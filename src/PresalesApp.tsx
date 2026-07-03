import React, { useEffect } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Services from './components/Services';
import Features from './components/Features';
import Pathway from './components/Pathway';
import Stats from './components/Stats';
import Footer from './components/Footer';

function useIosScrollFix() {
  useEffect(() => {
    if (!/iPad|iPhone|iPod/.test(navigator.userAgent)) return;
    document.documentElement.style.overscrollBehavior = 'none';
  }, []);
}

export default function PresalesApp() {
  useIosScrollFix();

  return (
    <div className="min-h-screen">
      <Navbar />
      <main>
        <Hero />
        <Services />
        <Features />
        <Pathway />
        <Stats />
      </main>
      <Footer />
    </div>
  );
}
