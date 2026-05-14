import React from 'react';

export default function Footer() {
  return (
    <footer className="h-12 bg-slate-900 border-t border-slate-800 text-slate-500 text-[10px] flex items-center py-0">
      <div className="max-w-7xl mx-auto px-6 w-full flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] font-medium">
        <div>© 2026 BANBU ONE ENTERPRISE SERVICES · ALL RIGHTS RESERVED</div>
        <div className="flex gap-8 font-bold text-slate-500">
          <span>PRIVACY POLICY</span>
          <span>SERVICE AGREEMENT</span>
          <span className="text-[#66CDB5]">SHANGHAI · BEIJING · SHENZHEN</span>
        </div>
      </div>
    </footer>
  );
}
