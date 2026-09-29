/**
 * Habit + HabitLog repository (IndexedDB).
 *
 * Keeps persistence details out of the store, so the UI depends only on this
 * module's interface (and could be swapped for a cloud/local hybrid later).
 *
 * Deletes are soft (tombstones with `deletedAt`) so a future sync layer can
 * propagate removals; reads filter out tombstoned records.
 */

import type { Habit, HabitInput, HabitLog } from '$lib/types/habit';
import { isValidHabit, isValidHabitLog } from '$lib/utils/validators';
import {
	DatabaseError,
	STORES,
	generateId,
	requestToPromise,
	withStore,
	withRawStore,
	waitForTransaction
} from './db-core';

function normalizeHabit(habit: Habit): Habit {
	return {
		...habit,
		targetPerPeriod:
			Number.isFinite(habit.targetPerPeriod) && habit.targetPerPeriod >= 1
				? Math.round(habit.targetPerPeriod)
				: 1,
		active: habit.active !== false,
		daysOfWeek: Array.isArray(habit.daysOfWeek)
			? [...new Set(habit.daysOfWeek.filter((d) => d >= 0 && d <= 6))].sort()
			: undefined
	};
}

export function getHabits(): Promise<Habit[]> {
	return withStore(
		'readonly',
		async (store) => {
			const raw = await requestToPromise<unknown[]>(store.getAll());
			return raw
				.filter(isValidHabit)
				.map(normalizeHabit)
				.filter((habit) => !habit.deletedAt);
		},
		STORES.habits
	);
}

export function getHabit(id: string): Promise<Habit | undefined> {
	return withStore(
		'readonly',
		async (store) => {
			const raw = await requestToPromise<unknown>(store.get(id));
			return isValidHabit(raw) ? normalizeHabit(raw) : undefined;
		},
		STORES.habits
	);
}

export function addHabit(input: HabitInput): Promise<Habit> {
	const now = new Date().toISOString();
	const habit = normalizeHabit({
		id: generateId(),
		name: input.name,
		description: input.description,
		categoryId: input.categoryId,
		frequency: input.frequency,
		daysOfWeek: input.daysOfWeek,
		targetPerPeriod: input.targetPerPeriod,
		reminder: input.reminder,
		active: input.active,
		createdAt: now,
		updatedAt: now,
		syncStatus: 'pending'
	});
	return withStore(
		'readwrite',
		async (store) => {
			await requestToPromise(store.add(habit));
			return habit;
		},
		STORES.habits
	);
}

export function updateHabit(id: string, changes: Partial<HabitInput>): Promise<Habit> {
	return withStore(
		'readwrite',
		async (store) => {
			const raw = await requestToPromise<unknown>(store.get(id));
			if (!isValidHabit(raw)) {
				throw new DatabaseError('Kebiasaan tidak ditemukan.');
			}
			const updated = normalizeHabit({
				...raw,
				...changes,
				id,
				createdAt: raw.createdAt,
				updatedAt: new Date().toISOString(),
				syncStatus: 'pending'
			});
			await requestToPromise(store.put(updated));
			return updated;
		},
		STORES.habits
	);
}

/** Soft-delete a habit (tombstone) so sync can propagate the removal. */
export function deleteHabit(id: string): Promise<void> {
	return withStore(
		'readwrite',
		async (store) => {
			const raw = await requestToPromise<unknown>(store.get(id));
			if (!isValidHabit(raw)) return;
			const now = new Date().toISOString();
			await requestToPromise(
				store.put({ ...raw, deletedAt: now, updatedAt: now, syncStatus: 'pending' })
			);
		},
		STORES.habits
	);
}

/** Permanently remove a habit (used by import "replace"). */
export function purgeHabit(id: string): Promise<void> {
	return withStore('readwrite', (store) => requestToPromise(store.delete(id)), STORES.habits);
}

export function purgeAllHabits(): Promise<void> {
	return withStore('readwrite', (store) => requestToPromise(store.clear()), STORES.habits);
}

// ---- Habit logs -----------------------------------------------------------

export function getHabitLogs(): Promise<HabitLog[]> {
	return withStore(
		'readonly',
		async (store) => {
			const raw = await requestToPromise<unknown[]>(store.getAll());
			return raw.filter(isValidHabitLog).filter((log) => !log.deletedAt);
		},
		STORES.habitLogs
	);
}

export function getHabitLogsByHabit(habitId: string): Promise<HabitLog[]> {
	return withStore(
		'readonly',
		async (store) => {
			const raw = await requestToPromise<unknown[]>(store.index('habitId').getAll(habitId));
			return raw.filter(isValidHabitLog).filter((log) => !log.deletedAt);
		},
		STORES.habitLogs
	);
}

