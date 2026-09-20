/**
 * 「确认并前往支付」确认接口的纯函数自检：不联网、不碰 React。
 *   npx tsx scripts/check-service-confirm.ts
 *
 * 覆盖四件事：请求体组得对不对（三个顶层字段 formData / proposalResult / phoneNumber、深拷贝），
 * 自选项的派生与存档读回（含旧版 id 字符串数组的迁移），**本地存档与请求体是否同一形状同一批数据**，
 * 以及各种失败都被翻译成能直接展示的中文提示 —— 确认接口失败要拦人，提示说不清用户就只能反复点。
 */
import {
  SERVICE_CONFIRM_TIMEOUT_MS,
  ServiceConfirmMissingProposalError,
  ServiceConfirmNotConfiguredError,
  confirmServicePlan,
  serviceConfirmRequestOf,
  type ServiceConfirmEndpoint,
  type ServiceConfirmInput,
  type ServiceConfirmRequest,
} from '../src/copreg/serviceConfirm';
import { buildPlan } from '../src/copreg/plan';
import { addonsOf, normalizeAddons, quoteFor } from '../src/copreg/components/proposalQuote';
import type { PlanSuggestion } from '../src/copreg/planGenerate';
// 只为编译期断言而引（`import type` 在 tsx 下会被抹掉，不会真的去加载 planDraft）
import type { PlanForm } from '../src/copreg/planDraft';
import type { ServiceTierType, SurveyData } from '../src/copreg/types';

/** 编译期断言用的类型相等判断：两边不完全一致时这个 ok(...) 会直接编译不过 */
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const FORM_SHAPE_MATCHES_ARCHIVE: Exact<ServiceConfirmRequest['formData'], PlanForm> = true;

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

const survey = (): SurveyData => ({
  coreNeeds: ['需公司主体'],
  companyDesc: '字号甲乙丙，主营软件开发',
  bizDesc: '面向企业客户，线上交付',
  scope: ['软件开发', '技术服务'],
  license: ['增值电信业务经营许可证'],
  sensitive: ['数据安全'],
  invoiceReq: '增值税专用发票',
  monthlyAmount: '10 - 50 万',
  revenue: ['服务费'],
  revenueOther: '',
  shareholderType: ['自然人'],
  shareholderCount: '2 个',
  capitalRec: '否',
  capitalAmount: '100',
  regAddress: '是（需推荐）',
  officeSpace: '否',
});

const report = (): PlanSuggestion => ({
  companyNameProposal: '甲乙丙科技有限公司',
  companyType: '有限责任公司（2 名自然人股东）',
  taxpayerIdentity: '小规模纳税人',
  taxReason: '年开票额预计在 500 万以内',
  capitalAmount: '建议 100 万元人民币（认缴）',
  capitalAdvice: '五年内实缴到位',
  registeredAddressAdvice: '可用园区集群注册地址',
  preQualifications: ['增值电信业务经营许可证'],
  postQualifications: [],
  riskTips: ['及时完成税务报道'],
});

/** 方案页那份方案：套餐与加购走真实报价，服务清单才有真实形状 */
const planOf = (tier: ServiceTierType, addons: string[] = []) => buildPlan(survey(), quoteFor(tier, addons));

const input = (overrides: Partial<ServiceConfirmInput> = {}): ServiceConfirmInput => ({
  survey: survey(),
  plan: planOf('bundle_small'),
  report: report(),
  mobile: '13800000000',
  smsCodeId: 'sms-123',
  smsValidCode: '654321',
  ...overrides,
});

/** 真实端点：与另外两个方案接口同属企业方案服务，默认 host 取自 config/api.ts 的 COMPANY_PLAN_HOST */
const ENDPOINT: ServiceConfirmEndpoint = {
  host: 'https://caa001.ibanbu.com',
  path: '/api/company-plan/confirm-proposal',
};

/* -------------------------------------------------------------- 请求体拼装 */

