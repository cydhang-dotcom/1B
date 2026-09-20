/**
 * copreg（售前：问卷 → 方案 → 支付）与 registration（售中：企业设立资料填报）
 * 之间的数据映射层。两边是上下游而不是重叠，所以这里只搬「双方都表达得了」的字段。
 *
 * 两边的完整字段清单与对照表见 docs/copreg-registration-fields.md。
 *
 * 三个同名词在两边含义不同，映射时必须按下面的约定走，不能照着字段名硬对：
 *
 *   regAddress  copreg 的 survey.regAddress 存的是「是否需要推荐注册地址」（'是（需推荐）'），
 *               **不是地址本身** → 它对应 registration 的 basic.regRecommend。
 *               真实注册地址字符串 copreg 全程不采集，映射时 registration 那边保持原值。
 *   license     copreg 的 survey.license 是「涉及许可 / 备案资质」（食品经营许可证之类）；
 *               registration 的 Attachment.slot === 'license' 是企业股东的**营业执照照片**。
 *               两者毫无关系，不互相映射。
 *   scope       两边都是经营范围，但 copreg 是 string[]、registration 是 string，
 *               在本层做双向转换，分隔符统一为「、」。
 *
 * 两处结构性差异让映射成为**有损**，已在对应位置注明，不做假装能对齐的处理：
 *   身份证号   copreg 以文本收集；registration 只收正反面照片（Person 里没有 idCard 字段）。
 *   监事       copreg 有具名监事；registration 的 ROLES 里没有「监事」，只有监事会设置。
 */

import {
  ORG_OPTIONS,
  emptyPerson,
  has,
  initial,
  uid,
  type ApplicationData,
  type BasicInfo,
  type Person,
  type RoleName,
  type RoleRecord,
  type Shareholder as ApplicationShareholder,
} from '../registration/model';
import type {
  PaymentOrder,
  RegistrationDetails,
  RegistrationPlan,
  Shareholder as CopregShareholder,
  SurveyData,
} from '../copreg/types';

/* ------------------------------------------------------------------ 常量 */

/** 经营范围往返用的分隔符；registration 是自由文本，用「、」串起来最接近中文习惯 */
const SCOPE_SEPARATOR = '、';

/**
 * copreg 问卷里「是否需要推荐注册地址」的两个选项值，取自 SurveyStep.tsx:702。
 * 判断时只看首字，不依赖括号里的说明文案，避免改文案就失配。
 */
const REG_ADDRESS_RECOMMEND = '是（需推荐）';
const REG_ADDRESS_SELF = '否（自有地址）';

/* ------------------------------------------------------------ 基础转换 */

/** copreg 的单选题值形如 '是（需推荐）' / '否（自有地址）' */
const isAffirmative = (value: string | undefined): boolean =>
  (value ?? '').trim().startsWith('是');

/** 从 '100 万元人民币' / '建议 100 万元人民币' 里取出数字串；取不到返回空串 */
const digitsOf = (value: string): string => {
  const matched = value.replace(/[,\s]/g, '').match(/\d+/);
  return matched ? matched[0] : '';
};

/** copreg 的出资比例/金额是数字，registration 是字符串；空值写 '' 而不是 'NaN' 或 '0' */
const textOfNumber = (value: number | undefined | null): string =>
  typeof value === 'number' && Number.isFinite(value) ? String(value) : '';

/** registration 的经营范围自由文本 → copreg 的字符串数组 */
export const splitScope = (value: string): string[] =>
  value
    .split(/[、,，;；\n\r]+/)
    .map((item) => item.trim())
    .filter((item) => item !== '');

/** copreg 的经营范围数组 → registration 的自由文本 */
export const joinScope = (values: string[]): string =>
  values
    .map((item) => item.trim())
    .filter((item) => item !== '')
    .join(SCOPE_SEPARATOR);

/**
 * copreg 的 companyType 是「有限责任公司（自然人投资或控股）」这类带后缀的自由文本，
 * registration 的 org 只接受 ORG_OPTIONS 里的三项。匹配不到就落到「其他」并把原文放进 orgOther。
 */
const orgOf = (companyType: string): Pick<BasicInfo, 'org' | 'orgOther'> => {
  const matched = ORG_OPTIONS.find((option) => companyType.includes(option));
  if (matched) return { org: matched, orgOther: '' };
  return has(companyType) ? { org: '其他', orgOther: companyType } : { org: '', orgOther: '' };
};

/** copreg 的办公地址是拆开的四段，拼回 registration 的一行地址 */
const officeAddressOf = (details: RegistrationDetails): string =>
  [details.officeAddress?.region, details.officeAddress?.detail]
    .map((part) => (part ?? '').trim())
    .filter((part) => part !== '')
    .join('');

/* ------------------------------------------------------------ 人员归并 */

/** 一个人的来源片段；只有姓名是必需的，其余按各自渠道能给多少填多少 */
type PersonSeed = { idCard?: string; name: string; phone?: string; email?: string };

/**
 * 自然人按身份证号去重；没有证件号时退化成按姓名去重。
 * copreg 里同一个人可能同时是股东、法定代表人、财务负责人、联系人（四份独立记录），
 * registration 侧 people 必须合成一条，否则 schema 会报「该人员已重复添加」。
 */
