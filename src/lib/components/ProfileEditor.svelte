<script lang="ts">
  import StatusMessage from './StatusMessage.svelte';
  import { NO_FIELD_ERRORS, type FieldErrors } from '$lib/profile';
  import type { OutputFormat } from '$lib/constants';

  export let draftCompanyCode: string;
  export let draftEmployeeName: string;
  export let draftEmployeeId: string;
  export let outputFormat: OutputFormat;
  export let isEditing: boolean;
  export let error: string;
  export let errorDetails: string[] = [];
  export let message: string;
  export let fieldErrors: FieldErrors = { ...NO_FIELD_ERRORS };

  export let docExportAvailable: boolean;

  export let onEdit: () => void;
  export let onSave: () => void;
  export let onCancel: () => void;
  export let onReset: () => void;
</script>

<div class="section-title">
  <h2>Document Fields</h2>
  <p>Values written to the official form</p>
</div>

<div class="profile-actions">
  {#if !isEditing}
    <button type="button" class="ghost" on:click={onEdit}>Edit Profile</button>
    <button type="button" class="ghost reset" on:click={onReset}>Reset</button>
  {:else}
    <button type="button" class="ghost save" on:click={onSave}>Save Profile</button>
    <button type="button" class="ghost cancel" on:click={onCancel}>Cancel</button>
  {/if}
</div>

<div class="profile-status" aria-live="assertive">
  <StatusMessage text={error} details={errorDetails} variant="error" />
  <StatusMessage text={message} variant="success" />
</div>

<div class="input-grid" class:editing={isEditing}>
  <label>
    <span>Company Code</span>
    <input
      type="text"
      bind:value={draftCompanyCode}
      placeholder="e.g. 123456789"
      disabled={!isEditing}
      class:field-error={fieldErrors.companyCode}
    />
    <small class="field-hint">6–12 digit numeric code</small>
  </label>

  <label>
    <span>Employee Name</span>
    <input
      type="text"
      bind:value={draftEmployeeName}
      placeholder="e.g. First Last"
      disabled={!isEditing}
      class:field-error={fieldErrors.employeeName}
    />
  </label>

  <label>
    <span>Employee ID</span>
    <input
      type="text"
      bind:value={draftEmployeeId}
      placeholder="e.g. 12345678901"
      disabled={!isEditing}
      class:field-error={fieldErrors.employeeId}
    />
    <small class="field-hint">Must be exactly 11 digits</small>
  </label>

  <label>
    <span>Output Format</span>
    <select bind:value={outputFormat} disabled={!isEditing}>
      {#if docExportAvailable}
        <option value="doc">DOC</option>
      {/if}
      <option value="docx">DOCX</option>
    </select>
  </label>
</div>

<style>
  .section-title {
    margin-top: var(--space-5);
  }

  .profile-actions {
    margin-top: var(--space-3);
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .ghost {
    min-height: 44px;
    border: 1px solid var(--border-subtle);
    background: rgba(243, 248, 255, 0.85);
    color: var(--accent-strong);
    border-radius: 999px;
    padding: 0.44rem 0.86rem;
    font-size: 0.79rem;
    font-weight: 650;
    cursor: pointer;
    transition:
      background-color 120ms ease,
      border-color 120ms ease;
  }

  .ghost:hover {
    background: rgba(233, 243, 255, 0.95);
    border-color: var(--border-strong);
  }

  .ghost.save {
    color: #fff;
    border-color: var(--accent);
    background: var(--accent);
  }

  .ghost.save:hover {
    background: var(--accent-strong);
    border-color: var(--accent-strong);
  }

  .ghost.cancel {
    color: var(--text-secondary);
    border-color: var(--border-subtle);
    background: rgba(243, 248, 255, 0.85);
  }

  .ghost.reset {
    color: #63511c;
    border-color: rgba(157, 137, 76, 0.36);
    background: rgba(253, 248, 230, 0.94);
  }

  .input-grid {
    margin-top: var(--space-3);
    display: grid;
    gap: var(--space-3);
    border-left: 3px solid transparent;
    padding-left: 0;
    transition:
      border-color 200ms ease,
      padding-left 200ms ease;
  }

  .input-grid.editing {
    border-left-color: var(--accent);
    padding: var(--space-3);
    background: rgba(234, 243, 255, 0.45);
    border-radius: var(--radius-sm);
  }

  .input-grid.editing input,
  .input-grid.editing select {
    border-color: var(--accent);
    background: #fff;
    box-shadow: 0 0 0 1px rgba(47, 111, 221, 0.12);
  }

  .input-grid.editing input.field-error {
    border-color: #c06878;
    border-width: 2px;
    background: rgba(252, 235, 240, 0.55);
    box-shadow: 0 0 0 1px rgba(192, 104, 120, 0.18);
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
    transition:
      border-color 180ms ease,
      background-color 180ms ease,
      box-shadow 180ms ease,
      color 180ms ease;
  }

  .profile-status:has(:global(.status)) {
    margin-top: var(--space-3);
  }

  .field-hint {
    color: var(--text-tertiary);
    font-size: 0.74rem;
    font-weight: 400;
    margin-top: calc(-1 * var(--space-1));
  }

  .input-grid:not(.editing) .field-hint {
    opacity: 0.55;
  }

  select {
    appearance: none;
    -webkit-appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23506a8e' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.75rem center;
    background-size: 0.65rem;
    padding-right: 2rem;
  }

  input:disabled,
  select:disabled {
    color: #506a8e;
    background: rgba(235, 240, 248, 0.92);
    border-color: rgba(150, 170, 200, 0.3);
    cursor: not-allowed;
  }

  input:disabled::placeholder {
    color: rgba(80, 106, 142, 0.55);
  }

  @media (max-width: 640px) {
    .profile-status :global(.status-list) {
      max-height: 4.5rem;
      overflow-y: auto;
      font-size: 0.78rem;
    }
  }
</style>
