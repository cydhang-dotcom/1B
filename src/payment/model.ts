/**
 * 微信支付 Native（PC 扫码）的数据模型与纯函数。
 *
 * 这一层零依赖、零 DOM、零 fetch，因此 scripts/check-wechat-pay.ts 可以用
 * `npx tsx` 直接跑。React 相关的东西一律在 useWechatNativePay.ts 里。
 *
 * 边界：商户私钥、下单签名、回调验签都在后端，前端只做展示与状态机，
 * 永远不判断「这笔钱收没收到」——只如实转述服务端的 trade_state。
 */

/* ------------------------------------------------------------------ 状态机 */

/**
 * awaiting 是「已出码、等用户扫」，不是「支付中」。
 * unconfigured 与 error 必须分开：前者是配置问题（重试一万次也不会好、不给重试按钮），
 * 后者是运行期故障（可重试）。
 */
export type PayPhase =
  | 'idle'
  | 'creating'
  | 'awaiting'
  | 'paid'
  | 'expired'
  | 'closed'
  | 'failed'
  | 'unconfigured'
  | 'error';

/** 已结束的终态：不会再变，UI 可以据此停止渲染倒计时 */
export const TERMINAL_PHASES: readonly PayPhase[] = ['paid', 'expired', 'closed', 'failed'];

export const isTerminal = (phase: PayPhase): boolean => TERMINAL_PHASES.includes(phase);

/**
 * 二维码的两种来源。后端给 codeUrl 就前端渲染，给 qrImageUrl 就直接用图。
 * url 在解析阶段已归一化为绝对地址，组件不参与补全。
 */
export type QrSource = { kind: 'text'; text: string } | { kind: 'image'; url: string };

export type PaymentOrder = {
  outTradeNo: string;
  qr: QrSource;
  /** 毫秒时间戳；本地倒计时的依据 */
  expiresAt: number;
  /** 服务端回传的应付金额，仅用于展示（比如「￥100.00」），不参与任何计算 */
  amount: string;
  currency: string;
};

/* ------------------------------------------------------------------ 异常类型 */

/**
 * 接口路径没配。刻意独立于普通 Error：调用方要能靠它把 UI 切到 unconfigured，
 * 而不是被通用 catch 吞成「网络异常，请重试」——那又是一种静默失败。
 */
export class PaymentNotConfiguredError extends Error {
  readonly missing: string[];

  constructor(missing: string[]) {
    super('支付功能尚未开通');
    this.name = 'PaymentNotConfiguredError';
    this.missing = missing;
  }
}

/** 请求超时。必须与「卸载导致的 abort」区分开：前者可重试，后者要被静默丢弃 */
export class TimeoutError extends Error {
  constructor(message = '请求超时') {
    super(message);
    this.name = 'TimeoutError';
  }
}

/** fetch 抛的原生 AbortError 没有可靠的类型判别，只能按 name 认 */
export const isAbortError = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'AbortError';

export const isFatalQueryError = (error: unknown): boolean =>
  error instanceof PaymentNotConfiguredError || (error instanceof HttpError && [401, 403, 404].includes(error.status));

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, message: string, code = '') {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}

/* ------------------------------------------------------------------ 小工具 */

