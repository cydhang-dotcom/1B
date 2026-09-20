/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 「确认并前往支付」的确认保存接口 `POST {host}/api/company-plan/confirm-proposal`：
 * 把第 1 步的**两份本地存档一并交上去**，外加刚验证过的手机号。
 *
 * 请求体恰好三个字段，与后端 DTO 逐字对应（见 docs/copreg-plan-api.md）：
 *   formData        后端是 `JsonNode`，就是本地存档 `1b_copreg_plan_form` 那份形状：
 *                   问卷 / 套餐档位 / 自选增值服务（`addons` 是 `{ id, name, price }` 对象数组，
 *                   服务端照它出单）。套餐内含的服务项不上报，服务端按 `tier` 自己映射
 *   proposalResult  本地存档 `1b_copreg_plan_report`：架构诊断结果，即 diagnose-architecture 的响应。
 *                   **后端标了 `@NotNull`** —— 诊断没成功过时前端就地拦住、不发请求：
 *                   硬送一个 null 换回 400，用户只会看到一句看不懂的后端报错
 *   phoneNumber     { mobile, smsCodeId, smsValidCode }，服务端据此比对短信验证码
 *
 * 端点由调用方注入，本文件**不 import config/api.ts**：那个文件读 import.meta.env，
 * 只有 Vite 才提供，一旦被 scripts/ 下的 tsx 自检脚本间接引到就会崩
 * （payment/client.ts 出于同样的理由也用注入式端点）。这里只做请求体拼装与请求本身，
 * 因此可以离线测试。
 *
 * 失败一律抛带中文提示的 Error，调用方据此把人拦在方案页：确认没落库就进支付页，
 * 那张订单会挂在一份服务端并不知道的确认上。
 */

import { joinUrl, postJson } from './apiClient';
// proposalQuote 是纯函数模块（只 import types），tsx 下可以直接跑，不影响下面的自检
import { ALL_ADDON_IDS, ALL_TIER_IDS, addonsOf } from './components/proposalQuote';
// 类型用 `import type` 明确标出：它们在编译期就被抹掉，所以本模块在 tsx 下不会顺着
// 类型导入摸到 planDraft → planGenerate → config/api.ts（那条路会踩 import.meta.env）
import type { PlanForm } from './planDraft';
import type { PlanSuggestion } from './planGenerate';
import type { RegistrationPlan, ServiceTierType, SurveyData } from './types';

/** 失败提示的主语，拼进 apiClient 的几种失败文案里（「确认方案超时，请稍后重试」等） */
const LABEL = '确认方案';

/**
 * 这个接口不是大模型接口，不需要 60s：按钮上的转圈超过十几秒，用户只会以为卡死了。
 * 真超时了也来得及重试 —— 没拿到确认就不往下走。
 */
export const SERVICE_CONFIRM_TIMEOUT_MS = 15_000;

/**
 * 服务端认的「确认成功」状态。响应形如
 *   `{"recordId":"VHpX5NqoXLHwPyMnVeBzCN","status":"SUCCESS"}`
 * 只有这一个状态会落本地并放人进第 3 步；别的状态（或没有状态）一律当成失败，
 * 提示里带上服务端给的原值，别让用户对着一个「成功」的 200 发呆。
 */
export const SERVICE_CONFIRM_SUCCESS_STATUS = 'SUCCESS';

/** 服务端返回的确认结果，原样两个字段 */
export interface ServiceConfirmResult {
  /** 委托单 / 确认单据号，之后下单接口的 bizId 也该用它 */
  recordId: string;
  /** 服务端自报的状态，正常是 `SUCCESS` */
  status: string;
}

/**
 * 存进本地的那份确认凭据。
 *
 * `recordId` / `status` 是**服务端给的**（严格校验，缺一个都不作数）；`tier` / `addonIds`
 * 是**前端自己附加的**，记下「这份确认是为哪套选择做的」，用来判断过期。两个附加字段是
 * 可选的：手写的凭据、或早于这次改动的版本写进去的凭据，只有服务端那两个字段——
 * 那种情况照样认它有效（服务端只说返回了这两个字段），只是没法自动判断过期，App 首帧会把
 * 当前选择补记上去（见 App.tsx），之后就正常了。
 */
export interface PlanConfirm extends ServiceConfirmResult {
  /** 确认时的套餐档位；认不出或缺失 = 没记，不参与过期判断 */
  tier?: ServiceTierType;
  /** 确认那一刻勾选的自选增值服务 id（排序无关，比较时按集合看）；缺失 = 没记 */
  addonIds?: string[];
}

/** 端点由 React 那一层从 config/api.ts 取好注入（host 已含 /v1） */
export interface ServiceConfirmEndpoint {
  host: string;
  /** 留空表示路径还没定，调用时抛 ServiceConfirmNotConfiguredError */
  path: string;
}

