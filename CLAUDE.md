# Timesheet Generator

A SvelteKit web application that automates generating Georgian-format monthly timesheets. It computes worked/vacation/holiday days, fills a DOCX template via XML manipulation, and returns the completed document.

## Tech Stack

- **Framework**: SvelteKit 2 + Svelte 5
- **Language**: TypeScript
- **Build Tool**: Vite 6
- **Code Quality**: ESLint + Prettier
- **Testing**: Vitest (unit) + Playwright (e2e)
- **Document Processing**: jszip, @xmldom/xmldom, xpath, cheerio
- **Date Handling**: date-fns

## Project Structure

```
src/
  app.html                          # Root HTML template (SvelteKit entry point)
  app.d.ts                          # Global TypeScript ambient declarations
  app.css                           # Global stylesheet
  routes/
    +page.svelte                    # Main UI (calendar, controls, profile editor)
    +layout.svelte                  # Root layout
    api/
      holidays/+server.ts           # GET /api/holidays?year=
      timesheet/generate/+server.ts # POST /api/timesheet/generate
      system/shutdown/+server.ts    # POST /api/system/shutdown
  lib/server/
    types.ts                        # Shared TypeScript types
    timesheet.ts                    # Day-code computation logic
    docx.ts                         # DOCX XML template filling
    doc-conversion.ts               # DOCX → DOC conversion
    holidays.ts                     # Holiday fetching & caching
    filename.ts                     # Output filename generation
    template.ts                     # Template buffer loader
scripts/
  start.mjs                        # Unified launcher (npm start)
  prepare-template.mjs             # Converts .doc template to .docx
  doctor.sh                        # Environment health check
static/                            # Static assets & DOCX template
tests/                             # Unit and integration tests
```

## Common Commands

```bash
npm start                # Launch app (install deps, prep template, open browser)
npm run dev              # Start dev server (port 5173)
npm run build            # Build production bundle
npm run preview          # Preview production build
npm run check            # Type-check with svelte-check
npm run lint             # Run prettier + eslint
npm run format           # Auto-format all files
npm run test:unit        # Run Vitest unit tests (unit + integration)
npm run prepare:template # Convert .doc template to .docx
npm run doctor           # Check environment health
npm run clean            # Remove build artifacts
```

## API Endpoints

### `GET /api/holidays?year={yyyy}`

Returns Georgian public holidays for a given year (cached 6h).

### `POST /api/timesheet/generate`

Accepts a JSON body and returns the filled document as a binary file download.

**Request body:**

```json
{
  "year": 2026,
  "month": 1,
  "companyCode": "string",
  "employeeName": "string",
  "employeeId": "string",
  "vacationDates": ["2026-01-15"],
  "outputFormat": "docx" | "doc"
}
```

**Response:** Binary file with `Content-Disposition: attachment; filename="{name-slug}-{mon}-{year}-timesheet.{ext}"`.
MIME type is `application/vnd.openxmlformats-officedocument.wordprocessingml.document` for DOCX or `application/msword` for DOC.

### `POST /api/system/shutdown`

Shuts down the local Node process via `SIGTERM` (for desktop app mode). Only available in dev mode (`NODE_ENV=development`); returns 404 in production.

## Key Concepts

- **Day Codes**: `8` = worked day, `შ` (Georgian letter) = paid vacation, `X` = holiday/weekend
- **Template**: A `.docx` file with XML cells that get filled via XPath-based DOM manipulation
- **Holidays**: Fetched from date.nager.at (primary) and yell.ge (fallback), cached 6 hours
- **Output formats**: DOCX (modern) or DOC (legacy, via LibreOffice conversion)
