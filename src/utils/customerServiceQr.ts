/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 专属客服 / 顾问企微码的**纯逻辑**：地址怎么拼、查到的结果怎么判断。
 *
 * 为什么要先查询再显示：客服码有两种 —— 服务端给这位分享人分配的**专属企微码**，
 * 和 www 上的**通用兜底图**。点开弹窗时得先问一次服务端拿到专属码，拿不到（没分享人、
 * 接口挂了、响应里没有文件 id）才回落到兜底图；不做这一步就只能一直显示兜底图，
 * 或者更糟 —— 显示一个根本扫不出东西的占位符。
 *
 * 与请求相关的部分（fetch、loading 状态）在 src/hooks/useCustomerServiceQr.ts，
 * 这里只放可离线自检的纯函数：本文件不 import config/api.ts（那个文件读 import.meta.env，
 * 只有 Vite 提供），所以 scripts/ 下的 tsx 自检能直接引它。
 */

import { docUuidUrl } from './docUuidUrl';

/** 通用兜底客服码：只在 www 上有一份，所以写死绝对地址（换域名/子路径部署也不会 404） */
export const FALLBACK_CUSTOMER_SERVICE_QR =
  'https://www.ibanbu.com/image-yqt/customer-service-qr.png';

/** host 以 / 结尾、path 以 / 开头时拼出双斜杠，先各自去掉再拼 */
const joinUrl = (host: string, path: string): string =>
  `${host.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;

/**
 * 取「这位分享人的客服码」的接口地址。**没有分享人就返回 null** —— 那种情况不该发请求，
 * 直接用兜底图。
 */
export const perShareQrEndpoint = (docHost: string, shareUserUuid: string | null | undefined): string | null => {
  const uuid = typeof shareUserUuid === 'string' ? shareUserUuid.trim() : '';
  if (uuid === '' || docHost.trim() === '') return null;
  return `${joinUrl(docHost, `xcx/yqt-co/user/${encodeURIComponent(uuid)}/get`)}`;
};

/**
 * 查到的响应 → 该显示的图片地址。
 *
 * 服务端给了 `perShareEwmFile` 就用文件服务上的那张（`{host}/doc/uuid/{file}/get`，
 * 拼法见 utils/docUuidUrl.ts，与附件地址共用同一份逻辑）；没给、给的不是字符串、或 host
 * 缺失 → 回落到通用兜底图。
 * 这里永远返回一个可用的地址，调用方不必再判空。
 */
export const perShareQrUrl = (docHost: string, payload: unknown): string => {
  const data = (payload ?? {}) as Record<string, unknown>;
  const file = typeof data.perShareEwmFile === 'string' ? data.perShareEwmFile.trim() : '';
  const url = docUuidUrl(docHost, file);
  return url === '' ? FALLBACK_CUSTOMER_SERVICE_QR : url;
};
