import React from 'react';

export default function Features() {
  const scenarios = [
    {
      num: "一",
      title: "快速办理，实时反馈",
      desc: "在线办理、进度查询、实时反馈、办结凭证统一留痕，减少事项推进中的不确定感。",
      color: "text-emerald-600"
    },
    {
      num: "二",
      title: "经营概览，一目了然",
      desc: "流水台账、收支结构、人资情况和动态分析集中展示，方便管理层快速判断公司状态。",
      color: "text-blue-600"
    },
    {
      num: "三",
      title: "智能提醒，风险管控",
      desc: "围绕发票风险、财务异常、用工风险和合同提醒生成待办，让关键事项更早被看见。",
      color: "text-amber-600"
    }
  ];

  return (
    <section id="scenes" className="py-16 sm:py-20 lg:py-32 bg-white border-t border-slate-100">
      <div className="max-w-7xl mx-auto px-5 sm:px-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 md:gap-12 mb-10 sm:mb-14 lg:mb-20">
          <div className="max-w-2xl">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 leading-[1.2]">
              可视可控，<br/><span className="text-[#66CDB5]">省心安心。</span>
            </h2>
          </div>
          <p className="text-base sm:text-lg text-slate-600 font-normal max-w-md md:pb-2 leading-relaxed">
            办理进度、经营概览和风险提醒都沉淀在小程序里，减少来回问人、找表和翻聊天记录。
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {scenarios.map((scene, idx) => (
            <div key={idx} className="group bg-slate-50 p-7 sm:p-10 lg:p-12 rounded-[1.5rem] sm:rounded-[2rem] border border-slate-100 transition-all duration-300 hover:bg-white hover:border-slate-300 hover:shadow-xl hover:shadow-slate-200/60 hover:-translate-y-1">
              <div className={`w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-sm shadow-slate-200/60 flex items-center justify-center text-xl font-bold mb-6 sm:mb-8 transition-transform duration-300 group-hover:scale-105 ${scene.color}`}>
                {scene.num}
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-4">{scene.title}</h3>
              <p className="text-slate-600 leading-relaxed text-sm">
                {scene.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
