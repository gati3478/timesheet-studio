<script lang="ts">
  import { onMount } from 'svelte';
  import { MONTHS } from '$lib/constants';
  import type { DayItem, CalendarCell } from '$lib/calendar-types';
  import MonthPicker from '$lib/components/MonthPicker.svelte';
  import ProfileEditor from '$lib/components/ProfileEditor.svelte';
  import VacationCalendar from '$lib/components/VacationCalendar.svelte';
  import SummaryMetrics from '$lib/components/SummaryMetrics.svelte';
  import { env } from '$env/dynamic/public';

  const PROFILE_STORAGE_KEY = 'timesheet.profile.v1';
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
  let profileMessage = '';

  let outputFormat: 'docx' | 'doc' = 'docx';

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

  // ── Helpers ──────────────────────────────────────────────

  function pad2(value: number): string {
    return String(value).padStart(2, '0');
  }

  function isNumeric(value: string): boolean {
    return /^\d+$/.test(value.trim());
  }

  function looksLikeName(value: string): boolean {
    return /[^\d\s]/.test(value.trim());
  }

  function normalizeCompanyCode(value: string): string {
    const trimmed = value.trim();
    if (trimmed.length === 0) return '';
    if (trimmed.length < 6 || trimmed.length > 12 || !isNumeric(trimmed)) return '';
    return trimmed;
  }

  function normalizeEmployeeId(value: string): string {
    const trimmed = value.trim();
    if (trimmed.length === 0) return '';
    if (!/^\d{11}$/.test(trimmed)) return '';
    return trimmed;
  }

  function normalizeEmployeeName(value: string): string {
    const trimmed = value.trim();
    if (trimmed.length === 0) return '';
    if (!looksLikeName(trimmed)) return '';
    return trimmed;
  }

  function repairProfileSnapshot(snapshot: {
    companyCode: string;
    employeeName: string;
    employeeId: string;
  }) {
    let nextCompanyCode = snapshot.companyCode.trim();
    let nextEmployeeName = snapshot.employeeName.trim();
    const nextEmployeeId = snapshot.employeeId.trim();

    if (
      !isNumeric(nextCompanyCode) &&
      looksLikeName(nextCompanyCode) &&
      isNumeric(nextEmployeeName) &&
      isNumeric(nextEmployeeId)
    ) {
      nextEmployeeName = nextCompanyCode;
      nextCompanyCode = '';
    }

    return {
      companyCode: normalizeCompanyCode(nextCompanyCode),
      employeeName: normalizeEmployeeName(nextEmployeeName),
      employeeId: normalizeEmployeeId(nextEmployeeId)
    };
  }

  function persistProfile(): void {
    localStorage.setItem(
      PROFILE_STORAGE_KEY,
      JSON.stringify({ companyCode, employeeName, employeeId })
    );
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
    if (loadedHolidayYear === year && holidayDates.size > 0) return;

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

  function toggleVacation(item: DayItem): void {
    if (item.isWeekend || item.isHoliday) return;

    if (vacationDates.has(item.dateIso)) {
      vacationDates.delete(item.dateIso);
    } else {
      vacationDates.add(item.dateIso);
    }
    vacationDates = new Set(vacationDates);
  }

  // ── Generation ───────────────────────────────────────────

  function parseFilename(contentDisposition: string | null): string | null {
    if (!contentDisposition) return null;
    const match = /filename="?([a-zA-Z0-9\u10D0-\u10FF._-]+)"?/.exec(contentDisposition);
    return match?.[1] ?? null;
  }

  async function generateTimesheet(): Promise<void> {
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
      const nameSlug =
        employeeName
          .toLowerCase()
          .replace(/[^a-z0-9\u10D0-\u10FF\s-]/g, '')
          .trim()
          .replace(/\s+/g, '-') || 'timesheet';
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
    profileMessage = '';
    isEditingProfile = true;
  }

  function cancelProfileEdit(): void {
    draftCompanyCode = companyCode;
    draftEmployeeName = employeeName;
    draftEmployeeId = employeeId;
    profileError = '';
    profileMessage = '';
    isEditingProfile = false;
  }

  function saveProfile(): void {
    const nextCompanyCode = draftCompanyCode.trim();
    const nextEmployeeName = draftEmployeeName.trim();
    const nextEmployeeId = draftEmployeeId.trim();

    if (!nextCompanyCode || !nextEmployeeName || !nextEmployeeId) {
      profileError = 'Company code, name, and ID are all required.';
      profileMessage = '';
      return;
    }
    if (!/^\d{6,12}$/.test(nextCompanyCode)) {
      profileError = 'Company code must be numeric (6-12 digits).';
      profileMessage = '';
      return;
    }
    if (!looksLikeName(nextEmployeeName)) {
      profileError = 'Employee name must contain text.';
      profileMessage = '';
      return;
    }
    if (!/^\d{11}$/.test(nextEmployeeId)) {
      profileError = 'Employee ID must be exactly 11 digits.';
      profileMessage = '';
      return;
    }

    companyCode = nextCompanyCode;
    employeeName = nextEmployeeName;
    employeeId = nextEmployeeId;
    draftCompanyCode = companyCode;
    draftEmployeeName = employeeName;
    draftEmployeeId = employeeId;

    persistProfile();
    isEditingProfile = false;
    profileError = '';
    profileMessage = 'Profile saved.';
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
    profileMessage = 'Profile reset to defaults.';
    persistProfile();
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
        return;
      }
      shutdownMessage = data.message ?? 'Server is shutting down...';
    } catch (error) {
      shutdownError = error instanceof Error ? error.message : 'Unexpected shutdown error.';
    } finally {
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

  function isWorkedDay(item: DayItem): boolean {
    return !item.isWeekend && !item.isHoliday && !item.isVacation;
  }

  // ── Lifecycle ────────────────────────────────────────────

  onMount(() => {
    const saved = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved) as Partial<{
        companyCode: string;
        employeeName: string;
        employeeId: string;
      }>;

      const fixed = repairProfileSnapshot({
        companyCode: typeof parsed.companyCode === 'string' ? parsed.companyCode : '',
        employeeName: typeof parsed.employeeName === 'string' ? parsed.employeeName : '',
        employeeId: typeof parsed.employeeId === 'string' ? parsed.employeeId : ''
      });

      companyCode = fixed.companyCode;
      employeeName = fixed.employeeName;
      employeeId = fixed.employeeId;
      draftCompanyCode = companyCode;
      draftEmployeeName = employeeName;
      draftEmployeeId = employeeId;

      persistProfile();
    } catch {
      localStorage.removeItem(PROFILE_STORAGE_KEY);
    }
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
      if (typeof localStorage !== 'undefined') persistProfile();
      profileMessage = 'Profile was auto-repaired.';
      profileError = '';
    }
  }

  $: monthLabel = `${MONTHS[selectedMonth - 1].label} ${selectedYear}`;
  $: if (selectedYear) void loadHolidays(selectedYear);

  $: dayItems = buildDayItems(selectedYear, selectedMonth, holidayDates, vacationDates);
  $: calendarCells = buildCalendarCells(selectedYear, selectedMonth, dayItems);

  $: workedDayCount = dayItems.filter((item) => isWorkedDay(item)).length;
  $: vacationDayCount = dayItems.filter((item) => item.isVacation).length;
  $: blockedDayCount = dayItems.filter((item) => item.isWeekend || item.isHoliday).length;
  $: weekdayHolidayCount = dayItems.filter((item) => item.isHoliday && !item.isWeekend).length;
  $: firstHalfHours = dayItems.filter((item) => item.day <= 15 && isWorkedDay(item)).length * 8;
  $: secondHalfHours = dayItems.filter((item) => item.day >= 16 && isWorkedDay(item)).length * 8;
  $: totalHours = firstHalfHours + secondHalfHours;
  $: vacationHours = vacationDayCount * 8;
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
        isEditing={isEditingProfile}
        error={profileError}
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
          <p class="status status-info">Refreshing holiday calendar…</p>
        {/if}
      </div>

      <div class="utility-row">
        <button
          type="button"
          class="utility-button"
          on:click={shutdownApp}
          disabled={isGenerating || isShuttingDown}
        >
          {#if isShuttingDown}Stopping…{:else}Quit local app{/if}
        </button>
      </div>
    </article>

    <article class="card calendar-panel">
      <VacationCalendar
        year={selectedYear}
        {selectedMonth}
        {calendarCells}
        onToggleVacation={toggleVacation}
      />
    </article>
  </section>

  <SummaryMetrics
    {workedDayCount}
    {vacationDayCount}
    {weekdayHolidayCount}
    {blockedDayCount}
    {totalHours}
    {vacationHours}
    {firstHalfHours}
    {secondHalfHours}
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
    opacity: 0.72;
    cursor: progress;
    box-shadow: none;
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
    opacity: 0.68;
    cursor: progress;
  }

  .status-stack {
    margin-top: var(--space-3);
    min-height: 0;
    display: grid;
    align-content: start;
    gap: var(--space-2);
  }

  .status {
    margin: 0;
    border-radius: var(--radius-md);
    border: 1px solid transparent;
    font-size: 0.85rem;
    line-height: 1.35;
    padding: 0.48rem 0.64rem;
  }

  .status-error {
    color: #8a2f45;
    background: rgba(252, 238, 242, 0.9);
    border-color: rgba(188, 96, 118, 0.35);
  }

  .status-info {
    color: #395f9a;
    background: rgba(234, 242, 255, 0.9);
    border-color: rgba(95, 138, 205, 0.35);
  }

  .status-list {
    margin: 0;
    padding-left: 1.25rem;
    color: #8a2f45;
    font-size: 0.84rem;
  }

  .status-list li + li {
    margin-top: 0.2rem;
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
