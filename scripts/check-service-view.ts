/**
 * 「服务人员只读查看客户申报资料」的自检：不联网、不碰 React、不开浏览器。
 *   npx tsx scripts/check-service-view.ts
 *
 * 覆盖四件事：
 *   1. **地址栏参数**：`?scbUuid=`（`uuid` 也认）才算查看意图，`code` 可有可无，
 *      空值 / 只有 code / 畸形串都不进查看模式（客户页照常）；
 *   2. **请求地址**：`{host}{path}{uuid}[?code=…]` —— 与 www 站 `static/js/page-display.js`
 *      的 code 版逻辑同一套（host 是 DOC_HOST、path 默认 `/xcx/yqt-co/subscribe/`）；
 *   3. **取值**：从响应的 `openAccApply.var2` 里取出申报表（字符串按 JSON 解、对象直接用），
 *      走与填报页读本地草稿同一份收口（补默认值、丢没有 fileUuid 的老附件）；
 *   4. **失败都有人话**：查询码无效（真机实测 400 + `reasons[]`）/ 网关 HTML / 超时 /
 *      网络不通 / 空体 / 非 JSON / 路径没配 / 没编号，各有各的文案，且后两种一个请求都不发。
 */
import {
  SUBSCRIBE_QUERY_TIMEOUT_MS,
  SubscribeQueryMissingRecordError,
  SubscribeQueryNotConfiguredError,
  fetchSubscribeDetail,
  subscribeQueryUrl,
} from '../src/copreg/registration/subscribeQuery';
import { serviceFormOf, serviceViewQueryOf } from '../src/copreg/serviceView';
import { isSubmittedSnapshot } from '../src/copreg/registration/formSnapshot';
import { createOnceGate, serviceViewGateKey } from '../src/copreg/registration/onceGate';
import {
  SERVICE_SNAPSHOT_LIMIT,
  snapshotFor,
  snapshotsOf,
  withSnapshot,
} from '../src/copreg/registration/snapshotStore';

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

const ENDPOINT = { host: 'https://yqt.ibanbu.com/v1', path: '/xcx/yqt-co/subscribe/' };
const UUID = 'QSVZXH3CdHntAAUpz289ry';

