# Host permissions spike: `<all_urls>` vs narrow / active-tab-style access

This document prototypes the **tradeoffs** for reducing broad host access. The shipping Chrome manifest today uses `host_permissions: ["<all_urls>"]` and content scripts on `<all_urls>` with `all_frames: true` ([src/manifest.json](../src/manifest.json)).

## Why `<all_urls>` exists

- Developers profile React apps on **localhost**, **LAN IPs**, **staging**, and **production** origins.
- The content script must attach early (`document_start`) so the bridge can observe `__REACT_DEVTOOLS_GLOBAL_HOOK__` on the **exact origin** of the tab under inspection.
- **iframes:** `all_frames: true` allows hooks inside embedded frames when React runs there.

## Narrow-mode idea (spike)

**Goal:** Offer an optional build or manifest variant for users or enterprises that refuse blanket host access.

**Approach A — explicit origin list**

- Replace `<all_urls>` with a fixed list, e.g. `http://localhost/*`, `http://127.0.0.1/*`, and your company’s staging hosts.
- **Pros:** Smallest permission surface; easy to explain to security review.
- **Cons:** Breaks profiling on any origin not listed; frequent manifest updates.

**Approach B — optional / on-demand host permissions (Chrome MV3)**

- Ship with **no** static `host_permissions` for arbitrary sites; use `optional_permissions` or runtime `permissions.request` for specific origins when the user starts a session.
- **Pros:** User-granted, least privilege per origin session.
- **Cons:** More UX friction; must teach users to approve each origin; iframe coverage still needs explicit grants.

**Approach C — activeTab + `scripting.executeScript` only**

- Avoid persistent content scripts on all tabs; inject only when the user invokes the extension or DevTools focuses the inspected page.
- **Pros:** Aligns with “current tab” mental model.
- **Cons:** Must ensure injection timing still sees the DevTools hook; may miss very early lifecycle unless carefully ordered; more engineering risk than status quo.

## Recommendation

- Keep **default** builds on `<all_urls>` for developer ergonomics and iframe coverage.
- For **enterprise / store narrative**, document this spike and ship a **maintainer-only** narrow manifest recipe (origin list or optional permissions) once validated — see near-term item in [ROADMAP.md](../ROADMAP.md).

## Store copy

Use [docs/store-assets/PERMISSION_JUSTIFICATION.md](store-assets/PERMISSION_JUSTIFICATION.md) for reviewer-facing justification of broad access.
