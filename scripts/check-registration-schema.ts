/**
 * 注册申请校验规则自检：直接跑纯函数，不经过浏览器。
 *   npx tsx scripts/check-registration-schema.ts
 */
import { migrateDraft } from '../src/registration/draft';
import { flatten } from '../src/registration/flat';
import {
  CONFIG,
  clone,
  initial,
  uid,
  type ApplicationData,
} from '../src/registration/model';
import {
  roleDraftErrors,
  sectionTouched,
  setupComplete,
  shareholderDraftErrors,
  validate,
} from '../src/registration/schema';

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

/** 校验通过的完整申请 */
function validData(): ApplicationData {
  const data = initial();
  const personId = uid();
  data.basic = {
    org: '有限责任公司',
    orgOther: '',
    intro: '从事企业服务',
    service: '企业注册代办',
    scope: '企业管理咨询',
    capital: '100',
    expert: false,
    names: ['班步测试企业', '', ''],
    regAddress: '上海市浦东新区某路 1 号',
    regRecommend: false,
    workAddress: '上海市浦东新区某路 2 号',
    workRecommend: false,
  };
  data.people[personId] = {
    name: '张三',
    phone: '13800000000',
    email: 'zhang@example.com',
    education: '',
    address: '上海市浦东新区某路 3 号',
    files: [
      { id: uid(), name: 'front.png', size: 10, type: 'image/png', data: 'data:image/png;base64,AA==', slot: 'idFront' },
      { id: uid(), name: 'back.png', size: 10, type: 'image/png', data: 'data:image/png;base64,AA==', slot: 'idBack' },
    ],
  };
  data.shareholders = [
    {
      id: uid(),
      type: '自然人',
      personId,
      name: '',
      code: '',
      ratio: '100',
      amount: '100',
      method: ['货币'],
      files: [],
    },
  ];
  data.roles = [
    { id: uid(), personId, roles: ['法定代表人', '财务负责人', '联系人'] },
  ];
  data.setup = {
    board: '不设董事会',
    directors: '',
    singleDirector: '一名董事',
    supervisorBoard: '不设监事会',
    supervisors: '',
    singleSupervisor: '一名监事',
    unanimous: false,
    term: '长期',
    termYears: '',
    legacyTerm: '',
    employees: '3',
  };
  data.confirm = { exemption: true, accurate: true };
  return data;
}

const messagesFor = (data: ApplicationData, id: string): string[] =>
  validate(data)
    .filter((error) => error.id === id)
    .map((error) => error.msg);

/* ------------------------------------------------------------ 基准：完整申请通过 */

ok('完整申请没有报错', validate(validData()).length === 0);

/* ------------------------------------------------------------------ 基本信息 */

{
  const data = validData();
  data.basic.org = '';
  ok('未选组织形式报错', messagesFor(data, 'org').includes('请选择企业组织形式'));
}
{
  const data = validData();
  data.basic.org = '其他';
  ok('其他组织形式需填说明', messagesFor(data, 'orgOther').includes('请填写具体组织形式'));
}
{
  const data = validData();
  data.basic.capital = '100.5';
  ok('注册资本必须是非负整数', messagesFor(data, 'capital').length === 1);
}
{
  const data = validData();
  data.basic.capital = '';
  data.basic.expert = true;
  ok('专家推荐时注册资金免填', messagesFor(data, 'capital').length === 0);
}
{
  const data = validData();
  data.basic.names = ['', '', ''];
  ok('至多需要一个拟注册名称', messagesFor(data, 'name-0').includes('请至少填写一个拟注册名称'));
}
{
  const data = validData();
  data.basic.names = ['甲', '', '', ''];
  ok('新增的第 4 个名称必填', messagesFor(data, 'name-3').length === 1);
}
{
  const data = validData();
  data.basic.names = ['甲', '', '', '丁'];
  ok('第 4 个名称填了就不报错', messagesFor(data, 'name-3').length === 0);
}
{
  const data = validData();
  data.basic.names = Array.from({ length: CONFIG.nameMaximum + 1 }, (_, index) => `名称${index}`);
  ok('名称数量有上限', messagesFor(data, 'name-0').some((msg) => msg.includes('最多')));
}
{
  const data = validData();
  data.basic.regAddress = '';
  ok('注册地址必填或交给服务商', messagesFor(data, 'regAddress').includes('请填写注册地址，或选择服务商推荐'));
}
{
  const data = validData();
  data.basic.workAddress = '';
  data.basic.workRecommend = true;
  ok('选择服务商推荐后地址免填', messagesFor(data, 'workAddress').length === 0);
}

