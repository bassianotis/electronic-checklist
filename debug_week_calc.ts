
import dayjs from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(weekOfYear);
dayjs.extend(isoWeek);

function getWeekInMonth(date: dayjs.Dayjs): number {
    const firstOfMonth = date.startOf('month');
    const firstSunday = firstOfMonth.day() === 0
        ? firstOfMonth
        : firstOfMonth.add(7 - firstOfMonth.day(), 'day');

    if (date.isBefore(firstSunday)) {
        return 1;
    }

    const weekNum = Math.floor(date.diff(firstSunday, 'day') / 7) + (firstOfMonth.day() === 0 ? 1 : 2);
    return weekNum;
}

const jan18 = dayjs('2026-01-18');
const jan25 = dayjs('2026-01-25');

console.log('Jan 18, 2026 WeekInMonth:', getWeekInMonth(jan18));
console.log('Jan 25, 2026 WeekInMonth:', getWeekInMonth(jan25));

const feb1 = dayjs('2026-02-01');
const feb18 = dayjs('2026-02-18');
console.log('Feb 1, 2026 (Sun) WeekInMonth:', getWeekInMonth(feb1));
console.log('Feb 18, 2026 (Wed) WeekInMonth:', getWeekInMonth(feb18));
