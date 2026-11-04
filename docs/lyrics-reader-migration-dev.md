# Lyrics reader migration: website rules

The English reader cuts a sung line under reader scheme v2, the current cut, or
v1, the earlier cut kept for replay. This document states how the website's
Lyrics page and Library tab mark, migrate and report the pronunciation choices,
rhyme links and declared returns they save, so that a number written under one
cut is not silently read under the other. These are live app contracts,
exercised by `scripts/check_lyrics_page.js` and
`scripts/test_library_declarations.js` among others. No connector caller acts on
them. The rules for connector calls are in the
[word numbering section of the lyrics runtime](../mcp/LYRICS_RUNTIME.md#word-numbering-declarations-held-from-before-the-reader-change).

Either surface refuses a saved mark naming a cut it does not read
(`— cut v3`, `token_cut: "v3"`), naming the accepted value.

## The Lyrics page

New reading rows carry `numbering` with their source
scheme and voices, alongside `— cut v2`. These marks survive a
downloaded `.txt`, a paste, an import, Undo/Redo and a Library working
copy. Historical cut-v2 rows lack voices provenance and keep that residual.
A row without a cut or numbering marker is legacy by compatibility policy (hand-typed or
imported text can be unmarked too, so this is a reading rule, not a claim
about when the row was written): it is rebound by span identity, or blocked
for the writer's decision (`src/pages/lyrics.js`, `lyEnsureTokenScheme`).

- It runs only at a boundary: when a session is opened (restored at
  start, a saved session loaded or copied, a session file imported, the
  Lyrics page mounted), when a `.txt` or Library working copy is
  imported, and before anything is sent to the writer. Never from the
  typing refresh, so the draft is not rewritten under the writer. An
  empty initial mount precedes startup content restored by
  `uiRestoreSession`; that restore supplies the migration boundary.
- It adds no Undo step. At an open or import, the step that event
  records already holds the migrated text, so Undo returns to the draft
  from before it and Redo to the migrated text. At an in-page boundary
  (send, mount), the writer's text is recorded first, exactly as leaving
  the editor records it, and the migrated text replaces that same step.
- Undo and Redo never run the migration. A step still holding an
  unmarked row (one typed or pasted by hand since the last boundary) is
  migrated at the next boundary.
- The selection is mapped through the rewrite onto the same characters,
  and no declaration is dropped.
- A row whose number names the same characters under both cuts keeps
  every byte and gains no mark. That is the page's existing contract:
  setup rows are hashed into the version a review certifies. Only a row
  the migration rewrites gains the mark, and inside it only the changed
  members are respelled. The cost is that such a row stays legacy, and
  is re-read under the earlier cut if its line is later edited across
  the cut. That cost is open for the owner; nothing decides it here.
- Every number the migration changes is reported twice: in a toast, and
  in a Review card listing each one ("word 2 → 3"). The card keeps every
  entry whole (the word as saved, every sung line it names) until the
  writer dismisses it: nothing is truncated or evicted, the card shows
  the first 20 and "Show all" lists every one.
- The record belongs to its draft (`app.lyricMeta.renumbered`, tied to
  the draft's id). It is part of each Undo/Redo step, so Undo restores a
  draft's text, id and record together and never leaves one draft's
  record over another; the session's saves keep it; and the draft's
  Library store entry is saved only with its own record. Importing
  ANOTHER draft (a Library working copy, a saved draft reopened from
  History) shows that draft's record instead: the earlier draft's record
  stays with the earlier draft, reachable through Undo and by reopening
  it, and is never carried into or saved under the other. It does not
  follow the text into a new Library working copy, which is a new draft.
  A `.txt` import replaces the text of the same draft, so its entries join
  the same list.
- A form that rewrites a rhyme groups or returns row (Save link,
  Remove link, a placed return, Declare exact repeat, removing links that
  bind no word, Keep / Remove on a carried member) first reads every
  unmarked row of that kind exactly as a boundary would (rebound by span,
  kept undecided, named places carried), and only then writes the row
  back marked. The form's own message and the Review card
  report what it renumbered. The typing refresh still never rewrites the
  draft. Before any boundary or form, the page's own Rhymes and Repeats
  display still shows an unmarked row under the current cut (display
  only; nothing is sent from it).

## The Library tab

Every pronunciation choice the Library tab saves on a device carries
`token_cut: "v2"` on the saved record (the page's own storage; the rows
sent keep their six fields). A record without it says nothing certain
about which cut counted it (the retained chunk of the previous page
version still saves records unmarked), so each of its rows is read under
both cuts (`src/library/analysis.js`, `twoCutBinding`): a number that
names its word on the same characters under both, or only under the
current cut, is kept; one that names it only under the server's earlier
cut (the cut its `reading_choices` were numbered under) is rebound once,
by exact raw-span identity, with the moved numbers shown; one that names
it on different characters under the two cuts, or under neither, is set
aside naming both readings. A set-aside choice needs the reader's
decision, is not sent, and no new analysis starts until it is removed
(`savedInterpretation`). A reading picked from analysis evidence goes
through the same rule, and evidence from a job whose identity records no
`reader_scheme` is labelled "earlier word cut" and cannot be picked from
(`pickedChoice`).

A server job queued before a release is refused
`STALE_READING` by the scheduler's identity recheck only when its stored
identity differs from the one the running service computes (across a
release: a different `engine_commit` or `resource_fingerprint`). The
identity records no reader scheme, so where both sides have no commit
identity (`engine_commit` null: a build with no baked or reported commit,
which a production image never is) and the same resources, a job
queued before a release passes the recheck and runs under the current
cut. Its stored request and `declaration_hash` are not rewritten; a
new job from rebound choices has a new `declaration_hash`, as any changed
declaration set does. Choices carried into Lyrics by a handoff or a
downloaded import bundle are source history only: kept verbatim (the
bundle's digest covers them) and never sent to the grader.

## Rhyme links and declared returns (team policy A)

Every row the website writes carries `— cut v2` after its members. New and form-rewritten
numbered rows also record their source `numbering`, including voices.
Each marked row maps to the current coordinate before mixed rows are sent
with one current call marker; excluded asides refuse. Historical rows
without voices provenance retain that residual. SETUP metadata itself
is never sent as member text.

A member keeps the spelling the writer used: `2.end` (the end, named) stays
`2.end` and a bare `4` stays `4`, through the migration, Keep, the forms,
section reorder, export/import and what the tools receive, sibling groups
included; `.end` is never added to a bare member. A member the page itself
makes for the end is bare. The two do not always mean the same thing. In
a rhyme groups row a bare `N` is placed by its group's type (`group_types`
or `relation`), and is the end only in a group with no type. In a RETURNS
row a bare `N` is a whole-line return judged by `returns_check`. Explicit `N.line`
is a placed return judged by `placed_returns_check` through the `line`
placement; it is not an alias for bare `N`. The harness semantics are
distinct, and mixed whole-line/placed classes are refused. Both forms
are exempt from word-offset migration: neither is carried, annotated,
labelled with a word place or shown with an endpoint word. Other placed
returns (`N.end`, `N.endword`, `N.head`, `N.headrime`, `N.T<k>`) follow
the word-place migration rules below. Review drops an unnecessary
word-cut note on bare `N` or `N.line` when Keep is chosen; that shared
migration treatment does not change their grading policy.

In an unmarked row (legacy by compatibility policy) a `N.Tk` is rebound by
span identity, or kept under its old number as
`N.Tk (numbered under the earlier cut)`, binding nothing and stopping every
send until the writer removes the link and declares it again. A bare `N`
or named place on a line whose earlier and current cuts differ ANYWHERE
(the whole line: the bound word's characters can be the same under both
cuts while the rhyme starts in an earlier word) is kept named and marked
`N.place (carried across the word-cut change)`: it is still sent and
judged, and Review shows one notice per member naming the line, the place
and the words the page shows there under each cut, with Keep the link /
Remove it. Those words are the page's display, not the grader's evidence:
the grader decides what the place binds. On a line whose cut did not
change the member is carried silently and the row is not rewritten.
A line also counts as changed when its cut is identical but the words
the earlier grader looked up are not.
