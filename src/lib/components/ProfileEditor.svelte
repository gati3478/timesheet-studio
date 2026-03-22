<script lang="ts">
  export let draftCompanyCode: string;
  export let draftEmployeeName: string;
  export let draftEmployeeId: string;
  export let outputFormat: 'docx' | 'doc';
  export let isEditing: boolean;
  export let error: string;
  export let errorDetails: string[] = [];
  export let message: string;

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

{#if error}
  <div class="status status-error">
    <p>{error}</p>
    {#if errorDetails.length > 0}
      <ul class="status-list">
        {#each errorDetails as detail, i (i)}
          <li>{detail}</li>
        {/each}
      </ul>
    {/if}
  </div>
{/if}

{#if message}
  <p class="status status-success">{message}</p>
{/if}

<div class="input-grid" class:editing={isEditing} class:has-error={!!error}>
  <label>
    <span>Company Code</span>
    <input
      type="text"
      bind:value={draftCompanyCode}
      placeholder="e.g. 405627530"
      disabled={!isEditing}
    />
  </label>

  <label>
    <span>Employee Name</span>
    <input
      type="text"
      bind:value={draftEmployeeName}
      placeholder="e.g. First Last"
      disabled={!isEditing}
    />
  </label>

  <label>
    <span>Employee ID</span>
    <input
      type="text"
      bind:value={draftEmployeeId}
      placeholder="e.g. 01005031116"
      disabled={!isEditing}
    />
  </label>

  <label>
    <span>Output Format</span>
    <select bind:value={outputFormat}>
      <option value="docx">DOCX</option>
      {#if docExportAvailable}
        <option value="doc">DOC</option>
      {/if}
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
    min-height: 36px;
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
    padding-left: var(--space-3);
  }

  .input-grid.editing input,
  .input-grid.editing select {
    border-color: var(--accent);
    background: #fff;
    box-shadow: 0 0 0 1px rgba(47, 111, 221, 0.12);
  }

  .input-grid.has-error input:placeholder-shown {
    border-color: rgba(188, 96, 118, 0.6);
    box-shadow: 0 0 0 1px rgba(188, 96, 118, 0.12);
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

  input:disabled,
  select:disabled {
    color: var(--text-tertiary);
    background: rgba(235, 240, 248, 0.92);
    border-color: rgba(150, 170, 200, 0.3);
    cursor: not-allowed;
  }

  .status {
    margin: var(--space-3) 0 0;
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

  .status-error p {
    margin: 0;
  }

  .status-error p::before {
    content: '⚠ ';
  }

  .status-list {
    margin: var(--space-2) 0 0;
    padding-left: 1.25rem;
    font-size: 0.84rem;
  }

  .status-list li + li {
    margin-top: 0.2rem;
  }

  .status-success {
    color: #26684d;
    background: rgba(232, 248, 240, 0.92);
    border-color: rgba(78, 152, 117, 0.35);
  }

  .status-success::before {
    content: '✓ ';
  }
</style>
