import {
  HttpError,
  PaymentNotConfiguredError,
  TimeoutError,
  joinUrl,
  parseCreateOrderResponse,
  parseQueryOrderResponse,
  type CreateOrderResult,
  type QueryOrderResult,
} from './model';

/**
 * 全模块唯一碰 fetch 的地方。
 *
 * 这里刻意**不 import config/api.ts**：那个文件读 import.meta.env，
 * 而 import.meta.env 只有 Vite 才提供，一旦被 scripts/ 下的 tsx 脚本间接引到就会崩。
 * 端点由调用方注入（见 useWechatNativePay.ts），本文件因此可以离线测试。
 *
 * 不做重试：下单请求盲目重发会产生多个真实订单，是支付里最经典的资损邻近 bug。
 * 要重试就靠调用方点击、且复用同一个 idempotencyKey 让服务端去重。
 */

const DEFAULT_TIMEOUT_MS = 15_000;
/** 微信 Native 二维码的默认有效期，后端没给 expiresAt 时用它兜底 */
export const DEFAULT_CODE_TTL_MS = 5 * 60 * 1000;

export type Fetcher = typeof fetch;

export type PayEndpoints = {
  host: string;
  /** 下单路径。留空表示未接入，调用时会抛 PaymentNotConfiguredError */
  createPath: string;
  /** 查单路径。同上 */
  queryPath: string;
};

export type PayClientOptions = {
  /** 测试用：注入假的 fetch */
  fetchImpl?: Fetcher;
  timeoutMs?: number;
};

/** 下单请求体。★ 这里永远不出现金额字段：服务端按 bizType/bizId 自行定价 */
export type CreateOrderPayload = {
  /** 业务类型，例如 'company-registration' */
  bizType: string;
  /** 业务单据 id */
  bizId: string;
  /** 展示给用户的标题，例如「企业注册服务费」 */
  subject?: string;
  /** 去重键，服务端据此保证重复调用只出一个订单 */
  idempotencyKey?: string;
  shareUserUuid?: string;
};

export type PayClient = {
  createOrder: (payload: CreateOrderPayload, signal?: AbortSignal) => Promise<CreateOrderResult>;
  queryOrder: (outTradeNo: string, signal?: AbortSignal) => Promise<QueryOrderResult>;
};

/** 哪些端点没配。两个路径缺任何一个都算没接入 */
export const missingEndpointPaths = (endpoints: PayEndpoints): string[] => {
  const missing: string[] = [];
  if (!endpoints.createPath) missing.push('WECHAT_NATIVE_CREATE_PATH');
  if (!endpoints.queryPath) missing.push('WECHAT_NATIVE_QUERY_PATH');
  return missing;
};

/**
 * 拼好的地址 + 超时。超时必须抛自己的 TimeoutError：
 * 原生 AbortError 分不清「用户离开页面」和「请求超时」，而这两者一个该静默丢弃、一个该重试。
 */
const request = async (
  url: string,
  init: RequestInit,
  fetchImpl: Fetcher,
  timeoutMs: number,
  outerSignal?: AbortSignal,
): Promise<unknown> => {
  const controller = new AbortController();
  // AbortSignal.timeout() / .any() 在 Safari 17.4 以下没有，不能省这几行
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onOuterAbort = () => controller.abort();
  outerSignal?.addEventListener('abort', onOuterAbort, { once: true });

  try {
    const response = await fetchImpl(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      throw new HttpError(response.status, `服务返回 ${response.status}`);
    }
    return (await response.json()) as unknown;
  } catch (cause) {
    // timedOut 只由上面那个定时器置位：外层 abort（用户离开页面）走另一条路，
    // 原样抛出原生 AbortError，由调用方静默丢弃
    if (timedOut) throw new TimeoutError();
    throw cause;
  } finally {
    clearTimeout(timer);
    outerSignal?.removeEventListener('abort', onOuterAbort);
  }
};

export function createPayClient(endpoints: PayEndpoints, options: PayClientOptions = {}): PayClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  /** 未配置时在碰 fetch 之前就拦住。抛错而不是返回 Result，是为了让控制台也响 */
  const assertConfigured = () => {
    const missing = missingEndpointPaths(endpoints);
    if (missing.length) throw new PaymentNotConfiguredError(missing);
  };

  return {
    /**
     * 下单。返回 Result 而不是抛异常（除了「未配置」那一种）：
     * tsconfig 没开 strict、vite build 也不做类型检查，网络数据的校验必须显式表达。
     */
    async createOrder(payload, signal) {
      assertConfigured();
      const json = await request(
        joinUrl(endpoints.host, endpoints.createPath),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
        fetchImpl,
        timeoutMs,
        signal,
      );
      return parseCreateOrderResponse(json, Date.now(), DEFAULT_CODE_TTL_MS);
    },

    /** 查单。这里只负责拿回 tradeState，怎么解释交给 model 的 mapTradeState */
    async queryOrder(outTradeNo, signal) {
      assertConfigured();
      const url = `${joinUrl(endpoints.host, endpoints.queryPath)}?outTradeNo=${encodeURIComponent(outTradeNo)}`;
      const json = await request(
        url,
        { method: 'GET', headers: { Accept: 'application/json' } },
        fetchImpl,
        timeoutMs,
        signal,
      );
      return parseQueryOrderResponse(json);
    },
  };
}
