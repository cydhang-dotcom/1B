/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 第 5 步「申报资料填报」的**初始数据**：从前面的步骤真实转换，不再塞一整套假示例。
 *
 * 之前这里用的是一个写死的示例数据工厂 —— 一份编好的跨境电商公司：编的企业描述、
 * 编的身份证号、编的委托书 PDF、编的股东与人员，连「信息属实」都预先勾上。
 * 用户看到的「填报」页面于是全是别人的数据，很容易看漏。
 *
 * 现在的口径：
 *
 * 1. **能从前面步骤拿到的，一律转换过来**（问卷第 1 步 + 方案第 2 步 + 确认/支付留下的手机号）；
 * 2. **拿不到的就空着**，让用户在第 5 步自己填 —— 不编名字、不编证件号、不编股比金额，
 *    也不预先勾选「信息属实」这类需要本人确认的项；
 * 3. 转换规则只做**有依据的推断**（备案名称取方案给的建议名、注册资本取问卷或方案里的数字、
 *    股东行数按问卷的股东人数铺开），拿不准的宁可留空。
 *
 * 纯函数、不碰 DOM 也不读 import.meta.env，所以 scripts/ 下的 tsx 自检能直接引它。
 */

import { createBlankForm, uid } from './registration/defaultData';
import type { RegistrationFullForm, ShareholderRecord } from './registration/types';
import type { RegistrationPlan, SurveyData } from './types';

export interface RegistrationSeedInput {
  /** 第 1 步问卷 */
  survey: SurveyData;
  /** 第 2 步方案（含题目里那份诊断建议） */
  plan: RegistrationPlan;
  /** 确认/支付步骤用过的经办手机号（本地不落，能拿到就带上） */
  contactPhone?: string;
}

/** 问卷里股东人数选「3 个及以上」时，先按 3 个铺开（这是下限，不是真实人数） */
export const MIN_SHAREHOLDER_ROWS = 3;

/** 名称建议里超过这个长度的片段当整句描述丢掉，不塞进「企业名称」输入框 */
const MAX_NAME_LENGTH = 30;

/**
 * 从方案给的名称建议里挑出备选字号。
 *
 * 服务端给的是一整段（如「甲乙丙科技有限公司；备选：甲乙丙（深圳）科技有限公司」），
 * 本地模板给的是空串。按分隔符拆开、去掉「备选」「建议」这类前缀与括号说明，
 * 只留像公司名的片段（含「公司」「中心」「商行」等字样，且不过长），最多 3 个。
 */
export const namesFromProposal = (proposal: string): string[] => {
  const raw = typeof proposal === 'string' ? proposal : '';
  const parts = raw
    .split(/[、,，;；\n\r]|(?:\s+备选[:：]?)/)
    .map((part) =>
      part
        .replace(/^[（(【\[]?(?:备选|建议|推荐)(?:名称)?[:：]?\s*/, '')
        .replace(/^[\s:：\-—]+/, '')
        .replace(/[）)】\]]$/, '')
        .trim()
    )
    .filter((part) => part.length > 0 && part.length <= MAX_NAME_LENGTH);

  // 有像公司名的就只要那些，省得把「不建议使用生僻字」这类整句也塞进名称框
  const named = parts.filter((part) => /(公司|中心|商行|事务所|企业|厂|店)/.test(part));
  const picked = (named.length > 0 ? named : parts).slice(0, 3);

  return ['', '', ''].map((_, index) => picked[index] ?? '');
};

/**
 * 注册资本（万元，纯数字串）。
 *
 * 优先用问卷里用户自己填的金额（`capitalRec === '否'` 时才有）；否则从方案那句建议里
 * 取**第一个数字**（「建议100万元人民币（认缴），不建议低于50万元」→ 100）。
 * 一个数字都没有就留空 —— 空着会被表单校验拦住，总好过编一个看着像真的注册资本。
 */
