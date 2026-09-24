/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 方案页 01 区块的**新结构诊断报告**渲染：标题 / 摘要 / 四条诊断 / 四个决策维度（含 points）/
 * 行业合规提示 / 避坑指南。
 *
 * 只在服务端返回了新结构报告（`plan.report !== null`）时渲染；老响应没有报告，
 * ProposalStep 会回落到原来那排平铺字段的卡片，所以这个组件不承担任何兜底逻辑。
 * 样式沿用 01 区块既有的 slate + 品牌绿，不引入新的视觉语言。
 */

import React from 'react';
import { PlanCoreDecision, PlanDiagnosticReport } from '../types';
import { AlertTriangle, ClipboardList } from 'lucide-react';

interface PlanReportViewProps {
  report: PlanDiagnosticReport;
}

/** 四个维度里有可显示内容的那些（整块都空的不占位） */
const decisionsOf = (report: PlanDiagnosticReport): PlanCoreDecision[] =>
  [report.orgStructure, report.capitalPlanning, report.taxAndInvoice, report.businessPremise].filter(
    (decision) =>
      decision.dimensionTitle !== '' ||
      decision.tag !== '' ||
      decision.recommended !== '' ||
      decision.points.length > 0,
  );

export const PlanReportView: React.FC<PlanReportViewProps> = ({ report }) => {
  const decisions = decisionsOf(report);
  const diagnosticItems = [
    { label: '业务方向', value: report.diagnosticBar.businessDirection },
    { label: '股东结构', value: report.diagnosticBar.shareholderProfile },
    { label: '场地安排', value: report.diagnosticBar.premiseArrangement },
    { label: '财税身份', value: report.diagnosticBar.taxIdentityProfile },
  ].filter((item) => item.value !== '');

  return (
    <div className="space-y-3">
      {report.summary && (
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{report.summary}</p>
      )}

      {diagnosticItems.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {diagnosticItems.map((item) => (
            <div key={item.label} className="p-2.5 rounded-lg bg-[#F8FCFB] border border-[#2AA894]/20">
              <span className="text-[11px] text-[#2AA894] font-medium block mb-0.5">{item.label}</span>
              <span className="text-xs text-slate-600 leading-relaxed">{item.value}</span>
            </div>
          ))}
        </div>
      )}

      {decisions.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {decisions.map((decision, idx) => (
            <div
              key={`${decision.dimensionIndex}-${idx}`}
              className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/70"
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <span className="text-[11px] text-slate-400">
                  {[decision.dimensionIndex, decision.dimensionTitle].filter(Boolean).join(' · ')}
                </span>
                {decision.tag && (
                  <span className="shrink-0 text-[11px] font-medium text-[#2AA894] bg-[#E6F7F2] px-2 py-0.5 rounded-md">
                    {decision.tag}
                  </span>
                )}
              </div>

              {decision.recommended && (
                <span className="font-bold text-slate-800 text-sm block mb-1">{decision.recommended}</span>
              )}

              {decision.points.length > 0 && (
                <ul className="space-y-1.5 mt-2 pt-2 border-t border-slate-200/70">
                  {decision.points.map((point, pointIdx) => (
                    <li key={pointIdx} className="flex gap-1.5">
                      <span className="mt-[7px] w-1 h-1 rounded-full bg-[#36B39E] shrink-0" />
                      <span className="leading-relaxed">
                        {point.title && (
                          <strong className="font-semibold text-slate-700">{point.title}</strong>
                        )}
                        {point.content && <span className="text-slate-500">{point.content}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {report.industryComplianceTips.length > 0 && (
        <div className="p-3.5 rounded-xl bg-sky-50/60 border border-sky-200/70">
          <div className="flex items-center gap-1.5 font-bold text-xs text-sky-900 mb-1.5">
            <ClipboardList className="w-3.5 h-3.5 text-sky-600" />
            <span>行业合规提示</span>
          </div>
          <ul className="space-y-1 text-xs text-sky-800 list-disc list-inside">
            {report.industryComplianceTips.map((tip, idx) => (
              <li key={idx} className="leading-relaxed">
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}

      {report.pitfallGuides.length > 0 && (
        <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/70">
          <div className="flex items-center gap-1.5 font-bold text-xs text-amber-900 mb-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>避坑指南</span>
          </div>
          <div className="space-y-2">
            {report.pitfallGuides.map((guide, idx) => (
              <div key={idx} className="flex gap-2 text-xs">
                <span className="shrink-0 w-5 h-5 rounded-full bg-amber-100 border border-amber-200 text-amber-800 text-[11px] font-bold flex items-center justify-center">
                  {guide.step || idx + 1}
                </span>
                <span className="leading-relaxed text-amber-800">
                  {guide.title && <strong className="font-semibold">{guide.title}</strong>}
                  {guide.title && guide.desc ? '：' : ''}
                  {guide.desc}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
