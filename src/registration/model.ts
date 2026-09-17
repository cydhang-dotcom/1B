/**
 * 企业注册服务申请系统的数据模型。
 *
 * 六个步骤：企业基本信息 → 股东及出资 → 企业主要人员 → 企业设立信息 → 委托书办理 → 信息确认并提交。
 * 整份申请是「一份文档」，股东与人员都是记录列表，因此这里用普通对象而非表单字段树。
 */

export const CONFIG = {
  /** 至少填写多少个拟注册名称 */
  nameMinimum: 1,
  /** 拟注册名称栏位上限 */
  nameMaximum: 9,
  /** 开箱即用的三个名称栏位 */
  nameInitial: 3,
  /** 必须有人担任的角色；总经理为选填 */
  requiredRoles: ['法定代表人', '财务负责人', '联系人'],
  /** 币种固定人民币 */
  currency: '人民币',
  /** 草稿结构版本，用于导出文件与旧草稿迁移 */
  version: '2026-09-14',
} as const;

/** 步骤标题 */
export const TITLES = [
  '企业基本信息',
  '股东及出资',
  '企业主要人员',
  '企业设立信息',
  '委托书办理',
  '信息确认并提交',
] as const;

/** 窄屏导航用的短标题 */
export const SHORT = ['基本信息', '股东出资', '主要人员', '设立信息', '委托书', '确认提交'] as const;

export const SUBS = [
  '先从企业的名称、业务与注册地址开始。',
  '添加股东，明确每一份出资与持股关系。',
  '复用已有人员，为企业安排主要角色。',
  '按照拟设立企业的实际安排，填写治理与经营信息。',
  '按步骤打印、签字盖章并上传法定代表人委托书。',
  '核对您的申请信息，确认后完成提交。',
] as const;

/** 人员角色，可多选 */
export const ROLES = ['法定代表人', '财务负责人', '总经理', '联系人'] as const;

export const SHARE_TYPES = ['自然人', '企业', '其他'] as const;

export const EDUCATION_OPTIONS = [
  '博士研究生',
  '硕士研究生',
  '大学本科',
  '大学专科',
  '中专/技校',
  '高中',
  '初中及以下',
  '其他',
] as const;

export const CONTRIBUTION_METHODS = ['货币', '实物', '知识产权', '土地使用权', '劳务', '其他'] as const;

export const ORG_OPTIONS = ['有限责任公司', '股份有限公司', '合伙企业'] as const;

/** 证件照片的固定位置：自然人两张，企业一张 */
export const PHOTO_SLOTS = {
  idFront: '身份证正面',
  idBack: '身份证反面',
  license: '营业执照',
} as const;

export type PhotoSlot = keyof typeof PHOTO_SLOTS;
export type ShareType = (typeof SHARE_TYPES)[number];
export type RoleName = (typeof ROLES)[number];

/** 本地读取的附件；接入接口后换成上传后的文件标识 */
export type Attachment = {
  id: string;
  name: string;
  size: number;
  type: string;
  /** dataURL，仅存本地，不会发送到服务端 */
  data: string;
  slot?: PhotoSlot;
};

export type Person = {
  name: string;
  phone: string;
  email: string;
  education: string;
  address: string;
  files: Attachment[];
};

export type Shareholder = {
  id: string;
  type: ShareType;
  /** 自然人股东关联到 people 中的一条；企业/其他为 null */
  personId: string | null;
  /** 企业名称；「其他」类型时作为股东说明 */
  name: string;
  /** 统一社会信用代码 */
  code: string;
  ratio: string;
  amount: string;
  /** 出资形式，可多选 */
  method: string[];
  files: Attachment[];
};

export type RoleRecord = {
  id: string;
  personId: string | null;
  roles: RoleName[];
};

export type BasicInfo = {
  org: string;
  orgOther: string;
  intro: string;
  service: string;
  scope: string;
  capital: string;
  /** 由服务人员根据企业情况提供注册资金建议 */
  expert: boolean;
  names: string[];
  regAddress: string;
  regRecommend: boolean;
  workAddress: string;
  workRecommend: boolean;
};

export type SetupInfo = {
  board: string;
  directors: string;
  singleDirector: string;
  supervisorBoard: string;
  supervisors: string;
  singleSupervisor: string;
  /** 全体股东一致同意不设监事 */
  unanimous: boolean;
  term: string;
  termYears: string;
  /** 旧草稿里把「20 年」写在 term 上，迁移后暂存于此 */
  legacyTerm: string;
  employees: string;
};

export type ConfirmInfo = {
  exemption: boolean;
  accurate: boolean;
};

export type Authorization = {
  /** 参与打印的受托人姓名，取自「联系人」角色；数据里留空，显示时现取 */
  trusteeName: string;
  /** 同上，本版不收集，打印时留空白下划线 */
  trusteeIdNumber: string;
  /** 已签署扫描件；只保留一份，重新上传即替换 */
  files: Attachment[];
};

export type ApplicationData = {
  basic: BasicInfo;
  /** 人员按 id 去重存放，股东与角色记录通过 personId 复用同一条 */
  people: Record<string, Person>;
  shareholders: Shareholder[];
  roles: RoleRecord[];
  setup: SetupInfo;
  authorization: Authorization;
  confirm: ConfirmInfo;
  status: 'draft' | 'submitted';
  savedAt: string | null;
  submittedAt: string | null;
  submissionPhone: string;
  id: string;
};

