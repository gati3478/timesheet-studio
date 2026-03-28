# Contributing

Thanks for your interest in contributing to Timesheet Studio! This is a small utility project, so the process is lightweight.

## Prerequisites

- [Node.js](https://nodejs.org/) v20+ (v24 LTS recommended, pinned in `.nvmrc`)
- [LibreOffice](https://www.libreoffice.org/) — required for template preparation and `.doc` export
- [Rust](https://rustup.rs/) — only needed if working on the desktop app (Tauri)

## Getting Started

The fastest way to get a working development environment:

```bash
git clone https://github.com/gati3478/timesheet-generator.git
cd timesheet-generator
npm start
```

This installs dependencies, prepares the DOCX template, starts the dev server, and opens your browser.

For step-by-step setup, see the [Manual Setup](README.md#manual-setup) section in the README.

### Verify Your Environment

```bash
npm run doctor
```

This checks Node version, dependencies, template status, LibreOffice availability, and port access.

## Before Submitting

Please run all quality checks before opening a pull request:

```bash
# Formatting & linting
npm run lint

# Type checking
npm run check

# Unit & integration tests
npm run test:unit

# End-to-end tests (Playwright auto-starts dev server on port 5173)
npm run test:e2e
```

CI runs all of the above on every push and pull request, so catching issues locally saves time.

## Guidelines

- **Open an issue first** for large or breaking changes so we can discuss the approach before you invest time in implementation.
- **Keep pull requests focused** — one feature or fix per PR makes review faster.
- **Follow existing patterns** — match the coding style, naming conventions, and project structure already in place.
- **Update documentation** if your change affects usage, API behavior, or setup steps.

## Reporting Bugs & Requesting Features

Use the [issue templates](https://github.com/gati3478/timesheet-generator/issues/new/choose) for bug reports and feature requests.

## Security

For security vulnerabilities, please see [SECURITY.md](SECURITY.md).
