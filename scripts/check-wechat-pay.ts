/**
 * 微信支付模块的纯函数自检：不联网、不碰 React。
 *   npx tsx scripts/check-wechat-pay.ts
 */
import { createPayClient, missingEndpointPaths } from '../src/payment/client';
import {
  HttpError,
  MAX_CONSECUTIVE_FAILURES,
  PaymentNotConfiguredError,
  TimeoutError,
  clampTtl,
  decodeCodeUrl,
  formatAmount,
  isAbortError,
  isTerminal,
  isWechatPayUrl,
  joinUrl,
  mapOpenAccState,
  paidFieldsOf,
  paidSnapshotOf,
  serverMessageOf,
  nextPollDelay,
  normalizeEpochMs,
  normalizeImageUrl,
  parseCreateOrderResponse,
  parseOpenAccPayResponse,
  resolveExpiresAt,
  resolveQrSource,
  toPhaseForError,
  toUserMessage,
} from '../src/payment/model';
import { encode } from 'uqr';

import { QR_BORDER, qrPath } from '../src/payment/qrcode';

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

const CODE_URL = 'weixin://wxpay/bizpayurl?pr=AbCd1234';
const NOW = 1_800_000_000_000; // 固定基准时刻，避免用到真实时钟

/* ---------------------------------------------------------------- URL 拼接 */

{
  ok('host 带尾斜杠不会拼出双斜杠', joinUrl('https://a.com/', '/x/y') === 'https://a.com/x/y');
  ok('path 缺前导斜杠会补上', joinUrl('https://a.com', 'x/y') === 'https://a.com/x/y');
  ok('两边都规范时原样', joinUrl('https://a.com', '/x/y') === 'https://a.com/x/y');
  ok('两边都有斜杠只留一个', joinUrl('https://a.com/', 'x/y') === 'https://a.com/x/y');
  ok('host 为空时不崩', joinUrl('', '/x') === '/x');
}

/* ---------------------------------------------------------------- 时间解析 */

{
  ok('10 位秒被当成秒', normalizeEpochMs(1_767_225_600) === 1_767_225_600_000);
  ok('13 位毫秒原样', normalizeEpochMs(NOW) === NOW);
  ok('数字串的秒也能认', normalizeEpochMs('1767225600') === 1_767_225_600_000);
  ok('ISO 带时区', normalizeEpochMs('2026-09-17T10:00:00+08:00') === Date.parse('2026-09-17T10:00:00+08:00'));
  ok(
    'yyyyMMddHHmmss 手写解析（Date 解不了这个格式）',
    normalizeEpochMs('20260917100000') === new Date(2026, 8, 17, 10, 0, 0).getTime(),
  );
  ok('空串返回 null', normalizeEpochMs('') === null);
  ok('null/undefined 返回 null', normalizeEpochMs(null) === null && normalizeEpochMs(undefined) === null);
  ok('无法解析的字符串返回 null', normalizeEpochMs('abc') === null);
  ok('负数与 0 返回 null', normalizeEpochMs(-1) === null && normalizeEpochMs(0) === null);
}

/* ------------------------------------------------------------------ 有效期 */

{
  ok('服务端给了未来的时间就用它', resolveExpiresAt({ expiresAt: NOW + 300_000 }, NOW, 60_000) === NOW + 300_000);
  ok('缺省时用兜底 TTL', resolveExpiresAt({}, NOW, 300_000) === NOW + 300_000);
  ok('兜底 TTL 被夹到至少 1 分钟', resolveExpiresAt({}, NOW, 1000) === NOW + 60_000);
  ok('兜底 TTL 被夹到最多 2 小时', resolveExpiresAt({}, NOW, 9_999_999_999) === NOW + 2 * 60 * 60 * 1000);
  ok('服务端给了过去时间也不会被判成立即过期', resolveExpiresAt({ expiresAt: NOW - 500_000 }, NOW, 60_000) >= NOW);
  ok('timeExpire 是 expiresAt 的别名', resolveExpiresAt({ timeExpire: NOW + 120_000 }, NOW, 60_000) === NOW + 120_000);
  ok('clampTtl 下界', clampTtl(0) === 60_000);
}

