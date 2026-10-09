/**
 * 第 5 步（#fill-details）两个地址输入框「按地址性质换提示词」的自检：
 * 不联网、不碰 React、不开浏览器。
 *   npx tsx scripts/check-address-nature-hints.ts
 *
 * 覆盖四件事：
 *   1. **性质选项表**没被顺手改动：法定注册地址 5 项、实际经营办公地址 4 项，值与说明文案逐字对上；
 *   2. **每种性质都有自己的提示词**：占位提示（= 用户 2026-10-08 给的「地址填写」口径）
 *      与缺填报错都指向该性质对应的材料（租赁合同 / 房产证 / 工位协议 / 园区入园协议 / 无偿使用证明），
 *      另外**「需上传材料」清单**逐条对上用户给的口径、两个地址共用同一套；
 *   3. **认不出的性质回落到改造前的通用文案**（逐字一致）——老存档手改或选项没加载出来时，
 *      提示词不能反而比原来更含糊；
 *   4. 两个地址**同一套性质**：同一档填写口径逐字相同，缺填报错各说自己的场景（2026-10-08）。
 */
import {
  ADDRESS_NATURES,
  DEFAULT_REG_ADDRESS_NATURE,
  DEFAULT_WORK_ADDRESS_NATURE,
  REG_ADDRESS_NATURES,
  WORK_ADDRESS_NATURES,
  addressHintOf,
  normalizeAddressNature,
  normalizeWorkAddressNature,
  regAddressMaterials,
  regAddressMissingError,
  regAddressPlaceholder,
  workAddressMaterials,
  workAddressMissingError,
  workAddressPlaceholder,
  workNatureForCopiedRegNature,
} from '../src/copreg/registration/addressNatureHints';

let passed = 0;
let failed = 0;

function ok(label: string, condition: boolean, extra = '') {
  if (condition) {
    passed += 1;
    console.log(`✓ ${label}`);
  } else {
    failed += 1;
    console.error(`✗ ${label}${extra ? ` —— ${extra}` : ''}`);
  }
}

/* ------------------------------- 1. 选项表 */

ok(
  // 2026-10-08 后续：用户又要求删掉「集中办公/众创空间」与「园区孵化器」两档，只剩三项
  '法定注册地址性质：3 项（租赁用房 / 自有房产 / 无偿使用证明），值与说明逐一对应',
  JSON.stringify(REG_ADDRESS_NATURES) ===
    JSON.stringify([
      { val: '租赁用房', desc: '商业写字楼/租赁办公' },
      { val: '自有房产', desc: '股东或企业自有产权' },
      { val: '无偿使用证明', desc: '关联方提供无偿使用' },
    ]),
  JSON.stringify(REG_ADDRESS_NATURES)
);
ok(
  // 2026-10-08 用户要求：「2 个地址性质改为相同的，以法定注册地址为准」
  '实际经营办公地址性质：与法定注册地址**完全相同**（同一份表、同顺序同说明，且都只剩三项）',
  JSON.stringify(WORK_ADDRESS_NATURES) === JSON.stringify(REG_ADDRESS_NATURES) &&
    WORK_ADDRESS_NATURES === ADDRESS_NATURES &&
    WORK_ADDRESS_NATURES.length === 3,
  JSON.stringify(WORK_ADDRESS_NATURES)
);
ok(
  '两个地址的默认性质都是「租赁用房」',
  DEFAULT_REG_ADDRESS_NATURE === '租赁用房' &&
    DEFAULT_WORK_ADDRESS_NATURE === DEFAULT_REG_ADDRESS_NATURE &&
    REG_ADDRESS_NATURES.some((o) => o.val === DEFAULT_REG_ADDRESS_NATURE),
  `${DEFAULT_REG_ADDRESS_NATURE} / ${DEFAULT_WORK_ADDRESS_NATURE}`
);
ok(
  '老存档里的同义旧值平移：商业租赁→租赁用房 / 自有产权→自有房产',
  normalizeAddressNature('商业租赁') === '租赁用房' &&
    normalizeAddressNature('自有产权') === '自有房产',
  ''
);
ok(
  '★ 已下架的档（联合办公·众创工位 / 集中办公·众创空间 / 园区孵化器 / 居家办公申报）→ 清空让用户重选',
  ['联合办公/众创工位', '集中办公/众创空间', '园区孵化器', '居家办公申报', '其他'].every(
    (v) => normalizeAddressNature(v) === ''
  ) && normalizeAddressNature(undefined) === '',
  ''
);
ok(
  '★ 两个地址都走同一套收口（注册地址那边选中已下架的档也清空）',
  normalizeAddressNature('园区孵化器') === '' && normalizeAddressNature('集中办公/众创空间') === '',
  ''
);
ok(
  '已经是新性质的原样保留（两端空格也认）',
  normalizeAddressNature(' 无偿使用证明 ') === '无偿使用证明' &&
    normalizeAddressNature('自有房产') === '自有房产',
  ''
);
ok(
  '每个性质都有非空说明文案',
  [...REG_ADDRESS_NATURES, ...WORK_ADDRESS_NATURES].every((o) => o.desc.trim().length > 0),
  ''
);

