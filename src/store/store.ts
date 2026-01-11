import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Item, Routine, WeekKey } from '../types';
import { generateDummyData, DEFAULT_NOW } from '../data/dummyData';
import {
    getWeekKey,
    addWeeks,
    compareWeekKeys,
    isWithin7Days
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
    reorderItem: (id: string, newOrderIndex: number, newWeek?: WeekKey) => void;
    moveToWeek: (id: string, week: WeekKey) => void;
    executeRollover: () => void;
    advanceTime: (days: number) => void;
    setTime: (isoTime: string) => void;
    toggleAllowUncomplete: () => void;
    resetData: () => void;

    // Computed helpers
    getPresentWeek: () => WeekKey;
    getVisibleItems: () => Item[];
    getAllCompletedItems: () => Item[];
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
                const { currentTime, allowUncomplete, getPresentWeek } = get();
                if (!allowUncomplete) return;

                const presentWeek = getPresentWeek();

                set((state) => {
                    const item = state.items.find((i) => i.id === id);
                    if (!item || item.status !== 'complete') return state;
                    if (!item.completedAt || !isWithin7Days(item.completedAt, currentTime)) {
                        return state;
                    }

                    // Get max order index in present week incomplete items
                    const presentIncomplete = state.items.filter(
                        (i) => i.week === presentWeek && i.status === 'incomplete'
                    );
                    const maxOrder = Math.max(0, ...presentIncomplete.map((i) => i.orderIndex));

                    return {
                        items: state.items.map((i) =>
                            i.id === id
                                ? {
                                    ...i,
                                    status: 'incomplete' as const,
                                    completedAt: undefined,
                                    week: presentWeek,
                                    orderIndex: maxOrder + 1,
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

                    // Get max order index in present week incomplete items
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
                set((state) => ({
                    items: state.items.map((item) =>
                        item.id === id
                            ? { ...item, minutes: (item.minutes ?? 0) + minutes }
                            : item
                    ),
                }));
            },

            reorderItem: (id: string, newOrderIndex: number, newWeek?: WeekKey) => {
                set((state) => {
                    const item = state.items.find((i) => i.id === id);
                    if (!item || item.status === 'complete') return state;

                    const targetWeek = newWeek ?? item.week;

                    // Get all incomplete items in target week, sorted by order
                    const weekItems = state.items
                        .filter((i) => i.week === targetWeek && i.status === 'incomplete' && i.id !== id)
                        .sort((a, b) => a.orderIndex - b.orderIndex);

                    // Insert at new position and recalculate all indices
                    const reorderedItems = [...weekItems];
                    const insertIndex = Math.min(newOrderIndex, reorderedItems.length);
                    reorderedItems.splice(insertIndex, 0, { ...item, week: targetWeek });

                    // Create update map
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

                    // Get max order index in target week incomplete items
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
                    // Move to next Sunday midnight
                    const daysUntilSunday = (7 - now.day()) % 7 || 7;
                    const newTime = now.add(daysUntilSunday, 'day').startOf('day').toISOString();
                    const oldPresentWeek = getWeekKey(state.currentTime);
                    const newPresentWeek = getWeekKey(newTime);

                    if (oldPresentWeek === newPresentWeek) {
                        // Already at Sunday, advance one more week
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

            getPresentWeek: () => {
                const { currentTime } = get();
                return getWeekKey(currentTime);
            },

            getVisibleItems: () => {
                const { items, currentTime } = get();
                const presentWeek = getWeekKey(currentTime);

                return items
                    .filter((item) => {
                        // Show all incomplete items
                        if (item.status === 'incomplete') return true;
                        // Show completed items within 7 days
                        if (item.completedAt && isWithin7Days(item.completedAt, currentTime)) {
                            return true;
                        }
                        return false;
                    })
                    .sort((a, b) => {
                        // First sort by week
                        const weekCompare = compareWeekKeys(a.week, b.week);
                        if (weekCompare !== 0) return weekCompare;

                        // Within same week: completed first (by completedAt oldest→newest)
                        if (a.status === 'complete' && b.status === 'complete') {
                            return new Date(a.completedAt!).getTime() - new Date(b.completedAt!).getTime();
                        }
                        if (a.status === 'complete') return -1;
                        if (b.status === 'complete') return 1;

                        // Both incomplete: sort by orderIndex
                        return a.orderIndex - b.orderIndex;
                    });
            },

            getAllCompletedItems: () => {
                const { items } = get();
                return items
                    .filter((item) => item.status === 'complete')
                    .sort((a, b) => {
                        // Reverse chronological (newest first)
                        return new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime();
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

// Helper function for rollover logic
function executeRolloverLogic(
    state: { items: Item[]; routines: Routine[]; currentTime: string; allowUncomplete: boolean },
    newPresentWeek: WeekKey,
    newTime: string
): { items: Item[]; currentTime: string } {
    const oldPresentWeek = getWeekKey(state.currentTime);

    // Get incomplete items from old present week
    const carryOverItems = state.items
        .filter((i) => i.week === oldPresentWeek && i.status === 'incomplete')
        .sort((a, b) => a.orderIndex - b.orderIndex);

    // Get items already scheduled for new present week
    const newWeekItems = state.items
        .filter((i) => i.week === newPresentWeek && i.status === 'incomplete')
        .sort((a, b) => a.orderIndex - b.orderIndex);

    // Create new order: carry-over items first, then pre-scheduled items
    const updatedItems = state.items.map((item) => {
        // Move carry-over items to new week
        const carryIndex = carryOverItems.findIndex((c) => c.id === item.id);
        if (carryIndex !== -1) {
            return {
                ...item,
                week: newPresentWeek,
                orderIndex: carryIndex,
            };
        }

        // Adjust order of pre-scheduled items
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
