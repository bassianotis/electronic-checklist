import dayjs from 'dayjs';
import type { CollectionItem, WeekNote, WeekKey, DateDefinition } from '../types';
import { resolveDateForYear, getWeekKeyForDate } from './dateUtils';
import { getFirstDayOfWeek } from './timeUtils';

/**
 * Get the week number within a month (1-5) for a given date.
 * Same logic as routineSpawner.
 */
function getWeekInMonth(date: dayjs.Dayjs): number {
    const firstOfMonth = date.startOf('month');
    const firstSunday = firstOfMonth.day() === 0
        ? firstOfMonth
        : firstOfMonth.add(7 - firstOfMonth.day(), 'day');

    if (date.isBefore(firstSunday)) {
        return 1;
    }

    // Always count from the first Sunday: first Sunday = 1, second = 2, etc.
    const weekNum = Math.floor(date.diff(firstSunday, 'day') / 7) + 1;
    return weekNum;
}

/**
 * Check if a week falls within a seasonal range for a collection item.
 * Similar to routineSpawner's isWeekInSeason.
 */
function isWeekInSeason(weekKey: WeekKey, item: CollectionItem): boolean {
    if (item.isYearRound) {
        // Even if year-round, check start bounds if they exist (for Monthly anchors)
        if (item.startYear || item.startMonth) {
            const weekDate = dayjs(getFirstDayOfWeek(weekKey));
            const currentYear = weekDate.year();
            const month = weekDate.month() + 1;

            // Check Start Year
            if (item.startYear && currentYear < item.startYear) return false;

            // Check Start Month (only separate check logic if same year)
            // Actually, if startYear is defined, we should treat it as a Start Date.
            if (item.startYear && currentYear === item.startYear && item.startMonth) {
                const currentVal = currentYear * 100 + month;
                const startVal = item.startYear * 100 + item.startMonth;
                // If current month is before start month in the start year
                if (currentVal < startVal) return false;
            }

            // If NO startYear but startMonth exists (unlikely for strict anchor, but possible legacy/draft)
            // We generally assume startYear is present if startMonth anchor is desired for YearRound.
            // If strict "Year Round" ignoring year, we don't check year. 
        }
        return true;
    }

    // For annually items, check year bounds
    if (item.cadence === 'annually') {
        const weekDate = dayjs(getFirstDayOfWeek(weekKey));
        const year = weekDate.year();
        if (item.startYear && year < item.startYear) return false;
        if (item.endYear && year > item.endYear) return false;
        return true;
    }

    // For other cadences:
    // If startYear is set, treat this as a one-time/bounded occurrence (not recurring every year)
    if (item.startYear) {
        const weekDate = dayjs(getFirstDayOfWeek(weekKey));
        const currentYear = weekDate.year();
        const startYear = item.startYear!;
        // Use endYear if set, otherwise default to same year as start (implied single season)
        // Actually, let's assume endYear must be set if startYear is set for valid bounds, 
        // or default endYear = startYear + 1 if spanning? 
        // Let's assume strict bounds require both.
        const endYear = item.endYear ?? startYear;

        // Construct comparable values (YYYYMMW)
        // Note: weekInMonth is 1-5, month is 1-12
        const currentVal = currentYear * 1000 + (weekDate.month() + 1) * 10 + getWeekInMonth(weekDate);
        const startVal = startYear * 1000 + item.startMonth! * 10 + item.startWeekInMonth!;
        const endVal = endYear * 1000 + item.endMonth! * 10 + item.endWeekInMonth!;

        if (currentVal < startVal || currentVal > endVal) {
            return false;
        }

        return true;
    }

    // Traditional recurring seasonal logic (ignoring year)
    const weekDate = dayjs(getFirstDayOfWeek(weekKey));
    const month = weekDate.month() + 1; // 1-indexed
    const weekInMonth = getWeekInMonth(weekDate);

    const startMonth = item.startMonth!;
    const startWeek = item.startWeekInMonth!;
    const endMonth = item.endMonth!;
    const endWeek = item.endWeekInMonth!;

    // Handle non-wrapping seasons (e.g., May-Sept)
    if (startMonth <= endMonth) {
        if (month < startMonth || month > endMonth) return false;
        if (month === startMonth && weekInMonth < startWeek) return false;
        if (month === endMonth && weekInMonth > endWeek) return false;
        return true;
    }

    // Handle wrapping seasons (e.g., Nov-Feb)
    if (month > endMonth && month < startMonth) return false;
    if (month === startMonth && weekInMonth < startWeek) return false;
    if (month === endMonth && weekInMonth > endWeek) return false;
    return true;
}

