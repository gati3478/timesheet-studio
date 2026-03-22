---
name: ui-audit
description: >-
  Full UI audit pipeline for Timesheet Studio — captures screenshots across all viewports
  and component states, then analyzes each state group for design quality, responsiveness,
  and accessibility issues. Use when the user says "audit the UI", "run a UI audit",
  "review the interface", "screenshot all states", or wants a comprehensive design review.
user-invocable: true
---

# UI Audit Pipeline — Timesheet Studio

You are orchestrating a full UI audit for Timesheet Studio, a single-page SvelteKit app with 5 components and multiple interactive states. This pipeline captures screenshots of every component state across 3 viewports, then analyzes each state group to produce actionable findings.

## Architecture

```
/ui-audit
  ├── Step 1: Ensure dev server is running
  ├── Step 2: Capture screenshots (scripts/capture-ui-docs.mjs)
  ├── Step 3: Read INDEX.md to understand what was captured
  ├── Step 4: Analyze each state group (read screenshots + source code)
  └── Step 5: Summary report with findings
```

## App Overview

Timesheet Studio is a **single-page app** (`src/routes/+page.svelte`) with these components:

| Component          | File                                         | Purpose                                        |
| ------------------ | -------------------------------------------- | ---------------------------------------------- |
| `TitleBar`         | `src/lib/components/TitleBar.svelte`         | Tauri desktop title bar (only in desktop mode) |
| `MonthPicker`      | `src/lib/components/MonthPicker.svelte`      | Month/year navigation with month grid          |
| `VacationCalendar` | `src/lib/components/VacationCalendar.svelte` | 7-column calendar grid with day state cells    |
| `ProfileEditor`    | `src/lib/components/ProfileEditor.svelte`    | Document fields form with view/edit modes      |
| `SummaryMetrics`   | `src/lib/components/SummaryMetrics.svelte`   | 4-column responsive metric card grid           |

**Responsive breakpoints:** 1140px, 1024px, 760px, 640px, 430px

## Arguments

Parse the user's invocation for these optional flags:

| Flag                 | Effect                                                                   | Default         |
| -------------------- | ------------------------------------------------------------------------ | --------------- |
| `--state <name>`     | Audit only one state group (see State Groups below)                      | All states      |
| `--skip-capture`     | Use existing screenshots in `./screenshots/ui-docs/` without recapturing | Capture fresh   |
| `--viewport <name>`  | Capture only one viewport: `desktop`, `tablet`, or `mobile`              | All 3 viewports |
| `--component <name>` | Focus analysis on a specific component                                   | All components  |

## Step 1: Ensure Dev Server

Before capturing, verify the dev server is running:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/
```

If it returns anything other than 200/302/304:

1. Start the dev server in the background: `npm run dev`
2. Wait for it to be ready (poll with curl, max 30 seconds)
3. Note that you started it so you can stop it when done

**Important:** Do NOT kill any existing process on port 5173 — it may be the user's running dev server.

## Step 2: Capture Screenshots

If `--skip-capture` was NOT specified, run the capture script:

```bash
node scripts/capture-ui-docs.mjs [options]
```

Map flags through:

- `--state <name>` → `--state <name>`
- `--viewport <name>` → `--viewport <name>`

The script outputs to `./screenshots/ui-docs/` with this structure:

```
screenshots/ui-docs/
  A-default/
    default_desktop.png
    default_tablet.png
    default_mobile.png
  B-vacation-selected/
    vacation-selected_desktop.png
    vacation-selected_tablet.png
    vacation-selected_mobile.png
  C-profile-editing/
    profile-editing_desktop.png
    profile-editing_tablet.png
    profile-editing_mobile.png
  D-profile-validation-error/
    profile-validation-error_desktop.png
    profile-validation-error_tablet.png
    profile-validation-error_mobile.png
  E-generation-error/
    generation-error_desktop.png
    generation-error_tablet.png
    generation-error_mobile.png
  F-holiday-loading/
    holiday-loading_desktop.png
    holiday-loading_tablet.png
    holiday-loading_mobile.png
  INDEX.md
