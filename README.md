# Timesheet Generator

SvelteKit web app that fills the provided monthly timesheet template and exports `.docx` or `.doc`.

## 1) Install

```bash
npm install
```

## 2) Prepare Template

Converts `timesheet_template.doc` into canonical `static/templates/timesheet_template.docx`.

```bash
npm run prepare:template
```

## 3) Run

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

Or use the executable launcher (starts server and opens browser automatically):

```bash
./run-timesheet-app.sh
```

## API

- `GET /api/holidays?year=YYYY`
- `POST /api/timesheet/generate`

## Testing

```bash
npm run test:unit
```

## Notes

- Holidays are fetched from `https://www.yell.ge/info/holiday.php?ht=1`.
- Entries marked state-organization-only are excluded.
- Vacation on weekend/holiday is blocked with explicit validation errors.
