/**
 * 第 1 步本地存档的自检：不联网、不碰 React。
 *   npx tsx scripts/check-plan-archive.ts
 *
 * 覆盖两件事：
 *   1. **自选项的派生**（`addonsOf`）：存档里 `addons` 是 `{ id, name, price }` 对象数组，
 *      由方案页那份报价明细派生 —— App 存 `1b_copreg_plan_form` 走的就是这条路径。
 *   2. **存档读回**（`normalizeAddons`）：新形状原样往返，旧版 id 字符串数组能迁移回来，
 *      认不出的 id / 重复项 / 乱七八糟的值都被收干净（存档可能来自旧版本或被手改过）。
 *
 * 这里只测「存档形状」这一层：`planDraft.ts` 本身读 `import.meta.env`（经 planGenerate →
 * config/api），tsx 下加载不了 —— 它与首屏落点的联动由 `npm run check:entry` 用真实组件树覆盖
 * （那里有「只有问卷存档 → 第 1 步」「问卷 + 诊断结果 + 委托单号 → 第 3 步」这些断言）。
 *
 * 曾经还有一个 `check-service-confirm.ts`（121 项）：确认接口 `confirm-proposal` 从
 * 2026-09 起不再调用（委托单号在第 1 步生成方案时就返回了），那些断言随接口一起删掉，
 * 只留下这里仍然成立的部分。
 */
import {
  ALL_ADDON_IDS,
  OPTIONAL_ADDON_SERVICES,
  addonsOf,
  normalizeAddons,
  quoteFor,
} from '../src/copreg/components/proposalQuote';
import { buildPlan } from '../src/copreg/plan';
import type { SurveyData } from '../src/copreg/types';
import type { PlanForm } from '../src/copreg/planDraft';

/** 编译期断言用的类型相等判断：两边不完全一致时这个 ok(...) 会直接编译不过 */
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
/** 存档必须恰好是「问卷 + 套餐 + 自选项」三样 */
const FORM_SHAPE: Exact<keyof PlanForm, 'survey' | 'tier' | 'addons'> = true;

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

