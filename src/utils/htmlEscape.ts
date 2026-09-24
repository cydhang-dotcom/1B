/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 把用户输入转义后再拼进 HTML 字符串（委托书、方案评估报告这些「文档本体」共用）。
 *
 * 这些文档都会被塞进 iframe / 下载成文件，用户填的姓名、经营范围里带 `<`、`&`、引号
 * 都可能把文档结构撕开，所以拼 HTML 之前一律先过这里。
 *
 * 纯函数，tsx 自检可直接引。
 */
export const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
