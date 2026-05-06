---
title: "feat: Routine proposals panel and focused week view"
type: feat
status: active
date: 2026-04-18
origin: docs/brainstorms/routine-proposals-week-focus-requirements.md
deepened: 2026-04-18
---

# feat: Routine Proposals Panel & Focused Week View

## Overview

Routines currently auto-spawn tasks into future weeks and carry incomplete ones forward. This plan replaces that model with a proposal system: routines appear in a persistent side panel ranked by urgency; the user drags proposals into a focused week view (current + next week) to commit. Dismissed proposals reset their cadence clock. Accepted-but-incomplete routine tasks are not carried over — they return to the proposals panel on the next app open.

This is a cross-cutting change that touches the data model, store logic, rollover behavior, spawn system, layout, and two UI panels.

## Problem Frame

See origin document. The core shift: routines stop being automated task schedulers and become guideposts that surface suggestions at the right time, leaving the user in control of what actually goes in the week. (see origin: docs/brainstorms/routine-proposals-week-focus-requirements.md)

## Requirements Trace

- R1–R2: Week view shows current week + next week. Future weeks show only calendar-dated events, not routine tasks.
- R3–R6: Persistent proposals panel ranked by cadence-percentage elapsed. Drag-to-accept into any visible week.
- R7–R9: Dismiss resets cadence clock from today. No distinction between fresh dismissal and dismiss-after-failure.
- R10–R12: Accepted tasks don't carry over. Return to proposals on week-end. Manual tasks carry over as before.
- R13–R16: lastCompletedAt is the cadence baseline. Dismissal sets dismissedAt used as pseudo-baseline. Fallback: "never completed" = 100% elapsed.
- R17: Calendar events unaffected.

## Scope Boundaries

- Does not change task types (simple, multi-occurrence, time-tracked).
- RoutineManager creation/editing UI is unchanged.
- Mobile layout of the proposals panel is deferred.
- Ranking algorithm is cadence-% elapsed only — no ML, weights, or external signals.
- "Consider deactivating" nudge for chronic dismissals is out of scope.
- Forward-planning routine tasks beyond next week is not supported (accepted trade-off).

### Deferred to Separate Tasks

- Mobile layout of the proposals panel: separate future design sprint.

## Context & Research

### Relevant Code and Patterns

- `src/types.ts` — `Routine` interface (lines 32–48): no `lastCompletedAt` or `dismissedAt` currently; `Item` has `completedAt?: string`, `routineId?: string`, `originalWeek?: WeekKey`
- `src/utils/routineSpawner.ts` — `spawnTasksForRoutine()`, `matchesCadence()`, `isWeekInSeason()`, `removeOutdatedRoutineTasks()`. Task IDs currently `${routine.id}-${weekKey}`.
- `src/utils/rolloverUtils.ts` — `rolloverPastItems()` pure function called from `App.tsx` useEffect on mount (line 27)
- `src/store/store.ts` — `completeItem` (lines 216–238, stamps `completedAt: currentTime`), `rolloverPastItems` (lines 629–649), `spawnRoutineTasks` (lines 610–627), `getPresentWeek()` derives week from `state.currentTime`
- `src/App.tsx` — spawn called in useEffect with empty deps (line 27); `tasks-layout` div (line 94); `activePanel` state; 30s polling hydration
- `src/components/TaskList.tsx` — 52-week loop (lines 158–169); `DndContext` owner; `handleDragEnd`, `handleDragOver`; `allDragItems` array includes ideas items for cross-container drag
- `src/components/SideDrawer.tsx` — toggle overlay panel, not suitable for always-visible proposals column
- `src/components/IdeasPanel.tsx` — proven pattern: `useDroppable` + `SortableContext` inside `TaskList`'s `DndContext` for cross-container drag from panel to week
- `src/components/WeekSection.tsx` — pure rendering component receiving week + items as props
- `src/styles/themes.css`, `src/index.css` — layout CSS including `.tasks-layout.panel-open`

### Institutional Learnings

- No `docs/solutions/` directory exists in this repo — no prior solutions indexed.
- **No unit test infrastructure exists in `src/`.** There are no `.test.ts` or `.test.tsx` files, no test runner configuration, and no `__tests__` directories in the source tree. Test scenarios in this plan are behavioral specifications for manual verification and/or for future use if a test framework is added. No "Test:" file paths are listed in implementation unit file lists.

### External References

- `@dnd-kit/core` v6.3.1 + `@dnd-kit/sortable` v10.0.0 already in use. Cross-container drag pattern well-established via IdeasPanel.

## Key Technical Decisions

