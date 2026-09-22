/**
 * 申报资料保存 / 提交接口（`/xcx/yqt-co/subscribe/open-info`）的自检：
 * 不联网、不碰 React、不开浏览器。
 *   npx tsx scripts/check-open-info.ts
 *
 * 覆盖三件事：
 *   1. **请求体**：恰好 `busUnionId` / `var2` / `savaType` 三个字段（`savaType` 是后端 DTO 的
 *      原始拼写，不许「顺手改对」），`var2` 是本地存档那份 JSON 的字符串，能原样解回来；
 *   2. **两个保存类型**：0 = 临时保存（保存草稿）、1 = 保存（确认提交并申请），原样带给服务端；
 *   3. **失败都拦人**：路径没配 / 没委托单号 → 一个请求都不发；非 2xx 用后端文案，
 *      超时与网络不通各有中文提示；2xx 就算成功（响应体不解析，见 openInfo.ts 的说明）。
 */
import {
  OPEN_INFO_TIMEOUT_MS,
  OpenInfoMissingRecordError,
  OpenInfoNotConfiguredError,
  openInfoRequestOf,
  saveOpenInfo,
} from '../src/copreg/registration/openInfo';

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

const ENDPOINT = { host: 'https://yqt.ibanbu.com/v1', path: '/xcx/yqt-co/subscribe/open-info' };
const FORM = {
  id: 'form-1',
  status: 'submitted',
  submissionPhone: '13800000000',
  basic: { intro: '字号甲乙丙', capital: '100', names: ['甲乙丙科技有限公司', '', ''] },
  people: { p1: { id: 'p1', name: '张三', files: [{ fileUuid: 'F1', fileName: '身份证.png' }] } },
  shareholders: [{ id: 's1', ratio: '100' }],
};

const jsonResponse = (body: string, status = 200) =>
  new Response(body, { status, headers: { 'Content-Type': 'application/json' } });

const capturingFetch = (response: Response) => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const impl = (async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return response;
  }) as unknown as typeof fetch;
  return { calls, impl };
};

