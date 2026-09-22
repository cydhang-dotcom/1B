/**
 * 手机号验证：腾讯行为验证码 → 通过后才发短信。
 * 顺序不能颠倒 —— 没有 ticket 的请求会被短信服务直接拒绝。
 */

import {
  SMS_HOST,
  SMS_SEND_PATH,
  SMS_SCENE_TYPE,
  TENCENT_CAPTCHA_APP_ID,
  TENCENT_CAPTCHA_USER_IP,
} from '../config/api';
import { showTencentCaptcha } from '../utils/tencentCaptcha';

/** 短信服务返回。smsCodeId 是后续校验验证码用的会话 id，拿不到就说明没发出去。 */
export interface SendSmsResponse {
  smsCodeId?: string;
  message?: string;
  code?: string;
}

export interface SmsRequestResult {
  smsCodeId: string;
  message?: string;
}

/**
 * 「手机号验证通过」交出的一组凭据：手机号 + 短信会话 id + 用户填的验证码。
 *
 * 前端没有任何接口能自己校验这串码 —— 比对由**业务接口**在服务端完成（caa 同款信封里的
 * phoneNumber 就是这个形状），所以这三个字段要原样带给调用方，不能只留个「已验证」的布尔。
 */
export interface PhoneVerification {
  mobile: string;
  smsCodeId: string;
  smsValidCode: string;
}

const REQUEST_TIMEOUT_MS = 15_000;

const buildSendSmsUrl = (mobile: string, ticket: string, randstr: string): string => {
  // host 以 / 结尾、path 以 / 开头时拼出双斜杠，先各自去掉再拼
  const url = new URL(`${SMS_HOST.replace(/\/+$/, '')}/${SMS_SEND_PATH.replace(/^\/+/, '')}`);
  const params: Record<string, string> = {
    mobile,
    captchaAppId: TENCENT_CAPTCHA_APP_ID,
    userIp: TENCENT_CAPTCHA_USER_IP,
    jcaptchaCode: ticket,
    jcaptchaId: randstr,
    type: SMS_SCENE_TYPE,
  };
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.toString();
};

/**
 * 走完整流程：弹腾讯验证码 → 拿 ticket → 请求短信。
 * 用户取消验证码时抛 CaptchaCancelledError（由 tencentCaptcha 定义），调用方应静默处理；
 * 其余失败抛带中文提示的 Error，可直接展示给用户。
 */
export const requestSmsCode = async (mobile: string): Promise<SmsRequestResult> => {
  const { ticket, randstr } = await showTencentCaptcha(TENCENT_CAPTCHA_APP_ID);

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(buildSendSmsUrl(mobile, ticket, randstr), {
      method: 'GET',
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`验证码发送失败（${response.status}）`);
    }

    // tsconfig 未开 strict，响应体必须显式校验，不能假设字段存在
    const data = (await response.json()) as SendSmsResponse;
    if (!data || typeof data.smsCodeId !== 'string' || !data.smsCodeId) {
      throw new Error(data?.message || '验证码发送失败，请稍后重试');
    }

    return { smsCodeId: data.smsCodeId, message: data.message };
  } catch (cause) {
    // timedOut 只由上面那个定时器置位，用来把超时和网络故障区分开
    if (timedOut) throw new Error('请求超时，请稍后重试');
    if (cause instanceof TypeError) throw new Error('网络异常，请检查网络后重试');
    throw cause;
  } finally {
    clearTimeout(timer);
  }
};
