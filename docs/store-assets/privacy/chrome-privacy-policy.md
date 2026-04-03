# Privacy Policy — React Perf Profiler

**Last updated:** April 3, 2026

This policy describes how the React Perf Profiler browser extension handles information. **By default, profiling data stays on your device.** Some features are **optional** and only send data if you turn them on and configure them.

## Who we are

React Perf Profiler is open-source software. Source code: [github.com/rejisterjack/react-perf-profiler](https://github.com/rejisterjack/react-perf-profiler).

**Canonical policy (HTML):** [index.html](./index.html) in this folder, deployed via GitHub Pages—see [docs/STORE_ASSETS.md](../STORE_ASSETS.md) for the public HTTPS URL.

## Default behavior (no optional features)

When you only record and analyze profiles in DevTools:

- **Profiling data** (component names, render timings, commit structure from the React Profiler path) is processed in extension contexts (panel, background service worker, web workers) on your machine.
- **Storage:** Preferences and session data are kept in the browser’s extension storage (`chrome.storage.local` on Chrome; equivalent APIs on Firefox).
- **We do not** operate our own analytics server, advertising SDK, or account system for the extension.
- **We do not** read passwords, credit cards, or unrelated page content for upload; the tool is aimed at **React render metadata** you generate while debugging.

## Optional features that can send data off your device

If you **choose** to enable and configure these features, data may leave your browser as described:

| Feature | What may be sent | Where |
|--------|-------------------|--------|
| **Cloud sync** (e.g. S3, Dropbox, Google Drive) | Exported profile files or payloads you upload | The cloud provider you configure (their terms apply). |
| **AI suggestions** (OpenAI, Anthropic, etc.) | Prompt text derived from your analysis (you may use privacy/anonymization options in the UI where available) + your API key in request headers | The provider’s API endpoints. |
| **Ollama (local)** | Requests to your local Ollama instance | Your machine only. |
| **Team / collaboration** (if enabled) | Session or signaling data needed for the feature | Depends on implementation (e.g. peer or relay); review in-app description when you enable it. |

**You control activation:** Nothing in this list runs without your configuration in the extension (except local analysis).

## Permissions (Chrome — Manifest V3)

The extension requests permissions reflected in `manifest.json`, including:

- **`activeTab`:** Interact with the tab you are debugging when appropriate.
- **`scripting`:** Inject the bridge script needed to connect to React’s DevTools global hook on pages you profile.
- **`host_permissions` / `<all_urls>`:** Allow the content script and bridge to run on development URLs you open (localhost, staging, production origins you choose to debug). **`all_frames`:** Support iframes where React runs.
- **Extension pages:** The DevTools panel and related UI load as extension pages under a strict content security policy.

These permissions exist **to make React profiling work on arbitrary sites you debug**, not to collect unrelated browsing history for the developer.

## Data retention and deletion

- Clear **extension data** in the browser to remove stored profiles and settings.
- **Exported files** you save to disk are your responsibility.
- **Cloud copies** follow the provider you used; delete them in that service if needed.

## Children’s privacy

The extension is intended for developers. It is not directed at children under 13.

## Changes

We may update this policy. The “Last updated” date will change; substantive changes should be reflected in the repository and, once published, on the canonical HTML page.

## Contact

- **Security:** See [SECURITY.md](https://github.com/rejisterjack/react-perf-profiler/blob/main/SECURITY.md) in the repository.
- **General questions:** Open an issue on GitHub (see repository link above).

## Open source

You may audit behavior in the public repository linked above.
