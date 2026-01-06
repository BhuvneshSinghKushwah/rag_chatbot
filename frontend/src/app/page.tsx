'use client';

import { Navbar } from '@/components/landing/Navbar';
import { Hero } from '@/components/landing/Hero';
import { ValueProps } from '@/components/landing/ValueProps';
import { Features } from '@/components/landing/Features';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { OpenSource } from '@/components/landing/OpenSource';
import { Footer } from '@/components/landing/Footer';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black">
      <Navbar />
      <main>
        <Hero />
        <ValueProps />
        <Features />
        <HowItWorks />
        <OpenSource />
      </main>
      <Footer />
    </div>
  );
}
