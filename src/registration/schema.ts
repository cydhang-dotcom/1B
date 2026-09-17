import { z } from 'zod';

import {
  CONFIG,
  SHARE_TYPES,
  authorizationUploaded,
  has,
  companyCategory,
  filesOf,
  hasLicense,
  idPhotosComplete,
  isPureNatural,
  personOf,
  titleOf,
  type ApplicationData,
  type BasicInfo,
  type Person,
  type RoleRecord,
  type SetupInfo,
  type Shareholder,
  type ValidationError,
} from './model';

/**
 * 规则只在 zod 里写一遍，报错文案与参考实现保持一致。
 * 元素 id 与列表前缀由下面的 validate() 负责拼装，因为「第几位股东」这类上下文
 * zod 拿不到，而且页面上报错要挂到具体元素上。
 */

const requiredText = (label: string) =>
  z.string().trim().min(1, `请填写${label}`);

const personSchema = z.object({
  name: requiredText('姓名'),
  phone: requiredText('联系电话'),
  email: z
    .string()
    .refine((value) => !has(value) || /^\S+@\S+\.\S+$/.test(value), '电子邮箱格式不正确'),
  education: z.string(),
  address: requiredText('居住地址'),
});

/** 出资比例、金额、形式；自然人/企业/其他三类股东共用 */
const contributionSchema = z.object({
  ratio: z.string().refine((value) => {
    const ratio = Number(value);
    return has(value) && Number.isFinite(ratio) && ratio > 0 && ratio <= 100;
  }, '出资比例需大于 0 且不超过 100%'),
  amount: z
    .string()
    .refine((value) => !has(value) || (Number.isFinite(Number(value)) && Number(value) >= 0), '出资金额需为非负数字'),
});

/** 非自然人股东的主体信息：企业要名称与信用代码，「其他」只要一段说明 */
const entitySchema = (type: Shareholder['type']) =>
  z.object({
    name: requiredText(type === '企业' ? '企业名称' : '股东说明'),
    code: z
      .string()
      .refine((value) => type !== '企业' || has(value), '请填写统一社会信用代码或证件号码'),
  });

const basicSchema = z
  .object({
    org: z.string().min(1, '请选择企业组织形式'),
    orgOther: z.string(),
    intro: requiredText('企业简介'),
    service: requiredText('主营服务简介'),
    scope: requiredText('经营范围'),
    capital: z.string(),
    expert: z.boolean(),
    names: z.array(z.string()).max(CONFIG.nameMaximum, `拟注册名称最多 ${CONFIG.nameMaximum} 个`),
    regAddress: z.string(),
    regRecommend: z.boolean(),
    workAddress: z.string(),
    workRecommend: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.org === '其他' && !has(value.orgOther)) {
      ctx.addIssue({ code: 'custom', path: ['orgOther'], message: '请填写具体组织形式' });
    }
    // 选「专家推荐」时金额由服务人员给出，此时不校验
    if (!value.expert && !/^\d+$/.test(value.capital)) {
      ctx.addIssue({
        code: 'custom',
        path: ['capital'],
        message: '注册资本需填写非负整数金额，或选择专家推荐',
      });
    }
    if (!value.names.some(has)) {
      ctx.addIssue({ code: 'custom', path: ['names', 0], message: '请至少填写一个拟注册名称' });
    }
    // 前三个是开箱栏位，可以留空；从第四个起是用户自己加的，要么填要么删
    value.names.forEach((name, index) => {
      if (index >= CONFIG.nameInitial && !has(name)) {
        ctx.addIssue({
          code: 'custom',
          path: ['names', index],
          message: `请填写新增的第 ${index + 1} 个名称，或移除该名称`,
        });
      }
    });
    // 勾了「由服务商推荐」就等于把地址交给服务人员，不再要求填写
    if (!value.regRecommend && !has(value.regAddress)) {
      ctx.addIssue({ code: 'custom', path: ['regAddress'], message: '请填写注册地址，或选择服务商推荐' });
    }
    if (!value.workRecommend && !has(value.workAddress)) {
      ctx.addIssue({ code: 'custom', path: ['workAddress'], message: '请填写实际经营地址，或选择服务商推荐' });
    }
  });

