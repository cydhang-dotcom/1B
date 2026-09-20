/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { PersonRecord, ShareholderRecord, RoleRecord, FileAttachment, BasicInfoData, SetupInfoData } from './types';
import { uid, formatSize } from './defaultData';
import { X, Trash2, Upload, Eye, AlertCircle } from 'lucide-react';

interface RecordModalProps {
  kind: 'share' | 'role';
  isNew: boolean;
  shareRecord?: ShareholderRecord;
  roleRecord?: RoleRecord;
  people: Record<string, PersonRecord>;
  existingRoles: RoleRecord[];
  basic?: BasicInfoData;
  setup?: SetupInfoData;
  onSave: (payload: {
    kind: 'share' | 'role';
    isNew: boolean;
    record: any;
    person?: PersonRecord;
    linked: boolean;
  }) => void;
  onDelete?: () => void;
  onClose: () => void;
  onPreviewFile: (file: FileAttachment) => void;
}

const EDUCATION_OPTIONS = [
  '博士研究生',
  '硕士研究生',
  '大学本科',
  '大学专科',
  '中专/技校',
  '高中',
  '初中及以下',
  '其他',
];

const CONTRIBUTION_METHODS = ['货币', '实物', '知识产权', '土地使用权', '劳务', '其他'];
const ROLES_LIST = ['法定代表人', '财务负责人', '总经理', '联系人'];

