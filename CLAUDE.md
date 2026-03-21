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
```

## Conventions

- **Svelte reactivity**: Components use Svelte 4 `$:` reactive syntax, not Svelte 5 runes. An ESLint override disables `svelte/prefer-svelte-reactivity`. Do NOT migrate to runes unless explicitly asked.
- **Server/client boundary**: Server logic in `src/lib/server/`, UI components in `src/lib/components/`. The `$lib/server` alias enforces server-only imports.
- **Georgian text**: Day code `შ` (Georgian "shin") = paid vacation. The DOCX template uses Sylfaen font for Georgian character rendering. Do not substitute Latin characters.
- **Validation errors**: Use `TimesheetValidationError` (from `timesheet.ts`) for all user-facing validation. It carries `details: string[]` for field-level errors. Endpoint handlers return 400 with JSON `{ error, details }`.
- **Dates**: ISO 8601 (`yyyy-MM-dd`) in API transit, `dd.MM.yyyy` for display labels. Use `date-fns` exclusively — no raw `Date` formatting.
- **Code style**: Single quotes, no trailing commas, 100 char print width (see `.prettierrc`). TypeScript strict mode enabled.

## Testing

- **Unit/integration**: Vitest. Coverage scope: `src/lib/server/**/*.ts` + `src/hooks.server.ts` (excludes `types.ts`). Thresholds: 80% lines/functions/statements, 70% branches.
- **E2E**: Playwright, Chromium only. Config auto-starts dev server on port 5173.
- **Test helpers**: Use `makeComputedTimesheet()` and `makeTimesheetInput()` from `tests/helpers/fixtures.ts` for test data. Use `tests/helpers/docx-assertions.ts` for DOCX content assertions. Always prefer these over inline fixtures.
- **CI**: Lint, type-check, unit tests (with coverage), e2e tests, build + smoke test all run on push/PR to main.

## Domain

- **DOCX pipeline**: Template is a ZIP of XML files. Filling: JSZip extract → xmldom parse → XPath locate cells → fill text + apply styles → repack ZIP. Entry point: `src/lib/server/docx.ts`.
- **Holidays**: Fetched from date.nager.at (primary) with yell.ge fallback (Cheerio HTML scraping). Cached 6 hours in memory. Falls back to bundled static holiday data (`src/lib/server/georgian-holidays.json`) when both providers are unreachable.
- **Output formats**: DOCX works standalone. DOC requires LibreOffice CLI (`soffice`) for conversion — detected at runtime via `GET /api/capabilities`. Frontend hides DOC option when unavailable.
- **Deployment**: adapter-node produces `build/` with `index.js` entry point. Run with `node build`. Supports `PORT`, `HOST`, `ORIGIN` env vars. Docker multi-stage build available (`Dockerfile` + `docker-compose.yml`).