/* ------------------------ 2. 每种性质提示词对应该性质的材料口径 */

/** 性质 → 提示词与报错里都必须出现的关键词（材料口径的抓手） */
const KEYWORDS: Array<{ slot: 'reg' | 'work'; val: string; keyword: string }> = [
  { slot: 'reg', val: '租赁用房', keyword: '租赁合同' },
  { slot: 'reg', val: '自有房产', keyword: '房产证' },
  { slot: 'reg', val: '无偿使用证明', keyword: '无偿使用证明' },
  // 实际经营那边 2026-10-08 起与注册地址同一套性质（同样只剩三项），关键词一一对应
  { slot: 'work', val: '租赁用房', keyword: '租赁合同' },
  { slot: 'work', val: '自有房产', keyword: '房产证' },
  { slot: 'work', val: '无偿使用证明', keyword: '无偿使用证明' },
];

KEYWORDS.forEach(({ slot, val, keyword }) => {
  const placeholder = slot === 'reg' ? regAddressPlaceholder(val) : workAddressPlaceholder(val);
  const missing = slot === 'reg' ? regAddressMissingError(val) : workAddressMissingError(val);
  const where = slot === 'reg' ? '法定注册' : '实际经营';
  ok(`${where}「${val}」占位提示指向「${keyword}」`, placeholder.includes(keyword), placeholder);
  ok(`${where}「${val}」报错文案指向「${keyword}」`, missing.includes(keyword), missing);
});

/* ------------------------ 3. 认不出的性质回落通用文案（与改造前逐字一致） */

const REG_GENERIC_PLACEHOLDER = '请输入详细注册地址（含省/市/区/街道/大厦/楼层及房号，需与产权证明一致）';
const REG_GENERIC_MISSING = '请填写法定注册详细地址，或勾选由服务商提供';
const WORK_GENERIC_PLACEHOLDER = '请输入企业实际经营或日常办公地址';
const WORK_GENERIC_MISSING = '请填写实际经营办公地址，或勾选由服务商提供';

const UNKNOWN = ['', '   ', '其他', '集中办公'];
UNKNOWN.forEach((nature) => {
  ok(
    `法定注册地址：性质「${nature}」回落通用占位提示`,
    regAddressPlaceholder(nature) === REG_GENERIC_PLACEHOLDER,
    regAddressPlaceholder(nature)
  );
  ok(
    `实际经营办公地址：性质「${nature}」回落通用占位提示`,
    workAddressPlaceholder(nature) === WORK_GENERIC_PLACEHOLDER,
    workAddressPlaceholder(nature)
  );
});
ok(
  '空 / 未选性质：报错回落到改造前的通用文案',
  regAddressMissingError(undefined) === REG_GENERIC_MISSING &&
    regAddressMissingError('') === REG_GENERIC_MISSING &&
    workAddressMissingError(undefined) === WORK_GENERIC_MISSING &&
    workAddressMissingError('') === WORK_GENERIC_MISSING,
  `${regAddressMissingError(undefined)} / ${workAddressMissingError(undefined)}`
);
ok(
  '认不出的性质：报错也回落通用文案（不会拿别的性质的文案糊弄）',
  regAddressMissingError('其他') === REG_GENERIC_MISSING &&
    workAddressMissingError('其他') === WORK_GENERIC_MISSING,
  ''
);
ok(
  '性质值两端空白不影响命中（存档里手改出空格也认）',
  regAddressPlaceholder(' 租赁用房 ') === regAddressPlaceholder('租赁用房') &&
    workAddressPlaceholder(' 租赁用房 ') === workAddressPlaceholder('租赁用房') &&
    regAddressPlaceholder('租赁用房 ') !== REG_GENERIC_PLACEHOLDER,
  regAddressPlaceholder(' 租赁用房 ')
);

