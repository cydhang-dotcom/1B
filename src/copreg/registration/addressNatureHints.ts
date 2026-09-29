/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 第 5 步（#fill-details）基本信息里两个地址输入框的**性质化提示词**（纯逻辑，无 DOM、无 React）。
 *
 * 为什么要有这个文件：注册地址 / 实际经营地址两个输入框原先无论选哪种「地址性质」，占位文案和
 * 校验报错都是同一句「需与产权证明一致」。可用户选的其实是**租赁用房 / 自有房产 / 集中办公 /
 * 园区孵化器 / 无偿使用证明**这些不同材料口径 —— 选租赁的说「与产权证明一致」会让人去找房产证，
 * 选无偿使用证明的则被指向租赁合同。这里按性质给出对应的占位提示与缺填报错，两边共用同一份文案，
 * 界面提示和校验文案不会各说各话。
 *
 * 「性质 → 文案」的取值口径（两处地址各自一套）：
 *   法定注册地址：租赁用房 / 自有房产 / 集中办公\众创空间 / 园区孵化器 / 无偿使用证明
 *   实际经营办公地址：商业租赁 / 自有产权 / 联合办公\众创工位 / 居家办公申报
 * 认不出的性质（老存档手改、选项还没加载出来）一律回落到**与改造前逐字一致**的通用文案，
 * 免得提示词反而比原来更含糊。
 */

/** 地址输入框所属的位置：reg = 法定注册地址，work = 实际经营办公地址 */
export type AddressSlot = 'reg' | 'work';

/** 一个地址性质选项：val 是存档里存的值，desc 是按钮上的小字说明 */
export interface AddressNatureOption {
  val: string;
  desc: string;
}

/** 法定注册地址性质（顺序、文案与线上一致，改动前请先确认真机显示） */
export const REG_ADDRESS_NATURES: AddressNatureOption[] = [
  { val: '租赁用房', desc: '商业写字楼/租赁办公' },
  { val: '自有房产', desc: '股东或企业自有产权' },
  { val: '集中办公/众创空间', desc: '众创空间/工位协议' },
  { val: '园区孵化器', desc: '产业园集中入驻' },
  { val: '无偿使用证明', desc: '关联方提供无偿使用' },
];

/** 实际经营办公地址性质 */
export const WORK_ADDRESS_NATURES: AddressNatureOption[] = [
  { val: '商业租赁', desc: '写字楼/商业办公租赁' },
  { val: '自有产权', desc: '股东或企业商用房产' },
  { val: '联合办公/众创工位', desc: '众创空间/共享工位' },
  { val: '居家办公申报', desc: '电商/咨询合规居家申报' },
];

/** 没填过地址性质时的兜底选中项（与 defaultData / 老存档迁移口径一致） */
export const DEFAULT_REG_ADDRESS_NATURE = '租赁用房';
/** 同上，实际经营办公地址 */
export const DEFAULT_WORK_ADDRESS_NATURE = '商业租赁';

/**
 * 「同法定注册地址」按钮用的**一一对应**表：注册地址性质 → 实际经营地址性质。
 *
 * 只登记真正对得上的三组（同一个材料口径才能搬过去）：
 *   租赁用房 → 商业租赁、自有房产 → 自有产权、集中办公/众创空间 → 联合办公/众创工位。
 * **园区孵化器 / 无偿使用证明在实际经营那边没有对应选项**（那边的选项只有商业租赁 / 自有产权 /
 * 联合办公·众创工位 / 居家办公申报），所以点复制时只同步地址输入框、**不动已选的地址性质** ——
 * 硬凑一个「自有产权」过去，会让用户以为场地材料也跟着换了。
 */
const COPIED_WORK_NATURE: Record<string, string> = {
  租赁用房: '商业租赁',
  自有房产: '自有产权',
  '集中办公/众创空间': '联合办公/众创工位',
};

/**
 * 复制法定注册地址时，实际经营地址应当跟着切到的性质；**对不上返回 null**（调用方只同步地址）。
 */
export function workNatureForCopiedRegNature(regNature?: string): string | null {
  const key = (regNature ?? '').trim();
  return COPIED_WORK_NATURE[key] ?? null;
}

