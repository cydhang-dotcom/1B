/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RegistrationFullForm } from './types';
import { registrationKey } from '../applications';

/** 单主体时代的全局申报表键；多主体之后只留给迁移用（见 applications.ts） */
export const STORAGE_KEY = 'banbu-registration-20260913-v1';

/**
 * 某个主体的申报表存档键。第 5 步的整份申报表按主体各存一份 ——
 * 共用一个键的话，切主体会看到上一个主体的申报资料。
 */
export const registrationStorageKey = (appId: string): string => registrationKey(appId);

export function uid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function formatSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

export function createBlankForm(): RegistrationFullForm {
  return {
    id: uid(),
    status: 'draft',
    savedAt: null,
    submittedAt: null,
    submissionPhone: '',
    basic: {
      org: '有限责任公司',
      orgOther: '',
      // 空白骨架就是空白：企业描述与主营由第 1 步问卷转换过来（见 registrationSeed.ts）
      intro: '',
      service: '',
      scope: '',
      capital: '100',
      expert: false,
      names: ['', '', ''],
      regAddress: '',
      regRecommend: false,
      regAddressNature: '租赁用房',
      regFiles: [],
      workAddress: '',
      workRecommend: false,
      workAddressNature: '商业租赁',
      workFiles: [],
      board: '不设董事会',
      directors: '',
      singleDirector: '由总经理代行职务（不设董事）',
      singleSupervisor: '不设监事',
      unanimous: true,
    },
    people: {},
    shareholders: [],
    roles: [],
    setup: {
      establishmentType: '发起设立',
      board: '不设董事会',
      directors: '',
      singleDirector: '由总经理代行职务（不设董事）',
      supervisorBoard: '不设监事会',
      supervisors: '',
      singleSupervisor: '不设监事',
      unanimous: true,
      term: '长期',
      termYears: '',
      employees: '',
    },
    authorization: {
      trusteeName: '',
      trusteeIdNumber: '',
      entrustDate: new Date().toISOString().split('T')[0],
      files: [],
    },
    confirm: {
      exemption: false,
      beneficiary: '',
      files: [],
      accurate: false,
    },
  };
}
