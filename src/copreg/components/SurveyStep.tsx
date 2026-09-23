/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { SurveyData } from '../types';
import {
  Home,
  CreditCard,
  FileText,
  Users,
  Sparkles,
  Check,
  X,
  ArrowRight,
  Info
} from 'lucide-react';
import { SENSITIVE_OPTIONS } from '../plan';
import { aiFillSurvey } from '../aiFill';
import { surveyRequiredFields } from '../surveyCheck';
import { CaptchaCancelledError } from '../../utils/tencentCaptcha';
import { PhoneVerifyModal } from './PhoneVerifyModal';
import type { PhoneVerification } from '../verification';

interface SurveyStepProps {
  survey: SurveyData;
  onChange: (updated: SurveyData) => void;
  /**
   * 提交问卷生成方案：先过手机验证弹框，验证通过后带着手机号调诊断接口
   * （接口失败由 App 抛出，弹框留在原地显示原因、改验证码重试）
   */
  onSubmit: (verification: PhoneVerification) => Promise<void>;
  /** 重置问卷后通知 App 收尾（清掉第 1 步的本地快照），问卷本身由 onChange 清空 */
  onReset: () => void;
  /** 预填的手机号：App 里还留着上一次验证过的号码就直接带出来 */
  contactPhone?: string;
}

