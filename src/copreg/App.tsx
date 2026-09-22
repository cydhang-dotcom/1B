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
import type { PhoneVerification } from './verification';
import {
  clearPlanDraft,
  clearPlanRecord,
  clearPlanReport,
  loadPlanDraft,
  savePlanForm,
  savePlanRecord,
  savePlanReport,
  type PlanRecord
} from './planDraft';
import {
  PAID_HASH,
  advanceOnPaid,
  hashClaimsPaid,
  progressRouteOf,
  resolveStep,
  showsPaidView,
  stepHash,
  stepOfHash,
} from './stepRoute';
import { fetchPaymentStatus } from './paymentStatus';
import { createOrderStatusChecker, type OrderStatusChecker } from './orderStatusCheck';
import { PAY_HOST, WECHAT_NATIVE_CREATE_PATH, WECHAT_NATIVE_QUERY_PATH } from '../config/api';
import type { PayEndpoints } from '../payment/client';

/**
 * 支付端点：只有 React 这一层读 config/api.ts（它依赖 import.meta.env，是 Vite 专有的）。
 * 与 useWechatNativePay 里那份是同一组常量 —— `#paid` 的状态核实走的就是支付模块的查单接口，
 * 两个路径都填好之前 `#paid` 一律收口回 `#payment`（不会有人因为查不动被拦住）。
 */
const PAY_ENDPOINTS: PayEndpoints = {
  host: PAY_HOST,
  createPath: WECHAT_NATIVE_CREATE_PATH,
  queryPath: WECHAT_NATIVE_QUERY_PATH
};

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
 * 由第 5 步「企业注册申报资料填报」在提交时回写（见 RegistrationDetailsStep 的 handleSubmit）。
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

/**
 * 第 5 步的申报资料是否已提交。第 5 步把整份申报表存进 localStorage（键见 registration/defaultData），
 * 提交状态写在那份存档里。落点判断要在 state 之前用它，所以抽成模块级函数。
 */
const readDetailsSubmitted = (): boolean => {
  try {
    const saved = localStorage.getItem(REGISTRATION_STORAGE_KEY);
    if (!saved) return false;
    const parsed = JSON.parse(saved) as { status?: string };
    return parsed.status === 'submitted';
  } catch {
    return false;
  }
};