/* -------------------------------------------------------------- 股东与出资 */

{
  const data = validData();
  data.shareholders = [];
  ok('至少需要一位股东', messagesFor(data, 'shareholders').includes('请添加至少 1 位股东'));
}
{
  const data = validData();
  data.shareholders[0].ratio = '0';
  ok('出资比例需大于 0', messagesFor(data, 'share-' + data.shareholders[0].id).some((msg) => msg.includes('出资比例')));
}
{
  const data = validData();
  data.shareholders[0].ratio = '100.1';
  ok('出资比例不超过 100', messagesFor(data, 'share-' + data.shareholders[0].id).some((msg) => msg.includes('出资比例')));
}
{
  const data = validData();
  data.shareholders[0].amount = '-1';
  ok('出资金额不能为负', messagesFor(data, 'share-' + data.shareholders[0].id).some((msg) => msg.includes('出资金额')));
}
{
  const data = validData();
  data.shareholders[0].amount = '';
  ok('出资金额选填', messagesFor(data, 'share-' + data.shareholders[0].id).length === 0);
}
{
  const data = validData();
  data.people[data.shareholders[0].personId!].files = [];
  ok(
    '自然人股东缺身份证照片时报错',
    messagesFor(data, 'share-' + data.shareholders[0].id).some((msg) => msg.includes('身份证')),
  );
}
{
  const data = validData();
  const entityId = uid();
  data.shareholders.push({
    id: entityId,
    type: '企业',
    personId: null,
    name: '某某有限公司',
    code: '',
    ratio: '50',
    amount: '',
    method: [],
    files: [],
  });
  const messages = validate(data).filter((error) => error.id === `share-${entityId}`).map((error) => error.msg);
  ok('企业股东缺信用代码报错', messages.some((msg) => msg.includes('统一社会信用代码')));
  ok('企业股东缺营业执照报错', messages.some((msg) => msg.includes('营业执照')));
}
{
  const data = validData();
  const otherId = uid();
  data.shareholders.push({
    id: otherId,
    type: '其他',
    personId: null,
    name: '',
    code: '',
    ratio: '10',
    amount: '',
    method: [],
    files: [],
  });
  const messages = validate(data).filter((error) => error.id === `share-${otherId}`).map((error) => error.msg);
  ok('其他类型股东需要说明', messages.some((msg) => msg.includes('股东说明')));
  ok('其他类型股东不要求附件', !messages.some((msg) => msg.includes('营业执照')));
}

/* ------------------------------------------------------------------ 主要人员 */

{
  const data = validData();
  data.roles = [];
  const messages = validate(data).map((error) => error.msg);
  ok('缺少法定代表人', messages.includes('请设置法定代表人'));
  ok('缺少财务负责人', messages.includes('请设置财务负责人'));
  ok('缺少联系人', messages.includes('请设置联系人'));
  ok('总经理不强制', !messages.includes('请设置总经理'));
}
{
  const data = validData();
  data.roles[0].roles = [];
  ok(
    '人员必须至少有一个角色',
    validate(data).some((error) => error.id === `role-${data.roles[0].id}` && error.msg.includes('请选择人员角色')),
  );
}
{
  const data = validData();
  data.people[data.roles[0].personId!].files = [];
  ok(
    '人员缺身份证照片时报错',
    validate(data).some((error) => error.id === `role-${data.roles[0].id}` && error.msg.includes('身份证')),
  );
}
{
  const data = validData();
  data.roles.push({ id: uid(), personId: data.roles[0].personId, roles: ['总经理'] });
  ok(
    '同一人员重复添加时报错',
    validate(data).some((error) => error.msg.includes('重复添加')),
  );
}

/* ------------------------------------------------------------------ 设立信息 */

