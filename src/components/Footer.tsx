import React from 'react';
import { Building2 } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-slate-950 border-t border-slate-800 text-slate-400">
      <div className="max-w-7xl mx-auto px-5 sm:px-6 py-8 sm:py-10">
        <div className="flex flex-col lg:flex-row justify-between gap-8 lg:gap-12">
          <div className="max-w-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#66CDB5] text-white flex items-center justify-center shadow-sm shadow-[#66CDB5]/25">
                <Building2 size={21} strokeWidth={2.5} />
              </div>
              <div>
                <div className="text-base font-bold text-white tracking-tight">班步一企通</div>
                <div className="text-[11px] font-semibold tracking-[0.2em] text-[#66CDB5] uppercase">BANBU ONE</div>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-slate-400">
              聚焦创业企业后台事务，把注册、财税、人事和补贴申请放进连续的服务路径里。
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 lg:min-w-[520px]">
            <div>
              <div className="text-xs font-bold text-slate-200 mb-4">服务内容</div>
              <div className="grid gap-2 text-sm">
                <span>注册代理</span>
                <span>财务代理</span>
                <span>人事外包</span>
                <span>补贴申请</span>
              </div>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-200 mb-4">服务城市</div>
              <div className="grid gap-2 text-sm">
                <span>上海</span>
                <span>北京</span>
                <span>深圳</span>
              </div>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <div className="text-xs font-bold text-slate-200 mb-4">服务说明</div>
              <div className="grid gap-2 text-sm">
                <span>隐私政策</span>
                <span>服务协议</span>
                <span>顾问服务支持</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-5 border-t border-slate-800 flex flex-col sm:flex-row justify-between gap-3 text-[11px] font-medium text-slate-500">
          <span>© 2026 班步一企通 版权所有</span>
          <span className="text-[#66CDB5]">企业后台事务，一站托管</span>
        </div>
      </div>
    </footer>
  );
}
