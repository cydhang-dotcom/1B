/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, User, Building2, Landmark } from 'lucide-react';

interface ShareholderTypeModalProps {
  onSelect: (type: '自然人' | '企业' | '其他') => void;
  onClose: () => void;
}

export const ShareholderTypeModal: React.FC<ShareholderTypeModalProps> = ({ onSelect, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800">选择股东类型</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          <p className="text-xs text-slate-500 mb-4">
            请选择拟添加的股东形态，随后可录入出资比例、出资金额及主体证明材料。
          </p>

          <div className="grid grid-cols-3 gap-3">
            {[
              { type: '自然人' as const, icon: User, title: '自然人', desc: '个人股东' },
              { type: '企业' as const, icon: Building2, title: '企业', desc: '公司法人' },
              { type: '其他' as const, icon: Landmark, title: '其他', desc: '机构/组织' },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => onSelect(item.type)}
                  className="p-4 rounded-xl border border-slate-200/80 hover:border-[#36B39E] bg-white hover:bg-[#F8FCFB] transition-all text-center group cursor-pointer shadow-2xs"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#E6F7F2] text-[#1D6C5E] flex items-center justify-center mx-auto mb-2 group-hover:scale-105 transition-transform">
                    <Icon className="w-5 h-5" />
                  </div>
                  <strong className="block text-xs font-bold text-slate-800 mb-0.5">
                    {item.title}
                  </strong>
                  <span className="text-[10px] text-slate-400 font-medium">{item.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/70 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-1.5 rounded-full border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold cursor-pointer transition-all"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
};