/* ------------------------ 4. 同性质内提示与报错口径一致、性质之间不重样 */

const regPlaceholders = REG_ADDRESS_NATURES.map((o) => regAddressPlaceholder(o.val));
const regMissings = REG_ADDRESS_NATURES.map((o) => regAddressMissingError(o.val));
const workPlaceholders = WORK_ADDRESS_NATURES.map((o) => workAddressPlaceholder(o.val));
const workMissings = WORK_ADDRESS_NATURES.map((o) => workAddressMissingError(o.val));

ok('注册地址：3 种性质的占位提示互不相同', new Set(regPlaceholders).size === 3, JSON.stringify(regPlaceholders));
ok('注册地址：3 种性质的报错文案互不相同', new Set(regMissings).size === 3, JSON.stringify(regMissings));
ok('实际经营：3 种性质的占位提示互不相同（与注册地址同一套）', new Set(workPlaceholders).size === 3, JSON.stringify(workPlaceholders));
ok('实际经营：3 种性质的报错文案互不相同', new Set(workMissings).size === 3, JSON.stringify(workMissings));

ok(
  '每种性质：占位提示与报错不是同一句话（一个说规范、一个说必填）',
  REG_ADDRESS_NATURES.every((o) => regAddressPlaceholder(o.val) !== regAddressMissingError(o.val)) &&
    WORK_ADDRESS_NATURES.every((o) => workAddressPlaceholder(o.val) !== workAddressMissingError(o.val)),
  ''
);
ok(
  // 第 5 档（无偿使用证明）按用户要求去掉了「或勾选由服务商提供」这半句，其余各档仍给退路
  '除「无偿使用证明」外，每句报错都给退路：提示「或勾选由服务商提供」',
  [...regMissings, ...workMissings]
    .filter((m) => !m.includes('无偿使用证明'))
    .every((m) => m.includes('或勾选由服务商提供')) &&
    !regAddressMissingError('无偿使用证明').includes('或勾选由服务商提供'),
  ''
);
ok(
  '每句报错或提示都不是空白 / 占位符残留',
  [...regPlaceholders, ...regMissings, ...workPlaceholders, ...workMissings].every(
    (t) => t.trim().length >= 8 && !t.includes('TODO') && !t.includes('undefined') && !t.includes('null')
  ),
  ''
);

/* ------------------------ 5. 两个输入框的提示词不互相串 */

ok(
  // 两边现在是同一套性质：同一档的**填写口径（占位）逐字相同**（用户给的那五句），
  // 必须不同的是**缺填报错** —— 一个说「法定注册详细地址」、一个说「经营办公地址」，不能串
  '同一档性质：两个地址的填写口径逐字相同；缺填报错各说自己的场景（「无偿使用证明」那句是用户原话、两边共用）',
  REG_ADDRESS_NATURES.every((o) => regAddressPlaceholder(o.val) === workAddressPlaceholder(o.val)) &&
    REG_ADDRESS_NATURES.filter((o) => o.val !== '无偿使用证明').every(
      (o) => regAddressMissingError(o.val) !== workAddressMissingError(o.val)
    ) &&
    workAddressMissingError('无偿使用证明') === regAddressMissingError('无偿使用证明') &&
    regAddressMissingError('租赁用房').includes('法定注册') &&
    workAddressMissingError('租赁用房').includes('经营办公'),
  `${regAddressMissingError('租赁用房')} / ${workAddressMissingError('租赁用房')}`
);
ok(
  '两边的性质键完全一致（不会有哪一档在一侧认得、另一侧回落通用文案）',
  REG_ADDRESS_NATURES.every(
    (o) => addressHintOf('work', o.val).placeholder === addressHintOf('reg', o.val).placeholder
  ) && addressHintOf('work', '租赁用房').materials.length === 3,
  ''
);

