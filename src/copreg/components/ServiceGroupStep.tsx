/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ChatMessage, RegistrationPlan, PaymentOrder } from '../types';
import {
  Send,
  Bot,
  UserCheck,
  Calendar,
  FileCheck,
  Clock,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Users,
  CheckCircle2,
  AlertCircle,
  Megaphone,
  Shield,
  HelpCircle,
  FileText
} from 'lucide-react';

/**
 * 演示态的群聊记录：服务群按演示保留，不随「从零填写」清空，所以 App 直接拿它当初始值。
 * 用户之后发的消息由 App 追加，这里只负责开场白。
 */
export const INITIAL_CHAT_MESSAGES: ChatMessage[] = [
  {
    id: 'msg-1',
    sender: '企服系统助手',
    role: 'ai',
    roleTag: '7x24h 智能AI',
    avatar: '🤖',
    timestamp: '10:00',
    content: '🎉 恭喜您成功签约！系统已为您创建【企业设立专属交付服务群】。我们已指派资深企业顾问 Lisa、交付主管张经理及 7×24 小时智能 AI 助手全流程护航。'
  },
  {
    id: 'msg-2',
    sender: 'Lisa（资深企业顾问）',
    role: 'advisor',
    roleTag: '专属顾问',
    avatar: '👩‍💼',
    timestamp: '10:01',
    content: '您好！我是您的专属企业顾问 Lisa。接下来由我和交付团队为您办理公司设立。办理总周期预计为 3 个工作日，主要节点如下：\n1. 今天：核对公司字号与股东架构，线上上传证件资料。\n2. 明天：市监局自主核名并网申，推送股东全体人脸核验电子签名。\n3. 后天：领发执照与刻章备案，顺丰专递到您手中，并预约银行开户！'
  },
  {
    id: 'msg-3',
    sender: '张经理（交付团队主管）',
    role: 'delivery',
    roleTag: '交付专员',
    avatar: '👨‍💼',
    timestamp: '10:02',
    content: '您好！交付通道已开通，公司设立的全部办理节点会实时同步到「办理进度」页，您也可以直接在这里发送文件。有任何疑问我们会在 30 分钟内响应！'
  },
  {
    id: 'msg-4',
    sender: '企服系统助手',
    role: 'ai',
    roleTag: '7x24h 智能AI',
    avatar: '🤖',
    timestamp: '10:02',
    content: '💡 您可以随时向我提问：例如“需要股东都到现场吗？”、“新公司法实缴资本怎么算？”、“刻章需要哪些手续？”等，AI 助手将实时秒级解答。'
  }
];

interface ServiceGroupStepProps {
  plan: RegistrationPlan;
  order: PaymentOrder;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  /** 服务群之后的下一步：办理进度。资料填报已移到 registration.html，不再经过 copreg 的页面 */
  onProceedToProgress: () => void;
  onBackToPayment?: () => void;
}

