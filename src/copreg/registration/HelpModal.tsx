/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, HelpCircle, ShieldCheck, FileCheck, Users, Building, FileText, MessageSquare, QrCode, Phone, CheckCircle2 } from 'lucide-react';

interface HelpModalProps {
  onResetToDemo: () => void;
  onClose: () => void;
  onOpenWecom?: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({
  onResetToDemo,
  onClose,
  onOpenWecom,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#E6F7F2] text-[#36B39E] flex items-center justify-center">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">企业注册填报须知与申报规范</h2>
              <p className="text-[11px] text-slate-400">政务合规标准 · 依据新《公司法》及市监局申报要求</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-600 leading-relaxed">
          {/* Dedicated Consultant Card inside Help Modal */}
          <div className="p-4 rounded-xl border border-emerald-200/90 bg-gradient-to-r from-[#F0FDF4] via-white to-[#F0FDF9] shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#2AA894] to-[#36B39E] text-white flex items-center justify-center shadow-xs shrink-0">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-slate-800">专属顾问：李经理</span>
                    <span className="text-[10px] text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded border border-emerald-200 font-medium">
                      企业微信官方认证
                    </span>
                    <span className="text-[11px] text-slate-400">（工号：BB-8029）</span>
                  </div>
                  <p className="text-slate-600 mt-1 leading-relaxed">
                    填报过程中如对企业名称排查、经营范围、出资比例、董事监事设置或场地证明材料有疑问，顾问可全程专人协同代填与合规预审。
                  </p>
                  <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3 text-[#2AA894]" /> 企服专线：0755-8828 0192
                    </span>
                    <span>· 服务时间：工作日 09:00 - 18:30</span>
                  </div>
                </div>
              </div>

              {onOpenWecom && (
                <div className="shrink-0 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenWecom();
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white hover:bg-emerald-50 text-[#1D6C5E] text-xs font-semibold border border-emerald-200 shadow-2xs transition-colors cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5 text-[#2AA894]" />
                    <span>微信扫码咨询</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Item 1 */}
          <div className="p-4 rounded-xl border border-slate-100 bg-[#F8FCFB] space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-slate-800 text-xs sm:text-sm">
              <Building className="w-4 h-4 text-[#36B39E]" />
              <span>企业名称与经营范围规范</span>
            </div>
            <p>
              建议提供 3 个以上备选字号（按偏好顺序排列），避免包含与知名品牌同音、禁用词或已被注册的名称。经营范围将由系统与专属顾问结合市监局规范库进行标准化匹配。
            </p>
          </div>

          {/* Item 2 */}
          <div className="p-4 rounded-xl border border-slate-100 bg-white space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-slate-800 text-xs sm:text-sm">
              <Users className="w-4 h-4 text-[#36B39E]" />
              <span>股东与主要人员身份证明</span>
            </div>
            <p>
              自然人股东及主要人员需提供有效期内的二代身份证原件正反面照片；法人股东需提供加盖企业公章的最新营业执照复印件。系统支持一键复用已录入的人员信息，无需重复上传。
            </p>
          </div>

          {/* Item 3 */}
          <div className="p-4 rounded-xl border border-slate-100 bg-[#F8FCFB] space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-slate-800 text-xs sm:text-sm">
              <FileCheck className="w-4 h-4 text-[#36B39E]" />
              <span>法定代表人委托书办理</span>
            </div>
            <p>
              刻章及经办备案需法定代表人授权委托书。系统已自动生成合规 A4 文本，您可在线预览、直接打印或下载后由法定代表人亲笔签名并加盖公章（新设企业免章面签），再拍照上传即可。
            </p>
          </div>

          {/* Table */}
          <div className="border border-slate-200/80 rounded-xl overflow-hidden text-xs">
            <div className="bg-slate-50 px-3.5 py-2 font-bold text-slate-700 border-b border-slate-200/80">
              关键申报要素校验清单
            </div>
            <div className="divide-y divide-slate-100">
              <div className="p-3 flex justify-between gap-4">
                <span className="font-semibold text-slate-800 w-24 shrink-0">法定代表人</span>
                <span className="text-slate-500 flex-1">不得为失信被执行人或工商黑名单人员；可兼任总经理或执行董事。</span>
              </div>
              <div className="p-3 flex justify-between gap-4 bg-slate-50/50">
                <span className="font-semibold text-slate-800 w-24 shrink-0">财务负责人</span>
                <span className="text-slate-500 flex-1">需具有独立中国大陆手机号与身份证，不可与监事兼任。</span>
              </div>
              <div className="p-3 flex justify-between gap-4">
                <span className="font-semibold text-slate-800 w-24 shrink-0">监事设置</span>
                <span className="text-slate-500 flex-1">依据新《公司法》，规模较小且全体股东一致同意的可不设监事。</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <button
            type="button"
            onClick={onResetToDemo}
            className="text-xs font-semibold text-[#1D6C5E] hover:underline cursor-pointer"
          >
            载入合规示例数据
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-full bg-[#36B39E] hover:bg-[#2AA894] text-white text-xs font-bold transition-colors cursor-pointer"
          >
            我知道了
          </button>
        </div>
      </div>
    </div>
  );
};
