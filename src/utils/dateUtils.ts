import dayjs from 'dayjs';
import type { DateDefinition, WeekKey } from '../types';
import { getWeekKey, getFirstDayOfWeek } from './timeUtils';

/**
 * Resolves a DateDefinition to a specific date for a given year.
 * Returns null if the date is invalid (e.g., Feb 30).
 */
export function resolveDateForYear(def: DateDefinition, year: number): dayjs.Dayjs | null {
    if (def.type === 'fixed') {
        const date = dayjs().year(year).month(def.month - 1).date(def.day);
        // Validate the date is real (e.g., reject Feb 30)
        if (date.month() !== def.month - 1) {
            return null;
        }
        return date;
    }

    // Relative date: Nth weekday of Month
    const { month, weekday, ordinal } = def;
    const firstOfMonth = dayjs().year(year).month(month - 1).date(1);
    const lastOfMonth = firstOfMonth.endOf('month');

    if (ordinal === 'last') {
        // Find the last occurrence of weekday in the month
        let candidate = lastOfMonth;
        while (candidate.day() !== weekday) {
            candidate = candidate.subtract(1, 'day');
        }
        return candidate;
    }

    // Find the Nth occurrence of weekday
    let count = 0;
    let candidate = firstOfMonth;
    while (candidate.month() === month - 1) {
        if (candidate.day() === weekday) {
            count++;
            if (count === ordinal) {
                return candidate;
            }
        }
        candidate = candidate.add(1, 'day');
    }

    // Nth occurrence doesn't exist in this month
    return null;
}

/**
 * Gets the WeekKey that a specific date falls into.
 */
export function getWeekKeyForDate(date: dayjs.Dayjs): WeekKey {
    return getWeekKey(date.toISOString());
}

/**
 * Checks if a given date falls within a specific week.
 */
export function isDateInWeek(date: dayjs.Dayjs, weekKey: WeekKey): boolean {
    const weekStart = dayjs(getFirstDayOfWeek(weekKey));
    const weekEnd = weekStart.add(6, 'day').endOf('day');
    return date.isSame(weekStart, 'day') || date.isSame(weekEnd, 'day') ||
        (date.isAfter(weekStart) && date.isBefore(weekEnd));
}

/**
 * Gets all years that are visible given a set of week keys.
 * Used to determine which years to resolve collection items for.
 */
export function getVisibleYears(weekKeys: WeekKey[]): number[] {
    const years = new Set<number>();
    for (const weekKey of weekKeys) {
        const weekStart = dayjs(getFirstDayOfWeek(weekKey));
        years.add(weekStart.year());
        // A week can span two years (e.g., Dec 29 - Jan 4)
        const weekEnd = weekStart.add(6, 'day');
        years.add(weekEnd.year());
    }
    return Array.from(years).sort();
}
