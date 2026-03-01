<script lang="ts">
  import { onMount } from 'svelte';

  const MONTHS = [
    { value: 1, label: 'January', short: 'Jan' },
    { value: 2, label: 'February', short: 'Feb' },
    { value: 3, label: 'March', short: 'Mar' },
    { value: 4, label: 'April', short: 'Apr' },
    { value: 5, label: 'May', short: 'May' },
    { value: 6, label: 'June', short: 'Jun' },
    { value: 7, label: 'July', short: 'Jul' },
    { value: 8, label: 'August', short: 'Aug' },
    { value: 9, label: 'September', short: 'Sep' },
    { value: 10, label: 'October', short: 'Oct' },
    { value: 11, label: 'November', short: 'Nov' },
    { value: 12, label: 'December', short: 'Dec' }
  ] as const;

  const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
  const PROFILE_STORAGE_KEY = 'timesheet.profile.v1';
  const DEFAULT_COMPANY_CODE = '405627530';
  const DEFAULT_EMPLOYEE_NAME = 'გიორგი პეტრიაშვილი, უფროსი დეველოპერი';
  const DEFAULT_EMPLOYEE_ID = '01005031116';

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

  type DayItem = {
    day: number;
    dateIso: string;
    isWeekend: boolean;
    isHoliday: boolean;
    isVacation: boolean;
  };

  type CalendarCell =
    | { kind: 'empty'; key: string }
    | { kind: 'day'; key: string; item: DayItem };

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
    if (trimmed.length < 6 || trimmed.length > 12 || !isNumeric(trimmed)) {
      return DEFAULT_COMPANY_CODE;
    }
    return trimmed;
  }

  function normalizeEmployeeId(value: string): string {
    const trimmed = value.trim();
    if (!/^\d{11}$/.test(trimmed)) {
      return DEFAULT_EMPLOYEE_ID;
    }
    return trimmed;
  }

  function normalizeEmployeeName(value: string): string {
    const trimmed = value.trim();
    if (!looksLikeName(trimmed)) {
      return DEFAULT_EMPLOYEE_NAME;
    }
    return trimmed;
  }

  function repairProfileSnapshot(snapshot: {
    companyCode: string;
    employeeName: string;
    employeeId: string;
  }): {
    companyCode: string;
    employeeName: string;
    employeeId: string;
  } {
    let nextCompanyCode = snapshot.companyCode.trim();
    let nextEmployeeName = snapshot.employeeName.trim();
    let nextEmployeeId = snapshot.employeeId.trim();

    // Repair the bad state shown in screenshot:
    // companyCode=name-like text, employeeName=id-like digits, employeeId=id-like digits.
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
      JSON.stringify({
        companyCode,
        employeeName,
        employeeId
      })
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

  async function loadHolidays(year: number): Promise<void> {
    if (loadedHolidayYear === year && holidayDates.size > 0) {
      return;
    }

    loadingHolidays = true;
    holidayError = '';

    try {
      const response = await fetch(`/api/holidays?year=${year}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message ?? 'Failed to load holidays.');
      }

      holidayDates = new Set<string>((data.entries ?? []).map((entry: { date: string }) => entry.date));
      loadedHolidayYear = year;
    } catch (error) {
      holidayError = error instanceof Error ? error.message : 'Unexpected holiday loading error.';
      holidayDates = new Set<string>();
    } finally {
      loadingHolidays = false;
    }
  }

  function toggleVacation(item: DayItem): void {
    if (item.isWeekend || item.isHoliday) {
      return;
    }

    if (vacationDates.has(item.dateIso)) {
      vacationDates.delete(item.dateIso);
      vacationDates = new Set(vacationDates);
      return;
    }

    vacationDates.add(item.dateIso);
    vacationDates = new Set(vacationDates);
  }

  function parseFilename(contentDisposition: string | null): string | null {
    if (!contentDisposition) {
      return null;
    }

    const match = /filename=\"?([^\";]+)\"?/.exec(contentDisposition);
    return match?.[1] ?? null;
  }

  async function generateTimesheet(): Promise<void> {
    generationError = '';
    generationDetails = [];
    isGenerating = true;

    try {
      const response = await fetch('/api/timesheet/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
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
      const fallbackFilename = `g.petriashvili-${MONTHS[selectedMonth - 1].short.toLowerCase()}-${selectedYear}-timesheet.${outputFormat}`;
      const filename = parseFilename(response.headers.get('content-disposition')) ?? fallbackFilename;
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

  async function shutdownApp(): Promise<void> {
    shutdownError = '';
    shutdownMessage = '';

    if (!window.confirm('This will stop the local server. Continue?')) {
      return;
    }

    isShuttingDown = true;
    try {
      const response = await fetch('/api/system/shutdown', {
        method: 'POST'
      });

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
      const weekend = isWeekend(year, month, day);
      const holiday = holidays.has(dateIso);

      items.push({
        day,
        dateIso,
        isWeekend: weekend,
        isHoliday: holiday,
        isVacation: vacations.has(dateIso)
      });
    }

    return items;
  }

  function buildCalendarCells(year: number, month: number, items: DayItem[]): CalendarCell[] {
    const cells: CalendarCell[] = [];
    const firstDay = new Date(year, month - 1, 1).getDay();
    const leading = (firstDay + 6) % 7;

    for (let index = 0; index < leading; index += 1) {
      cells.push({ kind: 'empty', key: `leading-${index}` });
    }

    for (const item of items) {
      cells.push({ kind: 'day', key: item.dateIso, item });
    }

    const trailing = (7 - (cells.length % 7)) % 7;
    for (let index = 0; index < trailing; index += 1) {
      cells.push({ kind: 'empty', key: `trailing-${index}` });
    }

    return cells;
  }

  function isWorkedDay(item: DayItem): boolean {
    return !item.isWeekend && !item.isHoliday && !item.isVacation;
  }

  function dayAriaLabel(item: DayItem): string {
    const date = `${MONTHS[selectedMonth - 1].label} ${item.day}, ${selectedYear}`;

    if (item.isHoliday) {
      return `${date}. Holiday, unavailable.`;
    }

    if (item.isWeekend) {
      return `${date}. Weekend, unavailable.`;
    }

    if (item.isVacation) {
      return `${date}. Paid vacation selected. Activate to set as workday.`;
    }

    return `${date}. Workday selected. Activate to set as paid vacation.`;
  }

  onMount(() => {
    const saved = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!saved) {
      return;
    }

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

  $: if (!isEditingProfile) {
    const fixed = repairProfileSnapshot({
      companyCode,
      employeeName,
      employeeId
    });

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
      if (typeof localStorage !== 'undefined') {
        persistProfile();
      }
      profileMessage = 'Profile was auto-repaired.';
      profileError = '';
    }
  }

  $: monthLabel = `${MONTHS[selectedMonth - 1].label} ${selectedYear}`;

  $: if (selectedYear) {
    void loadHolidays(selectedYear);
  }

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
      <p class="subtitle">Precisely fill your monthly form with holiday-aware accounting and instant export.</p>
    </div>
    <div class="hero-pill">{monthLabel}</div>
  </section>

  <section class="layout">
    <article class="card control-panel">
      <div class="section-title">
        <h2>Reporting Period</h2>
        <p>Dedicated month and year selector</p>
      </div>

      <div class="period-shell">
        <div class="period-header">
          <button type="button" class="nav" on:click={() => shiftMonth(-1)} aria-label="Previous month">←</button>
          <div class="period-label">{monthLabel}</div>
          <button type="button" class="nav" on:click={() => shiftMonth(1)} aria-label="Next month">→</button>
        </div>

        <div class="year-stepper">
          <button type="button" on:click={() => changeYear(-1)} aria-label="Decrease year">−</button>
          <div>{selectedYear}</div>
          <button type="button" on:click={() => changeYear(1)} aria-label="Increase year">+</button>
        </div>

        <div class="month-grid">
          {#each MONTHS as month}
            <button
              type="button"
              class:active={month.value === selectedMonth}
              on:click={() => setMonth(month.value)}
              aria-pressed={month.value === selectedMonth}
              aria-label={`Select ${month.label} ${selectedYear}`}
            >
              {month.short}
            </button>
          {/each}
        </div>
      </div>

      <div class="section-title fields-title">
        <h2>Document Fields</h2>
        <p>Values written to the official form</p>
      </div>

      <div class="profile-actions">
        {#if !isEditingProfile}
          <button type="button" class="ghost" on:click={openProfileEditor}>Edit Profile</button>
          <button type="button" class="ghost reset" on:click={resetProfile}>Reset</button>
        {:else}
          <button type="button" class="ghost save" on:click={saveProfile}>Save Profile</button>
          <button type="button" class="ghost cancel" on:click={cancelProfileEdit}>Cancel</button>
        {/if}
      </div>

      <div class="input-grid" class:editing={isEditingProfile}>
        <label>
          <span>Company Code</span>
          <input type="text" bind:value={draftCompanyCode} placeholder="405627530" disabled={!isEditingProfile} />
        </label>

        <label>
          <span>Employee Name</span>
          <input type="text" bind:value={draftEmployeeName} placeholder="Employee full name" disabled={!isEditingProfile} />
        </label>

        <label>
          <span>Employee ID</span>
          <input type="text" bind:value={draftEmployeeId} placeholder="Personal ID" disabled={!isEditingProfile} />
        </label>

        <label>
          <span>Output Format</span>
          <select bind:value={outputFormat}>
            <option value="docx">DOCX</option>
            <option value="doc">DOC</option>
          </select>
        </label>
      </div>

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
              {#each generationDetails as detail}
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

        {#if profileError}
          <p class="status status-error">{profileError}</p>
        {/if}

        {#if profileMessage}
          <p class="status status-success">{profileMessage}</p>
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
      <div class="section-title">
        <h2>Paid Vacation Picker</h2>
        <p>Weekends and holidays are locked as X</p>
      </div>

      <div class="legend">
        <span><i class="dot work"></i>Workday</span>
        <span><i class="dot vacation"></i>Paid Vacation</span>
        <span><i class="dot holiday"></i>Holiday (X)</span>
        <span><i class="dot blocked"></i>Weekend (X)</span>
      </div>

      <div class="weekday-row">
        {#each WEEKDAYS as day}
          <div>{day}</div>
        {/each}
      </div>

      <div class="calendar-grid">
        {#each calendarCells as cell (cell.key)}
          {#if cell.kind === 'empty'}
            <div class="day-cell empty" aria-hidden="true"></div>
          {:else}
            {@const item = cell.item}
            {@const blocked = item.isWeekend || item.isHoliday}
            <button
              type="button"
              class="day-cell"
              class:blocked={blocked}
              class:selected={item.isVacation}
              class:holidayCell={item.isHoliday}
              class:weekendCell={item.isWeekend && !item.isHoliday}
              on:click={() => toggleVacation(item)}
              disabled={blocked}
              aria-pressed={item.isVacation}
              aria-label={dayAriaLabel(item)}
              title={item.dateIso}
            >
              <strong>{item.day}</strong>
              {#if item.isHoliday}
                <em class="status-pill holiday-pill">X</em>
              {:else if item.isWeekend}
                <em class="status-pill weekend-pill">X</em>
              {:else if item.isVacation}
                <em class="status-pill vacation-pill">შ</em>
              {/if}
              <span>
                {#if item.isHoliday}
                  X Holiday
                {:else if item.isWeekend}
                  X Weekend
                {:else if item.isVacation}
                  შ Vacation
                {:else}
                  8 Work
                {/if}
              </span>
            </button>
          {/if}
        {/each}
      </div>

    </article>
  </section>

  <section class="summary-grid">
    <article class="card metric">
      <p>Worked Days</p>
      <strong>{workedDayCount}</strong>
      <small>{totalHours} hours total</small>
    </article>
    <article class="card metric">
      <p>Vacation</p>
      <strong>{vacationDayCount}</strong>
      <small>{vacationHours} paid hours</small>
    </article>
    <article class="card metric">
      <p>Weekday Holidays</p>
      <strong>{weekdayHolidayCount}</strong>
      <small>{blockedDayCount} blocked days overall</small>
    </article>
    <article class="card metric">
      <p>Month Split</p>
      <strong>{firstHalfHours} / {secondHalfHours}</strong>
      <small>First-half / second-half hours</small>
    </article>
  </section>
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

  .section-title h2 {
    margin: 0;
    font-size: 1.08rem;
    letter-spacing: -0.01em;
    color: var(--text-primary);
  }

  .section-title p {
    margin: var(--space-1) 0 0;
    color: var(--text-secondary);
    font-size: 0.85rem;
  }

  .period-shell {
    margin-top: var(--space-4);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    padding: var(--space-4);
    background: linear-gradient(165deg, rgba(248, 252, 255, 0.96), rgba(236, 245, 255, 0.88));
  }

  .period-header {
    display: grid;
    grid-template-columns: 44px 1fr 44px;
    gap: var(--space-2);
    align-items: center;
  }

  .period-label {
    text-align: center;
    font-weight: 700;
    letter-spacing: -0.01em;
    color: var(--text-primary);
  }

  .nav,
  .year-stepper button,
  .month-grid button,
  .button-row button {
    border: 0;
    cursor: pointer;
  }

  .nav {
    min-width: 44px;
    min-height: 44px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
    background: var(--surface-2);
    color: var(--accent-strong);
    font-weight: 700;
    transition: background-color 140ms ease, border-color 140ms ease;
  }

  .nav:hover {
    background: rgba(233, 243, 255, 0.95);
    border-color: var(--border-strong);
  }

  .year-stepper {
    margin-top: var(--space-3);
    display: grid;
    grid-template-columns: 44px 1fr 44px;
    gap: var(--space-2);
    align-items: center;
  }

  .year-stepper div {
    text-align: center;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
    background: var(--surface-2);
    padding: var(--space-2);
    font-weight: 650;
    color: var(--text-primary);
    min-height: 44px;
    display: grid;
    place-items: center;
  }

  .year-stepper button {
    min-width: 44px;
    min-height: 44px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
    background: var(--surface-2);
    color: var(--accent-strong);
    font-size: 1.1rem;
    line-height: 1;
    transition: background-color 140ms ease, border-color 140ms ease;
  }

  .year-stepper button:hover {
    background: rgba(233, 243, 255, 0.95);
    border-color: var(--border-strong);
  }

  .month-grid {
    margin-top: var(--space-3);
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: var(--space-2);
  }

  .month-grid button {
    border-radius: var(--radius-sm);
    min-height: 40px;
    padding: var(--space-2) var(--space-1);
    border: 1px solid var(--border-subtle);
    background: var(--surface-2);
    color: var(--text-secondary);
    font-size: 0.79rem;
    font-weight: 600;
    transition: background-color 140ms ease, border-color 140ms ease, color 140ms ease;
  }

  .month-grid button:hover {
    border-color: var(--border-strong);
    color: var(--text-primary);
    background: rgba(235, 244, 255, 0.95);
  }

  .month-grid button.active {
    background: linear-gradient(145deg, var(--accent), var(--accent-strong));
    color: #f8fbff;
    border-color: rgba(20, 74, 161, 0.85);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.22);
  }

  .fields-title {
    margin-top: var(--space-5);
  }

  .input-grid {
    margin-top: var(--space-3);
    display: grid;
    gap: var(--space-3);
  }

  .input-grid.editing input,
  .input-grid.editing select {
    border-color: var(--border-strong);
    background: rgba(247, 252, 255, 0.96);
  }

  .profile-actions {
    margin-top: var(--space-3);
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .ghost {
    min-height: 36px;
    border: 1px solid var(--border-subtle);
    background: rgba(243, 248, 255, 0.85);
    color: var(--accent-strong);
    border-radius: 999px;
    padding: 0.44rem 0.86rem;
    font-size: 0.79rem;
    font-weight: 650;
    transition: background-color 120ms ease, border-color 120ms ease;
  }

  .ghost:hover {
    background: rgba(233, 243, 255, 0.95);
    border-color: var(--border-strong);
  }

  .ghost.save {
    color: #1f6f53;
    border-color: rgba(73, 157, 119, 0.4);
    background: rgba(230, 249, 240, 0.95);
  }

  .ghost.cancel {
    color: #7a3d4d;
    border-color: rgba(168, 106, 125, 0.32);
    background: rgba(249, 241, 244, 0.92);
  }

  .ghost.reset {
    color: #63511c;
    border-color: rgba(157, 137, 76, 0.36);
    background: rgba(253, 248, 230, 0.94);
  }

  label {
    display: grid;
    gap: var(--space-2);
  }

  label span {
    color: var(--text-secondary);
    font-size: 0.82rem;
    font-weight: 600;
  }

  input,
  select {
    min-height: 42px;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    background: var(--surface-2);
    color: var(--text-primary);
    padding: 0.6rem 0.76rem;
    transition: border-color 120ms ease, background-color 120ms ease;
  }

  input:disabled {
    color: var(--text-secondary);
    background: rgba(244, 248, 253, 0.98);
    border-color: rgba(130, 156, 197, 0.35);
    cursor: not-allowed;
  }

  .button-row {
    margin-top: var(--space-4);
    display: flex;
    gap: var(--space-2);
  }

  .button-row button {
    border-radius: 999px;
    min-height: 44px;
    padding: 0.62rem 1.18rem;
    color: #fff;
    font-weight: 630;
    font-size: 0.94rem;
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
    transition: background-color 120ms ease, border-color 120ms ease, color 120ms ease;
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

  .status-success {
    color: #26684d;
    background: rgba(232, 248, 240, 0.92);
    border-color: rgba(78, 152, 117, 0.35);
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

  .calendar-panel {
    display: grid;
    align-content: start;
    gap: var(--space-3);
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    color: var(--text-secondary);
    font-size: 0.8rem;
  }

  .legend span {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }

  .dot {
    width: 0.58rem;
    height: 0.58rem;
    border-radius: 999px;
    display: inline-block;
  }

  .dot.work {
    background: #8da4c9;
  }

  .dot.vacation {
    background: var(--accent);
  }

  .dot.blocked {
    background: #9fa8b8;
  }

  .dot.holiday {
    background: #c07b88;
  }

  .weekday-row {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: var(--space-2);
    color: #5f7398;
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .weekday-row div {
    text-align: center;
    padding: var(--space-1) 0;
  }

  .calendar-grid {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: var(--space-2);
  }

  .day-cell {
    border: 1px solid var(--border-subtle);
    text-align: left;
    border-radius: var(--radius-md);
    background: rgba(255, 255, 255, 0.9);
    min-height: 72px;
    padding: 0.46rem 0.52rem;
    display: grid;
    gap: 0.18rem;
    position: relative;
    cursor: pointer;
    transition: transform 120ms ease, box-shadow 160ms ease, border-color 120ms ease;
  }

  .day-cell:not(.blocked):hover {
    transform: translateY(-1px);
    border-color: rgba(67, 115, 194, 0.55);
    box-shadow: 0 8px 14px rgba(55, 94, 156, 0.15);
  }

  .day-cell strong {
    font-size: 0.96rem;
    color: var(--text-primary);
  }

  .day-cell span {
    font-size: 0.72rem;
    color: var(--text-secondary);
  }

  .day-cell.selected {
    background: linear-gradient(145deg, #2f6fdd, #1f5fc8);
    border-color: rgba(20, 74, 161, 0.95);
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.24),
      0 10px 16px rgba(24, 67, 141, 0.24);
    transform: translateY(-1px);
  }

  .day-cell.selected strong,
  .day-cell.selected span {
    color: #f7fbff;
  }

  .day-cell.blocked {
    background: #f1f3f6;
    border-color: rgba(153, 164, 186, 0.42);
    opacity: 0.88;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }

  .day-cell.holidayCell {
    background: linear-gradient(145deg, #f6eaed, #f0dfe4);
    border-color: rgba(183, 117, 133, 0.55);
  }

  .day-cell.holidayCell strong {
    color: #7f3948;
  }

  .day-cell.weekendCell {
    background: linear-gradient(145deg, #eef1f5, #e7ebf1);
    border-color: rgba(136, 149, 173, 0.5);
  }

  .day-cell.empty {
    background: transparent;
    border: 1px dashed rgba(131, 160, 206, 0.2);
    cursor: default;
    box-shadow: none;
    transform: none;
  }

  .status-pill {
    position: absolute;
    top: 0.38rem;
    right: 0.36rem;
    width: 1.26rem;
    height: 1.26rem;
    display: grid;
    place-items: center;
    border-radius: 999px;
    font-style: normal;
    font-weight: 800;
    font-size: 0.75rem;
    line-height: 1;
  }

  .holiday-pill {
    background: #b35d6f;
    color: #fff;
    box-shadow: 0 6px 10px rgba(145, 73, 91, 0.24);
  }

  .weekend-pill {
    background: #7c8798;
    color: #fff;
  }

  .vacation-pill {
    background: #e9f1ff;
    color: #225fbe;
    border: 1px solid rgba(34, 95, 190, 0.46);
  }

  .day-cell.selected .vacation-pill {
    background: #fff;
    color: #1f60c3;
    border-color: transparent;
  }

  .summary-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--space-3);
  }

  .metric {
    padding: var(--space-4);
  }

  .metric p {
    margin: 0;
    color: var(--text-tertiary);
    font-size: 0.77rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .metric strong {
    margin-top: var(--space-2);
    display: block;
    font-size: 1.52rem;
    letter-spacing: -0.02em;
    color: var(--text-primary);
  }

  .metric small {
    color: var(--text-secondary);
    font-size: 0.78rem;
  }

  @media (max-width: 1140px) {
    .summary-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 1024px) {
    .layout {
      grid-template-columns: 1fr;
    }

    .calendar-grid .day-cell {
      min-height: 78px;
    }
  }

  @media (max-width: 760px) {
    .month-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    .hero-pill {
      align-self: flex-start;
    }

    .calendar-grid {
      gap: var(--space-1);
    }

    .calendar-grid .day-cell {
      min-height: 74px;
      padding: 0.42rem 0.42rem;
    }

    .weekday-row {
      gap: var(--space-1);
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

    .summary-grid {
      grid-template-columns: 1fr;
    }

    .day-cell {
      min-height: 68px;
    }
  }

  @media (max-width: 430px) {
    .month-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .weekday-row {
      font-size: 0.68rem;
    }

    .day-cell strong {
      font-size: 0.9rem;
    }

    .day-cell span {
      font-size: 0.68rem;
    }
  }
</style>