- **`lastCompletedAt` and `dismissedAt` added to `Routine` type.** Scanning `items` at render-time per routine is O(n) per routine and fragile. Adding fields to `Routine` and writing them on completion/dismissal is the correct long-term design. Historical completions are derivable from item records as a bootstrap fallback on first load.
- **Accepted task ID uses `accepted-${routineId}-${Date.now()}`.** The old `${routine.id}-${weekKey}` format encodes week identity, which no longer applies when the user chooses the week at drag time. A prefix of `accepted-` makes accepted proposals queryable (filter `item.id.startsWith('accepted-')`). Uniqueness is guaranteed by timestamp.
- **Duplicate acceptance guard in `acceptProposal` store action.** Before creating an item, check for existing `item.routineId === routineId && item.week === targetWeek && item.status !== 'complete'`. If found, no-op silently.
- **Rollover for routine tasks: remove, not carry-over.** `rolloverPastItems` will be updated to exclude `item.routineId` items. A second pass removes ALL past-week incomplete routine items (week < presentWeek), regardless of how many weeks were missed. These re-appear in the proposals panel naturally — their cadence-% urgency is re-computed from the original `lastCompletedAt`.
- **Proposal computation excludes routines with active accepted tasks.** A routine should not appear in proposals if an item exists with `routineId === X && week === presentWeek || nextWeek && status !== 'complete'`. This prevents double-booking.
- **Proposals panel is a persistent layout column, not a SideDrawer panel.** The `SideDrawer` toggle model doesn't support always-visible panels. The proposals column lives as a sibling div inside `tasks-layout`. Existing overlay panels (SideDrawer) can sit on top of it when open.
- **Auto-spawn is fully disabled.** `spawnRoutineTasks()` has exactly two call sites: App.tsx useEffect (line ~28) and `advanceTime` (line ~676). Both are removed. Existing future-week routine tasks are cleaned via a one-time migration on app load.
- **Migration: remove future-week routine tasks on first load after update.** Any `Item` with `routineId` and `week > nextWeek` that is `status === 'incomplete'` with no user-initiated data (no modified notes, no progress beyond initial state) is removed. A store migration flag (`routineProposalsMigrationV1: boolean`) prevents re-running. This flag must be stored in the API-synced state (not local-only) so that on a second device, if the flag is already true from the API, the migration does not re-run and re-delete items that were already cleaned. The migration runs AFTER `hydrateFromApi` so the API state is the source of truth for what items exist before deletion.
- **`isWeekInSeason` and `matchesCadence` reused verbatim.** These functions already handle seasonal windows and cadence alignment correctly. The proposal computation function calls them directly — no reimplementation.
- **Week-end detection is lazy (on-app-open).** Consistent with the existing rollover pattern. No background job or timer is introduced. The routine-task cleanup pass runs after `rolloverPastItems` on every app open, catching all gaps regardless of how many weeks were missed.
- **Cadence baseline uses `max(lastCompletedAt, dismissedAt)`.** Whichever is more recent is the effective "last reset" for cadence-% calculation. This ensures dismissal properly resets the clock even if there was a prior completion.
- **Proposal cards in DnD use phantom Item objects with a sentinel week.** Proposals are `RoutineProposal` objects, not `Item` objects. The existing `dragOrigin` type (`{ week: WeekKey; orderIndex: number; item: Item }`) requires Item-typed drag sources. To integrate proposals into the shared DndContext without changing the core drag type, proposal cards should be represented in `allDragItems` as lightweight synthetic Item objects (`{ id: routineId, week: PROPOSALS_CONTAINER_KEY, routineId, title, ... }`) with `PROPOSALS_CONTAINER_KEY` as their sentinel week. In `handleDragOver`, add a guard: if `dragOrigin.item.week === PROPOSALS_CONTAINER_KEY` (source is proposals), skip `reorderItem` — do not mutate item state during hover. In `handleDragEnd`, if `active.data.current.sortable.containerId === PROPOSALS_CONTAINER_KEY` and `overWeek` is a valid visible week, call `acceptProposal(routineId, overWeek)` and do not call `reorderItem`. This keeps the existing drag handler structure intact while correctly routing proposal drops.

## Open Questions

### Resolved During Planning