const survey = (): SurveyData => ({
  coreNeeds: ['需公司主体'],
  companyDesc: '字号甲乙丙，主营软件开发',
  bizDesc: '为中小企业提供定制软件与运维',
  scope: ['软件开发'],
  license: [],
  sensitive: [],
  invoiceReq: '不确定',
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

/** 方案页那份方案：套餐与加购走真实报价，服务清单才有真实形状 */
const planOf = (tier: Parameters<typeof quoteFor>[0], addons: string[] = []) =>
  buildPlan(survey(), quoteFor(tier, addons));

/* ------------------------------------------------ 存档形状（编译期 + 运行期） */

{
  const plan = planOf('standard', ['addon-bank', 'addon-tax']);
  const archived = addonsOf(plan.items); // App 存 1b_copreg_plan_form 时调的就是它

  const form: PlanForm = { survey: survey(), tier: plan.selectedTier, addons: archived };
  ok('存档恰好是 survey / tier / addons 三个字段（编译期断言）', FORM_SHAPE);
  ok('运行期也只有这三个字段', Object.keys(form).sort().join(',') === 'addons,survey,tier');
  ok('问卷十六个字段一个不少', Object.keys(form.survey).length === 16);

  // App 打开存档时走的路：对象 → 取 id 重算报价 → 再派生回对象，必须回到同一份
  const rebuilt = buildPlan(survey(), quoteFor('standard', archived.map((addon) => addon.id)));
  ok('存档 → 取 id 重算报价 → 再派生，回到同一份对象', JSON.stringify(addonsOf(rebuilt.items)) === JSON.stringify(archived));
}

/* -------------------------------------------------------- 自选增值服务 */

{
  const addons = addonsOf(planOf('standard', ['addon-bank', 'addon-tax']).items);

  ok('addons 是数组且有两项', Array.isArray(addons) && addons.length === 2);
  ok('每一项只有 id / name / price 三个字段', addons.every((a) => Object.keys(a).sort().join(',') === 'id,name,price'));
  ok('是对象数组（不再是字符串数组）', typeof addons[0] === 'object' && typeof addons[0] !== 'string');
  ok('第一项是银行开户，带名称与实收价', addons[0].id === 'addon-bank' && addons[0].name === '银行对公账户开通' && addons[0].price === 200);
  ok('第二项是税局开户，带名称与实收价', addons[1].id === 'addon-tax' && addons[1].name === '电子税务局开户' && addons[1].price === 100);
  ok('顺序与页面报价明细一致（银行 → 税局 → 社保）', addons.map((a) => a.id).join(',') === 'addon-bank,addon-tax');
  ok('不带 desc / originalPrice / tag（只带出单要用的三样）', !('desc' in addons[0]) && !('originalPrice' in addons[0]) && !('tag' in addons[0]));
  ok(
    '价格与报价明细里的同一个数',
    addons[0].price === quoteFor('standard', ['addon-bank', 'addon-tax']).items.find((item) => item.id === 'addon-bank')?.price
  );
}

/* ---------------------------------------------------------- 自选项派生 */

{
  const derived = addonsOf(quoteFor('standard', ['addon-bank', 'addon-tax']).items);

  ok('从报价明细派生出勾中的那两项', JSON.stringify(derived) === JSON.stringify([
    { id: 'addon-bank', name: '银行对公账户开通', price: 200 },
    { id: 'addon-tax', name: '电子税务局开户', price: 100 },
  ]));
  ok('派生结果就是 { id, name, price } 三样', derived.every((a) => Object.keys(a).sort().join(',') === 'id,name,price'));
  ok('bundle 档没有自选项可派生', addonsOf(quoteFor('bundle_small').items).length === 0);
  ok('单项加购也只派生一项', addonsOf(quoteFor('standard', ['addon-social']).items).map((a) => a.id).join(',') === 'addon-social');
  ok('只勾一项时名称与价格正确', (() => {
    const only = addonsOf(quoteFor('standard', ['addon-social']).items);
    return only.length === 1 && only[0].name === '办理社保公积金开户' && only[0].price === 100;
  })());
  ok(
    '套餐内含项没有混进 addons（服务端按 tier 自己映射）',
    addonsOf(planOf('standard').items).every((a) => a.id.startsWith('addon-'))
  );
  ok('bundle 档的 addons 是空数组而不是缺字段', JSON.stringify(addonsOf(planOf('bundle_small').items)) === '[]');
  ok('bundle 两档的 selectedTier 仍然如实带着', planOf('bundle_small').selectedTier === 'bundle_small' && planOf('bundle_general').selectedTier === 'bundle_general');
}

/* ------------------------------------------------- 目录定价与企业零申报加购 */

{
  const catalog = OPTIONAL_ADDON_SERVICES;
  ok(
    '自选目录四项（含企业零申报）',
    catalog.map((s) => s.id).join(',') === 'addon-bank,addon-tax,addon-social,addon-zero-tax'
  );
  ok('每一项都有大于实收价的划线原价', catalog.every((s) => typeof s.originalPrice === 'number' && s.originalPrice > s.price));
  ok('ALL_ADDON_IDS 与目录完全一致', ALL_ADDON_IDS.join(',') === catalog.map((s) => s.id).join(','));

  const zero = catalog.find((s) => s.id === 'addon-zero-tax');
  ok(
    '零申报：名称 / 实收 600 / 原价 1200 / 按年',
    Boolean(zero) &&
      zero?.name === '企业零申报服务（全年12个月）' &&
      zero?.price === 600 &&
      zero?.originalPrice === 1200 &&
      zero?.unit === '年'
  );

  const zeroItem = quoteFor('standard', ['addon-zero-tax']).items.find((item) => item.id === 'addon-zero-tax');
  ok('零申报进了报价明细', Boolean(zeroItem) && zeroItem?.price === 600 && zeroItem?.originalPrice === 1200);
  ok('零申报明细的 tag 带价与单位', zeroItem?.tag === '自选增值 ¥600/年');
  ok(
    '零申报派生成 { id, name, price }',
    JSON.stringify(addonsOf(quoteFor('standard', ['addon-zero-tax']).items)) ===
      JSON.stringify([{ id: 'addon-zero-tax', name: '企业零申报服务（全年12个月）', price: 600 }])
  );
  ok('旧存档里的 addon-zero-tax 也能读回', normalizeAddons(['addon-zero-tax'])[0]?.price === 600);

  const four = quoteFor('standard', ['addon-bank', 'addon-tax', 'addon-social', 'addon-zero-tax']);
  ok('四项加购计费 = 基准 600 + 四项实收价之和', four.finalPrice === 600 + 200 + 100 + 100 + 600);
  ok('四项加购的原价合计含零申报的 1200', four.totalOriginal === 800 + 600 + 300 + 400 + 300 + 300 + 1200);
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
      JSON.stringify([{ id: 'addon-tax', name: '电子税务局开户', price: 100 }])
  );
  ok('存档里自带的名称与价格优先', normalizeAddons([{ id: 'addon-tax', name: '自定义名', price: 1 }])[0].name === '自定义名');
  ok('认不出的 id 丢掉', normalizeAddons(['addon-unknown', { id: 'item-bnd-gov' }]).length === 0);
  ok('重复 id 只留第一个', normalizeAddons(['addon-bank', { id: 'addon-bank' }]).length === 1);
  ok(
    '乱七八糟的存档收成空数组',
    [undefined, null, 'addon-bank', 42, {}, []].every((value) => normalizeAddons(value).length === 0)
  );
}

console.log(`\n${passed} 项通过，${failed} 项失败`);
if (failed > 0) process.exit(1);
