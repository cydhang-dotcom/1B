/**
 * 申请数据的扁平化视图：把嵌套的 ApplicationData 摊成一层「中文键 → 字符串」的表，
 * 供其它协议文件（代办协议、章程、决议等模板）直接取值，例如 {{股东1姓名}}。
 *
 * 两条出路，共用同一个 flatten：
 *   1. localStorage 快照（FLAT_KEY），同源页面同步读取，见 readFlat；
 *   2. 导出 JSON 里的 flat 段，给站外程序或存档用。
 *
 * 三条约定：
 *   - 值一律是字符串，空值写 ''。键固定存在，模板取到空串好过取到 undefined。
 *   - 照片只写「已上传 / 未上传」，dataURL 留在 IndexedDB，不进扁平值。
 *   - 序号从 1 开始，配套写出「股东总数」「人员总数」，读取方据此遍历。
 */

import {
  CONFIG,
  ROLES,
  companyCategory,
  has,
  personOf,
  titleOf,
  type ApplicationData,
  type Attachment,
  type PhotoSlot,
} from './model';

/** localStorage 里的扁平快照键；与草稿键 DRAFT_KEY 区分开 */
export const FLAT_KEY = '1b_registration_flat';

export type FlatValues = Record<string, string>;

const yesNo = (value: boolean): string => (value ? '是' : '否');

const uploadState = (files: Attachment[], slot: PhotoSlot): string =>
  files.some((file) => file.slot === slot) ? '已上传' : '未上传';

/** 某位角色由谁担任；同一角色多人时不取（视为未定） */
const personInRole = (data: ApplicationData, role: string) => {
  const holders = data.roles.filter((record) => record.roles.includes(role as (typeof ROLES)[number]));
  return holders.length === 1 ? personOf(data, holders[0]) : null;
};

/** 出资比例合计；有股东没填或填了非数字时返回空串，避免给出一个骗人的部分和 */
const totalRatio = (data: ApplicationData): string => {
  const ratios = data.shareholders.map((record) => record.ratio.trim());
  if (!ratios.length || ratios.some((value) => value === '' || !Number.isFinite(Number(value)))) return '';
  const sum = ratios.reduce((total, value) => total + Number(value), 0);
  return String(Number(sum.toFixed(4)));
};

