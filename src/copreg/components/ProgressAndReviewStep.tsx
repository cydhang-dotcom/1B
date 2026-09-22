/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { TimelineNode, RegistrationPlan, RegistrationDetails, PaymentOrder, ReviewBranch } from '../types';
import {
  Activity,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Send,
  Truck,
  FileCheck,
  Award,
  RefreshCw,
  PenTool,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  HelpCircle,
  QrCode,
  Building,
  Landmark,
  FileBadge,
  Printer,
  Download,
  PhoneCall,
  Check
} from 'lucide-react';

/**
 * 演示态的办理进度节点：从签约开始的 9 个节点，用户点击推进时由本组件往下更新状态。
 * 同样是演示态，不随「从零填写」清空。
 */
export const INITIAL_TIMELINE_NODES: TimelineNode[] = [
  {
    id: 'tl-1',
    stepNumber: 1,
    title: '企业设立需求确认与方案定制',
    operator: '系统自动生成',
    dept: '智能系统',
    time: '2026-09-15 10:00',
    status: 'done',
    detail: '客户提交初步业务调研问卷，系统根据行业算法生成《定制设立方案与服务报价单》。'
  },
  {
    id: 'tl-2',
    stepNumber: 2,
    title: '服务协议确认与在线安全支付',
    operator: '客户本人',
    dept: '结算中心',
    time: '2026-09-15 10:05',
    status: 'done',
    detail: '完成短信验证码安全核验与在线缴费，系统已自动开具电子付款凭证并指派专属顾问。'
  },
  {
    id: 'tl-3',
    stepNumber: 3,
    title: '建立专属服务群与办理节点告知',
    operator: '顾问 Lisa / 智能AI',
    dept: '客户服务部',
    time: '2026-09-15 10:06',
    status: 'done',
    detail: '已拉起企微专属交付保障群，明确申报步骤、资料清单及责任交付时效。'
  },
  {
    id: 'tl-4',
    stepNumber: 4,
    title: '详细注册信息申报与资料上传',
    operator: '客户 / 系统预审',
    dept: '登记中心',
    time: '2026-09-15 10:28',
    status: 'done',
    detail: '企业字号自主排查、法定代表人及股东身份核实完毕，证件扫描件及住所证明已上传。'
  },
  {
    id: 'tl-5',
    stepNumber: 5,
    title: '客服人员合规初审与订单资料转交',
    operator: '客服 Lisa',
    dept: '客户服务部',
    time: '2026-09-15 10:45',
    status: 'current',
    detail: '客服团队核对申报字号与身份证清晰度。资料齐全无误，已正式转交政务交付团队。'
  },
  {
    id: 'tl-6',
    stepNumber: 6,
    title: '市场监督管理局网申与股东电子签名',
    operator: '交付团队 张经理',
    dept: '政务交付部',
    time: '待办',
    status: 'waiting',
    detail: '政务平台提交立项，需全体股东及法定代表人完成移动端微信/支付宝小程序人脸活体电子签名。',
    requiresAction: true,
    actionName: '进行人脸电子签名'
  },
  {
    id: 'tl-7',
    stepNumber: 7,
    title: '市监局审核出件与营业执照核发',
    operator: '行政审批中心',
    dept: '市场监督管理局',
    time: '预计 1 工作日内',
    status: 'waiting',
    detail: '审批通过后，生成统一社会信用代码并打印营业执照正副本原件。'
  },
  {
    id: 'tl-8',
    stepNumber: 8,
    title: '公安局特行备案芯片防伪印章刻制',
    operator: '指定印章中心',
    dept: '公安局印章备案系统',
    time: '预计 1 工作日内',
    status: 'waiting',
    detail: '防伪公章、财务章、法人私章、发票章、合同章五枚全套芯片章刻制及备案卡发放。'
  },
  {
    id: 'tl-9',
    stepNumber: 9,
    title: '执照印章顺丰专递与银行开户预约',
    operator: '顺丰速运专员',
    dept: '物流交付部',
    time: '出照后当日寄发',
    status: 'waiting',
    detail: '加急顺丰特快寄送至客户指定收件地址，同步推送银行预约开户号及开业财税指南。'
  }
];