```

Each screenshot is named `{state}_{viewport}.png` where viewport is `desktop` (1280×800), `tablet` (768×1024), or `mobile` (375×812).

**If `--skip-capture` was specified**, verify that `./screenshots/ui-docs/INDEX.md` exists. If it doesn't, inform the user that no existing screenshots were found and ask whether to capture fresh ones.

## Step 3: Read the Index

Read `./screenshots/ui-docs/INDEX.md` to understand what was captured. This file contains a table of all screenshots organized by state and viewport.

## Step 4: Analyze Each State Group

### State Groups

#### A: Default State

**What it shows:** Fresh page load — hero section, empty MonthPicker at current month, VacationCalendar with holidays/weekends marked, ProfileEditor in view mode (may have default or empty fields), SummaryMetrics showing full worked days.

**Screenshots:** `default_{viewport}.png`

**Analyze for:**

- Hero section layout and gradient rendering
- Month pill alignment and readability
- Calendar grid alignment, day cell sizing, weekend/holiday coloring
- Profile fields read-only appearance
- Summary card grid responsive reflow (4 → 2 → 1 columns)
- Overall visual hierarchy and spacing

#### B: Vacation Selected

**What it shows:** Several vacation days toggled on (blue gradient cells with "შ" badge). SummaryMetrics updated to reflect vacation/worked split.

**Screenshots:** `vacation-selected_{viewport}.png`

**Analyze for:**

- Vacation cell contrast and readability of Georgian "შ" character
- Selected state visual weight vs holiday vs weekend cells
- Calendar legend accuracy and visibility
- Summary metrics recalculation display
- Cell hover/active states (if visible in screenshot)
- Touch target sizes on mobile viewport

#### C: Profile Editing

**What it shows:** ProfileEditor in edit mode — inputs enabled, "Save Profile" + "Cancel" buttons visible, draft values in fields.

**Screenshots:** `profile-editing_{viewport}.png`

**Analyze for:**

- Input field enabled vs disabled visual distinction
- Button label clarity (Save/Cancel vs Edit/Reset)
- Form layout on narrow viewports
- Output format dropdown visibility and state — **note:** the `<select>` has no `disabled` attribute in view mode, so it is always interactive even when inputs are locked. Flag this if it looks inconsistent.
- Keyboard focus indicators (if visible)

#### D: Profile Validation Error

**What it shows:** ProfileEditor showing a validation error (red background message) after attempting to save with invalid data.

**Screenshots:** `profile-validation-error_{viewport}.png`

**Analyze for:**

- Error message visibility and contrast (red #8a2f45 on pink background)
- Error proximity to the offending field
- Whether error is accessible (screen reader, color-blind safe)
- Error message text clarity and actionability

#### E: Generation Error

**What it shows:** The status stack area showing a generation error with field-level details list. The "Generate Timesheet" button is re-enabled.

**Screenshots:** `generation-error_{viewport}.png`

**Analyze for:**

- Error status area visibility below the generate button
- Detail list readability and indentation
- Whether the error state is clearly distinguished from info/loading states
- Error message overflow behavior on mobile

#### F: Holiday Loading

**What it shows:** Status area showing "Refreshing holiday calendar…" info message. Generate button disabled. Calendar may show a transitional state.

**Screenshots:** `holiday-loading_{viewport}.png`

**Analyze for:**

- Loading indicator visibility (text-only — no spinner)
- Info message styling distinction from error messages
- Disabled button appearance (opacity 0.72, cursor: progress)
- Whether the user understands why the button is disabled

### Analysis Protocol

For each state group:

1. **Read all screenshots** in the group using the Read tool (it supports images)
2. **Read the component source code** for the components visible in that state:
   - `src/routes/+page.svelte` (always — it's the shell)
   - The relevant component file(s) from `src/lib/components/`
   - `src/app.css` for global design tokens
3. **Evaluate across 5 dimensions:**

| Dimension            | What to Check                                                                        |
| -------------------- | ------------------------------------------------------------------------------------ |
| **Layout**           | Grid alignment, spacing consistency, overflow handling, responsive reflow            |
| **Visual hierarchy** | Typography scale, color contrast, element prominence matches importance              |
| **Interaction cues** | Buttons look clickable, disabled states are clear, active states are distinguishable |
| **Accessibility**    | Color contrast ratios, touch targets (≥44px), focus rings, ARIA semantics            |
| **Consistency**      | Same patterns across viewports, no orphaned elements at breakpoints                  |

4. **Classify findings by severity:**

| Severity        | Definition                                            | Example                                           |
| --------------- | ----------------------------------------------------- | ------------------------------------------------- |
| **Critical**    | Broken layout, unreadable text, inaccessible controls | Calendar grid collapses, text overlaps            |
| **Major**       | Poor UX but functional, significant visual regression | Buttons too small on mobile, inconsistent spacing |
| **Refinement**  | Polish issues, minor spacing/alignment                | 2px misalignment, slightly off color              |
| **Opportunity** | Enhancement ideas, not bugs                           | Could add skeleton loading, micro-interactions    |

### Analysis Order

Process state groups in this order (foundational states first):

1. **A: Default** — establishes baseline layout and component rendering
2. **B: Vacation Selected** — core interaction state, exercises calendar most
3. **C: Profile Editing** — form interaction, mode switching
4. **D: Profile Validation Error** — error handling UX
5. **E: Generation Error** — primary action failure path
6. **F: Holiday Loading** — async state handling

### Pacing

After each state group analysis:

- Present a brief summary of findings (severity counts)
- Ask the user if they want to continue to the next group or stop here
- If the user says "continue all" or "run all", proceed without further prompts

## Step 5: Summary Report

After all state groups have been analyzed, produce a summary:

```markdown
# UI Audit Summary — Timesheet Studio

