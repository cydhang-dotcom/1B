/**
 * copreg 首屏落点自检：把**真实的 App 组件树**在 Node 里渲染一次，只换 localStorage 里的
 * 三份存档，看首屏落在第几步（第 1 步问卷 / 第 2 步方案 / 第 3 步协议与支付）。
 *
 * 这个自检不能像其他 check-*.ts 那样用 tsx 跑：App 依赖 import.meta.env（只有 Vite 提供），
 * 还带 JSX，所以先过一遍 Vite 的 SSR 构建再执行：
 *   npm run check:entry
 * （等价于 vite build --ssr scripts/check-copreg-entry.tsx --outDir node_modules/.cache/copreg-entry
 *   && node node_modules/.cache/copreg-entry/check-copreg-entry.js）
 *
 * 覆盖的就是「存档 → 首屏落点」这条链：有委托单号就直落第 3 步、有诊断结果才到第 2 步、
 * 只有问卷或什么都没存就第 1 步。不联网、不开浏览器。
 */
import { renderToString } from 'react-dom/server';
import App from '../src/copreg/App';
import { ProposalStep } from '../src/copreg/components/ProposalStep';
import { RegistrationDetailsStep } from '../src/copreg/components/RegistrationDetailsStep';
import { ServiceRecordView, ServiceRecordContent } from '../src/copreg/components/ServiceRecordView';
import { ReviewSection } from '../src/copreg/registration/ReviewSection';
import {
  ProgressAndReviewStep,
  INITIAL_TIMELINE_NODES,
} from '../src/copreg/components/ProgressAndReviewStep';
import { buildPlan } from '../src/copreg/plan';
import { quoteFor } from '../src/copreg/components/proposalQuote';
import {
  ACTIVE_APP_KEY,
  APPLICATIONS_KEY,
  createApplication,
  ensureApplicationsState,
  type ApplicationRecord,
} from '../src/copreg/applications';
import { progressRouteOf } from '../src/copreg/stepRoute';
import { createBlankForm } from '../src/copreg/registration/defaultData';
import {
  regAddressPlaceholder,
  workAddressPlaceholder,
} from '../src/copreg/registration/addressNatureHints';

const store = new Map<string, string>();
/** 假的地址栏：hash 由每个场景自己给，history.replaceState 只记下最后一次规范化的结果 */
const fakeWindow = {
  localStorage: {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  },
  location: { hash: '', search: '' },
  history: {
    replaceState: (_state: unknown, _title: string, url: string) => {
      // 地址栏被规范化的结果：`{pathname}?query#hash`，这里只关心 query 与 hash
      const [beforeHash, hash = ''] = url.split('#');
      const queryAt = beforeHash.indexOf('?');
      fakeWindow.location.search = queryAt === -1 ? '' : beforeHash.slice(queryAt);
      fakeWindow.location.hash = hash === '' ? '' : `#${hash}`;
    },
  },
  scrollTo: () => {},
  print: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
};

/** 固定时钟：主体 id 由它派生，测试里要能自己拼出 per-app 键 */
const NOW = Date.parse('2026-09-24T02:00:00.000Z');

/** 单主体时代的旧键：这里只用来**证明它们已经没人读**（不再有迁移） */
const FORM_KEY = '1b_copreg_plan_form';
const REPORT_KEY = '1b_copreg_plan_report';
const RECORD_KEY = '1b_copreg_plan_record';


const survey = {
  coreNeeds: ['需公司主体'], companyDesc: '甲乙丙科技', bizDesc: '软件开发',
  scope: ['软件开发'], license: [], sensitive: [], invoiceReq: '不确定',
  monthlyAmount: '< 10 万', revenue: ['服务费'], revenueOther: '',
  shareholderType: ['自然人'], shareholderCount: '1 个', capitalRec: '是',
  capitalAmount: '', regAddress: '是（需推荐）', officeSpace: '否',
};
/** 第 1 步接口返回的诊断结果：**有它才算「有方案」**，刷新才会落在第 2 步 */
const report = {
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
};
const form = { survey, tier: 'standard', addons: [{ id: 'addon-bank', name: '银行对公账户开通', price: 200 }] };
/** 委托单凭据：第 1 步诊断接口同一次响应里给的 recordId（服务端生成方案时建的单） */
const record = { recordId: 'VHpX5NqoXLHwPyMnVeBzCN' };

/**
 * 服务人员查看页渲染用的申报表：形状照真机响应 `openAccApply.var2` 里那份（内容换成假的）。
 * 客户页的 `#fill-details` 确认提交章读的就是这些字段，查看页要一字不差地把它显示出来。
 */
