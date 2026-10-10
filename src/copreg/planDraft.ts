/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 第 1 步的本地存档，分三份键存放 —— 写作时机也不同：
 *
 * 1. `1b_copreg_plan_form`（**填写的**）：问卷答案 + 第 2 步选过的套餐 / 自选增值服务。
 *    **调接口之前**就写：接口不通、超时、用户在等待时直接关掉页面，问卷也还能捞回来。
 * 2. `1b_copreg_plan_report`（**返回的**）：架构诊断结果。**只在接口成功后**写 ——
 *    它和上面那份问卷是配套的。提交新问卷时先把旧的作废：上一份问卷的结论
 *    挂在新问卷上是错的。
 * 3. `1b_copreg_plan_record`（**委托单凭据**）：诊断接口同一次响应里给的 `recordId`
 *    （服务端生成方案时就建好了单）**+ 这一单的分享人**（`shareUserUuid`，建单那次从 URL 上
 *    读到的，见 utils/shareUserUuid.ts）。**只在接口成功后**写；单号是下单（`busUnionId`）
 *    与查单的唯一凭据，有它下次进来就直接落在第 3 步（协议与支付）。
 *    提交新问卷、重置问卷都会作废它 —— 旧单号代表的是上一份问卷建的单。
 *    （第 2 步不再调确认接口，也不再因为「改了套餐」作废：单号是第 1 步建的，
 *    改套餐只改前端报价，服务端按单号复核价格。）
 *
 *    **分享人为什么跟单存**（2026-10 改）：客服码弹窗要显示「把这位客户带来的人」的专属企微码。
 *    以前它读的是**当前地址栏**的 `?shareUserUuid=` —— 那是「这次从哪条链接进来的」，
 *    不是「这一单是谁带来的」：老客户点开别人的分享链接，第 3 / 5 步的弹窗就会显示**别人的**
 *    客服码，客户扫过去就联系错人了。归属只在建单那一刻定得下来，所以它必须落在这张单上。
 *
 * 下次打开：有 report 就落到第 2 步，有 record 再往前一步落到第 3 步。
 * 存的是**输入**而不是算出来的方案 —— 方案由 buildPlan(survey, quoteFor(tier, addons 的 id)) 现算、
 * 再叠 applyPlanSuggestion(report) 得到，报价改版后回来看到的是新价而不是上次存的旧数字。
 *
 * 不存的几样：
 * - 手机号、order：手机号按项目约定不落本地；订单与支付是服务端说了算的状态，
 *   前端恢复它只会恢复出一个「看着像已支付」的假象。
 * - 进度页的 timeline、服务群消息：那是演示态，没有对应存档，不做本地续命。
 *
 * 键名沿用注册页的 1b_ 前缀。用 localStorage 而不是像 registration 那样上 IndexedDB：
 * 这几份加起来只有几 KB，用不上几 M 的仓。读取时逐字段校验（tsconfig 没开 strict，
 * 存档又可能来自旧版本或被手改过），任何一处对不上就当没有存档。
 */

import { stringListOf } from './apiClient';
import { ALL_TIER_IDS, normalizeAddons } from './components/proposalQuote';
import { hasPlanContent, parsePlanSuggestion, PlanSuggestion } from './planGenerate';
import { planFormKey, planRecordKey, planReportKey } from './applications';
import { PlanAddon, ServiceTierType, SurveyData } from './types';

/**
 * 单主体时代的全局键名：**历史遗留，只留作说明，代码里不再读写它们**。
 * 现在每个主体一套键，见 `applications.planFormKey / planReportKey / planRecordKey`；
 * 也不再有任何迁移逻辑（2026-09 去掉）—— 没有主体列表就是全新一份申请。
 */
export const LEGACY_PLAN_FORM_KEY = '1b_copreg_plan_form';
export const LEGACY_PLAN_REPORT_KEY = '1b_copreg_plan_report';
export const LEGACY_PLAN_RECORD_KEY = '1b_copreg_plan_record';

/**
 * 「填写的」：问卷 + 第 2 步的选择（方案由这两样现算，不存算出来的结果）。
 *
 * `addons` 存的是对象数组（`{ id, name, price }`）而不是 id 数组：由
 * `proposalQuote.addonsOf` 从方案页那份报价明细派生，与服务端出单要的形状同源，
 * 价格改版后重算的也是同一批数字。
 */
export interface PlanForm {
  /** 提交那一刻的问卷（与请求载荷、方案都是同一份快照） */
  survey: SurveyData;
  /** 第 2 步选过的套餐档位 */
  tier: ServiceTierType;
  /** 第 2 步勾过的自选增值服务；服务端出单要的名称与实收价一并存着 */
  addons: PlanAddon[];
}

/**
 * 委托单凭据：第 1 步诊断接口返回的 `recordId`（支付下单与查单都用它）
 * + **这一单的分享人**（`shareUserUuid`：建单那次 URL 上的 `?shareUserUuid=`，没有就是空串）。
 *
 * 分享人跟着单走而不是跟着地址栏走：客户可能中途又点开另一个人的分享链接，
 * 但「这一单是谁带来的」在建单那一刻就定了 —— 客服码弹窗显示错人=把客户推到别的顾问那里。
 */
export interface PlanRecord {
  recordId: string;
  /** 空串 = 这条链接没有分享人（自然流量 / 老单没存过这个字段），客服码走通用兜底图 */
  shareUserUuid: string;
}

/** 读出来的存档：三份键合起来的样子 */
export interface PlanDraft extends PlanForm {
  /** 上一次成功返回的诊断结果；没有（接口失败过 / 从没成功过）就是 null */
  report: PlanSuggestion | null;
  /** 委托单凭据；没有（没成功生成过方案 / 已作废）就是 null */
  record: PlanRecord | null;
}

