import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Item, Routine, WeekKey, AppState } from '../types';
import { IDEAS_WEEK_KEY } from '../types';
// Default "now" time - January 13, 2026 at noon (Maintenance of original dev time)
const DEFAULT_NOW = '2026-01-13T12:00:00.000Z';

console.log('Store initializing with DEFAULT_NOW:', DEFAULT_NOW);

import {
    getWeekKey,
    compareWeekKeys
} from '../utils/timeUtils';
import {
    getVisibleWeeks,
    spawnTasksForRoutine,
    updateRoutineTasks,
    removeOutdatedRoutineTasks
} from '../utils/routineSpawner';
import { executeRolloverLogic } from '../utils/rolloverUtils';
import { api } from '../api/client';
import { mergeState } from '../utils/mergeUtils';
import dayjs from 'dayjs';

interface TaskStore extends AppState {
    syncStatus: 'idle' | 'syncing' | 'error' | 'offline';
    lastSyncTime?: number;

    // Actions
    completeItem: (id: string) => void;
    uncompleteItem: (id: string) => void;
    startItem: (id: string) => void;
    incrementProgress: (id: string, minutes: number) => void;
    incrementOccurrence: (id: string) => void;
    decrementOccurrence: (id: string) => void;
    reorderItem: (id: string, newOrderIndex: number, newWeek?: WeekKey) => void;
    moveToWeek: (id: string, week: WeekKey) => void;
    addItem: (title: string, week: WeekKey, orderIndex: number, options?: { minutesGoal?: number; targetCount?: number; dueDateISO?: string }) => string;
    updateItem: (id: string, updates: { title?: string; minutesGoal?: number; targetCount?: number; dueDateISO?: string; notes?: string }) => void;
    archiveItem: (id: string) => void;
    unarchiveItem: (id: string) => void;
    deleteItem: (id: string) => void;
    deleteRoutine: (id: string, removeRelatedTasks: boolean) => void;
    addRoutine: (routine: Omit<Routine, 'id'>) => string;
    updateRoutine: (id: string, updates: Partial<Routine>, overwriteModifiedNotes?: boolean) => void;
    spawnRoutineTasks: () => void;
    rolloverPastItems: () => void;
    executeRollover: () => void;
    advanceTime: (days: number) => void;
    setTime: (isoTime: string) => void;
    toggleAllowUncomplete: () => void;
    resetData: () => void;

    // Time Management
    isTimeFrozen: boolean;
    toggleTimeFreeze: () => void;
    resetTime: () => void;

    // Sync Actions
    hydrateFromApi: () => Promise<void>;
    triggerSync: () => void;

    // Computed helpers
    getPresentWeek: () => WeekKey;
    getVisibleItems: () => Item[];
    getIdeasItems: () => Item[];
    getArchivedItems: () => Item[];
}

import { getInitialData } from '../utils/initialization';

const initialData = getInitialData();
const DATA_VERSION = 0;

let syncTimeout: any = null;

