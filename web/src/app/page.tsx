'use client';

import dynamic from 'next/dynamic';

import { Navigation } from '@/components/Navigation';
import { TrustBar } from '@/components/TrustBar';
import { Footer } from '@/components/Footer';

import { ProblemSolution } from '@/components/sections/ProblemSolution';
import { WhoIsItFor } from '@/components/sections/WhoIsItFor';
import { DemoSection } from '@/components/sections/DemoSection';
import { Comparison } from '@/components/sections/Comparison';
import { Pricing } from '@/components/sections/Pricing';

const SmoothScroll = dynamic(
  () =>
    import('@/components/SmoothScroll').then((mod) => mod.SmoothScroll),
  { ssr: false },
);

const Hero = dynamic(
  () => import('@/components/sections/Hero').then((mod) => mod.Hero),
);

const FeatureBento = dynamic(
  () =>
    import('@/components/sections/FeatureBento').then(
      (mod) => mod.FeatureBento,
    ),
);

const AllFeatures = dynamic(
  () =>
    import('@/components/sections/AllFeatures').then(
      (mod) => mod.AllFeatures,
    ),
);

const RSCShowcase = dynamic(
  () =>
    import('@/components/sections/RSCShowcase').then(
      (mod) => mod.RSCShowcase,
    ),
);

const CICDShowcase = dynamic(
  () =>
    import('@/components/sections/CICDShowcase').then(
      (mod) => mod.CICDShowcase,
    ),
);

const SocialProof = dynamic(
  () => import('@/components/SocialProof').then((mod) => mod.SocialProof),
);

const FAQ = dynamic(() => import('@/components/FAQ').then((mod) => mod.FAQ));

const CTASection = dynamic(
  () => import('@/components/CTASection').then((mod) => mod.CTASection),
);

export default function HomePage() {
  return (
    <SmoothScroll>
      <div className="min-h-screen bg-surface-900 text-white selection:bg-brand-cyan/30 selection:text-white">
        <Navigation />
        <main id="main-content">
          <Hero />
          <TrustBar />
          <ProblemSolution />
          <WhoIsItFor />
          <DemoSection />
          <FeatureBento />
          <AllFeatures />
          <RSCShowcase />
          <CICDShowcase />
          <Comparison />
          <SocialProof />
          <Pricing />
          <FAQ />
          <CTASection />
        </main>
        <Footer />
      </div>
    </SmoothScroll>
  );
}
