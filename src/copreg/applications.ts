/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * **多主体申请的模型与存档键空间**（纯逻辑，`scripts/check-applications.ts` 离线自检）。
 *
 * 现状是一个用户只有一份申请：三份全局键（`1b_copreg_plan_form/_report/_record`）加一份
 * 申报表（`banbu-registration-20260913-v1`）。多主体之后要变成：
 *
 *   `1b_copreg_apps_v1`                    主体列表（id / 名称 / 当前步 / 订单摘要 / 是否已提交）
 *   `1b_copreg_active_app_v1`              上次停留的主体 id（刷新按它恢复，地址栏不带 appId）
 *   `1b_copreg_app:{id}:plan_form`         该主体「填写的」
 *   `1b_copreg_app:{id}:plan_report`       该主体「返回的」诊断结果
 *   `1b_copreg_app:{id}:plan_record`       该主体的委托单凭据
 *   `banbu-registration-{id}`              该主体的申报资料表
 *
 * 业务规则（产品确认过）：
 *   - **最多 5 个主体**，到顶后新增被拒；
 *   - **作废仅本地**（不调接口）：未支付才能作废，最后一个主体作废后自动补一个空白主体；
 *   - 主体之间**不关联支付状态**，各自一份订单摘要；
 *   - 名称可自定义，默认由诊断给的企业名称 / 申报表名称 / 企业描述派生；
 *   - 申报资料按 `busUnionId`（各自的 recordId）分别提交，与本模块无关。
 *
 * 迁移：老的三份全局键 + 全局申报表键 → 归成「主体 #1」，迁移成功后**才**删除旧键；
 * 任何一步写失败就整体放弃（旧键原样保留），宁可下次再迁，也不能把用户的存档弄丢。
 *
 * 纯函数：不 import React、不 import config/api.ts；localStorage 由调用方以 `StorageLike` 注入。
 */

import { hasPlanContent, parsePlanSuggestion } from './planReport';
import { progressRouteOf, STEP_ORDER } from './stepRoute';
import type { ProcessStep } from './types';

/* ------------------------------------------------------------------ 常量 */

export const APPLICATIONS_KEY = '1b_copreg_apps_v1';
export const ACTIVE_APP_KEY = '1b_copreg_active_app_v1';

/** 一个用户最多能建几个主体（产品确认：5 个） */
export const MAX_APPLICATIONS = 5;

/**
 * 多主体申请**是否对外开放**。
 *
 * 产品要求**暂时屏蔽**（当前只允许一个主体）：顶栏不渲染主体切换与「新增企业注册」，
 * App 也拒绝新增。模型层保持完整 —— 上限、切换、改名、作废、老存档迁移、每个主体各自的键
 * 都还在，恢复时把它改回 `true` 即可；已有的多主体存档不会被清掉，只是暂时用不到。
 */
export const MULTI_APPLICATION_ENABLED = false;

/** 迁移前的全局键；迁移完成后清掉 */
export const LEGACY_PLAN_FORM_KEY = '1b_copreg_plan_form';
export const LEGACY_PLAN_REPORT_KEY = '1b_copreg_plan_report';
export const LEGACY_PLAN_RECORD_KEY = '1b_copreg_plan_record';
export const LEGACY_REGISTRATION_KEY = 'banbu-registration-20260913-v1';

/* --------------------------------------------------------------- 键工厂 */

export const planFormKey = (appId: string): string => `1b_copreg_app:${appId}:plan_form`;
export const planReportKey = (appId: string): string => `1b_copreg_app:${appId}:plan_report`;
export const planRecordKey = (appId: string): string => `1b_copreg_app:${appId}:plan_record`;
export const registrationKey = (appId: string): string => `banbu-registration-${appId}`;

/* ------------------------------------------------------------------ 模型 */

export type ApplicationOrderStatus = 'pending' | 'paid';

/**
 * 主体列表里存的**订单摘要**（不是完整订单）：列表/徽标只需要这几项，
 * 完整订单（发票、收据号…）仍活在 App 内存里，刷新后由查单补回来。
 */
