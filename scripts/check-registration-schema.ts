/**
 * 注册信息采集表单 schema 自检。
 * 运行：npx tsx scripts/check-registration-schema.ts
 */
import assert from 'node:assert/strict';
import { registrationSchema, type FormValues } from '../src/registration/schema';

const validForm: FormValues = {
  tradeName: '数鲸云',
  industry: '智能技术',
  orgType: '有限责任公司',
  registeredCapital: 100,

  leaseContractNo: 'JQ-2026-001',
  address: '中国（上海）自由贸易试验区新金桥路27号14号楼',
  postalCode: '201206',

  contactPhone: '021-12345678',
  articlesDate: '2026-08-01',
  businessScope: '从事智能技术、信息技术领域内的技术开发、技术咨询与技术服务。',

  shareholders: [
    {
      name: '张三',
      type: '自然人',
      idNumber: '310101199001011234',
      mobile: '13800138000',
      capital: 60,
      certificateImages: [
        { name: 'idcard-front.jpg', size: 200_000, type: 'image/jpeg', dataUrl: 'data:image/jpeg;base64,AA==' },
        { name: 'idcard-back.jpg', size: 180_000, type: 'image/jpeg', dataUrl: 'data:image/jpeg;base64,AA==' },
      ],
    },
    {
      name: '上海某某科技有限公司',
      type: '企业法人',
      idNumber: '91310115MA1K35QX7T',
      mobile: '13900139000',
      capital: 40,
      certificateImages: [
        { name: 'license.png', size: 300_000, type: 'image/png', dataUrl: 'data:image/png;base64,AA==' },
      ],
    },
  ],

  legalPerson: { name: '张三', idNumber: '310101199001011234', mobile: '13800138000' },
  director: { name: '张三', idNumber: '310101199001011234', mobile: '13800138000' },
  supervisor: { name: '李四', idNumber: '310101199002021234', mobile: '13700137000' },
  financeManager: { name: '王五', idNumber: '310101199003031234', mobile: '13600136000' },

  beneficiaries: [
    { name: '张三', idNumber: '310101199001011234', benefitType: '直接持股 25% 以上', shareRatio: 60 },
    { name: '李四', idNumber: '310101199002021234', benefitType: '实际控制人', shareRatio: null },
  ],

  agency: {
    agentName: '赵六',
    agentIdNumber: '310101199004041234',
    agentMobile: '13500135000',
    principalSign: '', // 亲笔签名，允许留空
    principalDate: '2026-08-01',
  },

  serviceConfirm: {
    basicService: true,
    taxService: true,
    hrService: false,
    subsidyService: false,
    taxType: '小规模纳税人',
    startYear: '2026',
    startMonth: '9',
    durationMonths: '12',
    standardFee: '2600',
    paidAmount: '2600.50',
    remark: '含首年财税托管。',
  },
};

/** 深拷贝后覆盖指定路径，模拟一处填写错误 */
const withOverride = (path: string, value: unknown): FormValues => {
  const draft = JSON.parse(JSON.stringify(validForm)) as Record<string, any>;
  const keys = path.split('.');
  const last = keys.pop() as string;
  const target = keys.reduce((acc, key) => acc[key], draft);
  target[last] = value;
  return draft as FormValues;
};

const messagesOf = (form: FormValues): string[] => {
  const result = registrationSchema.safeParse(form);
  if (result.success) return [];
  return result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
};

let checked = 0;
const expectPass = (name: string, form: FormValues) => {
  assert.deepEqual(messagesOf(form), [], `应通过：${name}`);
  checked += 1;
};
const expectFail = (name: string, form: FormValues, fragment: string) => {
  const messages = messagesOf(form);
  assert.ok(
    messages.some((message) => message.includes(fragment)),
    `应报错「${fragment}」：${name}，实际 ${JSON.stringify(messages)}`,
  );
  checked += 1;
};

// 完整合规表单
expectPass('完整表单', validForm);

// 认缴出资合计必须等于注册资本
expectFail('出资合计少于注册资本', withOverride('shareholders.0.capital', 50), '出资合计');
expectPass('出资合计相等（浮点尾数）', withOverride('shareholders.1.capital', 39.999999));

// 证件号码按股东类型校验
expectFail('自然人填统一社会信用代码', withOverride('shareholders.0.idNumber', '91310115MA1K35QX7T'), '身份证号');
expectFail('企业法人填身份证号', withOverride('shareholders.1.idNumber', '310101199001011234'), '统一社会信用代码');
expectFail('企业法人填 18 位纯数字', withOverride('shareholders.1.idNumber', '310101199001011200'), '统一社会信用代码');
expectFail('企业法人信用代码含非法字符', withOverride('shareholders.1.idNumber', '91310115MA1K35QZ7T'), '统一社会信用代码');

// 联系电话接受手机号与固话
expectPass('联系电话用手机号', withOverride('contactPhone', '13800138000'));
expectFail('联系电话格式错误', withOverride('contactPhone', '12345'), '手机号或固定电话');

// 章程决议日期不得晚于今天
expectFail('章程决议日期在未来', withOverride('articlesDate', '2027-01-01'), '不能晚于今天');
expectFail('章程决议日期为空', withOverride('articlesDate', ''), '请选择章程决议日期');

// 受益所有人：持股类必须填持股比例
expectFail('持股类缺持股比例', withOverride('beneficiaries.0.shareRatio', null), '请填写持股比例');
expectFail('持股比例超 100', withOverride('beneficiaries.0.shareRatio', 120), '不能超过 100');
expectPass('实际控制人无需持股比例', withOverride('beneficiaries.1.benefitType', '高级管理人员'));

