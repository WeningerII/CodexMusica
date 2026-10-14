# Lyrics runtime: durable requests and paid-work recovery

The lyrics kitchen — the service's own Gemini writer, which runs only inside the
website chat (no MCP connector endpoint offers it since 2026-09-27) — spans an
HTTP request, Gemini chat hops, MCP calls, a serialized Python worker and paid
proposal calls. A caller timeout does not establish which
of those operations completed. Recovery therefore follows a durable request
receipt; it does not automatically repeat an uncertain request.

## Runtime configuration

The legacy Render Blueprint declares a **1 GB persistent disk** at `/data/lyrics`
and sets `LYRIC_RUNTIME_DIR` to that path. The image-backed release migration must
preserve that disk, the Standard plan and single-instance operation; see
[IMAGE_RELEASE.md](./IMAGE_RELEASE.md). The release check requires the live recovery
store to be healthy and durable.
A source commit alone does not prove that the mount is active.

Render's [persistent disk documentation](https://render.com/docs/disks) states
that mounted data survives deploys/restarts, a disk belongs to a single instance,
and disk-backed services briefly stop during deployments. These stores therefore
support **one Node process and one instance**. Multiple processes or replicas need
a transactional shared store before they can safely use this protocol.

| State | Default file under `LYRIC_RUNTIME_DIR` |
|---|---|
| Request intents, progress and responses | `jobs/<request_id>.json` |
| Connector workflow sessions and operations (`/mcp` and its aliases) | `sessions/<id>.json` |
| Generated chat signing key | `chat-secret.key` |
| Shared model admission/accounting ledger | `model-spend.json` |
| Legacy chat turn counters | `chat-spend.json` |

`CHAT_SECRET` remains an explicit signing-key override; otherwise
`CHAT_SECRET_FILE` may override the generated key's path. Preserve the existing
`CHAT_SECRET` during migration if existing signed conversations must continue.
Do not rotate it while recovering retained receipts. An unreadable or malformed
configured signing key disables paid chat instead of silently generating a new
one. A corrupt accounting file closes paid admission instead of resetting spend.
Do not delete corrupted files to make a run proceed: reconcile them against the
provider's records and retained receipts first.

Without `LYRIC_RUNTIME_DIR`, local development is explicitly **process-local**.
`/health.recovery.durable` is false; this mode does not establish restart recovery.
Setting a path by itself cannot prove that the hosting provider mounted persistent
storage. The Blueprint supplies that mount. For a different host, arrange the
mount before setting the variable.

Files are replaced atomically after file fsync and directory fsync, using mode
0600; the job directory uses mode0700. Receipts contain private lyric drafts and
signed continuation envelopes. Treat both the disk and downloaded battery
artifacts after decryption as private working data. The battery workflow requires
a dedicated `BATTERY_RECOVERY_KEY` and uploads only authenticated encrypted
archives plus a nonsecret manifest; see [BATTERY_RECOVERY.md](./BATTERY_RECOVERY.md).
Do not publish plaintext receipts, decrypted artifacts or the key in a public issue.

## Request and recovery protocol

Generate `request_id` from **32 cryptographically random bytes**, encoded as 64
lowercase hexadecimal characters. Save the complete request and this identifier
locally **before** sending `POST /chat`. The identifier is a bearer capability:
knowing it grants access to that receipt. Seeds and run titles grant no access.
The server redacts it from its inbound HTTP log.

A legacy request without `request_id` has no receipt to recover. The shipped
browser and battery persist an identifier on every attempt.

1. After request validation and admission, before dispatch, the server atomically
   records the original request body,
   its canonical SHA256 digest, build identity and `pending` state.
2. Repeating the same identifier with the same body returns `202` while pending,
   and never dispatches the work twice. Different input returns `409`.
3. Safe chat boundaries retain a signed continuation checkpoint. Python progress
   is stored separately, since it can be newer than the latest complete chat
   exchange. A raw worker checkpoint is not a signed model conversation. Proposer
   admission is persisted before the local broker gives Python permission to
   dispatch; `proposer_usage` retains its most recent admission or usage event.
