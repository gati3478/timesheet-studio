<script lang="ts">
  import { onMount } from 'svelte';
  import { MONTHS } from '$lib/constants';
  import type { DayItem, CalendarCell } from '$lib/calendar-types';
  import MonthPicker from '$lib/components/MonthPicker.svelte';
  import ProfileEditor from '$lib/components/ProfileEditor.svelte';
  import VacationCalendar from '$lib/components/VacationCalendar.svelte';
  import SummaryMetrics from '$lib/components/SummaryMetrics.svelte';
  import { browser } from '$app/environment';
  import { env } from '$env/dynamic/public';
  import { isTauriApp } from '$lib/tauri';
  import { slugify } from '$lib/slugify';
  import {
    repairProfileSnapshot,
    persistProfile,
    loadSavedProfile,
    looksLikeName
  } from '$lib/profile';
  import type { PageData } from './$types';

  export let data: PageData;

  const DEFAULT_COMPANY_CODE = env.PUBLIC_DEFAULT_COMPANY_CODE ?? '';
  const DEFAULT_EMPLOYEE_NAME = env.PUBLIC_DEFAULT_EMPLOYEE_NAME ?? '';
  const DEFAULT_EMPLOYEE_ID = env.PUBLIC_DEFAULT_EMPLOYEE_ID ?? '';

  const now = new Date();
  let selectedYear = now.getFullYear();
  let selectedMonth = now.getMonth() + 1;

  let companyCode = DEFAULT_COMPANY_CODE;
  let employeeName = DEFAULT_EMPLOYEE_NAME;
  let employeeId = DEFAULT_EMPLOYEE_ID;

  let draftCompanyCode = companyCode;
  let draftEmployeeName = employeeName;
  let draftEmployeeId = employeeId;
  let isEditingProfile = false;
  let profileError = '';
  let profileDetails: string[] = [];
  let profileMessage = '';

  let outputFormat: 'docx' | 'doc' = 'docx';
  let docExportAvailable = data.docExportAvailable;

  let holidayDates = new Set<string>();
  let holidayError = '';
  let loadingHolidays = false;
  let loadedHolidayYear: number | null = null;

  let vacationDates = new Set<string>();

  let generationError = '';
  let generationDetails: string[] = [];
  let isGenerating = false;

  let shutdownError = '';
  let shutdownMessage = '';
  let isShuttingDown = false;

  let isTauri = false;

  // ── Helpers ──────────────────────────────────────────────

  function pad2(value: number): string {
    return String(value).padStart(2, '0');
  }

  function isoDate(year: number, month: number, day: number): string {
    return `${year}-${pad2(month)}-${pad2(day)}`;
  }

  function daysInMonth(year: number, month: number): number {
    return new Date(year, month, 0).getDate();
  }

  function isWeekend(year: number, month: number, day: number): boolean {
    const weekday = new Date(year, month - 1, day).getDay();
    return weekday === 0 || weekday === 6;
  }

  // ── Period navigation ────────────────────────────────────

  function purgeVacationOutOfMonth(): void {
    const prefix = `${selectedYear}-${pad2(selectedMonth)}-`;
    const filtered = [...vacationDates].filter((date) => date.startsWith(prefix));
    if (filtered.length !== vacationDates.size) {
      vacationDates = new Set(filtered);
    }
  }

  function setMonth(month: number): void {
    selectedMonth = month;
    purgeVacationOutOfMonth();
  }

  function changeYear(delta: number): void {
    selectedYear += delta;
    purgeVacationOutOfMonth();
  }

  function shiftMonth(delta: number): void {
    const shifted = new Date(selectedYear, selectedMonth - 1 + delta, 1);
    selectedYear = shifted.getFullYear();
    selectedMonth = shifted.getMonth() + 1;
    purgeVacationOutOfMonth();
  }

  // ── Holidays ─────────────────────────────────────────────

  async function loadHolidays(year: number): Promise<void> {
    if (loadedHolidayYear === year) return;

    loadingHolidays = true;
    holidayError = '';

    try {
      const response = await fetch(`/api/holidays?year=${year}`);
      const data = await response.json();

      if (!response.ok) throw new Error(data.message ?? 'Failed to load holidays.');

      holidayDates = new Set<string>(
        (data.entries ?? []).map((entry: { date: string }) => entry.date)
      );
      loadedHolidayYear = year;
    } catch (error) {
      holidayError = error instanceof Error ? error.message : 'Unexpected holiday loading error.';
      holidayDates = new Set<string>();
    } finally {
      loadingHolidays = false;
    }
  }

  // ── Vacation ─────────────────────────────────────────────

  function batchSetVacation(dateIsos: string[], isVacation: boolean): void {
    if (loadingHolidays) return;
    for (const dateIso of dateIsos) {
      if (isVacation) vacationDates.add(dateIso);
      else vacationDates.delete(dateIso);
    }
    vacationDates = new Set(vacationDates);
  }

  function selectAllWorkdays(): void {
    if (loadingHolidays) return;
    for (const item of dayItems) {
      if (!item.isWeekend && !item.isHoliday) vacationDates.add(item.dateIso);
    }
    vacationDates = new Set(vacationDates);
  }

  function clearAllVacation(): void {
    const prefix = `${selectedYear}-${pad2(selectedMonth)}-`;
    const filtered = [...vacationDates].filter((d) => !d.startsWith(prefix));
    vacationDates = new Set(filtered);
  }

  // ── Generation ───────────────────────────────────────────

  function parseFilename(contentDisposition: string | null): string | null {
    if (!contentDisposition) return null;

    // Prefer filename* (RFC 5987) — carries the full Unicode name
    const extMatch = /filename\*=UTF-8''([^\s;]+)/i.exec(contentDisposition);
    if (extMatch) {
      try {
        return decodeURIComponent(extMatch[1]);
      } catch {
        /* fall through to basic filename */
      }
    }

    const match = /filename="?([a-zA-Z0-9\u10D0-\u10FF._-]+)"?/.exec(contentDisposition);
    return match?.[1] ?? null;
  }

  async function generateTimesheet(): Promise<void> {
    if (isEditingProfile) {
      if (!saveProfile()) return;
    }

    generationError = '';
    generationDetails = [];
    isGenerating = true;

    try {
      const response = await fetch('/api/timesheet/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: selectedYear,
          month: selectedMonth,
          companyCode,
          employeeName,
          employeeId,
          outputFormat,
          vacationDates: [...vacationDates].sort((a, b) => a.localeCompare(b))
        })
      });

      if (!response.ok) {
        const data = await response.json();
        generationError = data.message ?? 'Failed to generate timesheet.';
        generationDetails = Array.isArray(data.details) ? data.details : [];
        return;
      }

      const blob = await response.blob();
      const nameSlug = slugify(employeeName) || 'timesheet';
      const fallbackFilename = `${nameSlug}-${MONTHS[selectedMonth - 1].short.toLowerCase()}-${selectedYear}-timesheet.${outputFormat}`;
      const filename =
        parseFilename(response.headers.get('content-disposition')) ?? fallbackFilename;
      const href = URL.createObjectURL(blob);

      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(href);
    } catch (error) {
      generationError = error instanceof Error ? error.message : 'Unexpected generation error.';
    } finally {
      isGenerating = false;
    }
  }

  // ── Profile ──────────────────────────────────────────────

  function openProfileEditor(): void {
    draftCompanyCode = companyCode;
    draftEmployeeName = employeeName;
    draftEmployeeId = employeeId;
    profileError = '';
    profileDetails = [];
    profileMessage = '';
    isEditingProfile = true;
  }

  function cancelProfileEdit(): void {
    draftCompanyCode = companyCode;
    draftEmployeeName = employeeName;
    draftEmployeeId = employeeId;
    profileError = '';
    profileDetails = [];
    profileMessage = '';
    isEditingProfile = false;
  }

  function saveProfile(): boolean {
    const nextCompanyCode = draftCompanyCode.trim();
    const nextEmployeeName = draftEmployeeName.trim();
    const nextEmployeeId = draftEmployeeId.trim();

    const errors: string[] = [];
    if (!nextCompanyCode) errors.push('Company code is required.');
    else if (!/^\d{6,12}$/.test(nextCompanyCode))
      errors.push('Company code must be numeric (6–12 digits).');

    if (!nextEmployeeName) errors.push('Employee name is required.');
    else if (!looksLikeName(nextEmployeeName)) errors.push('Employee name must contain text.');

    if (!nextEmployeeId) errors.push('Employee ID is required.');
    else if (!/^\d{11}$/.test(nextEmployeeId))
      errors.push('Employee ID must be exactly 11 digits.');

    if (errors.length > 0) {
      profileError = 'Please fix the following:';
      profileDetails = errors;
      profileMessage = '';
      return false;
    }

    companyCode = nextCompanyCode;
    employeeName = nextEmployeeName;
    employeeId = nextEmployeeId;
    draftCompanyCode = companyCode;
    draftEmployeeName = employeeName;
    draftEmployeeId = employeeId;

    persistProfile({ companyCode, employeeName, employeeId });
    isEditingProfile = false;
    profileError = '';
    profileDetails = [];
    profileMessage = 'Profile saved.';
    return true;
  }

  function resetProfile(): void {
    companyCode = DEFAULT_COMPANY_CODE;
    employeeName = DEFAULT_EMPLOYEE_NAME;
    employeeId = DEFAULT_EMPLOYEE_ID;
    draftCompanyCode = companyCode;
    draftEmployeeName = employeeName;
    draftEmployeeId = employeeId;
    isEditingProfile = false;
    profileError = '';
    profileDetails = [];
    profileMessage = 'Profile reset to defaults.';
    persistProfile({ companyCode, employeeName, employeeId });
  }

  // ── Shutdown ─────────────────────────────────────────────

  async function shutdownApp(): Promise<void> {
    shutdownError = '';
    shutdownMessage = '';

    if (!window.confirm('This will stop the local server. Continue?')) return;

    isShuttingDown = true;
    try {
      const response = await fetch('/api/system/shutdown', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) {
        shutdownError = data.message ?? 'Failed to shut down server.';
        isShuttingDown = false;
        return;
      }
      shutdownMessage = data.message ?? 'Server is shutting down...';
    } catch (error) {
      shutdownError = error instanceof Error ? error.message : 'Unexpected shutdown error.';
      isShuttingDown = false;
    }
  }

  // ── Calendar computation ─────────────────────────────────

  function buildDayItems(
    year: number,
    month: number,
    holidays: ReadonlySet<string>,
    vacations: ReadonlySet<string>
  ): DayItem[] {
    const items: DayItem[] = [];
    const total = daysInMonth(year, month);

    for (let day = 1; day <= total; day += 1) {
      const dateIso = isoDate(year, month, day);
      items.push({
        day,
        dateIso,
        isWeekend: isWeekend(year, month, day),
        isHoliday: holidays.has(dateIso),
        isVacation: vacations.has(dateIso)
      });
    }
    return items;
  }

  function buildCalendarCells(year: number, month: number, items: DayItem[]): CalendarCell[] {
    const cells: CalendarCell[] = [];
    const firstDay = new Date(year, month - 1, 1).getDay();
    const leading = (firstDay + 6) % 7;

    for (let i = 0; i < leading; i += 1) cells.push({ kind: 'empty', key: `leading-${i}` });
    for (const item of items) cells.push({ kind: 'day', key: item.dateIso, item });
    const trailing = (7 - (cells.length % 7)) % 7;
    for (let i = 0; i < trailing; i += 1) cells.push({ kind: 'empty', key: `trailing-${i}` });

    return cells;
  }

  // ── Lifecycle ────────────────────────────────────────────

  onMount(async () => {
    const saved = loadSavedProfile();
    if (saved) {
      companyCode = saved.companyCode;
      employeeName = saved.employeeName;
      employeeId = saved.employeeId;
      draftCompanyCode = companyCode;
      draftEmployeeName = employeeName;
      draftEmployeeId = employeeId;
    }

    isTauri = isTauriApp();
  });

  // ── Reactive statements ──────────────────────────────────

  $: if (!isEditingProfile) {
    const fixed = repairProfileSnapshot({ companyCode, employeeName, employeeId });
    const changed =
      fixed.companyCode !== companyCode ||
      fixed.employeeName !== employeeName ||
      fixed.employeeId !== employeeId;

    if (changed) {
      companyCode = fixed.companyCode;
      employeeName = fixed.employeeName;
      employeeId = fixed.employeeId;
      draftCompanyCode = companyCode;
      draftEmployeeName = employeeName;
      draftEmployeeId = employeeId;
      if (typeof localStorage !== 'undefined')
        persistProfile({ companyCode, employeeName, employeeId });
      profileMessage = 'Profile was auto-repaired.';
      profileError = '';
    }
  }

  // Clear stale profile errors when the user edits any field
  $: if (isEditingProfile) {
    void draftCompanyCode;
    void draftEmployeeName;
    void draftEmployeeId;
    profileError = '';
    profileDetails = [];
  }

  $: monthLabel = `${MONTHS[selectedMonth - 1].label} ${selectedYear}`;
  $: if (browser && selectedYear) void loadHolidays(selectedYear);

  $: dayItems = buildDayItems(selectedYear, selectedMonth, holidayDates, vacationDates);
  $: calendarCells = buildCalendarCells(selectedYear, selectedMonth, dayItems);
  $: hasVacation = dayItems.some((item) => item.isVacation);

  $: summary = (() => {
    let worked = 0,
      vacation = 0,
      blocked = 0,
      weekdayHoliday = 0,
      h1 = 0,
      h2 = 0;
    for (const item of dayItems) {
      if (item.isWeekend || item.isHoliday) {
        blocked++;
        if (item.isHoliday && !item.isWeekend) weekdayHoliday++;
      } else if (item.isVacation) {
        vacation++;
      } else {
        worked++;
        if (item.day <= 15) h1 += 8;
        else h2 += 8;
      }
    }
    return {
      workedDayCount: worked,
      vacationDayCount: vacation,
      blockedDayCount: blocked,
      weekdayHolidayCount: weekdayHoliday,
      firstHalfHours: h1,
      secondHalfHours: h2,
      totalHours: h1 + h2,
      vacationHours: vacation * 8
    };
  })();
