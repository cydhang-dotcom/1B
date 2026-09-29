/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 顶栏：品牌 + **我的企业注册服务（多主体切换）**。
 *
 * 版式与文案对照参考实现（cydhang-dotcom/copreg `TopNavbar`）：
 *   - 品牌块：图标 + 「企业注册向导」+ AI 徽标 + 「智能设立与合规规划服务」
 *   - 切换按钮：楼宇图标 + 当前主体名 + 「N个主体」（多于一个时）+ 箭头
 *   - 下拉：标题「我的企业注册服务（共 N 个）」；每条一张卡片 —— 名称 + 「当前办理」徽标 +
 *     套餐/价格 + 状态徽标，底部一行创建时间与「作废服务 / 已生效履约中」
 *   - 底部虚线框按钮「新增企业注册」
 *
 * 相对参考实现的两处**必要差异**：
 *   1. 参考没有数量上限；这里到 5 个时按钮置灰并写明「已达上限」；
 *   2. 参考不能改名；这里每条底部多一个「改名」（点两次作废的规则不变）。
 * 作废仍然要点两次确认（参考同款），已支付不给作废入口。
 *
 * 地址栏不参与主体切换（hash 只反映「当前主体在哪一步」），所以这里只回调、不碰 history。
 *
 * 品牌块**没有点击事件**：早先点它等于「回第 1 步」，在第 5 步填报时容易误触把用户从填报页拽回问卷，
 * 已按要求去掉（顶栏只保留主体切换这一处交互）。
 */

