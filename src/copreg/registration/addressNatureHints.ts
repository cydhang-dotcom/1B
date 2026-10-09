/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 第 5 步（#fill-details）基本信息里两个地址输入框的**性质化提示词**（纯逻辑，无 DOM、无 React）。
 *
 * 用户在 2026-10-08 给了五档口径（**地址怎么填 + 要传哪些材料**），两个地址共用同一份材料清单：
 *
 *   类型 1 租赁用房（商业写字楼/租赁办公）  按房产证或租赁合同上的地址填写
 *   类型 2 自有房产（股东或企业自有产权）    按房产证上的地址填写
 *   类型 3 无偿使用证明                     必须与《无偿使用证明》完全一致（红字报错重点，不带 ⚠️ 前缀）
 *
 * （2026-10-08 后续：`集中办公/众创空间` 与 `园区孵化器` 两档按用户要求删掉，选项只剩上面三项）
 *
 * 「性质 → 文案」的取值口径：**两个地址共用同一套性质**（2026-10-08 用户要求以法定注册地址那套为准）：
 *   租赁用房 / 自有房产 / 无偿使用证明
 * 老存档里的旧值：商业租赁 → 租赁用房、自有产权 → 自有房产（同义平移）；
 * 其余已下架的档（联合办公·众创工位 / 集中办公·众创空间 / 园区孵化器 / 居家办公申报）
 * 一律清空让用户重选（见 `normalizeAddressNature`）—— 性质决定要传哪些场地材料，不能替他猜。
 * 认不出的性质（手改存档、选项还没加载出来）一律回落到**通用文案**，免得提示词反而更含糊。
 */

/** 地址输入框所属的位置：reg = 法定注册地址，work = 实际经营办公地址 */
export type AddressSlot = 'reg' | 'work';

/** 一个地址性质选项：val 是存档里存的值，desc 是按钮上的小字说明 */
export interface AddressNatureOption {
  val: string;
  desc: string;
}

/**
 * 地址性质选项表 —— **两个地址共用这一套**（2026-10-08 用户要求「2 个地址性质改为相同的，
 * 以法定注册地址为准」）。原来实际经营那边是商业租赁 / 自有产权 / 联合办公·众创工位 / 居家办公申报
 * 那套，和注册地址不是一套口径，用户选了两边还得各自理解一遍；现在两边同词同义、材料清单也同一份。
 *
 * 同日又按用户要求**删掉两档**：`集中办公/众创空间`（原实际经营那边的 `联合办公/众创工位`）与
 * `园区孵化器`，只剩 租赁用房 / 自有房产 / 无偿使用证明。老存档里选中这两档的，载入时会被清空
 * 让用户重选（见 `normalizeAddressNature`）—— 性质决定要传哪些场地材料，不能替他猜一个。
 */
export const ADDRESS_NATURES: AddressNatureOption[] = [
  { val: '租赁用房', desc: '商业写字楼/租赁办公' },
  { val: '自有房产', desc: '股东或企业自有产权' },
  { val: '无偿使用证明', desc: '关联方提供无偿使用' },
];

/** 法定注册地址性质（= 上面那份共用表，顺序、文案与线上一致，改动前请先确认真机显示） */
export const REG_ADDRESS_NATURES: AddressNatureOption[] = ADDRESS_NATURES;

/** 实际经营办公地址性质（2026-10-08 起与法定注册地址完全相同） */
export const WORK_ADDRESS_NATURES: AddressNatureOption[] = ADDRESS_NATURES;

/** 没填过地址性质时的兜底选中项（与 defaultData / 老存档迁移口径一致） */
export const DEFAULT_REG_ADDRESS_NATURE = '租赁用房';
/** 同上；实际经营地址现在用同一套性质，所以默认项也一样 */
export const DEFAULT_WORK_ADDRESS_NATURE = DEFAULT_REG_ADDRESS_NATURE;