/** caa 同款信封里的 phoneNumber：服务端拿 smsCodeId + smsValidCode 比对验证码 */
export interface ServiceConfirmPhone {
  mobile: string;
  smsCodeId: string;
  smsValidCode: string;
}

export interface ServiceConfirmRequest {
  /**
   * 第 1 步「填写的」，对应后端 DTO 的 formData。
   *
   * 直接复用本地存档的类型（`planDraft.ts` 的 `PlanForm`）而不是另立一份：存下去的形状
   * 就是发出去的形状，`addons` 两边都是 `{ id, name, price }` 对象数组，改一处不会漏另一处。
   */
  formData: PlanForm;
  /**
   * 第 1 步「返回的」：架构诊断结果，对应后端 DTO 的 proposalResult。
   * 后端标了 `@NotNull`，所以这里也是非空：诊断没成功过就在组请求体时抛
   * ServiceConfirmMissingProposalError，不发请求。
   */
  proposalResult: PlanSuggestion;
  phoneNumber: ServiceConfirmPhone;
}

/**
 * 后端 proposalResult 是 `@NotNull`，但第 1 步「诊断失败不拦人前进」是既有产品行为，
 * 所以「人在方案页、手上却没有诊断结果」是真实可达的状态。这种时候不能硬送 null
 * 换回一句看不懂的 400，也不能编一份空壳 —— 就地拦住并告诉用户回去重新生成。
 */
export class ServiceConfirmMissingProposalError extends Error {
  constructor() {
    super('方案诊断结果缺失，请返回第 1 步点「生成需求方案」重新生成后再确认');
    this.name = 'ServiceConfirmMissingProposalError';
  }
}

/** 路径没配时不发请求，抛这个：调用方要提示的是「还没接入」，不是「网络异常」 */
export class ServiceConfirmNotConfiguredError extends Error {
  constructor() {
    super('确认方案接口尚未接入，暂时无法前往支付');
    this.name = 'ServiceConfirmNotConfiguredError';
  }
}

/**
 * 组请求体用的原料：全是点按钮那一刻的现成值，函数本身无副作用。
 * 套餐档位、加购项、服务清单、交付物都取自 `plan`（就是方案页上正在显示的那份），
 * 不分开传 —— 分开传就可能拼出一份「价格和页面不一致」的载荷。
 */
export interface ServiceConfirmInput {
  survey: SurveyData;
  plan: RegistrationPlan;
  /** 第 1 步的诊断结果；null = 那次接口失败过，组请求体时会抛错拦住 */
  report: PlanSuggestion | null;
  mobile: string;
  smsCodeId: string;
  smsValidCode: string;
}

/** 问卷里是数组的那几项，逐个复制一份（别把 React state 里的数组递出去） */
const copySurvey = (survey: SurveyData): SurveyData => ({
  ...survey,
  coreNeeds: [...survey.coreNeeds],
  scope: [...survey.scope],
  license: [...survey.license],
  sensitive: [...survey.sensitive],
  revenue: [...survey.revenue],
  shareholderType: [...survey.shareholderType],
});

const copyList = (list: string[] | null): string[] | null => (list === null ? null : [...list]);

/** 诊断结果同样复制一份。非空由调用方（serviceConfirmRequestOf）先保证 */
const copySuggestion = (report: PlanSuggestion): PlanSuggestion => ({
  ...report,
  preQualifications: copyList(report.preQualifications),
  postQualifications: copyList(report.postQualifications),
  riskTips: copyList(report.riskTips),
});

/**
 * 组请求体。`formData` 就是本地存档那份形状（`PlanForm`），其中 `addons` 与存档一样，
 * 由 `proposalQuote.addonsOf` 从方案页那份报价明细派生 —— 与 App 存 `1b_copreg_plan_form`
 * 时调的是同一个函数，所以「存下去的」与「发出去的」永远同一批对象、同一个价格。
 * 顺序也由它固定（银行开户 → 税局开户 → 社保公积金开户），与勾选先后无关。
 *
 * 诊断结果缺失（第 1 步那次接口失败过）时抛 ServiceConfirmMissingProposalError：
 * 后端 `proposalResult` 是 `@NotNull`，这里就是「不许发出半份确认」的唯一关卡。
 */
export const serviceConfirmRequestOf = (input: ServiceConfirmInput): ServiceConfirmRequest => {
  if (input.report === null) throw new ServiceConfirmMissingProposalError();

  return {
    formData: {
      survey: copySurvey(input.survey),
      tier: input.plan.selectedTier,
      addons: addonsOf(input.plan.items),
    },
    proposalResult: copySuggestion(input.report),
    phoneNumber: {
      mobile: input.mobile,
      smsCodeId: input.smsCodeId,
      smsValidCode: input.smsValidCode,
    },
  };
};

/**
 * 把响应收成 ServiceConfirmResult。
 *
 * 「有响应但没成功」也在这里变成失败：HTTP 200 只说明请求到了服务端，
 * `status` 不是 `SUCCESS`、或没给出 `recordId`，都不能当成确认成功放人进支付页 ——
 * 后者尤其重要：没有单据号的「成功」下次进来续不上，等于白确认一场。
 */
