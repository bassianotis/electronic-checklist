// Core types for the task list prototype

export type WeekKey = string; // e.g., "2026-W05" using Sunday start
export const IDEAS_WEEK_KEY = 'ideas';

export type ItemStatus = 'incomplete' | 'complete';

export interface Item {
    id: string;
    title: string;
    routineId?: string;
    week: WeekKey; // scheduled week
    status: ItemStatus;
    completedAt?: string; // ISO timestamp
    minutes?: number; // progress
    minutesGoal?: number; // optional display-only
    hasDueDate?: boolean;
    dueDateISO?: string; // optional absolute due date
    orderIndex: number; // for incomplete items
    archived?: boolean; // manually archived by user
    // Multi-occurrence tasks (e.g., "Water plants" 3x per week)
    targetCount?: number; // how many times to complete (e.g., 3)
    completedCount?: number; // how many times completed so far (e.g., 2)
    isSpacer?: boolean;
    originalWeek?: WeekKey; // original week if auto-rolled over from past
    notes?: string; // optional notes (max 140 chars)
    inheritedNotes?: string; // routine notes at spawn time (for comparison)
    updatedAt?: number; // unix timestamp
    deletedAt?: number; // unix timestamp for soft delete
}

export interface Routine {
    id: string;
    title: string;
    cadence: 'weekly' | 'biweekly' | 'monthly' | 'annually';
    taskType: 'simple' | 'multi-occurrence' | 'time-tracked';
    targetCount?: number;      // if taskType = multi-occurrence
    minutesGoal?: number;      // if taskType = time-tracked
    isYearRound: boolean;
    anchorWeek: WeekKey;       // starting week for alignment
    startMonth?: number;       // 1-12, if seasonal (!isYearRound)
    startWeekInMonth?: number; // 1-5, if seasonal
    endMonth?: number;         // 1-12, if seasonal
    endWeekInMonth?: number;   // 1-5, if seasonal
    notes?: string;
    lastCompletedAt?: string;  // ISO timestamp of most recent task completion
    dismissedAt?: string;      // ISO timestamp of last proposal dismissal (resets cadence clock)
    updatedAt?: number;
    deletedAt?: number;
}

// ==================== WeekNotes & Collections ====================

/**
 * DateDefinition: Defines when a collection item occurs annually.
 * - Fixed: A specific month and day (e.g., July 4th).
 * - Relative: Nth weekday of a month (e.g., 4th Thursday of November).
 */
export type DateDefinition =
    | { type: 'fixed'; month: number; day: number } // month: 1-12, day: 1-31
    | { type: 'relative'; month: number; weekday: number; ordinal: number | 'last' }; // weekday: 0=Sun..6=Sat, ordinal: 1-5 or 'last'

/**
 * Collection: A group of recurring informational dates (e.g., "Holidays", "Birthdays").
 */
export interface Collection {
    id: string;
    name: string;
    updatedAt?: number;
    deletedAt?: number;
}

/**
 * CollectionItem: A template for a recurring informational item within a collection.
 * Supports weekly, biweekly, monthly, and annually recurrence patterns.
 */
export interface CollectionItem {
    id: string;
    collectionId: string;
    title: string;
    cadence: 'weekly' | 'biweekly' | 'monthly' | 'annually';

    // For weekly/biweekly: which day of the week (0=Sun..6=Sat)
    dayOfWeek?: number;

    // For monthly/annually: defines the specific day pattern
    dateDefinition?: DateDefinition;

    // Starting point for cadence alignment (weekly/biweekly/monthly)
    anchorWeek?: WeekKey;

    // Bounds
    isYearRound: boolean;
    // For annually: start/end years
    startYear?: number;
    endYear?: number;
    // For weekly/biweekly/monthly: seasonal bounds (month + week-in-month)
    startMonth?: number;       // 1-12
    startWeekInMonth?: number; // 1-5
    endMonth?: number;         // 1-12
    endWeekInMonth?: number;   // 1-5

    notes?: string; // Default notes for spawned WeekNotes
    updatedAt?: number;
    deletedAt?: number;
}

/**
 * WeekNote: An informational note displayed at the top of a week.
 * Can be a one-off or spawned from a CollectionItem.
 */
export interface WeekNote {
    id: string;
    week: WeekKey;
    title: string;
    dateISO?: string; // The specific date (e.g., "2026-12-25"), optional for date-less notes
    collectionItemId?: string; // If spawned from a collection
    notes?: string; // User-editable notes for this instance
    inheritedNotes?: string; // Original notes from CollectionItem at spawn time
    updatedAt?: number;
    deletedAt?: number;
}

export interface AppState {
    items: Item[];
    routines: Routine[];
    collections: Collection[];
    collectionItems: CollectionItem[];
    weekNotes: WeekNote[];
    currentTime: string; // ISO timestamp, mocked "now"
    allowUncomplete: boolean; // DevPanel flag
    userTimezone: string;
    lastRolledWeek?: WeekKey;
    dataVersion: number;
    routineProposalsMigrationV1Done?: boolean;
    routineProposalsMigrationV2Done?: boolean;
}

// A routine that is currently due and eligible to be proposed to the user
export interface RoutineProposal {
    routine: Routine;
    lastCompletedAt: string | null;
    cadencePctElapsed: number; // e.g. 1.5 = 150% of cadence interval elapsed
}
