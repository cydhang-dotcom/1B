/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  ProcessStep,
  SurveyData,
  RegistrationPlan,
  PaymentOrder,
  ChatMessage,
  RegistrationDetails,
  TimelineNode,
  ReviewBranch
} from './types';
import { TopNavbar } from './components/TopNavbar';
import { SurveyStep } from './components/SurveyStep';
import { ProposalStep } from './components/ProposalStep';
import { AgreementAndPaymentStep } from './components/AgreementAndPaymentStep';
import { ServiceGroupStep, INITIAL_CHAT_MESSAGES } from './components/ServiceGroupStep';
import { ProgressAndReviewStep, INITIAL_TIMELINE_NODES } from './components/ProgressAndReviewStep';
import { RegistrationDetailsStep } from './components/RegistrationDetailsStep';
import { STORAGE_KEY as REGISTRATION_STORAGE_KEY } from './registration/defaultData';
import { buildPlan } from './plan';
import { addonsOf, quoteFor } from './components/proposalQuote';
import { applyPlanSuggestion, generatePlanReport, PlanSuggestion } from './planGenerate';
import {
  clearPlanConfirm,
  clearPlanDraft,
  clearPlanReport,
  loadPlanDraft,
  savePlanConfirm,
  savePlanForm,
  savePlanReport
} from './planDraft';
import { isPlanConfirmStale, planConfirmWithSelection, type PlanConfirm } from './serviceConfirm';

/**
 * 空问卷：所有字段留空，等用户从零填写。
 * 这里不预置任何示例内容 —— 预置过的行业描述会被 buildPlan 当成用户输入，
 * 生成出一份用户从没选过的方案。
 */
const emptySurvey = (): SurveyData => ({
  coreNeeds: [],
  companyDesc: '',
  bizDesc: '',
  scope: [],
  license: [],
  sensitive: [],
  invoiceReq: '',
  monthlyAmount: '',
  revenue: [],
  revenueOther: '',
  shareholderType: [],
  shareholderCount: '',
  capitalRec: '',
  capitalAmount: '',
  regAddress: '',
  officeSpace: ''
});

/**
 * 空注册资料。
 *
 * 这张表是给「办理进度」页看的摘要（企业名称、法定代表人、收件地址、材料清单），
 * 由第 5 步「企业注册申报资料填报」在提交时回写（见 RegistrationDetailsStep 的 handleVerifySuccess）。
 * 还没提交时保持空壳，进度页对空值显示占位，不编造。
 *
 * docs 保留：那份清单是「要交哪些材料」的产品规格，不是用户数据；每条状态回到 pending。
 */
const emptyRegistrationDetails = (): RegistrationDetails => ({
  primaryName: '',
  backupName1: '',
  backupName2: '',
  industryCategory: '',
  registeredCapital: '',
  legalRepresentative: { name: '', idCard: '', phone: '', email: '' },
  supervisor: { name: '', idCard: '', phone: '' },
  financeOfficer: { name: '', idCard: '', phone: '' },
  shareholders: [],
  officeAddress: { region: '', detail: '', propertyType: '', area: '' },
  docs: [
    { id: 'doc-1', name: '法定代表人身份证人像面及国徽面', type: '身份证明文件', required: true, status: 'pending' },
    { id: 'doc-2', name: '监事及股东身份证扫描件', type: '身份证明文件', required: true, status: 'pending' },
    { id: 'doc-3', name: '经营场所使用证明（房产证明/租赁合同）', type: '住所合规文件', required: true, status: 'pending' },
    { id: 'doc-4', name: '全体投资人签署的企业设立申请与公司章程', type: '工商法定文书', required: true, status: 'pending' }
  ]
});

