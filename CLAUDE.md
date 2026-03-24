# Timesheet Studio

Georgian-format monthly timesheet generator — SvelteKit 2, Svelte 5, TypeScript. See README.md for full documentation.

## Commands

```bash
npm run dev              # Dev server (port 5173)
npm run build            # Production build (adapter-node)
npm run start:prod       # Run production build (node build)
npm run check            # Type-check with svelte-check
npm run lint             # Prettier + ESLint check
npm run format           # Auto-format all files
npm run test:unit        # Vitest unit + integration tests
npm run test:e2e         # Playwright e2e tests (needs dev server)
npm run test:all         # Unit + e2e sequentially
npm run test:coverage    # Unit tests with coverage report
npm run doctor           # Environment health check (cross-platform)
npm run clean            # Remove build artifacts (cross-platform)
npm run bundle:sidecar   # Bundle SvelteKit server + Node binary for Tauri
npm run tauri:dev        # Tauri desktop dev mode (needs `npm run dev` first)
npm run tauri:build      # Full production desktop app build
```

## Conventions

- **Svelte reactivity**: Components use Svelte 4 `$:` reactive syntax, not Svelte 5 runes. An ESLint override disables `svelte/prefer-svelte-reactivity`. Do NOT migrate to runes unless explicitly asked.
- **Server/client boundary**: Server logic in `src/lib/server/`, UI components in `src/lib/components/`. The `$lib/server` alias enforces server-only imports.
- **Georgian text**: Day code `შ` (Georgian "shin") = paid vacation. The DOCX template uses Sylfaen font for Georgian character rendering. Do not substitute Latin characters.
- **Validation errors**: Use `TimesheetValidationError` (from `timesheet.ts`) for all user-facing validation. It carries `details: string[]` for field-level errors. Endpoint handlers return 400 with JSON `{ message, details }`.
- **Dates**: ISO 8601 (`yyyy-MM-dd`) in API transit, `dd.MM.yyyy` for display labels. Use `date-fns` exclusively — no raw `Date` formatting.
- **Code style**: Single quotes, no trailing commas, 100 char print width (see `.prettierrc`). TypeScript strict mode enabled.

## Testing

- **Unit/integration**: Vitest. Coverage scope: `src/lib/server/**/*.ts` + `src/hooks.server.ts` (excludes `types.ts`). Thresholds: 90% lines/statements, 100% functions, 85% branches.
- **E2E**: Playwright, Chromium + Firefox + WebKit. Config auto-starts dev server on port 5173. Includes accessibility checks via `@axe-core/playwright`.
- **Test helpers**: Use `makeComputedTimesheet()` and `makeTimesheetInput()` from `tests/helpers/fixtures.ts` for test data. Use `tests/helpers/docx-assertions.ts` for DOCX content assertions. Always prefer these over inline fixtures.
- **CI**: Lint, type-check, and unit tests (with coverage) run in parallel; e2e tests and build gate on those passing. A security audit (`npm audit`) runs independently in parallel. All run on push/PR to main.

## Domain

- **DOCX pipeline**: Template is a ZIP of XML files. Filling: JSZip extract → xmldom parse → XPath locate cells → fill text + apply styles → repack ZIP. Entry point: `src/lib/server/docx.ts`.
- **Holidays**: Fetched from date.nager.at (primary) with yell.ge fallback (Cheerio HTML scraping). Cached 6 hours in memory. Falls back to bundled static holiday data (`src/lib/server/georgian-holidays.json`) when both providers are unreachable.
- **Output formats**: DOCX works standalone. DOC requires LibreOffice CLI (`soffice`) for conversion — detected at runtime via `GET /api/capabilities`. Frontend hides DOC option when unavailable.
- **Deployment**: adapter-node produces `build/` with `index.js` entry point. Run with `node build`. Supports `PORT`, `HOST`, `ORIGIN` env vars. Docker multi-stage build available (`Dockerfile` + `docker-compose.yml`).
- **Desktop app**: Tauri v2 wraps the SvelteKit server as a Node.js sidecar. The `src-tauri/` directory contains the Rust project. `scripts/bundle-sidecar.mjs` bundles the server + downloads the Node binary. `TEMPLATE_DIR` env var in `template.ts` allows the sidecar to specify the template location. CI builds for macOS/Windows/Linux via `.github/workflows/tauri-build.yml` (triggered by version tags or manual dispatch).
