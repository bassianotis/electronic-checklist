# Weekly Trackers Dock — "WeekSpanTasks"

**Status:** Functionally complete 2026-05-22 — drag/drop overhauled to single-SortableContext-plus-sortable-divider; gap-at-destination and boundary drop-classification bugs resolved. Style refinement is the only deliberately deferred item.
**Date:** 2026-05-11 (brainstorm) / 2026-05-20 (initial implementation) / 2026-05-22 (drag/drop overhaul)
**Pending follow-up:** Style pass (intentionally deferred — user is doing a single design cleanup later).

## The Idea

The week layout grows from two sections to three:

1. **WeekNotes** — informational, date-stamped (top, unchanged).
2. **WeekSpanTasks** — *new section.* User-docked tasks that anchor the whole week. Visually quieter than normal tasks. Styled like tasks but with a clear divider and reduced significance.
3. **Tasks** — the normal week task list (bottom, unchanged).

**Membership model (user-confirmed):** any task can be docked via a simple per-task user toggle. No automatic rules based on `taskType`. Down the road, automatic rules may layer on; not now.

**Motivation:** ongoing weekly progress tasks (Watering, Read, Run) live at the top of the task list today because incomplete items sort up. They're a constant visual presence that demands attention disproportionate to their state — they're *expected* to be unfinished until Saturday. Docking them gives them a quieter visual home and signals "these run in the background; check on them, don't agonize over them."

---

## Shipped Summary (2026-05-20)

The core dock feature is live. Highlights — see the Decision Log for the full delta from the brainstorm leans:

**Data model:**
- Added `Item.docked?: boolean`. New optional field, undefined = false.
- **Did NOT add `Routine.dockByDefault`** (reversed from Q1 lean). Reason: tasks are *manually dragged* from the queue side panel each week — they don't auto-spawn — so an inherited default never fires. Manual placement is the entire interaction.

**Rendering:**
- `WeekSection` now renders three bands: WeekNotes → Dock → Main tasks. Dock band hides when empty (Q11). Hairline divider between dock and main, visible whenever the dock has items or a drag is in progress (Q6).
- Docked TaskCard variant: subtle `--bg-secondary` background, no shadow, no hover lift, rounded corners matching other cards. Drag handle hidden until hover. Due-date chip, cadence chip, and progress-text chip suppressed. Notes hidden unless the card is in edit mode.

