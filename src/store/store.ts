import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Item, Routine, WeekKey } from '../types';
import { generateDummyData, DEFAULT_NOW } from '../data/dummyData';
import {
    getWeekKey,
    compareWeekKeys
} from '../utils/timeUtils';
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
    archiveItem: (id: string) => void;
    unarchiveItem: (id: string) => void;
    executeRollover: () => void;
    advanceTime: (days: number) => void;
    setTime: (isoTime: string) => void;
    toggleAllowUncomplete: () => void;
    resetData: () => void;

    // Computed helpers
    getPresentWeek: () => WeekKey;
    getVisibleItems: () => Item[];
    getArchivedItems: () => Item[];
}

const initialData = generateDummyData(DEFAULT_NOW);

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
                // Simply add minutes, don't auto-move or auto-uncomplete
                set((state) => ({
                    items: state.items.map((item) =>
                        item.id === id
                            ? { ...item, minutes: (item.minutes ?? 0) + minutes }
                            : item
                    ),
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

                        // If we've completed all occurrences, mark as complete
                        if (newCount >= targetCount) {
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
                    .filter((item) => !item.archived) // Only show non-archived items
                    .sort((a, b) => {
                        const weekCompare = compareWeekKeys(a.week, b.week);
                        if (weekCompare !== 0) return weekCompare;

                        // Keep items in their position (by orderIndex)
                        return a.orderIndex - b.orderIndex;
                    });
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

function executeRolloverLogic(
    state: { items: Item[]; routines: Routine[]; currentTime: string; allowUncomplete: boolean },
    newPresentWeek: WeekKey,
    newTime: string
): { items: Item[]; currentTime: string } {
    const oldPresentWeek = getWeekKey(state.currentTime);

    const carryOverItems = state.items
        .filter((i) => i.week === oldPresentWeek && i.status === 'incomplete')
        .sort((a, b) => a.orderIndex - b.orderIndex);

    const newWeekItems = state.items
        .filter((i) => i.week === newPresentWeek && i.status === 'incomplete')
        .sort((a, b) => a.orderIndex - b.orderIndex);

    const updatedItems = state.items.map((item) => {
        const carryIndex = carryOverItems.findIndex((c) => c.id === item.id);
        if (carryIndex !== -1) {
            return {
                ...item,
                week: newPresentWeek,
                orderIndex: carryIndex,
            };
        }

        const newWeekIndex = newWeekItems.findIndex((n) => n.id === item.id);
        if (newWeekIndex !== -1) {
            return {
                ...item,
                orderIndex: carryOverItems.length + newWeekIndex,
            };
        }

        return item;
    });

    return {
        items: updatedItems,
        currentTime: newTime,
    };
}
