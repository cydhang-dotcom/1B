/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 第 5 步（#fill-details）的**卡片完善度**：唯一一份「哪些卡片算完成」的口径。
 *
 * 界面上的高亮卡片一共 `CARD_IDS.length` 张（与 `#survey` 同一套视觉：**没有待完善项才亮绿框**）：
 *   基本信息 7 个面板（01 组织形式 / 02 名称 / 03 注册资本 / 04 简介与主营 / 05 两个地址 /
 *   06 董事设置 / 07 监事设置）+ 股东出资 / 主要人员 / 委托书办理三章各一张。
 *
 * 为什么把口径集中到这里（原来散在 `BasicInfoSection` 的 `PANEL_ERROR_IDS` 与三个章节组件里的
 * `Object.keys(errors).length === 0`）：**提交时要带一个「完善百分比」**（2026-10-08 用户要求
 * 「以卡片绿色边框数量 / 总卡片数为标准」）—— 百分比必须与用户看到的绿框**同一个来源**，
 * 各算一套迟早对不上。所以三处界面与提交载荷都调这里的 `cardDoneOf` / `completionOf`。
 *
 * 判据：卡片归属章节的**校验结果**里有没有它那组 id 的错（`validate()` + `conflictErrorsOf()`
 * 的输出，`s` 是章节下标）。没有错 = 这一块没待完善项 = 界面亮绿框 = 计入分子。
 */

/**
 * 卡片分两类，判据不一样：
 *
 * - **整章一张的卡片**（股东出资 / 主要人员 / 委托书办理）：判据 = **这一章有没有待完善项**
 *   —— 就是章节上方那个**黄色提示框**（「本章节尚有 N 项需完善…」）的条件，一模一样。
 *   为什么不用「某几个 id」：这一章的错 id 花样很多（`shareholders` 只是「一个都没加」，
 *   每个股东还有 `share-{id}`、比例 / 出资额对不上还有冲突项…），
 *   只盯某几个 id 就会出现「黄框挂在上面、卡片却是绿的」（2026-10-08 用户报的）。
 * - **基本信息里的面板卡片**（01~07）：判据 = 这一块自己那组校验 id 有没有错
 *   （一张卡片对一个面板，粒度细到面板，所以不能整章一刀切）。
 */
export const PANEL_CARD_IDS = [
  'panel-01',
  'panel-02',
  'panel-03',
  'panel-04',
  'panel-05',
  'panel-06',
  'panel-07',
] as const;

export const CHAPTER_CARD_IDS = ['shareholders', 'personnel', 'authorization'] as const;

export type PanelCardId = (typeof PANEL_CARD_IDS)[number];
export type ChapterCardId = (typeof CHAPTER_CARD_IDS)[number];
export type RegistrationCardId = PanelCardId | ChapterCardId;

/** 界面上一共有哪些「高亮卡片」，顺序就是它们在页面上的顺序 */
export const CARD_IDS: RegistrationCardId[] = [...PANEL_CARD_IDS, ...CHAPTER_CARD_IDS];

/** `__names__`：名称那一组，校验 id 形如 `name-0` / `name-1` …（前缀匹配） */
const NAMES_GROUP = '__names__';

/** 面板卡片对应的校验 id（与 `RegistrationDetailsStep.validate()` 用的 id 一一对应） */
export const PANEL_ERROR_IDS: Record<PanelCardId, string[]> = {
  'panel-01': ['org', 'orgOther'],
  'panel-02': [NAMES_GROUP],
  'panel-03': ['capital'],
  'panel-04': ['scope'],
  'panel-05': ['regAddress', 'regAddressNature', 'regFiles', 'workAddress', 'workAddressNature', 'workFiles'],
  'panel-06': ['board', 'directors', 'singleDirector'],
  'panel-07': ['singleSupervisor', 'unanimous'],
};

/** 卡片归属的校验章节下标（0 基本信息 / 1 股东 / 2 人员 / 3 委托书 / 4 确认） */
export const CARD_CHAPTER: Record<RegistrationCardId, number> = {
  'panel-01': 0,
  'panel-02': 0,
  'panel-03': 0,
  'panel-04': 0,
  'panel-05': 0,
  'panel-06': 0,
  'panel-07': 0,
  shareholders: 1,
  personnel: 2,
  authorization: 3,
};

/** 校验错误的最小形状（`ValidationErrorItem` 的结构子集，纯逻辑不依赖 UI 层类型） */
export interface CompletionError {
  /** 章节下标 */
  s: number;
  /** 字段 / 卡片的 id（如 `capital`、`name-0`、`auth`） */
  id: string;
}

/**
 * 这张卡片**有没有待完善项**：`false` = 界面会亮绿框。
 * `errors` 传**这一章**的 id→文案（章节级），与界面上各组件拿到的是同一份
 * （`RegistrationDetailsStep` 的 `currentErrorsMap`）。
 *
 * 整章一张的卡片（股东出资 / 主要人员 / 委托书办理）：这一章**一条错都不能有** ——
 * 与章节上方那个黄色提示框同条件，黄框在就绝不亮绿框。
 */
export const cardDoneOf = (card: RegistrationCardId, errors: Record<string, string> | null | undefined): boolean => {
  const keys = Object.keys(errors ?? {});
  if ((CHAPTER_CARD_IDS as readonly string[]).includes(card)) return keys.length === 0;
  const ids = PANEL_ERROR_IDS[card as PanelCardId] ?? [];
  if (ids.includes(NAMES_GROUP)) return !keys.some((key) => key.startsWith('name-'));
  return !keys.some((key) => ids.includes(key));
};

/** 把校验错误按章节收成 `Record<章节, Record<id, 文案>>` */
export const errorsByChapter = (errors: CompletionError[]): Record<number, Record<string, string>> => {
  const map: Record<number, Record<string, string>> = {};
  errors.forEach((error) => {
    const chapter = map[error.s] ?? (map[error.s] = {});
    chapter[error.id] = chapter[error.id] ?? ''; // 文案这里用不上，只要 id 在
  });
  return map;
};

/** 完善度三件套：已亮绿框的卡片数 / 卡片总数 / 百分比（四舍五入到整数） */
export const completionOf = (errors: CompletionError[]): { done: number; total: number; percent: number } => {
  const byChapter = errorsByChapter(errors);
  const done = CARD_IDS.filter((card) => cardDoneOf(card, byChapter[CARD_CHAPTER[card]])).length;
  const total = CARD_IDS.length;
  return { done, total, percent: Math.round((done / total) * 100) };
};

/** 只要百分比（提交载荷里那个字段） */
export const completionPercentOf = (errors: CompletionError[]): number => completionOf(errors).percent;
