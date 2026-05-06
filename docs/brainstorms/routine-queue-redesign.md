# Routine Queue Redesign — Vetting Questions

**Status:** Design / Pre-implementation  
**Date:** 2026-05-02

## The Idea

Replace pre-spawned routine instances with an "opportunity queue":
- Ranked by urgency (`daysSinceLastCompletion / cadenceDays`)
- Visibility governed by a surfacing rule — a routine appears only when its next due date is within ~14 days (see Q8). This naturally hides annuals 11.5 months/year, hides out-of-season routines, and keeps weeklies/biweeklies always present.
- Dragging a queue item to a week *creates* the task instance at that moment
- Queue reshuffles after assignment; does not grow
- Items sink (via projected completion) post-assignment, rise again as their next due date approaches

---

## Category 1 — Source of Truth for Schedule

### Background — what `anchorWeek` is today

Defined in [src/types.ts:40](src/types.ts#L40), used by `matchesCadence()` in [src/utils/routineSpawner.ts:96-135](src/utils/routineSpawner.ts#L96-L135). It's a scheduling anchor; meaning varies by cadence:

- **Weekly** — anchor barely matters; every week from anchor onward spawns.
- **Biweekly** — anchor sets the *parity* (which "every-other-week" bucket the routine occupies).
- **Monthly** — anchor sets the *week-of-month* (e.g., always 2nd week).
- **Annually** — anchor sets *month + week-of-month* (e.g., December, week 3).

### Background — DB state as of 2026-05-02

For the demo account: **316 active routine-spawned items spread across 54 weeks** (2026-W04 → 2027-W05). The display was previously gated to present+next week, but the spawn loop still runs the full 12-month horizon — we hid most of it, didn't stop creating it.

---

1. **If we stop pre-spawning, where does `anchorWeek` live and what does it mean going forward?**

    **Answer:** Keep it on the routine; demote it from "spawn trigger" to "scheduling preference / intent." Across all cadences (weekly, biweekly, monthly, annual), the anchor expresses *when the routine prefers to land* — it informs the seed for "never completed" (Q4) and acts as a tie-breaking / suggested-week hint. It is no longer a spawn trigger because nothing pre-spawns.

    **Open:** Naming is deferred — final-touch concern, not urgent.

2. **What happens to the hundreds of pre-spawned items already in the database?**

    **Answer:** On migration, delete future untouched placeholders for **all cadences** (weekly, biweekly, monthly, *and* annual). Keep any items that have been completed, edited, or otherwise touched by the user (real history). All routines move to the queue model uniformly — annuals are not special-cased into a separate UI (see Q8 for how annuals fit in).

    **Open follow-up:**
    - Migration safety: what counts as "touched"? Status != incomplete? deletedAt set? completedAt set? User-edited title? Need to define before writing the migration.

3. ~~When a user completes a task that was *not* dragged from the queue, does that count toward the urgency calculation for that routine?~~

    **Reframed:** The original framing was confused — a manually-created task has no `routineId` and is unrelated to any routine. The real question is narrower:

    **Q3 (revised):** When a user marks any routine-attached task instance complete — whether it was dragged from the queue, auto-spawned in legacy data, or assigned via some future flow — does that update `lastCompletedAt` on the parent routine and recompute queue urgency?

    **Answer:** Yes. Any completion of a task with a `routineId` updates the parent routine's `lastCompletedAt` and feeds urgency. No special-casing for how the task came into existence.

4. **If a routine has never been completed, what seed value do we use for "last completed"?**

    **Answer:** Seed `lastCompletedAt = anchorDate − cadenceDays`. This makes urgency exactly 1.0 on the anchor week. Generalizes cleanly across cadences:
    - **Weekly / biweekly / monthly:** routine appears at urgency 1.0 on its anchor week.
    - **Annual:** seed is "previous year's anchor week" → urgency rises through the year, hits 1.0 next anchor week.
    - **Seasonal (year-round = false):** the anchor is the start of the season, so urgency 1.0 on day 1 of the season window. This is exactly what we want for "Water Plants, weekly, starting first week of May, never done" — top of queue on May 1. (Out-of-season hiding is handled by the Q8 surfacing rule, not by the seed.)

---

## Category 2 — Urgency Formula

Two formulas considered:

**Option A — Pure elapsed-time ratio** ← chosen
```
urgency = daysSinceLastCompletion / cadenceDays
```
- Simple, no calendar math
- Weekly routine at 3.5 days = 0.5; at 7 days = 1.0; at 9 days = 1.29
- Forward-looking: items rise into the queue's top range *before* they're due
- Anchor alignment ignored in the score itself (handled separately via tie-breakers / scheduling-intent metadata)

**Option B — Anchor-aware "only-once-overdue"** ← rejected
```
urgency = max(0, daysSinceLastCompletion - cadenceDays) / cadenceDays
```
- Items only appear with non-zero urgency *after* they're due
- Rejected: we want the queue to surface upcoming-due items so the user can plan a few days ahead, not a backlog of overdue items.

---

5. **Which formula feels right? Show items before due, or only once overdue?**

    **Answer:** Option A. The queue is forward-looking — surface items that are *coming due in the next few days* so the user can pull them into their plan ahead of time. Past-due items still appear (urgency > 1.0) but are not the dominant signal. The user's framing: "I should be seeing items that are soon to be due, not past due."

    **Note:** Option A assigns *every* routine a non-zero urgency score at all times. Visibility (which routines actually appear in the queue) is governed by the surfacing rule in Q8 — a routine appears only when its next due date is within ~14 days. Annual routines, for example, have urgency ~0.04 in January (12 days since done) but stay hidden because their next due date is 11 months away.

6. **How do we break ties?**

    **Examples of real ties:**
    - Two weekly routines completed the same day (e.g., Sunday's "Plan Week" and "Review Finances") — both reach urgency 0.43 on Wednesday.
    - Two new routines with the same anchor week, never completed → both seeded at 1.0.
    - One weekly at 7 days (1.0) and one biweekly at 14 days (1.0) — different cadences, same ratio.
    - Many routines simultaneously past due (a "slip" period) — all weeklies last done 21 days ago tie at urgency 3.0.
    - Approximate ties from rounding (0.4286 vs 0.4283).

    **Answer (revised after Q26 analysis):** Tiered tie-breaking.

    1. **Primary tiebreak: anchor-proximity.** Among tied urgencies, the routine whose next anchor occurrence is closest to today ranks first. Provides meaningful hierarchy when many routines bunch up — uses scheduling intent the routine already carries.
    2. **Secondary fallback: alphabetical by title.** Stable, predictable when anchors also tie (or when a routine has no informative anchor signal).

    *Original answer was alphabetical-only; Q26 surfaced that this leaves the top of the queue feeling flat when several routines tie at high urgency. Anchor-proximity addresses that without new state.*

7. **How is urgency displayed?**

    **Answer:** Hide the raw urgency value. Surface only `days since last done` ("Last done 9 days ago"). Concrete, interpretable, lets the user apply their own judgment. No urgency number, no color band, no Overdue/Due/Upcoming label.

---

## Category 3 — Annual & Seasonal Routines

> **Revised approach:** Annuals and seasonal routines all live in the **same queue** as everything else. No separate UI track, no special pre-spawning. The "surfacing rule" defined in Q8 below controls visibility uniformly across all cadences and gracefully hides out-of-window routines.

8. **Surfacing rule — when does a routine appear in the queue?**

    **Answer:** A routine appears in the queue when **`daysUntilDue ≤ N`**, where N is the global look-ahead window (lean **14 days**, possibly 21 — TBD via dogfooding).

    **`daysUntilDue` calculation:**
    - **Year-round:** `(lastCompletedAt + cadenceDays) − today`
    - **Seasonal** (`isYearRound = false`): `max(lastCompletedAt + cadenceDays, startOfCurrentOrUpcomingSeasonWindow) − today`
    - **Annual:** `(lastCompletedAt + 365 days) − today`, anchored to the next occurrence of the configured anchor week

    **Consequences (all desirable, no special-casing needed):**
    - Weekly routines (cadence 7d) → effectively always visible (next due is always ≤ 7 days away).
    - Biweekly (14d) → always visible.
    - Monthly (~30d) → visible most of the cycle (final 2 weeks).
    - **Annual** (365d) → hidden 11.5 months/year, surfaces ~2 weeks before its anchor week, naturally rises to top.
    - **Seasonal out-of-season** → hidden, because next due date is pushed forward to the start of the next season window.
    - **Seasonal first day of season** → at urgency 1.0 (from Q4 seed), top of queue.

    **Visual differentiation for long-cadence routines:** queue cards for annual routines should carry a small badge (e.g., `📅 Yearly` or an icon) so the user understands "this is the once-a-year one" at a glance. Same potentially for monthly / seasonal if helpful — to be designed.

    **Open:** Lean N=14, but dogfood briefly with 21 to compare. Final value can also be made user-configurable if it ever feels wrong.

9. ~~Seasonal routines: hidden, grayed, or urgency 0?~~

    **Resolved by Q8.** Out-of-season routines are hidden because their `daysUntilDue` is pushed to the start of the next season window — well outside the surfacing horizon. No explicit "in season" check needed.

10. ~~Seasonal "never done" first-time seed?~~

    **Resolved by Q4.** The seed `lastCompletedAt = anchorDate − cadenceDays` puts the routine at urgency 1.0 on day 1 of its season. The same rule covers all cadences uniformly.

11. ~~Annual look-ahead window?~~

    **Resolved by Q8.** Same global surfacing rule (N days) applies. No special "annual look-ahead" parameter.

12. ~~Annual completion semantics?~~

    **Resolved by Q18.** Completion of an annual works exactly like any other routine — the projected-completion logic and `lastCompletedAt` write rules apply uniformly.

---

## Category 4 — Drag Mechanics

13. **Which week does a drag assign to?**

    **Answer:** The week you drop onto. Past weeks are rarely visible in the UI — no special handling needed.

14. **Visual state after drag:**

    **Answer:** The queue row sinks to its new position based on the projected-completion rank (from Q18). If the new projection puts the routine outside the surfacing window (Q8: `daysUntilDue ≤ N`), it disappears from the queue entirely. No special "scheduled" badge or grayed-out state — the natural re-rank handles it.

15. **Reverse drag:**

    **Answer:** Dragging the task instance back into the queue re-places the routine at its relevant urgency-based position (with the projection cleared, so it ranks by real `lastCompletedAt`). No "previous slot to resurface to" needs tracking — the queue is a derived view, so the routine simply re-evaluates its position. **No duplicate rows in the queue** — one row per routine, always.

16. **Completing outside the queue:**

    **Answer:** Yes — already scoped by Q3 (reframed). Any completion of a task carrying a `routineId` updates the parent routine's `lastCompletedAt` and the queue re-ranks accordingly.

17. **Multiple assigns:**

    **Answer:** Not simultaneously, but **sequentially yes**.

    **Worked example:** "Run" is weekly. User sees it at top of queue, drags into this week — it sinks a few spots (projected completion = end of this week). User then grabs the same routine row again and drags it to next week. A second task instance is created.

    **Implication for projection:** when multiple uncompleted task instances exist for the same routine across different weeks, the queue's projected-completion ranking uses the **latest** assigned week (the one furthest in the future). This keeps the routine sunk for the longest time the user has committed to.

    **Open follow-up:** does the queue allow a third, fourth, etc. drag? Practically users probably won't, but no hard cap is needed — it just keeps creating instances and the projection follows the latest.

18. **Projected completion on assign — does dragging into a week count as a virtual completion for ranking purposes?**

    **Answer:** Yes, but the projection is *dynamic* — it tracks whichever week the item is currently assigned to.

    - Drag routine from queue → Week A: queue ranks as if `lastCompletedAt = end of Week A`. Routine sinks; doesn't appear at top of queue.
    - User then moves the item to Week B (e.g., a future week): projection updates → queue now ranks as if `lastCompletedAt = end of Week B`.
    - User actually completes the task: real `lastCompletedAt` on the routine is finally written (and the projection becomes the truth).
    - User deletes / unassigns the task without completing it: projection clears; routine returns to its real urgency (based on the *previous* real `lastCompletedAt`).

    **Why this matters:** the routine's stored `lastCompletedAt` is sacred — it only updates on real completion. The "projected" completion is purely a queue-ranking concern, derived from the currently-assigned task instance's `weekId` plus completion state.

    **Reference date for "end of Week":** **Saturday EOD.** Sunday is the first day of the week in this product, so Saturday is the last day. The projected-completion timestamp = Saturday end-of-day for whichever week the task is currently assigned to.

---

## Category 5 — Multi-Occurrence Routines

Some routines have `targetCount > 1` (e.g., "Run" with targetCount: 2, cadence: weekly — run twice a week).

19. **One queue row or multiple?**

    **Answer:** Single row. Same as the current product. The user's intent is to do the routine N times — splitting it into multiple queue rows would just clutter the queue. One row tracks `completedCount/targetCount` as it does today.

20. **Does urgency stay high until all occurrences are done this week?**

    **Answer:** Yes. The routine is not "complete" until `completedCount === targetCount`. Until then, `lastCompletedAt` does not update, so the routine remains "due" from a cadence perspective. Partial completion doesn't reset cadence.

    **Carry-over rule (resolves the lingering-incomplete edge case for *all* routines, not just multi-occurrence):**

    When a task assigned to week X reaches the end of week X (Saturday EOD) without being completed, the task **auto-carries into the next week**, preserving `completedCount` (e.g., "1 of 2" continues to read "1 of 2" in the new week). It is not archived, not abandoned in the past week, and not duplicated.

    **Consequences:**
    - The Q18 projection rides along — projection = end of whichever week the task currently lives in. The routine stays sunk in the queue while the task is carrying forward.
    - The user's week task list (not the queue) is what surfaces the missed task. The queue does not nag, because the task is technically still assigned.
    - `lastCompletedAt` stays untouched until full completion — carry-over doesn't change that.
    - Partial progress (e.g., 1 of 2 done) lives purely on the task instance as UI state. It does **not** propagate to queue urgency — cadence is strictly all-or-nothing.

    **Resolved follow-ups:**
    - **Carry forever** — no auto-archive. If a user wants to stop a carried-over task from following them, they explicitly delete it. No magic-disappear behavior.
    - **Applies to all tasks** — uniform rule across routine-attached and manually-created tasks. Simpler mental model: "if it's not done by Saturday, it carries to next week, regardless of origin." The user is responsible for cleaning up tasks that no longer make sense (e.g., date-bound manuals like "Submit form by Friday" need to be edited or deleted by the user when missed).

21. ~~Multiple-row UI differentiation?~~

    **N/A** — single-row chosen in Q19.

22. ~~Urgency formula for partial completion?~~

    **Resolved by Q20.** `lastCompletedAt` only updates on full completion, so partial progress doesn't affect urgency. Urgency continues to grow until target is met.

---

## Category 6 — Edge Cases & System Behavior

23. ~~New routine added — what initial urgency?~~

    **Resolved by Q4.** Seed `lastCompletedAt = anchorDate − cadenceDays`. Initial urgency depends on how the anchor relates to today: anchor in the past → already at/past 1.0; anchor today → exactly 1.0; anchor in the future → starts low and climbs.

24. ~~Routine paused/disabled state?~~

    **N/A.** No paused/disabled feature exists in the product today. If/when added, it gets a fresh decision — out of scope for this brainstorm.

25. **Week boundary / mid-session reordering risk?**

    **Answer:** Compute ranking on (a) initial app load, (b) any explicit user action (drag, complete, assign, edit). **No timer-based recompute.** During an active drag, ranking is **frozen** — resume only after drop.

    Trade-off accepted: ranking can become slightly stale on long-lived sessions (e.g., tab open all day, midnight rollover). Acceptable because urgency drift over a session is gradual and the cost of mid-session reorders (especially mid-drag) is much higher than the cost of staleness.

26. **Offline / stale state — preventing "everything at max urgency"**

    **The framing shift:** When urgency is hidden (Q7) and only used for ranking, **the formula choice doesn't change queue ORDER, only underlying magnitudes**. Linear and logarithmic give the same ranking. So switching curves is essentially cosmetic — the user can't see the difference.

    **What actually creates the "flat top" sensation:** when several routines tie at high urgency (e.g., 5 weeklies all 21 days overdue → all at urgency 3.0), the tie-breaker determines the ordering. With alphabetical-only (the original Q6 answer), the top of the queue looks arbitrary.

    **Answer:**

    1. **Keep linear urgency** — `daysSinceLastCompletion / cadenceDays` with no curve modification. Simple, no special cases.
    2. **Anchor-proximity tiebreak** (see revised Q6) — among tied urgencies, the routine whose next anchor occurrence is closest ranks first. Provides "clear hierarchy" at the top when many items bunch.
    3. **Visible-item cap is a parked UI consideration** — independent of urgency entirely. If overwhelm becomes a real problem, render a top-K visible window in the queue and collapse the rest under a "more" affordance. Solve at the rendering layer when (and only when) needed; don't bake into the ranking model.

    **Why this addresses the user's concern:**
    - Avoids "all max urgency" by making sure tied routines are ordered meaningfully (not by name).
    - Doesn't trigger only on absence — works for any slip period (the user noted: "Some weeks I'm just slipping behind").
    - Doesn't introduce new persistent state (no `lastInteractedAt` tracking).
    - Doesn't introduce a curve that's invisible to the user anyway.

    **Open follow-ups:**
    - Concrete definition of "next anchor occurrence" per cadence (weekly = next anchored weekday? monthly = next anchored week-of-month? annual = anchor week of next year?). Needs spec'ing during implementation.
    - When (if ever) does the visible-item cap become necessary? Dogfood and revisit.

---

## Concrete Scenarios to Validate Against

### Scenario A — Fresh Monday Morning
You open the app. Last week you did: Clean Den (Mon), Run (Wed + Fri), Grocery List (Sat).
You *didn't* do: Laundry, Review Finances, Plan Week.

Expected queue order (most urgent first):
- Plan Week (weekly, 0 days since anchor, never done this week)
- Review Finances (biweekly, 10 days since last)
- Laundry (weekly, 8 days since last)
- Clean Den (weekly, 7 days, done last Mon — just tipped over)
- Run (weekly, 4 days, done Fri — not yet due)
- Grocery List (weekly, 2 days, done Sat)

**Question:** Does this ordering feel correct? What would you change?

---

### Scenario B — Dragging "Clean Den" Into This Week
You drag "Clean Den" from the queue into Week 2026-W18.

1. A task instance is created: `{ type: 'simple', title: 'Clean Den', weekId: '2026-W18', routineId: 'xxx' }`
2. The queue row for Clean Den sinks to the bottom (just assigned)
3. Next Monday, urgency resets: daysSinceLast = 0

**Questions:**
- When exactly does daysSinceLast reset — on drag (assignment) or on completion of the task?
- What if you assign it but never complete it?

---

### Scenario C — Completing Via a Manually Created Task
User creates a one-off task "Clean Den" manually (not from queue). Marks it done.

**Question:** Should this count as a completion for the "Clean Den" routine's urgency calculation?
- If yes: how do we link the manual task to the routine? By title match? Explicit routine picker?
- If no: the queue doesn't know it was done; urgency stays high even though the user just did it.

---

## Decision Log

| # | Question | Decision | Date |
|---|----------|----------|------|
| 1 | Where does `anchorWeek` live? | Stays on routine. Across all cadences (weekly/biweekly/monthly/annual), demoted to scheduling-intent — informs "never completed" seed and tie-breaking. No longer a spawn trigger. | 2026-05-02 |
| 2 | Pre-spawned items in DB | Delete future untouched placeholders for **all cadences** (annuals included). Touched/completed history preserved. All routines move to queue model uniformly. | 2026-05-02 |
| 3 | ~~Manual completion counts?~~ | Reframed: any task with a `routineId` that gets completed updates the parent routine's `lastCompletedAt` regardless of how it was created. | 2026-05-02 |
| 4 | Seed for "never completed" | `lastCompletedAt = anchorDate − cadenceDays` → urgency 1.0 on the anchor week. Generalizes across weekly/biweekly/monthly/annual/seasonal. | 2026-05-02 |
| 5 | Urgency formula | Option A: `daysSinceLastCompletion / cadenceDays`. Forward-looking. Visibility gated by Q8 surfacing rule. | 2026-05-02 |
| 6 | Tie-breaker | **Revised in Q26 analysis.** Tiered: (1) anchor-proximity primary, (2) alphabetical by title fallback. | 2026-05-04 |
| 7 | Urgency display | Hidden. Show "days since last done" instead. | 2026-05-02 |
| 8 | Surfacing rule | Routine appears in queue when `daysUntilDue ≤ N` (lean N=14, possibly 21). For seasonal, `daysUntilDue` uses `max(naïveNextDue, startOfNextSeasonWindow)` so out-of-season routines hide naturally. Annual cards get a visual badge. | 2026-05-02 |
| 9–12 | Seasonal/annual special cases | Resolved by Q4 + Q8 + Q18. No separate annual UI; no explicit in-season check; no special completion semantics. | 2026-05-02 |
| 13 | Drop target week | The week you drop onto. Past weeks rare in UI; no special handling. | 2026-05-02 |
| 14 | Visual state after drag | Sinks to new urgency-based position (or disappears if outside surfacing window). No "scheduled" badge — natural re-rank handles it. | 2026-05-02 |
| 15 | Reverse drag | Re-evaluates urgency and re-places. Queue is a derived view — no slot bookkeeping. One row per routine, no duplicates. | 2026-05-02 |
| 16 | Completing outside queue | Already scoped by Q3 — any routine-attached completion updates `lastCompletedAt` and re-ranks. | 2026-05-02 |
| 17 | Multiple assigns | Sequentially yes (drag → sinks → drag again to a different week → second instance). Projection uses the *latest* assigned week when multiple instances exist. | 2026-05-02 |
| 18 | Projected completion on assign | Yes, dynamic — projection follows wherever the task is currently assigned. Real `lastCompletedAt` only updates on actual completion. End-of-week reference = **Saturday EOD**. | 2026-05-02 |
| 19 | Multi-occurrence: row count | Single row, same as current product. Tracks `completedCount/targetCount`. | 2026-05-03 |
| 20 | Carry-over for incomplete tasks | Incomplete tasks **auto-carry into the next week** (preserving `completedCount`). **Carries forever** until user deletes; **applies to all tasks** (routines + manuals). Q18 projection rides along — routine stays sunk in queue while task lives in week task list. `lastCompletedAt` only updates on full completion. Partial progress stays on task UI; doesn't propagate to queue urgency. | 2026-05-03 |
| 21–22 | Multi-occurrence sub-questions | Resolved by Q19/Q20. | 2026-05-03 |
| 23 | New routine initial urgency | Resolved by Q4 (anchor-minus-cadence seed). | 2026-05-04 |
| 24 | Paused/disabled routine | N/A — feature doesn't exist. | 2026-05-04 |
| 25 | Mid-session reordering | Compute on load + user actions (no timers). Freeze ranking during drag. Accept slight staleness on long sessions. | 2026-05-04 |
| 26 | Preventing "all max urgency" | Keep linear urgency (formula is cosmetic since urgency is hidden). Address via Q6 anchor-proximity tiebreak — gives meaningful order when many items tie. Visible-item cap parked as separate UI concern. | 2026-05-04 |
