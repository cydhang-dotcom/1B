/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ShareholderRecord, PersonRecord, FileAttachment } from './types';
import { ChevronRight, Plus, AlertTriangle, Users } from 'lucide-react';

interface ShareholderSectionProps {
  shareholders: ShareholderRecord[];
  people: Record<string, PersonRecord>;
  onAddShareholder: () => void;
  onEditShareholder: (id: string) => void;
  errors: Record<string, string>;
}

export const ShareholderSection: React.FC<ShareholderSectionProps> = ({
  shareholders,
  people,
  onAddShareholder,
  onEditShareholder,
  errors,
}) => {
  const totalRatio = shareholders.reduce((sum, s) => sum + (Number(s.ratio) || 0), 0);

  const getTitle = (s: ShareholderRecord): string => {
    if (s.type === '自然人' && s.personId && people[s.personId]) {
      return people[s.personId].name || '未填写姓名';
    }
    return s.name || (s.type === '企业' ? '未填写企业全称' : '未填写股东说明');
  };

  const getSub = (s: ShareholderRecord): string => {
    if (s.type === '自然人' && s.personId && people[s.personId]) {
      return people[s.personId].phone || '未填写联系电话';
    }
    if (s.type === '企业') {
      return s.code ? `统一代码：${s.code}` : '未填写证件号码';
    }
    return '其他类型股东';
  };

  const getFiles = (s: ShareholderRecord): FileAttachment[] => {
    if (s.type === '自然人' && s.personId && people[s.personId]) {
      return people[s.personId].files || [];
    }
    return s.files || [];
  };

  const getAttachmentBadge = (s: ShareholderRecord) => {
    const files = getFiles(s);
    if (s.type === '自然人') {
      const hasFront = files.some((f) => f.slot === 'idFront');
      const hasBack = files.some((f) => f.slot === 'idBack');
      if (hasFront && hasBack) {
        return <span className="text-[11px] text-[#1D6C5E] font-medium">身份证照片齐备</span>;
      }
      if (hasFront || hasBack) {
        return <span className="text-[11px] text-amber-600 font-medium">身份证照片待补齐</span>;
      }
      return <span className="text-[11px] text-amber-600 font-medium">未上传身份证照片</span>;
    }
    if (s.type === '企业') {
      const hasLicense = files.some((f) => f.slot === 'license');
      if (hasLicense) {
        return <span className="text-[11px] text-[#1D6C5E] font-medium">营业执照已上传</span>;
      }
      return <span className="text-[11px] text-amber-600 font-medium">待上传营业执照</span>;
    }
    return files.length > 0 ? (
      <span className="text-[11px] text-slate-500 font-medium">资料 {files.length} 份</span>
    ) : (
      <span className="text-[11px] text-slate-400 font-medium">未附资料</span>
    );
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl p-5 sm:p-6 border border-slate-200/80 bg-white shadow-2xs">
        <div className="flex items-start justify-between gap-4 mb-4 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-1.5">
              <span>股东及出资结构</span>
              <span className="text-rose-500 font-bold">*</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {shareholders.length > 0
                ? '点击股东卡片可修改基本资料与证件照片，支持自然人、法人企业及其他股东形态。'
                : '请添加至少 1 位股东并明确出资方式与持股比例。'}
            </p>
          </div>
          <span className="text-xs font-bold text-[#2AA894] bg-[#E6F7F2] px-2.5 py-0.5 rounded-full">
            01
          </span>
        </div>

        {/* Global errors for shareholders */}
        {errors['shareholders'] && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-600 font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errors['shareholders']}</span>
          </div>
        )}

        {/* Stats Strip */}
        {shareholders.length > 0 && (
          <div className="flex flex-wrap items-center gap-6 p-3.5 rounded-xl bg-[#F8FCFB] border border-slate-100 text-xs font-medium text-slate-600 mb-4">
            <div>
              <span>股东人数：</span>
              <strong className="text-slate-900 text-sm font-bold ml-1">{shareholders.length}</strong>
              <span className="text-slate-400 ml-1">人 / 家</span>
            </div>
            <div className="h-3 w-px bg-slate-200 hidden sm:block" />
            <div>
              <span>出资比例合计：</span>
              <strong className={`text-sm font-bold ml-1 ${totalRatio === 100 ? 'text-[#1D6C5E]' : 'text-slate-900'}`}>
                {Number(totalRatio.toFixed(4))}
              </strong>
              <span className="text-slate-400 ml-1">%</span>
              {totalRatio !== 100 && (
                <span className="ml-2 text-[11px] text-amber-600 font-normal">（设立提交前需合计为 100%）</span>
              )}
            </div>
          </div>
        )}

        {/* Shareholder Records List */}
        {shareholders.length > 0 ? (
          <div className="space-y-3">
            {shareholders.map((s) => {
              const cardError = errors[`share-${s.id}`];
              return (
                <div key={s.id}>
                  <button
                    type="button"
                    onClick={() => onEditShareholder(s.id)}
                    className={`w-full text-left p-4 rounded-xl border transition-all flex items-center gap-4 cursor-pointer group ${
                      cardError
                        ? 'border-rose-300 bg-rose-50/30 hover:bg-rose-50/60'
                        : 'border-slate-200 bg-white hover:border-[#36B39E] hover:bg-[#F8FCFB] shadow-2xs'
                    }`}
                  >
                    {/* Avatar Badge */}
                    <div className="w-10 h-10 rounded-xl bg-[#E6F7F2] border border-[#2AA894]/20 text-[#1D6C5E] flex items-center justify-center font-bold text-sm shrink-0 group-hover:scale-105 transition-transform">
                      {s.type === '自然人' ? getTitle(s).slice(0, 1) || '人' : s.type === '企业' ? '企' : '其'}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="font-bold text-slate-800 text-sm truncate">
                          {getTitle(s)}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/80">
                          {s.type}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 truncate">
                        <span>{getSub(s)}</span>
                        <span>·</span>
                        {getAttachmentBadge(s)}
                      </div>
                    </div>

                    {/* Ratio Side */}
                    <div className="text-right shrink-0">
                      <span className="text-sm sm:text-base font-black text-slate-900">
                        {s.ratio ? `${s.ratio}%` : '—'}
                      </span>
                      <small className="block text-[10px] text-slate-400 font-medium">出资比例</small>
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
                onClick={onAddShareholder}
                className="px-5 py-2 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 hover:border-slate-300 transition-all shadow-2xs cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5 text-[#36B39E]" />
                <span>添加股东</span>
              </button>
            </div>
          </div>
        ) : (
          /* Empty State */
          <div className="py-10 text-center">
            <div className="w-12 h-12 rounded-xl bg-[#E6F7F2] text-[#2AA894] flex items-center justify-center mx-auto mb-3">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800 mb-1">尚未添加股东</h3>
            <p className="text-xs text-slate-500 mb-5">
              请添加至少 1 位股东，明确出资额及持股比例。
            </p>
            <button
              type="button"
              onClick={onAddShareholder}
              className="px-6 py-2 rounded-full bg-[#36B39E] hover:bg-[#2AA894] text-white text-xs font-bold shadow-sm transition-all cursor-pointer inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>添加股东</span>
            </button>
          </div>
        )}

        <div className="mt-5 pt-3.5 border-t border-slate-100 text-xs text-slate-400">
          💡 股东二代身份证正反面照片可稍后补全，提交初审前需上传完整。
        </div>
      </div>
    </div>
  );
};
