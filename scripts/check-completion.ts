/**
 * 第 5 步「卡片完善度」口径的自检：不联网、不碰 React、不开浏览器。
 *   npx tsx scripts/check-completion.ts
 *
 * 口径（2026-10-08 用户要求：「提交数据里带完善百分比，以卡片绿色边框数量 / 总卡片数为标准」）：
 *   1. 卡片清单固定 **10 张**：基本信息 7 个面板 + 股东出资 / 主要人员 / 委托书办理；
 *   2. 每张卡片「没有待完善项」= 它那组校验 id 在本章的错误里一个都没出现（与界面亮绿框同源）；
 *   3. 百分比 = 绿框卡片数 / 10，四舍五入到整数；
 *   4. 错误按**章节**隔离：第 2 章的错误不该让基本信息的面板掉绿框。
 */
import {
  CARD_CHAPTER,
  CARD_IDS,
  CHAPTER_CARD_IDS,
  PANEL_CARD_IDS,
  PANEL_ERROR_IDS,
  cardDoneOf,
  completionOf,
  completionPercentOf,
  errorsByChapter,
} from '../src/copreg/registration/completion';

let passed = 0;
let failed = 0;

function ok(label: string, condition: boolean, extra = '') {
  if (condition) {
    passed += 1;
  } else {
    failed += 1;
    console.error(`✗ ${label}${extra ? ` —— ${extra}` : ''}`);
  }
}

const err = (s: number, id: string) => ({ s, id });

/* ------------------------------------------------------ 1. 卡片清单 */

ok('卡片一共 10 张', CARD_IDS.length === 10);
ok('卡片 id 不重复', new Set(CARD_IDS).size === CARD_IDS.length);
ok(
  '基本信息 7 个面板 + 三个章节卡片，章节归属正确',
  CARD_IDS.filter((c) => CARD_CHAPTER[c] === 0).length === 7 &&
    CARD_CHAPTER.shareholders === 1 &&
    CARD_CHAPTER.personnel === 2 &&
    CARD_CHAPTER.authorization === 3
);
ok(
  '7 张面板卡片各登记了一组校验 id',
  PANEL_CARD_IDS.every((card) => Array.isArray(PANEL_ERROR_IDS[card]) && PANEL_ERROR_IDS[card].length > 0) &&
    PANEL_CARD_IDS.every((card) => CARD_IDS.includes(card))
);
ok('3 张整章卡片是另外一类：股东出资 / 主要人员 / 委托书办理', CHAPTER_CARD_IDS.join(',') === 'shareholders,personnel,authorization');

/* ------------------------------------------ 2. 单张卡片：按 id 判完成 */

ok('没有任何错误 → 每张卡片都算完成', CARD_IDS.every((card) => cardDoneOf(card, {}) === true));
ok('null / undefined 也当「没有错误」', cardDoneOf('panel-03', null) === true && cardDoneOf('panel-03', undefined) === true);
ok(
  '注册资本那一档：报 capital → 这张卡片不算完成',
  cardDoneOf('panel-03', { capital: 'x' }) === false && cardDoneOf('panel-04', { capital: 'x' }) === true
);
ok(
  '名称那一档按 `name-*` 前缀判（name-0 / name-5 都算）',
  cardDoneOf('panel-02', { 'name-0': 'x' }) === false && cardDoneOf('panel-02', { 'name-5': 'x' }) === false
);
ok(
  '名字相似但不该命中的 id 不会误伤（`names` 不是 `name-0`）',
  cardDoneOf('panel-02', { names: 'x' }) === true && cardDoneOf('panel-03', { capitalX: 'x' }) === true
);
ok(
  '地址那一档：六个 id 里任意一个报错都不算完成',
  ['regAddress', 'regAddressNature', 'regFiles', 'workAddress', 'workAddressNature', 'workFiles'].every(
    (id) => cardDoneOf('panel-05', { [id]: 'x' }) === false
  )
);
ok(
  '★ 整章卡片（股东出资 / 主要人员 / 委托书办理）判据 = **这一章一条错都没有**（与上方黄色提示框同条件）',
  cardDoneOf('shareholders', { shareholders: 'x' }) === false &&
    cardDoneOf('personnel', { roles: 'x' }) === false &&
    cardDoneOf('authorization', { auth: 'x' }) === false &&
    cardDoneOf('shareholders', {}) === true &&
    cardDoneOf('shareholders', null) === true
);
ok(
  '★ 用户报的那个 bug：股东那一章只有**逐行的** `share-{id}` 错（或冲突项）时，卡片不能再亮绿',
  cardDoneOf('shareholders', { 'share-s1': '股东 1（张三）：请补齐身份证人像面和国徽面照片' }) === false &&
    cardDoneOf('shareholders', { 'share-abc123': '出资比例合计应为 100%' }) === false &&
    // 面板卡片不受影响：别的章的错、以及认不出的 id 都不改它的状态
    cardDoneOf('panel-03', { 'share-s1': 'x' }) === true &&
    cardDoneOf('panel-01', { 'share-s1': 'x' }) === true
);

