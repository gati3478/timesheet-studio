<script lang="ts">
  import type { SummaryResult } from '$lib/calendar-types';

  export let summary: SummaryResult;
</script>

<section class="summary-grid">
  <article class="card metric">
    <p>Worked Days</p>
    <strong>{summary.workedDayCount}</strong>
    <small>{summary.totalHours} hours total</small>
  </article>
  <article class="card metric">
    <p>Vacation</p>
    <strong>{summary.vacationDayCount}</strong>
    <small>{summary.vacationHours} paid hours</small>
  </article>
  <article class="card metric">
    <p>Weekday Holidays</p>
    <strong>{summary.weekdayHolidayCount}</strong>
    <small>{summary.blockedDayCount} blocked days overall</small>
  </article>
  <article class="card metric">
    <p>Month Split</p>
    <strong
      >{summary.firstHalfHours} <span class="split-sep">|</span> {summary.secondHalfHours}</strong
    >
    <small>1st half hours | 2nd half hours</small>
  </article>
</section>

<style>
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
    margin-top: var(--space-3);
    display: block;
    font-size: 1.52rem;
    letter-spacing: -0.02em;
    color: var(--text-primary);
  }

  .split-sep {
    color: var(--text-tertiary);
    font-weight: 400;
    margin: 0 0.1em;
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
