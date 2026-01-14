import dayjs from 'dayjs';
import type { Item, Routine, WeekKey } from '../types';
import { getWeekKey } from '../utils/timeUtils';

// Default "now" time - January 13, 2026 at noon
export const DEFAULT_NOW = '2026-01-13T12:00:00.000Z';

// Helper to get a date in a specific week offset
function getDateInWeek(weekOffset: number, dayOfWeek: number, baseDate: string): string {
    return dayjs(baseDate)
        .startOf('week')
        .add(weekOffset, 'week')
        .add(dayOfWeek, 'day')
        .toISOString();
}

export function generateDummyData(now: string = DEFAULT_NOW): { items: Item[]; routines: Routine[] } {
    const presentWeek = getWeekKey(now);
    const lastWeek = getWeekKey(dayjs(now).subtract(1, 'week').toISOString());

    // Get anchor weeks for routines
    const sortAnchor = getWeekKey('2026-01-11T12:00:00.000Z'); // Week of Jan 11
    const cleanAnchor = getWeekKey('2026-01-18T12:00:00.000Z'); // Week of Jan 18

    const items: Item[] = [
        // Past week - completed items
        {
            id: 'item-past-1',
            title: 'Review quarterly report',
            week: lastWeek,
            orderIndex: 0,
            status: 'complete',
            completedAt: getDateInWeek(-1, 3, now),
        },

        // This week - mixed status one-off items
        {
            id: 'item-1',
            title: 'Team meeting',
            week: presentWeek,
            orderIndex: 0,
            status: 'incomplete',
        },
        {
            id: 'item-2',
            title: 'Take vitamins',
            week: presentWeek,
            orderIndex: 1,
            status: 'incomplete',
            targetCount: 7,
            completedCount: 4,
        },
        {
            id: 'item-3',
            title: 'Research project',
            week: presentWeek,
            orderIndex: 2,
            status: 'complete',
            completedAt: getDateInWeek(0, 1, now),
            minutesGoal: 120,
            minutes: 165,
        },
        {
            id: 'item-4',
            title: 'Pay electricity bill',
            week: presentWeek,
            orderIndex: 3,
            status: 'incomplete',
            hasDueDate: true,
            dueDateISO: dayjs(now).add(19, 'day').toISOString(),
        },
        {
            id: 'item-5',
            title: 'Gym workout',
            week: presentWeek,
            orderIndex: 4,
            status: 'incomplete',
            minutesGoal: 60,
            minutes: 0,
        },
    ];

    // Routines - tasks will be spawned automatically by the spawner
    const routines: Routine[] = [
        // Biweekly sorting routines (starting Jan 11)
        {
            id: 'routine-sort-jesse',
            title: 'Sort Jesse room',
            cadence: 'biweekly',
            taskType: 'time-tracked',
            minutesGoal: 30,
            isYearRound: true,
            anchorWeek: sortAnchor,
        },
        {
            id: 'routine-sort-den',
            title: 'Sort den',
            cadence: 'biweekly',
            taskType: 'time-tracked',
            minutesGoal: 30,
            isYearRound: true,
            anchorWeek: sortAnchor,
        },
        {
            id: 'routine-sort-basement',
            title: 'Sort basement',
            cadence: 'biweekly',
            taskType: 'time-tracked',
            minutesGoal: 30,
            isYearRound: true,
            anchorWeek: sortAnchor,
        },
        // Biweekly cleaning routines (starting Jan 18 - alternates with sort)
        {
            id: 'routine-clean-bedroom',
            title: 'Clean bedroom',
            cadence: 'biweekly',
            taskType: 'time-tracked',
            minutesGoal: 60,
            isYearRound: true,
            anchorWeek: cleanAnchor,
        },
        {
            id: 'routine-clean-living',
            title: 'Clean living room',
            cadence: 'biweekly',
            taskType: 'time-tracked',
            minutesGoal: 60,
            isYearRound: true,
            anchorWeek: cleanAnchor,
        },
        {
            id: 'routine-clean-office',
            title: 'Clean office',
            cadence: 'biweekly',
            taskType: 'time-tracked',
            minutesGoal: 60,
            isYearRound: true,
            anchorWeek: cleanAnchor,
        },
        // Lawn care routines - seasonal
        {
            id: 'routine-mow-lawn',
            title: 'Mow lawn',
            cadence: 'biweekly',
            taskType: 'simple',
            isYearRound: false,
            anchorWeek: getWeekKey('2026-06-01T12:00:00.000Z'),
            startMonth: 6,
            startWeekInMonth: 1,
            endMonth: 9,
            endWeekInMonth: 4,
        },
        {
            id: 'routine-weed-lawn',
            title: 'Weed lawn',
            cadence: 'weekly',
            taskType: 'simple',
            isYearRound: false,
            anchorWeek: getWeekKey('2026-05-01T12:00:00.000Z'),
            startMonth: 5,
            startWeekInMonth: 1,
            endMonth: 10,
            endWeekInMonth: 4,
        },
        {
            id: 'routine-rake-lawn',
            title: 'Rake lawn',
            cadence: 'biweekly',
            taskType: 'simple',
            isYearRound: false,
            anchorWeek: getWeekKey('2026-09-01T12:00:00.000Z'),
            startMonth: 9,
            startWeekInMonth: 1,
            endMonth: 11,
            endWeekInMonth: 4,
        },
    ];

    return { items, routines };
}