const setupSchema = z
  .object({
    board: z.string(),
    directors: z.string(),
    singleDirector: z.string(),
    supervisorBoard: z.string(),
    supervisors: z.string(),
    singleSupervisor: z.string(),
    unanimous: z.boolean(),
    term: z.string(),
    termYears: z.string(),
    legacyTerm: z.string(),
    employees: z.string(),
  })
  .superRefine((value, ctx) => {
    // 只有真正在用的人数才校验；不设董事会时「董事人数」是隐藏字段
    const fields: Array<[keyof SetupInfo, boolean]> = [
      ['directors', value.board === '设董事会'],
      ['supervisors', value.supervisorBoard === '设监事会'],
      ['employees', true],
    ];
    fields.forEach(([key, active]) => {
      if (active && has(value[key]) && !/^\d+$/.test(value[key])) {
        ctx.addIssue({ code: 'custom', path: [key], message: '人数需为非负整数' });
      }
    });
    if (value.term === '固定年限' && (!/^\d+$/.test(value.termYears) || Number(value.termYears) < 1)) {
      ctx.addIssue({ code: 'custom', path: ['termYears'], message: '固定年限需填写大于 0 的整数年数' });
    }
  });

/** 取一份 zod 结果里的全部文案，去重后保持出现顺序 */
function messagesOf<T>(schema: z.ZodType<T>, value: unknown): string[] {
  const result = schema.safeParse(value);
  if (result.success) return [];
  return [...new Set(result.error.issues.map((issue) => issue.message))];
}

/** zod 的 path 映射到页面上元素的 id：names[2] → name-2 */
const basicIdOf = (path: readonly PropertyKey[]): string => {
  const [head, index] = path;
  if (head === 'names') return `name-${Number(index ?? 0)}`;
  return String(head);
};

function basicErrors(basic: BasicInfo): ValidationError[] {
  const result = basicSchema.safeParse(basic);
  if (result.success) return [];
  return result.error.issues.map((issue) => ({
    section: 0,
    id: basicIdOf(issue.path),
    msg: issue.message,
  }));
}

/** 一位自然人的必填项，单独跑一遍好把文案并进「股东 N」那一行 */
const personErrors = (person: Person): string[] => messagesOf(personSchema, person);

function shareholderErrors(data: ApplicationData): ValidationError[] {
  const errors: ValidationError[] = [];
  if (data.shareholders.length < 1) {
    return [{ section: 1, id: 'shareholders', msg: '请添加至少 1 位股东' }];
  }

  data.shareholders.forEach((record, index) => {
    const person = personOf(data, record);
    const messages: string[] = [];

    if (record.type === '自然人') {
      messages.push(...personErrors(person));
    } else {
      messages.push(...messagesOf(entitySchema(record.type), record));
    }
    messages.push(...messagesOf(contributionSchema, record));
    // 证件照片可以稍后再补，但提交前必须齐；这里只报缺什么，不拦保存
    if (record.type === '自然人' && !idPhotosComplete(filesOf(record, person))) {
      messages.push('请补齐身份证正面和反面照片');
    }
    if (record.type === '企业' && !hasLicense(filesOf(record, person))) {
      messages.push('请上传加盖公章的营业执照');
    }

    if (messages.length) {
      errors.push({
        section: 1,
        id: `share-${record.id}`,
        msg: `股东 ${index + 1}（${titleOf(record, person) || '未命名'}）：${messages.join('；')}`,
        record: { kind: 'share', id: record.id },
      });
    }
  });

  return errors;
}

