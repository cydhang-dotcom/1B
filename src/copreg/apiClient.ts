/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 企业方案服务（/api/company-plan/*）两个接口共用的请求底座：拼地址、超时、
 * 错误文案归一化、响应体解析与类型收口。
 *
 * 大模型接口返回慢，两个接口都给 60s；失败一律抛带中文提示的 Error，
 * 调用方拿到就能直接进 toast —— 不存在「拿到半个结果」的中间态。
 */

/** 默认超时。大模型生成长文本比普通接口慢得多，caa 同款接口也按 60s 给 */
export const REQUEST_TIMEOUT_MS = 60_000;

/**
 * host 以 / 结尾、path 以 / 开头时拼出双斜杠，先各自去掉再拼。
 * 两个接口都在 /api/company-plan 下，所以 host 这里只留域名。
 */
export const joinUrl = (host: string, path: string): string =>
  `${host.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;

/**
 * tsconfig 没开 strict，响应体必须显式校验。服务端只承诺「字符串数组」，
 * null / 不是数组 / 混进非字符串 / 空白串都在这里挡掉，调用方拿到的永远是干净的 string[]。
 * 去重是因为这些值会直接当标签渲染，重复项会撞成同一个 React key。
 *
 * 不是数组时返回空数组 —— AI 智能填充的语义就是「空 = 没有建议」，所以那个接口用这个。
 * 需要区分「没给这一项」和「明确说没有」的接口用下面的 optionalListOf。
 */
export const stringListOf = (value: unknown): string[] => optionalListOf(value) ?? [];

/** 数组字段：不是数组（含 null / undefined）= 没给（null）；是数组就照实取，空数组表示「明确没有」 */
export const optionalListOf = (value: unknown): string[] | null =>
  Array.isArray(value)
    ? [
        ...new Set(
          value
            .filter((item): item is string => typeof item === 'string')
            .map((item) => item.trim())
            .filter((item) => item !== '')
        )
      ]
    : null;

/**
 * 单个字符串字段：不是字符串（含 null / undefined）或只有空白 = 没给（null）。
 * 空串一律算「没给」而不是「明确为空」—— 长文本字段给空串从来不是有效答案，
 * 当没给处理才能保留本地生成的那一句。
 */
export const optionalStringOf = (value: unknown): string | null => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed === '' ? null : trimmed;
};

/** 非 2xx 的响应体：后端写好的错误文案就用它，网关返回的整页 HTML 就别往提示里塞了 */
const messageOf = (text: string, status: number, label: string): string => {
  const trimmed = text.trim();
  return trimmed && !trimmed.startsWith('<') ? trimmed : `${label}失败（${status}）`;
};

/**
 * POST 一段 JSON，返回解析好的响应对象。label 是失败提示的主语（如「AI 智能填充」），
 * 拼出来的句子都能直接给用户看：
 *   非 2xx      后端文案，取不到就用「{label}失败（状态码）」
 *   超时        「{label}超时，请稍后重试」
 *   网络不通    「网络异常，请检查网络后重试」
 *   不是 JSON   「{label}返回格式异常，请稍后重试」
 *
 * 计时从调用开始算（验证码弹窗在调用之前，不计入）。
 *
 * timeoutMs 默认是给大模型接口的 60s；普通保存类接口（如「确认并前往支付」）传更短的值 ——
 * 一个按钮转圈超过十几秒，用户只会以为卡死了。
 */
export const postJson = (
  url: string,
  body: unknown,
  label: string,
  timeoutMs: number = REQUEST_TIMEOUT_MS
): Promise<Record<string, unknown>> =>
  requestJson(
    url,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    label,
    timeoutMs
  );

/**
 * GET 一段 JSON，收口规则与 postJson 完全一致（同一套超时与错误文案）。
 * 给只读查询用（如支付状态查询）：查询是幂等的，不需要 body，也不该带请求体去绕缓存。
 */
export const getJson = (
  url: string,
  label: string,
  timeoutMs: number = REQUEST_TIMEOUT_MS
): Promise<Record<string, unknown>> =>
  requestJson(url, { method: 'GET', headers: { Accept: 'application/json' } }, label, timeoutMs);

const requestJson = async (
  url: string,
  init: RequestInit,
  label: string,
  timeoutMs: number
): Promise<Record<string, unknown>> => {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });

    if (!response.ok) {
      throw new Error(messageOf(await response.text(), response.status, label));
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new Error(`${label}返回格式异常，请稍后重试`);
    }
    // 数组也是 object，但两个接口都约定了对象体，数组多半是拿错了地址（网关/代理页）
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new Error(`${label}返回格式异常，请稍后重试`);
    }

    return payload as Record<string, unknown>;
  } catch (cause) {
    // timedOut 只由上面那个定时器置位，用来把超时和网络故障区分开
    if (timedOut) throw new Error(`${label}超时，请稍后重试`);
    if (cause instanceof TypeError) throw new Error('网络异常，请检查网络后重试');
    throw cause;
  } finally {
    clearTimeout(timer);
  }
};