// 下拉项与必填
expectFail('未选组织形式', withOverride('orgType', ''), '请选择组织形式');
expectFail('未选行业表述', withOverride('industry', ''), '请选择行业表述');
expectFail('未选受益类型', withOverride('beneficiaries.0.benefitType', ''), '请选择受益类型');

// 数字字段为空
expectFail('注册资本为空', withOverride('registeredCapital', null), '请输入注册资本');
expectFail('注册资本为零', withOverride('registeredCapital', 0), '注册资本必须大于 0');

// 至少一名股东 / 受益人
expectFail('无股东', withOverride('shareholders', []), '至少添加一名股东');
expectFail('无受益所有人', withOverride('beneficiaries', []), '至少添加一名受益所有人');

// 证件图片（环节 7 必填，可多张）
expectFail('未上传证件图片', withOverride('shareholders.0.certificateImages', []), '请上传证件图片');
expectFail(
  '证件图片超过 5 MB',
  withOverride('shareholders.1.certificateImages.0.size', 6 * 1024 * 1024),
  '图片不能超过 5 MB',
);
expectFail(
  '第二张证件图片超过 5 MB',
  withOverride('shareholders.1.certificateImages.1', {
    name: 'b.png',
    size: 6 * 1024 * 1024,
    type: 'image/png',
    dataUrl: 'data:image/png;base64,AA==',
  }),
  '图片不能超过 5 MB',
);
expectFail(
  '证件图片格式不支持',
  withOverride('shareholders.1.certificateImages.0.type', 'application/pdf'),
  '仅支持 JPG / PNG',
);
expectPass(
  '证件图片为 PNG 且未超限',
  withOverride('shareholders.1.certificateImages.0.type', 'image/png'),
);
expectFail(
  '证件图片超过 5 张',
  withOverride(
    'shareholders.0.certificateImages',
    Array.from({ length: 6 }, (_, i) => ({
      name: `cert-${i}.jpg`,
      size: 1000,
      type: 'image/jpeg',
      dataUrl: 'data:image/jpeg;base64,AA==',
    })),
  ),
  '最多上传 5 张',
);

// 人员手机号
expectFail('监事手机号错误', withOverride('supervisor.mobile', '12345678901'), '请输入 11 位手机号');

// 监事不得兼任法定代表人 / 董事 / 财务负责人
expectFail(
  '监事与法定代表人同一人',
  withOverride('supervisor.idNumber', validForm.legalPerson.idNumber),
  '监事不得兼任',
);
expectFail(
  '监事与财务负责人同一人',
  withOverride('supervisor.idNumber', validForm.financeManager.idNumber),
  '监事不得兼任',
);
expectPass(
  '监事与法定代表人同名但不同号',
  withOverride('supervisor.name', validForm.legalPerson.name),
);
const emptySupervisorId = messagesOf(withOverride('supervisor.idNumber', ''));
assert.deepEqual(
  emptySupervisorId,
  ['supervisor.idNumber: 请输入 18 位身份证号'],
  `监事证件号为空时只报必填、不报兼任，实际 ${JSON.stringify(emptySupervisorId)}`,
);
checked += 1;

// 右栏「金桥镇服务专员填写」（环节 3 经办人 + 环节 11 委托书签署信息）
// 全部可选：企业不应被服务专员尚未填写的字段卡住提交
expectPass('右栏整体留空', withOverride('agency', {
  agentName: '',
  agentIdNumber: '',
  agentMobile: '',
  principalSign: '',
  principalDate: '',
}));
expectPass('经办人姓名为空、号码照填', withOverride('agency.agentName', ''));
expectFail('经办人身份证号格式错误', withOverride('agency.agentIdNumber', '12345'), '请输入 18 位身份证号');
expectFail('经办人手机号格式错误', withOverride('agency.agentMobile', '12345678901'), '请输入 11 位手机号');
expectFail('委托日期在未来', withOverride('agency.principalDate', '2027-01-01'), '不能晚于今天');
expectPass('委托人签名留空', withOverride('agency.principalSign', ''));
expectPass('委托日期留空', withOverride('agency.principalDate', ''));

// 右栏「企业服务确认」（《企业服务委托单》第八节），同样全部可选
expectPass('企业服务确认整体留空', withOverride('serviceConfirm', {
  basicService: true,
  taxService: false,
  hrService: false,
  subsidyService: false,
  taxType: '',
  startYear: '',
  startMonth: '',
  durationMonths: '',
  standardFee: '',
  paidAmount: '',
  remark: '',
}));
expectPass('只有基础服务', withOverride('serviceConfirm.taxService', false));
// 空值合法，非选项值报错；zod 的 union 不回传自定义文案，这里只断言报错落在该字段上
expectFail('税务类型非选项内', withOverride('serviceConfirm.taxType', '个体户'), 'serviceConfirm.taxType');
expectFail('托管起始年份非 4 位', withOverride('serviceConfirm.startYear', '26'), '请输入 4 位年份');
expectFail('托管起始月份越界', withOverride('serviceConfirm.startMonth', '13'), '请输入 1-12 月');
expectFail('服务时长非数字', withOverride('serviceConfirm.durationMonths', '一年'), '请输入月数');
expectFail('标准服务费用格式错误', withOverride('serviceConfirm.standardFee', '2600元'), '请输入数字金额');
expectFail('实付金额小数超两位', withOverride('serviceConfirm.paidAmount', '2600.123'), '请输入数字金额');
expectPass('实付金额为整数', withOverride('serviceConfirm.paidAmount', '2600'));

console.log(`registration schema 自检通过：${checked} 项`);
