/**
 * 「拟注册企业名称」面板文案的自检：不联网、不碰 React、不开浏览器。
 *   npx tsx scripts/check-name-hints.ts
 *
 * 两条口径：
 *   1. **这一格填的是「字号（关键词）」，不是完整公司名称**：说明里要讲清楚并给出反例
 *      （「班步企程」而不是「上海班步企程服务有限公司」），否则用户会把行政区划、行业、
 *      组织形式全塞进来；
 *   2. **第一个输入框的示例按「企业组织形式」联动**：既说清填什么（字号），也说清会补成什么
 *      （完整名称），有限公司 / 股份有限公司 / 合伙企业各给各的后缀；「其他」用用户自填的组织形式，
 *      认不出的回落有限责任公司；占位里不再挂残留的 `*`。
 */
import {
  ADD_NAME_LABEL,
  NAME_PANEL_HINT,
  alternateNamePlaceholderOf,
  assembledNameExampleOf,
  primaryNamePlaceholderFor,
} from '../src/copreg/registration/nameHints';

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

/* ------------------------------------- 1. 说明：只填字号，别填完整名称 */

ok('说明写的是「只需填写字号（关键词）」', NAME_PANEL_HINT.includes('只需填写字号（关键词）'));
ok('说明给了正例「班步企程」', NAME_PANEL_HINT.includes('「班步企程」'));
ok('说明给了反例（完整公司名，明确说「不必填写」）', NAME_PANEL_HINT.includes('不必填写') && NAME_PANEL_HINT.includes('上海班步企程服务有限公司'));
ok('说明交代了行政区划与组织形式由系统补全', NAME_PANEL_HINT.includes('行政区划') && NAME_PANEL_HINT.includes('由系统'));

/* ------------------------------------------ 2. 示例名与组织形式联动 */

ok('有限责任公司 → 补成「上海班步企程服务有限公司」', assembledNameExampleOf('有限责任公司') === '上海班步企程服务有限公司');
ok('股份有限公司 → 补成「上海班步企程服务股份有限公司」', assembledNameExampleOf('股份有限公司') === '上海班步企程服务股份有限公司');
ok('合伙企业 → 补成「上海班步企程合伙企业（有限合伙）」', assembledNameExampleOf('合伙企业') === '上海班步企程合伙企业（有限合伙）');
ok('「其他」+ 自填组织形式 → 用用户填的那个', assembledNameExampleOf('其他', '外商投资性公司') === '上海班步企程外商投资性公司');
ok('「其他」没填 → 回落通用示例（不出现空后缀）', assembledNameExampleOf('其他', '   ') === '上海班步企程服务有限公司');
ok('认不出的组织形式 → 回落通用示例', assembledNameExampleOf('农民专业合作社') === '上海班步企程服务有限公司');
ok('空组织形式 → 回落通用示例（不出现 undefined）', assembledNameExampleOf('') === '上海班步企程服务有限公司');
ok(
  '四种组织形式给出的示例两两不同（确实是联动的）',
  new Set(['有限责任公司', '股份有限公司', '合伙企业', '其他'].map((org) => assembledNameExampleOf(org, '某某企业'))).size === 4
);

/* ------------------------------------------------- 3. 占位串组装 */

ok('首选占位说清「只需填字号」', primaryNamePlaceholderFor('有限责任公司').startsWith('只需填字号，例如：'));
ok(
  '首选占位同时给出「字号 → 完整名称」',
  primaryNamePlaceholderFor('有限责任公司') === '只需填字号，例如：班步企程 → 上海班步企程服务有限公司'
);
ok(
  '首选占位按组织形式变化（股份公司 / 合伙企业示例跟着换）',
  primaryNamePlaceholderFor('股份有限公司').includes('股份有限公司') &&
    primaryNamePlaceholderFor('合伙企业').includes('合伙企业（有限合伙）')
);
ok('首选占位不再挂残留的 `*`（必填星号由标题上的红点负责）', !primaryNamePlaceholderFor('有限责任公司').includes('*'));
ok('备选占位是「备选字号 N」（序号从 1 开始，与行首序号一致）', alternateNamePlaceholderOf(1) === '备选字号 2' && alternateNamePlaceholderOf(0) === '备选字号 1');
ok('添加按钮写清上限 9 个（与校验一致）', ADD_NAME_LABEL.includes('最多 9 个'));

console.log(`\n${passed} 项通过，${failed} 项失败`);
if (failed > 0) process.exit(1);
