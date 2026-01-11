import type { Item, Routine, WeekKey } from '../types';
import { getWeekKey, addWeeks, getFirstDayOfWeek } from '../utils/timeUtils';
import dayjs from 'dayjs';

// Default demo "now" - a Tuesday in February 2026
export const DEFAULT_NOW = '2026-02-03T10:30:00-08:00';

let idCounter = 1;
function generateId(): string {
    return `item-${idCounter++}`;
}

function randomMinutes(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate dummy data for rich scenario testing.
 */
export function generateDummyData(now: string | Date = DEFAULT_NOW): {
    items: Item[];
    routines: Routine[];
} {
    idCounter = 1;
    const nowDate = dayjs(now);
    const presentWeekKey = getWeekKey(now);

    const routines: Routine[] = [
        {
            id: 'routine-1',
            name: 'Weekly Review',
            cadence: 'weekly',
            defaultMinutesGoal: 60,
            notes: 'Review goals and plan for next week'
        },
        {
            id: 'routine-2',
            name: 'Deep Clean',
            cadence: 'biweekly',
            defaultMinutesGoal: 120,
        },
        {
            id: 'routine-3',
            name: 'Monthly Budget Review',
            cadence: 'monthly',
            defaultMinutesGoal: 45,
        },
        {
            id: 'routine-4',
            name: 'Exercise',
            cadence: 'weekly',
            defaultMinutesGoal: 30,
        }
    ];

    const items: Item[] = [];

    // =========================================================
    // PRESENT WEEK - mix of incomplete and completed
    // =========================================================

    // Completed items (with staggered completedAt times)
    items.push({
        id: generateId(),
        title: 'Email inbox zero',
        week: presentWeekKey,
        status: 'complete',
        completedAt: nowDate.subtract(10, 'minute').toISOString(),
        minutes: 25,
        orderIndex: 0
    });

    items.push({
        id: generateId(),
        title: 'Weekly Review',
        routineId: 'routine-1',
        week: presentWeekKey,
        status: 'complete',
        completedAt: nowDate.subtract(2, 'day').toISOString(),
        minutes: 65,
        minutesGoal: 60,
        orderIndex: 0
    });

    items.push({
        id: generateId(),
        title: 'Update resume',
        week: presentWeekKey,
        status: 'complete',
        completedAt: nowDate.subtract(5, 'day').toISOString(),
        minutes: 90,
        orderIndex: 0
    });

    // Completed with future due date (edge case)
    items.push({
        id: generateId(),
        title: 'Submit report early',
        week: presentWeekKey,
        status: 'complete',
        completedAt: nowDate.subtract(1, 'day').toISOString(),
        hasDueDate: true,
        dueDateISO: nowDate.add(5, 'day').toISOString(),
        orderIndex: 0
    });

    // Incomplete items in present week
    items.push({
        id: generateId(),
        title: 'Finish quarterly planning doc',
        week: presentWeekKey,
        status: 'incomplete',
        minutes: 45,
        minutesGoal: 120,
        orderIndex: 1
    });

    items.push({
        id: generateId(),
        title: 'Exercise',
        routineId: 'routine-4',
        week: presentWeekKey,
        status: 'incomplete',
        minutes: 0,
        minutesGoal: 30,
        orderIndex: 2
    });

    items.push({
        id: generateId(),
        title: 'Review pull requests',
        week: presentWeekKey,
        status: 'incomplete',
        minutes: 15,
        orderIndex: 3
    });

    items.push({
        id: generateId(),
        title: 'Call dentist',
        week: presentWeekKey,
        status: 'incomplete',
        hasDueDate: true,
        dueDateISO: nowDate.add(2, 'day').toISOString(),
        orderIndex: 4
    });

    // Overdue item still in present week
    items.push({
        id: generateId(),
        title: 'Pay electricity bill',
        week: presentWeekKey,
        status: 'incomplete',
        hasDueDate: true,
        dueDateISO: nowDate.subtract(2, 'day').toISOString(),
        orderIndex: 5
    });

    // =========================================================
    // PAST WEEK - some completed within 7 days, some older
    // =========================================================
    const lastWeek = addWeeks(presentWeekKey, -1);

    // Within 7 days (should be visible in main list)
    items.push({
        id: generateId(),
        title: 'Team standup preparation',
        week: lastWeek,
        status: 'complete',
        completedAt: nowDate.subtract(4, 'day').toISOString(),
        minutes: 20,
        orderIndex: 0
    });

    items.push({
        id: generateId(),
        title: 'Fix login bug',
        week: lastWeek,
        status: 'complete',
        completedAt: nowDate.subtract(6, 'day').toISOString(),
        minutes: 180,
        orderIndex: 0
    });

    // Older than 7 days (only visible in /completed)
    items.push({
        id: generateId(),
        title: 'Design review meeting',
        week: lastWeek,
        status: 'complete',
        completedAt: nowDate.subtract(10, 'day').toISOString(),
        minutes: 60,
        orderIndex: 0
    });

    items.push({
        id: generateId(),
        title: 'Monthly Budget Review',
        routineId: 'routine-3',
        week: addWeeks(presentWeekKey, -4),
        status: 'complete',
        completedAt: nowDate.subtract(25, 'day').toISOString(),
        minutes: 50,
        minutesGoal: 45,
        orderIndex: 0
    });

    // =========================================================
    // NEXT WEEK - blue items
    // =========================================================
    const nextWeek = addWeeks(presentWeekKey, 1);

    items.push({
        id: generateId(),
        title: 'Weekly Review',
        routineId: 'routine-1',
        week: nextWeek,
        status: 'incomplete',
        minutesGoal: 60,
        orderIndex: 1
    });

    items.push({
        id: generateId(),
        title: 'Prepare conference talk',
        week: nextWeek,
        status: 'incomplete',
        minutes: 0,
        minutesGoal: 240,
        orderIndex: 2
    });

    items.push({
        id: generateId(),
        title: 'Deep Clean',
        routineId: 'routine-2',
        week: nextWeek,
        status: 'incomplete',
        minutesGoal: 120,
        orderIndex: 3
    });

    items.push({
        id: generateId(),
        title: 'Doctor appointment followup',
        week: nextWeek,
        status: 'incomplete',
        hasDueDate: true,
        dueDateISO: nowDate.add(10, 'day').toISOString(),
        orderIndex: 4
    });

    // Future item with due date THIS week (edge case - blue but due soon)
    items.push({
        id: generateId(),
        title: 'Submit tax documents',
        week: nextWeek,
        status: 'incomplete',
        hasDueDate: true,
        dueDateISO: nowDate.add(3, 'day').toISOString(),
        orderIndex: 5
    });

    // =========================================================
    // TWO WEEKS OUT
    // =========================================================
    const twoWeeks = addWeeks(presentWeekKey, 2);

    items.push({
        id: generateId(),
        title: 'Exercise',
        routineId: 'routine-4',
        week: twoWeeks,
        status: 'incomplete',
        minutesGoal: 30,
        orderIndex: 1
    });

    items.push({
        id: generateId(),
        title: 'Weekly Review',
        routineId: 'routine-1',
        week: twoWeeks,
        status: 'incomplete',
        minutesGoal: 60,
        orderIndex: 2
    });

    items.push({
        id: generateId(),
        title: 'Plan vacation',
        week: twoWeeks,
        status: 'incomplete',
        orderIndex: 3
    });

    // =========================================================
    // NEXT MONTH (4-5 weeks out)
    // =========================================================
    const nextMonth = addWeeks(presentWeekKey, 5);

    items.push({
        id: generateId(),
        title: 'Monthly Budget Review',
        routineId: 'routine-3',
        week: nextMonth,
        status: 'incomplete',
        minutesGoal: 45,
        orderIndex: 1
    });

    items.push({
        id: generateId(),
        title: 'Car inspection',
        week: nextMonth,
        status: 'incomplete',
        hasDueDate: true,
        dueDateISO: dayjs(getFirstDayOfWeek(nextMonth)).add(3, 'day').toISOString(),
        orderIndex: 2
    });

    items.push({
        id: generateId(),
        title: 'Deep Clean',
        routineId: 'routine-2',
        week: addWeeks(presentWeekKey, 3),
        status: 'incomplete',
        minutesGoal: 120,
        orderIndex: 1
    });

    // =========================================================
    // FAR FUTURE (2-6 months out)
    // =========================================================

    items.push({
        id: generateId(),
        title: 'Renew passport',
        week: addWeeks(presentWeekKey, 10),
        status: 'incomplete',
        hasDueDate: true,
        dueDateISO: dayjs(getFirstDayOfWeek(addWeeks(presentWeekKey, 12))).toISOString(),
        orderIndex: 1
    });

    items.push({
        id: generateId(),
        title: 'Annual health checkup',
        week: addWeeks(presentWeekKey, 20),
        status: 'incomplete',
        orderIndex: 1
    });

    items.push({
        id: generateId(),
        title: 'Review insurance policies',
        week: addWeeks(presentWeekKey, 30),
        status: 'incomplete',
        orderIndex: 1
    });

    items.push({
        id: generateId(),
        title: 'Home maintenance check',
        week: addWeeks(presentWeekKey, 40),
        status: 'incomplete',
        orderIndex: 1
    });

    // Items with minutes exceeding goal
    items.push({
        id: generateId(),
        title: 'Research project',
        week: presentWeekKey,
        status: 'incomplete',
        minutes: 150,
        minutesGoal: 90,
        orderIndex: 6
    });

    // Items with same title (test uniqueness by id)
    items.push({
        id: generateId(),
        title: 'Team meeting',
        week: presentWeekKey,
        status: 'incomplete',
        orderIndex: 7
    });

    items.push({
        id: generateId(),
        title: 'Team meeting',
        week: nextWeek,
        status: 'incomplete',
        orderIndex: 6
    });

    items.push({
        id: generateId(),
        title: 'Team meeting',
        week: twoWeeks,
        status: 'incomplete',
        orderIndex: 4
    });

    // More varied items to fill out the list
    const additionalTitles = [
        'Code review',
        'Update documentation',
        'Fix unit tests',
        'Client presentation',
        'Sprint planning',
        'Retrospective notes',
        'Performance tuning',
        'Database migration',
    ];

    additionalTitles.forEach((title, index) => {
        const weekOffset = Math.floor(index / 2) + 2;
        items.push({
            id: generateId(),
            title,
            week: addWeeks(presentWeekKey, weekOffset),
            status: 'incomplete',
            minutes: index % 3 === 0 ? randomMinutes(10, 60) : undefined,
            minutesGoal: index % 2 === 0 ? randomMinutes(30, 120) : undefined,
            orderIndex: (index % 5) + 1
        });
    });

    return { items, routines };
}