/** Upsert a habit log for a given date (unique per habitId+date). */
export function putHabitLog(
	log: Omit<HabitLog, 'id' | 'updatedAt'> & { id?: string }
): Promise<HabitLog> {
	const now = new Date().toISOString();
	return withStore(
		'readwrite',
		async (store) => {
			const existingRaw = await requestToPromise<unknown>(
				store.index('habitId_date').get([log.habitId, log.date])
			);
			const existing = isValidHabitLog(existingRaw) ? existingRaw : null;
			const record: HabitLog = {
				id: existing?.id ?? log.id ?? generateId(),
				habitId: log.habitId,
				date: log.date,
				completed: log.completed,
				value: log.value,
				completedAt: log.completedAt,
				updatedAt: now,
				syncStatus: 'pending'
			};
			await requestToPromise(store.put(record));
			return record;
		},
		STORES.habitLogs
	);
}

/** Soft-delete (tombstone) a habit log. */
export function deleteHabitLog(id: string): Promise<void> {
	return withStore(
		'readwrite',
		async (store) => {
			const raw = await requestToPromise<unknown>(store.get(id));
			if (!isValidHabitLog(raw)) return;
			const now = new Date().toISOString();
			await requestToPromise(
				store.put({ ...raw, deletedAt: now, updatedAt: now, syncStatus: 'pending' })
			);
		},
		STORES.habitLogs
	);
}

export function purgeAllHabitLogs(): Promise<void> {
	return withStore('readwrite', (store) => requestToPromise(store.clear()), STORES.habitLogs);
}

/** Replace all habits + logs atomically (import "replace"). */
export async function replaceHabitsAndLogs(habits: Habit[], logs: HabitLog[]): Promise<void> {
	await withRawStore(
		'readwrite',
		(store, transaction) => {
			store.clear();
			for (const habit of habits) store.put(habit);
			return waitForTransaction(transaction);
		},
		STORES.habits
	);
	await withRawStore(
		'readwrite',
		(store, transaction) => {
			store.clear();
			for (const log of logs) store.put(log);
			return waitForTransaction(transaction);
		},
		STORES.habitLogs
	);
}

/** Merge habits by id (skip existing), returning count added. */
export function mergeHabits(habits: Habit[]): Promise<number> {
	return withRawStore(
		'readwrite',
		(store, transaction) =>
			new Promise<number>((resolve) => {
				const keysReq = store.getAllKeys();
				keysReq.onsuccess = () => {
					const existing = new Set(keysReq.result.map(String));
					let added = 0;
					for (const habit of habits) {
						if (existing.has(habit.id)) continue;
						store.put(habit);
						existing.add(habit.id);
						added += 1;
					}
					void transaction;
					resolve(added);
				};
				keysReq.onerror = () => resolve(0);
			}),
		STORES.habits
	);
}

/** Merge habit logs by (habitId,date), skipping duplicates. Returns count added. */
export function mergeHabitLogs(logs: HabitLog[]): Promise<number> {	return withRawStore(
		'readwrite',
		(store, transaction) =>
			new Promise<number>((resolve) => {
				const allReq = store.getAll();
				allReq.onsuccess = () => {
					const existing = new Set(
						allReq.result
							.filter(isValidHabitLog)
							.map((log) => `${log.habitId}::${log.date}`)
					);
					let added = 0;
					for (const log of logs) {
						const key = `${log.habitId}::${log.date}`;
						if (existing.has(key)) continue;
						store.put(log);
						existing.add(key);
						added += 1;
					}
					void transaction;
					resolve(added);
				};
				allReq.onerror = () => resolve(0);
			}),
		STORES.habitLogs
	);
}

/**
 * Force-write a habit, overwriting any existing record with the same id.
 * Used by the sync engine when a remote change wins the conflict.
 */
export function upsertHabit(habit: Habit): Promise<void> {
	if (!isValidHabit(habit)) return Promise.resolve();
	return withStore(
		'readwrite',
		async (store) => {
			await requestToPromise(store.put(habit));
		},
		STORES.habits
	);
}

/** Force-write a habit log (sync pull). Invalid records are ignored. */
export function upsertHabitLog(log: HabitLog): Promise<void> {
	if (!isValidHabitLog(log)) return Promise.resolve();
	return withStore(
		'readwrite',
		async (store) => {
			await requestToPromise(store.put(log));
		},
		STORES.habitLogs
	);
}
