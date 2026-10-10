/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 「分享人 uuid」的**纯逻辑**：参数叫什么、怎么从查询串里读、怎么往地址上拼。
 *
 * 为什么单独一个文件：参数名与拼法必须只有一份，而现在有三类地方在用 ——
 *   1. 落地页的推广入口（`components/Hero|Navbar|CTA` 把当前页的分享人透给 CAA 站）；
 *   2. copreg 的步骤路由（支付成功页开填报页的深链要带上它，见 stepRoute.ts 的 fillDetailsOpenUrl）；
 *   3. copreg 的 App（地址栏重建时要把分享人留下，只抹深链意图参数 open）。
 * 谁要是各写各的 `shareUserUUID` / `share_user_uuid`，就是一条静默失效的链路。
 *
 * React 那一层（挂载时读一次的记忆化）在 `src/hooks/useShareUserUuid.ts`；本文件不 import React、
 * 也不 import config/api.ts，所以 `npx tsx scripts/check-share-user-uuid.ts` 能直接引它。
 *
 * **为什么不落盘**（localStorage / sessionStorage）：分享人属于**这一条链接**，不是这台机器的状态。
 * 存下来会让「先点开 A 的分享链接、又点开 B 的」串味 —— 两个人都会算到 A 头上；
 * 而链接里带着它本来就是要跟着人走的（新标签页、刷新都在 URL 上）。所以只认 URL。
 */

export const SHARE_USER_UUID_PARAM = 'shareUserUuid';

/**
 * 从查询串里读分享人（`?shareUserUuid=xxx`，也接受不带 `?` 的 `shareUserUuid=xxx`）。
 *
 * 没有 / 空值 / 只有空白 → `null`：调用方据此**不发请求**、直接用通用客服码
 * （见 utils/customerServiceQr.ts 的 perShareQrEndpoint）。
 */
export const readShareUserUuid = (search: string | null | undefined): string | null => {
  const query = (search ?? '').replace(/^\?/, '');
  if (query === '') return null;
  // URLSearchParams 对畸形的百分号编码是**宽容**的（给替换字符，不抛错），所以不需要 try/catch；
  // 前后空白顺手去掉：那是复制粘贴带进来的，发出去只会让服务端查不到人
  const value = new URLSearchParams(query).get(SHARE_USER_UUID_PARAM);
  return value === null || value.trim() === '' ? null : value.trim();
};

/**
 * 把分享人拼到一条地址后面：**没有分享人就原样返回**（调用方不必判空）。
 * href 自带查询串时用 `&` 接上，值做 URL 转义（uuid 里出现 `+`、`&` 之类也不能把地址拼坏）。
 */
export const appendShareUserUuid = (href: string, uuid: string | null | undefined): string => {
  const value = typeof uuid === 'string' ? uuid.trim() : '';
  if (value === '') return href;
  const sep = href.includes('?') ? '&' : '?';
  return `${href}${sep}${SHARE_USER_UUID_PARAM}=${encodeURIComponent(value)}`;
};
