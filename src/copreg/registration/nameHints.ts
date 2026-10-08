/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 第 5 步（#fill-details）「拟注册企业名称」面板的文案（纯逻辑，无 DOM、无 React）。
 *
 * 口径（2026-09 与产品确认后改正）：
 *
 * 1. **这里填的是「字号（关键词）」，不是完整公司名称**。要注册「上海班步企程服务有限公司」，
 *    用户只填「班步企程」即可 —— 行政区划与组织形式由系统按所选组织形式补全。
 *    这也是原先最容易填错的一格：让人填完整名称，用户就会把行政区划、行业、组织形式全塞进来。
 * 2. **第一个输入框的示例按「企业组织形式」联动**：给出的示例同时说清「填什么（字号）」和
 *    「会补成什么（完整名称）」，选有限责任公司 / 股份有限公司 / 合伙企业各给各的后缀。
 *
 * 认不出的组织形式（老存档手改、选项还没加载）回落到最常见的有限责任公司示例，而不是给更含糊的话。
 * 自检：`scripts/check-name-hints.ts`（纯逻辑）+ `npm run check:entry`（渲染出来的 placeholder）。
 */

/** 面板标题下那句说明：说清「只填字号」并给出反例，避免用户填完整公司名 */
export const NAME_PANEL_HINT =
  '只需填写字号（关键词），例如「班步企程」，不必填写「上海班步企程服务有限公司」这样的完整名称——行政区划与组织形式由系统按所选组织形式补全。';

/** 示例里用的字号 */
const EXAMPLE_KEYWORD = '班步企程';

/** 示例里补全出来的行政区划（只是示例，不参与任何校验） */
const EXAMPLE_REGION = '上海';

/**
 * 组织形式 → 补全后的完整名称后缀。键就是基本信息里那四个选项的存档值。
 * 「其他」单独处理：用户自己填了具体组织形式就用它，没填才回落。
 */
const ORG_NAME_SUFFIX: Record<string, string> = {
  有限责任公司: '服务有限公司',
  股份有限公司: '服务股份有限公司',
  合伙企业: '合伙企业（有限合伙）',
};

/** 兜底示例：绝大多数主体是有限责任公司 */
const FALLBACK_SUFFIX = ORG_NAME_SUFFIX['有限责任公司'];

/** 示例字号被补全后的完整名称（按组织形式联动） */
export const assembledNameExampleOf = (org: string, orgOther = ''): string => {
  const trimmedOther = orgOther.trim();
  const suffix = org === '其他' ? (trimmedOther !== '' ? trimmedOther : FALLBACK_SUFFIX) : ORG_NAME_SUFFIX[org] ?? FALLBACK_SUFFIX;
  return `${EXAMPLE_REGION}${EXAMPLE_KEYWORD}${suffix}`;
};

/** 第一个输入框的占位：说清「只填字号」，并按组织形式给出补全后的完整名称 */
export const primaryNamePlaceholderFor = (org: string, orgOther = ''): string =>
  `只需填字号，例如：${EXAMPLE_KEYWORD} → ${assembledNameExampleOf(org, orgOther)}`;

/** 备选输入框的占位：第几个备选字号 */
export const alternateNamePlaceholderOf = (index: number): string => `备选字号 ${index + 1}`;

/** 「添加备选字号」按钮文案（上限与校验一致：最多 9 个） */
export const ADD_NAME_LABEL = '添加备选字号（最多 9 个）';