export const capitalWanFrom = (survey: SurveyData, plan: RegistrationPlan): string => {
  const own = survey.capitalRec === '否' ? survey.capitalAmount.trim() : '';
  if (/^\d+(\.\d+)?$/.test(own)) return own.replace(/\.0+$/, '');

  const matched = (plan.capitalAmount || '').match(/\d+(?:\.\d+)?/);
  if (!matched) return '';
  // 取到的可能是「100万」「50」，统一成不带小数的万元字符串
  return matched[0].replace(/\.0+$/, '');
};

/** 组织形式：方案的 companyType 是一整句，只在能明确认出时才改，否则用「有限责任公司」 */
export const orgFromPlan = (plan: RegistrationPlan): string => {
  const text = `${plan.companyType || ''} ${plan.taxpayerIdentity || ''}`;
  if (text.includes('股份有限公司')) return '股份有限公司';
  if (text.includes('合伙')) return '合伙企业';
  return '有限责任公司';
};

/** 问卷里选的股东类型 → 申报表的股东类型 */
const shareholderTypeOf = (surveyType: string): ShareholderRecord['type'] =>
  surveyType === '公司股东' ? '企业' : surveyType === '境外主体' ? '其他' : '自然人';

/** 问卷里选的股东人数 → 铺几行。认不出的取值返回 0（不铺） */
export const shareholderRowCount = (survey: SurveyData): number => {
  const count = survey.shareholderCount.trim();
  if (count.startsWith('1')) return 1;
  if (count.startsWith('2')) return 2;
  if (count.startsWith('3')) return MIN_SHAREHOLDER_ROWS;
  return 0;
};

/**
 * 按问卷的股东人数与类型铺出股东行：**只铺结构，不编姓名/证件/股比/出资额**。
 * 选了多种类型时按顺序轮流分配（如「自然人 + 公司股东」各 2 人 → 自然人、企业各一行）。
 */
export const shareholdersFromSurvey = (survey: SurveyData): ShareholderRecord[] => {
  const count = shareholderRowCount(survey);
  if (count === 0) return [];

  const types = survey.shareholderType.filter((type) => type.trim() !== '');
  return Array.from({ length: count }, (_, index) => ({
    id: uid(),
    type: shareholderTypeOf(types.length > 0 ? types[index % types.length] : '自然人'),
    personId: null,
    name: '',
    code: '',
    ratio: '',
    amount: '',
    method: ['货币'],
    files: [],
  }));
};

/** 问卷里「要不要推荐注册地址/办公场地」是「是（需推荐）」这类取值，取首字判断 */
const wantsRecommendation = (value: string): boolean => value.trim().startsWith('是');

/**
 * 组出第 5 步的初始表单：空骨架（`createBlankForm`）+ 前面步骤能转换过来的字段。
 * 空骨架里的组织类型、董事监事设置等是**结构性默认值**（不设董事会之类），
 * 不属于「编造的用户资料」，保留。
 */
export const registrationSeedFrom = ({
  survey,
  plan,
  contactPhone = '',
}: RegistrationSeedInput): RegistrationFullForm => {
  const blank = createBlankForm();

  return {
    ...blank,
    // 第 5 步提交时还要再发一次短信验证，这里把确认步骤用过的手机号带上省得重填
    submissionPhone: contactPhone,
    basic: {
      ...blank.basic,
      org: orgFromPlan(plan),
      intro: survey.companyDesc.trim(),
      service: survey.bizDesc.trim(),
      scope: survey.scope.join('；'),
      capital: capitalWanFrom(survey, plan),
      // 问卷选「金额由服务人员定」就按「专家建议」处理；上面的金额是方案给的建议值，可改
      expert: survey.capitalRec === '是',
      names: namesFromProposal(plan.companyNameProposal || ''),
      regRecommend: wantsRecommendation(survey.regAddress),
      workRecommend: wantsRecommendation(survey.officeSpace),
    },
    shareholders: shareholdersFromSurvey(survey),
    // people / roles 由第 5 步自己收集；委托书受托人、证件号、附件同样不预填（本地没有真数据）
    authorization: { ...blank.authorization },
    confirm: { ...blank.confirm },
  };
};
