import React, { useEffect, useState } from "react";

export default function PhoneMockup() {
  const tabs = ["总览", "任务", "事务", "公司"];
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    const loopMs = 28000;
    let frameId = 0;

    const syncActiveTab = () => {
      const progress = ((performance.now() % loopMs) / loopMs) * 100;
      const nextTab =
        progress < 22 ? 0 : progress < 47 ? 1 : progress < 72 ? 2 : progress < 96 ? 3 : 0;

      setActiveTab((current) => (current === nextTab ? current : nextTab));
      frameId = requestAnimationFrame(syncActiveTab);
    };

    frameId = requestAnimationFrame(syncActiveTab);
    return () => cancelAnimationFrame(frameId);
  }, []);

  return (
    <div className="relative mx-auto w-full max-w-[320px] aspect-[1/2] bg-white rounded-[32px] sm:rounded-[40px] p-2.5 sm:p-3 shadow-xl shadow-[#66CDB5]/5 z-10 border border-slate-200">
      {/* Notch */}
      <div className="absolute top-5 sm:top-6 left-1/2 -translate-x-1/2 w-16 sm:w-20 h-4 sm:h-5 bg-slate-100 rounded-full z-20 border border-slate-200"></div>

      {/* Screen */}
      <div className="h-full w-full bg-[#fafafa] rounded-[32px] overflow-hidden relative flex flex-col border border-slate-100">
        {/* Status Bar */}
        <div className="h-8 flex justify-between items-center px-6 sm:px-8 pt-4 text-[10px] font-bold text-slate-500 z-10 shrink-0 mb-1">
          <span>9:41</span>
          <div className="flex gap-1 items-center">
            <div className="w-3 h-3 border border-slate-300 rounded-full"></div>
            <div className="w-3 h-3 bg-slate-300 rounded-full"></div>
          </div>
        </div>

        {/* WeChat Header */}
        <div className="h-14 w-full px-5 sm:px-6 flex justify-between items-center shrink-0 border-b border-slate-100 bg-white mb-3">
          <div>
            <div className="text-[9px] font-bold text-[#66CDB5] uppercase tracking-widest leading-none mb-1">
              CEO Dashboard
            </div>
            <div className="text-lg sm:text-xl font-bold text-slate-800">班步一企通</div>
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
                <div className="text-3xl font-extrabold text-[#0f766e] mb-4">
                  ¥370,400
                </div>

                <div className="border-t border-[#ccfbf1] pt-3 flex justify-between">
                  <div>
                    <div className="text-[8px] text-[#0d9488] mb-0.5 font-medium">
                      收入
                    </div>
                    <div className="text-sm font-bold text-[#115e59]">
                      ¥85.2w
                    </div>
                  </div>
                  <div>
                    <div className="text-[8px] text-[#0d9488] mb-0.5 font-medium">
                      支出
                    </div>
                    <div className="text-sm font-bold text-[#115e59]">
                      ¥48.2w
                    </div>
                  </div>
                </div>
              </div>

              <div className="mx-2 bg-white rounded-2xl p-4 border border-slate-200 flex gap-3 items-start relative before:absolute before:left-0 before:top-4 before:bottom-4 before:w-1 before:bg-blue-400 before:rounded-r overflow-hidden shadow-sm shadow-slate-100">
                <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 font-bold shrink-0 text-xs">
                  AI
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800 mb-1 flex items-center justify-between gap-1">
                    智能健康诊断
                  </div>
                  <p className="text-[10px] text-slate-600 leading-relaxed">
                    资金充裕，预计覆盖近期开支。
                  </p>
                </div>
              </div>

              <div className="mx-2 bg-white rounded-2xl p-4 border border-slate-200 mt-2 shadow-sm shadow-slate-100">
                <div className="text-[9px] font-bold text-slate-500 uppercase mb-3">
                  账户余额走势
                </div>
                <div className="h-12 w-full bg-slate-50 rounded-lg relative overflow-hidden flex items-end">
                  <div
                    className="w-full h-3/4 bg-blue-500/10 rounded-t-lg"
                    style={{
                      clipPath:
                        "polygon(0 60%, 18% 54%, 35% 67%, 52% 24%, 68% 43%, 84% 40%, 100% 34%, 100% 100%, 0 100%)",
                    }}
                  ></div>
                  <div
                    className="absolute inset-0 w-full h-full"
                    style={{
                      background:
                        "linear-gradient(to right, transparent, rgba(255,255,255,0.8))",
                    }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Screen 2: Tasks */}
            <div className="w-1/4 h-full p-4 flex flex-col gap-4 overflow-y-auto no-scrollbar pb-24">
              <div>
                <div className="text-[9px] font-bold text-slate-500 tracking-widest uppercase mb-1">
                  EXECUTION
                </div>
                <h3 className="text-xl font-bold text-slate-800">本月任务</h3>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm shadow-slate-100">
                <div className="flex items-center gap-3 mb-6">
                  <div className="text-sm font-bold text-slate-800 flex-1">
                    交付履约进度
                  </div>
                  <div className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                    正常进展
                  </div>
                </div>

                <div className="relative border-l ml-3 border-slate-100 pb-2 space-y-6">
                  <div className="relative pl-6">
                    <div className="absolute w-2.5 h-2.5 bg-white border-2 border-slate-300 rounded-full -left-[5.5px] top-1"></div>
                    <div className="text-[9px] font-medium text-slate-500 mb-1">
                      12-10
                    </div>
                    <div className="text-sm font-bold text-slate-800 mb-2">
                      薪酬发放
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-[10px] text-slate-600">
                          实发总额
                        </span>
                        <span className="font-bold text-slate-800 text-xs">
                          ¥425k
                        </span>
                      </div>
                      <div className="w-full text-center py-2 bg-[#66CDB5] text-white text-[10px] font-medium rounded-lg shadow-sm shadow-[#66CDB5]/25">
                        待确认
                      </div>
                    </div>
                  </div>
                  <div className="relative pl-6">
                    <div className="absolute w-2.5 h-2.5 bg-[#66CDB5] border-2 border-white rounded-full -left-[5.5px] top-1"></div>
                    <div className="text-[9px] font-medium text-slate-500 mb-1">
                      12-15
                    </div>
                    <div className="text-sm font-bold text-slate-800 mb-2">
                      税务申报
                    </div>
                    <div className="flex gap-2">
                      <span className="bg-[#f0fdfa] text-[#0d9488] text-[9px] px-2 py-1 rounded font-medium border border-[#ccfbf1]">
                        增值税
                      </span>
                      <span className="bg-[#f0fdfa] text-[#0d9488] text-[9px] px-2 py-1 rounded font-medium border border-[#ccfbf1]">
                        个税
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Screen 3: Workspace */}
            <div className="w-1/4 h-full p-4 flex flex-col gap-4 overflow-y-auto no-scrollbar pb-24">
              <div>
                <div className="text-[9px] font-bold text-slate-500 tracking-widest uppercase mb-2">
                  WORKSPACE
                </div>
                <h3 className="text-xl font-extrabold text-slate-900">
                  事务工作台
                </h3>
              </div>
              <div className="h-10 bg-white rounded-xl border border-slate-200 flex items-center px-4 text-xs text-slate-500 shadow-sm">
                查找功能或事务...
              </div>

              {[
                { title: '财务运营', color: 'emerald', items: ['对账','流水','发票','报销','凭证','报表','税款'] },
                { title: '人事管理', color: 'blue', items: ['员工','薪酬','五险一金','合同'] },
              ].map(group => (
                <div key={group.title}>
                  <div className={`text-[9px] font-bold mb-2 ${group.color === 'emerald' ? 'text-emerald-600' : 'text-blue-600'}`}>{group.title}</div>
                  <div className="grid grid-cols-4 gap-2">
                    {group.items.map(label => (
                      <div key={label} className="flex flex-col items-center gap-2">
                        <div className={`w-12 h-12 bg-white rounded-xl border shadow-sm flex items-center justify-center ${group.color === 'emerald' ? 'border-emerald-100' : 'border-blue-100'}`}>
                          <div className={`w-5 h-5 rounded ${group.color === 'emerald' ? 'bg-emerald-400/15' : 'bg-blue-400/15'}`}></div>
                        </div>
                        <div className="text-[9px] font-bold text-slate-600">{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Screen 4: Company */}
            <div className="w-1/4 h-full p-4 flex flex-col gap-4 overflow-y-auto no-scrollbar pb-24">
              <div>
                <div className="text-[9px] font-bold text-slate-500 tracking-widest uppercase mb-1">
                  ENTERPRISE
                </div>
                <h3 className="text-xl font-bold text-slate-800">我的企业</h3>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm shadow-slate-100">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-600 rounded-xl text-white flex items-center justify-center font-bold text-lg shadow-sm shadow-blue-100">
                  企
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-slate-900 mb-1 text-base">
                      千机科技
                    </div>
                    <div className="flex gap-2">
                      <span className="bg-[#f0fdfa] text-[#0d9488] text-[8px] px-2 py-0.5 rounded-md font-medium border border-[#ccfbf1]">
                        已实名认证
                      </span>
                      <span className="bg-blue-50 text-blue-600 text-[8px] px-2 py-0.5 rounded-md font-medium border border-blue-100">
                        存续
                      </span>
                    </div>
                  </div>
                  <div className="text-slate-300 text-lg leading-none">↗</div>
                </div>

                <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                  <div className="text-[8px] font-bold text-slate-400 mb-1">
                    统一社会信用代码
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] font-mono font-bold tracking-widest text-slate-700">
                      91310000XXXXXXXX
                    </div>
                    <div className="text-slate-400 text-xs">▣</div>
                  </div>
                </div>
              </div>

              <div>
                <div className="text-[9px] font-bold tracking-widest text-slate-400 mb-2">
                  对公账户
                </div>
                <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm font-bold text-slate-900">招商银行</div>
                      <div className="text-[9px] font-medium text-slate-400 mt-0.5">
                        基本存款账户
                      </div>
                    </div>
                    <div className="h-8 w-8 rounded-full bg-white border border-blue-100 text-slate-400 flex items-center justify-center text-sm">
                      ◎
                    </div>
                  </div>
                  <div className="mt-4 text-2xl font-black tracking-tight text-slate-900">
                    ¥142,590.00
                  </div>
                  <div className="mt-3 inline-flex items-center rounded-lg bg-white px-3 py-1.5 text-[10px] font-bold tracking-widest text-slate-400 shadow-sm shadow-blue-100">
                    6227 0038 **** 8888
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 border-t border-blue-100 pt-3">
                    <div>
                      <div className="text-[8px] font-bold text-slate-400 mb-1">本月收入</div>
                      <div className="text-xs font-extrabold text-[#0d9488]">62,000</div>
                    </div>
                    <div>
                      <div className="text-[8px] font-bold text-slate-400 mb-1">本月支出</div>
                      <div className="text-xs font-extrabold text-orange-600">29,500</div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="text-[9px] font-bold tracking-widest text-slate-400 mb-2">
                  常用资料
                </div>
                <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm shadow-slate-100">
                  {[
                    ["开票信息", "税号、地址电话、开户行", "票"],
                    ["收件地址", "上海市徐汇区...", "址"],
                  ].map((item, index) => (
                    <div
                      key={item[0]}
                      className={`flex items-center gap-3 p-3 ${
                        index > 0 ? "border-t border-slate-100" : ""
                      }`}
                    >
                      <div className="w-9 h-9 rounded-xl bg-slate-50 text-blue-500 flex items-center justify-center text-xs font-bold">
                        {item[2]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-slate-800">{item[0]}</div>
                        <div className="text-[9px] font-medium text-slate-400 mt-0.5">
                          {item[1]}
                        </div>
                      </div>
                      <div className="text-slate-300 text-base">›</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="h-16 bg-white border-t border-slate-100 absolute bottom-0 inset-x-0 flex justify-around items-center px-4">
          {tabs.map((label, index) => (
            <div
              key={label}
              className="flex flex-col items-center gap-1"
            >
              <div
                className={`w-5 h-5 rounded-[4px] transition-colors duration-200 ${
                  index === activeTab ? "bg-[#66CDB5]" : "bg-slate-200"
                }`}
              ></div>
              <span
                className={`text-[8px] font-bold uppercase tracking-widest transition-colors duration-200 ${
                  index === activeTab ? "text-slate-900" : "text-slate-300"
                }`}
              >
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
