/**
 * 架构诊断「新结构报告」解析的自检：不联网、不碰 React、不开浏览器。
 *   npx tsx scripts/check-plan-report.ts
 *
 * 覆盖四件事：
 *   1. **新结构能认**：用户实测的那份响应（coreDecisions 四维 + points + diagnosticBar +
 *      industryComplianceTips + pitfallGuides）必须解析出报告，而不是报「未返回可用内容」；
 *   2. **平铺字段从报告派生**：companyType / taxpayerIdentity / capitalAmount /
 *      registeredAddressAdvice / taxReason / capitalAdvice 都有值，且优先取老平铺字段；
 *   3. **本地存档往返不丢**：解析结果再 JSON 一轮、再解析一遍，报告与 points 仍在；
 *   4. **老响应与垃圾响应**：平铺老结构照旧能认，什么都没有的响应仍然判为「无内容」。
 */
import { hasPlanContent, parsePlanSuggestion, parsePlanReport } from '../src/copreg/planReport';

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

/** 用户实测的那份响应，逐字保留 */
const NESTED = {
  reportTitle: '企业组织架构与财税规划评估报告',
  summary:
    '拟设有限责任公司，经营直播带货及烟酒玩具分销，股东为自然人与公司两名；烟草、食品、互联网备案及住所材料均需先核实，注册资本意向金额待补充。',
  diagnosticBar: {
    businessDirection: '直播带货与商品分销',
    shareholderProfile: '两名股东，自然人及公司股东，具体股比待核实',
    premiseArrangement: '需推荐注册地址且拟有办公场地，登记适用性待核实',
    taxIdentityProfile: '初步倾向小规模纳税人，待应税销售额与进项核实',
  },
  coreDecisions: {
    orgStructure: {
      dimensionIndex: '01',
      dimensionTitle: '组织形式与股权架构',
      tag: '两名股东设有限公司',
      recommendedType: '有限责任公司，股比及公司股东信息待核实',
      points: [
        { title: '【股东与股比】', content: '两名股东含自然人与公司股东，需明确各自认缴额、股比和权利义务。' },
        { title: '【治理安排】', content: '建议在章程中约定执行董事、监事或经理设置及议事规则。' },
      ],
    },
    capitalPlanning: {
      dimensionIndex: '02',
      dimensionTitle: '注册资本与出资规划',
      tag: '注册资本意向金额待补充',
      recommendedCapital: '用户未填写具体金额，待核实',
      capitalUnit: '（认缴出资额）',
      points: [{ title: '【认缴期限】', content: '结合启动支出、采购垫资和直播回款周期设定认缴期限。' }],
    },
    taxAndInvoice: {
      dimensionIndex: '03',
      dimensionTitle: '财税身份与发票统筹',
      tag: '专票需求与多收入类型',
      recommendedTaxIdentity: '小规模纳税人初步倾向，待应税销售额、专票需求和进项核实',
      points: [{ title: '【身份判断】', content: '需归集应税销售额、客户专票需求、可抵扣进项和增长预期。' }],
    },
    businessPremise: {
      dimensionIndex: '04',
      dimensionTitle: '经营场所与住所合规',
      tag: '注册地址需推荐',
      recommendedPremise: '需推荐注册地址；如用集中登记地址，须核实其资格与行业适用',
      points: [{ title: '【住所适用】', content: '按拟选地址所在区、房屋性质和登记方式核实。' }],
    },
  },
  industryComplianceTips: ['烟草制品零售、酒类经营、食品经营及直播相关许可备案需向主管部门核实。', '玩具销售需关注质量、标签及认证适用。'],
  pitfallGuides: [
    { step: 1, title: '许可先核', desc: '先按实际销售方式确认许可备案，再提交经营范围。' },
    { step: 2, title: '身份后定', desc: '先测算应税销售额、进项和毛利，再选择或申请身份。' },
    { step: 3, title: '地址可核', desc: '注册地址需可送达、可核查。' },
  ],
  model: 'deepseek-flash',
  recordId: 'QgcjYcfqRh8bSGU4xtMkxs',
  status: 'SUCCESS',
};

