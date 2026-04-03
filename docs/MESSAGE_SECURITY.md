# Message routing and trust assumptions

This document describes how the background service worker reasons about incoming messages and what is **not** cryptographically verified (normal for Chrome extensions that use `chrome.runtime.connect`).

## Entry points

1. **Long-lived ports** (`chrome.runtime.onConnect`): Named ports from [shared constants](../src/shared/constants.ts) (`CONTENT_BACKGROUND`, `DEVTOOLS_BACKGROUND`, `POPUP_BACKGROUND`, `PANEL_BACKGROUND`). Unknown port names are rejected and disconnected.
2. **One-off messages** (`chrome.runtime.onMessage`): Used for lightweight requests (e.g. `PING`, version queries). The background script handles a small allowlisted set.

## Tab binding

- Content script ports include `sender.tab.id` when available.
- DevTools/panel ports encode the inspected tab id in the port name suffix when needed (see `getTabIdFromPort` in [background/index.ts](../src/background/index.ts)).
- **MessageRouter** rejects routing when `tabId` is not a finite non-negative integer, so malformed synthetic ids cannot drive session state.

## What we assume

- **Extension origins only**: Messages on registered ports are assumed to come from this extension’s own contexts (content script, DevTools page, popup), not from arbitrary web pages. Web pages cannot call `chrome.runtime.connect` without extension APIs.
- **No signature on payloads**: `ExtensionMessage` payloads are validated for shape (known `type` enum) but are not signed. Compromise of an extension context would be out of scope for payload signing.

## Hardening notes

- Invalid or unknown `MessageType` values are dropped early in the router.
- Sensitive expansion (stricter origin checks, per-tab capability tokens) would be a future enhancement if threat model requires it.
