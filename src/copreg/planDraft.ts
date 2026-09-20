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
 * 3. `1b_copreg_plan_confirm`（**确认凭据**）：`confirm-proposal` 返回的
 *    `{ recordId, status }`，外加确认时那套选择（档位 / 自选项）。**只在确认成功后**写；
 *    有它下次进来就直接落在第 3 步（协议与支付），不必重新验证手机号。
 *    提交新问卷、重置问卷、或把套餐 / 自选项改掉，都会把它作废 —— 旧凭据代表的方案
 *    已经不是页面上这份了。
 *
 * 下次打开：有 form 就直接落到第 2 步，有 confirm 再往前一步落到第 3 步，
 * 有 report 就把诊断结果叠在方案上。
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
import { parsePlanConfirm, type PlanConfirm } from './serviceConfirm';
import { PlanAddon, ServiceTierType, SurveyData } from './types';

export const PLAN_FORM_KEY = '1b_copreg_plan_form';
export const PLAN_REPORT_KEY = '1b_copreg_plan_report';
export const PLAN_CONFIRM_KEY = '1b_copreg_plan_confirm';

/**
 * 「填写的」：问卷 + 第 2 步的选择（方案由这两样现算，不存算出来的结果）。
 *
 * 这份形状与确认接口请求体里的 `formData` **完全一致**（`serviceConfirm.ts` 直接拿它当
 * 请求体的类型）：存下去什么，点「确认并前往支付」就发什么。`addons` 因此是对象数组
 * 而不是 id 数组 —— 两边都由 `proposalQuote.addonsOf` 从同一份报价明细派生，价格同源。
 */
export interface PlanForm {
  /** 提交那一刻的问卷（与请求载荷、方案都是同一份快照） */
  survey: SurveyData;
  /** 第 2 步选过的套餐档位 */
  tier: ServiceTierType;
  /** 第 2 步勾过的自选增值服务；服务端出单要的名称与实收价一并存着 */
  addons: PlanAddon[];
}

/** 读出来的存档：三份键合起来的样子 */
export interface PlanDraft extends PlanForm {
  /** 上一次成功返回的诊断结果；没有（接口失败过 / 从没成功过）就是 null */
  report: PlanSuggestion | null;
  /** 确认凭据；没有（没确认过 / 确认失败 / 方案改过已作废）就是 null */
  confirm: PlanConfirm | null;
}

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
 * 「确认凭据」同理，没有就是 confirm 为 null（下次仍停在第 2 步）。
 */
export const loadPlanDraft = (): PlanDraft | null => {
  const form = readRecord(PLAN_FORM_KEY);
  if (form === null) return null;

  const survey = surveyOf(form.survey);
  if (!hasAnyAnswer(survey)) return null;

  return {
    survey,
    tier: tierOf(form.tier),
    // 新旧两种形状都认（旧存档是 id 字符串数组），认不出的 id 丢掉
    addons: normalizeAddons(form.addons),
    report: suggestionOf(readRecord(PLAN_REPORT_KEY)),
    confirm: parsePlanConfirm(readRecord(PLAN_CONFIRM_KEY)),
  };
};

/**
 * 存「填写的」：调接口之前写一次，方案页切套餐 / 勾加购时再刷新一次档位。
 * 写进去的就是确认接口要的那份形状（`addons` 由 `proposalQuote.addonsOf` 派生），
 * 所以「存下来什么」与「发出去什么」不会漂移。
 * 写不进去（隐私模式 / 配额满）返回 false，由调用方决定要不要告诉用户 ——
 * 存不下不该拦着人往下走。
 */
export const savePlanForm = (form: PlanForm): boolean => writeItem(PLAN_FORM_KEY, form);

/**
 * 存「返回的」：只在接口成功后调用。没有诊断结果的方案页是本地规则拼出来的，
 * 存下来下次就会被当成服务端给的结果。
 */
export const savePlanReport = (report: PlanSuggestion): boolean =>
  writeItem(PLAN_REPORT_KEY, report);

/**
 * 存「确认凭据」：只在 `confirm-proposal` 成功（status SUCCESS）后调用。
 * 它是「已经确认过、可以进第 3 步」的唯一凭据，所以存不下必须让用户知道 ——
 * 丢了它下次进来要重新确认，服务端会多出一份委托单。
 */
export const savePlanConfirm = (confirm: PlanConfirm): boolean =>
  writeItem(PLAN_CONFIRM_KEY, confirm);

/** 作废「返回的」：提交新问卷时先清掉，旧的诊断结果对应的是上一份问卷 */
export const clearPlanReport = (): void => removeItem(PLAN_REPORT_KEY);

/**
 * 作废「确认凭据」：提交新问卷、重置问卷、或把套餐 / 自选项改掉（`isPlanConfirmStale`）时调。
 * 旧凭据代表的那份方案已经不是页面上这份了，不能拿它进支付页。
 */
export const clearPlanConfirm = (): void => removeItem(PLAN_CONFIRM_KEY);

/** 三份一起作废（问卷页重置时用），否则重置完刷新一下又跳回后面的步骤看上一份问卷的方案 */
export const clearPlanDraft = (): void => {
  removeItem(PLAN_FORM_KEY);
  removeItem(PLAN_REPORT_KEY);
  removeItem(PLAN_CONFIRM_KEY);
};
