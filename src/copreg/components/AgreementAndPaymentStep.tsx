/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
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

import { registrationStorageKey } from '../registration/defaultData';
import { agentCardOf } from '../registration/contactInfo';
import { useRegistrationContact } from '../registration/useRegistrationContact';
import { fillDetailsOpenUrl } from '../stepRoute';
import { PayQrCode } from '../../payment/PayQrCode';
import { useWechatNativePay } from '../../payment/useWechatNativePay';
import { useCustomerServiceQr } from '../../hooks/useCustomerServiceQr';

interface AgreementAndPaymentStepProps {
  /** 当前主体 id：申报表存档按主体各一份，读「是否已提交」要用它 */
  appId: string;
  plan: RegistrationPlan;
  order: PaymentOrder;
  onUpdateOrder?: (order: PaymentOrder | ((prev: PaymentOrder) => PaymentOrder)) => void;
  /**
   * 查单确认已支付：把**这份付过款的订单**交回 App。
   *
   * 必须把订单带上：App 除了解锁服务群，还要把「已支付」写回**主体记录里的订单摘要**
   * —— 顶栏下拉的状态徽标 / 「作废服务」入口、以及支付成功页新开填报页的深链放行条件
   * （`allowsFillDetailsIntent`）读的都是那份摘要，光改运行时那份 `order` 它们都看不到
   * （2026-10 修：付完款顶栏仍显示「待支付」）。
   */
  onPaymentSuccess?: (paidOrder: PaymentOrder) => void;
  onBack: () => void;
  /** 申报资料是否已提交，决定清单里第一项的完成态与「查看/修改申报资料」入口 */
  isDetailsSubmitted?: boolean;
  /**
   * 这一页该显示「支付成功」还是「待支付」：由 App 按 `showsPaidView(orderPaid, detailsSubmitted)`
   * 算好传进来（申报资料已提交 ⇒ 必然付过款，刷新时不必等查单）。不传就只看订单状态
   */
  paidView?: boolean;
  /**
   * 进入第 5 步「企业注册申报资料填报」：清单里第一项（申报资料填报）的入口，
   * 提交后回来看/改也是它。**现在这两个按钮改在新标签页打开**（见
   * `openFillDetailsInNewTab`），这个回调只剩「弹窗被拦时退回同页跳转」这一条用途；
   * 第 4 步服务群那边的入口仍是同页跳转。
   * **支付成功后不再往第 4 步服务群引流** —— 付款后该做的是填申报资料（与 copreg 主线一致），
   * 服务群仍在导航里可直达，只是不再是这一页的主按钮。
   */
  onProceedToFillDetails?: () => void;
  /** 第 1 步诊断接口返回的委托单号：下单时的业务关联 id（busUnionId）。没有它下不了单 */
  busUnionId?: string;
  /**
   * **这一单的分享人**（`plan_record.shareUserUuid`，建单时存下的）：「微信扫码咨询」弹窗按它
   * 查专属客服码，开新标签页时也把它带过去（新标签页读的还是同一份本地凭据）。
   * 空串 = 这单没有分享人（自然流量 / 老单没存过）→ 弹窗显示通用客服码。
   */
  shareUserUuid?: string;
}

