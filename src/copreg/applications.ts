/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * **多主体申请的模型与存档键空间**（纯逻辑，`scripts/check-applications.ts` 离线自检）。
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
 * **不再有「老存档迁移」**（2026-09 去掉）：单主体时代的全局键（`1b_copreg_plan_form/_report/_record`
 * 与 `banbu-registration-20260913-v1`）与那套 `planLegacyMigration` / `applyLegacyMigration` 已删除 ——
 * 没有主体列表就是**全新的一份申请**，落第 1 步。旧键不读、不搬、也不删（留着无害，硬删反而可能
 * 删掉别人正在用的东西）。
 *
 * 纯函数：不 import React、不 import config/api.ts；localStorage 由调用方以 `StorageLike` 注入。
 */

import { progressRouteOf, STEP_ORDER } from './stepRoute';
import type { ProcessStep } from './types';

/* ------------------------------------------------------------------ 常量 */

export const APPLICATIONS_KEY = '1b_copreg_apps_v1';
export const ACTIVE_APP_KEY = '1b_copreg_active_app_v1';

/** 一个用户最多能建几个主体（产品确认：5 个） */
export const MAX_APPLICATIONS = 5;

/**
 * 多主体申请**是否对外开放**（2026-09 重新打开）。
 *
 * `true`：顶栏渲染主体切换与「新增企业注册」，App 允许新增；最多 5 个主体。
 * 曾经按产品要求屏蔽过一段时间（当时只允许一个主体，顶栏不给入口、App 也拒绝新增），
 * 现在恢复。真机自检 `.mcp-work/verify-multi-app.mjs` 按这个开关自动选模式：
 * 关掉时会退化成「确实没有入口、仍是单主体可用」那几条断言。
 */
export const MULTI_APPLICATION_ENABLED = true;

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

export interface EnsureApplicationsResult {
  state: ApplicationsState;
}

/**
 * 取当前的主体列表，按需初始化：
 *   1. 已经有列表 → 收口（activeAppId 无效就落到第一个）；
 *   2. 没有列表 → 建一个空白主体（落第 1 步）。
 *
 * **没有「从旧存档迁移」这一步了**（2026-09 去掉）：单主体时代的全局键不再读、不再搬。
 * 旧键留在那里也不影响（只有本模块的 per-app 键会被读），硬删反而可能删掉别人正在用的东西。
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
      return { state: withActive };
    }
    return { state: existing };
  }

  const fresh = createApplication(now, 0);
  const state: ApplicationsState = { applications: [fresh], activeAppId: fresh.id };
  return writeApplicationsState(storage, state) ? { state } : null;
};

/* ------------------------------------------------- 跨标签页的「合并写」 */

/**
 * 一次落盘的**意图**：说清「本标签页改了什么」，好让合并写只覆盖那些东西。
 *
 * 为什么要这么细：整份主体列表是**一个** localStorage 键，两个标签页各持一份快照时，
 * 谁后写谁就把对方的改动整个盖掉 —— 典型场景是「支付成功页新开一个填报标签页，
 * 回原标签页切了主体 / 新增了主体，然后填报页一保存」：原来那版直接 `setItem(整个 apps)`
 * 会把存档里的主体列表与 activeAppId 一起**退回**填报页启动时的快照（新增的主体凭空消失，
 * 当前主体被拽回去）。
 */
export interface ApplicationsWriteIntent {
  /** 本标签页改过字段的主体 id：只有这些以本标签页内存里的那份为准 */
  dirtyAppIds: string[];
  /** 本标签页删掉的主体 id（别的标签页的快照里可能还在） */
  removedAppIds: string[];
  /** 本标签页是不是**自己切换了当前主体** —— 只有它才有资格改存档里的 activeAppId */
  takeActiveAppId: boolean;
}

export interface MergedApplicationsWrite {
  state: ApplicationsState;
  /** 合并结果与存档一模一样时给 false，调用方就别写了（避免无谓的跨标签页覆盖） */
  changed: boolean;
}

/**
 * 跨标签页安全的合并写：`stored` 是**刚读到的**存档，`mine` 是本标签页内存里的那份。
 *
 * 规则：
 *   - 以存档为底 —— 别的标签页新增 / 改名 / 改状态的主体原样保留；
 *   - 只有 `dirtyAppIds` 里的主体用本标签页的版本覆盖（那些是我们真正改过的）；
 *   - `removedAppIds` 里的主体删掉；本标签页新增（存档里没有）的追加进去；
 *   - **activeAppId**：本标签页自己切过主体（`takeActiveAppId`）才动它，否则一律保留存档里的 ——
 *     于是「另一个标签页切了主体」不会被这个标签页的保存动作覆盖掉，而这个标签页自己
 *     也仍停留在自己那一份主体上（第 5 步填报页就是靠这一点钉住自己的主体）。
 *   - 兜底：删空了就补一个空白主体（与 `discardApplication` 同口径）。
 */
export const mergeApplicationsWrite = (
  stored: ApplicationsState | null,
  mine: ApplicationsState,
  intent: ApplicationsWriteIntent,
  now = Date.now()
): MergedApplicationsWrite => {
  const base: ApplicationsState = stored ?? { applications: [], activeAppId: mine.activeAppId };
  const dirty = new Set(intent.dirtyAppIds);
  const removed = new Set(intent.removedAppIds);
  const mineById = new Map(mine.applications.map((app) => [app.id, app]));

  const applications: ApplicationRecord[] = [];
  for (const app of base.applications) {
    if (removed.has(app.id)) continue;
    const own = mineById.get(app.id);
    applications.push(dirty.has(app.id) && own ? own : app);
  }
  for (const app of mine.applications) {
    if (removed.has(app.id)) continue;
    if (!applications.some((item) => item.id === app.id)) applications.push(app);
  }
  if (applications.length === 0) applications.push(createApplication(now, 0));

  const wantedActive = intent.takeActiveAppId ? mine.activeAppId : base.activeAppId;
  const activeAppId = applications.some((app) => app.id === wantedActive) ? wantedActive : applications[0].id;

  const state: ApplicationsState = { applications, activeAppId };
  return { state, changed: JSON.stringify(state) !== JSON.stringify(base) };
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
