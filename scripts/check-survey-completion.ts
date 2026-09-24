/**
 * 问卷「已完善」态的自检：不联网、不碰 React、不开浏览器。
 *   npx tsx scripts/check-survey-completion.ts
 *
 * 覆盖：
 *   1. **与提交校验同源**：每个区块的「已完善」判据就是 `surveyRequiredFields` 里该区块
 *      所有必填项都填好 —— 五张卡全打勾时必须能提交，不会出现「都打勾了还被拦」；
 *   2. **逐块点亮**：一段段填，已完成数 0 → 1 → … → 5，且互不串场；
 *   3. **区块内部分填不算完成**：如 03 只选了开票要求、没选月开票额与收入模式，仍是未完善；
 *   4. **注册资本金额跟随「否」**：选「否」必须填金额该块才算完善，选「是」不要求。
 */
import { SURVEY_SECTIONS, surveyCompletion, surveyRequiredFields } from '../src/copreg/surveyCheck';
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

const empty = (): SurveyData => ({
  coreNeeds: [],
  companyDesc: '',
  bizDesc: '',
  scope: [],
  license: [],
  sensitive: [],
  invoiceReq: '',
  monthlyAmount: '',
  revenue: [],
  revenueOther: '',
  shareholderType: [],
  shareholderCount: '',
  capitalRec: '',
  capitalAmount: '',
  regAddress: '',
  officeSpace: '',
});

/** 各区块的「填好它」的增量，按页面顺序 */
const sectionFill = (survey: SurveyData, index: number): SurveyData => {
  switch (index) {
    case 0:
      return { ...survey, coreNeeds: ['需公司主体'] };
    case 1:
      return { ...survey, companyDesc: '字号甲乙丙，主营软件开发', bizDesc: '为中小企业提供定制软件' };
    case 2:
      return { ...survey, invoiceReq: '不确定', monthlyAmount: '10 - 50 万', revenue: ['服务费'] };
    case 3:
      return { ...survey, shareholderType: ['自然人'], shareholderCount: '1 个', capitalRec: '是' };
    default:
      return { ...survey, regAddress: '是（需推荐）', officeSpace: '否' };
  }
};

function main() {
  ok('区块正好是页面上的五段', SURVEY_SECTIONS.join(',') === 'sec-core,sec-biz,sec-invoice,sec-equity,sec-address');

  const blank = surveyCompletion(empty());
  ok('空问卷：五段都未完善、已完成 0 项', SURVEY_SECTIONS.every((s) => !blank.done[s]) && blank.completedCount === 0);
  ok('总项数是 5', blank.totalCount === 5);
  ok('done 的键就是这五段', Object.keys(blank.done).sort().join(',') === [...SURVEY_SECTIONS].sort().join(','));

  // 逐段点亮：第 i 次填充后应恰好完成 i+1 段
  let survey = empty();
  SURVEY_SECTIONS.forEach((section, index) => {
    survey = sectionFill(survey, index);
    const completion = surveyCompletion(survey);
    ok(`填好第 ${index + 1} 段后：该段已完善、已完成 ${index + 1} 项`, completion.done[section] && completion.completedCount === index + 1);
  });
  ok(
    '五段填满后与提交校验完全一致（11 条必填项都 done）',
    surveyCompletion(survey).completedCount === 5 && surveyRequiredFields(survey).every((field) => field.done)
  );

  // 区块内部分填不算完成
  const partialInvoice = surveyCompletion({ ...empty(), invoiceReq: '不确定' });
  ok('03 只选了开票要求 → 仍未完善', partialInvoice.done['sec-invoice'] === false);
  const partialEquity = surveyCompletion({ ...empty(), shareholderType: ['自然人'] });
  ok('04 只选了股东类型 → 仍未完善', partialEquity.done['sec-equity'] === false);
  const partialAddress = surveyCompletion({ ...empty(), regAddress: '是（需推荐）' });
  ok('05 只选了注册地址 → 仍未完善', partialAddress.done['sec-address'] === false);

  // 区块之间互不串场
  const onlyCore = surveyCompletion(sectionFill(empty(), 0));
  ok('只填 01 时其余四段仍是未完善', onlyCore.done['sec-core'] && !onlyCore.done['sec-biz'] && !onlyCore.done['sec-invoice'] && !onlyCore.done['sec-equity'] && !onlyCore.done['sec-address']);

  // 注册资本金额跟随「否」
  const capitalNoWithoutAmount = surveyCompletion({
    ...empty(),
    shareholderType: ['自然人'],
    shareholderCount: '1 个',
    capitalRec: '否',
  });
  ok('04 选「否」但没填金额 → 未完善', capitalNoWithoutAmount.done['sec-equity'] === false);
  const capitalNoWithAmount = surveyCompletion({
    ...empty(),
    shareholderType: ['自然人'],
    shareholderCount: '1 个',
    capitalRec: '否',
    capitalAmount: '100',
  });
  ok('04 选「否」且填了金额 → 已完善', capitalNoWithAmount.done['sec-equity'] === true);
}

main();

console.log(`\n${passed} 项通过，${failed} 项失败`);
if (failed > 0) process.exit(1);