function roleErrors(data: ApplicationData): ValidationError[] {
  const errors: ValidationError[] = [];
  const assigned = data.roles.flatMap((record) => record.roles);

  CONFIG.requiredRoles.forEach((role) => {
    if (!assigned.includes(role)) {
      errors.push({ section: 2, id: 'roles', msg: `请设置${role}` });
    }
  });

  data.roles.forEach((record, index) => {
    const person = personOf(data, record);
    const messages = personErrors(person);
    // 同一个人只应有一条记录，多出来的角色并到原记录里
    if (data.roles.findIndex((item) => item.personId === record.personId) < index) {
      messages.push('该人员已重复添加，请保留一条记录并合并角色');
    }
    if (!record.roles.length) messages.push('请选择人员角色');
    if (!idPhotosComplete(person.files)) messages.push('请补齐身份证正面和反面照片');

    if (messages.length) {
      errors.push({
        section: 2,
        id: `role-${record.id}`,
        msg: `人员 ${index + 1}（${person.name || '未命名'}）：${messages.join('；')}`,
        record: { kind: 'role', id: record.id },
      });
    }
  });

  return errors;
}

function setupErrors(setup: SetupInfo): ValidationError[] {
  const result = setupSchema.safeParse(setup);
  if (result.success) return [];
  return result.error.issues.map((issue) => ({
    section: 3,
    id: String(issue.path[0]),
    msg: issue.message,
  }));
}

/** 全量校验，按步骤顺序返回 */
export function validate(data: ApplicationData): ValidationError[] {
  return [
    ...basicErrors(data.basic),
    ...shareholderErrors(data),
    ...roleErrors(data),
    ...setupErrors(data.setup),
    ...(data.confirm.accurate
      ? []
      : [{ section: 5, id: 'accurate', msg: '请勾选信息真实性确认' }]),
  ];
}

/** 单条记录保存前的校验（比提交宽松：不要求证件照片齐全） */
export function shareholderDraftErrors(record: Shareholder, person: Person): string[] {
  const messages: string[] = [];
  if (record.type === '自然人') messages.push(...personErrors(person));
  else messages.push(...messagesOf(entitySchema(record.type), record));
  messages.push(...messagesOf(contributionSchema, record));
  return messages;
}

export function roleDraftErrors(
  record: RoleRecord,
  person: Person,
  personTaken: boolean,
): string[] {
  const messages = personErrors(person);
  if (personTaken) messages.push('该人员已添加，请在原记录中调整角色');
  if (!record.roles.length) messages.push('请选择至少一个人员角色');
  return messages;
}

/** 设立信息是否填全，用于导航上的「完成」标记；不参与提交拦截 */
export function setupComplete(setup: SetupInfo): boolean {
  const boardDone =
    setup.board === '设董事会' ? has(setup.directors) : has(setup.singleDirector);
  const supervisorDone =
    setup.supervisorBoard === '设监事会'
      ? has(setup.supervisors)
      : has(setup.singleSupervisor) && (setup.singleSupervisor !== '不设监事' || setup.unanimous);
  const termDone =
    has(setup.term) && (setup.term !== '固定年限' || (/^\d+$/.test(setup.termYears) && Number(setup.termYears) > 0));
  return Boolean(setup.board && boardDone && setup.supervisorBoard && supervisorDone && termDone && has(setup.employees));
}

/** 这一步用户是否已经动过，用于区分「空白」与「不完整」 */
export function sectionTouched(data: ApplicationData, section: number): boolean {
  switch (section) {
    case 0:
      return Object.values(data.basic).some((value) =>
        Array.isArray(value) ? value.some(has) : typeof value === 'boolean' ? value : has(value),
      );
    case 1:
      return data.shareholders.length > 0;
    case 2:
      return data.roles.length > 0;
    case 3:
      return Object.values(data.setup).some((value) => (typeof value === 'boolean' ? value : has(value)));
    case 4:
      // 委托书这一步只有「传没传」一个信号；不参与提交拦截，故 validate 里没有对应规则
      return authorizationUploaded(data);
    default:
      return data.confirm.accurate || (isPureNatural(data) && data.confirm.exemption);
  }
}
