/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 《企业商事设立规划与财税合规评估报告》的**文档本体**（迁移自参考实现
 * cydhang-dotcom/copreg 的 `utils/exportPdf.ts` 模板）。
 *
 * 「存为 PDF」与「打印报告」印的是同一份东西，所以正文 HTML 只在这里生成一次：
 *   - 存为 PDF：把 body 塞进离屏容器 → html2canvas 光栅化 → jsPDF 分页（`exportProposalPdf.ts`）
 *   - 打印报告：拼成完整文档 → 隐藏 iframe 打印（`utils/printDocument.ts`）
 *
 * 与参考实现的**关键适配**：参考模板读的是旧平铺字段（`plan.companyType` / `plan.taxpayerTier`…），
 * 这里优先用新报告结构 `plan.report`（`diagnosticBar` / `coreDecisions` 四维含 points /
 * `industryComplianceTips` / `pitfallGuides`）渲染，报告缺失（老响应）时再回落到参考实现那套
 * 平铺字段与写死的建议文案。
 *
 * 纯函数：不 import React、不碰 DOM、不 import config/api.ts，`scripts/` 下可离线自检。
 */

import { escapeHtml } from '../utils/htmlEscape';
import type { PlanCoreDecision, PlanDiagnosticReport, RegistrationPlan, SurveyData } from './types';

export interface ProposalReportInput {
  /** 服务端架构诊断报告（新结构）；老响应为 null，走回落文案 */
  report: PlanDiagnosticReport | null;
  plan: RegistrationPlan;
  survey: SurveyData;
  /** 已验证的手机号，打在报告抬头上（可选） */
  contactPhone?: string;
  /** 生成日期，默认今天；自检注入固定值 */
  now?: Date;
}

/** 正文体一律先转义再拼 */
const esc = (value: string | undefined | null): string => escapeHtml((value ?? '').trim());

/** 非空才用，否则回落 */
const orElse = (value: string | undefined | null, fallback: string): string => {
  const trimmed = (value ?? '').trim();
  return trimmed === '' ? fallback : trimmed;
};

/** 报告编号：`BB-EV-YYYYMMDD-####`（与参考实现同格式） */
export const reportNoOf = (now: Date): string => {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const tail = String(Math.floor(1000 + Math.random() * 9000));
  return `BB-EV-${y}${m}${d}-${tail}`;
};

export const reportDateOf = (now: Date): string =>
  `${now.getFullYear()} 年 ${String(now.getMonth() + 1).padStart(2, '0')} 月 ${String(now.getDate()).padStart(2, '0')} 日`;