4. Before sending the final JSON response, the server commits its HTTP status,
   JSON body and any `Retry-After` header. A completed duplicate replays those
   recorded values.
5. `GET /chat/jobs/<request_id>` returns the receipt. On process restart, an
   unfinished receipt becomes `interrupted`; submitting it again returns `409`.
   It never authorizes replay of uncertain paid work.

To continue a completed or recoverable receipt, submit a new `request_id` with its
`continuation_id`. The server resolves the retained signed envelope without
requiring the browser to resend it. Each parent durably records one successor
before provider dispatch; a different successor is refused. Recover the existing
successor after a lost response rather than starting a competing continuation.

The GET response has this shape:

```json
{
  "request_id": "<64 random hexadecimal characters>",
  "state": "pending | completed | interrupted | retired",
  "checkpoint": "null or signed history/workspace/lyric/sig plus turn progress",
  "progress": "null or the latest worker progress object",
  "response": { "status": 200, "body": {}, "headers": { "retry-after": "41" } },
  "build": { "commit": "...", "source_sha256": "...", "config_sha256": "..." },
  "durable": true,
  "retention_ms": 86400000
}
```

`response` is null until completed; `headers` is absent when no pacing header was
set. The actual checkpoint and progress values are objects, not the descriptive
strings in this example. GET responses are marked `Cache-Control: no-store`.

The battery's explicit `--resume` path can continue a retained signed checkpoint
with a **new** request identifier. An interrupted `uncertain_proposal` receipt
refuses automatic continuation: the provider may have returned an answer that was
not yet journalled. A `proposing` checkpoint is conservatively uncertain even when
no paid dispatch can be proved. Keep its accepted lines and start a deliberately
independent run when appropriate; do not replay its original proposal. Otherwise,
inspect `progress` before choosing to repeat a repair; paid-call reservations with missing usage remain unknown spend,
not zero-cost attempts. A `404` means no retained receipt, **not** proof that the
request never executed. It must not trigger transparent resubmission.

## Capacity and identity

The `/chat` store is bounded to 128 full payloads, 8192 receipt identifiers, ~~8 MiB~~ 18 MiB per record
(raised 2026-10-04 with the run record cap) and 256 MiB total. Connector sessions have their own store with limits sized for
connector traffic (`SESSION_STORE_LIMITS` in `mcp/workflow_sessions.js`); the same
retirement rules apply to it. To admit new requests within these limits, the oldest completed
or interrupted payload can be retired early. Its small `retired` tombstone retains
the identifier and request digest, preventing that identifier from executing again.
A retired receipt returns no checkpoint or response and cannot be resumed.

Terminal receipt metadata expires 24 hours after the last work update. Pending
records never expire or retire inside a running process. Full storage with no
retirable terminal payload refuses new admission. Invalid and rate-limited requests
are rejected before occupying storage. A persistence failure refuses new paid chat;
GET still exposes already-retained records with a `persistence_error` and an
interrupted state for an unpersisted final response. Download full results promptly:
the 24-hour metadata retention is not a promise to keep every response body that
long.

`/health` keeps top-level `commit` and adds `build` plus `recovery`. Build identity
contains the baked commit and unique release identifier when available,
runtime-reported commit, source and configuration SHA256, asset and asset-manifest
SHA256, and Node/Python/NLTK versions. The source digest covers the deployed MCP,
lyric harness, scripts, references and dependency locks. Lexical data is identified
separately by the release asset inventory. The promoted registry digest identifies
the tested image, including its installed operating-system packages; these fields
do not identify the provider's model weights. Configuration
fingerprinting covers CHAT/LYRIC/MODEL settings, model choice and trusted-proxy
count, excluding keys, secrets and tokens. Each receipt retains the identity that
accepted it. A fingerprint is useful for mismatch detection, not independent
attestation of the hosting provider.

For a long kitchen measurement, require durable recovery and the intended SHA,
record the tested image identity and configuration fingerprints, and stop if either changes. First prove
one bounded request can stop and resume from its receipt; then attempt a full song.
This code and the offline regression suite do not prove live provider latency,
writer convergence, the actual mounted disk, or sustained memory headroom.