export const AgreementAndPaymentStep: React.FC<AgreementAndPaymentStepProps> = ({
  appId,
  plan,
  order,
  onUpdateOrder,
  onPaymentSuccess,
  onBack,
  isDetailsSubmitted,
  paidView,
  onProceedToFillDetails,
  busUnionId,
  shareUserUuid
}) => {
  const isPaid = paidView ?? order?.status === 'paid';

  /**
   * 「申报资料填报」/「查看/修改申报资料」→ **在新标签页打开**填报页。
   *
   * 为什么不直接在同页跳：填报要填很久，用户经常要对着方案 / 协议 / 材料来回看，
   * 开新标签页能把支付成功页留在原地。
   *
   * 新标签页只会按本地证据落点（地址栏不指挥页面），所以地址里带一个显式意图
   * `?open=fill-details`；付过款才会被认（见 stepRoute.ts 的 openIntentOf）。
   * 分享人（这一单的）也跟着地址过去：地址栏里那份**不是**客服码的依据（那是 `plan_record`），
   * 带上它是为了让新标签页仍持有同一条链接的上下文 —— 在那边（或绕回来）再建新单时，
   * 归属还认得出是谁带来的。
   * 万一被浏览器拦了弹窗（返回 null），退回原来的同页跳转，别让按钮变成没反应。
   */
  const openFillDetailsInNewTab = () => {
    const url = fillDetailsOpenUrl(window.location.origin, window.location.pathname, shareUserUuid);
    // ⚠️ **不能带 `noopener`**：带它时 `window.open` 一律返回 null，就分不清「开成功」和
    // 「被弹窗拦截」了 —— 于是每次都走下面的兜底、把原网页也跳走（踩过）。
    // 新窗口与本站同源，开成功后再手动断开 opener 即可。
    const opened = window.open(url, '_blank');
    if (opened) {
      try {
        opened.opener = null;
      } catch {
        /* 拿不到引用（个别浏览器）就算了，同源页面风险可忽略 */
      }
      return;
    }
    // 真被拦（返回 null）才退回同页跳转，别让按钮变成没反应
    if (onProceedToFillDetails) onProceedToFillDetails();
  };

  // 填报状态以持久化的那份申报存档为准：App 的 state 只在本次会话里有效，
  // 刷新后它从 localStorage 恢复，这里再兜一层，保证清单不会退回「待填报」。
  // 多主体：读的是**当前主体**那份申报表（键里带 appId）
  const [localSubmitted] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(registrationStorageKey(appId));
      if (!saved) return false;
      const parsed = JSON.parse(saved) as { status?: string };
      return parsed.status === 'submitted';
    } catch {
      return false;
    }
  });

  const effectiveSubmitted = Boolean(isDetailsSubmitted || localSubmitted);

  /**
   * 头部卡片的「经办人姓名 / 经办联系电话」：**申报资料里填了联系人就取联系人的**，
   * 没填才退回订单上查单带回来的手机号 / 破折号（姓名一直没采集过，所以以前那格总是破折号）。
   * 填报页是新标签页开的，那边一保存草稿这里就通过 storage 事件跟着更新，见 useRegistrationContact。
   */
  const contact = useRegistrationContact(appId, effectiveSubmitted);
  const agentCard = agentCardOf(contact, order || {});

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

  // 「微信扫码咨询」弹窗里的专属顾问企微码：点开才去查，查到专属码用它，查不到用通用兜底图。
  // 查的是**这一单的**分享人（props 从 plan_record 来），不是地址栏 —— 见 useCustomerServiceQr 的注释
  const wecomQr = useCustomerServiceQr(showWecomModal, shareUserUuid);

  // Payment method
  // 支付方式：目前只有微信（支付方式选择区里支付宝那一项先注释掉了），所以 'alipay'
  // 这一支暂时选不到；收银台与实付金额那几处三元判断都保留着它，接入支付宝时不用改。
  const [payMethod, setPayMethod] = useState<'wechat' | 'alipay'>(
    order.paymentMethod === 'alipay' ? 'alipay' : 'wechat'
  );

  // Cashier modal (直接支付)
  const [showPayModal, setShowPayModal] = useState(false);

  /**
   * 微信 Native 收银台：下单出码 + 轮询查单，只有服务端说已支付才算成功。
   *
   * 这里**没有任何「演示完成支付」的按钮**：不付款就标成已支付是假的终态，
   * 接了真实接口之后不能再留。下单也不会自动触发（见 hook 注释：StrictMode 下会出两个订单），
   * 只能由「立即支付」这一次点击发起。
   */
  const pay = useWechatNativePay();

  // Toast message
  const [toast, setToast] = useState<string | null>(null);
  /**
   * 提示。上一条的定时器要清掉：连着两条提示时，前一条的定时器会提前把后一条清掉，
   * 用户就看不到真正要紧的那句（填报页踩过，这里同款修法）。
   */
  const toastTimerRef = useRef<number | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3000);
  };
  useEffect(
    () => () => {
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    },
    []
  );

  // Triggered when user clicks "立即支付"
  const handleStartPayment = () => {
    if (!hasAgreed) {
      showToast('请先勾选同意《委托代理服务协议》');
      return;
    }
    if (!pay.configured) {
      // 路径没配就别开一个只有空气的收银台
      showToast('在线支付尚未开通，请联系专属顾问完成付款');
      return;
    }
    if (!busUnionId) {
      // 没有单号下不了单：服务端要靠它认这笔委托单（单号在第 1 步生成方案时由服务端给出）
      showToast('缺少委托单号，请返回第 1 步重新生成方案');
      return;
    }

    setShowPayModal(true);
    // 一次点击只发一次：hook 的 creating 相位会把按钮挡住，服务端没有去重键
    void pay.create({ payAmount: plan.finalPrice, busUnionId });
  };

  /**
   * 查单确认已支付（`phase === 'paid'`）才落订单与后续解锁。
   * 订单号 / 支付时间取查单返回的值；服务端没给就留空，前端不自己编。
   *
   * 两个回调**都要发**：`onUpdateOrder` 只改本页的运行时订单，`onPaymentSuccess` 让 App 把
   * 这份订单写进主体记录里的摘要 —— 顶栏（多主体下拉的状态徽标 / 「作废服务」入口）与
   * 支付成功页新开填报页的深链放行条件读的都是那份摘要。少发后者就是 2026-10 修的那个 bug。
   */
  useEffect(() => {
    if (pay.phase !== 'paid' || order.status === 'paid') return;

    const updatedOrder: PaymentOrder = {
      ...order,
      orderNo: pay.paidOrder?.orderNo || order.orderNo,
      status: 'paid',
      paidAt: pay.paidOrder?.payTime || new Date().toLocaleString('zh-CN', { hour12: false }),
      // 手机号只有服务端知道（本地不落）：查单带回 mobile 才补得上
      contactPhone: pay.paidOrder?.mobile || order.contactPhone,
      paymentMethod: payMethod,
      amount: plan.finalPrice
    };

    if (onUpdateOrder) onUpdateOrder(updatedOrder);
    // 带上这份订单：App 要把它写进主体记录的订单摘要（顶栏徽标 / 深链放行都读那份）
    if (onPaymentSuccess) onPaymentSuccess(updatedOrder);
    setShowPayModal(false);

    showToast('支付成功！委托代办已生效，已生成专属服务清单与企微顾问');
  }, [pay.phase, pay.paidOrder, order, payMethod, plan.finalPrice]);

  /**
   * 支付成功页「服务进度状态与办理清单」里的事项。
   *
   * **只有第 1 项**（申报资料填报与合规初审）：它才是这个页面真有功能的一件事（唯一的入口就是它，
   * 提交后状态与按钮都跟着它变）。原来还排着 2~7 项（市监送审 / 刻章 / 银行开户 / 税种核定 /
   * 记账托管 / 社保公积金），**那些功能目前都没有**，列在这里等于承诺了做不到的事 ——
   * 2026-10-08 按用户要求删掉，只留这一项。
   */
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
              </div>

              {/* Section 3: Payment Method Selection */}
              <div className="rounded-2xl p-5 sm:p-6 mb-5 border border-slate-200/80 bg-white">
                <h2 className="text-sm font-bold text-slate-800 mb-3">选择支付方式</h2>

                {/* 没有委托单号就下不了单（服务端要靠它认这笔委托单）。
                    这件事写在页面上，而不是等用户点了「立即支付」才弹一句 toast ——
                    上一次正是「渲染点漏传 busUnionId」这种错误，只弹 toast 时很难发现。 */}
                {!isPaid && !busUnionId && (
                  <div className="mb-3 p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 text-[11px] text-amber-900 leading-relaxed">
                    缺少委托单号，暂时无法在线支付：请返回第 1 步重新生成方案后再试。
                  </div>
                )}
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
                        {agentCard.name}
                      </span>
                    </div>
                    <div className="bg-white/80 backdrop-blur-xs rounded-xl p-2.5 border border-emerald-100/70 shadow-2xs">
                      <span className="text-[11px] text-slate-400 block font-medium">经办联系电话</span>
                      <span className="font-semibold text-slate-800 text-xs font-mono mt-0.5 block">
                        {agentCard.phone}
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
                        <span className="font-bold text-slate-800">专属顾问在线</span>
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
                    {effectiveSubmitted ? '资料已提交 · 专员初审中' : '申报资料待填报'}
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
                          {isCurrentActive && !effectiveSubmitted && (
                            <button
                              type="button"
                              id="btn-fill-details-new-tab"
                              onClick={openFillDetailsInNewTab}
                              className="px-4 py-1.5 rounded-xl bg-[#2AA894] hover:bg-[#1D6C5E] text-white font-bold text-xs shadow-sm hover:shadow transition-all cursor-pointer flex items-center gap-1"
                            >
                              <span>申报资料填报</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {isDone && index === 0 && (
                            <button
                              type="button"
                              id="btn-fill-details-new-tab"
                              onClick={openFillDetailsInNewTab}
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

            {/* 真实二维码：由下单接口返回的 codeURL 现渲染（不引外部图片，也不走后端截图） */}
            <div className="w-44 h-44 mx-auto bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col items-center justify-center mb-4 relative">
              {pay.phase === 'creating' && (
                <span className="text-xs text-slate-400">正在生成支付二维码…</span>
              )}

              {pay.phase !== 'creating' && pay.error && (
                <span className="text-xs text-red-500 leading-relaxed px-2">{pay.error}</span>
              )}

              {pay.phase !== 'creating' && !pay.error && pay.qr && (
                <PayQrCode source={pay.qr} className="w-36 h-36" />
              )}

              {pay.phase !== 'creating' && !pay.error && !pay.qr && (
                <span className="text-xs text-slate-400">
                  {pay.configured ? '暂未取到支付二维码' : '在线支付尚未开通'}
                </span>
              )}
            </div>

            <p className="text-xs text-slate-400 mb-3 leading-relaxed">
              请打开手机微信扫码完成付款
              <br />
              <span className="text-[11px] text-slate-400">
                {pay.phase === 'awaiting' && pay.remainingMs > 0
                  ? `二维码 ${Math.ceil(pay.remainingMs / 1000)} 秒后失效`
                  : '付款完成后本页面会自动刷新状态'}
              </span>
            </p>

            {/* 轮询期间的网络抖动只是提示，二维码照常显示（别把人正扫的码卸载掉） */}
            {pay.pollError && (
              <p className="text-[11px] text-amber-600 mb-3 leading-relaxed">
                查询支付结果暂时不通（已重试 {pay.pollError.attempts} 次），二维码仍可继续扫
              </p>
            )}

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowPayModal(false)}
                className="flex-1 py-2.5 rounded-full border border-slate-200 text-slate-600 font-medium text-xs hover:bg-slate-50 transition-colors cursor-pointer"
              >
                稍后支付
              </button>
              {/* 重新出码：二维码过期不可复用，必须换新订单（下单失败也不自动重试） */}
              <button
                type="button"
                disabled={!pay.configured || !busUnionId || pay.phase === 'creating'}
                onClick={() => void pay.restart({ payAmount: plan.finalPrice, busUnionId: busUnionId ?? '' })}
                className="flex-1 py-2.5 rounded-full bg-[#36B39E] hover:bg-[#2AA894] text-white font-bold text-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pay.phase === 'awaiting' ? '二维码失效？重新出码' : '重新出码'}
              </button>
            </div>
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

            <div className="space-y-4 text-xs text-slate-600 leading-relaxed max-h-[55vh] overflow-y-auto pr-2">
              <div>
                <h4 className="text-sm font-bold text-slate-800 mb-1">班步一企通服务委托单</h4>
                <p>
                  委托方委托上海班步企程科技有限公司（以下简称“受托方”）提供班步一企通相关企业服务。本文列明可提供的服务范围、标准价格和双方的一般权利义务。<strong className="text-slate-800">具体购买的服务项目、优惠、服务期限和应付金额，以双方确认的订单或服务确认记录为准；仅列于本文的项目，不视为已经购买。</strong>
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/70">
                <p className="font-medium text-slate-800 mb-0.5">
                  {/*
                    甲方 = 第 1 步验证过的经办手机号。原来的 `order.contactName` 从来没有任何地方采集
                    （填报页那个「经办人姓名」只在前面的清单里显示破折号），协议上就一直是「＿＿＿＿」，
                    等于没写委托方是谁。
                  */}
                  委托方（甲方）：{order.contactPhone || '＿＿＿＿'}
                </p>
                <p className="font-medium text-slate-800">受托方（乙方）：上海班步企程科技有限公司</p>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 text-xs mb-1.5">一、服务内容及标准价格</h4>

                <div className="space-y-2.5">
                  <div className="pl-2.5 border-l-2 border-[#36B39E]/30">
                    <h5 className="font-bold text-slate-800 text-xs mb-0.5">1. 注册代理服务</h5>
                    <p className="mb-1"><strong className="text-slate-800">标准价格：人民币 600 元／户次。</strong></p>
                    <p className="mb-1">
                      包括 AI 注册咨询、企业名称申报协助、法定代表人和股东实名认证协助、设立登记办理、营业执照领取及约定印章刻制。受托方交付营业执照及约定印章后，本项服务完成。银行开户、税务报到等后续事项属于其他服务。
                    </p>
                    <p>
                      注册代理服务单独计费，与零申报服务独立核算。首次合作并购买一年期税务／财税托管服务的，可减免注册代理服务费；具体优惠以双方确认的订单为准。已单独收取的注册代理服务费不抵扣后续服务费。
                    </p>
                  </div>

                  <div className="pl-2.5 border-l-2 border-[#36B39E]/30">
                    <h5 className="font-bold text-slate-800 text-xs mb-0.5">2. 税务／财税托管服务</h5>
                    <p className="mb-1"><strong className="text-slate-800">标准价格：小规模纳税人人民币 2,500 元／年；一般纳税人人民币 3,000 元／年。</strong></p>
                    <p className="mb-1">
                      标准范围包括银行开户协助、税务报到、票据整理及记账、纳税申报、申报回执及账务资料归档、月度基础报表与对账、税务事项提醒及财税基础风险提示、基础税务／财税咨询、发票开具协助、年度汇算清缴及工商年报办理协助。具体办理项目、资料传递与交付方式以双方确认的服务订单及办理安排为准；银行开户、税务事项的办理结果以有关机构审核为准。
                    </p>
                    <p>
                      历史账务补录、补申报、税务异常处理、工商变更或注销、专项审计等超出标准范围的事项，双方另行确认服务内容及费用。
                    </p>
                  </div>

                  <div className="pl-2.5 border-l-2 border-[#36B39E]/30">
                    <h5 className="font-bold text-slate-800 text-xs mb-0.5">3. 零申报服务</h5>
                    <p className="mb-1"><strong className="text-slate-800">标准价格：人民币 600 元／年。</strong></p>
                    <p className="mb-1">
                      包括符合适用条件的基础纳税申报维护、申报回执整理与反馈、基础税务提醒及标准范围内的基础税务咨询。
                    </p>
                    <p className="mb-1">
                      零申报应以真实经营情况和税务规定为依据。企业发生收入、成本费用、工资薪金、开票或其他影响申报口径的事项时，委托方应及时告知受托方；双方应据实调整申报和服务范围。企业没有收入，不当然意味着可以按零申报处理。零申报服务不包含实际经营账务处理、发票开具、异常处理、税务变更、注销等事项。
                    </p>
                    <p>
                      委托方改购一年期税务／财税托管服务的，已支付的当期零申报服务费可抵扣人民币 600 元，抵扣与服务衔接以双方确认的订单为准；注册代理服务费不参与抵扣。<strong className="text-slate-800">经营情况变化不自动产生购买一年期服务或扣款的义务。</strong>
                    </p>
                  </div>

                  <div className="pl-2.5 border-l-2 border-[#36B39E]/30">
                    <h5 className="font-bold text-slate-800 text-xs mb-0.5">4. 人力资源托管服务</h5>
                    <p className="mb-1">
                      <strong className="text-slate-800">标准价格：人民币 20 元／人／月。</strong>计费人数按当月实际在缴社保／公积金人数与当月个人所得税申报人数两者中的较高值计算，具体人数由双方核对。
                    </p>
                    <p>
                      标准范围包括社保及公积金增减员和缴费办理、薪资核算及工资表制作、个人所得税扣缴申报、月度明细与回执归档、人力资源基础管理及基础合规咨询。工资、税款、社保和公积金等应缴款项由委托方承担。
                    </p>
                  </div>

                  <div className="pl-2.5 border-l-2 border-[#36B39E]/30">
                    <h5 className="font-bold text-slate-800 text-xs mb-0.5">5. 政府补贴服务</h5>
                    <p className="mb-1">
                      <strong className="text-slate-800">标准价格：按单个项目实际到账的补贴金额分段累进计费，0—10 万元部分为 15%，超过 10 万元部分为 10%。</strong>同一项目分批到账的，按累计到账金额核算，并扣除该项目已支付的服务费；未到账部分不收取对应服务费。
                    </p>
                    <p>
                      标准范围包括政策匹配、申报资格初步判断、材料清单整理、材料规范化及系统填报协助、进度跟进、结果反馈和资料归档。具体申报项目须由双方另行确认。申报条件、受理与审核结果、补贴金额和拨付时间，以政府部门、园区或主管单位的最终结果为准，受托方不承诺申报成功或补贴到账。合作期间已经双方确认并完成申报的项目，合作结束后到账的，仍按本项约定结算。
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 text-xs mb-1.5">二、双方责任与服务办理</h4>
                <ol className="list-decimal pl-5 space-y-1">
                  <li>委托方应及时提供真实、准确、完整的资料、原始凭证和必要授权，完成身份核验、信息确认及依法应由其承担的费用支付。因资料不实、不全或配合延迟产生的后果，按实际原因及各方过错承担责任。</li>
                  <li>受托方按双方确认的项目和服务范围办理事项，及时反馈进度及结果，对自身过错依法承担责任。因主管部门、银行或第三方系统故障影响办理的，受托方应及时告知并协助处理。</li>
                  <li>涉及代理记账的，双方应在具体服务订单或配套文件中明确会计资料的交接、签收，财务会计报告的编制与提供、会计档案保管及终止后的会计业务交接方式。</li>
                  <li>服务事项增加、调整或超出标准范围的，双方应另行确认对应的服务内容及费用。政策、主管部门要求或办理系统规则变化时，双方应按实际要求协商调整办理安排。</li>
                  <li>涉及 UKey、U 盾、账号、密码或电子印章等介质或权限代管的，双方另行确认交接内容、使用范围、保管责任及返还方式。受托方不得超出授权范围使用。</li>
                </ol>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 text-xs mb-1.5">三、保密与信息保护</h4>
                <p className="mb-1">
                  双方应对合作中知悉的经营信息、财税资料、员工个人信息、薪酬社保信息及账号授权信息保密，并采取合理的安全措施。除履行已确认服务及法律法规要求外，不得超出委托目的使用或向无关第三方披露；合作结束后保密义务继续有效。
                </p>
                <p>
                  政府补贴项目需由第三方机构协助办理，或需向园区运营方、合作服务机构提供相关数据的，受托方应在具体项目中明确接收方、处理目的、必要的数据范围及安全责任。涉及个人信息的，应依法履行告知、取得同意等义务；企业确认本文不替代相关个人依法需要作出的同意。
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 text-xs mb-1.5">四、变更、终止与结算</h4>
                <p>
                  双方对具体服务的购买、期限、优惠和付款作单独确认。服务到期后的续期及价格，以届时双方确认的订单或续费记录为准。任一方拟终止具体服务的，应通知对方，并配合办理已开展事项的确认、会计及其他资料交接、介质返还、权限解除和费用结算。已经履行的服务及已完成申报而后续到账的补贴项目，按相应约定结算；未履行部分的费用由双方根据实际履行情况和适用法律处理。
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 text-xs mb-1.5">五、确认方式</h4>
                <p className="mb-1">
                  双方通过签署、电子确认或其他能够识别确认主体和确认内容的方式确认本文。订单或服务确认记录应载明实际购买的项目、期限、应付金额及适用优惠，并与本文共同构成相应服务的依据；针对具体项目的确认与本文不一致的，以该项目的具体约定为准。线上确认时，应向委托方展示可查阅的协议内容，并对价格、续费、责任限制等有重大利害关系的条款作出醒目提示，留存确认内容、操作人、时间及对应订单记录。
                </p>
                <p>
                  企业尚未设立时，注册代理事项由实际申请人确认；企业成立后的其他服务，由企业或有权代表企业的人员另行确认。
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

              {/* Policy notes —— 末尾原来还有一句「办结物料顺丰安全包邮寄达」，2026-10-08 按用户要求删掉 */}
              <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200/60 text-emerald-800 text-[11px]">
                <strong>服务保障承诺：</strong>所选套餐与增值服务已完全缴清，绝无任何二次巧立名目加价。
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
              {wecomQr.loading ? (
                <span className="text-[11px] text-slate-400 leading-relaxed px-2">
                  正在获取专属顾问二维码…
                </span>
              ) : (
                <img src={wecomQr.url} alt="专属顾问企业微信二维码" className="w-full h-full object-contain" />
              )}
            </div>
            <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60 inline-block mt-1">企业微信官方认证</span>
            <p className="text-[11px] text-slate-400 mt-2">微信扫一扫添加，专属顾问全程跟进代办</p>
          </div>
        </div>
      )}

    </div>
  );
};