export interface ApplicationOrderSummary {
  status: ApplicationOrderStatus;
  orderNo: string;
  paidAt: string;
  contactPhone: string;
  amount: number;
  /**
   * 当前选定的套餐名（如「全年无忧服务（小规模）」）。顶栏下拉每一条要显示「套餐 + 价格」，
   * 而套餐名只在运行时方案里 —— 生成方案 / 切档时顺手记一份到摘要里，列表才不用为了显示它
   * 把每个主体的方案都读出来。
   */
  tierName: string;
}

export interface ApplicationRecord {
  id: string;
  /** 展示名，可在顶栏改；默认由诊断 / 申报表 / 企业描述派生 */
  name: string;
  /** ISO 时间串，排序与展示用 */
  createdAt: string;
  updatedAt: string;
  currentStep: ProcessStep;
  unlockedSteps: ProcessStep[];
  order: ApplicationOrderSummary;
  /** 该主体的申报资料是否已提交（第 5 步那份存档里的 status） */
  isDetailsSubmitted: boolean;
}

export interface ApplicationsState {
  applications: ApplicationRecord[];
  activeAppId: string;
}

/** localStorage 的最小接口：自检里用 Map 造假实现 */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/* ------------------------------------------------------------ 读写与容错 */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const textOf = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const isStep = (value: unknown): value is ProcessStep =>
  typeof value === 'string' && (STEP_ORDER as string[]).includes(value);

const stepsOf = (value: unknown): ProcessStep[] => {
  if (!Array.isArray(value)) return [];
  // 顺序按 STEP_ORDER 归一，去掉重复与认不出的
  return STEP_ORDER.filter((step) => value.some((item) => item === step));
};

const orderOf = (value: unknown): ApplicationOrderSummary => {
  const source = isRecord(value) ? value : {};
  const amount = typeof source.amount === 'number' && Number.isFinite(source.amount) ? source.amount : 0;
  return {
    status: source.status === 'paid' ? 'paid' : 'pending',
    orderNo: textOf(source.orderNo),
    paidAt: textOf(source.paidAt),
    contactPhone: textOf(source.contactPhone),
    amount,
    tierName: textOf(source.tierName),
  };
};

/** 一个主体记录；id 为空串就不认（没有 id 就没法定位它的存档） */
export const parseApplication = (value: unknown, now: number): ApplicationRecord | null => {
  if (!isRecord(value)) return null;
  const id = textOf(value.id);
  if (id === '') return null;

  const currentStep = isStep(value.currentStep) ? value.currentStep : 'survey';
  const unlocked = stepsOf(value.unlockedSteps);
  const createdAt = textOf(value.createdAt) || new Date(now).toISOString();

  return {
    id,
    name: textOf(value.name),
    createdAt,
    updatedAt: textOf(value.updatedAt) || createdAt,
    currentStep,
    // 至少解锁到落点那一步（坏档里可能缺）
    unlockedSteps: unlocked.length > 0 ? unlocked : STEP_ORDER.slice(0, STEP_ORDER.indexOf(currentStep) + 1),
    order: orderOf(value.order),
    isDetailsSubmitted: value.isDetailsSubmitted === true,
  };
};

/** 列表收口：坏项丢掉、重复 id 只留第一个、activeAppId 认不出就落到第一个 */
export const parseApplicationsState = (value: unknown, now = Date.now()): ApplicationsState | null => {
  if (!isRecord(value)) return null;
  const rawList = Array.isArray(value.applications) ? value.applications : [];
  const seen = new Set<string>();
  const applications: ApplicationRecord[] = [];

  for (const item of rawList) {
    const parsed = parseApplication(item, now);
    if (parsed === null || seen.has(parsed.id)) continue;
    seen.add(parsed.id);
    applications.push(parsed);
    if (applications.length >= MAX_APPLICATIONS) break; // 存里多了也只认前 5 个
  }

  if (applications.length === 0) return null;

  const active = textOf(value.activeAppId);
  return {
    applications,
    activeAppId: applications.some((app) => app.id === active) ? active : applications[0].id,
  };
};

