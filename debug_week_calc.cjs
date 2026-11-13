
const dayjs = require('dayjs');
const weekOfYear = require('dayjs/plugin/weekOfYear');
const isoWeek = require('dayjs/plugin/isoWeek');

dayjs.extend(weekOfYear);
dayjs.extend(isoWeek);

function getWeekInMonth(dateStr) {
    const date = dayjs(dateStr);
    const firstOfMonth = date.startOf('month');
    const firstSunday = firstOfMonth.day() === 0
        ? firstOfMonth
        : firstOfMonth.add(7 - firstOfMonth.day(), 'day');

    if (date.isBefore(firstSunday)) {
        return 1;
    }

    // Fixed Logic
    const weekNum = Math.floor(date.diff(firstSunday, 'day') / 7) + (firstOfMonth.day() === 0 ? 1 : 2);
    return weekNum;
}

function getWeekInMonthOLD(dateStr) {
    const date = dayjs(dateStr);
    const firstOfMonth = date.startOf('month');
    const firstSunday = firstOfMonth.day() === 0
        ? firstOfMonth
        : firstOfMonth.add(7 - firstOfMonth.day(), 'day');

    if (date.isBefore(firstSunday)) {
        return 1;
    }

    // Old Logic
    const weekNum = Math.floor(date.diff(firstSunday, 'day') / 7) + 2;
    return weekNum;
}

console.log('--- Current Logic ---');
console.log('Jan 18, 2026 (Sun) WeekInMonth:', getWeekInMonth('2026-01-18'));
console.log('Jan 25, 2026 (Sun) WeekInMonth:', getWeekInMonth('2026-01-25'));
console.log('Feb 1, 2026 (Sun) WeekInMonth:', getWeekInMonth('2026-02-01'));
console.log('Feb 18, 2026 (Wed) WeekInMonth:', getWeekInMonth('2026-02-18'));
console.log('Feb 25, 2026 (Wed) WeekInMonth:', getWeekInMonth('2026-02-25'));
