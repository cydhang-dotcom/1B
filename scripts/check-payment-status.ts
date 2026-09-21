/**
 * 支付状态查询（`#paid` 的直达判断）的自检：不联网、不开浏览器。
 *   npx tsx scripts/check-payment-status.ts
 *
 * 覆盖的是**结论怎么来的**：走支付模块的查单接口（按 busUnionId 查开户支付订单），
 * 哪些响应算「已支付」、哪些算「未支付」、哪些一律「查不动」。
 * 这里判错的代价是显示一个假的「支付成功」界面，所以宁可少认、不可多认。
 */
import {
  PAYMENT_STATUS_TIMEOUT_MS,
  fetchPaymentStatus,
} from '../src/copreg/paymentStatus';

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

const LIVE = { host: 'https://api.example.com', createPath: '/xcx/pay/create', queryPath: '/xcx/pay/query' };
const RECORD_ID = 'VHpX5NqoXLHwPyMnVeBzCN';

/** 查单响应：假 fetch 只回这一份 JSON */
const reply = (body: unknown, status = 200) =>
  (async () =>
    ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    }) as unknown as Response) as unknown as typeof fetch;

const queryWith = (body: unknown, status = 200) =>
  fetchPaymentStatus(LIVE, RECORD_ID, { fetchImpl: reply(body, status) });

/* ------------------------------------------------------------- 已支付 */

{
  const paid = await queryWith({
    scbUuid: 'SCB-1',
    orderNo: 'REG20260920001',
    payTime: '2026-09-20 12:00:00',
    mobile: '13800000000',
    status: '1',
    payAmount: 2500,
  });
  ok("status='1' → paid", paid.status === 'paid');
  ok('带出服务端给的订单号', paid.orderNo === 'REG20260920001');
  ok('带出支付时间（支付成功界面要显示）', paid.paidAt === '2026-09-20 12:00:00');
  // 重新进入页面时「经办联系电话」就靠它：本地不存手机号
  ok('带出经办手机号', paid.mobile === '13800000000');
}

/* ------------------------------------------------------------- 未支付 */

{
  const warnings: string[] = [];
  const realWarn = console.warn;
  console.warn = (...args: unknown[]) => void warnings.push(String(args[0]));
  for (const [state, label] of [
    ['0', '未支付'],
    ['9', '没见过的新状态'],
    ['', '空状态'],
  ] as const) {
    const raw: Record<string, unknown> = { orderNo: 'T1', payAmount: 2500 };
    if (state !== '') raw.status = state;
    const result = await queryWith(raw);
    // 空 status 在解析层就被拦下（unknown），其余都算「还没付」——
    // 两种结论对调用方一样是「不直达」，但语义要分得清
    const expected = state === '' ? 'unknown' : 'unpaid';
    ok(`status=${JSON.stringify(state)}（${label}）→ ${expected}`, result.status === expected);
  }
  console.warn = realWarn;
  ok('没见过的状态会把原值 warn 出来（不静默吞掉）', warnings.some((line) => line.includes('未知的支付状态: 9')));
  ok('未支付时也算得出订单号（界面照实显示）', (await queryWith({ orderNo: 'T1', status: '0' })).orderNo === 'T1');
  ok('未支付时也带回手机号（等待付款时页面一样要显示经办电话）', (await queryWith({ orderNo: 'T1', status: '0', mobile: '13900000000' })).mobile === '13900000000');
}
/* --------------------------------------------------- 查不动一律 unknown */

{
  ok('缺 status → unknown（不猜「没状态=没付」，否则字段名换了都发现不了）', (await queryWith({ orderNo: 'T1' })).status === 'unknown');
  ok('响应不是对象 → unknown', (await queryWith([1, 2, 3])).status === 'unknown');
  ok('响应是 null → unknown', (await queryWith(null)).status === 'unknown');
  ok('HTTP 500 → unknown', (await queryWith({ orderNo: 'T1', status: '1' }, 500)).status === 'unknown');

  const offline = (async () => {
    throw new TypeError('fetch failed');
  }) as unknown as typeof fetch;
  ok('网络不通 → unknown（不抛异常）', (await fetchPaymentStatus(LIVE, RECORD_ID, { fetchImpl: offline })).status === 'unknown');

  const hanging = (async (_url: string, options: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      options.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    })) as unknown as typeof fetch;
  ok('超时 → unknown（不抛异常）', (await fetchPaymentStatus(LIVE, RECORD_ID, { fetchImpl: hanging, timeoutMs: 20 })).status === 'unknown');

  ok('路径没配 → unknown 且不发请求', (await fetchPaymentStatus({ ...LIVE, queryPath: '' }, RECORD_ID)).status === 'unknown');
  ok('两个路径都没配（支付未接入）→ unknown', (await fetchPaymentStatus({ host: 'https://api.example.com', createPath: '', queryPath: '' }, RECORD_ID)).status === 'unknown');
  ok('没有单据号 → unknown 且不发请求', (await fetchPaymentStatus(LIVE, '   ')).status === 'unknown');
}

/* ------------------------------------------------------------ 请求本身 */

{
  let url = '';
  let init: RequestInit | null = null;
  const spy = (async (target: string, options: RequestInit) => {
    url = String(target);
    init = options;
    return {
      ok: true,
      status: 200,
      json: async () => ({ orderNo: 'T1', status: '1' }),
      text: async () => '{}',
    } as unknown as Response;
  }) as unknown as typeof fetch;

  await fetchPaymentStatus(LIVE, RECORD_ID, { fetchImpl: spy });
  ok('走的是支付模块的查单接口', url === 'https://api.example.com/xcx/pay/query?busUnionId=VHpX5NqoXLHwPyMnVeBzCN');
  ok('方法是 GET（查单是只读的）', init?.method === 'GET');
  ok('按 busUnionId 查（不是订单号）', url.includes('busUnionId=VHpX5NqoXLHwPyMnVeBzCN'));

  await fetchPaymentStatus(LIVE, 'T 1&x=2', { fetchImpl: spy });
  ok('单据号里的特殊字符被转义，不会污染查询串', url.endsWith('busUnionId=T%201%26x%3D2'));
}

ok('只读预判给 8s，不到支付模块默认的 15s', PAYMENT_STATUS_TIMEOUT_MS === 8_000);

console.log(`\n${passed} 项通过，${failed} 项失败`);
if (failed > 0) process.exit(1);
