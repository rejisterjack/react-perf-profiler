# Release Checklist

A comprehensive checklist for releasing React Perf Profiler updates.

For the short operator path (tag, release assets, store upload only), use [Store release](./STORE_RELEASE.md) instead.

## Table of Contents

- [Pre-Release Testing](#pre-release-testing)
- [Version Bumping](#version-bumping)
- [Changelog Updates](#changelog-updates)
- [Build Verification](#build-verification)
- [Store Submission](#store-submission)
- [Post-Release Monitoring](#post-release-monitoring)

---

## Pre-Release Testing

### Automated Tests

```bash
# Run all test suites
pnpm test

# Run with coverage
pnpm test:coverage

# Run E2E tests
pnpm test:e2e

# Type checking
pnpm typecheck

# Linting
pnpm lint

# Format checking
pnpm format:check
```

**Required Checks:**
- [ ] Unit tests pass (300+ tests)
- [ ] Coverage meets thresholds (70%+ lines, 60%+ branches)
- [ ] E2E tests pass on Chrome (`pnpm run build && pnpm exec playwright install --with-deps chromium && pnpm run test:e2e`)
- [ ] Firefox build succeeds (`pnpm run build:firefox`); run E2E against Firefox when Playwright config supports it
- [ ] TypeScript compiles without errors
- [ ] Biome linting passes (`pnpm run lint` — zero errors; warnings documented in [CONTRIBUTING.md](../CONTRIBUTING.md))
- [ ] No console errors in test output
- [ ] Privacy policy HTML deployed or ready ([docs/STORE_ASSETS.md](./STORE_ASSETS.md))

### Manual Testing

#### Chrome Testing
- [ ] Extension loads in `chrome://extensions/`
- [ ] DevTools panel appears as "⚡ Perf Profiler"
- [ ] Records profiling data correctly
- [ ] Flamegraph renders and is interactive
- [ ] Component tree shows wasted renders
- [ ] Memo analysis works
- [ ] RSC analysis works (if applicable)
- [ ] Export/import functions work
- [ ] Settings persist across reloads
- [ ] Keyboard shortcuts work
- [ ] No console errors

#### Firefox Testing
- [ ] Extension loads in `about:debugging`
- [ ] DevTools panel appears correctly
- [ ] All core features work as in Chrome
- [ ] No Firefox-specific errors

#### Test Scenarios

Test with different React applications:
- [ ] Simple React app (Create React App)
- [ ] Next.js app (Pages Router)
- [ ] Next.js app (App Router with RSC)
- [ ] Large production app (1000+ components)
- [ ] App with heavy memoization
- [ ] App with context providers

Test edge cases:
- [ ] Empty profile (no commits)
- [ ] Single commit
- [ ] 500+ commits (max limit)
- [ ] Deep component tree (50+ levels)
- [ ] Rapid start/stop recording
- [ ] Import corrupted/invalid JSON
- [ ] Network disconnection during profiling

### Performance Testing

```bash
# Run performance benchmarks
pnpm benchmark

# Check bundle sizes
pnpm perf:check:bundles
```

- [ ] Bundle size under budget (1MB total)
- [ ] Analysis completes in < 2s for 100 commits
- [ ] UI remains responsive with 500 commits
- [ ] Memory usage stays under 100MB
- [ ] Timeline scrolls at 60fps

### Cross-Platform Testing

- [ ] macOS Chrome
- [ ] macOS Firefox
- [ ] Windows Chrome
- [ ] Windows Firefox
- [ ] Linux Chrome
- [ ] Linux Firefox

---

## Version Bumping

### Semantic Versioning

React Perf Profiler follows [SemVer](https://semver.org/):

- **MAJOR** - Breaking changes to API or behavior
- **MINOR** - New features, backwards compatible
- **PATCH** - Bug fixes, backwards compatible

### Version Update Checklist

1. **Determine version bump:**
   - [ ] Review changes since last release
   - [ ] Identify breaking changes
   - [ ] Decide on MAJOR.MINOR.PATCH

2. **Update package.json:**
   ```bash
   # Using npm version
   npm version patch   # 1.0.0 -> 1.0.1
   npm version minor   # 1.0.0 -> 1.1.0
   npm version major   # 1.0.0 -> 2.0.0
   
   # Or manually edit package.json
   ```

3. **Update version in files:**
   - [ ] `package.json`
   - [ ] `package-lock.json` (if applicable)
   - [ ] `pnpm-lock.yaml` (if updated)
   - [ ] `src/manifest.json` - update `version`
   - [ ] `src/manifest-firefox.json` - update `version`

4. **Update version constants:**
   ```typescript
   // src/shared/constants.ts
   export const EXTENSION_VERSION = '1.1.0';
   ```

5. **Tag the release:**
   ```bash
   git add .
   git commit -m "chore(release): prepare v1.1.0"
   git tag -a v1.1.0 -m "Release v1.1.0"
   git push origin main --tags
   ```

---

## Changelog Updates

### Changelog Format

Follow [Keep a Changelog](https://keepachangelog.com/):

```markdown
## [1.1.0] - 2024-03-22

### Added
- New feature description
- Another new feature

### Changed
- Behavior change description

### Deprecated
- Feature marked for removal

### Removed
- Deleted feature

### Fixed
- Bug fix description

### Security
- Security fix description
```

### Changelog Update Steps

1. **Update CHANGELOG.md:**
   - [ ] Move `[Unreleased]` changes to new version section
   - [ ] Add release date (ISO format: YYYY-MM-DD)
   - [ ] Add comparison link at bottom
   - [ ] Create new empty `[Unreleased]` section

2. **Categorize changes:**
   - [ ] Review all commits since last release
   - [ ] Categorize into Added/Changed/Fixed/etc.
   - [ ] Write clear, user-focused descriptions
   - [ ] Link to related issues/PRs

3. **Example entry:**
   ```markdown
   ### Added
   - RSC payload size analysis for Next.js App Router ([#123](https://github.com/.../123))
   - Plugin API for custom metrics ([#124](https://github.com/.../124))
   
   ### Fixed
   - Memory leak when clearing large profiles ([#125](https://github.com/.../125))
   ```

4. **Update GitHub Releases:**
   - [ ] Copy changelog to GitHub release notes
   - [ ] Add binaries/assets
   - [ ] Mark as pre-release if applicable

---

## Build Verification

### Clean Build

```bash
# Clean previous builds
rm -rf dist-chrome dist-firefox

# Install fresh dependencies
rm -rf node_modules
pnpm install

# Build for Chrome
pnpm build

# Build for Firefox
pnpm build:firefox
```

### Build Output Verification

#### Chrome Build
- [ ] `dist-chrome/` directory exists
- [ ] `manifest.json` present and valid
- [ ] All JS files minified
- [ ] Source maps generated (optional for release)
- [ ] Icons present in all sizes
- [ ] HTML files present
- [ ] CSS bundled correctly

#### Firefox Build
- [ ] `dist-firefox/` directory exists
- [ ] `manifest.json` present (V2 format)
- [ ] All required files present

### Bundle Analysis

```bash
# Analyze bundle sizes
pnpm analyze
```

- [ ] Total size under 1MB
- [ ] No unexpected large dependencies
- [ ] Code split appropriately
- [ ] No duplicate dependencies

### Security Scan

```bash
# Audit dependencies
pnpm audit

# Check for known vulnerabilities
npm audit --audit-level moderate
```

- [ ] No critical vulnerabilities
- [ ] No high vulnerabilities
- [ ] Moderate vulnerabilities reviewed

---

## Store Submission

### Chrome Web Store

#### Prepare Submission Package

```bash
# Create submission ZIP
cd dist-chrome
zip -r ../react-perf-profiler-v1.1.0-chrome.zip .
cd ..
```

#### Upload Steps

1. Go to [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
2. Select React Perf Profiler
3. Click "Package" → "Upload new package"
4. Upload `react-perf-profiler-v1.1.0-chrome.zip`
5. Update store listing if needed:
   - [ ] Screenshots (1-5 images)
   - [ ] Description
   - [ ] Privacy policy
6. Submit for review

#### Review Checklist
- [ ] Extension installs without errors
- [ ] All permissions are justified
- [ ] No remote code execution
- [ ] Privacy policy is accurate
- [ ] Store listing follows guidelines

### Firefox Add-ons

#### Prepare Submission Package

```bash
# Create XPI (or ZIP)
cd dist-firefox
zip -r ../react-perf-profiler-v1.1.0-firefox.xpi .
cd ..
```

#### Upload Steps

1. Go to [Firefox Add-on Developer Hub](https://addons.mozilla.org/developers/)
2. Select React Perf Profiler
3. Click "Upload New Version"
4. Upload `react-perf-profiler-v1.1.0-firefox.xpi`
5. Update listing if needed
6. Submit for review

### GitHub Release

#### Create Release

```bash
# Create release notes
gh release create v1.1.0 \
  --title "React Perf Profiler v1.1.0" \
  --notes-file CHANGELOG-section.md \
  dist-chrome/react-perf-profiler-v1.1.0-chrome.zip \
  dist-firefox/react-perf-profiler-v1.1.0-firefox.xpi
```

#### Release Assets
- [ ] Chrome extension ZIP
- [ ] Firefox extension XPI/ZIP
- [ ] Source code (tar.gz)
- [ ] Source code (zip)
- [ ] Checksums (SHA256)

---

## Post-Release Monitoring

### Immediate Verification (0-24 hours)

- [ ] GitHub release page is public
- [ ] Chrome Web Store shows new version
- [ ] Firefox Add-ons shows new version
- [ ] Download links work
- [ ] No immediate bug reports

### Short-term Monitoring (1-7 days)

- [ ] Review Chrome Web Store reviews
- [ ] Review Firefox Add-ons reviews
- [ ] Monitor GitHub issues
- [ ] Check error telemetry (if enabled)
- [ ] Respond to user feedback

#### Metrics to Track

```
Chrome Web Store:
- [ ] Weekly users
- [ ] Rating average
- [ ] New reviews
- [ ] Uninstall rate

Firefox Add-ons:
- [ ] Daily users
- [ ] Rating average
- [ ] New reviews

GitHub:
- [ ] New issues
- [ ] Issue close rate
- [ ] Star count
- [ ] Fork count
```

### Long-term Monitoring (Ongoing)

- [ ] Track adoption rate
- [ ] Monitor for browser compatibility issues
- [ ] Watch for React version compatibility
- [ ] Collect feature requests
- [ ] Plan next release

### Communication

- [ ] Announce on social media (Twitter/X, LinkedIn)
- [ ] Post to relevant communities (Reddit r/reactjs, Discord)
- [ ] Update documentation site
- [ ] Send newsletter (if applicable)

---

## Hotfix Release Process

For urgent bug fixes:

```bash
# 1. Create hotfix branch from latest tag
git checkout -b hotfix/v1.1.1 v1.1.0

# 2. Apply fix
# ... edit files ...

# 3. Update version
npm version patch

# 4. Update changelog
# ... edit CHANGELOG.md ...

# 5. Build and test
pnpm build:all
pnpm test

# 6. Tag and push
git push origin hotfix/v1.1.1
git tag -a v1.1.1 -m "Hotfix v1.1.1"
git push origin v1.1.1

# 7. Merge to main
git checkout main
git merge hotfix/v1.1.1
git push origin main

# 8. Submit to stores (expedited review)
```

---

## Release Templates

### GitHub Release Notes Template

```markdown
## React Perf Profiler v1.1.0

### 🚀 New Features
- Feature 1 description
- Feature 2 description

### 🐛 Bug Fixes
- Fix 1 description
- Fix 2 description

### 📦 Assets
| File | SHA256 |
|------|--------|
| react-perf-profiler-v1.1.0-chrome.zip | `abc123...` |
| react-perf-profiler-v1.1.0-firefox.xpi | `def456...` |

### 📋 Installation
**Chrome:**
1. Download `react-perf-profiler-v1.1.0-chrome.zip`
2. Open `chrome://extensions/`
3. Enable Developer Mode
4. Drag and drop the ZIP file

**Firefox:**
1. Download `react-perf-profiler-v1.1.0-firefox.xpi`
2. Open `about:addons`
3. Click gear icon → "Install Add-on From File"

### 🙏 Contributors
Thanks to @contributor1, @contributor2 for their contributions!

Full Changelog: https://github.com/rejisterjack/react-perf-profiler/compare/v1.0.0...v1.1.0
```

---

## Quick Reference

| Task | Command |
|------|---------|
| Run tests | `pnpm test` |
| Build all | `pnpm build:all` |
| Version bump | `npm version [patch/minor/major]` |
| Create tag | `git tag -a v1.0.0 -m "Release v1.0.0"` |
| Push tags | `git push origin --tags` |
| Create release ZIP | `cd dist-chrome && zip -r ../release.zip .` |

---

For questions about the release process, contact:
- GitHub: [@rejisterjack](https://github.com/rejisterjack)
- Email: [maintainer@example.com]