export function flatten(data: ApplicationData): FlatValues {
  const flat: FlatValues = {};
  const { basic, setup } = data;

  /* ------------------------------------------------------------ 基本信息 */

  flat['组织形式'] = basic.org;
  flat['组织形式说明'] = basic.orgOther;
  flat['企业类型'] = basic.org === '其他' && has(basic.orgOther) ? basic.orgOther : basic.org;
  flat['企业简介'] = basic.intro;
  flat['拟经营业务'] = basic.service;
  flat['经营范围'] = basic.scope;
  flat['注册资本'] = basic.capital;
  flat['注册资金由专家推荐'] = yesNo(basic.expert);
  basic.names.forEach((name, index) => {
    flat[`拟注册名称${index + 1}`] = name;
  });
  flat['注册地址'] = basic.regAddress;
  flat['注册地址由服务商推荐'] = yesNo(basic.regRecommend);
  flat['经营地址'] = basic.workAddress;
  flat['经营地址由服务商推荐'] = yesNo(basic.workRecommend);

  /* ------------------------------------------------------------ 股东出资 */

  data.shareholders.forEach((record, index) => {
    const at = `股东${index + 1}`;
    const person = personOf(data, record);
    flat[`${at}类型`] = record.type;
    flat[`${at}名称`] = titleOf(record, person);
    flat[`${at}出资比例`] = record.ratio;
    flat[`${at}出资金额`] = record.amount;
    flat[`${at}出资形式`] = record.method.join('、');

    if (record.type === '自然人') {
      flat[`${at}联系电话`] = person.phone;
      flat[`${at}电子邮箱`] = person.email;
      flat[`${at}学历`] = person.education;
      flat[`${at}联系地址`] = person.address;
      flat[`${at}身份证正面`] = uploadState(person.files, 'idFront');
      flat[`${at}身份证反面`] = uploadState(person.files, 'idBack');
    } else {
      flat[`${at}统一社会信用代码`] = record.code;
      flat[`${at}营业执照`] = uploadState(record.files, 'license');
    }
  });

  /* ------------------------------------------------------------ 主要人员 */

  data.roles.forEach((record, index) => {
    const at = `人员${index + 1}`;
    const person = personOf(data, record);
    flat[`${at}姓名`] = person.name;
    flat[`${at}角色`] = record.roles.join('、');
    flat[`${at}联系电话`] = person.phone;
    flat[`${at}电子邮箱`] = person.email;
    flat[`${at}学历`] = person.education;
    flat[`${at}联系地址`] = person.address;
    flat[`${at}身份证正面`] = uploadState(person.files, 'idFront');
    flat[`${at}身份证反面`] = uploadState(person.files, 'idBack');
  });

  // 协议里通常直接写角色而不是「人员 2」，这里按角色再派生一份
  ROLES.forEach((role) => {
    const person = personInRole(data, role);
    flat[role] = person?.name ?? '';
    flat[`${role}联系电话`] = person?.phone ?? '';
  });

  /* ------------------------------------------------------------ 设立信息 */

  flat['董事会'] = setup.board;
  flat['董事人数'] = setup.directors;
  flat['董事安排'] = setup.singleDirector;
  flat['监事会'] = setup.supervisorBoard;
  flat['监事人数'] = setup.supervisors;
  flat['监事安排'] = setup.singleSupervisor;
  flat['全体股东一致同意不设监事'] = yesNo(setup.unanimous);
  flat['营业期限'] = setup.term;
  flat['固定年限'] = setup.termYears;
  flat['员工人数'] = setup.employees;
  // setup.legacyTerm 只是旧草稿的迁移暂存处，不属于业务数据，不写进扁平值

  /* ---------------------------------------------------------------- 确认 */

  flat['信息真实性确认'] = yesNo(data.confirm.accurate);
  flat['免申报受益所有人承诺'] = yesNo(data.confirm.exemption);

  /* ------------------------------------------------------------ 汇总派生 */

  flat['股东总数'] = String(data.shareholders.length);
  flat['自然人股东数'] = String(data.shareholders.filter((record) => record.type === '自然人').length);
  flat['企业股东数'] = String(data.shareholders.filter((record) => record.type === '企业').length);
  flat['其他股东数'] = String(data.shareholders.filter((record) => record.type === '其他').length);
  flat['股东构成'] = companyCategory(data);
  flat['出资比例合计'] = totalRatio(data);
  flat['人员总数'] = String(data.roles.length);
  flat['拟注册名称数量'] = String(basic.names.filter(has).length);

  /* ------------------------------------------------------------ 元信息 */

  flat['_版本'] = CONFIG.version;
  flat['_申请编号'] = data.id;
  flat['_状态'] = data.status === 'submitted' ? '已提交' : '草稿';
  flat['_暂存时间'] = data.savedAt ?? '';
  flat['_提交时间'] = data.submittedAt ?? '';
  flat['_提交手机号'] = data.submissionPhone;

  return flat;
}

/**
 * 刷新 localStorage 快照。扁平值只是给其他页面看的副本，且随时可由草稿重算，
 * 因此 localStorage 不可用（隐私模式、配额满）时静默跳过，不影响暂存本身。
 */
export function writeFlat(data: ApplicationData): void {
  try {
    localStorage.setItem(FLAT_KEY, JSON.stringify(flatten(data)));
  } catch {
    // ponytail: 不做降级与提示；快照丢失时其他页面读不到，暂存与导出不受影响
  }
}

/** 供同源的其他页面（如协议页）同步读取；没有、损坏或值不是字符串时返回 null */
export function readFlat(): FlatValues | null {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(FLAT_KEY) ?? 'null');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const entries = Object.entries(parsed as Record<string, unknown>);
    if (entries.some(([, value]) => typeof value !== 'string')) return null;
    return Object.fromEntries(entries) as FlatValues;
  } catch {
    return null;
  }
}