{
  const request = serviceConfirmRequestOf(input());

  ok('顶层恰好三个字段', Object.keys(request).sort().join(',') === 'formData,phoneNumber,proposalResult');
  ok('formData 就是存档那三样（services 已去掉）', Object.keys(request.formData).sort().join(',') === 'addons,survey,tier');
  ok('formData.tier 原样带出', request.formData.tier === 'bundle_small');
  ok('formData.survey 十六个字段一个不少', Object.keys(request.formData.survey).length === 16);
  ok('formData.survey 的值原样带出', request.formData.survey.companyDesc === '字号甲乙丙，主营软件开发');
  ok('proposalResult 十项原样带出', request.proposalResult?.companyNameProposal === '甲乙丙科技有限公司');
  ok('phoneNumber 三样齐全', Object.keys(request.phoneNumber).sort().join(',') === 'mobile,smsCodeId,smsValidCode');
  ok('phoneNumber.mobile 用 trim 后的号码', request.phoneNumber.mobile === '13800000000');
  ok('phoneNumber.smsValidCode 是用户填的那串', request.phoneNumber.smsValidCode === '654321');
}

/* -------------------------------------------------------- 自选增值服务 */

{
  // 企业注册服务档才有自选增值服务：addons 是对象数组，描述勾中的那几项
  const request = serviceConfirmRequestOf(input({ plan: planOf('standard', ['addon-bank', 'addon-tax']) }));
  const { addons } = request.formData;

  ok('addons 是数组且有两项', Array.isArray(addons) && addons.length === 2);
  ok('每一项只有 id / name / price 三个字段', addons.every((a) => Object.keys(a).sort().join(',') === 'id,name,price'));
  ok('是对象数组（与本地存档同一形状，不再是字符串数组）', typeof addons[0] === 'object' && typeof addons[0] !== 'string');
  ok('第一项是银行开户，带名称与实收价', addons[0].id === 'addon-bank' && addons[0].name === '银行对公账户开通' && addons[0].price === 200);
  ok('第二项是税局开户，带名称与实收价', addons[1].id === 'addon-tax' && addons[1].name === '电子税务局开户' && addons[1].price === 300);
  ok('顺序与页面报价明细一致（银行 → 税局 → 社保）', addons.map((a) => a.id).join(',') === 'addon-bank,addon-tax');
  ok('不带 desc / originalPrice / tag（只带出单要用的三样）', !('desc' in addons[0]) && !('originalPrice' in addons[0]) && !('tag' in addons[0]));
  ok(
    '价格与报价明细里的同一个数',
    addons[0].price === quoteFor('standard', ['addon-bank', 'addon-tax']).items.find((item) => item.id === 'addon-bank')?.price
  );
}

/* -------------------------------------------- 自选项派生（存档与请求共用一个函数） */

{
  const standard = quoteFor('standard', ['addon-bank', 'addon-tax']);
  const derived = addonsOf(standard.items);

  ok('从报价明细派生出勾中的那两项', JSON.stringify(derived) === JSON.stringify([
    { id: 'addon-bank', name: '银行对公账户开通', price: 200 },
    { id: 'addon-tax', name: '电子税务局开户', price: 300 },
  ]));
  ok('派生结果就是 { id, name, price } 三样', derived.every((a) => Object.keys(a).sort().join(',') === 'id,name,price'));
  ok('bundle 档没有自选项可派生', addonsOf(quoteFor('bundle_small').items).length === 0);
  ok('单项加购也只派生一项', addonsOf(quoteFor('standard', ['addon-social']).items).map((a) => a.id).join(',') === 'addon-social');
}

/* ------------------------------------- 存档读回（含旧版 id 字符串数组的迁移） */

{
  const now = addonsOf(quoteFor('standard', ['addon-bank', 'addon-social']).items);

  ok('新存档写进去再读回来一字不差', JSON.stringify(normalizeAddons(JSON.parse(JSON.stringify(now)))) === JSON.stringify(now));

  const legacy = normalizeAddons(['addon-bank', 'addon-social']);
  ok('旧存档的 id 字符串数组能读回来', JSON.stringify(legacy) === JSON.stringify(now));
  ok('旧存档会补上名称与价格', legacy[0].name === '银行对公账户开通' && legacy[0].price === 200);
  ok(
    '对象缺名称/价格时回落到目录值',
    JSON.stringify(normalizeAddons([{ id: 'addon-tax' }])) ===
      JSON.stringify([{ id: 'addon-tax', name: '电子税务局开户', price: 300 }])
  );
  ok('存档里自带的名称与价格优先', normalizeAddons([{ id: 'addon-tax', name: '自定义名', price: 1 }])[0].name === '自定义名');
  ok('认不出的 id 丢掉', normalizeAddons(['addon-unknown', { id: 'item-bnd-gov' }]).length === 0);
  ok('重复 id 只留第一个', normalizeAddons(['addon-bank', { id: 'addon-bank' }]).length === 1);
  ok(
    '乱七八糟的存档收成空数组',
    [undefined, null, 'addon-bank', 42, {}, []].every((value) => normalizeAddons(value).length === 0)
  );
}

