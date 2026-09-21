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

/**
 * code_url 的合法形态。
 *
 * 只校验「微信私有协议 + /bizpayurl 路径」，**不校验 host 与查询参数名**，
 * 因为它们随微信的下单模式而变，钉死任何一个都会误拒：
 *   weixin://wxpay/bizpayurl?sr=123456                 短链模式
 *   weixin://wxpay/bizpayurl?pr=AbCd1234               凭证模式
 *   weixin://pay.weixin.qq.com/bizpayurl/up?pr=x&groupid=00   合单支付，host 都不一样
 *   weixin://wxpay/bizpayurl?sign=…&appid=…&mch_id=…   模式一的签名长串
 *
 * 放宽的代价也只是渲染出一个微信不认的码（用户当场看得见），
 * 而收紧的代价是整条支付链路直接不可用 —— 两者不对称，所以宁可宽松。
 */
export const isWechatPayUrl = (value: string): boolean => {
  const raw = value.trim();
  if (!raw) return false;
  if (/^weixin:\/\/[\w.-]+\/bizpayurl(\/|\?|$)/i.test(raw)) return true;
  return /^https:\/\/wxpay\.weixin\.qq\.com\//i.test(raw);
};

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
  // 后端 Java 字段名是 codeURL（trade_type=NATIVE 时返回，内容是 weixin:// 开头的 code_url 文本）；
  // codeUrl 是另一种常见写法，一并认。给了 qrImageUrl 就直接用图。
  const text = decodeCodeUrl(response.codeURL ?? response.codeUrl);
  const image = normalizeImageUrl(response.qrImageUrl);

  const byText: QrSource | null = isWechatPayUrl(text) ? { kind: 'text', text } : null;
  const byImage: QrSource | null = image ? { kind: 'image', url: image } : null;

  return prefer === 'image' ? (byImage ?? byText) : (byText ?? byImage);
};

/* -------------------------------------------------------------- 服务端错误 */

/**
 * 从服务端的**业务错误信封**里取一句能给用户看的话。
 *
 * 这套后端不是用 HTTP 状态码表达业务失败的，而是回 200 + 这样的结构：
 *   { "reasons": [ { "msg_id": "当前订单已完成支付，或请联系客服。", "field": "",
 *                    "message": "当前订单已完成支付，或请联系客服。" } ] }
 * 以前我们只校验业务字段（outTradeNo / codeURL / status），认不出就把整包丢掉，
 * 用户看到的是一句「返回格式不正确」—— 服务端明明说清楚了原因，却被我们吞了。
 *
 * 这里按优先级认几种常见写法；都没有就返回 null，由调用方给兜底文案。
 */
