# Permission justification (copy for store review)

Use the sections below in **Chrome Web Store** “justification” fields and **Firefox Add-ons** reviewer notes as appropriate. Adjust wording if your manifest changes.

## Broad host access (`<all_urls>`) and all frames

**Why:** React applications run on many origins during development (localhost, LAN IPs, staging, production). This extension injects a **content script** and **bridge** so the DevTools panel can read React’s profiler / DevTools hook on **whatever page the developer is actively debugging**. Without broad matches, profiling would fail on common dev setups.

**What we do not do:** We do not use this access to inject ads, mine cryptocurrency, fingerprint users for advertising, or upload page HTML to our servers. Optional cloud sync / LLM features only run when the **user configures** them.

## `activeTab` / `scripting` (Chrome MV3)

**Why:** `scripting` is required to inject the bridge script into the page context where `__REACT_DEVTOOLS_GLOBAL_HOOK__` lives. `activeTab` supports flows that scope work to the developer’s current tab where appropriate.

## `storage` / extension storage

**Why:** Persist UI settings, recorded session data, and optional feature configuration locally in the browser profile.

## DevTools panel

**Why:** The product is a **DevTools extension**; the panel is the primary UI for recording and analyzing React commits.

## Optional permissions (Firefox)

If you use `optional_permissions` (e.g. clipboard): justify each in the AMO form as “only requested when user invokes export/copy,” if that matches implementation.

## Data disclosure (pair with privacy policy)

Link reviewers to the **canonical HTTPS privacy policy**:

**https://rejisterjack.github.io/react-perf-profiler/**

(See [listing/README.md](listing/README.md) and [STORE_ASSETS.md](../STORE_ASSETS.md) if the repo or GitHub username changes.) State clearly:

- Default: local processing.
- Optional: user-configured cloud sync and cloud LLM APIs.

## Firefox: source code and minified builds

AMO reviewers may ask for correspondence between **source and built output**.

Suggested note:

> Source: tag `vX.Y.Z` at https://github.com/rejisterjack/react-perf-profiler  
> Chrome build: `pnpm install && pnpm run build` → `dist-chrome/`  
> Firefox build: `pnpm run build:firefox` → `dist-firefox/`  
> Submitted package is the zip of the matching `dist-*` directory from the release workflow.
