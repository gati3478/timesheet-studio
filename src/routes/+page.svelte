<script lang="ts">
  import { onMount } from 'svelte';
  import { format, getDaysInMonth, isWeekend } from 'date-fns';
  import { MONTHS } from '$lib/constants';
  import type { DayItem, CalendarCell } from '$lib/calendar-types';
  import { computeSummary } from '$lib/calendar-types';
  import MonthPicker from '$lib/components/MonthPicker.svelte';
  import ProfileEditor from '$lib/components/ProfileEditor.svelte';
  import VacationCalendar from '$lib/components/VacationCalendar.svelte';
  import SummaryMetrics from '$lib/components/SummaryMetrics.svelte';
  import StatusMessage from '$lib/components/StatusMessage.svelte';
  import { browser } from '$app/environment';
  import { env } from '$env/dynamic/public';
  import { isTauriApp } from '$lib/tauri';
  import { slugify } from '$lib/slugify';
  import { parseFilename } from '$lib/content-disposition';
  import {
    repairProfileSnapshot,
    persistProfile,
    loadSavedProfile,
    validateProfile,
    NO_FIELD_ERRORS
  } from '$lib/profile';
  import type { FieldErrors } from '$lib/profile';
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
  let fieldErrors: FieldErrors = { ...NO_FIELD_ERRORS };

  let outputFormat: 'docx' | 'doc' = 'docx';
  let docExportAvailable = data.docExportAvailable;
  let devMode = data.devMode;

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

  function monthPrefix(year: number, month: number): string {
    return format(new Date(year, month - 1, 1), 'yyyy-MM-');
  }

  // ── Period navigation ────────────────────────────────────

  function purgeVacationOutOfMonth(): void {
    const prefix = monthPrefix(selectedYear, selectedMonth);
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
      const body = await response.json();

      if (!response.ok) throw new Error(body.message ?? 'Failed to load holidays.');

      holidayDates = new Set<string>(
        (body.entries ?? []).map((entry: { date: string }) => entry.date)
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
    const prefix = monthPrefix(selectedYear, selectedMonth);
    const filtered = [...vacationDates].filter((d) => !d.startsWith(prefix));
    vacationDates = new Set(filtered);
  }

  // ── Generation ───────────────────────────────────────────

  async function generateTimesheet(): Promise<void> {
    if (isEditingProfile) {
      if (!saveProfile()) return;
    }

    generationError = '';
    generationDetails = [];
    profileMessage = '';
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
        const body = await response.json();
        generationError = body.message ?? 'Failed to generate timesheet.';
        generationDetails = Array.isArray(body.details) ? body.details : [];

        // Auto-open profile editor for validation errors so user can fix fields
        if (response.status === 400 && generationDetails.length > 0 && !isEditingProfile) {
          openProfileEditor();
        }
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

  function syncDraftsFromProfile(): void {
    draftCompanyCode = companyCode;
    draftEmployeeName = employeeName;
    draftEmployeeId = employeeId;
    profileError = '';
    profileDetails = [];
    fieldErrors = { ...NO_FIELD_ERRORS };
  }

  function openProfileEditor(): void {
    syncDraftsFromProfile();
    profileMessage = '';
    isEditingProfile = true;
  }

  function cancelProfileEdit(): void {
    syncDraftsFromProfile();
    profileMessage = '';
    isEditingProfile = false;
  }

  function saveProfile(): boolean {
    const result = validateProfile({
      companyCode: draftCompanyCode,
      employeeName: draftEmployeeName,
      employeeId: draftEmployeeId
    });

    if (result.messages.length > 0) {
      profileError = 'Please fix the following:';
      profileDetails = result.messages;
      profileMessage = '';
      fieldErrors = result.fieldErrors;
      return false;
    }

    companyCode = draftCompanyCode.trim();
    employeeName = draftEmployeeName.trim();
    employeeId = draftEmployeeId.trim();
    syncDraftsFromProfile();

    persistProfile({ companyCode, employeeName, employeeId });
    isEditingProfile = false;
    profileMessage = 'Profile saved.';
    return true;
  }

  function resetProfile(): void {
    companyCode = DEFAULT_COMPANY_CODE;
    employeeName = DEFAULT_EMPLOYEE_NAME;
    employeeId = DEFAULT_EMPLOYEE_ID;
    syncDraftsFromProfile();
    isEditingProfile = false;
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
      const body = await response.json();
      if (!response.ok) {
        shutdownError = body.message ?? 'Failed to shut down server.';
        isShuttingDown = false;
        return;
      }
      shutdownMessage = body.message ?? 'Server is shutting down...';
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
    const total = getDaysInMonth(new Date(year, month - 1));

    for (let day = 1; day <= total; day += 1) {
      const date = new Date(year, month - 1, day);
      const dateIso = format(date, 'yyyy-MM-dd');
      items.push({
        day,
        dateIso,
        isWeekend: isWeekend(date),
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
    fieldErrors = { ...NO_FIELD_ERRORS };
  }

  $: monthLabel = `${MONTHS[selectedMonth - 1].label} ${selectedYear}`;
  $: if (browser && selectedYear) void loadHolidays(selectedYear);

  $: dayItems = buildDayItems(selectedYear, selectedMonth, holidayDates, vacationDates);
  $: calendarCells = buildCalendarCells(selectedYear, selectedMonth, dayItems);
  $: hasVacation = dayItems.some((item) => item.isVacation);

  $: summary = computeSummary(dayItems);
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
        {fieldErrors}
        onEdit={openProfileEditor}
        onSave={saveProfile}
        onCancel={cancelProfileEdit}
        onReset={resetProfile}
      />

      <div class="button-row">
        <button
          type="button"
          class="primary"
          class:loading={isGenerating || loadingHolidays}
          on:click={generateTimesheet}
          disabled={isGenerating || loadingHolidays || isShuttingDown}
        >
          {#if isGenerating}Generating…{:else}Generate Timesheet{/if}
        </button>
      </div>

      <div class="status-stack" aria-live="polite">
        <StatusMessage text={generationError} details={generationDetails} variant="error" />
        <StatusMessage text={shutdownError} variant="error" />
        <StatusMessage text={shutdownMessage} variant="info" />

        {#if holidayError}
          <StatusMessage text={holidayError} variant="error" />
        {:else if loadingHolidays}
          <p class="status status-info">
            Refreshing holiday calendar<span class="loading-dots"
              ><span>.</span><span>.</span><span>.</span></span
            >
          </p>
        {/if}
      </div>

      {#if !isTauri && devMode}
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

  .button-row button.loading:disabled {
    cursor: progress;
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
