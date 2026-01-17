import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Item, Routine, WeekKey } from '../types';
import { IDEAS_WEEK_KEY } from '../types';
import { DEFAULT_NOW, generateDummyData } from '../data/dummyData';
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
import dayjs from 'dayjs';

interface TaskStore {
    items: Item[];
    routines: Routine[];
    currentTime: string;
    allowUncomplete: boolean;

    // Actions
    completeItem: (id: string) => void;
    uncompleteItem: (id: string) => void;
    startItem: (id: string) => void;
    incrementProgress: (id: string, minutes: number) => void;
    incrementOccurrence: (id: string) => void; // For multi-occurrence tasks
    decrementOccurrence: (id: string) => void; // For undoing multi-occurrence
    reorderItem: (id: string, newOrderIndex: number, newWeek?: WeekKey) => void;
    moveToWeek: (id: string, week: WeekKey) => void;
    addItem: (title: string, week: WeekKey, orderIndex: number, options?: { minutesGoal?: number; targetCount?: number; dueDateISO?: string }) => string;
    updateItem: (id: string, updates: { title?: string; minutesGoal?: number; targetCount?: number; dueDateISO?: string; notes?: string }) => void;
    archiveItem: (id: string) => void;
    unarchiveItem: (id: string) => void;
    deleteItem: (id: string) => void;
    deleteRoutine: (id: string, removeRelatedTasks: boolean) => void;
    addRoutine: (routine: Omit<Routine, 'id'>) => string;
    updateRoutine: (id: string, updates: Partial<Routine>) => void;
    spawnRoutineTasks: () => void;
    rolloverPastItems: () => void; // Move incomplete past items to present week
    executeRollover: () => void;
    advanceTime: (days: number) => void;
    setTime: (isoTime: string) => void;
    toggleAllowUncomplete: () => void;
    resetData: () => void;

    // Computed helpers
    getPresentWeek: () => WeekKey;
    getVisibleItems: () => Item[];
    getIdeasItems: () => Item[];
    getArchivedItems: () => Item[];
}

import { getInitialData } from '../utils/initialization';

const initialData = getInitialData();

