<script lang="ts">
  export let text: string;
  export let details: string[] = [];
  export let variant: 'error' | 'success' | 'info' = 'error';
</script>

{#if text}
  <p class="status status-{variant}">{text}</p>
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
</style>
