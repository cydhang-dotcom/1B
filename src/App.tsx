import React, { useState } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Services from './components/Services';
import Features from './components/Features';
import Pathway from './components/Pathway';
import Stats from './components/Stats';
import CTA from './components/CTA';
import Footer from './components/Footer';
import TrustModal from './components/TrustModal';

export default function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <Navbar onOpenModal={() => setIsModalOpen(true)} />
      <main>
        <Hero onOpenModal={() => setIsModalOpen(true)} />
        <Services />
        <Features />
        <Pathway />
        <Stats />
        <CTA onOpenModal={() => setIsModalOpen(true)} />
      </main>
      <Footer />
      <TrustModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