/** 文件名：主体名里的非法字符清掉并截断，避免下载出怪名字 */
export const proposalReportFileName = (companyName: string): string => {
  const clean = (companyName || '企业设立规划评估报告').replace(/[\\/:*?"<>|]/g, '').slice(0, 24);
  return `企业商事设立规划评估报告_${clean}.pdf`;
};

/** 诊断特征（参考实现同款推导） */
interface ReportTraits {
  displayCompanyName: string;
  hasCorporateShareholder: boolean;
  isMultiShareholder: boolean;
  hasOwnAddress: boolean;
  isGeneralTaxpayer: boolean;
}

const traitsOf = (input: ProposalReportInput): ReportTraits => {
  const { plan, survey } = input;
  return {
    displayCompanyName: orElse(plan.companyNameProposal, orElse(survey.companyDesc, '新创拟设企业')),
    hasCorporateShareholder: survey.shareholderType.some((t) => t.includes('公司') || t.includes('法人')),
    isMultiShareholder: survey.shareholderCount === '2 个' || survey.shareholderCount === '3 个及以上',
    hasOwnAddress: survey.regAddress.includes('否') || survey.officeSpace === '是',
    isGeneralTaxpayer: plan.taxpayerTier === 'general'
  };
};

/* --------------------------------------------------------------- 模板片段 */

const tdLabel = (text: string, width = '15%'): string =>
  `<td style="width:${width};padding:6px 10px;background-color:#F8FAFC;border:1px solid #CBD5E1;color:#475569;font-weight:600;">${esc(text)}</td>`;

const tdValue = (html: string, width = '35%'): string =>
  `<td style="width:${width};padding:6px 10px;border:1px solid #CBD5E1;color:#0F172A;font-weight:700;">${html}</td>`;

const partTitle = (text: string): string =>
  `<div style="border-left:3.5px solid #0F172A;padding-left:8px;font-size:12.5px;font-weight:800;color:#0F172A;margin-bottom:8px;">${esc(text)}</div>`;

/** 维度里的 points → 「【标题】正文」若干条 */
const pointsHtml = (decision: PlanCoreDecision): string =>
  decision.points
    .map(
      (point) =>
        `<div style="margin-top:3px;"><strong>${esc(point.title)}</strong>${esc(point.content)}</div>`
    )
    .join('');

/** 第二部分的一张维度卡：优先报告结构，报告缺失时用传入的兜底标题与正文 */
const dimensionCard = (
  index: number,
  fallbackTitle: string,
  decision: PlanCoreDecision | null,
  fallbackBadge: string,
  fallbackBody: string
): string => {
  const title = orElse(decision?.dimensionTitle, fallbackTitle);
  const badge = orElse(decision?.tag, fallbackBadge);
  const recommended = (decision?.recommended ?? '').trim();
  const body = decision && (recommended !== '' || decision.points.length > 0)
    ? `${recommended ? `<div style="margin-bottom:3px;"><strong>【拟定方案】</strong>${esc(recommended)}</div>` : ''}${pointsHtml(decision)}`
    : fallbackBody;

  return `
    <div style="border:1px solid #CBD5E1;border-radius:4px;padding:8px 12px;background-color:#FFFFFF;margin-bottom:8px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
        <span style="font-size:11px;font-weight:700;color:#0F172A;">${esc(`${['一', '二', '三', '四'][index]}、`)}${esc(title)}</span>
        <span style="font-size:9.5px;color:#475569;background-color:#F1F5F9;padding:1px 6px;border-radius:2px;">${esc(badge)}</span>
      </div>
      <div style="font-size:10px;color:#475569;line-height:1.55;">${body}</div>
    </div>`;
};

/* ------------------------------------------------------------------ 正文 */

export interface ProposalReportBodyOptions {
  /**
   * true（打印用，默认）：正文自带 A4 页边距（`@page margin:0` + 内边距）。
   * false（存为 PDF 用）：内边距交给 jsPDF 的页边距，避免「内边距 + 页边距」叠成双重留白。
   */
  pagePadding?: boolean;
}

/** 生成报告正文 HTML（inline 样式，既给 html2canvas 也给打印文档复用） */
export const buildProposalReportBody = (
  input: ProposalReportInput,
  options: ProposalReportBodyOptions = {}
): string => {
  const usePagePadding = options.pagePadding ?? true;
  const { report, plan, survey } = input;
  const now = input.now ?? new Date();
  const t = traitsOf(input);
  const reportNo = reportNoOf(now);
  const genDate = reportDateOf(now);
  const contactLine = input.contactPhone ? `　经办联系电话：${esc(input.contactPhone)}` : '';

  const orgDecision = report?.orgStructure ?? null;
  const capitalDecision = report?.capitalPlanning ?? null;
  const taxDecision = report?.taxAndInvoice ?? null;
  const premiseDecision = report?.businessPremise ?? null;

  // 第一部分：四项设立要素的「拟定方案」列
  const equityPlan = t.hasCorporateShareholder
    ? '法人/机构股东入股'
    : t.isMultiShareholder
      ? `多人合伙（${survey.shareholderCount}）`
      : '100% 自然人独资控股';
  const taxPlan = orElse(taxDecision?.recommended, t.isGeneralTaxpayer ? '增值税一般纳税人' : '增值税小规模纳税人');
  const premisePlan = orElse(premiseDecision?.recommended, t.hasOwnAddress ? '自有/租赁实体商用场地' : '合规商务秘书集群托管');
  const capitalPlan = orElse(capitalDecision?.recommended, `${plan.capitalAmount}（契合5年期限）`);

  return `
  <div style="padding:${usePagePadding ? '42px 48px' : '0'};box-sizing:border-box;background:#FFFFFF;color:#0F172A;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif;">

    <!-- 抬头 -->
    <div style="display:flex;justify-content:space-between;align-items:flex-end;padding-bottom:12px;border-bottom:2px solid #0F172A;margin-bottom:20px;">
      <div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:18px;font-weight:900;color:#1D6C5E;letter-spacing:1px;">班步企服</span>
          <span style="font-size:11px;color:#64748B;font-weight:600;padding-left:8px;border-left:1.5px solid #CBD5E1;">企业商事设立与规划系统</span>
        </div>
        <div style="font-size:9.5px;color:#94A3B8;margin-top:3px;letter-spacing:0.5px;">BANBU ENTERPRISE CONSULTING &amp; REGISTRATION</div>
      </div>
      <div style="text-align:right;font-size:10px;color:#64748B;">
        <span>方案编号：</span><span style="font-family:monospace;font-weight:600;color:#0F172A;">${esc(reportNo)}</span>
      </div>
    </div>

    <!-- 主标题 -->
    <div style="text-align:center;margin-bottom:22px;">
      <h1 style="font-size:20px;font-weight:900;color:#0F172A;margin:0 0 6px 0;letter-spacing:1px;">${esc(orElse(report?.reportTitle, '新创企业商事设立规划与财税合规评估报告'))}</h1>
      <div style="font-size:10.5px;color:#64748B;">依据新《中华人民共和国公司法》及国家市场监督管理总局商事制度改革规范评估出具</div>
    </div>

    <!-- 元数据表 -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:10.5px;">
      <tbody>
        <tr>
          ${tdLabel('报告编号')}${tdValue(`<span style="font-family:monospace;">${esc(reportNo)}</span>`)}${tdLabel('评估基准日')}${tdValue(`<span style="font-weight:600;">${esc(genDate)}</span>`)}
        </tr>
        <tr>
          ${tdLabel('拟设主体名称')}${tdValue(esc(t.displayCompanyName))}${tdLabel('所属行业分类')}${tdValue(`<span style="font-weight:600;">${esc(orElse(survey.companyDesc, '现代科技与商贸服务业'))}</span>`)}
        </tr>
        <tr>
          ${tdLabel('法定组织形式')}${tdValue(`<span style="font-weight:600;">${esc(orElse(plan.companyType, '有限责任公司'))}</span>`)}${tdLabel('规划出资规模')}${tdValue(esc(orElse(plan.capitalAmount, '待定')) + '（5年认缴）')}
        </tr>
      </tbody>
    </table>

    <!-- 第一部分 -->
    <div style="margin-bottom:20px;">
      ${partTitle('第一部分 · 设立核心要素梳理与落地指导意见')}
      ${report?.summary ? `<div style="background-color:#F8FAFC;border:1px solid #E2E8F0;border-radius:4px;padding:8px 12px;font-size:10px;color:#334155;line-height:1.6;margin-bottom:8px;">${esc(report.summary)}</div>` : ''}
      <table style="width:100%;border-collapse:collapse;margin-bottom:10px;font-size:10px;">
        <thead>
          <tr style="background-color:#F1F5F9;color:#475569;">
            <th style="width:18%;padding:6px 8px;border:1px solid #CBD5E1;font-weight:700;text-align:left;">设立要素</th>
            <th style="width:28%;padding:6px 8px;border:1px solid #CBD5E1;font-weight:700;text-align:left;">拟定方案</th>
            <th style="width:54%;padding:6px 8px;border:1px solid #CBD5E1;font-weight:700;text-align:left;">具体建议与意见</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding:7px 8px;border:1px solid #E2E8F0;font-weight:600;color:#0F172A;">股权架构设计</td>
            <td style="padding:7px 8px;border:1px solid #E2E8F0;color:#475569;">${esc(equityPlan)}</td>
            <td style="padding:7px 8px;border:1px solid #E2E8F0;color:#334155;line-height:1.5;">${t.hasCorporateShareholder ? '备齐母公司出资决议与营业执照公章要件，章程中明确约定表决权机制，严防50:50等额持股僵局。' : t.isMultiShareholder ? '建议创始团队配置67%绝对控制权或51%相对控制权，章程中提前约定分红节奏、议事规则及股东退出机制。' : '自然人一人独资决策高效，但日常须规范建账，每年度出具审计财报，确保个人财产与公司财产严格独立。'}</td>
          </tr>
          <tr>
            <td style="padding:7px 8px;border:1px solid #E2E8F0;font-weight:600;color:#0F172A;">资本认缴规划</td>
            <td style="padding:7px 8px;border:1px solid #E2E8F0;color:#475569;">${esc(capitalPlan)}</td>
            <td style="padding:7px 8px;border:1px solid #E2E8F0;color:#334155;line-height:1.5;">依据新《公司法》第47条，全体股东认缴出资须自公司成立起 5 年内缴足；出资款由股东账户转入公司基本户并备注“投资款”，留存回单。</td>
          </tr>
          <tr>
            <td style="padding:7px 8px;border:1px solid #E2E8F0;font-weight:600;color:#0F172A;">财税身份统筹</td>
            <td style="padding:7px 8px;border:1px solid #E2E8F0;color:#475569;">${esc(taxPlan)}</td>
            <td style="padding:7px 8px;border:1px solid #E2E8F0;color:#334155;line-height:1.5;">${orElse(taxDecision ? taxDecision.points.map((p) => `${p.title}${p.content}`).join('') : '', t.isGeneralTaxpayer ? '适用于大额采购或专票结算需求，规范建账并跟进进项专票认证抵扣与月度申报。' : '初创期优先享受月销10万 / 季销30万内免征增值税政策，核算报税成本低，后续可申请转为一般纳税人。')}</td>
          </tr>
          <tr>
            <td style="padding:7px 8px;border:1px solid #E2E8F0;font-weight:600;color:#0F172A;">经营住所规划</td>
            <td style="padding:7px 8px;border:1px solid #E2E8F0;color:#475569;">${esc(premisePlan)}</td>
            <td style="padding:7px 8px;border:1px solid #E2E8F0;color:#334155;line-height:1.5;">${t.hasOwnAddress ? '产权性质须为商业、办公或厂房，严禁住宅性质登记；挂牌并配备办公设施，以备银行尽调及市监抽查。' : '节省初创期实体场地租金押金；由托管机构专人代收信函，保证政务信函通达，防范失联被列入异常名录。'}</td>
          </tr>
        </tbody>
      </table>
      <div style="background-color:#F8FAFC;border:1px solid #E2E8F0;border-radius:4px;padding:8px 12px;font-size:10px;color:#334155;line-height:1.6;">
        <strong>【商事设立指导意见】</strong>经商事设立规则系统审核，拟设主体<strong>《${esc(t.displayCompanyName)}》</strong>设立路径明确，股权结构明晰，出资规划符合新《公司法》第47条法定认缴期限约束，行业资质与经营范围表述规范。建议按上述规划依法依规推进政务设立核准流程。${contactLine}
      </div>
    </div>

    <!-- 第二部分 -->
    <div style="margin-bottom:20px;">
      ${partTitle('第二部分 · 四大核心设立维度深度评估意见')}
      ${dimensionCard(
        0,
        '组织形式与股权治理架构评估',
        orgDecision,
        `法定类型：${orElse(plan.companyType, '有限责任公司')}`,
        t.hasCorporateShareholder
          ? '<strong>【治理重点】</strong>含法人/机构股东参股，须备齐母公司营业执照副本盖章件、法定代表人证件及同意出资的《股东会决议》；章程中明确表决机制与重大议事规则，严禁 50:50 等额持股导致治理僵局。'
          : t.isMultiShareholder
            ? `<strong>【治理重点】</strong>拟设架构为多人合伙（${esc(survey.shareholderCount)}），建议合理划分表决权比例；明确分红节奏与退出机制；规模较小的有限责任公司可不设董事会，设一名董事或经理。`
            : '<strong>【治理重点】</strong>自然人一人独资设立，决策高效；须特别注意一人有限责任公司财产独立性规定，建立规范会计账簿并逐年编制财务会计报告，防止连带清偿风险。'
      )}
      ${dimensionCard(
        1,
        '注册资本与认缴出资规划评估',
        capitalDecision,
        '新《公司法》第47条约束',
        `<strong>【出资规划】</strong>核定认缴资本额：<strong>${esc(orElse(plan.capitalAmount, '待定'))}</strong>。自 2024 年 7 月 1 日起施行的新《公司法》第47条规定，全体股东认缴的出资额须自公司成立之日起五年内缴足。注册资本不宜盲目虚高，应结合业务规模与现金流规划出资；出资款须由股东账户转入公司基本户并备注“投资款”，归档银行回单。`
      )}
      ${dimensionCard(
        2,
        '财税身份与发票纳税统筹评估',
        taxDecision,
        `纳税人定位：${t.isGeneralTaxpayer ? '一般纳税人' : '小规模纳税人'}`,
        t.isGeneralTaxpayer
          ? '<strong>【财税统筹】</strong>评定适用【增值税一般纳税人】。适用于面向大中型客户、进出口贸易或下游要求专票的情形；取得的合法进项专票可全额勾选抵扣，须按期完成建账、认证与申报底稿归档。'
          : '<strong>【财税统筹】</strong>评定首选【增值税小规模纳税人】。享受月销售额10万元以下（或季30万元以下）免征增值税等普惠政策，核算报税简便；后续年应税销售额超过500万元或客户要求专票时，可申请登记为一般纳税人。'
      )}
      ${dimensionCard(
        3,
        '经营场所与住所合规性评估',
        premiseDecision,
        t.hasOwnAddress ? '实体场地登记' : '商务秘书集群托管',
        t.hasOwnAddress
          ? '<strong>【住所要件】</strong>采用自有或租赁实体商用场所登记：不动产权证书用途须为“商业”“办公”或“工业厂房”，严禁住宅性质用房注册；悬挂企业名称水牌并配备办公设施，以备银行尽调与市监实地核查。'
          : '<strong>【住所要件】</strong>采用产业园区合规“商务秘书集群托管地址”登记：节约实体租金与押金；由托管机构建立信函代收代转机制，确保住所“信函通达、联络有效”，防范被列入经营异常名录。'
      )}
    </div>

    <!-- 第三部分 -->
    <div style="margin-bottom:20px;">
      ${partTitle('第三部分 · 拟申报经营范围与行业准入资质审查')}
      <div style="background-color:#F8FAFC;border:1px solid #E2E8F0;border-radius:4px;padding:8px 12px;font-size:10px;margin-bottom:8px;line-height:1.6;">
        <div style="font-weight:700;color:#0F172A;margin-bottom:2px;">【营业执照拟申报经营范围（规范表述）】</div>
        <div style="color:#334155;"><strong>一般项目：</strong>${survey.scope.length > 0 ? esc(survey.scope.join('；')) : '待补充'}。（除依法须经批准的项目外，凭营业执照依法自主开展经营活动）</div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:10px;">
        <tbody>
          <tr>
            ${tdLabel('建议行业后置资质', '22%')}
            <td style="padding:6px 10px;border:1px solid #CBD5E1;color:#0F172A;">${plan.postQualifications.length > 0 ? esc(plan.postQualifications.join('、')) : '无特殊前置行政许可，取得营业执照即可自主经营'}</td>
          </tr>
          <tr>
            ${tdLabel('敏感要素排查', '22%')}
            <td style="padding:6px 10px;border:1px solid #CBD5E1;color:#15803D;font-weight:600;">${survey.sensitive.length > 0 ? esc(`需重点核实：${survey.sensitive.join('、')}`) : '未勾选敏感要素；金融、证券、期货等严格准入字样仍以主管部门口径为准'}</td>
          </tr>
        </tbody>
      </table>
      ${plan.preQualifications.length > 0 ? `<div style="margin-top:8px;font-size:10px;color:#475569;line-height:1.6;"><strong>【前置许可提示】</strong>${esc(plan.preQualifications.join('、'))}</div>` : ''}
    </div>

    <!-- 第四部分 -->
    <div style="margin-bottom:22px;">
      ${partTitle('第四部分 · 初创期合规经营与避坑风险提示')}
      <div style="border:1px solid #E2E8F0;border-radius:4px;padding:8px 12px;background-color:#F8FAFC;font-size:9.5px;color:#475569;line-height:1.6;">
        ${report && (report.pitfallGuides.length > 0 || report.industryComplianceTips.length > 0)
          ? `${report.pitfallGuides
              .map(
                (guide, i) =>
                  `<div style="margin-bottom:3px;"><strong>${i + 1}. ${esc(guide.title)}：</strong>${esc(guide.desc)}</div>`
              )
              .join('')}${report.industryComplianceTips
              .map((tip, i) => `<div style="margin-bottom:3px;"><strong>${report.pitfallGuides.length + i + 1}. 行业合规提示：</strong>${esc(tip)}</div>`)
              .join('')}`
          : plan.riskTips.length > 0
            ? plan.riskTips.map((tip, i) => `<div style="margin-bottom:3px;"><strong>${i + 1}. </strong>${esc(tip)}</div>`).join('')
            : `<div style="margin-bottom:3px;"><strong>1. 资金出资合规：</strong>股东认缴出资须按章程期限由本人账户划入公司对公账户，备注“投资款”，留存回单。</div>
               <div style="margin-bottom:3px;"><strong>2. 公私账目严格分立：</strong>公司对公账户与个人收款账户必须严格分立，杜绝公私混同，避免丧失有限责任保护。</div>
               <div style="margin-bottom:3px;"><strong>3. 依法按期纳税申报：</strong>取得执照后即使未经营或当期无收入，也须按期“零申报”，避免被认定为非正常户。</div>
               <div><strong>4. 国家企业信用年报：</strong>每年 1 月 1 日至 6 月 30 日须报送上一年度年报并公示，严防逾期被列入经营异常名录。</div>`}
      </div>
    </div>

    <!-- 报告说明 -->
    <div style="border-top:1.5px solid #E2E8F0;padding-top:14px;margin-top:20px;">
      <div style="background-color:#F8FAFC;border:1px solid #E2E8F0;border-radius:6px;padding:12px 16px;font-size:9.5px;color:#64748B;line-height:1.65;">
        <div style="font-weight:700;color:#334155;margin-bottom:4px;">【报告说明与合规指引】</div>
        <div>1. 本报告由班步企服系统依据申报人填报的企业设立意向信息，并结合新《中华人民共和国公司法》及属地市场监督管理部门现行商事登记规范测算生成。</div>
        <div>2. 报告所列股权架构建议、认缴出资规划、财税统筹定位及经营风险提示，旨在为企业筹建提供结构性参考与合规前置指引。</div>
        <div>3. 最终法定登记范围、企业名称自主申报核准及营业执照发证结果，以属地市场监督管理机关及主管税务机关政务审核为准。</div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;font-size:9px;color:#94A3B8;padding:0 4px;">
        <div>班步企服 · 一站式企业设立与合规服务平台</div>
        <div>生成日期：${esc(genDate)} · 系统编号：${esc(reportNo)}</div>
      </div>
    </div>
  </div>`;
};

/**
 * 完整可独立打开的打印文档：正文自带 inline 样式，这里只补 @page 与页边距。
 * 打印走隐藏 iframe（`utils/printDocument.ts`），只印这份报告、不动整页。
 */
export const buildProposalReportDocument = (input: ProposalReportInput): string => `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>企业商事设立规划与财税合规评估报告</title>
<style>
  @page { size: A4; margin: 0; }
  html, body { margin: 0; padding: 0; background: #FFFFFF; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
</style></head>
<body>${buildProposalReportBody(input)}</body></html>`;
