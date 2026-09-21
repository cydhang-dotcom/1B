/**
 * 订单状态核实闸门的自检：不联网、不碰 React、不开浏览器。
 *   npx tsx scripts/check-order-status-check.ts
 *
 * 覆盖的正是真机上调了半天才抓到的那个坑：dev 的 StrictMode 会「挂载 → 清理 → 再挂载」，
 * 第一轮的结果按取消丢弃。如果那时就把「这个单据号查过了」记上，第二轮不会再查，
 * 于是服务端明明说已支付、界面却一直停在待支付。
 */
import { createOrderStatusChecker, type OrderStatusResult } from '../src/copreg/orderStatusCheck';

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

const RECORD_ID = 'TJG47efqmxfuXKairPJ3Z9';

/** 可控的假请求：记下调用次数，手动决定何时 resolve */
const createFetcher = (result: OrderStatusResult = { status: 'paid', orderNo: 'REG1' }) => {
  const calls: string[] = [];
  let release: (() => void) | null = null;
  const fetcher = (recordId: string) => {
    calls.push(recordId);
    return new Promise<OrderStatusResult>((resolve) => {
      release = () => resolve(result);
    });
  };
  return { fetcher, calls, release: () => release?.() };
};

/* ------------------------------------------------------------- 基本语义 */

{
  const { fetcher, calls } = createFetcher();
  const checker = createOrderStatusChecker(fetcher);

  ok('空单据号不查', checker.check('') === null && checker.check('   ') === null && calls.length === 0);

  const first = checker.check(RECORD_ID);
  ok('首次会发请求', first !== null && calls.length === 1);
  ok('同一单据号在途时复用同一个 promise（不会重复打服务端）', checker.check(RECORD_ID) === first && calls.length === 1);
  ok('不同单据号会另发一次', checker.check('OTHER-ID') !== null && calls.length === 2);
}

/* --------------------------------------------- StrictMode：挂载→清理→再挂载 */

{
  const { fetcher, calls, release } = createFetcher({ status: 'paid', orderNo: 'REG1' });
  const checker = createOrderStatusChecker(fetcher);

  // 第一次挂载：拿到 promise，随后被「清理」标记为取消，结果不采用
  const firstPass = checker.check(RECORD_ID);
  let firstApplied: boolean = false;
  firstPass!.then(() => {
    firstApplied = true; // 调用方在 cancelled 时会忽略，这里用一个标记模拟
  });

  // 第二次挂载（StrictMode 立刻重跑 effect）：闸门必须还能给出同一个 promise
  const secondPass = checker.check(RECORD_ID);
  ok('第二轮挂载仍能拿到同一个在途 promise（这是修复的关键）', secondPass !== null && secondPass === firstPass);
  ok('并且没有多发请求', calls.length === 1);

  let secondResult: unknown = null;
  secondPass!.then((result) => {
    secondResult = result;
  });
  release();
  await Promise.resolve();
  await Promise.resolve();

  ok('第二轮拿到结果并可以落地（已支付不再被丢掉）', (secondResult as { status?: string } | null)?.status === 'paid');
  ok('第一轮的 then 也照常触发，但由调用方按取消忽略', Boolean(firstApplied));

  // 出结果之后不再重复查
  ok('出结果后同一单据号不再查（只读预判，不反复打服务端）', checker.check(RECORD_ID) === null && calls.length === 1);
}

/* --------------------------------------------------------- 失败也算「查过」 */

{
  const { fetcher, calls, release } = createFetcher({ status: 'unknown' });
  const checker = createOrderStatusChecker(fetcher);

  const pending = checker.check(RECORD_ID);
  release();
  await Promise.resolve();
  await Promise.resolve();

  ok('查不动也会出结果（unknown）', (await pending)?.status === 'unknown');
  ok('查不动之后不再反复重试（避免一直打服务端）', checker.check(RECORD_ID) === null && calls.length === 1);
}

/* --------------------------------------------------------- 换单据号要能再查 */

{
  const { fetcher, calls, release } = createFetcher({ status: 'unpaid' });
  const checker = createOrderStatusChecker(fetcher);

  const first = checker.check(RECORD_ID);
  release();
  await Promise.resolve();
  await Promise.resolve();
  await first;

  const reused = checker.check(RECORD_ID);
  const next = checker.check('NEW-RECORD-ID');
  ok('同号不再查', reused === null);
  ok('重新确认后换了单据号 → 允许再查新号', next !== null && calls.join(',') === `${RECORD_ID},NEW-RECORD-ID`);
}

console.log(`\n${passed} 项通过，${failed} 项失败`);
if (failed > 0) process.exit(1);