export default function App() {
  // 上次留下的本地存档（见 planDraft.ts，分「填写的」「返回的」「确认凭据」三份键）：
  // 有「填写的」就从第 2 步开始 —— 问卷答案与选过的套餐都还在；
  // 有「确认凭据」再往前一步，直接落到第 3 步（协议与支付），不必重新验证手机号；
  // 有「返回的」再把服务端诊断叠上去。只在首帧读一次，之后一切以 state 为准。
  const [planDraft] = useState(loadPlanDraft);

  // Proposal / Plan state (defaults to bundle_small: 小规模纳税人)
  // 空问卷生成的只是占位方案（行业内容全空，价格按套餐给），问卷提交时会重新生成；
  // 存档里存的是输入（问卷 + 套餐），方案在这里现算，所以报价改版后回来看到的是新价
  const [plan, setPlan] = useState<RegistrationPlan>(() =>
    planDraft
      ? applyPlanSuggestion(
          // 存档里的 addons 是对象数组（与服务端要的形状一致），算报价只需要它们的 id
          buildPlan(planDraft.survey, quoteFor(planDraft.tier, planDraft.addons.map(addon => addon.id))),
          planDraft.report
        )
      : buildPlan(emptySurvey(), quoteFor('bundle_small'))
  );

  // 确认凭据（confirm-proposal 返回的 recordId/status + 当时那套选择）：有它就能直接进第 3 步。
  // 改套餐 / 换自选项 / 重新提交问卷都会把它作废，见下面的 clearPlanConfirm 调用点。
  //
  // 首帧这里还要再判一次「是否仍是这套方案」：正常路径下写过 form 就会顺带清凭据，
  // 但两次 localStorage 写入之间崩溃、或存档被手改过，都可能留下「新问卷 + 旧凭据」，
  // 那会把人直接送进一份与自己填的问卷不符的支付页。
  const initialConfirm =
    planDraft?.confirm && !isPlanConfirmStale(planDraft.confirm, plan) ? planDraft.confirm : null;
  const [planConfirm, setPlanConfirm] = useState<PlanConfirm | null>(initialConfirm);

  const [currentStep, setCurrentStep] = useState<ProcessStep>(
    initialConfirm ? 'payment' : planDraft ? 'proposal' : 'survey'
  );
  const [unlockedSteps, setUnlockedSteps] = useState<ProcessStep[]>(
    initialConfirm ? ['survey', 'proposal', 'payment'] : ['survey', 'proposal']
  );

  // Core Survey state —— 有存档用存档，没有就从空问卷开始，用户填什么就是什么
  const [survey, setSurvey] = useState<SurveyData>(() => planDraft?.survey ?? emptySurvey());

  // Payment order state —— 订单号等支付成功后再生成，这里只留空壳
  const [order, setOrder] = useState<PaymentOrder>({
    orderNo: '',
    createdAt: '',
    amount: plan.finalPrice,
    paymentMethod: 'wechat',
    status: 'pending',
    contactName: '',
    contactPhone: '',
    receiptNumber: '',
    invoiceTitle: ''
  });

  // Service Group chat state —— 服务群保留为演示态，不随「从 0 填写」清空
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_CHAT_MESSAGES);

  // 登记信息（法定代表人、住所等）：第 5 步填报提交时回写（见 RegistrationDetailsStep），
  // 进度页与支付页的「服务进度状态与办理清单」都读它
  const [details, setDetails] = useState<RegistrationDetails>(emptyRegistrationDetails);

  /**
   * 申报资料是否已提交。第 5 步把整份申报表存进 localStorage（键见 registration/defaultData），
   * 提交状态就写在那份存档里 —— 刷新后据此恢复，否则支付页的清单会退回「第 1 步待填报」。
   */
  const [isDetailsSubmitted, setIsDetailsSubmitted] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(REGISTRATION_STORAGE_KEY);
      if (!saved) return false;
      const parsed = JSON.parse(saved) as { status?: string };
      return parsed.status === 'submitted';
    } catch {
      return false;
    }
  });

  // Timeline / Delivery progress state
  const [timeline, setTimeline] = useState<TimelineNode[]>(INITIAL_TIMELINE_NODES);

  // 进度页的演示态：资料审核分支与银行开户预约。
  // 和 timeline 一样放在 App —— 留在进度页组件里的话，切到别的步骤再回来就被重置了。
  const [reviewBranch, setReviewBranch] = useState<ReviewBranch>('complete');
  const [bankBooked, setBankBooked] = useState(false);

  // 跨页提示：问卷页点「生成需求方案」后要跳到方案页，问卷页自己的 toast 会随组件卸载，
  // 所以方案接口失败的提示放在 App 这一层，几秒后自己消失。
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  // 服务端给的方案建议。方案页切套餐 / 勾加购时会用本地方案重建一份，
  // 那份重建会把建议冲掉 —— 所以建议单独留在 App，每次重建后重新叠上去。
  // 本地存着上次成功返回的那份就先用着，重进页面不用再调一次接口。
  const [planSuggestion, setPlanSuggestion] = useState<PlanSuggestion | null>(
    planDraft?.report ?? null
  );

  // 当前步骤与方案的镜像：方案接口最长要等 60s，回来时得知道人是不是还停在问卷页、
  // 以及这期间他有没有改过套餐（顶栏能直接跳到方案页，那时候不该把人拽回来、
  // 也不该改他已经切好的套餐价）
  const stepRef = useRef(currentStep);
  useEffect(() => {
    stepRef.current = currentStep;
  }, [currentStep]);
  const planRef = useRef(plan);
  useEffect(() => {
    planRef.current = plan;
  }, [plan]);
  // 确认凭据也留一份镜像：方案页切套餐时要在回调里判「凭据是否已过期」，
  // 用 state 会被闭包锁在上一次渲染的值上
  const planConfirmRef = useRef(planConfirm);
  useEffect(() => {
    planConfirmRef.current = planConfirm;
  }, [planConfirm]);

  // 凭据里没记「是为哪套选择确认的」（手写的、或早于这次改动的版本写进去的，只有服务端
  // 给的 recordId/status）：这种凭据照样认，但要把当前选择补记上去 ——
  // 不补的话以后改套餐也判断不出过期，用户会拿着一份旧确认进支付页。
  useEffect(() => {
    if (!planConfirm) return;
    const filled = planConfirmWithSelection(planConfirm, plan);
    if (filled === planConfirm) return; // 已经有注解，不用动
    setPlanConfirm(filled);
    savePlanConfirm(filled);
  }, [planConfirm, plan]);

  // Helper to unlock step
  const unlockStep = (step: ProcessStep) => {
    if (!unlockedSteps.includes(step)) {
      setUnlockedSteps(prev => [...prev, step]);
    }
  };

  // Step 1: Submit Survey -> S-->>U: 生成注册方案与服务报价
  const handleSurveySubmit = async () => {
    // 载荷用的是点击那一刻的问卷快照 —— 请求在途时用户还能接着改问卷，
    // 那些改动要重新点一次「生成需求方案」才会进方案。
    // 提示攒着：接口失败与本地存不下都可能发生，最后合成一条说，别让后一条把前一条顶掉。
    const warnings: string[] = [];

    // 套餐与加购取 planRef（请求在途时用户可能已经去方案页切过档）；价格只由前端报价决定，
    // 跟诊断结果无关
    const { selectedTier: tier, selectedAddons: addons } = planRef.current;

    // 「填写的」在**调接口之前**存：接口超时、不通、用户在等待时直接关掉页面，问卷都还能捞回来。
    // 自选项存的是 addonsOf 派生出来的对象（id + 名称 + 实收价），与确认接口发出去的是同一批
    if (!savePlanForm({ survey, tier, addons: addonsOf(planRef.current.items) })) {
      warnings.push('问卷本地保存失败（浏览器可能禁用了本地存储），下次进入需要重新填写');
    }
    // 上一次成功返回的诊断结果对应的是上一份问卷，这次已经提交了新问卷，先作废；
    // 本次成功后再写新的（写不进去也不拦人，只是下次进来要重新生成）
    clearPlanReport();
    // 确认凭据同理：它是为上一份问卷 + 上一套选项确认的，新问卷一提交就不再代表当前方案。
    // 不清掉的话，用户改完问卷反而会被直接送进支付页，支付的是旧方案
    clearPlanConfirm();
    setPlanConfirm(null);

    let suggestion: PlanSuggestion | null = null;
    try {
      suggestion = await generatePlanReport(survey);
    } catch (error) {
      // 接口不通不拦人前进：本地方案本身就是完整可用的（价格、套餐只由前端报价决定），
      // 但也不静默降级 —— 把原因说出来，用户才知道这版方案的行业内容是本地规则给的。
      warnings.push(
        `${error instanceof Error ? error.message : '生成需求方案失败'}，已先按本地规则生成方案`
      );
    }

    setPlanSuggestion(suggestion);

    // 「返回的」只在接口成功后存：它和上面那份问卷是配套的，下次进来靠它把诊断结果叠回方案上
    if (suggestion !== null && !savePlanReport(suggestion)) {
      warnings.push('诊断结果本地保存失败，下次进入需要重新生成方案');
    }

    // 按「本次问卷 + 当前套餐选择」重算一份，而不是把响应叠到旧方案上：旧方案里还留着上一次
    // 诊断的结论，本次响应没给的字段（null = 没给）会让那些旧结论继续挂在那儿
    const merged = applyPlanSuggestion(buildPlan(survey, quoteFor(tier, addons)), suggestion);
    setPlan(merged);

    // 导航与订单金额只在人还停在问卷页时更新：他已经自己走到方案页（或更后面）的话，
    // 把人拽回来、把套餐价改回套餐包价都是错的
    if (stepRef.current === 'survey') {
      setOrder(prev => ({ ...prev, amount: merged.finalPrice }));
      unlockStep('proposal');
      setCurrentStep('proposal');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (warnings.length > 0) setNotice(warnings.join('；'));
  };

  // Step 2: Confirm Proposal -> Go to Payment (Merged Agreement & Payment)
  // confirm 只在这次点击真的调了确认接口、且服务端返回 SUCCESS 时非空；
  // 已经确认过再点一次（ProposalStep 里判断凭据仍然有效）传的是 null，不重复保存也不重复下单
  const handleProposalProceed = (phone: string | undefined, confirm: PlanConfirm | null) => {
    if (phone) {
      setOrder(prev => ({ ...prev, contactPhone: phone }));
    }
    if (confirm) {
      setPlanConfirm(confirm);
      if (!savePlanConfirm(confirm)) {
        // 凭据存不下不拦人（本次已经确认成功，能正常进支付），但要说清楚后果：
        // 下次进来会回到第 2 步，重新确认会在服务端多出一份委托单
        setNotice('确认结果本地保存失败，下次进入需要重新确认（可能产生重复委托单）');
      }
    }
    unlockStep('payment');
    setCurrentStep('payment');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Step 3: Payment Success -> S-->>C: 同步已确认订单 & unlock Service Group
  const handlePaymentSuccess = () => {
    unlockStep('group');
  };

  // Proceed from Payment to Service Group
  const handleProceedToGroup = () => {
    unlockStep('group');
    setCurrentStep('group');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Proceed from Service Group to Fill Details —— 服务群之后就是填报企业注册申报资料
  const handleProceedToFillDetails = () => {
    unlockStep('fill_details');
    setCurrentStep('fill_details');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Step 5: Submit details for review -> 跳转到「服务进度状态与办理清单」页
  const handleSubmitForReview = () => {
    setIsDetailsSubmitted(true);
    unlockStep('progress');
    setCurrentStep('progress');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handle chat message in Service Group
  const handleSendMessage = (text: string) => {
    const userMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      // 发言人取订单上的经办人；还没填就只说「我」，不假装一个名字
      sender: order.contactName ? `${order.contactName}（您）` : '我',
      role: 'customer',
      roleTag: '经办人',
      avatar: '👤',
      timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      content: text,
      isSelf: true
    };

    setMessages(prev => [...prev, userMsg]);

    // Intelligent automated reply
    setTimeout(() => {
      let replyContent = '';
      let replySender = '企服系统助手';
      let replyRole: 'ai' | 'advisor' | 'delivery' = 'ai';
      let replyTag = '7x24h 智能AI';
      let replyAvatar = '🤖';

      const lower = text.toLowerCase();

      if (lower.includes('现场') || lower.includes('到场') || lower.includes('面签')) {
        replySender = 'Lisa（资深企业顾问）';
        replyRole = 'advisor';
        replyTag = '专属顾问';
        replyAvatar = '👩‍💼';
        replyContent = '您放心！现在的设立流程已实现全流程政务网办。法定代表人与股东无需到任何政务大厅现场，只需在市监局审核后通过微信或支付宝小程序做人脸活体实名认证并签名即可！';
      } else if (lower.includes('5年') || lower.includes('实缴') || lower.includes('资本')) {
        replyContent = '根据2024年7月起施行的新《公司法》第四十七条：有限责任公司全体股东认缴的出资额由股东按照公司章程的规定自公司成立之日起五年内缴足。我们已根据您的预期，为您规划了合理合规的出资节奏。';
      } else if (lower.includes('章') || lower.includes('公章') || lower.includes('刻章')) {
        replySender = '张经理（交付团队主管）';
        replyRole = 'delivery';
        replyTag = '交付专员';
        replyAvatar = '👨‍💼';
        replyContent = '我们为您包含的全套印章为公安特行备案的芯片防伪印章（公章、财务章、发票章、合同章、法人私章）。执照下发后由公安指定刻章点刻制，章体内植入加密芯片防伪，具有完全法律效力！';
      } else if (lower.includes('开户') || lower.includes('银行')) {
        replyContent = '办理完营业执照与印章后，我们将为您预约合作商业银行（招商/工行/平安等）的绿色开户通道。您只需带上执照正本、公章三章、法人身份证原件前往即可，一般 1 个工作日内可启用账户及网银。';
      } else if (lower.includes('范围') || lower.includes('字号') || lower.includes('名字')) {
        replySender = 'Lisa（资深企业顾问）';
        replyRole = 'advisor';
        replyTag = '专属顾问';
        replyAvatar = '👩‍💼';
        replyContent = '字号建议由 2~4 个汉字组成，避免与同行业已有知名企业重名；经营范围将按照国家市场监督管理总局统一标准规范表述填写，您填报登记信息时可直接选用我们给的规范表述！';
      } else {
        replyContent = `收到您的咨询！专属交付专员与 AI 助手正在为您跟进。您的问题已同步记录在工单系统，若有需要也可以随时在群内沟通。`;
      }

      const botReply: ChatMessage = {
        id: 'msg-' + (Date.now() + 1),
        sender: replySender,
        role: replyRole,
        roleTag: replyTag,
        avatar: replyAvatar,
        timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        content: replyContent
      };

      setMessages(prev => [...prev, botReply]);
    }, 600);
  };

  // Calculate progress percentage dynamically
  const isCoreDone = survey.coreNeeds.length > 0;
  const isBizDone = survey.companyDesc.trim() !== '' && survey.bizDesc.trim() !== '';
  const isInvoiceDone = survey.invoiceReq !== '' && survey.monthlyAmount !== '' && survey.revenue.length > 0;
  const isEquityDone = survey.shareholderType.length > 0 && survey.shareholderCount !== '';
  const isCapitalDone = survey.capitalRec === '是' || (survey.capitalRec === '否' && survey.capitalAmount.trim() !== '');
  const isAddressDone = survey.regAddress !== '' && survey.officeSpace !== '';
  const doneCount = [isCoreDone, isBizDone, isInvoiceDone, isEquityDone, isCapitalDone, isAddressDone].filter(Boolean).length;

  let currentProgressPct = 9;
  if (currentStep === 'survey') {
    currentProgressPct = doneCount === 0 ? 9 : Math.max(9, Math.round((doneCount / 6) * 100));
  } else if (currentStep === 'proposal') {
    currentProgressPct = 35;
  } else if (currentStep === 'payment' || currentStep === 'agreement') {
    currentProgressPct = 60;
  } else if (currentStep === 'group') {
    currentProgressPct = 80;
  } else if (currentStep === 'fill_details') {
    currentProgressPct = 92;
  } else if (currentStep === 'progress') {
    currentProgressPct = 100;
  }

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#0F172A] relative flex flex-col selection:bg-[#E6F7F2] selection:text-[#2AA894]">

      {/* Top Navbar */}
      <TopNavbar
        currentStep={currentStep}
        onSelectStep={(step) => {
          if (unlockedSteps.includes(step)) {
            setCurrentStep(step);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }}
        unlockedSteps={unlockedSteps}
        progressPct={currentProgressPct}
      />

      {/* Main Content Area */}
      <main className="relative z-10 flex-1">
        {currentStep === 'survey' && (
          <SurveyStep
            survey={survey}
            onChange={setSurvey}
            onSubmit={handleSurveySubmit}
            onReset={() => {
              // 重置问卷 = 第 1 步的存档作废，否则刷新一下又跳回第 2 步、看的还是上一份问卷的方案
              clearPlanDraft();
              setPlanConfirm(null);
              setPlanSuggestion(null);
            }}
          />
        )}

        {currentStep === 'proposal' && (
          <ProposalStep
            plan={plan}
            survey={survey}
            report={planSuggestion}
            confirm={planConfirm}
            contactPhone={order.contactPhone}
            onUpdatePlan={(newPlan) => {
              // 方案页切套餐 / 勾加购会按本地模板重建一份方案，别把服务端给的行业诊断丢掉
              const merged = applyPlanSuggestion(newPlan, planSuggestion);
              setPlan(merged);
              setOrder(prev => ({ ...prev, amount: merged.finalPrice }));
              // 选过的档位与自选项也一起落盘，下次进来看到的还是他选的套餐（「返回的」那份不动）。
              // 自选项与确认接口同源：都是 addonsOf 从这份 merged 方案里派生出来的对象
              // 这里存不下不提示：切一次档就弹一条「本地保存失败」太吵，下次提交时会再说
              savePlanForm({
                survey,
                tier: merged.selectedTier,
                addons: addonsOf(merged.items)
              });
              // 方案改过（档位 / 自选项与确认时不同）→ 那份确认凭据作废：它代表的已经不是
              // 页面上这份方案了，继续用会把人送进一份与价格不符的支付页
              if (planConfirmRef.current && isPlanConfirmStale(planConfirmRef.current, merged)) {
                clearPlanConfirm();
                setPlanConfirm(null);
              }
            }}
            onProceed={handleProposalProceed}
            onBack={() => {
              setCurrentStep('survey');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {currentStep === 'agreement' && (
          <AgreementAndPaymentStep
            plan={plan}
            order={order}
            onUpdateOrder={setOrder}
            onPaymentSuccess={handlePaymentSuccess}
            onProceedToGroup={handleProceedToGroup}
            onBack={() => {
              setCurrentStep('proposal');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {currentStep === 'payment' && (
          <AgreementAndPaymentStep
            plan={plan}
            order={order}
            isDetailsSubmitted={isDetailsSubmitted}
            onUpdateOrder={setOrder}
            onPaymentSuccess={handlePaymentSuccess}
            onProceedToGroup={handleProceedToGroup}
            onProceedToFillDetails={handleProceedToFillDetails}
            onBack={() => {
              setCurrentStep('proposal');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {currentStep === 'group' && (
          <ServiceGroupStep
            plan={plan}
            order={order}
            messages={messages}
            onSendMessage={handleSendMessage}
            onProceedToFillDetails={handleProceedToFillDetails}
            onBackToPayment={() => {
              setCurrentStep('payment');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {currentStep === 'fill_details' && (
          <RegistrationDetailsStep
            details={details}
            onUpdateDetails={setDetails}
            onSubmitForReview={handleSubmitForReview}
            onBackToGroup={() => {
              setCurrentStep('group');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {currentStep === 'progress' && (
          <ProgressAndReviewStep
            timeline={timeline}
            plan={plan}
            details={details}
            order={order}
            onUpdateTimeline={setTimeline}
            reviewBranch={reviewBranch}
            onUpdateReviewBranch={setReviewBranch}
            bankBooked={bankBooked}
            onUpdateBankBooked={setBankBooked}
            onGoToChat={() => {
              setCurrentStep('group');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}
      </main>

      {/* 跨页提示（方案接口失败等），样式与问卷页的 toast 一致 */}
      {notice && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 max-w-[92vw] px-4 py-2 rounded-full bg-slate-900 text-white text-xs font-semibold shadow-xl text-center">
          {notice}
        </div>
      )}

    </div>
  );
}
