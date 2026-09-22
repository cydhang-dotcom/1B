/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 生成需求方案（架构诊断）：过完腾讯行为验证码，把整份问卷发给
 * `POST /api/company-plan/diagnose-architecture`，换回一份「组织形式 / 纳税人身份 / 注册资本 /
 * 注册地址 / 许可资质 / 风险提示」的诊断结果，覆盖到本地方案上。
 *
 * 和 AI 智能填充（aiFill.ts）一样是「验证码通过才发请求」的接口，票据走 query
 * （captchaAppId / userIp / jcaptchaCode / jcaptchaId），没有 ticket 的请求会被服务端直接拒绝。
 * 区别只在调用姿势：这里的弹窗由调用方先调 requestPlanCaptcha 拿票据、再把它交给
 * generatePlanReport —— 见 requestPlanCaptcha 的注释（提交问卷在弹窗之前还有一串本地动作，
 * 用户取消时那些都不该发生）。
 *
 * 接口地址与完整响应字段见 src/config/api.ts 的 COMPANY_PLAN_HOST 段；请求参数**以前端为准** ——
 * 下面 PlanFormData 就是问卷 SurveyData 的逐字段镜像（字段名完全一致），
 * 服务端照这套名字取即可，前端加字段时这里同步加一项即可（不直接透传 survey，
 * 免得以后问卷加了内部字段就悄悄漏出去）。
 *
 * 价格、套餐、服务项不参与覆盖：那些只由前端报价（proposalQuote.ts）决定，
 * 服务端给什么都不改 —— 报价是产品定价，不是模型能决定的事。
 */

import {
  COMPANY_PLAN_HOST,
  PLAN_DIAGNOSE_PATH,
  TENCENT_CAPTCHA_APP_ID,
  TENCENT_CAPTCHA_USER_IP,
} from '../config/api';
import { joinUrl, optionalListOf, optionalStringOf, postJson } from './apiClient';
import { RegistrationPlan, SurveyData } from './types';
import { CaptchaCancelledError, showTencentCaptcha, type CaptchaTicket } from '../utils/tencentCaptcha';

/** 失败提示的主语，拼进 apiClient 的几种失败文案里 */
const LABEL = '生成需求方案';

/**
 * 请求体 formData 的字段表。每一项都来自用户在问卷页的填写
 * （含 AI 智能填充写回的经营范围 / 许可资质 / 敏感要素）。
 *
 * 单位与取值口径都跟问卷一致：注册资本是「万元」的纯数字串，
 * 单选字段直接给用户看到的那句选项文案，不做二次编码。
 */
export interface PlanFormData {
  /** 核心需求（多选）：用户勾选的办理诉求 */
  coreNeeds: string[];
  /** 企业描述：字号、行业、主营方向；AI 填范围与出方案的主要依据之一 */
  companyDesc: string;
  /** 业务描述：具体做什么业务、面向企业还是消费者、线上还是线下 */
  bizDesc: string;
  /** 经营范围：标准表述条目，可能来自 AI 智能填充，也可能是用户自己加的 */
  scope: string[];
  /** 许可资质：行政许可 / 备案资质全称 */
  license: string[];
  /** 敏感要素：只在表单固定选项内取值（plan.ts 的 SENSITIVE_OPTIONS） */
  sensitive: string[];
  /** 近期开票要求：`不确定` / `增值税专用发票` / `增值税普通发票` */
  invoiceReq: string;
  /** 预计月开票额：取用户选中的那档文案（如「10 - 50 万」） */
  monthlyAmount: string;
  /** 收入模式（多选） */
  revenue: string[];
  /** 其他收入模式：revenue 选了「其他」时用户自己写的补充说明 */
  revenueOther: string;
  /** 股东类型（多选）：自然人 / 企业法人 等 */
  shareholderType: string[];
  /** 股东人数：`1 个` / `2 个` / `3 个及以上` */
  shareholderCount: string;
  /** 是否需要注册资本专家建议：'是' = 金额由服务人员定，'否' = 用户自己填了金额 */
  capitalRec: string;
  /** 注册资本金额（万元）：仅 capitalRec === '否' 时非空，纯数字串 */
  capitalAmount: string;
  /** 是否需要推荐注册地址：'是…' / '否…'，带上用户选的那句后缀说明 */
  regAddress: string;
  /** 是否需要推荐实体办公场地：同上，带后缀说明 */
  officeSpace: string;
}

