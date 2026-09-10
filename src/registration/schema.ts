import { z } from 'zod';

/**
 * 字段范围依据《金桥镇新企业注册流程》中「企业侧需提供」的环节整理：
 *   环节 2  名称申报      → tradeName / industry / orgType / registeredCapital
 *   环节 5  住所信息      → leaseContractNo / address / postalCode
 *   环节 6  联系与章程    → contactPhone / articlesDate / businessScope
 *   环节 7  股东及出资    → shareholders
 *   环节 8  人员信息      → legalPerson / director / supervisor / financeManager
 *   环节 9  受益人信息    → beneficiaries
 *
 * 以下环节由金桥镇服务专员在「上海企业登记在线」平台内完成，不属于企业侧采集范围：
 *   环节 3  经办人信息（须为金桥镇指定人员）
 *   环节 4  选择申请机关
 *   环节 10 办理方式（全程网办 · 需要材料辅导）
 *   环节 11 刻章信息（须法人委托书）
 *   环节 12 材料预览与提交
 *   环节 13 其他联办事项（五险一金 / 涉税 / 开户预约，本次可忽略）
 *   环节 14 办理结果状态查询
 */

export const ORG_TYPES = [
  '有限责任公司',
  '股份有限公司',
  '合伙企业',
  '个人独资企业',
] as const;

export const INDUSTRIES = [
  '智能技术',
  '信息技术',
  '科技服务',
  '商务服务',
  '贸易',
  '文化创意',
  '生物医药',
] as const;

export const SHAREHOLDER_TYPES = ['自然人', '企业法人'] as const;

/** 持股类受益类型（需填写持股比例），参照人民银行受益所有人识别标准 */
export const EQUITY_BENEFIT_TYPES = ['直接持股 25% 以上', '间接持股 25% 以上'] as const;

/** 受益所有人类型 */
export const BENEFIT_TYPES = [...EQUITY_BENEFIT_TYPES, '实际控制人', '高级管理人员'] as const;

/** 持股类受益类型的填写提示 */
export const EQUITY_BENEFIT_HINT = '持股类受益类型需填写持股比例';

/** 金桥镇集中登记地址邮编（环节 5） */
export const JINQIAO_POSTAL_CODE = '201206';

/** 证件图片单张上限 5 MB、每名股东张数上限，仅支持 JPG / PNG */
export const MAX_CERTIFICATE_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_CERTIFICATE_IMAGES = 5;
export const CERTIFICATE_IMAGE_TYPES = ['image/jpeg', 'image/png'] as const;
export const CERTIFICATE_IMAGE_HINT =
  '自然人股东上传身份证正反面；企业法人股东上传营业执照。证件有多页的可分多张上传，系统会自动识别图片并填充相关信息，请确保图片清晰完整。单张不超过 5 MB，支持 JPG / PNG。';

/** 前端暂存的上传结果；接入接口后改为上传后的文件标识 */
export type CertificateImage = {
  name: string;
  size: number;
  type: string;
  dataUrl: string;
};

const MOBILE_RE = /^1[3-9]\d{9}$/;
const LANDLINE_RE = /^0\d{2,3}-?\d{7,8}$/;
const ID_CARD_RE = /^\d{17}[\dXx]$/;
// 统一社会信用代码：18 位，字符集不含 I、O、S、V、Z。
// 必须以 91 开头（9 = 工商登记，1 = 企业）——否则纯 18 位数字的身份证号也能通过校验。
// ponytail: 个体工商户(92)/农民专业合作社(93)作为股东时不适用，需另行放宽首两位。
const USCC_RE = /^91\d{6}[0-9A-HJ-NPQRTUWXY]{10}$/;

const ID_NUMBER_MESSAGE = {
  自然人: '请输入 18 位身份证号',
  企业法人: '请输入营业执照上以 91 开头的 18 位统一社会信用代码',
} as const;

const mobile = z.string().trim().regex(MOBILE_RE, '请输入 11 位手机号');

/** 注册客户联系电话可能是固话，因此手机号与固话都接受 */
const contactPhone = z
  .string()
  .trim()
  .refine(
    (value) => MOBILE_RE.test(value) || LANDLINE_RE.test(value),
    '请输入正确的手机号或固定电话（如 021-12345678）',
  );

const idCard = z.string().trim().regex(ID_CARD_RE, '请输入 18 位身份证号');

/**
 * 下拉框：空值 '' 属于合法输入类型（用于初始态），但校验不通过。
 * 这样 defaultValues 可以直接用 ''，报错信息也统一为「请选择 X」。
 */
const enumField = <T extends readonly [string, ...string[]]>(options: T, label: string) =>
  z
    .enum(options, { error: `请选择${label}` })
    .or(z.literal(''))
    .refine((value) => value !== '', `请选择${label}`);

// ponytail: 出资额统一按人民币万元采集。若后续出现外币出资，需补币种字段并放开下面的合计校验。
const amount = (label: string) =>
  z.number({ error: `请输入${label}` }).positive(`${label}必须大于 0`);

const todayLocal = () => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

