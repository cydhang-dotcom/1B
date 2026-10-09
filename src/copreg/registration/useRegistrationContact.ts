/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 读当前主体的**联系人**（申报资料里指定为「联系人」的那个人），给 `#paid` 头部的
 * 「经办人姓名 / 经办联系电话」两格用。口径在 `contactInfo.ts`，这里只管「什么时候重读」。
 *
 * 为什么要重读、而不是挂载时读一次：
 *   1. **填报页是新标签页打开的** —— 用户在这边的支付成功页点「申报资料填报」（新标签页）去填，
 *      填完保存/提交，那一页写的是 `banbu-registration-{appId}`。本页一直挂着、不会重新挂载，
 *      所以监听 `storage` 事件（同源别的标签页改动 localStorage 时，本页会收到）就能实时跟上；
 *   2. **同标签页**从填报页返回支付页（弹窗被拦时的同页跳转、或提交完自动回来）时组件会重新挂载，
 *      初始 state 自然读到新的；另外再听 `focus` / `visibilitychange` 兜一层（切回本标签页时重读）。
 *
 * 重读后两项都没变时**返回原对象**，免得每次 focus 都白渲染一次。
 */

import { useEffect, useState } from 'react';
import { registrationStorageKey } from './defaultData';
import { contactOfDraftJson, type RegistrationContact } from './contactInfo';

const readContact = (appId: string): RegistrationContact => {
  try {
    return contactOfDraftJson(localStorage.getItem(registrationStorageKey(appId)));
  } catch {
    // 浏览器禁用本地存储：当没填，退回订单上那份
    return { name: '', phone: '' };
  }
};

/**
 * @param appId      当前主体 id（申报表存档按主体各一份）
 * @param refreshKey 额外的「该重读了」信号（本页 state 变了就传进来，例如提交状态翻成 true）
 */
export const useRegistrationContact = (appId: string, refreshKey?: unknown): RegistrationContact => {
  const [contact, setContact] = useState<RegistrationContact>(() => readContact(appId));

  useEffect(() => {
    const reread = () => {
      setContact((prev) => {
        const next = readContact(appId);
        return prev.name === next.name && prev.phone === next.phone ? prev : next;
      });
    };

    reread(); // appId / refreshKey 变了（切主体、提交状态翻转）先读一次

    const onStorage = (event: StorageEvent) => {
      // key 为 null 表示整库被清空（clear()），也要重读；只认本主体那份草稿键
      if (event.key === null || event.key === registrationStorageKey(appId)) reread();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', reread);
    document.addEventListener('visibilitychange', reread);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', reread);
      document.removeEventListener('visibilitychange', reread);
    };
  }, [appId, refreshKey]);

  return contact;
};