/**
 * 存档里的委托单凭据收口：不是对象、`recordId` 不是非空字符串都不认（当作没有）。
 * 单号是支付的前提，认不出就不能拿去下单。
 *
 * 分享人**缺失／不是字符串／只有空白一律收成空串**：老存档（这次改动之前建的单）没有这个字段，
 * 那时宁可显示通用客服码，也不能拿当前地址栏上别人的分享人去猜 —— 猜错就是把客户推给别的顾问。
 */
export const parsePlanRecord = (value: unknown): PlanRecord | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const recordId = textOf(raw.recordId).trim();
  return recordId === '' ? null : { recordId, shareUserUuid: textOf(raw.shareUserUuid).trim() };
};

const textOf = (value: unknown): string => (typeof value === 'string' ? value : '');

/** 问卷的逐字段校验：认不出的字段回落成「没填」，不让一份被改过的存档把页面搞崩 */
const surveyOf = (value: unknown): SurveyData => {
  const raw = (value ?? {}) as Record<string, unknown>;
  return {
    coreNeeds: stringListOf(raw.coreNeeds),
    companyDesc: textOf(raw.companyDesc),
    bizDesc: textOf(raw.bizDesc),
    scope: stringListOf(raw.scope),
    license: stringListOf(raw.license),
    sensitive: stringListOf(raw.sensitive),
    invoiceReq: textOf(raw.invoiceReq),
    monthlyAmount: textOf(raw.monthlyAmount),
    revenue: stringListOf(raw.revenue),
    revenueOther: textOf(raw.revenueOther),
    shareholderType: stringListOf(raw.shareholderType),
    shareholderCount: textOf(raw.shareholderCount),
    capitalRec: textOf(raw.capitalRec),
    capitalAmount: textOf(raw.capitalAmount),
    regAddress: textOf(raw.regAddress),
    officeSpace: textOf(raw.officeSpace),
  };
};

/** 问卷是不是真填过东西 —— 一份全空的存档不该把人直接送到第 2 步 */
const hasAnyAnswer = (survey: SurveyData): boolean =>
  Object.values(survey).some((value) => (Array.isArray(value) ? value.length > 0 : value !== ''));

const tierOf = (value: unknown): ServiceTierType =>
  ALL_TIER_IDS.find((tier) => tier === value) ?? 'bundle_small';

/** 存档里的诊断结果再走一遍响应那套校验：写进去时是接口成功的结果，读回来时未必还是 */
const suggestionOf = (value: unknown): PlanSuggestion | null => {
  if (!value || typeof value !== 'object') return null;
  const suggestion = parsePlanSuggestion(value);
  return hasPlanContent(suggestion) ? suggestion : null;
};

const readItem = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    // 隐私模式下 localStorage 直接抛异常，当作没有存档
    return null;
  }
};

const writeItem = (key: string, value: unknown): boolean => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};

const removeItem = (key: string): void => {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // 删不掉也没什么可做的：这种环境下这份存档本来也没写成功过
  }
};

/** 读一份键并解析成普通对象；坏了或形状不对都返回 null（坏 JSON 顺手删掉） */
const readRecord = (key: string): Record<string, unknown> | null => {
  const stored = readItem(key);
  if (stored === null) return null;

  try {
    const parsed: unknown = JSON.parse(stored);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    removeItem(key);
    return null;
  }
};

/**
 * 读本地存档。没有「填写的」那份、或问卷全空（重置过、存的时候就是空的）都返回 null：
 * 宁可让用户重填，也不要拿半份数据把人送进第 2 步。
 * 「返回的」那份缺失是正常的（接口还没成功过），此时 report 为 null；
 * 「委托单凭据」同理，没有就是 record 为 null（下次仍停在第 2 步）。
 */

/** 三份键；多主体之后每个主体一套（`applications.planFormKey(appId)` 等） */
interface PlanDraftKeys {
  form: string;
  report: string;
  record: string;
}

const loadPlanDraftBy = ({ form: formKey, report: reportKey, record: recordKey }: PlanDraftKeys): PlanDraft | null => {
  const form = readRecord(formKey);
  if (form === null) return null;

  const survey = surveyOf(form.survey);
  if (!hasAnyAnswer(survey)) return null;

  return {
    survey,
    tier: tierOf(form.tier),
    // 新旧两种形状都认（旧存档是 id 字符串数组），认不出的 id 丢掉
    addons: normalizeAddons(form.addons),
    report: suggestionOf(readRecord(reportKey)),
    record: parsePlanRecord(readRecord(recordKey)),
  };
};

/** 读某个主体的存档（多主体） */
export const loadPlanDraftFor = (appId: string): PlanDraft | null =>
  loadPlanDraftBy({ form: planFormKey(appId), report: planReportKey(appId), record: planRecordKey(appId) });

/* ------------------------------------------------------- 多主体（按 appId） */

export const savePlanFormFor = (appId: string, form: PlanForm): boolean => writeItem(planFormKey(appId), form);
export const savePlanReportFor = (appId: string, report: PlanSuggestion): boolean =>
  writeItem(planReportKey(appId), report);
export const savePlanRecordFor = (appId: string, record: PlanRecord): boolean =>
  writeItem(planRecordKey(appId), record);

export const clearPlanReportFor = (appId: string): void => removeItem(planReportKey(appId));
export const clearPlanRecordFor = (appId: string): void => removeItem(planRecordKey(appId));

/** 某个主体的三份一起作废（该主体重置问卷时用） */
export const clearPlanDraftFor = (appId: string): void => {
  removeItem(planFormKey(appId));
  removeItem(planReportKey(appId));
  removeItem(planRecordKey(appId));
};