export default function App() {
  // 上次留下的本地存档（见 planDraft.ts，分「填写的」「返回的」「委托单凭据」三份键）：
  // 有「返回的」（诊断结果）就落到第 2 步 —— 问卷答案、套餐与方案内容都还在；
  // 有「委托单凭据」（第 1 步给的 recordId）再往前一步，直接落到第 3 步（协议与支付）。
  // 只在首帧读一次，之后一切以 state 为准。
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

  // 委托单凭据（第 1 步诊断接口返回的 recordId）：有它就能直接进第 3 步，下单与查单都用它。
  // 提交新问卷 / 重置问卷会作废它（旧单号是上一份问卷建的单）。
  const [planRecord, setPlanRecord] = useState<PlanRecord | null>(planDraft?.record ?? null);

  // 首屏落在哪一步：先按本地存档算出「本来该在哪」（有委托单号 = 第 3 步，
  // 拿到过接口返回的诊断结果 = 第 2 步），再看地址栏有没有 hash 请求别的步骤 —— hash 只是请求，
  // 没解锁的步骤会被收口回这一步（见 stepRoute.ts，以及下面同步 hash 的两个 effect）
  // 刷新时的落点由**已知进度**决定，而且从后往前判断：申报资料已提交 > 订单已支付 >
  // 拿到过委托单号 > 拿到过诊断结果。只按「有委托单号」就落到第 3 步是错的 —— 那会把已经填完申报资料
  // 的人送回支付页；只看「有问卷存档」就落到第 2 步同样是错的 —— 方案页的内容来自诊断接口，
  // 只填了一半问卷（或诊断失败/超时）时进去只有本地模板。订单是否已支付只有异步查单才知道，
  // 所以首帧先按本地证据算，查回来后由下面的核实 effect 解锁服务群。
  const { landing: fallbackStep, unlocked: initialUnlocked } = progressRouteOf({
    hasPlanReport: planDraft?.report != null,
    hasRecord: planRecord !== null,
    orderPaid: false,
    detailsSubmitted: readDetailsSubmitted(),
  });
  const initialStep = resolveStep(stepOfHash(window.location.hash), initialUnlocked, fallbackStep);

  if (import.meta.env.DEV) {
    // 落点决策只在首帧算一次，出问题时必须能一眼看出卡在哪条证据上（本地凭据缺失 / 过期最容易被误判）
    console.info('[copreg] 首屏落点', {
      hash: window.location.hash,
      请求的步骤: stepOfHash(window.location.hash),
      有问卷存档: planDraft !== null,
      有诊断结果: planDraft?.report != null,
      有委托单号: planRecord !== null,
      申报资料已提交: readDetailsSubmitted(),
      解锁: initialUnlocked.join(','),
      落点: initialStep,
    });
  }

  const [currentStep, setCurrentStep] = useState<ProcessStep>(initialStep);
  /** 首帧落点：异步查回「已支付」时用它判断用户是不是还停在原地（没自己走动过） */
  const initialStepRef = useRef<ProcessStep>(initialStep);
  const [unlockedSteps, setUnlockedSteps] = useState<ProcessStep[]>(initialUnlocked);

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
  const [isDetailsSubmitted, setIsDetailsSubmitted] = useState<boolean>(readDetailsSubmitted);

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
  // ---------------------------------------------------------------- URL hash
  // 步骤 ↔ 地址栏保持同步：刷新 / 收藏 / 转发能回到同一步，浏览器前进后退也能按步走。
  // 两个 effect 一个「写」一个「读」，互相不会打架：写之前先比一次 hash，
  // 读回来的步骤与当前一致时 setState 是同一个值，React 直接跳过。
  //
  // 唯一需要等一等的是 `#paid`：它声称「已支付」，而支付状态只有服务端知道。
  // 首帧先拿委托单号去查（下面那个 effect），结论出来之前**不写地址栏**，
  // 否则会把 #paid 先改成 #payment、查到已支付再改回来，地址栏白闪两下。
  const [paidCheck, setPaidCheck] = useState<'idle' | 'checking' | 'done'>('idle');
  const isPaidOrder = order.status === 'paid';
  /**
   * 第 3 步该显示哪一个界面：查单说已支付，或者**申报资料已提交**（填报页只有支付成功页的
   * 入口能进，所以那本身就说明付过款了）。地址栏写 `#paid`、第 3 步渲染支付成功界面都用它 ——
   * 刷新时不必等查单，不会先闪一屏「待支付」。
   */
  const paidView = showsPaidView(isPaidOrder, isDetailsSubmitted);

  const skipFirstHashWrite = useRef(true);
  useEffect(() => {
    if (paidCheck === 'checking') return; // 核实中，地址栏先不动
    // 已支付的支付页有自己的 hash（#paid）；其余情况按当前步骤的 hash
    const target = paidView && currentStep === 'payment' ? PAID_HASH : stepHash(currentStep);
    if (skipFirstHashWrite.current) {
      // 首帧只做规范化（例如地址栏是 #progress 但实际只能到第 1 步）：用 replace，
      // 不给自己多塞一条历史，否则用户按后退会退回到同一个页面
      skipFirstHashWrite.current = false;
      if (window.location.hash !== target) window.history.replaceState(null, '', target);
      return;
    }
    // 之后每换一步压一条历史，后退就是退回上一步
    if (window.location.hash !== target) window.location.hash = target;
  }, [currentStep, paidView, paidCheck]);

  useEffect(() => {
    const onHashChange = () => {
      const requested = stepOfHash(window.location.hash);
      // `#paid` 不是「请求哪一步」而是「声称已支付」：本次会话里没确认过已支付就不认，
      // 改回真实步骤（下一次刷新时首帧核实会再给一次机会）。
      // 申报资料已提交的人按支付成功界面算（见 showsPaidView），所以这种人也认 `#paid`
      if (hashClaimsPaid(window.location.hash) && !paidView) {
        window.history.replaceState(null, '', stepHash(stepRef.current));
        return;
      }
      // 认不出的 hash、或还没解锁的步骤：留在原地，并把地址栏改回真实步骤 ——
      // 地址栏与页面必须一致，否则复制出去的链接会把别人带到空壳页面
      if (requested === null || !unlockedSteps.includes(requested)) {
        window.history.replaceState(null, '', stepHash(stepRef.current));
        return;
      }
      if (requested === stepRef.current) return;
      setCurrentStep(requested);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [unlockedSteps, paidView]);

  // 订单状态核实：只要手上有委托单号、而且还不知道这笔已支付，就问一次服务端。两件事都靠它：
  //   ① 地址栏是 `#paid` 时能不能真的显示「支付成功」；
  //   ② **刷新后落回「待支付」、但订单其实早就付过了** —— 不问这一下，用户一点「立即支付」
  //      就会被服务端以「当前订单已完成支付，或请联系客服」拒掉（本地单号丢失时最容易撞上）。
  // 查不动（路径没配 / 超时 / 网络不通 / 响应认不出）一律当没付：收口回 `#payment`，用户照常付款。
  // 闸门要在 StrictMode 的「挂载 → 清理 → 再挂载」下也成立：同一个单据号复用同一个请求，
  // 第一轮的结果虽然被取消丢弃，第二轮仍会拿到同一个 promise 并落地（详见 orderStatusCheck.ts）
  const statusCheckerRef = useRef<OrderStatusChecker | null>(null);
  if (statusCheckerRef.current === null) {
    statusCheckerRef.current = createOrderStatusChecker((recordId: string) =>
      fetchPaymentStatus(PAY_ENDPOINTS, recordId)
    );
  }

  useEffect(() => {
    if (isPaidOrder) return;
    const pending = statusCheckerRef.current!.check(planRecord?.recordId ?? '');
    if (pending === null) return; // 空号 / 已核实过：不发请求

    let cancelled = false;
    setPaidCheck('checking');
    pending.then(result => {
      if (cancelled) return;
      if (result.status === 'paid') {
        setOrder(prev => ({
          ...prev,
          status: 'paid',
          // 服务端给了单号 / 支付时间 / 手机号就用它的；没给就留空，不自己编。
          // 手机号按约定不落本地，重新进入页面时只能从查单回答里补回来
          orderNo: result.orderNo ?? prev.orderNo,
          paidAt: result.paidAt ?? prev.paidAt,
          contactPhone: result.mobile ?? prev.contactPhone
        }));
        unlockStep('group'); // 已支付 = 服务群本来就该解锁

        // 首帧算落点时还不知道这笔已支付，可能先落在了第 2 步；查回来后把人补到
        // 「支付成功」界面 —— 只在他还停在首帧那一步时补（自己走开过就不动他）。
        const advanced = advanceOnPaid(stepRef.current, initialStepRef.current, {
          userNavigated: stepRef.current !== initialStepRef.current
        });
        if (advanced !== null) {
          setCurrentStep(advanced);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }
      setPaidCheck('done');
    });
    return () => {
      cancelled = true;
    };
  }, [planRecord, isPaidOrder]);

  // Helper to unlock step
  const unlockStep = (step: ProcessStep) => {
    if (!unlockedSteps.includes(step)) {
      setUnlockedSteps(prev => [...prev, step]);
    }
  };

  // Step 1: Submit Survey -> S-->>U: 生成注册方案与服务报价
  /**
   * 手机验证通过后提交问卷：调架构诊断接口（带上手机号与短信凭据，服务端比对验证码）。
   *
   * 失败**原样抛出**（不吞、不用本地规则兜底）：手机号没验过就不该出方案、更不该往下一步走，
   * 由 SurveyStep 把原因写在手机验证弹框里让人原地重试。只有本地存档写不进去这类
   * 「不拦人前进」的毛病才走 warnings。
   */
  const handleSurveySubmit = async (verification: PhoneVerification) => {
    // 载荷用的是点击那一刻的问卷快照 —— 请求在途时用户还能接着改问卷，
    // 那些改动要重新点一次「生成需求方案」才会进方案。
    // 提示攒着：本地存不下、诊断结果存不下都可能发生，最后合成一条说，别让后一条把前一条顶掉。
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
    // 委托单凭据同理：旧单号是上一份问卷建的，新问卷一提交就不再代表当前方案。
    // 不清掉的话，用户改完问卷反而会被直接送进支付页，支付的是旧单
    clearPlanRecord();
    setPlanRecord(null);

    // 远程诊断不再有本地兜底：手机号与短信验证码就压在这次请求里，服务端比对通过才算数。
    // 失败（含验证码不对 / 超时 / 服务端不可用）原样抛回 SurveyStep，弹框不关、可原地重试 ——
    // 手机没验过就不该出方案，也不该往下一步走。存档写不进去那几条 warning 先说出来
    // （下面这次请求可能直接抛回去，那时就没机会再报了）
    if (warnings.length > 0) setNotice(warnings.join('；'));
    const { recordId, suggestion } = await generatePlanReport(survey, verification);

    setPlanSuggestion(suggestion);

    // 「返回的」只在接口成功后存：它和上面那份问卷是配套的，下次进来靠它把诊断结果叠回方案上。
    // 提示是追加不是覆盖：前面那条「问卷没存下」同样重要
    if (!savePlanReport(suggestion)) {
      setNotice([...warnings, '诊断结果本地保存失败，下次进入需要重新生成方案'].join('；'));
    }

    // 手机号已经验过了：记在订单上，支付页的「经办联系电话」直接用它（手机号按约定不落本地，
    // 刷新后由查单响应里的 mobile 补回来）
    setOrder(prev => ({ ...prev, contactPhone: verification.mobile }));

    // 委托单号（诊断接口同一次响应里给的，服务端那时就建好单了）：支付下单与查单都用它，
    // 存不下就得说 —— 丢了它下次进来要重新生成方案
    const record: PlanRecord = { recordId };
    setPlanRecord(record);
    if (!savePlanRecord(record)) {
      setNotice('委托单号本地保存失败，下次进入需要重新生成方案');
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
  };

  // Step 2 -> Step 3: 方案页只是把第 1 步给的结果展示出来，点「前往支付」就走一步，
  // **这一页没有任何接口调用**（手机号与委托单号都是第 1 步的事了）
  const handleProposalProceed = () => {
    unlockStep('payment');
    setCurrentStep('payment');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Step 3: Payment Success -> S-->>C: 同步已确认订单 & unlock Service Group
  const handlePaymentSuccess = () => {
    unlockStep('group');
  };

  // Proceed from Payment to Fill Details —— 付款后该做的是填申报资料（第 5 步）。
  // 不再从 #paid 引流到第 4 步服务群：服务群仍在导航里可直达，只是不再是主按钮。
  // 服务群页面里的入口也走这个函数
  const handleProceedToFillDetails = () => {
    unlockStep('fill_details');
    setCurrentStep('fill_details');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Step 5: Submit details for review -> 跳转到「服务进度状态与办理清单」页
  const handleSubmitForReview = () => {
    setIsDetailsSubmitted(true);
    // 第 6 步仍然解锁（进度页要能进：刷新落点也是它），但**提交成功回的是支付成功页**
    // （#paid）—— 那一页的「服务进度状态与办理清单」会立刻变成「资料已提交 · 专员初审中」，
    // 并给出「查看/修改申报资料」入口，比直接甩到进度时间线更像「刚提交完该看的东西」
    unlockStep('progress');
    setCurrentStep('payment');
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
            contactPhone={order.contactPhone}
            onReset={() => {
              // 重置问卷 = 第 1 步的存档作废，否则刷新一下又跳回第 2 步、看的还是上一份问卷的方案
              clearPlanDraft();
              setPlanRecord(null);
              setPlanSuggestion(null);
            }}
          />
        )}

        {currentStep === 'proposal' && (
          <ProposalStep
            plan={plan}
            survey={survey}
            recordId={planRecord?.recordId ?? ''}
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
            busUnionId={planRecord?.recordId ?? ''}
            onUpdateOrder={setOrder}
            onPaymentSuccess={handlePaymentSuccess}
            onProceedToFillDetails={handleProceedToFillDetails}
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
            busUnionId={planRecord?.recordId ?? ''}
            isDetailsSubmitted={isDetailsSubmitted}
            paidView={paidView}
            onUpdateOrder={setOrder}
            onPaymentSuccess={handlePaymentSuccess}
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
            survey={survey}
            plan={plan}
            contactPhone={order.contactPhone}
            busUnionId={planRecord?.recordId ?? ''}
            onUpdateDetails={setDetails}
            onSubmitForReview={handleSubmitForReview}
            onBackToPaid={() => {
              // 回到第 3 步的支付成功界面（order 已支付时 hash 会写成 #paid）：办理清单在那一页上。
              // 服务群（#group）仍然解锁，只是不再是填报页的返回目标
              unlockStep('payment');
              setCurrentStep('payment');
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
