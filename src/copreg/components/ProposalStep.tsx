/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { RegistrationPlan, SurveyData, ServiceTierType, OptionalAddonService } from '../types';
import { buildPlan } from '../plan';
import { ALL_ADDON_IDS, OPTIONAL_ADDON_SERVICES, quoteFor } from './proposalQuote';
import { requestSmsCode } from '../verification';
import { CaptchaCancelledError } from '../../utils/tencentCaptcha';
import { COMPANY_PLAN_HOST, CONFIRM_PROPOSAL_PATH } from '../../config/api';
import {
  ServiceConfirmEndpoint,
  confirmServicePlan,
  isPlanConfirmStale,
  planConfirmOf,
  serviceConfirmRequestOf,
  type PlanConfirm
} from '../serviceConfirm';
import { PlanSuggestion } from '../planGenerate';
import {
  Building,
  Receipt,
  AlertTriangle,
  Gift,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  FileBadge,
  Clock,
  Printer,
  Check,
  Info,
  X,
  ShieldCheck,
  Landmark,
  FileSpreadsheet,
  Users,
  Sparkles,
  Smartphone
} from 'lucide-react';

interface ProposalStepProps {
  plan: RegistrationPlan;
  survey: SurveyData;
  /** 第 1 步「返回的」那份诊断结果（App 的 planSuggestion）：确认时原样提交给服务端 */
  report: PlanSuggestion | null;
  /** 已存下的确认凭据（App 的 planConfirm）；与当前方案一致时不再重复确认 */
  confirm: PlanConfirm | null;
  contactPhone?: string;
  onProceed: (phone: string | undefined, confirm: PlanConfirm | null) => void;
  onBack: () => void;
  onUpdatePlan?: (newPlan: RegistrationPlan) => void;
}

/** 只有 React 这一层读 config/api.ts：它依赖 import.meta.env，是 Vite 专有的 */
const CONFIRM_ENDPOINT: ServiceConfirmEndpoint = {
  host: COMPANY_PLAN_HOST,
  path: CONFIRM_PROPOSAL_PATH
};

