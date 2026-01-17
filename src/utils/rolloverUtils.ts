import type { Item, Routine, WeekKey } from '../types';
import { getWeekKey } from './timeUtils';

/**
 * Moves incomplete items from the "old" present week to the "new" present week.
 * Preserves order of carry-over items and pushes existing new-week items below them.
 */
export function executeRolloverLogic(
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
