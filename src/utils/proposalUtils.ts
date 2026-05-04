import dayjs from 'dayjs';
import type { Item, Routine, RoutineProposal } from '../types';
import { getWeekKey, addWeeks } from './timeUtils';
import { isWeekInSeason, matchesCadence } from './routineSpawner';

export const PROPOSALS_CONTAINER_KEY = 'routine-proposals';

// Cadence interval in days
const CADENCE_DAYS: Record<Routine['cadence'], number> = {
    weekly: 7,
    biweekly: 14,
    monthly: 30,
    annually: 365,
};

/**
 * Compute ranked routine proposals from current state.
 * Pure function — no side effects. Safe to use in useMemo.
 *
 * A routine appears as a proposal when:
 * - It is not deleted
 * - It is in-season (or year-round)
 * - It has no active accepted task in the current or next week
 * - Its cadence percentage elapsed >= 100% (it's due)
 *
 * Proposals are sorted descending by cadencePctElapsed (most overdue first).
 */
export function computeProposals(
    routines: Routine[],
    items: Item[],
    currentTime: string
): RoutineProposal[] {
    const presentWeek = getWeekKey(currentTime);
    const nextWeek = addWeeks(presentWeek, 1);
    const now = dayjs(currentTime);

    const proposals: RoutineProposal[] = [];

    for (const routine of routines) {
        if (routine.deletedAt) continue;

        // Seasonal filter — only show in-season routines
        if (!isWeekInSeason(presentWeek, routine)) continue;

        // Skip if there's any task for this routine in present or next week
        // (including completed — otherwise a weekly routine just completed re-proposes immediately)
        const hasTaskThisWindow = items.some(
            item =>
                item.routineId === routine.id &&
                !item.deletedAt &&
                (item.week === presentWeek || item.week === nextWeek)
        );
        if (hasTaskThisWindow) continue;

        // Determine last completed: prefer routine.lastCompletedAt, else derive from items history
        let lastCompletedAt: string | null = routine.lastCompletedAt ?? null;
        if (!lastCompletedAt) {
            let mostRecent: string | null = null;
            for (const item of items) {
                if (item.routineId !== routine.id) continue;
                if (item.status !== 'complete') continue;
                if (!item.completedAt) continue;
                if (!mostRecent || item.completedAt > mostRecent) {
                    mostRecent = item.completedAt;
                }
            }
            lastCompletedAt = mostRecent;
        }

        const dismissedAt = routine.dismissedAt ?? null;

        // Dismissal hides a proposal until the next week. Same week = suppressed,
        // different (later) week = dismissal is stale and ignored. The "Refill queue"
        // CTA is the manual override.
        if (dismissedAt && getWeekKey(dismissedAt) === presentWeek) continue;

        let baseline: string | null = null;
        if (lastCompletedAt && dismissedAt) {
            baseline = dayjs(lastCompletedAt).isAfter(dayjs(dismissedAt))
                ? lastCompletedAt
                : dismissedAt;
        } else {
            baseline = lastCompletedAt ?? dismissedAt;
        }

        let cadencePctElapsed: number;
        if (!baseline) {
            // Never completed and never dismissed — only surface if the cadence anchor
            // matches the present week. Prevents e.g. an annually routine anchored
            // to November from showing up in April.
            if (!matchesCadence(presentWeek, routine)) continue;
            cadencePctElapsed = 1.0;
        } else {
            const cadenceDays = CADENCE_DAYS[routine.cadence];
            const elapsed = now.diff(dayjs(baseline), 'day', true);
            cadencePctElapsed = elapsed / cadenceDays;
        }

        // Surface routines that are either overdue (>= 100% elapsed) OR scheduled
        // to land in the present/next week per their cadence anchor.
        const scheduledThisOrNext =
            matchesCadence(presentWeek, routine) || matchesCadence(nextWeek, routine);
        if (cadencePctElapsed < 1.0 && !scheduledThisOrNext) continue;

        proposals.push({
            routine,
            lastCompletedAt,
            cadencePctElapsed,
        });
    }

    // Sort descending by cadencePctElapsed — most overdue first
    proposals.sort((a, b) => b.cadencePctElapsed - a.cadencePctElapsed);

    return proposals;
}
