import dayjs from 'dayjs';
import type { Item, Routine, WeekKey } from '../types';
import { getWeekKey, getFirstDayOfWeek } from './timeUtils';

/**
 * Get all week keys through the end of the 12th month from the current month.
 * E.g., if it's January 2026, returns weeks through December 31, 2026.
 * If it's February 2026, returns weeks through January 31, 2027.
 */
export function getVisibleWeeks(currentTime: string): WeekKey[] {
    const weeks: WeekKey[] = [];
    const currentDate = dayjs(currentTime);

    // Start from the beginning of the current week
    const startDate = currentDate.startOf('week');

    // End at the last day of the 12th month from now
    // (current month + 11 more = 12 complete months)
    const endDate = currentDate.add(11, 'month').endOf('month');

    let current = startDate;
    while (current.isBefore(endDate) || current.isSame(endDate, 'day')) {
        weeks.push(getWeekKey(current.toISOString()));
        current = current.add(1, 'week');
    }

    return weeks;
}

/**
 * Get the week number within a month (1-5) for a given date.
 */
function getWeekInMonth(date: dayjs.Dayjs): number {
    const firstOfMonth = date.startOf('month');
    const firstSunday = firstOfMonth.day() === 0
        ? firstOfMonth
        : firstOfMonth.add(7 - firstOfMonth.day(), 'day');

    // If the date is before the first Sunday, it's week 1
    if (date.isBefore(firstSunday)) {
        return 1;
    }

    const weekNum = Math.floor(date.diff(firstSunday, 'day') / 7) + 2;
    return Math.min(weekNum, 5);
}

/**
 * Check if a week falls within a seasonal range.
 */
function isWeekInSeason(weekKey: WeekKey, routine: Routine): boolean {
    if (routine.isYearRound) {
        return true;
    }

    const weekDate = dayjs(getFirstDayOfWeek(weekKey));
    const month = weekDate.month() + 1; // 1-indexed
    const weekInMonth = getWeekInMonth(weekDate);

    const startMonth = routine.startMonth!;
    const startWeek = routine.startWeekInMonth!;
    const endMonth = routine.endMonth!;
    const endWeek = routine.endWeekInMonth!;

    // Handle non-wrapping seasons (e.g., May-Sept)
    if (startMonth <= endMonth) {
        if (month < startMonth || month > endMonth) {
            return false;
        }
        if (month === startMonth && weekInMonth < startWeek) {
            return false;
        }
        if (month === endMonth && weekInMonth > endWeek) {
            return false;
        }
        return true;
    }

    // Handle wrapping seasons (e.g., Nov-Feb)
    if (month > endMonth && month < startMonth) {
        return false;
    }
    if (month === startMonth && weekInMonth < startWeek) {
        return false;
    }
    if (month === endMonth && weekInMonth > endWeek) {
        return false;
    }
    return true;
}

/**
 * Check if a week matches the routine's anchor for the given cadence.
 */
function matchesCadence(weekKey: WeekKey, routine: Routine): boolean {
    const weekDate = dayjs(getFirstDayOfWeek(weekKey));
    const anchorDate = dayjs(getFirstDayOfWeek(routine.anchorWeek));

    // If week is before anchor, no spawn
    if (weekDate.isBefore(anchorDate)) {
        return false;
    }

    const weeksDiff = weekDate.diff(anchorDate, 'week');

    switch (routine.cadence) {
        case 'weekly': {
            return true; // Every week from anchor
        }

        case 'biweekly': {
            return weeksDiff % 2 === 0; // Every other week
        }

        case 'monthly': {
            // Same week-of-month as anchor
            const anchorWeekInMonth = getWeekInMonth(anchorDate);
            const currentWeekInMonth = getWeekInMonth(weekDate);
            return currentWeekInMonth === anchorWeekInMonth;
        }

        case 'annually': {
            // Same month and same week-of-month
            const anchorMonth = anchorDate.month();
            const anchorWIM = getWeekInMonth(anchorDate);
            const currentMonth = weekDate.month();
            const currentWIM = getWeekInMonth(weekDate);
            return currentMonth === anchorMonth && currentWIM === anchorWIM;
        }

        default:
            return false;
    }
}

