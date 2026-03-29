<script lang="ts">
  import { MONTHS, WEEKDAYS } from '$lib/constants';
  import type { CalendarCell, DayItem } from '$lib/calendar-types';

  export let year: number;
  export let selectedMonth: number;
  export let calendarCells: CalendarCell[];
  export let loadingHolidays: boolean = false;
  export let hasVacation: boolean = false;
  export let onBatchSetVacation: (dateIsos: string[], isVacation: boolean) => void;
  export let vacationCount: number = 0;
  export let onSelectAll: () => void = () => {};
  export let onClearAll: () => void = () => {};

  // ── Drag state ───────────────────────────────────────────
  let dragging = false;
  let dragIntent: 'select' | 'deselect' = 'select';
  let dragStartDay: number | null = null;
  let dragCurrentDay: number | null = null;

  $: dragRangeDates = (() => {
    if (!dragging || dragStartDay === null || dragCurrentDay === null) {
      return new Set<string>();
    }
    const lo = Math.min(dragStartDay, dragCurrentDay);
    const hi = Math.max(dragStartDay, dragCurrentDay);
    const dates = new Set<string>();
    for (const cell of calendarCells) {
      if (cell.kind !== 'day') continue;
      const item = cell.item;
      if (item.day >= lo && item.day <= hi && !item.isWeekend && !item.isHoliday) {
        dates.add(item.dateIso);
      }
    }
    return dates;
  })();

  function dayFromPoint(clientX: number, clientY: number): number | null {
    const el = document.elementFromPoint(clientX, clientY);
    if (!el) return null;
    const btn = (el as HTMLElement).closest('[data-day]') as HTMLElement | null;
    if (!btn) return null;
    const val = parseInt(btn.dataset.day!, 10);
    return Number.isFinite(val) ? val : null;
  }

  function dayStatus(item: DayItem): { pill?: string; pillClass?: string; label: string } {
    if (item.isHoliday) return { pill: 'X', pillClass: 'holiday-pill', label: 'X Holiday' };
    if (item.isWeekend) return { pill: 'X', pillClass: 'weekend-pill', label: 'X Weekend' };
    if (item.isVacation) return { pill: 'შ', pillClass: 'vacation-pill', label: 'შ Vacation' };
    return { label: '8 Work' };
  }

  function findDayItem(day: number): DayItem | null {
    const cell = calendarCells.find((c) => c.kind === 'day' && c.item.day === day);
    return cell?.kind === 'day' ? cell.item : null;
  }

  function resetDrag(): void {
    dragging = false;
    dragStartDay = null;
    dragCurrentDay = null;
  }

  function commitDrag(): void {
    if (loadingHolidays) {
      resetDrag();
      return;
    }
    const dates = [...dragRangeDates];
    if (dates.length > 0) {
      onBatchSetVacation(dates, dragIntent === 'select');
    }
    resetDrag();
  }

  function handlePointerDown(e: PointerEvent): void {
    if (loadingHolidays || dragging || e.button !== 0) return;
    const day = dayFromPoint(e.clientX, e.clientY);
    if (day === null) return;

    const item = findDayItem(day);
    if (!item || item.isWeekend || item.isHoliday) return;

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    dragging = true;
    dragStartDay = day;
    dragCurrentDay = day;
    dragIntent = item.isVacation ? 'deselect' : 'select';

    e.preventDefault();
  }

  function handlePointerMove(e: PointerEvent): void {
    if (!dragging) return;
    const day = dayFromPoint(e.clientX, e.clientY);
    if (day !== null && day !== dragCurrentDay) {
      dragCurrentDay = day;
    }
  }

  function handlePointerUp(): void {
    if (!dragging) return;
    commitDrag();
  }

  function handleCellClick(e: MouseEvent, item: DayItem): void {
    if (e.detail !== 0) return;
    if (loadingHolidays || item.isWeekend || item.isHoliday) return;
    onBatchSetVacation([item.dateIso], !item.isVacation);
  }

  function handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && dragging) {
      resetDrag();
    }
  }

  function handleWindowBlur(): void {
    if (dragging) resetDrag();
  }

  // ── Accessibility ────────────────────────────────────────
  function dayAriaLabel(item: DayItem): string {
    const date = `${MONTHS[selectedMonth - 1].label} ${item.day}, ${year}`;

    if (item.isHoliday) return `${date}. Holiday, unavailable.`;
    if (item.isWeekend) return `${date}. Weekend, unavailable.`;
    if (item.isVacation) return `${date}. Paid vacation selected. Activate to set as workday.`;
    return `${date}. Workday selected. Activate to set as paid vacation.`;
  }
