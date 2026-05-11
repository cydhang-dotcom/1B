import React from 'react';

export default function PhoneMockup() {
  return (
    <div className="relative mx-auto w-[320px] h-[640px] bg-white rounded-[40px] p-3 shadow-xl shadow-[#66CDB5]/5 relative z-10 border border-slate-200">
      {/* Notch */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 w-20 h-5 bg-slate-100 rounded-full z-20 border border-slate-200"></div>

      {/* Screen */}
      <div className="h-full w-full bg-[#fafafa] rounded-[32px] overflow-hidden relative flex flex-col border border-slate-100">
        {/* Status Bar */}
        <div className="h-8 flex justify-between items-center px-8 pt-4 text-[10px] font-bold text-slate-400 z-10 shrink-0 mb-1">
          <span>9:41</span>
          <div className="flex gap-1 items-center">
            <div className="w-3 h-3 border border-slate-300 rounded-full"></div>
            <div className="w-3 h-3 bg-slate-300 rounded-full"></div>
          </div>
        </div>

        {/* WeChat Header */}
        <div className="h-14 w-full px-6 flex justify-between items-center shrink-0 border-b border-slate-100 bg-white mb-3">
          <div>
            <div className="text-[9px] font-bold text-[#66CDB5] uppercase tracking-widest leading-none mb-1">CEO Dashboard</div>
            <div className="text-xl font-bold text-slate-800">班步一企通</div>
          </div>
          <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center">
            <div className="w-2 h-2 bg-[#66CDB5] rounded-full"></div>
          </div>
        </div>

        {/* Scrollable Content wrapper to simulate horizontal scroll trick */}
        <div className="flex-1 w-full overflow-hidden relative">
          <div className="absolute inset-0 flex w-[400%] animate-scroll-x">

            {/* Screen 1: Dashboard */}
            <div className="w-1/4 h-full p-4 flex flex-col gap-3 overflow-y-auto no-scrollbar pb-24">
              {/* Hero Card */}
              <div className="mx-2 bg-[#f0fdfa] border border-[#ccfbf1] rounded-2xl p-5">
                <div className="text-[10px] font-bold text-[#14b8a6] mb-1">
                  本月经营净成果
                </div>
                <div className="text-3xl font-extrabold text-[#0f766e] mb-4">¥370,400</div>
                
                <div className="border-t border-[#ccfbf1] pt-3 flex justify-between">
                  <div>
                    <div className="text-[8px] text-[#0d9488] mb-0.5 font-medium">收入</div>
                    <div className="text-sm font-bold text-[#115e59]">¥85.2w</div>
                  </div>
                  <div>
                    <div className="text-[8px] text-[#0d9488] mb-0.5 font-medium">支出</div>
                    <div className="text-sm font-bold text-[#115e59]">¥48.2w</div>
                  </div>
                </div>
              </div>

              <div className="mx-2 bg-white rounded-2xl p-4 border border-slate-200 flex gap-3 items-start relative before:absolute before:left-0 before:top-4 before:bottom-4 before:w-1 before:bg-blue-400 before:rounded-r overflow-hidden shadow-sm shadow-slate-100">
                <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 font-bold shrink-0 text-xs">AI</div>
                <div>
                  <div className="text-xs font-bold text-slate-800 mb-1 flex items-center justify-between gap-1">
                    智能健康诊断
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">资金充裕，预计覆盖近期开支。</p>
                </div>
              </div>

              <div className="mx-2 bg-white rounded-2xl p-4 border border-slate-200 mt-2 shadow-sm shadow-slate-100">
                <div className="text-[9px] font-bold text-slate-400 uppercase mb-3">账户余额走势</div>
                <div className="h-12 w-full bg-slate-50 rounded-lg relative overflow-hidden flex items-end">
                  <div className="w-full h-3/4 bg-blue-500/10 rounded-t-lg" style={{ clipPath: 'polygon(0 60%, 18% 54%, 35% 67%, 52% 24%, 68% 43%, 84% 40%, 100% 34%, 100% 100%, 0 100%)' }}></div>
                  <div className="absolute inset-0 w-full h-full" style={{ background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.8))' }}></div>
                </div>
              </div>
            </div>

            {/* Screen 2: Tasks */}
            <div className="w-1/4 h-full p-4 flex flex-col gap-4 overflow-y-auto no-scrollbar pb-24">
              <div>
                <div className="text-[9px] font-bold text-slate-400 tracking-widest uppercase mb-1">EXECUTION</div>
                <h3 className="text-xl font-bold text-slate-800">本月任务</h3>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm shadow-slate-100">
                <div className="flex items-center gap-3 mb-6">
                  <div className="text-sm font-bold text-slate-800 flex-1">交付履约进度</div>
                  <div className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">正常进展</div>
                </div>

                <div className="relative border-l ml-3 border-slate-100 pb-2 space-y-6">
                  <div className="relative pl-6">
                    <div className="absolute w-2.5 h-2.5 bg-white border-2 border-slate-300 rounded-full -left-[5.5px] top-1"></div>
                    <div className="text-[9px] font-medium text-slate-400 mb-1">12-10</div>
                    <div className="text-sm font-bold text-slate-800 mb-2">薪酬发放</div>
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-[10px] text-slate-500">实发总额</span>
                        <span className="font-bold text-slate-800 text-xs">¥425k</span>
                      </div>
                      <div className="w-full text-center py-2 bg-slate-800 text-white text-[10px] font-medium rounded-lg">待确认</div>
                    </div>
                  </div>
                  <div className="relative pl-6">
                    <div className="absolute w-2.5 h-2.5 bg-[#66CDB5] border-2 border-white rounded-full -left-[5.5px] top-1"></div>
                    <div className="text-[9px] font-medium text-slate-400 mb-1">12-15</div>
                    <div className="text-sm font-bold text-slate-800 mb-2">税务申报</div>
                    <div className="flex gap-2">
                      <span className="bg-[#f0fdfa] text-[#0d9488] text-[9px] px-2 py-1 rounded font-medium border border-[#ccfbf1]">增值税</span>
                      <span className="bg-[#f0fdfa] text-[#0d9488] text-[9px] px-2 py-1 rounded font-medium border border-[#ccfbf1]">个税</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Screen 3: Workspace Placeholder */}
            <div className="w-1/4 h-full p-4 flex flex-col gap-4 overflow-y-auto no-scrollbar pb-24">
               <div>
                <div className="text-[9px] font-bold text-slate-400 tracking-widest uppercase mb-2">WORKSPACE</div>
                <h3 className="text-xl font-extrabold text-slate-900">事务工作台</h3>
              </div>
              <div className="h-10 bg-white rounded-xl border border-slate-200 flex items-center px-4 text-xs text-slate-400 shadow-sm">
                 查找功能或事务...
              </div>
              
              <div className="grid grid-cols-4 gap-2">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 bg-white rounded-xl border border-slate-100 shadow-sm flex items-center justify-center">
                      <div className="w-5 h-5 bg-[#66CDB5]/10 rounded"></div>
                    </div>
                    <div className="text-[9px] font-bold text-slate-500">应用{i+1}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Screen 4: Company Placeholder */}
            <div className="w-1/4 h-full p-4 flex flex-col gap-4 overflow-y-auto no-scrollbar pb-24">
               <div>
                <div className="text-[9px] font-bold text-slate-400 tracking-widest uppercase mb-1">ENTERPRISE</div>
                <h3 className="text-xl font-bold text-slate-800">我的企业</h3>
              </div>
              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm shadow-slate-100 flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-50 rounded-xl text-slate-500 flex items-center justify-center font-bold text-lg border border-slate-100">企</div>
                <div>
                  <div className="font-bold text-slate-800 mb-1 text-sm">干机科技</div>
                  <div className="flex gap-2">
                    <span className="bg-[#f0fdfa] text-[#0d9488] text-[8px] px-2 py-0.5 rounded font-medium border border-[#ccfbf1]">已认证</span>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm shadow-slate-100">
                <div className="text-[9px] font-bold text-slate-400 mb-1">统一社会信用代码</div>
                <div className="text-xs font-mono text-slate-500 tracking-widest">91310000XXXX</div>
              </div>
            </div>

          </div>
        </div>

        {/* Tab Bar */}
        <div className="h-16 bg-white border-t border-slate-100 absolute bottom-0 inset-x-0 flex justify-around items-center px-4">
           <div className="flex flex-col items-center gap-1 text-[#66CDB5]">
             <div className="w-5 h-5 rounded-[4px] bg-current opacity-20"></div>
             <span className="text-[8px] font-bold uppercase tracking-widest">Dash</span>
           </div>
           <div className="flex flex-col items-center gap-1 text-slate-300">
             <div className="w-5 h-5 rounded-[4px] bg-current opacity-20"></div>
             <span className="text-[8px] font-bold uppercase tracking-widest">Tasks</span>
           </div>
           <div className="flex flex-col items-center gap-1 text-slate-300">
             <div className="w-5 h-5 rounded-[4px] bg-current opacity-20"></div>
             <span className="text-[8px] font-bold uppercase tracking-widest">Docs</span>
           </div>
           <div className="flex flex-col items-center gap-1 text-slate-300">
             <div className="w-5 h-5 rounded-[4px] bg-current opacity-20"></div>
             <span className="text-[8px] font-bold uppercase tracking-widest">Me</span>
           </div>
        </div>
      </div>
    </div>
  );
}
