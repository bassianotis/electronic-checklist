import dayjs from 'dayjs';
import type { Item, Routine, RoutineProposal, WeekKey } from '../types';
import { getWeekKey, getFirstDayOfWeek, addWeeks } from './timeUtils';
import { isWeekInSeason, matchesCadence } from './routineSpawner';

export const PROPOSALS_CONTAINER_KEY = 'routine-proposals';

const CADENCE_DAYS: Record<Routine['cadence'], number> = {
    weekly: 7,
    biweekly: 14,
    monthly: 30,
    annually: 365,
};

// Brainstorm Q8 — routine appears in the queue when its next due date is within
// this many days. Lean 14, possibly 21 — TBD by dogfooding. Tighten if the queue
// feels noisy after Phase 1 lands.
const SURFACING_WINDOW_DAYS = 14;

const WEEK_KEY_REGEX = /^\d{4}-W\d{2}$/;

// Saturday EOD of the given week. The week is Sunday-start (day 0), so Saturday
// is day 6. Used as the projected-completion timestamp when a routine task is
// assigned to a week (brainstorm Q18).
function endOfWeek(weekKey: WeekKey): Date {
    return dayjs(getFirstDayOfWeek(weekKey)).add(6, 'day').endOf('day').toDate();
}

// Latest week containing an uncompleted, non-deleted routine task instance, if
// any. When this exists, the queue treats the routine as virtually completed at
// end-of-week — sinks the row, prevents duplicate drags, and naturally rides
// along when Phase 2 carry-over moves the task forward.
function latestAssignedUncompletedWeek(
    routine: Routine,
    items: Item[]
): WeekKey | null {
    let latest: WeekKey | null = null;
    for (const item of items) {
        if (item.routineId !== routine.id) continue;
        if (item.deletedAt) continue;
        if (item.status === 'complete') continue;
        if (!WEEK_KEY_REGEX.test(item.week)) continue; // skip ideas / drag-staging
        if (!latest || item.week > latest) latest = item.week;
    }
    return latest;
}

// Next due date for the routine.
//   Year-round: lastCompletedAt + cadenceDays.
//   Seasonal: pushed forward to the first in-season week if the naive next is
//             out of season.
//   Annual: next occurrence of the anchor week-of-year (this year if still
//           future, else next year).
function nextDueDate(routine: Routine, effectiveLast: Date, today: Date): Date {
    if (routine.cadence === 'annually') {
        const anchorDate = dayjs(getFirstDayOfWeek(routine.anchorWeek));
        const todayD = dayjs(today);
        let candidate = anchorDate.year(todayD.year());
        if (!candidate.isAfter(todayD)) candidate = candidate.add(1, 'year');
        return candidate.toDate();
    }

    const cadenceDays = CADENCE_DAYS[routine.cadence];
    const naiveNext = dayjs(effectiveLast).add(cadenceDays, 'day');

    if (routine.isYearRound) return naiveNext.toDate();

    let scan = naiveNext.isBefore(today) ? dayjs(today) : naiveNext;
    for (let i = 0; i < 60; i++) {
        if (isWeekInSeason(getWeekKey(scan.toDate()), routine)) return scan.toDate();
        scan = scan.add(1, 'week');
    }
    return dayjs(today).add(1, 'year').toDate();
}

// Next anchor occurrence — primary tiebreak when urgencies tie.
//
// Limitation: anchorWeek is week-granular, so weekly routines have no
// day-of-week hint and all weeklies tie at "this/next week start." For weekly
// ties this falls through to the alphabetical fallback. Biweekly/monthly/annual
// tiebreaks are meaningful.
function nextAnchorOccurrence(routine: Routine, today: Date): Date {
    if (routine.cadence === 'annually') {
        const anchorDate = dayjs(getFirstDayOfWeek(routine.anchorWeek));
        const todayD = dayjs(today);
        let candidate = anchorDate.year(todayD.year());
        if (!candidate.isAfter(todayD)) candidate = candidate.add(1, 'year');
        return candidate.toDate();
    }

    let scanWeek = getWeekKey(today);
    for (let i = 0; i < 8; i++) {
        if (matchesCadence(scanWeek, routine)) return getFirstDayOfWeek(scanWeek);
        scanWeek = addWeeks(scanWeek, 1);
    }
    return dayjs(today).add(8, 'week').toDate();
}