## Reading basis: the lexicon supplement

Every tool that reads words (`lyric_screen`, `lyric_grade`, `lyric_revise`,
`lyric_check`, `lyric_verify`, `lyric_recover`) reads CMUdict plus one frozen
version of the reviewed lexicon supplement, named in
`lyric-harness/data/lexicon_supplement_versions.json`. The declaration is
`lexicon_supplement` (a version id, or `none` for CMUdict alone), and the record
keeps the version's file SHA256 beside it as `lexicon_supplement_sha256`
(`mcp/lexicon_basis.js`).

- **New work** that omits the field reads the manifest's `default`.
- **A continued run** (by `run_id`, `state`, `checkpoint`, or a session's grade
  receipt) keeps the version and SHA256 it recorded. A record written before
  this field existed reads `none`: it stays on CMUdict alone whatever the
  default now is. Inheritance is applied first, the default only after it.
- **An explicit different version** on a continuation is a moved declaration and
  refuses, like any other declaration.
- **A version this build does not ship**, a missing file, or a file whose bytes
  are not the recorded SHA256 refuses as `LEXICON_SUPPLEMENT_UNAVAILABLE`. No
  other version is ever substituted. The harness checks the file's bytes again
  (`--lexicon-supplement=<id> --lexicon-supplement-sha256=<hex>`).
- Every verdict carries `lexicon: {supplement_id, sha256}` from the harness's
  authenticated record, `null`/`null` for CMUdict alone. A creation session's
  grade receipt takes its basis from that field, never from the call's arguments.

A shipped version's file is never edited; a new batch is a new version and a new
file. Adding one changes the release asset inventory, so an in-flight
continuation from the previous image still meets `CONTINUATION_MIGRATION_REQUIRED`:
a stable version identity does not promise resume across deployments.

## Word numbering: declarations held from before the reader change

A pronunciation declaration names a word by its one-based sung-token position
in an exact line (`{line, token, word, …}`), and the English reader's cut of a
line changed in this release (reader scheme v2: ASCII dash runs split words,
digit-bearing runs are numeral tokens, NFC and the Unicode-hyphen folds apply).
The published schema did not change and carries no scheme field, so a
declaration does not say which cut numbered it. What follows is exactly what
does and does not protect one built before the release.

- **A continuation across the release is refused.** A `state`, `checkpoint`,
  `run_id` or session receipt written by the earlier image carries its
  `connector_semantic_identity`; the source changed, so
  `assertContinuationSemantics` (`mcp/state_codec.js`) refuses it as
  `CONTINUATION_MIGRATION_REQUIRED`, and the declarations inside it are never
  replayed under the new cut. `recover_only:true` extracts the stored lyrics
  and journal without replay.
- **Options are always numbered under the running release.**
  `pronunciation_options` from `lyric_grade` and `lyric_check` (the harness's
  `quality.pronunciation.reading_options`) number tokens under v2, so a
  declaration chosen from options this release returned binds the occurrence
  it names.
- **A mismatched position refuses.** A held declaration sent to a NEW call is
  validated against the line under v2; where its position no longer holds its
  word (`token 3 "Lawdy"` in `U--h, u--h, Lawdy,`, now `u`), the call refuses
  with the token the position names. It is never dropped silently.
- **The residual (open until commit 2).** Where the old position still holds
  the SAME word text under v2 but another occurrence of it, the held declaration
  validates and binds that other occurrence: in `Oh--oh, oh my love`, a
  pre-release `token 2 "oh"` meant the third `oh` (characters 8-10) and now
  binds the second (4-6). Nothing in today's schema can detect it. Commit 2 of
  this batch closes it: an optional numbering marker on each declaration,
  approved by the owner, with unmarked declarations that name different
  characters under the two cuts refused. Until it lands, a caller holding
  declarations from before this release (its own record, or a session it keeps
  across the deployment) re-reads `pronunciation_options` and re-declares before
  grading lines whose cut moved (a dash run, a numeral, a Unicode hyphen, a soft
  hyphen, combining marks).