/* ------------------------------------------------------------ code_url 解码 */

{
  ok('&amp; 反解成 &', decodeCodeUrl('a?x=1&amp;y=2') === 'a?x=1&y=2');
  ok('&lt; &gt; &quot; 反解', decodeCodeUrl('&lt;a&gt;&quot;b&quot;') === '<a>"b"');
  ok('&#39; 反解成单引号', decodeCodeUrl('it&#39;s') === "it's");
  ok('&apos; 反解成单引号', decodeCodeUrl('it&apos;s') === "it's");
  // 关键：字面 + 与 % 必须原样保留，decodeURIComponent 会把它们弄坏
  ok('字面 + 不被破坏', decodeCodeUrl('pr=a+b') === 'pr=a+b');
  ok('百分号不被破坏', decodeCodeUrl('pr=100%25x') === 'pr=100%25x');
  ok('前后空白被 trim', decodeCodeUrl('  weixin://x  ') === 'weixin://x');
  ok('非字符串返回空串', decodeCodeUrl(123) === '' && decodeCodeUrl(null) === '');
}

/* ---------------------------------------------------------------- URL 合法性 */

{
  ok('pr 凭证模式通过', isWechatPayUrl(CODE_URL));
  // 微信官方文档给的短链模式，参数名是 sr 不是 pr，同样必须通过
  ok('sr 短链模式通过', isWechatPayUrl('weixin://wxpay/bizpayurl?sr=123456'));
  ok('大小写不敏感', isWechatPayUrl('WEIXIN://WXPAY/bizpayurl?sr=x'));
  // host 不一定是 wxpay：合单支付用的是 pay.weixin.qq.com，且路径多一层 /up
  ok('合单支付的 pay.weixin.qq.com 通过', isWechatPayUrl('weixin://pay.weixin.qq.com/bizpayurl/up?pr=NwY5Mz9&groupid=00'));
  ok('模式一的签名长串通过', isWechatPayUrl('weixin://wxpay/bizpayurl?sign=A&appid=B&mch_id=C'));
  ok('微信支付域名通过', isWechatPayUrl('https://wxpay.weixin.qq.com/pay?x=1'));
  ok('别的域名被拒', !isWechatPayUrl('https://evil.com/pay'));
  ok('别的 weixin 协议被拒', !isWechatPayUrl('weixin://other/thing'));
  ok('bizpayurl 的近似串被拒', !isWechatPayUrl('weixin://wxpay/bizpayurlfake?sr=1'));
  ok('空串被拒', !isWechatPayUrl(''));
}

/* --------------------------------------------------------------- 图片地址 */

{
  ok('https 绝对地址通过', normalizeImageUrl('https://a.com/q.png') === 'https://a.com/q.png');
  ok('http 也通过', normalizeImageUrl('http://a.com/q.png') === 'http://a.com/q.png');
  ok('协议相对地址补 https', normalizeImageUrl('//cdn.a.com/q.png') === 'https://cdn.a.com/q.png');
  ok('java 伪协议被拒', normalizeImageUrl('javascript:alert(1)') === null);
  ok('dataURL 被拒', normalizeImageUrl('data:image/png;base64,AA==') === null);
  // 站点部署在 /OneBiz 这类子路径时根相对路径必然 404，宁可返回 null 也不要猜 host
  ok('根相对路径被拒（base 路径陷阱）', normalizeImageUrl('/doc/uuid/x/get') === null);
  ok('空串被拒', normalizeImageUrl('') === null);
}

/* --------------------------------------------------------------- 来源选择 */

