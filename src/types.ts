// Core types for the task list prototype

export type WeekKey = string; // e.g., "2026-W05" using Sunday start

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
    originalWeek?: WeekKey; // original week if auto-rolled over from past
    notes?: string; // optional notes (max 140 chars)
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
}

export interface AppState {
    items: Item[];
    routines: Routine[];
    currentTime: string; // ISO timestamp, mocked "now"
    allowUncomplete: boolean; // DevPanel flag
}
