/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, ShieldCheck, AlertCircle } from 'lucide-react';

interface VerificationModalProps {
  defaultPhone: string;
  onVerifySuccess: (phone: string) => void;
  onClose: () => void;
}

export const VerificationModal: React.FC<VerificationModalProps> = ({
  defaultPhone,
  onVerifySuccess,
  onClose,
}) => {
  const [phone, setPhone] = useState(defaultPhone || '13800138000');
  const [code, setCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const handleSendCode = () => {
    setErrorMsg(null);
    if (!/^1\d{10}$/.test(phone.trim())) {
      setErrorMsg('请输入有效的 11 位中国大陆手机号码');
      return;
    }

    setIsSending(true);
    setTimeout(() => {
      const mockCode = String(Math.floor(100000 + Math.random() * 900000));
      setGeneratedCode(mockCode);
      setCode(mockCode); // Pre-fill for convenience
      setIsSending(false);
    }, 300);
  };

  const handleSubmit = () => {
    setErrorMsg(null);
    if (!/^1\d{10}$/.test(phone.trim())) {
      setErrorMsg('请输入有效的 11 位手机号码');
      return;
    }
    if (!code || code.length !== 6) {
      setErrorMsg('请输入 6 位短信验证码');
      return;
    }
    if (generatedCode && code !== generatedCode) {
      setErrorMsg('验证码不正确');
      return;
    }

    onVerifySuccess(phone);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#36B39E]" />
            <span>经办人身份验证与提交</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 font-medium">
            🔔 演示安全核验：系统将模拟发送短信验证码，验证办税及企业开办经办人手机号真实性。
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-600 font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              手机号码 <span className="text-rose-500">*</span>
            </label>
            <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden focus-within:border-[#36B39E] focus-within:ring-2 focus-within:ring-[#E6F7F2]">
              <span className="px-3.5 py-2 text-xs text-slate-500 bg-slate-50 border-r border-slate-100 shrink-0 font-medium">
                +86
              </span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="请输入 11 位手机号码"
                className="flex-1 px-3 py-2 text-xs sm:text-sm text-slate-800 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              验证码 <span className="text-rose-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="请输入 6 位验证码"
                className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-800 focus:border-[#36B39E] focus:ring-2 focus:ring-[#E6F7F2] outline-none font-mono"
              />
              <button
                type="button"
                onClick={handleSendCode}
                disabled={isSending}
                className="px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
              >
                {isSending ? '发送中…' : generatedCode ? '重新获取' : '获取演示验证码'}
              </button>
            </div>
            {generatedCode && (
              <p className="text-[11px] text-[#1D6C5E] font-medium mt-1.5">
                已自动生成并填入演示验证码：<strong className="font-mono text-xs">{generatedCode}</strong>
              </p>
            )}
          </div>
        </div>

        <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/70 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-full border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold cursor-pointer transition-all"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-6 py-2 rounded-full bg-[#36B39E] hover:bg-[#2AA894] text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
          >
            验证并提交
          </button>
        </div>
      </div>
    </div>
  );
};
