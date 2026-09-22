/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 手机号 + 短信验证码弹框（第 1 步「生成需求方案」用）。
 *
 * 「获取验证码」先过腾讯行为验证码（`utils/tencentCaptcha`），拿到票据才请求短信服务；
 * 短信服务返回的 `smsCodeId` 与用户填的验证码一起交给调用方，由**业务接口**在服务端比对
 * —— 前端没有任何接口能自己校验这串码，只校验格式（11 位手机号、4~6 位数字）。
 *
 * 弹框本身**不发业务请求**：调用方拿到 PhoneVerification 后调自己的接口，再用 `busy` / `error`
 * 两个 props 把在途状态与失败提示交回来。这样「接口失败怎么办」由调用方决定
 * （生成需求方案是「失败留在弹框里、改验证码重试」），弹框不替它做主。
 */

import React, { useEffect, useState } from 'react';
import { Smartphone, X, ArrowRight } from 'lucide-react';
import { CaptchaCancelledError } from '../../utils/tencentCaptcha';
import { requestSmsCode, type PhoneVerification } from '../verification';

interface PhoneVerifyModalProps {
  /** 预填的手机号（App 里可能还留着上一次验证过的号码） */
  initialPhone?: string;
  /** 提交按钮的文案，如「验证并生成方案」 */
  submitLabel: string;
  /** 业务请求在途：整个弹框置灰，防止半路改号或重复提交 */
  busy: boolean;
  /** 业务请求失败的中文提示，显示在按钮上方；空串不显示 */
  error: string;
  /** 验证通过：手机号与短信凭据交给调用方去发业务请求 */
  onVerified: (verification: PhoneVerification) => void;
  onClose: () => void;
}

export const PhoneVerifyModal: React.FC<PhoneVerifyModalProps> = ({
  initialPhone,
  submitLabel,
  busy,
  error,
  onVerified,
  onClose
}) => {
  const [phone, setPhone] = useState(initialPhone || '');
  const [smsCode, setSmsCode] = useState('');
  const [smsCodeId, setSmsCodeId] = useState('');
  // 验证码实际发往的号码。改过号就得重新获取，否则等于在验证旧号码
  const [smsSentTo, setSmsSentTo] = useState('');
  const [smsError, setSmsError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [isSendingSms, setIsSendingSms] = useState(false);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleSendSms = async () => {
    if (!/^1\d{10}$/.test(phone.trim())) {
      setSmsError('请输入有效的 11 位中国大陆手机号码');
      return;
    }
    setIsSendingSms(true);
    setSmsError('');
    try {
      const { smsCodeId: id } = await requestSmsCode(phone.trim());
      setSmsCodeId(id);
      setSmsSentTo(phone.trim());
      setSmsCode('');
      setCountdown(60);
    } catch (err) {
      // 用户自己关掉验证码弹窗不算失败，静默处理
      if (!(err instanceof CaptchaCancelledError)) {
        setSmsError(err instanceof Error ? err.message : '验证码发送失败，请稍后重试');
      }
    } finally {
      setIsSendingSms(false);
    }
  };

  const handleSubmit = () => {
    if (!smsCodeId) {
      setSmsError('请先获取短信验证码');
      return;
    }
    if (phone.trim() !== smsSentTo) {
      setSmsError('手机号码已变更，请重新获取验证码');
      return;
    }
    if (!/^\d{4,6}$/.test(smsCode.trim())) {
      setSmsError('请输入手机收到的短信验证码');
      return;
    }

    setSmsError('');
    onVerified({ mobile: phone.trim(), smsCodeId, smsValidCode: smsCode.trim() });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full p-5 sm:p-6 border border-slate-200/80 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#E6F7F2] text-[#36B39E] flex items-center justify-center">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">手机号验证</h3>
              <span className="text-[11px] text-slate-400">用于接收办理进度与实名通知</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-100"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-4 text-xs">
          {/* Mobile field */}
          <div>
            <label className="font-medium text-slate-700 block mb-1">
              手机号码 <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              maxLength={11}
              value={phone}
              disabled={busy}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#36B39E] disabled:bg-slate-50 disabled:text-slate-400"
              placeholder="请输入11位手机号码"
            />
          </div>

          {/* SMS Code field */}
          <div>
            <label className="font-medium text-slate-700 block mb-1">
              短信验证码 <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={smsCode}
                disabled={busy}
                onChange={(e) => setSmsCode(e.target.value.trim())}
                placeholder="请输入短信验证码"
                className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#36B39E] disabled:bg-slate-50 disabled:text-slate-400"
              />
              <button
                type="button"
                onClick={handleSendSms}
                disabled={countdown > 0 || isSendingSms || busy}
                className="px-3.5 py-2 rounded-xl text-xs font-medium shrink-0 bg-[#E6F7F2] text-[#2AA894] hover:bg-[#D1F2EB] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#E6F7F2]"
              >
                {countdown > 0 ? `${countdown}s` : isSendingSms ? '发送中…' : '获取验证码'}
              </button>
            </div>
            {smsError ? (
              <p className="mt-1.5 text-[11px] text-red-500 leading-relaxed">{smsError}</p>
            ) : countdown > 0 ? (
              <p className="mt-1.5 text-[11px] text-slate-400 leading-relaxed">
                验证码已发送至 {smsSentTo}，请注意查收
              </p>
            ) : null}
          </div>

          {error && (
            <p className="text-[11px] text-red-600 leading-relaxed bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="px-4 py-2 rounded-full border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              取消
            </button>
            <button
              type="button"
              id="btn-confirm-phone-sms-submit"
              onClick={handleSubmit}
              disabled={busy}
              className="px-5 py-2 rounded-full bg-[#36B39E] hover:bg-[#2AA894] text-white font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-[#36B39E]"
            >
              <span>{busy ? '提交中…' : submitLabel}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
