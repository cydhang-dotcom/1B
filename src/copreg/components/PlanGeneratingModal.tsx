/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 「AI 财税与合规引擎正在推演」生成方案弹框（第 1 步「生成需求方案」用）。
 *
 * 迁移自参考实现（cydhang-dotcom/copreg `SurveyStep` 里短信验证成功后的生成 Loading 弹框）：
 * 四段推演步骤 + 进度条 + 顶部渐变条，视觉与文案照搬。
 *
 * 与参考实现的一处**有意差异**：参考里四段是纯演示动画（固定 3.1s，700 / 1500 / 2300ms 推进），
 * 走完就跳方案页；这里背后是真实的诊断接口（大模型可能跑十几秒到几十秒），所以节奏放慢成
 * **每 10 秒推进一段**（10s / 20s / 30s），进度条停在 95% 不再涨到 100% ——
 * 一直卡在「100% 还在转」会让人以为页面死了。
 * 请求一结束（成功切方案页 / 失败关弹框）本组件就被卸载，不需要自己收尾。
 */

import React, { useEffect, useState } from 'react';
import { Bot, BrainCircuit, Check, Loader2 } from 'lucide-react';

/** 四段推演步骤（与参考实现逐字一致） */
const GENERATION_STEPS = [
  { label: '解析业务分类与行业经营范围特征', desc: '智能匹配最新国民经济行业代码与许可资质' },
  { label: '推演股权治理架构与新公司法实缴期限', desc: '按股东构成设计表决权机制与 5 年出资规划' },
  { label: '核对经营场所类型与税务身份纳税方案', desc: '评估商用场地合规性，测算小规模或一般纳税人税负' },
  { label: '生成专属企业设立方案评估报告与服务清单', desc: '正在装配基础服务项目、增值服务包与优惠价格' },
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