/** 一份「客户已提交」的申报表（形状照真机响应里那份 var2，内容换成假的） */
const FORM = {
  id: 'form-1',
  status: 'submitted',
  savedAt: null,
  submittedAt: '2026/10/8 13:33:12',
  submissionPhone: '15900804441',
  basic: {
    org: '有限责任公司',
    orgOther: '',
    intro: '设立有限责任公司，经营玩具销售',
    service: '在平台采购商品实施分销操作',
    scope: '互联网销售；玩具销售',
    capital: '10',
    expert: true,
    names: ['聚义', '风控控股', '杨建峰'],
    regAddress: '',
    regRecommend: true,
    regFiles: [{ id: 'r1', fileUuid: 'RG1', fileName: '房产证.png', size: 2048, type: 'image/png' }],
    workAddress: '',
    workRecommend: true,
    workFiles: [{ id: 'w1', fileUuid: '', fileName: '旧版本附件.png', size: 1, type: 'image/png' }],
    board: '不设董事会',
    directors: '',
    singleDirector: '由总经理代行职务（不设董事）',
    singleSupervisor: '不设监事',
    unanimous: true,
  },
  people: {
    p1: {
      id: 'p1',
      name: '张三',
      phone: '13800000000',
      email: '',
      education: '大学本科',
      address: '上海市浦东新区',
      files: [
        { id: 'f1', fileUuid: 'F1', fileName: 'sfz-1.png', size: 318017, type: 'image/png', slot: 'idFront' },
      ],
    },
  },
  shareholders: [
    { id: 's1', type: '自然人', personId: 'p1', name: '', code: '', ratio: '100', amount: '10', method: ['货币'], files: [] },
  ],
  roles: [{ id: 'r1', personId: 'p1', roles: ['法定代表人', '财务负责人', '联系人', '总经理'] }],
  setup: { term: '长期' },
  authorization: {
    trusteeName: '李四',
    trusteeIdNumber: '31011519880730802X',
    entrustDate: '2026-10-08',
    files: [{ id: 'a1', fileUuid: 'A1', fileName: 'sfz-4.png', size: 329905, type: 'image/png' }],
  },
  confirm: { exemption: true, beneficiary: '', files: [], accurate: true },
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

/* ------------------------------------------------------------ 地址栏参数 */

{
  const both = serviceViewQueryOf(`?scbUuid=${UUID}&code=7D9209B5AFB54536A54C38750D400881`);
  ok('?scbUuid=…&code=… → 查看意图（uuid 与 code 都取到）',
    both !== null && both.uuid === UUID && both.code === '7D9209B5AFB54536A54C38750D400881');

  const alias = serviceViewQueryOf(`?uuid=${UUID}`);
  ok('page-display.js 那套写法 ?uuid= 也认（两边指向同一个开户单编号）',
    alias !== null && alias.uuid === UUID);
  ok('没带 code 时 code 是空串（照样发请求，由服务端说了算）', alias !== null && alias.code === '');

  const spaced = serviceViewQueryOf('?scbUuid=%20' + UUID + '%20&code=%20C1%20');
  ok('参数两端空白被去掉', spaced !== null && spaced.uuid === UUID && spaced.code === 'C1');

  const preferScb = serviceViewQueryOf(`?uuid=OTHER&scbUuid=${UUID}`);
  ok('两个名字都给时以 scbUuid 为准', preferScb !== null && preferScb.uuid === UUID);

  ok('空 scbUuid → 不是查看意图', serviceViewQueryOf('?scbUuid=') === null);
  ok('只有 code → 不是查看意图（客户页照常）', serviceViewQueryOf('?code=C1') === null);
  ok('没有查询串 → 不是查看意图', serviceViewQueryOf('') === null && serviceViewQueryOf(undefined) === null);
  ok('畸形查询串不抛错（当没传）', serviceViewQueryOf('?%E4%B8') === null);
}

/* -------------------------------------------------------------- 请求地址 */

{
  ok('地址 = host + path + uuid', subscribeQueryUrl(ENDPOINT, { uuid: UUID }) ===
    `https://yqt.ibanbu.com/v1/xcx/yqt-co/subscribe/${UUID}`);
  ok('带查看码时接 ?code=', subscribeQueryUrl(ENDPOINT, { uuid: UUID, code: 'C 1' }) ===
    `https://yqt.ibanbu.com/v1/xcx/yqt-co/subscribe/${UUID}?code=C%201`);
  ok('code 为空串时不带这个参数', !subscribeQueryUrl(ENDPOINT, { uuid: UUID, code: '  ' }).includes('code='));
  ok('host 尾斜杠 / path 无尾斜杠都不会拼出双斜杠或漏斜杠',
    subscribeQueryUrl({ host: 'https://yqt.ibanbu.com/v1/', path: '/xcx/yqt-co/subscribe' }, { uuid: UUID }) ===
      `https://yqt.ibanbu.com/v1/xcx/yqt-co/subscribe/${UUID}`);
  ok('uuid 两端空白被去掉', subscribeQueryUrl(ENDPOINT, { uuid: ` ${UUID} ` }) ===
    `https://yqt.ibanbu.com/v1/xcx/yqt-co/subscribe/${UUID}`);
  ok('普通读接口给 15s（不是大模型的 5 分钟）', SUBSCRIBE_QUERY_TIMEOUT_MS === 15_000);
}

/* ---------------------------------------------------- 从 openAccApply.var2 取值 */

{
  const result = serviceFormOf({ uuid: UUID, busUnionId: 'AWQYmcaF6V8hUbudFEoQMZ', openAccApply: { var2: JSON.stringify(FORM) } });
  ok('openAccApply.var2 是字符串 → 解出申报表', result.ok === true);
  if (result.ok === true) {
    ok('基本信息逐字保留（名称 / 资本 / 经营范围 / 组织形式）',
      result.form.basic.names[0] === '聚义' && result.form.basic.capital === '10' &&
      result.form.basic.scope === '互联网销售；玩具销售' && result.form.basic.org === '有限责任公司');
    ok('股东 / 人员 / 角色 / 委托书 / 确认都在',
      result.form.shareholders.length === 1 && result.form.people.p1.name === '张三' &&
      result.form.roles[0].roles.includes('法定代表人') &&
      result.form.authorization.trusteeName === '李四' && result.form.confirm.accurate === true);
    ok('提交时间与经办手机照原样带出',
      result.form.submittedAt === '2026/10/8 13:33:12' && result.form.submissionPhone === '15900804441');
    ok('一企通方案号（busUnionId）也带出来，方便和后台对单', result.busUnionId === 'AWQYmcaF6V8hUbudFEoQMZ');
    ok('有 fileUuid 的附件留着（注册场地证明 / 身份证 / 委托书）',
      result.form.basic.regFiles.length === 1 && result.form.people.p1.files.length === 1 &&
      result.form.authorization.files.length === 1);
    ok('没有 fileUuid 的老附件（dataURL 时代）丢掉',
      result.form.basic.workFiles.length === 0);
    ok('已提交的快照认得出（草稿则显示「客户尚未确认提交」）', isSubmittedSnapshot(result.form) === true);
  }

  const asObject = serviceFormOf({ openAccApply: { var2: FORM } });
  ok('var2 直接给对象也认（服务端改结构不用改前端）', asObject.ok === true);

  const defaults = serviceFormOf({ openAccApply: { var2: JSON.stringify({ basic: { names: ['甲'] }, people: {} }) } });
  ok('缺后加字段时补默认值（董事 / 监事 / 地址性质），不会 undefined 崩页面',
    defaults.ok === true && defaults.form.basic.singleDirector === '由总经理代行职务（不设董事）' &&
    defaults.form.basic.singleSupervisor === '不设监事' && defaults.form.basic.regAddressNature === '租赁用房');

  const draft = serviceFormOf({ openAccApply: { var2: JSON.stringify({ ...FORM, status: 'draft' }) } });
  ok('草稿也照实显示（status 仍是 draft）', draft.ok === true && isSubmittedSnapshot(draft.form) === false);
}

{
  const reasons = serviceFormOf({ reasons: [{ msg_id: '查询码无效或已过期', field: '', message: '查询码无效或已过期' }] });
  ok('200 里带业务错误信封 → 透出服务端那句人话',
    reasons.ok === false && reasons.message === '查询码无效或已过期');

  const noApply = serviceFormOf({ uuid: UUID });
  ok('没有 openAccApply → 说清是「这条记录里没有开户申请信息」',
    noApply.ok === false && noApply.message.includes('没有开户申请信息'));

  const noVar2 = serviceFormOf({ openAccApply: {} });
  ok('没有 var2 → 「该客户还没有提交申报资料」（不是报错，是还没填）',
    noVar2.ok === false && noVar2.message === '该客户还没有提交申报资料');

  const emptyVar2 = serviceFormOf({ openAccApply: { var2: '   ' } });
  ok('var2 是空白串 → 同上', emptyVar2.ok === false && emptyVar2.message === '该客户还没有提交申报资料');

  const badJson = serviceFormOf({ openAccApply: { var2: '{不是 JSON' } });
  ok('var2 不是 JSON → 单独一句「无法解析」',
    badJson.ok === false && badJson.message.includes('无法解析'));

  const notForm = serviceFormOf({ openAccApply: { var2: JSON.stringify({ foo: 1 }) } });
  ok('var2 解出来不是申报表（缺 basic/people）→ 「无法识别」',
    notForm.ok === false && notForm.message.includes('无法识别'));

  ok('响应不是对象 → 「返回格式异常」', serviceFormOf(null).ok === false && serviceFormOf('x').ok === false);
  ok('响应是数组 → 同样当格式异常', serviceFormOf([]).ok === false);
}

/* ---------------------------------------------------------------- 请求本身 */

{
  const { calls, impl } = capturingFetch(jsonResponse(JSON.stringify({ openAccApply: { var2: JSON.stringify(FORM) } })));
  const payload = await fetchSubscribeDetail(ENDPOINT, { uuid: UUID, code: 'C1' }, { fetchImpl: impl });
  ok('地址 = host + path + uuid + code',
    calls[0].url === `https://yqt.ibanbu.com/v1/xcx/yqt-co/subscribe/${UUID}?code=C1`);
  ok('方法是 GET', calls[0].init?.method === 'GET');
  ok('200 → 原样返回响应体（结构交给 serviceFormOf 判）',
    serviceFormOf(payload).ok === true);
}

{
  const noCode = capturingFetch(jsonResponse('{}'));
  await fetchSubscribeDetail(ENDPOINT, { uuid: UUID }, { fetchImpl: noCode.impl });
  ok('没带 code 就照发（不自己拦，服务端是否放行由它说）',
    noCode.calls[0].url === `https://yqt.ibanbu.com/v1/xcx/yqt-co/subscribe/${UUID}`);
}

/* ------------------------------------------------------------ 各种失败 */

{
  const { calls, impl } = capturingFetch(jsonResponse('{}'));
  const message = await failureOf(() => fetchSubscribeDetail({ ...ENDPOINT, path: '' }, { uuid: UUID }, { fetchImpl: impl }));
  ok('路径没配 → 提示「尚未接入」', message.includes('尚未接入'));
  ok('路径没配时一个请求都不发', calls.length === 0);

  const missing = await failureOf(() => fetchSubscribeDetail(ENDPOINT, { uuid: '  ' }, { fetchImpl: impl }));
  ok('没有开户单编号 → 说清缺 scbUuid', missing.includes('scbUuid') && missing.includes('无法查看'));
  ok('没编号时同样一个请求都不发', calls.length === 0);

  ok('两种情况各有专门的错误类型（调用方可以区分）',
    new SubscribeQueryNotConfiguredError().message.includes('尚未接入') &&
    new SubscribeQueryMissingRecordError().message.includes('缺少开户单编号'));
}

{
  // 真机实测：查询码不对就是 400 + reasons 信封（msg_id 与 message 都是「查询码无效或已过期」）
  const badCode = capturingFetch(
    jsonResponse('{"reasons":[{"msg_id":"查询码无效或已过期","field":"","message":"查询码无效或已过期"}]}', 400)
  );
  ok('查询码无效 → 原样透出服务端那句人话',
    (await failureOf(() => fetchSubscribeDetail(ENDPOINT, { uuid: UUID, code: 'BAD' }, { fetchImpl: badCode.impl }))) ===
      '查询码无效或已过期');

  const serverMessage = capturingFetch(jsonResponse('{"message":"服务开小差了"}', 500));
  ok('500 + JSON 信封 → 取 message',
    (await failureOf(() => fetchSubscribeDetail(ENDPOINT, { uuid: UUID }, { fetchImpl: serverMessage.impl }))) ===
      '服务开小差了');

  const html = capturingFetch(new Response('<html>502 Bad Gateway</html>', { status: 502 }));
  ok('网关 HTML → 兜底文案带状态码',
    (await failureOf(() => fetchSubscribeDetail(ENDPOINT, { uuid: UUID }, { fetchImpl: html.impl }))) ===
      '申报资料查看失败（502）');

  const empty = capturingFetch(new Response(null, { status: 200 }));
  ok('200 但是空体 → 格式异常',
    (await failureOf(() => fetchSubscribeDetail(ENDPOINT, { uuid: UUID }, { fetchImpl: empty.impl }))) ===
      '申报资料查看返回格式异常，请稍后重试');

  const notJson = capturingFetch(new Response('<html>portal</html>', { status: 200 }));
  ok('200 但不是 JSON → 格式异常（不把 HTML 当数据）',
    (await failureOf(() => fetchSubscribeDetail(ENDPOINT, { uuid: UUID }, { fetchImpl: notJson.impl }))) ===
      '申报资料查看返回格式异常，请稍后重试');

  const network = (async () => {
    throw new TypeError('Failed to fetch');
  }) as unknown as typeof fetch;
  ok('网络不通 → 中文提示',
    (await failureOf(() => fetchSubscribeDetail(ENDPOINT, { uuid: UUID }, { fetchImpl: network }))) ===
      '网络异常，请检查网络后重试');

  const hanging = ((_url: string, init?: RequestInit) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    })) as unknown as typeof fetch;
  ok('超时 → 中文提示',
    (await failureOf(() => fetchSubscribeDetail(ENDPOINT, { uuid: UUID }, { fetchImpl: hanging, timeoutMs: 5 }))) ===
      '申报资料查看超时，请稍后重试');
}

