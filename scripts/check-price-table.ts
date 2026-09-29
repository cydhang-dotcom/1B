/**
 * 价目表自检：三档套餐的价目、划线原价与明细标签，**对齐 GitHub 设计稿**
 * （`cydhang-dotcom/copreg` 的 `src/data/mockData.ts`：600 元档 = 「企业注册服务」）。
 * 不联网、不碰 React、不开浏览器。
 *   npx tsx scripts/check-price-table.ts
 *
 * 覆盖四件事：
 *   1. **三档基准价**：企业注册服务 600（600 元档不改）、全年无忧（小规模）2,500、全年无忧（一般纳税人）3,000；
 *   2. **明细价目**：每项的实收价与划线原价（含套餐内含项的 0 元项），以及由此算出的原价合计 / 已省；
 *   3. **明细标签**：免费的标配项统一「免除」，付费的记账项标「小规模记账托管 ¥2,500」/「一般人记账托管 ¥3,000」；
 *   4. **两个 bundle 的同名项必须逐字一致**（只改一边会让两档对不上），且每项划线价都大于实收价。
 */
import { ALL_ADDON_IDS, OPTIONAL_ADDON_SERVICES, quoteFor } from '../src/copreg/components/proposalQuote';
import type { QuotationItem } from '../src/copreg/types';

let passed = 0;
let failed = 0;

function ok(label: string, condition: boolean, extra = '') {
  if (condition) {
    passed += 1;
    console.log(`✓ ${label}`);
  } else {
    failed += 1;
    console.error(`✗ ${label}${extra ? ` —— ${extra}` : ''}`);
  }
}

const itemOf = (items: QuotationItem[], id: string) => items.find((item) => item.id === id);

/** 设计稿（copreg mockData）里每种明细的实收价 / 划线原价 / 标签 */
const EXPECTED: Record<string, { price: number; originalPrice: number; tag: string }> = {
  'item-std-gov': { price: 600, originalPrice: 800, tag: '政务代办' },
  'item-std-seal': { price: 0, originalPrice: 600, tag: '免除' },
  'item-std-fee': { price: 0, originalPrice: 300, tag: '免除' },
  'item-bnd-gov': { price: 0, originalPrice: 800, tag: '免除' },
  'item-bnd-seal': { price: 0, originalPrice: 600, tag: '免除' },
  'item-bnd-fee': { price: 0, originalPrice: 300, tag: '免除' },
  'item-bnd-bank': { price: 0, originalPrice: 400, tag: '免除' },
  'item-bnd-tax': { price: 0, originalPrice: 300, tag: '免除' },
  'item-bnd-social-setup': { price: 0, originalPrice: 300, tag: '免除' },
  'item-bnd-social-service': { price: 0, originalPrice: 200, tag: '免除' },
  'item-bnd-account-小规模': { price: 2500, originalPrice: 3600, tag: '小规模记账托管 ¥2,500' },
  'item-bnd-account-一般纳税人': { price: 3000, originalPrice: 4600, tag: '一般人记账托管 ¥3,000' },
};

const standard = quoteFor('standard', []);
const standardWithAddons = quoteFor('standard', [...ALL_ADDON_IDS]);
const bundleSmall = quoteFor('bundle_small', []);
const bundleGeneral = quoteFor('bundle_general', []);

/* --------------------------------- 1. 三档基准价 */

ok('600 元档（企业注册服务）实收 ¥600', standard.finalPrice === 600, String(standard.finalPrice));
ok('全年无忧（小规模）实收 ¥2,500', bundleSmall.finalPrice === 2500, String(bundleSmall.finalPrice));
ok('全年无忧（一般纳税人）实收 ¥3,000', bundleGeneral.finalPrice === 3000, String(bundleGeneral.finalPrice));
ok(
  '两档套餐名与设计稿一致',
  standard.tierName === '企业注册服务' &&
    bundleSmall.tierName === '全年无忧服务（小规模）' &&
    bundleGeneral.tierName === '全年无忧服务（一般纳税人）',
  [standard.tierName, bundleSmall.tierName, bundleGeneral.tierName].join(' / ')
);

/* --------------------------------- 2. 明细价目（含划线原价） */

