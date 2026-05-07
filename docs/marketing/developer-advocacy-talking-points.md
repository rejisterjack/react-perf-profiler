# Developer Advocacy Talking Points

## Elevator Pitch (30 seconds)
React Perf Profiler is a free, open-source Chrome/Firefox DevTools extension that helps React developers find and fix performance issues without changing a single line of code. It hooks into the React DevTools API to visualize render behavior, detect wasted renders, score memoization effectiveness, and provide AI-powered optimization suggestions — all within the browser DevTools you already use.

## Key Differentiators

### vs. React DevTools Profiler (built-in)
- React DevTools shows you *what* rendered; React Perf Profiler tells you *why* it's slow and *how* to fix it
- Built-in profiler has no budget alerts, no AI suggestions, no export, no team sharing
- We add analysis, regression detection, and optimization recommendations on top

### vs. Why Did You Render
- WDYR requires code changes (importing a higher-order component)
- React Perf Profiler works with zero code changes — install and go
- WDYR only detects unnecessary renders; we also profile render time, provide flamegraphs, and suggest fixes

### vs. React Scan
- React Scan overlays on the page (visual approach); we provide deep DevTools integration
- React Scan shows render counts; we provide full flamegraph, timeline, component tree, and analysis
- React Perf Profiler has export, collaboration, cloud sync, and AI suggestions

### vs. Lighthouse
- Lighthouse audits page-level performance at a single point in time
- React Perf Profiler profiles component-level render behavior interactively
- Complementary tools: use Lighthouse for overall page health, React Perf Profiler for React-specific optimization

## Stats to Cite (update when available)
- [X] GitHub stars
- [X] Chrome Web Store installs
- [X] Firefox Add-on installs
- 1176+ unit tests with 75%+ coverage
- Dual-browser support (Chrome MV3 + Firefox MV2)
- React 16.8+, 18, and 19 compatibility

## Talk Outlines

### 5-Minute Lightning Talk: "Stop Guessing, Start Profiling"
1. The problem: React performance is hard to debug (show a slow component)
2. Demo: Install → Record → Find the bottleneck in 60 seconds
3. The fix: Show the AI suggestion → Apply React.memo → Verify
4. Call to action: Free, open-source, install today

### 30-Minute Talk: "React Performance Deep Dive"
1. Why React performance matters (Core Web Vitals impact)
2. Common React anti-patterns (missing memoization, prop drilling, heavy computations)
3. How React's reconciler works (brief overview to set context)
4. Live demo: profiling a real app
5. Reading the flamegraph: what each color means
6. Timeline analysis: correlating renders with interactions
7. Performance budgets: CI/CD integration
8. Team workflows: collaboration and cloud sync
9. Q&A

### Workshop: "Hands-On React Performance Optimization" (90 min)
- Provide a purposely slow demo app
- Guided exercises for each feature
- Participants profile, identify, and fix issues in real-time

## Conference Targets
- React Conf
- Next.js Conf
- ViteConf
- React Summit
- AgentConf
- Local React meetups (React.js Bangalore, ReactNYC, etc.)