/** 请求体：问卷字段全在 formData 下，和 caa 同接口的信封保持一致 */
export interface PlanGenerateRequest {
  formData: PlanFormData;
}

/**
 * 服务端给的架构诊断结果，只收前端真正读到的那几项
 * （`model` 是服务端自报的模型名，前端没有展示位，所以不取）。
 *
 * null = 服务端没给这一项，覆盖时保留本地方案的值；
 * 字符串数组给空数组 = 明确「没有」，就用空数组（服务端说不需要前置许可，
 * 就不该继续显示本地模板猜的那条）。
 */
export interface PlanSuggestion {
  /** 企业名称方案（一整段，通常含备选名） */
  companyNameProposal: string | null;
  /** 组织形式（含股东结构建议，服务端给的是一整段） */
  companyType: string | null;
  /** 纳税人身份规划 */
  taxpayerIdentity: string | null;
  /** 这么定的理由 */
  taxReason: string | null;
  /** 注册资本建议（一整句话，含金额） */
  capitalAmount: string | null;
  /** 出资节奏与实缴安排建议 */
  capitalAdvice: string | null;
  /** 注册地址合规策略 */
  registeredAddressAdvice: string | null;
  /** 前置许可 / 备案清单 */
  preQualifications: string[] | null;
  /** 后置许可 / 资质清单 */
  postQualifications: string[] | null;
  /** 合规风险提示 */
  riskTips: string[] | null;
}

/** 问卷 → 请求体里的 formData（数组都复制一份，避免把 state 里的数组交出去） */
export const planFormFromSurvey = (survey: SurveyData): PlanFormData => ({
  coreNeeds: [...survey.coreNeeds],
  companyDesc: survey.companyDesc,
  bizDesc: survey.bizDesc,
  scope: [...survey.scope],
  license: [...survey.license],
  sensitive: [...survey.sensitive],
  invoiceReq: survey.invoiceReq,
  monthlyAmount: survey.monthlyAmount,
  revenue: [...survey.revenue],
  revenueOther: survey.revenueOther,
  shareholderType: [...survey.shareholderType],
  shareholderCount: survey.shareholderCount,
  capitalRec: survey.capitalRec,
  // 问卷里切回「是」只是把金额输入框藏起来，state 里的数字还留着 ——
  // 那种情况下带出去的金额是上一次填的，和 capitalRec 自相矛盾，这里按「没填」送
  capitalAmount: survey.capitalRec === '否' ? survey.capitalAmount : '',
  regAddress: survey.regAddress,
  officeSpace: survey.officeSpace,
});

/**
 * 把一份「形状未知的」诊断结果收成 PlanSuggestion：接口响应与本地快照（planDraft.ts）
 * 共用这一份字段校验 —— localStorage 里的东西也可能被改过、或是别的版本写的，
 * 不能因为它在本地就直接当可信数据用。
 */
export const parsePlanSuggestion = (payload: unknown): PlanSuggestion => {
  const source = (payload ?? {}) as Record<string, unknown>;
  return {
    companyNameProposal: optionalStringOf(source.companyNameProposal),
    companyType: optionalStringOf(source.companyType),
    taxpayerIdentity: optionalStringOf(source.taxpayerIdentity),
    taxReason: optionalStringOf(source.taxReason),
    capitalAmount: optionalStringOf(source.capitalAmount),
    capitalAdvice: optionalStringOf(source.capitalAdvice),
    registeredAddressAdvice: optionalStringOf(source.registeredAddressAdvice),
    preQualifications: optionalListOf(source.preQualifications),
    postQualifications: optionalListOf(source.postQualifications),
    riskTips: optionalListOf(source.riskTips),
  };
};

/** 一项可用内容都没有 = 后端没给这个接口该给的东西（字段名对不上，或真的什么都没算出来） */
export const hasPlanContent = (suggestion: PlanSuggestion): boolean =>
  [
    suggestion.companyNameProposal,
    suggestion.companyType,
    suggestion.taxpayerIdentity,
    suggestion.taxReason,
    suggestion.capitalAmount,
    suggestion.capitalAdvice,
    suggestion.registeredAddressAdvice,
    suggestion.preQualifications,
    suggestion.postQualifications,
    suggestion.riskTips,
  ].some((field) => field !== null);

