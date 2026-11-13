# Time Navigation — Past History & Future Weeks/Months

**Status:** Pre-implementation / Vetting
**Pending:** Findings from [hygiene-pass.md](hygiene-pass.md) (Doc 1)
**Date:** 2026-05-11

## The Idea

The app's UI center of gravity has shifted to "current week + the next week or two." This creates two unresolved time-navigation questions:

1. **Past:** the user wants a read-only view of past weeks — "navigate past weeks and what was done." Same UI, frozen. No edits, no analytics.
2. **Future:** weeks more than ~2 ahead deserve a different surface — possibly a month view or something more "calendary." The week-by-week strip is awkward when planning months out.

These cluster because both are about *navigating time beyond the current 1–2 week window*. Scoping them in isolation risks designing two competing time-navigation surfaces. Together they force a unified mental model.

**MUST re-assess after Doc 1.** If sync turns out to be structurally broken, the data shown in past/future views may not be trustworthy. Also coordinates with [calendar-protocols-and-horizon.md](calendar-protocols-and-horizon.md) (Doc 3) — imported external events change what month view has to render.

---

## Category 1 — Past Navigation (Read-Only History)

### Background

[src/components/WeekNav.tsx](src/components/WeekNav.tsx) lets the user navigate freely between weeks. Past weeks are currently fully interactive — items can be completed, edited, dragged. The user wants this to become **frozen**: viewable, not editable.

The data already exists. Items, WeekNotes, and completion timestamps are persisted per-week — nothing new to capture, only new presentation rules.

---

1. **What does "frozen" mean exactly?**

    **Answer (user-confirmed):** Same UI, just frozen. Read-only render of the existing [WeekSection.tsx](src/components/WeekSection.tsx).

    **Open sub-rules:**

    - *Inline edit (title, notes, due date):* disabled.
    - *Drag/drop:* disabled in both directions — nothing leaves past weeks, nothing drops into them.
    - *Status toggle (complete/uncomplete):* almost certainly disabled. Toggling a past completion would retroactively shift `lastCompletedAt` on the parent routine and re-rank the queue — bad.
    - *Soft actions (expand notes, view due-date chip, view routine cadence chip):* enabled. Purely informational.
    - *Adding new items to a past week:* disabled.
    - *Archive button:* open. Lean disabled — archiving is a mutation.

2. **How far back can the user navigate?**

    **Open.** Coupled to Doc 3's horizon decision.

    - *All available data:* navigate as far back as items exist in the DB. Cheapest. Lean.
    - *Capped (12 / 26 / 52 weeks):* arbitrary, predictable.
    - *Lazy-load on scroll:* complex but unlimited.

    **Lean:** all available data, with a "jump to date" affordance for fast travel. DB is small (better-sqlite3), client AppState is the only constraint and isn't large today.

3. **Today as a boundary**

    The current week is partially in the past (Wednesday means Sun–Tue are already history). Question: does "frozen" apply *per-day within the current week*?

    **Answer:** No. The mental model is *week-level*, not day-level. The current week stays fully editable; only weeks strictly before the current one are frozen. Simpler rule, no edge cases at the day boundary.

4. **WeekNotes — frozen too?**

    **Answer:** Yes, same rule. Past WeekNotes are visible but not editable. Becomes relevant for Doc 3: if external calendar imports drop WeekNotes into past weeks, they're informational only.

5. **Visual differentiation**

    **Open.**

    - *Identical:* minimal change; affordance is "the controls are gone." Cleanest, matches user's "same UI, just frozen."
    - *Muted (desaturated colors, slight opacity drop):* a clear "this is history" signal without being heavy-handed.
    - *Banner ("Read-only — past week"):* explicit but adds visual chrome.

    **Lean:** identical with disabled controls, matching the user's stated preference. Revisit if it feels confusing in dogfood.

6. **What happens if the user uses keyboard shortcuts or other paths to mutate past data?**

    **Open.** The disable-by-mode-flag must propagate to *every* mutation path:

    - The store actions in [src/store/store.ts](src/store/store.ts) check the target week's age and refuse mutations? *Cleanest* but invasive.
    - The UI just hides/disables controls? *Simpler* but leakable (e.g., keyboard shortcuts, future MCP/agent tools).

    **Lean:** enforce in the store. UI removes affordances *and* the store rejects mutations to past weeks. Two layers of defense.

