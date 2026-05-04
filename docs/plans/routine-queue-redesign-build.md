# Routine Queue Redesign — Build Plan

**Status:** Ready to build
**Brainstorm reference:** [docs/brainstorms/routine-queue-redesign.md](../brainstorms/routine-queue-redesign.md)
**Date:** 2026-05-04

This plan translates the closed brainstorm decisions into concrete implementation work.

---

## Current State of the Codebase

Significant scaffolding already exists from prior work on the proposal model. **Don't redo these:**

- [src/types.ts](../../src/types.ts): `Routine` (with `lastCompletedAt`, `anchorWeek`, `cadence`, `dismissedAt`), `Item` (with `routineId`, `originalWeek`, `targetCount`/`completedCount`), `RoutineProposal`
- [src/components/QueuePanel.tsx](../../src/components/QueuePanel.tsx): Two-section panel (Routines + Other)
- [src/utils/proposalUtils.ts](../../src/utils/proposalUtils.ts): `computeProposals()` — close to what we need but uses the old surfacing logic
- [src/store/store.ts](../../src/store/store.ts):
  - `acceptProposal()` — drag-to-create flow with stageForDrag
  - `dismissProposal()` / `clearDismissals()` — to be removed
  - `runRoutineProposalsMigrationV1`/`V2` — already wiped legacy pre-spawned routine items
  - `lastCompletedAt` updates on completion (3 sites)
  - Rollover logic that today moves manuals to ideas + deletes incomplete routine items
- [src/utils/routineSpawner.ts](../../src/utils/routineSpawner.ts): `isWeekInSeason()`, `matchesCadence()` — keep as helpers; the spawning entrypoints become dead code

---

## Phase 1 — New ranking model (urgency, surfacing, tiebreak)

**Goal:** Replace the current `computeProposals` ranking logic with the brainstorm's model.

**Decisions in play:** Q4 (seed), Q5 (linear urgency), Q6 (anchor-proximity tiebreak), Q8 (surfacing rule), Q18 (projected completion).

### Changes

In [src/utils/proposalUtils.ts](../../src/utils/proposalUtils.ts):

1. **Seed for never-completed** — replace the current "1.0 only if matchesCadence" branch with `effectiveLastCompletedAt = anchorDate − cadenceDays`. Generalizes across cadences and gives urgency 1.0 on the anchor week.

2. **Surfacing rule** — replace the "overdue OR scheduled this/next week" filter with `daysUntilDue ≤ N` (N=14, configurable constant). `daysUntilDue` calculation:
   - **Year-round:** `(effectiveLastCompletedAt + cadenceDays) − today`
   - **Seasonal** (`!isYearRound`): `max(naïveNextDue, startOfCurrentOrUpcomingSeasonWindow) − today`
   - **Annual:** `(effectiveLastCompletedAt + 365) − today`, anchored to next year-occurrence of the configured anchor week