/**
 * Determine if a task should spawn for a routine in a given week.
 */
export function shouldSpawnInWeek(weekKey: WeekKey, routine: Routine): boolean {
    return isWeekInSeason(weekKey, routine) && matchesCadence(weekKey, routine);
}

/**
 * Generate a unique ID for a routine-spawned task.
 */
function generateTaskId(routine: Routine, weekKey: WeekKey): string {
    return `${routine.id}-${weekKey}`;
}

/**
 * Spawn tasks for a routine across all visible weeks.
 * Returns new tasks that don't already exist.
 */
export function spawnTasksForRoutine(
    routine: Routine,
    visibleWeeks: WeekKey[],
    existingItems: Item[]
): Item[] {
    const existingIds = new Set(existingItems.map(item => item.id));
    const newTasks: Item[] = [];

    for (const weekKey of visibleWeeks) {
        if (!shouldSpawnInWeek(weekKey, routine)) {
            continue;
        }

        const taskId = generateTaskId(routine, weekKey);

        // Skip if task already exists
        if (existingIds.has(taskId)) {
            continue;
        }

        const task: Item = {
            id: taskId,
            title: routine.title,
            routineId: routine.id,
            week: weekKey,
            status: 'incomplete',
            orderIndex: 1000, // Will be reindexed
        };

        // Apply task type properties
        if (routine.taskType === 'time-tracked' && routine.minutesGoal) {
            task.minutesGoal = routine.minutesGoal;
            task.minutes = 0;
        } else if (routine.taskType === 'multi-occurrence' && routine.targetCount) {
            task.targetCount = routine.targetCount;
            task.completedCount = 0;
        }

        newTasks.push(task);
    }

    return newTasks;
}

/**
 * Update non-started tasks when a routine is edited.
 */
export function updateRoutineTasks(
    routine: Routine,
    items: Item[]
): Item[] {
    return items.map(item => {
        if (item.routineId !== routine.id) {
            return item;
        }

        // Check if task has been started
        const hasProgress = (item.minutes && item.minutes > 0) ||
            (item.completedCount && item.completedCount > 0) ||
            item.status !== 'incomplete';

        if (hasProgress) {
            return item; // Don't modify started tasks
        }

        // Update the task with new routine values
        const updated: Item = {
            ...item,
            title: routine.title,
        };

        // Update task type properties
        if (routine.taskType === 'time-tracked') {
            updated.minutesGoal = routine.minutesGoal;
            updated.minutes = 0;
            delete updated.targetCount;
            delete updated.completedCount;
        } else if (routine.taskType === 'multi-occurrence') {
            updated.targetCount = routine.targetCount;
            updated.completedCount = 0;
            delete updated.minutesGoal;
            delete updated.minutes;
        } else {
            // Simple task
            delete updated.minutesGoal;
            delete updated.minutes;
            delete updated.targetCount;
            delete updated.completedCount;
        }

        return updated;
    });
}

/**
 * Remove non-started tasks that no longer match the routine's schedule.
 * This handles cases where cadence changes to a less frequent option.
 */
export function removeOutdatedRoutineTasks(
    routine: Routine,
    items: Item[]
): Item[] {
    return items.filter(item => {
        // Keep items that aren't from this routine
        if (item.routineId !== routine.id) {
            return true;
        }

        // Keep started tasks
        const hasProgress = (item.minutes && item.minutes > 0) ||
            (item.completedCount && item.completedCount > 0) ||
            item.status !== 'incomplete';

        if (hasProgress) {
            return true;
        }

        // Check if task still matches the current schedule
        return shouldSpawnInWeek(item.week, routine);
    });
}