/* -------------------------------------------------- 存档与请求同源同形 */

{
  const plan = planOf('standard', ['addon-bank', 'addon-tax']);
  const request = serviceConfirmRequestOf(input({ plan }));
  const archived = addonsOf(plan.items); // App 存 1b_copreg_plan_form 时调的是同一个函数

  ok('请求体的 formData 与本地存档形状一致（编译期断言）', FORM_SHAPE_MATCHES_ARCHIVE);
  ok('请求里的 addons 与存进本地的那份逐字相同', JSON.stringify(request.formData.addons) === JSON.stringify(archived));
  ok('存档往返一趟仍与请求里的完全一致', JSON.stringify(normalizeAddons(archived)) === JSON.stringify(request.formData.addons));
  ok(
    'formData 就是存档那三个字段',
    Object.keys(request.formData).sort().join(',') === Object.keys({ survey: 1, tier: 1, addons: [] }).sort().join(',')
  );

  // App 打开存档时走的路：对象 → 取 id 重算报价 → 再派生回对象，必须回到同一份
  const rebuilt = buildPlan(survey(), quoteFor('standard', archived.map((addon) => addon.id)));
  ok('存档 → 取 id 重算报价 → 再派生，回到同一份对象', JSON.stringify(addonsOf(rebuilt.items)) === JSON.stringify(archived));
}

{
  const request = serviceConfirmRequestOf(input({ plan: planOf('standard', ['addon-social']) }));
  const only = request.formData.addons;

  ok('只勾一项就只有一项', only.length === 1 && only[0].id === 'addon-social');
  ok('社保开户的名称与价格正确', only[0].name === '办理社保公积金开户' && only[0].price === 200);
}

{
  // 套餐内含的服务项不上报：服务端按 tier 自己映射，前端只报勾中的自选项
  const request = serviceConfirmRequestOf(input());
  ok('套餐内含项没有混进 addons', request.formData.addons.every((a) => a.id.startsWith('addon-')));
}

{
  // 两档「全年无忧」的自选项是内置在套餐里的，页面不给勾选框，所以 addons 该是空数组
  const small = serviceConfirmRequestOf(input({ plan: planOf('bundle_small') }));
  const general = serviceConfirmRequestOf(input({ plan: planOf('bundle_general') }));

  ok('bundle 档的 addons 是空数组（自选项已内置在套餐里）', small.formData.addons.length === 0 && general.formData.addons.length === 0);
  ok('空加购项是 [] 而不是缺字段', JSON.stringify(small.formData.addons) === '[]');
  ok('bundle 两档的 tier 仍然如实带上', small.formData.tier === 'bundle_small' && general.formData.tier === 'bundle_general');
}

/* ---------------------------------------------------------------- 深拷贝 */

{
  // 交出去的必须是副本：调用方之后改 state 不该改到已经在途的载荷
  const live = input({ plan: planOf('standard', ['addon-bank', 'addon-tax']) });
  const request = serviceConfirmRequestOf(live);
  live.survey.coreNeeds.push('需开票');
  live.survey.companyDesc = '改过了';
  live.plan.selectedAddons?.push('addon-social');
  live.plan.items[3].name = '改过了';
  live.plan.items[3].price = 99999;
  live.report?.riskTips.push('工商年报别忘');
  live.report?.preQualifications?.push('食品经营许可证');

  ok('survey 的数组字段是副本', request.formData.survey.coreNeeds.length === 1);
  ok('survey 的字符串字段不受影响', request.formData.survey.companyDesc === '字号甲乙丙，主营软件开发');
  ok('proposalResult 的数组字段是副本', request.proposalResult?.riskTips.length === 1);
  ok('proposalResult 的空数组字段仍是空数组（明确「没有」，不是没给）', JSON.stringify(request.proposalResult?.postQualifications) === '[]');
  ok('proposalResult 的许可清单是副本', request.proposalResult?.preQualifications?.length === 1);
  ok('addons 里附带的名称与价格是副本（改报价明细不影响载荷）', request.formData.addons[0].name === '银行对公账户开通' && request.formData.addons[0].price === 200);
  ok('addons 数量不受调用方后续改 selectedAddons 影响', request.formData.addons.length === 2);
  ok('addons 里没有多出第三项', request.formData.addons.map((a) => a.id).join(',') === 'addon-bank,addon-tax');
}

