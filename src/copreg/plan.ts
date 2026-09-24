/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 注册方案生成：把问卷答案与套餐报价拼成一份完整的 RegistrationPlan。
 *
 * AI_INDUSTRY_TEMPLATES 是**本地**行业匹配模型 —— 自从 AI 智能填充改走服务端
 * （见 aiFill.ts）之后，它就只服务于方案生成这一条路了。
 */

import { RegistrationPlan, SurveyData, TierQuote } from './types';

/**
 * 问卷里「涉及敏感行业要素」的固定选项。SurveyStep 的勾选按钮和 AI 智能填充的
 * 返回值过滤都以这一份为准：服务端承诺 sensitive 只在这几个标签里取值，多出来的
 * 一律丢掉 —— 那样会变成表单上渲染不出、也删不掉的幽灵选项。
 */
export const SENSITIVE_OPTIONS = [
  '教培', '医疗/器械', '食品/餐饮', '进出口', '直播/MCN',
  '金融/理财', '人力/劳务', '建筑/施工', '危化/环保', '网络文化/ICP', '其他'
];

export interface IndustryTemplate {
  id: string;
  keys: string[];
  name: string;
  companyType: string;
  suggestedCapital: string;
  taxType: string;
  taxReason: string;
  scope: string[];
  license: string[];
  sensitive: string[];
  riskTips: string[];
}

