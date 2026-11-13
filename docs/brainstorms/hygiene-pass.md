# Hygiene Pass — Stale Labels & Sync Regression

**Status:** Shipped 2026-05-11 — commits `129346a` (chip removal) and `437a4d3` (sync fixes + tests)
**Date:** 2026-05-11

## The Idea

Two cleanup tasks bundled because both are "fix what's wrong before adding more surface area":

1. Remove the "Last week / Last month" stale-label design on task cards. The current chip reads as *"you decided to do it, but then didn't"* — a passive nudge that conflicts with the user's preferred framing. Optional replacement (a neutral "last done X days ago" chip, mirroring the queue) is **out of scope** for this pass.
2. Investigate and fix the multi-device sync regression. Opening the same app on different computers throws data out of sync — non-negotiable to fix before more work invites more divergence.

**Sequencing within this doc:** stale-label removal is trivial and unblocked. Sync regression is *investigation-first*; the scope of the fix depends entirely on what reproduction reveals. Honest sizing: this is **not** automatically a light pass.

---

## Category 1 — Stale Label Removal

### Background

The `↻ Last week` / `↻ Last month` chip on incomplete tasks renders in [src/components/TaskCard.tsx:403-407](src/components/TaskCard.tsx#L403-L407):

```tsx
{item.originalWeek && !isArchived && (
    <span className="chip rolled-over" title={`Originally scheduled for ${item.originalWeek}`}>
        ↻ {relativeLabel(item.originalWeek, presentWeek)}
    </span>
)}
```

The chip is driven by `Item.originalWeek` (set on auto-rollover from a past week — see [src/utils/rolloverUtils.ts](src/utils/rolloverUtils.ts)). The carry-over rule from the routine queue redesign (Q20) preserves `originalWeek` across week boundaries indefinitely — making this chip much more visible on tasks that have been carrying for weeks.

---

1. **Remove the chip entirely?**

    **Answer:** Yes. The user finds the design passive-aggressive. Delete the JSX block above. CSS for `.chip.rolled-over` in [src/styles/](src/styles/) becomes dead code; remove that too.

2. **Keep `originalWeek` on `Item`?**

    **Answer:** Keep the data, drop only the UI. Reasons:
    - Cheap to keep (one optional field on Item).
    - Useful for a future "last done X days ago" chip if/when the user opts back in.
    - Useful for analytics/debugging.
    - Removing requires a migration that's pure cost.

    **Open:** none — call it kept unless something forces our hand.

3. **Replacement chip ("last done N days ago") in scope?**

    **Answer:** No. User explicitly framed it as a *maybe-future* addition ("If I feel I want some stress, I'll add a similar text…"). Park it. If/when added, it mirrors the queue's day-since-last presentation for consistency.

---

## Category 2 — Multi-Device Sync Regression

### Background — what sync looks like today

Sync is **custom**, not a library:

- Client orchestration in [src/store/store.ts](src/store/store.ts) (1170 lines — sync is one section among many).
- Pull/push via [src/api/client.ts](src/api/client.ts).
- Merge entirely client-side in [src/utils/mergeUtils.ts](src/utils/mergeUtils.ts) — Last-Write-Wins per-entity with custom `Math.max` for counter fields (`completedCount`, `minutes`).
- Server: Express + better-sqlite3, single-process. Endpoints in [server/routes.ts](server/routes.ts).
- UI surface: [src/components/SyncIndicator.tsx](src/components/SyncIndicator.tsx).

Current merge contract (extracted from [mergeUtils.ts:1-72](src/utils/mergeUtils.ts#L1-L72)):
- Items: LWW per id by `updatedAt`, with `Math.max` for `completedCount` and `minutes`, and a re-evaluation of `status` based on merged counters.
- Routines / Collections / CollectionItems / WeekNotes: LWW per id by `updatedAt`.
- Root settings (`currentTime`, `allowUncomplete`, `userTimezone`, `dataVersion`, etc.): **remote wins** by default (`...remote` spread first), except `allowUncomplete` and `currentTime` which are explicitly preserved local.

---

4. **Reproduction — what's the actual bug?**

    **Resolved without a clean live repro.** Surfaces in play: Arc (Chromium) on three accounts — personal Mac, work Mac, Android. Symptom: opening the app on device B after device A has been the active one for a while → recent changes on A (completes, archives) appear undone on B.

    Attempted forensic diff: pulled `task-list-storage` localStorage from device A and compared one item ("Clear old mac") against server `/api/data`. Both `updatedAt` values matched (`1778544344946`), and the next `GET /api/data` returned 304 — meaning local `dataVersion: 2781` matched server. So at the moment of inspection, device A and server were aligned — eliminating "all pushes silently dropped" as a blanket explanation.

    The specific reverted item the user could name ("Clean stairs") had already been re-marked complete before we could diff its state, so no smoking-gun comparison was possible.

    **What we did instead:** code review of the three sync paths against the symptom shape produced three confirmed bugs (Q5). Fix scope was bounded enough that we shipped all three without further reproduction.

5. **Hypothesis list — where to look first**

    Starting hypotheses, ordered by perceived likelihood:

    - **H1 (state-ordering):** the client pulls remote *after* a local edit but *before* the local edit has been persisted to the server, and the LWW merge picks the older remote value. Likely culprit if the bug shows up on reload-after-edit.
    - **H2 (remote-wins for root):** the `...remote` spread on AppState root means any root-level setting (timezone, `dataVersion`, `lastRolledWeek`, the new `routineProposalsMigrationV1Done` / `routineProposalsMigrationV2Done` flags) silently loses on the side that synced last. Likely culprit if migration flags or timezone are involved.
    - **H3 (counter max-wins regression):** `Math.max(local, remote)` for `completedCount`/`minutes` means *uncompleting* a multi-occurrence task on one device is silently undone by the other device's higher counter. Likely culprit if uncomplete actions don't stick.
    - **H4 (deletion handling):** soft-delete via `deletedAt` — if one device deletes and another edits, LWW picks the more recent `updatedAt`; an "edit after delete" could un-delete.
    - **H5 (clock skew):** `updatedAt` is set client-side. If two devices have skewed clocks, LWW picks the wrong winner deterministically (worst case: one device always "wins" regardless of actual order).

    **Resolved:** three confirmed-by-code-review bugs landed in `437a4d3`:

    - **H1 variant (412 retry path doesn't re-push):** the conflict path at [store.ts:147-167](../../src/store/store.ts#L147-L167) called `mergeState` and updated local state but never re-pushed the merged result. Any conflict silently dropped the loser's edit until an unrelated subsequent edit happened to trigger another sync. **Deterministic on conflict.** Likely primary cause given 3 active devices.
    - **H6 (new — debounce + no flush-on-unload):** [store.ts:175](../../src/store/store.ts#L175) debounces `triggerSync` 1s; no `beforeunload`/`pagehide`/`visibilitychange` handler existed to flush a pending push. Any edit made within ~1s of tab close / app background was lost. **Probabilistic** but plausible given users do close tabs reflexively after marking something done.
    - **H3 (counter max-wins):** confirmed real. `uncompleteItem` didn't reset `completedCount`/`minutes`, and `mergeUtils` did pure `Math.max`. Together: uncompleting a multi-occurrence task on device A is silently revived if device B has a higher count + isGoalMet re-flips status. Direction is opposite of the user's reported symptom (this bug does undone→done, not done→undone), but real and fixed in this pass.

    **Not investigated / not fixed:**
    - **H2:** root remote-wins for migration flags. No evidence either way; left alone.
    - **H4:** deletion resurrection. Merge code looks correct on reading; no evidence of failure.
    - **H5:** client clock skew. Punted to Q9. Latent risk if clocks drift; unaddressed.

6. **Categorize the bug class**

    Once reproduced, the bug falls into one of these buckets — fix scope differs by an order of magnitude:

    - **State-ordering bug** (light, hours): client-side push/pull ordering issue. Fix is a guard or a reorder.
    - **Merge correctness bug** (medium, day): LWW rule is wrong for some specific entity field. Fix is localized; needs a regression test.
    - **Push/pull cadence bug** (medium, day): writes are batched/debounced such that fast device-switching loses in-flight changes. Fix is a queue/flush rework.
    - **Structural model-level bug** (heavy, weeks): LWW is fundamentally wrong for this app's semantics. Fix is a real rethink — per-field LWW, operational transforms, or CRDTs.

    **Resolved: mixed — primarily state-ordering + push-cadence, with one merge correctness issue.** All three landed in a single ~265 LOC commit in a single session:
    - State-ordering: 412 retry re-push (Bug 1).
    - Push-cadence: flush-on-unload (Bug 2).
    - Merge correctness: counter-reset honoring (Bug 3).

    Avoided the structural rethink. If symptom recurs post-fix, that's when CRDT / per-field timestamps go on the table.

7. **Scope of the fix**

    Two stopping criteria proposals:

    - **Narrow:** fix the specific reproduction, add a regression test, ship. Pros: fast, focused. Cons: leaves nearby latent bugs.
    - **Broad:** while we're in the merge code, audit every entity class against "what should happen if A and B both edit X in different ways?" — even for cases not currently reported. Pros: hardens fragile code. Cons: scope creep.

    **Resolved: narrow-plus.** Shipped fixes for the three confirmed bugs (slightly wider than "just the reported revert") but explicitly skipped a broader audit of routine/collection/weekNote merge semantics, root-settings remote-wins, and the H5 server-stamp question. Those remain available as follow-ups.

8. **Add merge tests?**

    **Resolved: yes, in this pass.** [src/utils/mergeUtils.test.ts](../../src/utils/mergeUtils.test.ts) added — 16 tests covering:
    - Per-item LWW (newer wins, both directions; remote-only / local-only adoption).
    - Counter merge: max-wins for concurrent increments, explicit-reset honor (H3 regression).
    - Deletion semantics: remote-delete-wins, local-delete-preserved, resurrection-on-newer-edit.
    - Root settings: remote-wins for `userTimezone`; local-wins for `currentTime` and `allowUncomplete`.
    - Week-key sanitization: invalid weeks dropped, `ideas` preserved.

    These are the *first* tests on `mergeUtils.ts`. Adjacent files (`routineSpawner`, `collectionSpawner`, `rolloverUtils`) still have no merge tests; not a regression but worth flagging.

9. **Decide on `updatedAt` source: client or server?**

    Out-of-band observation while writing this doc: `updatedAt` is set client-side in `mergeEntities`. This makes the LWW outcome dependent on client clocks. A common fix in custom-sync systems is to **stamp `updatedAt` server-side on write** — eliminates clock-skew (H5) at the cost of needing to refresh the client copy after each write.

    **Resolved: punted.** Three modern devices on NTP are unlikely to skew enough to matter in practice, and the other three fixes plausibly address the reported symptom. If symptoms recur in a way consistent with H5 (e.g., one device's writes *always* losing), revisit. Server-stamp is a non-trivial refactor — touches every push path, every merge, and the persistence model.

---

## Concrete Scenarios to Reproduce Against

*Not filled in — no clean live repro was captured before fixes landed (see Q4). Left in place as a template for the next pass if symptoms recur.*

### Scenario A — Edit-then-reload on same machine, different tabs

*Recipe:* TBD
*Expected:* TBD
*Actual:* TBD

### Scenario B — Edit-on-A, edit-on-B, reload-A

*Recipe:* TBD
*Expected:* TBD
*Actual:* TBD

### Scenario C — Offline edit, reconnect

*Recipe:* TBD
*Expected:* TBD
*Actual:* TBD

### Scenario D — Migration flag (`routineProposalsMigrationV*Done`) under sync

*Recipe:* TBD — particularly relevant given the recent migration work and that root-level booleans are remote-wins.
*Expected:* TBD
*Actual:* TBD

---

## Decision Log

| # | Question | Decision | Date |
|---|----------|----------|------|
| 1 | Remove `↻` rolled-over chip | **Shipped** in `129346a`. JSX + CSS deleted from [TaskCard.tsx](../../src/components/TaskCard.tsx), [index.css](../../src/index.css), [themes.css](../../src/styles/themes.css) (default + scrapbook). | 2026-05-11 |
| 2 | Keep `originalWeek` on Item | **Shipped** — data preserved on Item, UI removed. | 2026-05-11 |
| 3 | "Last done" replacement chip | Out of scope for this pass. Still open. | 2026-05-11 |
| 4 | Sync regression repro | **Closed without clean repro.** Forensic diff at point-in-time showed device A and server aligned; reverted item ("Clean stairs") was re-marked before we could diff. Shipped fixes from code review instead. | 2026-05-11 |
| 5 | Hypothesis list | **Closed.** H1 variant + new H6 (debounce/no-flush) + H3 confirmed and fixed in `437a4d3`. H2, H4, H5 not investigated. | 2026-05-11 |
| 6 | Bug class | **Closed: state-ordering + push-cadence + one merge-correctness** (mixed-light/medium). Structural rethink avoided. | 2026-05-11 |
| 7 | Fix scope | **Closed: narrow-plus.** Three confirmed bugs shipped together. Broader audit deferred. | 2026-05-11 |
| 8 | Add merge tests | **Shipped.** 16 tests in [mergeUtils.test.ts](../../src/utils/mergeUtils.test.ts) — first tests on that file. | 2026-05-11 |
| 9 | Server-stamped `updatedAt` | **Punted.** Latent H5 risk acknowledged; revisit only if symptoms recur consistent with clock skew. | 2026-05-11 |

---

## Handoff Note

Shipped in two commits on 2026-05-11:

- `129346a` — chip removal (Track 1).
- `437a4d3` — sync fixes + tests (Track 2).

Pushed to `origin/main`. Pi redeploy pending.

**What shipped:**

- Removed the `↻ Last week / Last month` chip from task cards. `originalWeek` data preserved.
- Fixed 412 conflict path to re-push after merge (was silently dropping the loser's edit).
- Added `flushSync` action wired to `pagehide` + `visibilitychange` so the 1s debounce can't eat edits made just before tab close. Uses `keepalive: true` so the request survives page teardown.
- `uncompleteItem` now resets `completedCount` / `minutes` when present.
- `mergeUtils` counter merge now honors an explicit reset (newer side at 0 with status=incomplete) instead of pure `Math.max`-reviving. Concurrent-increment max-wins still preserved for non-reset cases.
- 16 tests added covering LWW, counter merge (including H3 regression), deletion, root settings, week-key sanitization.

**What's still open:**

- **No live repro captured.** Symptom observation is the only way to confirm the fix actually addresses what the user saw. If the bug recurs, capture localStorage + `/api/data` *before* re-marking anything.
- **H2, H4, H5 not investigated.** Root remote-wins for migration flags, deletion-resurrection edge cases, and client-stamped `updatedAt` clock-skew are all latent risks.
- **No tests on adjacent merge-adjacent code** (`routineSpawner`, `collectionSpawner`, `rolloverUtils`). Not a regression; flagged for future hardening.
- **A possible "last done N days ago" replacement chip** (Q3) is parked, pending user signal that they want it.
- **New: `Item.docked` field (added 2026-05-20 with the [weekly-trackers-dock](weekly-trackers-dock.md) feature)** is not covered by `mergeUtils.test.ts`. Plain LWW handles it correctly by default, but a regression test belongs in the next merge-test pass — especially for the "user docks on device A, undocks on device B" race.

**Downstream docs to revisit:**

- [time-navigation.md](time-navigation.md) and [calendar-protocols-and-horizon.md](calendar-protocols-and-horizon.md) — both were deferred pending this pass. Sync semantics are now slightly stronger (no silent edit loss on conflict or unload, no counter resurrection) but not fundamentally rearchitected. Past-view reliability and CalDAV write semantics decisions can proceed on the assumption that LWW-with-debounce-and-flush is the contract going forward.
