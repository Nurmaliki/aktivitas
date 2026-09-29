<script lang="ts">
	import type { Activity } from '$lib/types/activity';
	import { formatDuration } from '$lib/utils/statistics';

	interface Props {
		activity: Activity;
		busy?: boolean;
		showDate?: boolean;
		onToggle: (id: string) => void;
		onEdit: (activity: Activity) => void;
		onDelete: (activity: Activity) => void;
	}

	let { activity, busy = false, showDate = false, onToggle, onEdit, onDelete }: Props = $props();

	const categoryClass = $derived(
		'badge category-' + activity.category.toLowerCase().replace(/[^a-z]/g, '')
	);
</script>

<li class="activity-item" class:completed={activity.completed}>
	<label class="activity-check">
		<input
			type="checkbox"
			checked={activity.completed}
			disabled={busy}
			onchange={() => onToggle(activity.id)}
			aria-label="Tandai {activity.name} sebagai {activity.completed
				? 'belum selesai'
				: 'selesai'}"
		/>
	</label>

	<div class="activity-main">
		<div class="activity-heading">
			<span class="activity-name">{activity.name}</span>
			<span class={categoryClass}>{activity.category}</span>
		</div>
		{#if activity.description}
			<p class="activity-description">{activity.description}</p>
		{/if}
		<div class="activity-meta">
			<span class="meta-duration" aria-label="Durasi">
				{formatDuration(activity.duration)}
			</span>
			<span class="meta-status">
				{activity.completed ? 'Selesai' : 'Belum selesai'}
			</span>
			{#if showDate}
				<span class="meta-date">{activity.date}</span>
			{/if}
		</div>
	</div>

	<div class="activity-actions">
		<button
			type="button"
			class="btn btn-ghost btn-sm"
			onclick={() => onEdit(activity)}
			disabled={busy}
			aria-label="Edit aktivitas {activity.name}"
		>
			Edit
		</button>
		<button
			type="button"
			class="btn btn-ghost btn-sm danger-text"
			onclick={() => onDelete(activity)}
			disabled={busy}
			aria-label="Hapus aktivitas {activity.name}"
		>
			Hapus
		</button>
	</div>
</li>

<style>
	.activity-item {
		display: flex;
		align-items: flex-start;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-2);
		border-bottom: 1px solid var(--color-border);
	}

	.activity-item:last-child {
		border-bottom: none;
	}

	.activity-check {
		display: flex;
		padding-top: 0.15rem;
	}

	.activity-check input {
		width: 1.15rem;
		height: 1.15rem;
		accent-color: var(--color-success);
		cursor: pointer;
	}

	.activity-main {
		flex: 1;
		min-width: 0;
	}

	.activity-heading {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex-wrap: wrap;
	}

	.activity-name {
		font-weight: 600;
		font-size: 0.95rem;
		word-break: break-word;
	}

	.completed .activity-name {
		text-decoration: line-through;
		text-decoration-color: var(--color-text-subtle);
		color: var(--color-text-muted);
	}

	.activity-description {
		font-size: 0.85rem;
		color: var(--color-text-muted);
		margin-top: 0.15rem;
		word-break: break-word;
	}

	.activity-meta {
		display: flex;
		gap: var(--space-3);
		margin-top: 0.35rem;
		font-size: 0.78rem;
		color: var(--color-text-subtle);
		flex-wrap: wrap;
	}

	.meta-duration {
		font-weight: 600;
		color: var(--color-text-muted);
	}

	.activity-item.completed .meta-status {
		color: var(--color-success);
		font-weight: 600;
	}

	.activity-actions {
		display: flex;
		gap: var(--space-1);
		flex-shrink: 0;
	}

	.danger-text {
		color: var(--color-danger);
	}

	.danger-text:hover:not(:disabled) {
		background-color: var(--color-danger-soft);
		color: var(--color-danger);
	}

	.category-development {
		background-color: #e0e7ff;
		color: #3730a3;
	}

	.category-meeting {
		background-color: #fef3c7;
		color: #92400e;
	}

	.category-learning {
		background-color: #dbeafe;
		color: #1e40af;
	}

	.category-exercise {
		background-color: #dcfce7;
		color: #166534;
	}

	.category-personal {
		background-color: #fae8ff;
		color: #86198f;
	}

	.category-other {
		background-color: #e2e8f0;
		color: #334155;
	}

	@media (max-width: 480px) {
		.activity-item {
			gap: var(--space-2);
			padding: var(--space-3) 0;
		}

		.activity-actions {
			flex-direction: column;
			align-items: flex-end;
			gap: 0;
		}

		.activity-actions .btn-sm {
			padding: 0.3rem 0.5rem;
		}
	}
</style>