- **Does the current model track lastCompletedAt per routine?** No — must be added to `Routine` type and written in `completeItem`. Historical completions can be bootstrapped from item scan on first load (see migration unit).
- **Migration flag and multi-device sync:** The `routineProposalsMigrationV1Done` flag must live in API-synced state. If device B hydrates after device A has already run the migration and the flag is set in API state, device B will see the flag and skip the migration — items remain correctly cleaned. Migration runs after hydration so API state is authoritative for which items exist before deletion.
- **How does week-end detection work?** Lazy, on-app-open. A cleanup pass after `rolloverPastItems` removes all past-week incomplete routine items. They re-appear in proposals via computation.
- **Can future-week spawning be suppressed without a large refactor?** Yes — remove spawn call sites and clean existing future tasks via migration. The spawn utility itself can be left largely in place (or removed).
- **Can the proposals panel reuse the SideDrawer pattern?** No — the "persistently visible" requirement means it must be a sibling layout column, not an overlay toggle.
- **Duplicate acceptance prevention?** Guard in `acceptProposal` store action. See Key Technical Decisions.
- **What happens when a routine is deleted with an accepted task?** Existing `deleteRoutine(removeRelatedTasks: false)` behavior: task stays in week view as an orphaned manual task. Acceptable — user committed to the task.
- **New routine immediate appearance?** Yes — immediately in proposals if in-season (or year-round). R16 fallback covers missing history.

### Deferred to Implementation

- **Bootstrap migration for historical `lastCompletedAt`:** Implementation should compute `max(completedAt)` per `routineId` across existing items and backfill `Routine.lastCompletedAt` during the migration pass. Confirm whether any items are missing `completedAt`.
- **CSS layout specifics for persistent proposals column:** The exact flex/grid approach and column widths should be determined during implementation against the existing `tasks-layout` and `panel-open` classes.
- **Empty-state UX for proposals panel:** When no proposals are currently eligible (all dismissed, in-season, or accepted), show a contextually appropriate empty message. Determine exact copy during implementation.
- **Saturday acceptance edge case:** If today is Saturday (last day of current week), an accepted task will have only hours before it returns to proposals on Sunday. No special warning is required in v1 — the rollover behavior handles it correctly.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
Proposal computation (pure, memoized):
  input: routines[], items[], currentTime
  for each routine:
    skip if deletedAt
    skip if not in seasonal window (isWeekInSeason)
    skip if has active accepted task in presentWeek or nextWeek
    baseline = max(lastCompletedAt, dismissedAt) ?? null
    cadenceDays = cadence → days (weekly=7, biweekly=14, monthly=30, annually=365)
    if baseline is null:
      cadencePct = 1.0   // R16: treat as 100% elapsed, show immediately
    else:
      elapsed = daysSince(baseline, currentTime)
      cadencePct = elapsed / cadenceDays
    if cadencePct < 1.0: skip  // not yet due
    include in proposals, sort descending by cadencePct

Acceptance flow (store action: acceptProposal):
  guard: if item exists with routineId + week + incomplete → no-op
  create item: { id: "accepted-{routineId}-{timestamp}", routineId, week: targetWeek, title, ... }

Dismissal flow (store action: dismissProposal):
  routine.dismissedAt = currentTime  // resets cadence clock

