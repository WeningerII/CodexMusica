# Engineering log

This log keeps engineering history that was moved out of documents describing
current behaviour: what changed and when, causes, corpus counts and
measurements, witness lines, commit and issue trails, and who found what. It is
a record of the past, not a reference for current behaviour. The documents each
section names state the current rules.

Every quoted block below is copied verbatim from the source file named in its
section, as that file stood at commit `03a42ba83`, with the source line numbers
at that commit. Paths, counts, commit ids and issue comment ids inside a block
are as they stood then; a path a block names may since have moved or gone.

## From `mcp/LYRICS_RUNTIME.md` (source commit `03a42ba83`)

### Opening paragraph (lines 3–6)

> The lyrics kitchen — the service's own Gemini writer, which runs only inside the
> website chat (no MCP connector endpoint offers it since 2026-09-27) — spans an
> HTTP request, Gemini chat hops, MCP calls, a serialized Python worker and paid
> proposal calls.

### Capacity and identity (lines 121–122)

> The `/chat` store is bounded to 128 full payloads, 8192 receipt identifiers, ~~8 MiB~~ 18 MiB per record
> (raised 2026-10-04 with the run record cap) and 256 MiB total.

### Word numbering: the reader change (lines 212–215 and 219–220)

> A pronunciation declaration names a word by its one-based sung-token position
> in an exact line (`{line, token, word, …}`), and the English reader's cut of a
> line changed in this release (reader scheme v2: ASCII dash runs split words,
> digit-bearing runs are numeral tokens, NFC and the Unicode-hyphen folds apply).

> What follows protects fresh lyric calls without rewriting
> pre-batch v1 state rows or their fingerprints.

### Word numbering: continuation across the release (lines 222–227)

> - **A continuation across the release is refused.** A `state`, `checkpoint`,
>   `run_id` or session receipt written by the earlier image carries its
>   `connector_semantic_identity`; the source changed, so
>   `assertContinuationSemantics` (`mcp/state_codec.js`) refuses it as
>   `CONTINUATION_MIGRATION_REQUIRED`, and the declarations inside it are never
>   replayed under the new cut.

### Word numbering: the ambiguous unmarked example (lines 242–244)

> For example, pre-release token 2 `oh` in
> `Oh--oh, oh my love` names characters 8–10 under v1 and 4–6 under v2; an
> unmarked fresh lyric call cannot choose between them.

### Word numbering: unmarked voices and re-sent declarations (lines 245 and 255–256)

> - **The existing unmarked-voices limitation remains.**

> This does not depend on cached aliases or extra receipt
> capacity and never rewrites pre-batch rows or fingerprints.

### Word numbering: the Lyrics page and the Library tab (lines 315–318 and 338–346)

The current rules these sentences sat among are in
`docs/lyrics-reader-migration-dev.md`.

> Before this, marking without that reading made the binding
> depend on whether a form or a send came first (`1.T4` bound `my` one
> way and `love` the other).

> A server job queued across the release is refused
> `STALE_READING` by the scheduler's identity recheck only when its stored
> identity differs from the one the running service computes (across a
> release: a different `engine_commit` or `resource_fingerprint`).

> The
> identity records no reader scheme, so where both sides have no commit
> identity (`engine_commit` null: a build with no baked or reported commit,
> which a production image never is) and the same resources, a job
> queued before the release passes the recheck and runs under the current
> cut.

### Word numbering: counts and definitions across the cut (lines 355–368)

> In
> `Oh--oh, oh my love` a pre-release `1.T4` meant `love` and now binds `my`,
> and `1.T2` moves to the `oh` inside `Oh--oh`, with no refusal; the two cuts
> disagree on 10,553 such positions on 3,099 lines of the English corpus.

> A
> bare `N` and the named places (`end`, `endword`, `head`, `headrime`, `line`)
> are DEFINITIONS the grader applies to the line as the running reader cuts it
> (`lyric-harness/quality/slots.py`: `head` and `endword` take the word start, `end`,
> `headrime` and `T<k>` the last stressed syllable from there), so what they
> bind moves with the cut too: on the English corpus `end` is re-cut on 178
> lines and on 539 more the earlier cut skipped a numeral end the current one
> reads (a visible hole in `blocking` unless a reading is declared); `endword`
> is re-cut on 229 lines and names a different word on 1; `head` is re-cut on
> 288; `headrime` on 284, plus 53 lines whose leading dashes only the current
> cut keeps out of the word.

