# React Server Components (RSC) Analysis

This document describes the React Server Components analysis capabilities of React Perf Profiler.

## Overview

React Server Components allow React components to render exclusively on the server, reducing the JavaScript bundle size sent to the client. The RSC Analysis feature helps you optimize your application's server/client boundary architecture.

## What is Analyzed

### 1. Payload Metrics

| Metric | Description | Optimization Target |
|--------|-------------|---------------------|
| **Payload Size** | Total size of RSC payload transferred | < 200KB per route |
| **Transfer Time** | Time from request to first byte | < 100ms |
| **Serialization Cost** | Time to serialize server data | < 50ms |
| **Deserialization Cost** | Time to parse RSC on client | < 30ms |

### 2. Boundary Metrics

| Metric | Description |
|--------|-------------|
| **Server Components** | Count of components rendering on server |
| **Client Boundaries** | Count of `'use client'` boundaries |
| **Boundary Crossings** | Server → Client component transitions |
| **Cache Hit Rate** | Percentage of cached RSC responses |

### 3. Detected Issues

The analyzer detects these common RSC issues:

| Issue Type | Description | Severity |
|------------|-------------|----------|
| **Oversized Props** | Props > 50KB passed to client boundary | High |
| **Cache Miss** | Server component not using cache effectively | Medium |
| **Slow Boundary** | Client boundary taking > 100ms to render | High |
| **Deep Nesting** | > 5 levels of server/client nesting | Low |
| **Unnecessary Boundary** | `'use client'` without interactivity need | Medium |

## How RSC Payloads Work

```
┌─────────────────────────────────────────────────────────────┐
│  Server                                    Client           │
│                                                             │
│  ┌──────────────┐      RSC Stream        ┌──────────────┐  │
│  │   Server     │  ───────────────────>  │  React       │  │
│  │  Components  │   1. Serialized JSX    │  Reconciler  │  │
│  │              │   2. References ($)    │              │  │
│  │  <Page/>     │   3. Client refs (@)   │  Hydrates    │  │
│  │    <Data/>   │   4. Promises ($L)     │  gradually   │  │
│  │    <UI/>     │                        │              │  │
│  └──────────────┘                        └──────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### RSC Reference Markers

| Marker | Meaning | Example |
|--------|---------|---------|
| `$` | Element reference | `"$1"` refers to element with ID 1 |
| `@` | Client reference | `"@/components/Button"` client component |
| `#` | Server action | `"#action-123"` server action reference |
| `$S` | Symbol | `"$Sreact.suspense"` React symbol |
| `$F` | Form state | `"$Fform-data"` form state reference |
| `$L` | Lazy/Promise | `"$Lpromise-1"` lazy loaded component |

## Using RSC Analysis

### 1. Capturing RSC Data

The profiler automatically captures RSC payloads when:
- You navigate between pages in a Next.js App Router app
- Server components re-render due to data changes
- Client boundaries are hydrated

### 2. Viewing Analysis

1. Open React DevTools → **⚡ Perf Profiler** tab
2. Navigate to the **RSC Analysis** section
3. View:
   - **Metrics Card**: Payload size, transfer time, cache rates
   - **Boundaries Table**: All server/client boundaries with stats
   - **Stream Timeline**: Visual timeline of RSC streaming
   - **Issues List**: Detected optimization opportunities

### 3. Reading the Report

```
┌─────────────────────────────────────────┐
│ RSC Analysis: Product Page              │
├─────────────────────────────────────────┤
│ Payload Size: 245 KB ⚠️                 │
│ Transfer Time: 89ms ✓                   │
│ Cache Hit Rate: 78% ✓                   │
│                                         │
│ Server Components: 12                   │
│ Client Boundaries: 3                    │
│                                         │
│ ⚠️ Issues Detected:                     │
│ • Large props passed to ProductCarousel │
│   (78 KB - consider image optimization) │
│ • Cache miss on ProductReviews          │
│                                         │
│ 💡 Recommendations:                     │
│ 1. Move images to CDN with blur placeholder
│ 2. Add 'use cache' to ProductReviews    │
│ 3. Reduce boundary crossings            │
└─────────────────────────────────────────┘
```