export const serverMessageOf = (payload: unknown): string | null => {
  const record = isRecord(payload) ? payload : null;
  if (!record) return null;

  const reasons = record.reasons;
  if (Array.isArray(reasons)) {
    for (const item of reasons) {
      if (!isRecord(item)) continue;
      const text = str(item.message) || str(item.msg_id) || str(item.msg) || str(item.msgId);
      if (text) return text;
    }
  }

  const direct = str(record.message) || str(record.msg) || str(record.errorMsg) || str(record.error);
  if (direct) return direct;

  // 有些网关再套一层
  const data = record.data;
  return data === payload ? null : serverMessageOf(data);
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

  // 服务端用 200 + reasons[] 表达业务失败（如「当前订单已完成支付」）：先把这句话留给用户看
  const rejection = serverMessageOf(response);
  if (rejection) return { status: 'error', code: 'server-rejected', message: rejection };

  // 单号**不是必须的**：真实下单接口只承诺返回 codeURL，订单编号以查单返回的 orderNo 为准
  const outTradeNo = str(response.outTradeNo);

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

/**
 * 查单快照：一企通开户支付自己的字段（`GET {DOC_HOST}/xcx/yqt-co/wx-pay/open-acc/query/pay`）。
 * 只有 busUnionId 是查单入参，其余都是服务端给的业务信息。
 */
export type OpenAccPaySnapshot = {
  /** 业务关联 id：就是确认接口返回的 recordId（查单入参） */
  busUnionId: string;
  /** 订单号；服务端没给就是空串，界面不自己编 */
  orderNo: string;
  /** 支付状态原值：'1' 已支付 / '0' 未支付；别的值原样留着（判定见 mapOpenAccState） */
  status: string;
  /** 支付时间（服务端格式，原样展示） */
  payTime?: string;
  /** 支付金额（元），服务端格式化后的字符串 */
  amount?: string;
  /** 开户记录 id / 手机号：本模块不用，留给排查 */
  scbUuid?: string;
  mobile?: string;
};

export type OpenAccPayResult =
  | { status: 'ok'; snapshot: OpenAccPaySnapshot }
  | { status: 'error'; code: string; message: string };

/** BigDecimal 之类的字段会以 JSON 数字回来，收成字符串展示 */
const textOf = (value: unknown): string =>
  typeof value === 'number' && Number.isFinite(value) ? String(value) : str(value);

const PAY_STATUS_PAID = '1';
const PAY_STATUS_UNPAID = '0';

/**
 * 查单响应逐字段校验。`status` 缺失就按错误处理（不猜「没状态 = 没付」：
 * 那会把服务端换了字段名这种事藏起来，用户只会看到二维码一直转圈）。
 */
export const parseOpenAccPayResponse = (response: unknown, busUnionId: string): OpenAccPayResult => {
  if (!isRecord(response)) return { status: 'error', code: 'bad-payload', message: '查单返回格式不正确' };
  const rejection = serverMessageOf(response);
  if (rejection) return { status: 'error', code: 'server-rejected', message: rejection };
  const status = str(response.status);
  if (!status) return { status: 'error', code: 'missing-pay-status', message: '查单返回缺少支付状态' };

  return {
    status: 'ok',
    snapshot: {
      busUnionId,
      orderNo: str(response.orderNo),
      status,
      payTime: str(response.payTime) || undefined,
      amount: textOf(response.payAmount) || undefined,
      scbUuid: str(response.scbUuid) || undefined,
      mobile: str(response.mobile) || undefined,
    },
  };
};

/**
 * 查单确认已支付后，能顺手补到页面订单上的字段。
 *
 * 重新进入页面时前端手上什么都没有（手机号按约定不落本地、订单号只有服务端知道），
 * 这几项只能从查单回答里取：订单号、支付时间、**经办手机号**（已支付界面的
 * 「经办联系电话」就靠它，不然那格是空的）。
 */
export const paidFieldsOf = (
  snapshot: OpenAccPaySnapshot,
): { orderNo?: string; payTime?: string; mobile?: string } => ({
  orderNo: snapshot.orderNo || undefined,
  payTime: snapshot.payTime,
  mobile: snapshot.mobile,
});

/**
 * 这次查单能不能证明「已支付」：能就给出快照，否则 null。
 * 下单被拒后的自愈、以及进页面时核实订单状态，都用它判一次。
 */
export const paidSnapshotOf = (result: OpenAccPayResult): OpenAccPaySnapshot | null =>
  result.status === 'ok' && mapOpenAccState(result.snapshot) === 'paid' ? result.snapshot : null;

/**
 * 服务端状态 → 前端相位。两条规则：
 *   1. `'1'` = 已支付：这是唯一能进「支付成功」界面的结论，且它**压过本地倒计时**
 *      （已支付的订单被显示成「已过期」是支付模块最不可接受的 bug）。
 *   2. 其余值（含 '0' 与没见过的新值）一律 awaiting —— 服务端会加状态，客户端不能因为
 *      不认识就判死；本地到点由调用方判 expired。
 */
export const mapOpenAccState = (snapshot: OpenAccPaySnapshot): PayPhase => {
  const status = snapshot.status.trim();
  if (status === PAY_STATUS_PAID) return 'paid';
  if (status !== PAY_STATUS_UNPAID && typeof console !== 'undefined') {
    console.warn(`[payment] 未知的支付状态: ${snapshot.status}`);
  }
  return 'awaiting';
};

/* --------------------------------------------------------------- 轮询节奏 */

/** 正常态：逐步拉开间隔，别一上来就狂查 */
export const POLL_SCHEDULE_MS = [1500, 1500, 2000, 2500, 3000, 4000, 5000];
/** 失败态：退得更快，但连续失败到上限就放弃 */
export const FAILURE_SCHEDULE_MS = [1000, 2000, 4000, 8000, 15000];
export const MAX_CONSECUTIVE_FAILURES = 5;
const JITTER = 0.2;

/**
 * 取数组第 i 项，越界就夹到两端。
 * 不用 `list[i]` 直接加 `!` 断言：开了 noUncheckedIndexedAccess 的项目里
 * `list[i]` 的类型是 `number | undefined`，`!` 能过编译但会掩盖真空数组，
 * 这里显式给一个兜底值。
 */
const clampPick = (list: readonly number[], index: number): number => {
  const clamped = Math.min(Math.max(index, 0), list.length - 1);
  return list[clamped] ?? list[list.length - 1] ?? 0;
};

/**
 * 下一次查询的等待时长。rand 可注入，测试里传固定值就能做确定性断言。
 * 加抖动是为了避免同一时刻下单的客户端同频打服务端。
 */
export const nextPollDelay = (
  attempt: number,
  failures: number,
  rand: () => number = Math.random,
): number => {
  const base = clampPick(failures > 0 ? FAILURE_SCHEDULE_MS : POLL_SCHEDULE_MS, failures > 0 ? failures - 1 : attempt);
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
