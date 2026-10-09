/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 第 5 步（#fill-details）的**经办人信息读取**接口：
 *
 *   GET {host}/xcx/yqt-co/subscribe/handler?busUnionId={委托单号}
 *   返回 { handName, handIdNumber }
 *
 * （2026-10-08 按服务端最新口径改：路径从 `subscribe/jingbanren` 换成 `subscribe/handler`，
 *   查询参数从 `recordId` 换成 `busUnionId`，返回字段从 `jingbanrenName / jingbanrenIdNumber`
 *   换成 `handName / handIdNumber` —— 语义没变，还是「一窗通」那位经办人。）
 *
 * 用途：委托书那一章的「受托经办人姓名 / 受托人身份证号」**不再让用户手填** ——
 * 这两个值必须与「一窗通」公章经办人一致（见 `authorizationDoc.ts` 的注释），由服务端下发才准。
 * 每打开一次填报页读一次（`RegistrationDetailsStep` 挂载时），拿到什么写什么：
 *   - **只覆盖非空字段**：接口这次没给的那一项保留原值，不把已有的好东西抹成空；
 *   - 两项都没给 → `applyJingbanren` 报「没变化」，调用方不用白改一次 state / 白落一次盘。
 *
 * 端点由调用方注入（React 层从 `config/api.ts` 取好），本文件不 import config/api.ts：
 * 那个文件读 `import.meta.env`，只有 Vite 提供，一旦被 scripts/ 下的 tsx 自检间接引到就会崩。
 * 与 `openInfo.ts` / `subscribeQuery.ts` 同一套写法（超时、非 2xx 取服务端那句人话）。
 */

import { serverErrorTextOf } from '../../utils/serverError';

/** 端点：host 与 path 分开注入（host 自带 /v1，拼法见 jingbanrenUrl） */
export interface JingbanrenEndpoint {
  host: string;
  /** 留空表示接口还没接：调用时抛 JingbanrenNotConfiguredError，不发请求 */
  path: string;
}

/** 读回来的两项。任一项拿不到就是空串（调用方按「空就不覆盖」处理） */
export interface JingbanrenInfo {
  name: string;
  idNumber: string;
}

/** 只读接口，用不了第 1 步大模型那 5 分钟 */
export const JINGBANREN_TIMEOUT_MS = 15_000;

const LABEL = '经办人信息读取';

export class JingbanrenNotConfiguredError extends Error {
  constructor() {
    super('经办人信息接口尚未接入，暂时无法自动带入');
    this.name = 'JingbanrenNotConfiguredError';
  }
}

/** 没有委托单号（本地凭据丢了 / 直接手敲进填报页）不发请求：服务端认不出读哪一笔 */
export class JingbanrenMissingRecordError extends Error {
  constructor() {
    super('缺少委托单号，无法读取经办人信息');
    this.name = 'JingbanrenMissingRecordError';
  }
}

/** host 以 / 结尾、path 以 / 开头时拼出双斜杠，先各自去掉再拼 */
const joinUrl = (host: string, path: string): string =>
  `${host.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;

/** 组请求地址：`{host}{path}?busUnionId=…`。单号要 encode（服务端下发的随机串可能带特殊字符） */
export const jingbanrenUrl = (endpoint: JingbanrenEndpoint, recordId: string): string =>
  `${joinUrl(endpoint.host, endpoint.path)}?busUnionId=${encodeURIComponent(recordId.trim())}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** 身份证号口径与手填时一致：只可能数字 + 结尾 X，统一大写 */
const idNumberOf = (value: unknown): string =>
  typeof value === 'string' ? value.replace(/[^0-9Xx]/g, '').toUpperCase() : '';
const textOf = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/**
 * 从响应里取这两项。
 *
 * **不猜死结构**：先看顶层，再看 `data` / `result` / `obj` 这几个常见的信封字段
 * （服务端这一族接口都是平铺的，但信封里套 JSON 字符串也见过 —— 顺手兼容，别为格式多跑一轮联调）。
 * 认不出来就是两项空串：宁可什么都不写，也不把 `undefined` 写进表单。
 */
export const jingbanrenFromPayload = (payload: unknown): JingbanrenInfo => {
  let node: unknown = payload;
  // 信封最多剥两层（`data` 里再套一个 JSON 字符串这种）
  for (let depth = 0; depth < 2; depth += 1) {
    if (typeof node === 'string') {
      const text = node.trim();
      if (text === '') break;
      try {
        node = JSON.parse(text) as unknown;
      } catch {
        break;
      }
      continue;
    }
    if (!isRecord(node)) break;
    const hasFields = 'handName' in node || 'handIdNumber' in node;
    if (hasFields) break;
    const next = node.data ?? node.result ?? node.obj;
    if (next === undefined) break;
    node = next;
  }

  if (!isRecord(node)) return { name: '', idNumber: '' };
  return {
    name: textOf(node.handName),
    idNumber: idNumberOf(node.handIdNumber),
  };
};

/**
 * 把读回来的两项并进委托书字段：**只覆盖非空的那一项**。
 * 返回 `changed = false` 表示这次读到的东西跟现有的一模一样（或两项都空），调用方不用动 state。
 */
export const applyJingbanren = (
  current: { trusteeName: string; trusteeIdNumber: string },
  info: JingbanrenInfo
): { next: { trusteeName: string; trusteeIdNumber: string }; changed: boolean } => {
  const trusteeName = info.name !== '' ? info.name : current.trusteeName;
  const trusteeIdNumber = info.idNumber !== '' ? info.idNumber : current.trusteeIdNumber;
  const changed = trusteeName !== current.trusteeName || trusteeIdNumber !== current.trusteeIdNumber;
  return { next: { trusteeName, trusteeIdNumber }, changed };
};

/**
 * 读经办人信息。成功 resolve 解析后的两项（可能都是空串，调用方按「空就不覆盖」处理），
 * 失败抛带中文提示的 Error：
 *   路径没配        「经办人信息接口尚未接入，暂时无法自动带入」（不发请求）
 *   没委托单号      「缺少委托单号，无法读取经办人信息」（不发请求）
 *   非 2xx         优先用响应体里那句人话
 *   超时            「经办人信息读取超时，请稍后重试」
 *   网络不通        「网络异常，请检查网络后重试」
 *   空体 / 非 JSON  「经办人信息读取返回格式异常，请稍后重试」
 */
export const fetchJingbanren = async (
  endpoint: JingbanrenEndpoint,
  recordId: string,
  options: { timeoutMs?: number; fetchImpl?: typeof fetch } = {}
): Promise<JingbanrenInfo> => {
  if (!endpoint.path) throw new JingbanrenNotConfiguredError();
  const id = typeof recordId === 'string' ? recordId.trim() : '';
  if (id === '') throw new JingbanrenMissingRecordError();

  const doFetch = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? JINGBANREN_TIMEOUT_MS);

  try {
    const response = await doFetch(jingbanrenUrl(endpoint, id), { method: 'GET', signal: controller.signal });
    const text = await response.text();
    if (!response.ok) throw new Error(serverErrorTextOf(text, response.status, LABEL));
    if (text.trim() === '') throw new Error(`${LABEL}返回格式异常，请稍后重试`);
    try {
      return jingbanrenFromPayload(JSON.parse(text) as unknown);
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
