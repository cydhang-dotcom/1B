import React from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { useShareUserUuid, appendShareUserUuid } from '../hooks/useShareUserUuid';

export default function CTA({ onOpenModal }: { onOpenModal: () => void }) {
  const uuid = useShareUserUuid();

  return (
    <section className="py-16 md:py-24 lg:py-32 relative overflow-hidden bg-white border-t border-slate-100">
      <div className="max-w-7xl mx-auto px-5 md:px-8">
        <div className="bg-[#f8fafc] rounded-[2rem] lg:rounded-[3rem] p-6 sm:p-12 lg:p-24 relative overflow-hidden border border-slate-100">
          {/* Decorative graphic */}
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#66CDB5]/5 rounded-full blur-3xl -translate-y-1/3 translate-x-1/3"></div>

          <div className="relative z-10 max-w-2xl">
            <h2 className="text-[2rem] sm:text-3xl md:text-5xl font-extrabold text-slate-900 leading-[1.25] md:leading-[1.2] mb-4 sm:mb-6">
              选择，
              <br />
              进入下一步。
            </h2>
            <p className="text-[15px] sm:text-lg text-slate-600 mb-8 max-w-xl leading-relaxed">
              无论是先了解注册路径，还是直接托管财税、人事和补贴事项，班步都可以从当前阶段接入，帮你把后台事务推进清楚。
            </p>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <button
                onClick={onOpenModal}
                className="w-full sm:w-auto inline-flex items-center justify-center h-12 sm:h-14 px-8 rounded-full bg-[#66CDB5] hover:bg-[#52ba9f] text-white font-medium text-base sm:text-lg transition-all gap-2"
              >
                获取服务
                <ArrowRight size={18} className="sm:w-5 sm:h-5" />
              </button>
              <a href={appendShareUserUuid('/CAA', uuid)} className="w-full sm:w-auto inline-flex items-center justify-center h-12 sm:h-14 px-8 rounded-full bg-white text-slate-600 font-medium text-base sm:text-lg border border-slate-200 hover:border-slate-300 hover:text-slate-900 transition-all">
                <Sparkles size={18} className="text-[#66CDB5]" />
                AI注册向导
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
