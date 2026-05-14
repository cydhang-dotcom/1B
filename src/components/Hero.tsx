import React from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import PhoneMockup from './PhoneMockup';

export default function Hero({ onOpenModal }: { onOpenModal: () => void }) {
  return (
    <section id="desk" className="pt-24 pb-16 sm:pb-20 lg:pt-32 lg:pb-32 overflow-hidden relative bg-gradient-to-b from-white via-white to-slate-50/70">
      <div className="absolute top-0 right-0 w-[420px] h-[420px] sm:w-[600px] sm:h-[600px] bg-[#66CDB5]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
      <div className="absolute left-0 bottom-0 h-px w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
      
      <div className="max-w-7xl mx-auto px-5 sm:px-6 grid lg:grid-cols-2 gap-12 lg:gap-20 items-center relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="max-w-2xl"
        >
          <h1 className="text-[2.75rem] sm:text-5xl lg:text-[5rem] leading-[1.08] lg:leading-[1.1] font-extrabold text-slate-900 tracking-tight mb-6 lg:mb-8">
            陪跑创业者<br/>
            <span className="text-[#66CDB5] relative inline-block mt-2">
              赢在起跑线
            </span>
          </h1>
          
          <p className="text-base sm:text-lg text-slate-600 font-normal leading-relaxed mb-8 sm:mb-10 max-w-lg">
            <strong className="text-[#66CDB5] font-semibold">「班步一企通」</strong>包含公司注册、财税代理、人事外包和补贴申请的一站式管家服务。
          </p>

          <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:gap-3 mb-10 sm:mb-12">
            {['后台事务', '一站服务', '可视可控'].map((point) => (
              <div key={point} className="flex min-w-0 items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap text-xs sm:text-sm font-medium text-slate-600 bg-white/90 px-2 sm:px-4 py-2.5 rounded-full border border-slate-200/70 shadow-sm shadow-slate-200/40">
                <CheckCircle2 size={16} className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 text-[#66CDB5]" />
                {point}
              </div>
            ))}
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <button 
              onClick={onOpenModal}
              className="inline-flex items-center justify-center h-14 px-8 rounded-full bg-[#66CDB5] hover:bg-[#52ba9f] text-white font-medium text-base sm:text-lg transition-all gap-2 shadow-lg shadow-[#66CDB5]/25 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[#66CDB5]/25 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#66CDB5]/20 active:translate-y-0"
            >
              托管我的企业
            </button>
            <a 
              href="#path"
              className="inline-flex items-center justify-center h-14 px-8 rounded-full bg-white text-slate-600 font-medium text-base sm:text-lg border border-slate-200 hover:border-slate-300 hover:text-slate-900 transition-all gap-2 shadow-sm shadow-slate-200/60 hover:-translate-y-0.5 hover:shadow-md hover:shadow-slate-200/70 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-200 active:translate-y-0"
            >
              注册新的公司
              <ArrowRight size={20} />
            </a>
          </div>
          
          <div className="mt-12 sm:mt-16 pt-8 sm:pt-10 border-t border-slate-100 grid grid-cols-3 gap-4 sm:gap-8">
            <div>
              <div className="text-3xl sm:text-4xl font-extrabold text-slate-900">20<span className="text-[#66CDB5]">+</span></div>
              <div className="text-xs font-medium text-slate-400 mt-2">年服务经验</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-extrabold text-slate-900">自研</div>
              <div className="text-xs font-medium text-slate-400 mt-2">一站式平台</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-extrabold text-slate-900">1v1</div>
              <div className="text-xs font-medium text-slate-400 mt-2">专家团队</div>
            </div>
          </div>
        </motion.div>

        <motion.div
           initial={{ opacity: 0, y: 40 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
           className="relative mx-auto w-full max-w-sm sm:max-w-md lg:max-w-none pattern-bg rounded-[32px] sm:rounded-[40px] p-4 sm:p-8 border border-slate-100 flex items-center justify-center shadow-2xl shadow-slate-200/70"
        >
           <PhoneMockup />
        </motion.div>
      </div>
    </section>
  );
}
