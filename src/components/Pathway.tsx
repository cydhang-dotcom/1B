import React from "react";

export default function Pathway() {
  const steps = [
    {
      code: "01",
      title: "筹备创业",
      desc: "先确认行业、股权、注册地址和办理节奏，形成注册前的资料清单。",
    },
    {
      code: "02",
      title: "注册落地",
      desc: "工商、刻章、开户、税务登记接续办理，小程序同步显示当前节点。",
    },
    {
      code: "03",
      title: "财税人事初始化",
      desc: "账套、发票、合同、员工档案、社保账户逐步建立，减少后续补资料。",
    },
    {
      code: "04",
      title: "日常事项托管",
      desc: "每月报税、发薪、报销、补贴申报、工商变更进入任务和顾问反馈。",
    },
  ];

  return (
    <section
      id="path"
      className="py-16 md:py-24 lg:py-32 bg-slate-50 border-t border-slate-100 relative"
    >
      <div className="max-w-7xl mx-auto px-5 md:px-8 grid lg:grid-cols-2 gap-12 lg:gap-20 items-start">
        <div className="lg:sticky lg:top-32">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-slate-900 leading-[1.2] mb-6">
            携手共进，
            <br />
            <span className="text-[#66CDB5]">未来可期。</span>
          </h2>
          <p className="text-base sm:text-lg text-slate-600 font-normal max-w-md leading-relaxed">
            企业处在不同阶段，需要接上的事项也不同。班步把注册、财税、人事和托管放进连续的服务路径里。
          </p>
        </div>

        <div className="relative border-l border-slate-200 pl-6 sm:pl-8 lg:pl-12 py-4">
          <div className="grid gap-12 sm:gap-16">
            {steps.map((step, idx) => (
              <div key={idx} className="relative">
                {/* Dot */}
                <div className="absolute -left-[29px] sm:-left-[37px] lg:-left-[53px] top-2 sm:top-3 w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center">
                  <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-[#66CDB5]"></div>
                </div>

                <div className="flex gap-4 sm:gap-6 items-start group">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-[14px] sm:rounded-2xl bg-white border border-slate-200 shadow-sm text-[#66CDB5] font-extrabold text-base sm:text-lg flex items-center justify-center transition-all group-hover:scale-110">
                    {step.code}
                  </div>
                  <div>
                    <h3 className="text-[17px] sm:text-xl font-bold text-slate-900 mb-2 sm:mb-3 mt-1 sm:mt-0">
                      {step.title}
                    </h3>
                    <p className="text-slate-600 leading-relaxed text-[13px] sm:text-sm">
                      {step.desc}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