{
  const data = validData();
  data.setup.board = '设董事会';
  data.setup.directors = '3.5';
  ok('董事人数必须是非负整数', messagesFor(data, 'directors').includes('人数需为非负整数'));
}
{
  const data = validData();
  data.setup.directors = '3.5';
  ok('不设董事会时不校验董事人数', messagesFor(data, 'directors').length === 0);
}
{
  const data = validData();
  data.setup.term = '固定年限';
  data.setup.termYears = '0';
  ok('固定年限需大于 0', messagesFor(data, 'termYears').includes('固定年限需填写大于 0 的整数年数'));
}
{
  const data = validData();
  data.setup.term = '固定年限';
  data.setup.termYears = '20';
  ok('固定年限填好后通过', messagesFor(data, 'termYears').length === 0);
}

/* -------------------------------------------------------------------- 确认 */

{
  const data = validData();
  data.confirm.accurate = false;
  ok('必须勾选信息真实性确认', messagesFor(data, 'accurate').includes('请勾选信息真实性确认'));
}
{
  const data = validData();
  data.confirm.exemption = false;
  ok('免申报承诺选填', validate(data).length === 0);
}

/* ---------------------------------------------------------------- 委托书 */

{
  const data = validData();
  ok('未上传委托书不影响提交', validate(data).length === 0);
}
{
  // 老草稿没有 authorization，迁移要能补出来，并且历史的多份附件收敛成一份
  const legacy = validData() as Partial<ApplicationData>;
  delete legacy.authorization;
  const migrated = migrateDraft(legacy as ApplicationData);
  ok('老草稿补出委托书结构', Array.isArray(migrated.authorization.files));
  ok('老草稿补出的委托书未上传', migrated.authorization.files.length === 0);
}
{
  // 委托日期改为线下手写，模型里不再留自动生成的日期
  ok('委托书结构里没有自动日期', !('entrustDate' in initial().authorization));
}
{
  const data = validData();
  const files = [1, 2, 3].map((n) => ({
    id: uid(),
    name: `委托书${n}.png`,
    size: 10,
    type: 'image/png',
    data: 'data:image/png;base64,AA==',
  }));
  ok('迁移把多份委托书收敛成一份', migrateDraft({ ...data, authorization: { ...data.authorization, files } }).authorization.files.length === 1);
}

/* --------------------------------------------------- 记录级校验与导航状态 */

{
  const data = validData();
  const record = data.shareholders[0];
  const person = clone(data.people[record.personId!]);
  person.files = [];
  ok('记录保存时允许暂时缺照片', shareholderDraftErrors(record, person).length === 0);
  person.name = '';
  ok('记录保存时姓名必填', shareholderDraftErrors(record, person).some((msg) => msg.includes('姓名')));
}
{
  const data = validData();
  const record = data.roles[0];
  const person = clone(data.people[record.personId!]);
  ok('记录保存时角色必填', roleDraftErrors({ ...record, roles: [] }, person, false).length > 0);
  ok('重复人员被记录级校验拦下', roleDraftErrors(record, person, true).some((msg) => msg.includes('已添加')));
}
{
  const data = initial();
  ok('空申请的第一步未触碰', !sectionTouched(data, 0));
  ok('空申请没有股东', !sectionTouched(data, 1));
  ok('空申请的设立信息未完成', !setupComplete(data.setup));
  const filled = validData();
  ok('填写后的设立信息完成', setupComplete(filled.setup));
  ok('填写后的确认步骤已触碰', sectionTouched(filled, 5));
  // 委托书只看传没传，且不参与提交拦截
  ok('空申请的委托书未触碰', !sectionTouched(data, 4));
  const signed = { id: uid(), name: '委托书.png', size: 10, type: 'image/png', data: 'data:image/png;base64,AA==' };
  ok(
    '上传后委托书章节已触碰',
    sectionTouched({ ...data, authorization: { ...data.authorization, files: [signed] } }, 4),
  );
  ok(
    '未上传委托书不影响提交校验',
    !validate(validData()).some((error) => error.section === 4),
  );
  ok(
    '信息真实性确认归属第 6 步',
    validate({ ...validData(), confirm: { exemption: false, accurate: false } }).some(
      (error) => error.id === 'accurate' && error.section === 5,
    ),
  );
}