export const parseConfirmResult = (payload: Record<string, unknown>): ServiceConfirmResult => {
  const recordId = typeof payload.recordId === 'string' ? payload.recordId.trim() : '';
  const status = typeof payload.status === 'string' ? payload.status.trim().toUpperCase() : '';

  if (status !== SERVICE_CONFIRM_SUCCESS_STATUS) {
    throw new Error(status ? `确认方案未成功（${status}）` : '确认方案未返回状态，请稍后重试');
  }
  if (recordId === '') {
    throw new Error('确认方案未返回单据号，请稍后重试');
  }
  return { recordId, status };
};

/**
 * 把服务端结果与这次提交的选择合成要落本地的那份凭据。
 * 档位与自选项取自**实际发出去的** formData（不是页面 state），存下来的凭据不会与请求张冠李戴。
 */
export const planConfirmOf = (
  result: ServiceConfirmResult,
  request: ServiceConfirmRequest
): PlanConfirm => ({
  ...result,
  tier: request.formData.tier,
  addonIds: request.formData.addons.map(addon => addon.id),
});

/** 自选项比较按集合看：勾选先后与报价明细顺序不同，不该被当成「改过」 */
const sameIds = (a: string[], b: string[]): boolean =>
  a.length === b.length && [...a].sort().join(',') === [...b].sort().join(',');

/**
 * 这份确认凭据是不是**为当前这套选择**做的。档位或自选项变了就是过期：
 * 旧凭据继续用下去，用户会拿着一份与页面价格不符的确认进支付页。
 *
 * 只比较凭据里**记了**的那几项：没记档位就不比档位（手写凭据、老版本凭据都只有
 * 服务端那两个字段，不能因此判它过期 —— 那样用户看到的是「明明有凭据却不跳第三步」）。
 */
export const isPlanConfirmStale = (confirm: PlanConfirm, plan: RegistrationPlan): boolean => {
  if (confirm.tier !== undefined && confirm.tier !== plan.selectedTier) return true;
  if (confirm.addonIds !== undefined && !sameIds(confirm.addonIds, plan.selectedAddons ?? [])) return true;
  return false;
};

/**
 * 存档里的确认凭据收口。**服务端给的字段严格**：不是对象、状态不是 SUCCESS、没有单据号，
 * 一律返回 null（当作没确认过）。**前端附加的选择信息尽力而为**：档位认不出就不记档位，
 * 自选项过滤到目录内并去重 —— 那几项只是用来判断过期的注解，不该因为注解有问题就
 * 把一份真实有效的确认作废掉。
 */
export const parsePlanConfirm = (value: unknown): PlanConfirm | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;

  const recordId = typeof raw.recordId === 'string' ? raw.recordId.trim() : '';
  const status = typeof raw.status === 'string' ? raw.status.trim().toUpperCase() : '';
  if (recordId === '' || status !== SERVICE_CONFIRM_SUCCESS_STATUS) return null;

  const confirm: PlanConfirm = { recordId, status };

  const tier = ALL_TIER_IDS.find(item => item === raw.tier);
  if (tier !== undefined) confirm.tier = tier;

  if (Array.isArray(raw.addonIds)) {
    confirm.addonIds = [
      ...new Set(
        raw.addonIds.filter(
          (id): id is string => typeof id === 'string' && (ALL_ADDON_IDS as string[]).includes(id)
        )
      ),
    ];
  }

  return confirm;
};

/**
 * 给**缺注解**的凭据补上当前选择（App 首帧读到这种凭据时用）。
 * 已经有注解的原样返回（同一个引用，调用方据此判断要不要回写）。
 * 不补的话，这种凭据以后改套餐也判断不出过期。
 */
export const planConfirmWithSelection = (
  confirm: PlanConfirm,
  plan: RegistrationPlan
): PlanConfirm =>
  confirm.tier !== undefined && confirm.addonIds !== undefined
    ? confirm
    : {
        ...confirm,
        tier: plan.selectedTier,
        addonIds: addonsOf(plan.items).map(addon => addon.id),
      };

/**
 * 提交确认。成功返回**收口后的**结果（`recordId` + `status`），失败抛带中文提示的 Error。
 * 调用方拿到结果后用 `planConfirmOf` 合成凭据落本地，下次进来就能直接进第 3 步。
 */
export const confirmServicePlan = async (
  endpoint: ServiceConfirmEndpoint,
  request: ServiceConfirmRequest,
  options: { timeoutMs?: number } = {}
): Promise<ServiceConfirmResult> => {
  if (!endpoint.path) throw new ServiceConfirmNotConfiguredError();

  const payload = await postJson(
    joinUrl(endpoint.host, endpoint.path),
    request,
    LABEL,
    options.timeoutMs ?? SERVICE_CONFIRM_TIMEOUT_MS
  );
  return parseConfirmResult(payload);
};