/** host 可能带尾斜杠、path 可能缺前导斜杠，两边都补一次，避免拼出 `//xcx/...` */
export const joinUrl = (host: string, path: string): string =>
  `${(host ?? '').replace(/\/+$/, '')}/${(path ?? '').replace(/^\/+/, '')}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/** 数值字段可能是 number 也可能是数字串，统一成字符串；金额保留两位小数 */
export const formatAmount = (value: unknown, currency: string): string => {
  if (value === null || value === undefined || value === '') return '';
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return '';
  const text = num.toFixed(2);
  return currency === 'CNY' || currency === '' ? `￥${text}` : `${text} ${currency}`;
};

/**
 * 时间归一化成毫秒。后端可能给秒、毫秒、ISO、或微信 v2 风格的 yyyyMMddHHmmss。
 * 认不出来返回 null —— 让调用方决定兜底，不猜。
 */
export const normalizeEpochMs = (value: unknown): number | null => {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return null;
    // 10 位是秒，13 位是毫秒；再短的当毫秒（离现在太近，判不了）
    return value < 1e11 ? Math.round(value * 1000) : Math.round(value);
  }
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw) return null;

  // yyyyMMddHHmmss：new Date() 解不了这个格式，必须手写
  const compact = raw.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
  if (compact) {
    const [, y, mo, d, h, mi, s] = compact;
    const ms = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s)).getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (/^\d+$/.test(raw)) return normalizeEpochMs(Number(raw));

  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

/** 兜底有效期同时夹到 [1 分钟, 2 小时]，避免后端漏字段时倒计时荒唐 */
export const clampTtl = (ms: number): number => Math.min(Math.max(ms, 60_000), 2 * 60 * 60 * 1000);

/**
 * 过期时刻：服务端优先，缺省用兜底的 TTL。
 * 服务端给了过去的时间就原样返回（由 mapTradeState 决定是否直接 expired），不纠正。
 */
export const resolveExpiresAt = (response: unknown, now: number, fallbackMs: number): number => {
  const raw = isRecord(response)
    ? (response.expiresAt ?? (response as { timeExpire?: unknown }).timeExpire)
    : undefined;
  const parsed = normalizeEpochMs(raw);
  if (parsed !== null) {
    // 机器时钟快几十秒会让二维码一出码就「已过期」，给一点容差
    return parsed > now ? parsed : Math.max(parsed, now + 60_000);
  }
  return now + clampTtl(fallbackMs);
};

/* --------------------------------------------------------------- 二维码来源 */

/**
 * code_url 里可能残留 XML 实体（微信 v2 XML 接口的遗留）。
 * 这里要做的是实体反转义，**不是 decodeURIComponent** —— 后者会把 % 和 + 弄坏，
 * 生成一个扫不出来的码。同理，编码进二维码时也不要 encodeURIComponent。
 */
export const decodeCodeUrl = (value: unknown): string => {
  const raw = str(value);
  if (!raw) return '';
  return raw
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
};

/** code_url 的合法形态：微信的私有协议或微信支付域名 */
export const isWechatPayUrl = (value: string): boolean =>
  /^weixin:\/\/wxpay\/bizpayurl/i.test(value) || /^https:\/\/wxpay\.weixin\.qq\.com\//i.test(value);

/**
 * 图片地址归一化。只接受 http(s) 绝对地址或协议相对地址。
 * 根相对路径（如 /doc/uuid/x/get）刻意返回 null 而不是猜着补 host：
 * 站点部署在 /OneBiz 这类子路径下时，根相对路径会解析到域名根并 404，
 * 猜一个 host 只会把 404 藏起来。
 */
export const normalizeImageUrl = (value: unknown): string | null => {
  const raw = str(value);
  if (!raw) return null;
  if (raw.startsWith('//')) return `https:${raw}`;
  if (/^https?:\/\//i.test(raw)) return raw;
  return null;
};

/**
 * 二选一选二维码来源。首选非法时降级到次选而不是返回 null ——
 * 后端图片挂了但 codeUrl 是好的，还有得救。两个都不行才 null。
 */
export const resolveQrSource = (
  response: unknown,
  prefer: 'codeUrl' | 'image' = 'codeUrl',
): QrSource | null => {
  if (!isRecord(response)) return null;
  const text = decodeCodeUrl(response.codeUrl);
  const image = normalizeImageUrl(response.qrImageUrl);

  const byText: QrSource | null = isWechatPayUrl(text) ? { kind: 'text', text } : null;
  const byImage: QrSource | null = image ? { kind: 'image', url: image } : null;

  return prefer === 'image' ? (byImage ?? byText) : (byText ?? byImage);
};

/* ------------------------------------------------------------------ 响应解析 */

/**
 * 判别字段用字符串而不是 boolean：本仓库 tsconfig 没开 strictNullChecks，
 * 那种设置下 TS 不会按 `ok: true|false` 收窄联合类型（实测），
 * 而字符串字面量判别是可靠的。
 */
export type CreateOrderResult =
  | { status: 'ok'; order: PaymentOrder }
  | { status: 'error'; code: string; message: string };

/**
 * 下单响应逐字段校验。tsconfig 没开 strict、vite build 也不做类型检查，
 * 所以来自网络的数据一律运行时校验，绝不用 as 断言。
 */
export const parseCreateOrderResponse = (
  response: unknown,
  now: number,
  fallbackTtlMs: number,
  prefer: 'codeUrl' | 'image' = 'codeUrl',
): CreateOrderResult => {
  if (!isRecord(response)) return { status: 'error', code: 'bad-payload', message: '下单返回格式不正确' };

  const outTradeNo = str(response.outTradeNo);
  if (!outTradeNo) return { status: 'error', code: 'missing-out-trade-no', message: '下单返回缺少订单号' };

  const qr = resolveQrSource(response, prefer);
  if (!qr) return { status: 'error', code: 'missing-qr', message: '下单返回缺少可用的支付二维码' };

  const currency = str(response.currency) || 'CNY';
  return {
    status: 'ok',
    order: {
      outTradeNo,
      qr,
      expiresAt: resolveExpiresAt(response, now, fallbackTtlMs),
      amount: formatAmount(response.amount, currency),
      currency,
    },
  };
};

export type QueryOrderSnapshot = { outTradeNo: string; tradeState: string; amount: string };

export type QueryOrderResult =
  | { status: 'ok'; snapshot: QueryOrderSnapshot }
  | { status: 'error'; code: string; message: string };

export const parseQueryOrderResponse = (response: unknown): QueryOrderResult => {
  if (!isRecord(response)) return { status: 'error', code: 'bad-payload', message: '查单返回格式不正确' };
  const tradeState = str(response.tradeState);
  if (!tradeState) return { status: 'error', code: 'missing-trade-state', message: '查单返回缺少交易状态' };
  const currency = str(response.currency) || 'CNY';
  return {
    status: 'ok',
    snapshot: {
      outTradeNo: str(response.outTradeNo),
      tradeState,
      amount: formatAmount(response.amount, currency),
    },
  };
};

/* --------------------------------------------------------------- 状态判定 */

/**
 * 唯一的终态判定入口。两条规则：
 *   1. 服务端终态永远压过本地倒计时 —— SUCCESS 即使本地已到点也算 paid。
 *      已支付的订单被显示成「已过期」是支付模块最不可接受的 bug。
 *   2. 不认识的 trade_state 一律当 awaiting —— 微信会加状态，客户端不能因为不认识就判死。
 */
export const mapTradeState = (snapshot: QueryOrderSnapshot, now: number, expiresAt: number): PayPhase => {
  const state = snapshot.tradeState.trim().toUpperCase();
  switch (state) {
    case 'SUCCESS':
      return 'paid';
    case 'CLOSED':
    case 'REVOKED':
    // 退款的订单不可能再支付，对本模块而言等同于已关闭
    case 'REFUND':
      return 'closed';
    case 'PAYERROR':
      return 'failed';
    case 'NOTPAY':
    case 'USERPAYING':
      return now >= expiresAt ? 'expired' : 'awaiting';
    default:
      if (typeof console !== 'undefined') {
        console.warn(`[payment] 未知的 trade_state: ${snapshot.tradeState}`);
      }
      return now >= expiresAt ? 'expired' : 'awaiting';
  }
};

/* --------------------------------------------------------------- 轮询节奏 */

/** 正常态：逐步拉开间隔，别一上来就狂查 */
export const POLL_SCHEDULE_MS = [1500, 1500, 2000, 2500, 3000, 4000, 5000];
/** 失败态：退得更快，但连续失败到上限就放弃 */
export const FAILURE_SCHEDULE_MS = [1000, 2000, 4000, 8000, 15000];
export const MAX_CONSECUTIVE_FAILURES = 5;
const JITTER = 0.2;

/**
 * 下一次查询的等待时长。rand 可注入，测试里传固定值就能做确定性断言。
 * 加抖动是为了避免同一时刻下单的客户端同频打服务端。
 */
export const nextPollDelay = (
  attempt: number,
  failures: number,
  rand: () => number = Math.random,
): number => {
  const schedule = failures > 0 ? FAILURE_SCHEDULE_MS : POLL_SCHEDULE_MS;
  const index = failures > 0 ? failures - 1 : attempt;
  const base = schedule[Math.min(Math.max(index, 0), schedule.length - 1)];
  const factor = 1 + (rand() * 2 - 1) * JITTER;
  return Math.max(0, Math.round(base * factor));
};

/** 异常 → phase。必须让「未配置」走 unconfigured 而不是 error，否则又变成静默失败 */
export const toPhaseForError = (error: unknown): PayPhase =>
  error instanceof PaymentNotConfiguredError ? 'unconfigured' : 'error';

export const toUserMessage = (error: unknown): string => {
  if (error instanceof PaymentNotConfiguredError) return '支付功能尚未开通，请联系管理员';
  if (error instanceof TimeoutError) return '网络超时，请检查网络后重试';
  if (error instanceof HttpError) return error.message || '服务暂时不可用，请稍后重试';
  if (error instanceof Error && error.message) return error.message;
  return '发生未知错误，请稍后重试';
};