export const ServiceGroupStep: React.FC<ServiceGroupStepProps> = ({
  plan,
  order,
  messages,
  onSendMessage,
  onProceedToProgress,
  onBackToPayment
}) => {
  const [inputText, setInputText] = useState('');

  const quickPrompts = [
    '法人和股东必须到政务现场吗？',
    '新《公司法》5年认缴实缴怎么算？',
    '公司名字怎么取市监通过率最高？',
    '银行开户需要带什么资料？',
    '第一年不记账报税会有什么后果？'
  ];

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text) return;
    onSendMessage(text);
    setInputText('');
  };

  const handleQuickPrompt = (p: string) => {
    onSendMessage(p);
  };

  return (
    <div className="pb-32">

      <div className="relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 pb-4 relative z-10">

          {/* Top Step Heading */}
          <section className="mb-5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#E6F7F2] text-[#2AA894] mb-2 select-none">
              <span className="w-1.5 h-1.5 rounded-full bg-[#36B39E]"></span>
              <span>第 4 步 · 专属服务群</span>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold tracking-tight mb-1.5">
              <span className="text-[#2AA894]">第 4 步：</span><span className="text-[#1D6C5E]">专属服务保障群（含专员与智能助手）</span>
            </h1>

            <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
              服务顾问、交付主管与智能助手已就位。办理节点、资料规范与常见问题可在此交流答疑。
            </p>
          </section>

          {/* Action Banner to Proceed to Next Step */}
          <div className="bg-[#F4FCFA] rounded-2xl p-4 sm:p-5 border border-[#D1F2EB] mb-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#36B39E] text-white flex items-center justify-center shrink-0">
                <FileCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#E6F7F2] text-[#2AA894]">
                    当前待办事项
                  </span>
                  <h3 className="font-bold text-slate-800 text-xs sm:text-sm">
                    查看企业开办办理进度与交付节点
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  资料申报、市监网申、股东电子签名、执照刻制与顺丰专递进度，均在办理进度页实时同步。
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onProceedToProgress}
              className="w-full sm:w-auto px-5 py-2.5 rounded-full bg-[#36B39E] hover:bg-[#2AA894] text-white font-medium text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
            >
              <span>查看办理进度</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Main Grid: Left Chat Window + Right Process & SLA Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* Left 2 Cols: Chat Window */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 flex flex-col h-[560px] overflow-hidden">

              {/* Chat Header */}
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#E6F7F2] text-[#2AA894] flex items-center justify-center text-xs font-bold">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-800 flex items-center gap-2">
                      企业设立专属交付服务群
                      <span className="text-[10px] font-normal px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800">
                        官方认证
                      </span>
                    </h4>
                    <div className="flex items-center gap-1 text-[11px] text-slate-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>4人在线：顾问 Lisa、主管张经理、AI小企、客户{order.contactName || '本人'}</span>
                    </div>
                  </div>
                </div>

                <span className="text-[11px] font-medium text-[#2AA894] bg-[#E6F7F2] px-2.5 py-0.5 rounded-full">
                  订单 {order.orderNo ? `${order.orderNo.slice(0, 10)}…` : '待生成'}
                </span>
              </div>

              {/* Pinned Group Announcement */}
              <div className="px-3.5 py-2 bg-[#FEF9EE] border-b border-[#FDE68A] flex items-start gap-2 text-xs text-amber-900">
                <Megaphone className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1 text-[11px] leading-relaxed">
                  <span className="font-bold">群公告：</span>
                  <span className="text-amber-800">
                    本群由专业团队提供 1对1 设立全流程陪伴。办理节点与资料核验结果会实时同步到「办理进度」页，我们将在 30 分钟内响应！
                  </span>
                </div>
              </div>

              {/* Messages Container */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-50/30">
                {messages.map((msg) => {
                  const isMe = msg.role === 'customer' || msg.isSelf;

                  return (
                    <div
                      key={msg.id}
                      className={`flex items-start gap-2.5 ${isMe ? 'flex-row-reverse' : ''}`}
                    >
                      <div className="w-7 h-7 rounded-full bg-white border border-slate-200 flex items-center justify-center text-xs shrink-0 select-none">
                        {msg.avatar}
                      </div>

                      <div className={`max-w-[85%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-[11px] font-medium text-slate-700">{msg.sender}</span>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-medium ${
                            msg.role === 'advisor'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : msg.role === 'delivery'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : msg.role === 'ai'
                              ? 'bg-[#E6F7F2] text-[#2AA894]'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {msg.roleTag}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">{msg.timestamp}</span>
                        </div>

                        <div
                          className={`p-3 rounded-xl text-xs leading-relaxed whitespace-pre-line ${
                            isMe
                              ? 'bg-[#36B39E] text-white rounded-tr-none font-medium'
                              : msg.role === 'ai'
                              ? 'bg-[#F4FCFA] border border-[#D1F2EB] text-slate-800 rounded-tl-none'
                              : 'bg-white border border-slate-200/80 text-slate-800 rounded-tl-none'
                          }`}
                        >
                          {msg.content}

                          {/* Interactive prompt payload if available */}
                          {msg.actionPayload && (
                            <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between gap-2">
                              <span className="text-[11px] font-semibold text-[#2AA894]">
                                {msg.actionPayload.title}
                              </span>
                              <button
                                type="button"
                                onClick={onProceedToProgress}
                                className="text-[11px] font-semibold text-white bg-[#36B39E] hover:bg-[#2AA894] px-2.5 py-0.5 rounded-full cursor-pointer transition-colors"
                              >
                                立即办理
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Quick Prompts Chips */}
              <div className="px-3 py-2 border-t border-slate-100 bg-white flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <span className="text-[10px] font-medium text-slate-400 shrink-0 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-[#36B39E]" />
                  快捷提问:
                </span>
                {quickPrompts.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleQuickPrompt(p)}
                    className="px-2.5 py-1 rounded-full text-[11px] bg-slate-50 hover:bg-[#E6F7F2] hover:text-[#2AA894] border border-slate-200 text-slate-600 shrink-0 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {p}
                  </button>
                ))}
              </div>

              {/* Input Bar */}
              <form onSubmit={handleSend} className="p-2.5 border-t border-slate-100 bg-white flex items-center gap-2">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="向专属顾问或智能 AI 提问任何设立细节…"
                  className="flex-1 px-3.5 py-2 rounded-full border border-slate-200 text-xs outline-none focus:border-[#36B39E] bg-slate-50/50"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  className="p-2 rounded-full bg-[#36B39E] hover:bg-[#2AA894] text-white disabled:opacity-40 transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>

            {/* Right Col: Timeline & Process Guides */}
            <div className="space-y-4">

              {/* Card 1: 3-Day Roadmap */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200/80">
                <h3 className="font-bold text-xs sm:text-sm text-slate-800 flex items-center gap-2 mb-3">
                  <Calendar className="w-4 h-4 text-[#36B39E]" />
                  <span>3 个工作日办理时限节点</span>
                </h3>

                <div className="space-y-2.5 text-xs">
                  <div className="flex gap-2.5 items-start">
                    <div className="w-4 h-4 rounded-full bg-[#E6F7F2] text-[#2AA894] font-bold flex items-center justify-center shrink-0 text-[10px]">
                      1
                    </div>
                    <div>
                      <span className="font-bold text-slate-800 block">今日 (Day 1)</span>
                      <span className="text-slate-500 text-[11px] leading-relaxed">
                        填报企业字号与股东资料，30分钟完成初审，生成标准化章程及网申档案。
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2.5 items-start">
                    <div className="w-4 h-4 rounded-full bg-slate-100 text-slate-600 font-bold flex items-center justify-center shrink-0 text-[10px]">
                      2
                    </div>
                    <div>
                      <span className="font-bold text-slate-800 block">明日 (Day 2)</span>
                      <span className="text-slate-500 text-[11px] leading-relaxed">
                        政务综合网申立项，推送全体股东及法人完成移动端人脸电子签名。
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2.5 items-start">
                    <div className="w-4 h-4 rounded-full bg-slate-100 text-slate-600 font-bold flex items-center justify-center shrink-0 text-[10px]">
                      3
                    </div>
                    <div>
                      <span className="font-bold text-slate-800 block">后日 (Day 3)</span>
                      <span className="text-slate-500 text-[11px] leading-relaxed">
                        市监核发执照正副本，刻制公安防伪芯片印章，顺丰特快当日寄发。
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Required Docs Checklist */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200/80">
                <h3 className="font-bold text-xs sm:text-sm text-slate-800 flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4 text-[#36B39E]" />
                  <span>申办必备资料清单</span>
                </h3>

                <div className="space-y-2 text-xs text-slate-600">
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#36B39E] shrink-0" />
                    <span className="text-[11px]">法定代表人身份证清晰扫描件</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#36B39E] shrink-0" />
                    <span className="text-[11px]">监事及全体股东身份证件</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#36B39E] shrink-0" />
                    <span className="text-[11px]">经营场地证明（自有租赁合同 / 集群挂靠）</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#36B39E] shrink-0" />
                    <span className="text-[11px]">公司章程及设立申请（系统自动生成）</span>
                  </div>
                </div>
              </div>

              {/* Card 3: SLA Guarantee */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200/80">
                <h3 className="font-bold text-xs sm:text-sm text-slate-800 flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-[#36B39E]" />
                  <span>服务标准承诺 (SLA)</span>
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed text-[11px]">
                  • 工作日咨询 5 分钟内快速响应<br />
                  • 材料初审在 30 分钟内完成反馈<br />
                  • 非客户原因设立失败，100% 退还服务费
                </p>
              </div>

            </div>

          </div>

        </div>
      </div>

      {/* Floating Bottom Bar */}
      <div className="fixed left-0 right-0 bottom-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 py-3 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBackToPayment}
            className="px-5 py-2 rounded-full border border-slate-200 bg-white text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>查看已付凭证</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onProceedToProgress}
              className="px-6 py-2 rounded-full bg-[#36B39E] hover:bg-[#2AA894] text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span>查看办理进度与交付节点</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