Rollover (modified rolloverPastItems):
  existing: move incomplete non-routine items from past weeks to present
  new: remove (don't move) incomplete routine items from past weeks
  these re-appear in proposal computation at high cadencePct

App load sequence:
  1. hydrateFromApi
  2. rolloverPastItems (modified)
  3. cleanupPastRoutineItems  ← new, part of rollover
  4. runMigrationV1 (if not yet run)
  5. computeProposals (derived, drives panel render)
```

```
Layout structure (conceptual, not prescriptive CSS):
┌──────────────────────────────────────────────────────┐
│ tasks-layout                                         │
│ ┌─────────────────────────┐ ┌──────────────────────┐ │
│ │ week-view-column        │ │ proposals-column      │ │
│ │ (TaskList content)      │ │ (RoutineProposals-    │ │
│ │  - current week         │ │  Panel, always        │ │
│ │  - next week            │ │  visible)             │ │
│ │  - future weeks*        │ │                       │ │
│ │  * calendar events only │ │  [DndContext shared]  │ │
│ └─────────────────────────┘ └──────────────────────┘ │
│ SideDrawer (overlay, on top when active)             │
└──────────────────────────────────────────────────────┘
```

## Implementation Units

- [ ] **Unit 1: Extend Routine type with proposal state fields**

**Goal:** Add `lastCompletedAt` and `dismissedAt` to the `Routine` data model. Wire `completeItem` to write `lastCompletedAt` on every routine task completion.

**Requirements:** R13, R14, R16

**Dependencies:** None

**Files:**
- Modify: `src/types.ts`
- Modify: `src/store/store.ts`

**Approach:**
- Add `lastCompletedAt?: string` and `dismissedAt?: string` to the `Routine` interface in `src/types.ts`
- In `completeItem` (store.ts ~line 216): after marking the item complete, if `item.routineId` exists, update `routines[routineId].lastCompletedAt` to `state.currentTime`
- Do not add these fields to the `spawnTasksForRoutine` or `RoutineManager` paths — they are managed only by completion and dismissal actions

**Patterns to follow:**
- `completeItem` already reads `state.currentTime` for `completedAt` — follow the same pattern for `lastCompletedAt`
- `updatedAt?: number` on `Routine` shows how optional timestamp fields are typed

**Test scenarios:**
- Happy path: Completing a routine-linked task sets `routine.lastCompletedAt` to the current timestamp on the associated routine
- Happy path: Completing a non-routine task does not modify any routine
- Edge case: Completing a routine task when `routine.lastCompletedAt` already exists overwrites it with the newer timestamp
- Edge case: Completing a task whose `routineId` references a deleted routine (deletedAt set) — does not error; may silently skip the update

**Verification:**
- After completing a routine-linked task in the store, `state.routines[routineId].lastCompletedAt` reflects the completion time
- `src/types.ts` compiles without errors with the new fields

---

- [ ] **Unit 2: Build proposal computation utility**

**Goal:** Create a pure, memoizable function `computeProposals(routines, items, currentTime)` that returns a ranked list of `RoutineProposal` objects ready for display. This is the engine that drives the proposals panel.

**Requirements:** R3, R4, R5, R13, R14, R15, R16

**Dependencies:** Unit 1 (Routine type has `lastCompletedAt`, `dismissedAt`)

**Files:**
- Create: `src/utils/proposalUtils.ts`
- Modify: `src/types.ts` (add `RoutineProposal` interface)

**Approach:**
- Define `RoutineProposal` type: `{ routine: Routine; lastCompletedAt: string | null; cadencePctElapsed: number; isDue: boolean }`
- `computeProposals` logic (see High-Level Technical Design above):
  - Filter: skip deleted routines, out-of-season routines, routines with an active accepted task in presentWeek or nextWeek
  - Compute `cadencePctElapsed` using `max(lastCompletedAt, dismissedAt)` as baseline
  - Cadence-day mapping: weekly→7, biweekly→14, monthly→30, annually→365
  - Skip routines with `cadencePctElapsed < 1.0` (not yet due)
  - Sort descending by `cadencePctElapsed`
- Reuse `isWeekInSeason(weekKey, routine)` from `src/utils/routineSpawner.ts` for seasonal filtering
- The function is pure — no store access, no side effects
- Export as a named function for use in the proposals panel component (via `useMemo`)

**Patterns to follow:**
- `src/utils/routineSpawner.ts` — `matchesCadence`, `isWeekInSeason` for reuse
- `getPresentWeek()` pattern: derive present/next week from `currentTime` argument, don't assume global state

**Test scenarios:**
- Happy path: A monthly routine with `lastCompletedAt` 35 days ago appears at 117% elapsed
- Happy path: A weekly routine with `lastCompletedAt` 8 days ago appears before a monthly routine at 150% elapsed (weekly ranks higher by %)
- Happy path: A routine with no `lastCompletedAt` and no `dismissedAt` appears at 100% elapsed (R16 fallback)
- Edge case: A routine with `lastCompletedAt` 3 days ago (weekly cadence, 43% elapsed) does NOT appear (not yet due)
- Edge case: A seasonal routine outside its active window does NOT appear in proposals
- Edge case: A routine with an active accepted task (incomplete item in presentWeek) does NOT appear in proposals (already committed)
- Edge case: `dismissedAt` is more recent than `lastCompletedAt` → uses `dismissedAt` as baseline
- Edge case: Both `lastCompletedAt` and `dismissedAt` are null → appears at 100%
- Edge case: Annual routine at 14 months (140%) ranks below monthly routine at 2 months (200%)

**Verification:**
- Pure function with no async calls or store access
- Returns sorted proposals only for due routines in active seasonal windows
- Reuses `isWeekInSeason` without modification

---

- [ ] **Unit 3: Update rollover to exclude and clean up routine tasks**

**Goal:** Prevent routine-linked tasks from carrying over automatically. Add a cleanup pass that removes past-week incomplete routine items so they return to proposals.

**Requirements:** R10, R11, R12

**Dependencies:** Unit 1

**Files:**
- Modify: `src/store/store.ts` (rolloverPastItems function, ~lines 629–649)
- Modify: `src/utils/rolloverUtils.ts` (if rollover logic lives there)

**Approach:**
- In `rolloverPastItems`: add `&& !item.routineId` guard to the filter that selects items to carry over — manual tasks continue to roll over; routine tasks do not
- After the carry-over pass, add a second pass: find all items where `item.routineId && item.status === 'incomplete' && item.week < presentWeek` and remove them from state. These items re-appear in the proposals panel naturally via `computeProposals`.
- This second pass handles multi-week gaps (offline for 3 weeks) by scanning ALL past weeks, not just the most recent one
- The removal does not touch `routine.lastCompletedAt` — incomplete items returning to proposals should not reset the completion baseline

**Patterns to follow:**
- `rolloverPastItems` already separates past-week items by condition; add to that filter chain
- `removeOutdatedRoutineTasks` in routineSpawner.ts shows the pattern for bulk item removal by condition

**Test scenarios:**
- Happy path: An incomplete manual task from the previous week carries over to the present week
- Happy path: An incomplete routine-linked task from the previous week does NOT carry over; it is removed from items
- Happy path: After removal, `computeProposals` surfaces the routine with elevated cadencePct (original lastCompletedAt used, not week-start)
- Edge case: An incomplete routine-linked task from 3 weeks ago is removed in a single pass (multi-week gap handled)
- Edge case: A completed routine-linked task from a past week is NOT removed (only incomplete items are removed)
- Edge case: A routine-linked task that was completed this week is unaffected
- Integration: After rollover runs, the proposals panel includes the routine whose task was removed, ranked at high urgency

**Verification:**
- After app open with a past-week incomplete routine task, `state.items` no longer contains that item
- After app open, manual tasks from past weeks still appear in the present week
- No completed routine tasks are removed

---

- [ ] **Unit 4: Disable auto-spawning and run data migration**

**Goal:** Remove all automatic routine task spawning from the app lifecycle. Clean up existing future-week routine tasks created under the old model.

**Requirements:** R2 (future weeks show no routine tasks), R1

**Dependencies:** Unit 1, Unit 6 (week view filtering must be in place before spawn is disabled, to avoid confusing intermediate states where spawn is off but future-week routine items still render)

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/store/store.ts` (`advanceTime`, migration action)
- Modify: `src/utils/routineSpawner.ts` (optional: mark spawn functions as no-op or remove call sites only)

**Approach:**
- Remove `spawnRoutineTasks()` call from App.tsx useEffect (line ~27)
- Remove `spawnRoutineTasks()` call from `advanceTime` in store.ts
- Add a `runRoutineProposalsMigrationV1` store action that:
  - Checks a flag `state.routineProposalsMigrationV1Done: boolean` — skip if already run
  - Removes all items where `item.routineId && item.status === 'incomplete' && item.week > nextWeek`
  - Exception: items with user-modified data (notes different from `inheritedNotes`, or any progress for multi-occurrence/time-tracked tasks) are preserved as manual tasks by clearing their `routineId` link
  - Sets `routineProposalsMigrationV1Done: true`
  - Also bootstraps `lastCompletedAt` on each routine by scanning existing completed items (`max(completedAt)` per `routineId`) if `routine.lastCompletedAt` is not yet set
- Call `runRoutineProposalsMigrationV1` in App.tsx after initial hydration
- Add `routineProposalsMigrationV1Done: boolean` to store state shape

**Patterns to follow:**
- `removeOutdatedRoutineTasks` in routineSpawner.ts for the item-removal pattern
- Any existing migration flags in the store state (check for precedents)

**Test scenarios:**
- Happy path: On first load after update, future-week routine tasks (week > nextWeek, incomplete, unmodified) are removed
- Happy path: After migration, `routineProposalsMigrationV1Done` is true and the migration does not run again on subsequent loads
- Edge case: A future-week routine task with user-added notes (different from `inheritedNotes`) is preserved as a manual task with `routineId` cleared
- Edge case: A multi-occurrence routine task with partial progress is preserved as a manual task
- Edge case: Migration bootstraps `lastCompletedAt` on a routine from existing completed item records
- Edge case: Migration with no existing routine tasks — runs cleanly and sets the flag

**Verification:**
- After migration, no incomplete routine-linked items exist in weeks beyond nextWeek
- `routineProposalsMigrationV1Done` is persisted in state
- Spawn is no longer called on app open or time advance

---

- [ ] **Unit 5: Add acceptProposal and dismissProposal store actions**

**Goal:** Implement the two primary user actions for the proposals panel — accepting a proposal (dragging it into a week) and dismissing one.

**Requirements:** R6, R7, R8, R9, R10

**Dependencies:** Unit 1, Unit 2 (RoutineProposal type)

**Files:**
- Modify: `src/store/store.ts`
- Modify: `src/types.ts` (if any new action types needed)

**Approach:**
- `acceptProposal(routineId: string, targetWeek: WeekKey)`:
  - Guard: if an item exists with `routineId === routineId && week === targetWeek && status !== 'complete'` → no-op (duplicate prevention)
  - Create item: inherit `title`, `taskType`, `targetCount`, `minutesGoal`, `notes` from the routine; set `id: accepted-${routineId}-${currentTime}`, `routineId`, `week: targetWeek`, `status: 'incomplete'`
  - Do NOT set `routine.lastCompletedAt` — acceptance is not completion
- `dismissProposal(routineId: string)`:
  - Set `routine.dismissedAt = state.currentTime` on the given routine
  - Does not create or remove any items
  - If the routine had an accepted-but-incomplete task in a visible week... leave it in place (the user is dismissing the proposal, not the committed task; this is an edge case worth noting for implementation)

**Patterns to follow:**
- `addItem` in store.ts for item creation pattern (check how `id` is generated there)
- `updateRoutine` for mutating routine fields
- `state.currentTime` as the timestamp source (not `Date.now()`) for dev-tool compatibility

**Test scenarios:**
- Happy path: `acceptProposal('r1', '2026-W17')` creates a new item in week 2026-W17 with `routineId: 'r1'`
- Happy path: After acceptance, `computeProposals` no longer includes routine 'r1' (active accepted task exists)
- Error path: Calling `acceptProposal('r1', '2026-W17')` twice — second call is a no-op, no duplicate item created
- Happy path: `dismissProposal('r1')` sets `routine.dismissedAt` to currentTime
- Happy path: After dismissal, `computeProposals` does not include routine 'r1' until cadence window reopens from dismissal date
- Edge case: `dismissProposal` on a routine that has an accepted incomplete task — `dismissedAt` is set but the accepted task remains in the week view unchanged

**Verification:**
- `acceptProposal` creates exactly one item per (routineId, week) regardless of how many times it's called
- `dismissProposal` correctly gates re-appearance in `computeProposals` output

---

- [ ] **Unit 6: Narrow week view — filter routine tasks from future weeks**

**Goal:** Restrict routine-linked tasks to the current week and next week in the week view. Future weeks render only calendar-dated events.

**Requirements:** R1, R2

**Dependencies:** Unit 1. Implement before Unit 4 (spawn must be disabled only after the view correctly filters future-week routine items, to avoid confusing intermediate state during development)

**Files:**
- Modify: `src/components/TaskList.tsx`
- Modify: `src/components/WeekSection.tsx`

**Approach:**
- In `TaskList.tsx`, retain the existing week generation loop (52 weeks for calendar events) but derive `presentWeek` and `nextWeek` from `currentTime`
- When passing `weekItems` to each `WeekSection`, filter out items with `routineId` for any week beyond `nextWeek`. Weeks ≤ nextWeek pass all items as before.
- Add a boolean prop `showRoutineTasks` (or equivalent) to `WeekSection`, defaulting to `true`, set to `false` for weeks beyond nextWeek
- In `WeekSection`, apply the filter: if `!showRoutineTasks`, exclude items where `item.routineId` is set from rendering. Do not change the prop drilling of the full `weekItems` — filtering at the WeekSection level keeps TaskList simpler.
- Past weeks (week < presentWeek): already show carried-over manual tasks only (Unit 3 removed routine items). No change needed.

**Patterns to follow:**
- Existing `weekItems` prop threading through TaskList → WeekSection
- `addWeeks(presentWeek, 1)` for computing nextWeek (see existing use of `addWeeks` in the codebase)

**Test scenarios:**
- Happy path: Current week displays both manual tasks and accepted routine tasks
- Happy path: Next week displays both manual tasks and accepted routine tasks
- Happy path: A week 3 weeks in the future displays calendar events but no routine-linked items
- Edge case: A routine task accepted into the current week appears in the week view; same routine accepted into a week 4 weeks out would not be possible (UI prevents this — only visible weeks are drop targets) but if data existed, it would be hidden
- Edge case: Past weeks show only manual/carried-over tasks (routine items were removed in Unit 3 rollover)

**Verification:**
- WeekSection for future weeks (beyond nextWeek) does not render items with `routineId`
- WeekSection for current and next week renders accepted routine tasks normally

---

- [ ] **Unit 7: Build RoutineProposalsPanel component**

**Goal:** Create the proposals panel component that renders ranked routine proposals with urgency signals and a dismiss action.

**Requirements:** R3, R4, R5, R6, R7

**Dependencies:** Unit 2 (computeProposals), Unit 5 (dismissProposal action)

**Files:**
- Create: `src/components/RoutineProposalsPanel.tsx`

**Approach:**
- The component consumes `routines`, `items`, and `currentTime` from the store, calls `computeProposals` via `useMemo`, and renders the result
- Each proposal card shows:
  - Routine title
  - Cadence label (e.g., "Monthly")
  - Last completed: either a human-readable relative date ("3 weeks ago") or "Never completed"
  - Urgency indicator: shown when `cadencePctElapsed >= 1.0`. Could be a subtle color shift or percentage badge — exact visual treatment is an implementation decision.
- Dismiss button on each card dispatches `dismissProposal(routineId)`
- Cards are wrapped in `SortableContext` with a `useDroppable` on the panel container using a new container id (e.g., `PROPOSALS_CONTAINER_KEY`). This follows the IdeasPanel pattern exactly.
- The component is rendered inside `TaskList`'s existing `DndContext` subtree (see Unit 9) — do NOT create a nested `DndContext`
- Export `PROPOSALS_CONTAINER_KEY` constant for use in the drag handler (Unit 9)

**Patterns to follow:**
- `src/components/IdeasPanel.tsx` — exact pattern for `useDroppable` + `SortableContext` inside a shared `DndContext`
- `src/components/TaskCard.tsx` — for proposal card drag handle behavior
- `src/store/store.ts` selector patterns for consuming store state in components

**Test scenarios:**
- Happy path: Panel renders with proposals sorted by cadencePct descending
- Happy path: Proposal card shows "Never completed" when `lastCompletedAt` is null
- Happy path: Proposal card shows relative date when `lastCompletedAt` is set
- Edge case: Empty proposals panel (all routines dismissed, accepted, or not yet due) — renders empty state message
- Happy path: Dismiss button on a card dispatches `dismissProposal` and the card disappears from the panel
- Integration: Completing a routine task in the week view causes its proposal to disappear from the panel (lastCompletedAt updated, cadencePct drops below 1.0)

**Verification:**
- Panel renders correctly with 0, 1, and N proposals
- Proposals are sorted by cadencePct descending
- Dismiss action removes the card from the panel immediately (optimistic store update)

---

- [ ] **Unit 8: Restructure layout for persistent proposals column**

**Goal:** Add a persistent proposals column to the app layout that coexists with the existing SideDrawer toggle panels.

**Requirements:** R3 (persistently visible)

**Dependencies:** Unit 7 (RoutineProposalsPanel component exists)

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/TaskList.tsx`
- Modify: `src/styles/themes.css` or `src/index.css`

**Approach:**
- Add a persistent `proposals-column` div as a sibling to the main week view column inside `tasks-layout`
- Render `<RoutineProposalsPanel />` inside this column
- The `proposals-column` is always visible — not controlled by `activePanel` state
- The existing `SideDrawer` overlay remains and opens on top of the proposals column when a toggle panel is activated
- Update CSS for `tasks-layout` to use a two-column flex/grid layout that allocates space to both the week view and the proposals column
- The `panel-open` class behavior may need to shift or stay — SideDrawer overlay is independent of the persistent column, so `panel-open` CSS may need updating to account for the new layout
- The proposals column should have a fixed or min-width that works with the existing week view content

**Patterns to follow:**
- Existing `tasks-layout` and `panel-open` CSS as the baseline to modify
- `SideDrawer` rendering in App.tsx for how overlay panels are layered

**Test scenarios:**
- Test expectation: none — this is a layout/structural change with no behavioral logic. Visual verification is the primary check.

**Verification:**
- Proposals column is visible when no SideDrawer panel is open
- Proposals column remains visible when a SideDrawer panel opens on top
- Week view retains usable width with the proposals column present
- Layout does not break at common desktop viewport widths

---

- [ ] **Unit 9: Wire proposals panel into the drag-and-drop system**

**Goal:** Enable dragging proposal cards from the proposals panel and dropping them into week sections to trigger `acceptProposal`.

**Requirements:** R6

**Dependencies:** Unit 5 (acceptProposal action), Unit 7 (RoutineProposalsPanel with PROPOSALS_CONTAINER_KEY), Unit 8 (layout in place)

**Files:**
- Modify: `src/components/TaskList.tsx`
- Modify: `src/components/RoutineProposalsPanel.tsx` (if any wiring belongs there)

**Approach:**
- Add phantom Item objects for proposals to `allDragItems` in `TaskList`. These synthetic items have `{ id: routineId, week: PROPOSALS_CONTAINER_KEY, routineId, title, status: 'incomplete', ... }` with `PROPOSALS_CONTAINER_KEY` as sentinel week. This satisfies the existing `dragOrigin` type without changing the core drag infrastructure.
- In `handleDragOver`: add an early guard — if `dragOrigin?.item?.week === PROPOSALS_CONTAINER_KEY` (source is the proposals panel), skip the `reorderItem` call entirely. Do not mutate state during hover for proposal drags. This prevents the P1 where `reorderItem` fires on every hover event for cross-container proposal moves.
- In `handleDragEnd`:
  - Detect when `dragOrigin?.item?.week === PROPOSALS_CONTAINER_KEY` and `overWeek` is a valid visible week (presentWeek or nextWeek)
  - Call `acceptProposal(routineId, overWeek)` where `routineId === dragOrigin.item.routineId`
  - Do NOT call `reorderItem` — acceptance creates a real item; reorder is not relevant
  - If `overWeek` is beyond nextWeek or not a valid week, no-op
- The `DragOverlay` renders during proposal drag — can reuse a simplified TaskCard appearance

**Patterns to follow:**
- `src/components/IdeasPanel.tsx` + `TaskList.tsx` `handleDragEnd` handling for `IDEAS_WEEK_KEY` as the exact pattern to follow
- `dragOrigin` state in TaskList for tracking cross-container source

**Test scenarios:**
- Happy path: Dragging a proposal card from the proposals panel and dropping it into the current week calls `acceptProposal(routineId, presentWeek)` and creates a task in the week view
- Happy path: Dropping a proposal into the next week calls `acceptProposal(routineId, nextWeek)`
- Error path: Dropping a proposal outside any week (onto empty space) — no action, proposal stays in panel
- Edge case: Dragging a proposal over a future-only week (calendar events only) — drop is rejected, no task created
- Integration: After drag-accept, the proposal card disappears from the panel and a task card appears in the target week

**Verification:**
- Drag-accept creates exactly one task per proposal per week
- Dropping into unsupported locations is a no-op
- DragOverlay renders during drag from proposals panel

## System-Wide Impact

- **Interaction graph:** `completeItem` now updates `Routine.lastCompletedAt`. `rolloverPastItems` (called on app mount) now has a second cleanup pass for routine items. `advanceTime` (dev panel) no longer calls `spawnRoutineTasks`. Any code that reads `state.items` to count routine tasks across future weeks will see fewer items after migration.
- **Error propagation:** `acceptProposal` is a pure store action with a no-op guard — no error surface. `dismissProposal` similarly. Migration runs on mount and sets a flag — if it crashes, the flag is not set and it reruns next open (idempotent-safe to design that way).
- **State lifecycle risks:** The migration removes items from state — if state is persisted to an API (`hydrateFromApi`), removed items will be sent as deletions. Confirm that the store's persistence layer handles bulk item deletions gracefully. The `routineProposalsMigrationV1Done` flag must also be persisted.
- **API surface parity:** The brainstorm noted this app has task sharing and user permissions. If routines or their items are synced across users/accounts, the migration and rollover changes must not conflict with incoming sync updates. Planning defers this to implementation review.
- **Integration coverage:** The key cross-layer scenario: completing a routine task → `completeItem` updates `Routine.lastCompletedAt` → `computeProposals` memoized result changes → proposals panel re-renders without that routine. This chain must be verified end-to-end.
- **Unchanged invariants:** `deleteRoutine(removeRelatedTasks: false)` behavior is unchanged — accepted tasks with stale `routineId` stay in the week view. Manual task carry-over is unchanged (R12). Calendar events rendering is unchanged (R17). RoutineManager creation/editing UI is unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `rolloverPastItems` removing wrong items | Unit 3 is highest-risk. Add strict `&& item.routineId` guard. Test with time-advance simulation before integrating other units. |
| Migration data loss for modified routine tasks | Unit 4 migration preserves items with user-initiated changes (differing notes, partial progress) by clearing `routineId` and leaving them as manual tasks |
| API persistence conflicts during migration | The store calls `hydrateFromApi` on load and persists state to an API. The migration deletes items in local state; implementation must verify whether the persistence layer treats these as explicit deletes (sent to the API) or whether the migration runs before hydration (in which case API state may re-hydrate the deleted items). Implementation should run migration AFTER initial hydration and confirm that deleted items are properly propagated as deletions, not silently re-spawned on next load. |
| Spawn call sites missed | Exactly 2 confirmed call sites: App.tsx useEffect (line ~28) and `advanceTime` (line ~676). `setTime` does not call spawn. Both must be removed. |
| DnD cross-container wiring breaks existing week-to-week drag | Follow IdeasPanel pattern exactly. Keep a single `DndContext`. Do not create nested contexts. |
| `computeProposals` performance with many routines | Function is pure and memoized via `useMemo`. For typical routine counts (< 50), O(n) item scan per routine is acceptable. If item counts are very large, a pre-indexed `lastCompletedAt` per routine (via Unit 1) eliminates the scan. |

## Sources & References

- **Origin document:** [docs/brainstorms/routine-proposals-week-focus-requirements.md](docs/brainstorms/routine-proposals-week-focus-requirements.md)
- Spawn logic: `src/utils/routineSpawner.ts`
- Rollover logic: `src/store/store.ts` (rolloverPastItems, ~line 629)
- Ideas panel DnD pattern: `src/components/IdeasPanel.tsx`
- DnD context owner: `src/components/TaskList.tsx`
- Type definitions: `src/types.ts`