import React, { useEffect, useRef, useState } from 'react';
import { Building2, Check, ChevronDown, Clock, FileCheck2, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
import { MAX_APPLICATIONS, MULTI_APPLICATION_ENABLED, type ApplicationRecord } from '../applications';

interface TopNavbarProps {
  /** 全部主体（按创建顺序） */
  applications: ApplicationRecord[];
  currentAppId: string;
  onSwitchApplication: (id: string) => void;
  onAddApplication: () => void;
  onRenameApplication: (id: string, name: string) => void;
  onDiscardApplication: (id: string) => void;
}

/** 状态徽标（文案与配色照参考实现） */
const getStepBadge = (app: ApplicationRecord): { text: string; color: string } => {
  if (app.order.status === 'paid') {
    return { text: '已支付 · 办理中', color: 'bg-emerald-50 text-[#1D6C5E] border-emerald-200' };
  }
  switch (app.currentStep) {
    case 'survey':
      return { text: '意向调研中', color: 'bg-amber-50 text-amber-700 border-amber-200' };
    case 'proposal':
      return { text: '方案待确认', color: 'bg-blue-50 text-blue-700 border-blue-200' };
    case 'payment':
    case 'agreement':
      return { text: '待支付', color: 'bg-rose-50 text-rose-700 border-rose-200' };
    case 'group':
      return { text: '服务群对接中', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
    case 'fill_details':
      return { text: '资料填报中', color: 'bg-purple-50 text-purple-700 border-purple-200' };
    case 'progress':
      return { text: '开办进度追踪', color: 'bg-teal-50 text-teal-700 border-teal-200' };
    default:
      return { text: '进行中', color: 'bg-slate-50 text-slate-700 border-slate-200' };
  }
};

/** 创建时间：存档里是 ISO，列表里显示成 MM/DD HH:mm */
const formatCreatedAt = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const TopNavbar: React.FC<TopNavbarProps> = ({
  applications,
  currentAppId,
  onSwitchApplication,
  onAddApplication,
  onRenameApplication,
  onDiscardApplication,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  // 作废要确认：第一次点记下 id，第二次点才真的删
  const [confirmDiscardId, setConfirmDiscardId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeApp = applications.find((app) => app.id === currentAppId) ?? applications[0];
  const atLimit = applications.length >= MAX_APPLICATIONS;

  // 点外面就收起来；顺手把「待确认作废」「改名中」也清掉
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
        setConfirmDiscardId(null);
        setRenameId(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [dropdownOpen]);

  const handleDiscardClick = (event: React.MouseEvent, appId: string) => {
    event.stopPropagation();
    if (confirmDiscardId === appId) {
      onDiscardApplication(appId);
      setConfirmDiscardId(null);
      setDropdownOpen(false);
    } else {
      setConfirmDiscardId(appId);
    }
  };

  const handleRenameClick = (event: React.MouseEvent, app: ApplicationRecord) => {
    event.stopPropagation();
    setRenameId(app.id);
    setRenameDraft(app.name);
    setConfirmDiscardId(null);
  };

  const commitRename = () => {
    if (renameId !== null) onRenameApplication(renameId, renameDraft);
    setRenameId(null);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/70 transition-all">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-2 flex items-center justify-between gap-3">

        {/* Left: Brand —— **纯展示，不可点**：原先点它回第 1 步（#survey），
            容易在填报到一半时误触把用户从第 5 步拽回问卷，已按要求去掉点击事件 */}
        <div className="flex items-center gap-2 shrink-0 select-none">
          <div className="w-8 h-8 rounded-xl bg-[#E6F7F2] flex items-center justify-center text-[#2AA894]">
            <Sparkles className="w-4 h-4 stroke-[2]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-800 text-sm leading-tight">企业注册向导</span>
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#E6F7F2] text-[#1D6C5E] border border-[#2AA894]/30 leading-none">
                <Sparkles className="w-2.5 h-2.5 text-[#2AA894]" />
                AI
              </span>
            </div>
            <div className="text-[10px] tracking-wide text-slate-400 font-medium">智能设立与合规规划服务</div>
          </div>
        </div>

        {/* Right: 多主体切换 —— 产品要求**暂时屏蔽**（开关在 applications.MULTI_APPLICATION_ENABLED）：
            关掉时整块不渲染，顶栏只剩品牌；模型与下面这段代码都保留，恢复时改回 true 即可 */}
        {MULTI_APPLICATION_ENABLED && (
          <div className="flex items-center gap-2" ref={dropdownRef}>
          <div className="relative">
            <button
              type="button"
              id="btn-applications-switcher"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200/90 bg-slate-50/70 hover:bg-slate-100 text-slate-800 text-xs font-medium transition-all cursor-pointer shadow-2xs group"
              title="切换当前办理的企业注册服务"
            >
              <Building2 className="w-3.5 h-3.5 text-[#2AA894] shrink-0" />
              <div className="flex items-center gap-1.5 text-left max-w-[130px] sm:max-w-[200px]">
                <span className="truncate font-semibold text-slate-800">{activeApp?.name ?? '当前注册服务'}</span>
                {applications.length > 1 && (
                  <span className="hidden sm:inline-flex text-[10px] font-semibold bg-emerald-100 text-[#1D6C5E] px-1.5 py-0.2 rounded-full shrink-0">
                    {applications.length}个主体
                  </span>
                )}
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180 text-slate-700' : ''}`}
              />
            </button>

            {/* Dropdown Panel */}
            {dropdownOpen && (
              <div
                id="applications-dropdown"
                className="absolute right-0 mt-1.5 w-80 sm:w-96 rounded-2xl bg-white border border-slate-200/90 shadow-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100"
              >
                <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-[#2AA894]" />
                    <span className="text-xs font-bold text-slate-800">我的企业注册服务</span>
                    <span className="text-[10px] text-slate-400">（共 {applications.length} 个）</span>
                  </div>
                </div>

                {/* Applications list */}
                <div className="max-h-72 overflow-y-auto p-1.5 space-y-1">
                  {applications.map((app) => {
                    const isCurrent = app.id === activeApp?.id;
                    const isPaid = app.order.status === 'paid';
                    const badge = getStepBadge(app);
                    const isRenaming = renameId === app.id;
                    const tierLabel = app.order.tierName ? app.order.tierName.split('（')[0] : '套餐待生成';

                    return (
                      <div
                        key={app.id}
                        onClick={() => {
                          if (isRenaming) return;
                          onSwitchApplication(app.id);
                          setDropdownOpen(false);
                        }}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
                          isCurrent
                            ? 'bg-[#F8FCFB] border-[#2AA894]/40 shadow-2xs'
                            : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-200/60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              {isRenaming ? (
                                <input
                                  type="text"
                                  value={renameDraft}
                                  maxLength={30}
                                  autoFocus
                                  onChange={(event) => setRenameDraft(event.target.value)}
                                  onBlur={commitRename}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter') commitRename();
                                    if (event.key === 'Escape') setRenameId(null);
                                  }}
                                  onClick={(event) => event.stopPropagation()}
                                  className="flex-1 min-w-0 px-1.5 py-0.5 rounded-md border border-[#2AA894] text-xs font-bold text-slate-800 focus:outline-none"
                                />
                              ) : (
                                <>
                                  <span className={`text-xs font-bold truncate ${isCurrent ? 'text-[#1D6C5E]' : 'text-slate-800'}`}>
                                    {app.name}
                                  </span>
                                  {isCurrent && (
                                    <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[10px] font-bold bg-[#2AA894] text-white shrink-0">
                                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                                      当前办理
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                              <span>套餐: {tierLabel}</span>
                              {app.order.amount > 0 && (
                                <>
                                  <span>·</span>
                                  <span>¥{app.order.amount}</span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-md border font-medium ${badge.color}`}>
                              {badge.text}
                            </span>
                          </div>
                        </div>

                        {/* Bottom bar of each item: creation date & actions */}
                        <div className="flex items-center justify-between pt-1 border-t border-slate-100/80 text-[10px] text-slate-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-300" />
                            {formatCreatedAt(app.createdAt)}
                          </span>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(event) => handleRenameClick(event, app)}
                              className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                              title="改名（自定义这份申请的名称）"
                            >
                              <Pencil className="w-3 h-3" />
                              <span>改名</span>
                            </button>

                            {!isPaid && (
                              <button
                                type="button"
                                onClick={(event) => handleDiscardClick(event, app.id)}
                                className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] transition-colors cursor-pointer ${
                                  confirmDiscardId === app.id
                                    ? 'bg-rose-500 text-white font-bold animate-pulse'
                                    : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                                }`}
                                title={confirmDiscardId === app.id ? '再次点击确认作废' : '未支付前可作废此服务'}
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>{confirmDiscardId === app.id ? '确定作废?' : '作废服务'}</span>
                              </button>
                            )}
                            {isPaid && (
                              <span className="text-emerald-700 flex items-center gap-0.5 font-medium">
                                <FileCheck2 className="w-3 h-3" />
                                已生效履约中
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Footer: 新增 */}
                <div className="p-2 border-t border-slate-100 mt-1 bg-slate-50/60 rounded-b-xl">
                  <button
                    type="button"
                    id="btn-add-application"
                    onClick={() => {
                      if (atLimit) return;
                      setDropdownOpen(false);
                      onAddApplication();
                    }}
                    disabled={atLimit}
                    title={atLimit ? `最多同时申请 ${MAX_APPLICATIONS} 个主体，请先作废一个不用的` : '新建一份企业设立申请'}
                    className="w-full py-2 rounded-xl bg-white border border-dashed border-[#2AA894]/50 hover:bg-[#E6F7F2] text-[#2AA894] text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>{atLimit ? `已达上限（${MAX_APPLICATIONS} 个）` : '新增企业注册'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
          </div>
        )}

      </div>
    </header>
  );
};
