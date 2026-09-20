/**
 * 问卷的必填项清单：SurveyStep 点「生成需求方案」时按这份表逐项拦。
 *
 * 每条都对应页面上一个标了「必填 / 必选 / 至少选 1 项」的控件，顺序就是页面
 * 从上到下的顺序 —— 校验只报第一处并把那一段滚到眼前，按顺序报才符合阅读习惯。
 * 只判「填了没有」，不校格式：问卷里全是选择卡与自由文本，没有格式可言
 * （注册资本金额那个输入框在键入时就把非数字滤掉了，所以「非空」即「是整数」）。
 */

import type { SurveyData } from './types';

/** 一条必填项：没填时提示什么、把页面滚到哪一段 */
export interface SurveyRequiredField {
  /** 未填时的提示语，直接进 toast */
  label: string;
  /** 所在区块的 DOM id，与 SurveyStep 里各 section 的 id 对应 */
  section: string;
  done: boolean;
}

const filled = (value: string): boolean => value.trim() !== '';

/** 全部必填项及其填写状态，按页面顺序 */
export function surveyRequiredFields(survey: SurveyData): SurveyRequiredField[] {
  return [
    {
      label: '请至少选择一项核心需求',
      section: 'sec-core',
      done: survey.coreNeeds.length > 0
    },
    {
      label: '请完整填写企业描述与业务描述',
      section: 'sec-biz',
      done: filled(survey.companyDesc) && filled(survey.bizDesc)
    },
    {
      label: '请选择近期开票要求',
      section: 'sec-invoice',
      done: survey.invoiceReq !== ''
    },
    {
      label: '请选择预计月开票额',
      section: 'sec-invoice',
      done: survey.monthlyAmount !== ''
    },
    {
      label: '请至少选择一项收入模式',
      section: 'sec-invoice',
      done: survey.revenue.length > 0
    },
    {
      label: '请至少选择一项股东类型',
      section: 'sec-equity',
      done: survey.shareholderType.length > 0
    },
    {
      label: '请选择股东人数',
      section: 'sec-equity',
      done: survey.shareholderCount !== ''
    },
    {
      label: '请选择是否需要注册资本专家建议',
      section: 'sec-equity',
      done: survey.capitalRec !== ''
    },
    {
      // 选「否」才会出现金额输入框，此时必须填；选「是」由服务人员定，不要求
      label: '请填写注册资本金额',
      section: 'sec-equity',
      done: survey.capitalRec !== '否' || filled(survey.capitalAmount)
    },
    {
      label: '请选择是否需要推荐注册地址',
      section: 'sec-address',
      done: survey.regAddress !== ''
    },
    {
      label: '请选择是否需要推荐实体办公场地',
      section: 'sec-address',
      done: survey.officeSpace !== ''
    }
  ];
}
