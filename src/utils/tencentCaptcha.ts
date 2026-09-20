/**
 * 腾讯云行为验证码（TCaptcha）—— 前端只负责弹窗拿到 ticket。
 *
 * appId 是公开值，真正的票据校验由服务端拿 ticket/randstr 调腾讯接口完成，
 * 所以这里不涉及任何密钥。
 */

/** 腾讯回调返回结构，ret 为 0 且带 ticket 才算通过 */
interface TencentCaptchaResult {
  ret: number;
  ticket: string;
  appid: string;
  randstr: string;
}

interface TencentCaptchaInstance {
  show: () => void;
  destroy: () => void;
}

declare global {
  interface Window {
    TencentCaptcha?: new (
      appId: string,
      callback: (res: TencentCaptchaResult) => void,
    ) => TencentCaptchaInstance;
  }
}

/** 通过验证码后返回给调用方的凭据 */
export interface CaptchaTicket {
  ticket: string;
  randstr: string;
}

/** 用户主动关闭验证码弹窗。这不是故障，调用方应当静默处理，不要报错。 */
export class CaptchaCancelledError extends Error {
  constructor() {
    super('已取消安全验证');
    this.name = 'CaptchaCancelledError';
  }
}

const SDK_URL = 'https://turing.captcha.qcloud.com/TCaptcha.js';

/** SDK 只加载一次，失败时清空以便下次重试 */
let sdkPromise: Promise<void> | null = null;
/** 实例按 appId 缓存，appId 变了就重建（同一个实例可以反复 show） */
let instance: TencentCaptchaInstance | null = null;
let instanceAppId = '';
/** 每次 show 只对应一个待决 promise */
let pending: { resolve: (v: CaptchaTicket) => void; reject: (e: Error) => void } | null = null;

const loadSdk = (): Promise<void> => {
  if (window.TencentCaptcha) return Promise.resolve();
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SDK_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      sdkPromise = null;
      reject(new Error('验证码组件加载失败，请检查网络后重试'));
    };
    document.head.appendChild(script);
  });
  return sdkPromise;
};

const getInstance = (appId: string): TencentCaptchaInstance => {
  if (instance && instanceAppId === appId) return instance;

  if (instance) {
    try {
      instance.destroy();
    } catch {
      // 旧实例销毁失败不影响后续流程
    }
  }

  const TencentCaptcha = window.TencentCaptcha;
  if (!TencentCaptcha) throw new Error('验证码组件不可用');

  instance = new TencentCaptcha(appId, (res) => {
    const waiting = pending;
    pending = null;
    if (!waiting) return;
    if (res.ticket) {
      waiting.resolve({ ticket: res.ticket, randstr: res.randstr });
    } else {
      waiting.reject(new CaptchaCancelledError());
    }
  });
  instanceAppId = appId;
  return instance;
};

/**
 * 弹出验证码，通过后 resolve 出服务端校验所需的 ticket / randstr。
 * 用户关闭弹窗或验证未通过时 reject(CaptchaCancelledError)。
 */
export const showTencentCaptcha = async (appId: string): Promise<CaptchaTicket> => {
  await loadSdk();
  const captcha = getInstance(appId);

  return new Promise<CaptchaTicket>((resolve, reject) => {
    // 上一次弹窗还挂着就当作被取代，避免 promise 永久悬挂
    if (pending) pending.reject(new CaptchaCancelledError());
    pending = { resolve, reject };
    captcha.show();
  });
};