function main() {
  // 1. 新结构能认
  const suggestion = parsePlanSuggestion(NESTED);
  const report = suggestion.report;
  ok('新结构解析出报告（不再报「未返回可用内容」）', report !== null);
  ok('hasPlanContent 放行', hasPlanContent(suggestion));

  if (!report) return;

  ok('报告标题', report.reportTitle === '企业组织架构与财税规划评估报告');
  ok('摘要进报告', report.summary.startsWith('拟设有限责任公司'));
  ok('诊断条四项都收', report.diagnosticBar.businessDirection === '直播带货与商品分销' && report.diagnosticBar.taxIdentityProfile.includes('小规模纳税人'));
  ok('维度 01 序号与标题', report.orgStructure.dimensionIndex === '01' && report.orgStructure.dimensionTitle === '组织形式与股权架构');
  ok('维度 01 标签', report.orgStructure.tag === '两名股东设有限公司');
  ok('维度 01 recommendedType 收进 recommended', report.orgStructure.recommended === '有限责任公司，股比及公司股东信息待核实');
  ok('维度 01 points 两条且带标题', report.orgStructure.points.length === 2 && report.orgStructure.points[0].title === '【股东与股比】');
  ok('注册资本结论拼上 capitalUnit', report.capitalPlanning.recommended === '用户未填写具体金额，待核实（认缴出资额）');
  ok('纳税人身份结论', report.taxAndInvoice.recommended === '小规模纳税人初步倾向，待应税销售额、专票需求和进项核实');
  ok('场地结论', report.businessPremise.recommended === '需推荐注册地址；如用集中登记地址，须核实其资格与行业适用');
  ok('行业合规提示两条', report.industryComplianceTips.length === 2);
  ok('避坑指南三条且 step 收成字符串', report.pitfallGuides.length === 3 && report.pitfallGuides[0].step === '1' && report.pitfallGuides[2].title === '地址可核');

  // 2. 平铺字段派生
  ok('companyType 取自组织形式结论', suggestion.companyType === report.orgStructure.recommended);
  ok('taxpayerIdentity 取自纳税人身份结论', suggestion.taxpayerIdentity === report.taxAndInvoice.recommended);
  ok('capitalAmount 取自注册资本结论', suggestion.capitalAmount === report.capitalPlanning.recommended);
  ok('registeredAddressAdvice 取自场地结论', suggestion.registeredAddressAdvice === report.businessPremise.recommended);
  ok('taxReason 由 points 拼出', suggestion.taxReason !== null && suggestion.taxReason.includes('【身份判断】'));
  ok('capitalAdvice 由 points 拼出', suggestion.capitalAdvice !== null && suggestion.capitalAdvice.includes('【认缴期限】'));
  ok('企业名称方案服务端没给 → null（本地块不渲染）', suggestion.companyNameProposal === null);
  ok('前置 / 后置资质服务端没给 → null（保留本地按问卷推的）', suggestion.preQualifications === null && suggestion.postQualifications === null);

  // 3. 本地存档往返
  const roundTripped = parsePlanSuggestion(JSON.parse(JSON.stringify(suggestion)));
  ok('存档往返后报告还在', roundTripped.report !== null && roundTripped.report.reportTitle === report.reportTitle);
  ok('存档往返后 points 还在', roundTripped.report?.orgStructure.points.length === 2);
  ok('存档往返后 recommended 不丢', roundTripped.report?.capitalPlanning.recommended === report.capitalPlanning.recommended);
  ok('单独喂 report 对象也能解析', parsePlanReport({ report })?.orgStructure.tag === '两名股东设有限公司');

  // 4. 老平铺响应 / 垃圾响应
  const flat = parsePlanSuggestion({
    companyType: '有限责任公司',
    taxpayerIdentity: '小规模纳税人',
    riskTips: ['老结构提示'],
  });
  ok('老平铺响应照旧能认（report 为 null）', flat.report === null && flat.companyType === '有限责任公司');
  ok('老平铺响应仍判为有内容', hasPlanContent(flat));

  const empty = parsePlanSuggestion({ model: 'deepseek-flash', recordId: 'X', status: 'SUCCESS' });
  ok('只有状态与单号的响应仍判为无内容', empty.report === null && !hasPlanContent(empty));
  ok('非对象输入不炸', parsePlanSuggestion(null).report === null && parsePlanReport('nope') === null);
  ok('只有标题没有别的也算内容', hasPlanContent(parsePlanSuggestion({ reportTitle: '报告' })));
}

main();

console.log(`\n${passed} 项通过，${failed} 项失败`);
if (failed > 0) process.exit(1);
