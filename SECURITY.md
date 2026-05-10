# Security policy

## Supported versions

Security updates are applied to the latest release on the `main` branch. Older tags may not receive backports unless explicitly noted in release notes.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security reports.

- **Preferred:** Use [GitHub private vulnerability reporting](https://github.com/rejisterjack/react-perf-profiler/security/advisories/new) for this repository (if enabled for the repo), or contact the maintainers through a private channel you already use with them.
- Include: affected version or commit, steps to reproduce, impact assessment, and any suggested fix if you have one.

We aim to acknowledge reports within 48 hours and provide an initial assessment within 5 business days. This project is maintained in good faith; timelines depend on maintainer availability.

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

In scope for security discussion:

- This browser extension (Chrome/Firefox builds), its service worker, content scripts, DevTools panel, and bundled CLI (`perf-check`).
- Handling of profiling data, cloud sync, collaboration, and optional LLM features **as implemented in this repository**.

Out of scope:

- Vulnerabilities in websites you profile with the extension (the extension runs in privileged extension contexts but interacts with arbitrary pages you choose to debug).
- Third-party services (OpenAI, Anthropic, AWS, Google, Dropbox, etc.) except where this repo’s integration clearly mishandles credentials or data.

## Safe harbor

If you make a good-faith effort to follow this policy and avoid privacy violations, destruction of data, or service disruption, we will not pursue legal action for research activities related to this project.

## Extension threat model (summary)

See [docs/MESSAGE_SECURITY.md](docs/MESSAGE_SECURITY.md) for how messages are validated and what is assumed about `chrome.runtime` ports and tab IDs.

## Data and storage

- **Profiling data** is processed locally in the extension unless you explicitly use export, cloud sync, or collaboration features.
- **LLM API keys** are stored in `chrome.storage.local` (extension storage). This is **not** the same as OS-level keychain encryption. Prefer **Ollama (local)** if you want keys to never leave your machine.
