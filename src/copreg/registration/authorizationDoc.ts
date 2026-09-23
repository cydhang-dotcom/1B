/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 法定代表人委托书的**文档本体**（一份可独立打开的 A4 HTML）。
 *
 * `#fill-details` 第 3 章里「直接打印」与「下载模板」印的是同一份东西，所以 HTML 只在这里
 * 生成一次 —— 两个按钮各拼一份迟早会印出两个版本。
 *
 * 这里是**纯函数**：不 import React、不碰 DOM、不 import config/api.ts（那个读 import.meta.env，
 * 只有 Vite 提供），所以 `scripts/` 下的 tsx 自检能直接引。真正落到浏览器上的打印动作
 * （隐藏 iframe）在 `src/utils/printDocument.ts`。
 */

/** 用户输入会直接进 HTML：先转义再拼，名字里带 `<`、`&` 之类不能把文档结构撕开 */
export const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const AUTHORIZATION_LETTER_TITLE = '法定代表人委托书';

export interface AuthorizationLetterInput {
  /** 受托人姓名（可与法定代表人不同，要与「一窗通」公章经办人一致），可为空 */
  trusteeName: string;
  /** 受托人身份证号，可为空 */
  trusteeIdNumber: string;
  /** 委托日期 `YYYY-MM-DD`；调用方负责在缺省时兜到今天 */
  date: string;
}

/** 下载文件名：受托人姓名为空时给个通用名，别下载出「法定代表人委托书_.html」 */
export const authorizationLetterFileName = (trusteeName: string): string => {
  const name = trusteeName.trim();
  return `${AUTHORIZATION_LETTER_TITLE}${name ? `_${name}` : ''}.html`;
};

/**
 * 委托日期 `YYYY-MM-DD` → 年 / 月 / 日三段，缺段留空（由申请人手写补），
 * 不拼出 `undefined 年 月 日`。
 */
export const splitAuthorizationDate = (date: string): [string, string, string] => {
  const [y = '', m = '', d = ''] = date.trim().split('-');
  return [y, m, d];
};

/**
 * 生成一张 A4 委托书（标题 + 正文 + 委托人签名线 + 委托日期）。
 *
 * 样式与 @page 一并写死在文档里：这份 HTML 会被下载成文件、也会被塞进隐藏 iframe 直接打印，
 * 两条路都不依赖宿主页面的样式表。
 */
export const buildAuthorizationLetterHtml = ({
  trusteeName,
  trusteeIdNumber,
  date,
}: AuthorizationLetterInput): string => {
  const [y, m, d] = splitAuthorizationDate(date);
  const name = escapeHtml(trusteeName);
  const idNumber = escapeHtml(trusteeIdNumber);

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${AUTHORIZATION_LETTER_TITLE}</title>
<style>
  @page { size: A4; margin: 0; }
  body{font-family:"PingFang SC","Microsoft YaHei",sans-serif;margin:0;padding:0;background:#fff}
  .page{
    width:210mm;min-height:297mm;box-sizing:border-box;
    padding:25mm 22mm;color:#0F172A;line-height:2.2;
    display:flex;flex-direction:column;
  }
  h1{text-align:center;font-size:22pt;letter-spacing:.06em;margin:0 0 30mm;font-weight:800}
  .body{font-size:12pt;line-height:2.4;text-align:justify}
  .underline{display:inline-block;min-width:100px;border-bottom:1px solid #0F172A;text-align:center;padding:0 8px;font-weight:600}
  .sign{margin-top:auto;padding-top:20mm;font-size:12pt}
  .line{display:inline-block;min-width:220px;border-bottom:1px solid #0F172A}
  .date{margin-top:8mm;font-size:12pt}
</style></head>
<body>
  <div class="page">
    <h1>${AUTHORIZATION_LETTER_TITLE}</h1>
    <div class="body">
      兹委托 <span class="underline">${name}</span> （身份证号码： <span class="underline">${idNumber}</span> ，注：受托人需与"一窗通"公章经办人一致）代表我公司办理公章刻制业务，受托人在上述事项内所签署的有关文件及提供的手续材料，本委托人均予以承认并承担相应的法律责任。
    </div>
    <div class="sign">委托人（法定代表人亲笔签名）：<span class="line"></span></div>
    <div class="date">委托日期：<span class="underline">${y}</span> 年 <span class="underline">${m}</span> 月 <span class="underline">${d}</span> 日</div>
  </div>
</body></html>`;
};
