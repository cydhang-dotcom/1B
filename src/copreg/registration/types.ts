/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface FileAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  data: string; // Data URL or placeholder
  slot?: 'idFront' | 'idBack' | 'license' | 'regAddressProof' | 'workAddressProof' | string;
}

export interface PersonRecord {
  id: string;
  name: string;
  phone: string;
  email: string;
  education: string;
  address: string;
  files: FileAttachment[];
}

export interface ShareholderRecord {
  id: string;
  type: '自然人' | '企业' | '其他';
  personId: string | null;
  name: string; // for enterprise or other
  code: string; // for enterprise code
  ratio: string; // percentage e.g. "70"
  amount: string; // wan yuan e.g. "70"
  method: string[]; // e.g. ['货币', '实物']
  files: FileAttachment[];
}

export interface RoleRecord {
  id: string;
  personId: string;
  roles: string[]; // ['法定代表人', '财务负责人', '总经理', '联系人']
}

export interface BasicInfoData {
  org: string;
  orgOther: string;
  intro: string;
  service: string;
  scope: string;
  capital: string;
  expert: boolean;
  names: string[];
  regAddress: string;
  regRecommend: boolean;
  regAddressNature?: string;
  regFiles?: FileAttachment[];
  workAddress: string;
  workRecommend: boolean;
  workAddressNature?: string;
  workFiles?: FileAttachment[];
  // 董事与监事设置
  board: string;
  directors: string;
  singleDirector: string;
  singleSupervisor: string;
  unanimous: boolean;
}

export interface SetupInfoData {
  establishmentType?: string;
  board?: string;
  directors?: string;
  singleDirector?: string;
  supervisorBoard?: string;
  supervisors?: string;
  singleSupervisor?: string;
  unanimous?: boolean;
  term?: string;
  termYears?: string;
  legacyTerm?: string;
  employees?: string;
}

export interface AuthorizationData {
  trusteeName: string;
  trusteeIdNumber: string;
  entrustDate: string;
  files: FileAttachment[];
}

export interface ConfirmData {
  exemption: boolean;
  beneficiary: string;
  files: FileAttachment[];
  accurate: boolean;
}

export interface RegistrationFullForm {
  id: string;
  status: 'draft' | 'submitted';
  savedAt: string | null;
  submittedAt: string | null;
  submissionPhone: string;
  basic: BasicInfoData;
  people: Record<string, PersonRecord>;
  shareholders: ShareholderRecord[];
  roles: RoleRecord[];
  setup?: SetupInfoData;
  authorization: AuthorizationData;
  confirm: ConfirmData;
}

export interface ValidationErrorItem {
  s: number; // chapter index (0-4)
  id: string; // field id
  msg: string;
  record?: {
    kind: 'share' | 'role';
    id: string;
  };
}
