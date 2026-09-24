/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 服务报价：三档套餐各自的报价明细、自选增值服务目录，以及费用计算。
 *
 * 报价只服务 ProposalStep 一个组件，所以与它同目录；把问卷答案与报价拼成
 * 一份完整 RegistrationPlan 的逻辑在 ../plan.ts。
 */

import { OptionalAddonService, PlanAddon, QuotationItem, ServiceTierType, TierQuote } from '../types';

export const ALL_ADDON_IDS = ['addon-bank', 'addon-tax', 'addon-social', 'addon-zero-tax'];

/**
 * 套餐档位白名单。报价（`quoteFor`）与存档解析（`planDraft` 的 `tierOf`）共用这一份：
 * 页面认的档位与存回来的档位必须永远一致，认不出的档位一律回落到默认档。
 */
export const ALL_TIER_IDS: ServiceTierType[] = ['bundle_small', 'bundle_general', 'standard'];

/** 报价明细里靠这个前缀区分自选增值服务与套餐内含项（`item-*`） */
const ADDON_PREFIX = 'addon-';

export const isAddonItemId = (id: string): boolean => id.startsWith(ADDON_PREFIX);

export const OPTIONAL_ADDON_SERVICES: OptionalAddonService[] = [
  {
    id: 'addon-bank',
    name: '银行对公账户开通',
    desc: '合作商业银行免排队专属绿色通道，专人对接协助开立企业基本户、办理企业网银U盾及结算权限',
    price: 200,
    originalPrice: 400,
    unit: '次',
    defaultSelected: false
  },
  {
    id: 'addon-tax',
    name: '电子税务局开户',
    desc: '国家税务总局新电局税种核定、财务负责人实名绑定、数电发票开票额度核定及首月开业建账辅导',
    price: 100,
    originalPrice: 300,
    unit: '次',
    defaultSelected: false
  },
  {
    id: 'addon-social',
    name: '办理社保公积金开户',
    desc: '办理企业社保局独立单位专户开户、住房公积金管理中心单位缴存登记开户设立，开具官方设立凭据',
    price: 100,
    originalPrice: 300,
    unit: '次',
    defaultSelected: false
  },
  {
    id: 'addon-zero-tax',
    name: '企业零申报服务（全年12个月）',
    desc: '专人按期代办月度/季度增值税及附加税、企业所得税零申报，出具官方申报凭据，含年度所得税汇算清缴与年报指导',
    price: 600,
    originalPrice: 1200,
    unit: '年',
    defaultSelected: false
  }
];

/**
 * 从一份报价明细里取出**已勾选的自选增值服务**，收成存档与请求体共用的形状。
 *
 * 这是「自选项」唯一的派生入口：本地存档（App 存 `1b_copreg_plan_form`）与确认接口的
 * `formData.addons` 都调它，所以存下去的和发出去的永远是同一批对象、同一个价格。
 * 顺序固定为报价明细的顺序（银行开户 → 税局开户 → 社保公积金开户 → 企业零申报），与勾选先后无关。
 */
export const addonsOf = (items: QuotationItem[]): PlanAddon[] =>
  items
    .filter(item => isAddonItemId(item.id))
    .map(item => ({ id: item.id, name: item.name, price: item.price }));

/**
 * 存档里的 `addons` 收口：新旧两种形状都认，认不出的项丢掉。
 *
 * 新存档是 `addonsOf` 那种对象数组；旧存档（本次改动之前）是 id 字符串数组 ——
 * 都要认，否则用户刷新一下勾过的自选项就没了。名称与价格以存档里的为准，
 * 缺了才回落到目录里的值（`OPTIONAL_ADDON_SERVICES`）。重复 id 只留第一个。
 */
export const normalizeAddons = (value: unknown): PlanAddon[] => {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const out: PlanAddon[] = [];
  for (const entry of value) {
    const raw = (entry ?? {}) as Record<string, unknown>;
    const id = typeof entry === 'string' ? entry.trim() : typeof raw.id === 'string' ? raw.id.trim() : '';
    const catalog = OPTIONAL_ADDON_SERVICES.find(service => service.id === id);
    if (catalog === undefined || seen.has(catalog.id)) continue;
    seen.add(catalog.id);

    const name = typeof raw.name === 'string' && raw.name.trim() !== '' ? raw.name.trim() : catalog.name;
    const price = typeof raw.price === 'number' && Number.isFinite(raw.price) ? raw.price : catalog.price;
    out.push({ id: catalog.id, name, price });
  }
  return out;
};

/**
 * 按套餐 + 自选增值服务算报价。
 * 企业注册服务按行项目累加；全年无忧是一口价全包，自选服务已内置在套餐里，
 * 开关不影响价格。
 */
