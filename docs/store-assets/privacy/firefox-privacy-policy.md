# Privacy Policy — React Perf Profiler (Firefox)

**Last updated:** April 3, 2026

This policy describes how the React Perf Profiler **Firefox** add-on handles information. **By default, profiling data stays on your device.** Some features are **optional** and only send data if you turn them on and configure them.

## Who we are

Open-source project: [github.com/rejisterjack/react-perf-profiler](https://github.com/rejisterjack/react-perf-profiler).

**Canonical policy (HTML):** Use the same published URL as Chrome, documented in [docs/STORE_ASSETS.md](../STORE_ASSETS.md).

## Default behavior

When you only record and analyze in Firefox DevTools:

- Profiling data is processed in extension contexts on your machine.
- Settings and data are stored with **Firefox extension storage APIs** (e.g. `browser.storage.local` where used).
- There is **no** developer-operated telemetry server bundled as part of the default experience.

## Optional features that can send data off your device

Same categories as the Chrome build:

- **Cloud sync** to providers you configure (S3, Dropbox, Google Drive, etc.) uploads **only what you choose** to sync.
- **Cloud LLM providers** receive prompts and API traffic **only if** you add keys and use those features; **Ollama** stays local.
- **Collaboration** may use network features when explicitly enabled.

## Permissions (Firefox)

The add-on uses permissions declared in `manifest-firefox.json`, including broad host access so the bridge can attach on **whatever origins you debug** (similar rationale to Chrome). Permissions are used for **React profiling**, not for unrelated data collection.

## Retention, children, changes, contact

Same principles as the Chrome policy in [chrome-privacy-policy.md](./chrome-privacy-policy.md) (clear add-on data in Firefox; no targeting of children; policy updates tracked by date; GitHub / SECURITY.md for reports).

## Source code

Available at the GitHub repository linked above.
