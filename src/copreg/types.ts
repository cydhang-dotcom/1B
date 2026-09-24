/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SurveyData {
  coreNeeds: string[];
  companyDesc: string;
  bizDesc: string;
  scope: string[];
  license: string[];
  sensitive: string[];
  invoiceReq: string;
  monthlyAmount: string;
  revenue: string[];
  revenueOther: string;
  shareholderType: string[];
  shareholderCount: string;
  capitalRec: string;
  capitalAmount: string;
  regAddress: string;
  officeSpace: string;
}

export interface QuotationItem {
  id: string;
  name: string;
  desc: string;
  price: number;
  originalPrice: number;
  isGift?: boolean;
  isFree?: boolean;
  tag?: string;
}

export type ServiceTierType = 'standard' | 'bundle_small' | 'bundle_general';

/**
 * 架构诊断接口返回的**报告结构**（2026-09 后端改版后的真实形状）。
 *
 * 老版本是平铺的 `companyType` / `taxpayerIdentity` / … 十个字段；现在是一份「报告」：
 * 顶部标题与摘要、四条诊断条、四个核心决策维度（每个维度带若干条 points 论证）、
 * 行业合规提示与避坑指南。前端两套都认：平铺字段仍按老口径取，报告另存一份给方案页渲染
 * （见 planGenerate.ts 的 parsePlanReport 与 applyPlanSuggestion）。
 */
export interface PlanDecisionPoint {
  /** 小标题，服务端形如「【股东与股比】」 */
  title: string;
  /** 这一条的正文 */
  content: string;
}

/** 报告顶部的四条诊断结论（业务方向 / 股东画像 / 场地安排 / 纳税人身份倾向） */
export interface PlanDiagnosticBar {
  businessDirection: string;
  shareholderProfile: string;
  premiseArrangement: string;
  taxIdentityProfile: string;
}

/** 一个核心决策维度：序号 + 标题 + 标签 + 一句结论 + 若干条 points */
export interface PlanCoreDecision {
  dimensionIndex: string;
  dimensionTitle: string;
  tag: string;
  /** 该维度的结论句：组织形式的 recommendedType、注册资本的 recommendedCapital（含单位）等 */
  recommended: string;
  points: PlanDecisionPoint[];
}

/** 避坑指南的一条：第几步 + 标题 + 说明 */
export interface PlanPitfallGuide {
  step: string;
  title: string;
  desc: string;
}

/** 完整报告。任一项缺失都由解析层收成空串 / 空数组，渲染层据此不显示 */
export interface PlanDiagnosticReport {
  reportTitle: string;
  summary: string;
  diagnosticBar: PlanDiagnosticBar;
  /** 组织形式与股权架构 */
  orgStructure: PlanCoreDecision;
  /** 注册资本与出资规划 */
  capitalPlanning: PlanCoreDecision;
  /** 财税身份与发票统筹 */
  taxAndInvoice: PlanCoreDecision;
  /** 经营场所与住所合规 */
  businessPremise: PlanCoreDecision;
  industryComplianceTips: string[];
  pitfallGuides: PlanPitfallGuide[];
}


/**
 * 一份套餐报价：套餐明细 + 费用合计。
 * 报价由 components/proposalQuote.ts 算出，plan.ts 再把它跟问卷答案拼成 RegistrationPlan。
 */
export interface TierQuote {
  selectedTier: ServiceTierType;
  taxpayerTier: 'small' | 'general';
  tierName: string;
  items: QuotationItem[];
  deliverables: string[];
  selectedAddons: string[];
  totalOriginal: number;
  totalDiscount: number;
  finalPrice: number;
}

export interface OptionalAddonService {
  id: string;
  name: string;
  desc: string;
  price: number;
  unit: string;
  defaultSelected?: boolean;
}

/**
 * 已勾选的一项自选增值服务。
 *
 * 本地存档（planDraft 的 `PlanForm.addons`）与确认接口请求体里的 `formData.addons`
 * **共用这一种形状**：存档里存的对象数组，就是点「确认并前往支付」时发出去的那份，
 * 不存在「存的是 id、发的是对象」两套字段名。两边都由 `proposalQuote.addonsOf` 从
 * 同一份报价明细派生，所以也不会出现价格不一致。
 */
