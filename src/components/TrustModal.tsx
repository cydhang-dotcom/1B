import React, { useState } from "react";
import { X, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import customerServiceQr from "../assets/customer-service-qr.png";

type SubmitStatus = 'idle' | 'submitting' | 'error';

export default function TrustModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [isSuccess, setIsSuccess] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', company: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');

  const clearFieldError = (field: string) => {
    setErrors(prev => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleClose = () => {
    setIsSuccess(false);
    setFormData({ name: '', phone: '', company: '' });
    setErrors({});
    setSubmitStatus('idle');
    onClose();
  };

  const handleRefill = () => {
    setIsSuccess(false);
    setFormData({ name: '', phone: '', company: '' });
    setErrors({});
    setSubmitStatus('idle');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) {
      newErrors.name = '请输入您的称呼';
    }
    if (!/^1[3-9]\d{9}$/.test(formData.phone)) {
      newErrors.phone = '请输入正确的手机号码';
    }
    if (Object.keys(newErrors).length) {
      setErrors(newErrors);
      return;
    }

    setSubmitStatus('submitting');
    try {
      const res = await fetch('https://v3001.ibanbu.com/v1/xcx/xhr-co/subscribe/zxfw-sqsy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          mobile: formData.phone,
          name1: formData.company.trim(),
          source: '2',
        }),
      });

      if (!res.ok) throw new Error('提交失败');

      setIsSuccess(true);
      setSubmitStatus('idle');
    } catch {
      setSubmitStatus('error');
      setTimeout(() => setSubmitStatus('idle'), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-6 py-4 sm:px-10 lg:px-16">
      <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" onClick={handleClose}></div>

      <AnimatePresence mode="wait">
        {!isSuccess ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-3xl max-h-[calc(100dvh-2rem)] bg-white rounded-[1.5rem] md:rounded-[2rem] shadow-xl shadow-slate-950/10 overflow-y-auto md:overflow-hidden relative z-10 flex flex-col md:flex-row border border-slate-100"
          >
            {/* Modal Aside */}
            <div className="w-full md:w-2/5 bg-slate-50 p-8 sm:p-12 flex flex-col justify-center relative overflow-hidden shrink-0 border-b md:border-b-0 md:border-r border-slate-100">
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#66CDB5]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>

              <div className="relative z-10">
                <div className="text-[10px] font-bold tracking-widest text-[#66CDB5] uppercase mb-4 sm:mb-6">
                  BANBU ONE SERVICE
                </div>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 leading-[1.2] mb-3 sm:mb-4">
                  企业后台
                  <br />
                  <span className="text-[#66CDB5]">交给班步</span>
                </h3>

                <div className="space-y-3 sm:space-y-4 border-t border-slate-200 pt-5 sm:pt-8 mt-6 sm:mt-10">
                  <div className="flex gap-3 text-sm font-medium text-slate-600">
                    <Check size={18} className="text-[#66CDB5] shrink-0" />
                    公司注册与后续托管衔接
                  </div>
                  <div className="flex gap-3 text-sm font-medium text-slate-600">
                    <Check size={18} className="text-[#66CDB5] shrink-0" />
                    财税、人事事项统一跟进
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Form */}
            <div className="w-full md:w-3/5 p-8 sm:p-12 relative">
              <button
                onClick={handleClose}
                className="absolute top-4 sm:top-6 right-4 sm:right-6 p-2 rounded-full hover:bg-slate-50 active:bg-slate-100 text-slate-400 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-200"
              >
                <X size={20} />
              </button>

              <h3 className="text-2xl font-extrabold text-slate-900 mb-6 sm:mb-8 mt-2 sm:mt-0">
                托管我的企业
              </h3>

              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                <div>
                  <input
                    type="text"
                    required
                    placeholder="您的称呼"
                    className={`w-full h-12 px-5 bg-white border rounded-full focus:border-[#66CDB5] focus:ring-4 focus:ring-[#66CDB5]/10 outline-none font-medium text-slate-900 transition-all placeholder:text-slate-400 shadow-sm shadow-slate-100 ${errors.name ? 'border-red-400' : 'border-slate-200'}`}
                    value={formData.name}
                    onChange={e => { setFormData({...formData, name: e.target.value}); clearFieldError('name'); }}
                  />
                  {errors.name && <p className="text-red-500 text-xs mt-1.5 pl-5">{errors.name}</p>}
                </div>
                <div>
                  <input
                    type="tel"
                    required
                    placeholder="您的联系方式"
                    className={`w-full h-12 px-5 bg-white border rounded-full focus:border-[#66CDB5] focus:ring-4 focus:ring-[#66CDB5]/10 outline-none font-medium text-slate-900 transition-all placeholder:text-slate-400 shadow-sm shadow-slate-100 ${errors.phone ? 'border-red-400' : 'border-slate-200'}`}
                    value={formData.phone}
                    onChange={e => { setFormData({...formData, phone: e.target.value}); clearFieldError('phone'); }}
                  />
                  {errors.phone && <p className="text-red-500 text-xs mt-1.5 pl-5">{errors.phone}</p>}
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="企业名称（选填）"
                    className="w-full h-12 px-5 bg-white border border-slate-200 rounded-full focus:border-[#66CDB5] focus:ring-4 focus:ring-[#66CDB5]/10 outline-none font-medium text-slate-900 transition-all placeholder:text-slate-400 shadow-sm shadow-slate-100"
                    value={formData.company}
                    onChange={(e) =>
                      setFormData({ ...formData, company: e.target.value })
                    }
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitStatus === 'submitting'}
                  className="w-full h-12 bg-[#66CDB5] hover:bg-[#52ba9f] disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-full font-medium text-base mt-2 transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#66CDB5]/20"
                >
                  {submitStatus === 'submitting' ? '提交中...' : submitStatus === 'error' ? '提交失败，请稍后重试' : '提交托管需求'}
                </button>
              </form>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg bg-white p-6 sm:p-8 rounded-[2rem] shadow-xl shadow-slate-200/50 relative z-10 border border-slate-100"
          >
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-50 active:bg-slate-100 text-slate-400 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-200"
            >
              <X size={18} />
            </button>

            <div className="flex items-start gap-4 pr-8">
              <div className="w-12 h-12 bg-[#f0fdfa] text-[#0d9488] rounded-2xl flex items-center justify-center shrink-0">
                <Check size={26} strokeWidth={3} />
              </div>
              <div>
                <div className="text-[10px] font-bold tracking-widest text-[#66CDB5] uppercase mb-1">
                  SUBMITTED
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-slate-900">
                  信息已提交
                </h3>
              </div>
            </div>

            <div className="mt-6 grid gap-5 sm:grid-cols-[180px_1fr] sm:items-center">
              <div className="mx-auto w-44 h-44 sm:w-[180px] sm:h-[180px] rounded-2xl border border-slate-100 bg-white p-2 shadow-sm shadow-slate-100">
                <img
                  src={customerServiceQr}
                  alt="客服二维码"
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 text-left">
                <div className="text-sm font-bold text-slate-900 mb-2">
                  添加客服号
                </div>
                <p className="text-sm leading-relaxed text-slate-500">
                  扫码后可直接沟通托管需求；也可以等待客服联系。
                </p>
              </div>
            </div>

            <div className="mt-6 flex w-full gap-3">
              <button
                type="button"
                onClick={handleRefill}
                className="h-11 flex-1 rounded-full border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-200"
              >
                重新填写
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="h-11 flex-1 rounded-full bg-[#66CDB5] text-white text-sm font-medium hover:bg-[#52ba9f] transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#66CDB5]/20"
              >
                我知道了
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
