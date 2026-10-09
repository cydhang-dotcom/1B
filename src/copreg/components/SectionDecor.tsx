/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * **卡片的高亮态** —— 左侧那条青绿渐变竖条 + 右上柔光 + 青绿描边/浅色底。
 *
 * 口径与 `#survey` **完全一致**：这套装饰**只在卡片「没有待完善项」时**才亮
 * （问卷那边叫「已完善」，第 5 步那边就是这一块校验过了）。没验证通过的卡片保持普通白底，
 * **不许是绿的** —— 用户 2026-10-08 的要求，两个页面同一份 DOM / 类名，免得各写一份慢慢走形。
 *
 * 用法（卡片的定位父级要 `relative overflow-hidden`）：
 *   `<div className={`rounded-2xl p-5 sm:p-6 border transition-all duration-300 relative overflow-hidden ${sectionCardClass(done)}`}>`
 *   `  {done && <SectionDecor />}`
 */

import React from 'react';

/** 卡片外层类名：`done` 为真才是问卷那套青绿高亮，否则是普通白卡 */
export const sectionCardClass = (done: boolean): string =>
  done
    ? 'border-[#2AA894]/30 bg-gradient-to-br from-[#F7FCFA] via-white to-white shadow-[0_4px_16px_-4px_rgba(42,168,148,0.08)]'
    : 'border-slate-200/80 bg-white hover:border-slate-300';

export const SectionDecor: React.FC = () => (
  <>
    <div
      data-section-decor="bar"
      className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#4ED1BC] to-[#2AA894] opacity-90 z-10"
    />
    <div
      data-section-decor="halo"
      className="absolute -top-12 -right-12 w-28 h-28 bg-[#E6F7F2]/35 rounded-full blur-2xl pointer-events-none"
    />
  </>
);
