/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * **联系人**（申报资料「03 主要人员」里指定为「联系人」的那个人）的取值口径 —— 纯逻辑，
 * `scripts/check-contact-info.ts` 离线自检。
 *
 * 用途：`#paid` 支付成功页头部卡片上的「经办人姓名 / 经办联系电话」。
 * 付过款时订单里只有一个查单带回来的手机号（`order.contactPhone`），**姓名从来没采集过**
 * （`order.contactName` 一直是空），所以那两格原来一直是破折号。用户报的是：
 * 「如果后面填写了联系人信息，就取联系人的姓名和电话」—— 也就是以**申报资料里填的联系人**为准，
 * 没填的时候才退回订单上那份（手机号）/ 破折号。
 *
 * 取值来源是**每个主体那份申报表草稿**（`banbu-registration-{appId}`，`RegistrationDetailsStep`
 * 保存 / 提交时写的），不是内存里的 state —— 填报页是**新标签页**打开的，只有落盘的东西那边才看得到。
 * 草稿可能来自旧版本，所以统一走 `normalizeRegistrationForm` 收口（与填报页、服务人员查看页同一份）。
 */

import { normalizeRegistrationForm } from './formSnapshot';
import type { RegistrationFullForm } from './types';

/** 「联系人」这个角色名（与 `PersonnelSection` 的 ALL_ROLES / 必填角色一致） */
export const CONTACT_ROLE = '联系人';

/** 联系人两项；没填就是空串（调用方据此决定要不要退回订单上那份） */
export interface RegistrationContact {
  name: string;
  phone: string;
}

const EMPTY: RegistrationContact = { name: '', phone: '' };

/**
 * 从申报表里取联系人：角色里带「联系人」的那个人 → 他的姓名 / 电话。
 * 同一个人可以兼多个角色（例如法定代表人兼联系人），所以按角色找、不按「是不是第一位」猜。
 * 找不到角色或那个人不存在 → 空串（**不拿法定代表人顶替**：联系人未必是法定代表人）。
 */
export const contactOfForm = (form: RegistrationFullForm | null | undefined): RegistrationContact => {
  if (!form) return EMPTY;
  const roleEntry = (form.roles || []).find((entry) => (entry.roles || []).includes(CONTACT_ROLE));
  if (!roleEntry) return EMPTY;
  const person = form.people ? form.people[roleEntry.personId] : null;
  if (!person) return EMPTY;
  return {
    name: (person.name || '').trim(),
    phone: (person.phone || '').trim(),
  };
};

/** 从草稿 JSON 串取联系人：坏 JSON / 认不出的结构一律当「没填」，不抛 */
export const contactOfDraftJson = (raw: string | null | undefined): RegistrationContact => {
  if (typeof raw !== 'string' || raw.trim() === '') return EMPTY;
  try {
    return contactOfForm(normalizeRegistrationForm(JSON.parse(raw)));
  } catch {
    return EMPTY;
  }
};

/**
 * 两项各自的取值：**联系人填了就取联系人的**，没填的那一项才退回订单上的值（没有就破折号）。
 * 两项分别判断：用户可能只填了姓名没填电话（或反过来）。
 */
export const agentCardOf = (
  contact: RegistrationContact,
  order: { contactName?: string; contactPhone?: string }
): { name: string; phone: string } => ({
  name: contact.name || (order.contactName || '').trim() || '—',
  phone: contact.phone || (order.contactPhone || '').trim() || '—',
});
