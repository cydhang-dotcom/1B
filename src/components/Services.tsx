import React from 'react';
import { Network, FileEdit, Users, Coins } from 'lucide-react';

const services = [
  {
    icon: <Network size={28} className="text-emerald-600" />,
    num: "01",
    title: "注册代理服务",
    desc: "从公司设立前的方案设计开始，到材料准备、流程跟进和交付归档。",
    tags: ["方案设计", "全程陪同", "全套交付"]
  },
  {
    icon: <FileEdit size={28} className="text-blue-600" />,
    num: "02",
    title: "财务代理服务",
    desc: "日常账务、纳税申报和风险提醒持续跟进，经营数据在小程序里可见。",
    tags: ["代理记账", "纳税申报", "智能助手"]
  },
  {
    icon: <Users size={28} className="text-purple-600" />,
    num: "03",
    title: "人事外包服务",
    desc: "围绕员工入转调离，处理合同、薪酬、五险一金等高频事项。",
    tags: ["电子合同", "薪酬服务", "五险一金"]
  },
  {
    icon: <Coins size={28} className="text-amber-600" />,
    num: "04",
    title: "政府补贴申请",
    desc: "梳理企业可申报政策，协助准备材料，让应享政策尽量不错过。",
    tags: ["创业补贴", "政策咨询", "应享尽享"]
  }
];

export default function Services() {
  return (
    <section id="services" className="py-16 sm:py-20 lg:py-32 bg-slate-50 border-t border-slate-100 relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-white/70 to-transparent pointer-events-none"></div>
      <div className="max-w-7xl mx-auto px-5 sm:px-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 md:gap-12 mb-10 sm:mb-14 lg:mb-20">
          <div className="max-w-2xl">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 leading-[1.2]">
              后台事务，<br/><span className="text-[#66CDB5]">一站服务。</span>
            </h2>
          </div>
          <p className="text-base sm:text-lg text-slate-600 font-normal max-w-md md:pb-2 leading-relaxed">
            从注册代理到财务代理、人事外包和政府补贴申请，服务前后衔接，减少创业初期到处找人的成本。
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {services.map((service, idx) => (
            <div key={idx} className="group p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2rem] bg-white border border-slate-200 hover:border-slate-300 hover:shadow-xl hover:shadow-slate-200/70 shadow-sm shadow-slate-200/50 transition-all duration-300 flex flex-col h-full relative overflow-hidden hover:-translate-y-1">
              <div className="mb-6 sm:mb-8 w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 shadow-sm shadow-slate-200/60 flex items-center justify-center relative z-10 group-hover:scale-105 transition-transform">
                {service.icon}
              </div>
              <div className="absolute top-6 right-6 text-6xl font-extrabold text-slate-100/70 group-hover:text-[#66CDB5]/10 transition-colors pointer-events-none select-none z-0">
                {service.num}
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-4 relative z-10">{service.title}</h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-10 flex-grow relative z-10">{service.desc}</p>
              
              <div className="flex flex-wrap gap-2 mt-auto relative z-10">
                {service.tags.map(tag => (
                  <span key={tag} className="px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-full text-[11px] font-medium text-slate-600 shadow-sm shadow-white/80">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
