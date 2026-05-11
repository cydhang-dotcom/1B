import React from 'react';

export default function Stats() {
  const stats = [
    { label: 'Experience', value: '20年', desc: '业务积淀，熟悉创业企业从注册到托管的后台事务。' },
    { label: 'Platform', value: '自研平台', desc: '小程序、任务流和顾问服务协同，事项推进更清楚。' },
    { label: 'Team', value: '专家团队', desc: '财税、人事、企业服务顾问持续跟进关键节点。' },
    { label: 'Promise', value: '应享尽享', desc: '围绕补贴政策和企业服务机会，协助企业及时申报。' },
  ];

  return (
    <section className="py-24 bg-[#f0fdfa]/50 relative overflow-hidden border-y border-[#ccfbf1]/50">
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat, idx) => (
            <div key={idx} className="p-8 pb-0">
              <span className="text-[10px] font-bold tracking-widest uppercase text-[#0d9488] mb-4 block">
                {stat.label}
              </span>
              <div className="text-4xl lg:text-5xl font-extrabold text-[#0f766e] mb-4 tracking-tight">
                {stat.value}
              </div>
              <p className="text-sm text-[#115e59]/70 leading-relaxed font-medium">
                {stat.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
