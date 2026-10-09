/**
 * 「注册资本（万元）」这一格的口径自检：不联网、不碰 React、不开浏览器。
 *   npx tsx scripts/check-capital-hints.ts
 *
 * 用户报的 bug：第 5 步基本信息里把注册资本改成 10，05 确认提交那一章还是显示「专家推荐」、
 * 看不到他填的数字。两条口径：
 *   1. **用户改了这一格就不再算「专家推荐」**（`capitalEditPatch` 顺手撤标记）—— 治本；
 *   2. **确认页只要有数字就先显示数字**，专家建议只作附注 —— 改之前就存下来的旧草稿
 *      （带着 `expert = true`）也不会再把数字藏起来。
 */
import {
  CAPITAL_EXPERT_HINT,
  capitalEditPatch,
  capitalReviewTextOf,
} from '../src/copreg/registration/capitalHints';

let passed = 0;
let failed = 0;

function ok(label: string, condition: boolean) {
  if (condition) {
    passed += 1;
  } else {
    failed += 1;
    console.error(`✗ ${label}`);
  }
}

/* ------------------------------------------------ 1. 改了就撤「专家推荐」标记 */

ok('改金额时只留整数（去掉「万」等非数字字符）', capitalEditPatch('10万').capital === '10');
ok('改金额时去掉空格与前后的杂字符', capitalEditPatch(' 1 0 ').capital === '10');
ok('改了金额就撤掉专家推荐标记', capitalEditPatch('10').expert === false);
ok('原本不是专家推荐时，改完仍是 false（不会反过来置 true）', capitalEditPatch('10').expert === false);
ok('清空这一格也撤标记（不再假装是专家推荐）', capitalEditPatch('').capital === '' && capitalEditPatch('').expert === false);

/* ------------------------------------ 2. 确认页显示：有数字就先显示数字 */

ok(
  '用户自己填的 10 → 显示「10 万元人民币」，不带专家字眼',
  capitalReviewTextOf({ capital: '10', expert: false }) === '10 万元人民币'
);
ok(
  '用户改过、但草稿里还留着旧标记（expert = true）→ 仍要显示数字',
  capitalReviewTextOf({ capital: '10', expert: true }).startsWith('10 万元人民币')
);
ok(
  '还是方案建议值时，数字后面注明是建议值、以顾问为准',
  capitalReviewTextOf({ capital: '100', expert: true }) === '100 万元人民币（专家建议值，最终由顾问确定）'
);
ok(
  '★ 专家建议不再把数字整个吞掉（用户报的就是这个）',
  !capitalReviewTextOf({ capital: '100', expert: true }).includes('专家推荐（由顾问出资建议方案确定）')
);
ok(
  '空白骨架的 100（expert = false）按用户自己的数字显示',
  capitalReviewTextOf({ capital: '100', expert: false }) === '100 万元人民币'
);
ok('金额两边有空格也不会显示成「10 万元」', capitalReviewTextOf({ capital: ' 10 ', expert: false }) === '10 万元人民币');
ok('确实没数字 + 专家建议 → 如实说明来源，不编数字', capitalReviewTextOf({ capital: '', expert: true }) === '专家推荐（由顾问出资建议方案确定）');
ok('确实没数字 + 不是专家建议 → 未填写', capitalReviewTextOf({ capital: '', expert: false }) === '未填写');

/* ------------------------------------------------------- 3. 面板说明文案 */

ok('说明讲清了「这是方案建议值」', CAPITAL_EXPERT_HINT.includes('建议值') && CAPITAL_EXPERT_HINT.includes('方案'));
ok('说明讲清了「可以自己改」', CAPITAL_EXPERT_HINT.includes('自己定') && CAPITAL_EXPERT_HINT.includes('改'));
ok('说明讲了改完确认页会跟着显示（与上面的口径一致）', CAPITAL_EXPERT_HINT.includes('确认提交') && CAPITAL_EXPERT_HINT.includes('显示'));

console.log(`\n${passed} 项通过，${failed} 项失败`);
if (failed > 0) process.exit(1);
