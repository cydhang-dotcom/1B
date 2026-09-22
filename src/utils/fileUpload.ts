/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 附件上传：`POST {host}{path}`，`multipart/form-data`，字段名 `file`，
 * 成功后服务端返回 `{ fileUuid, fileName }`（1b 侧约定的形状）。
 *
 * 上传成功后**不再存文件内容**：表单里只留 `fileUuid`，要显示时用全局工具
 * `fileUrlOf(fileUuid)`（`src/utils/fileUrl.ts`）现拼地址。
 *
 * 端点由调用方注入（就是 config/api.ts 里那两个常量），本文件**不 import config/api.ts**：
 * 那个文件读 import.meta.env，只有 Vite 提供，一旦被 scripts/ 下的 tsx 自检间接引到就会崩
 * （与 payment/client.ts、verification.ts 同样的理由）。`fetchImpl` 也能注入，自检据此离线跑。
 *
 * 失败一律抛带中文提示的 Error，调用方直接把它显示在页面上：
 *   路径没配        「附件上传接口尚未接入，请稍后重试」（一个请求都不发）
 *   非 2xx         优先用响应体里的文字（是网关 HTML 就用兜底文案）
 *   超时            「附件上传超时，请稍后重试」
 *   网络不通        「网络异常，请检查网络后重试」
 *   不是 JSON / 没给 fileUuid  「附件上传返回格式异常，请稍后重试」/「附件上传未返回文件编号，请稍后重试」
 */

/** 上传端点：host 与 path 分开注入（host 可能自带 /v1，拼法见 joinUrl） */
export interface FileUploadEndpoint {
  host: string;
  /** 留空表示接口还没接：调用时抛 FileUploadNotConfiguredError，不发请求 */
  path: string;
}

/** 上传成功后服务端给的凭据 */
export interface UploadedFile {
  /** 文件 id：取图 / 下载都靠它（`fileUrlOf(fileUuid)`） */
  fileUuid: string;
  /** 服务端存下来的文件名（可能与我们本地的文件名不同，展示以它为准） */
  fileName: string;
}

/** 路径没配时不发请求，抛这个：调用方要提示的是「还没接入」，不是「网络异常」 */
export class FileUploadNotConfiguredError extends Error {
  constructor() {
    super('附件上传接口尚未接入，请稍后重试');
    this.name = 'FileUploadNotConfiguredError';
  }
}

/** 上传要传文件本体，比普通接口慢，给 60s（与两个 AI 接口同档） */
export const FILE_UPLOAD_TIMEOUT_MS = 60_000;

const LABEL = '附件上传';

/** host 以 / 结尾、path 以 / 开头时拼出双斜杠，先各自去掉再拼 */
const joinUrl = (host: string, path: string): string =>
  `${host.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;

/** 非 2xx 的响应体：后端写好的错误文案就用它，网关返回的整页 HTML 就别往提示里塞了 */
const messageOf = (text: string, status: number): string => {
  const trimmed = text.trim();
  return trimmed && !trimmed.startsWith('<') ? trimmed : `${LABEL}失败（${status}）`;
};

/**
 * 上传一个文件。**不要手动设 Content-Type** —— multipart 的 boundary 由浏览器生成，
 * 手写一个 `multipart/form-data` 反而会让服务端解析不出文件。
 */
export const uploadFileTo = async (
  endpoint: FileUploadEndpoint,
  file: File,
  options: { timeoutMs?: number; fetchImpl?: typeof fetch } = {}
): Promise<UploadedFile> => {
  if (!endpoint.path) throw new FileUploadNotConfiguredError();

  const doFetch = options.fetchImpl ?? fetch;
  const body = new FormData();
  // 字段名固定 file：服务端按它取文件；带上文件名，服务端没改名时就用它
  body.append('file', file, file.name);

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? FILE_UPLOAD_TIMEOUT_MS);

  try {
    const response = await doFetch(joinUrl(endpoint.host, endpoint.path), {
      method: 'POST',
      body,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(messageOf(await response.text(), response.status));
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new Error(`${LABEL}返回格式异常，请稍后重试`);
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new Error(`${LABEL}返回格式异常，请稍后重试`);
    }

    const raw = payload as Record<string, unknown>;
    const fileUuid = typeof raw.fileUuid === 'string' ? raw.fileUuid.trim() : '';
    if (fileUuid === '') throw new Error(`${LABEL}未返回文件编号，请稍后重试`);
    // fileName 只用于展示：服务端没给就空着（调用方回落到本地文件名），不算失败
    const fileName = typeof raw.fileName === 'string' ? raw.fileName.trim() : '';

    return { fileUuid, fileName };
  } catch (cause) {
    // timedOut 只由上面那个定时器置位，用来把超时和网络故障区分开
    if (timedOut) throw new Error(`${LABEL}超时，请稍后重试`);
    if (cause instanceof TypeError) throw new Error('网络异常，请检查网络后重试');
    throw cause;
  } finally {
    clearTimeout(timer);
  }
};