/* -------------------------------------------------------------- 扁平化输出 */

{
  const flat = flatten(validData());
  ok('扁平值全部是字符串', Object.values(flat).every((value) => typeof value === 'string'));
  ok(
    '委托书扁平值取联系人且不含日期',
    flat['受托人姓名'] === '张三' &&
      flat['委托书已上传'] === '未上传' &&
      flat['委托书份数'] === '0' &&
      !('委托日期' in flat),
  );
  ok('未确定受托人时姓名留空而非全角空格', flatten(initial())['受托人姓名'] === '');
  ok('企业名称按序号展开', flat['拟注册名称1'] === '班步测试企业' && flat['拟注册名称2'] === '');
  ok('股东序号从 1 开始', flat['股东1类型'] === '自然人' && flat['股东1名称'] === '张三');
  ok('股东出资字段完整', flat['股东1出资比例'] === '100' && flat['股东1出资形式'] === '货币');
  ok('照片只写上传状态', flat['股东1身份证正面'] === '已上传' && flat['股东1身份证反面'] === '已上传');
  ok('自然人股东不写信用代码', !('股东1统一社会信用代码' in flat));
  ok('按角色派生姓名与电话', flat['法定代表人'] === '张三' && flat['法定代表人联系电话'] === '13800000000');
  ok('总经理无人担任时留空', flat['总经理'] === '');
  ok('出资比例合计', flat['出资比例合计'] === '100');
  ok('汇总计数', flat['股东总数'] === '1' && flat['人员总数'] === '1' && flat['自然人股东数'] === '1');
  ok('股东构成', flat['股东构成'] === '全部为自然人股东');
  ok('设立信息进扁平值', flat['董事会'] === '不设董事会' && flat['员工人数'] === '3');
  ok('确认项写成是/否', flat['信息真实性确认'] === '是' && flat['免申报受益所有人承诺'] === '是');
  ok('元信息标记草稿状态', flat['_状态'] === '草稿' && flat['_版本'] === CONFIG.version);
  ok('旧草稿迁移字段不进扁平值', !('legacyTerm' in flat) && !Object.keys(flat).some((key) => key.includes('legacy')));
}
{
  const data = validData();
  data.shareholders[0].amount = '';
  data.shareholders[0].ratio = '';
  const flat = flatten(data);
  ok('比例未填完时合计留空', flat['出资比例合计'] === '');
}
{
  const data = validData();
  const entityId = uid();
  data.shareholders.push({
    id: entityId,
    type: '企业',
    personId: null,
    name: '某某有限公司',
    code: '91310000MA1K000000',
    ratio: '50',
    amount: '50',
    method: ['货币'],
    files: [],
  });
  const flat = flatten(data);
  ok('企业股东写信用代码与营业执照', flat['股东2统一社会信用代码'] === '91310000MA1K000000' && flat['股东2营业执照'] === '未上传');
  ok('企业股东不写身份证状态', !('股东2身份证正面' in flat));
  ok('混股东时构成变化', flat['股东构成'] === '含企业股东' && flat['企业股东数'] === '1');
  ok('合计含全部股东', flat['出资比例合计'] === '150');
}
{
  const flat = flatten(initial());
  ok('空申请也有固定键，值取空串', flat['组织形式'] === '' && flat['企业简介'] === '' && flat['法定代表人'] === '');
  ok('空申请状态为草稿', flat['_状态'] === '草稿' && flat['_暂存时间'] === '');
  ok('没有股东时合计留空', flat['出资比例合计'] === '');
}
{
  const data = validData();
  data.status = 'submitted';
  data.submittedAt = '2026/9/14 10:00:00';
  const flat = flatten(data);
  ok('已提交状态写进扁平值', flat['_状态'] === '已提交' && flat['_提交时间'] === '2026/9/14 10:00:00');
}
{
  const data = validData();
  data.basic.org = '其他';
  data.basic.orgOther = '外商投资合伙企业';
  const flat = flatten(data);
  ok('其他组织形式派生企业类型', flat['组织形式'] === '其他' && flat['企业类型'] === '外商投资合伙企业');
}

console.log(`\n${passed} 项通过，${failed} 项失败`);
if (failed > 0) process.exit(1);
