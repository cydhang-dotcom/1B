/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 架构诊断响应的**解析、收口与覆盖**（纯逻辑）。
 *
 * 两套响应结构都收成同一份 `PlanSuggestion`：
 *   - **老平铺结构**：`companyType` / `taxpayerIdentity` / … 十个字段直接取；
 *   - **新报告结构**（2026-09 起）：主体是 `coreDecisions` 四个维度 + `points` + `diagnosticBar` +
 *     `industryComplianceTips` + `pitfallGuides`，原样收进 `report`，并**派生**一份平铺字段，
 *     让进度页 / 本地存档 / 覆盖规则这些按平铺字段工作的地方无需感知接口改版。
 *
 * 单独一个文件的原因：这些函数不 import `config/api.ts`（那个文件读 `import.meta.env`，
 * 只有 Vite 提供），所以 `scripts/check-plan-report.ts` 能用 tsx 直接引它做离线自检。
 * 请求链路（拼地址、postJson、recordId 必给）仍在 `planGenerate.ts`。
 */

import { optionalListOf, optionalStringOf } from './apiClient';
import {
  PlanCoreDecision,
  PlanDecisionPoint,
  PlanDiagnosticBar,
  PlanDiagnosticReport,
  PlanPitfallGuide,
  RegistrationPlan,
} from './types';

/**
 * 服务端给的架构诊断结果，只收前端真正读到的那几项。
 *
 * null = 服务端没给这一项，覆盖时保留本地方案的值；
 * 字符串数组给空数组 = 明确「没有」，就用空数组（服务端说不需要前置许可，
 * 就不该继续显示本地模板猜的那条）。
 */
export interface PlanSuggestion {
  /** 企业名称方案（一整段，通常含备选名） */
  companyNameProposal: string | null;
  /** 组织形式（含股东结构建议，服务端给的是一整段） */
  companyType: string | null;
  /** 纳税人身份规划 */
  taxpayerIdentity: string | null;
  /** 这么定的理由 */
  taxReason: string | null;
  /** 注册资本建议（一整句话，含金额） */
  capitalAmount: string | null;
  /** 出资节奏与实缴安排建议 */
  capitalAdvice: string | null;
  /** 注册地址合规策略 */
  registeredAddressAdvice: string | null;
  /** 前置许可 / 备案清单 */
  preQualifications: string[] | null;
  /** 后置许可 / 资质清单 */
  postQualifications: string[] | null;
  /** 合规风险提示 */
  riskTips: string[] | null;
  /**
   * 新结构的完整报告（标题 / 摘要 / 诊断条 / 四个决策维度 / 合规提示 / 避坑指南）。
   * 老响应没有这一项，为 `null`，方案页就回落到上面那排平铺字段。
   */
  report: PlanDiagnosticReport | null;
}

/** 只把「是普通对象」的值当对象看（数组与 null 都当没给） */
const recordOf = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

/** 维度里的 points：title / content 各自缺就补空串，两条都空的那条直接丢掉 */
const decisionPointsOf = (value: unknown): PlanDecisionPoint[] =>
  Array.isArray(value)
    ? value
        .map((item) => recordOf(item))
        .filter((item): item is Record<string, unknown> => item !== null)
        .map((item) => ({
          title: optionalStringOf(item.title) ?? '',
          content: optionalStringOf(item.content) ?? '',
        }))
        .filter((point) => point.title !== '' || point.content !== '')
    : [];

/** 避坑指南：`step` 可能是数字，统一收成字符串 */
const pitfallGuidesOf = (value: unknown): PlanPitfallGuide[] =>
  Array.isArray(value)
    ? value
        .map((item) => recordOf(item))
        .filter((item): item is Record<string, unknown> => item !== null)
        .map((item) => ({
          step: item.step === undefined || item.step === null ? '' : String(item.step).trim(),
          title: optionalStringOf(item.title) ?? '',
          desc: optionalStringOf(item.desc) ?? '',
        }))
        .filter((guide) => guide.title !== '' || guide.desc !== '')
    : [];

/**
 * 一个决策维度。`recommendedKeys` 是各维度自己的结论字段名
 * （组织形式叫 recommendedType、注册资本叫 recommendedCapital…），
 * 取到第一个非空的；注册资本的 capitalUnit 拼在结论后面。
 */
