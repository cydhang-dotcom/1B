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
import { addonsOf } from './components/proposalQuote';
// 类型用 `import type` 明确标出：它们在编译期就被抹掉，所以本模块在 tsx 下不会顺着
// 类型导入摸到 planDraft → planGenerate → config/api.ts（那条路会踩 import.meta.env）
import type { PlanForm } from './planDraft';
import type { PlanSuggestion } from './planGenerate';
import type { RegistrationPlan, SurveyData } from './types';

/** 失败提示的主语，拼进 apiClient 的几种失败文案里（「确认方案超时，请稍后重试」等） */
const LABEL = '确认方案';

/**
 * 这个接口不是大模型接口，不需要 60s：按钮上的转圈超过十几秒，用户只会以为卡死了。
 * 真超时了也来得及重试 —— 没拿到确认就不往下走。
 */
export const SERVICE_CONFIRM_TIMEOUT_MS = 15_000;

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
 * 提交确认。成功返回服务端响应体（当前没有取用其中任何字段，先原样交回调用方，
 * 等接口方定下委托单号之类的字段再取）。失败抛带中文提示的 Error。
 */
export const confirmServicePlan = async (
  endpoint: ServiceConfirmEndpoint,
  request: ServiceConfirmRequest,
  options: { timeoutMs?: number } = {}
): Promise<Record<string, unknown>> => {
  if (!endpoint.path) throw new ServiceConfirmNotConfiguredError();

  return postJson(
    joinUrl(endpoint.host, endpoint.path),
    request,
    LABEL,
    options.timeoutMs ?? SERVICE_CONFIRM_TIMEOUT_MS
  );
};
