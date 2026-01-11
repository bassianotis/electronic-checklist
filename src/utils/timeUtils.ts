import dayjs from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import isoWeek from 'dayjs/plugin/isoWeek';
import type { WeekKey } from '../types';

dayjs.extend(weekOfYear);
dayjs.extend(isoWeek);

/**
 * Get the Sunday-start week for a given date.
 * Returns format "YYYY-Www" where ww is the week number.
 */
export function getWeekKey(date: Date | string): WeekKey {
    const d = dayjs(date);
    // Get Sunday of this week (dayjs uses 0 = Sunday)
    const sunday = d.day() === 0 ? d : d.subtract(d.day(), 'day');
    const year = sunday.year();
    // Week number is 1-indexed, calculated from start of year
    const startOfYear = dayjs(`${year}-01-01`);
    const firstSunday = startOfYear.day() === 0
        ? startOfYear
        : startOfYear.add(7 - startOfYear.day(), 'day');

    let weekNum: number;
    if (sunday.isBefore(firstSunday)) {
        // This Sunday is in the previous year's last week
        const prevYear = year - 1;
        const prevYearStart = dayjs(`${prevYear}-01-01`);
        const prevFirstSunday = prevYearStart.day() === 0
            ? prevYearStart
            : prevYearStart.add(7 - prevYearStart.day(), 'day');
        weekNum = Math.floor(sunday.diff(prevFirstSunday, 'day') / 7) + 1;
        return `${prevYear}-W${weekNum.toString().padStart(2, '0')}`;
    }

    weekNum = Math.floor(sunday.diff(firstSunday, 'day') / 7) + 1;
    return `${year}-W${weekNum.toString().padStart(2, '0')}`;
}

/**
 * Get the present week key from a given "now" timestamp.
 */
export function presentWeek(now: Date | string): WeekKey {
    return getWeekKey(now);
}

/**
 * Add or subtract weeks from a week key.
 */
export function addWeeks(weekKey: WeekKey, n: number): WeekKey {
    const firstDay = getFirstDayOfWeek(weekKey);
    const newDate = dayjs(firstDay).add(n * 7, 'day');
    return getWeekKey(newDate.toDate());
}

/**
 * Get a relative label for a week compared to the present week.
 */
export function relativeLabel(
    weekKey: WeekKey,
    presentWeekKey: WeekKey
): string {
    if (weekKey === presentWeekKey) return 'This week';

    const present = getFirstDayOfWeek(presentWeekKey);
    const target = getFirstDayOfWeek(weekKey);
    const diffWeeks = Math.round(dayjs(target).diff(dayjs(present), 'day') / 7);

    if (diffWeeks === 1) return 'Next week';
    if (diffWeeks === -1) return 'Last week';
    if (diffWeeks > 1 && diffWeeks <= 4) return 'Next month';
    if (diffWeeks < -1 && diffWeeks >= -4) return 'Last month';
    if (diffWeeks > 4) return 'Later';
    return 'Earlier';
}

/**
 * Get the first day (Sunday) of a week from its key.
 */
export function getFirstDayOfWeek(weekKey: WeekKey): Date {
    const match = weekKey.match(/^(\d{4})-W(\d{2})$/);
    if (!match) throw new Error(`Invalid week key: ${weekKey}`);

    const year = parseInt(match[1], 10);
    const weekNum = parseInt(match[2], 10);

    const startOfYear = dayjs(`${year}-01-01`);
    const firstSunday = startOfYear.day() === 0
        ? startOfYear
        : startOfYear.add(7 - startOfYear.day(), 'day');

    return firstSunday.add((weekNum - 1) * 7, 'day').toDate();
}

/**
 * Check if an ISO date is within 7 days of now.
 */
export function isWithin7Days(isoDate: string, now: Date | string): boolean {
    const completed = dayjs(isoDate);
    const nowDate = dayjs(now);
    const diffDays = nowDate.diff(completed, 'day');
    return diffDays >= 0 && diffDays < 7;
}

/**
 * Add months with day clipping (e.g., Jan 31 + 1 month = Feb 28).
 */
export function addMonthsClip(date: Date, n: number): Date {
    const d = dayjs(date);
    const targetMonth = d.add(n, 'month');
    // dayjs handles day clipping automatically
    return targetMonth.toDate();
}

/**
 * Compare two week keys for sorting.
 * Returns negative if a < b, positive if a > b, 0 if equal.
 */
export function compareWeekKeys(a: WeekKey, b: WeekKey): number {
    const dateA = getFirstDayOfWeek(a);
    const dateB = getFirstDayOfWeek(b);
    return dateA.getTime() - dateB.getTime();
}

/**
 * Get the month name and year for a week.
 */
export function getMonthFromWeek(weekKey: WeekKey): { month: string; year: number } {
    const firstDay = getFirstDayOfWeek(weekKey);
    const d = dayjs(firstDay);
    return {
        month: d.format('MMMM'),
        year: d.year()
    };
}

/**
 * Format a date for display.
 */
export function formatDate(date: Date | string, format: string = 'MMM D, YYYY'): string {
    return dayjs(date).format(format);
}

/**
 * Check if a week is in the past relative to present.
 */
export function isPastWeek(weekKey: WeekKey, presentWeekKey: WeekKey): boolean {
    return compareWeekKeys(weekKey, presentWeekKey) < 0;
}

/**
 * Check if a week is in the future relative to present.
 */
export function isFutureWeek(weekKey: WeekKey, presentWeekKey: WeekKey): boolean {
    return compareWeekKeys(weekKey, presentWeekKey) > 0;
}
