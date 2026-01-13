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
}

export interface Routine {
    id: string;
    name: string;
    cadence: 'weekly' | 'biweekly' | 'monthly';
    defaultMinutesGoal?: number;
    notes?: string;
}

export interface AppState {
    items: Item[];
    routines: Routine[];
    currentTime: string; // ISO timestamp, mocked "now"
    allowUncomplete: boolean; // DevPanel flag
}