3. **Linear urgency** — keep `daysSinceLast / cadenceDays` for ranking. (No log curve — the formula is hidden so it's cosmetic; see Q26.)

4. **Anchor-proximity tiebreak** — when two routines tie on urgency, the one whose next anchor occurrence is sooner ranks first. Alphabetical is the final fallback. Add a `nextAnchorOccurrence(routine, today): Date` helper that computes:
   - Weekly → next occurrence of the anchor weekday
   - Biweekly → next anchor week given parity
   - Monthly → next anchored week-of-month
   - Annual → anchor week of next year

5. **Projected completion (Q18)** — when a routine has any uncompleted task instance assigned to a week, treat its effective `lastCompletedAt` as `endOfLatestAssignedWeek` (Saturday EOD of the *latest* assigned week if multiple). This is what sinks the routine in the queue. Real `lastCompletedAt` on the routine is untouched until actual completion.

### Files
- `src/utils/proposalUtils.ts` (rewrite core, keep public shape)
- New helper: `src/utils/routineScheduling.ts` (or extend `routineSpawner.ts`) for `nextAnchorOccurrence`, `daysUntilDue`, `effectiveLastCompletedAt`

### Acceptance criteria
- Annual routine, anchor 6 months out → hidden from queue
- Annual routine, anchor 10 days out → appears at top
- Out-of-season weekly routine → hidden
- 5 weeklies all 21 days overdue with different anchor weekdays → ordered by anchor proximity (not alphabetical)
- New seasonal "Water Plants" anchored at first week of May → appears at urgency 1.0 on May 1 of its first season

---

## Phase 2 — Universal carry-over rule

**Goal:** Incomplete tasks (routines AND manuals) auto-carry into the next current week on rollover, preserving partial state.

**Decisions in play:** Q20 (carry-over rule, applies to all tasks, indefinite).

### Changes

In [src/store/store.ts](../../src/store/store.ts) rollover logic (around line 780):

1. **Stop deleting past-week incomplete routine items.** Pass 2 of the rollover (currently filters out routine-attached past-week incomplete items) becomes a carry-forward: set `item.week = newPresentWeek`, preserve `originalWeek` if not yet set, preserve `completedCount`, `minutes`, `notes`, `targetCount`.
2. **Manual tasks move to current week, not ideas.** Replace the move-to-IDEAS_WEEK_KEY behavior with move-to-newPresentWeek. Same preservation rules.
3. **No auto-archive.** Tasks carry indefinitely. User deletes if they want it gone.

### Files
- `src/store/store.ts` (rollover routine)
- `src/utils/mergeUtils.ts` — review the `originalWeek` sanitization to ensure it survives carry-forward

### Acceptance criteria
- Run task at W18 with `completedCount=1` (of 2) → end of W18 → at W19 with `completedCount=1`
- Manual task "Dentist" at W18 incomplete → end of W18 → at W19, NOT in ideas
- Task missed across multiple rollovers continues forward each time
- User-deleted tasks don't return

---

## Phase 3 — UI cleanup & visual badges

**Goal:** Align the queue UI with the new model. Strip the dismissal flow that's no longer needed.

### Changes

1. **Remove dismissal flow:**
   - [src/components/QueuePanel.tsx](../../src/components/QueuePanel.tsx): remove "Refill" button, the `hasDismissedThisWeek` memo, and `onDismiss` button on `ProposalCard`
   - [src/store/store.ts](../../src/store/store.ts): remove `dismissProposal`, `clearDismissals`
   - [src/types.ts](../../src/types.ts): keep `dismissedAt` field as a no-op for now (avoid migration churn) or drop entirely if no consumers remain

2. **Yearly badge on annual routines** — in `ProposalCardVisual` and `ProposalCard`, render a small label/icon next to the cadence chip when `routine.cadence === 'annually'`.

3. **Empty state copy** — update the queue's empty-state message to remove "Refill" wording.

### Files
- `src/components/QueuePanel.tsx`
- `src/store/store.ts`
- `src/types.ts` (only if removing `dismissedAt`)
- `src/index.css` / `src/styles/themes.css` (badge styling)

### Acceptance criteria
- No Refill button, no Dismiss button visible
- Annual routines visibly distinct from weekly/biweekly/monthly in the queue
- Empty state reads sensibly with no dismissal references

---

## Phase 4 — Ranking stability

**Goal:** Prevent ranking from shifting under the user's hands.

**Decisions in play:** Q25 (compute on load + state changes, no timers, freeze during drag).

### Changes

1. **Audit `currentTime` updates.** Confirm there's no setInterval driving `currentTime` mid-session. If there is, gate it to fire only when no drag is active and only on minute/hour boundaries.
2. **Memoization is already in place** in `QueuePanel` (`useMemo` over `[routines, items, currentTime]`). Verify it doesn't recompute on unrelated state changes.
3. **dnd-kit naturally freezes** SortableContext during a drag. Confirm and add a comment.

### Files
- `src/App.tsx` (clock effects)
- `src/components/QueuePanel.tsx` (memoization comment)

### Acceptance criteria
- Idle the queue for 30 minutes; order does not shift
- Begin a drag, stay mid-drag for 30 seconds; order does not shift
- Drag held across midnight rollover completes without item disappearing

---

## Phase 5 — Stop spawning, retire dead code

**Goal:** No code path creates pre-spawned routine items anymore.

### Changes

1. Audit callers of `spawnTasksForRoutine` and `getVisibleWeeks` in [src/utils/routineSpawner.ts](../../src/utils/routineSpawner.ts).
2. Remove any routine-creation or routine-update flows that trigger spawning.
3. Keep `isWeekInSeason` and `matchesCadence` (used by Phase 1 helpers). Optionally rename the file to `routineScheduling.ts` to reflect the shift away from spawning.

### Files
- `src/utils/routineSpawner.ts`
- `src/store/store.ts` (any `addRoutine`/`updateRoutine` actions that call spawn)
- `src/components/RoutineManager.tsx`

### Acceptance criteria
- Creating a new routine inserts zero items into `state.items`
- Editing an existing routine inserts zero items
- The two existing migrations (V1, V2) remain idempotent

---

## Phase 6 — Validation pass

**Goal:** Walk through the brainstorm scenarios with real local data.

### Manual checks

1. **Scenario A — Fresh Monday Morning** ([brainstorm](../brainstorms/routine-queue-redesign.md#scenario-a--fresh-monday-morning)): seed last-completion timestamps to match, open queue, verify ordering matches the expected sequence (with anchor-proximity tie-breaking applied).
2. **Scenario B — Drag Clean Den**: drag from queue, verify projection sinks the row (or removes it from queue if outside surfacing window).
3. **Annual surfacing**: temporarily set `currentTime` to 10 days before an annual's anchor; verify it appears.
4. **Annual hiding**: set `currentTime` to 6 months before annual's anchor; verify hidden.
5. **Sequential multi-assign**: drag Run → W18, then drag Run → W19; verify both instances exist; verify queue projection follows W19 (latest).
6. **Carry-over multi-occurrence**: assign Run (targetCount=2) to W18, complete 1 of 2, advance to W19, verify task arrives at W19 with `completedCount=1`.
7. **Out-of-season hiding**: set `currentTime` to January with a May–September seasonal routine; verify hidden.

---

## Migration & data safety

### What's already done
- `runRoutineProposalsMigrationV1` (line 643): removed past-week incomplete routine items
- `runRoutineProposalsMigrationV2` (line 666): removed all incomplete routine items regardless of week

These ran on existing accounts. The DB inspection from 2026-05-02 (316 routine items across 54 weeks for the demo account) reflects pre-V2 state, but on a live account with V2 applied, the routine-spawned future placeholders should already be gone.

### What's still needed
- **Verify V2 ran on user's account before deploying Phase 2.** If V2 hasn't applied, the carry-over rule will pick up old pre-spawned routine items and start carrying them forward — confusing. Defensive: re-run V2 (idempotent) on app load.

### What's NOT needed
- No new migration required for the new ranking logic — it's pure derivation from existing fields.
- No schema change.

---

## File-touch summary

| File | Phase(s) | Type of change |
|------|----------|----------------|
| `src/utils/proposalUtils.ts` | 1 | Rewrite ranking core |
| `src/utils/routineSpawner.ts` (rename → `routineScheduling.ts`?) | 1, 5 | Add `nextAnchorOccurrence`, `daysUntilDue`; retire spawn calls |
| `src/store/store.ts` | 2, 3, 5 | Carry-over logic; remove dismissal actions; remove spawn calls |
| `src/components/QueuePanel.tsx` | 3 | Remove Refill/Dismiss; yearly badge |
| `src/components/RoutineManager.tsx` | 5 | Drop spawn-on-create wiring |
| `src/types.ts` | 3 (optional) | Drop `dismissedAt` if cleanly possible |
| `src/index.css` / `src/styles/themes.css` | 3 | Badge styling |
| `src/App.tsx` | 4 | Clock-effect audit |

---

## Risks & open questions to resolve during implementation

- **N=14 vs N=21 surfacing window** — dogfood for a few days each, pick by feel. Land 14 first.
- **Carry-over of manuals** — user confirmed it applies to all tasks, but the existing UX moved manuals to "ideas." Some users may rely on that to clear their week. Flag visibly in the changelog.
- **Next anchor occurrence per cadence** — spec precisely in code comments; the brainstorm parked this as a follow-up. Concrete defs:
  - Weekly: next occurrence of `getDayOfWeek(anchorWeek)` strictly after today
  - Biweekly: nearest future week matching anchor parity
  - Monthly: nearest future week with same `getWeekInMonth` as anchor
  - Annual: anchor week of the current year if future, else next year
- **Projected completion when multiple instances exist** — use latest (furthest-future) assigned week. Uncompleted only.
- **Lingering `dismissedAt`** — leaving the field on `Routine` is cheap and avoids a migration. Stop reading from it; keep it ignored.

---

## Suggested ordering

Execute roughly in phase order. Phase 1 and Phase 2 are the load-bearing changes; Phase 3 is dependent on Phase 1 (don't strip Refill until proposal computation is reliable); Phase 4 and Phase 5 can land any time after Phase 1.

A reasonable PR breakdown:
1. PR1: Phase 1 (ranking model rewrite) — biggest single change, ship behind a feature flag if uneasy
2. PR2: Phase 2 (carry-over)
3. PR3: Phase 3 (UI cleanup + badge)
4. PR4: Phase 4 + Phase 5 (stability + dead-code removal)
5. PR5: Phase 6 validation notes / fixes from dogfooding