---

## Category 2 — Future Weeks UI Rethink

### Background

Today, navigating to a week 10 ahead shows the same [WeekSection.tsx](src/components/WeekSection.tsx) as the current week, mostly empty. The user finds this awkward — wants something more "calendary" for distant planning.

---

7. **What specifically is wrong with the current future-week view?**

    **Open.** Need to articulate the failure mode(s) before designing a solution:

    - **Empty space:** most future weeks are nearly empty; the render feels pointless.
    - **Granularity mismatch:** planning months out happens at month- or quarter-level, not week-level.
    - **Discoverability:** scanning many weeks looking for one event is awkward in single-week view.
    - **Queue is missing:** the surfacing rule (N=14 days) means routines never appear in week 10 ahead. Future weeks are *only* WeekNotes + manually-placed tasks.
    - **No event density signal:** can't tell from the week list which weeks have anything in them.

    Decision needed from the user: which of these are the real pain points?

8. **What does "month view" mean here?**

    **Open.** Three candidate models:

    - **Calendar grid (Google Calendar-style):** 7 columns × ~5 rows of day cells. Best for date-stamped events (WeekNotes with `dateISO`, future imported VEVENTs). Worst for week-bound tasks (which have no specific day).
    - **Week stack:** 4–6 weeks listed vertically in compact "summary" form (counts per week). A telescoped version of the current view.
    - **Agenda list:** all upcoming dated items in a single chronological scroll. No grid.

    **Lean:** depends entirely on Q7 — different pain points map to different solutions. If "empty space" is the issue, week-stack with counts. If "I want to see a date in context," calendar grid. If "what events do I have coming up," agenda list.

9. **When does month view kick in?**

    **Open.**

    - **Always-available toggle:** separate "Month" mode user opts into. Predictable, no surprises.
    - **Range-based:** week-by-week for the first N weeks, auto-switch to month view beyond. Clever but fights muscle memory.
    - **Scroll-zoom:** smooth transition as user scrolls forward, like macOS Calendar. Beautiful but complex.

    **Lean:** toggle. Most predictable, simplest to build, doesn't fight the user.

10. **How does the queue interact with month view?**

    The queue is forward-looking by ~14 days from *real* now. When the user is viewing month 6 ahead, what does the queue show?

    **Answer:** Queue stays anchored to real now, not the viewed month. The queue answers "what should I be doing soon" — a separate channel from "what's scheduled in this distant window." The two coexist; the queue panel doesn't change as the user navigates.

11. **Dragging from queue into a far-future week**

    **Answer:** Unchanged mechanic. The Q18 projection from the routine queue redesign handles "task is in Week X" regardless of how far X is from now. Whether the target week is rendered as a single-week section or a cell in a month grid is a presentation detail; the data path is identical.

---

## Category 3 — Shared Primitives

12. **One grid component or two?**

    Past view and future month view both need some kind of multi-week or month rendering.

    **Open.**

    - **One component, two modes:** parameterize by `mode: 'past' | 'future'`. DRY. Risk: the modes diverge in interaction model (frozen vs. fully interactive), forcing conditionals everywhere.
    - **Two components:** `PastWeekView` (read-only, simple list) and `MonthView` (interactive grid). More files, each simpler.

    **Lean:** two components. The interaction surface is different enough that one component breeds conditionals.

13. **WeekNav rework**

    [src/components/WeekNav.tsx](src/components/WeekNav.tsx) is today's week-picker. It likely needs:

    - A "jump to date" affordance (for fast past navigation).
    - A view-mode toggle (week / month) — see Q9.
    - Awareness of "currently viewing past" vs "currently viewing future planning" — affects which controls show.

    **Open.** May grow into a "Calendar navigation toolbar" component. Defer concrete design until Q12 lands.

14. **`JumpToToday` interaction**

    [src/components/JumpToToday.tsx](src/components/JumpToToday.tsx) exists today. As the user navigates further afield (3 years back, or month-view in 2029), does jumping back to today still mean "current week in single-week view," or does it preserve the current view mode?

    **Lean:** always reset to single-week current view. "Take me home" should be unambiguous.

---