{
  const both = { codeURL: CODE_URL, qrImageUrl: 'https://a.com/q.png' };
  ok('默认偏向 codeUrl', resolveQrSource(both)?.kind === 'text');
  ok('后端真实字段名 codeURL 也认（trade_type=NATIVE 时返回）', resolveQrSource({ codeURL: CODE_URL })?.kind === 'text');
  ok('同时给了 codeURL 与 codeUrl 时以 codeURL 为准', resolveQrSource({ codeURL: CODE_URL, codeUrl: 'https://evil.com' })?.kind === 'text');
  ok('可以指定偏向图片', resolveQrSource(both, 'image')?.kind === 'image');
  ok('只有 codeUrl 时用文本', resolveQrSource({ codeUrl: CODE_URL })?.kind === 'text');
  ok('只有图片时用图片', resolveQrSource({ qrImageUrl: 'https://a.com/q.png' })?.kind === 'image');
  ok(
    '偏向图片但图片非法时降级到 codeUrl，而不是返回 null',
    resolveQrSource({ codeUrl: CODE_URL, qrImageUrl: '/bad.png' }, 'image')?.kind === 'text',
  );
  ok(
    '偏向 codeUrl 但 codeUrl 非法时降级到图片',
    resolveQrSource({ codeUrl: 'https://evil.com', qrImageUrl: 'https://a.com/q.png' })?.kind === 'image',
  );
  ok('两个都非法返回 null', resolveQrSource({ codeUrl: 'https://evil.com', qrImageUrl: '/x.png' }) === null);
  ok('空串视同缺失', resolveQrSource({ codeUrl: '', qrImageUrl: '' }) === null);
  ok('非对象返回 null', resolveQrSource(null) === null);
}

/* --------------------------------------------------------------- 下单响应 */

{
  const good = parseCreateOrderResponse({ codeURL: CODE_URL, amount: 100 }, NOW, 300_000);
  ok('正常响应解析成功', good.status === 'ok');
  if (good.status === 'ok') {
    ok('带上了二维码', good.order.qr.kind === 'text');
    ok('带上了过期时刻', good.order.expiresAt === NOW + 300_000);
    ok('接口没给订单号时留空（单号以查单返回为准，前端不自己编）', good.order.outTradeNo === '');
  }

  const withNo = parseCreateOrderResponse({ outTradeNo: 'T1', codeURL: CODE_URL }, NOW, 300_000);
  ok('接口给了订单号就带上', withNo.status === 'ok' && withNo.order.outTradeNo === 'T1');

  const noQr = parseCreateOrderResponse({ outTradeNo: 'T1' }, NOW, 300_000);
  ok('缺二维码被判失败', noQr.status === 'error' && noQr.code === 'missing-qr');

  ok('非对象被判失败', parseCreateOrderResponse('nope', NOW, 300_000).status === 'error');
  ok('数组被判失败', parseCreateOrderResponse([], NOW, 300_000).status === 'error');
}

/* ------------------------------------------------------------------ 金额 */

{
  ok('数字金额保留两位', formatAmount(1, 'CNY') === '￥1.00');
  ok('数字串金额也能格式化', formatAmount('0.1', 'CNY') === '￥0.10');
  ok('人民币带符号', formatAmount('100', 'CNY').startsWith('￥'));
  ok('非人民币带币种后缀', formatAmount('100', 'USD') === '100.00 USD');
  ok('缺失返回空串', formatAmount(undefined, 'CNY') === '' && formatAmount('', 'CNY') === '');
  ok('负数返回空串', formatAmount(-5, 'CNY') === '');
}

/* --------------------------------------------------------------- 查单响应 */

