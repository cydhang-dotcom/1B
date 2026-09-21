/**
 * 第 5 步申报表种子数据的自检：不联网、不碰 React、不开浏览器。
 *   npx tsx scripts/check-registration-seed.ts
 *
 * 覆盖「从前两步转换」的每一条规则，以及同等重要的另一半：**没有来源的字段必须空着**。
 * 之前这份数据是一整套编好的假示例（假企业描述、假身份证号、假委托书 PDF、假股东），
 * 用户看不出哪些是自己填的 —— 所以这里专门断言「不再编数据」。
 */
import {
  MIN_SHAREHOLDER_ROWS,
  capitalWanFrom,
  namesFromProposal,
  orgFromPlan,
  registrationSeedFrom,
  shareholderRowCount,
  shareholdersFromSurvey,
} from '../src/copreg/registrationSeed';
import type { RegistrationPlan, SurveyData } from '../src/copreg/types';

let passed = 0;
let failed = 0;

function ok(label: string, condition: boolean) {
  if (condition) {
    passed += 1;
  } else {
    failed += 1;
    console.error(`✗ ${label}`);
  }
}

const survey = (overrides: Partial<SurveyData> = {}): SurveyData => ({
  coreNeeds: ['需公司主体'],
  companyDesc: '拟设立甲乙丙科技有限公司，主营跨境电商独立站',
  bizDesc: '面向欧美市场销售自有品牌家居用品',
  scope: ['互联网销售', '货物进出口', '供应链管理服务'],
  license: ['增值电信业务经营许可证'],
  sensitive: [],
  invoiceReq: '增值税专用发票',
  monthlyAmount: '10 - 50 万',
  revenue: ['货物销售'],
  revenueOther: '',
  shareholderType: ['自然人'],
  shareholderCount: '2 个',
  capitalRec: '否',
  capitalAmount: '100',
  regAddress: '是（需推荐）',
  officeSpace: '否 · 暂不需要',
  ...overrides,
});

const plan = (overrides: Partial<RegistrationPlan> = {}): RegistrationPlan =>
  ({
    selectedTier: 'bundle_small',
    taxpayerTier: 'small',
    tierName: '全年无忧服务（小规模）',
    companyNameProposal: '',
    companyType: '科技型有限责任公司',
    taxpayerIdentity: '增值税小规模纳税人',
    taxReason: '',
    capitalAmount: '建议 100 万元人民币（认缴）',
    capitalAdvice: '',
    registeredAddressAdvice: '',
    preQualifications: [],
    postQualifications: [],
    riskTips: [],
    items: [],
    selectedAddons: [],
    totalOriginal: 0,
    totalDiscount: 0,
    finalPrice: 2500,
    estimatedWorkdays: 3,
    deliverables: [],
    ...overrides,
  }) as RegistrationPlan;

/* --------------------------------------------------------------- 企业名称 */

{
  const both = namesFromProposal('甲乙丙科技有限公司；备选：甲乙丙（深圳）科技有限公司');
  ok('按分隔符拆出主名与备选名', both[0] === '甲乙丙科技有限公司' && both[1] === '甲乙丙（深圳）科技有限公司');
  ok('不足 3 个的名字位补空串', both[2] === '' && both.length === 3);

  const prefixed = namesFromProposal('建议名称：甲乙丙科技有限公司、甲乙丙商务服务有限公司、甲乙丙供应链有限公司');
  ok('去掉「建议名称：」这类前缀', prefixed[0] === '甲乙丙科技有限公司');
  ok('最多取 3 个', prefixed.length === 3 && prefixed[2] === '甲乙丙供应链有限公司');

  ok('方案没给名称建议时三位全空', namesFromProposal('').every((name) => name === ''));

  // 一整句里没有公司名时，不要把描述塞进名称框（宁可空着）
  const prose = namesFromProposal('不建议使用生僻字，且不得与同行业已有知名企业重名，建议准备三到五个备选字号供核名使用');
  ok('整句描述不会被当名称（超过长度就丢）', prose.every((name) => name.length <= 30));

  ok('只给一个名字时第一位有值、其余空', namesFromProposal('甲乙丙科技有限公司')[1] === '');
}

/* --------------------------------------------------------------- 注册资本 */

{
  ok('问卷里自己填了金额就用它（不取方案那句）', capitalWanFrom(survey(), plan()) === '100');
  ok(
    '问卷选「专家建议」时，从方案的整句话里取第一个数字',
    capitalWanFrom(survey({ capitalRec: '是', capitalAmount: '' }), plan()) === '100'
  );
  ok(
    '整句里第一个数字之后的数字不会被误取',
    capitalWanFrom(survey({ capitalRec: '是', capitalAmount: '' }), plan({ capitalAmount: '建议50万元，不建议低于10万元' })) === '50'
  );
  ok('没有数字就留空，不编一个注册资本', capitalWanFrom(survey({ capitalRec: '是', capitalAmount: '' }), plan({ capitalAmount: '由顾问与您沟通后确定' })) === '');
  ok('问卷金额不是纯数字时也走方案那句', capitalWanFrom(survey({ capitalAmount: '一百万' }), plan()) === '100');
}