export const useTaskStore = create<TaskStore>()(
    persist(
        (set, get) => ({
            items: initialData.items,
            routines: initialData.routines,
            currentTime: DEFAULT_NOW,
            allowUncomplete: false,

            completeItem: (id: string) => {
                const { currentTime } = get();
                set((state) => ({
                    items: state.items.map((item) =>
                        item.id === id
                            ? {
                                ...item,
                                status: 'complete' as const,
                                completedAt: currentTime,
                            }
                            : item
                    ),
                }));
            },

            uncompleteItem: (id: string) => {
                set((state) => {
                    const item = state.items.find((i) => i.id === id);
                    if (!item || item.status !== 'complete') return state;

                    // Keep item in same position, just change status
                    return {
                        items: state.items.map((i) =>
                            i.id === id
                                ? {
                                    ...i,
                                    status: 'incomplete' as const,
                                    completedAt: undefined,
                                }
                                : i
                        ),
                    };
                });
            },

            startItem: (id: string) => {
                const { getPresentWeek } = get();
                const presentWeek = getPresentWeek();

                set((state) => {
                    const item = state.items.find((i) => i.id === id);
                    if (!item || item.week === presentWeek) return state;

                    const presentIncomplete = state.items.filter(
                        (i) => i.week === presentWeek && i.status === 'incomplete'
                    );
                    const maxOrder = Math.max(0, ...presentIncomplete.map((i) => i.orderIndex));

                    return {
                        items: state.items.map((i) =>
                            i.id === id
                                ? {
                                    ...i,
                                    week: presentWeek,
                                    orderIndex: maxOrder + 1,
                                }
                                : i
                        ),
                    };
                });
            },

            incrementProgress: (id: string, minutes: number) => {
                const { currentTime } = get();
                set((state) => ({
                    items: state.items.map((item) => {
                        if (item.id !== id) return item;

                        const newMinutes = (item.minutes ?? 0) + minutes;
                        const minutesGoal = item.minutesGoal ?? 0;

                        // Check combined goals
                        const minutesMet = minutesGoal === 0 || newMinutes >= minutesGoal;
                        const countMet = !item.targetCount || (item.completedCount ?? 0) >= item.targetCount;

                        if (minutesMet && countMet && item.status === 'incomplete') {
                            return {
                                ...item,
                                minutes: newMinutes,
                                status: 'complete' as const,
                                completedAt: currentTime,
                            };
                        }

                        return { ...item, minutes: newMinutes };
                    }),
                }));
            },

            incrementOccurrence: (id: string) => {
                const { currentTime } = get();
                set((state) => ({
                    items: state.items.map((item) => {
                        if (item.id !== id) return item;

                        const currentCount = item.completedCount ?? 0;
                        const targetCount = item.targetCount ?? 1;
                        const newCount = currentCount + 1;

                        // Check combined goals
                        const countMet = newCount >= targetCount;
                        const minutesMet = !item.minutesGoal || (item.minutes ?? 0) >= item.minutesGoal;

                        // If we've met ALL goals, mark as complete
                        if (countMet && minutesMet) {
                            return {
                                ...item,
                                completedCount: newCount,
                                status: 'complete' as const,
                                completedAt: currentTime,
                            };
                        }

                        return {
                            ...item,
                            completedCount: newCount,
                        };
                    }),
                }));
            },

            decrementOccurrence: (id: string) => {
                set((state) => ({
                    items: state.items.map((item) => {
                        if (item.id !== id) return item;

                        const currentCount = item.completedCount ?? 0;
                        if (currentCount <= 0) return item;

                        return {
                            ...item,
                            completedCount: currentCount - 1,
                            // If was complete, mark as incomplete
                            status: 'incomplete' as const,
                            completedAt: undefined,
                        };
                    }),
                }));
            },

            reorderItem: (id: string, newOrderIndex: number, newWeek?: WeekKey) => {
                set((state) => {
                    const item = state.items.find((i) => i.id === id);
                    if (!item) return state;

                    const targetWeek = newWeek ?? item.week;

                    // Include ALL items in the week (not just incomplete) for proper reordering
                    const weekItems = state.items
                        .filter((i) => i.week === targetWeek && !i.archived && i.id !== id)
                        .sort((a, b) => a.orderIndex - b.orderIndex);

                    const reorderedItems = [...weekItems];
                    const insertIndex = Math.min(newOrderIndex, reorderedItems.length);
                    reorderedItems.splice(insertIndex, 0, { ...item, week: targetWeek });

                    const updates = new Map<string, { orderIndex: number; week: WeekKey }>();
                    reorderedItems.forEach((i, idx) => {
                        updates.set(i.id, { orderIndex: idx, week: targetWeek });
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
            },

            moveToWeek: (id: string, week: WeekKey) => {
                set((state) => {
                    const item = state.items.find((i) => i.id === id);
                    if (!item) return state;

                    const weekIncomplete = state.items.filter(
                        (i) => i.week === week && i.status === 'incomplete'
                    );
                    const maxOrder = Math.max(0, ...weekIncomplete.map((i) => i.orderIndex));

                    return {
                        items: state.items.map((i) =>
                            i.id === id
                                ? { ...i, week, orderIndex: maxOrder + 1 }
                                : i
                        ),
                    };
                });
            },

            addItem: (title: string, week: WeekKey, orderIndex: number, options?: { minutesGoal?: number; targetCount?: number; dueDateISO?: string }) => {
                const id = `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

                set((state) => {
                    // Shift items at or after orderIndex down
                    const updatedItems = state.items.map((item) => {
                        if (item.week === week && !item.archived && item.orderIndex >= orderIndex) {
                            return { ...item, orderIndex: item.orderIndex + 1 };
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
                    };

                    return { items: [...updatedItems, newItem] };
                });

                return id;
            },

            updateItem: (id: string, updates: { title?: string; minutesGoal?: number; targetCount?: number; dueDateISO?: string; notes?: string }) => {
                set((state) => ({
                    items: state.items.map((item) => {
                        if (item.id !== id) return item;

                        const updated = { ...item };

                        if (updates.title !== undefined) {
                            updated.title = updates.title;
                        }
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
                            updated.notes = updates.notes.slice(0, 140) || undefined;
                        }

                        // Re-evaluate completion status
                        const minutesMet = !updated.minutesGoal || (updated.minutes ?? 0) >= updated.minutesGoal;
                        const countMet = !updated.targetCount || (updated.completedCount ?? 0) >= updated.targetCount;
                        const requirementsMet = minutesMet && countMet;

                        if (updated.status === 'complete' && !requirementsMet) {
                            updated.status = 'incomplete';
                            updated.completedAt = undefined;
                        }

                        // Optional: Auto-complete if now met? 
                        // User prompt implies only "uncheck", but usually if I lower the goal I expect it to complete?
                        // "In the scenario that I meet the time goal... the box should be unchecked"
                        // Safer to only auto-complete if implicit action (like increment), but for edit, if I change 30m -> 15m and I have 20m, it SHOULD complete?
                        // I will stick to "Uncomplete if not met" for now to be safe, unless user explicitly dragged.

                        return updated;
                    }),
                }));
            },

            deleteRoutine: (id: string, removeRelatedTasks: boolean) => {
                set((state) => {
                    const routine = state.routines.find(r => r.id === id);
                    if (!routine) return state;

                    let filteredItems = state.items;

                    if (removeRelatedTasks) {
                        // Remove non-started items that are linked to this routine
                        // A task is "started" if it has any progress (minutes > 0, completedCount > 0, or status !== 'incomplete')
                        filteredItems = state.items.filter(item => {
                            if (item.routineId !== id) return true;

                            // Check if the item has been started
                            const hasProgress = (item.minutes && item.minutes > 0) ||
                                (item.completedCount && item.completedCount > 0) ||
                                item.status !== 'incomplete';

                            // Keep if it has progress
                            return hasProgress;
                        });
                    }

                    return {
                        routines: state.routines.filter(r => r.id !== id),
                        items: filteredItems,
                    };
                });
            },

            addRoutine: (routineData: Omit<Routine, 'id'>) => {
                const id = `routine-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                const routine: Routine = { ...routineData, id };

                set((state) => {
                    // Add routine
                    const newRoutines = [...state.routines, routine];

                    // Spawn tasks for this routine immediately
                    const visibleWeeks = getVisibleWeeks(state.currentTime);
                    const newTasks = spawnTasksForRoutine(routine, visibleWeeks, state.items);

                    return {
                        routines: newRoutines,
                        items: [...state.items, ...newTasks],
                    };
                });

                return id;
            },

            updateRoutine: (id: string, updates: Partial<Routine>) => {
                set((state) => {
                    const routineIndex = state.routines.findIndex(r => r.id === id);
                    if (routineIndex === -1) return state;

                    const updatedRoutine = { ...state.routines[routineIndex], ...updates };
                    const newRoutines = [...state.routines];
                    newRoutines[routineIndex] = updatedRoutine;

                    // Remove tasks that no longer match the schedule (handles cadence changes to less frequent)
                    const itemsAfterRemoval = removeOutdatedRoutineTasks(updatedRoutine, state.items);

                    // Update remaining non-started tasks with new values
                    const updatedItems = updateRoutineTasks(updatedRoutine, itemsAfterRemoval);

                    // Spawn any new tasks (in case schedule expanded)
                    const visibleWeeks = getVisibleWeeks(state.currentTime);
                    const newTasks = spawnTasksForRoutine(updatedRoutine, visibleWeeks, updatedItems);

                    return {
                        routines: newRoutines,
                        items: [...updatedItems, ...newTasks],
                    };
                });
            },

            spawnRoutineTasks: () => {
                set((state) => {
                    const visibleWeeks = getVisibleWeeks(state.currentTime);
                    let allItems = [...state.items];

                    for (const routine of state.routines) {
                        const newTasks = spawnTasksForRoutine(routine, visibleWeeks, allItems);
                        allItems = [...allItems, ...newTasks];
                    }

                    return { items: allItems };
                });
            },

            rolloverPastItems: () => {
                set((state) => {
                    const presentWeek = getWeekKey(state.currentTime);

                    const updatedItems = state.items.map(item => {
                        // Skip ideas items (they don't rollover)
                        if (item.week === IDEAS_WEEK_KEY) {
                            return item;
                        }

                        // Skip if already in present/future week
                        if (compareWeekKeys(item.week, presentWeek) >= 0) {
                            return item;
                        }

                        // Skip if complete or archived
                        if (item.status === 'complete' || item.archived) {
                            return item;
                        }

                        // Move incomplete past item to present week
                        return {
                            ...item,
                            week: presentWeek,
                            // Track original week (only if not already set - preserves earliest origin)
                            originalWeek: item.originalWeek || item.week,
                        };
                    });

                    return { items: updatedItems };
                });
            },

            executeRollover: () => {
                set((state) => {
                    const now = dayjs(state.currentTime);
                    const daysUntilSunday = (7 - now.day()) % 7 || 7;
                    const newTime = now.add(daysUntilSunday, 'day').startOf('day').toISOString();
                    const oldPresentWeek = getWeekKey(state.currentTime);
                    const newPresentWeek = getWeekKey(newTime);

                    if (oldPresentWeek === newPresentWeek) {
                        const advancedTime = dayjs(newTime).add(7, 'day').toISOString();
                        return executeRolloverLogic(state, getWeekKey(advancedTime), advancedTime);
                    }

                    return executeRolloverLogic(state, newPresentWeek, newTime);
                });
            },

            advanceTime: (days: number) => {
                set((state) => ({
                    currentTime: dayjs(state.currentTime).add(days, 'day').toISOString(),
                }));
            },

            setTime: (isoTime: string) => {
                set({ currentTime: isoTime });
            },

            toggleAllowUncomplete: () => {
                set((state) => ({ allowUncomplete: !state.allowUncomplete }));
            },

            resetData: () => {
                const { currentTime } = get();
                const newData = generateDummyData(currentTime);
                set({
                    items: newData.items,
                    routines: newData.routines,
                });
            },

            archiveItem: (id: string) => {
                set((state) => ({
                    items: state.items.map((item) =>
                        item.id === id
                            ? { ...item, archived: true }
                            : item
                    ),
                }));
            },

            deleteItem: (id: string) => {
                set((state) => ({
                    items: state.items.filter((item) => item.id !== id),
                }));
            },

            unarchiveItem: (id: string) => {
                set((state) => {
                    const item = state.items.find((i) => i.id === id);
                    if (!item) return state;

                    // Move to top of its week (orderIndex 0)
                    // Shift other items in that week down
                    const updatedItems = state.items.map((i) => {
                        if (i.id === id) {
                            return { ...i, archived: false, orderIndex: 0 };
                        }
                        if (i.week === item.week && !i.archived) {
                            return { ...i, orderIndex: i.orderIndex + 1 };
                        }
                        return i;
                    });

                    return { items: updatedItems };
                });
            },

            getPresentWeek: () => {
                const { currentTime } = get();
                return getWeekKey(currentTime);
            },

            getVisibleItems: () => {
                const { items } = get();

                return items
                    .filter((item) => !item.archived && item.week !== IDEAS_WEEK_KEY) // Only show non-archived items and exclude Ideas
                    .sort((a, b) => {
                        const weekCompare = compareWeekKeys(a.week, b.week);
                        if (weekCompare !== 0) return weekCompare;

                        // Keep items in their position (by orderIndex)
                        return a.orderIndex - b.orderIndex;
                    });
            },

            getIdeasItems: () => {
                const { items } = get();
                return items
                    .filter((item) => !item.archived && item.week === IDEAS_WEEK_KEY)
                    .sort((a, b) => a.orderIndex - b.orderIndex);
            },

            getArchivedItems: () => {
                const { items } = get();
                return items
                    .filter((item) => item.archived)
                    .sort((a, b) => {
                        // Sort archived by completion time, most recent first
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
            }),
        }
    )
);


