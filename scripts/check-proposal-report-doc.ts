/**
 * 方案评估报告文档本体的自检：不联网、不碰 React、不开浏览器、不引 html2canvas。
 *   npx tsx scripts/check-proposal-report-doc.ts
 *
 * 覆盖：
 *   1. **新报告结构优先**：`reportTitle / summary / 四个维度（含 points）/ pitfallGuides /
 *      industryComplianceTips` 都要进正文，且比平铺字段优先；
 *   2. **老响应回落**：`plan.report` 为 null 时走参考实现那套平铺字段与写死建议，正文不空；
 *   3. **转义**：公司描述、经营范围里的 `<script>` 之类不能把文档结构撕开；
 *   4. 编号格式、文件名清洗、打印文档包装（@page A4）、不出现 `undefined`。
 */
import { buildPlan } from '../src/copreg/plan';
import { quoteFor } from '../src/copreg/components/proposalQuote';
import { applyPlanSuggestion, parsePlanSuggestion } from '../src/copreg/planReport';
import {
  buildProposalReportBody,
  buildProposalReportDocument,
  proposalReportFileName,
  reportNoOf,
  reportDateOf,
} from '../src/copreg/proposalReportDoc';
import { PDF_PAGE_MARGIN_MM, pdfPageGeometry, planPdfPages } from '../src/copreg/proposalPdfPages';
import type { SurveyData } from '../src/copreg/types';

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

const survey = (extra: Partial<SurveyData> = {}): SurveyData => ({
  coreNeeds: ['需公司主体'],
  companyDesc: '字号甲乙丙，主营软件开发',
  bizDesc: '为中小企业提供定制软件与运维',
  scope: ['软件开发', '互联网销售'],
  license: [],
  sensitive: [],
  invoiceReq: '不确定',
  monthlyAmount: '10 - 50 万',
  revenue: ['服务费'],
  revenueOther: '',
  shareholderType: ['自然人'],
  shareholderCount: '1 个',
  capitalRec: '否',
  capitalAmount: '100',
  regAddress: '是（需推荐）',
  officeSpace: '否',
  ...extra,
});

const REPORT = {
  reportTitle: '企业组织架构与财税规划评估报告',
  summary: '拟设有限责任公司，经营软件开发与互联网销售。',
  diagnosticBar: {
    businessDirection: '软件开发',
    shareholderProfile: '一名自然人股东',
    premiseArrangement: '需推荐注册地址',
    taxIdentityProfile: '倾向小规模纳税人',
  },
  coreDecisions: {
    orgStructure: {
      dimensionIndex: '01',
      dimensionTitle: '组织形式与股权架构',
      tag: '一人有限公司',
      recommendedType: '有限责任公司（自然人独资）',
      points: [{ title: '【股东与股比】', content: '明确认缴额与出资期限。' }],
    },
    capitalPlanning: {
      dimensionIndex: '02',
      dimensionTitle: '注册资本与出资规划',
      tag: '金额待核实',
      recommendedCapital: '建议 100 万元',
      capitalUnit: '（认缴出资额）',
      points: [{ title: '【认缴期限】', content: '按 5 年规划缴资。' }],
    },
    taxAndInvoice: {
      dimensionIndex: '03',
      dimensionTitle: '财税身份与发票统筹',
      tag: '普票为主',
      recommendedTaxIdentity: '小规模纳税人',
      points: [{ title: '【身份判断】', content: '结合应税销售额判断。' }],
    },
    businessPremise: {
      dimensionIndex: '04',
      dimensionTitle: '经营场所与住所合规',
      tag: '地址需推荐',
      recommendedPremise: '需推荐注册地址',
      points: [{ title: '【住所适用】', content: '核实地址与经营范围适配。' }],
    },
  },
  industryComplianceTips: ['软件开发涉及的知识产权需核实。'],
  pitfallGuides: [{ step: 1, title: '许可先核', desc: '先确认许可备案再提交经营范围。' }],
  model: 'deepseek-flash',
  recordId: 'R1',
  status: 'SUCCESS',
};

const NOW = new Date('2026-09-24T10:00:00');

const withReport = () =>
  applyPlanSuggestion(
    buildPlan(survey(), quoteFor('standard', ['addon-bank'])),
    parsePlanSuggestion(REPORT),
  );
const legacy = () => buildPlan(survey(), quoteFor('standard', []));

