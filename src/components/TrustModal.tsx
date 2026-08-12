import React, { useEffect, useState } from "react";
import { ArrowRight, Check, ShieldCheck, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { loadSubmissionState, saveSubmissionState, DEFAULT_FORM_DATA } from "../utils/storage";
import type { TrustServiceId } from "../utils/storage";
import { useShareUserUuid } from "../hooks/useShareUserUuid";
import { API_HOST, DOC_HOST } from "../config/api";

type SubmitStatus = 'idle' | 'submitting' | 'error';
type ServiceId = TrustServiceId;

const serviceOptions: Array<{
  id: ServiceId;
  title: string;
  description: string;
}> = [
  {
    id: 'registration',
    title: '企业注册',
    description: '注册路径、材料准备与办理跟进',
  },
  {
    id: 'hosting',
    title: '企业托管',
    description: '财税、人事及日常企业事项托管',
  },
];

const FIELD_LABEL_STYLE = "mb-2 block text-sm font-semibold text-stone-700";
const INPUT_STYLE = "h-12 w-full rounded-xl border border-stone-300/70 bg-stone-50/35 px-4 text-stone-800 outline-none transition-all placeholder-stone-400 hover:border-stone-400 focus:border-[#66cdb5] focus:bg-white focus:ring-4 focus:ring-[#66cdb5]/10";

export default function TrustModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [isSuccess, setIsSuccess] = useState(() => loadSubmissionState()?.submitted ?? false);
  const [formData, setFormData] = useState(() => loadSubmissionState()?.formData ?? DEFAULT_FORM_DATA);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');
  const shareUserUuid = useShareUserUuid();
  const [qrCodeUrl, setQrCodeUrl] = useState('/image-yqt/customer-service-qr.png');
  const [qrLoading, setQrLoading] = useState(false);

  useEffect(() => {
    if (!isSuccess) return;
    const needFetch = shareUserUuid && formData.serviceTypes.some(type => type !== 'hosting' || formData.serviceTypes.length > 1);
    if (!needFetch) {
      setQrCodeUrl('/image-yqt/customer-service-qr.png');
      setQrLoading(false);
      return;
    }
    const controller = new AbortController();
    setQrLoading(true);
    fetch(`${DOC_HOST}/xcx/yqt-co/user/${shareUserUuid}/get`, {
      signal: controller.signal,
    })
      .then(res => res.json())
      .then(data => {
        if (data?.perShareEwmFile) {
          setQrCodeUrl(`${DOC_HOST}/doc/uuid/${data.perShareEwmFile}/get`);
        }
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
      })
      .finally(() => {
        if (!controller.signal.aborted) setQrLoading(false);
      });
    return () => controller.abort();
  }, [isSuccess]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const clearFieldError = (field: string) => {
    setErrors(prev => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  // Persist submitted state + form data so the contact-customer-service view shows on next visit
  const persistSubmission = () => {
    saveSubmissionState(true, formData);
  };

  const handleClose = () => {
    setErrors({});
    setSubmitStatus('idle');
    onClose();
  };

  const handleRefill = () => {
    setIsSuccess(false);
    setQrCodeUrl('/image-yqt/customer-service-qr.png');
    setQrLoading(false);
    setErrors({});
    setSubmitStatus('idle');
  };

  const toggleService = (serviceId: ServiceId) => {
    setFormData(prev => {
      const isSelected = prev.serviceTypes.includes(serviceId);
      const serviceTypes = isSelected
        ? prev.serviceTypes.filter(item => item !== serviceId)
        : [...prev.serviceTypes, serviceId];

      return {
        ...prev,
        serviceTypes,
        company: serviceId === 'hosting' && isSelected ? '' : prev.company,
      };
    });
    clearFieldError('serviceTypes');
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
    if (!formData.serviceTypes.length) {
      newErrors.serviceTypes = '请至少选择一项服务';
    }
    if (Object.keys(newErrors).length) {
      setErrors(newErrors);
      return;
    }

    setSubmitStatus('submitting');
    try {
      const res = await fetch(`${API_HOST}/xcx/xhr-co/subscribe/zxfw-sqsy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          mobile: formData.phone.trim(),
          name1: formData.serviceTypes.includes('hosting') ? formData.company.trim() : '',
          intention: formData.serviceTypes
            .map(type => type === 'registration' ? '50' : '60')
            .join(','),
          source: '2',
          shareUserUuid: shareUserUuid ?? '',
          serviceTypes: formData.serviceTypes,
        }),
      });

      if (!res.ok) throw new Error('提交失败');

      setIsSuccess(true);
      setSubmitStatus('idle');
      persistSubmission();
    } catch {
      setSubmitStatus('error');
      setTimeout(() => setSubmitStatus('idle'), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" onClick={handleClose}></div>

      <AnimatePresence mode="wait">
        {!isSuccess ? (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="service-dialog-title"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative z-10 flex max-h-[calc(100dvh-2rem)] w-full max-w-[720px] flex-col overflow-y-auto rounded-[1.5rem] border border-slate-200/80 bg-white shadow-2xl shadow-slate-950/15"
          >
            {/* Modal Form */}
            <div className="relative w-full overflow-y-auto p-6 sm:p-8">
              <button
                type="button"
                onClick={handleClose}
                aria-label="关闭服务选择窗口"
                className="absolute top-4 sm:top-6 right-4 sm:right-6 p-2 rounded-full hover:bg-slate-50 active:bg-slate-100 text-slate-400 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-200"
              >
                <X size={20} />
              </button>

              <div className="pr-10 text-[10px] font-bold uppercase tracking-[0.18em] text-[#4fb69e]">
                班步一企通 · 服务咨询
              </div>
              <h3 id="service-dialog-title" className="mt-2 pr-10 text-2xl font-extrabold tracking-tight text-slate-900">
                选择我需要的服务
              </h3>

              <form onSubmit={handleSubmit} className="mt-7 grid gap-5" noValidate>
                <fieldset>
                  <legend className="mb-3 text-sm font-semibold text-stone-700">
                    服务类型 <span className="text-[#42a98f]">*</span>
                  </legend>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {serviceOptions.map(option => {
                      const isSelected = formData.serviceTypes.includes(option.id);

                      return (
                        <button
                          key={option.id}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => toggleService(option.id)}
                          className={`relative flex min-h-[68px] items-center rounded-xl border px-4 py-3 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#66cdb5]/15 ${
                            isSelected
                              ? 'border-[#66cdb5] bg-[#f5fbf9] text-stone-700'
                              : 'border-stone-300/70 bg-white text-stone-600 hover:border-[#66cdb5]/50'
                          }`}
                        >
                          <div className={`mr-3 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                            isSelected ? 'border-[#66cdb5] bg-[#66cdb5]' : 'border-stone-300 bg-transparent'
                          }`}>
                            {isSelected && <Check size={12} className="text-white" aria-hidden="true" />}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-stone-700">{option.title}</div>
                            <div className="mt-0.5 text-xs leading-5 text-stone-500">{option.description}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {errors.serviceTypes && <p className="text-red-500 text-xs mt-2">{errors.serviceTypes}</p>}
                </fieldset>

                <div className="border-t border-stone-200/80 pt-5">
                  <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="service-contact-name" className={FIELD_LABEL_STYLE}>
                        您的称呼 <span className="text-[#42a98f]">*</span>
                      </label>
                      <input
                        id="service-contact-name"
                        type="text"
                        required
                        autoComplete="name"
                        placeholder="请输入称呼"
                        className={`${INPUT_STYLE} ${errors.name ? 'border-red-400' : ''}`}
                        value={formData.name}
                        onChange={e => { setFormData({...formData, name: e.target.value}); clearFieldError('name'); }}
                      />
                      {errors.name && <p className="mt-1.5 text-xs text-red-500">{errors.name}</p>}
                    </div>
                    <div>
                      <label htmlFor="service-contact-phone" className={FIELD_LABEL_STYLE}>
                        联系方式 <span className="text-[#42a98f]">*</span>
                      </label>
                      <input
                        id="service-contact-phone"
                        type="tel"
                        required
                        inputMode="numeric"
                        autoComplete="tel"
                        maxLength={11}
                        placeholder="请输入手机号码"
                        className={`${INPUT_STYLE} ${errors.phone ? 'border-red-400' : ''}`}
                        value={formData.phone}
                        onChange={e => { setFormData({...formData, phone: e.target.value}); clearFieldError('phone'); }}
                      />
                      {errors.phone && <p className="mt-1.5 text-xs text-red-500">{errors.phone}</p>}
                    </div>
                    {formData.serviceTypes.includes('hosting') && (
                      <motion.div className="sm:col-span-2" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
                        <label htmlFor="service-company-name" className={FIELD_LABEL_STYLE}>
                          现有企业名称 <span className="font-normal text-stone-400">（选填）</span>
                        </label>
                        <input
                          id="service-company-name"
                          type="text"
                          autoComplete="organization"
                          placeholder="如已确定，可填写企业全称"
                          className={INPUT_STYLE}
                          value={formData.company}
                          onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                        />
                      </motion.div>
                    )}
                  </div>
                </div>

                <div className="sticky -bottom-6 z-10 -mx-6 flex flex-col gap-4 border-t border-stone-100 bg-white/95 px-6 pt-4 backdrop-blur sm:static sm:mx-0 sm:flex-row sm:items-center sm:justify-between sm:border-0 sm:bg-transparent sm:px-0 sm:pt-0 sm:backdrop-blur-none">
                  <div className="flex items-center gap-2 text-xs leading-5 text-stone-400">
                    <ShieldCheck size={15} className="shrink-0 text-[#57bba4]" aria-hidden="true" />
                    您的信息仅用于本次服务咨询与需求跟进
                  </div>

                  <button
                    type="submit"
                    disabled={submitStatus === 'submitting'}
                    className="flex h-12 w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-[#66cdb5] bg-[#66cdb5] px-6 text-sm font-bold text-white shadow-lg shadow-[#66cdb5]/15 transition-all hover:bg-[#57bea6] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#66cdb5]/20 sm:w-[190px]"
                  >
                    {submitStatus === 'submitting' ? '提交中...' : submitStatus === 'error' ? '提交失败，请稍后重试' : (
                      <>
                        提交服务需求
                        <ArrowRight size={17} aria-hidden="true" />
                      </>
                    )}
                  </button>
                </div>
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
              <div className="mx-auto w-44 h-44 sm:w-[180px] sm:h-[180px] rounded-2xl border border-slate-100 bg-white p-2 shadow-sm shadow-slate-100 flex items-center justify-center">
                {qrLoading ? (
                  <div className="w-8 h-8 border-2 border-[#66CDB5]/30 border-t-[#66CDB5] rounded-full animate-spin" />
                ) : (
                  <img
                    src={qrCodeUrl}
                    alt="客服二维码"
                    className="h-full w-full object-contain"
                  />
                )}
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
