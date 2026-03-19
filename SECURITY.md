# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 1.x     | Yes       |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it through [GitHub's private vulnerability reporting](https://github.com/gati3478/timesheet-generator/security/advisories/new).

Do **not** open a public issue for security vulnerabilities.

You can expect an initial response within 72 hours. We will work with you to understand and address the issue before any public disclosure.

## Security Considerations

This application is designed as a **local-use utility** with a narrow attack surface:

- **No user data storage** — The app does not persist any user data on the server. Profile information is stored in the browser's `localStorage` only.
- **No authentication** — There is no login system or user accounts.
- **`/api/system/shutdown` is intentionally unauthenticated** — This endpoint sends `SIGTERM` to the local Node process and is intended exclusively for local/trusted environments (desktop launcher mode). It should never be exposed to the public internet.
- **Template processing** — The DOCX template filling operates on a trusted, bundled template file. User input is limited to text values (names, dates, codes) inserted into XML cells.
