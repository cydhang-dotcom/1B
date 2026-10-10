/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo } from 'react';
import { readShareUserUuid } from '../utils/shareUserUuid';

/**
 * 当前这条链接的分享人（`?shareUserUuid=`）。**只在挂载时读一次**。
 *
 * 读一次就够、也必须只读一次：copreg 落点后会用 replaceState 重写地址栏（只留步骤 hash 与分享人），
 * 之后才挂载的组件再读就未必还读得到。要把分享人带到**新标签页**，走地址（见
 * `src/copreg/stepRoute.ts` 的 fillDetailsOpenUrl）而不是靠这里的状态。
 *
 * 读法与参数名在 `src/utils/shareUserUuid.ts`（纯函数、有自检）；这里只负责 React 记忆化。
 */
export function useShareUserUuid(): string | null {
  return useMemo(
    () => readShareUserUuid(typeof window === 'undefined' ? '' : window.location.search),
    [],
  );
}

/**
 * 外链透传用的拼法**从 utils 转出**：落地页的 Hero / Navbar / CTA 一直是从这里 import 的，
 * 保持这个入口不变；实现搬进 utils 是为了让不需要 React 的地方（copreg 的 stepRoute、App）
 * 也能用同一份逻辑。
 */
export { appendShareUserUuid } from '../utils/shareUserUuid';
