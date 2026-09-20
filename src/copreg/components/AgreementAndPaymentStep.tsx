/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { RegistrationPlan, PaymentOrder } from '../types';
import {
  FileText,
  CheckCircle2,
  ShieldCheck,
  Lock,
  CreditCard,
  QrCode,
  Download,
  Printer,
  ArrowRight,
  ArrowLeft,
  Building2,
  Award,
  Check,
  Receipt,
  ExternalLink,
  MessageSquare,
  Clock,
  HelpCircle,
  X,
  AlertCircle,
  Sparkles,
  ChevronRight,
  FileEdit
} from 'lucide-react';

import { STORAGE_KEY as REGISTRATION_STORAGE_KEY } from '../registration/defaultData';

/**
 * 支付成功时现场生成订单号：REG + 年月日 + 时间戳后 6 位。
 * 真实环境订单号应由后端下单接口下发，这里没有后端，所以用支付时刻本地生成，
 * 保证它跟同一时刻记录的 paidAt 自洽（两者都来自同一个 Date）。
 */
const makeOrderNo = (date: Date): string => {
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  return `REG${ymd}${String(date.getTime()).slice(-6)}`;
};

interface AgreementAndPaymentStepProps {
  plan: RegistrationPlan;
  order: PaymentOrder;
  onUpdateOrder?: (order: PaymentOrder | ((prev: PaymentOrder) => PaymentOrder)) => void;
  onPaymentSuccess?: () => void;
  onPaid?: (orderData: Partial<PaymentOrder>) => void;
  onBack: () => void;
  /** 申报资料是否已提交，决定清单里第一项的完成态与「查看/修改申报资料」入口 */
  isDetailsSubmitted?: boolean;
  /** 支付后的下一步：专属服务群 */
  onProceedToGroup?: () => void;
  /** 直接进入第 5 步「企业注册申报资料填报」，或提交后回来看/改 */
  onProceedToFillDetails?: () => void;
}