**Interaction (overhauled 2026-05-22):**
- **Drag-and-drop is the only docking mechanic.** Reversed from Q8's lean ("card menu (⋯) + routine settings"). Briefly shipped `↑/↓` arrow buttons; removed them once drag-and-drop replaced them.
- **Single `SortableContext` per week with a sortable-but-non-draggable divider pseudo-item.** Items array is `[...dockedItems, divider, ...mainItems]`. The divider participates in dnd-kit's `verticalListSortingStrategy` so it shifts alongside its neighbors during drag — keeping it a true visual boundary that items can't visually leak past. (Replaces the original two-context design, which couldn't open a gap at the destination band and triggered a `measureRect` infinite loop when we tried to fix that with mid-drag `updateItem`.)
- On drop, the active item's band is classified by its position relative to the divider in the post-`arrayMove` order — no cursor-vs-rect arithmetic. This is what dnd-kit's own strategy uses internally, so the classification is always consistent with the user's visual experience during drag.
- The boundary divider lights up (softly — 2px ~45% indigo) only when the cursor is *near* the boundary (over the divider, the last docked item, or the first main item). Otherwise it's a 1px hairline.
- Cross-week drag honors dock state (drop into another week's dock → item becomes docked in that week).

**Cross-cuts honored:**
- Carry-over (Q20): `Item.docked` is a regular field, so the existing rollover machinery preserves it without special handling.
- Completion (Q21): docked tasks stay in the dock when completed, same as the brainstorm lean.

---

## Known Issues & Deferred Work (as of 2026-05-22)

1. **Style is rough.** User explicitly deferred a design pass — there will be a single styling/refinement sweep after more features land. The dock-card visual treatment (background tint, padding, divider weight) is functional but not finished.

2. **~~Gap-at-destination during cross-band drag.~~ Resolved 2026-05-22** by the single-SortableContext-plus-sortable-divider redesign. dnd-kit's `verticalListSortingStrategy` now opens a real gap at the cursor in whichever band the item is heading toward, because all items (including the divider) participate in a single sort. No mid-drag store updates required.

3. **~~Drop position lands off-target near the boundary.~~ Resolved 2026-05-22** by switching the band classification from cursor-vs-rect-center math to `arrayMove` on the post-drop sortable order. The classification now matches dnd-kit's own strategy, so wherever the user sees the item during drag is exactly where it lands.

4. **"All items docked, can't drag back to main" (original issue #2 from the dock feedback list).** Largely mitigated by the redesign — with a single SortableContext, dragging out of the dock works the same as any other reorder, and the main band gains a sortable target as soon as the cursor crosses the divider. Re-evaluate during the next dogfood cycle.

5. **`Item.docked` is not covered by the merge test suite.** Plain LWW merge handles it correctly by default, but no regression test exists. Track on the hygiene-pass follow-up list.

6. **No past-view considerations yet.** Q23 (dock rendering in read-only past view) is moot until time-navigation ships. The dock currently respects `isReadOnly` — buttons disabled — but cross-cuts with `time-navigation.md` will need to be revisited when past-view lands.

---

## Category 1 — Data Model

### Background

`Item` ([src/types.ts:8-30](src/types.ts#L8-L30)) currently has no notion of dock state. `Routine` ([src/types.ts:32-50](src/types.ts#L32-L50)) likewise.

---

1. **Where does the dock flag live — Item, Routine, or both?**

    **Open.** Three options:

    - **Item only (`Item.docked: boolean`):** the flag is per-task-instance. Each spawned routine task starts undocked; user docks it each week. Simplest data model. Annoying UX if the user always wants the same routine docked.
    - **Routine only (`Routine.dockByDefault: boolean`):** the flag is the routine's preference. Every spawned item inherits. Manual one-off tasks can't be docked (since they have no routine). Limits flexibility.
    - **Both:** `Routine.dockByDefault` sets the default for spawned items; `Item.docked` overrides per-instance. Most flexible. Also most state.

    **Lean:** **both.** The user's stated direction ("Watering, Read, Run" — all routines) suggests routines are the primary case, so routine-level default matters. But the framing was "any task" — so per-item override should also exist. Inheritance pattern matches how `notes` / `inheritedNotes` work today on Item.

2. **Field naming**

    **Open.** Candidates:

    - `docked` / `dockByDefault` — matches the user's language.
    - `isWeekSpan` / `weekSpanByDefault` — matches the section name.
    - `pinned` — overloaded with other UI conventions (sticky-to-top in lists). Avoid.

    **Lean:** `docked` / `dockByDefault`. Matches conversation; "weekSpan" is a UI label but not necessarily the right *data* field name.

3. **Default value for new routines / tasks**

    **Answer:** Undocked by default. Docking is an opt-in user action. Existing routines and items get `docked: false` / `dockByDefault: false` on migration (or just leave the field absent — undefined-is-false).

4. **Sync / merge implications**

    Coordinate with [hygiene-pass.md](hygiene-pass.md) — the new field needs to merge correctly under multi-device editing.

    **Open.** LWW per-field via the existing item-merge path should work, but:
    - If User A docks an item on device 1 and User A undocks it on device 2 simultaneously, LWW picks whichever wins by `updatedAt`. Probably fine — toggling dock is a low-stakes operation.
    - The merge code in [src/utils/mergeUtils.ts](src/utils/mergeUtils.ts) doesn't need special-casing for a plain boolean.

    **Lean:** plain LWW per-field. No special merge logic.

---

## Category 2 — Visual Treatment

### Background — what the user said

> "Appears very much in the style of tasks… just with some sense of divider between it and the other tasks. And a sense of lesser significance and need for attention because it's such a consistent part of the week."

So: **same component shape as TaskCard**, with calibration knobs for "lesser significance" + a section divider.

---

5. **What "lesser significance" looks like concretely**

    **Open.** Mix of these, to be chosen during design:

    - **Reduced opacity** (e.g., 0.7) on the whole card.
    - **Smaller card** — tighter padding, smaller font size.
    - **Muted background** — no chip backgrounds, no hover lift.
    - **No accent stripe** (if regular TaskCards have one).
    - **Compact progress display** — for multi-occurrence/time-tracked, just a small pill ("1/2", "20/45 min") instead of the full progress UI.

    **Lean:** start with **reduced padding + reduced opacity + compact progress display**. Avoid changing the card *shape* — keeping the same component minimizes design and code surface.

6. **Section divider**

    **Open.** Three styles:

    - **Hairline rule** — a `<hr>` between dock and main task list. Subtlest.
    - **Labeled section** — a small heading ("Ongoing this week") above the dock. Most explicit; also most visual chrome.
    - **Background tint** — the dock area has a subtle tinted background, no rule needed.

    **Lean:** hairline rule + maybe a tiny label below it (or above the main task list: "Tasks") — minimum chrome.

7. **Visual indicator on the card itself that it's docked**

    **Open.** When a task is in the dock, do you need an icon/badge on the card showing it's docked, or is being-in-the-dock-section visual indicator enough?

    **Lean:** section-only. Adding an icon to the card is redundant once it's in the dock.

8. **Toggle affordance — how does the user dock/undock?**

    **Open.**

    - *Right-click / context menu:* "Dock to top of week."
    - *Card menu button (⋯):* item in the existing per-task menu.
    - *Drag the card up to the dock zone:* visual but ambiguous (drag is also used for week-to-week moves).
    - *Routine settings:* set `dockByDefault` in the routine manager.

    **Lean:** **card menu (⋯) for per-item toggle** + **routine settings for the routine-level default**. Drag-to-dock is appealing but conflicts with existing drag semantics.

---

## Category 3 — Layout & Position

9. **Position within WeekSection**

    **Answer (user-confirmed):**
    ```
    [Date header — "Week 19 — May 4–10"]
    [WeekNotes]
    [WeekSpanTasks — the dock]   ← divider below
    [Tasks]
    ```
    Three vertical bands; dock sits between WeekNotes and the main task list.

    See [src/components/WeekSection.tsx](src/components/WeekSection.tsx) for current composition (currently two bands: WeekNotes + Tasks).

10. **Ordering within the dock**

    **Open.**

    - *Manual order:* user-draggable within the dock (like the main task list).
    - *Routine alphabetical:* stable, predictable.
    - *By progress completion:* most-complete at top, least at bottom. Surfaces "almost done" — but ranking flips constantly mid-week.
    - *By creation order / dock-time:* simple, no surprises.

    **Lean:** manual order (via the existing `orderIndex` field on Item). The dock is a small set; manual ordering is fine.

11. **Empty dock — render the section or hide it?**

    **Open.**

    - *Always render:* dock section is always visible, even empty, with a "Drag tasks here to dock" hint.
    - *Hide when empty:* less visual chrome; section appears only when the user has docked at least one item.

    **Lean:** hide when empty. The user has to know about the feature to use it; the empty state isn't a useful affordance.

12. **Dock size cap?**

    **Open.** What if a user docks 15 tasks?

    **Lean:** no hard cap, but visual treatment (Q5) is meant to keep each card small. If 15 tasks looks bad, that's a design problem to revisit, not a model rule.

---

## Category 4 — Interaction

13. **Can a docked task be completed normally?**

    **Answer:** Yes. Same affordances as a normal TaskCard — progress increment for multi-occurrence, time logging for time-tracked, status toggle for simple. The dock is purely a layout/visual change, not an interaction change.

14. **Drag in / out of the dock**

    **Open.**

    - *Drag within section:* yes (reorder via `orderIndex`).
    - *Drag dock → main tasks:* undocks the task (sets `docked = false`).
    - *Drag main tasks → dock:* docks the task (sets `docked = true`).
    - *Drag dock → another week:* moves the task to that week. Open: does it stay docked in the new week, or undock?

    **Lean:**
    - Reorder within dock: yes.
    - Dock ↔ main tasks via drag: yes — feels natural and avoids a hidden affordance.
    - Cross-week drag: stays docked. Dock state travels with the item.

15. **Drag from queue → dock?**

    Doc context: the routine queue redesign drags routines from queue into specific weeks. Can the user drag a queue item *directly into the dock*?

    **Open.**

    - *Yes:* drop target is the dock area; task is created already docked.
    - *No:* queue always drops into main tasks; user must then dock manually.

    **Lean:** yes, if `Routine.dockByDefault === true`, queue drag drops into dock automatically. Otherwise, drops into main tasks. Drop-into-dock-zone is also supported as a manual override.

16. **Editing the docked task — same inline editor?**

    **Answer:** Yes. The card is the same component. Inline editing, notes expansion, due date — all unchanged.

---

## Category 5 — Routine Inheritance & Per-Instance Override

17. **Inheritance rules**

    **Open.** With both `Routine.dockByDefault` and `Item.docked`:

    - When a routine spawns a task: `Item.docked = Routine.dockByDefault` at spawn time.
    - User then toggles `Item.docked` independently. The override sticks.
    - Next week's spawn: inherits from `Routine.dockByDefault` again (override doesn't propagate).

    **Lean:** "spawn-time inheritance" — same pattern as `notes`/`inheritedNotes` today. Override is per-week.

    **Open:** alternative is "sticky override" — once the user toggles dock on one spawned item, future spawns also flip. More work to implement; muddies the routine-as-template model. Skip.

18. **Routine manager UI**

    `Routine.dockByDefault` needs a control in [src/components/RoutineManager.tsx](src/components/RoutineManager.tsx) — a checkbox: "Dock to top of week by default."

    **Open.** Trivial UI work, mentioning for completeness.

19. **Toggling `Routine.dockByDefault` mid-life — what happens?**

    **Open.** Routine was created without dock; user toggles `dockByDefault = true`. Already-spawned task instances:

    - Do nothing. Existing instances keep their `Item.docked` (undefined → false). New spawns inherit the new default.
    - Bulk-update: set `Item.docked = true` for all existing spawned items.

    **Lean:** do nothing. Less surprising — the user's toggle affects *future* spawns, not retroactively. Matches how other routine fields behave.

---

## Category 6 — Carry-Over & Lifecycle

20. **Carry-over preserves docked state**

    The carry-over rule (Q20 of routine-queue-redesign): incomplete tasks auto-carry into the next week. For a docked multi-occurrence task ("Run, 1/2 complete"):

    **Answer:** Carry-over preserves `Item.docked`. If it was docked in Week A and carries to Week B, it stays docked in Week B. Mirrors how `completedCount` / `originalWeek` carry.

21. **Completion behavior — does the dock card disappear?**

    **Open.** When a docked task is fully complete:

    - *Stays in dock, shown as completed:* matches normal task behavior (completed items stay in their list, just visually marked done).
    - *Moves to main task list as completed:* explicit "I'm done with this tracker for the week."
    - *Hidden entirely:* surface-level "out of sight."

    **Lean:** stays in dock, shown as completed. Consistent with how completed normal tasks behave. The dock empties as Saturday approaches — that's a *feature*, not a bug.

22. **Routine completion — does it update `lastCompletedAt`?**

    **Answer:** Yes, no special-casing. Already covered by Q3 of routine-queue-redesign: any completion of a task with a `routineId` updates the parent routine. Dock state is irrelevant to cadence math.

---

## Category 7 — Past-View Cross-Cut

23. **Frozen rendering**

    Coordinate with Doc 2 (time-navigation, Q1). In a read-only past week, the dock section renders as it did historically:

    - WeekNotes section: read-only.
    - **Dock section: read-only.** Same disable rules as Doc 2 — no toggling docked state, no completion changes, no drag.
    - Tasks section: read-only.

    **Open:** when re-revising Doc 2 post-Doc 1, add: "Past-view rendering preserves all three section bands."

---

## Concrete Scenarios

### Scenario A — Docking "Read"

User has a routine "Read" (time-tracked, 45 min/week, weekly cadence). It auto-spawns each week into the main task list and visually demands attention even though they're chipping away at it.

User goes to routine settings, checks "Dock to top of week by default." This week's task moves up into the dock band; next week's spawn lands directly in the dock. Reading progress shows as a compact "12/45 min" pill on a quieter card.

**Question:** When the user toggles `dockByDefault` on a routine mid-week, does *this week's* spawned item move into the dock, or only future spawns? (See Q19 — lean: only future spawns.)

### Scenario B — One-off docked task

User creates a manual task: "Drink 8 glasses of water" (multi-occurrence, target 8). They click the card menu → "Dock." Card moves into the dock band, quieter rendering, same progress affordance.

**Question:** Should the option "Make this a routine" appear nearby, in case the user wants this to recur? (Probably out of scope — already a feature elsewhere.)

### Scenario C — Carry-over of a docked partial

Week A has "Run" docked, completed 1 of 2. Saturday EOD passes without the second run. Per carry-over rule, the task auto-carries to Week B. In Week B it appears:

- Still docked.
- Still showing "1/2" in the compact progress pill.
- Its `originalWeek` is set to Week A (though we've removed the chip per Doc 1).

User completes the second run on Wednesday of Week B → routine's `lastCompletedAt` updates → queue re-ranks.

**Question:** Does the carry-over feel correct, or does the user expect the dock to "reset" the count at the week boundary? (Lean: carry preserves count — matches the existing carry-over semantics.)

### Scenario D — Past-week view

User navigates back to Week 14 (April). Section bands render:

- WeekNotes — frozen.
- Dock — frozen, showing what was docked that week with whatever progress state ended.
- Tasks — frozen.

Visual treatment identical to active weeks but with disabled controls (per Doc 2 Q1).

**Question:** Is the divider between dock and tasks still visible in past view, or does it collapse when the dock is empty (Q11) for a past week?

---

## Decision Log

| # | Question | Decision | Date |
|---|----------|----------|------|
| 1 | Field location | **Shipped: `Item.docked` only.** Reversed the "both" lean — `Routine.dockByDefault` removed before ship because queue-based manual placement makes a routine-level default meaningless. | 2026-05-20 |
| 2 | Field naming | **Shipped: `docked`.** | 2026-05-20 |
| 3 | Default value | **Shipped: undocked.** Field is optional; absence treated as `false`. | 2026-05-20 |
| 4 | Merge semantics | **Shipped: plain LWW per-field via existing item merge path.** Not yet covered by `mergeUtils.test.ts` — flagged as a hygiene-pass follow-up. | 2026-05-20 |
| 5 | "Lesser significance" visual | **Partially shipped.** Bg-secondary tint, no shadow, no hover lift, drag handle hidden until hover, due-date/cadence/progress-text chips suppressed, notes hidden unless editing. Style is intentionally unfinished pending a single design pass. | 2026-05-20 |
| 6 | Section divider | **Shipped: hairline.** Becomes a soft 2px ~45% indigo when cursor is near the boundary during drag. | 2026-05-20 |
| 7 | Per-card "docked" indicator | **Shipped: none.** Section position is the indicator. | 2026-05-20 |
| 8 | Dock/undock affordance | **Shipped: drag-and-drop only.** Reversed from the card-menu lean. Briefly shipped `↑/↓` arrow buttons; removed once drag-and-drop replaced them. | 2026-05-20 |
| 9 | Position | **Shipped: WeekNotes → Dock → Main.** | 2026-05-20 |
| 10 | Ordering within dock | **Shipped: manual via `orderIndex`** within the dock's own SortableContext. | 2026-05-20 |
| 11 | Empty state | **Shipped: hidden when no docked items AND no drag in progress.** During drag, empty dock expands to ~32px so it remains a targetable drop zone. | 2026-05-20 |
| 12 | Size cap | **Shipped: none.** Will revisit if 15+ docked tasks creates a real layout problem. | 2026-05-20 |
| 13 | Completion semantics | **Shipped: identical to normal tasks.** | 2026-05-20 |
| 14 | Drag in/out of dock | **Shipped + overhauled.** Single `SortableContext` per week with a sortable-but-non-draggable divider pseudo-item (`${week}:divider`). dnd-kit's vertical strategy shifts the divider with adjacent items, so items can't visually cross it during drag. On drop, the active item's band is determined by its position relative to the divider in the post-`arrayMove` order. Cross-week drag preserves dock intent based on what the cursor was over. | 2026-05-22 |
| 15 | Queue → dock direct drop | **N/A — removed with `Routine.dockByDefault`.** User can manually drag the spawned task into the dock once it lands in main. | 2026-05-20 |
| 16 | Inline editing | **Shipped: unchanged.** Edit mode reveals notes the same way as on regular cards. | 2026-05-20 |
| 17 | Spawn-time inheritance | **N/A — removed with `Routine.dockByDefault`.** | 2026-05-20 |
| 18 | RoutineManager UI | **N/A — removed with `Routine.dockByDefault`.** Briefly shipped a checkbox; removed. | 2026-05-20 |
| 19 | Mid-life `dockByDefault` toggle | **N/A — removed with `Routine.dockByDefault`.** | 2026-05-20 |
| 20 | Carry-over preserves dock state | **Shipped automatically.** `Item.docked` is a regular field, so existing rollover preserves it without special-casing. Not yet end-to-end tested across a week boundary in practice. | 2026-05-20 |
| 21 | Completion behavior | **Shipped: stays in dock, marked complete.** | 2026-05-20 |
| 22 | `lastCompletedAt` updates | **Shipped: no special-casing.** Already covered by routine-queue-redesign Q3. | 2026-05-20 |
| 23 | Past-view rendering | **Deferred.** No past-view exists yet. The dock respects `isReadOnly` — interactions disabled — but the cross-cut with [time-navigation.md](time-navigation.md) Q1 still needs to be wired through when past-view ships. | 2026-05-20 |
| 24 | Mid-drag band switching ("gap at destination") | **Resolved 2026-05-22 via a different architecture.** The dock-band update during drag was abandoned in favor of restructuring WeekSection to a single `SortableContext` containing a sortable-but-non-draggable divider. dnd-kit now opens the destination gap naturally through its existing strategy, with zero mid-drag store mutations. | 2026-05-22 |

---

## Handoff Note

Dock feature is functionally complete as of 2026-05-22. The drag/drop architecture went through two iterations — see Q14 and Q24 in the Decision Log for details.

**Iteration 1 (2026-05-20):** two `SortableContext`s per week (`${week}:dock` and `${week}`). Worked for clean band separation, but couldn't open a gap at the destination band during cross-band drag, and an attempted fix (mid-drag `updateItem` in `handleDragOver`) triggered a `measureRect` infinite loop.

**Iteration 2 (2026-05-22) — current:** single `SortableContext` per week with a sortable-but-non-draggable divider pseudo-item between docked and main items. dnd-kit's `verticalListSortingStrategy` shifts the divider alongside its neighbors, so the boundary moves with the items and no item ever visually crosses it. On drop, classification uses `arrayMove` on the sortable order — the active's position relative to the divider in the post-move array is authoritative. No mid-drag store mutations, no measurement loops, no cursor-rect arithmetic.

**What's still open:**
1. **Style refinement.** Deliberately deferred to a single design pass after more features land.
2. **`Item.docked` regression tests in `mergeUtils.test.ts`.** Flagged on the hygiene-pass follow-up list (see that doc's "What's still open").
3. **Past-view dock rendering (Q23).** Held until [time-navigation.md](time-navigation.md) ships.

**Coordinates with:**
- **[hygiene-pass.md](hygiene-pass.md)** — `Item.docked` rides the same LWW path as other Item fields. Add to the next merge-test pass.
- **[time-navigation.md](time-navigation.md)** — past-view "frozen" rule (Q1 there) needs to extend to the dock band; revisit when that doc moves to implementation. The single-SortableContext-plus-divider pattern carries forward cleanly under any rendered-week-count change.
- **Independent of:** [calendar-protocols-and-horizon.md](calendar-protocols-and-horizon.md). Dock is purely a within-week concern.