export const SurveyStep: React.FC<SurveyStepProps> = ({
  survey,
  onChange,
  onSubmit,
  onReset,
  contactPhone
}) => {
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // 手机验证弹框：过了必填校验才弹，验证通过后才发「生成需求方案」的请求
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  // 诊断接口的失败原因，显示在弹框里（不关弹框、原地改验证码重试）
  const [submitError, setSubmitError] = useState('');
  const [aiGenerated, setAiGenerated] = useState(false);
  const [aiTagInputScope, setAiTagInputScope] = useState('');
  const [aiTagInputLicense, setAiTagInputLicense] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  /**
   * 提示。上一条的定时器要清掉：连着两条提示时，前一条的定时器会提前把后一条清掉，
   * 用户就看不到真正要紧的那句（填报页踩过，这里同款修法）。
   */
  const toastTimerRef = useRef<number | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastMessage(null), 2800);
  };
  useEffect(
    () => () => {
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    },
    []
  );

  // AI 请求要跑十几秒，这期间用户还能接着改表单；用 ref 留住最新一版，
  // 免得回调里拿着发起请求那一刻的旧值，把这段输入覆盖回去
  const surveyRef = useRef(survey);
  useEffect(() => {
    surveyRef.current = survey;
  }, [survey]);

  // Toggle coreNeeds item helper (support both clean and legacy label values)
  const isCoreNeedChecked = (val: string) => {
    return survey.coreNeeds.some(item => item.includes(val) || val.includes(item));
  };

  const toggleCoreNeed = (val: string) => {
    const exists = isCoreNeedChecked(val);
    if (exists) {
      onChange({
        ...survey,
        coreNeeds: survey.coreNeeds.filter(item => !item.includes(val) && !val.includes(item))
      });
    } else {
      onChange({
        ...survey,
        coreNeeds: [...survey.coreNeeds, val]
      });
    }
  };

  // Toggle array item helper
  const toggleArrayItem = (field: 'revenue' | 'shareholderType' | 'sensitive', item: string) => {
    const list = survey[field];
    if (list.includes(item)) {
      onChange({ ...survey, [field]: list.filter(x => x !== item) });
    } else {
      onChange({ ...survey, [field]: [...list, item] });
    }
  };

  // AI smart suggestion：两个描述都是接口的必填项，缺哪个就点名让用户补哪个；
  // 齐了就交给 aiFillSurvey —— 先弹腾讯验证码，通过后才发请求
  const handleAiGenerate = async () => {
    const missing = [
      ['企业描述', survey.companyDesc],
      ['业务描述', survey.bizDesc]
    ]
      .filter(([, value]) => !value.trim())
      .map(([label]) => label);

    if (missing.length > 0) {
      showToast(`请先填写${missing.join('与')}，AI 将据此智能分析`);
      document.getElementById('sec-biz')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // 验证码弹窗期间按钮也是禁用的：否则再点一次会让后一次弹窗顶掉前一次，
    // 前一次只落得一个 CaptchaCancelledError 被静默吞掉
    setIsAiLoading(true);

    try {
      const suggestion = await aiFillSurvey(survey.companyDesc, survey.bizDesc);

      // 敏感要素只认表单里那几项：多出来的标签表单渲染不出，用户也就删不掉
      const sensitive = suggestion.sensitive.filter((item) => SENSITIVE_OPTIONS.includes(item));

      // **空数组 = 明确「没有」，照样写回去（把这一项清空）**，与诊断接口的覆盖口径一致：
      // 换了描述再点一次「重新生成」，页面上就该是这一版的答案 —— 留着一版 AI 填的旧内容，
      // 用户会以为那就是新结果。想保留自己加的内容就别点重新生成（或点完再补）。
      const current = surveyRef.current;
      onChange({
        ...current,
        scope: suggestion.scope,
        license: suggestion.license,
        sensitive
      });

      setAiGenerated(true);

      if (suggestion.scope.length === 0 && suggestion.license.length === 0 && sensitive.length === 0) {
        // 三项都空：已经按上面的口径清空了，把原因说清楚（不然用户会觉得「点了没反应」）
        showToast('AI 未给出经营范围 / 许可资质 / 敏感要素建议，已清空这三项；可把描述写具体些再试，或手动补充');
        return;
      }

      showToast(
        `已生成 ${suggestion.scope.length} 条经营范围、${suggestion.license.length} 项许可资质建议` +
          (sensitive.length > 0 ? `，并标记 ${sensitive.length} 项敏感要素` : '') +
          '！'
      );
    } catch (error) {
      // 用户自己关掉验证码弹窗不算失败，静默处理
      if (!(error instanceof CaptchaCancelledError)) {
        // aiFillSurvey 抛出来的都是能直接给用户看的中文提示
        showToast(error instanceof Error ? error.message : 'AI 智能填充失败，请稍后重试');
      }
    } finally {
      setIsAiLoading(false);
    }
  };

  const addScopeTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !survey.scope.includes(trimmed)) {
      onChange({ ...survey, scope: [...survey.scope, trimmed] });
      setAiTagInputScope('');
    }
  };

  const removeScopeTag = (tag: string) => {
    onChange({ ...survey, scope: survey.scope.filter(t => t !== tag) });
  };

  const addLicenseTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !survey.license.includes(trimmed)) {
      onChange({ ...survey, license: [...survey.license, trimmed] });
      setAiTagInputLicense('');
    }
  };

  const removeLicenseTag = (tag: string) => {
    onChange({ ...survey, license: survey.license.filter(t => t !== tag) });
  };

  // 提交前逐项拦：必填清单在 surveyCheck.ts，与页面上的必填标记一一对应。
  // 过了这一关才弹手机验证 —— 缺字段时先补字段，没必要先把验证码验了
  const handleValidateAndSubmit = () => {
    const failed = surveyRequiredFields(survey).filter(field => !field.done);
    if (failed.length > 0) {
      const [first] = failed;
      // 一次只报第一处并滚过去，剩下的用条数带一句，免得连弹一串 toast
      showToast(
        failed.length > 1 ? `${first.label}（另有 ${failed.length - 1} 项未完成）` : first.label
      );
      document.getElementById(first.section)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setSubmitError('');
    setShowPhoneModal(true);
  };

  /**
   * 手机验证通过 → 带着手机号与短信凭据生成方案（服务端据此比对验证码）。
   *
   * 失败**不关弹框**：请求没成功就可能一个字段都没落库（手机号也未必算验证过），
   * 失败原因写在弹框里，用户改验证码原地重试；成功才关框（随后 App 会跳去方案页）。
   * 手机号必须验证过才出方案，所以这里没有「先用本地规则生成一份」的兜底。
   */
  const handlePhoneVerified = async (verification: PhoneVerification) => {
    setIsSubmitting(true);
    setSubmitError('');
    try {
      await onSubmit(verification);
      setShowPhoneModal(false);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : '生成需求方案失败，请稍后重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    onChange({
      coreNeeds: [],
      companyDesc: '',
      bizDesc: '',
      scope: [],
      license: [],
      sensitive: [],
      invoiceReq: '',
      monthlyAmount: '',
      revenue: [],
      revenueOther: '',
      shareholderType: [],
      shareholderCount: '',
      capitalRec: '是',
      capitalAmount: '',
      regAddress: '',
      officeSpace: ''
    });
    onReset();
    setAiGenerated(false);
    showToast('已重置调查问卷内容');
  };

  return (
    <div className="pb-32">

      <div className="relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-10 pb-4 relative z-10">

          {/* ==================== Top Step Heading & Tips ==================== */}
          <section className="mb-5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#E6F7F2] text-[#2AA894] mb-2 select-none">
              <span className="w-1.5 h-1.5 rounded-full bg-[#36B39E]"></span>
              <span>第 1 步 · 需求评估</span>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold tracking-tight mb-2">
              <span className="text-[#2AA894]">第 1 步：</span><span className="text-[#1D6C5E]">填写企业开办基本信息与需求评估</span>
            </h1>

            {/* Flat Tips Bar */}
            <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/70 flex items-center gap-2.5 text-xs text-amber-900 leading-relaxed">
              <Info className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                用于评估组织形式与税务开票方案。带 <span className="text-amber-800 font-semibold">必填</span> 项建议完整提供，经营范围可使用 AI 智能生成。
              </span>
            </div>
          </section>

          {/* ==================== 01 核心需求 ==================== */}
          <div
            id="sec-core"
            className="rounded-2xl p-5 sm:p-6 mb-5 border border-slate-200/80 bg-white transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#E6F7F2] text-[#2AA894] select-none">
                <span className="w-1.5 h-1.5 rounded-full bg-[#36B39E]"></span>
                <span>01 · 核心诉求</span>
              </div>
              <span className="text-xs text-slate-400">据此配置银行开户与财税方案</span>
            </div>

            <h2 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight mb-4">
              您开设企业最核心的诉求是什么？
            </h2>

            {/* 2x2 Grid of 4 Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  title: '需公司主体',
                  sub: '营业执照 / 公章',
                  icon: <Home className="w-4 h-4 stroke-[1.8]" />,
                  value: '需公司主体'
                },
                {
                  title: '需对公收款',
                  sub: '开立并使用对公账户',
                  icon: <CreditCard className="w-4 h-4 stroke-[1.8]" />,
                  value: '需对公收款'
                },
                {
                  title: '需开票',
                  sub: '增值税普通发票 / 专用发票',
                  icon: <FileText className="w-4 h-4 stroke-[1.8]" />,
                  value: '需开票'
                },
                {
                  title: '需用工并缴社保',
                  sub: '劳动合同 / 社保公积金',
                  icon: <Users className="w-4 h-4 stroke-[1.8]" />,
                  value: '需用工并缴社保'
                }
              ].map((opt) => {
                const checked = isCoreNeedChecked(opt.value);
                return (
                  <div
                    key={opt.value}
                    onClick={() => toggleCoreNeed(opt.value)}
                    className={`flex items-center justify-between p-3.5 sm:p-4 rounded-xl border transition-colors cursor-pointer select-none ${
                      checked
                        ? 'border-[#36B39E] bg-[#F8FCFB]'
                        : 'border-slate-200/80 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#E6F7F2] flex items-center justify-center text-[#2AA894] shrink-0">
                        {opt.icon}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-800 leading-snug">
                          {opt.title}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {opt.sub}
                        </div>
                      </div>
                    </div>

                    {/* Radio / Check Circle */}
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                      checked
                        ? 'bg-[#36B39E] border-[#36B39E] text-white'
                        : 'border-slate-300 bg-white'
                    }`}>
                      {checked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ==================== 02 企业与业务 ==================== */}
          <div
            id="sec-biz"
            className="rounded-2xl p-5 sm:p-6 mb-5 border border-slate-200/80 bg-white transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#E6F7F2] text-[#2AA894] select-none">
                <span className="w-1.5 h-1.5 rounded-full bg-[#36B39E]"></span>
                <span>02 · 企业与业务</span>
              </div>
              <span className="text-xs text-slate-400">用于生成经营范围与合规建议</span>
            </div>

            <h2 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight mb-4">
              请描述拟设立企业的情况
            </h2>

            <div className="space-y-3.5">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1">
                  企业描述 <span className="text-amber-600 text-[10px] font-semibold">必填</span>
                </label>
                <textarea
                  value={survey.companyDesc}
                  onChange={(e) => onChange({ ...survey, companyDesc: e.target.value })}
                  rows={2}
                  placeholder="例如：拟设立有限责任公司，主营跨境电商，计划面向欧美市场。"
                  className="w-full text-xs sm:text-sm p-2.5 rounded-xl border border-slate-200/80 focus:border-[#36B39E] outline-none transition-colors resize-y text-slate-800"
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1">
                  业务描述 <span className="text-amber-600 text-[10px] font-semibold">必填</span>
                </label>
                <textarea
                  value={survey.bizDesc}
                  onChange={(e) => onChange({ ...survey, bizDesc: e.target.value })}
                  rows={2}
                  placeholder="例如：国内采购商品，通过独立站销售给海外消费者并提供售后服务。"
                  className="w-full text-xs sm:text-sm p-2.5 rounded-xl border border-slate-200/80 focus:border-[#36B39E] outline-none transition-colors resize-y text-slate-800"
                />
              </div>
            </div>

            {/* AI Suggestion Box */}
            <div className="mt-5 pt-4 border-t border-slate-100">
              <div className={`p-3.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-colors ${
                aiGenerated ? 'bg-slate-50/70 border-slate-200/80' : 'bg-[#F8FCFB] border-[#CDEFE7]'
              }`}>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-white border border-slate-200/70 flex items-center justify-center text-[#2AA894] shrink-0">
                    <Sparkles className="w-4 h-4 text-[#2AA894]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-bold text-slate-800">AI 智能提取科目</span>
                      <span className={`text-[10px] px-2 py-0.2 rounded-full font-medium ${
                        aiGenerated ? 'bg-[#E6F7F2] text-[#2AA894]' : 'bg-slate-200/70 text-slate-600'
                      }`}>
                        {aiGenerated ? '已生成' : '待生成'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      智能生成工商经营范围、许可资质与敏感要素
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  // 提交在途时不让再发起 AI 填充：填进来的范围 / 资质进不了已经发出去的请求，
                  // 结果回来还会写回一个已经离开的问卷页
                  disabled={isAiLoading || isSubmitting}
                  onClick={handleAiGenerate}
                  className="w-full sm:w-auto px-4 py-1.5 rounded-lg bg-[#36B39E] hover:bg-[#2AA894] text-white font-medium text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isAiLoading ? 'animate-spin' : ''}`} />
                  <span>{isAiLoading ? '分析中…' : aiGenerated ? '重新生成' : 'AI 智能填充'}</span>
                </button>
              </div>

              {/* Scope Tags */}
              <div className="mt-3.5">
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1">
                  初步经营范围 <span className="text-slate-400 text-[10px] font-normal">支持添加或删除</span>
                </label>
                <div className="min-h-[42px] p-2 border border-slate-200/80 rounded-xl bg-white flex flex-wrap items-center gap-1.5 focus-within:border-[#36B39E] transition-colors">
                  {survey.scope.length === 0 ? (
                    <span className="text-xs text-slate-400 pl-1">
                      点击上方「AI 智能填充」或在右侧输入后回车添加
                    </span>
                  ) : (
                    survey.scope.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium bg-[#E6F7F2] text-[#2AA894]"
                      >
                        <span>{tag}</span>
                        <button
                          type="button"
                          onClick={() => removeScopeTag(tag)}
                          className="w-3.5 h-3.5 rounded hover:text-red-500 flex items-center justify-center transition-colors"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    ))
                  )}
                  <input
                    type="text"
                    placeholder="+ 回车添加科目"
                    value={aiTagInputScope}
                    onChange={(e) => setAiTagInputScope(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addScopeTag(aiTagInputScope);
                      }
                    }}
                    className="text-xs px-2 py-1 outline-none flex-1 min-w-[110px] bg-transparent text-slate-800"
                  />
                </div>
              </div>

              {/* License Tags */}
              <div className="mt-3.5">
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1">
                  涉及许可 / 备案资质 <span className="text-slate-400 text-[10px] font-normal">AI 建议 / 可自定义</span>
                </label>
                <div className="min-h-[42px] p-2 border border-slate-200/80 rounded-xl bg-white flex flex-wrap items-center gap-1.5 focus-within:border-[#36B39E] transition-colors">
                  {survey.license.length === 0 ? (
                    <span className="text-xs text-slate-400 pl-1">
                      暂无前置许可，或输入后回车添加
                    </span>
                  ) : (
                    survey.license.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium bg-[#E6F7F2] text-[#2AA894]"
                      >
                        <span>{tag}</span>
                        <button
                          type="button"
                          onClick={() => removeLicenseTag(tag)}
                          className="w-3.5 h-3.5 rounded hover:text-red-500 flex items-center justify-center transition-colors"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    ))
                  )}
                  <input
                    type="text"
                    placeholder="+ 回车添加资质"
                    value={aiTagInputLicense}
                    onChange={(e) => setAiTagInputLicense(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addLicenseTag(aiTagInputLicense);
                      }
                    }}
                    className="text-xs px-2 py-1 outline-none flex-1 min-w-[110px] bg-transparent text-slate-800"
                  />
                </div>
              </div>

              {/* Sensitive Checklist */}
              <div className="mt-3.5">
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1">
                  涉及敏感行业要素
                </label>
                <div className="flex flex-wrap gap-1.5 p-2.5 border border-slate-200/80 rounded-xl bg-white">
                  {SENSITIVE_OPTIONS.map((item) => {
                    const checked = survey.sensitive.includes(item);
                    return (
                      <button
                        type="button"
                        key={item}
                        onClick={() => toggleArrayItem('sensitive', item)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                          checked
                            ? 'bg-[#E6F7F2] text-[#2AA894] border border-[#36B39E]/50'
                            : 'bg-slate-50 text-slate-600 border border-slate-200/70 hover:bg-slate-100'
                        }`}
                      >
                        {checked && <Check className="w-3 h-3 stroke-[3]" />}
                        <span>{item}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>

          {/* ==================== 03 开票与收入 ==================== */}
          <div
            id="sec-invoice"
            className="rounded-3xl p-6 sm:p-8 mb-6 border border-slate-200 bg-white shadow-xs transition-all"
          >
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#E6F7F2] text-[#2AA894] mb-3 select-none">
              <span className="w-1.5 h-1.5 rounded-full bg-[#36B39E]"></span>
              <span>03 · 开票与收入</span>
            </div>

            <h2 className="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight mb-2">
              开票需求与收入结构
            </h2>
            <p className="text-sm text-[#64748B] mb-6">
              用于税务方案与纳税人身份评估。
            </p>

            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                  近期开票要求 <span className="text-amber-600 text-[10px] font-semibold">必选</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['不确定', '增值税专用发票', '增值税普通发票'].map((val) => {
                    const active = survey.invoiceReq === val;
                    return (
                      <button
                        type="button"
                        key={val}
                        onClick={() => onChange({ ...survey, invoiceReq: val })}
                        className={`py-2 px-2.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                          active
                            ? 'border-[#36B39E] bg-[#F8FCFB] text-[#2AA894]'
                            : 'border-slate-200/80 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {val}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                  预计月开票额 <span className="text-amber-600 text-[10px] font-semibold">必选</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {['< 10 万', '10 - 50 万', '50 - 200 万', '> 200 万'].map((val) => {
                    const active = survey.monthlyAmount === val;
                    return (
                      <button
                        type="button"
                        key={val}
                        onClick={() => onChange({ ...survey, monthlyAmount: val })}
                        className={`py-2 px-2.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                          active
                            ? 'border-[#36B39E] bg-[#F8FCFB] text-[#2AA894]'
                            : 'border-slate-200/80 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {val}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                  收入模式 <span className="text-amber-600 text-[10px] font-semibold">至少选 1 项</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {['服务费', '货物销售', '平台抽佣', '项目/阶段款', '其他'].map((val) => {
                    const active = survey.revenue.includes(val);
                    return (
                      <button
                        type="button"
                        key={val}
                        onClick={() => toggleArrayItem('revenue', val)}
                        className={`py-1.5 px-3 rounded-lg border text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                          active
                            ? 'border-[#36B39E] bg-[#F8FCFB] text-[#2AA894]'
                            : 'border-slate-200/80 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {active && <Check className="w-3 h-3 stroke-[3]" />}
                        <span>{val}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* ==================== 04 股权与资本 ==================== */}
          <div
            id="sec-equity"
            className="rounded-2xl p-5 sm:p-6 mb-5 border border-slate-200/80 bg-white transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#E6F7F2] text-[#2AA894] select-none">
                <span className="w-1.5 h-1.5 rounded-full bg-[#36B39E]"></span>
                <span>04 · 股权与资本</span>
              </div>
              <span className="text-xs text-slate-400">影响公司类型与认缴期限</span>
            </div>

            <h2 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight mb-4">
              股东结构与资本规模
            </h2>

            <div className="space-y-3.5">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                  股东类型 <span className="text-amber-600 text-[10px] font-semibold">至少选 1 项</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['自然人', '公司股东', '境外主体'].map((val) => {
                    const active = survey.shareholderType.includes(val);
                    return (
                      <button
                        type="button"
                        key={val}
                        onClick={() => toggleArrayItem('shareholderType', val)}
                        className={`py-2 px-2.5 rounded-lg border text-xs font-medium transition-colors flex items-center justify-center gap-1 cursor-pointer ${
                          active
                            ? 'border-[#36B39E] bg-[#F8FCFB] text-[#2AA894]'
                            : 'border-slate-200/80 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {active && <Check className="w-3 h-3 stroke-[3]" />}
                        <span>{val}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                  股东人数 <span className="text-amber-600 text-[10px] font-semibold">必选</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['1 个', '2 个', '3 个及以上'].map((val) => {
                    const active = survey.shareholderCount === val;
                    return (
                      <button
                        type="button"
                        key={val}
                        onClick={() => onChange({ ...survey, shareholderCount: val })}
                        className={`py-2 px-2.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                          active
                            ? 'border-[#36B39E] bg-[#F8FCFB] text-[#2AA894]'
                            : 'border-slate-200/80 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {val}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100">
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                  是否需要注册资本专家建议 <span className="text-amber-600 text-[10px] font-semibold">必选</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: '是 · 需要专家建议（默认）', value: '是' },
                    { label: '否 · 已有明确数额', value: '否' }
                  ].map((opt) => {
                    const active = survey.capitalRec === opt.value;
                    return (
                      <button
                        type="button"
                        key={opt.value}
                        onClick={() => onChange({ ...survey, capitalRec: opt.value })}
                        className={`py-2 px-2.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                          active
                            ? 'border-[#36B39E] bg-[#F8FCFB] text-[#2AA894]'
                            : 'border-slate-200/80 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 选了「已有明确数额」才要填金额；专家建议那一档金额由服务人员定，这里不掺和 */}
              {survey.capitalRec === '否' && (
                <div className="pt-3 border-t border-slate-100">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                    注册资本金额 <span className="text-amber-600 text-[10px] font-semibold">必填</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={survey.capitalAmount}
                      onChange={(e) =>
                        // 只收整数万元：与 registration 那边「注册资本需填非负整数」的规则一致
                        onChange({ ...survey, capitalAmount: e.target.value.replace(/\D/g, '') })
                      }
                      placeholder="例如：100"
                      className="w-32 text-xs sm:text-sm p-2.5 rounded-xl border border-slate-200/80 focus:border-[#36B39E] outline-none transition-colors text-slate-800"
                    />
                    <span className="text-xs text-slate-500">万元人民币</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5">认缴金额需在成立之日起 5 年内实缴完毕。</p>
                </div>
              )}
            </div>
          </div>

          {/* ==================== 05 地址与场地 ==================== */}
          <div
            id="sec-address"
            className="rounded-2xl p-5 sm:p-6 mb-6 border border-slate-200/80 bg-white transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#E6F7F2] text-[#2AA894] select-none">
                <span className="w-1.5 h-1.5 rounded-full bg-[#36B39E]"></span>
                <span>05 · 地址与场地</span>
              </div>
              <span className="text-xs text-slate-400">用于配置合规挂靠或场地租赁</span>
            </div>

            <h2 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight mb-4">
              注册地址与办公场地需求
            </h2>

            <div className="space-y-3.5">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                  是否需要推荐注册地址 <span className="text-amber-600 text-[10px] font-semibold">必选</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {['是（需推荐）', '否（自有地址）'].map((val) => {
                    const active = survey.regAddress === val;
                    return (
                      <button
                        type="button"
                        key={val}
                        onClick={() => onChange({ ...survey, regAddress: val })}
                        className={`py-2 px-2.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                          active
                            ? 'border-[#36B39E] bg-[#F8FCFB] text-[#2AA894]'
                            : 'border-slate-200/80 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {val}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                  是否需要推荐实体办公场地 <span className="text-amber-600 text-[10px] font-semibold">必选</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {['是', '否'].map((val) => {
                    const active = survey.officeSpace === val;
                    return (
                      <button
                        type="button"
                        key={val}
                        onClick={() => onChange({ ...survey, officeSpace: val })}
                        className={`py-2 px-2.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                          active
                            ? 'border-[#36B39E] bg-[#F8FCFB] text-[#2AA894]'
                            : 'border-slate-200/80 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {val === '是' ? '是 · 需要推荐' : '否 · 暂不需要'}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ==================== Flat Bottom Floating Bar ==================== */}
      <div className="fixed left-0 right-0 bottom-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/70 py-3 px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">

          <div className="text-xs text-slate-400 select-none">
            填写完成后将自动生成服务方案与透明报价
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleReset}
              disabled={isSubmitting || isAiLoading}
              className="px-5 py-2 rounded-full border border-slate-200/80 bg-white text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              重置
            </button>

            <button
              type="button"
              onClick={handleValidateAndSubmit}
              disabled={isSubmitting || isAiLoading}
              className="px-6 py-2 rounded-full bg-[#36B39E] hover:bg-[#2AA894] text-white text-xs font-medium transition-colors active:scale-95 flex items-center gap-1.5 cursor-pointer select-none disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <span>{isSubmitting ? '生成方案中…' : '生成需求方案'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>
      </div>

      {/* 手机号验证弹框：验证通过才发「生成需求方案」；取消 = 什么都不做，原地留在问卷页 */}
      {showPhoneModal && (
        <PhoneVerifyModal
          initialPhone={contactPhone}
          submitLabel="验证并生成方案"
          busy={isSubmitting}
          error={submitError}
          onVerified={handlePhoneVerified}
          onClose={() => {
            setShowPhoneModal(false);
            setSubmitError('');
          }}
        />
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-slate-900 text-white text-xs font-semibold shadow-xl flex items-center gap-2 animate-in fade-in duration-150">
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
};
