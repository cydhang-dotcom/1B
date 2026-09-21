/**
 * 「微信扫码咨询」客服码的纯逻辑自检：不联网、不碰 React、不开浏览器。
 *   npx tsx scripts/check-customer-service-qr.ts
 *
 * 覆盖「先查询、再判断、后显示」里的**判断**那一步：什么时候用分享人的专属企微码、
 * 什么时候必须回落通用兜底图，以及地址怎么拼（双斜杠、文件 id 转义）。
 * 判错的后果是弹窗里显示一张扫不出东西的图，或者把兜底图当专属码一直用下去。
 */
import {
  FALLBACK_CUSTOMER_SERVICE_QR,
  perShareQrEndpoint,
  perShareQrUrl,
} from '../src/utils/customerServiceQr';

let passed = 0;
let failed = 0;

function ok(label: string, condition: boolean) {
  if (condition) {
    passed += 1;
  } else {
    failed += 1;
    console.error(`✗ ${label}`);
  }
}

const HOST = 'https://yqt.ibanbu.com/v1';

/* ------------------------------------------------------- 查询地址（第一跳） */

{
  ok('有分享人就按分享人查', perShareQrEndpoint(HOST, 'abc-123') === `${HOST}/xcx/yqt-co/user/abc-123/get`);
  ok('host 带尾斜杠不会拼出双斜杠', perShareQrEndpoint('https://a.com/', 'u1') === 'https://a.com/xcx/yqt-co/user/u1/get');
  ok('分享人前后空白被去掉', perShareQrEndpoint(HOST, '  u1  ') === `${HOST}/xcx/yqt-co/user/u1/get`);
  ok('分享人里的特殊字符被转义', perShareQrEndpoint(HOST, 'a/b c') === `${HOST}/xcx/yqt-co/user/a%2Fb%20c/get`);

  // 没有分享人 / host 缺失时 **不发请求**（返回 null），直接用兜底图
  ok('没有分享人 → null（不发请求）', perShareQrEndpoint(HOST, '') === null && perShareQrEndpoint(HOST, null) === null);
  ok('分享人只有空白 → null', perShareQrEndpoint(HOST, '   ') === null);
  ok('host 缺失 → null', perShareQrEndpoint('', 'u1') === null);
}

/* ------------------------------------------------- 查到结果后的判断（第二跳） */

{
  const ok1 = perShareQrUrl(HOST, { perShareEwmFile: 'file-1' });
  ok('有文件 id 就用文件服务上的专属码', ok1 === `${HOST}/doc/uuid/file-1/get`);
  ok('文件 id 里的特殊字符被转义', perShareQrUrl(HOST, { perShareEwmFile: 'a b/c' }) === `${HOST}/doc/uuid/a%20b%2Fc/get`);
  ok('host 尾斜杠同样不会拼出双斜杠', perShareQrUrl('https://a.com/', { perShareEwmFile: 'f' }) === 'https://a.com/doc/uuid/f/get');

  // 任何「没拿到」的情况都必须回落兜底图，绝不能返回空串让 <img> 变成裂图
  const fallbacks: [string, unknown][] = [
    ['响应里没有这个字段', { code: 0, message: 'ok' }],
    ['字段是空串', { perShareEwmFile: '' }],
    ['字段只有空白', { perShareEwmFile: '   ' }],
    ['字段不是字符串', { perShareEwmFile: 123 }],
    ['响应是 null', null],
    ['响应是数组', []],
    ['响应是字符串', 'nope'],
    ['响应是空对象', {}],
  ];
  for (const [label, payload] of fallbacks) {
    ok(`拿不到专属码时回落兜底图：${label}`, perShareQrUrl(HOST, payload) === FALLBACK_CUSTOMER_SERVICE_QR);
  }
  ok('host 缺失时也回落兜底图', perShareQrUrl('', { perShareEwmFile: 'f' }) === FALLBACK_CUSTOMER_SERVICE_QR);

  ok('兜底图是 www 上的绝对地址', FALLBACK_CUSTOMER_SERVICE_QR === 'https://www.ibanbu.com/image-yqt/customer-service-qr.png');
}

console.log(`\n${passed} 项通过，${failed} 项失败`);
if (failed > 0) process.exit(1);
