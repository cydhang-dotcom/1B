/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ProcessStep } from '../types';
import { Sparkles } from 'lucide-react';

interface TopNavbarProps {
  currentStep?: ProcessStep;
  onSelectStep?: (step: ProcessStep) => void;
  unlockedSteps?: ProcessStep[];
  progressPct?: number;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  onSelectStep
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/70 transition-all">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">

        {/* Left: Brand */}
        <div
          onClick={() => onSelectStep && onSelectStep('survey')}
          className="flex items-center gap-2.5 cursor-pointer group shrink-0"
        >
          <div className="w-8 h-8 rounded-xl bg-[#E6F7F2] flex items-center justify-center text-[#2AA894]">
            <Sparkles className="w-4 h-4 stroke-[2]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-800 text-sm leading-tight">
                企业注册向导
              </span>
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#E6F7F2] text-[#1D6C5E] border border-[#2AA894]/30 leading-none">
                <Sparkles className="w-2.5 h-2.5 text-[#2AA894]" />
                AI
              </span>
            </div>
            <div className="text-[10px] tracking-wide text-slate-400 font-medium uppercase">
              AI Registration Guide
            </div>
          </div>
        </div>

      </div>
    </header>
  );
};
