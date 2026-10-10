/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle } from 'lucide-react';
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
import { applyPlanSuggestion, generatePlanReport, modifyProposal, PlanSuggestion } from './planGenerate';
import type { PlanReport } from './planGenerate';
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
  applyPaidOrder,
  createApplication,
  defaultApplicationName,
  deriveApplicationName,
  discardApplication,
  ensureApplicationsState,
  findApplication,
  mergeApplicationsWrite,
  MULTI_APPLICATION_ENABLED,
  patchOrderSummary,
  readApplicationsState,
  renameApplication,
  setActiveApplication,
  suggestedContactPhone,
  updateApplication,
  writeApplicationsState,
  type ApplicationRecord,
  type ApplicationsState,
  type OrderSummaryPatch,
} from './applications';
import {
  PAID_HASH,
  advanceOnPaid,
  canPersistStep,
  clampPersistedStep,
  allowsFillDetailsIntent,
  openIntentOf,
  searchAfterOpenIntentUsed,
  showsPaidView,
  stepHash,
} from './stepRoute';
import { useShareUserUuid } from '../hooks/useShareUserUuid';
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
  /**
   * 这次是**从支付成功页的「申报资料填报」按钮新开的标签页**吗（`?open=fill-details`）？
   * 是的话：付过款就把落点直接定到第 5 步，并把这个参数抹掉（见下面那个挂载 effect）。
   */
  const deepLinkRef = useRef(false);
  /** 深链要落的步骤（只作为会话级浏览位置，见下面 viewStep 的注释） */
  const deepLinkStepRef = useRef<ProcessStep | null>(null);
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
      // 存档里可能留着超限的步骤（`fill_details` / `progress` 都是会话级浏览位置，本不该落盘）：
      // 读进来时收口回 payment —— 第 5 步只能从支付成功页进，不能靠存档直接落进去
      for (const app of state.applications) {
        if (!canPersistStep(app.currentStep)) {
          state = updateApplication(state, app.id, (item) => ({ ...item, currentStep: clampPersistedStep(item.currentStep) }));
        }
      }
      for (const app of state.applications) {
        const patch = orderSummaryOf(app.id);
        if (patch) state = patchOrderSummary(state, app.id, patch);
      }
      // 深链：`?open=fill-details` 只有在「已经付过款」时才认（否则这条链接就成了绕过支付的入口）
      const intent = typeof window === 'undefined' ? null : openIntentOf(window.location.search);
      if (intent !== null) {
        const target = state.applications.find((app) => app.id === state.activeAppId) ?? state.applications[0];
        if (allowsFillDetailsIntent(target.order.status === 'paid', target.isDetailsSubmitted)) {
          deepLinkRef.current = true;
          // **只记会话级浏览位置，不改落盘步骤**：登记的进度最大到 payment（见 canPersistStep）
          deepLinkStepRef.current = intent;
          state = updateApplication(state, target.id, (app) => ({
            ...app,
            unlockedSteps: app.unlockedSteps.includes(intent) ? app.unlockedSteps : [...app.unlockedSteps, intent],
          }));
        }
      }
      if (state !== ensured.state) writeApplicationsState(window.localStorage, state);
      bootstrapRef.current = { state, notice: null };
    }
  }

  /**
   * 深链参数用过就抹掉：地址栏只留 `{pathname}[?shareUserUuid=…]#fill-details`（步骤 hash 由下面
   * 那个 effect 写）。不抹的话，刷新、复制、转发出去的地址都会带着它再跳一次步。
   *
   * **只抹意图参数 `open`，分享人留在地址里**：客服码弹窗是后面才挂载的，它从 URL 上读分享人
   * （`useShareUserUuid`）—— 整条查询串一起抹掉的话，这个标签页刷新一次专属码就没了。
   * 重建口径见 stepRoute.ts 的 searchAfterOpenIntentUsed。
   */
  useEffect(() => {
    if (!deepLinkRef.current) return;
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${searchAfterOpenIntentUsed(window.location.search)}${window.location.hash}`,
    );
  }, []);

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

  /**
   * 主体列表落盘 —— **合并写**，不是把自己那份快照盖上去。
   *
   * 为什么（真会踩的跨标签页场景）：整份列表是**一个** localStorage 键。
   * 用户在支付成功页**新开一个标签页**去填申报资料，回原标签页**切了主体 / 新增了主体**，
   * 再回到填报页点保存 —— 原来那版直接 `setItem(整个 apps)` 会把存档退回填报页启动时的快照：
   * 新增的主体凭空消失、当前主体被拽回去。现在只覆盖「本标签页真正改过的那几条」，
   * 并且**只有本标签页自己切过主体时才动 activeAppId**（见 `mergeApplicationsWrite`）。
   */
  const writeIntentRef = useRef<{ dirty: Set<string>; removed: Set<string>; takeActive: boolean }>({
    dirty: new Set(),
    removed: new Set(),
    takeActive: false,
  });

  useEffect(() => {
    const intent = writeIntentRef.current;
    const stored = readApplicationsState(window.localStorage);
    const merged = mergeApplicationsWrite(stored, apps, {
      dirtyAppIds: [...intent.dirty],
      removedAppIds: [...intent.removed],
      takeActiveAppId: intent.takeActive,
    });
    intent.dirty.clear();
    intent.removed.clear();
    intent.takeActive = false;
    if (merged.changed) writeApplicationsState(window.localStorage, merged.state);
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
    writeIntentRef.current.dirty.add(activeApp.id);
    setApps((prev) => updateApplication(prev, prev.activeAppId, updater));
  };

  const { survey, plan, suggestion: planSuggestion, record: planRecord, order, details, messages, timeline, reviewBranch, bankBooked } = runtime;

  /**
   * 这条链接的分享人（`?shareUserUuid=`，只在挂载时读一次）。
   * 用途有两个，都是「别把分享人弄丢」：生成需求方案时随 `phoneNumber` 上送（服务端据此把
   * 这单算给分享人），以及支付成功页开填报页的深链把它带进新标签页（见 AgreementAndPaymentStep）。
   */
  const shareUserUuid = useShareUserUuid();

  /**
   * 当前步骤与解锁范围都在主体记录里（持久化），所以「刷新回到哪一步」和「切主体」
   * 用的是同一份数据 —— 不用再在首帧按证据算一次落点（迁移/新建时已经算好了）。
   */
  /**
   * 会话内的「浏览位置」：`fill_details` / `progress` 这类**超过登记上限**的步骤只放这里，
   * 不写进主体记录（见 stepRoute.ts 的 `canPersistStep`）。刷新后自然回到第 3 步。
   * 初值来自「新标签页深链」那次 bootstrap（`?open=fill-details`）。
   */
  const [viewStep, setViewStep] = useState<ProcessStep | null>(deepLinkStepRef.current);
  /** 渲染用：有会话级浏览位置就用它，否则用主体记录里的「进度」 */
  const currentStep = viewStep ?? activeApp.currentStep;
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
    // 超过登记上限的步骤（第 5 / 6 步）只在本次会话里显示，不落盘 —— 见 stepRoute.ts
    if (!canPersistStep(step)) {
      setViewStep(step);
      return;
    }
    setViewStep(null);
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
  /**
   * 查单说这条开户记录已经被后台删掉了（响应里 `scbUuid` 是空的）：
   * 这份申请在服务端已经不存在，继续留着只会让人点「立即支付」时被拒。
   * 置 true 后弹一个不可取消的提示，用户点「重新提交」→ 清掉旧数据、重开一份申请
   * （把旧问卷填进新的那份，见 handleConfirmRecordDeleted）。
   */
  const [recordDeleted, setRecordDeleted] = useState(false);
  const isPaidOrder = activeApp.order.status === 'paid' || order.status === 'paid';
  /**
   * 第 3 步该显示哪一个界面：**查单确认已支付**，或者**申报资料已提交**（填报页只有支付成功页的
   * 入口能进，所以那本身就说明付过款了）。地址栏写 `#paid`、第 3 步渲染支付成功界面都用它。
   *
   * `order.status` 只是**本地摘要**（可能过期、也可能是上一笔留下的）：它可以让界面先用着，
   * 但**不能**替代查单结论 —— 见下面那段核实的注释。
   */
  const paidView = showsPaidView(isPaidOrder, isDetailsSubmitted);

  useEffect(() => {
    if (paidCheck === 'checking') return; // 核实中，地址栏先不动
    // 已支付的支付页有自己的 hash（#paid）；其余情况按当前步骤的 hash
    // ⚠️ 写进去的是**纯 fragment**（`#proposal`）：replaceState 会拿它相对当前地址解析，
    // 于是 pathname 与查询串都原样留着 —— 分享人（`?shareUserUuid=`）就是这样活过每一步的。
    // 别改成 `${pathname}${hash}`：那是「整条查询串一起抹掉」的写法（App 里已经踩过一次）。
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
  // **有委托单号就要查一次**（2026-09 改）：单号只证明建过单，不证明付过款；
  // 本地那份 `order.status`（哪怕写着 paid）也可能过期、也可能是上一笔留下的，
  // 所以**不用它做「不用查了」的短路**，三种回答一律以服务端为准：
  //   paid    → 标已支付（并补单号 / 支付时间 / 手机号），地址栏与第 3 步翻成支付成功界面；
  //   unpaid  → **把本地那个 paid 改回 pending**（之前只是「查不动不动它」，等于纵容一个假已支付）；
  //   unknown → 查不动（路径没配 / 超时 / 网络不通 / 响应认不出）不动它，宁可先按本地那笔显示。
  // 同一单号在一次会话里仍然只查一次（`orderStatusCheck.ts` 的单飞闸门）——重复查没有新信息。
  // 闸门还要在 StrictMode 的「挂载 → 清理 → 再挂载」下成立（第一轮结果被丢弃时不能把「查过了」记上）。
  // 多主体：**每个委托单号一个 checker**（各自单飞），切主体互不影响。
  const checkersRef = useRef(new Map<string, OrderStatusChecker>());
  const checkerFor = (recordId: string): OrderStatusChecker => {
    let checker = checkersRef.current.get(recordId);
    if (!checker) {
      checker = createOrderStatusChecker((id: string) => fetchPaymentStatus(PAY_ENDPOINTS, id));
      checkersRef.current.set(recordId, checker);
    }
    return checker;
  };

  useEffect(() => {
    const recordId = planRecord?.recordId ?? '';
    if (recordId === '') return; // 还没建单：没有可查的东西
    const pending = checkerFor(recordId).check(recordId);
    if (pending === null) return; // 同一单号这次会话已经查过了

    let cancelled = false;
    setPaidCheck('checking');
    pending.then(result => {
      if (cancelled) return;
      if (result.recordDeleted === true) {
        // 后台把这条主体删了：这不是「未支付」，别标 paid/unpaid，弹提示让用户重开
        setRecordDeleted(true);
      } else if (result.status === 'paid') {
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
        updateActiveApp(app => applyPaidOrder(app, {
          orderNo: result.orderNo,
          paidAt: result.paidAt,
          contactPhone: result.mobile,
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
      } else if (result.status === 'unpaid') {
        // 服务端说没付：本地那个 paid 摘要是错的（上一笔留下 / 已退款 / 已关闭），把付款痕迹整条清掉
        // —— 状态回 pending，单号 / 支付时间也不再留着装样子。
        // 「申报资料已提交」那一档不受影响：那种情况下这笔必然付过款，界面仍按 paidView 渲染。
        updateRuntime(current => ({
          ...current,
          order: { ...current.order, status: 'pending', orderNo: '', paidAt: '' }
        }));
        updateActiveApp(app => ({
          ...app,
          order: { ...app.order, status: 'pending', orderNo: '', paidAt: '' }
        }));
      }
      setPaidCheck('done');
    });
    return () => {
      cancelled = true;
    };
  }, [planRecord, activeApp.id]);

  /* ------------------------------------------------------------ 主体管理 */

  const handleSwitchApplication = (id: string) => {
    setViewStep(null);
    // 本标签页自己切的主体 → 这一次落盘才有资格改存档里的 activeAppId
    writeIntentRef.current.takeActive = true;
    setApps((prev) => setActiveApplication(prev, id));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddApplication = () => {
    // 多主体开关（applications.MULTI_APPLICATION_ENABLED）关掉时顶栏没有入口，
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
    // 新增会顺手把**当前主体**换成新的那份 —— 那是本标签页自己的意思，落盘时才够格改
    // 存档里的 activeAppId（不记这一笔，合并写会保留旧 activeAppId，刷新后又落回上一个主体）
    if (result.state.activeAppId !== apps.activeAppId) writeIntentRef.current.takeActive = true;
    setApps(result.state);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRenameApplication = (id: string, name: string) => {
    writeIntentRef.current.dirty.add(id);
    setApps((prev) => renameApplication(prev, id, name));
  };

  /**
   * 服务端说这条记录已经被后台删掉了 → 用户确认后**重开一份申请**。
   *
   * 做的四件事：
   *   1. 把旧主体的三份方案存档（问卷 / 诊断结果 / 委托单号）与申报表草稿**清掉**
   *      —— 单号在服务端已经不存在，留着只会让人一点「立即支付」就被拒；
   *   2. **重开一份空白申请**（新的 appId、落在第 1 步），并顶掉旧主体在列表里的位置；
   *   3. 把旧的 `plan_form`（问卷 + 套餐 + 自选增值服务）**填进新的那份**，用户不用重填问卷；
   *   4. 清掉这个单号的查单缓存，免得下次（万一拿到同一个单号）被「已查询」挡住。
   *
   * 只搬 plan_form，不搬诊断结果与单号：报告是服务端按旧单号给的，跟着新申请走会前后矛盾。
   */
  const handleConfirmRecordDeleted = () => {
    const oldId = activeApp.id;
    const oldName = activeApp.name;
    const oldForm = loadPlanDraftFor(oldId);

    // ① 旧数据清干净
    clearPlanDraftFor(oldId);
    removeRegistrationDraft(oldId);
    const oldRecordId = planRecord?.recordId ?? '';
    if (oldRecordId !== '') checkersRef.current.delete(oldRecordId);

    // ② 重开一份：顶掉旧主体的位置（其余主体不动），并把旧的问卷填进去
    const others = apps.applications.filter((app) => app.id !== oldId);
    const fresh = createApplication(Date.now(), others.length, oldName);
    if (oldForm !== null) {
      savePlanFormFor(fresh.id, { survey: oldForm.survey, tier: oldForm.tier, addons: oldForm.addons });
    }

    setRuntimes((prev) => {
      const next = { ...prev };
      delete next[oldId];
      return { ...next, [fresh.id]: runtimeFromApplication(fresh) };
    });
    writeIntentRef.current.removed.add(oldId);
    writeIntentRef.current.takeActive = true;
    setApps({ applications: [...others, fresh], activeAppId: fresh.id });
    setRecordDeleted(false);
    setPaidCheck('idle');
    setNotice(oldForm !== null ? '已重开一份申请，问卷内容已带过去' : '已重开一份申请');
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    writeIntentRef.current.removed.add(id);
    // 作废的正好是当前主体时会顺延到另一个主体 —— 只有这种情况下本标签页才改存档的 activeAppId；
    // 作废别的（非当前）主体时，别的标签页正指着的那个主体不该被这次落盘拽走
    if (result.state.activeAppId !== apps.activeAppId) writeIntentRef.current.takeActive = true;
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
   * 第 1 步提交问卷的统一收尾：调接口（诊断 = 建单 / 改方案 = 改单）→ 存本次问卷与返回的
   * 诊断结果、单号 → 作废上一笔的付款痕迹 → 落到方案页。
   *
   * 两条入口的区别只有**请求怎么发**：
   *   - 第一次（本地没有委托单号）：`generatePlanReport(survey, 手机验证凭据)`，
   *     服务端比对短信验证码并**建单**，返回的 `recordId` 是必给项；
   *   - 已建单后再回第 1 步改问卷：`modifyProposal(survey, 旧单号)`（见 handleSurveyModify），
   *     **不再走短信验证**；响应没回新单号就沿用旧单号（`fallbackRecordId`）。
   *
   * 失败**原样抛出**（不吞、不用本地规则兜底）：手机号没验过就不该出方案、更不该往下一步走，
   * 由 SurveyStep 决定显在哪（手机验证弹框里 / 问卷页的 toast）。只有本地存档写不进去这类
   * 「不拦人前进」的毛病才走 warnings。
   *
   * @param request    真正发出去的那次请求（诊断建单 / 改方案）
   * @param fallbackRecordId 响应没给单号时沿用的旧单号；第一次生成方案时没有（null）
   * @param contactPhone 落到订单上的经办联系电话（第一次用刚验证过的手机号，改方案沿用单上已有的）
   */
  const runPlanSubmit = async (
    request: () => Promise<PlanReport>,
    fallbackRecordId: string | null,
    contactPhone: string
  ) => {
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
    // 上一次的诊断结果对应的是上一份问卷，这次已提交新问卷，先作废（改方案同样：旧报告不再对应当前问卷）
    clearPlanReportFor(appId);
    // 同一张单上改方案时**不能**作废单号 —— 它就是这次改动要带上去的 recordId。
    // 清掉的话「下单 → 查单」那条链就断了（支付全靠它），而且下次进来会被当成还没建单。
    // 只有第一次生成方案（没有旧单号）才清，清完下面接口会建一张新的。
    if (fallbackRecordId === null) clearPlanRecordFor(appId);
    // 新一单：把上一笔的付款痕迹一起清掉（下面 updateRuntime / updateActiveApp 落进去）。
    // 委托单号是服务端按这一次请求新建的，所以旧单的「已付 / 申报资料已提交」对新单不成立。
    // 不清的话 `showsPaidView` 会拿上一轮的 `isDetailsSubmitted` 把新单判成已支付：
    // 方案页 02/03 区被锁成「订单已支付 · 套餐已锁定」，套餐与加购都点不动
    // （纯本地旧状态造成的，服务端查单这时还在说「未支付」）。
    // 改方案同一条链（服务端说「修改需求方案」），所以这两条路都清。

    if (warnings.length > 0) setNotice(warnings.join('；'));
    const report = await request();
    const { recordId, suggestion } = report;

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
      // 手机号：第一次生成方案用刚验证过的那个；改方案没有手机验证框，沿用单上已有的
      // （支付页的「经办联系电话」就靠它，改成空会把这格弄丢）。
      // 付款痕迹回 pending / 清空 —— 这一次是新的一单 / 改的这一单都要重走支付
      // （见上面 clearPlanReportFor 之后那段注释）
      order: {
        ...current.order,
        status: 'pending',
        orderNo: '',
        paidAt: '',
        contactPhone,
        amount: merged.finalPrice
      },
    }));

    updateActiveApp((app) => {
      // 主体名还是默认的（用户没改过）就顺手换成诊断给的企业名称
      const named =
        app.name === defaultApplicationName(activeIndex)
          ? { ...app, name: deriveApplicationName({ companyNameProposal: suggestion.companyNameProposal, companyDesc: survey.companyDesc }, activeIndex) }
          : app;
      // 新一单：上一笔的「已付 / 申报资料已提交」对新单不成立，一起清掉（否则方案页被锁成已支付）
      const renewed: ApplicationRecord = {
        ...named,
        isDetailsSubmitted: false,
        order: {
          ...named.order,
          status: 'pending',
          orderNo: '',
          paidAt: '',
          contactPhone,
          amount: merged.finalPrice,
          tierName: merged.tierName
        },
      };
      // 导航只在人还停在问卷页时更新：他已经自己走到方案页（或更后面）的话，把人拽回来是错的
      if (stepRef.current !== 'survey') {
        return renewed;
      }
      return {
        ...renewed,
        currentStep: 'proposal',
        unlockedSteps: renewed.unlockedSteps.includes('proposal') ? renewed.unlockedSteps : [...renewed.unlockedSteps, 'proposal'],
      };
    });
    if (stepRef.current === 'survey') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /**
   * 第一次生成方案（本地还没有委托单号）：过手机验证弹框，带着手机号与短信凭据调诊断接口建单。
   *
   * 分享人（`?shareUserUuid=`）跟着这次请求一起上去（塞在 `phoneNumber` 信封里，与 caa 同形）：
   * 归属在第一张单建出来的那一刻就得定下来，之后改方案、支付都只是这一单上的动作。
   */
  const handleSurveySubmit = async (verification: PhoneVerification) => {
    await runPlanSubmit(
      () => generatePlanReport(survey, verification, shareUserUuid),
      null,
      verification.mobile
    );
  };

  /**
   * 已建单之后再回第 1 步改问卷：**不再走短信验证**，改调 `modify-proposal`
   * （只过一道腾讯行为验证码，票据在 modifyProposal 里取），把当前这份问卷带上去。
   *
   * `onCaptchaPassed` 一路传给 `modifyProposal`：**行为验证通过之后**才让问卷页盖「AI 推演中」弹框，
   * 免得生成弹框先弹出来把腾讯验证码盖在下面（见 planGenerate.ts 的 modifyProposal）。
   *
   * 为什么以「本地有没有委托单号」为准：手机号是**建单那一次**验过的，同一张单沿用；
   * 重开一单（重置问卷会清掉单号）时又会回到上面那条要验证码的路，与「建单才需要验手机号」一致。
   */
  const handleSurveyModify = async (onCaptchaPassed?: () => void) => {
    const recordId = planRecord?.recordId ?? '';
    if (recordId === '') throw new Error('缺少委托单号，请重新生成需求方案');
    await runPlanSubmit(() => modifyProposal(survey, recordId, onCaptchaPassed), recordId, order.contactPhone);
  };

  // Step 2 -> Step 3: 方案页只是把第 1 步给的结果展示出来，点「前往支付」就走一步
  const handleProposalProceed = () => {
    unlockStep('payment');
    setCurrentStep('payment');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Step 3: Payment Success -> 落「已支付」摘要 + 解锁 Service Group（只动当前主体）
  //
  // 为什么要改主体记录、而不是只解锁：顶栏下拉的状态徽标、「作废服务 / 已生效履约中」、
  // 以及支付成功页新开填报页的深链放行条件（`allowsFillDetailsIntent` 读 `order.status`）
  // **读的都是主体记录里的订单摘要**，运行时那份 `order`（`onUpdateOrder` 改的）它们看不到。
  // 之前这里只 `unlockStep('group')`，于是「付完款点开顶栏还是待支付」、已支付主体还留着
  // 「作废服务」（点下去会被 `discardApplication` 的 paid 规则拦住，但入口就不该在）、
  // 新开的填报页深链被拒 —— 三个症状同一个根因。写入口径见 `applications.applyPaidOrder`。
  const handlePaymentSuccess = (paidOrder: PaymentOrder) => {
    updateActiveApp((app) =>
      applyPaidOrder(app, {
        orderNo: paidOrder.orderNo,
        paidAt: paidOrder.paidAt,
        contactPhone: paidOrder.contactPhone,
      })
    );
  };

  // Proceed from Payment to Fill Details —— 付款后该做的是填申报资料（第 5 步）
  const handleProceedToFillDetails = () => {
    unlockStep('fill_details');
    setCurrentStep('fill_details');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Step 5: Submit details for review -> 回到「支付成功」界面看清单
  const handleSubmitForReview = () => {
    // 第 5 步是会话级浏览位置，提交完要回第 3 步 —— 两个都要收掉，只改记录不够
    setViewStep(null);
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

      {/* Top Navbar：品牌（纯展示，不可点）+ 我的企业注册服务（多主体切换 / 新增 / 改名 / 作废）。
          **第 5 步填报页不显示**（2026-10-08 用户要求）：那一页是独立模块、平时从支付成功页
          新开标签页进来，顶上不该再压一条向导导航（主体切换在这里也会把用户从填报页拽走）。 */}
      {currentStep !== 'fill_details' && (
        <TopNavbar
          applications={apps.applications}
          currentAppId={activeApp.id}
          onSwitchApplication={handleSwitchApplication}
          onAddApplication={handleAddApplication}
          onRenameApplication={handleRenameApplication}
          onDiscardApplication={handleDiscardApplication}
        />
      )}

      {/* Main Content Area */}
      <main className="relative z-10 flex-1">
        {currentStep === 'survey' && (
          <SurveyStep
            key={`${activeApp.id}-survey`}
            survey={survey}
            onChange={(nextSurvey) => updateRuntime((current) => ({ ...current, survey: nextSurvey }))}
            onSubmit={handleSurveySubmit}
            onModify={handleSurveyModify}
            modifyRecordId={planRecord?.recordId ?? ''}
            // 手机号预填：本主体验过的优先；新主体还没有号时借**别的已生成方案的主体**用过的号
            // （同一台机器同一个人，省得再敲一遍 —— 见 applications.suggestedContactPhone）
            contactPhone={suggestedContactPhone(apps, activeApp.id, order.contactPhone)}
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

      {/*
        服务端把这条主体删了：不可取消的提示 —— 用户点「重新提交」才重开一份申请。
        不给他「留在原地」的选项：那个单号在服务端已经不存在，点什么都会被拒。
      */}
      {recordDeleted && (
        <div className="fixed inset-0 z-[70] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            id="record-deleted-modal"
            className="bg-white rounded-2xl max-w-sm w-full p-5 sm:p-6 border border-slate-200/80 text-left"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <AlertCircle className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">该主体已被后台删除，请重新提交</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-1.5">
              服务端已经没有这条开户记录了，当前这份申请无法继续支付或提交。
            </p>
            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              点「重新提交」会为你重开一份申请，<strong className="text-slate-700">你填过的问卷内容会一并带过去</strong>（套餐与自选增值服务也保留），已生成的方案与委托单号会作废并重新生成。
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                id="btn-reopen-application"
                onClick={handleConfirmRecordDeleted}
                className="px-5 py-2 rounded-full bg-[#36B39E] hover:bg-[#2AA894] text-white text-xs font-bold cursor-pointer transition-colors"
              >
                重新提交
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 跨页提示（方案接口失败、主体上限、作废结果等），样式与问卷页的 toast 一致 */}
      {notice && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 max-w-[92vw] px-4 py-2 rounded-full bg-slate-900 text-white text-xs font-semibold shadow-xl text-center">
          {notice}
        </div>
      )}

    </div>
  );
}