/* -------------------------------------------------- 3. 百分比计算 */

ok('全无错误 → 10/10 = 100%', JSON.stringify(completionOf([])) === JSON.stringify({ done: 10, total: 10, percent: 100 }));
ok('只有一处错误 → 9/10 = 90%', completionPercentOf([err(0, 'capital')]) === 90);
ok('同一个面板报两条错也只扣一次', completionPercentOf([err(0, 'capital'), err(0, 'capital')]) === 90);
ok('两个面板错 → 8/10 = 80%', completionPercentOf([err(0, 'capital'), err(0, 'scope')]) === 80);
ok('四舍五入：3 张不完成 → 70%', completionPercentOf([err(0, 'capital'), err(0, 'scope'), err(0, 'org')]) === 70);
ok('四舍五入：1 张不完成 → 90%（0.9 不进位）', completionPercentOf([err(1, 'shareholders')]) === 90);
ok(
  '★ 错误按章节隔离：第 2 章（股东）的错不影响基本信息的面板',
  (() => {
    const onlyShareholderError = completionOf([err(1, 'shareholders')]);
    const byChapter = errorsByChapter([err(1, 'shareholders')]);
    return onlyShareholderError.done === 9 && cardDoneOf('panel-01', byChapter[0]) === true && cardDoneOf('shareholders', byChapter[1]) === false;
  })()
);
ok(
  '认不出的 id 不影响面板卡片（老存档里的脏错误不会莫名扣分）',
  completionPercentOf([err(0, 'foo'), err(9, 'capital')]) === 100
);
ok(
  '★ 但整章卡片只要这一章有错就不亮绿 —— 包括 id 认不出的冲突项（黄框会出现的那种）',
  completionPercentOf([err(1, 'whatever-conflict-id')]) === 90 && cardDoneOf('shareholders', { 'whatever-conflict-id': 'x' }) === false
);
ok('errorsByChapter 会按章节收口', JSON.stringify(errorsByChapter([err(0, 'a'), err(0, 'b'), err(1, 'c')])) === JSON.stringify({ 0: { a: '', b: '' }, 1: { c: '' } }));
ok('百分比永远是 0~100 的整数', CARD_IDS.every((_, index) => {
  const errors = CARD_IDS.slice(0, index).map((card) => err(CARD_CHAPTER[card], (PANEL_ERROR_IDS as Record<string, string[]>)[card]?.[0] ?? 'any-error'));
  const percent = completionPercentOf(errors);
  return Number.isInteger(percent) && percent >= 0 && percent <= 100;
}));
ok(
  '全部 10 张都不完成 → 0%',
  completionPercentOf(
    CARD_IDS.map((card) => {
      // 面板卡片：给它自己那组 id 里的第一个（名称那一档要用 `name-0` 这种真实 id）；
      // 整章卡片：随便一条本章的错就够（判据是「这一章有没有错」）
      const id = (PANEL_ERROR_IDS as Record<string, string[]>)[card];
      const errorId = !id ? 'any-error' : id[0] === '__names__' ? 'name-0' : id[0];
      return err(CARD_CHAPTER[card], errorId);
    })
  ) === 0
);

console.log(`\n${passed} 项通过，${failed} 项失败`);
if (failed > 0) process.exit(1);
