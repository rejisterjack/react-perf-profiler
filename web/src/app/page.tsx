'use client';

import { useEffect } from 'react';
import Lenis from 'lenis';

import { Navigation } from '@/components/Navigation';
import { TrustBar } from '@/components/TrustBar';
import { FAQ } from '@/components/FAQ';
import { CTASection } from '@/components/CTASection';
import { Footer } from '@/components/Footer';
import { SocialProof } from '@/components/SocialProof';

import { Hero } from '@/components/sections/Hero';
import { ProblemSolution } from '@/components/sections/ProblemSolution';
import { WhoIsItFor } from '@/components/sections/WhoIsItFor';
import { FeatureBento } from '@/components/sections/FeatureBento';
import { AllFeatures } from '@/components/sections/AllFeatures';
import { RSCShowcase } from '@/components/sections/RSCShowcase';
import { CICDShowcase } from '@/components/sections/CICDShowcase';
import { DemoSection } from '@/components/sections/DemoSection';
import { Comparison } from '@/components/sections/Comparison';
import { Pricing } from '@/components/sections/Pricing';

export default function HomePage() {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 2,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
    };
  }, []);

  return (
    <div className="min-h-screen bg-surface-900 text-white selection:bg-brand-cyan/30 selection:text-white">
      <Navigation />
      <main id="main-content">
        {/* 1. Hero — headline, dual install CTAs, live panel mockup */}
        <Hero />

        {/* 2. Trust bar — quality signals: test coverage, browser support, privacy, compatibility */}
        <TrustBar />

        {/* 3. Problem/Solution — emotional hook: React is fast until it isn't */}
        <ProblemSolution />

        {/* 4. Who is it for — 3 personas: solo dev, eng team, tech lead/devops */}
        <WhoIsItFor />

        {/* 5. How it works — 5-step guided flow: record → analyse → fix → AI → validate */}
        <DemoSection />

        {/* 6. Feature highlights (bento) — 6 core features with real UI mockups */}
        <FeatureBento />

        {/* 7. All features — complete feature matrix grouped by category */}
        <AllFeatures />

        {/* 8. RSC showcase — differentiated Next.js / App Router support */}
        <RSCShowcase />

        {/* 9. CI/CD showcase — perf budgets that fail the build */}
        <CICDShowcase />

        {/* 10. Comparison table — vs React DevTools & commercial tools */}
        <Comparison />

        {/* 11. Social proof — testimonials + benchmarks + extension perf stats */}
        <SocialProof />

        {/* 12. Pricing — free forever with self-hosting notes */}
        <Pricing />

        {/* 13. FAQ — 12 questions covering setup, compatibility, privacy, AI, CI */}
        <FAQ />

        {/* 14. Final CTA + email capture */}
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}