/**
 * Check if a week matches the item's cadence pattern.
 */
function matchesCadence(weekKey: WeekKey, item: CollectionItem): boolean {
    const weekDate = dayjs(getFirstDayOfWeek(weekKey));

    switch (item.cadence) {
        case 'weekly': {
            // Check if the week contains the specified day of week
            if (item.dayOfWeek === undefined) return false;
            // Weekly spawns in every week that's after or equal to anchor
            if (item.anchorWeek) {
                const anchorDate = dayjs(getFirstDayOfWeek(item.anchorWeek));
                if (weekDate.isBefore(anchorDate)) return false;
            }
            return true;
        }

        case 'biweekly': {
            if (item.dayOfWeek === undefined || !item.anchorWeek) return false;
            const anchorDate = dayjs(getFirstDayOfWeek(item.anchorWeek));
            if (weekDate.isBefore(anchorDate)) return false;
            const weeksDiff = weekDate.diff(anchorDate, 'week');
            return weeksDiff % 2 === 0;
        }

        case 'monthly': {
            if (!item.dateDefinition) return false;
            // Check if this week contains the monthly occurrence
            const def = item.dateDefinition;

            if (def.type === 'fixed') {
                // Fixed day of month (e.g., 15th)
                // Check if the 'day' falls within this week
                const targetDay = weekDate.startOf('month').date(def.day);
                if (!targetDay.isValid()) return false;
                const targetWeek = getWeekKeyForDate(targetDay);
                return targetWeek === weekKey;
            } else {
                // Relative (e.g., 2nd Monday)
                const targetDay = resolveRelativeDayInMonth(weekDate.month() + 1, weekDate.year(), def);
                if (!targetDay) return false;
                const targetWeek = getWeekKeyForDate(targetDay);
                return targetWeek === weekKey;
            }
        }

        case 'annually': {
            if (!item.dateDefinition) return false;

            const weekEnd = weekDate.add(6, 'day');
            const startYear = weekDate.year();
            const endYear = weekEnd.year();

            // Check start year
            let targetDate = resolveDateForYear(item.dateDefinition, startYear);
            if (targetDate && getWeekKeyForDate(targetDate) === weekKey) return true;

            // Check end year if different
            if (startYear !== endYear) {
                targetDate = resolveDateForYear(item.dateDefinition, endYear);
                if (targetDate && getWeekKeyForDate(targetDate) === weekKey) return true;
            }

            return false;
        }

        default:
            return false;
    }
}

/**
 * Resolve a relative date definition to a specific day in a given month/year.
 */
function resolveRelativeDayInMonth(month: number, year: number, def: DateDefinition): dayjs.Dayjs | null {
    if (def.type !== 'relative') return null;

    const firstOfMonth = dayjs().year(year).month(month - 1).startOf('month');
    const lastOfMonth = firstOfMonth.endOf('month');

    // Find all occurrences of the weekday in this month
    const occurrences: dayjs.Dayjs[] = [];
    let current = firstOfMonth;
    while (current.isBefore(lastOfMonth) || current.isSame(lastOfMonth, 'day')) {
        if (current.day() === def.weekday) {
            occurrences.push(current);
        }
        current = current.add(1, 'day');
    }

    if (occurrences.length === 0) return null;

    if (def.ordinal === 'last') {
        return occurrences[occurrences.length - 1];
    }

    const index = (def.ordinal as number) - 1;
    return occurrences[index] || null;
}

/**
 * Get the specific date for this week's occurrence based on item config.
 */
function getOccurrenceDate(weekKey: WeekKey, item: CollectionItem): dayjs.Dayjs | null {
    const weekDate = dayjs(getFirstDayOfWeek(weekKey));

    switch (item.cadence) {
        case 'weekly':
        case 'biweekly': {
            if (item.dayOfWeek === undefined) return null;
            // Return the specific day of this week
            return weekDate.day(item.dayOfWeek);
        }

        case 'monthly': {
            if (!item.dateDefinition) return null;
            const def = item.dateDefinition;
            const month = weekDate.month() + 1;
            const year = weekDate.year();

            if (def.type === 'fixed') {
                return weekDate.startOf('month').date(def.day).isValid()
                    ? weekDate.startOf('month').date(def.day)
                    : null;
            } else {
                return resolveRelativeDayInMonth(month, year, def);
            }
        }

        case 'annually': {
            if (!item.dateDefinition) return null;
            const year = weekDate.year();
            return resolveDateForYear(item.dateDefinition, year);
        }

        default:
            return null;
    }
}

