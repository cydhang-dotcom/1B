/**
 * 第 5 步（#fill-details）两个地址输入框「按地址性质换提示词」的自检：
 * 不联网、不碰 React、不开浏览器。
 *   npx tsx scripts/check-address-nature-hints.ts
 *
 * 覆盖四件事：
 *   1. **性质选项表**没被顺手改动：法定注册地址 5 项、实际经营办公地址 4 项，值与说明文案逐字对上；
 *   2. **每种性质都有自己的提示词**：占位提示与缺填报错都指向该性质对应的材料口径
 *      （租赁合同 / 不动产权证 / 工位协议 / 园区入园 / 无偿使用证明 / 房产证明），
 *      且同一性质的提示与报错口径一致、不同性质之间不重样；
 *   3. **认不出的性质回落到改造前的通用文案**（逐字一致）——老存档手改或选项没加载出来时，
 *      提示词不能反而比原来更含糊；
 *   4. 两个输入框的提示词**不互相串**（注册地址不会提示「居家办公」之类）。
 */
import {
  DEFAULT_REG_ADDRESS_NATURE,
  DEFAULT_WORK_ADDRESS_NATURE,
  REG_ADDRESS_NATURES,
  WORK_ADDRESS_NATURES,
  regAddressMissingError,
  regAddressPlaceholder,
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
  '法定注册地址性质：5 项，值与说明逐一对应',
  JSON.stringify(REG_ADDRESS_NATURES) ===
    JSON.stringify([
      { val: '租赁用房', desc: '商业写字楼/租赁办公' },
      { val: '自有房产', desc: '股东或企业自有产权' },
      { val: '集中办公/众创空间', desc: '众创空间/工位协议' },
      { val: '园区孵化器', desc: '产业园集中入驻' },
      { val: '无偿使用证明', desc: '关联方提供无偿使用' },
    ]),
  JSON.stringify(REG_ADDRESS_NATURES)
);
ok(
  '实际经营办公地址性质：4 项，值与说明逐一对应',
  JSON.stringify(WORK_ADDRESS_NATURES) ===
    JSON.stringify([
      { val: '商业租赁', desc: '写字楼/商业办公租赁' },
      { val: '自有产权', desc: '股东或企业商用房产' },
      { val: '联合办公/众创工位', desc: '众创空间/共享工位' },
      { val: '居家办公申报', desc: '电商/咨询合规居家申报' },
    ]),
  JSON.stringify(WORK_ADDRESS_NATURES)
);
ok(
  '默认性质在各自的选项表里（租赁用房 / 商业租赁）',
  REG_ADDRESS_NATURES.some((o) => o.val === DEFAULT_REG_ADDRESS_NATURE) &&
    DEFAULT_REG_ADDRESS_NATURE === '租赁用房' &&
    WORK_ADDRESS_NATURES.some((o) => o.val === DEFAULT_WORK_ADDRESS_NATURE) &&
    DEFAULT_WORK_ADDRESS_NATURE === '商业租赁',
  `${DEFAULT_REG_ADDRESS_NATURE} / ${DEFAULT_WORK_ADDRESS_NATURE}`
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
  { slot: 'reg', val: '自有房产', keyword: '不动产权证' },
  { slot: 'reg', val: '集中办公/众创空间', keyword: '工位' },
  { slot: 'reg', val: '园区孵化器', keyword: '园区' },
  { slot: 'reg', val: '无偿使用证明', keyword: '无偿使用证明' },
  { slot: 'work', val: '商业租赁', keyword: '租赁合同' },
  { slot: 'work', val: '自有产权', keyword: '不动产权证' },
  { slot: 'work', val: '联合办公/众创工位', keyword: '工位' },
  { slot: 'work', val: '居家办公申报', keyword: '门牌号' },
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
    workAddressPlaceholder(' 商业租赁 ') === workAddressPlaceholder('商业租赁') &&
    regAddressPlaceholder('租赁用房 ') !== REG_GENERIC_PLACEHOLDER,
  regAddressPlaceholder(' 租赁用房 ')
);

/* ------------------------ 4. 同性质内提示与报错口径一致、性质之间不重样 */

const regPlaceholders = REG_ADDRESS_NATURES.map((o) => regAddressPlaceholder(o.val));
const regMissings = REG_ADDRESS_NATURES.map((o) => regAddressMissingError(o.val));
const workPlaceholders = WORK_ADDRESS_NATURES.map((o) => workAddressPlaceholder(o.val));
const workMissings = WORK_ADDRESS_NATURES.map((o) => workAddressMissingError(o.val));

ok('注册地址：5 种性质的占位提示互不相同', new Set(regPlaceholders).size === 5, JSON.stringify(regPlaceholders));
ok('注册地址：5 种性质的报错文案互不相同', new Set(regMissings).size === 5, JSON.stringify(regMissings));
ok('实际经营：4 种性质的占位提示互不相同', new Set(workPlaceholders).size === 4, JSON.stringify(workPlaceholders));
ok('实际经营：4 种性质的报错文案互不相同', new Set(workMissings).size === 4, JSON.stringify(workMissings));

