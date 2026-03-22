<script lang="ts">
  import { MONTHS } from '$lib/constants';

  export let year: number;
  export let month: number;
  export let monthLabel: string;
  export let onShiftMonth: (delta: number) => void;
  export let onChangeYear: (delta: number) => void;
  export let onSetMonth: (month: number) => void;
</script>

<div class="section-title">
  <h2>Reporting Period</h2>
  <p>Dedicated month and year selector</p>
</div>

<div class="period-shell">
  <div class="period-header">
    <button type="button" class="nav" on:click={() => onShiftMonth(-1)} aria-label="Previous month"
      >←</button
    >
    <div class="period-label">{monthLabel}</div>
    <button type="button" class="nav" on:click={() => onShiftMonth(1)} aria-label="Next month"
      >→</button
    >
  </div>

  <div class="year-stepper">
    <button type="button" on:click={() => onChangeYear(-1)} aria-label="Decrease year">−</button>
    <div>{year}</div>
    <button type="button" on:click={() => onChangeYear(1)} aria-label="Increase year">+</button>
  </div>

  <div class="month-grid">
    {#each MONTHS as m (m.value)}
      <button
        type="button"
        class:active={m.value === month}
        on:click={() => onSetMonth(m.value)}
        aria-pressed={m.value === month}
        aria-label={`Select ${m.label} ${year}`}
      >
        {m.short}
      </button>
    {/each}
  </div>
</div>

<style>
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
  .month-grid button {
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
    transition:
      background-color 140ms ease,
      border-color 140ms ease;
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
    transition:
      background-color 140ms ease,
      border-color 140ms ease;
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
    transition:
      background-color 140ms ease,
      border-color 140ms ease,
      color 140ms ease;
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

  @media (max-width: 760px) {
    .month-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }

  @media (max-width: 430px) {
    .month-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
</style>