const STAFF_FORM = {
  id: 'form-staff-1',
  status: 'submitted' as const,
  savedAt: '2026/10/8 13:20:00',
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
    names: ['聚义', '风控控股', ''],
    regAddress: '',
    regRecommend: true,
    regAddressNature: '租赁用房',
    regFiles: [{ id: 'r1', fileUuid: 'RG1', fileName: '房产证.png', size: 2048, type: 'image/png' }],
    workAddress: '',
    workRecommend: true,
    workAddressNature: '商业租赁',
    workFiles: [],
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
      files: [{ id: 'f1', fileUuid: 'F1', fileName: 'sfz-1.png', size: 318017, type: 'image/png', slot: 'idFront' }],
    },
  },
  shareholders: [
    { id: 's1', type: '自然人' as const, personId: 'p1', name: '', code: '', ratio: '100', amount: '10', method: ['货币'], files: [] },
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

/** 每个场景开始前清空所有存档，避免上一个场景的状态串味（多主体后键更多，直接全清） */
const clearStorage = () => {
  store.clear();
};

/**
 * 一次首屏渲染。**按多主体的 per-app 存档形状预置**（没有迁移了）：
 * 先按本次给出的证据（问卷 / 诊断结果 / 单号 / 已提交）用 `progressRouteOf` 算出落点，
 * 写成一份完整的主体列表 + 该主体的三份存档 —— 这正是浏览器里 App bootstrap 会写的东西，
 * 所以断言「落在第几步」验证的是**光凭存档能不能渲染出对的那一步**。
 *
 * `appsOverride` 用来测「存档里本来就有多个主体」这类场景（直接给整份列表，跳过上面的派生）。
 */
const render = (
  keys: Record<string, unknown>,
  hash = '',
  options: { submitted?: boolean; appsOverride?: Record<string, unknown>; search?: string } = {}
) => {
  clearStorage();
  const appId = 'app-entry-check-1';
  // 传进来的仍是**旧全局键名**（FORM_KEY / REPORT_KEY / RECORD_KEY）：它们在这里只当「这次带哪些
  // 证据」的记号用，真正落盘的是该主体的 per-app 键。旧键本身已经没人读了（下面有一条专门断言）。
  const form = keys[FORM_KEY] as { survey?: unknown; tier?: string; addons?: unknown } | undefined;
  const report = keys[REPORT_KEY];
  const record = keys[RECORD_KEY];
  const recordId = (record as { recordId?: string } | undefined)?.recordId?.trim() ?? '';

  const route = progressRouteOf({
    hasPlanReport: report !== undefined,
    // 单号是「生成方案」那次请求里服务端给的：没有方案就没有那张单（只有单号存档不算证据）
    hasRecord: report !== undefined && recordId !== '',
    // 已支付只有查单才知道，SSR 首屏一定还没有结论（本地那份 order.status 不再作为依据）
    orderPaid: false,
    detailsSubmitted: options.submitted === true,
  });

  const app = {
    ...createApplication(NOW, 0, '甲乙丙科技有限公司'),
    id: appId,
    currentStep: route.landing,
    unlockedSteps: route.unlocked,
    isDetailsSubmitted: options.submitted === true,
  };
  const appsState = options.appsOverride ?? { applications: [app], activeAppId: appId };

  store.set(APPLICATIONS_KEY, JSON.stringify(appsState));
  store.set(ACTIVE_APP_KEY, JSON.stringify((appsState as { activeAppId?: string }).activeAppId ?? appId));
  if (form !== undefined) store.set(`1b_copreg_app:${appId}:plan_form`, JSON.stringify(form));
  if (report !== undefined) store.set(`1b_copreg_app:${appId}:plan_report`, JSON.stringify(report));
  if (record !== undefined) store.set(`1b_copreg_app:${appId}:plan_record`, JSON.stringify(record));
  if (options.submitted === true) {
    store.set(`banbu-registration-${appId}`, JSON.stringify({ status: 'submitted', submittedAt: '2026-09-22 11:00:00' }));
  }
  fakeWindow.location.hash = hash;
  fakeWindow.location.search = options.search ?? '';
  (globalThis as any).window = fakeWindow;
  // 组件里有直接读裸全局 localStorage 的地方（浏览器里恒存在），SSR 里补上同一个桩
  (globalThis as any).localStorage = fakeWindow.localStorage;
  const html = renderToString(<App />);
  return {
    html,
    hash: fakeWindow.location.hash,
    /** 规范化之后的查询串（深链参数应当被抹掉） */
    search: fakeWindow.location.search,
    // 用各步骤独有的 DOM id 判定，比文字匹配稳
    step1: html.includes('id="sec-core"'),
    step2: html.includes('id="btn-confirm-proposal-proceed"'),
    step3: html.includes('id="btn-click-pay"'),
    // 第 3 步的另一个界面：支付成功（与「待支付」二选一）
    paidView: html.includes('支付成功 · 委托代办已生效'),
    step4: html.includes('专属服务群') || html.includes('id="group-chat"'),
    recordShown: html.includes('VHpX5NqoXLHwPyMnVeBzCN'),
  };
};

let pass = 0;
let fail = 0;
const check = (label: string, ok: boolean, detail = '') => {
  if (ok) { pass += 1; console.log(`✓ ${label}`); }
  else { fail += 1; console.error(`✗ ${label} ${detail}`); }
};

const withRecord = render({ [FORM_KEY]: form, [REPORT_KEY]: report, [RECORD_KEY]: record });
check('有委托单号 → 首屏第 3 步（协议确认与支付）', withRecord.step3 && !withRecord.step2, JSON.stringify(withRecord));

// 支付方式：支付宝还没接入，第 3 步只应列出微信支付
check(
  '第 3 步的支付方式只列微信（支付宝选项已隐藏）',
  withRecord.step3 && !withRecord.html.includes('支付宝') && withRecord.html.includes('微信支付'),
  `step3=${withRecord.step3} 含支付宝=${withRecord.html.includes('支付宝')}`
);

// 顾问是谁要由服务端 / 扫码后才知道，页面上不许再写死姓名或头衔
check(
  '第 3 步不出现写死的顾问称呼',
  !withRecord.html.includes('李经理') && !withRecord.html.includes('资深设立顾问'),
  `李经理=${withRecord.html.includes('李经理')}`
);

// 用户报的 bug：只有问卷存档（没有诊断结果）时刷新被送进第 2 步
const withoutConfirm = render({ [FORM_KEY]: form });
check(
  '只有问卷存档、没有诊断结果 → 首屏第 1 步（不跳方案页）',
  withoutConfirm.step1 && !withoutConfirm.step2 && !withoutConfirm.step3,
  JSON.stringify({ step1: withoutConfirm.step1, step2: withoutConfirm.step2 })
);

const withReport = render({ [FORM_KEY]: form, [REPORT_KEY]: report });
check('问卷 + 诊断结果 → 首屏第 2 步', withReport.step2 && !withReport.step3, JSON.stringify({ step2: withReport.step2 }));

// 第 2 步不再有「确认」这一步：单号是第 1 步建单时给的，改套餐 / 换自选项都不该把它作废
// （改的只是前端报价，服务端按单号复核价格）
const recordWithOtherTier = render({
  [FORM_KEY]: { ...form, tier: 'bundle_general', addons: [] },
  [REPORT_KEY]: report,
  [RECORD_KEY]: record,
});
check('换了套餐档位 → 单号照样有效，仍直落第 3 步', recordWithOtherTier.step3, JSON.stringify(recordWithOtherTier));

const noForm = render({ [RECORD_KEY]: record });
check('只有单号没有问卷 → 回到第 1 步', noForm.step1 && !noForm.step3, JSON.stringify(noForm));

// 坏的单号不认（当作没生成过方案）
const badRecord = render({ [FORM_KEY]: form, [REPORT_KEY]: report, [RECORD_KEY]: { recordId: '   ' } });
check('单号是空白串 → 不认，退回第 2 步', badRecord.step2 && !badRecord.step3, JSON.stringify(badRecord));

const empty = render({});
check('什么都没存 → 第 1 步', empty.step1 && !empty.step2 && !empty.step3, JSON.stringify(empty));



const legacyAddons = render({ [FORM_KEY]: { ...form, addons: ['addon-bank'] }, [REPORT_KEY]: report, [RECORD_KEY]: record });
check('旧存档（addons 是字符串数组）+ 单号 → 仍落在第 3 步', legacyAddons.step3, JSON.stringify(legacyAddons));

// 手写的单号（只有 recordId 一个字段）照样认
const bareRecord = render({ [FORM_KEY]: form, [REPORT_KEY]: report, [RECORD_KEY]: { recordId: 'VHpX5NqoXLHwPyMnVeBzCN' } });
check('只有 recordId 的单号 → 同样落到第 3 步', bareRecord.step3, JSON.stringify(bareRecord));

/* ------------------------------------------------ 首屏忽略 URL hash：只看本地证据 */

// SSR 只渲染一次、不跑 effect，所以这里验的正是「首屏落在哪一步」（用户真正看到的结果）。
// **刷新时地址栏的 hash 一律不看**：收藏/转发的链接（乃至 `#paid`）会过期、也会在别人手里，
// 落点只由本地进度证据决定；地址栏随后被改写成真实步骤（那是 effect 行为，SSR 看不到，
// 由真机验证覆盖）。会话内的 hash 导航（手敲、前进/后退）仍按「已解锁才认」收口，
// 规则在 scripts/check-step-route.ts 的 resolveStep。
const hashProposalNoReport = render({ [FORM_KEY]: form }, '#proposal');
check(
  '#proposal 但只有问卷存档 → 忽略 hash，落第 1 步',
  hashProposalNoReport.step1 && !hashProposalNoReport.step2,
  `step1=${hashProposalNoReport.step1} step2=${hashProposalNoReport.step2}`
);

// 已解锁的 hash 也一样不看：手上只有「问卷 + 诊断结果」时，带 #proposal 与不带都必须落第 2 步
const hashProposal = render({ [FORM_KEY]: form, [REPORT_KEY]: report }, '#proposal');
check('有诊断结果 → 第 2 步（带不带 #proposal 一样）', hashProposal.step2, `step2=${hashProposal.step2}`);

const hashPayment = render({ [FORM_KEY]: form, [REPORT_KEY]: report, [RECORD_KEY]: record }, '#payment');
check('有委托单号 → 第 3 步（带不带 #payment 一样）', hashPayment.step3, `step3=${hashPayment.step3}`);

// 第 3 步必须拿到委托单号（下单要用它）：漏传时页面会显示「缺少委托单号」，
// 这条断言就是为上次那个「给废弃的 agreement 渲染点传了、真正在用的 payment 没传」的 bug 加的
const noBusUnionIdNote = '缺少委托单号';
check(
  '第 3 步拿到了委托单号（页面上不出现「缺少委托单号」）',
  hashPayment.step3 && !hashPayment.html.includes(noBusUnionIdNote),
  `含提示=${hashPayment.html.includes(noBusUnionIdNote)}`
);


const hashPaymentNoConfirm = render({ [FORM_KEY]: form, [REPORT_KEY]: report }, '#payment');
check('#payment 但没有委托单号 → 收口回第 2 步（不能进空壳支付页）', hashPaymentNoConfirm.step2, `step2=${hashPaymentNoConfirm.step2}`);

const hashProgress = render({ [FORM_KEY]: form, [REPORT_KEY]: report, [RECORD_KEY]: record }, '#progress');
check('#progress（没支付）→ 收口回第 3 步，不是第 6 步', hashProgress.step3, `step3=${hashProgress.step3}`);

const hashGroup = render({ [FORM_KEY]: form, [REPORT_KEY]: report }, '#group');
check('#group（没支付）→ 收口回第 2 步，不是第 4 步', hashGroup.step2, `step2=${hashGroup.step2}`);

// 关键回归：已解锁的 #survey 在**刷新时**也不生效 —— 证据在，就该落第 3 步
const hashSurvey = render({ [FORM_KEY]: form, [REPORT_KEY]: report, [RECORD_KEY]: record }, '#survey');
check(
  '#survey（已解锁）刷新时同样被忽略 → 仍按证据落第 3 步',
  hashSurvey.step3 && !hashSurvey.step1,
  `step1=${hashSurvey.step1} step3=${hashSurvey.step3}`
);

const hashUnknown = render({ [FORM_KEY]: form, [REPORT_KEY]: report }, '#nonsense');
check('认不出的 hash → 按没给处理，落到本该在的第 2 步', hashUnknown.step2, `step2=${hashUnknown.step2}`);

const hashSlash = render({ [FORM_KEY]: form, [REPORT_KEY]: report }, '#/proposal');
check('#/proposal 这种写法也认（同样是忽略，落点由证据给） → 第 2 步', hashSlash.step2, `step2=${hashSlash.step2}`);

const hashFillDetails = render({ [FORM_KEY]: form, [REPORT_KEY]: report, [RECORD_KEY]: record }, '#fill-details');
check('#fill-details（没到那一步）→ 收口回第 3 步', hashFillDetails.step3, `step3=${hashFillDetails.step3}`);

const hashPaid = render({ [FORM_KEY]: form, [REPORT_KEY]: report, [RECORD_KEY]: record }, '#paid');
check(
  '#paid + 有委托单号 → 首帧先按第 3 步渲染（待核实，核实通过才切支付成功界面）',
  hashPaid.step3,
  `step3=${hashPaid.step3}`
);

const hashPaidNoConfirm = render({ [FORM_KEY]: form, [REPORT_KEY]: report }, '#paid');
check('#paid 但没有委托单号 → 没有单号可查，收口回第 2 步', hashPaidNoConfirm.step2, `step2=${hashPaidNoConfirm.step2}`);

const hashPaidNoDraft = render({}, '#paid');
check('#paid 且什么都没有 → 第 1 步', hashPaidNoDraft.step1, `step1=${hashPaidNoDraft.step1}`);

const hashNoDraft = render({}, '#payment');
check('没有存档时 #payment → 第 1 步', hashNoDraft.step1, `step1=${hashNoDraft.step1}`);

/* ------------------------- 刷新落点：后面的步骤做过了就该落在后面（回归断言） */

{
  // 用户报的 bug：申报资料填完、刷新却被送回第 3 步支付页
  const afterSubmit = render(
    { [FORM_KEY]: form, [REPORT_KEY]: report, [RECORD_KEY]: record },
    '',
    { submitted: true }
  );
  // 注：SSR 只渲染首帧、不跑 effect，所以地址栏写没写成 #paid 看不了（那一步由真机验证覆盖）
  check(
    '申报资料已提交 + 有委托单号 → 刷新落在支付成功界面，不是进度页也不是待支付页',
    afterSubmit.paidView && !afterSubmit.step3 && !afterSubmit.html.includes('企业开办与政务交付办理进度'),
    `支付成功界面=${afterSubmit.paidView} 待支付页=${afterSubmit.step3}`
  );
  check(
    '已提交时清单显示「资料已提交 · 专员初审中」并给出「查看/修改申报资料」入口',
    afterSubmit.html.includes('资料已提交 · 专员初审中') && afterSubmit.html.includes('查看/修改申报资料')
  );

  // 只填了问卷、还没拿到诊断结果：落在第 1 步（问卷答案还在，接着填/重新生成即可）
  const onlyForm = render({ [FORM_KEY]: form }, '');
  check('只填过问卷 → 第 1 步（没有诊断结果就不进方案页）', onlyForm.step1 && !onlyForm.step2 && !onlyForm.step3);

  // 拿到诊断结果 → 第 2 步（别再被这条新规则带偏）
  const formAndReport = render({ [FORM_KEY]: form, [REPORT_KEY]: report }, '');
  check('问卷 + 诊断结果 → 第 2 步', formAndReport.step2 && !formAndReport.step1);

  // 进度页：刷新时 hash 被忽略（已提交一律落支付成功界面），所以它现在只能「进入页面后在会话内跳到」，
  // SSR 里改为直接渲染组件，保住「这一页自己能不能渲染」的覆盖（页面本身仍要能用）。
  const progressHtml = renderToString(
    <ProgressAndReviewStep
      timeline={INITIAL_TIMELINE_NODES}
      plan={buildPlan(survey, quoteFor('standard', ['addon-bank']))}
      details={{
        primaryName: '甲乙丙科技有限公司',
        backupName1: '',
        backupName2: '',
        industryCategory: '',
        registeredCapital: '100 万元人民币',
        legalRepresentative: { name: '张三', idCard: '', phone: '13800000000', email: '' },
        supervisor: { name: '', idCard: '', phone: '' },
        financeOfficer: { name: '', idCard: '', phone: '' },
        shareholders: [],
        officeAddress: { region: '', detail: '', propertyType: '', area: '' },
        docs: [],
      }}
      order={{ orderNo: 'TEST-ORDER-1', createdAt: '', amount: 2280, paymentMethod: 'wechat', status: 'paid', paidAt: '2026-09-22 10:00:00' }}
      onUpdateTimeline={() => {}}
      reviewBranch="complete"
      onUpdateReviewBranch={() => {}}
      bankBooked={false}
      onUpdateBankBooked={() => {}}
      onGoToChat={() => {}}
    />
  );
  check(
    '进度页组件本身能渲染（刷新时不再靠 #progress 进来，但页面要能用）',
    progressHtml.includes('企业开办与政务交付办理进度'),
    ''
  );

  // 已提交时手敲 #payment 也应该能回去看（六步都解锁了）
  const backToPayment = render(
    { [FORM_KEY]: form, [REPORT_KEY]: report, [RECORD_KEY]: record },
    '#payment',
    { submitted: true }
  );
  check(
    '已提交后手敲 #payment 也按支付成功界面渲染（同一页的两个状态，已付过款就不该再显示待支付）',
    backToPayment.paidView
  );
}

/* ------------------------------------------ 第 2 步：已支付时 02 / 03 锁定 */

{
  const plan = buildPlan(survey, quoteFor('standard', ['addon-bank']));
  const render = (locked: boolean) =>
    renderToString(
      <ProposalStep
        plan={plan}
        survey={survey}
        recordId="TEST-RECORD-1"
        locked={locked}
        onProceed={() => {}}
        onBack={() => {}}
      />
    );

  const unlockedHtml = render(false);
  const lockedHtml = render(true);

  check(
    '方案页未支付 → 02 提示「点击卡片切换方案」，没有锁定横幅',
    unlockedHtml.includes('点击卡片切换方案') && !unlockedHtml.includes('套餐已锁定'),
    ''
  );
  check(
    '方案页已支付 → 02 提示「订单已支付 · 套餐已锁定」并给出说明',
    lockedHtml.includes('订单已支付 · 套餐已锁定') && lockedHtml.includes('已按付款时的选择锁定'),
    ''
  );
  check(
    '方案页已支付 → 套餐卡片与增值服务都标了 aria-disabled（点击不再切换）',
    lockedHtml.includes('aria-disabled="true"') && !unlockedHtml.includes('aria-disabled="true"'),
    ''
  );
  check(
    '方案页已支付 → 卡片用 cursor-not-allowed 置灰',
    // 只看可锁定元素那一档 class（cursor-not-allowed + opacity-60）：页面上其它按钮的
    // disabled:cursor-not-allowed 是禁用态样式，不代表卡片被锁
    lockedHtml.includes('cursor-not-allowed opacity-60') && !unlockedHtml.includes('cursor-not-allowed opacity-60'),
    ''
  );
}

/* --------------------------------- 第 5 步：必须是转换来的数据，不是假示例 */

{
  // 直接渲染组件（不经过 render）：同样先清档，验证的是「没有草稿时按前面步骤转换」
  clearStorage();

  const step5Html = renderToString(
    <RegistrationDetailsStep
      appId="app-check-1"
      details={{
        primaryName: '',
        backupName1: '',
        backupName2: '',
        industryCategory: '',
        registeredCapital: '',
        legalRepresentative: { name: '', idCard: '', phone: '', email: '' },
        supervisor: { name: '', idCard: '', phone: '' },
        financeOfficer: { name: '', idCard: '', phone: '' },
        shareholders: [],
        officeAddress: { region: '', detail: '', propertyType: '', area: '' },
        docs: [],
      }}
      survey={survey}
      plan={buildPlan(survey, quoteFor('standard', ['addon-bank']))}
      contactPhone="13800000000"
      busUnionId="TEST-RECORD-1"
      onUpdateDetails={() => {}}
      onSubmitForReview={() => {}}
    />,
  );

  check('第 5 步渲染出问卷里的企业描述', step5Html.includes(survey.companyDesc), '');
  check('第 5 步渲染出问卷里的经营范围', step5Html.includes(survey.scope[0]), '');
  const demoLeftovers = ['林楚天', '440301199308123418', '跨境独立站', '海外仓配履约'];
  const found = demoLeftovers.filter((text) => step5Html.includes(text));
  check('第 5 步不再出现旧示例数据（假人名 / 假证件号 / 假企业描述）', found.length === 0, `仍出现：${found.join('、')}`);
}

/* ------------------------ 第 5 步：地址输入框的提示词跟着「地址性质」换 */

{
  // 两个地址输入框只有「不勾选由服务商提供」时才出现，所以这里直接铺一份**不勾选**的草稿存档，
  // 再按真实的注册键（banbu-registration-{appId}）喂给组件 —— 断言的是渲染出来的 placeholder，
  // 而不是「源码里写了这行字」。
  const NATURE_APP = 'app-check-nature';
  const NATURE_KEY = `banbu-registration-${NATURE_APP}`;

  const renderWithNatures = (reg: string, work: string) => {
    clearStorage();
    const blank = createBlankForm();
    store.set(
      NATURE_KEY,
      JSON.stringify({
        ...blank,
        basic: {
          ...blank.basic,
          regRecommend: false,
          regAddress: '',
          regAddressNature: reg,
          workRecommend: false,
          workAddress: '',
          workAddressNature: work,
        },
      })
    );
    return renderToString(
      <RegistrationDetailsStep
        appId={NATURE_APP}
        details={{
          primaryName: '',
          backupName1: '',
          backupName2: '',
          industryCategory: '',
          registeredCapital: '',
          legalRepresentative: { name: '', idCard: '', phone: '', email: '' },
          supervisor: { name: '', idCard: '', phone: '' },
          financeOfficer: { name: '', idCard: '', phone: '' },
          shareholders: [],
          officeAddress: { region: '', detail: '', propertyType: '', area: '' },
          docs: [],
        }}
        survey={survey}
        plan={buildPlan(survey, quoteFor('standard', ['addon-bank']))}
        contactPhone="13800000000"
        busUnionId="TEST-RECORD-1"
        onUpdateDetails={() => {}}
        onSubmitForReview={() => {}}
        />
    );
  };

  const ownReg = renderWithNatures('自有房产', '自有房产');
  check(
    '第 5 步：注册地址占位提示按性质换成「按房产证上的地址填写。」',
    ownReg.includes(regAddressPlaceholder('自有房产')) &&
      !ownReg.includes(regAddressPlaceholder(undefined)),
    ''
  );
  check(
    // 2026-10-08 起两个地址**同一套性质**，实际经营那一栏也按「自有房产」换词
    '第 5 步：实际经营地址占位提示同样按性质换（两边同一套）',
    ownReg.includes(workAddressPlaceholder('自有房产')) &&
      !ownReg.includes(workAddressPlaceholder(undefined)),
    ''
  );

  const freeUse = renderWithNatures('自有房产', '无偿使用证明');
  check(
    // 两个地址的「填写口径」是同一套，所以不能拿另一档的占位做「不该出现」的反证（自有房产那句
    // 两边都会出现）—— 这里改用**各自性质专属的东西**：需上传材料那块的小标题 + 无偿使用证明的报错原文
    '第 5 步：换成自有房产 / 无偿使用证明后提示词跟着换（不是写死一句话）',
    // 注意：SSR 会在相邻文本节点之间插 `<!-- -->`，所以带插值的「需上传材料（XX）」不好整串匹配，
    // 这里直接拿两档**专属的材料条目**当证据（纯字符串，不插值）
    freeUse.includes('房产证复印件（需产权人签字或盖章）') &&
      freeUse.includes('关联方出具的《无偿使用证明》（需盖章/签字）') &&
      freeUse.includes(regAddressPlaceholder('自有房产')) &&
      // 无偿使用证明那一档的占位是它专属的短句
      freeUse.includes(workAddressPlaceholder('无偿使用证明')),
    ''
  );
  check(
    '第 5 步：两个地址渲染的是同一套性质（只剩 3 项：租赁用房 / 自有房产 / 无偿使用证明）',
    ['租赁用房', '自有房产', '无偿使用证明'].every((v) => freeUse.includes(v)) &&
      // 已下架与旧那套的词都不该出现
      !freeUse.includes('集中办公/众创空间') &&
      !freeUse.includes('园区孵化器') &&
      !freeUse.includes('居家办公申报') &&
      !freeUse.includes('联合办公/众创工位') &&
      !freeUse.includes('商业租赁'),
    ''
  );
}

/* ------------------ 第 5 步：企业名称的示例占位跟着「组织形式」换 */

{
  // 与上面地址那块同一套做法：铺一份草稿存档，断言**渲染出来的 placeholder**
  const NAME_APP = 'app-check-name';
  const NAME_KEY = `banbu-registration-${NAME_APP}`;
  const renderWithOrg = (org: string, orgOther = '') => {
    clearStorage();
    const blank = createBlankForm();
    store.set(NAME_KEY, JSON.stringify({ ...blank, basic: { ...blank.basic, org, orgOther } }));
    return renderToString(
      <RegistrationDetailsStep
        appId={NAME_APP}
        details={{
          primaryName: '',
          backupName1: '',
          backupName2: '',
          industryCategory: '',
          registeredCapital: '',
          legalRepresentative: { name: '', idCard: '', phone: '', email: '' },
          supervisor: { name: '', idCard: '', phone: '' },
          financeOfficer: { name: '', idCard: '', phone: '' },
          shareholders: [],
          officeAddress: { region: '', detail: '', propertyType: '', area: '' },
          docs: [],
        }}
        survey={survey}
        plan={buildPlan(survey, quoteFor('standard', ['addon-buyer']))}
        contactPhone="13800000000"
        busUnionId="TEST-RECORD-1"
        onUpdateDetails={() => {}}
        onSubmitForReview={() => {}}
        />,
    );
  };

  const limited = renderWithOrg('有限责任公司');
  check(
    '第 5 步：名称面板说清「只填字号（关键词）」并给出反例',
    limited.includes('只需填写字号（关键词）') && limited.includes('不必填写「上海班步企程服务有限公司」'),
    ''
  );
  check(
    '第 5 步：首选占位说清「字号 → 按组织形式补全的完整名称」（有限责任公司）',
    limited.includes('只需填字号，例如：班步企程 → 上海班步企程服务有限公司'),
    ''
  );
  check('第 5 步：首选占位没有残留的星号', !limited.includes('上海班步企程服务有限公司 *'), '');
  check(
    '第 5 步：换成股份有限公司 → 补全示例跟着变',
    renderWithOrg('股份有限公司').includes('只需填字号，例如：班步企程 → 上海班步企程服务股份有限公司'),
    ''
  );
  check(
    '第 5 步：换成合伙企业 → 补全示例跟着变',
    renderWithOrg('合伙企业').includes('只需填字号，例如：班步企程 → 上海班步企程合伙企业（有限合伙）'),
    ''
  );
  check(
    '第 5 步：选「其他」并用自填组织形式 → 补全示例用它',
    renderWithOrg('其他', '外商投资性公司').includes('只需填字号，例如：班步企程 → 上海班步企程外商投资性公司'),
    ''
  );
}

/* ------------------------------------------- 多主体：旧结构、切换、状态徽标 */

{
  // **旧结构不再迁移**（2026-09 去掉）：只剩单主体时代的全局键时，照样是全新一份申请
  // ——不读旧键、不搬、也不删（硬删可能删掉别人正在用的东西）。
  clearStorage();
  const legacyKeys = {
    [FORM_KEY]: JSON.stringify(form),
    [REPORT_KEY]: JSON.stringify(report),
    [RECORD_KEY]: JSON.stringify(record),
    'banbu-registration-20260913-v1': JSON.stringify({ status: 'submitted' }),
  };
  Object.entries(legacyKeys).forEach(([k, v]) => store.set(k, v));
  const fresh = ensureApplicationsState(fakeWindow.localStorage as never, NOW)!;
  check(
    '只剩旧全局键 → 建全新主体（不迁移、不采用旧进度证据）',
    fresh.state.applications.length === 1 &&
      fresh.state.applications[0].currentStep === 'survey' &&
      fresh.state.applications[0].isDetailsSubmitted === false,
    JSON.stringify({ 个数: fresh.state.applications.length, 落点: fresh.state.applications[0].currentStep })
  );
  check(
    '旧键原样留着（不搬也不删）',
    Object.entries(legacyKeys).every(([k, v]) => store.get(k) === v),
    ''
  );

  // 有 per-app 存档时（= 上面的 render 预置的那种），主体名取诊断给的企业名称
  const named = render({ [FORM_KEY]: form, [REPORT_KEY]: report, [RECORD_KEY]: record });
  const namedState = JSON.parse(store.get('1b_copreg_apps_v1') ?? 'null');
  check(
    '主体名取诊断给的企业名称',
    namedState?.applications?.[0]?.name === '甲乙丙科技有限公司',
    JSON.stringify({ 名字: namedState?.applications?.[0]?.name })
  );
  check(
    '多主体开启：顶栏渲染切换入口、并显示当前主体名',
    named.html.includes('btn-applications-switcher') && named.html.includes('甲乙丙科技有限公司'),
    JSON.stringify({
      切换入口: named.html.includes('btn-applications-switcher'),
      主体名: named.html.includes('甲乙丙科技有限公司'),
    })
  );

  // 存档里本来就有多个主体时，按 activeAppId 落在**那个主体自己的**步骤
  const firstApp = createApplication(Date.now(), 0, '云帆科技');
  const secondApp: ApplicationRecord = {
    ...createApplication(Date.now() + 1, 1, '盛景科技'),
    currentStep: 'payment',
    unlockedSteps: ['survey', 'proposal', 'payment'],
  };
  const switched = render(
    {
      [`1b_copreg_app:${secondApp.id}:plan_form`]: { survey, tier: 'standard', addons: [] },
      [`1b_copreg_app:${secondApp.id}:plan_report`]: report,
      [`1b_copreg_app:${secondApp.id}:plan_record`]: record,
    },
    '',
    { appsOverride: { applications: [firstApp, secondApp], activeAppId: secondApp.id } }
  );
  check(
    '存档里多个主体时：按 activeAppId 落在它自己的步骤（第 3 步）',
    switched.step3,
    JSON.stringify({ step3: switched.step3 })
  );
  check(
    '顶栏显示当前主体名（不是别的那个）',
    switched.html.includes('盛景科技') && !switched.html.includes('云帆科技'),
    JSON.stringify({ 云帆: switched.html.includes('云帆科技'), 盛景: switched.html.includes('盛景科技') })
  );

  // 本地摘要写着 paid、但**还没查单**：首帧只落第 3 步的「待支付」界面，不假装已支付
  // （「有委托单号 / 本地标记 ≠ 已支付」—— 支付状态只有服务端查单说了算，见 stepRoute.ts）
  const locallyPaidApp: ApplicationRecord = {
    ...secondApp,
    order: { status: 'paid', orderNo: 'ORD-1', paidAt: '2026-09-24 10:00', contactPhone: '', amount: 2500, tierName: '全年无忧服务（小规模）' },
  };
  const readKeys = {
    [FORM_KEY]: { survey, tier: 'standard', addons: [] },
    [REPORT_KEY]: report,
    [RECORD_KEY]: record,
  };
  const locallyPaid = render(readKeys, '', { appsOverride: { applications: [locallyPaidApp], activeAppId: locallyPaidApp.id } });
  // 本地摘要说 paid 时界面照样可以先用它渲染（比闪一下待支付体验好），但**地址栏的 #paid 与
  // 「服务端说过未支付就改回 pending」都由真机脚本覆盖**（.mcp-work/verify-entry-paid-query.mjs）——
  // 首帧不查单这件事这里看不出来。
  check(
    '本地摘要 paid 的主体：首帧按支付成功界面渲染（查单结论随后可推翻它）',
    locallyPaid.paidView && !locallyPaid.step3,
    JSON.stringify({ step3: locallyPaid.step3, paidView: locallyPaid.paidView })
  );

  // 查单确认已支付（浏览器里落成 isDetailsSubmitted 之外的第二条依据不存在）：
  // SSR 首帧拿不到查单结论，所以「已支付 → 支付成功界面」由真机脚本覆盖
  // （.mcp-work/verify-paid-cta.mjs / verify-submitted-landing.mjs）。
  const submittedApp: ApplicationRecord = { ...secondApp, isDetailsSubmitted: true };
  const submittedHtml = render(readKeys, '', { appsOverride: { applications: [submittedApp], activeAppId: submittedApp.id } });
  check(
    '申报资料已提交的主体：落在支付成功界面（它本身就说明付过款）',
    submittedHtml.paidView,
    JSON.stringify({ paidView: submittedHtml.paidView })
  );
}

/* ---------------------- 「新标签页」深链：?open=fill-details（支付成功页的填报按钮） */

{
  const fillApp: ApplicationRecord = {
    ...createApplication(NOW, 0, '盛景科技'),
    currentStep: 'payment',
    unlockedSteps: ['survey', 'proposal', 'payment'],
    order: { status: 'paid', orderNo: 'ORD-1', paidAt: '2026-09-24 10:00', contactPhone: '', amount: 2500, tierName: '全年无忧服务（小规模）' },
  };
  const keys = {
    [FORM_KEY]: form,
    [REPORT_KEY]: report,
    [RECORD_KEY]: record,
  };
  const deepKeys = {
    [`1b_copreg_app:${fillApp.id}:plan_form`]: { survey, tier: 'standard', addons: [] },
    [`1b_copreg_app:${fillApp.id}:plan_report`]: report,
    [`1b_copreg_app:${fillApp.id}:plan_record`]: record,
  };
  const deepApp = { applications: [fillApp], activeAppId: fillApp.id };

  // 付过款 + 带意图参数 → 直接落第 5 步（新标签页靠它，而不是靠 hash）
  // 注：SSR 不跑 effect，所以「地址栏被规范化成 #fill-details」与「参数被抹掉」这两条
  // 由真机脚本覆盖（.mcp-work/verify-paid-cta.mjs）。
  const deepLinked = render(deepKeys, '', { appsOverride: deepApp, search: '?open=fill-details' });
  check(
    '★ 已支付 + ?open=fill-details → 直接落在第 5 步申报资料填报',
    deepLinked.html.includes('企业注册申报资料填报与初审') && !deepLinked.html.includes('支付成功 · 委托代办已生效'),
    JSON.stringify({ 第5步: deepLinked.html.includes('企业注册申报资料填报与初审') })
  );
  // 高亮条（与 #survey 同款，`components/SectionDecor.tsx`）：两张页面的「需要输入的卡片」都要有
  const decorCount = (html: string) => (html.match(/data-section-decor="bar"/g) ?? []).length;
  const doneCount = (html: string) => (html.match(/data-card-done="true"/g) ?? []).length;
  const pendingCount = (html: string) => (html.match(/data-card-done="false"/g) ?? []).length;
  check(
    // 口径与 #survey 一致：**没有待完善项的卡片才亮**，没验证通过的一律白底
    // （所以「高亮条数」必须正好等于 data-card-done="true" 的卡片数）
    '★ 第 5 步：只有「校验过了」的卡片亮高亮条（高亮条数 = 已完成卡片数）',
    deepLinked.html.includes('企业注册申报资料填报与初审') &&
      decorCount(deepLinked.html) >= 1 &&
      decorCount(deepLinked.html) === doneCount(deepLinked.html) &&
      pendingCount(deepLinked.html) >= 1,
    JSON.stringify({ 高亮条: decorCount(deepLinked.html), 已完成: doneCount(deepLinked.html), 待完善: pendingCount(deepLinked.html) })
  );
  check(
    '★ 第 5 步：没验证通过的卡片**不是**绿色（待完善卡片没有高亮竖条）',
    decorCount(deepLinked.html) < doneCount(deepLinked.html) + pendingCount(deepLinked.html) &&
      pendingCount(deepLinked.html) > 0,
    JSON.stringify({ 卡片总数: doneCount(deepLinked.html) + pendingCount(deepLinked.html) })
  );
  check(
    // 问卷页（只有问卷存档 → 落第 1 步）的卡片同样带 data-section-decor="bar"，确认抽出去没走形
    '高亮条就是问卷那套组件（问卷页的卡片也带同款）',
    withoutConfirm.step1 && decorCount(withoutConfirm.html) >= 1,
    JSON.stringify({ 问卷高亮条数: decorCount(withoutConfirm.html) })
  );

  // 落点是**会话级**的：主体记录里的「进度」仍然停在 payment（第 5 步不落盘）
  check(
    '★ 深链只改会话内的浏览位置，落盘的步骤仍是 payment',
    JSON.parse(store.get(APPLICATIONS_KEY) ?? 'null')?.applications?.[0]?.currentStep === 'payment',
    store.get(APPLICATIONS_KEY)?.slice(0, 160)
  );

  // 存档里留着超限步骤（老版本写进去的）→ 读进来收口回 payment，不直接落进填报页
  const staleFill = { ...fillApp, currentStep: 'fill_details' as const };
  const clamped = render(deepKeys, '', { appsOverride: { applications: [staleFill], activeAppId: staleFill.id } });
  check(
    '★ 存档里写着 fill_details 也会被收口回 payment（第 5 步只能从支付页进）',
    !clamped.html.includes('企业注册申报资料填报与初审') &&
      JSON.parse(store.get(APPLICATIONS_KEY) ?? 'null')?.applications?.[0]?.currentStep === 'payment',
    JSON.stringify({ 第5步: clamped.html.includes('企业注册申报资料填报与初审') })
  );

  // 没付过款 + 同样的参数 → 完全忽略（否则这条链接就是绕过支付的入口）
  const notPaid: ApplicationRecord = { ...fillApp, order: { status: 'pending', orderNo: '', paidAt: '', contactPhone: '', amount: 0, tierName: '' } };
  const notPaidDeep = render(deepKeys, '', { appsOverride: { applications: [notPaid], activeAppId: notPaid.id }, search: '?open=fill-details' });
  check(
    '★ 没付过款 + ?open=fill-details → 忽略参数，仍按本地证据落第 3 步（不是第 5 步）',
    !notPaidDeep.html.includes('企业注册申报资料填报与初审') && notPaidDeep.step3,
    JSON.stringify({ 第5步: notPaidDeep.html.includes('企业注册申报资料填报与初审'), step3: notPaidDeep.step3 })
  );

  // 参数不认识也一样忽略
  const unknownParam = render(deepKeys, '', { appsOverride: deepApp, search: '?open=progress' });
  check(
    '不认识的意图值被忽略（白名单）',
    !unknownParam.html.includes('企业开办与政务交付办理进度'),
    JSON.stringify({ 进度页: unknownParam.html.includes('企业开办与政务交付办理进度') })
  );
}

/* ============================ 服务人员查看页（copreg-view.html） ============================ */

/**
 * React 在「静态文本 + 表达式」之间插 `<!-- -->` 注释分隔（`开户单编号：{uuid}` 就是两段），
 * 断言连起来的那句话之前先把它去掉。
 */
const plain = (html: string) => html.replace(/<!-- -->/g, '');

{
  // 客户页**不认** ?scbUuid=（查看意图只属于 copreg-view.html）：带上它照样落第 1 步问卷
  const withStaffParam = render({}, '', { search: '?scbUuid=QSVZXH3CdHntAAUpz289ry&code=C1' });
  check(
    '客户页 copreg.html 不认 ?scbUuid=（不会误进服务人员视图）',
    withStaffParam.step1 && !withStaffParam.html.includes('服务人员查看'),
    JSON.stringify({ step1: withStaffParam.step1, 含服务人员视图: withStaffParam.html.includes('服务人员查看') })
  );

  // 带参数打开查看页 → 首帧是「正在读取」（真机上再发请求，SSR 跑不到 effect）
  const loading = renderToString(<ServiceRecordView query={{ uuid: 'QSVZXH3CdHntAAUpz289ry', code: 'C1' }} />);
  check(
    '查看页带 scbUuid → 落只读视图并显示「正在读取」',
    plain(loading).includes('服务人员查看 · 只读') &&
      plain(loading).includes('开户单编号：QSVZXH3CdHntAAUpz289ry') &&
      plain(loading).includes('正在读取客户申报资料'),
    JSON.stringify({ 只读徽标: loading.includes('服务人员查看 · 只读'), 加载中: loading.includes('正在读取客户申报资料') })
  );

  // 链接被截断（没有 scbUuid）→ 说清缺什么，而不是静默空白
  const badLink = renderToString(<ServiceRecordView query={null} />);
  check(
    '查看页没有 scbUuid → 提示「链接不完整，缺少开户单编号」',
    badLink.includes('链接不完整') && badLink.includes('scbUuid'),
    JSON.stringify({ 提示: badLink.includes('链接不完整') })
  );
}

{
  const content = renderToString(
    <ServiceRecordContent
      form={STAFF_FORM}
      busUnionId="AWQYmcaF6V8hUbudFEoQMZ"
      fetchedAt="2026/10/8 13:40:00"
      fromSnapshot={false}
      onPreviewFile={() => {}}
    />
  );

  check(
    '查看页正文照客户「05 确认提交」那一章渲染（基本信息 / 股东 / 主要人员 / 委托书 / 真实性确认）',
    plain(content).includes('1. 企业基本信息') &&
      plain(content).includes('2. 股东及出资结构') &&
      plain(content).includes('3. 企业主要管理人员') &&
      plain(content).includes('4. 法定代表人委托书签署') &&
      plain(content).includes('我已核对本次拟申报的全部企业信息与证件资料'),
    JSON.stringify({ 基本信息: plain(content).includes('1. 企业基本信息') })
  );

  check(
    '客户填的值原样显示（名称 / 股东姓名 / 股比 / 受托人）',
    plain(content).includes('聚义') &&
      plain(content).includes('张三') &&
      plain(content).includes('持股 100%') &&
      plain(content).includes('李四'),
    JSON.stringify({ 股东: plain(content).includes('张三'), 受托人: plain(content).includes('李四') })
  );

  check(
    '概览给提交时间 / 经办手机 / 方案号 / 读取时间，并标「已确认提交」',
    content.includes('2026/10/8 13:33:12') &&
      content.includes('15900804441') &&
      content.includes('AWQYmcaF6V8hUbudFEoQMZ') &&
      plain(content).includes('本次读取时间') &&
      content.includes('2026/10/8 13:40:00') &&
      content.includes('已确认提交'),
    JSON.stringify({ 已提交: content.includes('已确认提交') })
  );

  check(
    '正常读取（不是快照）时不出现「本页是…会话内快照」那条提示',
    !plain(content).includes('会话内快照'),
    JSON.stringify({ 含快照提示: plain(content).includes('会话内快照') })
  );

  check(
    '只读：没有「修改」按钮，也没有跳去办理清单的按钮',
    !content.includes('修改') && !content.includes('查看服务进度状态与办理清单'),
    JSON.stringify({ 含修改: content.includes('修改') })
  );

  check(
    '两个勾选（免申报承诺 / 信息真实性）在只读模式下不可改',
    content.includes('disabled'),
    JSON.stringify({ 勾选置灰: content.includes('disabled') })
  );

  check(
    '补上「确认提交」没有、但 var2 里确实有的地址性质与场地证明附件',
    content.includes('地址性质与场地证明') &&
      content.includes('注册地址性质') &&
      content.includes('租赁用房') &&
      content.includes('房产证.png'),
    JSON.stringify({ 地址卡: content.includes('地址性质与场地证明') })
  );

  const draft = renderToString(
    <ServiceRecordContent
      form={{ ...STAFF_FORM, status: 'draft', submittedAt: null }}
      busUnionId=""
      fetchedAt="2026/10/8 13:40:00"
      fromSnapshot={false}
      onPreviewFile={() => {}}
    />
  );
  check(
    '客户只存了草稿时如实标「草稿（客户尚未确认提交）」',
    draft.includes('草稿（客户尚未确认提交）') && !draft.includes('已确认提交'),
    JSON.stringify({ 草稿: draft.includes('草稿（客户尚未确认提交）') })
  );
}

{
  // 刷新命中会话内快照：必须说清「这一趟没有重新读」（查看码一次有效，不会再打接口）
  const snap = renderToString(
    <ServiceRecordContent
      form={STAFF_FORM}
      busUnionId="AWQYmcaF6V8hUbudFEoQMZ"
      fetchedAt="2026/10/8 13:40:00"
      fromSnapshot
      onPreviewFile={() => {}}
    />
  );
  check(
    '刷新命中会话内快照时，概览上说明「刷新不会重新读取」并给出重新获取链接的办法',
    plain(snap).includes('会话内快照') &&
      plain(snap).includes('刷新不会重新读取') &&
      plain(snap).includes('请回开户详情页重新点一次'),
    JSON.stringify({ 快照提示: plain(snap).includes('会话内快照') })
  );
}

{
  // 对照：同一个组件在客户页（非只读）必须还是原来那套可改的界面
  const editable = renderToString(
    <ReviewSection
      form={STAFF_FORM}
      onGoChapter={() => {}}
      onUpdateConfirm={() => {}}
      onPreviewFile={() => {}}
      onProceedToDelivery={() => {}}
      errors={{}}
    />
  );
  check(
    '非只读的确认提交章仍保留「修改」与跳转按钮（只读是加出来的，没有改掉客户页）',
    editable.includes('修改') && editable.includes('查看服务进度状态与办理清单'),
    JSON.stringify({ 修改: editable.includes('修改'), 跳转: editable.includes('查看服务进度状态与办理清单') })
  );
}

console.log(`\n${pass} 项通过，${fail} 项失败`);
if (fail > 0) process.exit(1);