const personKeyOf = (idCard: string | undefined, name: string): string =>
  (idCard ?? '').trim() || `name:${name.trim()}`;

const collectPeople = (seeds: PersonSeed[]) => {
  const people: Record<string, Person> = {};
  const idByKey = new Map<string, string>();

  seeds.forEach((seed) => {
    const name = (seed.name ?? '').trim();
    const idCard = (seed.idCard ?? '').trim();
    // 姓名和证件号都空的人不建记录，否则 people 里会塞进一串空壳
    if (!name && !idCard) return;

    const key = personKeyOf(idCard, name);
    const existingId = idByKey.get(key);
    if (existingId) {
      // 同一个人出现在多处：手机号、邮箱补第一个非空值，不覆盖已有内容
      const existing = people[existingId];
      people[existingId] = {
        ...existing,
        phone: existing.phone || (seed.phone ?? '').trim(),
        email: existing.email || (seed.email ?? '').trim(),
      };
      return;
    }

    const id = uid();
    idByKey.set(key, id);
    people[id] = {
      ...emptyPerson(),
      name,
      phone: (seed.phone ?? '').trim(),
      email: (seed.email ?? '').trim(),
    };
  });

  return { people, idByKey };
};

/* ---------------------------------------------------------------- 输入 */

/** 映射层的输入：copreg 的全部业务状态 */
export interface CopregSnapshot {
  survey: SurveyData;
  plan: RegistrationPlan;
  order: PaymentOrder;
  details: RegistrationDetails;
}

/* ------------------------------------------- copreg → registration（预填） */

/**
 * 按 copreg 的售前数据生成一份企业注册申请。copreg 没采集过的字段一律留空，
 * 等用户在 registration 里补 —— 这里不做任何「猜一个合理默认值」的填充。
 */
export function applicationFromCopreg(snapshot: CopregSnapshot): ApplicationData {
  const { survey, plan, order, details } = snapshot;

  // 注册资本以 plan.capitalAmount 为准：survey.capitalAmount 只在「不需要专家建议」时被 plan 采用，
  // 而 plan.capitalAmount 是用户在下单前确认过的那一份（survey.capitalAmount 是它的上游，不是另一个答案）
  const capital = plan.capitalAmount || survey.capitalAmount;
  const needsExpert = isAffirmative(survey.capitalRec);

  // 拟注册名称：copreg 固定三个槽位，正好对上 registration 开箱即用的 CONFIG.nameInitial 个输入框
  const names = [details.primaryName, details.backupName1, details.backupName2].map((name) =>
    (name ?? '').trim(),
  );

  const { people, idByKey } = collectPeople([
    ...details.shareholders.map((record) => ({
      idCard: record.idCard,
      name: record.name,
      phone: record.phone,
    })),
    {
      idCard: details.legalRepresentative.idCard,
      name: details.legalRepresentative.name,
      phone: details.legalRepresentative.phone,
      email: details.legalRepresentative.email,
    },
    {
      idCard: details.financeOfficer.idCard,
      name: details.financeOfficer.name,
      phone: details.financeOfficer.phone,
    },
    { name: order.contactName, phone: order.contactPhone },
  ]);

  const shareholders: ApplicationShareholder[] = details.shareholders.map((record) => ({
    id: uid(),
    type: '自然人',
    personId: idByKey.get(personKeyOf(record.idCard, record.name)) ?? null,
    // 自然人股东的名称取自关联人员，自己那份 name 留空（见 model.ts 的 titleOf）
    name: '',
    code: '',
    ratio: textOfNumber(record.ratio),
    amount: textOfNumber(record.capitalAmount),
    // copreg 不采集出资形式，留空由用户补；schema 也不把它列为必填
    method: [],
    files: [],
  }));

  // 同一个人只允许一条角色记录，多个角色并进去（见 schema.ts:221 的重复校验）
  const rolesOf = new Map<string, RoleName[]>();
  const assign = (seed: PersonSeed, role: RoleName) => {
    const personId = idByKey.get(personKeyOf(seed.idCard, seed.name));
    if (!personId) return;
    const current = rolesOf.get(personId) ?? [];
    if (!current.includes(role)) rolesOf.set(personId, [...current, role]);
  };

  assign({ idCard: details.legalRepresentative.idCard, name: details.legalRepresentative.name }, '法定代表人');
  assign({ idCard: details.financeOfficer.idCard, name: details.financeOfficer.name }, '财务负责人');
  assign({ name: order.contactName }, '联系人');
  // details.supervisor 不映射：registration 的 ROLES 里没有「监事」，
  // 监事会只以「设/不设、人数、安排」的形式存在于 setup，没有地方安放一个具名监事

  const roles: RoleRecord[] = [...rolesOf.entries()].map(([personId, list]) => ({
    id: uid(),
    personId,
    roles: list,
  }));

  const nextCapital = digitsOf(capital);
  const blank = initial();

  return {
    ...blank,
    basic: {
      ...blank.basic,
      ...orgOf(plan.companyType),
      intro: (survey.companyDesc ?? '').trim(),
      service: (survey.bizDesc ?? '').trim(),
      scope: joinScope(survey.scope ?? []),
      // 选了专家建议就等于把金额交给服务人员定，与 registration 的 expert 同义，此时不填金额
      capital: needsExpert ? '' : nextCapital,
      expert: needsExpert,
      names,
      // survey.regAddress 是「要不要推荐」，不是地址；真实地址 copreg 不采集，留空
      regAddress: '',
      regRecommend: isAffirmative(survey.regAddress),
      workAddress: officeAddressOf(details),
      // survey.officeSpace 问的是「要不要推荐实体办公场地」，与 registration 的
      // workRecommend（经营地址由服务商推荐）最接近但仍不是同一件事，按最接近的语义映射
      workRecommend: isAffirmative(survey.officeSpace),
    },
    people,
    shareholders,
    roles,
  };
}

