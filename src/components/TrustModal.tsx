import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function TrustModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [isSuccess, setIsSuccess] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', company: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) return;
    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      onClose();
      setFormData({ name: '', phone: '', company: '' });
    }, 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-4">
      <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" onClick={onClose}></div>
      
      <AnimatePresence mode="wait">
        {!isSuccess ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-4xl max-h-[calc(100dvh-2rem)] bg-white rounded-[1.5rem] md:rounded-[2rem] shadow-2xl shadow-slate-950/15 overflow-y-auto md:overflow-hidden relative z-10 flex flex-col md:flex-row border border-slate-100"
          >
            {/* Modal Aside */}
            <div className="w-full md:w-2/5 bg-slate-50 p-6 md:p-12 flex flex-col justify-center relative overflow-hidden shrink-0 border-b md:border-b-0 md:border-r border-slate-100">
               <div className="absolute top-0 right-0 w-64 h-64 bg-[#66CDB5]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
               
               <div className="relative z-10">
                 <div className="text-[10px] font-bold tracking-widest text-[#66CDB5] uppercase mb-4 md:mb-6">BANBU ONE SERVICE</div>
                 <h3 className="text-2xl md:text-3xl font-extrabold text-slate-900 leading-[1.2] mb-3 md:mb-4">企业后台<br/>交给班步</h3>
                 <p className="text-sm text-slate-500 mb-6 md:mb-10 leading-relaxed">
                   从注册落地到财税、人事、补贴申请，按月推进、在线可见。
                 </p>
                 
                 <div className="space-y-3 md:space-y-4 border-t border-slate-200 pt-5 md:pt-8">
                   <div className="flex gap-3 text-sm font-medium text-slate-600">
                     <Check size={18} className="text-[#66CDB5] shrink-0" />
                     公司注册与后续托管衔接
                   </div>
                   <div className="flex gap-3 text-sm font-medium text-slate-600">
                     <Check size={18} className="text-[#66CDB5] shrink-0" />
                     财税、人事事项统一跟进
                   </div>
                 </div>
               </div>
            </div>

            {/* Modal Form */}
            <div className="w-full md:w-3/5 p-6 md:p-12 relative">
              <button 
                onClick={onClose}
                className="absolute top-6 right-6 h-10 w-10 flex items-center justify-center rounded-full hover:bg-slate-50 active:bg-slate-100 text-slate-400 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-200"
              >
                <X size={20} />
              </button>

              <h3 className="text-2xl font-extrabold text-slate-900 mb-6 md:mb-8 text-center md:text-left mt-4 md:mt-0">托管我的企业</h3>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <input 
                    type="text" 
                    required
                    placeholder="您的称呼" 
                    className="w-full h-12 px-5 bg-white border border-slate-200 rounded-full focus:border-[#66CDB5] focus:ring-4 focus:ring-[#66CDB5]/10 outline-none font-medium text-slate-900 transition-all placeholder:text-slate-400 shadow-sm shadow-slate-100"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div>
                  <input 
                    type="tel" 
                    required
                    placeholder="您的联系方式" 
                    className="w-full h-12 px-5 bg-white border border-slate-200 rounded-full focus:border-[#66CDB5] focus:ring-4 focus:ring-[#66CDB5]/10 outline-none font-medium text-slate-900 transition-all placeholder:text-slate-400 shadow-sm shadow-slate-100"
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
                <div>
                  <input 
                    type="text" 
                    placeholder="企业名称（选填）" 
                    className="w-full h-12 px-5 bg-white border border-slate-200 rounded-full focus:border-[#66CDB5] focus:ring-4 focus:ring-[#66CDB5]/10 outline-none font-medium text-slate-900 transition-all placeholder:text-slate-400 shadow-sm shadow-slate-100"
                    value={formData.company}
                    onChange={e => setFormData({...formData, company: e.target.value})}
                  />
                </div>
                
                <button 
                  type="submit"
                  className="w-full h-12 bg-[#66CDB5] hover:bg-[#52ba9f] text-white rounded-full font-medium text-base mt-2 transition-all shadow-lg shadow-[#66CDB5]/20 hover:shadow-xl hover:shadow-[#66CDB5]/25 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#66CDB5]/20"
                >
                  提交托管需求
                </button>
              </form>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm bg-white p-10 rounded-[2rem] shadow-xl shadow-slate-200/50 relative z-10 flex flex-col items-center text-center border border-slate-100"
          >
            <div className="w-16 h-16 bg-[#EEF0FF] text-[#5F65E8] rounded-2xl flex items-center justify-center mb-6">
              <Check size={32} strokeWidth={3} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">提交成功！</h3>
            <p className="text-slate-500 font-medium text-sm">我们会尽快与您联系</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