## Optimization Patterns

### ❌ Anti-Pattern: Large Props to Client

```tsx
// Server Component
async function ProductPage({ id }) {
  const product = await fetchProduct(id);
  
  // ❌ Passing large data to client boundary
  return (
    <ClientCarousel 
      images={product.highResImages} // 5MB of image URLs!
    />
  );
}
```

### ✅ Solution: Data Colocation

```tsx
// Server Component
async function ProductPage({ id }) {
  const product = await fetchProduct(id);
  
  return (
    <ServerCarousel>
      {product.images.map(img => (
        <ServerImage key={img.id} src={img.thumb} />
      ))}
    </ServerCarousel>
  );
}

// Client Component only handles interactions
'use client';
function ServerCarousel({ children }) {
  const [activeIndex, setActiveIndex] = useState(0);
  // Client logic only, no large data
}
```

### ❌ Anti-Pattern: Unnecessary Client Boundary

```tsx
// ❌ Making entire component client for one hook
'use client';

function Header() {
  const pathname = usePathname(); // Only need this one hook
  
  return (
    <header>
      <Logo />
      <Nav />
      <UserMenu />
    </header>
  );
}
```

### ✅ Solution: Split Boundaries

```tsx
// Server Component
function Header() {
  return (
    <header>
      <Logo />
      <Nav />
      <ClientPathIndicator /> {/* Only client part */}
    </header>
  );
}

'use client';
function ClientPathIndicator() {
  const pathname = usePathname();
  return <span>{pathname}</span>;
}
```

## RSC Caching Strategies

### 1. Full Route Cache (Next.js)

```tsx
// Cache the entire page
export const dynamic = 'force-static';

async function Page() {
  const data = await fetch('https://api.example.com/data', {
    next: { revalidate: 3600 } // 1 hour
  });
  return <View data={data} />;
}
```

### 2. Component-Level Cache

```tsx
import { unstable_cache } from 'next/cache';

const getCachedData = unstable_cache(
  async (id) => fetchData(id),
  ['data-cache'],
  { revalidate: 3600 }
);

async function Component({ id }) {
  const data = await getCachedData(id);
  return <View data={data} />;
}
```

### 3. React `use cache` (Experimental)

```tsx
'use cache';

async function ExpensiveComponent({ userId }) {
  const data = await fetchUserData(userId);
  return <Profile data={data} />;
}
```

## Configuration

### Analysis Thresholds

Configure thresholds in `rscAnalysisStore`:

```typescript
interface RSCAnalysisConfig {
  maxPayloadSize: number;      // Default: 500000 (500KB)
  maxPropsSize: number;        // Default: 50000 (50KB)
  slowBoundaryThreshold: number; // Default: 100 (100ms)
}
```

## Framework Support

| Framework | Status | Notes |
|-----------|--------|-------|
| Next.js App Router | ✅ Full | All features supported |
| Next.js Pages Router | ⚠️ Partial | No RSC (use standard profiling) |
| Remix | 🔄 Planned | Pending RSC release |
| React Router (future) | 🔄 Planned | Pending RSC release |

## Troubleshooting

### "No RSC Data Captured"

1. Ensure you're using a framework with RSC support (Next.js App Router)
2. Check that React DevTools is installed and enabled
3. Navigate between pages to trigger RSC renders
4. Verify `reactServerComponents` is enabled in profiler settings

### "Payload Size Seems Incorrect"

- RSC payload size is an estimate based on serialized JSON
- Actual network transfer may differ due to:
  - Compression (gzip/brotli)
  - Streaming overhead
  - Binary data encoding

### "Cache Hit Rate is 0%"

- Check that your server components use caching
- Verify cache headers in network tab
- Some frameworks disable caching in development mode

## Related Documentation

- [React Server Components RFC](https://github.com/reactjs/rfcs/blob/main/text/0188-server-components.md)
- [Next.js RSC Documentation](https://nextjs.org/docs/app/building-your-application/rendering/server-components)
- [React DevTools Profiler](https://react.dev/reference/react/Profiler)
