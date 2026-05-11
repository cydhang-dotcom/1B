import React from 'react';
import { ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import PhoneMockup from './PhoneMockup';

export default function Hero({ onOpenModal }: { onOpenModal: () => void }) {
  return (
    <section id="desk" className="pt-24 pb-24 lg:pt-32 lg:pb-32 overflow-hidden relative bg-white">
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#66CDB5]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
      
      <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-20 items-center relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="max-w-2xl"
        >
          <h1 className="text-5xl lg:text-[5rem] leading-[1.1] font-extrabold text-slate-900 tracking-tight mb-8">
            陪跑创业者<br/>
            <span className="text-[#66CDB5] relative inline-block mt-2">
              赢在起跑线
            </span>
          </h1>
          
          <p className="text-lg text-slate-500 font-normal leading-relaxed mb-10 max-w-lg">
            <strong className="text-[#66CDB5] font-semibold">「班步一企通」</strong>包含公司注册、财税代理、人事外包和补贴申请的一站式管家服务。
          </p>

          <div className="flex flex-wrap gap-3 mb-12">
            {['后台事务', '一站服务', '可视可控'].map((point) => (
              <div key={point} className="flex items-center gap-2 text-sm font-medium text-slate-600 bg-slate-50 px-4 py-2.5 rounded-full border border-slate-100">
                <CheckCircle2 size={16} className="text-[#66CDB5]" />
                {point}
              </div>
            ))}
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <button 
              onClick={onOpenModal}
              className="inline-flex items-center justify-center h-14 px-8 rounded-full bg-[#66CDB5] hover:bg-[#52ba9f] text-white font-medium text-lg transition-all gap-2"
            >
              托管我的企业
            </button>
            <a 
              href="#path"
              className="inline-flex items-center justify-center h-14 px-8 rounded-full bg-white text-slate-600 font-medium text-lg border border-slate-200 hover:border-slate-300 hover:text-slate-900 transition-all gap-2"
            >
              了解服务路径
              <ArrowRight size={20} />
            </a>
          </div>
          
          <div className="mt-16 pt-10 border-t border-slate-100 grid grid-cols-3 gap-8">
            <div>
              <div className="text-4xl font-extrabold text-slate-900">20<span className="text-[#66CDB5]">+</span></div>
              <div className="text-xs font-medium text-slate-400 mt-2">年服务经验</div>
            </div>
            <div>
              <div className="text-4xl font-extrabold text-slate-900">自研</div>
              <div className="text-xs font-medium text-slate-400 mt-2">一站式平台</div>
            </div>
            <div>
              <div className="text-4xl font-extrabold text-slate-900">1v1</div>
              <div className="text-xs font-medium text-slate-400 mt-2">专家团队</div>
            </div>
          </div>
        </motion.div>

        <motion.div
           initial={{ opacity: 0, y: 40 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
           className="relative mx-auto w-full max-w-md lg:max-w-none pattern-bg rounded-[40px] p-8 border border-slate-100 flex items-center justify-center"
        >
           <PhoneMockup />
        </motion.div>
      </div>
    </section>
  );
}
