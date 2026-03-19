<script lang="ts">
  export let workedDayCount: number;
  export let vacationDayCount: number;
  export let weekdayHolidayCount: number;
  export let blockedDayCount: number;
  export let totalHours: number;
  export let vacationHours: number;
  export let firstHalfHours: number;
  export let secondHalfHours: number;
</script>

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

<style>
  .summary-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--space-3);
  }

  .card {
    background: var(--surface-1);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-md);
    backdrop-filter: blur(6px);
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

  @media (max-width: 640px) {
    .summary-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
