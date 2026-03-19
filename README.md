# Timesheet Studio

A SvelteKit web application that automates generating Georgian-format monthly timesheets. It computes worked days, vacation days, and public holidays, fills an official DOCX template via XML manipulation, and returns the completed document — ready for submission.

Built for organizations operating under Georgian labor regulations that require standardized monthly timesheet forms.

## Features

- **Interactive Calendar UI** — Visual month calendar with click-to-toggle vacation selection. Weekends and public holidays are automatically locked.
- **Georgian Holiday Integration** — Fetches official Georgian public holidays from two sources ([date.nager.at](https://date.nager.at) + [yell.ge](https://www.yell.ge)) with automatic fallback and 6-hour caching.
- **DOCX Template Engine** — Fills the official timesheet template using XPath-based XML DOM manipulation, preserving the original document formatting.
- **Dual Output Formats** — Export as modern `.docx` or legacy `.doc` (via LibreOffice CLI conversion).
- **Smart Day Codes** — Automatically assigns Georgian-standard codes: `8` (worked), `შ` (paid vacation), `X` (holiday/weekend).
- **Payroll-Ready Metrics** — Calculates first-half/second-half hour splits, total worked hours, vacation hours, and weekday holiday counts.
- **Profile Persistence** — Employee name, company code, and ID saved to localStorage across sessions.
- **Input Validation** — Prevents invalid vacation selections (weekends, holidays) with detailed error messages.
- **Responsive Design** — Fully responsive from desktop down to mobile with breakpoints at 1140px, 1024px, 760px, 640px, and 430px.
- **Accessible** — Full ARIA labels, semantic HTML, keyboard navigation for all controls.

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [LibreOffice](https://www.libreoffice.org/) (only required for `.doc` output format)

### Installation

```bash
git clone https://github.com/gati3478/timesheet-generator.git
cd timesheet-generator
npm install
```

### Prepare the Template

Converts the source `.doc` template into the `.docx` format used at runtime. Requires LibreOffice.

```bash
npm run prepare:template
```

### Run

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

#### Alternative: Shell Launcher

A standalone launcher that installs dependencies, prepares the template, starts the server, and opens the browser automatically:

```bash
./run-timesheet-app.sh
```

## How It Works

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (Svelte 5)                    │
│                                                         │
│  ┌──────────────┐  ┌────────────────────────────────┐   │
│  │ Control Panel │  │      Interactive Calendar      │   │
│  │              │  │                                │   │
│  │ • Year/Month │  │  Mon Tue Wed Thu Fri Sat Sun   │   │
│  │ • Profile    │  │   1   2   3   4   5   6   7    │   │
│  │ • Format     │  │  [8] [8] [8] [8] [8] [X] [X]  │   │
│  │ • Generate   │  │   8   9  10  11  12  13  14    │   │
│  └──────────────┘  │  [8] [შ] [8] [X] [8] [X] [X]  │   │
│                    └────────────────────────────────┘   │
│                                                         │
│  ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌────────────┐   │
│  │ Worked  │ │Vacation │ │ Holidays │ │Month Split │   │
│  │ 20 days │ │ 1 day   │ │ 2 days   │ │ 88 / 72    │   │
│  └─────────┘ └─────────┘ └──────────┘ └────────────┘   │
└──────────────────────────┬──────────────────────────────┘
                           │ POST /api/timesheet/generate
                           ▼
┌─────────────────────────────────────────────────────────┐
│                  SvelteKit Server                        │
│                                                         │
│  1. Validate request (dates, profile fields)             │
│  2. Fetch holidays (cached, dual-source fallback)        │
│  3. Compute day codes for each day of the month          │
│  4. Load DOCX template → extract XML via JSZip           │
│  5. Fill cells using XPath DOM manipulation              │
│  6. Set Sylfaen font for Georgian text rendering         │
│  7. Apply gray shading to holiday/weekend cells          │
│  8. Repack ZIP → return binary download                  │
│  9. (Optional) Convert to .doc via LibreOffice CLI       │
└─────────────────────────────────────────────────────────┘
```

### Day Code System

| Code      | Meaning                                    | Hours | Cell Style     |
| --------- | ------------------------------------------ | ----- | -------------- |
| `8`       | Worked day                                 | 8h    | Default        |
| `შ`       | Paid vacation (Georgian letter)            | 8h    | Blue highlight |
| `X`       | Holiday or weekend                         | 0h    | Gray shading   |
| _(empty)_ | Day beyond month end (e.g., day 30 in Feb) | —     | —              |

## API Reference

### `GET /api/holidays?year={yyyy}`

Returns Georgian public holidays for a given year. Results are cached for 6 hours.

**Response:**

```json
{
  "entries": [
    { "date": "2026-01-01", "title": "New Year's Day", "isStateOnly": false },
    { "date": "2026-01-07", "title": "Christmas Day", "isStateOnly": false }
  ]
}
```

### `POST /api/timesheet/generate`

Generates a filled timesheet document from the template.

**Request:**

```json
{
  "year": 2026,
  "month": 1,
  "companyCode": "405627530",
  "employeeName": "გიორგი პეტრიაშვილი, უფროსი დეველოპერი",
  "employeeId": "01005031116",
  "vacationDates": ["2026-01-15"],
  "outputFormat": "docx"
}
```

**Response:** Binary file download with `Content-Disposition` header.

| Field           | Type              | Validation                                   |
| --------------- | ----------------- | -------------------------------------------- |
| `year`          | `number`          | Required                                     |
| `month`         | `number`          | 1–12                                         |
| `companyCode`   | `string`          | 6–12 digits                                  |
| `employeeName`  | `string`          | Non-empty, must contain text                 |
| `employeeId`    | `string`          | Exactly 11 digits                            |
| `vacationDates` | `string[]`        | ISO dates, must be weekdays and non-holidays |
| `outputFormat`  | `"docx" \| "doc"` | `doc` requires LibreOffice                   |

### `POST /api/system/shutdown`

Gracefully shuts down the local server (for desktop app mode). No authentication — intended only for local/trusted environments.

## Project Structure

```
src/
├── app.html                              # SvelteKit HTML entry point
├── app.css                               # Global styles & design tokens
├── app.d.ts                              # Ambient TypeScript declarations
├── routes/
│   ├── +page.svelte                      # Main UI (calendar, controls, profile)
│   ├── +layout.svelte                    # Root layout
│   └── api/
│       ├── holidays/+server.ts           # Holiday fetching endpoint
│       ├── timesheet/generate/+server.ts # Document generation endpoint
│       └── system/shutdown/+server.ts    # Local server shutdown
└── lib/server/
    ├── types.ts                          # Shared TypeScript types
    ├── timesheet.ts                      # Day-code computation logic
    ├── docx.ts                           # DOCX XML template filling
    ├── doc-conversion.ts                 # DOCX → DOC via LibreOffice
    ├── holidays.ts                       # Holiday fetching & caching
    ├── filename.ts                       # Output filename generation
    └── template.ts                       # Template buffer loader

scripts/
└── prepare-template.mjs                  # .doc → .docx template conversion

static/
└── templates/
    └── timesheet_template.docx           # Compiled DOCX template

tests/
├── unit/
│   ├── timesheet.test.ts                 # Day code computation tests
│   ├── holidays.test.ts                  # Holiday parsing tests
│   └── filename.test.ts                  # Filename generation tests
└── integration/
    ├── docx-fill.test.ts                 # Template filling tests
    └── real-template.test.ts             # Full template scenarios
```

## Tech Stack

| Layer               | Technology                                                                                                                              |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Framework           | [SvelteKit 2](https://kit.svelte.dev/) + [Svelte 5](https://svelte.dev/)                                                                |
| Language            | [TypeScript](https://www.typescriptlang.org/)                                                                                           |
| Build               | [Vite 6](https://vitejs.dev/)                                                                                                           |
| Document Processing | [JSZip](https://stuk.github.io/jszip/) · [@xmldom/xmldom](https://github.com/xmldom/xmldom) · [xpath](https://github.com/goto100/xpath) |
| Date Handling       | [date-fns](https://date-fns.org/)                                                                                                       |
| HTML Parsing        | [Cheerio](https://cheerio.js.org/) (holiday fallback source)                                                                            |
| Testing             | [Vitest](https://vitest.dev/) (unit/integration) · [Playwright](https://playwright.dev/) (e2e)                                          |

## Development

```bash
npm run dev              # Start dev server (port 5173)
npm run build            # Production build
npm run preview          # Preview production build
npm run check            # Type-check with svelte-check
npm run test:unit        # Run unit & integration tests
npm run prepare:template # Convert .doc → .docx template
```

## License

[MIT](LICENSE)
