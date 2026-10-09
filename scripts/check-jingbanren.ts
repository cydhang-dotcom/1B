/**
 * 「经办人信息读取」接口的自检：不联网、不碰 React、不开浏览器。
 *   npx tsx scripts/check-jingbanren.ts
 *
 * 口径（用户 2026-10-08 的要求：委托书那两项取接口值，不再让用户手填）：
 *   1. 地址是 `{host}{path}?busUnionId=…`，单号要 encode，host/path 的斜杠接缝不能出双斜杠；
 *   2. 返回体**不猜死结构**：平铺的 `handName` / `handIdNumber` 认，
 *      套一层 `data` / `result` / `obj`（含 JSON 字符串）也认；认不出来就是两项空串，不写 `undefined`；
 *   3. 身份证号按手填时的口径清洗（只留数字与结尾 X、统一大写）；
 *   4. **只覆盖非空的那一项** —— 接口这次没给的那项保留原值；两项都没变化时 `changed = false`。
 */
import {
  JINGBANREN_TIMEOUT_MS,
  applyJingbanren,
  fetchJingbanren,
  jingbanrenFromPayload,
  jingbanrenUrl,
} from '../src/copreg/registration/jingbanren';

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

const ENDPOINT = { host: 'https://doc.example.com/v1/', path: '/xcx/yqt-co/subscribe/handler' };

/* ------------------------------------------------------------ 1. 请求地址 */

ok(
  'host / path 的斜杠接缝只留一个',
  jingbanrenUrl(ENDPOINT, 'REC-1') === 'https://doc.example.com/v1/xcx/yqt-co/subscribe/handler?busUnionId=REC-1'
);
ok('单号前后的空格被去掉', jingbanrenUrl(ENDPOINT, '  REC-1  ').endsWith('?busUnionId=REC-1'));
ok(
  'recordId 做 encode（带 & / 空格 的坏单号不会把 query 拆坏）',
  jingbanrenUrl(ENDPOINT, 'a b&c') === 'https://doc.example.com/v1/xcx/yqt-co/subscribe/handler?busUnionId=a%20b%26c'
);

/* -------------------------------------------------------------- 2. 解析 */

ok(
  '平铺返回：读 handName / handIdNumber',
  JSON.stringify(jingbanrenFromPayload({ handName: '张三', handIdNumber: '440301199308123418' })) ===
    JSON.stringify({ name: '张三', idNumber: '440301199308123418' })
);
ok(
  '套一层 data 也认',
  jingbanrenFromPayload({ code: '0', data: { handName: '李四', handIdNumber: '44030119930812341X' } }).name === '李四'
);
ok(
  '套一层 result 也认',
  jingbanrenFromPayload({ result: { handName: '王五' } }).name === '王五'
);
ok(
  'data 里是 JSON 字符串也认',
  jingbanrenFromPayload({ data: '{"handName":"赵六","handIdNumber":"440301199308123418"}' }).name === '赵六'
);
ok('顶层就是 JSON 字符串也认', jingbanrenFromPayload('{"handName":"钱七"}').name === '钱七');
ok('名字两边空格去掉', jingbanrenFromPayload({ handName: '  张三  ' }).name === '张三');
ok(
  '身份证号清洗成「数字 + 结尾 X」且大写（与手填时的输入口径一致）',
  jingbanrenFromPayload({ handIdNumber: '4403011993-0812-341x' }).idNumber === '44030119930812341X'
);
ok(
  '只给姓名时身份证号是空串（不是 undefined）',
  jingbanrenFromPayload({ handName: '张三' }).idNumber === ''
);
ok('认不出的结构 → 两项空串', JSON.stringify(jingbanrenFromPayload({ foo: 'bar' })) === JSON.stringify({ name: '', idNumber: '' }));
ok('null / 数组 / 数字 → 两项空串', jingbanrenFromPayload(null).name === '' && jingbanrenFromPayload([1, 2]).name === '' && jingbanrenFromPayload(42).idNumber === '');
ok('字段是数字（脏数据）→ 当空串，不写进表单', jingbanrenFromPayload({ handName: 123 }).name === '');

