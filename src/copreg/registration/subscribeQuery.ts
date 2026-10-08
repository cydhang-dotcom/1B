/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * **服务人员只读查看**：按开户单 uuid（`scbUuid`）把客户已提交的申报资料读回来。
 *
 *   GET {host}{path}{uuid}[?code={访问码}]
 *
 * 这套地址与凭据口径**照抄 www 站的 `static/js/page-display.js`**（各「code 版」静态页共用）：
 *   - `host` 就是那边的 `API_HOST`，也就是本项目的 `DOC_HOST`（开发 testv3001 / 生产 yqt.ibanbu.com，
 *     两者都自带 `/v1`）—— 与支付、企微码、`open-info` 同一个服务；
 *   - `path` 是那边各页面传给 `fetchSubscribeData` 的 basePath，默认 `/xcx/yqt-co/subscribe/`；
 *   - 带 `code` 时会校验查询码：不通过是 **HTTP 400 + `{"reasons":[{"message":"查询码无效或已过期"}]}`**
 *     （真机实测），所以这条链路必须走 `utils/serverError.ts` 的信封解析，把服务端那句人话透出来；
 *   - 不带 `code` 服务端也可能放行（测试环境实测 200），所以**不强制要求 code**，
 *     有就带上、错误文案照实透出。
 *
 * 响应体**不在这里猜结构**：拿到什么原样交给 `serviceView.ts` 去取 `openAccApply.var2`。
 *
 * 端点由调用方注入（React 层从 config/api.ts 取好），本文件不 import config/api.ts：
 * 那个文件读 import.meta.env，只有 Vite 提供，一旦被 scripts/ 下的 tsx 自检间接引到就会崩。
 */

import { serverErrorTextOf } from '../../utils/serverError';

/** 端点：host 与 path 分开注入（host 自带 /v1；path 默认以 / 结尾，拼法见 subscribeQueryUrl） */
export interface SubscribeQueryEndpoint {
  host: string;
  /** 留空表示接口还没接：调用时抛 SubscribeQueryNotConfiguredError，不发请求 */
  path: string;
}

export interface SubscribeQueryInput {
  /** 开户单 uuid（`scbUuid`）—— 就是地址栏里那个参数。**必给** */
  uuid: string;
  /** 查看码（地址栏 `code`）；没有就不带这个 query 参数 */
  code?: string;
}

/** 普通读接口，不用第 1 步大模型那 5 分钟 */
export const SUBSCRIBE_QUERY_TIMEOUT_MS = 15_000;

const LABEL = '申报资料查看';

/** 路径没配时不发请求，抛这个：调用方要提示的是「还没接入」，不是「网络异常」 */
export class SubscribeQueryNotConfiguredError extends Error {
  constructor() {
    super('客户资料查看接口尚未接入，暂时无法查看');
    this.name = 'SubscribeQueryNotConfiguredError';
  }
}

/** 没有开户单编号（链接被截断 / 手敲进来）时不发请求：服务端认不出查哪一条 */
export class SubscribeQueryMissingRecordError extends Error {
  constructor() {
    super('链接里缺少开户单编号（scbUuid），无法查看客户资料');
    this.name = 'SubscribeQueryMissingRecordError';
  }
}

/** host 以 / 结尾、path 以 / 开头时拼出双斜杠，先各自去掉再拼；path 再补回一个结尾 / */
const joinUrl = (host: string, path: string): string =>
  `${host.replace(/\/+$/, '')}/${path.replace(/^\/+/, '').replace(/\/+$/, '')}/`;

/**
 * 组请求地址：`{host}{path}{uuid}[?code=…]`。
 * uuid 与 code 都要 `encodeURIComponent`（与 page-display.js 一致），否则带 `&`/`#`/中文的
 * 访问码会把 query 拆坏 —— 访问码是服务端下发的随机串，不该出现这些字符，但坏链接必须照样能发出请求、
 * 让服务端回一句人话，而不是在前端拼出一个静默错的地址。
 */
export const subscribeQueryUrl = (endpoint: SubscribeQueryEndpoint, input: SubscribeQueryInput): string => {
  const base = `${joinUrl(endpoint.host, endpoint.path)}${encodeURIComponent(input.uuid.trim())}`;
  const code = typeof input.code === 'string' ? input.code.trim() : '';
  return code === '' ? base : `${base}?code=${encodeURIComponent(code)}`;
};

/**
 * 读回开户单详情（含 `openAccApply.var2`）。成功 resolve 解析后的 JSON（**不校验结构**），
 * 失败抛带中文提示的 Error：
 *   路径没配        「客户资料查看接口尚未接入，暂时无法查看」（不发请求）
 *   没开户单编号    「链接里缺少开户单编号（scbUuid），无法查看客户资料」（不发请求）
 *   非 2xx         优先用响应体里那句人话（查询码无效 → 「查询码无效或已过期」）
 *   超时            「申报资料查看超时，请稍后重试」
 *   网络不通        「网络异常，请检查网络后重试」
 *   空体 / 非 JSON  「申报资料查看返回格式异常，请稍后重试」
 */
export const fetchSubscribeDetail = async (
  endpoint: SubscribeQueryEndpoint,
  input: SubscribeQueryInput,
  options: { timeoutMs?: number; fetchImpl?: typeof fetch } = {}
): Promise<unknown> => {
  if (!endpoint.path) throw new SubscribeQueryNotConfiguredError();
  const uuid = typeof input.uuid === 'string' ? input.uuid.trim() : '';
  if (uuid === '') throw new SubscribeQueryMissingRecordError();

  const doFetch = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? SUBSCRIBE_QUERY_TIMEOUT_MS);

  try {
    const response = await doFetch(subscribeQueryUrl(endpoint, { ...input, uuid }), {
      method: 'GET',
      signal: controller.signal,
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(serverErrorTextOf(text, response.status, LABEL));
    }
    if (text.trim() === '') throw new Error(`${LABEL}返回格式异常，请稍后重试`);
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new Error(`${LABEL}返回格式异常，请稍后重试`);
    }
  } catch (cause) {
    // timedOut 只由上面那个定时器置位，用来把超时和网络故障区分开
    if (timedOut) throw new Error(`${LABEL}超时，请稍后重试`);
    if (cause instanceof TypeError) throw new Error('网络异常，请检查网络后重试');
    throw cause;
  } finally {
    clearTimeout(timer);
  }
};
