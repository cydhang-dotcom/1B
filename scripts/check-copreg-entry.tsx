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

const store = new Map<string, string>();
const fakeWindow = {
  localStorage: {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  },
  scrollTo: () => {},
  print: () => {},
};

const FORM_KEY = '1b_copreg_plan_form';
const REPORT_KEY = '1b_copreg_plan_report';
const CONFIRM_KEY = '1b_copreg_plan_confirm';

const survey = {
  coreNeeds: ['需公司主体'], companyDesc: '甲乙丙科技', bizDesc: '软件开发',
  scope: ['软件开发'], license: [], sensitive: [], invoiceReq: '不确定',
  monthlyAmount: '< 10 万', revenue: ['服务费'], revenueOther: '',
  shareholderType: ['自然人'], shareholderCount: '1 个', capitalRec: '是',
  capitalAmount: '', regAddress: '是（需推荐）', officeSpace: '否',
};
const form = { survey, tier: 'standard', addons: [{ id: 'addon-bank', name: '银行对公账户开通', price: 200 }] };
const confirm = { recordId: 'VHpX5NqoXLHwPyMnVeBzCN', status: 'SUCCESS', tier: 'standard', addonIds: ['addon-bank'] };

const render = (keys: Record<string, unknown>) => {
  [FORM_KEY, REPORT_KEY, CONFIRM_KEY].forEach((k) => store.delete(k));
  Object.entries(keys).forEach(([k, v]) => store.set(k, JSON.stringify(v)));
  (globalThis as any).window = fakeWindow;
  const html = renderToString(<App />);
  return {
    html,
    // 用各步骤独有的 DOM id 判定，比文字匹配稳
    step1: html.includes('id="sec-core"'),
    step2: html.includes('id="btn-confirm-proposal-proceed"'),
    step3: html.includes('id="btn-click-pay"'),
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

console.log(`\n${pass} 项通过，${fail} 项失败`);
if (fail > 0) process.exit(1);