- **The website's own saved choices are migrated, not left to that residual.**
  - The Lyrics page: every reading row it writes carries the cut it was
    numbered under (`— cut v2`, in the row itself, so the mark survives a
    downloaded `.txt`, a paste, an import, Undo/Redo and a Library working
    copy). A row without it is legacy by compatibility policy (hand-typed or
    imported text can be unmarked too, so this is a reading rule, not a claim
    about when the row was written): it is rebound by span identity, or blocked
    for the writer's decision (`src/pages/lyrics.js`, `lyEnsureTokenScheme`).
    - It runs only at a boundary: when a session is opened (restored at
      start, a saved session loaded or copied, a session file imported, the
      Lyrics page mounted), when a `.txt` or Library working copy is
      imported, and before anything is sent to the writer. Never from the
      typing refresh, so the draft is not rewritten under the writer.
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
    - A form that rewrites a rhyme groups or returns row (Link endings,
      Remove link, a placed return, Declare exact repeat, removing links that
      bind no word, Keep / Remove on a carried member) first reads every
      unmarked row of that kind exactly as a boundary would (rebound by span,
      kept undecided, named places carried), and only then writes the row
      back marked. Before this, marking without that reading made the binding
      depend on whether a form or a send came first (`1.T4` bound `my` one
      way and `love` the other). The form's own message and the Review card
      report what it renumbered. The typing refresh still never rewrites the
      draft. Before any boundary or form, the page's own Rhymes and Repeats
      display still shows an unmarked row under the current cut (display
      only; nothing is sent from it).
  - The Library tab: every pronunciation choice it saves on a device carries
    `token_cut: "v2"` on the saved record (the page's own storage; the rows
    sent keep their six fields). A record without it is legacy by
    compatibility policy and is rebound once, by exact raw-span identity from
    the server's earlier cut (the cut its `reading_choices` were numbered
    under) to the current one, with the moved numbers shown; a choice no
    current word covers exactly is set aside as needing the reader's decision,
    is not sent, and no new analysis starts until it is removed
    (`src/library/analysis.js`, `savedInterpretation`). A server job queued
    across the release is refused `STALE_READING` by the scheduler's identity
    recheck, and its stored request and `declaration_hash` are not rewritten; a
    new job from rebound choices has a new `declaration_hash`, as any changed
    declaration set does. Choices carried into Lyrics by a handoff or a
    downloaded import bundle are source history only: kept verbatim (the
    bundle's digest covers them) and never sent to the grader.
  - Either surface refuses a saved mark naming a cut it does not read
    (`— cut v3`, `token_cut: "v3"`), naming the accepted value.
- **Word places in `groups` and `returns`: counts and definitions.** A member
  `N.Tk` (`--groups=1.T4,2`, `--returns=1.T2,3.T2`) is a COUNT: word k of line
  N, with no word to validate against, read under v2 by a new call. In
  `Oh--oh, oh my love` a pre-release `1.T4` meant `love` and now binds `my`,
  and `1.T2` moves to the `oh` inside `Oh--oh`, with no refusal; the two cuts
  disagree on 10,553 such positions on 3,099 lines of the English corpus. A
  bare `N` and the named places (`end`, `endword`, `head`, `headrime`, `line`)
  are DEFINITIONS the grader applies to the line as the running reader cuts it
  (`lyric-harness/quality/slots.py`: `head` and `endword` take the word start, `end`,
  `headrime` and `T<k>` the last stressed syllable from there), so what they
  bind moves with the cut too: on the English corpus `end` is re-cut on 178
  lines and on 539 more the earlier cut skipped a numeral end the current one
  reads (a visible hole in `blocking` unless a reading is declared); `endword`
  is re-cut on 229 lines and names a different word on 1; `head` is re-cut on
  288; `headrime` on 284, plus 53 lines whose leading dashes only the current
  cut keeps out of the word. A named place is never converted to a number.
  - **Connector callers' held `N.Tn` members are an OPEN residual.** The
    owner approved extending commit 2's numbering marker to `groups` and
    `returns`; until it lands, a caller holding such members from before this
    release re-reads the line's words and re-declares them. Commit 1 does not
    close this.
  - **The website's rhyme links and declared returns** (team policy A): every
    row it writes carries `— cut v2` after its members (never sent to a tool).
    A member keeps the spelling the writer used: `2.end` (the end, named) stays
    `2.end` and a bare `4` stays `4`, through the migration, Keep, the forms,
    section reorder, export/import and what the tools receive, sibling groups
    included; `.end` is never added to a bare member. A member the page itself
    makes for the end is bare. The two do not always mean the same thing. In
    a rhyme groups row a bare `N` is the default end. In a RETURNS row a bare
    `N`, and `N.line`, is a WHOLE-LINE return (the harness's return class of
    line numbers: the line returns, no word is named), while `N.end`,
    `N.endword`, `N.head`, `N.headrime` and `N.T<k>` are PLACED returns (the
    word at that place returns); the harness refuses one class holding both.
    A whole-line return is never carried, annotated, labelled "last rhyme" or
    shown with a word, on any line, because no word cut can move what it
    names; the rules below apply to placed returns and rhyme-group members.
    A whole-line member an earlier version of this page annotated is named as
    a whole-line return in Review, with no word shown, and Keep drops the
    note.
    In an unmarked row (legacy by compatibility policy) a `N.Tk` is rebound by
    span identity, or kept under its old number as
    `N.Tk (numbered under the earlier cut)`, binding nothing and stopping every
    send until the writer removes the link and declares it again. A bare `N`
    or named place on a line whose earlier and current cuts differ ANYWHERE
    (the whole line: on 22 corpus lines the bound word's characters are the
    same under both cuts but the rhyme starts in an earlier word, the "double
    bass" shape) is kept named and marked
    `N.place (carried across the word-cut change)`: it is still sent and
    judged, and Review shows one notice per member naming the line, the place
    and the words the page shows there under each cut, with Keep the link /
    Remove it. Those words are the page's display, not the grader's evidence:
    the grader decides what the place binds. On a line whose cut did not
    change the member is carried silently and the row is not rewritten.
    A line also counts as changed when its cut is identical but the words
    the earlier grader looked up are not.
    - The cause: v1's `line_anchors` re-cut the words before the last from
      their space-joined text. That joined an enclitic the printed line sets
      apart to the word before it: `Below the knap, 's a runnèn still;`
      looked up `knap's`, and `When in that house M.P.'s divide,` looked up
      `P's` (P IY1 Z). The current reader reads `'s` alone, so the rhyme's
      start moves.
    - Measured on the English song corpus
      (`lyric-harness/quality/results/named_place_lookup_2026-10-14/`), out
      of 271,092 identical-cut sung lines:
      - 8 change their END binding, and the condition names all 8;
      - the condition fires on 24 lines in all, the 8 plus 16 where the
        lookup differs but the end anchor does not reach the joined word;
      - it fires on none of the other 271,068.
      - 7 more non-Latin lines differ only in the label's Unicode
        normalisation, with nothing bound under either scheme.
- **Pre-existing, not caused by this batch and not fixed in it** (BB8 #519
  6161601064, 3PO 6161637870). They are listed so they are not read as
  regressions:
  - A Library job refused `STALE_READING` (queued or paused across a
    release) still offers a Resume that cannot succeed
    (`src/library/analysis.js`: the Resume button shown for every paused,
    cancelled or failed job).
  - Under reader scheme v1, the default end slot's swap splices into an echo
    aside that repeats the end word (`my love (my love)` edits the aside).
    The v1 replay keeps that wrong edit byte-identical, because v1 is the
    pre-batch body verbatim (`lyric-harness/quality/loop.py` `swap_at_slot` docstring).
  - The standalone Library Site (`sites/library`) posts device pronunciation
    choices to the server without this release's migration.
  - The reviser can accept a candidate that deletes a word. On the empty-walk
    path the stock tier-2 proposer's `GroupBrief` carries an empty pivot
    (`pivot_word=''`), `default_propose_group` splices that empty string in,
    and `revise_loop` accepts the result: `['zap be free', 'zip me now',
    'zop see that']` with `1.head,2.head,3.head` becomes `[' be free',
    ' me now', 'zop  that']` (BB8 #527 6164278661). `67889851` and `fce4bf0f`
    do the same. It is a shared-loop candidate-validity question, separate
    from WHICH occurrence a splice edits, and it is not fixed here: changing
    what the loop accepts needs the owner's bounded approval. The slot
    receipts splice a non-empty marker, so they cannot see it, and they do not
    show that production candidates are safe.
  - Two items await the owner's scope decision and are not touched here: a
    retained 30-day Library chunk that saves declarations without their cut
    (F2), and the mixed-version deploy window between page, server and
    queued jobs (F3).
- **A run resumed under v1 resolves every place under v1.** A state recorded
  under reader scheme v1 (a pre-batch harness state replayed with the harness,
  or an explicit `--reader-scheme=v1`) keeps the whole pre-batch reading (D1):
  counts and named places alike resolve under the earlier cut, exactly as they
  did when the state was written.
- **A recorded reader scheme is absent or named; `null` is malformed.** A
  deferred state, a kitchen checkpoint, a replay file or an `answered` block
  without the `reader_scheme` field predates it and resumes as v1. A field that
  is present but holds `null` (or any name other than `v1`/`v2`) is malformed:
  the resume, `tryline`'s pre-flight, the checkpoint and the replay all refuse
  it with one message, before the record is touched. This build never writes
  `null`; only a hand-edited or foreign record holds one. Whether a connector
  caller can deliver such a record at all is established by source reading
  only, not by a test: the refusal is the harness's, wherever the record
  arrives from.
- **A word broken across the line end** (`king-` / `dom of daylight's…`): the
  current cut keeps the hyphen inside the token, and a hyphenated word reads
  only whole, so the declared-relation reader (the registered English reader a
  plain lexicon gets, fallback refused) read `king-` as no word while
  `line_anchors` read `king`, and a declared `broken rhyme` or `perfect rhyme`
  on that pair went unjudged. The relation stream now reads the printed part of
  the line-final broken word through the same phonology and its own fallback
  policy (`English.split_final_stem`), and only after the token itself read
  nothing (a declared reading of `king-` answers first). A numeral broken there
  (`2-`) and a printed boundary stay refused, and the bare word `king-` still
  has no reading. All five hyphen spellings give one verdict; v1 keeps its own
  answers (ASCII `-` only). On the English song corpus, 13 of the 18 lines that
  end on such a word (of 281,069) are now read in the stream; 5 stay refused.
  - The same holds when punctuation or a closing quote follows the hyphen
    (`king-,`, `king-.`, `king-;`, `king-'`), which `line_anchors` also reads as
    `king`: the stream reads the printed part, and the line is NOT split,
    because punctuation never makes the word continue on the next line. So a
    declared perfect rhyme holds and a declared broken rhyme is false, exactly
    as v1 answers. Before, these shapes were refused under v2 (both relations
    unjudged). On the English song corpus 2 lines end that way; 1 (`Boo-`) is
    now read and 1 (`Buce-`) stays refused, its stem having no reading.
- **A bare word is looked up as a token is.** Under v2,
  `pronunciation_variants` (and `English.parses`, `whole_reading` and the
  `types` verb built on it) looks a bare word up under the reader's entry
  normalisation, as `transcribe_word` and every line token already did, and a
  supplement row found that way is credited to its own source. v1 and declared
  readings are unchanged.

## What the money limits establish

The shared model ledger reserves an allowance before each network dispatch, across
chat and kitchen operations. The current reservation is calculated from serialized
request bytes plus 1024 input-token allowance, configured maximum output tokens,
and a separate 65,536-token thinking allowance (overridable with
`MODEL_THINKING_RESERVE_TOKENS`). These are conservative engineering assumptions
for the current text workflow, **not** a provider-certified maximum token count.
Changing models, modalities or the allowance requires rechecking those assumptions.

Settlement uses reported prompt, tool-input, candidate and thinking token counts at
the repository's declared input/output prices. This follows Google's documented
[usage categories](https://googleapis.github.io/js-genai/release_docs/classes/types.GenerateContentResponseUsageMetadata.html).
Cached token counts remain in the record; the current arithmetic charges all prompt
tokens at the ordinary input rate, without applying cache discounts. The resulting
USD figure is a conservative list-price calculation, not an invoice reconciliation.
Missing, malformed or inconsistent usage retains the reservation as unknown spend.

The proposer's bounded transport retry policy can issue a replacement after an
uncertain network failure. Every attempt reserves separately, and the earlier
attempt remains charged as unknown; this is not exactly-once provider execution.
Worker timeout/crash recovery never silently restarts that kitchen invocation.
An interrupted proposal without a journaled answer stops automatic continuation;
starting again from the accepted draft is an explicit fresh-run choice.

A reservation can stop work before the remaining allowance is actually exhausted.
Conversely, if reported usage exceeds the reserved amount, that request has already
occurred: the ledger records its reported cost and persistently blocks further paid
admission. The mechanism cannot retroactively prevent that one provider-side
overshoot. Unknown reservations survive a restart; completed usage is assigned to
the UTC day of settlement, and clock rollback closes admission rather than refunding
spend. These rules make the accounting limitations visible instead of assigning
missing usage a zero price.

## Offline regression coverage

Battery request capabilities are saved and encrypted for remote artifact upload
before each paid dispatch. Hosted execution refuses to dispatch if that upload
fails. Checkpoints and terminal verdicts are saved atomically, and later uploads
retain updated recovery records. A local-only run explicitly lacks hosted recovery
qualification. The release acceptance gate also requires an actual hosted archive
restore; local filesystem tests do not establish that external result.

Run `node --test mcp/test_job_store.mjs`. The suite uses real Express HTTP and real
filesystem writes, with fixture work instead of a paid model. It checks intent
before dispatch, concurrent duplicate rejection, lost-socket final recovery,
SIGKILL/restart interruption, safe checkpoint preservation, corrupt persisted
state, storage failure, bounded retention and recovered retry pacing. It does not
make live Gemini calls or deploy a service.


## Production contract after the audit

AI hosts connect to the shared `/mcp` endpoint, which serves both tool families
and keeps workflow sessions on the server; a lyrics session opened with
`begin_lyrics` in phase `create` enforces the creation order from receipts the
server records. The task-scoped views `/mcp/recipe` and `/mcp/lyrics` (used by the
maintained client) and the browser task selector dispatch only one tool family
and preserve the task outside the model transcript. Recipe creation uses Rich and
a maximum of 1,000 characters; its delivery is the engine's exact rendered string.
No endpoint can enforce a task an external host never states: `/mcp` serves
whichever family the host calls.

Direct lyric continuations require the returned `run_revision` with `run_id`.
A concurrent continuation or stale revision refuses before work starts. Original
replay input, accepted lines and immutable declarations have separate fields;
accepted lines never silently replace the replay input. The bounded state codec
identifies the scorer source, lexical data and runtime. Signed chat continuations
and worker recovery enforce the same identity. A mismatch preserves the original
artifact and refuses automatic replay; recover its accepted lyrics before starting
independent work under the changed implementation.

Completion is based on authenticated harness metadata containing requested-layer
coverage and the exact final draft. Display text cannot create a clean verdict.
The host's completion receipt hashes both the final draft and the exact delivered
text. An unknown, refused or incomplete layer cannot become a finished song.

`node mcp/check_live.mjs --commit=FULL_SHA --ready --config=render --image-manifest=lyrics-image.json`
checks the full MCP surface and initialization, exact tested image build identity,
lyrics readiness, durable recovery and effective public configuration.
`/health` remains a liveness endpoint. A successful
source test is not evidence of a completed paid song or a successful long wall
continuation; those require the maintained battery acceptance gate.