</script>

<svelte:window on:keydown={handleKeyDown} on:blur={handleWindowBlur} />

<div class="section-title">
  <h2>Paid Vacation Picker</h2>
  <p>Weekends and holidays are locked as X</p>
</div>

<div class="legend-row">
  <div class="legend">
    <span><i class="dot work"></i>Workday</span>
    <span><i class="dot vacation"></i>Paid Vacation</span>
    <span><i class="dot holiday"></i>Holiday (X)</span>
    <span><i class="dot blocked"></i>Weekend (X)</span>
  </div>
  <div class="bulk-actions">
    {#if vacationCount > 0}
      <span class="vacation-count">{vacationCount} day{vacationCount !== 1 ? 's' : ''}</span>
    {/if}
    <button
      type="button"
      class="bulk-btn"
      on:click={onSelectAll}
      disabled={loadingHolidays}
      title="Mark all workdays as paid vacation"
    >
      Select all
    </button>
    <button
      type="button"
      class="bulk-btn clear"
      class:bulk-btn-hidden={!hasVacation}
      on:click={onClearAll}
      disabled={!hasVacation}
      title="Remove all vacation selections"
    >
      Clear
    </button>
  </div>
</div>

<div class="weekday-row">
  {#each WEEKDAYS as day (day)}
    <div>{day}</div>
  {/each}
</div>

<div class="calendar-wrapper" class:loading={loadingHolidays}>
  <div
    class="calendar-grid"
    class:dragging
    role="group"
    aria-label="Vacation day picker — drag across days to select a range"
    on:pointerdown={handlePointerDown}
    on:pointermove={handlePointerMove}
    on:pointerup={handlePointerUp}
  >
    {#each calendarCells as cell (cell.key)}
      {#if cell.kind === 'empty'}
        <div class="day-cell empty" aria-hidden="true"></div>
      {:else}
        {@const item = cell.item}
        {@const blocked = item.isWeekend || item.isHoliday}
        {@const status = dayStatus(item)}
        <button
          type="button"
          class="day-cell"
          class:blocked
          class:selected={item.isVacation}
          class:holidayCell={item.isHoliday}
          class:weekendCell={item.isWeekend && !item.isHoliday}
          class:drag-select={dragIntent === 'select' && dragRangeDates.has(item.dateIso)}
          class:drag-deselect={dragIntent === 'deselect' && dragRangeDates.has(item.dateIso)}
          on:click={(e) => handleCellClick(e, item)}
          data-day={item.day}
          disabled={blocked}
          aria-pressed={item.isVacation}
          aria-label={dayAriaLabel(item)}
          title={item.dateIso}
        >
          <strong>{item.day}</strong>
          {#if status.pill}
            <em class="status-pill {status.pillClass}">{status.pill}</em>
          {/if}
          <span>{status.label}</span>
        </button>
      {/if}
    {/each}
  </div>
  {#if loadingHolidays}
    <div class="loading-overlay" aria-hidden="true">
      <span
        >Refreshing holidays<span class="loading-dots"
          ><span>.</span><span>.</span><span>.</span></span
        ></span
      >
    </div>
  {/if}
</div>

<style>
  .legend-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3);
    flex-wrap: wrap;
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

  .bulk-actions {
    display: flex;
    gap: var(--space-2);
    flex-shrink: 0;
  }

  .bulk-btn {
    min-height: 44px;
    border: 1px solid var(--border-subtle);
    background: rgba(243, 248, 255, 0.85);
    color: var(--accent-strong);
    border-radius: 999px;
    padding: 0.3rem 0.7rem;
    font-size: 0.74rem;
    font-weight: 650;
    cursor: pointer;
    transition:
      background-color 120ms ease,
      border-color 120ms ease;
  }

  .bulk-btn:hover:not(:disabled) {
    background: rgba(233, 243, 255, 0.95);
    border-color: var(--border-strong);
  }

  .bulk-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .bulk-btn.clear {
    color: var(--color-destructive);
    border-color: rgba(168, 106, 125, 0.32);
    border-style: dashed;
    background: rgba(249, 241, 244, 0.92);
  }

  .bulk-btn.clear.bulk-btn-hidden {
    visibility: hidden;
    pointer-events: none;
  }

  .vacation-count {
    color: var(--accent-strong);
    font-size: 0.78rem;
    font-weight: 600;
    align-self: center;
    white-space: nowrap;
  }

  .calendar-wrapper {
    position: relative;
  }

  @keyframes shimmer {
    0% {
      opacity: 0.4;
    }
    50% {
      opacity: 0.55;
    }
    100% {
      opacity: 0.4;
    }
  }

  .calendar-wrapper.loading .calendar-grid {
    animation: shimmer 2s ease-in-out infinite;
    pointer-events: none;
  }

  .loading-overlay {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
  }

  .loading-overlay span {
    background: rgba(255, 255, 255, 0.92);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    padding: var(--space-2) var(--space-4);
    color: var(--text-secondary);
    font-size: 0.85rem;
    font-weight: 600;
    box-shadow: var(--shadow-sm);
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

  .loading-overlay .loading-dots span {
    animation: pulse-dots 1.4s infinite;
  }

  .loading-overlay .loading-dots span:nth-child(2) {
    animation-delay: 0.2s;
  }

  .loading-overlay .loading-dots span:nth-child(3) {
    animation-delay: 0.4s;
  }

  .dot {
    width: 0.72rem;
    height: 0.72rem;
    border-radius: 999px;
    display: inline-block;
    border: 1.5px solid transparent;
  }

  .dot.work {
    background: #8da4c9;
  }

  .dot.vacation {
    background: var(--accent);
  }

  .dot.blocked {
    background: transparent;
    border: 2px dashed #7a8496;
  }

  .dot.holiday {
    background: #c07b88;
    border-color: #a05a6a;
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
    touch-action: none;
  }

  .calendar-grid.dragging {
    user-select: none;
    -webkit-user-select: none;
  }

  .calendar-grid.dragging .day-cell:not(.blocked) {
    cursor: grabbing;
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
    transition:
      transform 120ms ease,
      box-shadow 160ms ease,
      border-color 120ms ease;
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
    background: linear-gradient(145deg, var(--accent), var(--accent-strong));
    border-color: rgba(31, 95, 200, 0.95);
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.24),
      0 10px 16px rgba(24, 67, 141, 0.24);
    transform: none;
  }

  .day-cell.selected strong,
  .day-cell.selected span {
    color: #fff;
  }

  .day-cell.drag-select {
    background: rgba(47, 111, 221, 0.12);
    border-color: rgba(47, 111, 221, 0.45);
    box-shadow: 0 0 0 1px rgba(47, 111, 221, 0.2);
    transform: translateY(-1px);
  }

  .day-cell.drag-select strong {
    color: var(--accent-strong);
  }

  .day-cell.drag-deselect {
    opacity: 0.5;
    border-color: rgba(168, 106, 125, 0.4);
    background: rgba(249, 241, 244, 0.7);
    transform: none;
    box-shadow: none;
  }

  .day-cell.selected.drag-deselect {
    background: linear-gradient(145deg, #8aa4cc, #7a94bc);
    border-color: rgba(100, 130, 175, 0.6);
    box-shadow: none;
    opacity: 0.55;
    transform: none;
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
    color: var(--accent-strong);
    border: 1px solid rgba(34, 95, 190, 0.46);
  }

  .day-cell.selected .vacation-pill {
    background: #fff;
    color: var(--accent-strong);
    border-color: transparent;
  }

  @media (max-width: 1024px) {
    .day-cell {
      min-height: 78px;
    }
  }

  @media (max-width: 760px) {
    .calendar-grid {
      gap: var(--space-1);
    }

    .day-cell {
      min-height: 74px;
      padding: 0.42rem 0.42rem;
    }

    .weekday-row {
      gap: var(--space-1);
    }
  }

  @media (max-width: 640px) {
    .day-cell {
      min-height: 68px;
    }
  }

  @media (max-width: 430px) {
    .calendar-grid {
      gap: 2px;
    }

    .weekday-row {
      font-size: 0.68rem;
      gap: 2px;
    }

    .day-cell strong {
      font-size: 0.9rem;
    }

    .day-cell span {
      display: none;
    }

    .status-pill {
      width: 1.22rem;
      height: 1.22rem;
      font-size: 0.72rem;
    }
  }
</style>
