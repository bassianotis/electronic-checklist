import type { Item, Routine } from '../types';
import { getWeekKey, addWeeks, getFirstDayOfWeek } from '../utils/timeUtils';
import dayjs from 'dayjs';

// Default demo "now" - a Tuesday in February 2026
export const DEFAULT_NOW = '2026-02-03T10:30:00-08:00';

let idCounter = 1;
function generateId(): string {
    return `item-${idCounter++}`;
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

    // PRESENT WEEK - mix of incomplete and completed
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

    items.push({
        id: generateId(),
        title: 'Pay electricity bill',
        week: presentWeekKey,
        status: 'incomplete',
        hasDueDate: true,
        dueDateISO: nowDate.subtract(2, 'day').toISOString(),
        orderIndex: 5
    });

    // Multi-occurrence tasks (multiple completions per week)
    items.push({
        id: generateId(),
        title: 'Water the plants',
        week: presentWeekKey,
        status: 'incomplete',
        targetCount: 3,
        completedCount: 1,
        orderIndex: 6
    });

    items.push({
        id: generateId(),
        title: 'Take vitamins',
        week: presentWeekKey,
        status: 'incomplete',
        targetCount: 7,
        completedCount: 4,
        orderIndex: 7
    });

    // PAST WEEK
    const lastWeek = addWeeks(presentWeekKey, -1);

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

    items.push({
        id: generateId(),
        title: 'Design review meeting',
        week: lastWeek,
        status: 'complete',
        completedAt: nowDate.subtract(10, 'day').toISOString(),
        minutes: 60,
        orderIndex: 0
    });

    // NEXT WEEK
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

    items.push({
        id: generateId(),
        title: 'Submit tax documents',
        week: nextWeek,
        status: 'incomplete',
        hasDueDate: true,
        dueDateISO: nowDate.add(3, 'day').toISOString(),
        orderIndex: 5
    });

    // TWO WEEKS OUT
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
        title: 'Plan vacation',
        week: twoWeeks,
        status: 'incomplete',
        orderIndex: 2
    });

    // NEXT MONTH
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

    // FAR FUTURE - spread across 12 months
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

    // Month 3-4 items
    items.push({
        id: generateId(),
        title: 'Quarterly review prep',
        week: addWeeks(presentWeekKey, 12),
        status: 'incomplete',
        minutesGoal: 90,
        orderIndex: 1
    });

    items.push({
        id: generateId(),
        title: 'Spring cleaning',
        week: addWeeks(presentWeekKey, 14),
        status: 'incomplete',
        targetCount: 4,
        completedCount: 0,
        orderIndex: 1
    });

    // Month 5-6 items
    items.push({
        id: generateId(),
        title: 'Plan summer vacation',
        week: addWeeks(presentWeekKey, 18),
        status: 'incomplete',
        orderIndex: 1
    });

    items.push({
        id: generateId(),
        title: 'Renew gym membership',
        week: addWeeks(presentWeekKey, 22),
        status: 'incomplete',
        hasDueDate: true,
        dueDateISO: dayjs(getFirstDayOfWeek(addWeeks(presentWeekKey, 24))).toISOString(),
        orderIndex: 1
    });

    // Month 7-8 items
    items.push({
        id: generateId(),
        title: 'Mid-year financial review',
        week: addWeeks(presentWeekKey, 26),
        status: 'incomplete',
        minutesGoal: 120,
        orderIndex: 1
    });

    items.push({
        id: generateId(),
        title: 'Update emergency contacts',
        week: addWeeks(presentWeekKey, 30),
        status: 'incomplete',
        orderIndex: 1
    });

    // Month 9-10 items
    items.push({
        id: generateId(),
        title: 'Fall home maintenance',
        week: addWeeks(presentWeekKey, 34),
        status: 'incomplete',
        targetCount: 5,
        completedCount: 0,
        orderIndex: 1
    });

    items.push({
        id: generateId(),
        title: 'Holiday gift planning',
        week: addWeeks(presentWeekKey, 38),
        status: 'incomplete',
        orderIndex: 1
    });

    // Month 11-12 items
    items.push({
        id: generateId(),
        title: 'Year-end review',
        week: addWeeks(presentWeekKey, 44),
        status: 'incomplete',
        minutesGoal: 180,
        orderIndex: 1
    });

    items.push({
        id: generateId(),
        title: 'Set next year goals',
        week: addWeeks(presentWeekKey, 48),
        status: 'incomplete',
        orderIndex: 1
    });

    // Items with progress exceeding goal
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

    // ========================================
    // PRACTICAL HOUSEHOLD TASKS
    // ========================================

    // Helper: Check if a month is in a range (1-indexed)
    const isMonthInRange = (month: number, startMonth: number, endMonth: number): boolean => {
        if (startMonth <= endMonth) {
            return month >= startMonth && month <= endMonth;
        }
        // Wrap-around (e.g., Nov-Feb)
        return month >= startMonth || month <= endMonth;
    };

    // Helper: Get the first Sunday of a specific month/year
    const getFirstSundayOfMonth = (year: number, month: number): dayjs.Dayjs => {
        const firstDay = dayjs().year(year).month(month - 1).date(1);
        const dayOfWeek = firstDay.day();
        const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
        return firstDay.add(daysUntilSunday, 'day');
    };

    // Helper: Generate recurring tasks for a period
    const generateRecurring = (
        title: string,
        cadence: 'weekly' | 'biweekly' | 'monthly',
        startMonth: number,
        endMonth: number,
        options?: { targetCount?: number; minutesGoal?: number; biweeklyOffset?: number }
    ) => {
        let weekOffset = 0;
        const maxWeeks = 52; // 12 months
        const biweeklyOffset = options?.biweeklyOffset ?? 0; // 0 = even weeks, 1 = odd weeks

        while (weekOffset < maxWeeks) {
            const weekKey = addWeeks(presentWeekKey, weekOffset);
            const weekDate = dayjs(getFirstDayOfWeek(weekKey));
            const month = weekDate.month() + 1; // 1-indexed

            if (isMonthInRange(month, startMonth, endMonth)) {
                // Check cadence
                let shouldAdd = true;
                if (cadence === 'biweekly') {
                    shouldAdd = (weekOffset + biweeklyOffset) % 2 === 0;
                } else if (cadence === 'monthly') {
                    // Only first week of month
                    const prevWeekDate = dayjs(getFirstDayOfWeek(addWeeks(presentWeekKey, weekOffset - 1)));
                    shouldAdd = weekDate.month() !== prevWeekDate.month() || weekOffset === 0;
                }

                if (shouldAdd) {
                    items.push({
                        id: generateId(),
                        title,
                        week: weekKey,
                        status: 'incomplete',
                        targetCount: options?.targetCount,
                        completedCount: options?.targetCount ? 0 : undefined,
                        minutesGoal: options?.minutesGoal,
                        orderIndex: items.length
                    });
                }
            }

            weekOffset++;
        }
    };

    // Helper: Generate annual task
    const generateAnnual = (
        title: string,
        targetMonth: number,
        weekOfMonth: number = 1, // 1 = first week, 2 = second week, etc.
        hasDueDate: boolean = false
    ) => {
        // Find the target month within the next 12 months
        for (let monthOffset = 0; monthOffset < 12; monthOffset++) {
            const checkDate = nowDate.add(monthOffset, 'month');
            if (checkDate.month() + 1 === targetMonth) {
                const firstSunday = getFirstSundayOfMonth(checkDate.year(), targetMonth);
                const targetSunday = firstSunday.add((weekOfMonth - 1) * 7, 'day');
                const weekKey = getWeekKey(targetSunday.toISOString());

                items.push({
                    id: generateId(),
                    title,
                    week: weekKey,
                    status: 'incomplete',
                    hasDueDate,
                    dueDateISO: hasDueDate ? targetSunday.add(6, 'day').toISOString() : undefined, // Saturday
                    orderIndex: items.length
                });
                break;
            }
        }
    };

    // ---- BIWEEKLY YEAR-ROUND: SORT (even weeks, 30 min) ----
    generateRecurring('Sort office', 'biweekly', 1, 12, { minutesGoal: 30, biweeklyOffset: 0 });
    generateRecurring('Sort Jesse room', 'biweekly', 1, 12, { minutesGoal: 30, biweeklyOffset: 0 });
    generateRecurring('Sort den', 'biweekly', 1, 12, { minutesGoal: 30, biweeklyOffset: 0 });
    generateRecurring('Sort basement', 'biweekly', 1, 12, { minutesGoal: 30, biweeklyOffset: 0 });
    generateRecurring('Sort bedroom', 'biweekly', 1, 12, { minutesGoal: 30, biweeklyOffset: 0 });
    generateRecurring('Sort living room', 'biweekly', 1, 12, { minutesGoal: 30, biweeklyOffset: 0 });

    // ---- BIWEEKLY YEAR-ROUND: CLEAN (odd weeks, 60 min) ----
    generateRecurring('Clean office', 'biweekly', 1, 12, { minutesGoal: 60, biweeklyOffset: 1 });
    generateRecurring('Clean Jesse room', 'biweekly', 1, 12, { minutesGoal: 60, biweeklyOffset: 1 });
    generateRecurring('Clean den', 'biweekly', 1, 12, { minutesGoal: 60, biweeklyOffset: 1 });
    generateRecurring('Clean basement', 'biweekly', 1, 12, { minutesGoal: 60, biweeklyOffset: 1 });
    generateRecurring('Clean bedroom', 'biweekly', 1, 12, { minutesGoal: 60, biweeklyOffset: 1 });
    generateRecurring('Clean living room', 'biweekly', 1, 12, { minutesGoal: 60, biweeklyOffset: 1 });

    // ---- BIWEEKLY YEAR-ROUND: BATHROOMS/STAIRS (same schedule as clean, 60 min) ----
    generateRecurring('Clean stairs', 'biweekly', 1, 12, { minutesGoal: 60, biweeklyOffset: 1 });
    generateRecurring('Clean upstairs bathroom', 'biweekly', 1, 12, { minutesGoal: 60, biweeklyOffset: 1 });
    generateRecurring('Clean main-floor bathroom', 'biweekly', 1, 12, { minutesGoal: 60, biweeklyOffset: 1 });
    generateRecurring('Clean basement bathroom', 'biweekly', 1, 12, { minutesGoal: 60, biweeklyOffset: 1 });

    // ---- SEASONAL LAWN/GARDEN ----
    generateRecurring('Mow lawn', 'biweekly', 6, 9, { biweeklyOffset: 0 }); // June - Sept, even weeks
    generateRecurring('Weed lawn', 'biweekly', 5, 10, { biweeklyOffset: 1 }); // May - Oct, odd weeks
    generateRecurring('Rake lawn', 'biweekly', 9, 11); // Sept - Nov

    // ---- MONTHLY YEAR-ROUND ----
    generateRecurring('Water indoor plants', 'monthly', 1, 12);

    // ---- EVERY-OTHER-DAY (as weekly with 4 checkboxes) ----
    // May - Sept
    generateRecurring('Water outdoor plants', 'weekly', 5, 9, { targetCount: 4 });

    // ---- ANNUAL TASKS ----
    generateAnnual('Prune', 4); // April
    generateAnnual('Plan fall planting', 6); // June
    generateAnnual('Purchase fall planting', 8); // August
    generateAnnual('Plant fall planting', 9); // September
    generateAnnual('Configure bed watering', 4); // April
    generateAnnual('Retire bed watering', 11); // November
    generateAnnual('Plan Christmas gifts', 11, 1, true); // 1st week of Nov with due date
    generateAnnual('Purchase Christmas gifts', 12, 1, true); // 1st week of Dec with due date
    generateAnnual('Create Christmas gift log', 1); // January
    generateAnnual('Plan Minah birthday', 12); // December
    generateAnnual('Plan anniversary', 9); // September
    generateAnnual('Decorate Christmas interior', 12); // December
    generateAnnual('Decorate Christmas exterior', 12); // December
    generateAnnual('Plan LA trip', 11); // November
    generateAnnual('Purchase Christmas tree', 12); // December

    return { items, routines };
}