const pairs: Array<[string, QuotationItem | undefined, string]> = [
  ['item-std-gov', itemOf(standard.items, 'item-std-gov'), '企业注册服务'],
  ['item-std-seal', itemOf(standard.items, 'item-std-seal'), '企业注册服务'],
  ['item-std-fee', itemOf(standard.items, 'item-std-fee'), '企业注册服务'],
  ['item-bnd-gov', itemOf(bundleSmall.items, 'item-bnd-gov'), '小规模'],
  ['item-bnd-seal', itemOf(bundleSmall.items, 'item-bnd-seal'), '小规模'],
  ['item-bnd-fee', itemOf(bundleSmall.items, 'item-bnd-fee'), '小规模'],
  ['item-bnd-bank', itemOf(bundleSmall.items, 'item-bnd-bank'), '小规模'],
  ['item-bnd-tax', itemOf(bundleSmall.items, 'item-bnd-tax'), '小规模'],
  ['item-bnd-social-setup', itemOf(bundleSmall.items, 'item-bnd-social-setup'), '小规模'],
  ['item-bnd-social-service', itemOf(bundleSmall.items, 'item-bnd-social-service'), '小规模'],
  ['item-bnd-account-小规模', itemOf(bundleSmall.items, 'item-bnd-account'), '小规模'],
  ['item-bnd-gov', itemOf(bundleGeneral.items, 'item-bnd-gov'), '一般纳税人'],
  ['item-bnd-seal', itemOf(bundleGeneral.items, 'item-bnd-seal'), '一般纳税人'],
  ['item-bnd-fee', itemOf(bundleGeneral.items, 'item-bnd-fee'), '一般纳税人'],
  ['item-bnd-bank', itemOf(bundleGeneral.items, 'item-bnd-bank'), '一般纳税人'],
  ['item-bnd-tax', itemOf(bundleGeneral.items, 'item-bnd-tax'), '一般纳税人'],
  ['item-bnd-social-setup', itemOf(bundleGeneral.items, 'item-bnd-social-setup'), '一般纳税人'],
  ['item-bnd-social-service', itemOf(bundleGeneral.items, 'item-bnd-social-service'), '一般纳税人'],
  ['item-bnd-account-一般纳税人', itemOf(bundleGeneral.items, 'item-bnd-account'), '一般纳税人'],
];

for (const [key, item, where] of pairs) {
  const want = EXPECTED[key];
  ok(
    `${where} ${item?.name ?? key}：实收 ¥${want.price.toLocaleString('en-US')} / 划线 ¥${want.originalPrice.toLocaleString('en-US')}`,
    item !== undefined && item.price === want.price && item.originalPrice === want.originalPrice,
    item ? `实际 ${item.price} / ${item.originalPrice}` : '明细里没有这一项'
  );
}

/* --------------------------------- 3. 标签 */

for (const [key, item, where] of pairs) {
  const want = EXPECTED[key];
  ok(
    `${where} ${item?.name ?? key}：标签「${want.tag}」`,
    item !== undefined && item.tag === want.tag,
    item ? String(item.tag) : '明细里没有这一项'
  );
}

/* --------------------------------- 4. 原价合计 / 已省（由明细算出来，改了原价就该跟着变） */

ok(
  '600 元档：原价合计 ¥1,700、已省 ¥1,100',
  standard.totalOriginal === 1700 && standard.totalDiscount === 1100,
  `${standard.totalOriginal} / ${standard.totalDiscount}`
);
ok(
  '600 元档 + 四项自选：原价合计 ¥3,900、已省 ¥2,300、应收 ¥1,600',
  standardWithAddons.totalOriginal === 3900 &&
    standardWithAddons.totalDiscount === 2300 &&
    standardWithAddons.finalPrice === 1600,
  `${standardWithAddons.totalOriginal} / ${standardWithAddons.totalDiscount} / ${standardWithAddons.finalPrice}`
);
ok(
  '全年无忧（小规模）：原价合计 ¥6,500、已省 ¥4,000',
  bundleSmall.totalOriginal === 6500 && bundleSmall.totalDiscount === 4000,
  `${bundleSmall.totalOriginal} / ${bundleSmall.totalDiscount}`
);
ok(
  '全年无忧（一般纳税人）：原价合计 ¥7,500、已省 ¥4,500',
  bundleGeneral.totalOriginal === 7500 && bundleGeneral.totalDiscount === 4500,
  `${bundleGeneral.totalOriginal} / ${bundleGeneral.totalDiscount}`
);

/* --------------------------------- 5. 结构一致性 */

