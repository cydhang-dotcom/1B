/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 文件服务（doc）地址的**拼法本体**：`{docHost}/doc/uuid/{fileUuid}/get`。
 *
 * 这是公司各项目通用的文件下载约定（老项目里的全局 `$getDownloadUrl(uuid)` 就是
 * `{host}/v1/doc/uuid/{uuid}/get`）；上传接口把文件存进去时返回 `fileUuid`，
 * 之后图片 / 附件的地址都由它拼出来。
 *
 * **host 由调用方传**：本文件不 import config/api.ts（那个文件读 import.meta.env，
 * 只有 Vite 提供），这样 scripts/ 下的 tsx 自检能直接引它。业务代码请用
 * `src/utils/fileUrl.ts` 的全局工具 `fileUrlOf(fileUuid)`，它把 DOC_HOST 接好了。
 */

/** host 以 / 结尾、path 以 / 开头时拼出双斜杠，先各自去掉再拼 */
const joinUrl = (host: string, path: string): string =>
  `${host.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;

/**
 * 用文件 id 拼出可访问的地址。**空 id / 空 host 返回空串**（不是 null）：
 * 调用方拿到空串就知道「这个附件没有可显示的地址」，直接不渲染图片即可 ——
 * 一张裂图或一条 `.../doc/uuid//get` 的错误地址比空着更糟。
 */
export const docUuidUrl = (docHost: string, fileUuid?: string | null): string => {
  const uuid = typeof fileUuid === 'string' ? fileUuid.trim() : '';
  if (uuid === '' || String(docHost ?? '').trim() === '') return '';
  return joinUrl(docHost, `doc/uuid/${encodeURIComponent(uuid)}/get`);
};
