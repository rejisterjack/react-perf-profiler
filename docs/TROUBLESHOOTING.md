# Troubleshooting Guide

Common issues and solutions for React Perf Profiler.

## Installation Issues

### Extension Not Appearing in DevTools

**Problem**: The "⚡ Perf Profiler" tab doesn't appear in Chrome/Firefox DevTools.

**Solutions**:

1. **Verify Extension is Loaded**
   - Chrome: Go to `chrome://extensions/` → Check if React Perf Profiler is listed and enabled
   - Firefox: Go to `about:addons` → Check if extension is installed

2. **Check for Errors**
   - Chrome: `chrome://extensions/` → Click "Errors" button on the extension card
   - Firefox: `about:debugging` → This Firefox → Inspect extension

3. **Reload Extension**
   - Chrome: Click the reload icon on the extension card
   - Firefox: Click "Inspect" → Click reload button

4. **Clear Cache**
   - Close and reopen DevTools (F12 twice)
   - Hard refresh the page (Ctrl/Cmd + Shift + R)

### Build Errors

**Problem**: `pnpm run build` fails.

**Common Causes & Solutions**:

| Error | Solution |
|-------|----------|
| `Cannot find module '@crxjs/vite-plugin'` | Run `pnpm install` |
| `TypeScript compilation failed` | Run `pnpm run typecheck` to see specific errors |
| `manifest.json not found` | Ensure `src/manifest.json` exists |
| `vite not found` | Install globally: `npm i -g vite` or use `npx vite` |

**Full Reset**:
```bash
rm -rf node_modules dist dist-firefox
pnpm install
pnpm run build
```

## Profiling Issues

### "No React Detected"

**Problem**: Profiler shows "React not detected on this page".

**Solutions**:

1. **Verify React is Loaded**
   ```javascript
   // In browser console
   console.log(window.React);
   console.log(window.__REACT_DEVTOOLS_GLOBAL_HOOK__);
   ```