const bundleItems = (items: QuotationItem[]) => items.filter((item) => item.id.startsWith('item-bnd-'));
const sameSide = bundleItems(bundleSmall.items).every((small) => {
  if (small.id === 'item-bnd-account') return true; // 记账两档本来就不同名不同价
  const general = itemOf(bundleGeneral.items, small.id);
  return (
    general !== undefined &&
    general.name === small.name &&
    general.desc === small.desc &&
    general.price === small.price &&
    general.originalPrice === small.originalPrice &&
    general.tag === small.tag
  );
});
ok('两个 bundle 的同名项逐字一致（名称/描述/价目/标签）', sameSide, '');

ok(
  '每一项的划线原价都大于实收价（0 元项也要有划线价，否则划线显示 ¥0）',
  [...standard.items, ...bundleSmall.items, ...bundleGeneral.items].every(
    (item) => item.originalPrice > item.price
  ),
  ''
);
ok(
  '每一项都有名称与描述（价目表不能出现空白行）',
  [...bundleSmall.items, ...bundleGeneral.items].every(
    (item) => item.name.trim() !== '' && item.desc.trim() !== '' && item.tag !== undefined && item.tag !== ''
  ),
  ''
);
ok(
  '自选增值服务目录与设计稿一致（200/400、100/300、100/300、600/1200）',
  JSON.stringify(OPTIONAL_ADDON_SERVICES.map((s) => [s.id, s.price, s.originalPrice, s.unit])) ===
    JSON.stringify([
      ['addon-bank', 200, 400, '次'],
      ['addon-tax', 100, 300, '次'],
      ['addon-social', 100, 300, '次'],
      ['addon-zero-tax', 600, 1200, '年'],
    ]),
  JSON.stringify(OPTIONAL_ADDON_SERVICES.map((s) => [s.id, s.price, s.originalPrice, s.unit]))
);
ok(
  '自选项只在 600 元档可选（套餐档不重复收加购费）',
  quoteFor('bundle_small', [...ALL_ADDON_IDS]).items.every((item) => !item.id.startsWith('addon-')) &&
    quoteFor('bundle_general', [...ALL_ADDON_IDS]).items.every((item) => !item.id.startsWith('addon-')),
  ''
);

/* --------------------------------- 6. 交付清单与明细顺序（与设计稿同序） */

const COMMON_HEAD = [
  '营业执照正副本（纸质原件 + 电子营业执照）',
  '公安备案防伪芯片印章5枚（公章、财务章、发票章、合同章、法人章）',
  '公司章程及股东会决议书（工商归档备案全套版）',
];
const BUNDLE_TAIL = [
  '银行基本户开户信息表与网银U盾',
  '电子税务局企业身份开通与新电局实名绑定凭据',
  '企业社保与住房公积金独立单位专户设立凭据',
];

ok(
  '600 元档交付清单 3 项与设计稿一致',
  JSON.stringify(standard.deliverables) === JSON.stringify(COMMON_HEAD),
  JSON.stringify(standard.deliverables)
);
ok(
  '小规模交付清单 7 项、含顺序与设计稿一致（代记账协议在最后一条）',
  JSON.stringify(bundleSmall.deliverables) ===
    JSON.stringify([
      ...COMMON_HEAD.map((t) => `${t}【包含企业注册套餐】`),
      ...BUNDLE_TAIL,
      '全年小规模财务代记账服务协议与12期财务凭证账簿及纳税申报表',
    ]),
  JSON.stringify(bundleSmall.deliverables)
);
ok(
  '一般纳税人交付清单 7 项、含顺序与设计稿一致（代记账协议在最后一条）',
  JSON.stringify(bundleGeneral.deliverables) ===
    JSON.stringify([
      ...COMMON_HEAD.map((t) => `${t}【包含企业注册套餐】`),
      ...BUNDLE_TAIL,
      '全年一般纳税人财务代记账服务协议与12期财务账簿及专票申报底稿',
    ]),
  JSON.stringify(bundleGeneral.deliverables)
);
ok(
  '两档套餐的明细也把「代记账」放在最后一条（与设计稿同序）',
  bundleSmall.items[bundleSmall.items.length - 1].id === 'item-bnd-account' &&
    bundleGeneral.items[bundleGeneral.items.length - 1].id === 'item-bnd-account',
  `${bundleSmall.items.map((i) => i.id).join(',')} / ${bundleGeneral.items.map((i) => i.id).join(',')}`
);

console.log(`\n${passed} 项通过，${failed} 项失败`);
if (failed > 0) process.exit(1);