/**
 * 老存档里的旧性质 → 新（共用）性质。只平移**同义**的两条：
 * 商业租赁 → 租赁用房、自有产权 → 自有房产。
 * 其余已下架的档（联合办公·众创工位 / 集中办公·众创空间 / 园区孵化器 / 居家办公申报）
 * **一律清空让用户重选**，不替他猜 —— 性质决定要传哪些场地材料。
 */
const LEGACY_NATURE: Record<string, string> = {
  商业租赁: '租赁用房',
  自有产权: '自有房产',
};

/** 是不是这张共用表里的性质（去掉两端空格后判断） */
export const isKnownAddressNature = (nature?: string): boolean =>
  ADDRESS_NATURES.some((option) => option.val === (nature ?? '').trim());

/**
 * 把一个地址性质收口到共用表（**两个地址都用它**）：认得的原样返回，老值按 `LEGACY_NATURE` 平移，
 * 认不出的（含已下架的那几档）返回空串 —— 调用方要么留空让用户重选，要么补默认值。
 */
export const normalizeAddressNature = (nature?: string): string => {
  const key = (nature ?? '').trim();
  if (key === '') return '';
  if (isKnownAddressNature(key)) return key;
  return LEGACY_NATURE[key] ?? '';
};

/** 早先只给实际经营那边用的名字 —— 现在两个地址同一套口径，直接指向 `normalizeAddressNature` */
export const normalizeWorkAddressNature = normalizeAddressNature;

/**
 * 复制法定注册地址时，实际经营地址应当跟着切到的性质。
 *
 * 两边现在是**同一套性质**（2026-10-08），所以直接取注册地址选的那一档即可；
 * 认不出的性质返回 `null`（那种情况只搬地址与材料，不动已选性质）。
 */
export function workNatureForCopiedRegNature(regNature?: string): string | null {
  const key = (regNature ?? '').trim();
  return isKnownAddressNature(key) ? key : null;
}

/* ------------------------------------------------- 三档口径（用户给的原话） */

/**
 * 「地址怎么填」。**逐字用用户给的口径**：无偿使用证明那一档只留正文（用户要求的 ⚠️ 前缀也去掉了），
 * 「重点」靠界面按 `emphasis` 标红，文字本身不带标记。
 */
const FILL_RULE = {
  rent: '按房产证或租赁合同上的地址填写。',
  own: '按房产证上的地址填写。',
  // 第 5 档用户给的是**一整句要求**（不是一句占位），放进红字报错里更合适：
  // 占位留短句，否则空着时占位与报错两行说的是同一件事（用户 2026-10-08 说这样不好看）
  freeUse: '请输入与《无偿使用证明》完全一致的房产地址（含门牌号及房号）',
} as const;

/** 「需上传材料」。两个地址共用同一份清单（用户给的口径就是同一套） */
const MATERIALS = {
  rent: [
    '房屋租赁合同（需在有效期内）',
    '房东的房产证复印件（需房东签字或盖章）',
    '房东身份证复印件',
  ],
  own: ['房产证复印件（需产权人签字或盖章）', '（如产权人为股东）股东身份证明'],
  freeUse: ['关联方出具的《无偿使用证明》（需盖章/签字）', '无偿提供方的房产证复印件'],
} as const;

type SpecKind = keyof typeof FILL_RULE;

/** 缺填时的报错（按性质给出对应材料口径，两个地址各自的说法） */
const MISSING: Record<SpecKind, { reg: string; work: string }> = {
  rent: {
    reg: '请填写与《房屋租赁合同》或房产证一致的法定注册详细地址（含门牌号及房号），或勾选由服务商提供',
    work: '请填写与《房屋租赁合同》或房产证一致的经营办公地址（含门牌号及房号），或勾选由服务商提供',
  },
  own: {
    reg: '请填写房产证上一致的法定注册详细地址（含门牌号及房号），或勾选由服务商提供',
    work: '请填写房产证上一致的经营办公地址（含门牌号及房号），或勾选由服务商提供',
  },
  // 第 5 档：用户那句「必须填写…」原话落在这里（红字重点 —— 红靠**报错本身的红色**，
  // 前缀的 ⚠️ 也按用户要求去掉了）。两个地址共用同一句（原话本来就不分注册 / 经营）。
  // **这一档不带「或勾选由服务商提供」的退路**，也删掉了「且需与无偿提供方的房产证地址一致」那半句
  freeUse: {
    reg: '必须填写与《无偿使用证明》完全一致的房产地址（包含门牌号及房号）',
    work: '必须填写与《无偿使用证明》完全一致的房产地址（包含门牌号及房号）',
  },
};