export function quoteFor(tier: ServiceTierType, addons: string[] = []): TierQuote {
  // ServiceTierType 本身就只有三档，不再做旧版 'bundle' + taxpayerTier 的兼容转换
  const normalizedTier: ServiceTierType = tier;
  const activeAddons =
    tier === 'standard' ? addons.filter(id => ALL_ADDON_IDS.includes(id)) : [];

  let items: QuotationItem[] = [];
  let tierName = '';
  let deliverables: string[] = [];

  if (normalizedTier === 'standard') {
    tierName = '企业注册服务';
    items = [
      {
        id: 'item-std-gov',
        name: '全程政务网申代办及营业执照正副本',
        desc: '字号自主申报核准、新《公司法》章程规范备案、政务网申材料编制送审、全程代办并领办纸质营业执照正副本原件',
        price: 600,
        originalPrice: 800,
        tag: '政务代办'
      },
      {
        id: 'item-std-seal',
        name: '公安备案防伪芯片印章全套（5枚）',
        desc: '企业法定名称公章、财务专用章、法定代表人名章、发票专用章、合同专用章（含公安特行备案芯片防伪印鉴系统登记）',
        price: 0,
        originalPrice: 600,
        isFree: true,
        tag: '惠企政策全免'
      },
      {
        id: 'item-std-fee',
        name: '现行市监登记规费与电子营业执照',
        desc: '国家减负惠企政策：免收工商设立行政登记规费，同步领办国家数字签名电子营业执照',
        price: 0,
        originalPrice: 300,
        isFree: true,
        tag: '政务规费全免'
      }
    ];

    deliverables = [
      '营业执照正副本（纸质原件 + 电子营业执照）',
      '公安备案防伪芯片印章5枚（公章、财务章、发票章、合同章、法人章）',
      '公司章程及股东会决议书（工商归档备案全套版）'
    ];
  } else if (normalizedTier === 'bundle_small') {
    tierName = '全年无忧服务（小规模）';
    items = [
      {
        id: 'item-bnd-gov',
        name: '全程政务网申代办及营业执照正副本【含企业注册套餐】',
        desc: '包含【企业注册服务】：字号申报、新《公司法》章程规范备案、政务网申材料编制送审、领办纸质营业执照正副本原件',
        price: 0,
        originalPrice: 800,
        isFree: true,
        tag: '已含企业注册套餐'
      },
      {
        id: 'item-bnd-seal',
        name: '公安备案防伪芯片印章全套（5枚）【含企业注册套餐】',
        desc: '包含【企业注册服务】：公章、财务专用章、法人名章、发票专用章、合同专用章（含公安特行防伪芯片系统备案）',
        price: 0,
        originalPrice: 600,
        isFree: true,
        tag: '已含企业注册套餐'
      },
      {
        id: 'item-bnd-fee',
        name: '现行市监登记规费与电子营业执照',
        desc: '国家行政审批登记规费全免，同步开通国家电子营业执照系统',
        price: 0,
        originalPrice: 300,
        isFree: true,
        tag: '政务规费全免'
      },
      {
        id: 'item-bnd-account',
        name: '全年财务代记账服务（小规模纳税人 12个月）',
        desc: '资深注册会计师1对1负责：每月原始凭证审核、记账凭证装订、编制资产负债表与利润表、按期纳税申报（增值税、附加税、所得税、个税）及年度汇算清缴',
        price: 2500,
        originalPrice: 4800,
        tag: '小规模记账托管 ¥2,500'
      },
      {
        id: 'item-bnd-bank',
        name: '银行对公账户开通',
        desc: '合作商业银行免排队专属绿色通道，专人对接协助开立企业基本户、办理企业网银U盾及结算权限',
        price: 0,
        originalPrice: 200,
        isFree: true,
        tag: '全年无忧必选服务'
      },
      {
        id: 'item-bnd-tax',
        name: '电子税务局开户',
        desc: '国家税务总局新电局税种核定、财务负责人实名绑定、数电发票开票额度核定及首月开业建账辅导',
        price: 0,
        originalPrice: 300,
        isFree: true,
        tag: '全年无忧必选服务'
      },
      {
        id: 'item-bnd-social-setup',
        name: '办理社保公积金开户',
        desc: '办理企业社保局独立单位专户开户、住房公积金管理中心单位缴存登记开户设立，开具官方设立凭据',
        price: 0,
        originalPrice: 200,
        isFree: true,
        tag: '全年无忧必选服务'
      },
      {
        id: 'item-bnd-social-service',
        name: '社保公积金服务',
        desc: '社保公积金系统企业专属专户全年合规状态维护与基数核定指导（注：本项不含员工增减员及代缴申报）',
        price: 0,
        originalPrice: 1000,
        isFree: true,
        tag: '全年无忧默认服务'
      }
    ];

    deliverables = [
      '营业执照正副本（纸质原件 + 电子营业执照）【包含企业注册套餐】',
      '公安备案防伪芯片印章5枚（公章、财务章、发票章、合同章、法人章）【包含企业注册套餐】',
      '公司章程及股东会决议书（工商归档备案全套版）【包含企业注册套餐】',
      '全年小规模财务代记账服务协议与12期财务凭证账簿及纳税申报表',
      '银行基本户开户信息表与网银U盾',
      '电子税务局企业身份开通与新电局实名绑定凭据',
      '企业社保与住房公积金独立单位专户设立凭据'
    ];
  } else {
    tierName = '全年无忧服务（一般纳税人）';
    items = [
      {
        id: 'item-bnd-gov',
        name: '全程政务网申代办及营业执照正副本【含企业注册套餐】',
        desc: '包含【企业注册服务】：字号申报、新《公司法》章程规范备案、政务网申材料编制送审、领办纸质营业执照正副本原件',
        price: 0,
        originalPrice: 800,
        isFree: true,
        tag: '已含企业注册套餐'
      },
      {
        id: 'item-bnd-seal',
        name: '公安备案防伪芯片印章全套（5枚）【含企业注册套餐】',
        desc: '包含【企业注册服务】：公章、财务专用章、法人名章、发票专用章、合同专用章（含公安特行防伪芯片系统备案）',
        price: 0,
        originalPrice: 600,
        isFree: true,
        tag: '已含企业注册套餐'
      },
      {
        id: 'item-bnd-fee',
        name: '现行市监登记规费与电子营业执照',
        desc: '国家行政审批登记规费全免，同步开通国家电子营业执照系统',
        price: 0,
        originalPrice: 300,
        isFree: true,
        tag: '政务规费全免'
      },
      {
        id: 'item-bnd-account',
        name: '全年财务代记账服务（一般纳税人 12个月）',
        desc: '资深注册会计师1对1负责：每月增值税专用发票进项认证勾选抵扣、原始凭证审核、记账凭证装订、编制财务报表、纳税申报及年度汇算清缴',
        price: 3000,
        originalPrice: 5800,
        tag: '一般人记账托管 ¥3,000'
      },
      {
        id: 'item-bnd-bank',
        name: '银行对公账户开通',
        desc: '合作商业银行免排队专属绿色通道，专人对接协助开立企业基本户、办理企业网银U盾及结算权限',
        price: 0,
        originalPrice: 200,
        isFree: true,
        tag: '全年无忧必选服务'
      },
      {
        id: 'item-bnd-tax',
        name: '电子税务局开户',
        desc: '国家税务总局新电局税种核定、财务负责人实名绑定、数电发票开票额度核定及首月开业建账辅导',
        price: 0,
        originalPrice: 300,
        isFree: true,
        tag: '全年无忧必选服务'
      },
      {
        id: 'item-bnd-social-setup',
        name: '办理社保公积金开户',
        desc: '办理企业社保局独立单位专户开户、住房公积金管理中心单位缴存登记开户设立，开具官方设立凭据',
        price: 0,
        originalPrice: 200,
        isFree: true,
        tag: '全年无忧必选服务'
      },
      {
        id: 'item-bnd-social-service',
        name: '社保公积金服务',
        desc: '社保公积金系统企业专属专户全年合规状态维护与基数核定指导（注：本项不含员工增减员及代缴申报）',
        price: 0,
        originalPrice: 1000,
        isFree: true,
        tag: '全年无忧默认服务'
      }
    ];

    deliverables = [
      '营业执照正副本（纸质原件 + 电子营业执照）【包含企业注册套餐】',
      '公安备案防伪芯片印章5枚（公章、财务章、发票章、合同章、法人章）【包含企业注册套餐】',
      '公司章程及股东会决议书（工商归档备案全套版）【包含企业注册套餐】',
      '全年一般纳税人财务代记账服务协议与12期财务账簿及专票申报底稿',
      '银行基本户开户信息表与网银U盾',
      '电子税务局企业身份开通与新电局实名绑定凭据',
      '企业社保与住房公积金独立单位专户设立凭据'
    ];
  }

  // 自选增值服务：仅在企业注册服务中提供可选加购。
  // 明细直接由目录（OPTIONAL_ADDON_SERVICES）生成，不再逐项手写一份 —— 改价时两处会漂移。
  if (normalizedTier === 'standard') {
    for (const service of OPTIONAL_ADDON_SERVICES) {
      if (!activeAddons.includes(service.id)) continue;
      items.push({
        id: service.id,
        name: service.name,
        desc: service.desc,
        price: service.price,
        // 没有划线原价就拿实收价顶上，折扣算 0
        originalPrice: service.originalPrice ?? service.price,
        tag: `自选增值 ¥${service.price}/${service.unit}`
      });
    }
  }

  const totalOriginal = items.reduce((sum, it) => sum + it.originalPrice, 0);

  // 费用计算：全年无忧服务一口价全包（小规模2500，一般纳税人3000），关闭自选服务不减价；企业注册服务基准600元加单项自选费
  let finalPrice = 0;
  if (normalizedTier === 'standard') {
    finalPrice = items.reduce((sum, it) => sum + it.price, 0);
  } else if (normalizedTier === 'bundle_small') {
    finalPrice = 2500;
  } else {
    finalPrice = 3000;
  }
  const totalDiscount = Math.max(0, totalOriginal - finalPrice);

  return {
    selectedTier: normalizedTier,
    taxpayerTier: normalizedTier === 'bundle_general' ? 'general' : 'small',
    tierName,
    items,
    deliverables,
    selectedAddons: activeAddons,
    totalOriginal,
    totalDiscount,
    finalPrice
  };
}
