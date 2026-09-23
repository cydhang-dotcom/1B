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
import {
  ProgressAndReviewStep,
  INITIAL_TIMELINE_NODES,
} from '../src/copreg/components/ProgressAndReviewStep';
import { buildPlan } from '../src/copreg/plan';
import { quoteFor } from '../src/copreg/components/proposalQuote';

const store = new Map<string, string>();
/** 假的地址栏：hash 由每个场景自己给，history.replaceState 只记下最后一次规范化的结果 */
const fakeWindow = {
  localStorage: {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  },
  location: { hash: '' },
  history: { replaceState: (_state: unknown, _title: string, url: string) => void (fakeWindow.location.hash = url) },
  scrollTo: () => {},
  print: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
};

const FORM_KEY = '1b_copreg_plan_form';
const REPORT_KEY = '1b_copreg_plan_report';
const RECORD_KEY = '1b_copreg_plan_record';
const DETAILS_KEY = 'banbu-registration-20260913-v1';

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

/** 每个场景开始前清空所有存档，避免上一个场景的状态串味 */
const clearStorage = () => {
  [FORM_KEY, REPORT_KEY, RECORD_KEY, DETAILS_KEY].forEach((key) => store.delete(key));
};

const render = (keys: Record<string, unknown>, hash = '') => {
  clearStorage();
  Object.entries(keys).forEach(([k, v]) => store.set(k, JSON.stringify(v)));
  fakeWindow.location.hash = hash;
  (globalThis as any).window = fakeWindow;
  // 组件里有直接读裸全局 localStorage 的地方（浏览器里恒存在），SSR 里补上同一个桩
  (globalThis as any).localStorage = fakeWindow.localStorage;
  const html = renderToString(<App />);
  return {
    html,
    hash: fakeWindow.location.hash,
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
  const submittedDraft = { status: 'submitted', basic: {}, people: {}, shareholders: [], roles: [] };
  const afterSubmit = render(
    { [FORM_KEY]: form, [REPORT_KEY]: report, [RECORD_KEY]: record, [DETAILS_KEY]: submittedDraft },
    ''
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
    { [FORM_KEY]: form, [REPORT_KEY]: report, [RECORD_KEY]: record, [DETAILS_KEY]: submittedDraft },
    '#payment'
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
    lockedHtml.includes('cursor-not-allowed') && !unlockedHtml.includes('cursor-not-allowed'),
    ''
  );
}

/* --------------------------------- 第 5 步：必须是转换来的数据，不是假示例 */

{
  // 直接渲染组件（不经过 render）：同样先清档，验证的是「没有草稿时按前面步骤转换」
  clearStorage();

  const step5Html = renderToString(
    <RegistrationDetailsStep
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
      onBackToPaid={() => {}}
    />,
  );

  check('第 5 步渲染出问卷里的企业描述', step5Html.includes(survey.companyDesc), '');
  check('第 5 步渲染出问卷里的经营范围', step5Html.includes(survey.scope[0]), '');
  const demoLeftovers = ['林楚天', '440301199308123418', '跨境独立站', '海外仓配履约'];
  const found = demoLeftovers.filter((text) => step5Html.includes(text));
  check('第 5 步不再出现旧示例数据（假人名 / 假证件号 / 假企业描述）', found.length === 0, `仍出现：${found.join('、')}`);
}

console.log(`\n${pass} 项通过，${fail} 项失败`);
if (fail > 0) process.exit(1);