export interface PlanAddon {
  /** 自选增值服务 id：`addon-bank` / `addon-tax` / `addon-social` */
  id: string;
  /** 服务名称，如「银行对公账户开通」 */
  name: string;
  /** 实收金额（元），取自报价明细，与页面上显示的一致 */
  price: number;
}

export interface RegistrationPlan {
  selectedTier: ServiceTierType;
  taxpayerTier: 'small' | 'general';
  tierName: string;
  companyNameProposal: string;
  companyType: string;
  taxpayerIdentity: string;
  taxReason: string;
  capitalAmount: string;
  capitalAdvice: string;
  registeredAddressAdvice: string;
  preQualifications: string[];
  postQualifications: string[];
  riskTips: string[];
  /**
   * 服务端架构诊断返回的完整报告（新结构）。本地模板方案没有它，为 `null`；
   * 方案页 01 区块有报告时按报告渲染，没有才回落到上面那排平铺字段。
   */
  report: PlanDiagnosticReport | null;
  items: QuotationItem[];
  selectedAddons?: string[];
  totalOriginal: number;
  totalDiscount: number;
  finalPrice: number;
  estimatedWorkdays: number;
  deliverables: string[];
}

export interface PaymentOrder {
  orderNo: string;
  createdAt: string;
  paidAt?: string;
  amount: number;
  paymentMethod: 'wechat' | 'alipay' | 'bank';
  status: 'pending' | 'paid';
  contactName: string;
  contactPhone: string;
  receiptNumber: string;
  invoiceType?: 'personal' | 'company_normal' | 'company_special';
  invoiceTitle: string;
  invoiceTaxId?: string;
  invoiceEmail?: string;
}

export interface ChatMessage {
  id: string;
  sender: string;
  role: 'customer' | 'advisor' | 'delivery' | 'ai';
  roleTag: string;
  avatar: string;
  timestamp: string;
  content: string;
  isSelf?: boolean;
  actionPayload?: {
    type: 'timeline' | 'docs' | 'signature';
    title: string;
    description: string;
  };
}

export interface Shareholder {
  id: string;
  name: string;
  idCard: string;
  phone: string;
  ratio: number;
  capitalAmount: number;
}

export interface UploadedDoc {
  id: string;
  name: string;
  type: string;
  required: boolean;
  status: 'pending' | 'uploaded' | 'verified' | 'rejected';
  fileName?: string;
  fileSize?: string;
  feedback?: string;
  updatedAt?: string;
}

export interface RegistrationDetails {
  primaryName: string;
  backupName1: string;
  backupName2: string;
  industryCategory: string;
  registeredCapital: string;
  legalRepresentative: {
    name: string;
    idCard: string;
    phone: string;
    email: string;
  };
  supervisor: {
    name: string;
    idCard: string;
    phone: string;
  };
  financeOfficer: {
    name: string;
    idCard: string;
    phone: string;
  };
  shareholders: Shareholder[];
  officeAddress: {
    region: string;
    detail: string;
    propertyType: string;
    area: string;
  };
  docs: UploadedDoc[];
}

/**
 * 页面步骤，编号与各步骤页眉上标出的「第 N 步」一致。
 * 协议确认与在线支付合并成了一个页面（payment）；企业注册申报资料填报（fill_details）
 * 与办理进度都在本页内，不再有独立的 registration.html。所以序号是 6 个。
 */
export type ProcessStep =
  | 'survey'       // 第 1 步 初步业务信息调研
  | 'proposal'     // 第 2 步 注册方案与服务报价
  | 'agreement'    // 已废弃：协议确认与支付合并到 payment，没有任何入口会走到这里
  | 'payment'      // 第 3 步 协议确认与在线支付
  | 'group'        // 第 4 步 专属服务群（含 AI 助手）
  | 'fill_details' // 第 5 步 企业注册申报资料填报与初审
  | 'progress';    // 第 6 步 客服核验与交付团队办理进度

/** 进度页的「资料审核」演示分支：资料齐全转交交付 / 资料有误提示补正 */
export type ReviewBranch = 'complete' | 'incomplete';

export interface TimelineNode {
  id: string;
  stepNumber: number;
  title: string;
  operator: string;
  dept: string;
  time: string;
  status: 'done' | 'current' | 'waiting';
  detail: string;
  requiresAction?: boolean;
  actionName?: string;
}