/** 上传的证件图片，至少一张（环节 7 平台标注为必填项） */
const certificateImage = z.object(
  {
    name: z.string().min(1),
    size: z.number().max(MAX_CERTIFICATE_IMAGE_BYTES, '图片不能超过 5 MB'),
    type: z
      .string()
      .refine(
        (value) => (CERTIFICATE_IMAGE_TYPES as readonly string[]).includes(value),
        '仅支持 JPG / PNG 格式',
      ),
    dataUrl: z.string().min(1),
  },
  { error: '请上传证件图片' },
);

const certificateImages = z
  .array(certificateImage)
  .min(1, '请上传证件图片')
  .max(MAX_CERTIFICATE_IMAGES, `最多上传 ${MAX_CERTIFICATE_IMAGES} 张图片`);

export const shareholderSchema = z
  .object({
    name: z.string().trim().min(2, '请填写股东名称'),
    type: z.enum(SHAREHOLDER_TYPES, { error: '请选择股东类型' }),
    idNumber: z.string().trim().min(1, '请填写证件号码'),
    mobile,
    capital: amount('认缴出资额'),
    certificateImages,
  })
  .superRefine((value, ctx) => {
    if (!value.idNumber) return;
    const pattern = value.type === '自然人' ? ID_CARD_RE : USCC_RE;
    if (pattern.test(value.idNumber)) return;
    ctx.addIssue({
      code: 'custom',
      path: ['idNumber'],
      message: ID_NUMBER_MESSAGE[value.type],
    });
  });

/** 人员信息仅采集三项；职务由角色（法定代表人/董事/监事/财务负责人）确定 */
export const personSchema = z.object({
  name: z.string().trim().min(2, '请填写姓名'),
  idNumber: idCard,
  mobile,
});

export const beneficiarySchema = z
  .object({
    name: z.string().trim().min(2, '请填写姓名'),
    idNumber: idCard,
    benefitType: enumField(BENEFIT_TYPES, '受益类型'),
    shareRatio: z
      .number({ error: '请输入持股比例' })
      .min(0, '持股比例不能小于 0')
      .max(100, '持股比例不能超过 100')
      .nullable(),
  })
  .superRefine((value, ctx) => {
    if (!(EQUITY_BENEFIT_TYPES as readonly string[]).includes(value.benefitType)) return;
    if (value.shareRatio === null || Number.isNaN(value.shareRatio)) {
      ctx.addIssue({ code: 'custom', path: ['shareRatio'], message: '请填写持股比例' });
    }
  });

/** 环节 11 刻章信息所需的法人委托书说明 */
export const ATTORNEY_HINT =
  '本页展示的是环节 11 刻章信息所需的《法定代表人委托书》，受托人由「环节 3 · 经办人信息」带出，企业无需填写。请打印后由法定代表人亲笔签名，再交经办人上传。';

/**
 * 金桥镇服务专员（我司服务人员）办理的环节，统一在页面右栏填写。
 * 与左侧企业侧字段分开存放，便于分别对接两方；不设必填——企业不应被尚未填写的他方字段卡住提交。
 *
 *   环节 3  经办人信息   → agentName / agentIdNumber / agentMobile
 *   环节 11 法人委托书   → principalDate / principalSign（受托人直接取环节 3 的经办人）
 *
 * 环节 4 申请机关、环节 10 办理方式在 PDF 中是固定值，只做只读展示，不建字段。
 */
export const agencySchema = z.object({
  agentName: z.string().trim(),
  agentIdNumber: z
    .string()
    .trim()
    .refine((value) => !value || ID_CARD_RE.test(value), '请输入 18 位身份证号'),
  agentMobile: z
    .string()
    .trim()
    .refine((value) => !value || MOBILE_RE.test(value), '请输入 11 位手机号'),

  // 签名与日期都可以留空——打印件上是空白的签字线，由法定代表人当场亲笔写上
  principalSign: z.string().trim(),
  principalDate: z
    .string()
    .refine((value) => !value || value <= todayLocal(), '委托日期不能晚于今天'),
});

/** 《企业服务委托单》第八节「本次服务确认」的税务类型 */
export const TAX_TYPES = ['小规模纳税人', '一般纳税人'] as const;

/** 金额只做格式校验：可留空，也可填 1200 / 2600.50 */
const optionalAmount = (label: string) =>
  z
    .string()
    .trim()
    .refine((value) => !value || /^\d+(\.\d{1,2})?$/.test(value), `${label}请输入数字金额`);

/**
 * 《企业服务委托单》第八节「本次服务确认」，由金桥镇服务专员填写。
 * 与登记流程的环节无关，属于服务口径的确认，故不占 PDF 环节号；同样全部可选。
 */