export const readApplicationsState = (storage: StorageLike, now = Date.now()): ApplicationsState | null => {
  try {
    const raw = storage.getItem(APPLICATIONS_KEY);
    if (raw === null) return null;
    return parseApplicationsState(JSON.parse(raw), now);
  } catch {
    return null;
  }
};

export const writeApplicationsState = (storage: StorageLike, state: ApplicationsState): boolean => {
  try {
    storage.setItem(APPLICATIONS_KEY, JSON.stringify(state));
    storage.setItem(ACTIVE_APP_KEY, state.activeAppId);
    return true;
  } catch {
    return false;
  }
};

export const readActiveAppId = (storage: StorageLike): string => {
  try {
    return textOf(storage.getItem(ACTIVE_APP_KEY));
  } catch {
    return '';
  }
};

/* ------------------------------------------------------------------ 规则 */

/** 主体 id：时间戳 + 随机尾巴，同一毫秒建两个也不会撞 */
export const newApplicationId = (now: number): string =>
  `app-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const defaultApplicationName = (index: number): string => `企业设立申请（主体 ${index + 1}）`;

/** 展示名派生：申报表里的名称 > 诊断给的企业名称 > 截断的企业描述 > 兜底 */
export interface ApplicationNameSource {
  /** 申报表 `basic.names[0]` */
  registrationName?: string | null;
  /** 诊断结果 `companyNameProposal` */
  companyNameProposal?: string | null;
  /** 问卷 `companyDesc` */
  companyDesc?: string | null;
}

export const deriveApplicationName = (source: ApplicationNameSource, index: number): string => {
  const registrationName = textOf(source.registrationName);
  if (registrationName !== '') return registrationName;
  const proposal = textOf(source.companyNameProposal);
  if (proposal !== '') return proposal;
  const desc = textOf(source.companyDesc);
  if (desc !== '') return desc.length > 16 ? `${desc.slice(0, 16)}…` : desc;
  return defaultApplicationName(index);
};

/** 空白主体：问卷、方案、委托单都还没有，落在第 1 步 */
export const createApplication = (now: number, index: number, name?: string): ApplicationRecord => {
  const iso = new Date(now).toISOString();
  return {
    id: newApplicationId(now),
    name: textOf(name) || defaultApplicationName(index),
    createdAt: iso,
    updatedAt: iso,
    currentStep: 'survey',
    unlockedSteps: ['survey'],
    order: { status: 'pending', orderNo: '', paidAt: '', contactPhone: '', amount: 0, tierName: '' },
    isDetailsSubmitted: false,
  };
};

export type CreateApplicationResult =
  | { ok: true; state: ApplicationsState }
  | { ok: false; reason: 'limit' };

/** 新增主体：到 5 个就拒（UI 据此把「新增」置灰并说明） */
export const addApplication = (
  state: ApplicationsState,
  options: { name?: string; now?: number } = {}
): CreateApplicationResult => {
  if (state.applications.length >= MAX_APPLICATIONS) return { ok: false, reason: 'limit' };
  const now = options.now ?? Date.now();
  const created = createApplication(now, state.applications.length, options.name);
  return {
    ok: true,
    state: { applications: [...state.applications, created], activeAppId: created.id },
  };
};

export const canAddApplication = (state: ApplicationsState): boolean =>
  state.applications.length < MAX_APPLICATIONS;

export const findApplication = (state: ApplicationsState, id: string): ApplicationRecord | null =>
  state.applications.find((app) => app.id === id) ?? null;

/** 改名：空名不生效（调用方按「名字没变」处理） */
export const renameApplication = (
  state: ApplicationsState,
  id: string,
  name: string,
  now = Date.now()
): ApplicationsState => {
  const next = textOf(name);
  if (next === '') return state;
  return {
    ...state,
    applications: state.applications.map((app) =>
      app.id === id ? { ...app, name: next, updatedAt: new Date(now).toISOString() } : app
    ),
  };
};

export type DiscardApplicationResult =
  | { ok: true; state: ApplicationsState }
  | { ok: false; reason: 'missing' | 'paid' };

/**
 * 作废主体（**仅本地**，不调接口）：
 *   - 找不到 → missing；
 *   - **已支付不能作废**（服务端那笔单还在，本地删了只会让人找不到自己的申请）；
 *   - 删的正好是当前主体 → 切到剩下的第一个；
 *   - 删到最后一个 → 补一个空白主体，列表永远不为空。
 */
export const discardApplication = (
  state: ApplicationsState,
  id: string,
  now = Date.now()
): DiscardApplicationResult => {
  const target = findApplication(state, id);
  if (target === null) return { ok: false, reason: 'missing' };
  if (target.order.status === 'paid') return { ok: false, reason: 'paid' };

  const remaining = state.applications.filter((app) => app.id !== id);
  if (remaining.length === 0) {
    const fresh = createApplication(now, 0);
    return { ok: true, state: { applications: [fresh], activeAppId: fresh.id } };
  }

  return {
    ok: true,
    state: {
      applications: remaining,
      activeAppId: state.activeAppId === id ? remaining[0].id : state.activeAppId,
    },
  };
};

/* ------------------------------------------------------------------ 迁移 */

export interface LegacyMigrationPlan {
  /** 迁移出来的主体；没有旧存档时为 null */
  application: ApplicationRecord | null;
  /** 迁移后的列表状态；没有旧存档时为 null */
  state: ApplicationsState | null;
  /** 要写入的键值（先全部写完，才动 removals） */
  writes: Array<{ key: string; value: string }>;
  /** 写入全部成功后要删掉的旧键 */
  removals: string[];
}

const EMPTY_PLAN: LegacyMigrationPlan = { application: null, state: null, writes: [], removals: [] };

const readRaw = (storage: StorageLike, key: string): string | null => {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
};

const parseRaw = (raw: string | null): unknown => {
  try {
    return JSON.parse(raw ?? 'null');
  } catch {
    return null;
  }
};

/**
 * 这份「填写的」里的问卷到底填过没有。
 *
 * 与 `planDraft.loadPlanDraft` 的 `hasAnyAnswer` 同一口径（问卷全空就当没存过），只是这里
 * 作用在**原始 JSON** 上 —— `applications.ts` 不能 import `planDraft`（planDraft 反过来要
 * import 本模块的键工厂，会成环），所以只能这样等价判断。
 */
const hasAnySurveyAnswerRaw = (form: unknown): boolean => {
  const survey = isRecord(form) ? form.survey : null;
  if (!isRecord(survey)) return false;
  return Object.values(survey).some((value) =>
    Array.isArray(value) ? value.length > 0 : typeof value === 'string' && value.trim() !== ''
  );
};

/** 单号是不是有效（与 planDraft.parsePlanRecord 同口径：非空字符串才算） */
const hasRecordIdRaw = (raw: string | null): boolean => {
  const parsed = parseRaw(raw);
  return isRecord(parsed) && typeof parsed.recordId === 'string' && parsed.recordId.trim() !== '';
};

/** 从旧存档里尽量取一个主体名（申报表名称 / 诊断名称 / 企业描述） */
const legacyNameSource = (formRaw: string | null, reportRaw: string | null, registrationRaw: string | null) => {
  const source: ApplicationNameSource = {};
  try {
    const form = JSON.parse(formRaw ?? 'null') as { survey?: { companyDesc?: string } } | null;
    source.companyDesc = form?.survey?.companyDesc ?? null;
  } catch {
    /* 坏 JSON 当没有 */
  }
  try {
    const report = JSON.parse(reportRaw ?? 'null') as { companyNameProposal?: string } | null;
    source.companyNameProposal = report?.companyNameProposal ?? null;
  } catch {
    /* 同上 */
  }
  try {
    const registration = JSON.parse(registrationRaw ?? 'null') as { basic?: { names?: string[] } } | null;
    source.registrationName = registration?.basic?.names?.[0] ?? null;
  } catch {
    /* 同上 */
  }
  return source;
};

/**
 * 规划一次「老存档 → 主体 #1」的迁移（**只看不写**，便于自检）。
 * 已经有主体列表（哪怕是空的坏档被收口成 null 但键还在）时不再迁移。
 */
export const planLegacyMigration = (storage: StorageLike, now = Date.now()): LegacyMigrationPlan => {
  if (readApplicationsState(storage, now) !== null) return EMPTY_PLAN;

  const legacyForm = readRaw(storage, LEGACY_PLAN_FORM_KEY);
  const legacyReport = readRaw(storage, LEGACY_PLAN_REPORT_KEY);
  const legacyRecord = readRaw(storage, LEGACY_PLAN_RECORD_KEY);
  const legacyRegistration = readRaw(storage, LEGACY_REGISTRATION_KEY);

  const hasLegacy =
    legacyForm !== null || legacyReport !== null || legacyRecord !== null || legacyRegistration !== null;
  // 没有「填写的」也没有申报表 —— 旧键就算在也只是空壳，没有迁移价值
  if (!hasLegacy) return EMPTY_PLAN;

  let detailsSubmitted = false;
  try {
    const registration = JSON.parse(legacyRegistration ?? 'null') as { status?: string } | null;
    detailsSubmitted = registration?.status === 'submitted';
  } catch {
    /* 坏 JSON 当作未提交 */
  }

  // 落点用的证据必须与旧的 `loadPlanDraft` 完全同口径：**问卷没填过（或压根没有问卷）时，
  // 诊断结果与委托单号都不算数**（旧 App 那时也落第 1 步）。原始值照样搬过去，只是不算进度证据。
  const hasForm = hasAnySurveyAnswerRaw(parseRaw(legacyForm));
  const hasPlanReport = hasForm && hasPlanContent(parsePlanSuggestion(parseRaw(legacyReport)));
  const hasRecord = hasForm && hasRecordIdRaw(legacyRecord);

  const { landing, unlocked } = progressRouteOf({
    hasPlanReport,
    hasRecord,
    // 订单是否已支付只有异步查单才知道，迁移这一刻一律按未支付算（App 查回来会补）
    orderPaid: false,
    detailsSubmitted,
  });

  const id = newApplicationId(now);
  const iso = new Date(now).toISOString();
  const application: ApplicationRecord = {
    id,
    name: deriveApplicationName(legacyNameSource(legacyForm, legacyReport, legacyRegistration), 0),
    createdAt: iso,
    updatedAt: iso,
    currentStep: landing,
    unlockedSteps: unlocked,
    // 订单摘要在迁移时不带过来：手机号按约定不落本地，金额等 App 起来后按方案现算
    order: { status: 'pending', orderNo: '', paidAt: '', contactPhone: '', amount: 0, tierName: '' },
    isDetailsSubmitted: detailsSubmitted,
  };
  const state: ApplicationsState = { applications: [application], activeAppId: id };

  const writes: Array<{ key: string; value: string }> = [];
  if (legacyForm !== null) writes.push({ key: planFormKey(id), value: legacyForm });
  if (legacyReport !== null) writes.push({ key: planReportKey(id), value: legacyReport });
  if (legacyRecord !== null) writes.push({ key: planRecordKey(id), value: legacyRecord });
  if (legacyRegistration !== null) writes.push({ key: registrationKey(id), value: legacyRegistration });
  // 主体列表**最后写**：它是「迁移已完成」的标记。先写它的话，后面某份存档写失败时
  // 下次进来会读到「已经有主体」而跳过迁移，旧键还在却再也不搬 —— 用户的方案就搁浅了
  writes.push({ key: APPLICATIONS_KEY, value: JSON.stringify(state) });
  writes.push({ key: ACTIVE_APP_KEY, value: id });

  const legacyKeys = [LEGACY_PLAN_FORM_KEY, LEGACY_PLAN_REPORT_KEY, LEGACY_PLAN_RECORD_KEY, LEGACY_REGISTRATION_KEY];
  const removals = legacyKeys.filter((key) => readRaw(storage, key) !== null);

  return { application, state, writes, removals };
};

/**
 * 执行迁移：**先写全新键，全部成功才删旧键**。中途写失败（配额满 / 隐私模式）就整体放弃，
 * 旧键一个不动，下次进页面再试。
 */
export const applyLegacyMigration = (storage: StorageLike, plan: LegacyMigrationPlan): boolean => {
  if (plan.state === null) return false;
  try {
    for (const { key, value } of plan.writes) storage.setItem(key, value);
  } catch {
    return false;
  }
  for (const key of plan.removals) {
    try {
      storage.removeItem(key);
    } catch {
      /* 删不掉也无妨：下次迁移会因为已有主体列表而直接跳过 */
    }
  }
  return true;
};

export interface EnsureApplicationsResult {
  state: ApplicationsState;
  /** 这次是不是刚从老存档迁移过来的（用于提示 / 埋点） */
  migrated: boolean;
}

/**
 * 取当前的主体列表，按需初始化：
 *   1. 已经有列表 → 收口（activeAppId 无效就落到第一个）；
 *   2. 没有列表但有旧存档 → 迁移成主体 #1；
 *   3. 什么都没有 → 建一个空白主体。
 *
 * 返回 null 表示「连空白主体都存不下来」（隐私模式 / 配额满），调用方据此提示。
 */
export const ensureApplicationsState = (storage: StorageLike, now = Date.now()): EnsureApplicationsResult | null => {
  const existing = readApplicationsState(storage, now);
  if (existing !== null) {
    const active = readActiveAppId(storage);
    if (active !== '' && active !== existing.activeAppId && existing.applications.some((app) => app.id === active)) {
      const withActive = { ...existing, activeAppId: active };
      writeApplicationsState(storage, withActive);
      return { state: withActive, migrated: false };
    }
    return { state: existing, migrated: false };
  }

  const plan = planLegacyMigration(storage, now);
  if (plan.state !== null) {
    const applied = applyLegacyMigration(storage, plan);
    return applied ? { state: plan.state, migrated: true } : null;
  }

  const fresh = createApplication(now, 0);
  const state: ApplicationsState = { applications: [fresh], activeAppId: fresh.id };
  return writeApplicationsState(storage, state) ? { state, migrated: false } : null;
};

/** 更新某个主体（App 的 `updateActiveApp` 底层用它） */
export const updateApplication = (
  state: ApplicationsState,
  id: string,
  updater: (app: ApplicationRecord) => ApplicationRecord,
  now = Date.now()
): ApplicationsState => ({
  ...state,
  applications: state.applications.map((app) =>
    app.id === id ? { ...updater(app), updatedAt: new Date(now).toISOString() } : app
  ),
});

export const setActiveApplication = (state: ApplicationsState, id: string): ApplicationsState =>
  state.applications.some((app) => app.id === id) ? { ...state, activeAppId: id } : state;

/**
 * 回填某主体摘要里缺的「套餐名 / 金额」。
 *
 * `tierName` 是「顶栏下拉显示套餐」这个需求才加进摘要的，**早于它的存档（含单主体时代迁移
 * 过来的那份）里没有**，列表就会显示「套餐待生成」—— 明明方案早就生成、甚至已经付过款了。
 * 规则：`tierName` 空就补；`amount` **只有为 0 时才补**（付过款的金额不能被现算的报价盖掉）。
 */
export interface OrderSummaryPatch {
  tierName?: string;
  amount?: number;
}

export const patchOrderSummary = (
  state: ApplicationsState,
  id: string,
  patch: OrderSummaryPatch,
  now = Date.now()
): ApplicationsState => {
  const target = findApplication(state, id);
  if (target === null) return state;

  const tierName = target.order.tierName !== '' ? target.order.tierName : patch.tierName ?? '';
  const amount = target.order.amount > 0 ? target.order.amount : patch.amount ?? 0;
  if (tierName === target.order.tierName && amount === target.order.amount) return state;

  return updateApplication(state, id, (app) => ({ ...app, order: { ...app.order, tierName, amount } }), now);
};
