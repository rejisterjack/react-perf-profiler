# Security policy

## Supported versions

Security updates are applied to the latest release on the `main` branch.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security reports.

- Use [GitHub private vulnerability reporting](https://github.com/rejisterjack/react-perf-profiler/security/advisories/new) for this repository, or contact the maintainers through a private channel.
- Include: affected version or commit, steps to reproduce, impact assessment, and any suggested fix if you have one.

We aim to acknowledge reports within 48 hours and provide an initial assessment within 5 business days.

### Response Timeline

| Stage | Target SLA |
|-------|-----------|
| Acknowledgment | Within 48 hours |
| Initial assessment | Within 5 business days |
| Fix developed | Within 14 days (critical), 30 days (medium) |
| Disclosure coordination | After fix is released |

### Supported Versions

| Version | Supported |
|---------|-----------|
| 1.0.x   | Active development |
| < 1.0   | Not supported |

## Scope

In scope:

- This browser extension (Chrome build), its service worker, content scripts, DevTools panel.
- Handling of profiling data, cloud sync, and optional LLM features as implemented in this repository.

Out of scope:

- Vulnerabilities in websites you profile with the extension.
- Third-party services (OpenAI, Anthropic, AWS, Google, Dropbox, etc.) except where this repo's integration clearly mishandles credentials or data.

## Data and storage

- **Profiling data** is processed locally in the extension unless you explicitly use export or cloud sync features.
- **LLM API keys** are stored in `chrome.storage.local` (extension storage). Prefer **Ollama (local)** if you want keys to never leave your machine.
