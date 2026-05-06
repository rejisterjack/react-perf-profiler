import { useEffect } from 'react';
import Lenis from 'lenis';

import { Navigation } from './components/Navigation';
import { TrustBar } from './components/TrustBar';
import { FAQ } from './components/FAQ';
import { CTASection } from './components/CTASection';
import { Footer } from './components/Footer';

import { Hero } from './sections/Hero';
import { ProblemSolution } from './sections/ProblemSolution';
import { FeatureBento } from './sections/FeatureBento';
import { AllFeatures } from './sections/AllFeatures';
import { RSCShowcase } from './sections/RSCShowcase';
import { DemoSection } from './sections/DemoSection';
import { Workflow } from './sections/Workflow';
import { Comparison } from './sections/Comparison';
import { Pricing } from './sections/Pricing';
import { Testimonials } from './components/Testimonials';

function App() {
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
      <main>
        {/* 1. Hero — headline, direct download CTAs, mockup */}
        <Hero />

        {/* 2. Trust bar — verifiable quality signals */}
        <TrustBar />

        {/* 3. Problem/Solution — emotional hook */}
        <ProblemSolution />

        {/* 4. Feature highlights (bento) — core 6 features at a glance */}
        <FeatureBento />

        {/* 5. All features — complete feature matrix grouped by category */}
        <AllFeatures />

        {/* 6. RSC showcase — differentiated Next.js / App Router support */}
        <RSCShowcase />

        {/* 7. Demo — step-by-step walkthrough + quick-start terminal */}
        <DemoSection />

        {/* 8. How it works — simplified 3-step flow */}
        <Workflow />

        {/* 9. Comparison table — vs React DevTools & commercial tools */}
        <Comparison />

        {/* 10. Benchmarks — real-world performance results */}
        <Testimonials />

        {/* 11. Pricing — free forever with self-hosting notes */}
        <Pricing />

        {/* 12. FAQ */}
        <FAQ />

        {/* 13. Final CTA + email capture */}
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}

export default App;