export const ProposalStep: React.FC<ProposalStepProps> = ({
  plan,
  survey,
  report,
  confirm,
  contactPhone,
  onProceed,
  onBack,
  onUpdatePlan
}) => {
  // Service tiers: 'bundle_small' (default) | 'bundle_general' | 'standard'
  const initialTier: ServiceTierType =
    plan.selectedTier === 'standard'
      ? 'standard'
      : plan.selectedTier === 'bundle_general'
      ? 'bundle_general'
      : 'bundle_small';

  const [selectedTier, setSelectedTier] = useState<ServiceTierType>(initialTier);
  const [selectedAddons, setSelectedAddons] = useState<string[]>(() => {
    // 企业注册服务：默认不勾选自选服务；全年无忧套餐已全部内置必选和默认服务
    if (initialTier === 'standard') {
      return (plan.selectedAddons || []).filter(id => ALL_ADDON_IDS.includes(id));
    }
    return [];
  });
  const [showReportModal, setShowReportModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Phone and SMS verification modal for confirming proposal
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [phone, setPhone] = useState(contactPhone || '');
  // 短信验证码：先过腾讯行为验证码，拿到票据才发请求，请求成功才起 60s 倒计时
  const [smsCode, setSmsCode] = useState('');
  const [smsCodeId, setSmsCodeId] = useState('');
  // 验证码实际发往的号码。改过号就得重新获取，否则等于在验证旧号码
  const [smsSentTo, setSmsSentTo] = useState('');
  const [smsError, setSmsError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [isSendingSms, setIsSendingSms] = useState(false);
  // 「确认并前往支付」的接口在途状态与失败提示：失败拦在方案页，不放人进支付
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState('');

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const formatMoney = (val?: number | null) => {
    if (val === undefined || val === null || isNaN(val)) return '0';
    return val.toLocaleString();
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const openPhoneModal = () => {
    setSmsError('');
    setConfirmError('');
    setShowPhoneModal(true);
  };

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

  const handleConfirmAndProceed = async () => {
    if (!smsCodeId) {
      setSmsError('请先获取短信验证码');
      return;
    }
    if (phone.trim() !== smsSentTo) {
      setSmsError('手机号码已变更，请重新获取验证码');
      return;
    }
    // 前端只校验格式，真正的验证码比对由服务端拿 smsCodeId + smsValidCode 完成
    if (!/^\d{4,6}$/.test(smsCode.trim())) {
      setSmsError('请输入手机收到的短信验证码');
      return;
    }

    setSmsError('');
    setConfirmError('');
    setIsConfirming(true);
    let record: PlanConfirm | null = null;
    try {
      // 第 1 步的两份存档（问卷 + 套餐选择、诊断返回）连同手机号一起提交；
      // 套餐、加购、服务清单与确认凭据都取方案页当前这份 activePlan，和页面上的价格是同一份
      const request = serviceConfirmRequestOf({
        survey,
        plan: activePlan,
        report,
        mobile: phone.trim(),
        smsCodeId,
        smsValidCode: smsCode.trim()
      });
      const result = await confirmServicePlan(CONFIRM_ENDPOINT, request);
      // 服务端结果 + 这次提交的选择，一起交给 App 落本地：下次进来直接进第 3 步
      record = planConfirmOf(result, request);
    } catch (error) {
      // 确认没落库就不往下走：接口失败 / 未成功 / 路径没配都停在这一步，弹窗不关，可直接重试
      setConfirmError(error instanceof Error ? error.message : '确认方案失败，请稍后重试');
      return;
    } finally {
      setIsConfirming(false);
    }

    setShowPhoneModal(false);
    if (onUpdatePlan) {
      onUpdatePlan(activePlan);
    }
    showToast('手机号验证通过');
    onProceed(phone, record);
  };

  /**
   * 已经确认过（本地有凭据，且凭据与当前方案一致）时走这里：直接进第 3 步，不再调确认接口。
   * 再调一次会在服务端多出一份委托单，而用户什么都没改，没有任何理由重发。
   */
  const handleConfirmedProceed = () => {
    if (onUpdatePlan) {
      onUpdatePlan(activePlan);
    }
    onProceed(undefined, null);
  };

  // Handler to switch tier
  const handleTierSelect = (tier: ServiceTierType) => {
    setSelectedTier(tier);
    // 企业注册服务：保留有效自选项；全年无忧套餐：已全部内置必选/默认服务，无需外挂自选项
    let nextAddons: string[];
    if (tier === 'standard') {
      nextAddons = selectedAddons.filter(id => ALL_ADDON_IDS.includes(id));
    } else {
      nextAddons = [];
    }
    setSelectedAddons(nextAddons);
    const updatedPlan = buildPlan(survey, quoteFor(tier, nextAddons));
    if (onUpdatePlan) {
      onUpdatePlan(updatedPlan);
    }
  };

  // Handler to toggle optional addon service
  const handleToggleAddon = (addonId: string) => {
    const isCurrentlyActive = selectedAddons.includes(addonId);
    const nextAddons = isCurrentlyActive
      ? selectedAddons.filter(id => id !== addonId)
      : [...selectedAddons, addonId];
    setSelectedAddons(nextAddons);
    const updatedPlan = buildPlan(survey, quoteFor(selectedTier, nextAddons));
    if (onUpdatePlan) {
      onUpdatePlan(updatedPlan);
    }
  };

  const activePlan = (plan.selectedTier === selectedTier && JSON.stringify(plan.selectedAddons || []) === JSON.stringify(selectedAddons))
    ? plan
    : buildPlan(survey, quoteFor(selectedTier, selectedAddons));

  // 本地那份确认凭据是否仍然代表这套方案：档位或自选项改过就作废（App 会把它清掉，
  // 这里再判一次是为了「改回原样后没重新确认」也不至于拿旧凭据进支付页）
  const alreadyConfirmed = confirm !== null && !isPlanConfirmStale(confirm, activePlan);

  // 基础核心服务项目（固定高度，不因下方增值服务勾选而增减行，避免上下抖动）
  const basePackageItems = activePlan.items.filter(item => !item.id.startsWith('addon-'));

  return (
    <div className="pb-32">

      <div className="relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-10 pb-4 relative z-10">

          {/* Top Step Heading - states current step clearly */}
          <section className="mb-6">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#E6F7F2] text-[#2AA894] mb-2.5 select-none">
              <span className="w-1.5 h-1.5 rounded-full bg-[#36B39E]"></span>
              <span>第 2 步 · 方案与报价确认</span>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold tracking-tight mb-1.5">
              <span className="text-[#2AA894]">第 2 步：</span><span className="text-[#1D6C5E]">确认服务方案与费用明细</span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-500 max-w-2xl leading-relaxed">
              根据您的业务特征与财税要求生成建议方案，支持按需切换套餐与单列加购增值服务。
            </p>
          </section>

          {/* ==================== 01 架构与组织形式 ==================== */}
          <div
            id="sec-proposal-arch"
            className="rounded-2xl p-5 sm:p-6 mb-5 border border-slate-200/80 bg-white transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#E6F7F2] text-[#2AA894] select-none">
                <span className="w-1.5 h-1.5 rounded-full bg-[#36B39E]"></span>
                <span>01 · 架构诊断</span>
              </div>
              <span className="inline-flex items-center gap-1 text-xs text-[#2AA894]">
                <Check className="w-3 h-3 stroke-[2.5]" /> 诊断通过
              </span>
            </div>

            <h2 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight mb-3.5">
              企业架构与组织形式建议
            </h2>

            {/* 企业名称方案：服务端给的是含备选名的一整段，占满一行比塞进卡片里好读 */}
            {activePlan.companyNameProposal && (
              <div className="mb-3 p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/70">
                <span className="text-[11px] text-slate-400 block mb-0.5">企业名称方案</span>
                <p className="text-xs text-slate-700 leading-relaxed">
                  {activePlan.companyNameProposal}
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/70">
                <span className="text-[11px] text-slate-400 block mb-0.5">企业组织类型</span>
                <span className="font-bold text-[#2AA894] text-sm block mb-1">{activePlan.companyType}</span>
                <p className="text-slate-500 leading-relaxed">
                  股东以认缴出资额承担有限责任，适合商业结算、招投标与线上经营。
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/70">
                <span className="text-[11px] text-slate-400 block mb-0.5">纳税人身份规划</span>
                <span className="font-bold text-slate-800 text-sm block mb-1">{activePlan.taxpayerIdentity}</span>
                <p className="text-slate-500 leading-relaxed">
                  {activePlan.taxReason}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/70">
                <span className="text-[11px] text-slate-400 block mb-0.5">注册资本规划</span>
                <span className="font-bold text-slate-800 text-sm block mb-1">{activePlan.capitalAmount}</span>
                <p className="text-slate-500 leading-relaxed">
                  {activePlan.capitalAdvice}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/70">
                <span className="text-[11px] text-slate-400 block mb-0.5">注册地址合规策略</span>
                <span className="font-bold text-slate-800 text-sm block mb-1">
                  {survey.regAddress.includes('是') ? '自贸园区标准合规商务秘书集群注册地址' : '自有商业办公场所合规备案登记'}
                </span>
                <p className="text-slate-500 leading-relaxed">
                  {activePlan.registeredAddressAdvice}
                </p>
              </div>
            </div>

            {/* Scope and Qualifications */}
            <div className="mt-4 pt-3.5 border-t border-slate-100 space-y-3">
              <div>
                <span className="text-xs font-bold text-slate-700 block mb-1.5">拟申报经营范围：</span>
                <div className="flex flex-wrap gap-1.5">
                  {survey.scope.map((s) => (
                    <span key={s} className="px-2.5 py-0.5 rounded-md text-xs bg-[#E6F7F2] text-[#2AA894]">
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              {activePlan.postQualifications.length > 0 && (
                <div>
                  <span className="text-xs font-bold text-slate-700 block mb-1.5">后续需协同办理的行业资质：</span>
                  <div className="flex flex-wrap gap-1.5">
                    {activePlan.postQualifications.map((l) => (
                      <span key={l} className="px-2.5 py-0.5 rounded-md text-xs bg-purple-50 text-purple-700 border border-purple-200/70">
                        {l}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Concise Risk Tips */}
              <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/70">
                <div className="flex items-center gap-1.5 font-bold text-xs text-amber-900 mb-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span>合规专家提醒</span>
                </div>
                <ul className="space-y-0.5 text-xs text-amber-800 list-disc list-inside">
                  {activePlan.riskTips.map((tip, idx) => (
                    <li key={idx} className="leading-relaxed">{tip}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* ==================== 02 套餐方案选择 ==================== */}
          <div className="rounded-2xl p-5 sm:p-6 mb-5 border border-slate-200/80 bg-white">
            <div className="flex items-center justify-between mb-3">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#E6F7F2] text-[#2AA894] select-none">
                <span className="w-1.5 h-1.5 rounded-full bg-[#36B39E]"></span>
                <span>02 · 服务套餐</span>
              </div>
              <span className="text-xs text-slate-400">点击卡片切换方案 · 清单实时联动</span>
            </div>

            <h2 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight mb-4">
              服务套餐选择
            </h2>

            {/* 3 distinct service packages */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 items-stretch">

              {/* Package 1: 企业注册服务 */}
              <div
                id="tier-card-standard"
                onClick={() => handleTierSelect('standard')}
                className={`p-4 sm:p-4.5 rounded-xl cursor-pointer transition-colors flex flex-col justify-between ${
                  selectedTier === 'standard'
                    ? 'border border-[#36B39E] bg-[#F8FCFB]'
                    : 'border border-slate-200/80 bg-white hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                      基础设立 · 仅办证照
                    </span>
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all shrink-0 ${
                      selectedTier === 'standard' ? 'bg-[#36B39E] border-[#36B39E] text-white' : 'border-slate-300 bg-white'
                    }`}>
                      {selectedTier === 'standard' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                    </div>
                  </div>

                  <h3 className="text-base font-bold text-slate-800">企业注册服务</h3>
                  <p className="text-xs text-slate-400 mt-0.5 mb-2.5">已有专职财务，仅委托办理执照与印章</p>

                  <div className="py-2 my-2 border-y border-slate-100 flex items-baseline justify-between">
                    <div className="flex items-baseline gap-0.5">
                      <span className="text-xs font-bold text-slate-400">¥</span>
                      <span className={`text-xl sm:text-2xl font-black ${selectedTier === 'standard' ? 'text-[#36B39E]' : 'text-slate-800'}`}>
                        600
                      </span>
                      <span className="text-xs text-slate-400 line-through ml-1.5">¥1,700</span>
                    </div>
                    <span className="text-[11px] font-medium text-[#2AA894] bg-[#E6F7F2] px-1.5 py-0.5 rounded">
                      省 ¥1,100
                    </span>
                  </div>

                  <ul className="space-y-2 text-xs text-slate-600 my-3">
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#36B39E] shrink-0" />
                      <span>全程政务网申与执照申领</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#36B39E] shrink-0" />
                      <span>公安特行芯片印章5枚（免费）</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#36B39E] shrink-0" />
                      <span>市监行政审批规费（¥0全免）</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#36B39E] shrink-0" />
                      <span>公司章程与股东决议编制</span>
                    </li>
                    <li className="flex items-center gap-1.5 text-slate-400 pt-1 border-t border-slate-100">
                      <span className="w-3.5 text-center text-slate-300 shrink-0">—</span>
                      <span>可选加购银行开户/税局开户/社保公积金开户</span>
                    </li>
                  </ul>
                </div>

                <div className="pt-2.5 mt-1 border-t border-slate-100">
                  <button
                    type="button"
                    className={`w-full py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1 cursor-pointer ${
                      selectedTier === 'standard'
                        ? 'bg-[#36B39E] text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {selectedTier === 'standard' ? (
                      <>
                        <Check className="w-3 h-3 stroke-[3]" />
                        <span>已选此方案</span>
                      </>
                    ) : (
                      <span>选择此方案</span>
                    )}
                  </button>
                </div>
              </div>

              {/* Package 2: 全年无忧服务（小规模） */}
              <div
                id="tier-card-bundle-small"
                onClick={() => handleTierSelect('bundle_small')}
                className={`p-4 sm:p-4.5 rounded-xl cursor-pointer transition-colors flex flex-col justify-between ${
                  selectedTier === 'bundle_small'
                    ? 'border border-[#36B39E] bg-[#F8FCFB]'
                    : 'border border-slate-200/80 bg-white hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[11px] font-medium text-[#2AA894] bg-[#E6F7F2] px-2 py-0.5 rounded-md">
                      推荐 · 含企业注册
                    </span>
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all shrink-0 ${
                      selectedTier === 'bundle_small' ? 'bg-[#36B39E] border-[#36B39E] text-white' : 'border-slate-300 bg-white'
                    }`}>
                      {selectedTier === 'bundle_small' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                    </div>
                  </div>

                  <h3 className="text-base font-bold text-slate-800">全年无忧（小规模）</h3>
                  <p className="text-xs text-slate-400 mt-0.5 mb-2.5">含工商设立全套 + 12个月记账报税</p>

                  <div className="py-2 my-2 border-y border-slate-100 flex items-baseline justify-between">
                    <div className="flex items-baseline gap-0.5">
                      <span className="text-xs font-bold text-slate-400">¥</span>
                      <span className="text-xl sm:text-2xl font-black text-[#36B39E]">
                        2,500
                      </span>
                      <span className="text-xs text-slate-400 line-through ml-1.5">¥6,500</span>
                    </div>
                    <span className="text-[11px] font-medium text-[#2AA894] bg-[#E6F7F2] px-1.5 py-0.5 rounded">
                      省 ¥4,000
                    </span>
                  </div>

                  <ul className="space-y-2 text-xs text-slate-600 my-3">
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#36B39E] shrink-0" />
                      <span>含企业注册全程网申与执照正副本</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#36B39E] shrink-0" />
                      <span>公安备案防伪芯片印章5枚</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#36B39E] shrink-0" />
                      <span>市监行政审批规费全免</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#36B39E] shrink-0" />
                      <span>小规模代理记账托管（全年12个月）</span>
                    </li>
                    <li className="flex items-center gap-1.5 text-[#2AA894]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#36B39E] shrink-0" />
                      <span>含银行/税局/社保公积金开户及社保服务</span>
                    </li>
                  </ul>
                </div>

                <div className="pt-2.5 mt-1 border-t border-slate-100">
                  <button
                    type="button"
                    className={`w-full py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1 cursor-pointer ${
                      selectedTier === 'bundle_small'
                        ? 'bg-[#36B39E] text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {selectedTier === 'bundle_small' ? (
                      <>
                        <Check className="w-3 h-3 stroke-[3]" />
                        <span>已选此方案</span>
                      </>
                    ) : (
                      <span>选择此方案</span>
                    )}
                  </button>
                </div>
              </div>

              {/* Package 3: 全年无忧服务（一般纳税人） */}
              <div
                id="tier-card-bundle-general"
                onClick={() => handleTierSelect('bundle_general')}
                className={`p-4 sm:p-4.5 rounded-xl cursor-pointer transition-colors flex flex-col justify-between ${
                  selectedTier === 'bundle_general'
                    ? 'border border-[#36B39E] bg-[#F8FCFB]'
                    : 'border border-slate-200/80 bg-white hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[11px] font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                      专票抵扣 · 含企业注册
                    </span>
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all shrink-0 ${
                      selectedTier === 'bundle_general' ? 'bg-[#36B39E] border-[#36B39E] text-white' : 'border-slate-300 bg-white'
                    }`}>
                      {selectedTier === 'bundle_general' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                    </div>
                  </div>

                  <h3 className="text-base font-bold text-slate-800">全年无忧（一般纳税人）</h3>
                  <p className="text-xs text-slate-400 mt-0.5 mb-2.5">开具专票、有进项税额抵扣需求企业</p>

                  <div className="py-2 my-2 border-y border-slate-100 flex items-baseline justify-between">
                    <div className="flex items-baseline gap-0.5">
                      <span className="text-xs font-bold text-slate-400">¥</span>
                      <span className={`text-xl sm:text-2xl font-black ${selectedTier === 'bundle_general' ? 'text-[#36B39E]' : 'text-slate-800'}`}>
                        3,000
                      </span>
                      <span className="text-xs text-slate-400 line-through ml-1.5">¥7,500</span>
                    </div>
                    <span className="text-[11px] font-medium text-[#2AA894] bg-[#E6F7F2] px-1.5 py-0.5 rounded">
                      省 ¥4,500
                    </span>
                  </div>

                  <ul className="space-y-2 text-xs text-slate-600 my-3">
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#36B39E] shrink-0" />
                      <span>含企业注册全程网申与执照正副本</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#36B39E] shrink-0" />
                      <span>公安备案防伪芯片印章5枚</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#36B39E] shrink-0" />
                      <span>市监行政审批规费全免</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#36B39E] shrink-0" />
                      <span>专票认证代账与抵扣（全年12个月）</span>
                    </li>
                    <li className="flex items-center gap-1.5 text-blue-700">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#36B39E] shrink-0" />
                      <span>含银行/税局/社保公积金开户及社保服务</span>
                    </li>
                  </ul>
                </div>

                <div className="pt-2.5 mt-1 border-t border-slate-100">
                  <button
                    type="button"
                    className={`w-full py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1 cursor-pointer ${
                      selectedTier === 'bundle_general'
                        ? 'bg-[#36B39E] text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {selectedTier === 'bundle_general' ? (
                      <>
                        <Check className="w-3 h-3 stroke-[3]" />
                        <span>已选此方案</span>
                      </>
                    ) : (
                      <span>选择此方案</span>
                    )}
                  </button>
                </div>
              </div>

            </div>
          </div>

          {/* ==================== 03 服务项目与自选增值服务清单 ==================== */}
          <div className="rounded-2xl p-5 sm:p-6 mb-5 border border-slate-200/80 bg-white">
            {/* Header */}
            <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#E6F7F2] flex items-center justify-center text-[#36B39E]">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-800">
                    <span className="text-[#2AA894] mr-1">03 ·</span>服务项目与自选增值服务清单
                  </h2>
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs text-[#2AA894] bg-[#E6F7F2] px-2.5 py-0.5 rounded-full font-medium">
                <Clock className="w-3.5 h-3.5" />
                <span>时效：约 3 工作日</span>
              </div>
            </div>

            {/* Current Selected Tier Info */}
            <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-slate-50/70 border border-slate-200/70 flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-slate-400">已选方案：</span>
                <span className="font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200/70">
                  {activePlan.tierName}
                </span>
                <span className="text-slate-500">
                  基准标价：¥ {selectedTier === 'standard' ? '600' : selectedTier === 'bundle_small' ? '2,500' : '3,000'} 元
                </span>
              </div>
              <div className="text-xs text-[#2AA894]">
                {selectedTier === 'standard'
                  ? '包含：执照正副本 + 公安备案防伪5章 + 市监规费减免'
                  : '包含：企业注册全套 + 全年代理记账 + 银行开户/税局开户/社保公积金等必选与默认服务'}
              </div>
            </div>

            {/* Single Unified Service List (套餐服务与自选服务不分区合并) */}
            <div className="divide-y divide-slate-100 text-xs rounded-xl border border-slate-100 px-3 bg-white">
              {/* 1. 套餐标配/必选服务项目（勾选不可变，前面都是绿色的勾子） */}
              {basePackageItems.map((item) => (
                <div key={item.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-5 h-5 rounded-md bg-[#E6F7F2] text-[#2AA894] flex items-center justify-center shrink-0 select-none">
                      <Check className="w-3 h-3 stroke-[2.5]" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium text-slate-800">{item.name}</span>
                        {item.tag && (
                          <span className={`text-[10px] px-1.5 py-0.2 rounded ${
                            item.price === 0
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                              : 'bg-blue-50 text-blue-700 border border-blue-200/60'
                          }`}>
                            {item.tag}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 truncate">{item.desc}</p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="flex items-baseline gap-1.5 justify-end">
                      <span className={`font-bold ${
                        item.price === 0 ? 'text-emerald-600' : 'text-slate-800'
                      }`}>
                        {item.price === 0 ? '¥0 (免费)' : `¥${formatMoney(item.price)}`}
                      </span>
                      <span className="text-[11px] text-slate-400 line-through">
                        ¥{formatMoney(item.originalPrice)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              {/* 2. 企业注册服务内可选付费增值服务（前面是可选的 checkbox，点击可勾选/取消） */}
              {selectedTier === 'standard' && OPTIONAL_ADDON_SERVICES.map((addon) => {
                const isSelected = selectedAddons.includes(addon.id);

                return (
                  <div
                    key={addon.id}
                    onClick={() => handleToggleAddon(addon.id)}
                    className="py-2.5 flex items-center justify-between gap-2 cursor-pointer hover:bg-slate-50/70 transition-colors select-none group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* 可选的 checkbox */}
                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-all ${
                          isSelected
                            ? 'bg-[#36B39E] border border-[#36B39E] text-white'
                            : 'border border-slate-300 bg-white group-hover:border-[#36B39E]'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`font-medium ${isSelected ? 'text-slate-800' : 'text-slate-700'}`}>
                            {addon.name}
                          </span>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded border ${
                              isSelected
                                ? 'text-[#2AA894] bg-[#E6F7F2] border-[#36B39E]/30'
                                : 'text-slate-500 bg-slate-100 border-slate-200'
                            }`}
                          >
                            {isSelected ? '已加选' : '可选加购'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 truncate">{addon.desc}</p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="flex items-baseline gap-1.5 justify-end">
                        <span className={`font-bold ${isSelected ? 'text-slate-800' : 'text-slate-400'}`}>
                          ¥{addon.price}
                        </span>
                        <span className="text-[11px] text-slate-400">/{addon.unit}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Combined Cost Summary Box */}
            <div className="mt-5 p-4 rounded-xl bg-slate-50/70 border border-slate-200/70 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="space-y-1 text-xs text-slate-500">
                <div className="flex items-center gap-2 flex-wrap">
                  <span>项目原价：¥{formatMoney(activePlan.totalOriginal)}</span>
                  <span>·</span>
                  <span className="text-[#2AA894] font-medium">
                    政策减免与套餐优惠：-¥{formatMoney(activePlan.totalDiscount)}
                  </span>
                  {selectedTier === 'standard' && selectedAddons.length > 0 && (
                    <>
                      <span>·</span>
                      <span className="text-slate-600 font-medium">
                        加选增值服务（{selectedAddons.length}项）：+¥{formatMoney(activePlan.finalPrice - 600)}
                      </span>
                    </>
                  )}
                </div>
                <p className="text-slate-600">
                  {selectedTier === 'standard'
                    ? '已选【企业注册服务】：政务代办、执照申领、公安防伪芯片5章及规费全免' + (selectedAddons.length > 0 ? `，加选 ${selectedAddons.length} 项可选增值服务。` : '。')
                    : selectedTier === 'bundle_small'
                    ? '已选【全年无忧（小规模）】：含企业注册全套、小规模代理记账，以及银行开户、税局开户、社保公积金开户与社保公积金服务。'
                    : '已选【全年无忧（一般纳税人）】：含企业注册全套、一般纳税人专票记账，以及银行开户、税局开户、社保公积金开户与社保公积金服务。'}
                </p>
              </div>

              <div className="flex items-center md:items-end justify-between md:justify-center md:flex-col gap-0.5 shrink-0 pt-2.5 md:pt-0 border-t md:border-t-0 border-slate-200/60">
                <span className="text-xs text-slate-400 whitespace-nowrap">最终应付总额</span>
                <div className="text-2xl font-black text-[#36B39E] whitespace-nowrap tracking-tight flex items-baseline">
                  <span className="text-lg mr-0.5 font-bold">¥</span>
                  <span>{formatMoney(activePlan.finalPrice)}</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Floating Bottom Bar */}
      <div className="fixed left-0 right-0 bottom-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 py-3 px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">

          <button
            type="button"
            onClick={onBack}
            className="px-5 py-2 rounded-full border border-slate-200 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>返回修改调研</span>
          </button>

          <div className="flex items-center gap-2.5">
            {alreadyConfirmed && (
              <span className="hidden sm:inline text-[11px] text-slate-400" title={confirm?.recordId}>
                已确认 · 单号 {confirm?.recordId}
              </span>
            )}
            <button
              type="button"
              onClick={() => setShowReportModal(true)}
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-slate-200 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-[#36B39E]" />
              <span>查看正式方案报告</span>
            </button>

            <button
              type="button"
              id="btn-confirm-proposal-proceed"
              onClick={alreadyConfirmed ? handleConfirmedProceed : openPhoneModal}
              className="px-6 py-2.5 rounded-full bg-[#36B39E] hover:bg-[#2AA894] text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span>
                {alreadyConfirmed
                  ? '已确认，前往支付'
                  : `确认方案（¥ ${formatMoney(activePlan.finalPrice)}）`}
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>
      </div>

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 sm:p-8 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#E6F7F2] flex items-center justify-center text-[#36B39E]">
                  <Building className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#0F172A]">企业设立定制方案与报价确认书</h3>
                  {/* 方案编号由下单时生成，这里还没有下单，不能编一个 */}
                  <span className="text-xs text-slate-400">方案编号：待生成</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs text-[#475569]">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="font-bold text-sm text-[#0F172A]">企业概况评估</div>
                <div>主营方向：{survey.companyDesc}</div>
                <div>具体模式：{survey.bizDesc}</div>
                <div>拟定组织类型：{activePlan.companyType}</div>
                <div>注册资本规划：{activePlan.capitalAmount}</div>
                <div>选定服务套餐：<strong className="text-[#2AA894]">{activePlan.tierName}</strong>（¥ {formatMoney(activePlan.finalPrice)}）</div>
              </div>

              <div>
                <div className="font-bold text-sm text-[#0F172A] mb-2">已规划拟申报经营范围</div>
                <div className="flex flex-wrap gap-1.5">
                  {survey.scope.map(s => (
                    <span key={s} className="px-2.5 py-1 rounded-full bg-[#E6F7F2] text-[#2AA894]">
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <div className="font-bold text-sm text-[#0F172A] mb-1">服务保障条款</div>
                <p className="text-slate-500 leading-relaxed">
                  本方案承诺全程办理透明，受托办理范围含全程政务网申代办、执照申领、公安备案防伪五章刻制及后续开户与财税服务。因平台自身原因导致登记失败全额退款。
                </p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="px-5 py-2 rounded-full border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>打印报告</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowReportModal(false);
                  if (alreadyConfirmed) {
                    handleConfirmedProceed();
                  } else {
                    openPhoneModal();
                  }
                }}
                className="px-6 py-2 rounded-full bg-[#36B39E] hover:bg-[#2AA894] text-white text-xs font-semibold shadow-xs cursor-pointer"
              >
                {alreadyConfirmed ? '已确认，前往支付' : '确认方案'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phone & SMS Verification Modal on Confirming Proposal */}
      {showPhoneModal && (
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
                onClick={() => setShowPhoneModal(false)}
                disabled={isConfirming}
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
                  disabled={isConfirming}
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
                    disabled={isConfirming}
                    onChange={(e) => setSmsCode(e.target.value.trim())}
                    placeholder="请输入短信验证码"
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#36B39E] disabled:bg-slate-50 disabled:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={handleSendSms}
                    disabled={countdown > 0 || isSendingSms || isConfirming}
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

              {confirmError && (
                <p className="text-[11px] text-red-600 leading-relaxed bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                  {confirmError}
                </p>
              )}

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowPhoneModal(false)}
                  disabled={isConfirming}
                  className="px-4 py-2 rounded-full border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                >
                  取消
                </button>
                <button
                  type="button"
                  id="btn-confirm-phone-sms-submit"
                  onClick={handleConfirmAndProceed}
                  disabled={isConfirming}
                  className="px-5 py-2 rounded-full bg-[#36B39E] hover:bg-[#2AA894] text-white font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-[#36B39E]"
                >
                  <span>{isConfirming ? '提交中…' : '确认并前往支付'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-slate-900 text-white text-xs font-semibold shadow-xl flex items-center gap-2 animate-in fade-in duration-150">
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
};