interface ProgressAndReviewStepProps {
  timeline: TimelineNode[];
  plan: RegistrationPlan;
  details: RegistrationDetails;
  order: PaymentOrder;
  onUpdateTimeline: (nodes: TimelineNode[]) => void;
  /** 资料审核分支与银行预约是演示态，存在 App 里，切步骤再回来不会丢 */
  reviewBranch: ReviewBranch;
  onUpdateReviewBranch: (branch: ReviewBranch) => void;
  bankBooked: boolean;
  onUpdateBankBooked: (booked: boolean) => void;
  onGoToChat: () => void;
}

export const ProgressAndReviewStep: React.FC<ProgressAndReviewStepProps> = ({
  timeline,
  plan,
  details,
  order,
  onUpdateTimeline,
  reviewBranch,
  onUpdateReviewBranch,
  bankBooked,
  onUpdateBankBooked,
  onGoToChat
}) => {
  const [isFixSubmitted, setIsFixSubmitted] = useState(false);
  const [showSignModal, setShowSignModal] = useState(false);
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [showSealModal, setShowSealModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  /**
   * 是否已完成股东人脸签名，以 timeline 的节点 6 为准。
   * timeline 在 App 里、切步骤不会丢，这里再存一份的话，签完名离开再回来就会出现
   * 「看板显示等待签名、节点却已经 done」的矛盾。
   */
  const isSigned = timeline.some(
    (node) => node.stepNumber === 6 && node.status === 'done'
  );

  /**
   * 企业名称、法定代表人、收件地址来自第 5 步「企业注册申报资料填报」提交时回写的摘要
   * （见 RegistrationDetailsStep 的 handleSubmit）。没提交就进不来这一页，但摘要里
   * 仍可能有个别字段是空的（例如申报表没填经营地址）——直接渲染会出现「法定代表人：【】」，
   * 所以空值统一给个占位，不编造。
   */
  const pendingSync = '待同步';

  /**
   * 提示。上一条的定时器要清掉：连着两条提示时，前一条的定时器会提前把后一条清掉，
   * 用户就看不到真正要紧的那句（填报页踩过，这里同款修法）。
   */
  const toastTimerRef = useRef<number | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2500);
  };
  useEffect(
    () => () => {
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    },
    []
  );

  const handleFixAndResubmit = () => {
    setIsFixSubmitted(true);
    showToast('已重新上传清晰证件扫描件，客服 Lisa 正在进行二次复核…');
    setTimeout(() => {
      onUpdateReviewBranch('complete');
      showToast('客服 Lisa 复核通过！资料齐全无误，已正式转交政务交付团队 D');
    }, 1500);
  };

  const handleCompleteSignature = () => {
    setShowSignModal(false);
    showToast('全体股东活体人脸识别比对一致，电子签名已回传市政务网申系统！');

    // Update timeline nodes to advance through 6, 7, 8, 9
    const updated = timeline.map((node) => {
      if (node.stepNumber === 6) {
        return {
          ...node,
          status: 'done' as const,
          detail: '全体股东及法定代表人已通过微信小程序完成活体人脸识别与数字证书电子签名。',
          requiresAction: false
        };
      }
      if (node.stepNumber === 7) {
        return {
          ...node,
          status: 'done' as const,
          time: '已核发',
          detail: '市场监督管理局已审核通过，统一社会信用代码随电子执照一并下发。'
        };
      }
      if (node.stepNumber === 8) {
        return {
          ...node,
          status: 'done' as const,
          time: '已刻制',
          detail: '公安特行备案芯片防伪印章已雕刻成型并录入市公安防伪印鉴系统。'
        };
      }
      if (node.stepNumber === 9) {
        return {
          ...node,
          status: 'done' as const,
          time: '已寄出',
          detail: '证照章已交付顺丰特快专递，发出后单号会同步到本页。'
        };
      }
      return node;
    });

    onUpdateTimeline(updated);
  };

  return (
    <div className="pb-32">

      <div className="relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 pb-4 relative z-10">

          {/* Top Step Heading */}
          <section className="mb-5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#E6F7F2] text-[#2AA894] mb-2 select-none">
              <span className="w-1.5 h-1.5 rounded-full bg-[#36B39E]"></span>
              <span>第 5 步 · 进度追踪</span>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold tracking-tight mb-1.5">
              <span className="text-[#2AA894]">第 5 步：</span><span className="text-[#1D6C5E]">企业开办与政务交付办理进度</span>
            </h1>

            <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
              实时追踪客服初审、市监局政务网申审批、公安备案印章刻制及物流进度。
            </p>
          </section>

          {/* ==================== 01 核心状态指标看板 ==================== */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className="p-3.5 rounded-xl bg-white border border-slate-200/80">
              <span className="text-[11px] text-slate-400 block mb-1">受理流水号</span>
              <span className="font-mono font-bold text-xs sm:text-sm text-slate-800">
                {order.orderNo || '待生成'}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-slate-200/80">
              <span className="text-[11px] text-slate-400 block mb-1">市监审批状态</span>
              <span className="font-bold text-xs sm:text-sm text-[#2AA894] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                {isSigned ? '终审通过 · 已核准' : '等待股东人脸签名'}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-slate-200/80">
              <span className="text-[11px] text-slate-400 block mb-1">防伪印章刻制</span>
              <span className="font-bold text-xs sm:text-sm text-slate-800">
                {isSigned ? '5枚全套已备案出件' : '等待出照联动刻制'}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-slate-200/80">
              <span className="text-[11px] text-slate-400 block mb-1">顺丰专递物流</span>
              <span className="font-bold text-xs sm:text-sm text-slate-800">
                {isSigned ? '发货后同步单号' : '出照后当日揽件'}
              </span>
            </div>
          </div>

          {/* ==================== 02 资料审核与协同流转状态 ==================== */}
          <div className="rounded-2xl p-5 sm:p-6 mb-5 border border-slate-200/80 bg-white">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#E6F7F2] text-[#2AA894] select-none mb-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#36B39E]"></span>
                  <span>协同状态</span>
                </div>
                <h3 className="text-sm sm:text-base font-bold text-slate-800">
                  资料审核与协同流转进度
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  办理流转状态：支持切换查看【资料齐全 · 转交政务交付】与【资料有误 · 客服提示补正】
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onUpdateReviewBranch('complete');
                    setIsFixSubmitted(false);
                  }}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                    reviewBranch === 'complete'
                      ? 'bg-[#E6F7F2] text-[#2AA894] border-[#36B39E]'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  资料齐全 · 转交交付
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onUpdateReviewBranch('incomplete');
                    setIsFixSubmitted(false);
                  }}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                    reviewBranch === 'incomplete'
                      ? 'bg-amber-50 text-amber-900 border-amber-300'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  资料有误 · 提示补正
                </button>
              </div>
            </div>

            {/* Branch Content Banner */}
            {reviewBranch === 'incomplete' ? (
              <div className="mt-3.5 p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-bold text-amber-900 block">
                      客服 Lisa 发送补正通知：证件扫描件边缘反光
                    </span>
                    <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                      “您好！您上传的法定代表人身份证反面国徽面有拍摄反光，遮挡了有效期限。请重新补充上传清晰文件，客服将即时为您安排加急复核！”
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleFixAndResubmit}
                  disabled={isFixSubmitted}
                  className="w-full sm:w-auto px-4 py-1.5 rounded-full bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium transition-colors shrink-0 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isFixSubmitted ? 'animate-spin' : ''}`} />
                  <span>{isFixSubmitted ? '正在重新复核…' : '一键重新上传清晰证件'}</span>
                </button>
              </div>
            ) : (
              <div className="mt-3.5 p-3.5 rounded-xl bg-[#F4FCFA] border border-[#D1F2EB] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#2AA894] shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      客服初审合格：订单及全套资料已转交政务交付团队
                    </span>
                    <p className="text-xs text-slate-500 mt-0.5">
                      法定代表人与股东身份证明、经营场所住所文件齐全规范，交付专员已完成政务系统建档网申。
                    </p>
                  </div>
                </div>
                <span className="text-xs font-medium text-[#2AA894] bg-white px-2.5 py-0.5 rounded-full border border-[#D1F2EB] shrink-0">
                  审核流转中
                </span>
              </div>
            )}
          </div>

          {/* ==================== 03 电子签名急需待办提示卡 ==================== */}
          {!isSigned && reviewBranch === 'complete' && (
            <div className="bg-[#F4FCFA] rounded-2xl p-4 sm:p-5 border border-[#D1F2EB] mb-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#36B39E] text-white flex items-center justify-center shrink-0">
                    <PenTool className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 animate-pulse">
                        政务系统待办通知
                      </span>
                      <h3 className="font-bold text-slate-800 text-xs sm:text-sm">
                        全体股东与法定代表人进行人脸识别与电子签名
                      </h3>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      依据政务登记规定，请法定代表人{details.legalRepresentative.name ? `【${details.legalRepresentative.name}】` : ''}及全体股东完成微信端活体人脸识别及 CA 电子签名。签署完成后市监局秒级出照！
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowSignModal(true)}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-full bg-[#36B39E] hover:bg-[#2AA894] text-white font-medium text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <PenTool className="w-3.5 h-3.5" />
                  <span>立即进行人脸电子签名</span>
                </button>
              </div>
            </div>
          )}

          {/* ==================== 04 全流程办理全景进度图 ==================== */}
          <div className="rounded-2xl p-5 sm:p-6 mb-5 border border-slate-200/80 bg-white">
            <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-slate-100">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#E6F7F2] text-[#2AA894] select-none">
                <span className="w-1.5 h-1.5 rounded-full bg-[#36B39E]"></span>
                <span>全景节点 · 9大关键办理阶段</span>
              </div>

              <button
                type="button"
                onClick={onGoToChat}
                className="text-xs font-medium text-[#2AA894] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>联系群内顾问</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <h2 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight mb-5">
              企业设立全流程办理全景图
            </h2>

            {/* Timeline Nodes */}
            <div className="space-y-4 relative pl-4 sm:pl-5 border-l-2 border-slate-100">
              {timeline.map((node) => {
                const isDone = node.status === 'done';
                const isCurrent = node.status === 'current';

                return (
                  <div key={node.id} className="relative group">
                    {/* Status Dot */}
                    <div className={`absolute -left-[23px] sm:-left-[27px] top-1 w-3.5 h-3.5 rounded-full border-2 border-white flex items-center justify-center ${
                      isDone
                        ? 'bg-[#36B39E] text-white'
                        : isCurrent
                        ? 'bg-blue-600 text-white ring-2 ring-blue-100 animate-pulse'
                        : 'bg-slate-300'
                    }`}>
                      {isDone && <Check className="w-2 h-2 stroke-[3]" />}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-slate-400 font-mono">0{node.stepNumber}</span>
                        <h4 className={`text-xs sm:text-sm font-bold ${
                          isDone ? 'text-slate-800' : isCurrent ? 'text-blue-700' : 'text-slate-500'
                        }`}>
                          {node.title}
                        </h4>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span className="font-medium text-slate-600">{node.operator} · {node.dept}</span>
                        <span>•</span>
                        <span>{node.time}</span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 leading-relaxed bg-slate-50/70 p-2.5 rounded-xl border border-slate-100 mt-1">
                      {node.detail}
                    </p>

                    {node.requiresAction && !isSigned && (
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={() => setShowSignModal(true)}
                          className="px-3.5 py-1 rounded-full bg-[#36B39E] hover:bg-[#2AA894] text-white text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <PenTool className="w-3 h-3" />
                          <span>{node.actionName || '立即办理'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ==================== 05 交付成果物：营业执照正本与防伪印章 ==================== */}
          {isSigned && (
            <div className="rounded-2xl p-5 sm:p-6 border border-slate-200/80 bg-white mb-5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-[#2AA894]" />
                  <div>
                    <h3 className="font-bold text-sm sm:text-base text-slate-800">企业设立交付成果物（已出照及刻制）</h3>
                    <span className="text-xs text-slate-500">已核准统一社会信用代码，支持扫码验真与下载</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSealModal(true)}
                    className="px-3.5 py-1.5 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium text-xs border border-slate-200 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <span>查看印章备案卡</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowLicenseModal(true)}
                    className="px-3.5 py-1.5 rounded-full bg-[#E6F7F2] hover:bg-[#D1F2EB] text-[#2AA894] font-medium text-xs flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <span>查看电子营业执照样件</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">企业法定名称：</span>
                    <span className="font-bold text-slate-800">{details.primaryName || pendingSync}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">统一社会信用代码：</span>
                    {/* 信用代码由市监局核发，受理前不可能知道，不能编一个 */}
                    <span className="font-mono font-bold text-[#2AA894]">待核准</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">法定代表人：</span>
                    <span className="font-bold text-slate-800">{details.legalRepresentative.name || pendingSync}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">注册资本：</span>
                    <span className="font-bold text-slate-800">{plan.capitalAmount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">成立日期：</span>
                    <span className="font-bold text-slate-800">待核准</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                  <div className="flex items-center gap-2 text-slate-800 font-bold">
                    <Truck className="w-4 h-4 text-[#2AA894]" />
                    {/* 快递单号要等真正发货后由顺丰回传，不能预先编一个 */}
                    <span>顺丰特快寄送专递（发货后同步单号）</span>
                  </div>
                  <p className="text-slate-500 text-[11px] leading-relaxed">
                    加急保价专递包：营业执照正副本原件、公安防伪芯片章5枚、公司章程归档原件、密码卡。
                  </p>
                  <div className="flex items-center gap-1.5 text-[11px] text-[#2AA894] bg-[#E6F7F2] px-2 py-0.5 rounded-lg font-medium">
                    <Clock className="w-3 h-3" />
                    <span>顺丰已于深圳湾营业点揽件，预计次日上午 10:00 前送达</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    收件地址：
                    {[details.officeAddress.region, details.officeAddress.detail].filter(Boolean).join(' ') || pendingSync}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ==================== 06 银行开户与首期税务建账启用 ==================== */}
          <div className="rounded-2xl p-5 sm:p-6 border border-slate-200/80 bg-white mb-6">
            <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Landmark className="w-5 h-5 text-[#2AA894]" />
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-slate-800">对公银行开户预约与首期税务建账</h3>
                  <span className="text-xs text-slate-500">凭执照与印章即可无缝前往银行开立对公基本账户</span>
                </div>
              </div>

              <button
                type="button"
                disabled={bankBooked}
                onClick={() => {
                  onUpdateBankBooked(true);
                  showToast('已成功预约招商银行高新支行绿色通道开户专窗！');
                }}
                className="px-4 py-1.5 rounded-full bg-[#36B39E] hover:bg-[#2AA894] text-white text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
              >
                {bankBooked ? '已预约招行绿色通道' : '一键预约合作银行开户'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="font-bold text-slate-800 block mb-1">招商银行（高新支行）</span>
                <p className="text-slate-500 text-[11px]">免网银年费、免首年账户管理费，开户即赠送企业银企直联系统。</p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="font-bold text-slate-800 block mb-1">中国工商银行（科技园支行）</span>
                <p className="text-slate-500 text-[11px]">跨境结汇首选通道，支持多币种国际结算与贸易外汇收支名录登记。</p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="font-bold text-slate-800 block mb-1">首月财税合规陪伴包</span>
                <p className="text-slate-500 text-[11px]">资深注册会计师王老师已为您搭建电子税务局初始账套与发票核定。</p>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Signature Modal */}
      {showSignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl flex flex-col border border-slate-200/80">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#2AA894]" />
                <h3 className="font-bold text-slate-800 text-sm">政务人脸识别与数字证书在线签名</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSignModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none cursor-pointer"
              >
                ×
              </button>
            </div>

            <div className="text-xs text-slate-500 space-y-3 mb-4">
              <p>请法定代表人【{details.legalRepresentative.name}】进行工商设立登记签名核验。</p>

              {/* Simulated Signature Box */}
              <div className="border border-dashed border-slate-300 rounded-xl h-36 bg-slate-50 flex flex-col items-center justify-center relative overflow-hidden">
                <div className="text-slate-400 text-xs flex flex-col items-center gap-1">
                  <PenTool className="w-5 h-5 text-slate-400" />
                  <span>在虚线框内完成手写签名（演示模式支持一键签署）</span>
                </div>
                <div className="absolute font-cursive text-3xl text-slate-800 rotate-[-5deg] font-bold select-none opacity-85">
                  {details.legalRepresentative.name || '（待签名）'}
                </div>
              </div>
              <p className="text-[11px] text-slate-400">
                点击确认即代表您已授权生成国家市场监督管理局认可的个人 CA 数字证书并完成实名署名。
              </p>
            </div>

            <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowSignModal(false)}
                className="px-4 py-1.5 rounded-full border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleCompleteSignature}
                className="px-5 py-1.5 rounded-full bg-[#36B39E] hover:bg-[#2AA894] text-white text-xs font-medium shadow-xs transition-colors cursor-pointer"
              >
                完成签署并提交政务系统
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Official Business License Modal */}
      {showLicenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-[#FFFDF7] rounded-2xl max-w-xl w-full p-6 sm:p-7 shadow-xl border-2 border-[#C5A059] relative flex flex-col max-h-[90vh] overflow-y-auto">
            {/* Watermark Emblem */}
            <div className="text-center pb-4 border-b border-[#C5A059]/30 mb-4">
              <div className="w-10 h-10 rounded-full border border-red-600 mx-auto mb-1.5 flex items-center justify-center text-red-600 font-bold text-xs">
                国徽
              </div>
              <h2 className="text-lg sm:text-xl font-bold tracking-widest text-[#5A3E1B]">营业执照</h2>
              <span className="text-[10px] tracking-wider text-[#8C6D3F] block font-serif">（正本）</span>
              <p className="text-xs font-mono font-bold text-slate-800 mt-1">
                统一社会信用代码：待核准
              </p>
            </div>

            <div className="space-y-2 text-xs text-slate-800 leading-relaxed">
              <div className="flex">
                <span className="w-24 font-bold text-[#5A3E1B] shrink-0">名 称：</span>
                <span className="font-bold">{details.primaryName}</span>
              </div>
              <div className="flex">
                <span className="w-24 font-bold text-[#5A3E1B] shrink-0">类 型：</span>
                <span>{plan.companyType}</span>
              </div>
              <div className="flex">
                <span className="w-24 font-bold text-[#5A3E1B] shrink-0">法定代表人：</span>
                <span className="font-bold">{details.legalRepresentative.name}</span>
              </div>
              <div className="flex">
                <span className="w-24 font-bold text-[#5A3E1B] shrink-0">注册资本：</span>
                <span>{plan.capitalAmount}</span>
              </div>
              <div className="flex">
                <span className="w-24 font-bold text-[#5A3E1B] shrink-0">成立日期：</span>
                <span>待核准</span>
              </div>
              <div className="flex">
                <span className="w-24 font-bold text-[#5A3E1B] shrink-0">住 所：</span>
                <span>{details.officeAddress.region} {details.officeAddress.detail}</span>
              </div>
              <div className="flex">
                <span className="w-24 font-bold text-[#5A3E1B] shrink-0">经营范围：</span>
                <span className="text-[11px] text-slate-600">{plan.preQualifications.concat(plan.postQualifications).join('；')}等</span>
              </div>
            </div>

            {/* Official SAMR Stamp */}
            <div className="mt-5 flex justify-between items-end pt-3 border-t border-[#C5A059]/20">
              <div className="text-center">
                <div className="w-14 h-14 bg-white border border-slate-300 p-1 flex items-center justify-center">
                  <QrCode className="w-12 h-12" />
                </div>
                <span className="text-[9px] text-slate-400 block mt-1">国家信用系统扫码验证</span>
              </div>

              <div className="text-right">
                <span className="text-xs font-bold text-[#5A3E1B] block">登记机关：深圳市市场监督管理局</span>
                <span className="text-xs text-slate-500 block">核准日期：待核准</span>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  window.print();
                  showToast('已唤起打印程序');
                }}
                className="px-4 py-1.5 rounded-full border border-[#C5A059] text-xs font-medium text-[#5A3E1B] hover:bg-[#C5A059]/10 cursor-pointer"
              >
                打印执照样件
              </button>
              <button
                type="button"
                onClick={() => setShowLicenseModal(false)}
                className="px-4 py-1.5 rounded-full bg-[#5A3E1B] text-white text-xs font-medium cursor-pointer"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Seal Inspection Modal */}
      {showSealModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl flex flex-col border border-slate-200/80">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-800 text-sm">公安特行备案防伪芯片印章清单（5枚全套）</h3>
              <button
                type="button"
                onClick={() => setShowSealModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none cursor-pointer"
              >
                ×
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              {[
                { name: '企业法定名称章（公章）', spec: '圆形直径40mm，内置RFID防伪芯片，刻制后由公安特行备案' },
                { name: '财务专用章', spec: '圆形直径38mm，专用于银行对公支票与财务往来款项' },
                { name: '法定代表人名章（私章）', spec: '方形18×18mm，用于银行开户与工商申报' },
                { name: '发票专用章', spec: '椭圆形40×30mm，符合国家税务总局发票印章规范' },
                { name: '合同专用章', spec: '圆形直径38mm，专用于对外商业协议与采购合同签署' }
              ].map((s, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800 block">{s.name}</span>
                    <span className="text-slate-500 text-[11px]">{s.spec}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-[#E6F7F2] text-[#2AA894] text-[10px] font-medium">
                    已办结出件
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowSealModal(false)}
                className="px-5 py-1.5 rounded-full bg-[#36B39E] hover:bg-[#2AA894] text-white text-xs font-medium cursor-pointer transition-colors"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-slate-900 text-white text-xs font-semibold shadow-xl flex items-center gap-2 animate-in fade-in duration-150">
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
};
