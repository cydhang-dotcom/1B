import React from "react";
import { ArrowRight, Check, Info, Sparkles } from "lucide-react";
import { useShareUserUuid, appendShareUserUuid } from '../hooks/useShareUserUuid';

const pricingPlans = [
  {
    eyebrow: '单项服务',
    name: '注册代理',
    detail: '适合仅需完成企业注册的客户',
    price: '600',
    unit: '元 / 户次',
    features: ['企业注册办理', '按单户单次计费', '选择服务包可全额减免'],
  },
  {
    eyebrow: '年度服务包',
    name: '班步一企通',
    detail: '小规模纳税人',
    price: '2,500',
    unit: '元 / 年',
    badge: '适合多数初创企业',
    featured: true,
    features: ['小规模纳税人年度服务', '企业财税事项持续跟进', '注册代理费全额减免'],
  },
  {
    eyebrow: '年度服务包',
    name: '班步一企通',
    detail: '一般纳税人',
    price: '3,000',
    unit: '元 / 年',
    features: ['一般纳税人年度服务', '企业财税事项持续跟进', '注册代理费全额减免'],
  },
  {
    eyebrow: '基础申报',
    name: '零申报服务',
    detail: '适合暂无经营申报需求的企业',
    price: '600',
    unit: '元 / 年',
    features: ['年度零申报服务', '按年度收取服务费', '不包含注册代理费减免'],
  },
];

export default function CTA({ onOpenModal }: { onOpenModal?: () => void }) {
  const uuid = useShareUserUuid();

  return (
    <section className="py-16 md:py-24 lg:py-32 relative overflow-hidden bg-white border-t border-slate-100">
      <div className="max-w-7xl mx-auto px-5 md:px-8">
        <div id="pricing" className="relative isolate mb-16 scroll-mt-24 sm:mb-20 lg:mb-24 lg:scroll-mt-28">
          <div className="pointer-events-none absolute -inset-x-8 top-32 -z-10 h-[30rem] rounded-[50%] bg-[#66CDB5]/5 blur-[80px]" aria-hidden="true"></div>
          <div className="mb-10">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl lg:text-[2.75rem]">
                企业服务，<span className="text-[#66CDB5]">清晰定价</span>
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">从公司注册到年度财税托管，按企业实际阶段选择所需服务。</p>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:items-stretch">
            {pricingPlans.map((plan) => (
              <article
                key={`${plan.name}-${plan.detail}`}
                className={`group relative flex min-h-[360px] flex-col rounded-[1.5rem] border p-6 transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 ${
                  plan.featured
                    ? 'border-[#66CDB5]/60 bg-[#66CDB5]/[0.055] shadow-[0_14px_42px_rgba(102,205,181,0.08)] backdrop-blur-2xl'
                    : 'border-[#66CDB5]/15 bg-white/55 shadow-[0_10px_36px_rgba(46,98,86,0.035)] backdrop-blur-2xl hover:border-[#66CDB5]/35 hover:bg-white/70 hover:shadow-[0_14px_42px_rgba(102,205,181,0.07)]'
                }`}
              >
                {plan.badge && (
                  <span className="absolute right-5 top-5 rounded-full border border-white/60 bg-[#66CDB5]/90 px-3 py-1.5 text-[11px] font-bold tracking-wide text-white backdrop-blur-md">
                    {plan.badge}
                  </span>
                )}

                <div className="min-h-20">
                  <div className="text-xs font-bold tracking-[0.12em] text-slate-600">{plan.eyebrow}</div>
                  <h3 className="mt-4 text-xl font-extrabold tracking-tight text-slate-900">{plan.name}</h3>
                  <p className="mt-2 min-h-10 text-sm leading-5 text-[#60736e]">{plan.detail}</p>
                </div>

                <div className={`mt-6 flex items-end gap-2 border-b pb-6 ${plan.featured ? 'border-[#66CDB5]/25' : 'border-slate-200/55'}`}>
                  <span className="pb-1 text-sm font-bold text-[#60736e]">¥</span>
                  <span className="text-[2.65rem] font-extrabold leading-none tracking-[-0.04em] text-slate-950">{plan.price}</span>
                  <span className="pb-1 text-sm font-medium text-[#60736e]">/ {plan.unit.replace('元 / ', '')}</span>
                </div>

                <ul className="mt-6 grid gap-3.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm leading-5 text-[#344b45]">
                      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${plan.featured ? 'bg-[#66CDB5]/85 text-white' : 'bg-[#66CDB5]/10 text-[#419b86]'}`}>
                        <Check size={12} strokeWidth={3} aria-hidden="true" />
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <div className="mt-6 border-t border-[#66CDB5]/15 pt-5 text-sm text-slate-600">
            <p className="flex items-center gap-2.5 font-medium text-slate-700">
              <Info size={17} className="shrink-0 text-[#4aaf98]" aria-hidden="true" />
              人事代理服务费 <strong className="ml-1 font-extrabold text-slate-950">+20 元 / 人 / 月</strong>
            </p>
          </div>
        </div>

        <div className="bg-[#f8fafc] rounded-[2rem] lg:rounded-[3rem] p-6 sm:p-12 lg:p-20 relative overflow-hidden border border-slate-100">
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
              {onOpenModal && (
                <button
                  onClick={onOpenModal}
                  className="group w-full sm:w-[188px] inline-flex items-center justify-center h-12 sm:h-14 rounded-full bg-[#66CDB5] hover:bg-[#52ba9f] text-white font-semibold text-base sm:text-lg transition-all gap-2 shadow-sm hover:shadow-md"
                >
                  获取服务
                  <ArrowRight size={18} className="sm:w-5 sm:h-5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </button>
              )}
              <a href={appendShareUserUuid('/CAA', uuid)} target="_blank" rel="noopener noreferrer" className="w-full sm:w-[188px] inline-flex items-center justify-center gap-2 h-12 sm:h-14 rounded-full bg-white text-slate-700 font-semibold text-base sm:text-lg border border-slate-200 hover:border-[#66CDB5]/60 hover:bg-teal-50/50 hover:text-teal-700 transition-all">
                <Sparkles size={18} className="text-[#4fb69e]" aria-hidden="true" />
                AI 注册向导
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
