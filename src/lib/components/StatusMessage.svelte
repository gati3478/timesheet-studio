<script lang="ts">
  export let text: string;
  export let details: string[] = [];
  export let variant: 'error' | 'success' | 'info' = 'error';
  export let onRetry: (() => void) | undefined = undefined;
</script>

{#if text}
  <p class="status status-{variant}">
    {text}
    {#if onRetry && variant === 'error'}
      <button type="button" class="retry-link" on:click={onRetry}>Try again</button>
    {/if}
  </p>
  {#if details.length > 0}
    <ul class="status-list variant-{variant}">
      {#each details as detail (detail)}
        <li>{detail}</li>
      {/each}
    </ul>
  {/if}
{/if}

<style>
  .variant-error {
    color: var(--color-error);
  }

  .variant-success {
    color: var(--color-success);
  }

  .variant-info {
    color: var(--color-info);
  }

  .retry-link {
    display: inline;
    background: none;
    border: none;
    color: inherit;
    text-decoration: underline;
    font: inherit;
    cursor: pointer;
    padding: 0;
    margin-left: 0.4em;
  }

  .retry-link:hover {
    opacity: 0.75;
  }
</style>
