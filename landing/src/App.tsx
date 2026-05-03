import { useEffect } from 'react';
import Lenis from 'lenis';
import { Hero } from './sections/Hero';
import { ProblemSolution } from './sections/ProblemSolution';
import { FeatureBento } from './sections/FeatureBento';
import { RSCShowcase } from './sections/RSCShowcase';
import { Workflow } from './sections/Workflow';

// We'll optionally render these if they exist, but we focus on the newly architected PLG sections
import { Navigation } from './components/Navigation';
import { TrustBar } from './components/TrustBar';
import { Testimonials } from './components/Testimonials';
import { FAQ } from './components/FAQ';
import { CTASection } from './components/CTASection';
import { Footer } from './components/Footer';

function App() {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // https://www.desmos.com/calculator/brs54l4xou
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
        <Hero />
        <TrustBar />
        <ProblemSolution />
        <FeatureBento />
        <RSCShowcase />
        <Workflow />
        <Testimonials />
        <FAQ />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}

export default App;
