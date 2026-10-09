/**
 * 「注册资本（万元）」这一格的**文案与口径**（纯逻辑，`scripts/check-capital-hints.ts` 离线自检）。
 *
 * 背景：问卷里问过「是否需要注册资本专家建议」（默认「是 · 需要专家建议」）。
 *   - 选「是」→ 第 5 步预填**方案给出的建议值**，并记 `expert = true`：这格里的数字不是用户定的，
 *     只有顾问最终确认才算数；
 *   - 选「否」→ 预填用户自己填的金额，`expert = false`。
 *
 * 用户报的 bug：他在第 5 步把这格改成 10，05 确认提交那一章却只显示「专家推荐」、把他填的
 * 数字吞掉了 —— 因为 `expert` 是**建表那一刻**的快照，改输入框并不会清它。两条修法：
 *   1. 用户**一旦自己改这格**，就等于他自己定了金额 → `capitalEditPatch` 顺手把标记撤掉（治本）；
 *   2. 确认页**只要有数字就把数字显示出来**，`expert` 只作为「这是建议值」的附注 ——
 *      这样即便是一份改之前就已经存下来、带着 `expert = true` 的旧草稿，也不会再把数字藏起来。
 */

/** 用户改金额时的表单补丁：只留整数（与校验口径一致），并撤掉「专家推荐」标记 */
export const capitalEditPatch = (value: string): { capital: string; expert: boolean } => ({
  capital: value.replace(/[^\d]/g, ''),
  expert: false,
});

/**
 * 预填的仍是方案建议值时，输入框下面那句说明。
 * 用户看到这行就知道「这个 100 不是我填的、可以改」，改完标记自动撤掉、确认页按他填的显示。
 */
export const CAPITAL_EXPERT_HINT =
  '当前数字是方案给出的建议值（问卷里选了「需要注册资本专家建议」）。要自己定就直接改这一格，改完按你填的金额走，确认提交那一章也会显示这个数字。';

/** 05 确认提交那一章怎么显示注册资本：**有数字就先显示数字**，专家建议只作附注 */
export const capitalReviewTextOf = (basic: { capital: string; expert: boolean }): string => {
  const amount = basic.capital.trim();
  if (amount !== '') {
    return basic.expert ? `${amount} 万元人民币（专家建议值，最终由顾问确定）` : `${amount} 万元人民币`;
  }
  // 数字是必填项，正常走不到这里；真为空时如实说明来源，不编数字
  return basic.expert ? '专家推荐（由顾问出资建议方案确定）' : '未填写';
};