2. **Check React DevTools**
   - Install [React DevTools](https://chrome.google.com/webstore/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi) if not present
   - React Perf Profiler requires React DevTools hook

3. **Development vs Production**
   - React DevTools hook may not be available in production builds
   - Use development builds for profiling

4. **Frame/iframe Issues**
   - React in iframes requires special handling
   - Select the correct frame context in DevTools console

### "Start Profiling" Button Disabled

**Problem**: Cannot start profiling session.

**Causes**:
1. React not detected
2. Another profiling session active
3. Page not fully loaded

**Solutions**:
- Wait for page to fully load
- Check for existing active sessions (red indicator)
- Refresh the page and try again

### No Data After Recording

**Problem**: Profile completed but no components shown.

**Solutions**:

1. **Interact with the App**
   - Renders only occur with user interaction or state changes
   - Click buttons, navigate, trigger updates during recording

2. **Check Filters**
   - Clear any active filters in the toolbar
   - Adjust minimum render count threshold

3. **React Version Compatibility**
   - React 16.5+ required for Profiler API
   - Some features require React 18+

### Profiling heuristics (Strict Mode, Fast Refresh, concurrent React)

**Strict Mode (development):** React may intentionally double-invoke renders. Render counts and “wasted render” hints can look higher than in production. Compare profiles on the same mode (dev vs dev, prod vs prod).

**Fast Refresh:** Hot reload resets components and fiber identity. For stable comparisons, capture a short recording after a full navigation, not mid-edit.

**Concurrent features:** Scheduling can change commit grouping. Use the timeline and multiple short recordings rather than a single long session when diagnosing edge cases.

**False positives:** Heuristics infer wasted work from props/state snapshots. Treat suggestions as starting points—verify with your app’s actual update patterns.

More context: [docs/COMPATIBILITY.md](./COMPATIBILITY.md).

## Performance Issues

### Profiler UI is Slow

**Problem**: UI lag when viewing large profiles.

**Solutions**:

1. **Limit Profile Duration**
   - Record shorter sessions (< 10 seconds)
   - Focus on specific interactions

2. **Adjust Settings**
   - Reduce `maxCommits` in settings (default: 100)
   - Lower `maxNodesPerCommit` if needed

3. **Clear Old Data**
   - Click "Clear Data" button between sessions
   - Enable auto-clear in settings

4. **Close Unused Tabs**
   - Each open tab with DevTools consumes memory
   - Close DevTools on inactive tabs

### High Memory Usage

**Problem**: Browser using excessive memory with profiler.

**Solutions**:

1. **Memory Management**
   ```typescript
   // In profiler settings
   {
     maxCommits: 50,        // Lower commit history
     maxNodesPerCommit: 5000 // Limit nodes per commit
   }
   ```

2. **Periodic Cleanup**
   - Set up auto-clear every 30 minutes
   - Manually clear after major profiling sessions

3. **Use Eager Cleanup**
   - Enable in advanced settings
   - Automatically removes old commits

## RSC Analysis Issues

### No RSC Data Captured

**Problem**: RSC Analysis shows "No data available".

**Solutions**:

1. **Framework Check**
   - RSC requires Next.js App Router or similar
   - Next.js Pages Router doesn't support RSC

2. **Navigation Required**
   - RSC payloads are captured on navigation
   - Navigate between pages while profiling

3. **Development Mode**
   - Some frameworks disable RSC caching in dev
   - Data may still be captured without caching

4. **Check Response Headers**
   - Look for `Content-Type: text/x-component`
   - Verify server is sending RSC payloads

### Incorrect Payload Size

**Problem**: RSC payload size seems wrong.

**Explanation**:
- Reported size is serialized JSON estimate
- Actual network transfer may differ due to:
  - Gzip/Brotli compression
  - Binary encoding
  - Streaming overhead

**Verification**:
- Check Network tab for actual transfer size
- Compare with profiler estimate
- Factor in ~30-50% compression ratio

## Browser-Specific Issues

### Firefox: Extension Not Loading

**Problem**: Firefox shows "Extension is invalid".

**Solutions**:

1. **Use Correct Build**
   ```bash
   pnpm run build:firefox  # NOT pnpm run build
   ```

2. **Temporary Extension**
   - Firefox requires temporary loading for unsigned extensions
   - Use `about:debugging` → This Firefox → Load Temporary Add-on

3. **Manifest Version**
   - Firefox uses Manifest V2
   - Chrome build (V3) won't work in Firefox

### Chrome: Service Worker Errors

**Problem**: "Service worker registration failed".

**Solutions**:

1. **Clear Extension Data**
   - `chrome://extensions/` → Developer mode → Clear storage

2. **Restart Browser**
   - Chrome occasionally needs restart after extension updates

3. **Check Permissions**
   - Verify extension has required permissions
   - Check `manifest.json` permissions array

## Analysis Issues

### Wasted Render Detection Incorrect

**Problem**: Profiler shows wasted renders that seem correct.

**Understanding**:
- A "wasted render" is when React re-renders but output is identical
- This can be intentional (e.g., side effects, refs)
- Not all wasted renders need fixing

**When to Ignore**:
- Components with side effects
- Components using refs for DOM manipulation
- Animation components

**When to Fix**:
- Pure presentational components
- Expensive computations
- List items in large lists

### Memoization Report Confusing

**Problem**: Unsure how to interpret memo effectiveness.

**Guidelines**:

| Hit Rate | Status | Action |
|----------|--------|--------|
| 80-100% | ✅ Excellent | None needed |
| 50-79% | ⚠️ Needs Work | Check prop stability |
| <50% | ❌ Ineffective | Restructure or remove memo |

**Common Fixes**:
```tsx
// ❌ Inline objects break memo
<MemoizedComponent config={{ theme: 'dark' }} />

// ✅ Stable reference
const config = useMemo(() => ({ theme: 'dark' }), []);
<MemoizedComponent config={config} />

// ❌ Inline callbacks
<MemoizedComponent onClick={() => handleClick()} />

// ✅ useCallback
const handleClick = useCallback(() => { ... }, []);
<MemoizedComponent onClick={handleClick} />
```

## Data Export/Import Issues

### Export Fails

**Problem**: Cannot export profile data.

**Solutions**:
- Check browser download permissions
- Disable popup blockers
- Try smaller profile (< 100 commits)
- Check available disk space

### Import Fails

**Problem**: Cannot import profile data.

**Solutions**:
- Verify file is valid JSON
- Check file size (< 50MB recommended)
- Ensure compatible version (profiles from v1.x work with v1.x)
- Clear current data before importing

## Getting Help

### Debug Information

When reporting issues, include:

1. **Browser Info**
   ```javascript
   // In console
   navigator.userAgent
   ```

2. **Extension Version**
   - Chrome: `chrome://extensions/` → Version number
   - Firefox: `about:addons` → Version number

3. **React Version**
   ```javascript
   React.version
   ```

4. **Error Logs**
   - Chrome: Extension page → Errors
   - Firefox: Browser console (Ctrl/Cmd + Shift + J)

### GitHub Issues

Report issues at: https://github.com/rejisterjack/react-perf-profiler/issues

Include:
- Issue description
- Steps to reproduce
- Expected vs actual behavior
- Browser and version
- Extension version
- React version
- Screenshot if applicable

### Development Debugging

Enable debug logging:

```typescript
// In DevTools console
window.__REACT_PERF_PROFILER_DEBUG__ = true;
```

This enables verbose logging in:
- Background service worker
- Content script
- DevTools panel
