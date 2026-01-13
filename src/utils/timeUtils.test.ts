import { describe, it, expect } from 'vitest';
import {
    getWeekKey,
    presentWeek,
    addWeeks,
    relativeLabel,
    getFirstDayOfWeek,
    isWithin7Days,
    addMonthsClip,
    compareWeekKeys,
    isPastWeek,
    isFutureWeek,
} from './timeUtils';

describe('getWeekKey', () => {
    it('returns correct week key for a Sunday', () => {
        // Feb 1, 2026 is a Sunday
        const result = getWeekKey('2026-02-01');
        expect(result).toBe('2026-W05');
    });

    it('returns correct week key for a weekday (uses that week\'s Sunday)', () => {
        // Feb 3, 2026 is a Tuesday
        const result = getWeekKey('2026-02-03T10:30:00');
        expect(result).toBe('2026-W05');
    });

    it('returns correct week key for a Saturday (same week as Sunday)', () => {
        // Feb 7, 2026 is a Saturday
        const result = getWeekKey('2026-02-07');
        expect(result).toBe('2026-W05');
    });

    it('handles year boundary correctly', () => {
        // Dec 28, 2025 is a Sunday
        const result = getWeekKey('2025-12-28');
        expect(result).toBe('2025-W52');
    });
});

describe('presentWeek', () => {
    it('returns current week key', () => {
        const result = presentWeek('2026-02-03T10:30:00');
        expect(result).toBe('2026-W05');
    });
});

describe('addWeeks', () => {
    it('adds weeks correctly', () => {
        const result = addWeeks('2026-W05', 1);
        expect(result).toBe('2026-W06');
    });

    it('subtracts weeks correctly', () => {
        const result = addWeeks('2026-W05', -1);
        expect(result).toBe('2026-W04');
    });

    it('handles year boundary when adding', () => {
        // 2025-W52 + 2 weeks = 2026-W02 (weeks are Sunday-start)
        const result = addWeeks('2025-W52', 2);
        expect(result).toBe('2026-W02');
    });
});

describe('relativeLabel', () => {
    it('returns "This week" for same week', () => {
        const result = relativeLabel('2026-W05', '2026-W05');
        expect(result).toBe('This week');
    });

    it('returns "Next week" for week + 1', () => {
        const result = relativeLabel('2026-W06', '2026-W05');
        expect(result).toBe('Next week');
    });

    it('returns "Last week" for week - 1', () => {
        const result = relativeLabel('2026-W04', '2026-W05');
        expect(result).toBe('Last week');
    });

    it('returns "Next month" for weeks 2-4 ahead', () => {
        const result = relativeLabel('2026-W08', '2026-W05');
        expect(result).toBe('Next month');
    });

    it('returns "Later" for weeks > 4 ahead', () => {
        const result = relativeLabel('2026-W15', '2026-W05');
        expect(result).toBe('Later');
    });
});

describe('getFirstDayOfWeek', () => {
    it('returns first Sunday of the week', () => {
        const result = getFirstDayOfWeek('2026-W05');
        expect(result.getDate()).toBe(1); // Feb 1, 2026
        expect(result.getMonth()).toBe(1); // February
        expect(result.getFullYear()).toBe(2026);
    });
});

describe('isWithin7Days', () => {
    it('returns true for date within 7 days', () => {
        const now = '2026-02-03T10:30:00';
        const date = '2026-02-01T10:00:00'; // 2 days ago
        expect(isWithin7Days(date, now)).toBe(true);
    });

    it('returns false for date more than 7 days ago', () => {
        const now = '2026-02-03T10:30:00';
        const date = '2026-01-25T10:00:00'; // 9 days ago
        expect(isWithin7Days(date, now)).toBe(false);
    });

    it('returns true for date exactly 6 days ago', () => {
        const now = '2026-02-07T10:30:00';
        const date = '2026-02-01T10:00:00'; // 6 days ago
        expect(isWithin7Days(date, now)).toBe(true);
    });
});

describe('addMonthsClip', () => {
    it('adds months correctly', () => {
        const date = new Date('2026-01-15');
        const result = addMonthsClip(date, 1);
        expect(result.getMonth()).toBe(1); // February
    });

    it('clips day when target month is shorter', () => {
        const date = new Date('2026-01-31');
        const result = addMonthsClip(date, 1);
        expect(result.getMonth()).toBe(1); // February
        expect(result.getDate()).toBe(28); // Clipped to Feb 28
    });
});

describe('compareWeekKeys', () => {
    it('returns negative for earlier week', () => {
        const result = compareWeekKeys('2026-W04', '2026-W05');
        expect(result).toBeLessThan(0);
    });

    it('returns positive for later week', () => {
        const result = compareWeekKeys('2026-W06', '2026-W05');
        expect(result).toBeGreaterThan(0);
    });

    it('returns 0 for same week', () => {
        const result = compareWeekKeys('2026-W05', '2026-W05');
        expect(result).toBe(0);
    });
});

describe('isPastWeek / isFutureWeek', () => {
    it('correctly identifies past week', () => {
        expect(isPastWeek('2026-W04', '2026-W05')).toBe(true);
        expect(isPastWeek('2026-W05', '2026-W05')).toBe(false);
    });

    it('correctly identifies future week', () => {
        expect(isFutureWeek('2026-W06', '2026-W05')).toBe(true);
        expect(isFutureWeek('2026-W05', '2026-W05')).toBe(false);
    });
});
