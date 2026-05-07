# Case Study Template

Use this template to document real-world performance improvements achieved with React Perf Profiler.

---

## Title: How [Company] Reduced Render Time by [X]% with React Perf Profiler

### Company Background
- **Company:** [Name]
- **Industry:** [e.g., E-commerce, SaaS, Fintech]
- **Scale:** [e.g., 10M monthly active users, 500 components]
- **Tech stack:** [e.g., Next.js 14, React 18, TypeScript]

### The Problem
Describe the performance challenge the team was facing:
- What were the symptoms? (slow page loads, janky interactions, poor Lighthouse scores)
- Which metrics were affected? (LCP, FID, CLS, INP)
- How long had this been an issue?
- What had they tried before?

### The Approach
How the team used React Perf Profiler:
1. **Setup:** How they installed and configured the extension
2. **Profiling:** Which features they used (flamegraph, component tree, timeline)
3. **Analysis:** What the tool revealed (wasted renders, missing memoization, etc.)
4. **Optimization:** The changes they made based on the findings

### Key Findings
List the specific performance issues discovered:
- **Finding 1:** [e.g., Component X re-rendered 47 times on page load due to missing React.memo]
- **Finding 2:** [e.g., Prop drilling caused 12 components to re-render on every state change]
- **Finding 3:** [e.g., Heavy computation in render function blocked main thread for 180ms]

### Results
Quantify the improvement:
| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| LCP | Xs | Ys | Z% |
| INP | Xms | Yms | Z% |
| Render count (page load) | X | Y | Z% |
| JS bundle size | XKB | YKB | Z% |
| Lighthouse performance | X | Y | +Z |

### Quote
> "[Testimonial from a developer on the team about their experience with the tool]"
> — [Name], [Title] at [Company]

### Lessons Learned
- [Key takeaway 1]
- [Key takeaway 2]
- [Key takeaway 3]

### About React Perf Profiler
React Perf Profiler is a Chrome/Firefox DevTools extension that profiles React component render behavior without code changes. [Link to install](https://github.com/rejisterjack/react-perf-profiler).