/* ------------------------------------------------------------- 组织形式 */

{
  ok('默认有限责任公司', orgFromPlan(plan()) === '有限责任公司');
  ok('认出股份有限公司', orgFromPlan(plan({ companyType: '股份有限公司（发起设立）' })) === '股份有限公司');
  ok('认出合伙企业', orgFromPlan(plan({ companyType: '有限合伙企业' })) === '合伙企业');
}

/* ----------------------------------------------------------------- 股东 */

{
  ok('「1 个」铺 1 行', shareholderRowCount(survey({ shareholderCount: '1 个' })) === 1);
  ok('「2 个」铺 2 行', shareholderRowCount(survey({ shareholderCount: '2 个' })) === 2);
  ok('「3 个及以上」按下限 3 行铺', shareholderRowCount(survey({ shareholderCount: '3 个及以上' })) === MIN_SHAREHOLDER_ROWS);
  ok('人数没填就不铺', shareholderRowCount(survey({ shareholderCount: '' })) === 0);

  const natural = shareholdersFromSurvey(survey({ shareholderCount: '2 个', shareholderType: ['自然人'] }));
  ok('股东类型映射：自然人', natural.length === 2 && natural.every((row) => row.type === '自然人'));
  ok('只铺结构，姓名/证件/股比/出资额都空着', natural.every((row) => row.name === '' && row.code === '' && row.ratio === '' && row.amount === ''));

  const mixed = shareholdersFromSurvey(survey({ shareholderCount: '2 个', shareholderType: ['自然人', '公司股东'] }));
  ok('多种类型轮流分配', mixed[0].type === '自然人' && mixed[1].type === '企业');
  ok('公司股东映射成「企业」', shareholdersFromSurvey(survey({ shareholderCount: '1 个', shareholderType: ['公司股东'] }))[0].type === '企业');
  ok('境外主体映射成「其他」', shareholdersFromSurvey(survey({ shareholderCount: '1 个', shareholderType: ['境外主体'] }))[0].type === '其他');
  ok('每行都有独立 id（表格 key 不会撞）', new Set(natural.map((row) => row.id)).size === 2);
  ok('出资方式默认货币', natural[0].method.join(',') === '货币');
}

/* ------------------------------------------------------- 整份初始表单 */

{
  const form = registrationSeedFrom({ survey: survey(), plan: plan(), contactPhone: '13800000000' });

  // 1) 转换过来的字段
  ok('企业描述来自问卷', form.basic.intro === '拟设立甲乙丙科技有限公司，主营跨境电商独立站');
  ok('业务描述来自问卷', form.basic.service === '面向欧美市场销售自有品牌家居用品');
  ok('经营范围来自问卷（拼接）', form.basic.scope === '互联网销售；货物进出口；供应链管理服务');
  ok('注册资本来自问卷', form.basic.capital === '100');
  ok('「是否需要推荐注册地址」来自问卷', form.basic.regRecommend === true);
  ok('「是否需要推荐办公场地」来自问卷', form.basic.workRecommend === false);
  ok('「金额由服务人员定」对应专家建议', registrationSeedFrom({ survey: survey({ capitalRec: '是' }), plan: plan() }).basic.expert === true);
  ok('提交短信手机号沿用确认步骤那个', form.submissionPhone === '13800000000');
  ok('股东行数与问卷一致', form.shareholders.length === 2);

  // 2) 绝不编造的字段
  ok('企业名称没有建议时留空（不是编一个）', form.basic.names.every((name) => name === ''));
  ok('注册地址留空（问卷只问要不要推荐）', form.basic.regAddress === '');
  ok('办公地址留空', form.basic.workAddress === '');
  ok('委托书受托人姓名留空', form.authorization.trusteeName === '');
  ok('委托书证件号留空（旧版本写死过 440301199308123418）', form.authorization.trusteeIdNumber === '');
  ok('委托书附件为空（旧版本塞过一份假 PDF）', form.authorization.files.length === 0);
  ok('「信息属实」不预先勾选', form.confirm.accurate === false);
  ok('「免于申报」不预先勾选', form.confirm.exemption === false);
  ok('人员与角色由第 5 步自己收集', Object.keys(form.people).length === 0 && form.roles.length === 0);
  ok('员工人数不预填（问卷里没有这一项）', (form.setup?.employees ?? '') === '');

  // 3) 状态与结构性默认值
  ok('新表单是草稿态且没保存时间', form.status === 'draft' && form.savedAt === null && form.submittedAt === null);
  ok('委托日期默认今天（结构性默认，不是用户资料）', /^\d{4}-\d{2}-\d{2}$/.test(form.authorization.entrustDate));
  ok('董事监事的结构性默认值保留', form.basic.board !== '' && form.basic.singleDirector !== '');

  // 4) 两次生成不会共用同一个 id / 数组引用
  const again = registrationSeedFrom({ survey: survey(), plan: plan() });
  ok('每次生成独立的表单 id', again.id !== form.id);
  ok('股东数组是独立副本', again.shareholders[0].id !== form.shareholders[0].id);
}

console.log(`\n${passed} 项通过，${failed} 项失败`);
if (failed > 0) process.exit(1);
