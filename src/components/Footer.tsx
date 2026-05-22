import React from "react";

export default function Footer() {
  return (
    <footer className="py-6 md:h-12 md:py-0 bg-slate-900 border-t border-slate-800 text-slate-500 text-[10px] flex items-center">
      <div className="max-w-7xl mx-auto px-5 md:px-8 w-full flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] font-medium text-center md:text-left">
        <div>© 2026 BANBU ONE ENTERPRISE SERVICES · ALL RIGHTS RESERVED</div>
        <div className="flex flex-wrap justify-center gap-4 md:gap-8 font-bold text-slate-500">
          <span>PRIVACY POLICY</span>
          <span>SERVICE AGREEMENT</span>
          <span className="text-[#66CDB5]">SHANGHAI · BEIJING · SHENZHEN</span>
        </div>
      </div>
    </footer>
  );
}
