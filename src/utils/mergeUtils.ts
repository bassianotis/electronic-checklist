import type { AppState } from '../types';

export function mergeState(local: AppState, remote: AppState): AppState {
    const mergedItems = mergeEntities(local.items, remote.items, (l, r) => {
        // Custom logic for Item fields
        const merged = { ...r };

        // Counters: Max wins
        if (l.completedCount !== undefined || r.completedCount !== undefined) {
            merged.completedCount = Math.max(l.completedCount || 0, r.completedCount || 0);
        }
        if (l.minutes !== undefined || r.minutes !== undefined) {
            merged.minutes = Math.max(l.minutes || 0, r.minutes || 0);
        }

        // Status Re-evaluation based on merged progress
        // Only auto-complete items that HAVE goals (time-tracked or multi-occurrence)
        // Simple items and ideas keep their existing status
        const hasGoals = merged.minutesGoal || merged.targetCount;

        if (hasGoals) {
            if (isGoalMet(merged)) {
                merged.status = 'complete';
                merged.completedAt = l.status === 'complete' ? l.completedAt : (r.status === 'complete' ? r.completedAt : new Date().toISOString());
            } else {
                merged.status = 'incomplete';
                merged.completedAt = undefined;
            }
        }
        // For simple items without goals, keep the most recent status (remote wins by default from spread)

        return merged;
    });

    const mergedRoutines = mergeEntities(local.routines, remote.routines, (_l, r) => ({ ...r }));

    // Merge collections, collection items, and week notes (simple LWW for now)
    const mergedCollections = mergeEntities(local.collections || [], remote.collections || [], (_l, r) => ({ ...r }));
    const mergedCollectionItems = mergeEntities(local.collectionItems || [], remote.collectionItems || [], (_l, r) => ({ ...r }));
    const mergedWeekNotes = mergeEntities(local.weekNotes || [], remote.weekNotes || [], (_l, r) => ({ ...r }));

    // Sanitize items: Remove items with invalid week keys, clean up originalWeek
    const WEEK_KEY_REGEX = /^\d{4}-W\d{2}$/;
    const IDEAS_KEY = 'ideas';
    const sanitizedItems = mergedItems
        .filter(item => {
            // Keep items with valid week keys or 'ideas'
            return item.week === IDEAS_KEY || WEEK_KEY_REGEX.test(item.week);
        })
        .map(item => {
            // Clean up invalid originalWeek
            if (item.originalWeek && !WEEK_KEY_REGEX.test(item.originalWeek)) {
                const { originalWeek, ...rest } = item;
                return rest;
            }
            return item;
        });

    // Timezone: Remote usually implies "Server/User Source of Truth", but strictly it's per-user.
    // If we changed TZ locally, we might want to keep it. 
    // Let's say: more recent update wins for settings.
    // We don't track updatedAt for AppState root yet, so we'll trust Remote as strict source of truth for root settings if conflict.

    return {
        ...remote,
        items: sanitizedItems,
        routines: mergedRoutines,
        collections: mergedCollections,
        collectionItems: mergedCollectionItems,
        weekNotes: mergedWeekNotes,
        // Preserve local dev flags
        allowUncomplete: local.allowUncomplete,
        currentTime: local.currentTime, // Keep local time mocking
    };
}

function mergeEntities<T extends { id: string, updatedAt?: number, deletedAt?: number }>(
    localList: T[],
    remoteList: T[],
    mergeFields: (local: T, remote: T) => T
): T[] {
    const map = new Map<string, T>();

    // Index all local
    localList.forEach(i => map.set(i.id, i));

    // Merge remote
    remoteList.forEach(remote => {
        const local = map.get(remote.id);

        if (!local) {
            // New from remote
            map.set(remote.id, remote);
            return;
        }

        // Conflict Resolution
        const localTime = local.updatedAt || 0;
        const remoteTime = remote.updatedAt || 0;

        // 1. Deleted Wins (if deletedAt is set, it's dead)
        if (remote.deletedAt) {
            map.set(remote.id, remote);
            return;
        }
        if (local.deletedAt) {
            // Local deleted it, keep local (unless remote is WAY newer? No, delete is authoritative usually)
            // But if remote was updated AFTER local delete? "Resurrection".
            // Strict rule: "If one side deleted, it's deleted" (unless we support undelete).
            // Let's assume deletedAt timestamp determines too.
            if (remoteTime > (local.deletedAt || 0)) {
                // Remote updated strictly after local deletion -> Resurrect
                map.set(remote.id, mergeFields(local, remote));
            } else {
                // Keep deletion
                map.set(local.id, local);
            }
            return;
        }

        // 2. UpdatedAt Wins
        if (remoteTime >= localTime) {
            map.set(remote.id, mergeFields(local, remote));
        } else {
            // Local is newer
            // But we need to make sure we don't lose field-specific merges (like counters)
            // For now, simpler: "Winner takes all fields" + custom mergeFields logic
            // Actually, if local is newer, we keep local, but maybe apply max() logic too?
            // Symetric merge is best.
            map.set(local.id, mergeFields(remote, local)); // Note: switching args
        }
    });

    return Array.from(map.values());
}

function isGoalMet(item: any): boolean {
    const minutesMet = !item.minutesGoal || (item.minutes ?? 0) >= item.minutesGoal;
    const countMet = !item.targetCount || (item.completedCount ?? 0) >= item.targetCount;
    return minutesMet && countMet;
}
