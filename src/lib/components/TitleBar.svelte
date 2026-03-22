<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { isTauriApp } from '$lib/tauri';

  type TauriWindow = {
    close(): Promise<void>;
    startDragging(): Promise<void>;
    toggleMaximize(): Promise<void>;
  };

  let isTauri = false;
  let appWindow: TauriWindow | null = null;
  let closeReady = false;

  onMount(async () => {
    if (isTauriApp()) {
      isTauri = true;
      document.body.classList.add('tauri-app');
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        appWindow = getCurrentWindow();
      } catch (error) {
        console.error('TitleBar: Failed to initialize Tauri window API.', error);
      } finally {
        closeReady = true;
      }
    }
  });

  onDestroy(() => {
    if (typeof document !== 'undefined') {
      document.body.classList.remove('tauri-app');
    }
  });

  function handleDragStart(e: MouseEvent): void {
    if (e.buttons !== 1) return;
    if (e.target instanceof Element && e.target.closest('.titlebar-close')) return;
    if (!appWindow) return;
    if (e.detail === 2) {
      appWindow.toggleMaximize();
    } else {
      appWindow.startDragging();
    }
  }

  async function handleClose(): Promise<void> {
    if (!appWindow) return;
    try {
      await appWindow.close();
    } catch (error) {
      console.error('TitleBar: Failed to close window.', error);
    }
  }
</script>

{#if isTauri}
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <header class="titlebar" data-tauri-drag-region on:mousedown={handleDragStart}>
    <span class="titlebar-label" data-tauri-drag-region>Timesheet Studio</span>
    <button
      type="button"
      class="titlebar-close"
      on:click={handleClose}
      disabled={!closeReady || !appWindow}
      aria-label="Close application"
      title="Close"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24">
        <path
          fill="currentColor"
          d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
        />
      </svg>
    </button>
  </header>
{/if}

<style>
  .titlebar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 38px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 0.5rem 0 1rem;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.97), rgba(248, 251, 255, 0.97));
    border-bottom: 1px solid var(--border-subtle);
    z-index: 9999;
    user-select: none;
    -webkit-user-select: none;
    app-region: drag;
    -webkit-app-region: drag;
  }

  .titlebar-label {
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--text-secondary);
    letter-spacing: -0.01em;
    pointer-events: none;
  }

  .titlebar-close {
    app-region: no-drag;
    -webkit-app-region: no-drag;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-tertiary);
    cursor: pointer;
    transition:
      background-color 120ms ease,
      color 120ms ease;
  }

  .titlebar-close:hover:not(:disabled) {
    background: rgba(220, 60, 80, 0.12);
    color: #c23050;
  }

  .titlebar-close:active:not(:disabled) {
    background: rgba(220, 60, 80, 0.22);
  }

  .titlebar-close:disabled {
    opacity: 0.4;
    cursor: default;
  }

  @media (prefers-reduced-motion: reduce) {
    .titlebar-close {
      transition: none;
    }
  }
</style>
