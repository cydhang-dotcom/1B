/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * **把非 2xx 的响应体收成一句能直接给用户看的错误文案。**
 *
 * 后端（含网关）表达失败有几种常见写法：
 *   1. 一段纯文本：「手机验证码不正确，请重新获取」——直接用；
 *   2. 一个 JSON 信封：
 *      `{ "status": 400, "error": "Bad Request", "message": "短信验证码错误",
 *         "code": "error.0098", "recordId": "error.0098", … }`
 *      只取 `message` / `msg` / `errorMsg` / `error`（或支付那套 `reasons[]`）里那句人话；
 *   3. **信封里再套一层 JSON**（网关把上游的报错原样塞进 `message` 字符串）：
 *      `{ "status": 502, "message": "{\"status\":504,\"code\":\"AI_TIMEOUT\",
 *         \"message\":\"AI request timed out\"}" }`
 *      —— 这一层以前会被当成普通文案整段显示。这里**递归拆到最里层**，并识别超时
 *      （里层 `status` 408/504 或 `code` / 文案里带 timeout）后翻成「{接口名}超时，请稍后重试」。
 *
 * 取不到可用文案（网关整页 HTML、JSON 里只有 `"Bad Request"` 这种 HTTP 短语、空体、
 * 说不清是 JSON 又解析不了）一律回落到「{接口名}失败（状态码）」——
 * 宁可少说，也不把机器字段糊到用户脸上。
 *
 * 纯函数，不碰 DOM / 网络，`scripts/check-server-error.ts` 直接引它做离线自检。
 */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** HTTP 状态短语：出现在 `error` 字段里时不算「后端写好的文案」 */
const GENERIC_HTTP_PHRASES = new Set([
  'bad request',
  'unauthorized',
  'payment required',
  'forbidden',
  'not found',
  'method not allowed',
  'request timeout',
  'conflict',
  'gone',
  'unprocessable entity',
  'too many requests',
  'internal server error',
  'not implemented',
  'bad gateway',
  'service unavailable',
  'gateway timeout',
]);

/** 超时状态码：网关把上游超时原样透出时常见 504（有时 408） */
const TIMEOUT_STATUSES = new Set([408, 504]);

/** 中文文案（含中日韩统一表意文字）才算「后端写给人看的话」，英文短语优先翻成中文兜底 */
const HAS_CJK = /[\u3400-\u9fff]/;

/** 嵌套 JSON 字符串最多拆这么多层，防止异常数据把解析拖死 */
const MAX_ENVELOPE_DEPTH = 4;

const textOf = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const looksLikeJson = (text: string): boolean => text.startsWith('{') || text.startsWith('[');

const isTimeoutHint = (record: Record<string, unknown>): boolean => {
  const status = record.status;
  if (typeof status === 'number' && TIMEOUT_STATUSES.has(status)) return true;
  const code = textOf(record.code).toLowerCase();
  if (code.includes('timeout')) return true;
  const message = textOf(record.message).toLowerCase();
  return message.includes('timed out') || message.includes('timeout');
};

interface Envelope {
  /** 最里层那句人话；没有就是 null */
  message: string | null;
  /** 任意一层带超时迹象（里层 504 / code=AI_TIMEOUT / message 含 timeout） */
  timedOut: boolean;
}

const EMPTY_ENVELOPE: Envelope = { message: null, timedOut: false };

/**
 * 一层层拆错误信封：`reasons[]` → 平铺的 message / msg / errorMsg / error → 再套一层的 `data`。
 * 候选值是 JSON 字符串就递归拆；拆不出人话返回 null。
 */
const envelopeOf = (payload: unknown, depth: number): Envelope => {
  if (!isRecord(payload)) return EMPTY_ENVELOPE;

  let timedOut = isTimeoutHint(payload);

  const candidates: unknown[] = [];
  if (Array.isArray(payload.reasons)) {
    for (const item of payload.reasons) {
      if (!isRecord(item)) continue;
      if (isTimeoutHint(item)) timedOut = true;
      candidates.push(item.message, item.msg_id, item.msg, item.msgId);
    }
  }
  candidates.push(payload.message, payload.msg, payload.errorMsg, payload.error);

  for (const candidate of candidates) {
    const text = textOf(candidate);
    if (text === '') continue;

    if (looksLikeJson(text)) {
      // 信封里套的那层 JSON：拆开看，绝不把原文当文案透出
      if (depth < MAX_ENVELOPE_DEPTH) {
        try {
          const nested = envelopeOf(JSON.parse(text), depth + 1);
          timedOut = timedOut || nested.timedOut;
          if (nested.message !== null) return { message: nested.message, timedOut };
        } catch {
          /* 只是以 { 开头的普通文案，下面按普通文案处理会走到 generic 过滤 */
        }
      }
      continue;
    }

    if (!GENERIC_HTTP_PHRASES.has(text.toLowerCase())) return { message: text, timedOut };
  }

  if (payload.data !== undefined && payload.data !== payload) {
    const nested = envelopeOf(payload.data, depth + 1);
    timedOut = timedOut || nested.timedOut;
    if (nested.message !== null) return { message: nested.message, timedOut };
  }

  return { message: null, timedOut };
};

/**
 * 从业务错误信封里取一句人话（不含超时翻转）。
 * 递归拆嵌套 JSON；取不到返回 null，由调用方给兜底文案。
 */
export const serverMessageOf = (payload: unknown): string | null => envelopeOf(payload, 0).message;

/**
 * 非 2xx 的响应体 → 用户可读文案。
 *   `label` 是接口名（如「AI 智能填充」），用于兜底文案「{label}失败（状态码）」与超时文案。
 */
export const serverErrorTextOf = (text: string, status: number, label: string): string => {
  const fallback = `${label}失败（${status}）`;
  const trimmed = text.trim();
  // 网关返回的整页 HTML（以 < 开头）不是给人看的提示
  if (trimmed === '' || trimmed.startsWith('<')) return fallback;

  // JSON 信封：只取里面那句人话，取不到就兜底，绝不整包透出
  if (looksLikeJson(trimmed)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return fallback;
    }
    const envelope = envelopeOf(parsed, 0);
    // 中文文案优先；只有英文/机器文案时才把超时翻成中文提示
    if (envelope.message !== null && HAS_CJK.test(envelope.message)) return envelope.message;
    if (envelope.timedOut) return `${label}超时，请稍后重试`;
    return envelope.message ?? fallback;
  }

  // 纯文本就是后端写好的文案
  return trimmed;
};
