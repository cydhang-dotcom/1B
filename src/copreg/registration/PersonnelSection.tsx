/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { RoleRecord, PersonRecord, BasicInfoData } from './types';
import { ChevronRight, Plus, AlertTriangle, UserCheck, ShieldCheck, ExternalLink } from 'lucide-react';

interface PersonnelSectionProps {
  roles: RoleRecord[];
  people: Record<string, PersonRecord>;
  basic?: BasicInfoData;
  onAddPersonnel: () => void;
  onEditPersonnel: (id: string) => void;
  onGoBasic?: () => void;
  errors: Record<string, string>;
}

export const PersonnelSection: React.FC<PersonnelSectionProps> = ({
  roles,
  people,
  basic,
  onAddPersonnel,
  onEditPersonnel,
  onGoBasic,
  errors,
}) => {
  const assignedRoles = roles.flatMap((r) => r.roles);

  const hasDirector = basic
    ? basic.board === '设董事会' ||
      basic.singleDirector === '设 1 名董事' ||
      basic.singleDirector === '设1名董事' ||
      basic.singleDirector === '董事'
    : false;

  const hasGeneralManagerExercising = basic
    ? basic.board === '不设董事会' &&
      (basic.singleDirector?.includes('总经理') ||
       basic.singleDirector?.includes('代行') ||
       basic.singleDirector?.includes('经理') ||
       !hasDirector)
    : true;

  const hasSupervisor = basic
    ? basic.singleSupervisor === '设 1 名监事' ||
      basic.singleSupervisor === '设1名监事' ||
      basic.singleSupervisor === '一名监事'
    : false;

  const ALL_ROLES = ['法定代表人', '财务负责人', '联系人', '总经理'];
  if (hasDirector) ALL_ROLES.push('董事');
  if (hasSupervisor) ALL_ROLES.push('监事');

  const REQUIRED_ROLES = ['法定代表人', '财务负责人', '联系人'];
  if (hasDirector) REQUIRED_ROLES.push('董事');
  if (hasGeneralManagerExercising) REQUIRED_ROLES.push('总经理');
  if (hasSupervisor) REQUIRED_ROLES.push('监事');

  const getPerson = (r: RoleRecord): PersonRecord => {
    return (
      people[r.personId] || {
        id: r.personId,
        name: '未填写姓名',
        phone: '未填写联系电话',
        email: '',
        education: '',
        address: '',
        files: [],
      }
    );
  };

  const getAttachmentBadge = (p: PersonRecord) => {
    const files = p.files || [];
    const hasFront = files.some((f) => f.slot === 'idFront');
    const hasBack = files.some((f) => f.slot === 'idBack');
    if (hasFront && hasBack) {
      return <span className="text-[11px] text-[#1D6C5E] font-medium">身份证照片齐备</span>;
    }
    if (hasFront || hasBack) {
      return <span className="text-[11px] text-amber-600 font-medium">身份证照片待补齐</span>;
    }
    return <span className="text-[11px] text-amber-600 font-medium">未上传身份证照片</span>;
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl p-5 sm:p-6 border border-slate-200/80 bg-white shadow-2xs">
        <div className="flex items-start justify-between gap-4 mb-4 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-1.5">
              <span>企业主要管理人员</span>
              <span className="text-rose-500 font-bold">*</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              可一键复用已有自然人股东，也可录入新人员，分配法定代表人、财务负责人与办税联系人等职责。
            </p>
          </div>
          <span className="text-xs font-bold text-[#2AA894] bg-[#E6F7F2] px-2.5 py-0.5 rounded-full">
            01
          </span>
        </div>

        {/* Governance Linkage Notice Banner */}
        <div className="mb-4 p-3 rounded-xl bg-slate-50/90 border border-slate-200/80 text-xs text-slate-700 flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-[#2AA894] shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-800">治理架构联动配置：</span>
              {hasDirector ? (
                <span className="text-[#1D6C5E] font-medium ml-1">
                  设立董事（必选*）·
                </span>
              ) : (
                <span className="text-slate-600 font-medium ml-1">
                  不设董事会，由总经理代行职权（需设总经理*，不设董事）·
                </span>
              )}
              {hasSupervisor ? (
                <span className="text-[#1D6C5E] font-medium ml-1">
                  设立 1 名监事（必选*）
                </span>
              ) : (
                <span className="text-slate-600 font-medium ml-1">
                  不设监事（全体股东一致同意）
                </span>
              )}
            </div>
          </div>
          {onGoBasic && (
            <button
              type="button"
              onClick={onGoBasic}
              className="text-[11px] font-bold text-[#2AA894] hover:text-[#1D6C5E] inline-flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <span>修改基本信息设置</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Global errors for roles */}
        {errors['roles'] && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-600 font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errors['roles']}</span>
          </div>
        )}

        {/* Role Pills Status Bar */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-5 pb-4 border-b border-slate-100">
          {ALL_ROLES.map((roleName) => {
            const isAssigned = assignedRoles.includes(roleName);
            const isReq = REQUIRED_ROLES.includes(roleName);
            return (
              <div
                key={roleName}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all select-none ${
                  isAssigned
                    ? 'bg-[#E6F7F2] text-[#1D6C5E] border border-[#2AA894]/30 shadow-2xs'
                    : isReq
                    ? 'bg-amber-50/70 text-amber-800 border border-amber-200'
                    : 'bg-slate-50 text-slate-500 border border-slate-200/80'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isAssigned ? 'bg-[#36B39E]' : isReq ? 'bg-amber-400' : 'bg-slate-300'
                  }`}
                />
                <span>
                  {isAssigned ? `✓ ${roleName}` : roleName}
                  {isReq && <span className="text-rose-500 ml-0.5">*</span>}
                </span>
              </div>
            );
          })}
        </div>

        {/* Personnel Records */}
        {roles.length > 0 ? (
          <div className="space-y-3">
            {roles.map((r) => {
              const p = getPerson(r);
              const cardError = errors[`role-${r.id}`];

              return (
                <div key={r.id}>
                  <button
                    type="button"
                    onClick={() => onEditPersonnel(r.id)}
                    className={`w-full text-left p-4 rounded-xl border transition-all flex items-center gap-4 cursor-pointer group ${
                      cardError
                        ? 'border-rose-300 bg-rose-50/30 hover:bg-rose-50/60'
                        : 'border-slate-200 bg-white hover:border-[#36B39E] hover:bg-[#F8FCFB] shadow-2xs'
                    }`}
                  >
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-xl bg-[#E6F7F2] border border-[#2AA894]/20 text-[#1D6C5E] flex items-center justify-center font-bold text-sm shrink-0 group-hover:scale-105 transition-transform">
                      {p.name.slice(0, 1) || '人'}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="font-bold text-slate-800 text-sm truncate">{p.name}</span>
                        {r.roles.map((role) => (
                          <span
                            key={role}
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E6F7F2] text-[#1D6C5E] border border-[#2AA894]/30"
                          >
                            {role}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 truncate">
                        <span>{p.phone || '未填写联系电话'}</span>
                        <span>·</span>
                        {getAttachmentBadge(p)}
                      </div>
                    </div>

                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#2AA894] transition-colors shrink-0" />
                  </button>

                  {cardError && (
                    <p className="text-xs text-rose-500 mt-1 ml-2 font-medium">{cardError}</p>
                  )}
                </div>
              );
            })}

            <div className="flex justify-center pt-3">
              <button
                type="button"
                onClick={onAddPersonnel}
                className="px-5 py-2 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 hover:border-slate-300 transition-all shadow-2xs cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5 text-[#36B39E]" />
                <span>添加主要人员</span>
              </button>
            </div>
          </div>
        ) : (
          /* Empty State */
          <div className="py-10 text-center">
            <div className="w-12 h-12 rounded-xl bg-[#E6F7F2] text-[#2AA894] flex items-center justify-center mx-auto mb-3">
              <UserCheck className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800 mb-1">尚未设置企业主要人员</h3>
            <p className="text-xs text-slate-500 mb-5">
              请添加人员并指定法定代表人、财务负责人与联系人。
            </p>
            <button
              type="button"
              onClick={onAddPersonnel}
              className="px-6 py-2 rounded-full bg-[#36B39E] hover:bg-[#2AA894] text-white text-xs font-bold shadow-sm transition-all cursor-pointer inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>添加人员</span>
            </button>
          </div>
        )}

        <div className="mt-5 pt-3.5 border-t border-slate-100 text-xs text-slate-400 space-y-1">
          <div>💡 同一人员可兼任多个角色（例如法定代表人可同时兼任董事、总经理或联系人）。</div>
          <div>⚠️ 法规提示：依据《公司法》第七十四条及第八十三条规定，董事、高级管理人员（经理、财务负责人）不得兼任监事职务。</div>
        </div>
      </div>
    </div>
  );
};