ok(
  '每种性质：占位提示与报错不是同一句话（一个说规范、一个说必填）',
  REG_ADDRESS_NATURES.every((o) => regAddressPlaceholder(o.val) !== regAddressMissingError(o.val)) &&
    WORK_ADDRESS_NATURES.every((o) => workAddressPlaceholder(o.val) !== workAddressMissingError(o.val)),
  ''
);
ok(
  '每句报错都给退路：提示「或勾选由服务商提供」',
  [...regMissings, ...workMissings].every((m) => m.includes('或勾选由服务商提供')),
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
  '注册地址的提示词不会出现「居家办公」这类实际经营专用口径',
  regPlaceholders.every((t) => !t.includes('居家办公')) && regMissings.every((t) => !t.includes('居家办公')),
  ''
);
ok(
  '实际经营的提示词不会出现「无偿使用证明 / 园区孵化器」这类注册专用口径',
  workPlaceholders.every((t) => !t.includes('无偿使用') && !t.includes('孵化')) &&
    workMissings.every((t) => !t.includes('无偿使用') && !t.includes('孵化')),
  ''
);
ok(
  '同名性质（注册「租赁用房」/ 实际「商业租赁」）的两套文案不重复，各有各的场景',
  regAddressPlaceholder('租赁用房') !== workAddressPlaceholder('商业租赁') &&
    regAddressMissingError('租赁用房') !== workAddressMissingError('商业租赁'),
  `${workAddressPlaceholder('商业租赁')}`
);

/* ------------------------ 6.「同法定注册地址」的一一对应 */

const regVals = REG_ADDRESS_NATURES.map((o) => o.val);
const workVals = WORK_ADDRESS_NATURES.map((o) => o.val);

ok(
  '复制地址：租赁用房 → 商业租赁',
  workNatureForCopiedRegNature('租赁用房') === '商业租赁',
  String(workNatureForCopiedRegNature('租赁用房'))
);
ok(
  '复制地址：自有房产 → 自有产权',
  workNatureForCopiedRegNature('自有房产') === '自有产权',
  String(workNatureForCopiedRegNature('自有房产'))
);
ok(
  '复制地址：集中办公/众创空间 → 联合办公/众创工位',
  workNatureForCopiedRegNature('集中办公/众创空间') === '联合办公/众创工位',
  String(workNatureForCopiedRegNature('集中办公/众创空间'))
);
ok(
  '复制地址：园区孵化器 / 无偿使用证明在实际经营那边没有对应选项 → 返回 null（只同步地址）',
  workNatureForCopiedRegNature('园区孵化器') === null &&
    workNatureForCopiedRegNature('无偿使用证明') === null,
  `${workNatureForCopiedRegNature('园区孵化器')} / ${workNatureForCopiedRegNature('无偿使用证明')}`
);
ok(
  '复制地址：认不出 / 没选的性质一律 null（不会硬凑一个性质过去）',
  workNatureForCopiedRegNature(undefined) === null &&
    workNatureForCopiedRegNature('') === null &&
    workNatureForCopiedRegNature('   ') === null &&
    workNatureForCopiedRegNature('其他') === null,
  ''
);
ok(
  '复制地址：性质值两端空白不影响命中（手改出空格也认）',
  workNatureForCopiedRegNature(' 租赁用房 ') === '商业租赁',
  String(workNatureForCopiedRegNature(' 租赁用房 '))
);
ok(
  '复制地址：映射的目标全是真实存在的实际经营性质（不会切到一个界面上没有的选项）',
  regVals.every((v) => {
    const target = workNatureForCopiedRegNature(v);
    return target === null || workVals.includes(target);
  }),
  regVals.map((v) => `${v}→${workNatureForCopiedRegNature(v)}`).join('、')
);
ok(
  '复制地址：映射一一对应（两个注册性质不会挤到同一个实际性质，也不会推出「居家办公申报」）',
  (() => {
    const targets = regVals
      .map((v) => workNatureForCopiedRegNature(v))
      .filter((t): t is string => t !== null);
    return new Set(targets).size === targets.length && !targets.includes('居家办公申报');
  })(),
  regVals.map((v) => `${v}→${workNatureForCopiedRegNature(v)}`).join('、')
);
ok(
  '复制地址：对得上的注册性质都有目标（租赁用房 / 自有房产 / 集中办公·众创空间 三组）',
  regVals.filter((v) => workNatureForCopiedRegNature(v) !== null).length === 3,
  regVals.map((v) => `${v}→${workNatureForCopiedRegNature(v)}`).join('、')
);

console.log(`\n${passed} 项通过，${failed} 项失败`);
if (failed > 0) process.exit(1);