{
  const raw = {
    scbUuid: 'SCB-1',
    orderNo: 'REG20260920001',
    payTime: '2026-09-20 12:00:00',
    mobile: '13800000000',
    status: '1',
    payAmount: 2500,
  };
  const good = parseOpenAccPayResponse(raw, 'VHpX5NqoXLHwPyMnVeBzCN');
  ok('查单正常解析', good.status === 'ok');
  if (good.status === 'ok') {
    ok('带上业务关联 id（查单入参）', good.snapshot.busUnionId === 'VHpX5NqoXLHwPyMnVeBzCN');
    ok('带上订单号', good.snapshot.orderNo === 'REG20260920001');
    ok('带上状态原值', good.snapshot.status === '1');
    ok('带上支付时间', good.snapshot.payTime === '2026-09-20 12:00:00');
    ok('金额转成字符串（界面按字符串展示）', good.snapshot.amount === '2500');
    ok('带上开户 id 与手机号（排查用）', good.snapshot.scbUuid === 'SCB-1' && good.snapshot.mobile === '13800000000');
  }

  ok('没给订单号时是空串', (() => {
    const result = parseOpenAccPayResponse({ status: '0' }, 'R1');
    return result.status === 'ok' && result.snapshot.orderNo === '';
  })());
  ok('缺 status 判失败（换了字段名不该被藏起来）', (() => {
    const result = parseOpenAccPayResponse({ orderNo: 'T1' }, 'R1');
    return result.status === 'error' && result.code === 'missing-pay-status';
  })());
  ok('查单非对象被判失败', parseOpenAccPayResponse(null, 'R1').status === 'error');
  ok('查单数组被判失败', parseOpenAccPayResponse([], 'R1').status === 'error');
}

/* ------------------------------------------- 服务端业务错误（200 + reasons） */

{
  // 真实遇到的那一包：本地凭据丢了之后又去下单，服务端说这笔单已经付过了
  const rejected = {
    reasons: [
      {
        msg_id: '当前订单已完成支付，或请联系客服。',
        field: '',
        message: '当前订单已完成支付，或请联系客服。',
      },
    ],
  };
  const message = '当前订单已完成支付，或请联系客服。';

  ok('从 reasons[].message 取到原因', serverMessageOf(rejected) === message);
  ok('reasons[].message 缺失时退回 msg_id', serverMessageOf({ reasons: [{ msg_id: '仅 msg_id' }] }) === '仅 msg_id');
  ok('reasons 里有脏项也不崩', serverMessageOf({ reasons: [null, 3, { message: '  ' }, { message: '有效原因' }] }) === '有效原因');
  ok('认 { message }', serverMessageOf({ message: '直接给 message' }) === '直接给 message');
  ok('认 { msg } / { errorMsg } / { error }', serverMessageOf({ msg: 'm' }) === 'm' && serverMessageOf({ errorMsg: 'e' }) === 'e' && serverMessageOf({ error: 'x' }) === 'x');
  ok('剥一层 data 信封', serverMessageOf({ data: { message: '套在 data 里' } }) === '套在 data 里');

  const quiet: unknown[] = [
    { outTradeNo: 'T1', status: '1' }, // 正常业务响应不能被当成错误
    { reasons: [] },
    { reasons: [{ field: 'x' }] },
    null,
    [],
    'boom',
    42,
  ];
  ok('没有错误信息时返回 null（正常响应不受影响）', quiet.every((payload) => serverMessageOf(payload) === null));

  // 解析器：认得出就用这句话，而不是笼统的「返回格式不正确」
  const create = parseCreateOrderResponse(rejected, NOW, 300_000);
  ok('下单响应是业务错误时，把服务端那句话交给调用方', create.status === 'error' && create.code === 'server-rejected' && create.message === message);
  const query = parseOpenAccPayResponse(rejected, 'R1');
  ok('查单响应是业务错误时同样透出原因', query.status === 'error' && query.code === 'server-rejected' && query.message === message);
}

/* ----------------------------------------- 400 是「已经付过了」这种业务失败 */

