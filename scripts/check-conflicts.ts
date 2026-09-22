/**
 * 申报表「关联冲突」校验的自检：不联网、不碰 React、不开浏览器。
 *   npx tsx scripts/check-conflicts.ts
 *
 * 覆盖 `src/copreg/registration/conflicts.ts` 的每条规则，以及同等重要的另一半：
 * **本来自洽的数据不许误报**（全留空、选填没填、小数四舍五入、名称与组织形式一致……）。
 * 误报比漏报更烦人：一个假冲突会把用户拦在提交按钮前，还指不出该改哪儿。
 */
import { AMOUNT_EPS, conflictErrorsOf, numberOf } from '../src/copreg/registration/conflicts';
import type { RegistrationFullForm, ShareholderRecord } from '../src/copreg/registration/types';

let passed = 0;
let failed = 0;

function ok(label: string, condition: boolean) {
  if (condition) {
    passed += 1;
    console.log(`✓ ${label}`);
  } else {
    failed += 1;
    console.error(`✗ ${label}`);
  }
}

/** 一份「哪儿都不冲突」的底表：1 位自然人股东，出资 100% / 100 万元 = 注册资本 100 万元 */
const baseForm = (): RegistrationFullForm =>
  ({
    id: 'form-1',
    status: 'draft',
    savedAt: null,
    submittedAt: null,
    submissionPhone: '',
    basic: {
      org: '有限责任公司',
      orgOther: '',
      intro: '',
      service: '',
      scope: '互联网销售',
      capital: '100',
      expert: false,
      names: ['甲乙丙科技有限公司', '', ''],
      regAddress: '',
      regRecommend: true,
      regAddressNature: '租赁用房',
      regFiles: [],
      workAddress: '',
      workRecommend: true,
      workAddressNature: '商业租赁',
      workFiles: [],
      board: '不设董事会',
      directors: '',
      singleDirector: '由总经理代行职务（不设董事）',
      singleSupervisor: '不设监事',
      unanimous: true,
    },
    people: {
      p1: { id: 'p1', name: '张三', phone: '13800000000', email: '', education: '', address: '深圳市南山区 1 号', files: [] },
      p2: { id: 'p2', name: '李四', phone: '13900000000', email: '', education: '', address: '深圳市南山区 2 号', files: [] },
    },
    shareholders: [
      { id: 's1', type: '自然人', personId: 'p1', name: '', code: '', ratio: '100', amount: '100', method: ['货币'], files: [] },
    ],
    roles: [{ id: 'r1', personId: 'p1', roles: ['法定代表人', '总经理', '财务负责人', '联系人'] }],
    setup: {},
    authorization: { trusteeName: '', trusteeIdNumber: '', entrustDate: '2026-01-01', files: [] },
    confirm: { exemption: false, beneficiary: '', accurate: true, files: [] },
  } as unknown as RegistrationFullForm);

type Patch = (form: RegistrationFullForm) => void;

const share = (patch: Partial<ShareholderRecord>): ShareholderRecord => ({
  id: 'sx',
  type: '自然人',
  personId: 'p2',
  name: '',
  code: '',
  ratio: '',
  amount: '',
  method: ['货币'],
  files: [],
  ...patch,
});

const check = (label: string, patch: Patch): { count: number; messages: string[] } => {
  const form = baseForm();
  patch(form);
  const found = conflictErrorsOf(form);
  ok(label, found.length > 0);
  return { count: found.length, messages: found.map((e) => e.msg) };
};

const expectClean = (label: string, patch: Patch): void => {
  const form = baseForm();
  patch(form);
  const found = conflictErrorsOf(form);
  ok(
    label,
    found.length === 0
  );
  if (found.length > 0) console.error('   误报：', found.map((e) => e.msg).join(' / '));
};

const expectNothing = (label: string, form: RegistrationFullForm): void => {
  const found = conflictErrorsOf(form);
  ok(label, found.length === 0);
  if (found.length > 0) console.error('   误报：', found.map((e) => e.msg).join(' / '));
};

/* ---------------------------------------------------------------- 基础 */

expectNothing('底表（1 位自然人 100% / 100 万元 = 注册资本 100 万元）无冲突', baseForm());
ok('numberOf：空串 / 非数字 = 没填，数字原样', numberOf('') === null && numberOf('  ') === null && numberOf('abc') === null && numberOf(' 12.5 ') === 12.5);
ok('容差是 0.01（万元 / 百分比）', AMOUNT_EPS === 0.01);

