/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * AI 智能填充：腾讯行为验证码 → 通过后才发请求，拿「企业描述 + 业务描述」
 * 换一份经营范围、许可资质与敏感要素建议。
 *
 * 顺序不能颠倒 —— 和 caa 的 /api/company-plan/analyze-business 一样，
 * 没有 ticket 的请求会被服务端直接拒绝。其余调用姿势也照搬 caa：60s 超时、
 * 非 2xx 时把响应体当错误文案抛出（都在 apiClient.ts 里）。差别只在数据形状 ——
 * 入参从一条 businessDescription 拆成 companyDesc / bizDesc，出参从「一段文本 + 布尔开关」
 * 改成三个字符串数组。接口定义见 src/config/api.ts。
 */

import {
  AI_FILL_PATH,
  COMPANY_PLAN_HOST,
  TENCENT_CAPTCHA_APP_ID,
  TENCENT_CAPTCHA_USER_IP,
} from '../config/api';
import { joinUrl, postJson, stringListOf } from './apiClient';
import { showTencentCaptcha } from '../utils/tencentCaptcha';

/**
 * 服务端建议，三个列表都按重要性排序，没有建议时是空数组（不是 null）。
 * **空数组 = 明确「没有」**：调用方（SurveyStep）会把它写回表单（清空该项），
 * 而不是「保留用户填的旧内容」—— 与诊断接口的覆盖口径一致。
 */
export interface AiFillResult {
  scope: string[];
  license: string[];
  sensitive: string[];
}

/** 失败提示的主语，拼进 apiClient 的几种失败文案里 */
const LABEL = 'AI 智能填充';

/**
 * 验证码票据走 query，参数名沿用 caa 同款接口的约定：jcaptchaCode = 腾讯 ticket、
 * jcaptchaId = randstr。caa 还会把这四个参数同时塞进 body，新接口的 DTO 只声明了
 * companyDesc / bizDesc 两个字段，这里就只放 query —— 万一服务端开了严格反序列化，
 * body 里多出来的字段会直接换回 400，而 query 参数不会。
 */
const buildUrl = (ticket: string, randstr: string): string => {
  // 用 URLSearchParams 拼串而不是 new URL：host 被配成相对路径（本地代理）时 new URL 会抛原生
  // TypeError，那会绕过 apiClient 的中文错误归一化，把一句英文弹给用户
  const params = new URLSearchParams({
    captchaAppId: TENCENT_CAPTCHA_APP_ID,
    userIp: TENCENT_CAPTCHA_USER_IP,
    jcaptchaCode: ticket,
    jcaptchaId: randstr,
  });
  return `${joinUrl(COMPANY_PLAN_HOST, AI_FILL_PATH)}?${params.toString()}`;
};

/**
 * 走完整流程：弹腾讯验证码 → 拿 ticket → 请求 AI 分析。两个描述都会先 trim ——
 * 后端标了 @NotBlank，空值只能换回一个 400，前端拦下来能省一次往返。
 * 用户取消验证码时抛 CaptchaCancelledError（由 tencentCaptcha 定义），调用方应静默处理；
 * 其余失败抛带中文提示的 Error，可直接展示给用户。
 */
export const aiFillSurvey = async (companyDesc: string, bizDesc: string): Promise<AiFillResult> => {
  // 弹窗在 postJson 之外：用户取消不该被当成网络故障，也不该算进那 60s
  const { ticket, randstr } = await showTencentCaptcha(TENCENT_CAPTCHA_APP_ID);

  const payload = await postJson(
    buildUrl(ticket, randstr),
    { companyDesc: companyDesc.trim(), bizDesc: bizDesc.trim() },
    LABEL
  );

  return {
    scope: stringListOf(payload.scope),
    license: stringListOf(payload.license),
    sensitive: stringListOf(payload.sensitive),
  };
};
