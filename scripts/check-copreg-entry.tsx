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
 * 覆盖的就是「存档 → 首屏落点」这条链：确认凭据有效就直落第 3 步、过期/没配套就退回第 2 步、
 * 什么都没存就第 1 步。不联网、不开浏览器。
 */
import { renderToString } from 'react-dom/server';
import App from '../src/copreg/App';
import { RegistrationDetailsStep } from '../src/copreg/components/RegistrationDetailsStep';
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
const CONFIRM_KEY = '1b_copreg_plan_confirm';
const DETAILS_KEY = 'banbu-registration-20260913-v1';

const survey = {
  coreNeeds: ['需公司主体'], companyDesc: '甲乙丙科技', bizDesc: '软件开发',
  scope: ['软件开发'], license: [], sensitive: [], invoiceReq: '不确定',
  monthlyAmount: '< 10 万', revenue: ['服务费'], revenueOther: '',
  shareholderType: ['自然人'], shareholderCount: '1 个', capitalRec: '是',
  capitalAmount: '', regAddress: '是（需推荐）', officeSpace: '否',
};
const form = { survey, tier: 'standard', addons: [{ id: 'addon-bank', name: '银行对公账户开通', price: 200 }] };
const confirm = { recordId: 'VHpX5NqoXLHwPyMnVeBzCN', status: 'SUCCESS', tier: 'standard', addonIds: ['addon-bank'] };