const nothing: RegistrationFullForm = baseForm();
nothing.shareholders = [];
nothing.roles = [];
ok('一个股东、一个人员都没有时不报冲突（那是必填校验的事）', conflictErrorsOf(nothing).length === 0);

/* --------------------------------------------- 第 1 章：资本 ↔ 股东出资 */

{
  const result = check('出资比例合计不是 100% → 冲突', (f) => {
    f.shareholders = [share({ id: 's1', ratio: '60', amount: '60' }), share({ id: 's2', ratio: '30', amount: '30' })];
  });
  ok('  · 提示里带合计与差额', result.messages[0].includes('90%') && result.messages[0].includes('还差 10%'));
}
{
  const result = check('出资比例超过 100% → 冲突', (f) => {
    f.shareholders = [share({ id: 's1', ratio: '120', amount: '120' })];
  });
  ok('  · 用「超出」而不是「还差」', result.messages[0].includes('超出'));
}
{
  const result = check('比例合计 = 100% 但出资额之和 ≠ 注册资本 → 冲突', (f) => {
    f.shareholders = [share({ id: 's1', ratio: '60', amount: '60' }), share({ id: 's2', ratio: '40', amount: '30' })];
  });
  ok('  · 提示里带合计、注册资本与差额', result.messages.some((m) => m.includes('合计 90 万元') && m.includes('注册资本 100 万元') && m.includes('差 10 万元')));
}
{
  const result = check('只填了一部分出资额 → 冲突（没法对账）', (f) => {
    f.shareholders = [share({ id: 's1', ratio: '60', amount: '60' }), share({ id: 's2', ratio: '40', amount: '' })];
  });
  ok('  · 提示说明几位没填', result.messages.some((m) => m.includes('有 1 位股东没填')));
}
{
  const result = check('单行「比例 × 注册资本 ≠ 出资额」→ 冲突（挂到那一行）', (f) => {
    f.basic.capital = '100';
    f.shareholders = [share({ id: 's1', ratio: '30', amount: '50' })];
  });
  ok('  · 提示里给出算式与两个数', result.messages.some((m) => m.includes('30% × 注册资本 100 万元 = 30 万元') && m.includes('50 万元')));
}

expectClean('比例合计 100%、出资之和 = 注册资本 → 不报', (f) => {
  f.shareholders = [share({ id: 's1', ratio: '60', amount: '60' }), share({ id: 's2', ratio: '40', amount: '40' })];
});
expectClean('出资额全部留空（选填）→ 不报', (f) => {
  f.shareholders = [share({ id: 's1', ratio: '60', amount: '' }), share({ id: 's2', ratio: '40', amount: '' })];
});
expectClean('金额是小数（33.33 / 33.33 / 33.34）→ 不报（浮点余量内）', (f) => {
  f.basic.capital = '100';
  f.shareholders = [
    share({ id: 's1', ratio: '33.33', amount: '33.33' }),
    share({ id: 's2', ratio: '33.33', amount: '33.33' }),
    share({ id: 's3', ratio: '33.34', amount: '33.34' }),
  ];
});
expectClean('比例/金额没填（空串）时不与资本对账，也不误报', (f) => {
  f.shareholders = [share({ id: 's1', ratio: '', amount: '' })];
});

{
  const result = check('自然人股东没关联人员 → 冲突', (f) => {
    f.shareholders = [share({ id: 's1', ratio: '100', amount: '100', personId: null })];
  });
  ok('  · 提示说明姓名与证件照取不到', result.messages.some((m) => m.includes('必须关联一位已录入的人员')));
}
{
  const result = check('关联到不存在的人员 → 同样按未关联处理', (f) => {
    f.shareholders = [share({ id: 's1', ratio: '100', amount: '100', personId: 'ghost' })];
  });
  ok('  · 也是那条提示', result.messages.some((m) => m.includes('必须关联一位已录入的人员')));
}
expectClean('企业股东不要求关联人员（它有企业全称与信用代码）', (f) => {
  f.shareholders = [
    share({ id: 's1', type: '企业', personId: null, name: '某某科技有限公司', code: '91310000MA1K35XXXX', ratio: '100', amount: '100' }),
  ];
});

/* ------------------------------- 第 2 章：主要人员 ↔ 治理结构 */

