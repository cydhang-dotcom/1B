/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 「AI 财税与合规引擎正在推演」生成方案弹框（第 1 步「生成需求方案」用）。
 *
 * 迁移自参考实现（cydhang-dotcom/copreg `SurveyStep` 里短信验证成功后的生成 Loading 弹框）：
 * 四段推演步骤 + 进度条 + 顶部渐变条，视觉照搬。
 *
 * 与参考实现的两处**有意差异**：
 *   1. **文案对齐第 2 步的四张「核心决策」建议卡**：参考实现的四段写的是「业务分类 / 股权架构 /
 *      税负测算 / 生成报告与服务清单」，其中第 1、4 段在方案页上并没有对应物；这里改成与
 *      方案页 01 区块（`PlanReportView`）**逐张对应**的四段 —— 组织形式与股权架构 / 注册资本与
 *      出资规划 / 财税身份与发票统筹 / 经营场所与住所合规，也就是弹框走完、方案页立刻出现的
 *      那四段建议（`report.coreDecisions` 的四个维度）。每段标题按参考实现的口气**带一个动词前缀**
 *      （推演 / 测算 / 匹配 / 核验），动词后面那半截与卡片标题逐字一致。用户看着弹框就能预期
 *      下面会给什么，不要在弹框里承诺方案页上看不到的东西。
 *   2. **节奏放慢**：参考里四段是纯演示动画（固定 3.1s，700 / 1500 / 2300ms 推进），走完就跳
 *      方案页；这里背后是真实的诊断接口（大模型可能跑十几秒到几十秒），所以改成
 *      **每 10 秒推进一段**（10s / 20s / 30s），进度条停在 95% 不再涨到 100% ——
 *      一直卡在「100% 还在转」会让人以为页面死了。
 * 请求一结束（成功切方案页 / 失败关弹框）本组件就被卸载，不需要自己收尾。
 */

import React, { useEffect, useState } from 'react';
import { Bot, BrainCircuit, Check, Loader2 } from 'lucide-react';

/**
 * 四段推演步骤：**动词前缀 + 方案页 01 区块四张「核心决策」建议卡的标题**
 * （`PlanReportView` 的四张卡 / `proposalReportDoc` 第二部分，序号 01~04 同一顺序），
 * 描述写的就是那一档在方案页上给出的结论口径 —— 弹框是这四段建议的「生成中」，不是另一套说辞。
 * 动词是弹框自己的口径（在**做**什么），卡片标题是方案页的口径（**给出**什么），
 * 后半截必须与卡片标题逐字一致；改这里时要跟 `PlanReportView` / `proposalReportDoc` 一起看。
 */
const GENERATION_STEPS = [
  { label: '推演组织形式与股权架构', desc: '按股东构成设计责任形式、股比与表决权治理安排' },
  { label: '测算注册资本与出资规划', desc: '结合业务规模核定认缴出资额与新《公司法》5 年实缴节奏' },
  { label: '匹配财税身份与发票统筹', desc: '比对小规模与一般纳税人身份，测算税负与开票方案' },
  { label: '核验经营场所与住所合规', desc: '按地址类型核查登记适用性、材料清单与住所要件' },
];

/**
 * 后三步的推进时刻：**每 10 秒推进一段**（第 0 步在挂载时就是当前步）。
 * 参考实现是 700 / 1500 / 2300ms，这里按真实接口耗时放慢，免得几秒钟就走到最后一段干等。
 */
const STEP_DELAYS_MS = [10_000, 20_000, 30_000];

/** 动画走完后进度条停在这个值：请求没回来之前不谎报 100% */
const HOLDING_PROGRESS = 95;

export const PlanGeneratingModal: React.FC = () => {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const timers = STEP_DELAYS_MS.map((delay, index) =>
      window.setTimeout(() => setStepIndex(index + 1), delay),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const progress = stepIndex >= GENERATION_STEPS.length - 1 ? HOLDING_PROGRESS : (stepIndex + 1) * 25;

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 sm:p-7 border border-slate-200/80 shadow-2xl relative overflow-hidden">
        {/* 顶部装饰渐变条 */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#1D6C5E] via-[#36B39E] to-emerald-400 animate-pulse" />

        <div className="text-center mb-6 pt-2">
          <div className="relative w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <div className="absolute inset-0 rounded-2xl bg-[#E6F7F2] animate-ping opacity-35" />
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#1D6C5E] to-[#36B39E] text-white flex items-center justify-center shadow-lg relative z-10">
              <BrainCircuit className="w-8 h-8 animate-pulse text-white" />
            </div>
          </div>

          <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-1.5 tracking-tight flex items-center justify-center gap-2">
            <span>AI 财税与合规引擎正在推演</span>
            <Loader2 className="w-4 h-4 text-[#2AA894] animate-spin shrink-0" />
          </h3>
          <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
            正结合新《公司法》合规准则、股东架构及经营特征为您定制最优落地方案，请稍候片刻…
          </p>
        </div>

        {/* 动态步骤进度 */}
        <div className="space-y-3 bg-slate-50/80 rounded-xl p-4 border border-slate-100 text-xs mb-5">
          {GENERATION_STEPS.map((step, idx) => {
            const isFinished = stepIndex > idx;
            const isCurrent = stepIndex === idx;

            return (
              <div key={step.label} className="flex items-start gap-3 transition-all duration-300">
                <div className="mt-0.5 shrink-0">
                  {isFinished ? (
                    <div className="w-4 h-4 rounded-full bg-[#1D6C5E] text-white flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                  ) : isCurrent ? (
                    <div className="w-4 h-4 rounded-full border-2 border-[#36B39E] border-t-transparent animate-spin" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-slate-300 bg-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-xs font-semibold ${
                      isFinished ? 'text-slate-800' : isCurrent ? 'text-[#1D6C5E]' : 'text-slate-400'
                    }`}
                  >
                    {step.label}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">{step.desc}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 底部进度条 */}
        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-gradient-to-r from-[#1D6C5E] to-[#36B39E] h-1.5 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between items-center text-[10px] text-slate-400 mt-2 px-0.5">
          <span className="flex items-center gap-1">
            <Bot className="w-3 h-3 text-[#2AA894]" />
            <span>智能引擎运算中</span>
          </span>
          <span>{progress}%</span>
        </div>
      </div>
    </div>
  );
};