/** 校验结果：指明属于哪一步、落在页面上哪个元素、以及是否要打开某条记录 */
export type ValidationError = {
  /** 步骤序号 0-5 */
  section: number;
  /** 页面上对应元素的 id */
  id: string;
  msg: string;
  record?: { kind: 'share' | 'role'; id: string };
};

/** 无依赖冲突的 id 生成；crypto.randomUUID 在非安全上下文不可用，故不采用 */
export const uid = (): string => {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
};

export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** 视为「已填写」：去掉首尾空白后非空 */
export const has = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== '';

/** 出资形式等可多选字段统一成字符串数组 */
export const listOf = (value: unknown): string[] =>
  Array.isArray(value) ? [...new Set(value.filter((v): v is string => typeof v === 'string'))] : has(value) ? [value] : [];

/** 股东/角色记录背后的人；自然人股东与角色记录都指向 people 里的一条 */
export const personOf = (data: ApplicationData, record: { personId: string | null }): Person =>
  (record.personId && data.people[record.personId]) || emptyPerson();

/** 记录在列表里显示的名字：自然人是姓名，企业是企业名称，「其他」是股东说明 */
export const titleOf = (record: Shareholder, person: Person): string =>
  record.type === '自然人' ? person.name : record.name;

/** 附件挂在自然人身上或记录自己身上 */
export const filesOf = (record: Shareholder, person: Person): Attachment[] =>
  record.type === '自然人' ? person.files : record.files;

/** 两个证件位置都齐了才算完整 */
export const idPhotosComplete = (files: Attachment[]): boolean =>
  (['idFront', 'idBack'] as const).every((slot) => files.some((f) => f.slot === slot));

export const hasLicense = (files: Attachment[]): boolean => files.some((f) => f.slot === 'license');

/** 全部股东都是自然人时，才谈得上免申报受益所有人承诺 */
export const isPureNatural = (data: ApplicationData): boolean =>
  data.shareholders.length > 0 && data.shareholders.every((s) => s.type === '自然人');

export const companyCategory = (data: ApplicationData): string => {
  if (!data.shareholders.length) return '尚未识别';
  if (isPureNatural(data)) return '全部为自然人股东';
  return data.shareholders.some((s) => s.type === '其他') ? '含其他类型股东' : '含企业股东';
};

/* -------------------------------------------------------------------- 委托书 */

/**
 * 委托人没填、受托人也没确定时，公文纸上靠这串全角空格把下划线撑开。
 * 确认页要显示「未填写」，因此那里传空串而不是它（trim 会把全角空格去掉）。
 */
export const EMPTY_FILL = '　　　　　　';

export const emptyAuthorization = (): Authorization => ({
  trusteeName: '',
  trusteeIdNumber: '',
  files: [],
});

/**
 * 受托人 = 「联系人」角色的那个人，名字实时取，保证改了人员信息后委托书跟着变。
 * 同一角色多人时取第一条，与原型一致。
 */
export const trusteeOf = (data: ApplicationData): Person =>
  personOf(data, data.roles.find((record) => record.roles.includes('联系人')) ?? { personId: null });

/** 公文纸上要显示的受托人姓名；没确定时用全角空格占位 */
export const trusteeNameOf = (data: ApplicationData): string => {
  const name = trusteeOf(data).name;
  return has(name) ? name : EMPTY_FILL;
};

export const authorizationUploaded = (data: ApplicationData): boolean =>
  (data.authorization?.files.length ?? 0) > 0;

export const emptyPerson = (): Person => ({
  name: '',
  phone: '',
  email: '',
  education: '',
  address: '',
  files: [],
});

/** 已经挂在股东或角色记录上、且有姓名的人员，用于「复用已有人员」 */
export const activePeople = (data: ApplicationData): Array<{ id: string } & Person> =>
  [
    ...new Set([
      ...data.shareholders.filter((record) => record.type === '自然人').map((record) => record.personId),
      ...data.roles.map((record) => record.personId),
    ]),
  ]
    .filter((id): id is string => Boolean(id))
    .map((id) => ({ id, ...(data.people[id] ?? emptyPerson()) }))
    .filter((person) => has(person.name));

export const initial = (): ApplicationData => ({
  basic: {
    org: '',
    orgOther: '',
    intro: '',
    service: '',
    scope: '',
    capital: '',
    expert: false,
    names: Array.from({ length: CONFIG.nameInitial }, () => ''),
    regAddress: '',
    regRecommend: false,
    workAddress: '',
    workRecommend: false,
  },
  people: {},
  shareholders: [],
  roles: [],
  setup: {
    board: '',
    directors: '',
    singleDirector: '',
    supervisorBoard: '',
    supervisors: '',
    singleSupervisor: '',
    unanimous: false,
    term: '',
    termYears: '',
    legacyTerm: '',
    employees: '',
  },
  authorization: emptyAuthorization(),
  confirm: { exemption: false, accurate: false },
  status: 'draft',
  savedAt: null,
  submittedAt: null,
  submissionPhone: '',
  id: uid(),
});
