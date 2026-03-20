# Roadmap to 10/10

Current score: **~6.5/10** - Solid foundation, needs polish for production

---

## Phase 1 — Commit & Ship (Day 1) → **6.5 → 7.5**

- [x] Commit all uncommitted files
- [x] Fix browser adapter exports
- [x] Complete release pipeline with CWS + Firefox Add-ons
- [ ] Publish to Chrome Web Store
- [ ] Publish to Firefox Add-ons
- [ ] Create release tag v1.0.0

**Success Criteria**: Extension installable from official stores

---

## Phase 2 — Reliability (Week 1) → **7.5 → 8.5**

### E2E Tests (Playwright)
- [ ] Core flow: Start profiling → Record → Stop → View results
- [ ] Analysis flow: View wasted renders → Click component → See recommendations
- [ ] Export/Import flow: Export JSON → Clear → Import → Verify data

### Type Safety
- [ ] Fix `any` types in `src/content/types.ts`
- [ ] Fix `any` types in `src/panel/utils/memoAnalysis.ts`
- [ ] Fix `any` types in `src/content/bridge.ts`
- [ ] Enable `no-explicit-any` ESLint rule

### Error Handling
- [ ] Add React Error Boundaries to panel UI
- [ ] Handle bridge initialization failures
- [ ] Graceful degradation when React DevTools not present

### Performance
- [ ] Replace polling in `src/content/bridge.ts` with MutationObserver
- [ ] Add requestAnimationFrame batching for UI updates

**Success Criteria**: Zero TypeScript errors, E2E tests pass, no unhandled crashes

---

## Phase 3 — Performance & Polish (Week 2) → **8.5 → 9.0**

### Optimization
- [ ] Memoize `shallowEqual` results per fiber
- [ ] Move RSC analysis to Web Worker
- [ ] Move timeline generation to Web Worker
- [ ] Virtualize long component lists (>1000 items)

### UX Enhancements
- [ ] Keyboard shortcuts:
  - `Ctrl/Cmd + Shift + P` - Start/Stop profiling
  - `← →` - Navigate commits
  - `Esc` - Close detail panel
- [ ] Improved error messages with debug context
- [ ] Loading states for async operations

### Visual Polish
- [ ] Dark theme refinements
- [ ] Consistent spacing and typography
- [ ] Animation for state transitions

**Success Criteria**: 60fps UI, keyboard-navigable, polished visuals

---

## Phase 4 — Completeness (Week 3-4) → **9.0 → 9.5**

### Plugin System
- [ ] Implement `AnalysisPlugin` interface
- [ ] Plugin registration API
- [ ] Example plugin: Redux action tracking
- [ ] Plugin marketplace foundation

### CI Integration
- [ ] Performance budgets for CI
- [ ] `perf-budget.json` config file
- [ ] GitHub Action for automated perf checks
- [ ] Comment on PRs with perf regression

### Import/Export
- [ ] Drag-and-drop in ImportDialog
- [ ] Version in exported JSON (v1 schema)
- [ ] Migration path for future versions
- [ ] Cloud sync preparation (stub in .env.example)

### Documentation
- [ ] Plugin development guide
- [ ] Performance budget guide
- [ ] Migration guide for major versions

**Success Criteria**: Plugin API stable, CI integration working, extensible architecture

---

## Phase 5 — The 10/10 Final Mile → **9.5 → 10.0**

### Test Coverage
- [ ] >80% unit test coverage
- [ ] >70% integration test coverage
- [ ] All critical paths have E2E tests
- [ ] Visual regression tests

### Type Safety
- [ ] Zero `any` types
- [ ] Strict mode enabled
- [ ] Full generic inference

### Performance
- [ ] Benchmark: 10k components without jank
- [ ] Memory profiling: no leaks over 1 hour
- [ ] Bundle size under budget (panel < 150KB)

### Cloud Features
- [ ] Team sharing via cloud sync
- [ ] Profile comparison URLs
- [ ] Organization dashboards

### Community
- [ ] Product Hunt launch
- [ ] Hacker News post
- [ ] Dev.to article series
- [ ] Video tutorial series

**Success Criteria**: Industry standard tool, active community, 1000+ users

---

## Current Blockers

| Issue | Priority | Phase |
|-------|----------|-------|
| Chrome Web Store account | High | 1 |
| Firefox Add-ons account | High | 1 |
| Store listing assets | Medium | 1 |

## Metrics Dashboard

Track progress with these metrics:

```
Tests:        498 / 1000+ target
Coverage:     ?%  / 80%+ target
Any types:    23  / 0 target
Bundle size:  145KB / 150KB target
Users:        0   / 1000+ target
```

Run `pnpm run metrics` to update.

---

## Contributing

Pick an item from the current phase and open a PR!

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.