export const AI_INDUSTRY_TEMPLATES: IndustryTemplate[] = [
  {
    id: 'crossBorder',
    keys: ['跨境', '电商', '进出口', '外贸', '海外', '出口', '独立站', '亚马逊', 'shopee', 'lazada', '国际', '出海'],
    name: '跨境电商与出海贸易',
    companyType: '有限责任公司（自然人投资或控股）',
    suggestedCapital: '100 万元人民币（建议认缴5年内分期实缴）',
    taxType: '增值税小规模纳税人（年销售额500万以内享税收优惠，后续达标平滑升级一般纳税人）',
    taxReason: '初创阶段单月开票平稳，小规模纳税人可充分享受月度10万或季度30万以内免征增值税优惠政策。',
    scope: [
      '互联网销售（除销售需要许可的商品）',
      '货物进出口',
      '技术进出口',
      '供应链管理服务',
      '国内贸易代理',
      '国际货物运输代理',
      '信息技术咨询服务',
      '广告设计、代理'
    ],
    license: [
      '海关进出口收发货人备案（多证合一）',
      '对外贸易经营者备案',
      '外汇管理局名录登记与跨境结汇账户开立',
      'ICP/EDI电信业务备案'
    ],
    sensitive: ['进出口'],
    riskTips: [
      '跨境电商涉及跨境结汇合规，银行基本户开立后需及时向外汇局办理“贸易外汇收支企业名录”登记。',
      '新《公司法》实施后，认缴注册资本需在成立之日起5年内实缴完毕，建议资金规模不宜虚高，100万元适中稳健。',
      '商品如涉及食品、美妆等品类需前置/后置食品经营许可或化妆品经营备案。'
    ]
  },
  {
    id: 'tech',
    keys: ['软件', '技术', '开发', 'saas', 'it', '互联网', '平台', '系统', '科技', '信息', '数据', '数字化', '小程序', 'app', '人工智能', 'ai'],
    name: '软件和信息技术服务',
    companyType: '科技型有限责任公司',
    suggestedCapital: '100 万元人民币',
    taxType: '按开票需求评估：若直接面向大中型政企客户需开6%专票建议直接一般纳税人，否则首选小规模纳税人',
    taxReason: '科技类研发前期投入高、研发费用加计扣除政策利好，根据合同付款方要求决定纳税人身份。',
    scope: [
      '软件开发',
      '信息技术咨询服务',
      '技术服务、技术开发、技术咨询、技术交流、技术转让、技术推广',
      '计算机系统服务',
      '数据处理和存储支持服务',
      '人工智能应用软件开发',
      '网络与信息安全软件开发'
    ],
    license: [
      '国家增值电信业务经营许可证（ICP/EDI许可证）',
      '公安部网络安全等级保护（等保二级/三级）',
      '软件著作权登记（软著）'
    ],
    sensitive: ['网络文化/ICP'],
    riskTips: [
      '若提供在线付费订阅或撮合交易，需在设立后尽快申请ICP/EDI电信牌照。',
      '核心技术骨干持股建议设立持股平台（有限合伙企业）以稳定控制权并便于后续融资。'
    ]
  },
  {
    id: 'food',
    keys: ['餐饮', '食品', '饮食', '餐厅', '外卖', '烘焙', '咖啡', '茶饮', '生鲜'],
    name: '餐饮管理与食品经营',
    companyType: '有限责任公司',
    suggestedCapital: '50 万元人民币',
    taxType: '增值税小规模纳税人',
    taxReason: '餐饮终端消费者开票多为普票，小规模纳税人增值税征收率低，税负更轻。',
    scope: [
      '餐饮管理',
      '食品销售（仅销售预包装食品）',
      '外卖递送服务',
      '餐饮服务',
      '日用品销售',
      '企业管理咨询'
    ],
    license: [
      '食品经营许可证（后置许可，需场地现场核查）',
      '从业人员健康证',
      '生态环境部门排水排污备案',
      '消防安全检查合格意见书'
    ],
    sensitive: ['食品/餐饮'],
    riskTips: [
      '餐饮场地必须具备商业或餐饮用途产权证明，严禁在居民住宅楼内开设产生油烟餐饮。',
      '先办营业执照，再申请食品经营许可证并接受现场踏勘方可正式对外营业。'
    ]
  },
  {
    id: 'media',
    keys: ['文化', '传媒', '直播', '广告', '影视', '自媒体', 'mcn', '短视频', '内容', '演艺'],
    name: '文化传媒与数字创意',
    companyType: '文化传媒有限责任公司',
    suggestedCapital: '100 万元人民币',
    taxType: '小规模纳税人（后期根据签约平台结算规模可随时申请升为一般纳税人）',
    taxReason: '初期签约主播与品牌商赞助阶段流水多变，小规模纳税人管理成本低、报税简便。',
    scope: [
      '组织文化艺术交流活动',
      '广告设计、代理、发布',
      '企业形象策划',
      '摄影扩印服务',
      '数字内容制作服务（不含出版发行）',
      '文化娱乐经纪人服务',
      '互联网销售（除销售需要许可的商品）'
    ],
    license: [
      '广播电视节目制作经营许可证',
      '网络文化经营许可证（文网文）',
      '演出经纪机构设立审批（如涉及艺人/主播经纪）'
    ],
    sensitive: ['直播/MCN', '网络文化/ICP'],
    riskTips: [
      '涉及带货直播的，应在营业执照经营范围中务必体现互联网销售，并在开播前完成各平台企业号实名报备。',
      '如涉及艺人签约抽成，需注意演出经纪资质，避免无资质违规经营风险。'
    ]
  },
  {
    id: 'consulting',
    keys: ['咨询', '服务', '管理', '人力', '猎头', '财务', '财税', '代理', '法务'],
    name: '商务咨询与企业服务',
    companyType: '咨询服务有限责任公司',
    suggestedCapital: '50 万元人民币',
    taxType: '增值税小规模纳税人',
    taxReason: '咨询类进项发票较少，小规模纳税人可享受3%征收率按1%计征的普惠减税优惠。',
    scope: [
      '企业管理咨询',
      '信息咨询服务（不含许可类信息咨询服务）',
      '社会经济咨询服务',
      '市场营销策划',
      '会议及展览服务',
      '财务咨询（不含代理记账）'
    ],
    license: [
      '代理记账许可证（仅在涉及代理记账业务时需申请）',
      '人力资源服务许可证（仅涉及劳务中介/人才猎头时需申请）'
    ],
    sensitive: ['人力/劳务'],
    riskTips: [
      '咨询行业人员流动灵活，建议设立之初即规范劳动合同与知识产权保密协议。',
      '注意“代理记账”与“财务咨询”界限，未获财政部门代理记账许可证前不得对外提供代理记账服务。'
    ]
  }
];

export const DEFAULT_AI_TEMPLATE = AI_INDUSTRY_TEMPLATES[0];

