import React, { useState, useEffect } from "react";
import { Building2, Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function Navbar({ onOpenModal }: { onOpenModal: () => void }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { name: "产品入口", href: "#desk" },
    { name: "服务内容", href: "#services" },
    { name: "能力亮点", href: "#scenes" },
    { name: "服务路径", href: "#path" },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? "glass-panel border-b border-slate-100" : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-5 md:px-8 h-16 md:h-20 flex items-center justify-between">
        <a href="#" className="flex items-center gap-2 md:gap-3 group">
          <div className="w-8 h-8 md:w-10 md:h-10 bg-[#66CDB5] rounded-[10px] md:rounded-xl flex items-center justify-center text-white group-hover:scale-105 transition-transform">
            <Building2
              className="w-5 h-5 md:w-[22px] md:h-[22px]"
              strokeWidth={2.5}
            />
          </div>
          <span className="font-bold text-lg md:text-xl tracking-tight text-slate-800">
            班步一企通{" "}
            <span className="text-slate-500 font-medium hidden sm:inline">
              · BANBU
            </span>
          </span>
        </a>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors relative after:absolute after:bottom-[-4px] after:left-0 after:w-full after:h-[2px] after:bg-[#66CDB5] after:scale-x-0 hover:after:scale-x-100 after:transition-transform after:origin-left"
            >
              {link.name}
            </a>
          ))}
          <button
            onClick={onOpenModal}
            className="px-6 py-2.5 bg-[#66CDB5] hover:bg-[#52ba9f] text-white text-sm font-medium rounded-full transition-all shadow-sm"
          >
            托管我的企业
          </button>
        </nav>

        {/* Mobile Toggle */}
        <button
          className="md:hidden p-2 text-slate-600"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Nav */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-16 md:top-20 left-0 right-0 glass-panel border-b border-slate-200 p-6 flex flex-col gap-4 shadow-xl md:hidden"
          >
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-lg font-semibold text-slate-900 py-2 border-b border-slate-100"
              >
                {link.name}
              </a>
            ))}
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                onOpenModal();
              }}
              className="w-full mt-4 px-6 py-3 bg-[#66CDB5] hover:bg-[#52ba9f] text-white font-bold rounded-xl shadow-md text-center transition-colors"
            >
              托管我的企业
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
