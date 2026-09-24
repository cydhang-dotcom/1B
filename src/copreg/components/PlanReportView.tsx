/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 方案页 01 区块的**新结构诊断报告**渲染（布局迁移自参考实现 cydhang-dotcom/copreg
 * `ProposalStep` 的「01 · 设立规划建议报告」2026-09 改版）。
 *
 * 参考实现的版式要点，这里逐条对齐：
 *   - 顶栏序号徽标与「存为 PDF」按钮在 ProposalStep，这里只画正文
 *   - 意向诊断核对条：四格（拟营业务方向 / 股东构成特征 / 经营场所安排 / 财税身份定位）
 *   - 四大核心维度**上下竖排**（不是左右分列）：每张卡 = 图标 + 序号·标题 + 右侧标签 +
 *     加粗结论 + 「【小标题】正文」逐条要点
 *   - 经营范围卡：营业执照规范表述 + 标签 + 后置资质提醒
 *   - 初创期合规避坑：竖排卡片（避坑指南 + 行业合规提示）
 *   - 底部一行免责小字
 *
 * 内容来源与参考实现的差别：参考实现读本地模板生成的平铺字段、每段建议写死在组件里；
 * 这里用服务端**新报告结构**（`report.coreDecisions` 的结论与 points、`diagnosticBar`、
 * `pitfallGuides`、`industryComplianceTips`）—— 也就是「存为 PDF」导出报告里的同一份内容。
 *
 * 只在服务端返回了新结构报告（`plan.report !== null`）时渲染；老响应没有报告，
 * ProposalStep 会回落到原来那排平铺字段的卡片。
 */

import React from 'react';
import {
  AlertTriangle,
  Building,
  Check,
  FileBadge,
  Landmark,
  Receipt,
  Scale,
  ShieldCheck,
} from 'lucide-react';
import type { PlanCoreDecision, PlanDiagnosticReport, RegistrationPlan, SurveyData } from '../types';

interface PlanReportViewProps {
  report: PlanDiagnosticReport;
  plan: RegistrationPlan;
  survey: SurveyData;
}

/** 维度里有没有可显示的东西（序号单独存在不算内容） */
const hasDecisionContent = (decision: PlanCoreDecision): boolean =>
  decision.dimensionTitle !== '' ||
  decision.tag !== '' ||
  decision.recommended !== '' ||
  decision.points.length > 0;

/** 经营场所是否需要自己提供（参考实现同款推导） */
const hasOwnAddress = (survey: SurveyData): boolean =>
  survey.regAddress.includes('否') || survey.officeSpace === '是';

/** 股东构成特征的中文短语（报告没给时的回落） */
const shareholderTrait = (survey: SurveyData): string => {
  const hasCorporate = survey.shareholderType.some((t) => t.includes('公司') || t.includes('法人'));
  const hasForeign = survey.shareholderType.some((t) => t.includes('境外') || t.includes('外资'));
  if (hasCorporate) return '含法人股东参股';
  if (hasForeign) return '涉外资合伙';
  if (survey.shareholderCount === '2 个' || survey.shareholderCount === '3 个及以上') {
    return `自然人合伙（${survey.shareholderCount}）`;
  }
  return '自然人独资（1人）';
};

const truncate = (text: string, max: number): string => (text.length > max ? `${text.slice(0, max)}…` : text);