{
  // 后端 proposalResult 是 @NotNull，而第 1 步「诊断失败不拦人前进」是既有行为，
  // 所以「人在方案页、手上没有诊断结果」是真实可达的状态：就地拦住，别送 null 换回 400
  let error: unknown = null;
  try {
    serviceConfirmRequestOf(input({ report: null }));
  } catch (cause) {
    error = cause;
  }

  ok('诊断结果缺失时组请求体就抛错', error instanceof ServiceConfirmMissingProposalError);
  ok('提示告诉用户回第 1 步重新生成', String((error as Error).message).includes('返回第 1 步'));
  ok('这与「接口未接入」是两回事，不能混用提示', !(error instanceof ServiceConfirmNotConfiguredError));
}

{
  const request: ServiceConfirmRequest = serviceConfirmRequestOf(input({ plan: planOf('standard', ['addon-bank']) }));
  const wire = JSON.parse(JSON.stringify(request)) as Record<string, unknown>;
  const wireForm = wire.formData as Record<string, unknown>;
  ok('可整体 JSON 序列化（数组与 null 都不会漏字段）', Object.keys(wire).length === 3);
  ok('序列化后 formData 仍是三个字段', Object.keys(wireForm).sort().join(',') === 'addons,survey,tier');
  ok('序列化后 addons 变成对象数组', JSON.stringify(wireForm.addons) === '[{"id":"addon-bank","name":"银行对公账户开通","price":200}]');
  ok('空加购项是空数组而不是缺字段', JSON.stringify(serviceConfirmRequestOf(input({ plan: planOf('standard') })).formData.addons) === '[]');
}

/* ------------------------------------------------------------------ 端点 */

const jsonResponse = (body: unknown, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }) as unknown as Response;

const textResponse = (text: string, status: number) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => JSON.parse(text),
    text: async () => text,
  }) as unknown as Response;

const htmlResponse = (status: number) =>
  ({
    ok: false,
    status,
    json: async () => {
      throw new Error('not json');
    },
    text: async () => '<html><body>502 Bad Gateway</body></html>',
  }) as unknown as Response;

const realFetch = globalThis.fetch;

{
  let called = 0;
  globalThis.fetch = (async () => {
    called += 1;
    return jsonResponse({});
  }) as typeof fetch;

  let error: unknown = null;
  try {
    await confirmServicePlan({ host: 'https://api.example.com/v1', path: '' }, serviceConfirmRequestOf(input()));
  } catch (cause) {
    error = cause;
  }

  ok('路径留空抛未配置错误', error instanceof ServiceConfirmNotConfiguredError);
  ok('未配置时提示说的是「尚未接入」而不是网络异常', String((error as Error).message).includes('尚未接入'));
  ok('未配置时一个请求都不发', called === 0);

  globalThis.fetch = realFetch;
}

