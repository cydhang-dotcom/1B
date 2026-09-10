/**
 * 开发阶段的示例数据，由 RegistrationApp 用 import.meta.env.DEV 把关，生产构建不会带上。
 *
 * ponytail: 只为省去反复手填。目标是表单直接可提交，方便走通全流程与调试接口。
 * 正式上线前把本文件与 RegistrationApp 里的 DEV 分支一起删掉即可，schema 不受影响。
 */
import {
  JINQIAO_POSTAL_CODE,
  defaultValues,
  type CertificateImage,
  type FormValues,
} from './schema';

/** 8×8 纯色占位图，让图片预览看得见，不至于像没传上 */
const PLACEHOLDER_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGNIO7sVK2IYWhIAl8l6AUrV5eQAAAAASUVORK5CYII=';

const devImage = (name: string): CertificateImage => ({
  name,
  size: 1024,
  type: 'image/png',
  dataUrl: PLACEHOLDER_PNG,
});

const 张三 = { name: '张三', idNumber: '310101199001011234', mobile: '13800138000' };
const 李四 = { name: '李四', idNumber: '310101199002021234', mobile: '13700137000' };
const 王五 = { name: '王五', idNumber: '310101199003031234', mobile: '13600136000' };

export const devDefaultValues: FormValues = {
  ...defaultValues,

  // 环节 2 名称申报
  tradeName: '数鲸云',
  industry: '智能技术',
  orgType: '有限责任公司',
  registeredCapital: 100,

  // 环节 5 住所信息
  leaseContractNo: 'JQ-2026-001',
  address: '中国（上海）自由贸易试验区金沪路1155号518室',
  postalCode: JINQIAO_POSTAL_CODE,

  // 环节 6 联系与章程
  contactPhone: '021-12345678',
  articlesDate: '2026-08-01',
  businessScope:
    '从事智能技术、信息技术领域内的技术开发、技术咨询、技术服务；企业管理咨询；商务信息咨询。',

  // 环节 7 股东及出资（认缴合计须等于注册资本：60 + 40 = 100）
  shareholders: [
    {
      ...张三,
      type: '自然人',
      capital: 60,
      certificateImages: [devImage('idcard-front.png'), devImage('idcard-back.png')],
    },
    {
      name: '上海某某科技有限公司',
      type: '企业法人',
      idNumber: '91310115MA1K35QX7T',
      mobile: '13900139000',
      capital: 40,
      certificateImages: [devImage('license.png')],
    },
  ],

  // 环节 8 人员信息（监事不得与法定代表人、董事、财务负责人为同一人）
  legalPerson: { ...张三 },
  director: { ...张三 },
  supervisor: { ...李四 },
  financeManager: { ...王五 },

  // 环节 9 受益人信息
  beneficiaries: [
    { ...张三, benefitType: '直接持股 25% 以上', shareRatio: 60 },
    { ...李四, benefitType: '实际控制人', shareRatio: null },
  ],

  // 右栏「金桥镇服务专员填写」：环节 3 经办人 + 环节 11 委托书签署信息
  // 受托人是金桥镇指定经办人，不是法定代表人本人
  agency: {
    agentName: '赵六',
    agentIdNumber: '310101199004041234',
    agentMobile: '13500135000',
    principalSign: '', // 亲笔签名，留空由打印后手写
    principalDate: '2026-08-01',
  },

  // 右栏「企业服务确认」：《企业服务委托单》第八节
  serviceConfirm: {
    basicService: true, // 必选，界面上禁用
    taxService: true,
    hrService: false,
    subsidyService: false,
    taxType: '小规模纳税人',
    startYear: '2026',
    startMonth: '9',
    durationMonths: '12',
    standardFee: '2600',
    paidAmount: '2600',
    remark: '含首年财税托管，注册完成后按季度对账。',
  },
};