### Word numbering: the website's rhyme links and declared returns (lines 404–412)

The current rule this sentence states is in `docs/lyrics-reader-migration-dev.md`.

> A bare `N`
> or named place on a line whose earlier and current cuts differ ANYWHERE
> (the whole line: on 22 corpus lines the bound word's characters are the
> same under both cuts but the rhyme starts in an earlier word, the "double
> bass" shape) is kept named and marked
> `N.place (carried across the word-cut change)`: it is still sent and
> judged, and Review shows one notice per member naming the line, the place
> and the words the page shows there under each cut, with Keep the link /
> Remove it.

### Word numbering: the cause of the named-place re-cut and its measurement (lines 417–431)

> - The cause: v1's `line_anchors` re-cut the words before the last from
>   their space-joined text. That joined an enclitic the printed line sets
>   apart to the word before it: `Below the knap, 's a runnèn still;`
>   looked up `knap's`, and `When in that house M.P.'s divide,` looked up
>   `P's` (P IY1 Z). The current reader reads `'s` alone, so the rhyme's
>   start moves.
> - Measured on the English song corpus
>   (`lyric-harness/quality/results/named_place_lookup_2026-10-14/`), out
>   of 271,092 identical-cut sung lines:
>   - 8 change their END binding, and the condition names all 8;
>   - the condition fires on 24 lines in all, the 8 plus 16 where the
>     lookup differs but the end anchor does not reach the joined word;
>   - it fires on none of the other 271,068.
>   - 7 more non-Latin lines differ only in the label's Unicode
>     normalisation, with nothing bound under either scheme.

### Word numbering: the pre-existing items as first recorded (lines 432–459)

The current list is "Known open limitations (pre-existing items)" in
`mcp/LYRICS_RUNTIME.md`. The `sites/library` item below is not restated there:
it has not been verified on current main.

> - **Pre-existing, not caused by this batch and not fixed in it** (BB8 #519
>   6161601064, 3PO 6161637870). They are listed so they are not read as
>   regressions:
>   - A Library job refused `STALE_READING` (queued or paused across a
>     release) still offers a Resume that cannot succeed
>     (`src/library/analysis.js`: the Resume button shown for every paused,
>     cancelled or failed job).
>   - Under reader scheme v1, the default end slot's swap splices into an echo
>     aside that repeats the end word (`my love (my love)` edits the aside).
>     The v1 replay keeps that wrong edit byte-identical, because v1 is the
>     pre-batch body verbatim (`lyric-harness/quality/loop.py` `swap_at_slot` docstring).
>   - The standalone Library Site (`sites/library`) posts device pronunciation
>     choices to the server without this release's migration.
>   - The reviser can accept a candidate that deletes a word. On the empty-walk
>     path the stock tier-2 proposer's `GroupBrief` carries an empty pivot
>     (`pivot_word=''`), `default_propose_group` splices that empty string in,
>     and `revise_loop` accepts the result: `['zap be free', 'zip me now',
>     'zop see that']` with `1.head,2.head,3.head` becomes `[' be free',
>     ' me now', 'zop  that']` (BB8 #527 6164278661). `67889851` and `fce4bf0f`
>     do the same. It is a shared-loop candidate-validity question, separate
>     from WHICH occurrence a splice edits, and it is not fixed here: changing
>     what the loop accepts needs the owner's bounded approval. The slot
>     receipts splice a non-empty marker, so they cannot see it, and they do not
>     show that production candidates are safe.
>   - Two items await the owner's scope decision and are not touched here: a
>     retained 30-day Library chunk that saves declarations without their cut
>     (F2), and the mixed-version deploy window between page, server and
>     queued jobs (F3).

_Owner's decision (2026-11-04, John, #656 6638610083): F2 is not repaired;
affected chunks expire within their 30-day retention. F3 is accepted and
documented in `mcp/LYRICS_RUNTIME.md` (known open limitations), with the
safety that already holds across a deploy: old-server continuations refuse
`CONTINUATION_MIGRATION_REQUIRED` and resume with `recover_only`, and Library
jobs queued or paused across a release refuse `STALE_READING`._

_Later finding (2026-11-03, BB8, #656 6615011687): the empty-pivot deletion
item above was already fixed on main by `0e849218d6` (the #570 re-land, 16
Oct). `swap_at_slot` and `swap_end_word` refuse a word with no letter or
numeral, and `default_propose_group` with an empty pivot returns None under v1
and v2. `test_loop` on `129afebbd` passed 267/267, including 28 empty-pivot
checks. It is not listed among the current open limitations._

### Word numbering: a run resumed under v1 (lines 460–464)

> A state recorded
> under reader scheme v1 (a pre-batch harness state replayed with the harness,
> or an explicit `--reader-scheme=v1`) keeps the whole pre-batch reading (D1):
> counts and named places alike resolve under the earlier cut, exactly as they
> did when the state was written.

### Word numbering: a word broken across the line end (lines 475–487 and 493–502)

> - **A word broken across the line end** (`king-` / `dom of daylight's…`): the
>   current cut keeps the hyphen inside the token, and a hyphenated word reads
>   only whole, so the declared-relation reader (the registered English reader a
>   plain lexicon gets, fallback refused) read `king-` as no word while
>   `line_anchors` read `king`, and a declared `broken rhyme` or `perfect rhyme`
>   on that pair went unjudged. The relation stream now reads the printed part of
>   the line-final broken word through the same phonology and its own fallback
>   policy (`English.split_final_stem`), and only after the token itself read
>   nothing (a declared reading of `king-` answers first). A numeral broken there
>   (`2-`) and a printed boundary stay refused, and the bare word `king-` still
>   has no reading.

> On the English song corpus, 13 of the 18 lines that
> end on such a word (of 281,069) are now read in the stream; 5 stay refused.

> Before, these shapes were refused under v2 (both relations
> unjudged). On the English song corpus 2 lines end that way; 1 (`Boo-`) is
> now read and 1 (`Buce-`) stays refused, its stem having no reading. The
> printed witness is `Then the ominous words “It’s a Boo-”`. At `0af39c6f`
> its closing quote still left `Boo-` unread; the punctuation/quote repair
> in `7c26d40c4` reads it. With `we knew` as the comparison line, the repaired
> stream judges perfect rhyme True and broken rhyme False. This witness
> has no parenthetical aside, so it gives the same result in aside-stripped
> and voices modes. Corpus counts still need mode labels: voices retains
> parenthetical material that aside-stripped mode removes.

### Word numbering: a bare word looked up as a token is (lines 503–507)

> Under v2,
> `pronunciation_variants` (and `English.parses`, `whole_reading` and the
> `types` verb built on it) looks a bare word up under the reader's entry
> normalisation, as `transcribe_word` and every line token already did, and a
> supplement row found that way is credited to its own source.

## From `docs/session-workflow-repairs.md` (source commit `03a42ba83`)

### Title and introduction (lines 1–4 and 7)

> # Repairs from the Moonshots connector runs
>
> These changes address reproducible implementation failures exposed by the actual
> recipe and lyric sessions.

> ## Fixes

### Fixes: native SDK client and Rich compression (lines 12–13 and 37–38)

> Discovery is still available, and an explicit host `phase: 'edit'` permits
> work on an existing song.

> Browser technique edits now create pins too; a subsequent material
> edit cannot quietly discard that earlier choice.

### Boundaries: evidence behind each limit (lines 79–83, 84–88 and 98–99)

> The surprising prize/house result reproduced on bare
> words too; carrier contamination was not established by that observation.

> Full-line anchor-span searches can differ from standalone
> screening, which is now stated on the tool itself.

> * No verified pronunciation declarations for Blundin, Mostaque, or Moonshot were
>   supplied. Low fallback guesses are not biographical evidence. The original replay left the homograph
>   "record" unresolved and correctly remained uncertified. The pronunciation
>   replay now declares the dictionary noun reading and regrades before revision. No guessed names were added
>   to the dictionary merely to get a green result.

> Catalog preface IDs (including `conductors`)
> retain their canonical spelling; no unaudited global rename was made.

### Repeatable verification: the Moonshots replay (lines 107–115)

> `npm run qualify:session:workflow` replays the actual 30-line Moonshots draft
> through the maintained client and real sweep, screen, plan, grade and interview
> revision tools. It uses no paid model and does not alter continuation state.
> Evidence is written beside the checked-in draft. The replay checks that all seven
> section headers survive and the unknown-name lower-bound meter refusals disappear
> under explicitly selected low fallback. It then declares the noun reading of
> "record", regrades, resumes the two actual lyric repairs, and requires exit 0
> with complete requested coverage. The original uncertified replay remains as
> a counterexample; the new evidence uses the `moonshots-pronunciation-replay` prefix.
