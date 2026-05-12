import { describe, it, expect } from 'vitest';
import { mergeState } from './mergeUtils';
import type { AppState, Item, WeekKey } from '../types';

function makeState(overrides: Partial<AppState> = {}): AppState {
    return {
        items: [],
        routines: [],
        collections: [],
        collectionItems: [],
        weekNotes: [],
        currentTime: '2026-01-01T00:00:00.000Z',
        allowUncomplete: false,
        userTimezone: 'UTC',
        dataVersion: 0,
        ...overrides,
    };
}

function makeItem(id: string, overrides: Partial<Item> = {}): Item {
    return {
        id,
        title: 'test',
        week: '2026-W01',
        status: 'incomplete',
        orderIndex: 0,
        ...overrides,
    };
}

describe('mergeState — per-item LWW', () => {
    it('remote wins when its updatedAt is newer', () => {
        const local = makeState({ items: [makeItem('a', { title: 'old', updatedAt: 100 })] });
        const remote = makeState({ items: [makeItem('a', { title: 'new', updatedAt: 200 })] });
        const merged = mergeState(local, remote);
        expect(merged.items[0].title).toBe('new');
    });

    it('local wins when its updatedAt is newer', () => {
        const local = makeState({ items: [makeItem('a', { title: 'kept', updatedAt: 300 })] });
        const remote = makeState({ items: [makeItem('a', { title: 'overwritten', updatedAt: 200 })] });
        const merged = mergeState(local, remote);
        expect(merged.items[0].title).toBe('kept');
    });

    it('adopts items present only on remote', () => {
        const merged = mergeState(
            makeState({ items: [] }),
            makeState({ items: [makeItem('a', { title: 'remote-only' })] }),
        );
        expect(merged.items).toHaveLength(1);
        expect(merged.items[0].title).toBe('remote-only');
    });

    it('keeps items present only on local', () => {
        const merged = mergeState(
            makeState({ items: [makeItem('a', { title: 'local-only' })] }),
            makeState({ items: [] }),
        );
        expect(merged.items).toHaveLength(1);
        expect(merged.items[0].title).toBe('local-only');
    });
});

describe('mergeState — multi-occurrence counter merge', () => {
    it('takes the max for concurrent increments (neither side reset)', () => {
        const local = makeState({ items: [makeItem('a', {
            updatedAt: 100, completedCount: 2, targetCount: 3,
        })] });
        const remote = makeState({ items: [makeItem('a', {
            updatedAt: 200, completedCount: 1, targetCount: 3,
        })] });
        const merged = mergeState(local, remote);
        expect(merged.items[0].completedCount).toBe(2);
    });

    it('honors explicit reset on the newer side (regression: uncomplete survives merge)', () => {
        // Device A: completedCount=3, status=complete.
        // Device A uncompletes → completedCount=0, status=incomplete, newer updatedAt.
        // Device B's local still has completedCount=3.
        // Merge must keep count=0 / status=incomplete, not silently revive complete.
        const local = makeState({ items: [makeItem('a', {
            status: 'complete', completedAt: 'X',
            updatedAt: 100, completedCount: 3, targetCount: 3,
        })] });
        const remote = makeState({ items: [makeItem('a', {
            status: 'incomplete',
            updatedAt: 200, completedCount: 0, targetCount: 3,
        })] });
        const merged = mergeState(local, remote);
        expect(merged.items[0].completedCount).toBe(0);
        expect(merged.items[0].status).toBe('incomplete');
    });

    it('honors explicit minutes reset on the newer side', () => {
        const local = makeState({ items: [makeItem('a', {
            status: 'complete', updatedAt: 100, minutes: 30, minutesGoal: 30,
        })] });
        const remote = makeState({ items: [makeItem('a', {
            status: 'incomplete', updatedAt: 200, minutes: 0, minutesGoal: 30,
        })] });
        const merged = mergeState(local, remote);
        expect(merged.items[0].minutes).toBe(0);
        expect(merged.items[0].status).toBe('incomplete');
    });

    it('re-evaluates status to complete when concurrent increments reach goal', () => {
        const local = makeState({ items: [makeItem('a', {
            updatedAt: 100, completedCount: 3, targetCount: 3, status: 'incomplete',
        })] });
        const remote = makeState({ items: [makeItem('a', {
            updatedAt: 200, completedCount: 2, targetCount: 3, status: 'incomplete',
        })] });
        const merged = mergeState(local, remote);
        expect(merged.items[0].completedCount).toBe(3);
        expect(merged.items[0].status).toBe('complete');
    });
});

describe('mergeState — deletion semantics', () => {
    it('remote deletion wins over older local edit', () => {
        const local = makeState({ items: [makeItem('a', { title: 'edited', updatedAt: 100 })] });
        const remote = makeState({ items: [makeItem('a', { deletedAt: 200, updatedAt: 200 })] });
        const merged = mergeState(local, remote);
        expect(merged.items[0].deletedAt).toBe(200);
    });

    it('local deletion preserved when remote is older', () => {
        const local = makeState({ items: [makeItem('a', { deletedAt: 200, updatedAt: 200 })] });
        const remote = makeState({ items: [makeItem('a', { title: 'stale', updatedAt: 100 })] });
        const merged = mergeState(local, remote);
        expect(merged.items[0].deletedAt).toBe(200);
    });

    it('remote resurrects a locally-deleted item when remote was updated after the delete', () => {
        const local = makeState({ items: [makeItem('a', { deletedAt: 100, updatedAt: 100 })] });
        const remote = makeState({ items: [makeItem('a', { title: 'resurrected', updatedAt: 200 })] });
        const merged = mergeState(local, remote);
        expect(merged.items[0].deletedAt).toBeUndefined();
        expect(merged.items[0].title).toBe('resurrected');
    });
});

describe('mergeState — root settings', () => {
    it('remote wins userTimezone (remote-wins by default for root)', () => {
        const merged = mergeState(
            makeState({ userTimezone: 'America/Los_Angeles' }),
            makeState({ userTimezone: 'Europe/London' }),
        );
        expect(merged.userTimezone).toBe('Europe/London');
    });

    it('preserves local currentTime (dev time-mocking)', () => {
        const merged = mergeState(
            makeState({ currentTime: '2026-06-01T00:00:00.000Z' }),
            makeState({ currentTime: '2026-01-01T00:00:00.000Z' }),
        );
        expect(merged.currentTime).toBe('2026-06-01T00:00:00.000Z');
    });

    it('preserves local allowUncomplete (dev flag)', () => {
        const merged = mergeState(
            makeState({ allowUncomplete: true }),
            makeState({ allowUncomplete: false }),
        );
        expect(merged.allowUncomplete).toBe(true);
    });
});

describe('mergeState — week-key sanitization', () => {
    it('drops items with invalid week keys', () => {
        const merged = mergeState(
            makeState({ items: [makeItem('a', { week: 'not-a-week' as WeekKey })] }),
            makeState({ items: [makeItem('b', { week: '2026-W01' })] }),
        );
        expect(merged.items.find(i => i.id === 'a')).toBeUndefined();
        expect(merged.items.find(i => i.id === 'b')).toBeDefined();
    });

    it('preserves items in the ideas backlog', () => {
        const merged = mergeState(
            makeState({ items: [makeItem('a', { week: 'ideas' })] }),
            makeState({ items: [] }),
        );
        expect(merged.items).toHaveLength(1);
    });
});