export interface IndustryMatch {
  template: IndustryTemplate;
  /** 一个关键词都没命中时 template 只是兜底模板，调用方要据此决定用不用行业内容 */
  matched: boolean;
}

/** 按问卷里的公司描述与业务描述匹配行业模型，命中关键词最多的胜出 */
export function matchIndustryTemplate(survey: SurveyData): IndustryMatch {
  const text = `${survey.companyDesc} ${survey.bizDesc}`.toLowerCase();
  let template = DEFAULT_AI_TEMPLATE;
  let maxScore = 0;

  AI_INDUSTRY_TEMPLATES.forEach(tpl => {
    const score = tpl.keys.filter(k => text.includes(k.toLowerCase())).length;
    if (score > maxScore) {
      maxScore = score;
      template = tpl;
    }
  });

  return { template, matched: maxScore > 0 };
}

/**
 * 生成方案。行业相关内容只在命中行业模型时出现，没命中就留空 —— 否则等于替
 * 用户选了一个他没选过的行业。
 */
export function buildPlan(survey: SurveyData, quote: TierQuote): RegistrationPlan {
  const { template: matched, matched: industryMatched } = matchIndustryTemplate(survey);

  // 套餐那部分整块由报价决定，这里按原字段名取出来，下面的字段表才读得顺
  const {
    selectedTier: normalizedTier,
    taxpayerTier: autoTaxpayerTier,
    tierName,
    items,
    selectedAddons: activeAddons,
    totalOriginal,
    totalDiscount,
    finalPrice,
    deliverables
  } = quote;

  return {
    selectedTier: normalizedTier,
    taxpayerTier: autoTaxpayerTier,
    tierName,
    // 名称方案只有服务端架构诊断给得出来（本地没有命名能力），拿不到就留空：
    // 方案页空值时整块不渲染，不拿企业描述前 12 个字硬凑一个「名称方案」糊弄用户
    companyNameProposal: '',
    companyType: industryMatched ? matched.companyType : '',
    taxpayerIdentity: autoTaxpayerTier === 'general'
      ? '增值税一般纳税人（满足客户大额专票开具与全额进项税抵扣）'
      : '增值税小规模纳税人（享受月度10万或季度30万以内免征增值税优惠）',
    taxReason: autoTaxpayerTier === 'general'
      ? '由于涉及专票开具或预计年销售额较高，选择一般纳税人便于下游合作企业进项抵扣与招投标。'
      : '初创阶段轻资产运营，小规模纳税人申报简便、充分享受国家普惠性减税降费优惠政策。',
    // 用户自填的金额只是个数字串，补上单位才和「是」那条分支读起来一致；
    // 桥接层要纯数字时会用 digitsOf 把单位剥掉，不用担心
    capitalAmount:
      survey.capitalRec === '否' ? `${survey.capitalAmount} 万元人民币` : '建议 100 万元人民币',
    capitalAdvice: '遵循新《公司法》注册资本5年内实缴规则，出资方式可选择货币、知识产权或实物，建议股东制定分期缴资计划。',
    registeredAddressAdvice: survey.regAddress.startsWith('是')
      ? '我们已为您匹配享受园区政策的合规商务秘书集群托管地址，支持合法对公银行开户与工商年报。'
      : survey.regAddress.startsWith('否')
      ? '使用自有办公场地注册需提供产权证复印件及租赁协议，确保房屋规划用途符合登记标准。'
      : '',
    preQualifications: survey.sensitive.includes('进出口')
      ? ['海关进出口收发货人登记', '外汇管理局名录申报']
      : ['名称自主申报核准'],
    postQualifications: survey.license.length > 0
      ? survey.license
      : industryMatched
      ? matched.license
      : [],
    riskTips: industryMatched ? matched.riskTips : [],
    // 完整报告只有服务端架构诊断给得出来；本地模板方案没有，方案页据此回落到上面的平铺字段
    report: null,
    items,
    selectedAddons: activeAddons,
    totalOriginal,
    totalDiscount,
    finalPrice,
    estimatedWorkdays: 3,
    deliverables
  };
}
