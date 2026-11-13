# Calendar Protocols & Horizon — Becoming a Real Calendar

**Status:** Pre-implementation / Vetting
**Pending:** [hygiene-pass.md](hygiene-pass.md) (Doc 1) + coordination with [time-navigation.md](time-navigation.md) (Doc 2)
**Date:** 2026-05-11

## The Idea

The app is shifting from "weekly task list" to "weekly task list *plus* a real calendar." Two interlocked threads:

1. **Protocol interop** — start with **ICS file import/export** (single event, date range, or whole calendar). Grow into **CalDAV** bidirectional sync with Nextcloud as a *separate, later* milestone.
2. **Horizon expansion** — the 12-month limit no longer fits a calendar app. Adopt the conventional model: events are stored as date-stamped rows; the UI lazily renders the visible window. No hard horizon.

These cluster because they're tightly coupled: CalDAV/ICS imports will pull events well past 12 months, which forces the horizon to expand. Doing protocol interop without resolving horizon means importing a 2029 event into a system that can't hold it.

**Phase split is load-bearing:**
- **Phase 1 (this brainstorm's primary scope):** ICS files + horizon + owner identity.
- **Phase 2 (separately scoped milestone):** CalDAV. Sketched in Cat 4 so we know what we're *not* committing to yet.

**MUST re-assess after Doc 1 and Doc 2.** Sync regressions affect bidirectional protocols. Time-navigation UI dictates where imported events become visible.

---

## Category 1 — What's a "Calendar Item" for Protocol Purposes?

### Background — current data model

Three entities in the app have "date" semantics:

- **WeekNote** ([src/types.ts:112-122](src/types.ts#L112-L122)) — has `dateISO`, optional `notes`. Renders at top of week. Often spawned from a `CollectionItem` (annual recurrences: birthdays, holidays).
- **Item with `dueDateISO`** ([src/types.ts:17-18](src/types.ts#L17-L18)) — a task with a deadline.
- **Item without `dueDateISO`** — week-bound only, no specific date.

---

1. **Which entities export to ICS?**

    **Answers (user-confirmed):**

    - **WeekNote → VEVENT:** *yes, canonical.* These are date-stamped, calendar-shaped, and what the user explicitly wants in Nextcloud.
    - **Item with `dueDateISO`:** *maybe.* User leaned "probably not but maybe." Held open.
    - **Item without `dueDateISO`:** *never.* Confirmed — week-bound tasks have no ICS semantics.

2. **WeekNote → VEVENT field mapping**

    **Provisional mapping:**

    | WeekNote field | ICS field | Notes |
    |---|---|---|
    | `title` | `SUMMARY` | Direct. |
    | `dateISO` | `DTSTART` / `DTEND` | All-day event by default. |
    | `notes` | `DESCRIPTION` | Direct. |
    | `id` | `UID` | Must be globally unique. Prefix with a domain/app-id namespace (e.g., `<uuid>@tasks.example.com`). |
    | `updatedAt` | `LAST-MODIFIED` + `DTSTAMP` | Direct (epoch → ICS datetime). |
    | `collectionItemId` | `RRULE` or N/A | See Q5. |

    **Open:**
    - Do we ever export *timed* events (with hours), or always all-day? WeekNote's `dateISO` is currently date-only.
    - `ORGANIZER` field — depends on calendar identity (Cat 2).

3. **If `dueDateISO` Items export, what shape?**

    **Open, contingent on Q1 resolution.**

    - **VTODO** — semantically correct (it's a task with a deadline). Weakly supported by Nextcloud/Apple Calendar; some clients ignore VTODO entirely.
    - **VEVENT** — universal support, but semantically wrong ("Pay rent by 5/15" isn't an event, it's a deadline).
    - **Don't export** — user lean. Avoid the semantic mismatch; tasks stay internal.

    **Lean:** don't export in phase 1. Revisit if the user explicitly wants their deadlines on their phone calendar. Easier to add later than to remove.

4. **Imported events land where?**

    **Open.** Three options:

    - **WeekNotes (phase 1):** simplest. Incoming VEVENT becomes a WeekNote in whichever week its `DTSTART` falls in. Inherits existing UI.
    - **New entity `CalendarEvent` (phase 2+):** semantically richer — imported items carry `location`, `organizer`, `attendees`, RSVP state. Different icon, separate management UI.
    - **Hybrid:** WeekNotes gain optional fields (`location`, `organizer`, `attendees`) when imported.

    **Lean:** WeekNotes for phase 1 with a minimal field extension (`location` optional). Defer the full `CalendarEvent` entity to phase 2 when CalDAV brings RSVP/scheduling semantics that WeekNotes can't fake.

5. **Recurring events**

    ICS uses `RRULE` for recurrence (e.g., `RRULE:FREQ=YEARLY;BYMONTH=12;BYMONTHDAY=25`). The app already has a recurrence model: `CollectionItem` (which spawns `WeekNote`s).

    **Open:**

    - **Export:** if a WeekNote was spawned from a `CollectionItem` ("Christmas, annually"), do we export the *occurrence* (a one-off VEVENT) or the *series* (a single VEVENT with `RRULE`)?
        - Lean: export the occurrence. Mapping `CollectionItem.cadence` + `dateDefinition` → `RRULE` is non-trivial (especially `relative` definitions like "4th Thursday of November" → `BYDAY=4TH`).
    - **Import:** an incoming VEVENT with `RRULE` — does it become a new `CollectionItem` (recurring parent) plus spawned WeekNotes, or a flat list of WeekNotes (one per occurrence)?
        - Lean: flat list of WeekNotes initially. Reconsider when users want to edit the *series*, not the *occurrences*.

6. **Exceptions / overrides** (advanced recurrence)

    ICS supports `EXDATE` (skip this occurrence) and modified instances. With "occurrences as flat WeekNotes" (Q5), exceptions are trivial — just edit/delete the specific WeekNote. With "series + spawned children," exceptions need explicit override state.

    **Open:** non-urgent. Resolved by Q5 if we stay flat.

---

## Category 2 — Owner / Calendar Identity

### Background

ICS files and CalDAV both expect an "owner" — a name + email — to populate `ORGANIZER` and `ATTENDEE` fields. The app has user auth ([server/auth.ts](server/auth.ts)) but the auth identity is a login credential, not a public calendar identity.

---

7. **What fields define calendar identity?**

    **Answer (user-confirmed in scope):** Minimum needed:

    - *Display name* — e.g., "Robin Example"
    - *Email* — e.g., `robin@example.com`
    - *(Optional)* Timezone — already in `AppState.userTimezone`.

8. **Identity vs. auth identity**

    **Open.** Three options:

    - **Same as auth:** login email = calendar email. Simplest. Cost: if user logs in with a personal email but wants to send invites from a work address, can't.
    - **Separate profile:** auth is a credential; calendar identity is a separately-configured profile (display name + email + maybe avatar). More flexible.
    - **Multiple identities:** user has N calendar identities, picks one per export. Overkill until multi-calendar lands.

    **Lean:** separate profile. The auth email is private (used for login). Calendar identity is public-facing. They should be decoupled from day one — adding the decoupling later is messy.

9. **One identity per app, or per-calendar?**

    Only matters when multi-calendar lands. Today the app has one implicit calendar.

    **Lean:** one identity for now. Revisit when multi-calendar arrives (out of scope here).

10. **Storage**

    **Open.** Calendar identity needs persistence. Options:

    - New columns on the user row in the DB (server-side, single source of truth).
    - Stored in `AppState` as a `userProfile` field (client-side, syncs via the existing sync path).

    **Lean:** server-side on the user row. Identity is *user* data, not *app* data; conceptually belongs with auth even though it's separate from auth credentials. Reduces sync surface.

---

## Category 3 — ICS Files (Phase 1, Primary Scope)

11. **Export scope — what granularities are supported?**

    **Open.** Three granularities to consider:

    - **Single event:** "share this WeekNote as an invite." Output: small `.ics` with one VEVENT.
    - **Date range:** "export May–July." Output: `.ics` with all WeekNotes in that range.
    - **Whole calendar:** "back up everything." Output: `.ics` with every (non-deleted) WeekNote.

    **Lean:** support all three. Single-event export is the most user-visible (sharing an invite) — priority.

12. **Import — where do events land, and how is dedup handled?**

    **Open.**

    - *Destination:* default to the implicit calendar (only one today). Multi-calendar lands later → user picks.
    - *Dedup:* incoming `UID` matches an existing WeekNote → update or skip?
        - Lean: update via LWW based on `LAST-MODIFIED` from the ICS. Coordinate with Doc 1's sync conflict semantics.
    - *Different UID, same date:* coexist as separate entries (don't try to merge by title — too fragile).

13. **Import UI**

    **Open.**

    - *File picker:* simplest. Phase 1 primary.
    - *Drag-and-drop file:* nice ergonomics; modest implementation cost. Phase 1 nice-to-have.
    - *Paste raw ICS text:* power-user affordance, low cost. Optional.

    **Lean:** file picker + drag-and-drop for phase 1. Paste as a follow-up.

14. **ICS parser/serializer**

    **Open.**

    - *Custom:* writing an ICS parser is a footgun. The spec is sprawling (line folding, escaping, timezone definitions, recurrence rules).
    - *Library:* `ical.js` (Mozilla) is the canonical JS option — well-maintained, handles parsing + serialization + RRULE.

    **Lean:** `ical.js`. Pay the bundle-size cost (~80kb minified, lazy-loaded only when import/export UI opens) for correctness.

15. **Validation policy on import**

    **Open.**

    - *Strict:* reject any non-conforming ICS file outright.
    - *Lenient:* skip malformed events with a warning, import everything else.
    - *Hybrid:* warn the user before import if N events are malformed; let them decide.

    **Lean:** lenient with a summary report ("Imported 487 events. Skipped 3 malformed entries.") Logging the skipped UIDs for debugging.

16. **Export file format details**

    **Open small details:**

    - Filename: `tasks-export-YYYY-MM-DD.ics`? Or user-named?
    - `PRODID` field: `-//Tasks//tasks-app//EN`?
    - `X-WR-CALNAME` (the calendar's display name in clients): use the user's display name? "Tasks"? User-configurable?

---

## Category 4 — CalDAV (Phase 2, Separate Milestone — Sketched Only)

### Honest sizing

CalDAV is *not* just an extension of ICS. It's the union of:

- **HTTP + WebDAV** — `PROPFIND`, `REPORT`, `MKCOL`, `PUT`, `DELETE`.
- **iCalendar** — the data format (same as ICS, library reusable).
- **Scheduling extensions (RFC 6638)** — invites, RSVPs.
- **Auth** — Basic, Digest, or OAuth depending on the server.
- **Discovery** — principal URL → `calendar-home-set` → individual calendars. Not a fixed URL.
- **Change tracking** — `ETag` per resource, `sync-token` for incremental sync.
- **XML query model** — `REPORT` queries with `calendar-query` filters.

Doable, especially with [tsdav](https://github.com/natelindev/tsdav) or similar libraries. But this is a multi-week effort, not a weekend. Flagging so it's correctly scoped as a separate milestone.

---

17. **Bidirectional sync?**

    **Open.** Two-way sync introduces conflict resolution for "same event edited in two places." Same problem as Doc 1 (inter-device sync), but harder (external system, unknown other clients).

    **Lean:** yes eventually, but **land read-only first**. Phase 2a: pull events from Nextcloud, render them, don't push. Phase 2b: enable writes once read is stable and conflict semantics are settled.

18. **Client or server?**

    - *Client:* this app speaks CalDAV to a remote (Nextcloud, Radicale). Doesn't host its own.
    - *Server:* this app exposes CalDAV endpoints so Apple Calendar / Thunderbird can subscribe.

    **Lean:** client only. Server is phase 3 if ever — Nextcloud already does this well; no reason to compete.

19. **Sync strategy**

    **Open.**

    - *Pull-on-demand:* user clicks "sync now"; fetch changes since last `sync-token`.
    - *Background polling:* every N minutes, pull silently.
    - *Push from server:* CalDAV doesn't natively support push; some servers offer long-polling or WebDAV-PUSH extensions. Complex.

    **Lean:** pull-on-demand for phase 2 launch. Background polling as a follow-up if the user finds manual sync annoying.

20. **Auth with Nextcloud**

    **Open.** Nextcloud supports:

    - **App passwords:** user generates an app-specific password in Nextcloud settings, pastes into our app. Basic auth. Simpler.
    - **OAuth:** redirect flow, refresh tokens. More secure, more complex.

    **Lean:** app passwords for phase 2. OAuth is a future hardening pass.

21. **Conflict policy**

    **Open.** Coordinate explicitly with [hygiene-pass.md](hygiene-pass.md): whatever LWW/CRDT semantics we land on for inter-device sync should *probably* also apply to CalDAV conflicts. Avoid inventing two parallel conflict systems.

---

## Category 5 — Horizon

### Background — current state

[src/utils/initialization.ts](src/utils/initialization.ts), [src/utils/routineSpawner.ts](src/utils/routineSpawner.ts), and [src/utils/collectionSpawner.ts](src/utils/collectionSpawner.ts) historically iterated over a fixed 12-month window. Post-queue-redesign, routines no longer pre-spawn — they're queue-derived. CollectionItems still spawn WeekNotes ahead of time.

---

22. **Does the app still need a horizon?**

    **Answer:** Not as a *hard storage limit*. Adopt the calendar-app model: store events at any date; render only the visible window. Aligns with how every other calendar tool works.

    **Open:** the 12-month assumption may still be load-bearing for some specific code paths. See Q24.

23. **Navigation bounds (UI)**

    Doc 2 territory but coordinated here.

    **Open.**

    - *No bound:* user can click WeekNav indefinitely. Empty weeks render empty. Lean.
    - *Soft bound:* navigate freely to "first event backward" and "last event + 1 year forward." Beyond, require "jump to date."
    - *Hard bound:* fixed N years.

    **Lean:** no bound, with a "jump to date" affordance (Doc 2 Q13) for fast travel.

24. **Audit: where does code still assume 12 months?**

    **Required deliverable for phase 1.** Files known to have horizon assumptions:

    - [src/utils/initialization.ts](src/utils/initialization.ts) — initial state population.
    - [src/utils/routineSpawner.ts](src/utils/routineSpawner.ts) — even post-queue-redesign, may still loop the year.
    - [src/utils/collectionSpawner.ts](src/utils/collectionSpawner.ts) — CollectionItem → WeekNote expansion; almost certainly has a horizon.
    - Any server query in [server/routes.ts](server/routes.ts) with `WHERE week BETWEEN ...`.

    **Open:** concrete list of code locations + the assumption each makes. To be filled by a grep pass during scoping.

25. **CollectionItem expansion strategy**

    A "Birthdays" collection with 30 entries × 50 years = 1,500 spawned WeekNotes. Per collection. With many collections, expansion gets expensive fast.

    **Open.**

    - *Eager expand on horizon:* pre-generate all spawned WeekNotes within some bound (current behavior, scaled). Simple, but bounded.
    - *Lazy expand on visible window:* generate spawned WeekNotes only for weeks the user is viewing. Unbounded, but stateful (need a "have I generated this week" marker).
    - *Pure derivation (no spawn):* don't materialize at all — CollectionItem occurrences are computed on read. No data; just a function. Most elegant; biggest deviation from current design (WeekNotes are mutable; how do user edits on derived occurrences persist?).

    **Lean:** lazy expand. Keeps WeekNotes mutable (user can edit notes on a specific occurrence) while bounded to actually-viewed windows.

26. **Storage / performance**

    **Open.** As events accumulate (5+ years × multiple collections × imported calendars), what scales?

    - SQLite handles millions of rows without issue.
    - Client-side `AppState` blob holding *everything* in memory may not — at some point, lazy per-week loading is needed.

    **Lean:** don't optimize until it's a problem. Add lazy client loading when in-memory state exceeds a noticeable threshold (TBD — probably "user reports slowness" rather than a hard number).

---

## Category 6 — Cross-Cuts with Doc 2

27. **Month view must render imported events**

    A CalDAV pull dumping 200 events into the next 6 months changes the calculus for Doc 2 Q8 (what does month view look like). A calendar grid becomes much more attractive when there's substantial dated content.

    **Action:** revise Doc 2 Q7/Q8 *after* Doc 3 lands.

28. **Past view + imported historical events**

    A user importing a 10-year `.ics` archive lands events in past weeks. The read-only past view (Doc 2 Q1) must render them like native WeekNotes.

    **Action:** revise Doc 2 Q1 to explicitly include imported events.

29. **Past view + horizon expansion**

    Doc 2 Q2 ("how far back can the user navigate") was held open pending this doc. With Q23's "no bound" answer, Doc 2 Q2 becomes "all available data, plus jump-to-date."

    **Action:** confirm Doc 2 Q2 when revising.

---

## Concrete Scenarios

### Scenario A — Sharing a single event

User has a WeekNote: "Birthday Party — May 22". They click "Share as invite." App generates a one-event `.ics` file with `SUMMARY=Birthday Party`, `DTSTART=20260522`, `ORGANIZER=mailto:robin@example.com;CN=Robin Example`. User emails it; recipient opens in Apple Calendar; event appears.

**Questions:**
- What if calendar identity isn't configured yet — block the share, or prompt the user inline?
- Do we add the user as `ATTENDEE` (with PARTSTAT=ACCEPTED) so the invite shows them as already-attending?

### Scenario B — Importing a Nextcloud calendar archive

User exports their full Nextcloud calendar (500 events, 5 years past + 1 year future, mixed VEVENTs and recurring rules). Drags the `.ics` file into the app.

App lazy-loads `ical.js`, parses, generates one WeekNote per occurrence (per Q5 flat list), writes to DB. UI shows progress: "Imported 487 events. Skipped 3 malformed entries."

**Questions:**
- Does this run server-side or client-side?
- For events 5 years in the past — does the past-week-view (Doc 2 Q1) render them? Yes per Q28.
- For events 1 year ahead — does the future-week-view (Doc 2 Q8) render them? Yes; possibly motivates Doc 2 month view.

### Scenario C — CalDAV bidirectional with Nextcloud (phase 2)

User configures CalDAV: Nextcloud URL, username, app password. App discovers their calendar, pulls all events. User adds a WeekNote in the app; on next push, it appears in Nextcloud. User edits the event on their phone (also synced to Nextcloud); next pull, the change appears in the app.

**Questions:**
- What if the user edits the *same* event on phone *and* app between pulls? Conflict policy (Q21) — coordinate with Doc 1.
- What if Nextcloud is unreachable? Queue local changes for next successful sync.

### Scenario D — Looking 3 years ahead, no horizon

Today is May 11, 2026. User clicks forward in WeekNav until they reach October 2029. The app doesn't error out. They add a WeekNote ("Trip to Japan"). It persists. Days later, on a different device, they pull and see the WeekNote in 2029.

**Question:** Does the routine queue / cadence math break if a routine's anchor is 3+ years in the past? Specifically, is there any modulo/integer overflow risk? (Probably not — `daysSinceLastCompletion / cadenceDays` is just a float — but worth verifying.)

---

## Decision Log

| # | Question | Decision | Date |
|---|----------|----------|------|
| 1 | Which entities export | WeekNote yes (canonical). `dueDateISO` Item open (lean no). Bare Items never. | 2026-05-11 |
| 2 | WeekNote → VEVENT field mapping | Sketched. Open on timed-vs-allday and `RRULE`. | 2026-05-11 |
| 3 | `dueDateISO` Item export shape | Lean don't export in phase 1. | 2026-05-11 |
| 4 | Imported events land where | Lean WeekNotes (phase 1), with minimal field extension. `CalendarEvent` entity in phase 2 if needed. | 2026-05-11 |
| 5 | Recurring events | Lean export-as-occurrences, import-as-flat. Open. | 2026-05-11 |
| 6 | Recurrence exceptions | Trivial if Q5 stays flat. Resolved by Q5. | 2026-05-11 |
| 7 | Calendar identity fields | Display name + email minimum. Timezone reused from AppState. | 2026-05-11 |
| 8 | Identity vs. auth | Lean separate profile from day one. Open. | 2026-05-11 |
| 9 | Per-app or per-calendar | One for now. Revisit with multi-calendar. | 2026-05-11 |
| 10 | Identity storage | Lean server-side on user row. | 2026-05-11 |
| 11 | Export granularities | Single event + date range + whole calendar — all three. Single-event priority. | 2026-05-11 |
| 12 | Import dedup | UID match → LWW update. Different UID, same date → coexist. Coordinate with Doc 1. | 2026-05-11 |
| 13 | Import UI | File picker + drag-drop phase 1. Paste later. | 2026-05-11 |
| 14 | ICS library | Lean `ical.js` lazy-loaded. | 2026-05-11 |
| 15 | Validation policy | Lean lenient + summary report. | 2026-05-11 |
| 16 | Export file format details | Open (filename pattern, PRODID, X-WR-CALNAME). | 2026-05-11 |
| 17 | CalDAV bidirectional | Yes, eventually. Read-only first (phase 2a), writes second (phase 2b). | 2026-05-11 |
| 18 | CalDAV client or server | Client only. Server out of scope. | 2026-05-11 |
| 19 | CalDAV sync strategy | Pull-on-demand phase 2. Background polling follow-up. | 2026-05-11 |
| 20 | Nextcloud auth | App password (phase 2). OAuth later. | 2026-05-11 |
| 21 | CalDAV conflict policy | Coordinate with Doc 1. Open. | 2026-05-11 |
| 22 | Hard horizon | None. Store anything. | 2026-05-11 |
| 23 | Navigation bounds | No bound + "jump to date." | 2026-05-11 |
| 24 | 12-month code audit | Required deliverable. Open. | 2026-05-11 |
| 25 | CollectionItem expansion | Lean lazy-expand on visible window. Open. | 2026-05-11 |
| 26 | Storage/perf | Don't optimize until problem. Lazy client loading later. | 2026-05-11 |
| 27 | Month view + imports | Doc 2 must be re-scoped post-Doc 3. | 2026-05-11 |
| 28 | Past view + imports | Doc 2 "frozen" rule extends to imports. | 2026-05-11 |
| 29 | Past view + horizon | Doc 2 Q2 = all available data. | 2026-05-11 |

---

## Handoff Note

This document is provisional pending:

1. **[hygiene-pass.md](hygiene-pass.md)** — CalDAV bidirectional sync (Cat 4) depends on inter-device sync being solid. Specifically: whatever conflict-resolution semantics we land on for Doc 1 should propagate to Q12 (ICS import dedup) and Q21 (CalDAV conflicts). Don't start CalDAV writes until Doc 1 closes.
2. **[time-navigation.md](time-navigation.md)** — month view shape (Q8) and past-view rules (Q1) are reshaped by imports. Cat 6 of this doc lists the cross-cuts to revise.
3. **Phase split is load-bearing.** Phase 1 (ICS + horizon + identity) is the actual commitment from this doc. Phase 2 (CalDAV) is *sketched* here so we know the shape of the cliff we're walking toward, but is a separate milestone — not committed.

After Doc 1 closes:
- Refresh Q12 (ICS dedup) with the actual conflict-resolution rule.
- Refresh Q24 with a concrete code audit (grep for 12-month assumptions).
- Refresh Q21 (CalDAV conflicts) so phase 2 inherits the same model.
- Refresh Cat 6 cross-cuts in Doc 2.
