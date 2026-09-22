import {
  HttpError,
  serverMessageOf,
  PaymentNotConfiguredError,
  TimeoutError,
  joinUrl,
  parseCreateOrderResponse,
  parseOpenAccPayResponse,
  type CreateOrderResult,
  type OpenAccPayResult,
} from './model';

/**
 * 全模块唯一碰 fetch 的地方。
 *
 * 这里刻意**不 import config/api.ts**：那个文件读 import.meta.env，
 * 而 import.meta.env 只有 Vite 才提供，一旦被 scripts/ 下的 tsx 脚本间接引到就会崩。
 * 端点由调用方注入（见 useWechatNativePay.ts），本文件因此可以离线测试。
 * 两个端点都是「一企通开户支付」的业务接口：下单 {DOC_HOST}/xcx/yqt-co/wx-pay/open-acc/pay、
 * 查单 {DOC_HOST}/xcx/yqt-co/wx-pay/open-acc/query/pay（按 busUnionId 查）。
 *
 * 不做重试：下单请求盲目重发会产生多个真实订单，是支付里最经典的资损邻近 bug。
 * 服务端的开户支付下单接口没有去重键（见 CreateOrderPayload），所以「重复点击出两个订单」
 * 只能靠前端状态机挡住：hook 的 creating 相位 + 按钮 disable，一次点击只发一次。
 */

/** 响应体可能是 JSON，也可能是网关整页 HTML —— 解不开就当没有 */
const tryParseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

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

/**
 * 下单（创建开户支付订单）请求体，对应 `POST {DOC_HOST}/xcx/yqt-co/wx-pay/open-acc/pay`。
 *
 * ★ **金额由前端传**（服务端按 `busUnionId` 关联业务，但金额取的是这里传的值）。
 *   这意味着前端传什么价就按什么价收款 —— 服务端**必须**按 `busUnionId` 复核一遍价格，
 *   否则改一个请求体就能少付钱。
 * ★ 没有去重键：同一次点击绝不能重发（调用方负责），下单失败也不自动重试。
 */
export type CreateOrderPayload = {
  /** 支付金额（元）。与页面上显示的实付金额同一个数：`plan.finalPrice` */
  payAmount: number;
  /** 业务关联 id：第 1 步生成方案时返回的委托单号（本地存档 `1b_copreg_plan_record`） */
  busUnionId: string;
};

export type PayClient = {
  createOrder: (payload: CreateOrderPayload, signal?: AbortSignal) => Promise<CreateOrderResult>;
  /** 查单：按业务关联 id（copreg 侧就是第 1 步给的委托单号）查这笔开户支付订单的状态 */
  queryOrder: (busUnionId: string, signal?: AbortSignal) => Promise<OpenAccPayResult>;
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
      // 非 2xx 时后端也常把原因写在同样的 reasons[] 信封里，能读出来就别只报状态码
      const body = typeof response.text === 'function' ? await response.text().catch(() => '') : '';
      const parsed = body ? tryParseJson(body) : null;
      throw new HttpError(response.status, serverMessageOf(parsed) || `服务返回 ${response.status}`);
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

    /**
     * 查单。入参是业务关联 id（委托单号），不是订单号 —— 服务端的开户支付查单就是按它查的。
     * 这里只负责拿回 status，怎么解释交给 model 的 mapOpenAccState。
     */
    async queryOrder(busUnionId, signal) {
      assertConfigured();
      const url = `${joinUrl(endpoints.host, endpoints.queryPath)}?busUnionId=${encodeURIComponent(busUnionId)}`;
      const json = await request(
        url,
        { method: 'GET', headers: { Accept: 'application/json' } },
        fetchImpl,
        timeoutMs,
        signal,
      );
      return parseOpenAccPayResponse(json, busUnionId);
    },
  };
}
