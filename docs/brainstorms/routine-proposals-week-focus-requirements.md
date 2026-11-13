---
date: 2026-04-18
topic: routine-proposals-week-focus
---

# Routine Proposals & Focused Week View

## Problem Frame

The current routine system auto-spawns tasks into future weeks and carries incomplete tasks forward automatically. This creates anxiety: skipping a task makes the next week's queue longer, and users have no way to adapt to real-life circumstances (illness, shifting priorities) without feeling like they're falling behind. Routines become a source of stress rather than guidance.

The fix is to shift routines from automatic assignment to a **proposal model** — the system suggests tasks based on cadence and completion history; the user decides what actually goes in the week. This also requires a UX rethink: the current infinite scroll of pre-filled future weeks creates false commitment for tasks that haven't been accepted. Routines should be guideposts, not mandates.

This change affects more than the routine model — it also reshapes the main week view and introduces a new proposals side panel.

## User Flow

```
┌─────────────────────────────────────────────────┐
│  User opens app                                 │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  Week view (current week + next week)           │
│  + Proposals panel (always visible, ranked)     │
└────────────────┬────────────────────────────────┘
                 │
        ┌────────┴────────┐
        ▼                 ▼
┌──────────────┐   ┌─────────────────────────────┐
│ Drag task to │   │ Dismiss proposal            │
│ a week       │   │ (skip this cycle)           │
└──────┬───────┘   └──────────────┬──────────────┘
       │                          │
       ▼                          ▼
┌──────────────┐   ┌─────────────────────────────┐
│ Task appears │   │ Cadence resets from today;  │
│ in week view │   │ proposal disappears         │
└──────┬───────┘   └─────────────────────────────┘
       │
       ├── Completed → last-done date updates; removed from proposals
       │
       └── Not completed at week end → returns to proposals panel
                                       (urgency re-calculated from original
                                        last-completion date, not week-start)
```

## Requirements

**Week View Scope**

- R1. The main view shows the current week and next week. Past weeks remain scrollable for historical reference.
- R2. Future weeks beyond current + next show only calendar-dated events. Auto-spawned routine task placeholders are not shown in future weeks.

**Proposals Panel**

- R3. A side panel is persistently visible alongside the week view. It displays all routine proposals ranked by urgency — no week-specific sections.
- R4. Each proposal card shows: routine title, cadence (e.g., "monthly"), last completed date or "never completed," and an urgency indicator when overdue relative to cadence.
- R5. Proposals are ranked by the percentage of the cadence interval elapsed since last completion — not raw days overdue. A monthly routine last completed 6 weeks ago (150% elapsed) ranks higher than an annual routine last completed 14 months ago (117% elapsed), even though the annual task is further behind in absolute days.
- R6. The user drags a proposal into any visible week to accept it. Accepted tasks appear in the week view like any other task.

**Proposal Dismissal**

- R7. The user can dismiss (skip) a proposal. Dismissal resets the routine's next suggestion date from today — as if the task were completed today — without creating a task or leaving any carry-over.
- R8. Dismissed proposals do not re-appear in the panel until their cadence window opens again from the dismissal date.
- R9. If the user dismisses a proposal that was previously accepted but not completed (returned from a past week), the dismissal still resets the cadence from today. The incomplete-acceptance history is discarded. There is no penalty state distinct from a fresh dismissal.

**Accepted Tasks**

- R10. Accepted routine tasks behave like regular tasks: completable, editable, and reorderable within the week.
- R11. An accepted routine task that is not completed by the end of its week does not auto-carry over. It returns to the proposals panel. Its urgency is re-calculated from the original last-completion date (not the start of the week in which it was accepted), so it naturally ranks high without requiring a special "returned" state or label.
- R12. Manually created tasks (not from routines) continue to carry over automatically as they do today.

**Completion & Cadence**