export const useTaskStore = create<TaskStore>()(
    persist(
        (set, get) => ({
            items: initialData.items,
            routines: initialData.routines,
            currentTime: DEFAULT_NOW,
            isTimeFrozen: false,
            allowUncomplete: false,
            userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            dataVersion: DATA_VERSION,
            syncStatus: 'idle',

            triggerSync: () => {
                if (syncTimeout) clearTimeout(syncTimeout);

                set({ syncStatus: 'syncing' });

                syncTimeout = setTimeout(async () => {
                    const state = get();
                    // Strip functions and UI state
                    const payload: AppState = {
                        items: state.items,
                        routines: state.routines,
                        currentTime: state.currentTime,
                        allowUncomplete: state.allowUncomplete,
                        userTimezone: state.userTimezone,
                        lastRolledWeek: state.lastRolledWeek,
                        dataVersion: state.dataVersion,
                    };

                    try {
                        const response = await api.syncData(payload, state.dataVersion);

                        if (response.status === 204 || response.status === 200) {
                            const newVersion = parseInt(response.headers?.get('ETag')?.replace(/"/g, '') || '0', 10);
                            set({
                                syncStatus: 'idle',
                                lastSyncTime: Date.now(),
                                dataVersion: newVersion || state.dataVersion // Updates version
                            });
                        }
                    } catch (err: any) {
                        console.error('Sync failed', err);

                        if (err.status === 412) {
                            // Conflict!
                            // Re-fetch logic
                            try {
                                const remoteData = await api.fetchData(); // Fetch latest
                                if (remoteData.data) {
                                    const currentState = get();
                                    const merged = mergeState(currentState, remoteData.data);
                                    set({
                                        ...merged,
                                        dataVersion: remoteData.version || currentState.dataVersion,
                                        syncStatus: 'idle'
                                    });
                                    // Optionally verify/sync back immediately
                                } else if (remoteData.version === 0) {
                                    // Server is empty/reset. We should adopt version 0 as base so next sync works.
                                    // This handles "First push to empty server" if local was > 0.
                                    set({ dataVersion: 0 });
                                    // Trigger sync again immediately
                                    get().triggerSync();
                                }
                            } catch (fetchErr) {
                                set({ syncStatus: 'error' });
                            }
                        } else {
                            set({ syncStatus: 'error' });
                        }
                    }
                }, 1000); // Debounce 1s
            },

            hydrateFromApi: async () => {
                set({ syncStatus: 'syncing' });
                try {
                    const currentVersion = get().dataVersion;
                    const response = await api.fetchData(currentVersion);

                    if (response.status === 304) {
                        set({ syncStatus: 'idle', lastSyncTime: Date.now() });
                        return;
                    }

                    if (response.data) {
                        const serverVersion = response.version || 0;

                        // If server version is 1, it was deliberately reset/cleared
                        // Don't merge - just replace entirely
                        if (serverVersion === 1) {
                            set({
                                items: response.data.items || [],
                                routines: response.data.routines || [],
                                dataVersion: 1,
                                syncStatus: 'idle',
                                lastSyncTime: Date.now()
                            });
                            return;
                        }

                        const currentState = get();
                        const merged = mergeState(currentState, response.data);
                        set({
                            ...merged,
                            dataVersion: serverVersion || currentState.dataVersion,
                            syncStatus: 'idle',
                            lastSyncTime: Date.now()
                        });
                    } else {
                        set({ syncStatus: 'idle' });
                    }
                } catch (err) {
                    console.error('Hydrate failed', err);
                    set({ syncStatus: 'error' });
                }
            },

            completeItem: (id: string) => {
                const { currentTime, triggerSync, items } = get();
                const item = items.find(i => i.id === id);

                // Prevent completing ideas
                if (item?.week === IDEAS_WEEK_KEY) {
                    return;
                }

                const nowTs = Date.now();
                set((state) => ({
                    items: state.items.map((item) =>
                        item.id === id
                            ? {
                                ...item,
                                status: 'complete' as const,
                                completedAt: currentTime,
                                updatedAt: nowTs
                            }
                            : item
                    ),
                }));
                triggerSync();
            },

            uncompleteItem: (id: string) => {
                const { triggerSync } = get();
                const nowTs = Date.now();
                set((state) => ({
                    items: state.items.map((i) =>
                        i.id === id
                            ? {
                                ...i,
                                status: 'incomplete' as const,
                                completedAt: undefined,
                                updatedAt: nowTs
                            }
                            : i
                    ),
                }));
                triggerSync();
            },

            startItem: (id: string) => {
                const { getPresentWeek, triggerSync } = get();
                const presentWeek = getPresentWeek();
                const nowTs = Date.now();

                set((state) => {
                    const item = state.items.find((i) => i.id === id);
                    if (!item || item.week === presentWeek) return state;

                    const presentIncomplete = state.items.filter(
                        (i) => i.week === presentWeek && i.status === 'incomplete' && !i.deletedAt
                    );
                    const maxOrder = Math.max(0, ...presentIncomplete.map((i) => i.orderIndex));

                    return {
                        items: state.items.map((i) =>
                            i.id === id
                                ? {
                                    ...i,
                                    week: presentWeek,
                                    orderIndex: maxOrder + 1,
                                    updatedAt: nowTs
                                }
                                : i
                        ),
                    };
                });
                triggerSync();
            },

            incrementProgress: (id: string, minutes: number) => {
                const { currentTime, triggerSync } = get();
                const nowTs = Date.now();
                set((state) => ({
                    items: state.items.map((item) => {
                        if (item.id !== id) return item;

                        const newMinutes = (item.minutes ?? 0) + minutes;
                        const minutesGoal = item.minutesGoal ?? 0;
                        const minutesMet = minutesGoal === 0 || newMinutes >= minutesGoal;
                        const countMet = !item.targetCount || (item.completedCount ?? 0) >= item.targetCount;

                        if (minutesMet && countMet && item.status === 'incomplete') {
                            return {
                                ...item,
                                minutes: newMinutes,
                                status: 'complete' as const,
                                completedAt: currentTime,
                                updatedAt: nowTs
                            };
                        }

                        return { ...item, minutes: newMinutes, updatedAt: nowTs };
                    }),
                }));
                triggerSync();
            },

            incrementOccurrence: (id: string) => {
                const { currentTime, triggerSync } = get();
                const nowTs = Date.now();
                set((state) => ({
                    items: state.items.map((item) => {
                        if (item.id !== id) return item;

                        const currentCount = item.completedCount ?? 0;
                        const targetCount = item.targetCount ?? 1;
                        const newCount = currentCount + 1;

                        const countMet = newCount >= targetCount;
                        const minutesMet = !item.minutesGoal || (item.minutes ?? 0) >= item.minutesGoal;

                        if (countMet && minutesMet) {
                            return {
                                ...item,
                                completedCount: newCount,
                                status: 'complete' as const,
                                completedAt: currentTime,
                                updatedAt: nowTs
                            };
                        }

                        return {
                            ...item,
                            completedCount: newCount,
                            updatedAt: nowTs
                        };
                    }),
                }));
                triggerSync();
            },

            decrementOccurrence: (id: string) => {
                const { triggerSync } = get();
                const nowTs = Date.now();
                set((state) => ({
                    items: state.items.map((item) => {
                        if (item.id !== id) return item;

                        const currentCount = item.completedCount ?? 0;
                        if (currentCount <= 0) return item;

                        return {
                            ...item,
                            completedCount: currentCount - 1,
                            status: 'incomplete' as const,
                            completedAt: undefined,
                            updatedAt: nowTs
                        };
                    }),
                }));
                triggerSync();
            },

            reorderItem: (id: string, newOrderIndex: number, newWeek?: WeekKey) => {
                const { triggerSync } = get();
                const nowTs = Date.now();
                set((state) => {
                    const item = state.items.find((i) => i.id === id);
                    if (!item) return state;

                    const targetWeek = newWeek ?? item.week;

                    const weekItems = state.items
                        .filter((i) => i.week === targetWeek && !i.archived && i.id !== id && !i.deletedAt)
                        .sort((a, b) => a.orderIndex - b.orderIndex);

                    const reorderedItems = [...weekItems];
                    const insertIndex = Math.min(newOrderIndex, reorderedItems.length);
                    reorderedItems.splice(insertIndex, 0, { ...item, week: targetWeek });

                    const updates = new Map<string, { orderIndex: number; week: WeekKey; updatedAt: number }>();
                    reorderedItems.forEach((i, idx) => {
                        updates.set(i.id, { orderIndex: idx, week: targetWeek, updatedAt: nowTs });
                    });

                    return {
                        items: state.items.map((i) => {
                            const update = updates.get(i.id);
                            if (update) {
                                return { ...i, ...update };
                            }
                            return i;
                        }),
                    };
                });
                triggerSync();
            },

            moveToWeek: (id: string, week: WeekKey) => {
                const { triggerSync } = get();
                const nowTs = Date.now();
                set((state) => {
                    const item = state.items.find((i) => i.id === id);
                    if (!item) return state;

                    const weekIncomplete = state.items.filter(
                        (i) => i.week === week && i.status === 'incomplete' && !i.deletedAt
                    );
                    const maxOrder = Math.max(0, ...weekIncomplete.map((i) => i.orderIndex));

                    return {
                        items: state.items.map((i) =>
                            i.id === id
                                ? { ...i, week, orderIndex: maxOrder + 1, updatedAt: nowTs }
                                : i
                        ),
                    };
                });
                triggerSync();
            },

            addItem: (title: string, week: WeekKey, orderIndex: number, options?: { minutesGoal?: number; targetCount?: number; dueDateISO?: string }) => {
                const { triggerSync } = get();
                const id = `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                const nowTs = Date.now();

                set((state) => {
                    const updatedItems = state.items.map((item) => {
                        if (item.week === week && !item.archived && !item.deletedAt && item.orderIndex >= orderIndex) {
                            return { ...item, orderIndex: item.orderIndex + 1, updatedAt: nowTs };
                        }
                        return item;
                    });

                    const newItem: Item = {
                        id,
                        title,
                        week,
                        status: 'incomplete',
                        orderIndex,
                        ...(options?.minutesGoal && { minutesGoal: options.minutesGoal, minutes: 0 }),
                        ...(options?.targetCount && options.targetCount > 1 && { targetCount: options.targetCount, completedCount: 0 }),
                        ...(options?.dueDateISO && { hasDueDate: true, dueDateISO: options.dueDateISO }),
                        updatedAt: nowTs
                    };

                    return { items: [...updatedItems, newItem] };
                });
                triggerSync();
                return id;
            },

            updateItem: (id: string, updates: { title?: string; minutesGoal?: number; targetCount?: number; dueDateISO?: string; notes?: string }) => {
                const { triggerSync } = get();
                const nowTs = Date.now();
                set((state) => ({
                    items: state.items.map((item) => {
                        if (item.id !== id) return item;

                        const updated = { ...item, updatedAt: nowTs };

                        if (updates.title !== undefined) updated.title = updates.title;
                        if (updates.minutesGoal !== undefined) {
                            updated.minutesGoal = updates.minutesGoal;
                            if (updates.minutesGoal > 0 && updated.minutes === undefined) {
                                updated.minutes = 0;
                            }
                        }
                        if (updates.targetCount !== undefined) {
                            updated.targetCount = updates.targetCount > 1 ? updates.targetCount : undefined;
                            if (updates.targetCount > 1 && updated.completedCount === undefined) {
                                updated.completedCount = 0;
                            }
                        }
                        if (updates.dueDateISO !== undefined) {
                            updated.dueDateISO = updates.dueDateISO || undefined;
                            updated.hasDueDate = !!updates.dueDateISO;
                        }
                        if (updates.notes !== undefined) {
                            updated.notes = updates.notes.slice(0, 1200) || undefined;
                        }

                        const minutesMet = !updated.minutesGoal || (updated.minutes ?? 0) >= updated.minutesGoal;
                        const countMet = !updated.targetCount || (updated.completedCount ?? 0) >= updated.targetCount;
                        const requirementsMet = minutesMet && countMet;

                        if (updated.status === 'complete' && !requirementsMet) {
                            updated.status = 'incomplete';
                            updated.completedAt = undefined;
                        }

                        return updated;
                    }),
                }));
                triggerSync();
            },

            deleteRoutine: (id: string, removeRelatedTasks: boolean) => {
                const { triggerSync } = get();
                const nowTs = Date.now();
                set((state) => {
                    const routine = state.routines.find(r => r.id === id);
                    if (!routine) return state;

                    let updatedItems = state.items;

                    if (removeRelatedTasks) {
                        updatedItems = state.items.map(item => {
                            if (item.routineId !== id) return item;
                            const hasProgress = (item.minutes && item.minutes > 0) ||
                                (item.completedCount && item.completedCount > 0) ||
                                item.status !== 'incomplete';
                            if (!hasProgress) {
                                return { ...item, deletedAt: nowTs, updatedAt: nowTs };
                            }
                            return item;
                        });
                    }

                    const updatedRoutines = state.routines.map(r =>
                        r.id === id ? { ...r, deletedAt: nowTs, updatedAt: nowTs } : r
                    );

                    return {
                        routines: updatedRoutines,
                        items: updatedItems,
                    };
                });
                triggerSync();
            },

            addRoutine: (routineData: Omit<Routine, 'id'>) => {
                const { triggerSync } = get();
                const nowTs = Date.now();
                const id = `routine-${nowTs}-${Math.random().toString(36).substr(2, 9)}`;
                const routine: Routine = { ...routineData, id, updatedAt: nowTs };

                set((state) => {
                    const newRoutines = [...state.routines, routine];
                    const visibleWeeks = getVisibleWeeks(state.currentTime);
                    const newTasks = spawnTasksForRoutine(routine, visibleWeeks, state.items);
                    const newTasksStamped = newTasks.map(t => ({ ...t, updatedAt: nowTs }));

                    return {
                        routines: newRoutines,
                        items: [...state.items, ...newTasksStamped],
                    };
                });
                triggerSync();
                return id;
            },

            updateRoutine: (id: string, updates: Partial<Routine>, overwriteModifiedNotes?: boolean) => {
                const { triggerSync } = get();
                const nowTs = Date.now();
                set((state) => {
                    const routineIndex = state.routines.findIndex(r => r.id === id);
                    if (routineIndex === -1) return state;

                    const updatedRoutine = { ...state.routines[routineIndex], ...updates, updatedAt: nowTs };
                    const newRoutines = [...state.routines];
                    newRoutines[routineIndex] = updatedRoutine;

                    const itemsAfterRemoval = removeOutdatedRoutineTasks(updatedRoutine, state.items);

                    // Handle note updates with overwrite option
                    let updatedItems = updateRoutineTasks(updatedRoutine, itemsAfterRemoval);

                    // If overwriteModifiedNotes is true, force update notes on all incomplete tasks
                    if (overwriteModifiedNotes && updates.notes !== undefined) {
                        updatedItems = updatedItems.map(item => {
                            if (item.routineId !== id) return item;
                            if (item.status !== 'incomplete') return item;
                            if (item.deletedAt) return item;
                            return {
                                ...item,
                                notes: updates.notes,
                                inheritedNotes: updates.notes,
                                updatedAt: nowTs,
                            };
                        });
                    }

                    const visibleWeeks = getVisibleWeeks(state.currentTime);
                    const newTasks = spawnTasksForRoutine(updatedRoutine, visibleWeeks, updatedItems);
                    const newTasksStamped = newTasks.map(t => ({ ...t, updatedAt: nowTs }));

                    return {
                        routines: newRoutines,
                        items: [...updatedItems, ...newTasksStamped],
                    };
                });
                triggerSync();
            },

            spawnRoutineTasks: () => {
                const { triggerSync } = get();
                const nowTs = Date.now();
                set((state) => {
                    const visibleWeeks = getVisibleWeeks(state.currentTime);
                    let allItems = [...state.items];
                    for (const routine of state.routines) {
                        if (routine.deletedAt) continue;
                        const newTasks = spawnTasksForRoutine(routine, visibleWeeks, allItems);
                        const newTasksStamped = newTasks.map(t => ({ ...t, updatedAt: nowTs }));
                        allItems = [...allItems, ...newTasksStamped];
                    }
                    return { items: allItems };
                });
                triggerSync();
            },

            rolloverPastItems: () => {
                const { triggerSync } = get();
                const nowTs = Date.now();
                set((state) => {
                    const presentWeek = getWeekKey(state.currentTime);
                    const updatedItems = state.items.map(item => {
                        if (item.deletedAt) return item;
                        if (item.week === IDEAS_WEEK_KEY) return item;
                        if (compareWeekKeys(item.week, presentWeek) >= 0) return item;
                        if (item.status === 'complete' || item.archived) return item;
                        return {
                            ...item,
                            week: presentWeek,
                            originalWeek: item.originalWeek || item.week,
                            updatedAt: nowTs
                        };
                    });
                    return { items: updatedItems };
                });
                triggerSync();
            },

            executeRollover: () => {
                const { triggerSync } = get();
                set((state) => {
                    const now = dayjs(state.currentTime);
                    const daysUntilSunday = (7 - now.day()) % 7 || 7;
                    const newTime = now.add(daysUntilSunday, 'day').startOf('day').toISOString();
                    const oldPresentWeek = getWeekKey(state.currentTime);
                    const newPresentWeek = getWeekKey(newTime);

                    if (oldPresentWeek === newPresentWeek) {
                        const advancedTime = dayjs(newTime).add(7, 'day').toISOString();
                        const result = executeRolloverLogic(state, getWeekKey(advancedTime), advancedTime);
                        return result;
                    }

                    return executeRolloverLogic(state, newPresentWeek, newTime);
                });
                triggerSync();
            },

            advanceTime: (days: number) => {
                set((state) => ({
                    currentTime: dayjs(state.currentTime).add(days, 'day').toISOString(),
                }));
                get().rolloverPastItems();
            },

            setTime: (isoTime: string) => {
                set({ currentTime: isoTime });
            },

            toggleAllowUncomplete: () => {
                set((state) => ({ allowUncomplete: !state.allowUncomplete }));
            },

            resetData: () => {
                // Reset to empty state
                set({
                    items: [],
                    routines: [],
                    dataVersion: 1,
                });
                const { triggerSync } = get();
                triggerSync();
            },

            toggleTimeFreeze: () => {
                set((state) => ({ isTimeFrozen: !state.isTimeFrozen }));
            },

            resetTime: () => {
                set({
                    currentTime: new Date().toISOString(),
                    isTimeFrozen: false
                });
            },

            archiveItem: (id: string) => {
                const { triggerSync } = get();
                const nowTs = Date.now();
                set((state) => ({
                    items: state.items.map((item) =>
                        item.id === id
                            ? { ...item, archived: true, updatedAt: nowTs }
                            : item
                    ),
                }));
                triggerSync();
            },

            deleteItem: (id: string) => {
                const { triggerSync } = get();
                const nowTs = Date.now();
                set((state) => ({
                    items: state.items.map(item => item.id === id ? { ...item, deletedAt: nowTs, updatedAt: nowTs } : item),
                }));
                triggerSync();
            },

            unarchiveItem: (id: string) => {
                const { triggerSync } = get();
                const nowTs = Date.now();
                set((state) => {
                    const item = state.items.find((i) => i.id === id);
                    if (!item) return state;
                    const updatedItems = state.items.map((i) => {
                        if (i.id === id) {
                            return { ...i, archived: false, orderIndex: 0, updatedAt: nowTs };
                        }
                        if (i.week === item.week && !i.archived && !i.deletedAt) {
                            return { ...i, orderIndex: i.orderIndex + 1, updatedAt: nowTs };
                        }
                        return i;
                    });
                    return { items: updatedItems };
                });
                triggerSync();
            },

            getPresentWeek: () => {
                const { currentTime } = get();
                return getWeekKey(currentTime);
            },

            getVisibleItems: () => {
                const { items } = get();
                return items
                    .filter((item) => !item.archived && !item.deletedAt && item.week !== IDEAS_WEEK_KEY)
                    .sort((a, b) => {
                        const weekCompare = compareWeekKeys(a.week, b.week);
                        if (weekCompare !== 0) return weekCompare;
                        return a.orderIndex - b.orderIndex;
                    });
            },

            getIdeasItems: () => {
                const { items } = get();
                return items
                    .filter((item) => !item.archived && !item.deletedAt && item.week === IDEAS_WEEK_KEY)
                    .sort((a, b) => a.orderIndex - b.orderIndex);
            },

            getArchivedItems: () => {
                const { items } = get();
                return items
                    .filter((item) => item.archived && !item.deletedAt)
                    .sort((a, b) => {
                        if (a.completedAt && b.completedAt) {
                            return new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime();
                        }
                        return 0;
                    });
            },
        }),
        {
            name: 'task-list-storage',
            partialize: (state) => ({
                items: state.items,
                routines: state.routines,
                currentTime: state.currentTime,
                allowUncomplete: state.allowUncomplete,
                userTimezone: state.userTimezone,
                lastRolledWeek: state.lastRolledWeek,
                dataVersion: state.dataVersion,
            }),
        }
    )
);