const failureOf = async (run: () => Promise<unknown>): Promise<string> => {
  try {
    await run();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return '(没有抛错)';
};

/* -------------------------------------------------------------- 请求体 */

{
  const request = openInfoRequestOf({ busUnionId: ' REC-1 ', form: FORM, savaType: '1' });
  ok(
    '恰好三个字段，字段名就是后端那三个（savaType 原样拼写）',
    Object.keys(request).sort().join(',') === 'busUnionId,savaType,var2'
  );
  ok('busUnionId 前后空白被去掉', request.busUnionId === 'REC-1');
  ok('savaType 原样带出（1 = 保存/提交）', request.savaType === '1');
  ok('var2 是字符串', typeof request.var2 === 'string');
  ok('var2 就是本地存档那份 JSON（能原样解回来）', JSON.stringify(JSON.parse(request.var2)) === JSON.stringify(FORM));
  ok(
    'var2 里连附件的 fileUuid 都在（与 localStorage 那份逐字一致）',
    JSON.parse(request.var2).people.p1.files[0].fileUuid === 'F1'
  );
  ok('临时保存用 0', openInfoRequestOf({ busUnionId: 'R', form: FORM, savaType: '0' }).savaType === '0');

  ok(
    '没有委托单号 → 专门的错误（调用方据此提示回第 1 步）',
    (() => {
      try {
        openInfoRequestOf({ busUnionId: '   ', form: FORM, savaType: '1' });
        return false;
      } catch (error) {
        return error instanceof OpenInfoMissingRecordError;
      }
    })()
  );
}

/* ---------------------------------------------------------- 请求本身 */

{
  const { calls, impl } = capturingFetch(jsonResponse('{"code":"0"}'));
  await saveOpenInfo(ENDPOINT, { busUnionId: 'REC-1', form: FORM, savaType: '1' }, { fetchImpl: impl });

  const body = JSON.parse(String(calls[0].init?.body)) as Record<string, unknown>;
  ok('地址 = host + path', calls[0].url === 'https://yqt.ibanbu.com/v1/xcx/yqt-co/subscribe/open-info');
  ok('方法是 POST', calls[0].init?.method === 'POST');
  ok('带 JSON 请求头', (calls[0].init?.headers as Record<string, string>)['Content-Type'] === 'application/json');
  ok('请求体三个字段', Object.keys(body).sort().join(',') === 'busUnionId,savaType,var2');
  ok('提交时 savaType = 1', body.savaType === '1');
  ok('提交时带上了委托单号', body.busUnionId === 'REC-1');
  ok('var2 在这条链路上仍是那份 JSON', JSON.stringify(JSON.parse(String(body.var2))) === JSON.stringify(FORM));
  ok('普通写库接口给 15s（不是大模型的 60s）', OPEN_INFO_TIMEOUT_MS === 15_000);
}

{
  const { calls, impl } = capturingFetch(jsonResponse('{"code":"0"}'));
  await saveOpenInfo({ ...ENDPOINT, host: 'https://yqt.ibanbu.com/v1/' }, { busUnionId: 'R', form: {}, savaType: '0' }, { fetchImpl: impl });
  ok('host 尾斜杠不会拼出双斜杠', calls[0].url === 'https://yqt.ibanbu.com/v1/xcx/yqt-co/subscribe/open-info');
  ok('form 为 undefined 时 var2 是 {}（不是 "undefined"）', String(calls[0].init?.body).includes('"var2":"{}"'));
}

/* ------------------------------------------------------------ 各种失败 */

{
  const { calls, impl } = capturingFetch(jsonResponse('{}'));
  const message = await failureOf(() => saveOpenInfo({ ...ENDPOINT, path: '' }, { busUnionId: 'R', form: FORM, savaType: '1' }, { fetchImpl: impl }));
  ok('路径没配 → 提示「尚未接入」', message.includes('尚未接入'));
  ok('路径没配时一个请求都不发', calls.length === 0);

  const missing = await failureOf(() => saveOpenInfo(ENDPOINT, { busUnionId: '', form: FORM, savaType: '1' }, { fetchImpl: impl }));
  ok('没委托单号 → 提示回第 1 步重新生成方案', missing.includes('缺少委托单号') && missing.includes('第 1 步'));
  ok('没委托单号时同样一个请求都不发', calls.length === 0);
  ok(
    '两种情况各有专门的错误类型（调用方可以区分）',
    new OpenInfoNotConfiguredError().message === '申报资料保存接口尚未接入，暂时无法提交' &&
      new OpenInfoMissingRecordError().message.includes('缺少委托单号')
  );
}

{
  const backend = capturingFetch(new Response('资料不完整：缺少法定代表人身份证', { status: 400 }));
  ok(
    '非 2xx 用后端文案',
    (await failureOf(() => saveOpenInfo(ENDPOINT, { busUnionId: 'R', form: FORM, savaType: '1' }, { fetchImpl: backend.impl }))) ===
      '资料不完整：缺少法定代表人身份证'
  );

  const html = capturingFetch(new Response('<html>502 Bad Gateway</html>', { status: 502 }));
  ok(
    '网关 HTML 用兜底文案',
    (await failureOf(() => saveOpenInfo(ENDPOINT, { busUnionId: 'R', form: FORM, savaType: '1' }, { fetchImpl: html.impl }))) ===
      '申报资料保存失败（502）'
  );

  const network = (async () => {
    throw new TypeError('Failed to fetch');
  }) as unknown as typeof fetch;
  ok(
    '网络不通 → 中文提示',
    (await failureOf(() => saveOpenInfo(ENDPOINT, { busUnionId: 'R', form: FORM, savaType: '1' }, { fetchImpl: network }))) ===
      '网络异常，请检查网络后重试'
  );

  const hanging = ((_url: string, init?: RequestInit) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    })) as unknown as typeof fetch;
  ok(
    '超时 → 中文提示',
    (await failureOf(() => saveOpenInfo(ENDPOINT, { busUnionId: 'R', form: FORM, savaType: '1' }, { fetchImpl: hanging, timeoutMs: 5 }))) ===
      '申报资料保存超时，请稍后重试'
  );
}

/* ------------------------------------ 2xx 即成功（响应体不解析，别猜 code） */

{
  await saveOpenInfo(ENDPOINT, { busUnionId: 'R', form: FORM, savaType: '1' }, { fetchImpl: capturingFetch(jsonResponse('{}')).impl });
  ok('2xx + 空 JSON 对象 → 成功', true);

  const plain = capturingFetch(new Response('success', { status: 200 }));
  ok('2xx + 纯文本 → 也算成功（不猜响应形状）', (await failureOf(() => saveOpenInfo(ENDPOINT, { busUnionId: 'R', form: FORM, savaType: '1' }, { fetchImpl: plain.impl }))) === '(没有抛错)');

  const empty = capturingFetch(new Response(null, { status: 204 }));
  ok('204 无内容 → 成功', (await failureOf(() => saveOpenInfo(ENDPOINT, { busUnionId: 'R', form: FORM, savaType: '1' }, { fetchImpl: empty.impl }))) === '(没有抛错)');
}

console.log(`\n${passed} 项通过，${failed} 项失败`);
if (failed > 0) process.exit(1);
