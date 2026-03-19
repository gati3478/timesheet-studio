<script lang="ts">
  export let draftCompanyCode: string;
  export let draftEmployeeName: string;
  export let draftEmployeeId: string;
  export let outputFormat: 'docx' | 'doc';
  export let isEditing: boolean;
  export let error: string;
  export let message: string;

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

<div class="input-grid" class:editing={isEditing}>
  <label>
    <span>Company Code</span>
    <input
      type="text"
      bind:value={draftCompanyCode}
      placeholder="405627530"
      disabled={!isEditing}
    />
  </label>

  <label>
    <span>Employee Name</span>
    <input
      type="text"
      bind:value={draftEmployeeName}
      placeholder="Employee full name"
      disabled={!isEditing}
    />
  </label>

  <label>
    <span>Employee ID</span>
    <input
      type="text"
      bind:value={draftEmployeeId}
      placeholder="Personal ID"
      disabled={!isEditing}
    />
  </label>

  <label>
    <span>Output Format</span>
    <select bind:value={outputFormat}>
      <option value="docx">DOCX</option>
      <option value="doc">DOC</option>
    </select>
  </label>
</div>

{#if error}
  <p class="status status-error">{error}</p>
{/if}

{#if message}
  <p class="status status-success">{message}</p>
{/if}

<style>
  .section-title {
    margin-top: var(--space-5);
  }

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
  }

  .input-grid.editing input,
  .input-grid.editing select {
    border-color: var(--border-strong);
    background: rgba(247, 252, 255, 0.96);
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
      border-color 120ms ease,
      background-color 120ms ease;
  }

  input:disabled {
    color: var(--text-secondary);
    background: rgba(244, 248, 253, 0.98);
    border-color: rgba(130, 156, 197, 0.35);
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

  .status-success {
    color: #26684d;
    background: rgba(232, 248, 240, 0.92);
    border-color: rgba(78, 152, 117, 0.35);
  }
</style>
