# Store Assets

Assets and metadata for Chrome Web Store and Firefox Add-ons publication.

## Table of Contents

- [Screenshots](#screenshots)
- [Promotional Images](#promotional-images)
- [Store Listings](#store-listings)
- [Privacy Policy](#privacy-policy)
- [Permission justification](./store-assets/PERMISSION_JUSTIFICATION.md) (copy for reviewers)
- [Asset Generation Guide](#asset-generation-guide)

---

## Screenshots

Screenshots should showcase the extension's key features and UI.

### Required Sizes

| Size | Aspect Ratio | Usage |
|------|--------------|-------|
| 1280x800 | 16:10 | Chrome Web Store (recommended) |
| 1200x800 | 3:2 | Chrome Web Store (alternative) |
| 640x400 | 16:10 | Firefox Add-ons, thumbnails |

### Screenshot Guidelines

1. **Content**
   - Show the actual extension UI in DevTools
   - Include real-world usage examples
   - Demonstrate key features (flamegraph, wasted renders, memo analysis)
   - Use realistic React apps (not empty/skeleton UIs)

2. **Quality**
   - High resolution, no pixelation
   - Good contrast and readability
   - Consistent color scheme
   - No sensitive/personal information

3. **Captions** (Chrome Web Store)
   - Screenshot 1: "Flamegraph View - Visualize render hierarchy"
   - Screenshot 2: "Wasted Render Detection - Find unnecessary re-renders"
   - Screenshot 3: "Memo Analysis - Optimize memoization"
   - Screenshot 4: "RSC Support - Analyze Server Components"
   - Screenshot 5: "Component Tree - Navigate with ease"

### Screenshot List

Placeholders (replace with real UI): [store-assets/screenshots/](store-assets/screenshots/) — see [README](store-assets/screenshots/README.md) there.

```
docs/store-assets/screenshots/
├── screenshot-1-flamegraph-1280x800.png
├── screenshot-2-wasted-renders-1280x800.png
├── screenshot-3-memo-analysis-1280x800.png
├── screenshot-4-rsc-support-1280x800.png
├── screenshot-5-component-tree-1280x800.png
├── …-640x400.png (thumbnails)
└── README.md
```

---

## Promotional Images

### Small Promotional Image

- **Size:** 440x280 pixels
- **Format:** PNG or JPEG
- **Usage:** Chrome Web Store listing, search results
- **Requirements:**
  - No transparency
  - No animated elements
  - Clear branding
  - Readable at small sizes

**Design Guidelines:**
- Feature the React logo + lightning bolt icon
- Include tagline: "Profile React Performance"
- Use brand colors: #61DAFB (React blue), #FFD700 (gold accent)
- Clean, modern design

### Large Promotional Image

- **Size:** 920x680 pixels
- **Format:** PNG or JPEG
- **Usage:** Chrome Web Store featured listing
- **Requirements:**
  - Same as small promo, higher resolution
  - More detail and context
  - Can include UI preview elements

**Design Guidelines:**
- Expand on small promo design
- Add subtle background pattern
- Include feature callouts (badges/icons)

### Marquee Image

- **Size:** 1400x560 pixels
- **Format:** PNG or JPEG
- **Usage:** Chrome Web Store homepage featured section
- **Requirements:**
  - Wide format, left-aligned content
  - Impactful visual
  - Clear value proposition

**Design Guidelines:**
- Left side: Branding and tagline
- Right side: Feature preview or abstract visualization
- Bold, eye-catching design

### Promotional Image Assets

```
docs/store-assets/
├── promotional/
│   ├── promo-small-440x280.png
│   ├── promo-large-920x680.png
│   └── marquee-1400x560.png
```

---

## Store Listings

### Chrome Web Store

#### Short Description (Max 132 characters)

```
Profile React performance: detect wasted renders, analyze memoization, visualize flamegraphs. For Chrome DevTools.
```

#### Full Description (Max 1000 characters)

```
React Perf Profiler is a powerful Chrome DevTools extension for analyzing React component performance.

KEY FEATURES:

🎯 Wasted Render Detection
Identify components that re-render without changes. Get specific recommendations for React.memo, useMemo, and useCallback.

📊 Interactive Flamegraph
Visualize render hierarchy and timing with color-coded components. Zoom, pan, and explore your component tree.

🧠 Memo Effectiveness Analysis
Analyze how well your memoization strategy works. Detect unstable props and callbacks breaking memoization.

🌊 React Server Components Support
Profile RSC payloads, cache hit rates, and boundary crossings. Optimize your Next.js App Router applications.

⚡ Performance at Scale
Built for large applications. Web Worker-based analysis, virtualized lists, and memory-efficient storage.

🔄 Time-Travel Debugging
Step through commits to understand how your app state evolves over time.

📈 CI/CD Integration
Export profiles, set performance budgets, and enforce standards in your pipeline.

🔌 Plugin System
Extend with custom analysis plugins. Build your own metrics and visualizations.

PERFECT FOR:
• Optimizing React applications
• Finding performance bottlenecks
• Learning React rendering behavior
• Code reviews and performance audits

Open source and free. Built with ❤️ for the React community.
```

#### Key Features List (Bullet Points)

- Detect wasted renders and unnecessary re-renders
- Interactive flamegraph visualization
- Memoization effectiveness analysis
- React Server Components support
- Time-travel debugging
- Export/import profile sessions
- CI/CD performance budgets
- Extensible plugin system

### Firefox Add-ons

#### Short Description (Max 170 characters)

```
React performance profiler for Firefox DevTools. Detect wasted renders, analyze memoization, visualize component hierarchy.
```

#### Full Description

```
React Perf Profiler brings advanced performance analysis to Firefox DevTools.

FEATURES:

🔍 Wasted Render Detection
Find components re-rendering without prop or state changes. Get actionable optimization suggestions.

📈 Flamegraph Visualization
Explore your component tree with an interactive flamegraph. Identify slow components at a glance.

🧮 Memo Analysis
Understand why your React.memo components still re-render. Detect unstable callbacks and objects.

🌐 RSC Support
Full support for React Server Components. Analyze payload sizes and cache effectiveness.

⚙️ Developer Experience
• Keyboard shortcuts for common actions
• Export profiles for sharing
• Customizable settings
• Dark mode support

PERFORMANCE BUDGETS
Integrate with your CI/CD pipeline to prevent performance regressions. Set thresholds for render times, wasted renders, and more.

OPEN SOURCE
React Perf Profiler is open source software. Report issues and contribute on GitHub.

Learn more: https://github.com/rejisterjack/react-perf-profiler
```

### Store Listing Assets

```
docs/store-assets/
├── listing/
│   ├── chrome-short-description.txt
│   ├── chrome-full-description.txt
│   ├── firefox-short-description.txt
│   ├── firefox-full-description.txt
│   └── keywords.txt
```

---

## Privacy Policy

### Canonical URL for store listings (HTTPS)

After you enable **GitHub Pages** (Settings → Pages → Source: **GitHub Actions**), the workflow [.github/workflows/pages.yml](../.github/workflows/pages.yml) publishes:

- **Live policy:** `https://<github-username>.github.io/<repository>/`

The deployed site is built from [docs/store-assets/privacy/index.html](store-assets/privacy/index.html).

**Source of truth (markdown, for edits):**

- [docs/store-assets/privacy/chrome-privacy-policy.md](store-assets/privacy/chrome-privacy-policy.md)
- [docs/store-assets/privacy/firefox-privacy-policy.md](store-assets/privacy/firefox-privacy-policy.md)

Use the **same HTTPS URL** on both Chrome Web Store and Firefox Add-ons. Keep `index.html` in sync when you change policy text.

**Important:** The policy must describe **optional** cloud sync, collaboration, and cloud LLM features accurately. Do not claim that all data never leaves the device if those features exist.

---

## Asset Generation Guide

### Automated Screenshot Capture

Use Playwright to capture screenshots programmatically:

```typescript
// scripts/capture-screenshots.ts
import { chromium } from 'playwright';
import { testAppServer } from '../tests/fixtures/server';

async function captureScreenshots() {
  const server = await testAppServer.start();
  
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  
  const page = await context.newPage();
  
  // Load test app with profiler
  await page.goto('http://localhost:3000');
  
  // Open DevTools (requires CDP)
  const client = await page.context().newCDPSession(page);
  
  // Navigate to profiler panel
  await client.send('Runtime.evaluate', {
    expression: `
      // Script to open DevTools and switch to profiler tab
    `
  });
  
  // Wait for UI to settle
  await page.waitForTimeout(1000);
  
  // Capture screenshots
  await page.screenshot({
    path: 'docs/store-assets/screenshots/screenshot-1-1280x800.png'
  });
  
  await browser.close();
  await server.stop();
}

captureScreenshots();
```

### Generating Promotional Images

Use a tool like Figma, Sketch, or code-based generation:

```typescript
// scripts/generate-promo-images.ts
import { createCanvas } from 'canvas';
import fs from 'fs';

function generatePromoImage(width: number, height: number, filename: string) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  // Background
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#1a1a2e');
  gradient.addColorStop(1, '#16213e');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  
  // React logo
  ctx.fillStyle = '#61DAFB';
  ctx.beginPath();
  ctx.arc(width * 0.2, height * 0.5, 50, 0, Math.PI * 2);
  ctx.fill();
  
  // Lightning bolt
  ctx.fillStyle = '#FFD700';
  ctx.beginPath();
  ctx.moveTo(width * 0.25, height * 0.4);
  ctx.lineTo(width * 0.28, height * 0.5);
  ctx.lineTo(width * 0.25, height * 0.5);
  ctx.lineTo(width * 0.27, height * 0.6);
  ctx.lineTo(width * 0.22, height * 0.5);
  ctx.lineTo(width * 0.25, height * 0.5);
  ctx.closePath();
  ctx.fill();
  
  // Title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 48px system-ui';
  ctx.fillText('React Perf Profiler', width * 0.35, height * 0.45);
  
  // Tagline
  ctx.font = '24px system-ui';
  ctx.fillStyle = '#a0a0a0';
  ctx.fillText('Profile React Performance', width * 0.35, height * 0.55);
  
  // Save
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(filename, buffer);
}

// Generate all sizes
generatePromoImage(440, 280, 'docs/store-assets/promotional/promo-small-440x280.png');
generatePromoImage(920, 680, 'docs/store-assets/promotional/promo-large-920x680.png');
generatePromoImage(1400, 560, 'docs/store-assets/promotional/marquee-1400x560.png');
```

### Validation Checklist

Before submitting to stores, verify:

- [ ] All images meet size requirements
- [ ] Screenshots show actual extension UI
- [ ] No sensitive information in screenshots
- [ ] Promotional images are high quality
- [ ] Descriptions are within character limits
- [ ] Privacy policy is complete
- [ ] Keywords are relevant and not excessive
- [ ] Support URL is valid
- [ ] Website URL is valid

### Store Submission Checklist

Chrome Web Store:
- [ ] ZIP file with manifest and assets
- [ ] 1-5 screenshots (1280x800 or 1200x800)
- [ ] Small promo tile (440x280) - optional
- [ ] Large promo tile (920x680) - optional
- [ ] Marquee promo tile (1400x560) - optional
- [ ] Detailed description
- [ ] Privacy policy URL
- [ ] Support URL
- [ ] Category: Developer Tools

Firefox Add-ons:
- [ ] ZIP or XPI file
- [ ] 1-8 screenshots (recommended 1200x900)
- [ ] Icon (recommended 512x512)
- [ ] Summary (max 170 chars)
- [ ] Description
- [ ] Privacy policy
- [ ] Support email/URL
- [ ] Category: Developer Tools

---

## Asset storage structure

```
docs/store-assets/
├── AMO_SUBMISSION_NOTES.md
├── PERMISSION_JUSTIFICATION.md
├── listing/
│   ├── chrome-short.txt
│   ├── chrome-full.txt
│   ├── firefox-short.txt
│   ├── firefox-full.txt
│   └── keywords.txt
├── privacy/
│   ├── index.html                 # GitHub Pages entry (built policy)
│   ├── chrome-privacy-policy.md
│   └── firefox-privacy-policy.md
├── promotional/
│   ├── marquee-1400x560.svg
│   ├── promo-large-920x680.svg
│   └── promo-small-440x280.svg
└── screenshots/
    ├── README.md
    └── screenshot-*.png         # Replace placeholders with real UI
```

Extension icons used in builds: `public/icons/` (SVG).

Promotional SVGs can be exported to PNG when a store requires raster tiles.
