<script lang="ts">
	import type { Activity } from '$lib/types/activity';
	import ActivityItem from '$lib/components/ActivityItem.svelte';

	interface Props {
		activities: Activity[];
		busy?: boolean;
		showDate?: boolean;
		emptyTitle?: string;
		emptyMessage?: string;
		emptyActionLabel?: string;
		onEmptyAction?: () => void;
		onToggle: (id: string) => void;
		onEdit: (activity: Activity) => void;
		onDelete: (activity: Activity) => void;
	}

	let {
		activities,
		busy = false,
		showDate = false,
		emptyTitle = 'Belum ada aktivitas.',
		emptyMessage = '',
		emptyActionLabel,
		onEmptyAction,
		onToggle,
		onEdit,
		onDelete
	}: Props = $props();
</script>

{#if activities.length === 0}
	<div class="empty-state">
		<div class="empty-icon" aria-hidden="true">📝</div>
		<p class="empty-title">{emptyTitle}</p>
		{#if emptyMessage}
			<p class="empty-message">{emptyMessage}</p>
		{/if}
		{#if emptyActionLabel && onEmptyAction}
			<button type="button" class="btn btn-primary" onclick={onEmptyAction}>
				{emptyActionLabel}
			</button>
		{/if}
	</div>
{:else}
	<ul class="activity-list" aria-label="Daftar aktivitas">
		{#each activities as activity (activity.id)}
			<ActivityItem
				{activity}
				{busy}
				{showDate}
				{onToggle}
				{onEdit}
				{onDelete}
			/>
		{/each}
	</ul>
{/if}

<style>
	.activity-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: var(--space-3);
		padding: var(--space-8) var(--space-4);
	}

	.empty-icon {
		font-size: 2rem;
		line-height: 1;
	}

	.empty-title {
		font-size: 1.05rem;
		font-weight: 700;
	}

	.empty-message {
		font-size: 0.9rem;
		color: var(--color-text-muted);
		max-width: 26rem;
	}
</style>
