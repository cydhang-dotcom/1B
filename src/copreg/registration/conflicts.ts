/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 申报表的**关联冲突校验（cross-field）**：每一项单看都没问题，但彼此对不上。
 *
 * 与 `RegistrationDetailsStep.validate()` 的分工：
 *   `validate()`   只管「这一项填了没有、格式对不对」—— 单字段、按章节顺着看；
 *   本文件          只管「几项之间是否自相矛盾」—— 注册资本 ↔ 股东出资比例/金额、
 *                  基本信息里的治理结构 ↔ 主要人员实际指派、企业名称 ↔ 组织形式、
 *                  委托书两项是否成对、免申报承诺 ↔ 股东类型。
 *
 * 产出沿用 `ValidationErrorItem`（`s` = 章节下标、`id` = 章节内定位用的 key、`record` 挂到具体
 * 股东/人员行），所以调用方直接把它并进既有错误列表即可：章节顶部那份「本章节尚有 N 项需完善」
 * 会一并列出来，点提交时也会像普通校验一样跳到第一个出错章节。
 *
 * 纯函数、不碰 React 也不读 import.meta.env，所以 `scripts/check-conflicts.ts` 能直接跑。
 * 金额单位一律「万元」，比例单位「%」；浮点与四舍五入留 0.01 的余量。
 */

import type { RegistrationFullForm, RoleRecord, ShareholderRecord, ValidationErrorItem } from './types';

/** 金额（万元）/ 比例（%）的比对容差 */
export const AMOUNT_EPS = 0.01;

/** 出资额超过这个数就不接受小数了吗？——不限制，只按填写值算，格式问题由 validate() 管 */

/** 空串 / 非法数字都返回 null（「没填」与「填了但不是数字」在这里都当不可用，格式错误由 validate() 报） */
export const numberOf = (value: string | undefined | null): number | null => {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text === '') return null;
  const num = Number(text);
  return Number.isFinite(num) ? num : null;
};

/** 两位小数内的相等（避免 33.33 × 3 这类浮点尾巴） */
const eq = (a: number, b: number): boolean => Math.abs(a - b) < AMOUNT_EPS;

/** 去掉多余小数尾巴用于提示文案：100 → 100、33.333 → 33.33 */
const show = (value: number): string => String(Math.round(value * 100) / 100);

/* -------------------------------------------------- 基本信息里的治理结构 */

/** 与 BasicInfoSection 的选项一致（那边有 `设 1 名董事` 与 `设1名董事` 两种历史写法） */
const isDirectorSeat = (value: string | undefined): boolean =>
  value === '设 1 名董事' || value === '设1名董事' || value === '董事';

/** 「不设董事会 + 由总经理代行（或压根没选董事安排）」= 没有董事席位 */
const isNoDirectorBoard = (form: RegistrationFullForm): boolean => {
  const b = form.basic;
  if (b.board === '设董事会') return false;
  if (isDirectorSeat(b.singleDirector)) return false;
  return true;
};

const isOneSupervisor = (value: string | undefined): boolean =>
  value === '设 1 名监事' || value === '设1名监事' || value === '一名监事';

const isNoSupervisor = (value: string | undefined): boolean => value === '不设监事';

/** 谁担任了某个角色（可能不止一个人 —— 那本身就是冲突，见下） */
const holdersOf = (roles: RoleRecord[], role: string): RoleRecord[] =>
  roles.filter((record) => (record.roles ?? []).includes(role));

const nameOf = (form: RegistrationFullForm, record: RoleRecord): string =>
  form.people[record.personId]?.name?.trim() || '未填写姓名';

/* ------------------------------------------------------------------ 规则 */

/** 名称里是否出现某个组织形式字样（企业名称里通常含「有限公司 / 股份有限公司 / 合伙企业」） */
const NAME_WORDS = {
  joint: '股份',
  partnership: '合伙',
} as const;

/**
 * 找出所有「关联冲突」。返回顺序按章节（0→4），同一章节内先整章级的、后具体行的，
 * 让用户从上往下改。
 */