export const serviceConfirmSchema = z.object({
  /** 基础服务为必选，界面上是勾选且禁用，仅作留档 */
  basicService: z.boolean(),
  taxService: z.boolean(),
  hrService: z.boolean(),
  subsidyService: z.boolean(),
  // 空值合法（专员可暂不选）；下拉框只有这两个选项，非选项值只可能来自篡改
  taxType: z.enum(TAX_TYPES, { error: '税务类型不在可选项内' }).or(z.literal('')),
  startYear: z
    .string()
    .trim()
    .refine((value) => !value || /^\d{4}$/.test(value), '请输入 4 位年份'),
  startMonth: z
    .string()
    .trim()
    .refine((value) => !value || /^(0?[1-9]|1[0-2])$/.test(value), '请输入 1-12 月'),
  durationMonths: z
    .string()
    .trim()
    .refine((value) => !value || /^\d+$/.test(value), '请输入月数'),
  standardFee: optionalAmount('标准服务费用'),
  paidAmount: optionalAmount('本次实付金额'),
  remark: z.string().trim(),
});

export const registrationSchema = z
  .object({
    // 环节 2 名称申报
    tradeName: z.string().trim().min(2, '字号至少 2 个字').max(20, '字号不能超过 20 个字'),
    industry: enumField(INDUSTRIES, '行业表述'),
    orgType: enumField(ORG_TYPES, '组织形式'),
    registeredCapital: amount('注册资本'),

    // 环节 5 住所信息
    leaseContractNo: z.string().trim().min(1, '请填写租赁合同编号'),
    address: z.string().trim().min(5, '请按租赁合同填写住所地址'),
    postalCode: z.string().trim().regex(/^\d{6}$/, '请输入 6 位邮政编码'),

    // 环节 6 联系与章程信息
    contactPhone,
    articlesDate: z
      .string()
      .min(1, '请选择章程决议日期')
      .refine((value) => value <= todayLocal(), '章程决议日期不能晚于今天'),
    businessScope: z.string().trim().min(10, '经营范围至少 10 个字'),

    // 环节 7 股东及出资信息
    shareholders: z.array(shareholderSchema).min(1, '至少添加一名股东'),

    // 环节 8 人员信息
    legalPerson: personSchema,
    director: personSchema,
    supervisor: personSchema,
    financeManager: personSchema,

    // 环节 9 受益人信息
    beneficiaries: z.array(beneficiarySchema).min(1, '至少添加一名受益所有人'),

    // 金桥镇服务专员办理的环节（页面右栏）
    agency: agencySchema,

    // 《企业服务委托单》第八节，同样由服务专员在右栏填写，不占 PDF 环节号
    serviceConfirm: serviceConfirmSchema,
  })
  .superRefine((value, ctx) => {
    if (Number.isFinite(value.registeredCapital)) {
      const total = value.shareholders.reduce(
        (sum, item) => sum + (Number.isFinite(item.capital) ? item.capital : 0),
        0,
      );
      if (Math.abs(total - value.registeredCapital) >= 0.001) {
        ctx.addIssue({
          code: 'custom',
          path: ['shareholders'],
          message: `认缴出资合计 ${total} 万元，与注册资本 ${value.registeredCapital} 万元不一致`,
        });
      }
    }

    // 董事、高级管理人员不得兼任监事（公司法）。「复用已填人员」会让人一键把同一人填进所有角色，
    // 这里按身份证号拦住；号码缺失时不报，交给 personSchema 的必填提示。
    const samePerson = (a: { idNumber: string }, b: { idNumber: string }) =>
      Boolean(a.idNumber) && a.idNumber === b.idNumber;
    if ([value.legalPerson, value.director, value.financeManager].some((item) => samePerson(value.supervisor, item))) {
      ctx.addIssue({
        code: 'custom',
        path: ['supervisor', 'idNumber'],
        message: '监事不得兼任法定代表人、董事或财务负责人',
      });
    }
  });

export type FormValues = z.input<typeof registrationSchema>;
export type ShareholderValues = FormValues['shareholders'][number];
export type BeneficiaryValues = FormValues['beneficiaries'][number];
export type AgencyValues = FormValues['agency'];
export type ServiceConfirmValues = FormValues['serviceConfirm'];

export const defaultShareholder = (): ShareholderValues => ({
  name: '',
  type: '自然人',
  idNumber: '',
  mobile: '',
  capital: null as unknown as number,
  certificateImages: [],
});

export const defaultBeneficiary = (): BeneficiaryValues => ({
  name: '',
  idNumber: '',
  benefitType: '',
  shareRatio: null,
});

export const defaultValues: FormValues = {
  tradeName: '',
  industry: '',
  orgType: '',
  registeredCapital: null as unknown as number,

  leaseContractNo: '',
  address: '',
  postalCode: JINQIAO_POSTAL_CODE,

  contactPhone: '',
  articlesDate: '',
  businessScope: '',

  shareholders: [defaultShareholder()],

  legalPerson: { name: '', idNumber: '', mobile: '' },
  director: { name: '', idNumber: '', mobile: '' },
  supervisor: { name: '', idNumber: '', mobile: '' },
  financeManager: { name: '', idNumber: '', mobile: '' },

  beneficiaries: [defaultBeneficiary()],

  agency: {
    agentName: '',
    agentIdNumber: '',
    agentMobile: '',
    principalSign: '',
    principalDate: '',
  },

  serviceConfirm: {
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
  },
};
