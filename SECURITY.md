# Security policy

## Supported versions

Security updates are applied to the latest release on the `main` branch.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security reports.

- Use [GitHub private vulnerability reporting](https://github.com/rejisterjack/react-perf-profiler/security/advisories/new) for this repository, or contact the maintainers through a private channel.
- Include: affected version or commit, steps to reproduce, impact assessment, and any suggested fix if you have one.

We aim to acknowledge reports within 48 hours and provide an initial assessment within 5 business days.

### Response timeline

| Stage                   | Target SLA                                  |
| ----------------------- | ------------------------------------------- |
| Acknowledgment          | Within 48 hours                             |
| Initial assessment      | Within 5 business days                      |
| Fix developed           | Within 14 days (critical), 30 days (medium) |
| Disclosure coordination | After fix is released                       |

### Supported versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | Active development |
| < 1.0   | Not supported      |

## Scope

**In scope:**

- The browser extension at `apps/ext` (Chrome/Firefox build), its service worker, content scripts, DevTools panel, and bundled packages (`@react-perf-profiler/{analyzer,cli,vscode-extension,test-plugin}`).
- The web app at `apps/web`, including its REST API (`/api/auth`, `/api/profiles`, `/api/sessions`, `/api/plugins`, `/api/health`), NextAuth config, and Prisma data layer.
- The shared `packages/profile-contract` data contract.

**Out of scope:**

- Vulnerabilities in third-party dependencies (report to the upstream maintainer).
- Self-inflicted issues from running with `NEXTAUTH_SECRET` set to a known-weak placeholder (the app refuses to boot in this case).
- Issues that require the user to disable browser security features.

## Data handling

- The extension captures React Fiber commit data from pages where the DevTools panel is open. This data lives in the page's memory and the extension's service worker; it is only sent off-device when the user explicitly configures cloud sync (Dropbox/S3/GDrive) or first-party sync (the `/api/profiles` endpoint).
- The web API stores profile data in Postgres. Public profiles (`isPublic: true`) are world-readable; private profiles are restricted to the owner.
- Passwords are hashed with bcrypt (cost 12). Auth tokens are JWTs signed with `NEXTAUTH_SECRET`.

## Disclosure

We support coordinated disclosure and will credit reporters in release notes unless they prefer otherwise.
