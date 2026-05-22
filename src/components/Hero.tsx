import React from "react";
import { ArrowRight, Sparkles, Check } from "lucide-react";
import { motion } from "motion/react";
import PhoneMockup from "./PhoneMockup";

export default function Hero({ onOpenModal }: { onOpenModal: () => void }) {
  return (
    <section
      id="desk"
      className="pt-24 lg:pt-32 pb-0 lg:pb-32 overflow-hidden relative bg-white flex flex-col"
    >
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#66CDB5]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#EEF0FF]/40 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3"></div>

      <div className="max-w-7xl mx-auto px-5 md:px-8 w-full grow flex flex-col lg:grid lg:grid-cols-2 gap-6 lg:gap-20 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="flex flex-col pt-10 sm:pt-14 lg:pt-0 lg:justify-center order-1 lg:order-none max-w-2xl mx-0 lg:mx-0 w-full relative z-20 items-start"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-50 border border-teal-100 text-teal-700 text-xs sm:text-sm font-semibold mb-6 mx-0">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
            </span>
            专注初创企业一站式管家服务
          </div>

          <h1 className="text-[2.6rem] sm:text-4xl lg:text-[4.5rem] xl:text-[5rem] leading-[1.15] lg:leading-[1.1] font-black text-slate-900 tracking-tight mb-5 lg:mb-8 text-left text-balance w-full">
            陪跑创业者
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-[#66CDB5] relative inline-block mt-1 sm:mt-2">
              赢在起跑线
            </span>
          </h1>

          <p className="text-[15px] sm:text-lg text-slate-500 font-medium leading-relaxed mb-8 lg:mb-10 max-w-lg mx-0 text-left text-balance">
            <strong className="text-teal-600 font-semibold">
              「班步一企通」
            </strong>
            为您提供全周期的
            <strong className="text-slate-800 font-bold ml-1">
              一站式管家服务
            </strong>
            。
          </p>

          <div className="flex flex-wrap sm:justify-start gap-3 sm:gap-4 mb-4 lg:mb-12 w-full">
            {["公司注册", "财税代理", "人事外包", "补贴申请"].map((point) => (
              <div
                key={point}
                className="flex items-center gap-2.5 px-4 sm:px-5 py-3 sm:py-3.5 bg-white border border-slate-100 rounded-xl sm:rounded-full shadow-sm text-[14px] sm:text-[15px] font-semibold text-slate-700 cursor-default hover:border-teal-200 hover:shadow-md transition-all justify-start"
              >
                <div className="w-5 h-5 rounded-full bg-teal-50 flex items-center justify-center shrink-0">
                  <Check size={12} strokeWidth={3} className="text-teal-500" />
                </div>
                {point}
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mt-12 sm:mt-10 w-full sm:max-w-none mx-0">
            <button
              onClick={onOpenModal}
              className="inline-flex items-center justify-center h-[52px] sm:h-14 px-8 w-full sm:w-auto rounded-[16px] sm:rounded-full bg-[#66CDB5] hover:bg-[#52ba9f] active:bg-[#52ba9f] text-white font-medium text-[16px] sm:text-[17px] transition-all shadow-lg shadow-[#66CDB5]/30 sm:shadow-sm"
            >
              托管我的企业
            </button>
            <a
              href="#path"
              className="inline-flex items-center justify-center h-[52px] sm:h-14 px-8 w-full sm:w-auto rounded-[16px] sm:rounded-full bg-white text-slate-700 font-medium text-[16px] sm:text-[17px] border border-slate-200 hover:border-slate-300 hover:text-slate-900 active:bg-slate-50 transition-all gap-2"
            >
              了解服务路径
              <ArrowRight size={18} className="hidden sm:block" />
            </a>
          </div>
        </motion.div>

        {/* Right Col (Phone) */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="relative mx-auto w-full max-w-[360px] lg:max-w-none pattern-bg rounded-t-[2.5rem] sm:rounded-[40px] p-6 sm:p-8 flex items-center justify-center order-2 lg:order-none grow lg:grow-0 mt-10 lg:mt-0 overflow-hidden lg:overflow-visible border-x border-t lg:border-b border-slate-100 lg:border-transparent"
        >
          <div className="transform scale-[0.8] sm:scale-[0.85] lg:scale-100 origin-top lg:origin-center -mb-40 sm:-mb-24 lg:mb-0 w-full flex justify-center">
            <PhoneMockup />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