## Concrete Scenarios

### Scenario A — Reviewing last month

Today is May 11, 2026. User wants to see what they accomplished in April. They click "back" in WeekNav 4 times, landing on 2026-W14. The WeekSection renders identically to today, but every interactive control is disabled — they can scroll, expand notes, see what was completed and when, but cannot change anything.

**Question:** Does the user want this *per-week scrolling*, or a single "month overview" surface that summarizes April in one screen? (The former matches "same UI, just frozen." The latter is a richer affordance.)

### Scenario B — Planning a trip in October

Today is May 11. User wants to add WeekNotes for a trip in October (week ~40). They click forward many times. At some point — explicit toggle? auto-switch? — the UI shows October as a month view. They tap October 15, add a WeekNote ("Flight: SFO → LHR").

**Question:** What does the month view actually look like, and where does the WeekNote land in the data model? (See Doc 3 for the data side.)

### Scenario C — Mixed: viewing this week while glancing at Q3

User has the current week open. They want to glance at Q3 to check if a date is free. Do they:

- Click "month view" and the main view changes (loses current-week context)?
- Open a popover/sidebar with the month view (two surfaces simultaneously)?
- Navigate via a separate Calendar page (full mode switch)?

**Question:** Is time navigation a *replacement* surface (mode switch) or a *secondary* surface (popover)?

### Scenario D — A user "carries" a task for 8 weeks

Per the routine queue redesign carry-over rule, an incomplete task just keeps following the user forward. After 8 weeks of being carried, with the `↻ Last week` chip removed (Doc 1), the only signal that this task is old is its absence from a "completed-recently" set.

**Question:** Should the past-week view show this task in the week it was *originally* scheduled (its first appearance), in the week it currently lives (today), or in every week it was carried through? This is a real ambiguity for the read-only history.

---

## Decision Log

| # | Question | Decision | Date |
|---|----------|----------|------|
| 1 | "Frozen" = read-only render, same UI | Confirmed. Sub-rules (status toggle, archive, keyboard) lean disabled; some open. | 2026-05-11 |
| 2 | How far back to navigate | Lean all available. Coordinates with Doc 3 horizon decision. | 2026-05-11 |
| 3 | Current-week boundary | Week-level. Frozen only applies to strictly past weeks. | 2026-05-11 |
| 4 | Past WeekNotes frozen too | Yes. | 2026-05-11 |
| 5 | Visual differentiation | Lean identical-with-disabled-controls. Open. | 2026-05-11 |
| 6 | Where to enforce read-only | Both UI *and* store. Two layers of defense. | 2026-05-11 |
| 7 | What's wrong with current future-week view | Open — needs user articulation. | 2026-05-11 |
| 8 | What "month view" means | Open. Three candidates. Depends on Q7. | 2026-05-11 |
| 9 | When month view kicks in | Lean explicit toggle. Open. | 2026-05-11 |
| 10 | Queue behavior in month view | Queue stays anchored to real now. | 2026-05-11 |
| 11 | Drag from queue to far-future week | Unchanged mechanic. | 2026-05-11 |
| 12 | One grid component or two | Lean two. Open. | 2026-05-11 |
| 13 | WeekNav rework | Open. Defer until Q12. | 2026-05-11 |
| 14 | `JumpToToday` semantics | Always resets to single-week current view. | 2026-05-11 |

---

## Handoff Note

This document is provisional pending:

1. **[hygiene-pass.md](hygiene-pass.md)** — if sync is structurally broken, past-view reliability is suspect (you'd be rendering "history" that's actually corrupted). Q1-style read-only enforcement only matters if the underlying data is trustworthy.
2. **[calendar-protocols-and-horizon.md](calendar-protocols-and-horizon.md)** — the horizon question and ICS import decisions reshape what future navigation needs to support. A CalDAV pull of 200 events into the next 6 months changes the calculus for Q8 (month view shape).

After Doc 1 closes, revise this doc with:
- Which Q's are actually load-bearing (some may have been overtaken by sync findings).
- Any new constraints from sync work (e.g., if `updatedAt` becomes server-stamped, mutation-rejection in past-view becomes simpler).
- Coordinated answers with Doc 3 — particularly Q2 (horizon) and Q8 (month-view shape vs. imported event density).