- R13. When a routine task is completed in any week, that completion date becomes the new baseline for the cadence calculation.
- R14. Routine cadence (weekly, biweekly, monthly, annually) continues to determine *when a routine is suggested*, not when it is assigned. The system computes: last completion date + cadence interval → next suggestion window.
- R15. Seasonal routines (with active month windows) only appear in the proposals panel during their active window. This behavior is unchanged.
- R16. If no completion history exists for a routine (e.g., newly created, or history is unavailable), the routine is treated as "never completed" and shown in the panel immediately, ranked as if 100% of its cadence interval has elapsed.

**Calendar Events**

- R17. Calendar-dated events are unaffected. They continue to appear in the week they belong to, across all visible weeks.

## Success Criteria

- Users report feeling less anxiety about incomplete routine tasks week-over-week.
- The proposals panel surfaces genuinely relevant suggestions — the ranking feels accurate to the user's real priorities, not just a mechanical overdue list.
- Users can handle a difficult week (illness, high workload) by dismissing proposals freely, without the following week's panel feeling punishingly long.
- The week view feels intentional rather than pre-filled and overwhelming.
- Routine tasks do not carry over without explicit user action.

## Scope Boundaries

- Does not change task types (simple, multi-occurrence, time-tracked).
- Does not change how manual (non-routine) tasks behave, except that they continue to carry over as before (R12).
- Mobile layout of the proposals panel is deferred — the desktop experience is the primary target for this work. Mobile users retain current behavior until a mobile layout is designed separately.
- The proposal ranking algorithm is intentionally simple in v1: cadence-percentage elapsed since last completion only. No weighted scoring, ML, or external signals.
- Does not change the Routine creation or editing experience (RoutineManager UI stays the same).
- Does not address the case where a user repeatedly dismisses the same routine over many cycles. Surfacing a "consider deactivating this routine" nudge is out of scope for v1.
- Forward-planning routine tasks beyond the next week is not supported. Users who want to pre-schedule a routine task more than one week ahead must use a manual (non-routine) task for that purpose. This is an accepted trade-off.

## Key Decisions

- **Dismissal resets the clock, not marks overdue.** Treating a dismissed proposal as "done today" prevents guilt accumulation and stops the panel from becoming another carry-over queue. This applies equally to fresh dismissals and dismissals of previously-accepted-but-not-completed tasks (R9).
- **Accepted-but-incomplete returns to proposals, no special state.** The task returns with urgency re-calculated from original last-completion date. No "returned" badge or shame label — the natural urgency ranking surfaces it without adding a distinct guilt state (R11).
- **Ranking by cadence-percentage, not raw days.** Ensures annual routines do not crowd out monthly ones when both are technically overdue. A routine at 150% of its interval is more urgent than one at 117%, regardless of task type (R5).
- **No week distinction in the proposals panel.** All due/overdue routines are ranked together. The user drags to whichever visible week makes sense.
- **Focused week view (current + next only) for routine tasks.** Prevents false commitment in future weeks. Calendar events, being time-bound, are the exception.
- **Bigger than just routines.** This change also reshapes the main week view layout and introduces a new side panel UI component.

## Dependencies / Assumptions

- Last completion date tracking is assumed to be derivable from existing task completion events on routine-linked tasks. **Unverified** — planning must confirm whether this data exists in the current model or needs to be captured. R16 defines the fallback if history is absent.
- The existing side panel pattern (used for Collections) is assumed to be a reasonable host for the proposals panel. Planning should verify layout constraints and interaction model compatibility.

## Outstanding Questions

### Deferred to Planning

- [Affects R5, R13][Technical] Does the current data model track a "last completed date" per routine, or must it be computed from task completion history across all spawned tasks?
- [Affects R11][Technical] How does the system detect that an accepted routine task's week has ended without completion? Is this event-driven, lazy (detected on next app open), or requires a background job? The answer affects platform complexity.
- [Affects R2][Technical] Can the current week view suppress auto-spawned routine tasks in future weeks without removing underlying spawn records, or does the spawn model need to change entirely?