{
  const result = check('法定代表人被两位人员同时担任 → 冲突', (f) => {
    f.roles = [
      { id: 'r1', personId: 'p1', roles: ['法定代表人'] },
      { id: 'r2', personId: 'p2', roles: ['法定代表人'] },
    ];
  });
  ok('  · 提示里点名两个人', result.messages.some((m) => m.includes('2 位人员同时担任') && m.includes('张三') && m.includes('李四')));
}
{
  check('财务负责人被两位人员同时担任 → 冲突', (f) => {
    f.roles = [
      { id: 'r1', personId: 'p1', roles: ['财务负责人'] },
      { id: 'r2', personId: 'p2', roles: ['财务负责人'] },
    ];
  });
}
expectClean('同一人兼法定代表人 + 财务负责人 + 总经理 + 联系人 → 不报（小公司常见）', (f) => {
  f.roles = [{ id: 'r1', personId: 'p1', roles: ['法定代表人', '财务负责人', '总经理', '联系人'] }];
});

{
  const result = check('设董事会填 3 人、只指派 1 位董事 → 冲突', (f) => {
    f.basic.board = '设董事会';
    f.basic.directors = '3';
    f.roles = [
      { id: 'r1', personId: 'p1', roles: ['法定代表人', '总经理', '财务负责人', '联系人', '董事'] },
    ];
  });
  ok('  · 提示对齐人数', result.messages.some((m) => m.includes('设 3 名董事') && m.includes('指派了 1 位董事')));
}
expectClean('设董事会填 3 人、正好指派 3 位董事 → 不报', (f) => {
  f.basic.board = '设董事会';
  f.basic.directors = '3';
  f.roles = [
    { id: 'r1', personId: 'p1', roles: ['董事'] },
    { id: 'r2', personId: 'p2', roles: ['董事'] },
    { id: 'r3', personId: 'p1', roles: ['董事', '法定代表人'] },
  ];
});
{
  const result = check('「由总经理代行职务（不设董事）」却指派了董事 → 冲突', (f) => {
    f.roles = [
      { id: 'r1', personId: 'p1', roles: ['法定代表人', '总经理', '财务负责人', '联系人', '董事'] },
    ];
  });
  ok('  · 提示说两者矛盾', result.messages.some((m) => m.includes('不设董事会') && m.includes('两者矛盾')));
}
{
  check('「不设监事会/不设监事」却指派了监事 → 冲突', (f) => {
    f.roles = [{ id: 'r1', personId: 'p1', roles: ['监事'] }];
  });
}
{
  check('「设 1 名监事」却指派了 2 位监事 → 冲突', (f) => {
    f.basic.singleSupervisor = '设 1 名监事';
    f.roles = [
      { id: 'r1', personId: 'p1', roles: ['法定代表人', '总经理', '财务负责人', '联系人'] },
      { id: 'r2', personId: 'p2', roles: ['监事'] },
      { id: 'r3', personId: 'p1', roles: ['监事'] },
    ];
  });
}
expectClean('「设 1 名监事」且正好一位监事 → 不报', (f) => {
  f.basic.singleSupervisor = '设 1 名监事';
  f.roles = [
    { id: 'r1', personId: 'p1', roles: ['法定代表人', '总经理', '财务负责人', '联系人'] },
    { id: 'r2', personId: 'p2', roles: ['监事'] },
  ];
});
expectClean('「由总经理代行职务」但没指派总经理 → 不在这里报（那是必填校验的事）', (f) => {
  f.roles = [{ id: 'r1', personId: 'p1', roles: ['法定代表人', '财务负责人', '联系人'] }];
});

/* --------------------------------- 第 0 章：企业名称 ↔ 组织形式 */

{
  const result = check('名称含「股份」但组织形式是有限责任公司 → 冲突', (f) => {
    f.basic.names = ['甲乙丙股份有限公司', '', ''];
  });
  ok('  · 挂到具体那个名称输入框上（name-0）', result.messages.some((m) => m.includes('含「股份」')));
}
{
  check('名称含「合伙」但组织形式是有限责任公司 → 冲突', (f) => {
    f.basic.names = ['甲乙丙合伙企业', '', ''];
  });
}
{
  check('组织形式选了股份有限公司、但名称都没「股份」→ 冲突', (f) => {
    f.basic.org = '股份有限公司';
    f.basic.names = ['甲乙丙科技有限公司', '', ''];
  });
}
{
  check('组织形式选了合伙企业、但名称都没「合伙」→ 冲突', (f) => {
    f.basic.org = '合伙企业';
    f.basic.names = ['甲乙丙科技有限公司', '', ''];
  });
}
expectClean('组织形式与名称一致（股份有限公司 + 含股份）→ 不报', (f) => {
  f.basic.org = '股份有限公司';
  f.basic.names = ['甲乙丙科技股份有限公司', '', ''];
});
expectClean('合伙企业 + 名称含合伙 → 不报', (f) => {
  f.basic.org = '合伙企业';
  f.basic.names = ['甲乙丙（有限合伙）', '', ''];
});