/* ------------- 5.5 用户 2026-10-08 给的五档口径：地址怎么填 + 需上传材料 ------------- */

ok(
  '注册「租赁用房」：填写口径是「按房产证或租赁合同上的地址填写。」',
  regAddressPlaceholder('租赁用房') === '按房产证或租赁合同上的地址填写。',
  regAddressPlaceholder('租赁用房')
);
ok(
  '注册「自有房产」：填写口径是「按房产证上的地址填写。」',
  regAddressPlaceholder('自有房产') === '按房产证上的地址填写。',
  regAddressPlaceholder('自有房产')
);
ok(
  '★ 已下架的两档（集中办公/众创空间、园区孵化器）取文案时回落通用口径，不再是专用文案',
  regAddressPlaceholder('集中办公/众创空间') === REG_GENERIC_PLACEHOLDER &&
    regAddressPlaceholder('园区孵化器') === REG_GENERIC_PLACEHOLDER &&
    workAddressMaterials('集中办公/众创空间').length === 0 &&
    workAddressMaterials('园区孵化器').length === 0,
  regAddressPlaceholder('集中办公/众创空间')
);
ok(
  // 第 5 档用户给的是整句「要求」，放进**红字报错**（占位留短句，否则空着时两行说同一件事）
  '注册「无偿使用证明」：报错逐字是「必须填写与《无偿使用证明》完全一致的房产地址（包含门牌号及房号）」（不带 ⚠️ 前缀）',
  regAddressMissingError('无偿使用证明') ===
    '必须填写与《无偿使用证明》完全一致的房产地址（包含门牌号及房号）' &&
    !regAddressMissingError('无偿使用证明').startsWith('⚠️'),
  regAddressMissingError('无偿使用证明')
);
ok(
  '注册「无偿使用证明」：占位是短句，且与报错不是同一句（不会两行说同一件事）',
  regAddressPlaceholder('无偿使用证明') === '请输入与《无偿使用证明》完全一致的房产地址（含门牌号及房号）' &&
    regAddressPlaceholder('无偿使用证明') !== regAddressMissingError('无偿使用证明'),
  regAddressPlaceholder('无偿使用证明')
);
ok(
  '两个地址「无偿使用证明」的报错是同一句（原话本来就不分注册 / 经营）',
  workAddressMissingError('无偿使用证明') === regAddressMissingError('无偿使用证明'),
  workAddressMissingError('无偿使用证明')
);

const MATERIAL_CASES: Array<{ slot: 'reg' | 'work'; val: string; must: string[]; count: number }> = [
  {
    slot: 'reg',
    val: '租赁用房',
    count: 3,
    must: ['房屋租赁合同（需在有效期内）', '房东的房产证复印件（需房东签字或盖章）', '房东身份证复印件'],
  },
  { slot: 'reg', val: '自有房产', count: 2, must: ['房产证复印件（需产权人签字或盖章）', '股东身份证明'] },
  { slot: 'reg', val: '无偿使用证明', count: 2, must: ['《无偿使用证明》（需盖章/签字）', '无偿提供方的房产证复印件'] },
];

MATERIAL_CASES.forEach(({ val, must, count }) => {
  const list = regAddressMaterials(val);
  ok(`注册「${val}」：需上传材料 ${count} 条、关键条目逐字对上`, list.length === count && must.every((m) => list.some((item) => item.includes(m))), JSON.stringify(list));
});