function main() {
  /* 编号与文件名 */
  ok('报告编号格式 BB-EV-YYYYMMDD-####', /^BB-EV-20260924-\d{4}$/.test(reportNoOf(NOW)));
  ok('评估基准日中文格式', reportDateOf(NOW) === '2026 年 09 月 24 日');
  ok('文件名清掉非法字符', proposalReportFileName('云帆/盛景:科技*?“”') === '企业商事设立规划评估报告_云帆盛景科技“”.pdf');
  ok('文件名兜底', proposalReportFileName('') === '企业商事设立规划评估报告_企业设立规划评估报告.pdf');

  /* 新结构 */
  const body = buildProposalReportBody({ report: withReport().report, plan: withReport(), survey: survey(), now: NOW });
  ok('报告标题进正文', body.includes('企业组织架构与财税规划评估报告'));
  ok('摘要进正文', body.includes('拟设有限责任公司，经营软件开发与互联网销售。'));
  ok('四个维度标题都进正文', ['组织形式与股权架构', '注册资本与出资规划', '财税身份与发票统筹', '经营场所与住所合规'].every((t) => body.includes(t)));
  ok('维度结论用报告值', body.includes('有限责任公司（自然人独资）') && body.includes('建议 100 万元（认缴出资额）') && body.includes('小规模纳税人'));
  ok('维度 tag 进正文', body.includes('一人有限公司') && body.includes('地址需推荐'));
  ok('points 进正文', body.includes('【股东与股比】') && body.includes('明确认缴额与出资期限。'));
  ok('避坑指南进正文', body.includes('许可先核') && body.includes('先确认许可备案再提交经营范围。'));
  ok('行业合规提示进正文', body.includes('软件开发涉及的知识产权需核实。'));
  ok('第三部分带经营范围', body.includes('软件开发；互联网销售'));
  ok('四个部分标题齐全', ['第一部分', '第二部分', '第三部分', '第四部分'].every((t) => body.includes(t)));
  ok('不出现 undefined', !body.includes('undefined') && !body.includes('null'));

  /* 老响应回落 */
  const legacyBody = buildProposalReportBody({ report: null, plan: legacy(), survey: survey(), now: NOW });
  ok('老响应：正文不为空且仍含四部分', legacyBody.length > 1000 && ['第一部分', '第二部分', '第三部分', '第四部分'].every((t) => legacyBody.includes(t)));
  ok('老响应：用平铺字段的组织形式与资本', legacyBody.includes('有限责任公司') && legacyBody.includes('100 万元人民币'));
  ok('老响应：没有报告摘要时不渲染该块', !legacyBody.includes('拟设有限责任公司，经营软件开发与互联网销售。'));
  ok('老响应：不出现 undefined', !legacyBody.includes('undefined'));

  /* 转义 */
  const injected = buildProposalReportBody({
    report: null,
    plan: legacy(),
    survey: survey({ companyDesc: '<script>alert(1)</script>', scope: ['<b>经营范围</b>'] }),
    now: NOW,
  });
  ok('公司描述被转义', !injected.includes('<script>alert(1)</script>') && injected.includes('&lt;script&gt;'));
  ok('经营范围被转义', !injected.includes('<b>经营范围</b>') && injected.includes('&lt;b&gt;经营范围&lt;/b&gt;'));

  /* 打印文档包装 */
  const doc = buildProposalReportDocument({ report: withReport().report, plan: withReport(), survey: survey(), now: NOW });
  ok('打印文档是完整 HTML', doc.startsWith('<!DOCTYPE html>') && doc.includes('</html>'));
  ok('打印文档 @page A4 无页边距', doc.includes('@page { size: A4; margin: 0; }'));
  ok('打印文档正文与 body 一致', doc.includes('企业组织架构与财税规划评估报告') && doc.includes('第三部分'));

  /* 正文内边距：打印版自带、PDF 版不带来（页边距交给 jsPDF） */
  const baseInput = { report: withReport().report, plan: withReport(), survey: survey(), now: NOW };
  ok('打印版正文自带 A4 内边距', buildProposalReportBody(baseInput).includes('padding:42px 48px'));
  ok(
    'PDF 版正文不自带内边距（否则和页边距叠成双重留白）',
    buildProposalReportBody(baseInput, { pagePadding: false }).includes('padding:0') &&
      !buildProposalReportBody(baseInput, { pagePadding: false }).includes('padding:42px 48px')
  );

  /* PDF 分页与页边距 */
  const geometry = pdfPageGeometry(1588, 210, 297, PDF_PAGE_MARGIN_MM);
  ok('页边距 12mm → 内容 186mm × 273mm', geometry.contentWidthMm === 186 && geometry.contentHeightMm === 273);
  ok('每页内容高度换算成像素', geometry.pageContentHeightPx === Math.floor(273 / (186 / 1588)));

  ok(
    '短文档只有一页且覆盖全高',
    (() => {
      const slices = planPdfPages(1588, 1000, geometry, () => false);
      return slices.length === 1 && slices[0].top === 0 && slices[0].height === 1000;
    })()
  );

  const height = 10000;
  const slices = planPdfPages(1588, height, geometry, (y) => y % 20 === 0);
  ok('长文档切成多页', slices.length > 1);
  ok(
    '切片首尾相接、覆盖整张画布',
    slices[0].top === 0 &&
      slices[slices.length - 1].top + slices[slices.length - 1].height === height &&
      slices.every((slice, index) => index === 0 || slice.top === slices[index - 1].top + slices[index - 1].height)
  );
  ok(
    '除最后一页外都不超过每页内容高度（留出了页边距）',
    slices.slice(0, -1).every((slice) => slice.height <= geometry.pageContentHeightPx)
  );
  ok(
    '切点落在空白行之后（不会把一行字切成两半）',
    slices.slice(0, -1).every((slice) => (slice.top + slice.height - 1) % 20 === 0)
  );

  ok(
    '找不到空白行时按理想切点切（不会死循环）',
    planPdfPages(1588, height, geometry, () => false)
      .slice(0, -1)
      .every((slice) => slice.height === geometry.pageContentHeightPx)
  );

  const backtrack = Math.floor(geometry.pageContentHeightPx * 0.4);
  ok(
    '回退到窗口下沿就停（这一页最多缩短 40%）',
    (() => {
      const capped = planPdfPages(1588, height, geometry, (y) => y === 1400);
      return capped[0].height < geometry.pageContentHeightPx && capped[0].height >= geometry.pageContentHeightPx - backtrack;
    })()
  );
  ok(
    '更早的空白行够不到就不回退（窗口下沿之上不再找）',
    planPdfPages(1588, height, geometry, (y) => y === 1000)[0].height === geometry.pageContentHeightPx
  );
}

main();

console.log(`\n${passed} 项通过，${failed} 项失败`);
if (failed > 0) process.exit(1);