/* ------------------------------------------------------ 一次性查询码的单次闸门 */

{
  // 查看码只能用一次：dev 的 StrictMode「挂载 → 清理 → 再挂载」会让 effect 跑两遍，
  // 闸门必须保证第二遍复用第一遍那个 promise，不再真打一次接口。
  const gate = createOnceGate<number>();
  let calls = 0;
  const task = async () => {
    calls += 1;
    return calls;
  };

  const first = await gate.run('K', task);
  const second = await gate.run('K', task);
  ok('同一个 key 只执行一次任务（StrictMode 的第二遍复用同一个 promise）', calls === 1);
  ok('两次拿到的是同一个结果（不是两次数值）', first === second && first === 1);

  await gate.run('OTHER', task);
  ok('换了 key（换了一枚码 / 换了开户单）就重新执行', calls === 2);

  gate.reset('K');
  await gate.run('K', task);
  ok('reset 之后重新执行（「重新读取」按钮靠它）', calls === 3);

  // 在途时并发调用：两个调用方拿到同一个 promise，任务只跑一次
  const inflight = createOnceGate<string>();
  let inflightCalls = 0;
  let release: (value: string) => void = () => {};
  const pending = new Promise<string>((resolve) => {
    release = resolve;
  });
  const slow = () => {
    inflightCalls += 1;
    return pending;
  };
  const a = inflight.run('K2', slow);
  const b = inflight.run('K2', slow);
  release('ok');
  ok('在途时并发调用不重复执行（两个调用方同一条 promise）', (await a) === 'ok' && (await b) === 'ok' && inflightCalls === 1);

  // 失败也记着：同一枚码不会因为失败就自动重打（否则一次网络抖动会把码用掉两次）
  const failing = createOnceGate<string>();
  let failCalls = 0;
  const boom = async () => {
    failCalls += 1;
    throw new Error('炸了');
  };
  await failureOf(() => failing.run('K3', boom));
  await failureOf(() => failing.run('K3', boom));
  ok('失败的 promise 也被记住（同 key 不自动重打）', failCalls === 1);

  ok('闸门 key 把 uuid 与 code 都算进去，且不会因为拼接歧义而串号',
    serviceViewGateKey('A', 'B') === serviceViewGateKey('A', 'B') &&
    serviceViewGateKey('A', 'B') !== serviceViewGateKey('A', 'BC') &&
    serviceViewGateKey('A', 'B') !== serviceViewGateKey('AB', ''));
}