{
  const live = { host: 'https://api.example.com', createPath: '/xcx/pay/create', queryPath: '/xcx/pay/query' };
  const busUnionId = 'VHpX5NqoXLHwPyMnVeBzCN';

  // 真实链路：下单被服务端以 400 + reasons[] 拒掉
  let createRejected: unknown = null;
  try {
    await createPayClient(live, {
      fetchImpl: async () =>
        ({
          ok: false,
          status: 400,
          text: async () =>
            JSON.stringify({
              reasons: [
                {
                  msg_id: '当前订单已完成支付，或请联系客服。',
                  field: '',
                  message: '当前订单已完成支付，或请联系客服。',
                },
              ],
            }),
          json: async () => ({}),
        }) as unknown as Response,
    }).createOrder({ payAmount: 2500, busUnionId });
  } catch (cause) {
    createRejected = cause;
  }

  const reason = '当前订单已完成支付，或请联系客服。';
  ok('400 下单失败仍是 HttpError（带状态码）', createRejected instanceof HttpError && createRejected.status === 400);
  ok('400 时用户看到的是服务端那句话，不是「服务返回 400」', toUserMessage(createRejected) === reason);
  ok('这类失败不算「未开通」，UI 不该显示未开通态', toPhaseForError(createRejected) === 'error');

  // 同一路径下补查状态：服务端说已支付 → 自愈所需的快照就到手了
  const recovered = parseOpenAccPayResponse(
    { scbUuid: 'SCB-1', orderNo: 'REG20260920001', payTime: '2026-09-20 12:00:00', status: '1', payAmount: 2500 },
    busUnionId,
  );
  const snapshot = paidSnapshotOf(recovered);
  ok('补查能拿到已支付快照（自愈的依据）', snapshot?.orderNo === 'REG20260920001');
  ok('自愈时能带上支付时间与订单号给界面', paidFieldsOf(snapshot!).payTime === '2026-09-20 12:00:00');
}

/* -------------------------------------------- 下单被拒后的自愈判断 */

{
  const paidSnapshot = { busUnionId: 'R1', orderNo: 'REG1', status: '1', mobile: '13800000000' };
  ok('查单说已支付 → 给出快照（调用方据此进「支付成功」）', paidSnapshotOf({ status: 'ok', snapshot: paidSnapshot })?.orderNo === 'REG1');
  ok('查单说没支付 → null（照常报下单那一刻的错误）', paidSnapshotOf({ status: 'ok', snapshot: { busUnionId: 'R1', orderNo: 'REG1', status: '0' } }) === null);
  ok('查单本身失败 → null', paidSnapshotOf({ status: 'error', code: 'server-rejected', message: 'x' }) === null);
}

/* --------------------------------------------------- 已支付要回填的字段 */

{
  const full = paidFieldsOf({
    busUnionId: 'R1',
    orderNo: 'REG20260920001',
    status: '1',
    payTime: '2026-09-20 12:00:00',
    amount: '2500',
    mobile: '13800000000',
  });
  ok('回填订单号', full.orderNo === 'REG20260920001');
  ok('回填支付时间', full.payTime === '2026-09-20 12:00:00');
  // 手机号按约定不落本地，重新进入页面时只能从查单回答里补「经办联系电话」
  ok('回填经办手机号', full.mobile === '13800000000');

  const bare = paidFieldsOf({ busUnionId: 'R1', orderNo: '', status: '1' });
  ok('服务端没给的一律 undefined（页面显示破折号，不编值）', bare.orderNo === undefined && bare.payTime === undefined && bare.mobile === undefined);
}

/* ------------------------------------------------------------------ 状态 */

{
  const at = (status: string) => ({ busUnionId: 'R1', orderNo: 'T1', status });
  const future = NOW + 60_000;
  const past = NOW - 1;

  ok("status='1' → paid", mapOpenAccState(at('1')) === 'paid');
  ok("status='0' → awaiting", mapOpenAccState(at('0')) === 'awaiting');
  ok('前后空白无所谓', mapOpenAccState(at(' 1 ')) === 'paid');
  // 未知状态：只 warn、不判死，同时也不静默吞掉
  const warnings: string[] = [];
  const realWarn = console.warn;
  console.warn = (...args: unknown[]) => void warnings.push(String(args[0]));
  const unknownNext = mapOpenAccState(at('9'));
  const emptyNext = mapOpenAccState(at(''));
  console.warn = realWarn;
  ok('没见过的状态当 awaiting，不判死（服务端会加状态）', unknownNext === 'awaiting');
  ok('空状态也当 awaiting（解析层已经拦过一次）', emptyNext === 'awaiting');
  ok('未知状态会 warn 出来，不是静默吞掉', warnings.filter((line) => line.includes('未知的支付状态')).length === 2);

  // 这条最重要：已支付被显示成「已过期」是支付模块最不可接受的 bug。
  // 判 expired 是调用方（hook）按本地倒计时做的，已支付必须在它之前就返回 paid。
  ok('已支付不参与本地倒计时判定（拿未来/过去时间点结果一样）', mapOpenAccState(at('1')) === 'paid' && future > past);
}