export const PlanReportView: React.FC<PlanReportViewProps> = ({ report, plan, survey }) => {
  // 四大维度竖排：图标与配色按参考实现的顺序固定
  const dimensions = [
    { decision: report.orgStructure, Icon: Building, tone: 'slate' as const },
    { decision: report.capitalPlanning, Icon: Scale, tone: 'amber' as const },
    { decision: report.taxAndInvoice, Icon: Receipt, tone: 'slate' as const },
    { decision: report.businessPremise, Icon: Landmark, tone: 'slate' as const },
  ].filter((entry) => hasDecisionContent(entry.decision));

  const diagnosticItems = [
    {
      label: '拟营业务方向',
      value: report.diagnosticBar.businessDirection || truncate(survey.companyDesc.trim(), 12) || '现代数字化服务',
    },
    { label: '股东构成特征', value: report.diagnosticBar.shareholderProfile || shareholderTrait(survey) },
    {
      label: '经营场所安排',
      value:
        report.diagnosticBar.premiseArrangement ||
        (hasOwnAddress(survey) ? '自有/租赁商用场所' : '商务秘书集群合规托管'),
    },
    {
      label: '财税身份定位',
      value:
        report.diagnosticBar.taxIdentityProfile ||
        (plan.taxpayerTier === 'general' ? '一般纳税人（专票抵扣）' : '小规模纳税人（享免税）'),
    },
  ];

  // 避坑：服务端的避坑指南按步编号，行业合规提示排在后面
  const pitfalls = [
    ...report.pitfallGuides.map((guide, index) => ({
      title: `${index + 1}. ${guide.title || '合规提示'}`,
      desc: guide.desc,
    })),
    ...report.industryComplianceTips.map((tip, index) => ({
      title: `行业合规提示${report.industryComplianceTips.length > 1 ? ` ${index + 1}` : ''}`,
      desc: tip,
    })),
  ].filter((item) => item.desc !== '' || item.title !== '');

  return (
    <>
      {/* 意向诊断核对条 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-slate-50/90 border border-slate-200/70 mb-5 text-xs">
        {diagnosticItems.map((item) => (
          <div key={item.label} className="min-w-0">
            <span className="text-slate-400 block text-[11px] mb-0.5">{item.label}</span>
            <span className="font-semibold text-slate-800 block truncate" title={item.value}>
              {item.value}
            </span>
          </div>
        ))}
      </div>

      {/* 四大核心维度：上下竖排 */}
      <div className="flex flex-col gap-3.5 mb-5">
        {dimensions.map(({ decision, Icon, tone }, index) => {
          const amber = tone === 'amber';
          return (
            <div
              key={`${decision.dimensionIndex}-${index}`}
              className={`p-4 rounded-xl border transition-colors ${
                amber
                  ? 'border-amber-200/80 bg-amber-50/20 hover:bg-amber-50/40'
                  : 'border-slate-200/80 bg-slate-50/50 hover:bg-slate-50/80'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <span className={`text-xs font-bold flex items-center gap-1.5 ${amber ? 'text-amber-800' : 'text-slate-700'}`}>
                  <Icon className={`w-4 h-4 ${amber ? 'text-amber-600' : 'text-[#1D6C5E]'}`} />
                  <span>{[decision.dimensionIndex, decision.dimensionTitle].filter(Boolean).join(' · ')}</span>
                </span>
                {decision.tag && (
                  <span
                    className={`shrink-0 text-[11px] px-2 py-0.5 rounded-md font-medium ${
                      amber
                        ? 'text-amber-800 bg-amber-100/70 border border-amber-200/60'
                        : 'text-[#1D6C5E] bg-[#E6F7F2]'
                    }`}
                  >
                    {decision.tag}
                  </span>
                )}
              </div>

              {decision.recommended && (
                <div className={`font-bold mb-2 ${amber ? 'text-base text-[#1D6C5E]' : 'text-sm text-slate-900'}`}>
                  {decision.recommended}
                </div>
              )}

              {decision.points.length > 0 && (
                <div className="space-y-1.5 text-xs text-slate-600 leading-relaxed">
                  {decision.points.map((point, pointIndex) => (
                    <div key={pointIndex} className="flex items-start gap-1.5">
                      <span className={`font-bold shrink-0 ${amber ? 'text-amber-600' : 'text-[#1D6C5E]'}`}>·</span>
                      <span>
                        {point.title && <strong>{point.title}</strong>}
                        {point.content}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 经营范围与资质建议 */}
      <div className="p-4 rounded-xl bg-slate-50/60 border border-slate-200/70 mb-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <FileBadge className="w-4 h-4 text-[#1D6C5E]" />
            <span>营业执照拟定经营范围</span>
          </span>
          <span className="text-[11px] text-slate-500">
            共选定 {survey.scope.length} 项 · 依营业执照依法自主经营
          </span>
        </div>

        <div className="text-xs text-slate-700 bg-white p-3 rounded-lg border border-slate-200/60 leading-relaxed mb-3">
          <span className="font-semibold text-slate-900">一般项目：</span>
          {survey.scope.join('；')}。（除依法须经批准的项目外，凭营业执照依法自主开展经营活动）
        </div>

        <div className="flex flex-wrap gap-1.5">
          {survey.scope.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-white text-slate-700 border border-slate-200/80"
            >
              <Check className="w-3 h-3 text-[#1D6C5E]" />
              <span>{item}</span>
            </span>
          ))}
        </div>

        {plan.postQualifications.length > 0 && (
          <div className="mt-3.5 pt-3 border-t border-slate-200/60 text-xs">
            <div className="flex items-center gap-1.5 text-amber-800 font-medium mb-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>后续资质提醒（证照分离，不影响先领营业执照）：</span>
            </div>
            <p className="text-slate-600 pl-5 leading-relaxed text-[11px] sm:text-xs">
              您涉及的【<strong className="text-slate-800">{plan.postQualifications.join('、')}</strong>
              】属于后置许可或备案事项。根据国家“证照分离”政策，营业执照办结后由专员协同办理即可，设立初期不影响领照。
            </p>
          </div>
        )}
      </div>

      {/* 初创期合规避坑建议 */}
      {pitfalls.length > 0 && (
        <div className="mb-4">
          <h3 className="text-xs font-bold text-slate-800 mb-2.5 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#1D6C5E]" />
            <span>初创期合规避坑建议（针对性提示）</span>
          </h3>

          <div className="flex flex-col gap-2.5 text-xs text-slate-600">
            {pitfalls.map((item, index) => (
              <div key={index} className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50">
                <div className="font-semibold text-slate-900 mb-1 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1D6C5E]" />
                  <span>{item.title}</span>
                </div>
                <p className="text-slate-500 leading-relaxed text-[11px]">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 底部免责小字 */}
      <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-slate-400">
        <span>* 方案依据新《公司法》及商事登记标准生成，供设立规划参考，最终以登记主管机关核准为准。</span>
        <span className="hidden sm:inline">商事登记合规指导标准</span>
      </div>
    </>
  );
};