/**
 * 「生成需求方案」的腾讯行为验证码闸门：弹出验证码，通过后 resolve 出服务端校验所需的票据。
 *
 * 顺序不能颠倒 —— 和 AI 智能填充（aiFill.ts 的 aiFillSurvey）一样，没有 ticket 的请求
 * 会被服务端直接拒绝。只是这里把弹窗单独拆成一步给调用方先调，而不是塞在请求函数里：
 * 提交问卷在弹窗之前还有一串本地动作（存问卷、作废上一份诊断与确认凭据），
 * 用户自己关掉弹窗时那些都不该发生，页面也该原地不动 —— 放在请求函数里就拦不住它们。
 *
 * 用户取消返回 null（不是失败，调用方原地不动、不要报错）；
 * 组件加载不出来等真故障抛带中文提示的 Error（此时接口一个请求都没发）。
 */
export const requestPlanCaptcha = async (): Promise<CaptchaTicket | null> => {
  try {
    return await showTencentCaptcha(TENCENT_CAPTCHA_APP_ID);
  } catch (error) {
    if (error instanceof CaptchaCancelledError) return null;
    throw error;
  }
};

/**
 * 验证码票据走 query，参数名沿用 caa 同款接口的约定：jcaptchaCode = 腾讯 ticket、
 * jcaptchaId = randstr。不重复塞进 body —— body 的 DTO 只声明了 formData（caa 那边还有
 * phoneNumber），严格反序列化下多出来的字段会直接换回 400，而 query 参数不会。
 */
const buildUrl = ({ ticket, randstr }: CaptchaTicket): string => {
  // 用 URLSearchParams 拼串而不是 new URL：host 被配成相对路径（本地代理）时 new URL 会抛原生
  // TypeError，那会绕过 apiClient 的中文错误归一化，把一句英文弹给用户
  const params = new URLSearchParams({
    captchaAppId: TENCENT_CAPTCHA_APP_ID,
    userIp: TENCENT_CAPTCHA_USER_IP,
    jcaptchaCode: ticket,
    jcaptchaId: randstr,
  });
  return `${joinUrl(COMPANY_PLAN_HOST, PLAN_DIAGNOSE_PATH)}?${params.toString()}`;
};

/**
 * 请求架构诊断，票据取自 requestPlanCaptcha（没过验证码就没有票据可传）。
 * 失败抛带中文提示的 Error（超时 / 网络 / 后端文案 / 没有任何可用字段），
 * 由调用方决定怎么兜 —— App.tsx 是「不拦人前进，但把失败说出来」。
 *
 * 「响应是合法 JSON 但认不出任何字段」也算失败：那多半是字段名对不上，
 * 此时若当成成功，用户会看到一份本地模板方案却以为它是服务端给的。
 */
export const generatePlanReport = async (
  survey: SurveyData,
  captcha: CaptchaTicket
): Promise<PlanSuggestion> => {
  const body: PlanGenerateRequest = { formData: planFormFromSurvey(survey) };
  const payload = await postJson(buildUrl(captcha), body, LABEL);

  const suggestion = parsePlanSuggestion(payload);
  if (!hasPlanContent(suggestion)) throw new Error('生成需求方案未返回可用内容');
  return suggestion;
};

/**
 * 把诊断结果覆盖到方案上：服务端给了这一项才用，没给的项保持传入方案的原样
 * （字符串字段给空串、数组字段不是数组都算「没给」；给空数组算「明确没有」）。
 * 价格与套餐字段一律不动（见文件头），所以对已经切过套餐的方案再叠一次也是安全的。
 * suggestion 为 null（接口失败）时原样返回。
 */
export const applyPlanSuggestion = (
  plan: RegistrationPlan,
  suggestion: PlanSuggestion | null
): RegistrationPlan =>
  suggestion === null
    ? plan
    : {
        ...plan,
        companyNameProposal: suggestion.companyNameProposal ?? plan.companyNameProposal,
        companyType: suggestion.companyType ?? plan.companyType,
        taxpayerIdentity: suggestion.taxpayerIdentity ?? plan.taxpayerIdentity,
        taxReason: suggestion.taxReason ?? plan.taxReason,
        capitalAmount: suggestion.capitalAmount ?? plan.capitalAmount,
        capitalAdvice: suggestion.capitalAdvice ?? plan.capitalAdvice,
        registeredAddressAdvice: suggestion.registeredAddressAdvice ?? plan.registeredAddressAdvice,
        preQualifications: suggestion.preQualifications ?? plan.preQualifications,
        postQualifications: suggestion.postQualifications ?? plan.postQualifications,
        riskTips: suggestion.riskTips ?? plan.riskTips,
      };