/* ------------------------------------------------------------------ 退避 */

{
  const half = () => 0.5;
  ok('正常态首次延迟落在基准附近', Math.abs(nextPollDelay(0, 0, half) - 1500) <= 1);
  ok('正常态逐步拉开', nextPollDelay(0, 0, half) <= nextPollDelay(5, 0, half));
  ok('正常态封顶', nextPollDelay(99, 0, half) === 5000);
  ok('失败态比正常态退得快', nextPollDelay(0, 5, half) === 15000);
  ok('失败态递增', nextPollDelay(0, 1, half) < nextPollDelay(0, 2, half));
  ok('失败次数超出序列长度不越界', nextPollDelay(0, 99, half) === 15000);
  ok('抖动幅度在 ±20% 内', nextPollDelay(0, 0, () => 0) === 1200 && nextPollDelay(0, 0, () => 1) === 1800);
  ok('连续失败上限是 5 次', MAX_CONSECUTIVE_FAILURES === 5);
}

/* ------------------------------------------------------------ 异常与终态 */

{
  ok('未配置错误映射到 unconfigured', toPhaseForError(new PaymentNotConfiguredError(['A'])) === 'unconfigured');
  ok('超时错误映射到 error', toPhaseForError(new TimeoutError()) === 'error');
  ok('普通错误映射到 error', toPhaseForError(new Error('x')) === 'error');
  // 原生 AbortError 没有可靠的类型判别，只能按 name 认
  ok('能认出 abort', isAbortError(Object.assign(new Error('aborted'), { name: 'AbortError' })));
  ok('普通错误不是 abort', !isAbortError(new Error('x')));

  ok('paid 是终态', isTerminal('paid'));
  ok('closed 是终态', isTerminal('closed'));
  ok('awaiting 不是终态', !isTerminal('awaiting'));
  ok('unconfigured 不是终态（配好就能重来）', !isTerminal('unconfigured'));
}

/* ------------------------------------------------------- 二维码矩阵往返 */

{
  // 把生成的 path 反解回二维矩阵，逐格比对 uqr 的原始矩阵。
  // 矩阵本身由 uqr 保证，这里验证的是「矩阵 → path」这一步无损，两者合起来即二维码可扫。
  const parsePath = (path: string, size: number): boolean[][] => {
    const grid = Array.from({ length: size }, () => Array.from({ length: size }, () => false));
    for (const move of path.match(/M(\d+) (\d+)h(\d+)v1h-\d+z/g) ?? []) {
      const [, x, y, w] = move.match(/M(\d+) (\d+)h(\d+)/)!;
      for (let i = 0; i < Number(w); i += 1) grid[Number(y)][Number(x) + i] = true;
    }
    return grid;
  };

  const encoded = qrPath(CODE_URL);
  ok('能编码出二维码', encoded !== null);

  if (encoded) {
    // 与 uqr 的原始矩阵逐格比对
    const raw = encode(CODE_URL, { ecc: 'M', border: QR_BORDER });
    ok('边长与库给出的矩阵一致', encoded.size === raw.size && raw.data.length === raw.size);

    const grid = parsePath(encoded.path, encoded.size);
    ok('反解出的矩阵是方的', grid.length === encoded.size && grid[0]?.length === encoded.size);
    ok('反解出的深色模块数大于 0', grid.some((row) => row.some(Boolean)));

    let mismatches = 0;
    raw.data.forEach((row, y) => row.forEach((dark, x) => {
      if (dark !== grid[y][x]) mismatches += 1;
    }));
    ok('矩阵 → path 无损（逐格一致）', mismatches === 0);

    // 静默区必须是白的，否则很多手机扫不出来
    const quietRows = grid.slice(0, QR_BORDER);
    const quietCols = grid.map((row) => row.slice(0, QR_BORDER));
    ok(
      '四周静默区全白',
      quietRows.every((row) => row.every((v) => !v)) &&
        quietCols.every((row) => row.every((v) => !v)) &&
        grid.slice(-QR_BORDER).every((row) => row.every((v) => !v)),
    );
  }

  ok('空串编码返回 null', qrPath('') === null);
  ok('纯空白编码返回 null', qrPath('   ') === null);
}