/**
 * Determines if a note should spawn for a collection item in a given week.
 */
export function shouldSpawnNoteInWeek(weekKey: WeekKey, item: CollectionItem): boolean {
    return isWeekInSeason(weekKey, item) && matchesCadence(weekKey, item);
}

/**
 * Generates a unique ID for a collection-spawned WeekNote.
 * Uses weekKey for weekly/biweekly/monthly, year for annually.
 */
function generateWeekNoteId(item: CollectionItem, weekKey: WeekKey): string {
    if (item.cadence === 'annually') {
        const weekDate = dayjs(getFirstDayOfWeek(weekKey));
        return `${item.id}-${weekDate.year()}`;
    }
    return `${item.id}-${weekKey}`;
}

/**
 * Spawns WeekNotes for collection items across all visible weeks.
 * Returns new WeekNotes that don't already exist.
 */
export function spawnCollectionNotes(
    collectionItems: CollectionItem[],
    visibleWeeks: WeekKey[],
    existingNotes: WeekNote[]
): WeekNote[] {
    const existingIds = new Set(existingNotes.map(note => note.id));
    const newNotes: WeekNote[] = [];

    const activeItems = collectionItems.filter(item => !item.deletedAt);

    for (const item of activeItems) {
        for (const weekKey of visibleWeeks) {
            if (!shouldSpawnNoteInWeek(weekKey, item)) {
                continue;
            }

            const noteId = generateWeekNoteId(item, weekKey);

            // Skip if already exists
            if (existingIds.has(noteId)) {
                continue;
            }

            // Get the specific date for this occurrence
            const occurrenceDate = getOccurrenceDate(weekKey, item);

            const weekNote: WeekNote = {
                id: noteId,
                week: weekKey,
                title: item.title,
                dateISO: occurrenceDate?.format('YYYY-MM-DD'),
                collectionItemId: item.id,
                notes: item.notes,
                inheritedNotes: item.notes,
            };

            newNotes.push(weekNote);
            existingIds.add(noteId); // Prevent duplicates in same run
        }
    }

    return newNotes;
}

/**
 * Removes WeekNotes that no longer have a valid collection item.
 */
export function removeOrphanedWeekNotes(
    weekNotes: WeekNote[],
    collectionItems: CollectionItem[]
): WeekNote[] {
    const activeItemIds = new Set(
        collectionItems.filter(item => !item.deletedAt).map(item => item.id)
    );

    return weekNotes.filter(note => {
        if (!note.collectionItemId) return true;
        return activeItemIds.has(note.collectionItemId);
    });
}

/**
 * Updates existing WeekNotes when a collection item is modified.
 */
export function updateWeekNotesFromCollectionItem(
    weekNotes: WeekNote[],
    updatedItem: CollectionItem,
    overwriteModifiedNotes: boolean = false
): WeekNote[] {
    return weekNotes.map(note => {
        if (note.collectionItemId !== updatedItem.id) {
            return note;
        }

        const updates: Partial<WeekNote> = {
            title: updatedItem.title,
        };

        if (note.notes === note.inheritedNotes || overwriteModifiedNotes) {
            updates.notes = updatedItem.notes;
            updates.inheritedNotes = updatedItem.notes;
        } else {
            updates.inheritedNotes = updatedItem.notes;
        }

        // Recalculate dateISO in case day/month definition changed
        const newDate = getOccurrenceDate(note.week, updatedItem);
        if (newDate) {
            updates.dateISO = newDate.format('YYYY-MM-DD');
        }

        return { ...note, ...updates };
    });
}

/**
 * Removes WeekNotes that no longer match the collection item's schedule.
 * Similar to removeOutdatedRoutineTasks.
 */
export function removeOutdatedWeekNotes(
    weekNotes: WeekNote[],
    item: CollectionItem
): WeekNote[] {
    return weekNotes.filter(note => {
        if (note.collectionItemId !== item.id) return true;
        // Keep notes that match the current schedule
        return shouldSpawnNoteInWeek(note.week, item);
    });
}
