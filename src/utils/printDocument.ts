/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * **打印一段独立 HTML，而不是当前整页。**
 *
 * 直接 `window.print()` 打的是整个页面：委托书只是页面里的一小块，印出来会带上导航、
 * 章节时间线、上传框一堆无关内容。这里把要打印的文档塞进一个 0 尺寸的隐藏 iframe，
 * 调 iframe 自己的 `print()` —— 打印范围就只有这份文档。
 *
 * 之所以不复用宿主页面的 DOM（例如 `@media print` 只留某个元素）：这个应用里还有别的
 * 「打印报告」入口确实要打整页，全局的打印样式很容易把它们一起改掉；iframe 里的文档
 * 自带样式，互不影响。
 *
 * `onReady` 在 iframe 文档加载完、真正发起打印前回调，调用方据此给「已唤起打印程序」提示。
 */

const PRINT_IFRAME_REMOVE_DELAY_MS = 1000;

export const printHtmlDocument = (html: string, onReady?: () => void): void => {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.setAttribute('title', '打印预览');
  // display:none 在部分浏览器里会把 iframe 文档打成空白，用 0 尺寸 + 移出视口更稳
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';

  const remove = () => {
    // print() 在 Chrome 里会阻塞到打印框关掉；再留个延时兜底，防止别的浏览器不触发 afterprint
    window.setTimeout(() => iframe.remove(), PRINT_IFRAME_REMOVE_DELAY_MS);
  };

  // 先写 srcdoc 再挂载：iframe 一进 DOM 就先 load 一次 about:blank、随后 load srcdoc，
  // 挂载后再赋值会打出两次（第一次是空白页）。先写后挂 + 单次守卫，只打正文那一次。
  iframe.srcdoc = html;

  let printed = false;
  iframe.onload = () => {
    if (printed) return;
    printed = true;
    const win = iframe.contentWindow;
    if (!win) {
      iframe.remove();
      return;
    }
    win.onafterprint = remove;
    win.focus();
    onReady?.();
    win.print();
    remove();
  };

  document.body.appendChild(iframe);
};