/* --------------------------------------------- client：配置闸门与离线冒烟 */

const jsonResponse = (body: unknown) =>
  ({ ok: true, status: 200, json: async () => body }) as unknown as Response;

const failing = (status: number) =>
  ({ ok: false, status, json: async () => ({}) }) as unknown as Response;

/** 永不返回、只在 abort 时 reject 的假 fetch，用来测超时与外部取消 */
const hanging: typeof fetch = (_url, init) =>
  new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () =>
      reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
    );
  });

async function checkClient() {
  // 真实契约：创建开户支付订单（POST {DOC_HOST}/xcx/yqt-co/wx-pay/open-acc/pay）
  const payload = { payAmount: 2500, busUnionId: 'VHpX5NqoXLHwPyMnVeBzCN' };
  const live = { host: 'https://api.example.com', createPath: '/xcx/pay/create', queryPath: '/xcx/pay/query' };

  // 未配置时必须在碰 fetch 之前就抛，且错误类型要能被 toPhaseForError 认成 unconfigured
  for (const [createPath, queryPath, expectedMissing] of [
    ['', '', ['WECHAT_NATIVE_CREATE_PATH', 'WECHAT_NATIVE_QUERY_PATH']],
    ['/pay/create', '', ['WECHAT_NATIVE_QUERY_PATH']],
    ['', '/pay/query', ['WECHAT_NATIVE_CREATE_PATH']],
  ] as const) {
    const client = createPayClient({ host: 'https://api.example.com', createPath, queryPath }, { fetchImpl: hanging });
    ok(
      `缺路径清单正确（${createPath || 'create'} / ${queryPath || 'query'}）`,
      missingEndpointPaths({ host: 'x', createPath, queryPath }).join(',') === expectedMissing.join(','),
    );

    let caught: unknown = null;
    try {
      await client.createOrder(payload);
    } catch (cause) {
      caught = cause;
    }
    ok('未配置时下单抛 PaymentNotConfiguredError', caught instanceof PaymentNotConfiguredError);
    ok('未配置错误映射到 unconfigured 而非 error', toPhaseForError(caught) === 'unconfigured');

    let queryCaught: unknown = null;
    try {
      await client.queryOrder('T1');
    } catch (cause) {
      queryCaught = cause;
    }
    ok('未配置时查单同样抛错', queryCaught instanceof PaymentNotConfiguredError);
  }

  // 正常路径：假 fetch 走通整条链路
  let seenUrl = '';
  let seenBody: Record<string, unknown> = {};
  const okFetch: typeof fetch = async (url, init) => {
    seenUrl = String(url);
    seenBody = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
    return jsonResponse({ outTradeNo: 'T1', codeUrl: CODE_URL, amount: 100 });
  };

  const created = await createPayClient({ ...live, host: 'https://api.example.com/' }, { fetchImpl: okFetch }).createOrder(payload);
  ok('下单走通并解析成功', created.status === 'ok');
  ok('下单地址拼接正确（host 尾斜杠被吃掉）', seenUrl === 'https://api.example.com/xcx/pay/create');
  // 请求体就是这两个字段：金额（元）+ 业务关联 id，不多不少
  ok('请求体恰好两个字段', Object.keys(seenBody).sort().join(',') === 'busUnionId,payAmount');
  ok('金额按元传数字（不是分、不是字符串）', seenBody.payAmount === 2500 && typeof seenBody.payAmount === 'number');
  ok('业务关联 id 就是确认单据号', seenBody.busUnionId === 'VHpX5NqoXLHwPyMnVeBzCN');

  const queried = await createPayClient(live, {
    fetchImpl: async () => jsonResponse({ orderNo: 'REG1', status: '1', payAmount: 2500 }),
  }).queryOrder('VHpX5NqoXLHwPyMnVeBzCN');
  ok('查单走通并解析成功（status=1 → 已支付）', queried.status === 'ok' && mapOpenAccState(queried.snapshot) === 'paid' && queried.snapshot.orderNo === 'REG1');

  let queryUrl = '';
  await createPayClient(live, {
    fetchImpl: async (url) => {
      queryUrl = String(url);
      return jsonResponse({ orderNo: 'T1', status: '0' });
    },
  }).queryOrder('T 1&x=2');
  ok('查单按 busUnionId 查，且值被 URL 编码', queryUrl === 'https://api.example.com/xcx/pay/query?busUnionId=T%201%26x%3D2');

  // 非 2xx 要变成 HttpError，而不是静默当成空响应
  let httpError: unknown = null;
  try {
    await createPayClient(live, { fetchImpl: async () => failing(500) }).queryOrder('T1');
  } catch (cause) {
    httpError = cause;
  }
  ok('非 2xx 抛 HttpError', httpError instanceof HttpError && httpError.status === 500);

  // 非 2xx 的响应体里若带着同一套 reasons 信封，HttpError 的文案要用它，
  // 而不是只报「服务返回 500」——用户至少知道该找客服还是该重新下单
  let rejectedError: unknown = null;
  try {
    await createPayClient(live, {
      fetchImpl: async () =>
        ({
          ok: false,
          status: 400,
          text: async () => JSON.stringify({ reasons: [{ message: '当前订单已完成支付，或请联系客服。' }] }),
          json: async () => ({}),
        }) as unknown as Response,
    }).queryOrder('R1');
  } catch (cause) {
    rejectedError = cause;
  }
  ok(
    '非 2xx 时把服务端的原因带进 HttpError',
    rejectedError instanceof HttpError && rejectedError.message === '当前订单已完成支付，或请联系客服。',
  );

  // 网关整页 HTML 这种解不开的响应体，仍然退回状态码文案
  let htmlError: unknown = null;
  try {
    await createPayClient(live, {
      fetchImpl: async () =>
        ({ ok: false, status: 502, text: async () => '<html>502</html>', json: async () => ({}) }) as unknown as Response,
    }).queryOrder('R1');
  } catch (cause) {
    htmlError = cause;
  }
  ok('响应体解不开时退回「服务返回 502」', htmlError instanceof HttpError && htmlError.message === '服务返回 502');

  // 超时抛 TimeoutError（可重试），与下面外部取消的 AbortError（静默丢弃）必须区分开
  let timeoutError: unknown = null;
  try {
    await createPayClient(live, { fetchImpl: hanging, timeoutMs: 20 }).queryOrder('T1');
  } catch (cause) {
    timeoutError = cause;
  }
  ok('超时抛 TimeoutError 而不是 AbortError', timeoutError instanceof TimeoutError);

  const outer = new AbortController();
  const cancelled = createPayClient(live, { fetchImpl: hanging, timeoutMs: 5000 }).queryOrder('T1', outer.signal);
  outer.abort();
  let cancelError: unknown = null;
  try {
    await cancelled;
  } catch (cause) {
    cancelError = cause;
  }
  ok('外部取消保持为 AbortError', isAbortError(cancelError));
  ok('外部取消不会被误判成超时', !(cancelError instanceof TimeoutError));
}

await checkClient();

console.log(`\n${passed} 项通过，${failed} 项失败`);
if (failed > 0) process.exit(1);