/** 每个场景开始前清空所有存档，避免上一个场景的状态串味 */
const clearStorage = () => {
  [FORM_KEY, REPORT_KEY, CONFIRM_KEY, DETAILS_KEY].forEach((key) => store.delete(key));
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

const withConfirm = render({ [FORM_KEY]: form, [CONFIRM_KEY]: confirm });
check('有确认凭据 → 首屏第 3 步（协议确认与支付）', withConfirm.step3 && !withConfirm.step2, JSON.stringify(withConfirm));

// 支付方式：支付宝还没接入，第 3 步只应列出微信支付
check(
  '第 3 步的支付方式只列微信（支付宝选项已隐藏）',
  withConfirm.step3 && !withConfirm.html.includes('支付宝') && withConfirm.html.includes('微信支付'),
  `step3=${withConfirm.step3} 含支付宝=${withConfirm.html.includes('支付宝')}`
);

// 顾问是谁要由服务端 / 扫码后才知道，页面上不许再写死姓名或头衔
check(
  '第 3 步不出现写死的顾问称呼',
  !withConfirm.html.includes('李经理') && !withConfirm.html.includes('资深设立顾问'),
  `李经理=${withConfirm.html.includes('李经理')}`
);

const withoutConfirm = render({ [FORM_KEY]: form });
check('只有问卷存档 → 首屏第 2 步', withoutConfirm.step2 && !withoutConfirm.step3, JSON.stringify(withoutConfirm));

const staleConfirm = render({ [FORM_KEY]: form, [CONFIRM_KEY]: { ...confirm, tier: 'bundle_general' } });
check('凭据与存档方案不符 → 退回第 2 步', staleConfirm.step2 && !staleConfirm.step3, JSON.stringify(staleConfirm));

const staleAddons = render({ [FORM_KEY]: form, [CONFIRM_KEY]: { ...confirm, addonIds: [] } });
check('自选项与确认时不同 → 退回第 2 步', staleAddons.step2 && !staleAddons.step3, JSON.stringify(staleAddons));

const noForm = render({ [CONFIRM_KEY]: confirm });
check('只有凭据没有问卷 → 回到第 1 步', noForm.step1 && !noForm.step3, JSON.stringify(noForm));

const empty = render({});
check('什么都没存 → 第 1 步', empty.step1 && !empty.step2 && !empty.step3, JSON.stringify(empty));

const badStatus = render({ [FORM_KEY]: form, [CONFIRM_KEY]: { ...confirm, status: 'FAIL' } });
check('凭据 status 不是 SUCCESS → 第 2 步', badStatus.step2 && !badStatus.step3, JSON.stringify(badStatus));

const legacyAddons = render({ [FORM_KEY]: { ...form, addons: ['addon-bank'] }, [CONFIRM_KEY]: confirm });
check('旧存档（addons 是字符串数组）+ 凭据 → 仍落在第 3 步', legacyAddons.step3, JSON.stringify(legacyAddons));

// 手写的凭据：只有服务端返回的 recordId / status，没有前端附加的选择注解
const bareConfirm = render({ [FORM_KEY]: form, [CONFIRM_KEY]: { recordId: 'VHpX5NqoXLHwPyMnVeBzCN', status: 'SUCCESS' } });
check('只有 recordId/status 的凭据 → 同样落到第 3 步', bareConfirm.step3, JSON.stringify(bareConfirm));

const bareOnBundle = render({
  [FORM_KEY]: { ...form, tier: 'bundle_small', addons: [] },
  [CONFIRM_KEY]: { recordId: 'VHpX5NqoXLHwPyMnVeBzCN', status: 'SUCCESS' },
});
check('bundle 档 + 只有 recordId/status 的凭据 → 也落到第 3 步', bareOnBundle.step3, JSON.stringify(bareOnBundle));

/* --------------------------------------------------- URL hash 决定首屏落点 */

// SSR 只渲染一次，不跑 effect，所以这里验的是「hash 决定首屏落在哪一步」（用户真正看到的结果）；
// 「地址栏被改写成真实步骤」属于 effect 行为，由 scripts/check-step-route.ts 的 resolveStep 覆盖。
const hashProposal = render({ [FORM_KEY]: form }, '#proposal');
check('#proposal + 有问卷存档 → 第 2 步', hashProposal.step2, `step2=${hashProposal.step2}`);

const hashPayment = render({ [FORM_KEY]: form, [CONFIRM_KEY]: confirm }, '#payment');
check('#payment + 有确认凭据 → 第 3 步', hashPayment.step3, `step3=${hashPayment.step3}`);

// 第 3 步必须拿到确认单据号（下单要用它）：漏传时页面会显示「缺少确认单据号」，
// 这条断言就是为上次那个「给废弃的 agreement 渲染点传了、真正在用的 payment 没传」的 bug 加的
const noBusUnionIdNote = '缺少确认单据号';
check(
  '第 3 步拿到了确认单据号（页面上不出现「缺少确认单据号」）',
  hashPayment.step3 && !hashPayment.html.includes(noBusUnionIdNote),
  `含提示=${hashPayment.html.includes(noBusUnionIdNote)}`
);


const hashPaymentNoConfirm = render({ [FORM_KEY]: form }, '#payment');
check('#payment 但没有确认凭据 → 收口回第 2 步（不能进空壳支付页）', hashPaymentNoConfirm.step2, `step2=${hashPaymentNoConfirm.step2}`);

const hashProgress = render({ [FORM_KEY]: form, [CONFIRM_KEY]: confirm }, '#progress');
check('#progress（没支付）→ 收口回第 3 步，不是第 6 步', hashProgress.step3, `step3=${hashProgress.step3}`);

const hashGroup = render({ [FORM_KEY]: form }, '#group');
check('#group（没支付）→ 收口回第 2 步，不是第 4 步', hashGroup.step2, `step2=${hashGroup.step2}`);

const hashSurvey = render({ [FORM_KEY]: form, [CONFIRM_KEY]: confirm }, '#survey');
check('#survey 手敲回第 1 步（已解锁的都能去）', hashSurvey.step1, `step1=${hashSurvey.step1}`);

const hashUnknown = render({ [FORM_KEY]: form }, '#nonsense');
check('认不出的 hash → 按没给处理，落到本该在的第 2 步', hashUnknown.step2, `step2=${hashUnknown.step2}`);

const hashSlash = render({ [FORM_KEY]: form }, '#/proposal');
check('#/proposal 这种写法也认 → 第 2 步', hashSlash.step2, `step2=${hashSlash.step2}`);

const hashFillDetails = render({ [FORM_KEY]: form, [CONFIRM_KEY]: confirm }, '#fill-details');
check('#fill-details（没到那一步）→ 收口回第 3 步', hashFillDetails.step3, `step3=${hashFillDetails.step3}`);

const hashPaid = render({ [FORM_KEY]: form, [CONFIRM_KEY]: confirm }, '#paid');
check(
  '#paid + 有确认凭据 → 首帧先按第 3 步渲染（待核实，核实通过才切支付成功界面）',
  hashPaid.step3,
  `step3=${hashPaid.step3}`
);

const hashPaidNoConfirm = render({ [FORM_KEY]: form }, '#paid');
check('#paid 但没有确认凭据 → 没有单据号可查，收口回第 2 步', hashPaidNoConfirm.step2, `step2=${hashPaidNoConfirm.step2}`);

const hashPaidNoDraft = render({}, '#paid');
check('#paid 且什么都没有 → 第 1 步', hashPaidNoDraft.step1, `step1=${hashPaidNoDraft.step1}`);

const hashNoDraft = render({}, '#payment');
check('没有存档时 #payment → 第 1 步', hashNoDraft.step1, `step1=${hashNoDraft.step1}`);

/* ------------------------- 刷新落点：后面的步骤做过了就该落在后面（回归断言） */

{
  // 用户报的 bug：申报资料填完、刷新却被送回第 3 步支付页
  const submittedDraft = { status: 'submitted', basic: {}, people: {}, shareholders: [], roles: [] };
  const afterSubmit = render(
    { [FORM_KEY]: form, [CONFIRM_KEY]: confirm, [DETAILS_KEY]: submittedDraft },
    ''
  );
  check(
    '申报资料已提交 + 有确认凭据 → 刷新落在第 6 步进度页，而不是支付页',
    afterSubmit.html.includes('企业开办与政务交付办理进度') && !afterSubmit.step3,
    `进度页=${afterSubmit.html.includes('企业开办与政务交付办理进度')} 支付页=${afterSubmit.step3}`
  );

  // 只填了问卷：仍应落在第 2 步
  const onlyForm = render({ [FORM_KEY]: form }, '');
  check('只填过问卷 → 第 2 步（没被后面的判断带偏）', onlyForm.step2 && !onlyForm.step3);

  // 已提交时手敲 #payment 也应该能回去看（六步都解锁了）
  const backToPayment = render(
    { [FORM_KEY]: form, [CONFIRM_KEY]: confirm, [DETAILS_KEY]: submittedDraft },
    '#payment'
  );
  check('已提交后手敲 #payment 仍可回到支付页（已解锁）', backToPayment.step3);
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
      onUpdateDetails={() => {}}
      onSubmitForReview={() => {}}
      onBackToGroup={() => {}}
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
