/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 一个已上传的附件。**选完文件就调上传接口**（见 `useAttachmentUpload.ts`），
 * 这里只留服务端给的文件编号 —— 不存 dataURL：那份 base64 既会撑爆 localStorage，
 * 也没法交给服务端出单。要显示 / 下载时用全局工具 `fileUrlOf(fileUuid)` 现拼地址。
 */
export interface FileAttachment {
  /** 本地行 key（React key、删除用）；与服务端的 fileUuid 无关 */
  id: string;
  /** 上传接口返回的文件 id：取图 / 下载都靠它（`fileUrlOf(fileUuid)`） */
  fileUuid: string;
  /** 上传接口返回的文件名；服务端没给时回落到本地文件名 */
  fileName: string;
  /** 本地文件大小（服务端不回这一项，仅用于展示） */
  size: number;
  /** MIME（本地读到的，判断图片 / PDF 用） */
  type: string;
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