## States Reviewed

| State             | Critical | Major | Refinement | Opportunity | Key Finding |
| ----------------- | -------- | ----- | ---------- | ----------- | ----------- |
| Default           | 0        | 1     | 3          | 1           | ...         |
| Vacation Selected | 0        | 2     | 1          | 0           | ...         |
| ...               | ...      | ...   | ...        | ...         | ...         |

## Top Priority Issues

{List the 5-10 most impactful issues across all states, ordered by severity then impact}

## Cross-Cutting Patterns

{Issues that appear across multiple states — these should be fixed globally in app.css
or the page shell, not per-component}

## Responsive Breakpoint Issues

{Issues specific to breakpoint transitions — elements that break between viewports}

## Component-Specific Findings

### MonthPicker

{Findings specific to this component across all states}

### VacationCalendar

{Findings specific to this component across all states}

### ProfileEditor

{Findings specific to this component across all states}

### SummaryMetrics

{Findings specific to this component across all states}

## Recommended Fix Order

{Which issues to tackle first based on severity, blast radius, and dependencies}
```

## Cleanup

If you started the dev server in Step 1:

- Stop it when the audit is complete
- Inform the user it was stopped

## Important Notes

- **This is a single-page app.** All states share the same route (`/`). The audit focuses on component states and responsive behavior, not navigation.
- **No dark mode.** The app has a single light theme. No mode toggle exists.
- **Tauri mode.** The TitleBar component only renders in the Tauri desktop shell. The capture script runs in a regular browser, so TitleBar won't appear. This is expected — note it in the report but don't flag it as an issue.
- **Georgian characters.** The calendar uses "შ" (Georgian "shin") for vacation badges. Verify it renders correctly — this requires Sylfaen or a Georgian-capable font.
- **Interactive states require Playwright.** The capture script uses `@playwright/test` to click buttons, fill forms, and trigger error states. It does not just take static screenshots.
- **Ad-hoc captures.** If you need a screenshot of a state not covered by the script (e.g., a specific month with holidays, or the DOC format dropdown), use Playwright directly:
  ```bash
  npx playwright test --headed -g "specific test name"
  ```
  Or write a quick inline Playwright script.
