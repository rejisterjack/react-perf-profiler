import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { useInView } from '@/hooks/useInView';
import { Card } from './ui/Card';
import { motion } from 'framer-motion';
import { Quote } from 'lucide-react';

const TESTIMONIALS = [
  {
    quote: "Found 47 wasted renders in our main feed. Fixed them in an afternoon. Page load dropped 200ms. This tool paid for itself in one day.",
    name: "Senior Frontend Engineer",
    role: "E-commerce Platform",
    highlight: "200ms faster",
  },
  {
    quote: "The memo effectiveness report alone saved us weeks. It pinpointed exactly which callbacks were breaking React.memo — something we'd been chasing for months.",
    name: "Tech Lead",
    role: "SaaS Analytics Dashboard",
    highlight: "Weeks saved",
  },
  {
    quote: "We integrated the performance budget into CI. Now every PR gets a performance score, and we've caught regressions before they ever reached production.",
    name: "Principal Engineer",
    role: "Enterprise SaaS",
    highlight: "CI-integrated",
  },
];

function TestimonialCard({ testimonial, index }: { testimonial: typeof TESTIMONIALS[0]; index: number }) {
  const [ref, isInView] = useInView<HTMLDivElement>({ threshold: 0.2 });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: index * 0.15 }}
    >
      <Card hover className="p-8 h-full flex flex-col relative overflow-hidden">
        <div className="absolute top-0 right-0 p-6 opacity-10">
          <Quote className="w-16 h-16 text-brand-react" />
        </div>
        <div className="relative z-10 flex-1">
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-brand-react/10 text-brand-react text-xs font-medium mb-6">
            {testimonial.highlight}
          </div>
          <p className="text-lg text-surface-200 leading-relaxed mb-8 italic">
            "{testimonial.quote}"
          </p>
        </div>
        <div className="relative z-10 flex items-center gap-4 pt-6 border-t border-white/5">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-react to-brand-blue flex items-center justify-center text-sm font-bold text-surface-900">
            {testimonial.name.charAt(0)}
          </div>
          <div>
            <div className="text-sm font-medium text-white">{testimonial.name}</div>
            <div className="text-xs text-surface-500">{testimonial.role}</div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

export function Testimonials() {
  const ref = useScrollAnimation<HTMLDivElement>();

  return (
    <section id="testimonials" ref={ref} className="py-24 lg:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6 text-balance">
            Loved by <span className="gradient-text">React developers</span>
          </h2>
          <p className="text-lg text-surface-400 text-balance">
            From startups to enterprise teams, developers trust React Perf Profiler to
            ship faster, more performant applications.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t, i) => (
            <TestimonialCard key={i} testimonial={t} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