interface AddressHint {
  /** 输入框为空时显示的占位提示 */
  placeholder: string;
  /** 必填校验未过时的报错（缺填时才出现，非实时校验） */
  missing: string;
}

/** 改造前的通用文案：认不出的性质回落到这里 */
const REG_FALLBACK: AddressHint = {
  placeholder: '请输入详细注册地址（含省/市/区/街道/大厦/楼层及房号，需与产权证明一致）',
  missing: '请填写法定注册详细地址，或勾选由服务商提供',
};

const WORK_FALLBACK: AddressHint = {
  placeholder: '请输入企业实际经营或日常办公地址',
  missing: '请填写实际经营办公地址，或勾选由服务商提供',
};

const REG_HINTS: Record<string, AddressHint> = {
  租赁用房: {
    placeholder: '请输入与房屋租赁合同完全一致的注册地址（含省/市/区/街道/大厦/楼层及房号）',
    missing: '请填写与租赁合同一致的法定注册详细地址（含省/市/区/街道/大厦/楼层及房号），或勾选由服务商提供',
  },
  自有房产: {
    placeholder: '请输入与不动产权证完全一致的注册地址（证载坐落地址，含门牌号及房号）',
    missing: '请填写与不动产权证一致的法定注册详细地址（证载坐落地址），或勾选由服务商提供',
  },
  '集中办公/众创空间': {
    placeholder: '请输入集中办公/众创空间名称及工位号（如：XX众创空间 3 楼 A-018 工位）',
    missing: '请填写集中办公/众创空间的托管地址及工位号（与工位协议一致），或勾选由服务商提供',
  },
  园区孵化器: {
    placeholder: '请输入园区名称、楼栋及房号（如：XX产业园 2 栋 501 室）',
    missing: '请填写园区孵化器的入园地址（园区名称 + 楼栋房号），或勾选由服务商提供',
  },
  无偿使用证明: {
    placeholder: '请输入无偿提供方的房产证载地址（需与无偿使用证明一致）',
    missing: '请填写与无偿使用证明一致的房产地址（含门牌号及房号），或勾选由服务商提供',
  },
};

const WORK_HINTS: Record<string, AddressHint> = {
  商业租赁: {
    placeholder: '请输入与房屋租赁合同一致的办公地址（含省/市/区/街道/大厦/楼层及房号）',
    missing: '请填写与租赁合同一致的实际经营办公地址（含楼层及房号），或勾选由服务商提供',
  },
  自有产权: {
    placeholder: '请输入与不动产权证一致的办公地址（证载坐落地址，含门牌号及房号）',
    missing: '请填写与不动产权证一致的实际经营办公地址（证载坐落地址），或勾选由服务商提供',
  },
  '联合办公/众创工位': {
    placeholder: '请输入联合办公空间名称及工位号（如：XX联合办公 5 楼 B-12 工位）',
    missing: '请填写联合办公/众创空间的场地名称及工位号（与工位协议一致），或勾选由服务商提供',
  },
  居家办公申报: {
    placeholder: '请输入居家办公的具体门牌号及房号（需与房产证明一致，不能只写到小区）',
    missing: '请填写居家办公的具体门牌号及房号（需与房产证明一致），或勾选由服务商提供',
  },
};

function hintOf(slot: AddressSlot, nature?: string): AddressHint {
  const table = slot === 'reg' ? REG_HINTS : WORK_HINTS;
  const fallback = slot === 'reg' ? REG_FALLBACK : WORK_FALLBACK;
  const key = (nature ?? '').trim();
  return table[key] ?? fallback;
}

/** 法定注册地址输入框的占位提示（按地址性质） */
export function regAddressPlaceholder(nature?: string): string {
  return hintOf('reg', nature).placeholder;
}

/** 法定注册地址缺填时的报错（按地址性质） */
export function regAddressMissingError(nature?: string): string {
  return hintOf('reg', nature).missing;
}

/** 实际经营办公地址输入框的占位提示（按地址性质） */
export function workAddressPlaceholder(nature?: string): string {
  return hintOf('work', nature).placeholder;
}

/** 实际经营办公地址缺填时的报错（按地址性质） */
export function workAddressMissingError(nature?: string): string {
  return hintOf('work', nature).missing;
}
