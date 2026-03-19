<script lang="ts">
  import { MONTHS, WEEKDAYS } from '$lib/constants';
  import type { CalendarCell, DayItem } from '$lib/calendar-types';

  export let year: number;
  export let selectedMonth: number;
  export let calendarCells: CalendarCell[];
  export let onToggleVacation: (item: DayItem) => void;

  function dayAriaLabel(item: DayItem): string {
    const date = `${MONTHS[selectedMonth - 1].label} ${item.day}, ${year}`;

    if (item.isHoliday) return `${date}. Holiday, unavailable.`;
    if (item.isWeekend) return `${date}. Weekend, unavailable.`;
    if (item.isVacation) return `${date}. Paid vacation selected. Activate to set as workday.`;
    return `${date}. Workday selected. Activate to set as paid vacation.`;
  }
</script>

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
  {#each WEEKDAYS as day (day)}
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
        class:blocked
        class:selected={item.isVacation}
        class:holidayCell={item.isHoliday}
        class:weekendCell={item.isWeekend && !item.isHoliday}
        on:click={() => onToggleVacation(item)}
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

<style>
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
