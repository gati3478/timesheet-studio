# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-05-15

### Added

- Interactive calendar UI with click-to-toggle vacation selection
- Georgian public holiday integration with dual-source fetching and 6-hour caching
- DOCX template engine using XPath-based XML DOM manipulation
- Dual output formats: `.docx` (modern) and `.doc` (legacy, via LibreOffice)
- Smart day-code assignment: `8` (worked), `შ` (paid vacation), `X` (holiday/weekend)
- Payroll-ready metrics: first-half/second-half hour splits, totals, weekday holiday counts
- Profile persistence via browser localStorage
- Input validation with detailed error messages
- Responsive design with breakpoints at 1140px, 1024px, 760px, 640px, and 430px
- Full ARIA labels, semantic HTML, and keyboard navigation
- Desktop app via Tauri v2 — native macOS, Windows, and Linux binaries
- Sidecar bundler script (`scripts/bundle-sidecar.mjs`) — esbuild bundles the SvelteKit server + Node.js binary into a Tauri-managed sidecar
- `TEMPLATE_DIR` env var support in `template.ts` for sidecar resource path resolution
- `npm run tauri:build` — single command to build the desktop app
- `npm run tauri:dev` — Tauri development mode with hot-reload
- `npm start` launcher: auto-installs deps, prepares template, opens browser
- `npm run doctor` environment health check
- Cross-browser e2e testing — Firefox and WebKit alongside Chromium
- Accessibility testing via `@axe-core/playwright` — WCAG 2.1 AA checks, form labels, heading hierarchy, color contrast
- CI pipeline: lint, type check, unit tests, e2e tests, build
- Cross-platform CI workflow for desktop builds (`.github/workflows/tauri-build.yml`)
- CI job dependency graph — e2e and build gate on lint, type-check, and unit tests passing
- `npm audit` security audit job in CI pipeline
- Dependabot for npm and GitHub Actions dependency updates

### Changed

- Standardized the runtime on Node.js 24 LTS across `engines.node`, `.nvmrc`, the Dockerfile, and the Tauri sidecar binary (`SIDECAR_NODE_VERSION` 22.16.0 → 24.15.0)
- Bumped dependency floors: `@tauri-apps/*` 2.11, `@playwright/test` 1.60, `@sveltejs/adapter-node` 5.5, `date-fns` 4.1, `@types/node` 24
- Pinned `cookie` to `^0.7.0` via `overrides` to close GHSA-pxg6-pf52-xh8x (transitive via SvelteKit)

[Unreleased]: https://github.com/gati3478/timesheet-studio/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/gati3478/timesheet-studio/releases/tag/v1.0.0
