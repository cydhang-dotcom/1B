/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 第 5 步（#fill-details）申报资料的**保存 / 提交**接口：
 *   `POST {host}/xcx/yqt-co/subscribe/open-info`
 *   请求体恰好三个字段（后端 DTO 原样：
 *     busUnionId  开户业务关联 id —— 就是第 1 步生成方案时服务端给的委托单号（recordId）
 *     var2        本地存档那份 JSON 的字符串（就是写进 localStorage[STORAGE_KEY] 的那份表单）
 *     savaType    保存类型：0 = 临时保存（「保存草稿」），1 = 保存（「确认并提交申请」）
 *   ）
 *
 * **响应体前端不解析：2xx 即成功**。用户给的接口说明里没有响应字段，与其猜一个 `code`/`status`
 * 去误判，不如只看 HTTP 结果；非 2xx 一律抛带中文提示的 Error（纯文本直接用，JSON 信封只取
 * `message` 那句人话，网关 HTML 用兜底文案），调用方据此把人拦在填报页。接口方若用「200 + code」
 * 表达业务失败，把字段名告诉我，这里加一条判断即可。
 *
 * 端点由调用方注入（React 层从 config/api.ts 取好），本文件不 import config/api.ts：
 * 那个文件读 import.meta.env，只有 Vite 提供，一旦被 scripts/ 下的 tsx 自检间接引到就会崩。
 */

import { serverErrorTextOf } from '../../utils/serverError';

/** 保存类型：0 临时保存（保存草稿）、1 保存（确认提交并申请） */
export type OpenInfoSaveType = '0' | '1';

/** 端点：host 与 path 分开注入（host 可能自带 /v1，拼法见 joinUrl） */
export interface OpenInfoEndpoint {
  host: string;
  /** 留空表示接口还没接：调用时抛 OpenInfoNotConfiguredError，不发请求 */
  path: string;
}

export interface OpenInfoInput {
  /** 委托单号（第 1 步的 recordId）。**必给**：服务端靠它认这笔开户业务 */
  busUnionId: string;
  /** 本地存档的表单对象（这里负责 JSON.stringify 成 var2） */
  form: unknown;
  savaType: OpenInfoSaveType;
}

export interface OpenInfoRequest {
  busUnionId: string;
  var2: string;
  /** ★ 字段名就叫 `savaType`（后端 DTO 原文如此，不是笔误） */
  savaType: OpenInfoSaveType;
}

/** 保存/提交是普通写库接口，不用大模型那 60s；超时了用户重试一次即可 */
export const OPEN_INFO_TIMEOUT_MS = 15_000;

const LABEL = '申报资料保存';

/** 路径没配时不发请求，抛这个：调用方要提示的是「还没接入」，不是「网络异常」 */
export class OpenInfoNotConfiguredError extends Error {
  constructor() {
    super('申报资料保存接口尚未接入，暂时无法提交');
    this.name = 'OpenInfoNotConfiguredError';
  }
}

/** 没有委托单号（本地凭据丢了 / 直接手敲进填报页）时不发请求：服务端认不出这笔业务 */
export class OpenInfoMissingRecordError extends Error {
  constructor() {
    super('缺少委托单号，请返回第 1 步重新生成方案后再提交');
    this.name = 'OpenInfoMissingRecordError';
  }
}

/** host 以 / 结尾、path 以 / 开头时拼出双斜杠，先各自去掉再拼 */
const joinUrl = (host: string, path: string): string =>
  `${host.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;

/** 非 2xx 的响应体 → 用户可读文案（JSON 信封只取 message 那句人话，见 utils/serverError.ts） */
const messageOf = (text: string, status: number): string => serverErrorTextOf(text, status, LABEL);

/**
 * 组请求体：`var2` 就是「本地存档那份 JSON」的字符串。
 * 先在这里校验委托单号，缺了直接抛 OpenInfoMissingRecordError（一个请求都不发）。
 */
export const openInfoRequestOf = (input: OpenInfoInput): OpenInfoRequest => {
  const busUnionId = typeof input.busUnionId === 'string' ? input.busUnionId.trim() : '';
  if (busUnionId === '') throw new OpenInfoMissingRecordError();

  return {
    busUnionId,
    var2: JSON.stringify(input.form ?? {}),
    savaType: input.savaType,
  };
};

/**
 * 保存 / 提交申报资料。成功 resolve（响应体不解析），失败抛带中文提示的 Error：
 *   路径没配        「申报资料保存接口尚未接入，暂时无法提交」（不发请求）
 *   没委托单号      「缺少委托单号，请返回第 1 步重新生成方案后再提交」（不发请求）
 *   非 2xx         优先用响应体里的文字（网关 HTML → 「申报资料保存失败（状态码）」）
 *   超时            「申报资料保存超时，请稍后重试」
 *   网络不通        「网络异常，请检查网络后重试」
 */
export const saveOpenInfo = async (
  endpoint: OpenInfoEndpoint,
  input: OpenInfoInput,
  options: { timeoutMs?: number; fetchImpl?: typeof fetch } = {}
): Promise<void> => {
  if (!endpoint.path) throw new OpenInfoNotConfiguredError();
  const body = openInfoRequestOf(input);

  const doFetch = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? OPEN_INFO_TIMEOUT_MS);

  try {
    const response = await doFetch(joinUrl(endpoint.host, endpoint.path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(messageOf(await response.text(), response.status));
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
