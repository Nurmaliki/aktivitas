<script lang="ts">
	interface Props {
		open: boolean;
		title?: string;
		message?: string;
		confirmLabel?: string;
		cancelLabel?: string;
		danger?: boolean;
		busy?: boolean;
		onConfirm: () => void;
		onCancel: () => void;
	}

	let {
		open,
		title = 'Konfirmasi',
		message = 'Apakah Anda yakin?',
		confirmLabel = 'Ya, lanjutkan',
		cancelLabel = 'Batal',
		danger = false,
		busy = false,
		onConfirm,
		onCancel
	}: Props = $props();

	let dialog = $state<HTMLDialogElement | null>(null);

	$effect(() => {
		const el = dialog;
		if (!el) return;
		if (open && !el.open) {
			el.showModal();
		} else if (!open && el.open) {
			el.close();
		}
	});

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && !busy) {
			event.preventDefault();
			onCancel();
		}
	}
</script>

<dialog
	bind:this={dialog}
	class="confirm-dialog"
	aria-labelledby="confirm-title"
	oncancel={(event) => {
		event.preventDefault();
		if (!busy) onCancel();
	}}
	onkeydown={handleKeydown}
>
	<div class="confirm-body">
		<h2 id="confirm-title" class="confirm-title">{title}</h2>
		<p class="confirm-message">{message}</p>
		<div class="confirm-actions">
			<button type="button" class="btn btn-secondary" onclick={onCancel} disabled={busy}>
				{cancelLabel}
			</button>
			<button
				type="button"
				class="btn {danger ? 'btn-danger' : 'btn-primary'}"
				onclick={onConfirm}
				disabled={busy}
			>
				{busy ? 'Memproses…' : confirmLabel}
			</button>
		</div>
	</div>
</dialog>

<style>
	.confirm-dialog {
		border: none;
		border-radius: var(--radius-lg);
		padding: 0;
		max-width: 26rem;
		width: calc(100% - 2rem);
		box-shadow: var(--shadow-lg);
		color: var(--color-text);
	}

	.confirm-dialog::backdrop {
		background-color: rgba(15, 23, 42, 0.45);
	}

	.confirm-body {
		padding: var(--space-5);
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.confirm-title {
		font-size: 1.1rem;
		font-weight: 700;
	}

	.confirm-message {
		color: var(--color-text-muted);
		font-size: 0.925rem;
	}

	.confirm-actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-3);
		margin-top: var(--space-2);
	}
</style>