/** 一个地址性质对应的全部提示口径 */
export interface AddressHint {
  /** 输入框为空时的占位提示（= 该性质的「地址填写」口径） */
  placeholder: string;
  /** 缺填时的校验报错 */
  missing: string;
  /** 需上传材料清单（可能为空 = 这一档没有给口径，界面不显示材料块） */
  materials: string[];
  /** 地址填写说明要不要**红字强调**（「无偿使用证明」这一档：地址必须与证明、房产证完全一致） */
  emphasis: boolean;
}

const hintOfKind = (kind: SpecKind, slot: AddressSlot): AddressHint => ({
  placeholder: FILL_RULE[kind],
  missing: MISSING[kind][slot],
  materials: [...MATERIALS[kind]],
  emphasis: kind === 'freeUse',
});

/** 改造前的通用文案：认不出的性质回落到这里 */
const REG_FALLBACK: AddressHint = {
  placeholder: '请输入详细注册地址（含省/市/区/街道/大厦/楼层及房号，需与产权证明一致）',
  missing: '请填写法定注册详细地址，或勾选由服务商提供',
  materials: [],
  emphasis: false,
};

const WORK_FALLBACK: AddressHint = {
  placeholder: '请输入企业实际经营或日常办公地址',
  missing: '请填写实际经营办公地址，或勾选由服务商提供',
  materials: [],
  emphasis: false,
};

const REG_HINTS: Record<string, AddressHint> = {
  租赁用房: hintOfKind('rent', 'reg'),
  自有房产: hintOfKind('own', 'reg'),
  无偿使用证明: hintOfKind('freeUse', 'reg'),
};

// 实际经营地址现在与注册地址**同一套性质**，所以键也一致（只有缺填报错按各自场景说话）；
// 老存档里的旧值由 `normalizeAddressNature` 平移过来，认不出的（含已下架那几档）会被清空让用户重选
const WORK_HINTS: Record<string, AddressHint> = {
  租赁用房: hintOfKind('rent', 'work'),
  自有房产: hintOfKind('own', 'work'),
  无偿使用证明: hintOfKind('freeUse', 'work'),
};

/** 某个地址 + 某个性质对应的完整提示口径（认不出的性质回落通用文案） */
export function addressHintOf(slot: AddressSlot, nature?: string): AddressHint {
  const table = slot === 'reg' ? REG_HINTS : WORK_HINTS;
  const fallback = slot === 'reg' ? REG_FALLBACK : WORK_FALLBACK;
  const key = (nature ?? '').trim();
  return table[key] ?? fallback;
}

/** 法定注册地址输入框的占位提示（按地址性质） */
export function regAddressPlaceholder(nature?: string): string {
  return addressHintOf('reg', nature).placeholder;
}

/** 法定注册地址缺填时的报错（按地址性质） */
export function regAddressMissingError(nature?: string): string {
  return addressHintOf('reg', nature).missing;
}

/** 法定注册地址「需上传材料」（按地址性质；空数组表示这一档没有口径）。返回**副本**，调用方改不动表 */
export function regAddressMaterials(nature?: string): string[] {
  return [...addressHintOf('reg', nature).materials];
}

/** 实际经营办公地址输入框的占位提示（按地址性质） */
export function workAddressPlaceholder(nature?: string): string {
  return addressHintOf('work', nature).placeholder;
}

/** 实际经营办公地址缺填时的报错（按地址性质） */
export function workAddressMissingError(nature?: string): string {
  return addressHintOf('work', nature).missing;
}

/** 实际经营办公地址「需上传材料」（按地址性质）。返回**副本**，调用方改不动表 */
export function workAddressMaterials(nature?: string): string[] {
  return [...addressHintOf('work', nature).materials];
}