/* ------------------------------------------ 第 3 章：委托书两项成对 */

{
  check('只填受托人姓名、没填身份证号 → 冲突', (f) => {
    f.authorization.trusteeName = '李四';
  });
}
{
  check('只填身份证号、没填姓名 → 冲突', (f) => {
    f.authorization.trusteeIdNumber = '440301199308123418';
  });
}
{
  check('身份证号不是 18 位 → 冲突', (f) => {
    f.authorization.trusteeName = '李四';
    f.authorization.trusteeIdNumber = '44030119930812';
  });
}
expectClean('两项都不填（交申请人手写）→ 不报', (f) => {
  f.authorization.trusteeName = '';
  f.authorization.trusteeIdNumber = '';
});
expectClean('两项都填且身份证号 18 位（含 X）→ 不报', (f) => {
  f.authorization.trusteeName = '李四';
  f.authorization.trusteeIdNumber = '44030119930812341X';
});

/* --------------------------------- 第 4 章：免申报承诺 ↔ 股东类型 */

{
  check('勾了「股东均为自然人」的免申报，却有企业股东 → 冲突', (f) => {
    f.confirm.exemption = true;
    f.shareholders = [
      share({ id: 's1', ratio: '70', amount: '70' }),
      share({ id: 's2', type: '企业', personId: null, name: '某某科技有限公司', code: '91310000MA1K35XXXX', ratio: '30', amount: '30' }),
    ];
  });
}
expectClean('全是自然人股东 + 勾了免申报 → 不报', (f) => {
  f.confirm.exemption = true;
});
expectClean('有企业股东但没勾免申报 → 不报', (f) => {
  f.shareholders = [
    share({ id: 's1', ratio: '70', amount: '70' }),
    share({ id: 's2', type: '企业', personId: null, name: '某某科技有限公司', code: '91310000MA1K35XXXX', ratio: '30', amount: '30' }),
  ];
});

/* ------------------------------------------------------------ 综合 */

{
  // 一次把所有毛病都摆上：条数应当等于各自的冲突数，且都带章节下标
  const form = baseForm();
  form.basic.names = ['甲乙丙股份有限公司', '', ''];
  form.basic.capital = '100';
  form.shareholders = [
    share({ id: 's1', ratio: '60', amount: '50', personId: null }),
    share({ id: 's2', type: '企业', personId: null, name: '某某科技有限公司', code: '91310000MA1K35XXXX', ratio: '50', amount: '50' }),
  ];
  form.roles = [
    { id: 'r1', personId: 'p1', roles: ['法定代表人', '监事'] },
    { id: 'r2', personId: 'p2', roles: ['法定代表人', '监事'] },
  ];
  form.authorization.trusteeName = '李四';
  form.confirm.exemption = true;

  const found = conflictErrorsOf(form);
  ok('多种冲突同时存在时逐条列出（不是只报第一条）', found.length >= 6);
  ok('每条都带着章节下标（0–4），提交时才能跳到第一个出错章节', found.every((e) => e.s >= 0 && e.s <= 4));
  ok('整章级冲突挂在章节 key 上（shareholders / roles）', found.some((e) => e.id === 'shareholders') && found.some((e) => e.id === 'roles'));
  ok('具体行的冲突挂到那一行（share-<id>）', found.some((e) => e.id === 'share-s1' && e.record?.kind === 'share'));
  ok('名称冲突挂到对应输入框（name-0）', found.some((e) => e.id === 'name-0' && e.s === 0));
  ok('委托书冲突挂在第 3 章（auth）', found.some((e) => e.id === 'auth' && e.s === 3));
  ok('免申报冲突挂在第 4 章', found.some((e) => e.id === 'exemption' && e.s === 4));
}

console.log(`\n${passed} 项通过，${failed} 项失败`);
if (failed > 0) process.exit(1);