export const conflictErrorsOf = (form: RegistrationFullForm): ValidationErrorItem[] => {
  const errors: ValidationErrorItem[] = [];
  const add = (
    s: number,
    id: string,
    msg: string,
    record?: { kind: 'share' | 'role'; id: string }
  ) => {
    errors.push({ s, id, msg, ...(record ? { record } : {}) });
  };

  const shareholders: ShareholderRecord[] = form.shareholders ?? [];
  const roles: RoleRecord[] = form.roles ?? [];

  /* ---------- 第 1 章：股东出资 ↔ 注册资本 ---------- */

  const capital = numberOf(form.basic?.capital);
  const rows = shareholders.map((record) => ({
    record,
    ratio: numberOf(record.ratio),
    amount: numberOf(record.amount),
  }));

  if (rows.length > 0 && rows.every((row) => row.ratio !== null)) {
    const ratioSum = rows.reduce((sum, row) => sum + (row.ratio as number), 0);
    if (!eq(ratioSum, 100)) {
      add(
        1,
        'shareholders',
        `股东出资比例合计 ${show(ratioSum)}%，应为 100%（${ratioSum > 100 ? '超出' : '还差'} ${show(
          Math.abs(100 - ratioSum)
        )}%）`
      );
    }
  }

  if (rows.length > 0 && capital !== null && capital > 0) {
    const filled = rows.filter((row) => row.amount !== null);
    if (filled.length === 0) {
      // 认缴出资金额是选填：一份都没填就不跟注册资本对账（要填就得填全，见下一条）
    } else if (filled.length < rows.length) {
      add(
        1,
        'shareholders',
        `有 ${rows.length - filled.length} 位股东没填认缴出资金额（共 ${rows.length} 位）：请补齐，或全部留空 —— 只填一部分没法与注册资本核对`
      );
    } else {
      const amountSum = filled.reduce((sum, row) => sum + (row.amount as number), 0);
      if (!eq(amountSum, capital)) {
        add(
          1,
          'shareholders',
          `各股东认缴出资合计 ${show(amountSum)} 万元，与基本信息里的注册资本 ${show(capital)} 万元不一致（${
            amountSum > capital ? '超出' : '差'
          } ${show(Math.abs(capital - amountSum))} 万元）`
        );
      }
    }

    // 逐行：比例 × 注册资本 应当等于该股东填的出资额
    rows.forEach((row, index) => {
      if (row.ratio === null || row.amount === null) return;
      const expected = (row.ratio / 100) * capital;
      if (eq(expected, row.amount)) return;
      add(
        1,
        `share-${row.record.id}`,
        `股东 ${index + 1}：按出资比例 ${show(row.ratio)}% × 注册资本 ${show(capital)} 万元 = ${show(
          expected
        )} 万元，与填写的 ${show(row.amount)} 万元不一致`,
        { kind: 'share', id: row.record.id }
      );
    });
  }

  // 自然人股东必须关联一位已录入的人员（否则姓名/证件照那些校验查的是「不存在的人」）
  rows.forEach((row, index) => {
    if (row.record.type !== '自然人') return;
    const linked = row.record.personId ? form.people?.[row.record.personId] : null;
    if (linked) return;
    add(
      1,
      `share-${row.record.id}`,
      `股东 ${index + 1}：自然人股东必须关联一位已录入的人员（当前未关联，姓名与证件照都取不到）`,
      { kind: 'share', id: row.record.id }
    );
  });

  /* ---------- 第 2 章：主要人员 ↔ 基本信息里的治理结构 ---------- */

  // 法定代表人 / 财务负责人只能有一位
  (['法定代表人', '财务负责人'] as const).forEach((role) => {
    const holders = holdersOf(roles, role);
    if (holders.length <= 1) return;
    add(
      2,
      'roles',
      `${role}由 ${holders.length} 位人员同时担任（${holders
        .map((record) => nameOf(form, record))
        .join('、')}），只能有一位`
    );
  });

  // 董事会人数：基本信息里填了几人，就应当指派几位「董事」
  const directorHolders = holdersOf(roles, '董事');
  if (form.basic?.board === '设董事会') {
    const seats = numberOf(form.basic.directors);
    if (seats !== null && directorHolders.length !== seats) {
      add(
        2,
        'roles',
        `基本信息里设 ${show(seats)} 名董事，但主要人员里指派了 ${directorHolders.length} 位董事，请对齐`
      );
    }
  } else if (directorHolders.length > 0) {
    add(
      2,
      'roles',
      `基本信息是「不设董事会 · ${
        form.basic?.singleDirector || '由总经理代行职务（不设董事）'
      }」，但主要人员里指派了 ${directorHolders.length} 位董事，两者矛盾`
    );
  }

  // 监事：设 1 名就刚好一位，不设就一位都不能有
  const supervisorHolders = holdersOf(roles, '监事');
  if (isNoSupervisor(form.basic?.singleSupervisor) && supervisorHolders.length > 0) {
    add(
      2,
      'roles',
      `基本信息选择「不设监事」，但主要人员里指派了 ${supervisorHolders.length} 位监事，两者矛盾`
    );
  } else if (isOneSupervisor(form.basic?.singleSupervisor) && supervisorHolders.length !== 1) {
    add(
      2,
      'roles',
      `基本信息选择「设 1 名监事」，但主要人员里指派了 ${supervisorHolders.length} 位监事，请对齐`
    );
  }

  // 注：「不设董事会时该不该有总经理」不在这里查 —— 那是**必填**（validate 的 requiredRoles
  // 会要求指派总经理），不属于「两边对不上」；本文件只报自相矛盾。

  /* ---------- 第 0 章：企业名称 ↔ 组织形式 ---------- */

  const org = (form.basic?.org || '').trim();
  const names = (form.basic?.names ?? []).map((name) => (name || '').trim());
  names.forEach((name, index) => {
    if (name === '') return;
    if (name.includes(NAME_WORDS.joint) && org !== '股份有限公司') {
      add(
        0,
        `name-${index}`,
        `名称「${name}」含「股份」，但与基本信息里的组织形式「${org || '未选择'}」不符（应选股份有限公司）`
      );
    }
    if (name.includes(NAME_WORDS.partnership) && org !== '合伙企业') {
      add(
        0,
        `name-${index}`,
        `名称「${name}」含「合伙」，但与基本信息里的组织形式「${org || '未选择'}」不符（应选合伙企业）`
      );
    }
  });
  if (names.some((name) => name !== '')) {
    if (org === '股份有限公司' && !names.some((name) => name.includes(NAME_WORDS.joint))) {
      add(0, 'name-0', '组织形式选了股份有限公司，但填写的名称里都没有「股份」字样，请核对');
    }
    if (org === '合伙企业' && !names.some((name) => name.includes(NAME_WORDS.partnership))) {
      add(0, 'name-0', '组织形式选了合伙企业，但填写的名称里都没有「合伙」字样，请核对');
    }
  }

  /* ---------- 第 3 章：委托书两项是否成对、格式 ---------- */

  const trusteeName = (form.authorization?.trusteeName || '').trim();
  const trusteeId = (form.authorization?.trusteeIdNumber || '').trim();
  if (trusteeName !== '' && trusteeId === '') {
    add(3, 'auth', '已填受托人姓名，但没填身份证号码：委托书上两项都要有（或都留空交申请人手写）');
  } else if (trusteeName === '' && trusteeId !== '') {
    add(3, 'auth', '已填受托人身份证号码，但没填姓名：委托书上两项都要有（或都留空交申请人手写）');
  }
  if (trusteeId !== '' && !/^\d{17}[\dXx]$/.test(trusteeId)) {
    add(3, 'auth', `受托人身份证号码「${trusteeId}」不是 18 位（17 位数字 + 数字或 X）`);
  }

  /* ---------- 第 4 章：免申报承诺 ↔ 股东类型 ---------- */

  if (form.confirm?.exemption) {
    const nonNatural = shareholders.filter((record) => record.type !== '自然人');
    if (nonNatural.length > 0) {
      add(
        4,
        'exemption',
        `已勾选「股东均为自然人」的免申报承诺，但股东里有 ${nonNatural.length} 位非自然人股东（${nonNatural
          .map((record) => record.name?.trim() || '未填写企业全称')
          .join('、')}），两者矛盾`
      );
    }
  }

  return errors;
};