export const RecordModal: React.FC<RecordModalProps> = ({
  kind,
  isNew,
  shareRecord,
  roleRecord,
  people,
  existingRoles,
  basic,
  setup,
  onSave,
  onDelete,
  onClose,
  onPreviewFile,
}) => {
  const gov = basic || setup;
  const hasDirector = gov
    ? gov.board === '设董事会' ||
      gov.singleDirector === '设 1 名董事' ||
      gov.singleDirector === '设1名董事' ||
      gov.singleDirector === '董事'
    : false;

  const hasSupervisor = gov
    ? gov.singleSupervisor === '设 1 名监事' ||
      gov.singleSupervisor === '设1名监事' ||
      gov.singleSupervisor === '一名监事'
    : false;

  const dynamicRolesList = ['法定代表人', '财务负责人', '联系人', '总经理'];
  if (hasDirector) dynamicRolesList.push('董事');
  if (hasSupervisor) dynamicRolesList.push('监事');
  // Current edited record
  const [currentShare, setCurrentShare] = useState<ShareholderRecord>(() => {
    if (shareRecord) return { ...shareRecord, method: [...(shareRecord.method || ['货币'])] };
    return {
      id: uid(),
      type: '自然人',
      personId: null,
      name: '',
      code: '',
      ratio: '',
      amount: '',
      method: ['货币'],
      files: [],
    };
  });

  const [currentRole, setCurrentRole] = useState<RoleRecord>(() => {
    if (roleRecord) return { ...roleRecord, roles: [...roleRecord.roles] };
    return {
      id: uid(),
      personId: '',
      roles: [],
    };
  });

  // Natural person state
  const isNatural = kind === 'role' || currentShare.type === '自然人';

  const [linked, setLinked] = useState<boolean>(() => {
    if (kind === 'share') {
      return Boolean(shareRecord?.personId && people[shareRecord.personId]);
    }
    return Boolean(roleRecord?.personId && people[roleRecord.personId]);
  });

  const [currentPerson, setCurrentPerson] = useState<PersonRecord>(() => {
    const existingPersonId = kind === 'share' ? shareRecord?.personId : roleRecord?.personId;
    if (existingPersonId && people[existingPersonId]) {
      return { ...people[existingPersonId], files: [...(people[existingPersonId].files || [])] };
    }
    return {
      id: uid(),
      name: '',
      phone: '',
      email: '',
      education: '大学本科',
      address: '',
      files: [],
    };
  });

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Pick list of existing people to reuse
  const allPeople = Object.values(people) as PersonRecord[];
  const selectablePeople = allPeople.filter((p) => p.name.trim().length > 0);

  const handleSelectPerson = (p: PersonRecord) => {
    setCurrentPerson({ ...p, files: [...(p.files || [])] });
    setLinked(true);
    if (kind === 'share') {
      setCurrentShare((prev) => ({ ...prev, personId: p.id }));
    } else {
      setCurrentRole((prev) => ({ ...prev, personId: p.id }));
    }
  };

  const handleDetachPerson = () => {
    setLinked(false);
    const clone = { ...currentPerson, id: uid() };
    setCurrentPerson(clone);
    if (kind === 'share') {
      setCurrentShare((prev) => ({ ...prev, personId: clone.id }));
    } else {
      setCurrentRole((prev) => ({ ...prev, personId: clone.id }));
    }
  };

  // Upload/Remove photos
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, slot: 'idFront' | 'idBack' | 'license') => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];

    const reader = new FileReader();
    reader.onload = () => {
      const newFile: FileAttachment = {
        id: uid(),
        name: file.name,
        size: file.size,
        type: file.type,
        data: (reader.result as string) || '',
        slot,
      };

      if (isNatural) {
        const filtered = (currentPerson.files || []).filter((f) => f.slot !== slot);
        setCurrentPerson({ ...currentPerson, files: [...filtered, newFile] });
      } else {
        const filtered = (currentShare.files || []).filter((f) => f.slot !== slot);
        setCurrentShare({ ...currentShare, files: [...filtered, newFile] });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = (slot: 'idFront' | 'idBack' | 'license') => {
    if (isNatural) {
      setCurrentPerson({
        ...currentPerson,
        files: (currentPerson.files || []).filter((f) => f.slot !== slot),
      });
    } else {
      setCurrentShare({
        ...currentShare,
        files: (currentShare.files || []).filter((f) => f.slot !== slot),
      });
    }
  };

  const toggleMethod = (method: string) => {
    const current = currentShare.method || [];
    if (current.includes(method)) {
      if (current.length === 1) return;
      setCurrentShare({ ...currentShare, method: current.filter((m) => m !== method) });
    } else {
      setCurrentShare({ ...currentShare, method: [...current, method] });
    }
  };

  const toggleRole = (r: string) => {
    const current = currentRole.roles || [];
    if (current.includes(r)) {
      setErrorMsg(null);
      setCurrentRole({ ...currentRole, roles: current.filter((x) => x !== r) });
    } else {
      if (r === '监事') {
        const conflicts = current.filter((x) => ['董事', '法定代表人', '总经理', '财务负责人'].includes(x));
        if (conflicts.length > 0) {
          setErrorMsg(`依据《公司法》规定，监事不得兼任【${conflicts.join('、')}】职务`);
          return;
        }
      } else if (['董事', '法定代表人', '总经理', '财务负责人'].includes(r) && current.includes('监事')) {
        setErrorMsg('依据《公司法》规定，董事及高级管理人员不得兼任【监事】职务');
        return;
      }
      setErrorMsg(null);
      setCurrentRole({ ...currentRole, roles: [...current, r] });
    }
  };

  const handleSave = () => {
    setErrorMsg(null);

    if (isNatural) {
      if (!currentPerson.name.trim()) {
        setErrorMsg('请填写真实姓名');
        return;
      }
      if (!currentPerson.phone.trim()) {
        setErrorMsg('请填写联系电话');
        return;
      }
      if (!currentPerson.address.trim()) {
        setErrorMsg('请填写完整居住地址');
        return;
      }
    } else if (currentShare.type === '企业') {
      if (!currentShare.name.trim()) {
        setErrorMsg('请填写企业全称');
        return;
      }
      if (!currentShare.code.trim()) {
        setErrorMsg('请填写统一社会信用代码');
        return;
      }
    } else {
      if (!currentShare.name.trim()) {
        setErrorMsg('请填写股东说明');
        return;
      }
    }

    if (kind === 'share') {
      const ratioNum = Number(currentShare.ratio);
      if (!currentShare.ratio || isNaN(ratioNum) || ratioNum <= 0 || ratioNum > 100) {
        setErrorMsg('出资比例需大于 0 且不超过 100%');
        return;
      }
      if (currentShare.amount && (isNaN(Number(currentShare.amount)) || Number(currentShare.amount) < 0)) {
        setErrorMsg('出资金额需为非负数字');
        return;
      }
    } else {
      if (!currentRole.roles || currentRole.roles.length === 0) {
        setErrorMsg('请至少选择一个人员角色');
        return;
      }
    }

    onSave({
      kind,
      isNew,
      record: kind === 'share' ? currentShare : currentRole,
      person: isNatural ? currentPerson : undefined,
      linked,
    });
  };

  const modalTitle = isNew
    ? `添加${kind === 'share' ? currentShare.type + '股东' : '企业主要人员'}`
    : `编辑${kind === 'share' ? currentShare.type + '股东' : '企业主要人员'}`;

  const currentFiles = isNatural ? currentPerson.files : currentShare.files;
  const frontFile = currentFiles.find((f) => f.slot === 'idFront');
  const backFile = currentFiles.find((f) => f.slot === 'idBack');
  const licenseFile = currentFiles.find((f) => f.slot === 'license');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden my-8 flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-base font-bold text-slate-800">{modalTitle}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-slate-800 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-600 font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Reuse existing person option */}
          {isNatural && selectablePeople.length > 0 && (
            <div className="p-3.5 rounded-xl bg-[#F8FCFB] border border-slate-200/80 space-y-2">
              <div className="text-xs font-bold text-slate-600">复用已录入人员信息（免重复上传证件）</div>
              <div className="flex flex-wrap gap-2">
                {selectablePeople.map((p) => {
                  const isSelected = linked && currentPerson.id === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectPerson(p)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#E6F7F2] border-[#36B39E] text-[#1D6C5E] shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span>{p.name}</span>
                      {p.phone && (
                        <span className="text-slate-400 ml-1 font-normal">
                          ({p.phone.slice(-4)})
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {linked && (
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-200/60 mt-2">
                  <span>已关联已有人员，基本信息与身份证件照片自动同步。</span>
                  <button
                    type="button"
                    onClick={handleDetachPerson}
                    className="text-[#2AA894] font-bold hover:underline cursor-pointer"
                  >
                    解除关联改为独立填写
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Natural Person Fields */}
          {isNatural && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  姓名 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={currentPerson.name}
                  readOnly={linked}
                  onChange={(e) => setCurrentPerson({ ...currentPerson, name: e.target.value })}
                  placeholder="真实姓名（与身份证一致）"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-800 focus:border-[#36B39E] focus:ring-2 focus:ring-[#E6F7F2] outline-none read-only:bg-slate-50 read-only:text-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  联系电话 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  value={currentPerson.phone}
                  readOnly={linked}
                  onChange={(e) => setCurrentPerson({ ...currentPerson, phone: e.target.value })}
                  placeholder="大陆 11 位手机号码"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-800 focus:border-[#36B39E] focus:ring-2 focus:ring-[#E6F7F2] outline-none read-only:bg-slate-50 read-only:text-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  电子邮箱 <span className="text-slate-400 font-normal">选填</span>
                </label>
                <input
                  type="email"
                  value={currentPerson.email}
                  readOnly={linked}
                  onChange={(e) => setCurrentPerson({ ...currentPerson, email: e.target.value })}
                  placeholder="name@example.com"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-800 focus:border-[#36B39E] focus:ring-2 focus:ring-[#E6F7F2] outline-none read-only:bg-slate-50 read-only:text-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  最高学历 <span className="text-slate-400 font-normal">选填</span>
                </label>
                <select
                  value={currentPerson.education}
                  disabled={linked}
                  onChange={(e) => setCurrentPerson({ ...currentPerson, education: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-800 focus:border-[#36B39E] focus:ring-2 focus:ring-[#E6F7F2] outline-none disabled:bg-slate-50 disabled:text-slate-500 cursor-pointer"
                >
                  {EDUCATION_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  居住地址 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={currentPerson.address}
                  readOnly={linked}
                  onChange={(e) => setCurrentPerson({ ...currentPerson, address: e.target.value })}
                  placeholder="省 / 市 / 区 / 街道门牌号（与身份证或实际住址一致）"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-800 focus:border-[#36B39E] focus:ring-2 focus:ring-[#E6F7F2] outline-none read-only:bg-slate-50 read-only:text-slate-500"
                />
              </div>
            </div>
          )}

          {/* Enterprise Fields */}
          {!isNatural && currentShare.type === '企业' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  企业全称 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={currentShare.name}
                  onChange={(e) => setCurrentShare({ ...currentShare, name: e.target.value })}
                  placeholder="请输入营业执照上的完整企业名称"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-800 focus:border-[#36B39E] focus:ring-2 focus:ring-[#E6F7F2] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  统一社会信用代码 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={currentShare.code}
                  onChange={(e) => setCurrentShare({ ...currentShare, code: e.target.value })}
                  placeholder="18 位统一社会信用代码"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-800 focus:border-[#36B39E] focus:ring-2 focus:ring-[#E6F7F2] outline-none font-mono"
                />
              </div>
            </div>
          )}

          {/* Other Shareholder Fields */}
          {!isNatural && currentShare.type === '其他' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                股东说明 <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={currentShare.name}
                onChange={(e) => setCurrentShare({ ...currentShare, name: e.target.value })}
                rows={3}
                placeholder="说明股东性质（如事业单位、社会团体、外资分支机构等）"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-800 focus:border-[#36B39E] focus:ring-2 focus:ring-[#E6F7F2] outline-none"
              />
            </div>
          )}

          {/* Shareholder-specific Fields */}
          {kind === 'share' && (
            <div className="space-y-4 pt-3 border-t border-slate-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    出资比例 (%) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max="100"
                    value={currentShare.ratio}
                    onChange={(e) => setCurrentShare({ ...currentShare, ratio: e.target.value })}
                    placeholder="例如：60"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-800 focus:border-[#36B39E] focus:ring-2 focus:ring-[#E6F7F2] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    认缴出资金额（万元） <span className="text-slate-400 font-normal">选填</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={currentShare.amount}
                    onChange={(e) => setCurrentShare({ ...currentShare, amount: e.target.value })}
                    placeholder="例如：60"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-800 focus:border-[#36B39E] focus:ring-2 focus:ring-[#E6F7F2] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  出资形式 <span className="text-rose-500">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {CONTRIBUTION_METHODS.map((m) => {
                    const isChecked = (currentShare.method || []).includes(m);
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => toggleMethod(m)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                          isChecked
                            ? 'bg-[#E6F7F2] border-[#36B39E] text-[#1D6C5E]'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {isChecked ? `✓ ${m}` : m}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Role-specific Fields */}
          {kind === 'role' && (
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700">
                  担任企业角色职务（可多选） <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] text-slate-400">已根据治理设立联动配置</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {dynamicRolesList.map((r) => {
                  const isChecked = (currentRole.roles || []).includes(r);
                  const isRequired =
                    ['法定代表人', '财务负责人', '联系人'].includes(r) ||
                    (r === '董事' && hasDirector) ||
                    (r === '监事' && hasSupervisor);

                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => toggleRole(r)}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        isChecked
                          ? 'border-[#36B39E] bg-[#E6F7F2] text-[#1D6C5E] font-bold shadow-2xs'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="text-xs font-bold flex items-center justify-center gap-1">
                        <span>{isChecked ? `✓ ${r}` : r}</span>
                        {isRequired && <span className="text-rose-500 text-xs">*</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-400">
                * 注：依据《公司法》规定，董事、高级管理人员（法定代表人、总经理、财务负责人）不得兼任监事。
              </p>
            </div>
          )}

          {/* Photo & Attachment Uploads */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <h3 className="text-xs font-bold text-slate-800">证件及证明材料照片（提交初审前需上传完整）</h3>

            {/* Natural Person ID Cards */}
            {isNatural && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Front Photo */}
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <span>身份证人像面（正面）</span>
                    <span className="text-[11px] text-slate-400">{frontFile ? '已上传' : '待上传'}</span>
                  </div>

                  {frontFile ? (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-800 truncate">{frontFile.name}</div>
                        <div className="text-[11px] text-slate-400">{formatSize(frontFile.size)}</div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => onPreviewFile(frontFile)}
                          className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        >
                          预览
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto('idFront')}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="border-2 border-dashed border-slate-200 hover:border-[#36B39E] rounded-xl bg-[#F8FCFB] hover:bg-[#E6F7F2]/40 p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all group relative">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handlePhotoUpload(e, 'idFront')}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                      <Upload className="w-4 h-4 text-slate-400 group-hover:text-[#36B39E] mb-1" />
                      <span className="text-xs font-bold text-slate-700 group-hover:text-[#1D6C5E]">
                        ＋ 上传人像面
                      </span>
                      <span className="text-[10px] text-slate-400 mt-0.5">支持 JPG / PNG 照片</span>
                    </label>
                  )}
                </div>

                {/* Back Photo */}
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <span>身份证国徽面（背面）</span>
                    <span className="text-[11px] text-slate-400">{backFile ? '已上传' : '待上传'}</span>
                  </div>

                  {backFile ? (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-800 truncate">{backFile.name}</div>
                        <div className="text-[11px] text-slate-400">{formatSize(backFile.size)}</div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => onPreviewFile(backFile)}
                          className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        >
                          预览
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto('idBack')}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="border-2 border-dashed border-slate-200 hover:border-[#36B39E] rounded-xl bg-[#F8FCFB] hover:bg-[#E6F7F2]/40 p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all group relative">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handlePhotoUpload(e, 'idBack')}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                      <Upload className="w-4 h-4 text-slate-400 group-hover:text-[#36B39E] mb-1" />
                      <span className="text-xs font-bold text-slate-700 group-hover:text-[#1D6C5E]">
                        ＋ 上传国徽面
                      </span>
                      <span className="text-[10px] text-slate-400 mt-0.5">支持 JPG / PNG 照片</span>
                    </label>
                  )}
                </div>
              </div>
            )}

            {/* Document Grid for Enterprise */}
            {!isNatural && currentShare.type === '企业' && (
              <div className="space-y-1.5 max-w-sm">
                <div className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                  <span>加盖公章营业执照</span>
                  <span className="text-[11px] text-slate-400">{licenseFile ? '已上传' : '待上传'}</span>
                </div>

                {licenseFile ? (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-800 truncate">{licenseFile.name}</div>
                      <div className="text-[11px] text-slate-400">{formatSize(licenseFile.size)}</div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => onPreviewFile(licenseFile)}
                        className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        预览
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto('license')}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-slate-200 hover:border-[#36B39E] rounded-xl bg-[#F8FCFB] hover:bg-[#E6F7F2]/40 p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all group relative">
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => handlePhotoUpload(e, 'license')}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <Upload className="w-4 h-4 text-slate-400 group-hover:text-[#36B39E] mb-1" />
                    <span className="text-xs font-bold text-slate-700 group-hover:text-[#1D6C5E]">
                      ＋ 上传营业执照照片
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5">加盖企业公章复印件或原件扫描</span>
                  </label>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between gap-4 sticky bottom-0">
          <div>
            {!isNew && onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              >
                删除记录
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-full border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition-all cursor-pointer"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-6 py-2 rounded-full bg-[#36B39E] hover:bg-[#2AA894] text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              保存记录
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