/* ------------------------------------------- registration → copreg（回填） */

/** 从 registration 的角色记录里取担任某角色的人；同一角色多人时不取（视为未定） */
const personInRole = (app: ApplicationData, role: RoleName): Person | null => {
  const holders = app.roles.filter((record) => record.roles.includes(role));
  if (holders.length !== 1) return null;
  const personId = holders[0].personId;
  return personId ? app.people[personId] ?? null : null;
};

const legalRepresentativeOf = (app: ApplicationData): RegistrationDetails['legalRepresentative'] => {
  const person = personInRole(app, '法定代表人');
  return {
    name: person?.name ?? '',
    // registration 只收身份证正反面照片，没有证件号文本，这里补不出来
    idCard: '',
    phone: person?.phone ?? '',
    email: person?.email ?? '',
  };
};

const financeOfficerOf = (app: ApplicationData): RegistrationDetails['financeOfficer'] => {
  const person = personInRole(app, '财务负责人');
  return { name: person?.name ?? '', idCard: '', phone: person?.phone ?? '' };
};

const shareholderOf = (record: ApplicationShareholder, person: Person): CopregShareholder => ({
  id: record.id,
  name: person.name,
  // registration 只存身份证照片不存号码，这里补不出来
  idCard: '',
  phone: person.phone,
  // copreg 这边是数字，转换失败时给 0 而不是 NaN
  ratio: Number(record.ratio) || 0,
  capitalAmount: Number(record.amount) || 0,
});

/**
 * 用 registration 的申请回填 copreg。
 * registration 表达不了的字段（问卷里的意向选项、行业类别、监事、资料清单）一律保留 base，
 * 不做清空 —— base 是 copreg 自己的状态，只有 registration 确实掌握的部分才覆盖。
 */
export function copregFromApplication(base: CopregSnapshot, app: ApplicationData): CopregSnapshot {
  const { basic } = app;
  const contact = personInRole(app, '联系人');
  const naturalShareholders = app.shareholders.filter((record) => record.type === '自然人');

  const shareholderTypes = [...new Set(app.shareholders.map((record) => record.type))];

  return {
    ...base,
    survey: {
      ...base.survey,
      companyDesc: basic.intro,
      bizDesc: basic.service,
      scope: splitScope(basic.scope),
      capitalRec: basic.expert ? '是' : '否',
      capitalAmount: basic.capital,
      regAddress: basic.regRecommend ? REG_ADDRESS_RECOMMEND : REG_ADDRESS_SELF,
      officeSpace: basic.workRecommend ? '是' : '否',
      shareholderType: shareholderTypes,
      shareholderCount: app.shareholders.length ? `${app.shareholders.length} 个` : '',
      // coreNeeds / license / sensitive / invoiceReq / monthlyAmount / revenue / revenueOther
      // 在 registration 里都没有对应字段，保留 base。
      // 注意 license 指的是「许可 / 备案资质」，与 registration 的营业执照附件不是一回事
    },
    order: {
      ...base.order,
      contactName: contact?.name ?? base.order.contactName,
      contactPhone: contact?.phone ?? base.order.contactPhone,
    },
    details: {
      ...base.details,
      primaryName: basic.names[0] ?? '',
      backupName1: basic.names[1] ?? '',
      backupName2: basic.names[2] ?? '',
      legalRepresentative: legalRepresentativeOf(app),
      financeOfficer: financeOfficerOf(app),
      // details.supervisor 保留 base：registration 没有具名监事，只有监事会设置
      shareholders: naturalShareholders.map((record) => {
        const personId = record.personId;
        const person = personId ? app.people[personId] ?? emptyPerson() : emptyPerson();
        return shareholderOf(record, person);
      }),
      officeAddress: {
        ...base.details.officeAddress,
        // registration 只有一行自由文本的经营地址，拆不出「区/详址/性质/面积」，
        // 整串放进 region，其余三段保留 base
        region: basic.workAddress || base.details.officeAddress.region,
      },
      // details.docs 保留 base：registration 的附件是 dataURL 二进制 + slot 语义，
      // copreg 的 docs 只是「传没传」的清单，两边形状对不上
    },
    // plan 是 copreg 独有的报价/套餐，registration 里没有对应概念，由 ...base 原样带过
  };
}