ok(
  '两个地址共用同一套材料口径：同一档的材料清单逐条相同（3 档全覆盖）',
  REG_ADDRESS_NATURES.every(
    (o) => JSON.stringify(regAddressMaterials(o.val)) === JSON.stringify(workAddressMaterials(o.val))
  ) && regAddressMaterials('租赁用房').length === 3,
  `${JSON.stringify(workAddressMaterials('租赁用房'))}`
);
ok(
  '只有「无偿使用证明」这一档是红字重点（emphasis）',
  addressHintOf('reg', '无偿使用证明').emphasis === true &&
    REG_ADDRESS_NATURES.filter((o) => addressHintOf('reg', o.val).emphasis).length === 1 &&
    WORK_ADDRESS_NATURES.filter((o) => addressHintOf('work', o.val).emphasis).length === 1 &&
    addressHintOf('work', '无偿使用证明').emphasis === true,
  ''
);
ok(
  '认不出的性质：材料清单是空数组（界面不显示材料块），不是 undefined',
  Array.isArray(addressHintOf('reg', '其他').materials) && addressHintOf('reg', '其他').materials.length === 0 &&
    Array.isArray(addressHintOf('work', undefined).materials) && addressHintOf('work', undefined).emphasis === false,
  ''
);
ok(
  '老存档的旧值（商业租赁等）取文案时回落通用口径（值本身由 normalizeWorkAddressNature 平移）',
  addressHintOf('work', '商业租赁').placeholder === WORK_GENERIC_PLACEHOLDER &&
    normalizeWorkAddressNature('商业租赁') === '租赁用房',
  addressHintOf('work', '商业租赁').placeholder
);
ok(
  '材料清单是副本：改返回值不会污染模块里的表',
  (() => {
    const first = regAddressMaterials('租赁用房');
    first.push('乱加的');
    return regAddressMaterials('租赁用房').length === 3;
  })(),
  ''
);

/* ------------------------ 6.「同法定注册地址」复制时同步的性质 */

const regVals = REG_ADDRESS_NATURES.map((o) => o.val);
const workVals = WORK_ADDRESS_NATURES.map((o) => o.val);

ok(
  // 2026-10-08：两边同一套性质 → 复制时把注册地址那一档原样切过去（不再是「商业租赁」那套映射）
  '复制地址：性质原样跟着切（3 档都是恒等映射）',
  regVals.every((v) => workNatureForCopiedRegNature(v) === v) &&
    workVals.length === regVals.length,
  regVals.map((v) => `${v}→${workNatureForCopiedRegNature(v)}`).join('、')
);
ok(
  '复制地址：认不出 / 没选的性质一律 null（那种情况只搬地址与材料，不动已选性质）',
  workNatureForCopiedRegNature(undefined) === null &&
    workNatureForCopiedRegNature('') === null &&
    workNatureForCopiedRegNature('   ') === null &&
    workNatureForCopiedRegNature('其他') === null &&
    workNatureForCopiedRegNature('商业租赁') === null &&
    workNatureForCopiedRegNature('园区孵化器') === null &&
    workNatureForCopiedRegNature('集中办公/众创空间') === null,
  ''
);
ok(
  '复制地址：性质值两端空白不影响命中（手改出空格也认）',
  workNatureForCopiedRegNature(' 租赁用房 ') === '租赁用房' &&
    workNatureForCopiedRegNature(' 无偿使用证明 ') === '无偿使用证明',
  String(workNatureForCopiedRegNature(' 租赁用房 '))
);
ok(
  '复制地址：切过去的目标都是真实存在的实际经营性质（不会切到一个界面上没有的选项）',
  regVals.every((v) => {
    const target = workNatureForCopiedRegNature(v);
    return target === null || workVals.includes(target);
  }),
  regVals.map((v) => `${v}→${workNatureForCopiedRegNature(v)}`).join('、')
);
ok(
  '复制地址：3 档全都对得上（没有哪一档只能搬地址、不搬性质）',
  regVals.filter((v) => workNatureForCopiedRegNature(v) !== null).length === 3,
  regVals.map((v) => `${v}→${workNatureForCopiedRegNature(v)}`).join('、')
);

console.log(`\n${passed} 项通过，${failed} 项失败`);
if (failed > 0) process.exit(1);