const coreDecisionOf = (value: unknown, recommendedKeys: string[]): PlanCoreDecision => {
  const source = recordOf(value) ?? {};
  // 接口各维度叫法不同（recommendedType / recommendedCapital…）；本地存档里已收成 recommended，
  // 所以统一再兜一次 recommended，报告存下来再读回来才不丢结论
  const recommended =
    [...recommendedKeys, 'recommended']
      .map((key) => optionalStringOf(source[key]))
      .find((text): text is string => text !== null) ?? '';
  const capitalUnit = optionalStringOf(source.capitalUnit) ?? '';
  const withUnit = capitalUnit
    ? /^[（(]/.test(capitalUnit)
      ? `${recommended}${capitalUnit}`
      : `${recommended} ${capitalUnit}`
    : recommended;

  return {
    dimensionIndex: optionalStringOf(source.dimensionIndex) ?? '',
    dimensionTitle: optionalStringOf(source.dimensionTitle) ?? '',
    tag: optionalStringOf(source.tag) ?? '',
    recommended: withUnit,
    points: decisionPointsOf(source.points),
  };
};

/** 维度里有没有可显示的东西（序号单独存在不算内容） */
const decisionHasContent = (decision: PlanCoreDecision): boolean =>
  decision.dimensionTitle !== '' ||
  decision.tag !== '' ||
  decision.recommended !== '' ||
  decision.points.length > 0;

/**
 * 把一份形状未知的**新结构报告**收成 `PlanDiagnosticReport`；一点可用内容都没有时返回 null
 * （于是 `hasPlanContent` 不会因为它而放行，最终还是走「未返回可用内容」那条提示）。
 *
 * 两种来源都认：
 *   - 接口原始响应：报告字段与 `coreDecisions` 平铺在根上；
 *   - 本地存档：`parsePlanSuggestion` 收好的那份报告放在 `report` 字段下。
 */
export const parsePlanReport = (payload: unknown): PlanDiagnosticReport | null => {
  const source = recordOf(payload);
  if (!source) return null;

  // 本地存档里报告在 report 下；接口响应就在根上
  const raw = recordOf(source.report) ?? source;
  const coreDecisions = recordOf(raw.coreDecisions) ?? raw;
  const diagnosticBarRaw = recordOf(raw.diagnosticBar) ?? {};

  const diagnosticBar: PlanDiagnosticBar = {
    businessDirection: optionalStringOf(diagnosticBarRaw.businessDirection) ?? '',
    shareholderProfile: optionalStringOf(diagnosticBarRaw.shareholderProfile) ?? '',
    premiseArrangement: optionalStringOf(diagnosticBarRaw.premiseArrangement) ?? '',
    taxIdentityProfile: optionalStringOf(diagnosticBarRaw.taxIdentityProfile) ?? '',
  };

  const report: PlanDiagnosticReport = {
    reportTitle: optionalStringOf(raw.reportTitle) ?? '',
    summary: optionalStringOf(raw.summary) ?? '',
    diagnosticBar,
    orgStructure: coreDecisionOf(coreDecisions.orgStructure, ['recommendedType']),
    capitalPlanning: coreDecisionOf(coreDecisions.capitalPlanning, ['recommendedCapital']),
    taxAndInvoice: coreDecisionOf(coreDecisions.taxAndInvoice, ['recommendedTaxIdentity']),
    businessPremise: coreDecisionOf(coreDecisions.businessPremise, ['recommendedPremise']),
    industryComplianceTips: optionalListOf(raw.industryComplianceTips) ?? [],
    pitfallGuides: pitfallGuidesOf(raw.pitfallGuides),
  };

  const hasAny =
    report.reportTitle !== '' ||
    report.summary !== '' ||
    Object.values(diagnosticBar).some((text) => text !== '') ||
    decisionHasContent(report.orgStructure) ||
    decisionHasContent(report.capitalPlanning) ||
    decisionHasContent(report.taxAndInvoice) ||
    decisionHasContent(report.businessPremise) ||
    report.industryComplianceTips.length > 0 ||
    report.pitfallGuides.length > 0;

  return hasAny ? report : null;
};

/** 维度里的 points 拼成一段（平铺字段 taxReason / capitalAdvice 用得上） */
const pointsTextOf = (decision: PlanCoreDecision): string | null => {
  const parts = decision.points
    .map((point) => `${point.title}${point.content}`.trim())
    .filter((text) => text !== '');
  return parts.length > 0 ? parts.join('；') : null;
};

/**
 * 把一份「形状未知的」诊断结果收成 PlanSuggestion：接口响应与本地快照（planDraft.ts）
 * 共用这一份字段校验 —— localStorage 里的东西也可能被改过、或是别的版本写的，
 * 不能因为它在本地就直接当可信数据用。
 *
 * 新结构（带 `coreDecisions` 的报告）除了原样收进 `report`，还会**派生**一份平铺字段：
 * 老响应有平铺字段就直接用，新响应没有才从报告里取（`??` 的左值优先）。
 */
export const parsePlanSuggestion = (payload: unknown): PlanSuggestion => {
  const source = (payload ?? {}) as Record<string, unknown>;
  const report = parsePlanReport(source);

  const companyType = optionalStringOf(source.companyType);
  const taxpayerIdentity = optionalStringOf(source.taxpayerIdentity);
  const taxReason = optionalStringOf(source.taxReason);
  const capitalAmount = optionalStringOf(source.capitalAmount);
  const capitalAdvice = optionalStringOf(source.capitalAdvice);
  const registeredAddressAdvice = optionalStringOf(source.registeredAddressAdvice);

  return {
    companyNameProposal: optionalStringOf(source.companyNameProposal),
    companyType: companyType ?? (report ? optionalStringOf(report.orgStructure.recommended) : null),
    taxpayerIdentity:
      taxpayerIdentity ?? (report ? optionalStringOf(report.taxAndInvoice.recommended) : null),
    taxReason:
      taxReason ??
      (report
        ? pointsTextOf(report.taxAndInvoice) ?? optionalStringOf(report.diagnosticBar.taxIdentityProfile)
        : null),
    capitalAmount: capitalAmount ?? (report ? optionalStringOf(report.capitalPlanning.recommended) : null),
    capitalAdvice: capitalAdvice ?? (report ? pointsTextOf(report.capitalPlanning) : null),
    registeredAddressAdvice:
      registeredAddressAdvice ?? (report ? optionalStringOf(report.businessPremise.recommended) : null),
    preQualifications: optionalListOf(source.preQualifications),
    postQualifications: optionalListOf(source.postQualifications),
    riskTips: optionalListOf(source.riskTips),
    report,
  };
};

/** 一项可用内容都没有 = 后端没给这个接口该给的东西（字段名对不上，或真的什么都没算出来） */
export const hasPlanContent = (suggestion: PlanSuggestion): boolean =>
  suggestion.report !== null ||
  [
    suggestion.companyNameProposal,
    suggestion.companyType,
    suggestion.taxpayerIdentity,
    suggestion.taxReason,
    suggestion.capitalAmount,
    suggestion.capitalAdvice,
    suggestion.registeredAddressAdvice,
    suggestion.preQualifications,
    suggestion.postQualifications,
    suggestion.riskTips,
  ].some((field) => field !== null);

/**
 * 把诊断结果覆盖到方案上：服务端给了这一项才用，没给的项保持传入方案的原样
 * （字符串字段给空串、数组字段不是数组都算「没给」；给空数组算「明确没有」）。
 * 价格与套餐字段一律不动（见 planGenerate.ts 文件头），所以对已经切过套餐的方案再叠一次也是安全的。
 * suggestion 为 null（接口失败）时原样返回。
 */
export const applyPlanSuggestion = (
  plan: RegistrationPlan,
  suggestion: PlanSuggestion | null
): RegistrationPlan =>
  suggestion === null
    ? plan
    : {
        ...plan,
        companyNameProposal: suggestion.companyNameProposal ?? plan.companyNameProposal,
        companyType: suggestion.companyType ?? plan.companyType,
        taxpayerIdentity: suggestion.taxpayerIdentity ?? plan.taxpayerIdentity,
        taxReason: suggestion.taxReason ?? plan.taxReason,
        capitalAmount: suggestion.capitalAmount ?? plan.capitalAmount,
        capitalAdvice: suggestion.capitalAdvice ?? plan.capitalAdvice,
        registeredAddressAdvice: suggestion.registeredAddressAdvice ?? plan.registeredAddressAdvice,
        preQualifications: suggestion.preQualifications ?? plan.preQualifications,
        postQualifications: suggestion.postQualifications ?? plan.postQualifications,
        riskTips: suggestion.riskTips ?? plan.riskTips,
        // 报告整份跟着走：方案页 01 区块有它就按报告渲染（切套餐重建方案时也靠这一行带回来）
        report: suggestion.report ?? plan.report,
      };
