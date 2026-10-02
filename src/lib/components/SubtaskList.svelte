<script lang="ts">
	import type { Subtask } from '$lib/types/common';
	import {
		MAX_SUBTASKS,
		createSubtask,
		moveSubtask,
		removeSubtask,
		renameSubtask,
		subtaskProgress,
		toggleSubtask
	} from '$lib/utils/subtasks';

	interface Props {
		subtasks?: Subtask[];
		/** Notifies the parent whenever the list changes (immutable updates). */
		onChange?: (next: Subtask[]) => void;
		disabled?: boolean;
		/** Compact rendering for use inside list rows / modals. */
		compact?: boolean;
	}

	let { subtasks = [], onChange, disabled = false, compact = false }: Props = $props();

	let draft = $state('');
	let editingId = $state<string | null>(null);
	let editingTitle = $state('');

	const progress = $derived(subtaskProgress(subtasks));
	const ordered = $derived([...subtasks].sort((a, b) => a.order - b.order));

	function update(next: Subtask[]) {
		onChange?.(next);
	}

	function handleAdd(event: SubmitEvent) {
		event.preventDefault();
		const title = draft.trim();
		if (!title || subtasks.length >= MAX_SUBTASKS) return;
		update([...ordered, createSubtask(title, ordered.length)]);
		draft = '';
	}

	function startEdit(subtask: Subtask) {
		editingId = subtask.id;
		editingTitle = subtask.title;
	}

	function commitEdit() {
		if (editingId) {
			const title = editingTitle.trim();
			if (title) update(renameSubtask(ordered, editingId, title));
		}
		editingId = null;
		editingTitle = '';
	}
</script>

<div class="subtasks" class:compact>
	<div class="subtasks-head">
		<span class="subtasks-label">Checklist</span>
		{#if progress.total > 0}
			<span class="subtasks-count" aria-live="polite">
				{progress.completed}/{progress.total}
			</span>
		{/if}
	</div>

	{#if progress.total > 0}
		<div
			class="subtask-bar"
			role="progressbar"
			aria-valuemin="0"
			aria-valuemax="100"
			aria-valuenow={progress.percent}
			aria-label="Progres checklist"
		>
			<span class="subtask-bar-fill" style="width: {progress.percent}%"></span>
		</div>
	{/if}

	<ul class="subtask-list">
		{#each ordered as subtask, index (subtask.id)}
			<li class="subtask-row">
				<label class="subtask-check">
					<input
						type="checkbox"
						checked={subtask.completed}
						disabled={disabled}
						onchange={() => update(toggleSubtask(ordered, subtask.id))}
					/>
					<span class="sr-only">Tandai "{subtask.title}"</span>
				</label>

				{#if editingId === subtask.id}
					<input
						class="subtask-edit"
						type="text"
						bind:value={editingTitle}
						maxlength="200"
						onblur={commitEdit}
						onkeydown={(event) => {
							if (event.key === 'Enter') {
								event.preventDefault();
								commitEdit();
							}
							if (event.key === 'Escape') {
								editingId = null;
								editingTitle = '';
							}
						}}
					/>
				{:else}
					<button
						type="button"
						class="subtask-title"
						class:done={subtask.completed}
						onclick={() => startEdit(subtask)}
						disabled={disabled}
						title="Klik untuk ubah"
					>
						{subtask.title}
					</button>
				{/if}

				<div class="subtask-actions">
					<button
						type="button"
						class="icon-btn"
						aria-label="Naikkan {subtask.title}"
						disabled={disabled || index === 0}
						onclick={() => update(moveSubtask(ordered, subtask.id, -1))}
					>
						↑
					</button>
					<button
						type="button"
						class="icon-btn"
						aria-label="Turunkan {subtask.title}"
						disabled={disabled || index === ordered.length - 1}
						onclick={() => update(moveSubtask(ordered, subtask.id, 1))}
					>
						↓
					</button>
					<button
						type="button"
						class="icon-btn danger"
						aria-label="Hapus {subtask.title}"
						disabled={disabled}
						onclick={() => update(removeSubtask(ordered, subtask.id))}
					>
						✕
					</button>
				</div>
			</li>
		{/each}
	</ul>

	{#if !disabled && subtasks.length < MAX_SUBTASKS}
		<form class="subtask-add" onsubmit={handleAdd}>
			<input
				type="text"
				bind:value={draft}
				placeholder="Tambah langkah…"
				maxlength="200"
				aria-label="Judul langkah baru"
			/>
			<button type="submit" class="btn btn-secondary btn-sm" disabled={!draft.trim()}>
				Tambah
			</button>
		</form>
	{/if}

	{#if subtasks.length === 0 && disabled}
		<p class="subtask-empty">Belum ada checklist.</p>
	{/if}
</div>

<style>
	.subtasks {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.subtasks-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.subtasks-label {
		font-size: 0.85rem;
		font-weight: 600;
	}

	.subtasks-count {
		font-size: 0.8rem;
		color: var(--color-text-muted);
		font-variant-numeric: tabular-nums;
	}

	.subtask-bar {
		height: 8px;
		background-color: var(--color-surface-alt);
		border-radius: var(--radius-full);
		overflow: hidden;
	}

	.subtask-bar-fill {
		display: block;
		height: 100%;
		background-color: var(--color-primary);
		transition: width 0.2s ease;
	}

	.subtask-list {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 2px;
		margin: 0;
		padding: 0;
	}

	.subtask-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 2rem;
	}

	.subtask-check {
		display: flex;
		align-items: center;
	}

	.subtask-title {
		flex: 1;
		text-align: left;
		background: none;
		border: none;
		padding: 2px 4px;
		font: inherit;
		color: inherit;
		cursor: text;
		border-radius: var(--radius-sm);
	}

	.subtask-title.done {
		text-decoration: line-through;
		color: var(--color-text-muted);
	}

	.subtask-title:hover:not(:disabled) {
		background-color: var(--color-surface-alt);
	}

	.subtask-edit {
		flex: 1;
		padding: 2px 6px;
		font: inherit;
	}

	.subtask-actions {
		display: flex;
		gap: 2px;
		opacity: 0.6;
	}

	.subtask-row:hover .subtask-actions,
	.subtask-row:focus-within .subtask-actions {
		opacity: 1;
	}

	.icon-btn {
		border: 1px solid var(--color-border);
		background-color: var(--color-surface);
		color: var(--color-text-muted);
		border-radius: var(--radius-md);
		width: 1.75rem;
		height: 1.75rem;
		line-height: 1;
		cursor: pointer;
		font-size: 0.8rem;
	}

	.icon-btn:hover:not(:disabled) {
		color: #fff;
		background-color: var(--color-primary);
		border-color: var(--color-primary);
	}

	.icon-btn:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}

	.icon-btn.danger:hover:not(:disabled) {
		color: #fff;
		background-color: var(--color-danger);
		border-color: transparent;
	}

	.subtask-add {
		display: flex;
		gap: var(--space-2);
	}

	.subtask-add input {
		flex: 1;
		padding: 4px 8px;
	}

	.subtask-empty {
		margin: 0;
		font-size: 0.8rem;
		color: var(--color-text-muted);
	}

	.compact .subtask-row {
		min-height: 1.6rem;
	}

	.compact .subtask-title {
		font-size: 0.9rem;
	}
</style>