export const AgreementAndPaymentStep: React.FC<AgreementAndPaymentStepProps> = ({
  plan,
  order,
  onUpdateOrder,
  onPaymentSuccess,
  onPaid,
  onBack,
  isDetailsSubmitted,
  onProceedToGroup,
  onProceedToFillDetails
}) => {
  const isPaid = order?.status === 'paid';

  // 填报状态以持久化的那份申报存档为准：App 的 state 只在本次会话里有效，
  // 刷新后它从 localStorage 恢复，这里再兜一层，保证清单不会退回「待填报」
  const [localSubmitted] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(REGISTRATION_STORAGE_KEY);
      if (!saved) return false;
      const parsed = JSON.parse(saved) as { status?: string };
      return parsed.status === 'submitted';
    } catch {
      return false;
    }
  });

  const effectiveSubmitted = Boolean(isDetailsSubmitted || localSubmitted);

  const formatMoney = (val?: number | null) => {
    if (val === undefined || val === null || isNaN(val)) return '0';
    return val.toLocaleString();
  };

  const finalPrice = plan?.finalPrice ?? order?.amount ?? 0;
  const totalOriginal = plan?.totalOriginal ?? 8180;
  const totalDiscount = plan?.totalDiscount ?? (totalOriginal - finalPrice);
  const items = plan?.items || [];

  // Agreement confirmation state
  const [hasAgreed, setHasAgreed] = useState(true);
  const [showAgreementModal, setShowAgreementModal] = useState(false);
  const [showServiceContentModal, setShowServiceContentModal] = useState(false);
  const [showWecomModal, setShowWecomModal] = useState(false);

  // Payment method
  // 支付方式：目前只有微信（支付方式选择区里支付宝那一项先注释掉了），所以 'alipay'
  // 这一支暂时选不到；收银台与实付金额那几处三元判断都保留着它，接入支付宝时不用改。
  const [payMethod, setPayMethod] = useState<'wechat' | 'alipay'>(
    order.paymentMethod === 'alipay' ? 'alipay' : 'wechat'
  );

  // Cashier modal (直接支付)
  const [showPayModal, setShowPayModal] = useState(false);
  const [isProcessingPay, setIsProcessingPay] = useState(false);

  // Toast message
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Triggered when user clicks "立即支付" - 只进行支付
  const handleStartPayment = () => {
    if (!hasAgreed) {
      showToast('请先勾选同意《委托代理服务协议》');
      return;
    }
    // “立即支付”只支付：直接唤起支付收银台
    setShowPayModal(true);
  };

  // Confirm payment in Cashier modal
  const handleCompletePayment = () => {
    setIsProcessingPay(true);
    setTimeout(() => {
      setIsProcessingPay(false);
      setShowPayModal(false);

      const paidAt = new Date();
      const now = paidAt.toLocaleString('zh-CN', { hour12: false });
      const updatedOrder: PaymentOrder = {
        ...order,
        // 订单号理应由后端下单接口下发，这里没有后端，就在支付成功这一刻用
        // 同一个时间戳现场生成，保证订单号与支付时间自洽。
        orderNo: order.orderNo || makeOrderNo(paidAt),
        status: 'paid',
        paidAt: now,
        paymentMethod: payMethod,
        amount: plan.finalPrice
      };

      if (onUpdateOrder) {
        onUpdateOrder(updatedOrder);
      }
      if (onPaymentSuccess) {
        onPaymentSuccess();
      }
      if (onPaid) {
        onPaid(updatedOrder);
      }

      showToast('支付成功！委托代办已生效，已生成专属服务清单与企微顾问');
    }, 900);
  };

  // Checklist items for post-payment status display
  const checklistItems = [
    {
      title: '企业注册申报资料在线填报与合规初审',
      desc: effectiveSubmitted
        ? '已成功提交企业名称排查、股东股权架构、主要管理人员实名信息及经营场所证明。专属顾问正在进行合规初核，预计 2 小时内完成并对接网申审批系统。'
        : '在线登记企业备选字号、股东股权架构、主要人员实名信息及经营场所证明。专属顾问在您提交后 2 小时内完成合规审核并推进后续各项审批。',
      status: effectiveSubmitted ? 'completed' : 'in_progress',
      statusLabel: effectiveSubmitted ? '已完成填报 · 专员初审中' : '进行中 · 待填报',
      dept: effectiveSubmitted ? '已提交 · 企服专员初核中' : '独立专项填报模块 / 经办人在线录入',
      time: effectiveSubmitted ? '已提交（正在初核）' : '核心前置任务（约 10~15 分钟）',
      isPrereq: !effectiveSubmitted
    },
    {
      title: '市场监督管理局行政审批送审与执照领办',
      desc: effectiveSubmitted
        ? '【当前阶段】专人对接属地市监行政审批网申系统编制申报底稿，协同全体股东完成实名认证电子签名后，领办纸质营业执照正副本原件。'
        : '【前置条件：资料审核通过后启动】专人对接属地市监行政审批网申系统编制申报底稿，协同全体股东完成实名认证电子签名后，领办纸质营业执照正副本原件。',
      status: effectiveSubmitted ? 'in_progress' : 'waiting',
      statusLabel: effectiveSubmitted ? '进行中 · 底稿编制与政务网申' : '待资料审核后启动',
      dept: '市场监督管理局',
      time: effectiveSubmitted ? '预计 1~2 工作日办结' : '资料审核通过后 1~2 工作日',
      isPrereq: effectiveSubmitted
    },
    {
      title: '公安特行备案防伪芯片印章刻制（全套5枚）',
      desc: '【前置条件：执照下发后启动】公章、财务章、发票章、合同章、法人私章，公安特行刻印点内嵌芯片防伪备案。',
      status: 'pending',
      statusLabel: '执照核发后启动',
      dept: '公安局特行备案点',
      time: '执照下发后 4 小时'
    },
    {
      title: '合作商业银行对公账户绿色通道开户预约',
      desc: '【前置条件：证照齐全后启动】招商银行/工商银行/平安银行专属客户经理绿色通道对接，专人协同网点开户。',
      status: 'waiting',
      statusLabel: '证照齐全后启动',
      dept: '合作商业银行',
      time: '证照齐全后次日'
    },
    {
      title: '国家电子税务局企业税种核定与登记',
      desc: '【前置条件：开户完成后启动】办理电子税务局实名登记、税种核定、发票票种及数电发票额度申领。',
      status: 'pending',
      statusLabel: '开户完成后启动',
      dept: '国家税务总局电子税局',
      time: '开户完成后 1 工作日'
    },
    {
      title: '专属财税专员建账与全年记账报税托管',
      desc: '【常态化托管服务】持证资深会计师建立标准财务账套，按期纳税申报及汇算清缴。',
      status: 'planned',
      statusLabel: '按期交付',
      dept: '专属财税团队',
      time: '全年 12 个月托管'
    },
    {
      title: '单位独立社保与住房公积金开户及托管',
      desc: '【按需申报】开立单位专属五险一金账户，按月协助员工增减员申报与基数核算。',
      status: 'planned',
      statusLabel: '按需申报',
      dept: '人社局 / 公积金中心',
      time: '按月度办理'
    }
  ];

  return (
    <div className="pb-32">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#0F172A] text-white text-xs font-semibold px-5 py-2.5 rounded-full shadow-xl flex items-center gap-2 animate-in fade-in zoom-in-95 duration-200">
          <CheckCircle2 className="w-4 h-4 text-[#36B39E]" />
          <span>{toast}</span>
        </div>
      )}

      <div className="relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-10 pb-4 relative z-10">

          {/* ========================================================= */}
          {/* ==================== STATE 1: UNPAID ==================== */}
          {/* ========================================================= */}
          {!isPaid ? (
            <div>
              {/* Top Step Heading - states current step clearly */}
              <section className="mb-6">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#E6F7F2] text-[#2AA894] mb-2 select-none">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#36B39E]"></span>
                  <span>第 3 步 · 协议确认与支付</span>
                </div>

                <h1 className="text-xl sm:text-2xl font-bold tracking-tight mb-1.5">
                  <span className="text-[#2AA894]">第 3 步：</span><span className="text-[#1D6C5E]">确认委托协议并完成支付</span>
                </h1>

                <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
                  请核对您的企业设立委托方案与费用明细，完成短信实名验证并在线支付，即可启动代办流程。
                </p>
              </section>

              {/* Section 1: Order Summary & Itemized Table */}
              <div className="rounded-2xl p-5 sm:p-6 mb-5 border border-slate-200/80 bg-white">
                <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[#E6F7F2] flex items-center justify-center text-[#36B39E]">
                      <Receipt className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-800">委托代办方案与费用明细</h2>
                      <span className="text-[11px] text-slate-400">订单号：{order.orderNo || '支付后生成'}</span>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-[#2AA894] bg-[#E6F7F2] px-2.5 py-0.5 rounded-full">
                    {plan.tierName || (plan.selectedTier === 'standard' ? '企业注册服务' : plan.selectedTier === 'bundle_general' ? '全年无忧服务（一般纳税人）' : '全年无忧服务（小规模）')}
                  </span>
                </div>

                {/* Items Table */}
                <div className="border border-slate-200/80 rounded-xl overflow-hidden mb-4">
                  <div className="bg-slate-50/80 px-3.5 py-2 grid grid-cols-12 text-xs font-medium text-slate-500 border-b border-slate-200/80">
                    <span className="col-span-6">服务项目及交付标准</span>
                    <span className="col-span-3 text-right">参考原价</span>
                    <span className="col-span-3 text-right">结算金额</span>
                  </div>

                  <div className="divide-y divide-slate-100 text-xs text-slate-700">
                    {items.map((item, idx) => {
                      const orig = item?.originalPrice ?? item?.price ?? 0;
                      const current = item?.price ?? 0;
                      const isFreeItem = item?.isFree || item?.isGift || current === 0;

                      return (
                        <div key={item.id || idx} className="px-3.5 py-2.5 grid grid-cols-12 items-center hover:bg-slate-50/50 transition-colors">
                          <div className="col-span-6 pr-2">
                            <div className="font-medium text-slate-800 flex items-center gap-1.5 flex-wrap">
                              <span>{item.name}</span>
                              {isFreeItem && (
                                <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200/60">
                                  政策全免
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400 block mt-0.5 truncate">{item.desc}</span>
                          </div>
                          <div className="col-span-3 text-right text-slate-400 line-through">
                            ¥{formatMoney(orig)}
                          </div>
                          <div className="col-span-3 text-right font-medium text-slate-800">
                            {isFreeItem ? (
                              <span className="text-emerald-600 font-bold">¥0 (免收)</span>
                            ) : (
                              <span>¥{formatMoney(current)}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Calculation Bar */}
                <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/70 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>服务原价合计：</span>
                    <span className="line-through">¥{formatMoney(totalOriginal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[#2AA894] font-medium">
                    <span>免收规费及套餐优惠：</span>
                    <span>-¥{formatMoney(totalDiscount)}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between font-bold text-slate-800">
                    <span>最终应付金额：</span>
                    <span className="text-xl font-black text-[#36B39E]">¥{formatMoney(finalPrice)}</span>
                  </div>
                </div>
              </div>

              {/* Section 2: Minimal Service Agreement Confirmation */}
              <div className="rounded-xl p-3.5 sm:p-4 mb-5 border border-slate-200/80 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 text-xs text-slate-700 select-none">
                  <input
                    type="checkbox"
                    id="checkbox-agreement"
                    checked={hasAgreed}
                    onChange={(e) => setHasAgreed(e.target.checked)}
                    className="w-4 h-4 text-[#36B39E] border-slate-300 rounded focus:ring-[#36B39E] cursor-pointer shrink-0"
                  />
                  <label htmlFor="checkbox-agreement" className="cursor-pointer">
                    <span>我已阅读并同意</span>
                    <button
                      type="button"
                      onClick={() => setShowAgreementModal(true)}
                      className="text-[#36B39E] font-medium underline hover:text-[#2AA894] mx-1 cursor-pointer inline-flex items-center gap-0.5"
                    >
                      <span>《委托代理服务协议》</span>
                      <ExternalLink className="w-3 h-3 inline" />
                    </button>
                  </label>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAgreementModal(true)}
                  className="text-xs text-slate-400 hover:text-[#36B39E] underline cursor-pointer text-left sm:text-right shrink-0"
                >
                  点击查看协议全文
                </button>
              </div>

              {/* Section 3: Payment Method Selection */}
              <div className="rounded-2xl p-5 sm:p-6 mb-5 border border-slate-200/80 bg-white">
                <h2 className="text-sm font-bold text-slate-800 mb-3">选择支付方式</h2>
                {/* 目前只有微信支付接入了（src/payment/），支付宝还没接，所以这里只列一项，
                    外层用单列。接入支付宝时：把下面那段注释掉的选项恢复，外层改回
                    grid-cols-1 sm:grid-cols-2 —— payMethod 的类型和收银台那几处三元判断
                    都还留着 'alipay' 分支，不用动。 */}
                <div className="grid grid-cols-1 gap-3">
                  {/* WeChat Pay */}
                  <div
                    onClick={() => setPayMethod('wechat')}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-colors flex items-center justify-between ${
                      payMethod === 'wechat'
                        ? 'border-[#36B39E] bg-[#F8FCFB]'
                        : 'border-slate-200/80 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm">
                        微
                      </div>
                      <div>
                        <span className="font-medium text-slate-800 block text-xs">微信支付</span>
                        <span className="text-[11px] text-slate-400">微信扫码 / 快捷支付</span>
                      </div>
                    </div>
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      payMethod === 'wechat' ? 'border-[#36B39E] bg-[#36B39E] text-white' : 'border-slate-300'
                    }`}>
                      {payMethod === 'wechat' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                    </div>
                  </div>

                  {/* 支付宝：尚未接入，先隐藏（恢复时把这段取消注释即可）
                  <div
                    onClick={() => setPayMethod('alipay')}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-colors flex items-center justify-between ${
                      payMethod === 'alipay'
                        ? 'border-[#36B39E] bg-[#F8FCFB]'
                        : 'border-slate-200/80 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">
                        支
                      </div>
                      <div>
                        <span className="font-medium text-slate-800 block text-xs">支付宝</span>
                        <span className="text-[11px] text-slate-400">支付宝扫码 / 花呗</span>
                      </div>
                    </div>
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      payMethod === 'alipay' ? 'border-[#36B39E] bg-[#36B39E] text-white' : 'border-slate-300'
                    }`}>
                      {payMethod === 'alipay' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                    </div>
                  </div>
                  */}
                </div>
              </div>

              {/* Bottom Sticky Action Bar */}
              <div className="fixed left-0 right-0 bottom-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 py-3 px-6">
                <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={onBack}
                    className="px-5 py-2 rounded-full border border-slate-200 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>返回修改方案</span>
                  </button>

                  <div className="flex items-center gap-3">
                    <div className="hidden sm:block text-right">
                      <span className="text-[11px] text-slate-400 block">应付总额</span>
                      <span className="text-base font-black text-[#36B39E]">¥{formatMoney(finalPrice)}</span>
                    </div>

                    <button
                      type="button"
                      id="btn-click-pay"
                      onClick={handleStartPayment}
                      className="px-6 py-2.5 rounded-full bg-[#36B39E] hover:bg-[#2AA894] text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>立即支付 ¥{formatMoney(finalPrice)}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ======================================================= */
            /* ==================== STATE 2: PAID ==================== */
            /* ======================================================= */
            <div className="space-y-4">
              {/* ==================== BEAUTIFIED WELCOME HERO CARD ==================== */}
              <div className="relative overflow-hidden rounded-2xl p-6 sm:p-7 border border-emerald-200/90 bg-gradient-to-br from-[#F0FDF4]/90 via-white to-[#F0FDF9] shadow-sm">
                {/* Subtle decorative glow accents */}
                <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-100/35 rounded-full blur-3xl -mr-24 -mt-24 pointer-events-none" />
                <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-[#E6F7F2]/40 rounded-full blur-2xl -mb-20 pointer-events-none" />

                <div className="relative z-10">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 pb-5 border-b border-emerald-100/80">
                    <div className="flex items-start sm:items-center gap-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#2AA894] to-[#36B39E] text-white flex items-center justify-center shadow-md shadow-emerald-600/20 ring-4 ring-emerald-100/90 shrink-0">
                        <Check className="w-5 h-5 stroke-[2.8]" />
                      </div>
                      <div>
                        <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-full mb-1.5 border border-emerald-200/60">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span>支付成功 · 委托代办已生效</span>
                        </div>
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
                          欢迎使用“班步一企通”服务
                        </h1>
                        <div className="mt-2.5 flex flex-wrap items-center gap-2">
                          <span className="text-xs text-slate-400 font-medium">已开通服务：</span>
                          <span className="text-xs font-bold text-[#1D6C5E] bg-white px-2.5 py-1 rounded-lg border border-[#2AA894]/30 shadow-2xs">
                            {plan.tierName || (plan.selectedTier === 'standard' ? '企业注册服务' : plan.selectedTier === 'bundle_general' ? '全年无忧服务（一般纳税人）' : '全年无忧服务（小规模）')}
                          </span>
                          {plan.selectedAddons && plan.selectedAddons.length > 0 && (
                            <span className="text-xs font-medium text-blue-700 bg-white px-2.5 py-1 rounded-lg border border-blue-200/80 shadow-2xs">
                              含 {plan.selectedAddons.length} 项自选增值服务
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => setShowServiceContentModal(true)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-[#2AA894] hover:text-[#1D6C5E] bg-white hover:bg-emerald-50/50 border border-[#36B39E]/35 px-3 py-1 rounded-lg cursor-pointer transition-all shadow-2xs"
                          >
                            <FileText className="w-3.5 h-3.5 text-[#36B39E]" />
                            <span>服务内容详情</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="text-left sm:text-right shrink-0 bg-white/60 sm:bg-transparent p-3 sm:p-0 rounded-xl border border-emerald-100/60 sm:border-0 w-full sm:w-auto">
                      <span className="text-xs text-slate-400 block font-medium">
                        实付金额（{order?.paymentMethod === 'alipay' ? '支付宝' : '微信支付'}）
                      </span>
                      <div className="flex items-baseline sm:justify-end gap-0.5 mt-0.5">
                        <span className="text-sm font-bold text-[#2AA894]">¥</span>
                        <span className="text-2xl sm:text-3xl font-black text-[#1D6C5E] tracking-tight">
                          {formatMoney(order?.amount ?? finalPrice)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Metadata Cards Grid */}
                  <div className="pt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="bg-white/80 backdrop-blur-xs rounded-xl p-2.5 border border-emerald-100/70 shadow-2xs">
                      <span className="text-[11px] text-slate-400 block font-medium">订单编号</span>
                      <span className="font-semibold text-slate-800 text-xs font-mono mt-0.5 block truncate">
                        {order.orderNo}
                      </span>
                    </div>
                    <div className="bg-white/80 backdrop-blur-xs rounded-xl p-2.5 border border-emerald-100/70 shadow-2xs">
                      <span className="text-[11px] text-slate-400 block font-medium">经办人姓名</span>
                      <span className="font-semibold text-slate-800 text-xs mt-0.5 block">
                        {order.contactName}
                      </span>
                    </div>
                    <div className="bg-white/80 backdrop-blur-xs rounded-xl p-2.5 border border-emerald-100/70 shadow-2xs">
                      <span className="text-[11px] text-slate-400 block font-medium">经办联系电话</span>
                      <span className="font-semibold text-slate-800 text-xs font-mono mt-0.5 block">
                        {order.contactPhone}
                      </span>
                    </div>
                    <div className="bg-white/80 backdrop-blur-xs rounded-xl p-2.5 border border-emerald-100/70 shadow-2xs">
                      <span className="text-[11px] text-slate-400 block font-medium">支付时间</span>
                      <span className="font-semibold text-slate-800 text-xs mt-0.5 block truncate">
                        {order.paidAt || '刚刚完成'}
                      </span>
                    </div>
                  </div>

                  {/* Integrated Dedicated Consultant Bar inside Welcome Card */}
                  <div className="mt-3.5 pt-3.5 border-t border-emerald-100/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-emerald-100/80 text-[#2AA894] flex items-center justify-center shrink-0">
                        <MessageSquare className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex items-center gap-2 flex-wrap min-w-0 text-xs">
                        <span className="font-bold text-slate-800">专属顾问：李经理</span>
                        <span className="text-[10px] text-emerald-800 bg-emerald-100/80 px-1.5 py-0.5 rounded border border-emerald-200 font-medium">
                          企业微信官方认证
                        </span>
                        <span className="text-slate-300 hidden md:inline">·</span>
                        <span className="text-[11px] text-slate-500 hidden sm:inline truncate">
                          专员将在工作时间内主动致电协助申报代办，亦可随时微信沟通
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowWecomModal(true)}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-emerald-50/80 text-[#1D6C5E] text-xs font-semibold border border-emerald-200/90 shadow-2xs hover:shadow-xs transition-all cursor-pointer shrink-0 self-start sm:self-auto"
                    >
                      <QrCode className="w-3.5 h-3.5 text-[#2AA894]" />
                      <span>微信扫码咨询</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Requirement 3: Service Checklist & Handling Status */}
              <div className="rounded-2xl p-5 sm:p-6 border border-slate-200/80 bg-white">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 mb-4 border-b border-slate-100 gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[#E6F7F2] flex items-center justify-center text-[#36B39E]">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-800">服务进度状态与办理清单</h2>
                    </div>
                  </div>
                  <span className="text-xs text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/70 self-start sm:self-auto font-medium">
                    {effectiveSubmitted ? '资料已提交 · 专员初审中' : '第 1 步待填报'}
                  </span>
                </div>

                {/* Checklist items list */}
                <div className="space-y-2.5">
                  {checklistItems.map((item, index) => {
                    const isDone = item.status === 'completed';
                    const isInProgress = item.status === 'in_progress';
                    const isCurrentActive = item.isPrereq && isInProgress;

                    return (
                      <div
                        key={index}
                        className={`p-3.5 sm:p-4 rounded-xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 ${
                          isCurrentActive
                            ? 'border-emerald-300/90 bg-gradient-to-r from-emerald-50/80 via-[#E6F7F2]/40 to-white shadow-2xs ring-1 ring-emerald-200/50'
                            : isDone
                            ? 'border-emerald-200/80 bg-emerald-50/20'
                            : 'border-slate-200/80 bg-white'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 shrink-0">
                            {isCurrentActive ? (
                              <div className="w-5 h-5 rounded-full bg-[#2AA894] text-white flex items-center justify-center shadow-xs">
                                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                              </div>
                            ) : isDone ? (
                              <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                                <Check className="w-3 h-3 stroke-[2.5]" />
                              </div>
                            ) : (
                              <div className="w-4 h-4 rounded-full border border-slate-300 bg-white flex items-center justify-center text-[10px] font-medium text-slate-400">
                                {index + 1}
                              </div>
                            )}
                          </div>

                          <div>
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              {isCurrentActive && (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200/70">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                                  当前进行阶段
                                </span>
                              )}
                              <span className={`text-xs font-bold ${isCurrentActive ? 'text-slate-800 sm:text-sm' : isDone ? 'text-emerald-900' : 'text-slate-700'}`}>
                                {item.title}
                              </span>
                              <span className="text-[10px] text-slate-400 bg-slate-50 px-1.5 py-0.2 rounded border border-slate-200/60">
                                {item.dept}
                              </span>
                            </div>
                            <p className={`text-xs mt-0.5 leading-relaxed ${isCurrentActive ? 'text-slate-600' : 'text-slate-400'}`}>
                              {item.desc}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
                          <span className="text-[11px] text-slate-400">{item.time}</span>
                          {isCurrentActive && (
                            <button
                              type="button"
                              onClick={() => {
                                if (onProceedToGroup) onProceedToGroup();
                              }}
                              className="px-4 py-1.5 rounded-xl bg-[#2AA894] hover:bg-[#1D6C5E] text-white font-bold text-xs shadow-sm hover:shadow transition-all cursor-pointer flex items-center gap-1"
                            >
                              <span>进入专属服务群</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {isDone && index === 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                if (onProceedToFillDetails) onProceedToFillDetails();
                              }}
                              className="px-3 py-1.5 rounded-xl border border-emerald-300 bg-white hover:bg-emerald-50 text-[#1D6C5E] font-bold text-xs shadow-2xs transition-all cursor-pointer flex items-center gap-1 shrink-0"
                            >
                              <FileEdit className="w-3.5 h-3.5" />
                              <span>查看/修改申报资料</span>
                            </button>
                          )}
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                              isCurrentActive
                                ? 'bg-emerald-100/70 text-emerald-800 border-emerald-200'
                                : isDone
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                                : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}
                          >
                            {item.statusLabel}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Service Completion Footer Note */}
              <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/70 text-center text-xs text-slate-400">
                <span>客服专班已在线启动 · 办理过程中若有疑问，请随时微信扫码与专属顾问沟通</span>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ===================================================================== */}
      {/* ==================== MODAL: CASHIER / PAY MODAL ===================== */}
      {/* ===================================================================== */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 sm:p-6 border border-slate-200/80 animate-in fade-in zoom-in-95 duration-150 text-center">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <span className="text-xs font-medium text-slate-600">
                收银台 · {payMethod === 'wechat' ? '微信支付' : '支付宝'}
              </span>
              <button
                type="button"
                onClick={() => setShowPayModal(false)}
                className="w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="mb-4">
              <span className="text-xs text-slate-400 block mb-0.5">支付金额</span>
              <div className="text-2xl font-black text-[#36B39E]">¥{formatMoney(finalPrice)}</div>
              <span className="text-[11px] text-slate-400 block mt-0.5">订单号：{order?.orderNo || '支付后生成'}</span>
            </div>

            {/* Simulated QR Box */}
            <div className="w-44 h-44 mx-auto bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col items-center justify-center mb-4 relative">
              <QrCode className="w-36 h-36 text-slate-800" />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 shadow-2xs flex items-center justify-center">
                  <span className="text-xs font-bold text-[#36B39E]">
                    {payMethod === 'wechat' ? '微信' : '支'}
                  </span>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              请打开手机{payMethod === 'wechat' ? '微信' : '支付宝'}扫码完成付款<br />
              <span className="text-[11px] text-slate-400">（演示环境可直接点击下方按钮完成）</span>
            </p>

            <button
              type="button"
              disabled={isProcessingPay}
              onClick={handleCompletePayment}
              className="w-full py-2.5 rounded-full bg-[#36B39E] hover:bg-[#2AA894] text-white font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              {isProcessingPay ? (
                <span>正在确认支付结果...</span>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>确认支付（¥{formatMoney(finalPrice)}）</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* ==================== MODAL 3: FULL LEGAL AGREEMENT TEXT MODAL =============== */}
      {/* ============================================================================== */}
      {showAgreementModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-5 sm:p-6 border border-slate-200/80 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#E6F7F2] flex items-center justify-center text-[#36B39E]">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">委托代理服务协议</h3>
                  <span className="text-[11px] text-slate-400">合同编号：{order.orderNo ? `HT-${order.orderNo}` : '支付后生成'}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAgreementModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-slate-600 leading-relaxed max-h-[55vh] overflow-y-auto pr-2">
              <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/70">
                <p className="font-medium text-slate-800 mb-0.5">
                  委托方（甲方）：{order.contactName || '＿＿＿＿'}（经办代表）
                </p>
                <p className="font-medium text-slate-800">受托方（乙方）：企服云帆企业管理咨询（深圳）有限公司</p>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 text-xs mb-1">第一条 委托事项与服务范围</h4>
                <p>
                  1.1 甲方因投资创业需要，正式委托乙方代为办理新设企业相关政务设立及财税建账服务。
                </p>
                <p>
                  1.2 乙方代办事项包含：拟定合规企业名称申报、起草公司章程及股东会决议、政务网申材料编制送审、辅导股东与法定代表人电子人脸签名、线下领办纸质营业执照正副本原件、公安特行芯片印章刻制备案，以及后续银行对公绿色开户预约及财税托管服务。
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 text-xs mb-1">第二条 费用结算与支付</h4>
                <p>
                  2.1 委托代办费用总计人民币 ¥{formatMoney(finalPrice)} 元整（含政务代办费、印章刻制及相应财税服务费）。
                </p>
                <p>
                  2.2 乙方承诺收费明细公开透明，绝无任何巧立名目的二次隐形加价。
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 text-xs mb-1">第三条 服务时效与不成功全额退费承诺</h4>
                <p>
                  3.1 乙方承诺自甲方及全体股东完成电子实名认证签署之日起，一般于 1~3 个工作日内办结纸质营业执照。
                </p>
                <p>
                  3.2 若非因甲方提供虚假身份资料或政策不可抗力、而因乙方原因导致设立不通过的，乙方承诺 100% 全额退还已收代办费用。
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 text-xs mb-1">第四条 商业保密与个人信息安全</h4>
                <p>
                  4.1 乙方严格遵照《个人信息保护法》及《网络安全法》，对甲方提供的股东身份证、住所信息及商业计划承担保密责任。
                </p>
              </div>
            </div>

            <div className="pt-3.5 mt-4 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setHasAgreed(true);
                  setShowAgreementModal(false);
                }}
                className="px-5 py-2 rounded-full bg-[#36B39E] hover:bg-[#2AA894] text-white text-xs font-bold cursor-pointer transition-colors"
              >
                我已阅读并同意签署
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ================= MODAL 4: SERVICE DETAILS CONTENT MODAL ================ */}
      {/* ========================================================================= */}
      {showServiceContentModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 sm:p-6 border border-slate-200/80 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#E6F7F2] text-[#36B39E] flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-800">“班步一企通”服务内容与交付清单</h3>
                  <span className="text-[11px] text-slate-400">
                    当前开通套餐：{plan.tierName || (plan.selectedTier === 'standard' ? '企业注册服务' : plan.selectedTier === 'bundle_general' ? '全年无忧服务（一般纳税人）' : '全年无忧服务（小规模）')}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowServiceContentModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-slate-600 leading-relaxed max-h-[60vh] overflow-y-auto pr-2">
              {/* Plan highlight card */}
              <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 text-xs sm:text-sm">
                      {plan.tierName || (plan.selectedTier === 'standard' ? '企业注册服务' : plan.selectedTier === 'bundle_general' ? '全年无忧服务（一般纳税人）' : '全年无忧服务（小规模）')}
                    </span>
                    <span className="text-[10px] font-medium text-[#2AA894] bg-white px-2 py-0.5 rounded border border-[#36B39E]/20">
                      生效中
                    </span>
                  </div>
                  <p className="text-slate-400 text-xs mt-0.5">
                    {plan.selectedTier === 'standard'
                      ? '包含：全程政务网申代办、营业执照正副本原件领办、公安备案防伪芯片印章全套5枚及市监规费全免'
                      : '包含：【企业注册服务】全套（执照正副本+芯片5章+规费全免）及全年12个月记账报税托管'}
                  </p>
                </div>
                <div className="text-left sm:text-right shrink-0">
                  <span className="text-slate-400 text-[11px] block">结算金额</span>
                  <span className="text-lg font-black text-[#36B39E]">¥{formatMoney(order?.amount ?? finalPrice)}</span>
                </div>
              </div>

              {/* Service Items Table */}
              <div>
                <h4 className="font-bold text-slate-800 text-xs mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#36B39E]" />
                  <span>服务项目明细及服务标准</span>
                </h4>
                <div className="border border-slate-200/80 rounded-xl overflow-hidden divide-y divide-slate-100">
                  {items.map((item, idx) => (
                    <div key={item.id || idx} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/50 transition-colors">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#36B39E] shrink-0 mt-0.5" />
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium text-slate-800 text-xs">{item.name}</span>
                            {item.tag && (
                              <span className="text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200/60">
                                {item.tag}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400 block mt-0.5">{item.desc}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0 font-medium text-xs pl-5 sm:pl-0">
                        {item.price === 0 ? (
                          <span className="text-emerald-600">¥0 (免费)</span>
                        ) : (
                          <span className="text-slate-800">¥{formatMoney(item.price)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Deliverables */}
              <div>
                <h4 className="font-bold text-slate-800 text-xs mb-2 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#36B39E]" />
                  <span>办结实体与电子交付清单</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {(plan.deliverables || [
                    '营业执照正本、副本原件（政务印制镭射防伪防复制）',
                    '公安备案特行芯片印章5枚（公章、财务章、发票章、合同章、法人章）',
                    '印章公安系统特行备案证明书与芯片编码凭证',
                    '公司章程原件与股东会决议标准备案文本',
                    '电子税务局开户账套档案与纳税人申报回执',
                    '单位社保、住房公积金独立专户编号凭证'
                  ]).map((del, idx) => (
                    <div key={idx} className="p-2 rounded-lg bg-slate-50/70 border border-slate-200/70 flex items-center gap-1.5 text-slate-700">
                      <Check className="w-3.5 h-3.5 text-[#36B39E] shrink-0 stroke-[2.5]" />
                      <span className="text-[11px]">{del}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Policy notes */}
              <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200/60 text-emerald-800 text-[11px]">
                <strong>服务保障承诺：</strong>所选套餐与增值服务已完全缴清，绝无任何二次巧立名目加价；办结物料顺丰安全包邮寄达。
              </div>
            </div>

            <div className="pt-3.5 mt-4 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowServiceContentModal(false)}
                className="px-5 py-2 rounded-full bg-[#36B39E] hover:bg-[#2AA894] text-white text-xs font-bold cursor-pointer transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* ==================== MODAL: WECOM CONSULTANT QR CODE ========================= */}
      {/* ============================================================================== */}
      {showWecomModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xs w-full p-5 border border-slate-200 animate-in fade-in zoom-in-95 duration-150 text-center">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#2AA894]" />
                <span className="text-xs font-bold text-slate-800">专属顾问企业微信</span>
              </div>
              <button
                type="button"
                onClick={() => setShowWecomModal(false)}
                className="w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-400 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="w-36 h-36 mx-auto bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex flex-col items-center justify-center my-2">
              <QrCode className="w-28 h-28 text-slate-800" />
            </div>
            <p className="text-xs font-semibold text-slate-800 mt-2">李经理 · 资深设立顾问</p>
            <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60 inline-block mt-1">企业微信官方认证</span>
            <p className="text-[11px] text-slate-400 mt-2">微信扫一扫添加，专属顾问全程跟进代办</p>
          </div>
        </div>
      )}

    </div>
  );
};
