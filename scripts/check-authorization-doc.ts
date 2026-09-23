/**
 * 委托书文档本体的自检：不联网、不碰 React、不开浏览器。
 *   npx tsx scripts/check-authorization-doc.ts
 *
 * 覆盖三件事：
 *   1. **一份文档两个入口**：「直接打印」与「下载模板」都走 `buildAuthorizationLetterHtml`，
 *      正文里的姓名 / 身份证号 / 委托日期必须真的进到 HTML 里；
 *   2. **用户输入先转义**：名字里带 `<`、`&` 不能把文档结构撕开；
 *   3. **空值不留坑**：日期缺段、姓名为空时不能印出 `undefined 年` 或 `委托书_.html`。
 */
import {
  AUTHORIZATION_LETTER_TITLE,
  authorizationLetterFileName,
  buildAuthorizationLetterHtml,
  escapeHtml,
  splitAuthorizationDate,
} from '../src/copreg/registration/authorizationDoc';

let passed = 0;
let failed = 0;

function ok(label: string, condition: boolean) {
  if (condition) {
    passed += 1;
    console.log(`✓ ${label}`);
  } else {
    failed += 1;
    console.error(`✗ ${label}`);
  }
}

function main() {
  ok('标题常量是「法定代表人委托书」', AUTHORIZATION_LETTER_TITLE === '法定代表人委托书');

  // 1. 正文取值
  const html = buildAuthorizationLetterHtml({
    trusteeName: '张三',
    trusteeIdNumber: '110101199001011234',
    date: '2026-03-05',
  });
  ok('单页 A4：@page 指定 size A4、无页边距', html.includes('@page { size: A4; margin: 0; }'));
  ok('标题进了 <title>', html.includes(`<title>${AUTHORIZATION_LETTER_TITLE}</title>`));
  ok('标题在正文里渲染一次', (html.match(/法定代表人委托书/g) ?? []).length === 2);
  ok('受托人姓名进正文', html.includes('>张三</span>'));
  ok('身份证号进正文', html.includes('>110101199001011234</span>'));
  ok('委托日期拆成年 / 月 / 日三段', html.includes('>2026</span> 年 <span class="underline">03</span> 月 <span class="underline">05</span> 日'));

  // 2. 转义
  ok('escapeHtml 处理五个危险字符', escapeHtml(`<a href="x" & 'y'>`) === '&lt;a href=&quot;x&quot; &amp; &#39;y&#39;&gt;');
  const injected = buildAuthorizationLetterHtml({
    trusteeName: '<script>alert(1)</script>',
    trusteeIdNumber: '11010119900101123X',
    date: '2026-03-05',
  });
  ok('恶意姓名被转义、不产生 script 标签', !injected.includes('<script>') && injected.includes('&lt;script&gt;'));
  ok('逃逸不破坏正文结构', injected.includes('兹委托 <span class="underline">&lt;script&gt;'));

  // 3. 空值
  ok('日期缺段时不留 undefined', !buildAuthorizationLetterHtml({ trusteeName: '', trusteeIdNumber: '', date: '' }).includes('undefined'));
  ok(
    '空日期三段都是空下划线',
    buildAuthorizationLetterHtml({ trusteeName: '', trusteeIdNumber: '', date: '' }).includes(
      '委托日期：<span class="underline"></span> 年 <span class="underline"></span> 月 <span class="underline"></span> 日',
    ),
  );
  ok(
    '只在月 / 日缺失时按空处理',
    JSON.stringify(splitAuthorizationDate('2026-03-05')) === JSON.stringify(['2026', '03', '05']) &&
      JSON.stringify(splitAuthorizationDate('')) === JSON.stringify(['', '', '']),
  );

  // 4. 文件名
  ok('文件名带受托人姓名', authorizationLetterFileName('张三') === '法定代表人委托书_张三.html');
  ok('姓名前后空格不进文件名', authorizationLetterFileName('  张三  ') === '法定代表人委托书_张三.html');
  ok('姓名为空时不留尾部下划线', authorizationLetterFileName('') === '法定代表人委托书.html');
}

main();

console.log(`\n${passed} 项通过，${failed} 项失败`);
if (failed > 0) process.exit(1);