/* ------------------------------------------------- 刷新用的会话内快照（查看码一次有效） */

{
  const KEY_A = serviceViewGateKey('SCB-A', 'CODE-1');
  const KEY_A2 = serviceViewGateKey('SCB-A', 'CODE-2');

  ok('空 / 坏 JSON / 不是数组 → 都当空表（不抛错）',
    snapshotsOf(null).length === 0 &&
      snapshotsOf('').length === 0 &&
      snapshotsOf('{不是 JSON').length === 0 &&
      snapshotsOf('{"key":"x"}').length === 0);

  ok('形状不对的条目被丢掉，好的留着',
    snapshotsOf(JSON.stringify([
      { key: 'K1', fetchedAt: '2026-10-08 13:40:00', payload: { a: 1 } },
      { fetchedAt: '没有 key' },
      null,
    ])).length === 1);

  const written = withSnapshot(null, { key: KEY_A, fetchedAt: '2026-10-08 13:40:00', payload: { openAccApply: { var2: '{}' } } });
  ok('写进去再读出来，payload 原样（结构不在这一层判）',
    snapshotFor(written, KEY_A)?.payload !== undefined &&
      JSON.stringify((snapshotFor(written, KEY_A)?.payload as { openAccApply?: unknown }).openAccApply) === '{"var2":"{}"}');

  ok('★ 换了一枚查看码就不命中（新链接必须重新去读最新内容）', snapshotFor(written, KEY_A2) === null);
  ok('开户单编号不同也不命中', snapshotFor(written, serviceViewGateKey('SCB-B', 'CODE-1')) === null);

  const overwritten = withSnapshot(written, { key: KEY_A, fetchedAt: '2026-10-08 14:00:00', payload: { v: 2 } });
  ok('同一个 key 再写就是覆盖（不会堆两条）',
    snapshotsOf(overwritten).length === 1 && snapshotFor(overwritten, KEY_A)?.fetchedAt === '2026-10-08 14:00:00');

  const two = withSnapshot(written, { key: KEY_A2, fetchedAt: '2026-10-08 14:05:00', payload: { v: 3 } });
  ok('新的一条排在最前（表按时间倒序，方便看上限丢谁）',
    snapshotsOf(two)[0].key === KEY_A2 && snapshotsOf(two)[1].key === KEY_A);

  let many: string | null = null;
  for (let i = 0; i < SERVICE_SNAPSHOT_LIMIT + 3; i += 1) {
    many = withSnapshot(many, { key: `K${i}`, fetchedAt: `t${i}`, payload: i });
  }
  ok(`只留最近 ${SERVICE_SNAPSHOT_LIMIT} 条（超出的丢最旧的）`,
    snapshotsOf(many).length === SERVICE_SNAPSHOT_LIMIT &&
      snapshotsOf(many)[0].key === `K${SERVICE_SNAPSHOT_LIMIT + 2}` &&
      snapshotFor(many, 'K0') === null);

  ok('limit 传 1 也至少留一条（不是把表清空）', snapshotsOf(withSnapshot(many, { key: 'KX', fetchedAt: 't', payload: 1 }, 0)).length === 1);
}

console.log(`\n${passed} 项通过，${failed} 项失败`);
if (failed > 0) process.exit(1);