/**
 * Compute ranked routine proposals for the queue.
 *
 * Pure function — safe to memoize on (routines, items, currentTime).
 *
 * Ranking model (see docs/brainstorms/routine-queue-redesign.md):
 *   Q4  — Never-completed routines seed to anchorDate − cadenceDays so urgency
 *         is exactly 1.0 on the anchor week.
 *   Q5  — Linear urgency: daysSinceLast / cadenceDays.
 *   Q6  — Tied urgencies broken by anchor-proximity, then alphabetical.
 *   Q8  — Routine surfaces only when daysUntilDue ≤ SURFACING_WINDOW_DAYS.
 *         This naturally hides annuals 11.5 months/year and out-of-season
 *         seasonal routines, with no special-case "in season" check.
 *   Q18 — Routines with an uncompleted assigned task instance are treated as
 *         virtually completed at end-of-latest-assigned-week, sinking them.
 */
export function computeProposals(
    routines: Routine[],
    items: Item[],
    currentTime: string
): RoutineProposal[] {
    const today = new Date(currentTime);
    const proposals: RoutineProposal[] = [];

    for (const routine of routines) {
        if (routine.deletedAt) continue;

        // Display lastCompletedAt: stored value first, else derive from
        // completed task history (legacy data path).
        let displayLast: string | null = routine.lastCompletedAt ?? null;
        if (!displayLast) {
            for (const item of items) {
                if (item.routineId !== routine.id) continue;
                if (item.status !== 'complete') continue;
                if (!item.completedAt) continue;
                if (!displayLast || item.completedAt > displayLast) {
                    displayLast = item.completedAt;
                }
            }
        }

        // Effective lastCompletedAt for ranking. Projection > stored > derived
        // > seed. The projection is purely a queue concern — the routine's
        // real lastCompletedAt is untouched until actual completion.
        const projectedWeek = latestAssignedUncompletedWeek(routine, items);
        let effectiveLast: Date;
        if (projectedWeek) {
            effectiveLast = endOfWeek(projectedWeek);
        } else if (displayLast) {
            effectiveLast = new Date(displayLast);
        } else {
            const anchorDate = getFirstDayOfWeek(routine.anchorWeek);
            const cadenceDays = CADENCE_DAYS[routine.cadence];
            effectiveLast = dayjs(anchorDate).subtract(cadenceDays, 'day').toDate();
        }

        const dueAt = nextDueDate(routine, effectiveLast, today);
        const daysUntilDue = dayjs(dueAt).diff(dayjs(today), 'day', true);
        if (daysUntilDue > SURFACING_WINDOW_DAYS) continue;

        const cadenceDays = CADENCE_DAYS[routine.cadence];
        const daysSinceLast = dayjs(today).diff(dayjs(effectiveLast), 'day', true);
        const cadencePctElapsed = daysSinceLast / cadenceDays;

        proposals.push({
            routine,
            lastCompletedAt: displayLast,
            cadencePctElapsed,
        });
    }

    // Sort: urgency desc → anchor-proximity asc → alphabetical asc
    proposals.sort((a, b) => {
        if (a.cadencePctElapsed !== b.cadencePctElapsed) {
            return b.cadencePctElapsed - a.cadencePctElapsed;
        }
        const aAnchor = nextAnchorOccurrence(a.routine, today).getTime();
        const bAnchor = nextAnchorOccurrence(b.routine, today).getTime();
        if (aAnchor !== bAnchor) return aAnchor - bAnchor;
        return a.routine.title.localeCompare(b.routine.title);
    });

    return proposals;
}