/* ------------------------------------------------- 3. 只覆盖非空的那一项 */

{
  const current = { trusteeName: '旧名字', trusteeIdNumber: '旧号码' };
  const both = applyJingbanren(current, { name: '新名字', idNumber: '440301199308123418' });
  ok('两项都给了 → 两项都换', both.next.trusteeName === '新名字' && both.next.trusteeIdNumber === '440301199308123418');
  ok('两项都换了 → changed = true', both.changed === true);

  const onlyName = applyJingbanren(current, { name: '新名字', idNumber: '' });
  ok('只给了姓名 → 身份证号保留原值', onlyName.next.trusteeName === '新名字' && onlyName.next.trusteeIdNumber === '旧号码');

  const nothing = applyJingbanren(current, { name: '', idNumber: '' });
  ok('两项都没给 → 原样不动', nothing.next.trusteeName === '旧名字' && nothing.next.trusteeIdNumber === '旧号码');
  ok('两项都没给 → changed = false（调用方不用白改 state / 白落盘）', nothing.changed === false);

  const same = applyJingbanren(current, { name: '旧名字', idNumber: '旧号码' });
  ok('读到的东西跟现有的一模一样 → changed = false', same.changed === false);
}

/* ------------------------------------------------------ 4. 不发的那些请求 */

{
  const calls: string[] = [];
  const fetchImpl = (url: string) => {
    calls.push(String(url));
    return Promise.resolve(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
  };

  let notConfigured = '';
  await fetchJingbanren({ host: 'https://doc.example.com', path: '' }, 'REC-1', { fetchImpl: fetchImpl as unknown as typeof fetch }).catch(
    (e: Error) => {
      notConfigured = e.message;
    }
  );
  ok('路径没配 → 抛「尚未接入」且一个请求都不发', notConfigured.includes('尚未接入') && calls.length === 0);

  let missing = '';
  await fetchJingbanren(ENDPOINT, '   ', { fetchImpl: fetchImpl as unknown as typeof fetch }).catch((e: Error) => {
    missing = e.message;
  });
  ok('没委托单号 → 抛「缺少委托单号」且一个请求都不发', missing.includes('缺少委托单号') && calls.length === 0);

  // 正常一次：GET 到正确地址、解析出两项
  const info = await fetchJingbanren(ENDPOINT, 'REC-9', {
    fetchImpl: ((url: string, init: RequestInit) => {
      calls.push(String(url));
      ok('用的是 GET', init.method === 'GET');
      return Promise.resolve(
        new Response(JSON.stringify({ handName: '张三', handIdNumber: '440301199308123418' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    }) as unknown as typeof fetch,
  });
  ok('成功时解析出两项', info.name === '张三' && info.idNumber === '440301199308123418');
  ok('地址里带上了 busUnionId', calls[calls.length - 1].includes('busUnionId=REC-9'));

  // 非 2xx：把服务端那句人话透出来
  let serverMsg = '';
  await fetchJingbanren(ENDPOINT, 'REC-9', {
    fetchImpl: (() =>
      Promise.resolve(new Response(JSON.stringify({ message: '开户单不存在' }), { status: 404, headers: { 'Content-Type': 'application/json' } }))) as unknown as typeof fetch,
  }).catch((e: Error) => {
    serverMsg = e.message;
  });
  ok('非 2xx → 用响应体里那句人话', serverMsg.includes('开户单不存在'));

  // 空体 / 非 JSON：给「格式异常」而不是崩在 JSON.parse
  let emptyMsg = '';
  await fetchJingbanren(ENDPOINT, 'REC-9', {
    fetchImpl: (() => Promise.resolve(new Response('', { status: 200 }))) as unknown as typeof fetch,
  }).catch((e: Error) => {
    emptyMsg = e.message;
  });
  ok('空响应体 → 「返回格式异常」', emptyMsg.includes('返回格式异常'));
}

ok('超时不是第 1 步那种 5 分钟（普通读接口 15 秒）', JINGBANREN_TIMEOUT_MS === 15_000);

console.log(`\n${passed} 项通过，${failed} 项失败`);
if (failed > 0) process.exit(1);