</script>

<svelte:head>
  <title>Timesheet Studio</title>
</svelte:head>

<main class="shell">
  <section class="hero card">
    <div>
      <p class="eyebrow">Twino</p>
      <h1>Timesheet Studio</h1>
      <p class="subtitle">
        Precisely fill your monthly form with holiday-aware accounting and instant export.
      </p>
    </div>
    <div class="hero-pill">{monthLabel}</div>
  </section>

  <section class="layout">
    <article class="card control-panel">
      <MonthPicker
        year={selectedYear}
        month={selectedMonth}
        {monthLabel}
        onShiftMonth={shiftMonth}
        onChangeYear={changeYear}
        onSetMonth={setMonth}
      />

      <ProfileEditor
        bind:draftCompanyCode
        bind:draftEmployeeName
        bind:draftEmployeeId
        bind:outputFormat
        {docExportAvailable}
        isEditing={isEditingProfile}
        error={profileError}
        errorDetails={profileDetails}
        message={profileMessage}
        onEdit={openProfileEditor}
        onSave={saveProfile}
        onCancel={cancelProfileEdit}
        onReset={resetProfile}
      />

      <div class="button-row">
        <button
          type="button"
          class="primary"
          on:click={generateTimesheet}
          disabled={isGenerating || loadingHolidays || isShuttingDown}
        >
          {#if isGenerating}Generating…{:else}Generate Timesheet{/if}
        </button>
      </div>

      <div class="status-stack" aria-live="polite">
        {#if generationError}
          <p class="status status-error">{generationError}</p>
          {#if generationDetails.length > 0}
            <ul class="status-list">
              {#each generationDetails as detail, i (i)}
                <li>{detail}</li>
              {/each}
            </ul>
          {/if}
        {/if}

        {#if shutdownError}
          <p class="status status-error">{shutdownError}</p>
        {/if}

        {#if shutdownMessage}
          <p class="status status-info">{shutdownMessage}</p>
        {/if}

        {#if holidayError}
          <p class="status status-error">{holidayError}</p>
        {:else if loadingHolidays}
          <p class="status status-info">
            Refreshing holiday calendar<span class="loading-dots"
              ><span>.</span><span>.</span><span>.</span></span
            >
          </p>
        {/if}
      </div>

      {#if !isTauri}
        <div class="utility-row">
          <button
            type="button"
            class="utility-button"
            on:click={shutdownApp}
            disabled={isGenerating || isShuttingDown}
            title="Stops the local Node.js server powering this page"
          >
            {#if isShuttingDown}Stopping…{:else}Quit local app{/if}
          </button>
        </div>
      {/if}
    </article>

    <article class="card calendar-panel">
      <VacationCalendar
        year={selectedYear}
        {selectedMonth}
        {calendarCells}
        {loadingHolidays}
        {hasVacation}
        onBatchSetVacation={batchSetVacation}
        onSelectAll={selectAllWorkdays}
        onClearAll={clearAllVacation}
      />
    </article>
  </section>

  <SummaryMetrics
    workedDayCount={summary.workedDayCount}
    vacationDayCount={summary.vacationDayCount}
    weekdayHolidayCount={summary.weekdayHolidayCount}
    blockedDayCount={summary.blockedDayCount}
    totalHours={summary.totalHours}
    vacationHours={summary.vacationHours}
    firstHalfHours={summary.firstHalfHours}
    secondHalfHours={summary.secondHalfHours}
  />
</main>

<style>
  .shell {
    width: min(1160px, calc(100% - 2.4rem));
    margin: var(--space-7) auto var(--space-8);
    display: grid;
    gap: var(--space-4);
  }

  .card {
    background: var(--surface-1);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-md);
    backdrop-filter: blur(6px);
  }

  .hero {
    padding: var(--space-5) var(--space-6);
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3);
    background:
      radial-gradient(circle at 20% 8%, rgba(85, 146, 255, 0.1), transparent 43%),
      linear-gradient(160deg, rgba(255, 255, 255, 0.94), rgba(241, 247, 255, 0.94));
  }

  .eyebrow {
    margin: 0;
    font-size: 0.73rem;
    text-transform: uppercase;
    letter-spacing: 0.11em;
    color: var(--text-tertiary);
    font-weight: 700;
  }

  h1 {
    margin: var(--space-2) 0 0;
    font-size: clamp(1.65rem, 3.7vw, 2.25rem);
    letter-spacing: -0.032em;
    line-height: 1.08;
    color: var(--text-primary);
  }

  .subtitle {
    margin: var(--space-2) 0 0;
    color: var(--text-secondary);
    max-width: 64ch;
    font-size: 1rem;
  }

  .hero-pill {
    border: 1px solid var(--border-strong);
    border-radius: 999px;
    padding: 0.44rem 0.86rem;
    font-size: 0.84rem;
    color: var(--accent-strong);
    font-weight: 600;
    background: rgba(227, 238, 255, 0.78);
    white-space: nowrap;
  }

  .layout {
    display: grid;
    grid-template-columns: minmax(340px, 0.95fr) minmax(460px, 1.2fr);
    gap: var(--space-4);
    align-items: start;
  }

  .control-panel,
  .calendar-panel {
    padding: var(--space-5);
  }

  .calendar-panel {
    display: grid;
    align-content: start;
    gap: var(--space-3);
  }

  .button-row {
    margin-top: var(--space-4);
    display: flex;
    gap: var(--space-2);
  }

  .button-row button {
    border: 0;
    border-radius: 999px;
    min-height: 44px;
    padding: 0.62rem 1.18rem;
    color: #fff;
    font-weight: 630;
    font-size: 0.94rem;
    cursor: pointer;
  }

  .button-row .primary {
    background: linear-gradient(135deg, var(--accent), var(--accent-strong));
    box-shadow: 0 10px 20px rgba(38, 89, 176, 0.2);
  }

  .button-row button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    box-shadow: none;
    filter: saturate(0.6);
  }

  .utility-row {
    margin-top: var(--space-2);
    display: flex;
    justify-content: flex-start;
  }

  .utility-button {
    min-height: 36px;
    border: 1px solid var(--border-subtle);
    border-radius: 999px;
    background: rgba(245, 248, 253, 0.85);
    color: var(--text-secondary);
    padding: 0.45rem 0.8rem;
    font-weight: 560;
    cursor: pointer;
    transition:
      background-color 120ms ease,
      border-color 120ms ease,
      color 120ms ease;
  }

  .utility-button:hover:not(:disabled) {
    background: rgba(238, 244, 253, 0.95);
    color: var(--text-primary);
    border-color: var(--border-strong);
  }

  .utility-button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .status-stack {
    margin-top: var(--space-3);
    min-height: 0;
    display: grid;
    align-content: start;
    gap: var(--space-2);
  }

  @keyframes pulse-dots {
    0%,
    20% {
      opacity: 0;
    }
    50% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }

  .status-info .loading-dots span {
    animation: pulse-dots 1.4s infinite;
  }

  .status-info .loading-dots span:nth-child(2) {
    animation-delay: 0.2s;
  }

  .status-info .loading-dots span:nth-child(3) {
    animation-delay: 0.4s;
  }

  @media (max-width: 1024px) {
    .layout {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 760px) {
    .hero-pill {
      align-self: flex-start;
    }
  }

  @media (max-width: 640px) {
    .shell {
      width: calc(100% - 1.2rem);
      margin: var(--space-4) auto var(--space-6);
    }

    .hero {
      padding: var(--space-4);
      flex-direction: column;
    }

    .control-panel,
    .calendar-panel {
      padding: var(--space-4);
    }
  }
</style>
