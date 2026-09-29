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
import { registrationStorageKey } from './registration/defaultData';
import { buildPlan } from './plan';
import { addonsOf, quoteFor } from './components/proposalQuote';
import { applyPlanSuggestion, generatePlanReport, PlanSuggestion } from './planGenerate';
import type { PhoneVerification } from './verification';
import {
  clearPlanDraftFor,
  clearPlanRecordFor,
  clearPlanReportFor,
  loadPlanDraftFor,
  savePlanFormFor,
  savePlanRecordFor,
  savePlanReportFor,
  type PlanRecord
} from './planDraft';
import {
  addApplication,
  createApplication,
  defaultApplicationName,
  deriveApplicationName,
  discardApplication,
  ensureApplicationsState,
  findApplication,
  MULTI_APPLICATION_ENABLED,
  patchOrderSummary,
  renameApplication,
  setActiveApplication,
  updateApplication,
  writeApplicationsState,
  type ApplicationRecord,
  type ApplicationsState,
  type OrderSummaryPatch,
} from './applications';
import {
  PAID_HASH,
  advanceOnPaid,
  showsPaidView,
  stepHash,
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

const emptyOrder = (amount: number): PaymentOrder => ({
  orderNo: '',
  createdAt: '',
  amount,
  paymentMethod: 'wechat',
  status: 'pending',
  contactName: '',
  contactPhone: '',
  receiptNumber: '',
  invoiceTitle: ''
});

/**
 * 一个主体的**运行时状态**（内存里的活跃视图）。
 *
 * 持久化的只有「填写的」（问卷 + 套餐 + 自选项）、诊断结果、委托单号与申报表 —— 都在
 * 各主体自己的键里（见 applications.ts）。方案在这里现算（报价改版后回来看到的是新价），
 * 订单详情、服务群消息、进度时间线这些要么由服务端查回来、要么本来就是演示态，不落盘。
 */
interface AppRuntime {
  survey: SurveyData;
  plan: RegistrationPlan;
  suggestion: PlanSuggestion | null;
  record: PlanRecord | null;
  order: PaymentOrder;
  details: RegistrationDetails;
  messages: ChatMessage[];
  timeline: TimelineNode[];
  reviewBranch: ReviewBranch;
  bankBooked: boolean;
}

/** 按主体的存档重建一份运行时状态（切主体 / 刷新时都走它） */
const runtimeFromApplication = (app: ApplicationRecord): AppRuntime => {
  const draft = loadPlanDraftFor(app.id);
  const suggestion = draft?.report ?? null;
  const survey = draft?.survey ?? emptySurvey();
  const plan = draft
    ? applyPlanSuggestion(
        buildPlan(survey, quoteFor(draft.tier, draft.addons.map((addon) => addon.id))),
        suggestion
      )
    : buildPlan(emptySurvey(), quoteFor('bundle_small'));

  return {
    survey,
    plan,
    suggestion,
    record: draft?.record ?? null,
    // 订单详情接口才有；本地只留摘要（状态 / 单号 / 支付时间 / 手机号 / 金额）
    order: {
      ...emptyOrder(plan.finalPrice),
      status: app.order.status,
      orderNo: app.order.orderNo,
      paidAt: app.order.paidAt,
      contactPhone: app.order.contactPhone,
    },
    details: emptyRegistrationDetails(),
    messages: INITIAL_CHAT_MESSAGES,
    timeline: INITIAL_TIMELINE_NODES,
    reviewBranch: 'complete',
    bankBooked: false,
  };
};

/** 删掉某个主体的申报表草稿（作废主体时用） */
const removeRegistrationDraft = (appId: string): void => {
  try {
    window.localStorage.removeItem(registrationStorageKey(appId));
  } catch {
    /* 删不掉也无妨：主体已经不在列表里，不会被再读到 */
  }
};

/**
 * 从主体的存档里现算「套餐名 + 报价」，用来回填摘要。
 *
 * 顶栏下拉每条要显示「套餐: X · ¥Y」，而 `tierName` 是后加进摘要的：早于它的存档
 * （含单主体时代迁移过来的）里是空的，列表就会显示「套餐待生成」—— 明明方案早就生成、
 * 甚至已经付过款。启动时按每份存档现算一次补上（最多 5 个主体，代价很小）。
 */
const orderSummaryOf = (appId: string): OrderSummaryPatch | null => {
  const draft = loadPlanDraftFor(appId);
  if (!draft) return null;
  const quote = quoteFor(draft.tier, draft.addons.map((addon) => addon.id));
  return { tierName: quote.tierName, amount: quote.finalPrice };
};

export default function App() {
  /**
   * 首帧：读主体列表 → 没有就按老存档迁移成「主体 #1」→ 再没有就建一个空白主体。
   * 连空白主体都存不下（隐私模式 / 配额满）时退回内存里的一份，并提示「本次填写不会被保存」。
   */
  const bootstrapRef = useRef<{ state: ApplicationsState; notice: string | null } | null>(null);
  if (bootstrapRef.current === null) {
    const ensured = typeof window === 'undefined' ? null : ensureApplicationsState(window.localStorage);
    if (ensured === null) {
      const fresh = createApplication(Date.now(), 0);
      bootstrapRef.current = {
        state: { applications: [fresh], activeAppId: fresh.id },
        notice: '本地存档不可用（浏览器可能禁用了本地存储），本次填写不会被保存',
      };
    } else {
      // 回填早期存档缺的「套餐 / 金额」摘要：顶栏下拉要拿它显示「套餐: X · ¥Y」
      let state = ensured.state;
      for (const app of state.applications) {
        const patch = orderSummaryOf(app.id);
        if (patch) state = patchOrderSummary(state, app.id, patch);
      }
      if (state !== ensured.state) writeApplicationsState(window.localStorage, state);
      bootstrapRef.current = { state, notice: null };
    }
  }

  const [apps, setApps] = useState<ApplicationsState>(bootstrapRef.current.state);
  // 每个主体一份运行时；切到没加载过的主体时按它的存档现建
  const [runtimes, setRuntimes] = useState<Record<string, AppRuntime>>(() => {
    const initial = bootstrapRef.current!.state;
    const active = initial.applications.find((app) => app.id === initial.activeAppId) ?? initial.applications[0];
    return { [active.id]: runtimeFromApplication(active) };
  });

  const activeApp = findApplication(apps, apps.activeAppId) ?? apps.applications[0];
  const activeIndex = apps.applications.findIndex((app) => app.id === activeApp.id);
  const runtime = runtimes[activeApp.id] ?? runtimeFromApplication(activeApp);

  /** 主体列表落盘（含 activeAppId） */
  useEffect(() => {
    writeApplicationsState(window.localStorage, apps);
  }, [apps]);

  /** 切到没加载过的主体时，按它的存档补一份运行时 */
  useEffect(() => {
    setRuntimes((prev) =>
      prev[activeApp.id] ? prev : { ...prev, [activeApp.id]: runtimeFromApplication(activeApp) }
    );
  }, [activeApp.id]);

  const updateRuntime = (updater: (current: AppRuntime) => AppRuntime) => {
    setRuntimes((prev) => ({
      ...prev,
      [activeApp.id]: updater(prev[activeApp.id] ?? runtimeFromApplication(activeApp)),
    }));
  };

  /** 改当前主体那一条（步骤 / 解锁 / 订单摘要 / 名称 / 是否已提交） */
  const updateActiveApp = (updater: (app: ApplicationRecord) => ApplicationRecord) => {
    setApps((prev) => updateApplication(prev, prev.activeAppId, updater));
  };

  const { survey, plan, suggestion: planSuggestion, record: planRecord, order, details, messages, timeline, reviewBranch, bankBooked } = runtime;

  /**
   * 当前步骤与解锁范围都在主体记录里（持久化），所以「刷新回到哪一步」和「切主体」
   * 用的是同一份数据 —— 不用再在首帧按证据算一次落点（迁移/新建时已经算好了）。
   */
  const currentStep = activeApp.currentStep;
  const unlockedSteps = activeApp.unlockedSteps;
  const isDetailsSubmitted = activeApp.isDetailsSubmitted;

  // 跨页提示：问卷页点「生成需求方案」后要跳到方案页，问卷页自己的 toast 会随组件卸载，
  // 所以方案接口失败的提示放在 App 这一层，几秒后自己消失。
  const [notice, setNotice] = useState<string | null>(bootstrapRef.current.notice);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  // 当前步骤与方案的镜像：方案接口最长要等 5 分钟（apiClient 的超时），回来时得知道人是不是还停在问卷页、
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

  if (import.meta.env.DEV) {
    // 落点现在是「主体记录里的 currentStep」，出问题时能一眼看出卡在哪条证据上
    console.info('[copreg] 当前主体', {
      主体数: apps.applications.length,
      当前主体: activeApp.id,
      主体名: activeApp.name,
      当前步骤: currentStep,
      有诊断结果: planSuggestion !== null,
      有委托单号: planRecord !== null,
      申报资料已提交: isDetailsSubmitted,
    });
  }

  /** 首帧落点：异步查回「已支付」时用它判断用户是不是还停在原地（没自己走动过） */
  const initialStepRef = useRef(currentStep);
  useEffect(() => {
    // 切主体相当于换了一份申请：把「首帧落点」重置成这个主体的当前步
    initialStepRef.current = currentStep;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeApp.id]);

  const setCurrentStep = (step: ProcessStep) => {
    updateActiveApp((app) => ({ ...app, currentStep: step }));
  };

  // Helper to unlock step
  const unlockStep = (step: ProcessStep) => {
    updateActiveApp((app) =>
      app.unlockedSteps.includes(step) ? app : { ...app, unlockedSteps: [...app.unlockedSteps, step] }
    );
  };

  /* ---------------------------------------------------------------- URL hash */
  // 步骤 ↔ 地址栏保持同步。地址栏**只读**：它只反映「当前主体在哪一步」，不接受手敲 /
  // 前进后退来跳步（见下面两个 effect）。hash 里**不带主体 id** —— 切主体时地址栏会跟着
  // 改成新主体的步骤，刷新按本地记的 activeAppId 回到上次那个主体。
  //
  // 唯一需要等一等的是 `#paid`：它声称「已支付」，而支付状态只有服务端知道。
  // 首帧先拿委托单号去查（下面那个 effect），结论出来之前**不写地址栏**，
  // 否则会把 #paid 先改成 #payment、查到已支付再改回来，地址栏白闪两下。
  const [paidCheck, setPaidCheck] = useState<'idle' | 'checking' | 'done'>('idle');
  const isPaidOrder = activeApp.order.status === 'paid' || order.status === 'paid';
  /**
   * 第 3 步该显示哪一个界面：查单说已支付，或者**申报资料已提交**（填报页只有支付成功页的
   * 入口能进，所以那本身就说明付过款了）。地址栏写 `#paid`、第 3 步渲染支付成功界面都用它 ——
   * 刷新时不必等查单，不会先闪一屏「待支付」。
   */
  const paidView = showsPaidView(isPaidOrder, isDetailsSubmitted);

  useEffect(() => {
    if (paidCheck === 'checking') return; // 核实中，地址栏先不动
    // 已支付的支付页有自己的 hash（#paid）；其余情况按当前步骤的 hash
    const target = paidView && currentStep === 'payment' ? PAID_HASH : stepHash(currentStep);
    if (window.location.hash !== target) window.history.replaceState(null, '', target);
  }, [currentStep, paidView, paidCheck]);

  // 有人动了地址栏（手敲、或浏览器的前进/后退）→ 立刻改回当前步骤，页面不动。
  // replaceState 不会再触发 hashchange，所以不会打架。
  useEffect(() => {
    const restoreHash = () => {
      const target = paidView && currentStep === 'payment' ? PAID_HASH : stepHash(currentStep);
      if (window.location.hash !== target) window.history.replaceState(null, '', target);
    };
    window.addEventListener('hashchange', restoreHash);
    return () => window.removeEventListener('hashchange', restoreHash);
  }, [currentStep, paidView]);

  /* ------------------------------------------------------------ 订单状态核实 */
  // 只要手上有委托单号、而且还不知道这笔已支付，就问一次服务端。两件事都靠它：
  //   ① 地址栏是 `#paid` 时能不能真的显示「支付成功」；
  //   ② **刷新后落回「待支付」、但订单其实早就付过了** —— 不问这一下，用户一点「立即支付」
  //      就会被服务端以「当前订单已完成支付，或请联系客服」拒掉。
  // 查不动（路径没配 / 超时 / 网络不通 / 响应认不出）一律当没付：收口回 `#payment`，用户照常付款。
  // 闸门要在 StrictMode 的「挂载 → 清理 → 再挂载」下也成立（见 orderStatusCheck.ts）。
  // 多主体：**每个委托单号一个 checker**（各自单飞），切主体互不影响，也不会重复查同一个单号。
  const checkersRef = useRef(new Map<string, OrderStatusChecker>());
  const checkerFor = (recordId: string): OrderStatusChecker => {
    let checker = checkersRef.current.get(recordId);
    if (!checker) {
      checker = createOrderStatusChecker((id: string) => fetchPaymentStatus(PAY_ENDPOINTS, id));
      checkersRef.current.set(recordId, checker);
    }
    return checker;
  };

  // 换主体相当于换了一笔单：核实状态从头开始（否则新主体会被上一个主体的结论挡着）
  useEffect(() => {
    setPaidCheck('idle');
  }, [activeApp.id]);

  useEffect(() => {
    if (isPaidOrder) return;
    const recordId = planRecord?.recordId ?? '';
    const pending = checkerFor(recordId).check(recordId);
    if (pending === null) return; // 空号 / 已核实过：不发请求

    let cancelled = false;
    setPaidCheck('checking');
    pending.then(result => {
      if (cancelled) return;
      if (result.status === 'paid') {
        updateRuntime(current => ({
          ...current,
          order: {
            ...current.order,
            status: 'paid',
            // 服务端给了单号 / 支付时间 / 手机号就用它的；没给就留空，不自己编。
            // 手机号按约定不落本地，重新进入页面时只能从查单回答里补回来
            orderNo: result.orderNo ?? current.order.orderNo,
            paidAt: result.paidAt ?? current.order.paidAt,
            contactPhone: result.mobile ?? current.order.contactPhone
          }
        }));
        updateActiveApp(app => ({
          ...app,
          order: {
            ...app.order,
            status: 'paid',
            orderNo: result.orderNo ?? app.order.orderNo,
            paidAt: result.paidAt ?? app.order.paidAt,
            contactPhone: result.mobile ?? app.order.contactPhone
          },
          unlockedSteps: app.unlockedSteps.includes('group') ? app.unlockedSteps : [...app.unlockedSteps, 'group']
        }));

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
  }, [planRecord, isPaidOrder, activeApp.id]);

  /* ------------------------------------------------------------ 主体管理 */

  const handleSwitchApplication = (id: string) => {
    setApps((prev) => setActiveApplication(prev, id));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddApplication = () => {
    // 多主体暂时屏蔽（开关在 applications.MULTI_APPLICATION_ENABLED）：顶栏已经没有入口，
    // 这里再兜一层，避免别处调用绕过去
    if (!MULTI_APPLICATION_ENABLED) {
      setNotice('多主体申请暂未开放，当前只能办理一个主体');
      return;
    }
    const result = addApplication(apps);
    if (!result.ok) {
      setNotice('最多只能同时申请 5 个主体，请先作废一个不用的');
      return;
    }
    setApps(result.state);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRenameApplication = (id: string, name: string) => {
    setApps((prev) => renameApplication(prev, id, name));
  };

  /**
   * 作废一个主体：**仅本地**（产品确认，不调接口），已支付的不让作废，最后一个作废后
   * 会自动补一个空白主体；同时清掉它的方案/申报表草稿。服务端那条委托单仍然存在 ——
   * 本地丢弃不等于撤单。
   */
  const handleDiscardApplication = (id: string) => {
    const target = findApplication(apps, id);
    const result = discardApplication(apps, id);
    if (result.ok === false) {
      setNotice(result.reason === 'paid' ? '已支付的申请不能作废' : '作废失败，请刷新后重试');
      return;
    }
    clearPlanDraftFor(id);
    removeRegistrationDraft(id);
    setRuntimes((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setApps(result.state);
    setNotice(`${target?.name ?? '该申请'}已作废（仅本地，服务端单据仍保留）`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* ---------------------------------------------------------------- 各步骤 */

  /**
   * 手机验证通过后提交问卷：调架构诊断接口（带上手机号与短信凭据，服务端比对验证码）。
   *
   * 失败**原样抛出**（不吞、不用本地规则兜底）：手机号没验过就不该出方案、更不该往下一步走，
   * 由 SurveyStep 把原因写在手机验证弹框里让人原地重试。只有本地存档写不进去这类
   * 「不拦人前进」的毛病才走 warnings。
   */
  const handleSurveySubmit = async (verification: PhoneVerification) => {
    const appId = activeApp.id;
    // 载荷用的是点击那一刻的问卷快照 —— 请求在途时用户还能接着改问卷，
    // 那些改动要重新点一次「生成需求方案」才会进方案。
    // 提示攒着：本地存不下、诊断结果存不下都可能发生，最后合成一条说，别让后一条把前一条顶掉。
    const warnings: string[] = [];

    // 套餐与加购取 planRef（请求在途时用户可能已经去方案页切过档）；价格只由前端报价决定
    const { selectedTier: tier, selectedAddons: addons } = planRef.current;

    // 「填写的」在**调接口之前**存：接口超时、不通、用户在等待时直接关掉页面，问卷都还能捞回来
    if (!savePlanFormFor(appId, { survey, tier, addons: addonsOf(planRef.current.items) })) {
      warnings.push('问卷本地保存失败（浏览器可能禁用了本地存储），下次进入需要重新填写');
    }
    // 上一次的诊断结果 / 委托单号对应的是上一份问卷，这次已提交新问卷，先作废
    clearPlanReportFor(appId);
    clearPlanRecordFor(appId);

    if (warnings.length > 0) setNotice(warnings.join('；'));
    const { recordId, suggestion } = await generatePlanReport(survey, verification);

    // 「返回的」只在接口成功后存
    if (!savePlanReportFor(appId, suggestion)) {
      setNotice([...warnings, '诊断结果本地保存失败，下次进入需要重新生成方案'].join('；'));
    }

    const record: PlanRecord = { recordId };
    if (!savePlanRecordFor(appId, record)) {
      setNotice('委托单号本地保存失败，下次进入需要重新生成方案');
    }

    // 按「本次问卷 + 当前套餐选择」重算一份，而不是把响应叠到旧方案上
    const merged = applyPlanSuggestion(buildPlan(survey, quoteFor(tier, addons)), suggestion);

    updateRuntime((current) => ({
      ...current,
      survey,
      plan: merged,
      suggestion,
      record,
      // 手机号已经验过了：记在订单上，支付页的「经办联系电话」直接用它
      order: { ...current.order, contactPhone: verification.mobile, amount: merged.finalPrice },
    }));

    updateActiveApp((app) => {
      // 主体名还是默认的（用户没改过）就顺手换成诊断给的企业名称
      const named =
        app.name === defaultApplicationName(activeIndex)
          ? { ...app, name: deriveApplicationName({ companyNameProposal: suggestion.companyNameProposal, companyDesc: survey.companyDesc }, activeIndex) }
          : app;
      // 导航与订单金额只在人还停在问卷页时更新：他已经自己走到方案页（或更后面）的话，
      // 把人拽回来、把套餐价改回套餐包价都是错的
      if (stepRef.current !== 'survey') {
        return {
          ...named,
          order: { ...named.order, contactPhone: verification.mobile, amount: merged.finalPrice, tierName: merged.tierName },
        };
      }
      return {
        ...named,
        currentStep: 'proposal',
        unlockedSteps: named.unlockedSteps.includes('proposal') ? named.unlockedSteps : [...named.unlockedSteps, 'proposal'],
        order: { ...named.order, contactPhone: verification.mobile, amount: merged.finalPrice, tierName: merged.tierName },
      };
    });
    if (stepRef.current === 'survey') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Step 2 -> Step 3: 方案页只是把第 1 步给的结果展示出来，点「前往支付」就走一步
  const handleProposalProceed = () => {
    unlockStep('payment');
    setCurrentStep('payment');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Step 3: Payment Success -> unlock Service Group（只动当前主体）
  const handlePaymentSuccess = () => {
    unlockStep('group');
  };

  // Proceed from Payment to Fill Details —— 付款后该做的是填申报资料（第 5 步）
  const handleProceedToFillDetails = () => {
    unlockStep('fill_details');
    setCurrentStep('fill_details');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Step 5: Submit details for review -> 回到「支付成功」界面看清单
  const handleSubmitForReview = () => {
    updateActiveApp((app) => ({
      ...app,
      isDetailsSubmitted: true,
      unlockedSteps: app.unlockedSteps.includes('progress') ? app.unlockedSteps : [...app.unlockedSteps, 'progress'],
      currentStep: 'payment',
    }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /** 某主体重置问卷：作废它的方案/单号存档（与迁移前的口径一致 —— 不动订单与解锁状态） */
  const handleResetSurvey = () => {
    clearPlanDraftFor(activeApp.id);
    updateRuntime((current) => ({
      ...current,
      survey: emptySurvey(),
      plan: buildPlan(emptySurvey(), quoteFor('bundle_small')),
      suggestion: null,
      record: null,
    }));
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

    updateRuntime((current) => ({ ...current, messages: [...current.messages, userMsg] }));

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

      updateRuntime((current) => ({ ...current, messages: [...current.messages, botReply] }));
    }, 600);
  };

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#0F172A] relative flex flex-col selection:bg-[#E6F7F2] selection:text-[#2AA894]">

      {/* Top Navbar：品牌（纯展示，不可点）+ 我的企业注册服务（多主体切换 / 新增 / 改名 / 作废） */}
      <TopNavbar
        applications={apps.applications}
        currentAppId={activeApp.id}
        onSwitchApplication={handleSwitchApplication}
        onAddApplication={handleAddApplication}
        onRenameApplication={handleRenameApplication}
        onDiscardApplication={handleDiscardApplication}
      />

      {/* Main Content Area */}
      <main className="relative z-10 flex-1">
        {currentStep === 'survey' && (
          <SurveyStep
            key={`${activeApp.id}-survey`}
            survey={survey}
            onChange={(nextSurvey) => updateRuntime((current) => ({ ...current, survey: nextSurvey }))}
            onSubmit={handleSurveySubmit}
            contactPhone={order.contactPhone}
            onReset={handleResetSurvey}
          />
        )}

        {currentStep === 'proposal' && (
          <ProposalStep
            key={`${activeApp.id}-proposal`}
            plan={plan}
            survey={survey}
            recordId={planRecord?.recordId ?? ''}
            locked={paidView}
            onUpdatePlan={(newPlan) => {
              // 方案页切套餐 / 勾加购会按本地模板重建一份方案，别把服务端给的行业诊断丢掉
              const merged = applyPlanSuggestion(newPlan, planSuggestion);
              updateRuntime((current) => ({
                ...current,
                plan: merged,
                order: { ...current.order, amount: merged.finalPrice },
              }));
              // 选过的档位与自选项也一起落盘（「返回的」那份不动）
              savePlanFormFor(activeApp.id, {
                survey,
                tier: merged.selectedTier,
                addons: addonsOf(merged.items),
              });
              updateActiveApp((app) => ({ ...app, order: { ...app.order, amount: merged.finalPrice, tierName: merged.tierName } }));
            }}
            onProceed={handleProposalProceed}
            onBack={() => {
              setCurrentStep('survey');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {(currentStep === 'agreement' || currentStep === 'payment') && (
          <AgreementAndPaymentStep
            key={`${activeApp.id}-payment`}
            appId={activeApp.id}
            plan={plan}
            order={order}
            busUnionId={planRecord?.recordId ?? ''}
            isDetailsSubmitted={isDetailsSubmitted}
            paidView={paidView}
            onUpdateOrder={(orderUpdater) => {
              updateRuntime((current) => ({
                ...current,
                order: typeof orderUpdater === 'function' ? orderUpdater(current.order) : orderUpdater,
              }));
            }}
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
            key={`${activeApp.id}-group`}
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
            key={`${activeApp.id}-fill-details`}
            appId={activeApp.id}
            details={details}
            survey={survey}
            plan={plan}
            contactPhone={order.contactPhone}
            busUnionId={planRecord?.recordId ?? ''}
            onUpdateDetails={(nextDetails) => updateRuntime((current) => ({ ...current, details: nextDetails }))}
            onSubmitForReview={handleSubmitForReview}
            onBackToPaid={() => {
              // 回到第 3 步的支付成功界面（order 已支付时 hash 会写成 #paid）：办理清单在那一页上
              unlockStep('payment');
              setCurrentStep('payment');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {currentStep === 'progress' && (
          <ProgressAndReviewStep
            key={`${activeApp.id}-progress`}
            timeline={timeline}
            plan={plan}
            details={details}
            order={order}
            onUpdateTimeline={(nextTimeline) => updateRuntime((current) => ({ ...current, timeline: nextTimeline }))}
            reviewBranch={reviewBranch}
            onUpdateReviewBranch={(branch) => updateRuntime((current) => ({ ...current, reviewBranch: branch }))}
            bankBooked={bankBooked}
            onUpdateBankBooked={(booked) => updateRuntime((current) => ({ ...current, bankBooked: booked }))}
            onGoToChat={() => {
              setCurrentStep('group');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}
      </main>

      {/* 跨页提示（方案接口失败、主体上限、作废结果等），样式与问卷页的 toast 一致 */}
      {notice && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 max-w-[92vw] px-4 py-2 rounded-full bg-slate-900 text-white text-xs font-semibold shadow-xl text-center">
          {notice}
        </div>
      )}

    </div>
  );
}