{
  let url = '';
  let init: RequestInit | null = null;
  globalThis.fetch = (async (target: string, options: RequestInit) => {
    url = String(target);
    init = options;
    return jsonResponse({ delegateNo: 'WT-1' });
  }) as unknown as typeof fetch;

  const payload = await confirmServicePlan(
    ENDPOINT,
    serviceConfirmRequestOf(input({ plan: planOf('standard', ['addon-bank', 'addon-tax']) }))
  );
  const body = JSON.parse(String(init?.body)) as Record<string, unknown>;

  ok('地址由 host + path 拼成', url === 'https://caa001.ibanbu.com/api/company-plan/confirm-proposal');
  ok('方法是 POST', init?.method === 'POST');
  ok('带 JSON 请求头', (init?.headers as Record<string, string>)['Content-Type'] === 'application/json');
  ok('请求体恰好三个字段', Object.keys(body).sort().join(',') === 'formData,phoneNumber,proposalResult');
  ok(
    '请求体里的手机号三件套进了 phoneNumber',
    JSON.stringify(body.phoneNumber) === JSON.stringify({ mobile: '13800000000', smsCodeId: 'sms-123', smsValidCode: '654321' })
  );
  ok('请求体里的 formData 带着套餐', ((body.formData as Record<string, unknown>).tier as string) === 'standard');
  ok(
    '请求体里的 addons 是对象数组（线上真发得出去，带名称与价格）',
    JSON.stringify((body.formData as Record<string, unknown>).addons) ===
      '[{"id":"addon-bank","name":"银行对公账户开通","price":200},{"id":"addon-tax","name":"电子税务局开户","price":300}]'
  );
  ok('请求体里的 formData 没有多余字段（services 已去掉）', Object.keys(body.formData as Record<string, unknown>).sort().join(',') === 'addons,survey,tier');
  ok('请求体里的 proposalResult 是诊断结果', (body.proposalResult as Record<string, unknown>).taxpayerIdentity === '小规模纳税人');
  ok('响应体原样交回调用方', (payload as { delegateNo?: string }).delegateNo === 'WT-1');

  // 两边都有斜杠也只留一个，别拼出 //api
  globalThis.fetch = (async (target: string) => {
    url = String(target);
    return jsonResponse({});
  }) as unknown as typeof fetch;
  await confirmServicePlan({ host: 'https://caa001.ibanbu.com/', path: 'api/company-plan/confirm-proposal' }, serviceConfirmRequestOf(input()));
  ok('host 尾斜杠 + path 无前导斜杠也拼得对', url === 'https://caa001.ibanbu.com/api/company-plan/confirm-proposal');

  // 诊断结果缺失时连请求都不许发（后端 proposalResult 是 @NotNull）
  let missingCalled = 0;
  globalThis.fetch = (async () => {
    missingCalled += 1;
    return jsonResponse({});
  }) as unknown as typeof fetch;
  let missingError: unknown = null;
  try {
    await confirmServicePlan(ENDPOINT, serviceConfirmRequestOf(input({ report: null })));
  } catch (cause) {
    missingError = cause;
  }
  ok('诊断结果缺失时一个请求都不发', missingCalled === 0);
  ok('诊断结果缺失时给的是「回去重新生成」而不是后端 400', missingError instanceof ServiceConfirmMissingProposalError);

  globalThis.fetch = realFetch;
}

/* ------------------------------------------------------------ 失败文案 */

const failureOf = async (fetchImpl: typeof fetch, timeoutMs?: number): Promise<string> => {
  globalThis.fetch = fetchImpl;
  try {
    await confirmServicePlan(ENDPOINT, serviceConfirmRequestOf(input()), timeoutMs === undefined ? {} : { timeoutMs });
    return '';
  } catch (cause) {
    return cause instanceof Error ? cause.message : String(cause);
  } finally {
    globalThis.fetch = realFetch;
  }
};

{
  const backendText = await failureOf((async () => textResponse('手机号验证码不正确', 400)) as unknown as typeof fetch);
  ok('非 2xx 用后端文案', backendText === '手机号验证码不正确');

  const gatewayHtml = await failureOf((async () => htmlResponse(502)) as unknown as typeof fetch);
  ok('网关 HTML 不塞进提示，用兜底文案', gatewayHtml === '确认方案失败（502）');

  const hanging = (async (_url: string, options: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      options.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    })) as unknown as typeof fetch;
  const timeout = await failureOf(hanging, 20);
  ok('超时提示可重试', timeout === '确认方案超时，请稍后重试');
  ok('超时阈值是 15s 而不是大模型接口的 60s', SERVICE_CONFIRM_TIMEOUT_MS === 15_000);

  const offline = (async () => {
    throw new TypeError('fetch failed');
  }) as unknown as typeof fetch;
  ok('网络不通走网络文案', (await failureOf(offline)) === '网络异常，请检查网络后重试');

  const brokenJson = (async () =>
    ({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('invalid json');
      },
      text: async () => 'not json',
    }) as unknown as Response) as unknown as typeof fetch;
  ok('不是 JSON 走格式异常文案', (await failureOf(brokenJson)) === '确认方案返回格式异常，请稍后重试');

  const arrayJson = (async () => jsonResponse([1, 2, 3])) as unknown as typeof fetch;
  ok('响应是数组也按格式异常处理', (await failureOf(arrayJson)) === '确认方案返回格式异常，请稍后重试');

  const emptyJson = (async () => jsonResponse(null)) as unknown as typeof fetch;
  ok('响应是 null 也按格式异常处理', (await failureOf(emptyJson)) === '确认方案返回格式异常，请稍后重试');

  const okJson = (async () => jsonResponse({ code: '0' })) as unknown as typeof fetch;
  ok('{} 这种合法对象算成功（后端只回一个 code 也是成功）', (await failureOf(okJson)) === '');
}

console.log(`\n${passed} 项通过，${failed} 项失败`);
if (failed > 0) process.exit(1);
