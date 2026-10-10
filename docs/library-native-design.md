# Native Library tab: design for review (revision 3)

**Status: proposed, not implemented.** This is a review draft for R2 and 3PO. Nothing in it is approved. After R2 and 3PO agree, it goes to John, who makes the decisions listed under "Owner decisions". No implementation starts before then.

**What John asked for:**
- The Library becomes a native tab on codexmusica.com, as much a part of the site as Genre, Instrument, Map and Lyrics. No chatgpt.site URL and no link to another website.
- Every feature on day one, with no corners cut.
- No regression in the number of accessible works. The tab serves the current catalog, not the old Site's earlier snapshot.
- Loading must be measurably faster than the old Site.

**How this draft was produced:**
1. The Library app, the Render reader bridge, the catalog and rights data, and the site shell were mapped, and a critic pass corrected the maps.
2. Three independent designs were written: performance-first, parity-and-risk-first and operations-first.
3. Three judges scored them, on parity and rights, performance, and feasibility and operations.
4. The designs were synthesized into one, built on the performance-first design with the best parts of the other two.
5. Two red-team reviewers checked the synthesis against the code at `031b7de` and against a locally built copy of snapshot 317c.

The red team found 12 blocking defects and no architectural flaw. Revision 1 below resolves each of them. **Revision 3 amends Revision 2, which overrides Revision 1, which overrides the base design further down.** The base design is kept verbatim from the synthesis so reviewers can trace every change.

**Planned files:** new tool names written without a directory (for example `check_library_data.js`) are planned files under `scripts/` that do not exist yet.

**How to review:** comment inline on this file in PR #519 (Files tab), or post typed comments on #519 (`[FINDING]`, `[QUESTION]`, `[VERDICT]`). Line references are to `main` at `031b7de`.

---

## Summary

- **Route:** the fifth `UI_ROUTES` entry in `codex.html`. A small inline stub, plus SRI-pinned, same-origin code chunks loaded on first visit. No iframe and no other website. Deep links use `#library/works`, `#library/rights`, `#library/collections/<id>` and `#library/read/<id>?…`.
- **Reading data:** static files on GitHub Pages under `library/data/`, projected from the verified, rights-filtered site export of main's current catalog. That catalog is snapshot 317c5afa: 25,525 readable units against the old Site's 20,865, with all 20,865 old ids kept. Files are addressed by reading id and revision, never by snapshot, so unrelated `sources.tsv` edits change nothing on Pages.
- **Render (`mcp.codexmusica.com/library/v1`):** serves only what needs a server: exact search, metadata for held units, ZIP exports, the whole-corpus packages, and analysis.
  - Analysis identity is a random HttpOnly `__Host-` cookie that Render mints.
  - Job capabilities are re-derived on the server and never leave it.
  - There is no signing secret in the browser.
- **Performance:**
  - A `#library` boot skips the shell's catalog and engine waits, which cost 290 KB to 1 MB today. Shelves-ready needs about 3 requests and about 385 KB, all from Pages.
  - The target is at most 0.55× the old Site's time on mobile Slow 4G, with absolute caps of 4.5 s (shelves) and 4.8 s (reader).
- **No-regression gates:**
  - immutable per-id manifests for 5226 and 317c;
  - count, rights and label-census gates;
  - goldens captured from the Worker's own code;
  - an A/B timing gate that detects milestones identically on the old Site and the new tab.
- **Phasing:**
  - Everything is built behind a build flag, and the tab goes live in one cutover PR.
  - Render changes ship first, dark.
  - The old Site becomes a move page that redirects old links and offers device data for download. It is retired later, with John's go-ahead.

---

## Revision 3: narrow corrections from 3PO's second verdict

3PO's [verdict on `44577289c`](https://github.com/WeningerII/CodexMusica/pull/519#issuecomment-6101621407) found the nine earlier findings substantially addressed and asked for seven contract corrections and two clarifications, with no architectural rework. **Revision 3 amends the Revision 2 items it names.** Everything else in Revision 2 stands.

### C1 (amends V1). Reading paths carry projection identity, not only the revision
**Why:** `source_labels`, `source_basis` and `work_reviewed_equivalence` are added after the canonical revision is computed (`catalog_site_export.py:243-261`). A labels-only change would alter the bytes at an "immutable" URL.

**Contract:**
- Each reading's files live under `r/<hh>/<reading_unit_id>/<rev16>-<proj12>/`. `proj12` is the first 12 hex of the sha256 of the canonical projected head, which includes every enrichment and the page-file hashes.
- Page files are named by their own content hash. The head lists each page's sha256, and the client verifies it.
- Rows, `u/` shards and search results carry `rev16-proj12`.
- An enrichment-only change gives a new directory. The old directory's bytes never change.

**Gate:** in `check_library_data`, take a fixture with an unchanged revision and changed labels. The old URLs stay byte-identical (retained), a new `proj12` directory appears, and rows point to it.

### C2 (amends V1 retention). Retention never preserves a body that is no longer eligible
**Contract:**
- Every build revalidates **all retained generations** against current eligibility.
- When a unit is no longer readable, every retained file for it is deleted in the same commit, and its `u/` entry is removed.
- The client then gets 404, finds no shard entry, and falls back to the metadata-only UI through `/library/v1/metadata/:id`, with the "not readable" notice.
- Eligibility is judged per unit, so an independently eligible older edition is unaffected when another edition changes.

**Gate:**
- `check_library_data` asserts that no file in any retained generation belongs to a non-readable id.
- `check_library_page` stage `rights-correction` demotes a unit in a fixture. The retained URL is gone, and the tab shows metadata only.

### C3 (amends V3). Quota resynchronization is fenced by generation
**Contract:**
1. **Write intent.** Before a record commit, the writer writes `records/.pending` containing `{generation: g+1}`. After the commit it publishes `.generation = g+1` and removes `.pending`.
2. **Verification scan off the request path.**
   - The scan reads `.generation = g0` at the start and keeps an in-memory journal of the deltas this process applies during the scan.
   - At the end:
     - if `.generation` still equals `g0` plus this process's own commits, the result is `scan + journal`, and it replaces the counter;
     - if another process committed meanwhile, the result is discarded and the scan retries, at most 3 times, then rescheduled.
   - A scan never overwrites a counter with a mixed-generation total.
3. **Crash between commit and publication.** On open, if `.pending` exists or a record is newer than `.generation`, a full rescan is scheduled off the request path. Until it finishes, `_capacity` refuses any write that would come within `RESERVE_BYTES × 16` of the quota, so the counter can't under-count into an overrun.
4. **Bounds per maintenance tick:** ≤ 100 records, ≤ 500 objects, ≤ 64 MB of bytes read, and ≤ 50 ms of wall time, yielding between batches.

**Tests:** in `mcp/test_reader_store_bounds.mjs`:
- two store instances writing concurrently;
- writes during a verification scan;
- a crash injected between record commit and generation publication;
- a rescan converging to the full-scan truth.

The `store-load` budgets remain the implementation acceptance test.

### C4 (amends V4). Rollback compatibility is enforced outside the image
**Contract:**
- When phase B enables gzip writes, the store writes `store-format.json {"min_reader": "A"}`.
- The deploy and qualification workflows read the candidate image's reader-format label and refuse any image below `min_reader`. That is enforced outside the old image, which can't know about gzip.
- Render's dashboard rollback bypasses workflows, so the runbook forbids a dashboard rollback past phase A once `store-format.json` exists.
- **Rollback to before phase A** requires `scripts/reader_store_inflate.mjs`, run under the exclusive writer lock. It first checks free space ≥ the inflated size + 20%, writes plain objects beside the gzip ones, verifies each hash, then removes the gzip objects and `store-format.json`, and keeps a checksum manifest for recovery.
- Rolling back from B to A stays valid.

**Tests:**
- the deploy gate refuses a pre-A image when `store-format.json` exists;
- the inflate conversion on a fixture store, including a simulated out-of-space refusal and an interrupted run that resumes.

### C5 (amends V6). Corpus URLs use package identity
**Contract:**
- Corpus downloads are `GET /library/v1/corpus/<package_sha16>/<format>.zip`. `package_sha16` is the first 16 hex of the package's own sha256, already recorded in the package manifest.
- A whole-selection export maps to that URL.

**Test:** an unchanged snapshot with changed exporter code gives a new package sha, a new URL, and an old URL that answers 404 with the current URL in its error body. HEAD validation then re-plans.

### C6 (amends V7). Reauthorize on every activation
**Contract:** a fresh authorized `GET /library/v1/jobs/:id` returning 200 is required before reusing in-memory evidence on **every** activation of a reader or job view. That covers:
- route entry, including Back and Forward within the same document;
- switching to an evidence lens;
- returning to a hidden tab after more than 60 s.

This governs later rendering and access. It cannot erase bytes already shown.

**Test:** in `private-cache`, within one document: clear the cookie, then Back/Forward to the reading. No evidence renders from memory, and the "earlier browser session" message shows.

### C7 (amends the retirement purge). Positive evidence of old-Site ownership
**Contract:**
- The purge selector is an **allowlist** of `(job_id, viewer)` pairs exported from the old Site's D1 `library_jobs` bindings. John runs that export, since the repo holds no Sites credentials.
- A dry run lists the store records whose id **and** viewer both match. Unmatched or unknown records are left untouched.
- The purge runs only after John confirms the exact dry-run count at action time.

**Test:** the purge tool on a fixture store with matched, viewer-mismatched and unknown records. Only exact matches are selected, and the default is dry-run.

### Clarifications
- **B6 lookup:** "both snapshots contain this revision" is confirmed through `GET /library/v1/metadata/:id`, which returns the unit's `reading_revision`. `/health` carries no per-unit data. Static `projected_from` stays the provenance label.
- **V5 trade-off, stated for John:** refusing to export a historical analysis whose reading revision is no longer installed is a truthful fail-closed choice. It is **not** unchanged export availability: some older analyses that the old Site would have exported cannot be exported after a corpus revision, and the user is offered a re-run instead. This is added to owner decision 12.
- **Chunk reload recovery:**
  - Before reloading, the tab flushes pending device-state writes and verifies them by reading them back.
  - If persistence failed, it does **not** reload. It shows the existing "unsaved" state and offers the device-state download.
  - The existing save-failure and conflict safeguards are unchanged.

### Owner decision 12, reworded
Old private jobs and D1/R2 are not migrated. **Possible irreversible loss** is stated, and an export window comes before the move page. After a corpus revision, exports of older analyses are refused where the analysed revision is no longer installed, with a re-run offered instead. The purge uses the D1 allowlist and needs John's action-time confirmation of the exact count.

---

## Revision 2: answers to 3PO's verdict on `774435ca1`

3PO requested changes with nine blocking findings ([verdict](https://github.com/WeningerII/CodexMusica/pull/519#issuecomment-6101557150)). Revision 2 resolves each one with a contract, a decision and a named test. **Revision 2 overrides Revision 1 and the base design wherever they conflict.** R2 re-checked every code citation in the verdict against `031b7de` before writing this.

### V1. Reading files are addressed by revision, immutably
**Finding:** head and page files used id-only paths with query-string retries. Pages ignores query strings, and deploy caches could pair an old head with a new page.

**Contract:**
- Paths carry the revision:
  - `library/data/r/<hh>/<reading_unit_id>/<rev16>.json.gz` for the head;
  - `…/<rev16>.p<k>.json.gz` for the pages.
- A revision path never changes content once published, so mixed generations cannot occur by construction.
- Every head and page file embeds `{reading_unit_id, reading_revision, page_index, page_count}`. The client checks all four against what it requested and **fails closed** on any mismatch: discard, show no text, run recovery.
- **Where the revision comes from:**
  - list rows (`w/`, `c/`), search results and the tab's own links always carry `?revision=`, and the head preload uses it directly;
  - a deep link without one first fetches the `u/<hh>` shard (≤6 KB gz, one extra request), then the head.
- **Shards and indexes** (`catalog.json`, `collections.json`, `c/`, `w/`, `u/`) embed `data_id`.
  - A mismatch between them refetches the stale one with `cache: 'reload'`.
  - If the mismatch persists, the tab shows "The Library was just updated" with Reload, keeping the hash route.
- **Retention:** the previous generation's revision files are kept for 30 days after a revision changes. An open tab holding an old list keeps working, and when it next refreshes a shard it lands on the new revision by `line_id` with a notice.
- **Recovery on 404:** after 30 days, or for a revision never published, the tab refetches the `u/` shard (`cache: 'reload'`) and opens the current revision with the "This reading was updated" notice, landing by `line_id` where it exists.

**Tests:**
- `check_library_page` stage `generations`:
  - (a) an old head with a new page, and (b) a new head with an old page, both served by `_pages_server` on purpose: the client rejects each and recovers;
  - (c) a 404 on a retired revision recovers to the current one;
  - (d) a `data_id` mismatch between `catalog.json` and `c/` triggers a reload, then the update notice.
- `check_library_data` asserts that every file's embedded identity equals its path.

### V2. Deep pages carry their own global coordinates
**Finding:** ranges derived by cumulative sums need every preceding page, but a deep link fetches only the head and the requested page.

**Contract:**
- Every page file's header carries its page-start global offsets: `{row_start, analysis_line_start, normalized_cp_start, normalized_utf16_start, physical_line_start}`.
- Within a page, ranges are derived cumulatively from those starts.
- The head file carries the same for page 0.
- No coordinate ever depends on a page that wasn't fetched.

**Tests:**
- `check_library_data` asserts that every page's start offsets equal the canonical reading's, and that the derived per-line normalized code-point and UTF-16 ranges equal canonical for every line of every unit.
- `check_library_page` stage `deep-offset` opens `?offset=500` and `?offset=22500` (Kalevala) and an astral-plane and RTL fixture at offset ≥ 500. It asserts:
  - only the head and the target page were requested (request log);
  - the `?span` marks land on the canonical characters.

### V3. Bounded store maintenance off the request path
**Finding (source-confirmed, not a measured production failure):** every authorized read runs `_touch` → `_save` → `_capacity` → `_usage`, which stats every record and evidence object (`reader_job_store.js:295-328, 385-389, 1005-1006`). Every `_open` also runs `_reload`, `_prune` and `_collect` under the writer lock. A record cache alone does not fix this.

**Contract (store changes, all before `LIBRARY_PUBLIC=1`):**
1. **Bounded durable touches.**
   - A read refreshes `accessed_at` and `expires_at` in memory.
   - It persists them durably only when the stored `expires_at` is more than 1 hour stale.
   - Effect: at most one touch-write per job per hour.
   - A crash loses at most 1 hour of sliding retention, which is stated in READER_RUNTIME.md.
2. **Incremental quota accounting.**
   - Usage is held as an in-memory counter. One full scan initializes it at open, and again whenever the on-disk generation counter changes because another writer committed.
   - Every write and delete applies its exact byte delta under the lock.
   - A verification scan runs off the request path, in chunks of ≤ 200 entries per `setImmediate` tick, every 15 minutes. A discrepancy re-bases the counter and logs `READER_USAGE_DRIFT` with both values.
   - `_capacity` reads the counter and never scans.
3. **Off-loop maintenance.** `_prune` and `_collect` (expiry and garbage collection) move from `_open` to a timer: one bounded batch of ≤ 100 records per minute, under the same writer lock. An expired job is still refused at read time by its `expires_at`, so correctness never depends on the sweep having run.
4. **Read path.**
   - Records are cached in memory, validated by an atomically written generation counter (`records/.generation`).
   - A read takes no exclusive lock unless it writes (a due touch).
   - Writers keep the existing `wx` lock, fencing, `atomicWrite` and digest checks unchanged.

**Tests:**
- `mcp/test_reader_store_bounds.mjs`:
  - delta accounting equals a full scan after a randomized sequence of creates, checkpoints, deletes and expiries;
  - a crash between a write and a counter update re-bases on reopen;
  - the touch interval is honored;
  - expired-but-unswept jobs are refused.
- `qualify_reader` scenario `store-load`: 2,000 evidence-bearing jobs, expiry in progress, and concurrent checkpoint writes from the scheduler, with 20 pollers. Budgets:
  - server-side job GET p99 ≤ 25 ms;
  - event-loop delay p99 ≤ 50 ms;
  - `/mcp` `tools/list` p99 within +20 ms of the no-load run.

### V4. Compression at rest supports both consumers, ships in two phases, and needs scoped owner approval
**Finding:** `workerPayload` hands `worker.py` physical page paths, which it opens as UTF-8 JSON (`reader_job_store.js:1101-1116`; `worker.py:74-87`). Sniffing in Node alone breaks checkpoint and resume.

**Contract:**
- **One reader in each runtime:**
  - Node `readPageObject(path)` and Python `read_page_object(path)` both sniff `1f 8b`.
  - Each inflates with a hard output bound equal to `READER_LIMITS.objectBytes`, refusing with `STORAGE_CORRUPT` beyond it, and verifies `sha256(uncompressed) == name`.
  - Plain objects are read as today.
  - `worker.py` `load_records` and every Node object read go through these functions.
- **Identity is unchanged:** sha256 over the uncompressed bytes. The served `Content-Encoding: gzip` bytes are the stored bytes. The client verifies the uncompressed hash.
- **Two-phase rollout, for rollback safety:**
  - **Phase A** ships the dual readers and still writes plain objects. Rolling back past A is always safe.
  - **Phase B** is a later deploy, after A has run qualified in production. It turns on gzip writes with `READER_STORE_GZIP=1`.
  - Rolling back from B to A is safe because A reads both.
  - Rolling back past A while gzip objects exist is refused by a startup check: an image without `readPageObject` finds `.gz`-magic objects and fails readiness loudly rather than misreading them.
  - `scripts/reader_store_inflate.mjs` converts a store back to plain objects if ever needed.

**Tests:**
- mixed plain and gzip objects in one job;
- checkpoint, then restart, then resume through `worker.py`;
- an inflation bomb refused;
- hash mismatch refused;
- rollback B → A reads everything;
- the old-image startup check fails on gzip objects.

**Owner decision (scoped):**
- Approve the phase-B switch for the shared reader store, about 18× capacity.
- Alternative: keep plain objects and raise `READER_STORAGE_MAX_BYTES` within the 1 GB disk. PR 1 measures the disk's other occupants before quoting a safe figure.
- With neither, public analysis capacity is about 100 analyses per 30 days.

### V5. Exports of older analyses never mix generations
**Finding:** job identity pins the reading revision, engine commit and resource fingerprint (`reader_scheduler.js:285-301`), but the design packaged the current image's reading, METHODS and schema.

**Contract:**
- **Definitions are retained by fingerprint.** At job creation, the store keeps content-addressed copies of the exact `methods.json` and result schema in force, about 0.3 MB once per distinct fingerprint, deduplicated. The job record references their hashes.
  - An analysis export emits `ANALYSIS/METHODS.json` and `RESULT_SCHEMA.json` from those retained copies.
  - `PROVENANCE.json` names the job's own `engine_commit`, `resource_fingerprint` and `snapshot_id`, never the current image's.
- **Reading entries** (READINGS, TRANSCRIPTIONS, PROVENANCE, ATTRIBUTIONS, NOTICES) are emitted only when the current image holds the job's exact `reading_revision`. Revisions are content hashes, so the bytes are the ones analysed.
  - Otherwise the export is refused with `409 EXPORT_READING_CHANGED`, and the UI offers "Run again on the current reading". The evidence stays viewable in the tab, labelled "Generated by engine `<commit8>` on revision `<rev8>`".
- **Jobs created before this change** have no retained definitions. Their export is refused with `409 EXPORT_DEFINITIONS_UNAVAILABLE` unless their fingerprint equals the current one.

**Tests:** `test_library_exports` scenario `generation`:
1. Create a job.
2. Redeploy a fixture runtime with a changed methods file, then export. The retained definitions are emitted, and PROVENANCE names the old fingerprint.
3. Redeploy with the reading revised, then export: 409 `EXPORT_READING_CHANGED`.
4. A pre-change job with a different fingerprint: 409 `EXPORT_DEFINITIONS_UNAVAILABLE`.

### V6. A selection export is identified by its exact content, not its membership
**Finding:** `set_id` hashed readable ids only, so new revisions, or a snapshot-only provenance change, produced different bytes at the same URL.

**Contract:**
- **Two identities:**
  - `membership_id = sha256(sorted ids)`, used only for "is this selection still valid";
  - `content_id = sha256(canonical {exporter_version, format, snapshot_id embedded in PROVENANCE, rights_registry_sha256, sorted [id, reading_revision] pairs})`.
  - The bytes are a deterministic function of the `content_id` inputs.
- **The plan is server-held, so no bitset appears in any URL or log.**
  - `POST /library/v1/exports/plan {reading_unit_ids, format}` returns `{content_id, bytes, entries, url: /library/v1/exports/p/<content_id>.zip}`.
  - The server keeps the plan in a process-local LRU: 2,000 plans, 1 hour each, about 9 MB at the 4.3 KB maximum.
- **On GET** the server recomputes `content_id` from the held plan against the installed snapshot.
  - Any difference returns `409 PLAN_STALE`.
  - An evicted plan (restart or TTL) returns `409 PLAN_EXPIRED`.
  - The client's pre-navigation HEAD (B4) catches both and re-plans transparently from its stored ids. The stored `pending-export` holds `{format, ids}`, never a URL.
- A selection covering every readable unit maps to the prebuilt corpus package, whose URL is already content-addressed by snapshot.

**Tests:**
- (a) revision churn: same ids, one revision changed, so `content_id` changes, the old URL gets `PLAN_STALE`, and the re-plan downloads new bytes;
- (b) snapshot-only churn: `sources.tsv` edited, no unit changed, so `content_id` changes through the PROVENANCE snapshot, and the same flow follows;
- (c) restart, then `PLAN_EXPIRED`, then re-plan;
- (d) the same plan twice yields identical sha256;
- (e) no `sel=` or id list appears in any request URL (request-log assertion).

### V7. Authenticated responses stay no-store; nothing private renders without a fresh authorization
**Finding:** 7-day immutable private caching plus an IndexedDB evidence store could render evidence after cookie loss or deletion, unlike today's `private, no-store` (`reader_routes.js:339,365`).

**Contract:**
- Every credentialed `/library/v1` response, job, manifest, page and analysis export alike, is sent with `Cache-Control: private, no-store`, as today.
- **No persistent evidence cache.** The IndexedDB `evidence` store is removed. Verified pages live in a per-tab in-memory cache only.
- Before any evidence renders, the tab makes a fresh `GET /library/v1/jobs/:id` in that page lifetime and gets a 200. It then shows only pages whose hashes appear in the manifest that response names.
- On 404 (cookie lost or another viewer), 410 (expired or deleted) or a local Delete, that job's in-memory pages are dropped at once, and the device key `interpretation:{id}:{revision}` keeps only the declarations, not the job reference.
- Offline retention of private evidence is **not** proposed. It would be a separate, explicit product decision.

**Tests:** `check_library_page` stage `private-cache`, run with a warmed browser:
- (a) clear the cookie and reopen the reading: no evidence renders, and the "earlier browser session" message shows;
- (b) delete the job, Back, Forward: nothing renders from cache;
- (c) expire the job server-side and reload: 410 handled, nothing renders;
- (d) response headers on every credentialed route are `no-store`.

### V8. Timing harness: a recorded synthetic comparison plus an authoritative real-host comparison
**Finding:** HAR wait time already includes network, adding throttling double-counts it, and Playwright's HAR replay ignores recorded timing.

**Contract:**
- **Synthetic CI comparison, labelled synthetic in every report.**
  - The old Site's responses (bodies, headers, content-encoding and the recorded `202` → `200` manifest sequence, with its exact 202 count) are pinned as fixtures.
  - They are served through `_pages_server` with **zero server delay**, the same as the new tab's static files, under identical CDP throttling.
  - The old client's own 500 ms manifest polling runs unchanged.
  - Any unmatched request aborts the run (strict no-live fallback).
  - This isolates client and payload differences. It does not claim production timing.
- **Server delay is measured, not inferred.**
  - PR 0 measures old-Site server time separately as TTFB minus a same-connection baseline RTT, n ≥ 30 per endpoint from the same runner. It is reported as a modelled-delay table.
  - A second synthetic profile replays with those measured delays, and the report shows both.
- **Calibration.** PR 0 runs the old Site live from the runner n = 9 times and reports synthetic-vs-live medians as a calibration ratio. No threshold uses an uncalibrated synthetic number.
- **Authoritative comparison: real hosts.**
  - Both the old Site and the new tab are run live, on the same runner, with the same throttling, interleaved, n ≥ 9 per side.
  - Before cutover this uses the production preview; if John declines the preview, it happens immediately after cutover with a rollback rule.

**Tests:** `check_library_perf` refuses to emit a ratio when:
- the two sides used different modes;
- a fixture request was unmatched;
- calibration is missing.

The report labels every number synthetic, synthetic plus modelled delay, or live.

### V9. "Measurably faster" is a real-host improvement condition plus caps, with a stricter definition of ready
**Contract:**
- **Pass requires both:**
  - (a) the absolute caps: mobile shelves-ready ≤ 4.5 s, reader-ready ≤ 4.8 s;
  - (b) a **live same-scenario improvement**: the new median ≤ `(1 − m)` × the old median, with the bootstrap 95% CI of the difference excluding zero.
- **The margin `m` is John's to set.** Recommended: 0.45, which is ≤ 0.55×.
- A 4.4 s new time against a 4.0 s old one therefore fails, whatever the cap.
- **Ready means usable, measured the same way on both sides:**
  1. the target element is in the viewport and painted: IntersectionObserver ratio > 0, computed visibility, a non-zero box;
  2. text is rendered in its final or fallback font after `document.fonts` settles, or within 100 ms;
  3. no `aria-busy`, skeleton or loading indicator remains in that region;
  4. an **immediate-action probe** passes:
     - shelves: activating the first card's Open starts navigation within 100 ms;
     - reader: Next page or a line toggle responds within 100 ms;
     - both run during the deferred workspace boot.

**Tests:** `check_library_perf` implements the four conditions identically for old and new, and asserts the probe during deferred boot.

---

### Answers to 3PO's specific points, adopted

| Point | Adopted contract |
|---|---|
| **B6 snapshot labels** | Static `projected_from`, labelled accurately. The "both contain this revision" note appears only after confirming revision equality with Render's `/library/v1/health` revision for that unit. The provenance gate compares against the **Worker's own provenance download bytes**, including its enrichments (source_basis, labels, notices), for the golden sample, and against a canonical rebuild for every unit. |
| **B7 limits** | Each limit goes to John with its **exact consequence**: a 12-per-IP outstanding cap means a 7th viewer behind one network address, each running 2, is refused; 2 export streams per IP means a 3rd simultaneous download from that network waits for Retry-After; 6 corpus starts per IP per day means a classroom of 7 can't each start one. Options are listed with no ceiling, per abuse model. **One precise long-reading rule:** a reading with more than 5,000 analysis lines may have at most **one** queued or running job service-wide, and a second gets `429 LONG_READING_BUSY` with Retry-After. Tests cover boundary users (exactly at, one over), FIFO retry fairness under a held cap, and 7 viewers behind one IP. |
| **Coverage classifier** | Adds `unchanged-non-readable` and every non-readable↔non-readable transition (held, research-only, rejected, metadata-only). The report **reconciles every id**: the class totals sum to 32,220 baseline ids plus the added ones, and to 36,880 current ids. No new 5226→317c rerun, since 3PO's exact-snapshot reconstruction stands for unchanged inputs; the gate enforces it from now on. |
| **Feature matrix** | Adds row 60: **reader-side Method reference filtering** (the reader's Method select over `method_id`, `reader.tsx:96,681,1044`, and its own reference list at 1111), separate from the Rights page's definition filter. |
| **Migration shapes** | Fixtures for the real old shapes: `export-selection:<snap>` as `string[]` of ids only; `position:<snap>:<id>` as `{line_id, offset}` **or a legacy bare string**; `interpretation:<snap>:<id>:<rev>` as `{declarations, job_id?, previous?: [{id, declarations}]}`; `analysis-export:<job>:<hash>`; `pending-export`; `shelf-position:<lang>` as a number. Revisions resolve through the committed **5226 manifest** using the snapshot in the key. **All `previous[].declarations` sets are carried** as declaration history; job ids are dropped. Entries whose revision changed are kept with a notice, landing by `line_id` when the line exists. Nothing is silently rejected or flattened, and the import report lists every entry with its outcome. |
| **Rights** | The static projection stays strictly within verified eligibility, and existing exposure never justifies widening it. The Pages exposure of held corpus files is a separate, scoped decision. John's approval never substitutes for rights evidence. |
| **Retirement** | Loss is stated plainly. A re-run may **not** reproduce old evidence if the engine or resources changed, and that loss can be irreversible. Before the move page, the old Site announces a window to export analyses. **Purge selector:** existing records hold no site id, so the selector is "viewer not matching `^lv1:` and `created_at` before the cutover time". It runs only with John's **action-time** confirmation of the exact count; design agreement is not that confirmation. |
| **Privacy wording** | "Library device data stays in your browser, except what you submit: search terms, declarations sent with an analysis, and selections sent to plan an export." Selection bitsets no longer appear in URLs (V6). |
| **Evidence wording** | Old boot, from code: manifest, then (serial catalog pages ‖ methods) via `Promise.all`, then shelves (`library-app.tsx:469-485`). PSI's five catalog entries were the largest-payload subset, omitting `offset=1000`, not a measured complete waterfall. The baseline is re-stated that way. |
| **Chunk generations** | Chunk files are kept for **30 days across all generations**, about 70 KB gz per generation, rather than one previous generation. A tab opened days earlier still loads its chunks. Past 30 days, the recovery saves in-memory Library state (passage selection, filter text, inspector and lens) to `sessionStorage` and reloads to the same hash, which restores it. Test: two deployments between page load and the first reader and analysis use. |

### Revision 2: owner decisions, consolidated (replaces the earlier lists)
1. Data plane split: static reading on Pages; search, held metadata, exports, corpus and analysis on Render. *Recommended: approve.*
2. READER_RUNTIME.md amendment: the public `/library/v1` family, an unsigned HttpOnly `__Host-` viewer cookie, capabilities derived in-process, and the no-capability rule kept verbatim. *Recommended: approve.*
3. Reader store capacity (V4): phase-B gzip at rest, or a quota raise sized from PR 1's disk measurement. *Recommended: gzip, two-phase.*
4. Rate limits and the long-reading rule (B7 table, with consequences). *John chooses each value.*
5. "Measurably faster" margin `m` (V9). *Recommended: 0.45.*
6. Production preview before cutover, for the live comparison. *Recommended: yes.*
7. Whole-corpus packages on Render with Range. *Recommended: approve and accept egress.*
8. Held and research-only metadata on codexmusica.com, as the old Site shows it, including radif-bearing titles; bodies and labels refused. *Recommended: keep.*
9. Public serving of USA-only Gutenberg admissions, with the USA statement shown. *Recommended: confirm.*
10. "Open in Lyrics" in the same tab. *Recommended: approve.*
11. Final Sites deploy as a move page: export window, device-data download, redirects, 410 for the API, kept 12 months. *Recommended: yes.*
12. Old private jobs and D1/R2: not migrated, loss stated; purge only with action-time confirmation. *Recommended: accept the plan; confirm at action time.*
13. Retire 5226, `/internal/reader` and the bridge secrets after the move page. *Recommended: yes.*
14. Navigation entry, recipe panel mode, deferred workspace, derived brand mark. *Recommended: approve.*
15. Pre-existing exposure of held corpus files on Pages: a **separate decision**, alongside cutover.

---

## Revision 1: red-team blockers and their resolutions

Each entry gives the defect, the resolution adopted, and the gate that keeps it fixed. Figures marked *measured* came from the red team's run on 317c, and R2 re-checked the language counts.

### B1. Default Works and collection rows lost the snippet and contributor text
**Defect:** the old table shows `snippet`, the first 180 code points of the folded body, even without a query, plus `contributor_search` (`library-api.ts:360-367`; `library-app.tsx:1223,1231-1233`). The static `w/` and `c/` rows carry neither, so every row would show `source_path` and a structured contributor list instead.

**Resolution:**
- `w/` and `c/` rows gain `snippet` and `contributor_search`, using the Worker's own definitions: snippet is `substr(search.text, 1, 180)` in code points of the folded body.
- Estimated cost: about +2 MB gz each for `w/` and `c/` (25,525 × ≤180 code points). PR 2 measures it and re-sets the budgets.

**Gate:** `check_library_data`'s order-parity differential becomes a **row-content** differential. It compares title, snippet, contributor_search, edition8, work8, completeness and availability against Python `sqlite3` running the Worker's exact SQL over the same summaries.

### B2. The language filter lost Sanskrit and Malay; held-only collections had no static presence
**Defect:** the old filter lists every language that appears in *any* collection, including held ones (`library-app.tsx:1355-1358`). R2 re-checked this on the local 317c build:
- all 2,327 collections cover eng, ltc, fas, fin, cym, non, san and msa;
- the 2,279 readable collections cover only eng, ltc, cym, non, fin and fas.

There are 48 collections with no readable unit, and a deep link to one of them has no title source.

**Resolution:**
- `catalog.json` carries the full recorded-language list for the filter, separate from the readable shelf list.
- `collections.json` lists **all 2,327 collections** with their readable count. The rail and shelves show only collections with readable > 0. This adds 48 rows; titles are metadata the old Site already published.
- A deep link to a collection with no readable unit opens a Render search with `collection=<id>`, under the static title.

**Gate:** `check_library_page` asserts the filter offers exactly the old option set, computed from all collections. `check_library_data` asserts that `collections.json` covers every collection id in the manifest.

### B3. Card Play opened a different reading for cards past the first 12
**Defect:** the old Play opens `readable_reading_unit_ids[0]` in **catalog order** (`library-app.tsx:1310-1313`). The design fell back to the head of `c/`, which is in display (title) order. Measured: those differ in 707 of 2,279 readable collections.

**Resolution:**
- The head of each `c/<collection_id>` file keeps `readable_ids` in **catalog order**. Display rows are sorted separately by `(title_search, id)`.
- Play uses `readable_ids[0]`. The `c/` head is already prefetched on card hover or focus.
- This avoids putting 2,279 more UUIDs into `collections.json`, which would break its budget.

**Gate:** `check_library_data` asserts that Play's target equals `readable_reading_unit_ids[0]` for every readable collection.

### B4. Downloads started by navigating an anchor cannot see errors and can replace the tab with raw JSON
**Defect:** a page never sees the status of a navigation it starts, and the `download` attribute is ignored across origins. So the 409, 404 and 429 recovery the design promised cannot be built, and an error body would replace codexmusica.com, losing the reader's state.

**Resolution:**
1. **Validate before navigating.**
   - Every download first sends a CORS `HEAD` to the same URL: credentialed for analysis exports, uncredentialed for selection and corpus downloads.
   - The page handles 409 `SET_CHANGED` / `SELECTION_UNAVAILABLE` (re-plan or name the ids), 404 (earlier browser session) and 429 (shows Retry-After) in place.
   - It navigates only after a 200.
2. **No error can replace the page.** Every error on a download path is served with `Content-Disposition: attachment; filename="library-download-error.txt"`. Even a race between HEAD and GET then produces a small file, never a page swap.

**Gate:** a `check_library_page` stage forces 409, 404 and 429 on each download path. It asserts the tab stays on `#library` with an in-page message, and that a forced GET-time error produces an attachment, not a navigation.

### B5. A byte-equal golden for analysis-export `REQUEST.json` cannot pass
**Defect:** the Worker wrote the browser's raw POST bytes, including the client-sent `snapshot_id`, `idempotency_key` and key order (`library-api.ts:518,581-588`; `library-exports.ts:666-683`). The new client no longer sends `snapshot_id`, so byte equality with the Worker is impossible by construction.

**Resolution:**
- Declare it an **intentional, documented difference**.
- The server persists the exact accepted request as a sidecar object next to the job, with the server-filled `snapshot_id`, in canonical form. It is deleted with the job, and `ANALYSIS/REQUEST.json` emits those bytes verbatim.

**Gate:** the analysis-export golden becomes entry-level parity.
- Every entry is byte-equal except `REQUEST.json`.
- `REQUEST.json` is compared field by field on reading_unit_id, reading_revision, declaration_set, requested_layers, requested_methods and snapshot_id.

The PR 0 golden needs a live reader job: library-site.yml runs the image's reader backend for one short poem (22-26 s of CPU).

### B6. The snapshot label goes stale after an unrelated `sources.tsv` change
**Defect:** the static plane carries `projected_from.snapshot_id`, which deliberately does not churn. The provenance download, the Sources lens, the topline and the Lyrics envelope's `snapshotId` all use it, while analysis shows Render's snapshot. After churn the two disagree, and the provenance byte-equality gate is ambiguous.

**Resolution (an explicit decision):**
- `projected_from` is **truthful**: that snapshot contains exactly this revision, and anyone can rebuild it from the recorded commit. Main's newest snapshot may not even be deployed yet.
- The UI labels both values honestly:
  - the topline and Sources lens show **"Readings: snapshot X"**, the projection;
  - analysis shows **"Analysed on snapshot Y"**, from Render.
  - When X ≠ Y, the Sources lens explains that both contain this exact revision, after checking that the revisions match.
- The provenance download and the Lyrics envelope use `projected_from`.
- The nightly `library-data` job regenerates `catalog.json` only when content changes. So `projected_from` can lag main's label, and that lag is documented.

**Gate:** the provenance byte-equality gate states that it compares against a reference rebuilt with `snapshot_id = projected_from.snapshot_id`.

**Alternative for 3PO to weigh:** fetch `snapshot_id` from Render `/library/v1/health` at download time, and fall back to `projected_from` with a "projected from" label. R2 recommends the static label because it keeps provenance working through Render outages.

### B7. New per-IP limits restricted what the old Site allowed, without John's decision
**Defect:** the old Site had no rate limiter. Its only bounds were 2 outstanding analyses per viewer and 16 waiting globally. Per-IP limits would penalize shared NAT (schools, offices).

**Resolution:**
- The binding analysis limits move to **per viewer**: 2 outstanding per viewer, as before, and creates at 30/h per viewer.
- Per-IP limits become **abuse ceilings** sized so a shared IP cannot plausibly reach them.
- Every new limit, compared with the old behaviour, goes to John as an owner decision:

| Traffic | Old Site | Proposed |
|---|---|---|
| search | none | 600/min per IP (abuse ceiling), with Retry-After shown in the UI |
| analysis outstanding | 2 per viewer, 16 waiting globally | 2 per viewer (unchanged); 12 per IP ceiling; 16 waiting globally (unchanged) |
| analysis creates | none | 30/h per viewer; 120/h per IP ceiling |
| job reads | none (Worker relay) | 600/min per IP, plus client poll backoff (3 s, rising to 15 s after 2 min) |
| cancel / resume / delete | none | 120/h per viewer |
| cookie mints | n/a | 30/h per IP |
| export plans | none | 120/h per IP |
| export streams | none (step loop) | 2 concurrent per IP, 4 globally, with an idle timeout and a minimum transfer rate |
| corpus downloads | none | 6/day per IP (Range-less starts only), 2 concurrent globally, with an idle timeout and a minimum transfer rate |

**Gate:** `test_library_routes` runs 3 viewers behind one IP, each running 2 analyses, and all succeed.

### B8. `catalog.json` measured over its own 4,096 B budget
**Defect:** measured at 4,853 B gz, or 5,050 B with rendition paths. The artwork credit, source and note strings were what pushed it over.

**Resolution:**
- `catalog.json` keeps only `art_id`, and rendition paths are derived from it.
- The credit, source and note text moves to `library/data/artwork.json`. That file is fetched by Sources & rights, the card ⋮ menu or the lightbox, never on the shelves path.
- B2's full-language list adds about 60 B.
- The budget row stays at 4,096 B, and PR 2 re-measures before it is fixed. Measured without artwork records: 3,733 B.

**Gate:** `check_library_data` keeps `catalog.json` at ≤ 4,096 B gz.

### B9. Gates that run the embedded build or `file://` could not reach the Library
**Defect:**
- `check_workbench` and `ui_reachability_check` run the embedded build (jsdom or `file://`), where the design fetches nothing.
- `check_lazy_app`'s first-view rule needs the lazy and embedded bodies to be byte-identical, which any drawn `#library` state breaks.

So several feature-matrix tests could not pass as written.

**Resolution:**
- The Library takes its data and API bases from its own injected constants, `LIBRARY_DATA_BASE` and `LIBRARY_API_BASE`, never from `CODEX_LAZY_API`.
- The Library sections of `ui_reachability_check`, `check_workbench` and `check_mobile_layout` run against the **flagged lazy build**. `_pages_server.js` serves it with the fixture `library/data` tree and a local mcp server built on a fixture snapshot.
- `#library` is **excluded** from `check_lazy_app`'s lazy/embedded first-view equality. A Library-specific first-view gate replaces it: the stub skeleton is byte-identical in both builds, and the data-bearing view is tested only in the lazy build.
- The feature matrix names the build each test runs: lazy-flagged, embedded or production preview.
- jsdom gets shims for DecompressionStream, IndexedDB and `crypto.subtle`, or those tests run in Playwright instead.

**Gate:** each feature-matrix row names an executable test in a build that can reach its data. `check_library_page` fails if a cited test id does not exist.

### B10. Heavy synchronous work on Render's shared event loop (search-hit projection, export sizing)
**Defect:**
- Search-hit projection parses the canonical reading. Kalevala's is 33 MB: measured at 425-477 ms blocked and +131 MB heap, and too large for the 64 MB LRU, so it is re-parsed on every hit.
- Exact-length selection plans would scan up to 2.2 GB of readings.
- All of this runs on the event loop that also serves `/mcp` and `/chat`.

**Resolution:**
- At image build, `search_store.py` precomputes per-unit projection tables:
  - folded-body offset to row index;
  - per row, the line-id seed and the code-point, UTF-16 and source ranges, read by offset;
  - the per-unit entry sizes and CRC32 of every ZIP entry: READINGS `.json`, `.txt` and `.csv`, TRANSCRIPTIONS, PROVENANCE, ATTRIBUTIONS and NOTICES.
- Hit projection and plans then become table lookups, and streams copy pre-derived bytes.
- **No canonical reading is ever parsed with `JSON.parse` on a request path.** Any residual parse runs in a `worker_thread` with concurrency 1 and a size cap.

**Gate:** a `qualify_reader` scenario runs a Kalevala search hit and a near-full selection plan concurrently with `lyric_grade`. It asserts thresholds on event-loop delay p99, peak RSS and `/mcp` latency.

### B11. Public job polling re-reads and re-hashes every reader record synchronously
**Defect:** every store read goes through `_open`, which takes an exclusive lock file, runs `readdirSync` over every record, and parses and hashes each one (`reader_job_store.js:220-289,391-395`). At public polling rates, and with about 1,800 retained jobs after gzip-at-rest, that runs on the shared event loop.

**Resolution:**
- `ReaderJobStore` gains an in-memory record cache, validated by a generation counter written atomically on each save. Reads then re-validate only records that changed.
- Client polling backs off (see B7).
- This lands before `LIBRARY_PUBLIC=1`.

**Gate:** a `qualify_reader` load test with 2,000 records and 20 concurrent pollers, with thresholds on event-loop delay and `/mcp` and `/chat` latency.

### B12. The old-versus-new timing gate measured the two sides over different networks
**Defect:** the old Site was measured over the live internet, the new tab against a local Pages emulator. The 0.55× ratio could pass without showing a real production improvement.

**Resolution:**
- **Same path in CI.** PR 0 records the old Site's responses as a HAR, with Worker timing kept as server delay. They replay through the same `_pages_server` and the same CDP throttling as the new tab.
- **Production acceptance before cutover.** The production preview (`?library-preview=1`) becomes the recommended pre-cutover acceptance step. Both sides are timed against real hosts with identical throttling, plus a PageSpeed Insights run (n ≥ 5).
- The absolute caps (4.5 s / 4.8 s mobile) are the primary pass/fail, and the ratio is reported as evidence.
- If John declines the preview, the same run happens immediately after cutover, with a rollback criterion: revert if a cap fails.

**Gate:** `check_library_perf` records the HAR provenance (date, runner, URL list). It refuses to compute a ratio when the two sides used different paths.

---

## Revision 1: non-blocking review notes and how each is handled

| # | Note | Disposition |
|---|---|---|
| N1 | "Open in Lyrics" changes from a new tab (old `window.open`) to the same tab (push `#lyrics`; Back returns). | Listed as an **owner decision**, with same-tab recommended because Back returns to the reading and nothing opens in a new window. A visible behaviour difference, not presented as parity. |
| N2 | Shelves show 12 cards per language until `collections.json` arrives, so a saved shelf position past card 12 would jump. | When a stored `shelf-position` exceeds the cards in `catalog.json`, fetch `collections.json` on the critical path for that boot only. The restore is deferred and swapped in place without layout shift. Tested. |
| N3 | A deep link to a held unit has no `r/` file. | Fetch `/library/v1/metadata/:id` and show the metadata sheet with the old "not readable" notice. Tested. |
| N4 | The `codex.html` growth claim (+3.5 KB gz) is inconsistent with a 4 KB stub budget plus the shell additions. | PR 3 measures the marginal cost against a base that already has the derived brand mark. Budgets are re-set from that measurement: stub ≤ 4 KB, total `codex.html` growth ≤ 6 KB gz. That stays inside the existing 33,772 B page headroom, so no budget raise is needed. The existing-route gate allows the measured growth. |
| N5 | "A reading's revision hashes only its own rights rows" is imprecise: `reading_revision = sha(reading)`. | Reworded: the revision hashes the whole reading, which embeds only its own `sources.tsv` rows, so the churn conclusion holds. |
| N6 | Dropping the query string from the app logger doesn't keep search terms out of Render's platform logs. | PRIVACY.md is scoped to say exactly that. Search stays a cacheable GET for performance, and export selections move to the POST plan body. |
| N7 | Pre-existing exposure: held corpus files are publicly fetchable from codexmusica.com because Pages serves `main` verbatim. | Outside this design. Raised to John as a **separate decision to run alongside cutover**. |
| N8 | The comparison picker's related list must keep the old exclusion and title order. | Static `work_readings` excludes the current id, is title-ordered, and carries title and source_path. Tested. |
| N9 | Selection-export progress moves from an in-page toast to the browser's download UI, and 410 `EXPORT_EXPIRED` goes away. | Disclosed in the release notes as a deliberate difference. |
| N10 | `build_html --check` pins the current preload shape. | Its invariants are rewritten to allow `boot_preload`/`library_preload` in a fixed order. `check_lazy_app`'s stored-state equivalence becomes route-aware. |
| N11 | `CATALOG_READY` starts its fetch when the script is evaluated, and a resize listener calls `renderAll()`. | The `CATALOG_READY` expression itself is route-gated. The resize handler is guarded until the workspace is ready. Both are covered by the boot-trace gate. |
| N12 | The preview flag must change `UI_ROUTES` before page scripts register, and `?library-preview` survives tab switches. | The flag is read in the head boot script, and the param is consumed the way `?trad` is. |
| N13 | The header brand image (icon-192.png, 29,654 B) is on the shelves path. | Replaced by the derived 56 px mark (owner decision), and counted in the shelves-path budget either way. |
| N14 | An in-app reader click can contend with the low-priority workspace boot. | Workspace fetches pause while a Library chunk or `r/` fetch is pending. The click time is pinned in the scenario. |
| N15 | Corpus and export streams have no idle timeout. | Idle timeout and minimum transfer rate added (see B7). The Render load-balancer duration limit is verified in PR 1. |
| N16 | Editing the Dockerfile invalidates the capacity-receipt cache. | The library stages are ordered before the per-run ARGs so they cache. |
| N17 | Concurrent corpus PRs both rewrite binary data files, which can't be merged by hand. | Documented: serialize corpus PRs, then regenerate after rebase with `npm run build:library-data`, which is deterministic. |
| N18 | Pages ignores query strings, so `?d=` doesn't version content. | `data_id` is embedded in every list and shard file, and the client refetches `catalog.json` on a mismatch. |
| N19 | The in-page handoff drops the 8 MiB `TRANSFER_BYTES` cap. | The cap is kept for in-page handoff. Above it, the reader offers an excerpt or the bundle download, as before. |
| N20 | Prefetch on nav focus conflicts with "other routes make no `library/` request". | Prefetch on `pointerenter` only. The `check_lazy_app` assertion exempts explicit nav hover. |
| N21 | Self-minted viewers can queue very long readings, such as Kalevala, on the single-CPU instance. | Admission rule: readings over 5,000 lines need an empty queue ahead or count double. **Owner-visible**, listed under the limits decision. |

---

## Revision 1: changes to owner decisions

These are added or changed relative to the base list at the end of this file:
- **New: the rate-limit table in B7.** Each new limit compared with the old behaviour. Recommended: approve as proposed.
- **New: "Open in Lyrics" opens in the same tab** (N1). Recommended: approve.
- **Changed: the production preview** is now the recommended pre-cutover acceptance step for timing (B12), not merely optional.
- **New: snapshot labelling (B6).** The static projection label is used in provenance, and analysis's snapshot is shown separately. Recommended: approve.
- **New: long-reading admission rule (N21).** Recommended: approve.
- **Unchanged but stressed: the pre-existing exposure of held corpus files on Pages (N7)** needs its own decision, running alongside cutover.

---

# Base design (synthesis, verbatim; Revision 1 above overrides it)

_Native Library tab: reading files on Pages addressed by revision, a shell boot that starts with the Library, and a /library/v1 service on Render bound to a cookie_

## Thesis

The Library becomes the fifth UI_ROUTES entry in codex.html. It is a small inline stub plus SRI-pinned, same-origin chunks that load on first visit, with no iframe and no other website. Everything on the shelves-ready and reader-ready paths is a static file on GitHub Pages, served over the connection codex.html already opened. These files are projected from the verified, rights-filtered site export of main's current catalog (317c5afa, 25,525 readable). They are addressed by (reading_unit_id, reading_revision), never by snapshot_id. So Render is never on a load path, and the frequent snapshot churn from unrelated sources.tsv edits neither breaks the tab nor forces data regeneration.

On a #library boot the shell draws the Library first. browse_boot.json and engine.json follow at low priority after the first Library milestone. Engine.start and the prose download never run while the Library is the current view.

Render serves only what needs a server: exact search, held-unit metadata, streamed ZIP exports, the whole-corpus packages and analysis. They come from a new public /library/v1 contract whose snapshot is filled in by the server. Analysis identity is an unsigned 256-bit HttpOnly __Host- cookie. Job capabilities are re-derived on the server for each request and never transmitted.

Immutable id manifests (5226 and 317c), per-id, count, rights and label-census gates, goldens captured from the Worker's own code, and an A/B timing gate hold the tab to no regression in readable works and a measurably faster load. The timing gate detects shelves-ready and reader-ready the same way on the old Site and the new tab.

## Page integration

ROUTE AND NAV
- UI_ROUTES (src/workbench.js:44-49) gains ['library','Library','library'] as the fifth entry, after Lyrics.
- Icon: the unused UI_ICONS 'library' (lucide library-big). 'book-open' already means Form & story in Lyrics (src/pages/lyrics.js:371,930,3240). The Lyrics 'Library source' card (lyrics.js:2055) switches to 'library', so each icon keeps one meaning.
- Colour: --cm-route-library: var(--cm-green) in src/theme.css:168-173 (defined in both themes; this is the Library's own #1e8e3e), plus a nav svg rule beside src/workbench.css:1245-1256.
- At cutover:
  - delete uiLibraryLink (workbench.js:114-119) and its call (751);
  - retarget the narrow-header rules (workbench.css:1300-1315, plus the .ui-nav-link selectors at 85,104,109,537,583,589,963,1215) to button.cm-tab[data-view=library]: icon-only at <=440px and 900-1099px, label kept in aria-label and title, target >=44px;
  - scripts/build_html.js:229 PAGES += 'library'.
- Before cutover the entry exists only in two cases:
  - in the CI-only flagged build (CODEX_LIBRARY=1);
  - after PR 5, if John approves, behind a runtime preview flag: boot sees ?library-preview=1.

CODE LOADING (three tiers, same document)
1. Inline stub, budget 'library-stub' <=4,096 B gz: src/pages/library.js, src/pages/library.css and src/library_preload.js.
   - Registers uiRegisterPage({id:'library', recipe:'sidebar', mount, render, route, currentRoute, layout, resetLayout, escape, actions}).
   - actions is the fixed list of 'lib-' names (no shell or page owns that prefix today). Each one delegates to the chunk once it has loaded.
   - mount() writes only static skeleton markup:
     - Explore / Works / Sources & rights as a .cm-tab group, .cm-search and the Filter button;
     - an empty rail;
     - fixed-size shelf skeletons.
   - mount() is byte-identical in the lazy and embedded builds, which check_lazy_app's first-view equality requires. It does no fetch and touches no lazy-only global.
   - render() calls the loader.
2. First-visit chunks: sources in src/library/*.js.
   - build_html.js emits them through the existing squeeze() as library/code/<chunk>.<sha256-10>.js and injects a LIBRARY_CHUNKS {name:[file, sha384]} table into the stub.
   - The chunks, with gzip-6 ceilings:
     | Chunk | Contents | Ceiling |
     |---|---|---|
     | core | Explore and carousel, rail, Works, filters, search client, metadata sheet, Sources & rights, export panel, selection, device state, static data client | <=20,480 |
     | reader | paper, marks, selection, position, Summary and Sources lenses, read aloud, provenance download, Lyrics envelope | <=20,480 |
     | analysis | jobs, evidence hydration, Sound/Form/Rhythm/Language lenses, declarations, pronunciation, method reference | <=24,576 |
     | compare | picker, alignLines/intraLine | <=6,144 |
     | inflate | loaded only where DecompressionStream is missing | <=4,096 |
   - These ceilings are re-derived from the judges' check of the React sources: the reader-related sources gzip to 18,812 B before porting. PR 4 records the real ports and lowers each ceiling to measured +15%. Lowering needs no Lighthouse citation.
   - Each chunk carries its scoped CSS as a string, inserted as one <style>, and registers the lucide paths it needs into UI_ICONS, so codex.html does not grow.
   - Version skew: sync-pages keeps the previous generation's chunk files (library/code/previous.json), so a codex.html cached under Pages' 600 s TTL still finds its chunks. Any 404 or integrity failure shows uiEmptyState 'The site was updated' with a Reload button.
   - Embedded build: the same chunks are inlined as passive runtime blocks that only define window.CMLibraryChunks[name], and the loader prefers them. jsdom gates (check_workbench, ui_reachability, the embedded side of check_lazy_app) therefore exercise the real code.
   - file:// (CODEX_LAZY_API undefined) shows 'The Library reads its catalog from codexmusica.com' and fetches nothing.
3. Head preloads: a new <!--@LIBRARY_PRELOAD--> marker emits src/library_preload.js, following the src/engine_preload.js precedent.
   - It acts only when the protocol is http(s) and location.hash matches ^#library(/|\?|$). It then adds:
     - <link rel=preload as=script integrity> for core;
     - <link rel=preload as=fetch crossorigin> for library/data/catalog.json;
     - on read routes, also the reader chunk and library/data/r/<hh>/<id>.json.gz, plus the page file for a deep ?offset >= 250;
     - when matchMedia('(min-width:1100px)') holds (rail open), collections.json with fetchpriority=low.
   - Other routes get nothing.
   - Hover or focus on the Library nav button adds rel=prefetch for core and catalog.json.
   - The static browse_boot <link> (build_html.js:634-636) becomes src/boot_preload.js, placed first in <head>. It emits the identical element except on #library (see performance_plan for the measured fallback).

HASH GRAMMAR
- Form: #library[/works|/rights|/collections/<collection_id>|/read/<reading_unit_id>][?params]. Path names match the old Site, so translating its links is mechanical.
- List params: q, language, availability, completeness, contributor, sort, offset. Defaults (''/'all'/'0') are omitted, as before.
- Reader params: revision, line, offset, span=a:b, precision=exact|span, lens=summary|sound|form|rhythm|language|sources, view=source, compare=<id>, autoplay=1 (consumed with replaceState).
- All Library state lives in the fragment. location.search is never written, so nothing leaks into other tabs' URLs, and ?trad (workbench.js:1047-1063) is unchanged.
- An old ?snapshot= is accepted and dropped. Every 5226 identity is unchanged in 317c (critic-verified). A notice appears only when ?revision differs from the static revision.
- Shell changes are confined to the three places the critic named:
  - uiRouteOf(hash) returns {view, sub}, splitting at the first '/' or '?'. It is used in uiNavigate (156-163), the hashchange listener (1011-1014) and boot (1054-1063).
  - uiNavigate writes '#'+view+sub. On a nav click (sub undefined) it asks page.currentRoute?.(), so returning to the tab resumes where the reader was.
  - A same-view hashchange calls page.route(sub,{pop:true}) without refocusing the nav button or re-applying the recipe mode.
  - New shell API: uiSubroute(sub,{push,state}).
- docs/ui-foundation.md:56-62 is amended in the same PR.

BACK/FORWARD
- Push: section switch, opening a collection or a reading, Works Next/Previous, the Lyrics handoff.
- Replace: q and filters (200 ms debounce, as the Site did), lens, the revision written after load, compare, removal of autoplay.
- Before a push, scrollY goes into history.state.libScroll; it is restored in a rAF after render.
- '← Works' calls history.back() when history.state.libPrev marks a Library list. Otherwise it pushes #library/works (the old previousLocation default).

RECIPE PANEL
- recipe:'sidebar': collapsed by default, sharing Lyrics' remembered preference (workbench.js:207-231). This keeps the one-workspace contract. New fault library-loses-recipe mirrors faults.js #37.
- Below 900px it is the Recipe sheet, and data-view='library' joins the 60% phone-sheet rule (workbench.css:2350-2351).
- While the deferred workspace boots, the panel shows a 'Loading your recipe…' .cm-status (data-engine-pending='recipe') instead of card rows.

HOOKS
- escape(): closes the topmost Library layer in this order: card ⋮ menu, filter sheet, comparison sheet, metadata sheet, mobile inspector sheet, passage selection. Focus returns to the opener. This runs last in the shell's Escape order (workbench.js:1647-1670).
- layout(): registers UILayout panes library-rail and library-inspector (default 344px).
- resetLayout(): clears both panes and the rail-open default.
- Text size and source view use UILayout.remember('library-text-size' and 'library-source-view'). Nothing enters codex-workbench-v1.
- Ctrl/Cmd+K focuses the Library search only while UI.view==='library'. Ctrl/Cmd+Z/Y stay the shell's recipe undo/redo.

DESIGN-SYSTEM MAPPING
- The Library's own header, nav, brand and 'Library.' bar are dropped; the shell owns them.
| Library element | Shell equivalent |
|---|---|
| section switcher, lenses | .cm-tab with aria-selected and uiTabIndex roving |
| search | .cm-search |
| selects | .cm-select / .cm-input |
| filter, comparison, metadata and mobile-inspector sheets | .cm-panel + .cm-scrim |
| ⋮ | .cm-menu |
| method reference | .cm-accordion |
| comparison modes | .cm-segmented |
| language and state badges | .cm-chip / .cm-status |
| progress | a .cm-status row with aria-live |
| empty, loading and failure states | uiEmptyState, never ABSENT wording such as '0 …' |
| toasts | showToast |
| Blob downloads | uiDownload |
| artwork credit | uiPhoto lightbox |
- Every hard-coded colour becomes a token:
  - exact mark: --cm-accent-soft fill with an --cm-accent underline;
  - mapped mark: dotted --cm-text-muted;
  - evidence highlight: --cm-warning-soft;
  - passage selection: --cm-accent-soft;
  - diff: --cm-success-soft / --cm-danger-soft;
  - verdict borders: --cm-success / --cm-warning / --cm-border-strong / --cm-danger;
  - rail spines cycle --cm-blue, --cm-green, --cm-amber, --cm-violet;
  - type covers: --cm-surface-subtle with a tinted top border;
  - reading font: the page-scoped --lib-reading-font (Georgia stack).
- All CSS is scoped to #surface-library.
- The looping, windowed carousel (items tripled, visible cards plus 6 rendered, only the middle copy focusable, Arrow keys step) is a Library-owned component. It is not uiRowsHTML, which only appends and never windows (workbench.js:1376-1388).

DARK MODE
- Comes entirely from tokens; the old Site had none.
- check_ui_foundation D asserts the visible #surface-library is neutral (R=G=B within 2).
- check_library_page checks mark, diff and verdict contrast in both themes.
- The reading container keeps dir and lang from the reading, so RTL Persian works.

RULE 1
- The Library never reads app.cards, compileRecipeStack, envCardOf, Engine, Catalog or chat state, and never derives declarations from a recipe.
- Library to Lyrics is a text envelope only.
- check_library_isolation.js enforces this with a grep, plus an eslint no-restricted-globals rule over src/library/** and src/pages/library.js.

## Data plane

PRINCIPLE
- Every byte on a load path is static on Pages, same-origin, over the HTTP/2 connection codex.html already uses. Pages serves main verbatim (.nojekyll); .json gets transfer gzip; TTL 600 s.
- Static content is addressed by reading_unit_id and reading_revision and carries no snapshot_id. So a sources.tsv edit that leaves readable units unchanged changes nothing on Pages. catalog.py:634 folds sha256(sources.tsv) into snapshot_id, and lexicon PR 605b98487 forced repin f0dd2a006. But a reading's revision hashes only its own rights rows (catalog.py:372-391,491).
- Render is used for exact search, held metadata, ZIPs, corpus packages and analysis, and nothing else.

STATIC BUILDER
New scripts/build_library_data.py calls a new lyric-harness/library/catalog_static_export.py, which runs four steps.
1. `library.catalog build` into lyric-harness/library/snapshot (gitignored, .gitignore:54), with --repo-sha read from library/catalog_sources.json.
   - This is the layout library-site.yml uses.
   - It fixes the verified label pitfall: pack_export reads canonical_source.parent.parent/data/lyric_label_prefixes.json and silently attaches {} otherwise (catalog_site_export.py:175-179). The 317c export measured in this session has label_registry_sha256 None and no references.
2. The unchanged verified exporter, run in order: export_snapshot, then pack_export, then attach_references(reference_dir=lyric-harness/library), then verify_export.
   - The builder asserts derived_metadata.label_registry_sha256 == sha256(lyric-harness/data/lyric_label_prefixes.json) and that the source_records and label_prefixes references are attached. This activates verify_export's held-body and held-label refusals (379-380) and its label identity check (319).
3. Projection from the verified packs, not from the canonical files. Pack summaries are compact_summary + source_basis (line 249), and rows carry source_labels. The static data therefore equals what the approved Worker served.
4. Deterministic output: canonical sorted JSON, gzip -9, mtime 0.

The builder sits outside the three traced builders, so lyric-harness stays inert for check_build_closure (_build_closure.js:74-85). It has its own gate, check_library_data.

LAYOUT: library/data/
Sizes are measured on 317c by scratchpad r1design/measure_e.py and measure_f.py, plus this session's collection and unit-shard measurement.

1. catalog.json (plain; budget <=4,096 B gz). The only data before shelves-ready.
   - format:1;
   - data_id: sha256 of the content manifest;
   - projected_from {snapshot_id, repository_commit}, a provenance label excluded from freshness comparison;
   - census: the 11 manifest counts;
   - readable_ids_sha256;
   - languages in catalog order: cym 7, fas 1, fin 3, eng 2,195, ltc 66, non 7 readable collections;
   - per language: total plus the first 12 cards [collection_id, title, readable, recorded, art_id, first_readable_id];
   - 8 artwork records (credit, source, note, rendition paths);
   - collections_sha.
   Artwork matching uses the old art() rule (library-app.tsx:65-76), computed at build time: 9 collections match.
2. collections.json (plain). All 2,279 readable collections as [collection_id, title, language, readable, recorded, art_id]: 171,972 B raw / 78,387 gz; budget <=98,304 gz. Fetched at idle after shelves-ready, or preloaded low on wide screens.
3. c/<collection_id>.json.gz plus .p<k> pages of 250 rows.
   - Head: {readable_ids (all, in display order), rows 0-249}.
   - Rows are sorted by (title_search UTF-8 bytes, reading_unit_id). This is the Worker's ORDER BY r.title,r.id over the folded column (library-api.ts:363-366; library-catalog.ts binds title_search into r.title). 25,469 of 25,525 readable titles differ from their title_search, so ordering by title would break parity.
   - Row: [reading_unit_id, revision16, title, contributors, language, availability, completeness, edition8, work8, source_path].
   - About 2.2 MB gz in 2,317 files: 1.61 MB for rows, plus about 0.6 MB of id lists. The largest collection has 2,618 readable units.
   - Every unit belongs to exactly one collection (measured), so c/ files partition the readable set.
4. w/title/<k>.json.gz: the default Works list (availability=readable, sort=title, no q), 100 rows per file in the same order. 256 files, 1,418,845 B gz.
5. u/<hh>.json.gz: [reading_unit_id, revision16, collection_id] for every readable unit, sharded on the uuid's first two hex digits. 256 files, 1,236,554 B gz in total, at most 5,998 each.
   Used for:
   - deep-link revision checks;
   - selection membership for imported or old ids;
   - device-state import;
   - the count gate.
6. r/<hh>/<reading_unit_id>.json.gz: header plus lines 0-249; .p<k> page files for the 62 readings over 250 lines (172 page files).
   - Header:
     - ids: id, revision, work, edition;
     - descriptive: title, language, direction, notation, completeness, collection_id, source_path, source_sha256, normalized_sha256, contributors[name, role, basis, source_declaration];
     - source: source_marks, source_labels, source_basis, work_reviewed_equivalence, census, source_map minus rows;
     - rights: required_attribution and notice shas inline, rights_ref, metadata_ref;
     - work_readings, only when the work has other readable readings (213 units).
   - Line: [kind, text, indent, physical_line, analysis_line, source_cp_range, source_text only when it differs, source_ranges[codepoint, byte, utf16, physical_line, precision]].
   - Derived in the client, never shipped, and gated for every unit:
     - normalized_text = '\n'.join of lyric-row text;
     - normalized cp and utf16 ranges, by cumulative sums with +1 between lyric rows;
     - line ids = 'line_'+uuid5(7b347e4c…, 'line:'+id+':'+row);
     - source_map.rows = line ids.
     These follow from catalog.py:437-475 and 26-43.
   - Measured: 158.8 MB raw / 61.6 MB gz in total. Head file 2,006 B gz median, 3,812 at p90, 8,497 at p99, 17,564 max. Kalevala is 843,528 B gz across 92 files.
7. rights/r-<hh>.json.gz (256 shards) and rights/rows-<hh>.json.gz (64 shards).
   - 6,653 distinct rights objects interned by content hash: 730,671 B gz.
   - 2,785 shared sources.tsv rows: 355,030 B gz.
   - notices/<sha>.json: the Hafez MIT notice and two Gutenberg terms, 41,481 B.
   The client rebuilds the exact canonical rights object.
8. meta/<hh>.json.gz (64 shards): 2,273 distinct metadata headers, 2.59 MB raw.
9. methods.json (copy of lyric-harness/library/methods.json, 278,001 B; registry_hash gated) and reader-result.schema.json. declaration-options.json is bundled into the analysis chunk.
10. Art renditions in assets/library/art/<id>-{240,480}.{avif,webp}.
    - Derived by a new build_library_art.js using sharp (already a devDependency), byte-checked with --check, at most 25,600 B per file.
    - The originals move from sites/library/public/art to assets/library/art-src. Measured: 1,734,318 B of originals become about 127 KB of WebP at 272px.

TOTALS AND FETCH RULES
- Totals: about 68 MB gz and about 28.9k files. The served tree goes from 713.3 MB to about 782 MB, under the 1 GB Pages limit. Gated by check_pages_size at <=950 MB and no file >=100 MB.
- Bulk files are .json.gz. The client sniffs 1f 8b and inflates with DecompressionStream, or the inflate chunk on old browsers. If Pages ever sends Content-Encoding, the bytes arrive already decoded and parse directly. A PR 0 probe file records the real headers.
- List and shard URLs carry ?d=<data_id8>.
- r/ is fetched unversioned, so it matches the head preload, then verified against the expected revision from the row or shard. A mismatch refetches with ?v=<rev8>.
- Contingency: the data client takes its r/ base URL from one constant. If PR 2's measured Pages deploy fails or exceeds 7 minutes with about 29k extra files, r/ is served from Render's /library/v1/r/... built from the same projection in the image. Nothing else changes.

RENDER (mcp.codexmusica.com /library/v1, mounted by a new mcp/library_routes.js; CHAT_BACKEND override reused)
- The client never sends a snapshot. Every response names the server's snapshot_id and readable_ids_sha256.
- Public, uncredentialed GETs (CORS simple requests):
  - GET /library/v1/health: passive, no cookie, no writes. Returns {contract:1, snapshot_id, readable_ids_sha256, counts, search_ready, analysis_available, corpus:{format:{bytes, sha256, url}}}.
  - GET /library/v1/search?q&language&availability&completeness&work&collection&contributor&sort&offset&limit<=100.
    - Returns {snapshot_id, items:[compact_summary + source_basis + snippet + search_hit, each with reading_revision], total, next_offset}.
    - Cache-Control: public, max-age=300, with an ETag. The query string is redacted from the request log.
    - limit<=100 rather than the Worker's 250, because no UI asks for more than 50.
  - GET /library/v1/metadata/:id: compact_summary + source_basis for any availability. Held units get no body, no snippet and no labels.
  - Export and corpus routes: see exports_and_downloads.
- Viewer routes: see analysis_and_identity.

SEARCH STORE
New lyric-harness/library/search_store.py runs in the image's assets stage against /build/library-canonical, before release_assets filters held readings out. It imports compact_summary and source_basis from catalog_site_export, so the summaries equal the Worker's metadata column. It writes:
- body.bin: folded search.text for readable units, 19,009,282 B; held bodies are empty, exactly as in D1;
- UTF-8 columns for title_search and contributor_search, with offsets;
- two sort permutations computed in Python on UTF-8 bytes: (title_search, id) and (contributor_search, title_search, id);
- summaries and interned source_basis on disk, read by offset;
- the sorted readable-id list used for export bitsets.

Query handling is a line-for-line port of the Worker's SQL:
- normalization: NFC, the Python casefold table, whitespace collapse, at most 500 chars, else 400 BAD_QUERY;
- match: Buffer.indexOf over title, contributor or body. Each hit is mapped to its unit by binary search and the scan resumes at the unit's end;
- filters:
  - equality on language, availability, completeness and work;
  - membership for collection;
  - contributor via instr(lower(contributor_search), fold(x)), with SQLite's ASCII-only lower() reproduced;
- snippet: substr(body,1,180) in code points of the folded body; body_position is 1-based;
- total is exact, and there is no ranking.

Hit projection is a Node port of search-hit.ts, run for returned readable hits only. It sits behind an LRU budgeted by parsed size (64 MB), and readings over 4 MB are handled one at a time. Memory is about 40-60 MB plus the LRU, measured in qualify_reader against the 1638 MiB bound.

HELD METADATA
The 11,354 held units and the 1 research-only unit never appear in static files. They reach the tab only through Render search (availability=held|all, and 'Inspect all recorded availability') and /metadata/:id. Each carries the Worker's compact_summary plus source_basis, built at image time from the full snapshot, so the metadata sheet keeps its recorded evidence exactly as the approved Site served it.

SKEW BETWEEN PAGES AND RENDER
Pages publishes at merge (sync-pages on CI success). Render promotes after Production qualification (deploy-connector.yml). Under revision addressing, skew is limited to units whose revision changed in a corpus PR:
- Reading never breaks.
- Analysis create for a newer static revision gets 409 STALE_READING {current_revision}. The UI says the analysis server updates within a day and offers 'Notify me by retrying later'.
- A search hit whose revision differs from the displayed revision lands by line_id, without span marks, and says so.
- An export containing an id not yet on Render gets 409 SELECTION_UNAVAILABLE naming those ids.
- smoke_library_live reports the per-id skew count after each publish and promotion, and alerts if it is non-zero for more than 48 h.

## Analysis and identity

CONTRACT
A new browser family, /library/v1, on the existing service. It is separate from /internal/reader: that keeps its HMAC authenticator and stays out of CORS until retirement.

server_http.js:262-271 is split so that:
- ReaderJobStore and ReaderScheduler are built whenever READER_CATALOG_DIR and a durable directory exist;
- /internal/reader mounts only while READER_BRIDGE_SECRET and READER_SITE_ID are set;
- the /library/v1 viewer routes mount when LIBRARY_PUBLIC=1 (production-config pin; 0 until PR 5).
Without this split, removing the bridge secrets would silently disable public analysis.

VIEWER IDENTITY
- The cookie is unsigned and random, so no new secret is needed:
  `__Host-cm_library=<43-char base64url of 32 random bytes>; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=2592000`
- It is minted only by POST /library/v1/analyses when no valid cookie is present, so GETs never create state. Mints are limited to 30/h per IP.
- Max-Age slides on every viewer-route response, matching the 30-day retention.
- viewer = 'lv1:'+sha256hex(value), which fits the store's ^[A-Za-z0-9_.:-]{1,200}$ check and is disjoint from the Site's viewers.
- codexmusica.com and www.codexmusica.com are same-site with mcp.codexmusica.com, so the Strict cookie travels with fetch(…, {credentials:'include'}) and with download navigations. Page script can never read it.
- Why unsigned, over a signed cookie with LIBRARY_VIEWER_KEY:
  - a 256-bit random value cannot be guessed;
  - a non-browser client can fabricate viewers either way, so the per-IP outstanding cap, not the per-viewer cap, is the binding admission limit;
  - a signing key would be one more dashboard secret whose loss or rotation orphans every viewer's analyses.

CAPABILITIES NEVER LEAVE THE SERVER
- ReaderJobStore gains one trusted method, capabilityFor(id, viewer). It returns the existing HMAC(storeKey,'reader-v1\0id\0viewer') from _capability (reader_job_store.js:359-364).
- The router re-derives the capability on every call, from the path's job id and the cookie's viewer, and passes it to get, cancel, resume, delete, readManifest, readManifestPage and readPage. It is never serialised.
- No binding table, receipt store or other new persistent state is added.
- The browser receives {contract_version:1, job: publicReaderJob(record)} (reader_routes.js:143-166). The job id is a reference, useless without the cookie, so job ids may live in IndexedDB, as the Site's reference ids did.

VIEWER ROUTES (credentialed; bodies <=2 MiB)
- POST /library/v1/analyses
  - Body: {contract_version:1, reading_unit_id, reading_revision, declaration_set?, requested_layers?, requested_methods?<=256, idempotency_key}.
  - The server fills snapshot_id with its installed snapshot, then runs the pipeline /internal/reader already uses: validateRequest, prepareRequest, resolveIdentity, store.create, scheduler.kick. It is extracted into one shared helper, so both routers run identical code.
  - 202 for a new job, 200 for an exact retry (which refreshes the job).
  - 409 IDEMPOTENCY_CONFLICT; 409 STALE_READING {current_revision}; 403 READING_UNAVAILABLE for non-readable units; 429 QUEUE_FULL.
- GET /library/v1/jobs/:id
- POST /library/v1/jobs/:id/cancel and /resume, with an Idempotency-Key header (generated per click).
- DELETE /library/v1/jobs/:id: tombstone.
- GET /library/v1/jobs/:id/manifests/:sha
- GET /library/v1/jobs/:id/manifests/:sha/pages?offset&limit<=250
- GET /library/v1/jobs/:id/pages/:sha?manifest=
- GET /library/v1/jobs/:id/exports/<manifest>.zip

Route behaviour:
- Another viewer's job answers 404, and methods are routed strictly. The Worker quirk that answered GET …/cancel as a results read (library-api.ts:639-644) is not reproduced.
- Manifest and page bytes are content-addressed: Cache-Control private, max-age=604800, immutable. The router re-hashes what it reads (503 STORAGE_CORRUPT on a mismatch). The client also verifies sha256 with SubtleCrypto and caches verified pages in an IndexedDB 'evidence' store with a 64 MB LRU. This replaces the Worker's verifiedPull and R2 cache.
- A job read refreshes retention (existing store behaviour). That makes it a write, unlike the passive /health.

CORS (mcp/server_http.js:217-244)
- Allow-Headers adds Idempotency-Key.
- Access-Control-Allow-Credentials: true, on /library/v1/analyses* and /library/v1/jobs* only (preflights included), using the existing exact-origin echo; boot already refuses wildcards.
- Expose-Headers: Retry-After, Content-Disposition, X-Library-Bytes, X-Library-SHA256.
- Max-Age: 600.
- CSRF: a foreign Origin is refused by the existing middleware (403); every non-GET must be application/json, which forces a preflight; and the cookie is SameSite=Strict.
- Search, metadata, exports and corpus stay uncredentialed.

RATE LIMITS
Process-local Windows keyed by clientIp with TRUSTED_PROXY_HOPS=1 (ratelimit.js). These are looser than perf-first's after the parity review flagged shared NAT. Every refusal is 429 with Retry-After, and the UI says when to retry.
| Traffic | Limit |
|---|---|
| search | 60/min and 1,200/h per IP |
| analysis creates | 30/h per IP, and <=4 outstanding per IP on top of the store's 2 per viewer and 16 waiting |
| job reads | 240/min per IP |
| cancel / resume / delete | 120/h per IP |
| cookie mints | 30/h per IP |
| export plans | 30/h per IP |
| export streams | 2 concurrent per IP, 4 global |
| corpus downloads | 6/day per IP counting only Range-less or bytes=0- requests, 2 concurrent global |

QUOTAS
- Unchanged, and shared with reader-v1: 16 waiting, 1 running, 600 s leases, yields to lyric work, 30-day sliding retention, zero provider calls enforced in four layers.
- Open issue resolved here: evidence pages are stored uncompressed today (no gzip in reader_job_store.js). At about 2-3.3 MB per short poem (critic measurement), the 256 MiB quota would hold only about 100 analyses per 30 days.
  - Recommended fix in PR 1: store pages gzip-compressed at rest. Identity stays sha256 over the uncompressed bytes, existing objects are read by magic-byte sniff, and pages are served pre-compressed with Content-Encoding: gzip.
  - Measured ratio is about 18x (2,045,168 B to 110,206 B), which raises capacity to roughly 1,800 analyses at the same 256 MiB.
- Exports store nothing on disk.

LOGS
- The request logger already omits Cookie (server_http.js:139-150). Set-Cookie is never logged either.
- The query string is dropped for /library/v1/search and /library/v1/exports, so search terms and selection bitsets are not logged.
- Job ids are logged; they are references.

READER_RUNTIME.md AMENDMENT (same PR as the routes)
1. Configuration table:
   - READER_BRIDGE_SECRET and READER_SITE_ID become optional; they mount only /internal/reader, while the Site exists.
   - New rows: LIBRARY_PUBLIC, and READER_REQUIRED pinned to 1 at cutover.
2. 'Install the same canonical catalog snapshot on the Site and Render' becomes 'Render serves and analyses one installed snapshot; the static Library reading plane is projected from the same catalog and addressed by reading revision.'
3. A new section, 'Public Library browser API (/library/v1)', covering:
   - the caller: the codexmusica.com Library tab;
   - identity: the Render-minted HttpOnly, Secure, SameSite=Strict, host-only __Host- viewer cookie;
   - the per-job capability is derived and checked in-process and never appears in responses, URLs, client persistence, analytics or logs;
   - Cookie and Set-Cookie values are never logged;
   - credentialed CORS only for the exact allowlist and only on viewer paths;
   - the per-IP limits;
   - jobs share the reader-jobs-v1 store, admission and scheduler;
   - 30-day retention, zero provider calls.
4. Lines 42-44 keep their rule verbatim: raw backend capabilities never appear in URLs, client persistence, analytics or logs. Only the caller clause gains 'and the in-process /library/v1 router', and one sentence is added: 'The viewer cookie is an HttpOnly session credential, not a capability.'

Justification for the amendment:
- A browser cannot hold a signing secret.
- An HttpOnly cookie cannot be read by page script. codex.html has no CSP, so this is strictly safer than any token kept in IndexedDB.
- Losing the cookie loses only access to the viewer's own deterministic, re-runnable analyses.

PRIVACY.md and mcp/PRIVACY.md gain: the cookie, its 30-day sliding life, the per-IP processing, and the fact that Library device data never leaves the browser.

LIFECYCLE PARITY
- Same states and badges: Partial evidence / Complete report / Waiting for evidence.
- Polling every 3 s while queued, running or deferred_requeue, paused while the tab is hidden.
- Cancel while running or queued. Resume from paused, cancelled or failed, with unchanged identity. Delete in any state, leaving a tombstone.
- Evidence comes from manifest, then refs(offset, limit=1), then page bytes, verified; 'Load more evidence · page n' works as before.
- Earlier analyses come from device state 'interpretation:{id}:{revision}', refreshed with GET jobs/:id.
  - A 404 (cookie lost, or Safari's 7-day cap) reads 'This analysis belonged to an earlier browser session' and offers a deterministic re-run.
  - A job created on an older server snapshot stays readable from the store. Its resume offers 'Run again on the current catalog' when the revision is unchanged.
- 'Load latest evidence checkpoint' appears when job.manifest_hash differs from the displayed hash.
- Partial results never impersonate complete ones (store semantics unchanged).
- The Method select reads static methods.json (reader_requestable per language).

## Exports and downloads

ONE SERVER ZIP WRITER
mcp/library_exports.js holds two parts:
- mcp/library_zip.js: zip-stream.ts ported verbatim. STORED ZIP64 with data descriptors, flags 0x808, fixed 1980-01-01 DOS time, deterministic entry order, CRCs from Node 22 zlib.crc32.
- Ports of bodyPart, csvLines (CSV_FIELDS), provenance and credits from library-exports.ts:125-305.

It reads canonical readings and wholly readable originals from the installed snapshot, and evidence from the reader store. There are no D1 leases, no R2 chunks, no step loop and no stored export records.

SELECTION EXPORTS (text | json | csv; stateless, public)
1. POST /library/v1/exports/plan with {reading_unit_ids, format}.
   - Ids must match ^reading_[A-Za-z0-9_-]+$; they are deduplicated and sorted.
   - Any id not readable on the server answers 409 SELECTION_UNAVAILABLE, naming the ids, as library-exports.ts:364-373 did.
   - Response: {export_id = sha256(set_id, format, sel), bytes, entries, mode, url}.
   - url is GET /library/v1/exports/s/<set_id>/<format>.zip?sel=<base64url bitset over the server's sorted readable ids>.
     - set_id is the first 16 hex of readable_ids_sha256, so snapshot churn that leaves the readable set unchanged does not invalidate plans.
     - The bitset is at most 4.3 KB.
   - A selection covering every readable unit maps to the prebuilt corpus package (the old 'prebuilt' mode).
2. The tab starts the download with a hidden anchor.
   - The server streams the ZIP with an exact Content-Length (STORED sizes are known in advance) and Content-Disposition: attachment.
   - The browser's own download UI shows progress, and nothing is buffered in page memory.
   - A stale set_id answers 409 SET_CHANGED, and the client re-plans from the stored ids.

Entries are identical to the Worker's:
- Per unit:
  1. READINGS/<id>.json (canonical bytes), .txt (normalized_text) or .csv (CSV_FIELDS)
  2. TRANSCRIPTIONS/<id>.txt
  3. PROVENANCE/<id>.json
  4. ATTRIBUTIONS/<id>.txt
  5. NOTICES/<id>-<sha>.txt, each sha re-verified
  6. SOURCES/<sha>.bin, json only, once per source, and only when whole_source_availability is readable, i.e. every unit of that source is readable
- At the root: PROVENANCE.json and ATTRIBUTION.txt ('Credits are required and must accompany reuse.').
- The snapshot_id embedded in PROVENANCE and CSV rows is the server's installed snapshot, as the Worker embedded its own.

Export panel controls:
| Control | Behaviour |
|---|---|
| Export selected readings | plan, then download |
| Resume prepared export | re-GETs the stored url; re-plans on 409 |
| Forget export reference | clears device key 'pending-export' {format, ids, url} |
| Clear selection | as before |
| Download unsaved selection | library-selection.json, when IndexedDB failed |
| Export readable corpus | the prebuilt package |
The client warns above an estimated 500 MB and steers to the corpus package.

Change from the Worker, stated openly: there is no per-viewer export record and no 30-day 410 EXPORT_EXPIRED. Viewer isolation existed to protect private records. A public, deterministic selection export has no record to protect, and regenerating it yields identical bytes.

ANALYSIS EXPORTS (cookie-bound)
- GET /library/v1/jobs/:id/exports/<manifest>.zip, started by anchor navigation. Same-site navigations carry the Strict cookie.
- The manifest identity is checked first; partial checkpoints are allowed.
- It streams the reading's unit entries, then:
  - PROVENANCE.json (scope whole_reading_unit_analysis, analysis_manifest_hash, partial);
  - ATTRIBUTION.txt;
  - ANALYSIS/MANIFEST.json (exact bytes);
  - ANALYSIS/REQUEST.json (canonical request rebuilt from the job's stored identity);
  - ANALYSIS/METHODS.json and ANALYSIS/RESULT_SCHEMA.json (the image's files);
  - ANALYSIS/EVIDENCE/<8-digit n>.json, store pages in manifest order, hash-verified.
- 'Export complete analysis' or 'Export partial checkpoint' is offered according to manifest.partial.
- Device key 'analysis-export:{job}:{hash}' keeps the url. It holds no secret.

WHOLE-CORPUS EXPORTS
- Built by the existing deterministic `python -m library.catalog_downloads` in a dedicated, cacheable Dockerfile stage over the installed snapshot. Measured on 317c in 2 m 18 s:
  | Format | Bytes | Entries |
  |---|---|---|
  | text | 73,439,381 | 51,055 |
  | csv | 140,958,923 | 25,530 |
  | json | 363,604,074 | 27,809 |
  | total | 578,002,378 | |
- Every package carries PROVENANCE.json (canonical_manifest_sha256, body_policy, excluded_availability_counts, whole_original_sources), ATTRIBUTION.txt with the DCS credit, and NOTICES/.
- The *.part-* files are deleted. GET /library/v1/corpus/<snap12>/<format>.zip is served by sendFile with Content-Length, Accept-Ranges (so downloads can resume), ETag = sha256, X-Library-SHA256 and public immutable caching.
- /library/v1/health lists each package's size and sha256, and the panel shows them beside the links.
- verify_downloads runs in the build, and qualify_reader runs --verify-existing.
- They cannot live on Pages: csv and json are each over GitHub's 100 MB file limit, and 578 MB exceeds the headroom.

CLIENT-SIDE DOWNLOADS (uiDownload Blobs, no server)
- reading-provenance.json from the Sources lens: {snapshot_id: projected_from, reading_unit_id, reading_revision, rights rebuilt exactly from the shards plus notice texts, source_map with derived rows, source_marks, source_labels, source_basis, work_reviewed_equivalence, metadata}. Pretty-printed exactly as reader.tsx:999-1027.
- reading-declarations.json.
- library-selection.json.
- codex-musica-library-import.json, only if the in-page Lyrics import throws.

PROVENANCE, ATTRIBUTION AND NOTICES TRAVEL
- Every r/ file carries required_attribution and notice refs, and the paper footer shows 'Required credits', linking to the Sources lens.
- Every ZIP carries PROVENANCE.json, ATTRIBUTION.txt and NOTICES/.
- Every Lyrics envelope carries the full rights object with notice texts.
- Artwork credits appear on Sources & rights, in the card ⋮ menu and in the lightbox; artwork is in no package.
- The Rights page states that Gutenberg admission is a USA public-domain statement.

DETERMINISM GATES
- PR 0 captures goldens by running the Worker's own TypeScript (library-exports.ts, zip-stream.ts) against the pinned 317c fixture: ZIP sha256 for fixed selections in all three formats, plus one analysis export.
- mcp/test_library_exports.mjs requires byte equality with those goldens, and an identical sha256 for the same request made twice.
- The rebuilt provenance download must be byte-equal to a reference built from the canonical reading, for every readable unit, in check_library_data.
- Corpus sha256 must equal package-manifest.json in qualify_reader.

## Lyrics handoff

The handoff stays in the same document and carries text only, through the receiver Lyrics already ships. There is no window.open, nonce, origin check, postMessage handshake or 8 MiB cap.

1. Entry points: 'Open in Lyrics' (whole reading) in the paper header, and 'Open excerpt in Lyrics' (the selected analysis lines) in the passage bar.
2. The reader chunk loads every page of the reading from static r/ files, plus the rights and meta shards and the notices. It builds exactly the codex-musica.library-import v1 envelope of library-client.ts:38-89:
   - handoffId and draftId: random UUIDs; createdAt.
   - payload.text: derived normalized_text, or the excerpt. For a whole reading the client first checks sha256(text) == normalized_sha256.
   - payload.title, payload.language, payload.scope (whole | excerpt).
   - payload.provenance:
     - the five ids validateEnvelope requires (src/library-import.js:60-102): snapshotId = projected_from.snapshot_id, unitId, workId, editionId, revisionId;
     - source_sha256, normalized_sha256, source_path;
     - the full canonical rights object, including required_attribution and notice texts, so Lyrics' 'Export source details' (ly-library-provenance) keeps the credits;
     - contributors, completeness, metadata;
     - source_map with derived rows, source_marks, source_labels, source_basis, work_reviewed_equivalence.
   - payload.lineage, one entry per analysis line: derived line_id, physical_line, analysis_line, derived normalized cp and utf16 ranges, static source_ranges. Filtered to the selection for an excerpt.
   - payload.declarations: [the reading's own Library declaration set] for whole readings, [] for excerpts.
   - digest: CMLibraryImport.envelopeDigest, the receiver's own canonical form, already inline in codex.html.
3. A new shell API, uiOpenInLyrics(envelope), in workbench.js and listed in docs/ui-foundation.md's API table.
   - Lyrics exposes its importer through registration rather than a page-to-page global: src/pages/lyrics.js passes imports:{library: (env) => lyLibraryReceiver.importEnvelope(env)} to uiRegisterPage.
   - uiOpenInLyrics awaits uiEnsureWorkspace(), then calls UI_PAGES.lyrics.imports.library(envelope). This is the no-binding path the JSON file import already uses (library-import.js:500-507; lyrics.js:5084-5098): validateEnvelope, then a durable atomic draft commit plus receipt in IndexedDB 'codex-musica-library-drafts'.
   - lyLibraryActivate then preserves the previous draft, detaches the writer and navigates to #lyrics with its toast (lyrics.js:1913-1977), pushed so that Back returns to the reading.
4. If the import throws (for example, IndexedDB is refused), the old fallback applies: download codex-musica-library-import.json with 'In Lyrics, choose Import'.

RULE 1
- The envelope carries only Library text and the reader's own declarations.
- Nothing reads or writes recipe state, and Lyrics sends nothing back.
- Enforced by check_library_isolation.js (no recipe identifiers in src/library/** or src/pages/library.js) and test_library_import_inpage.js. That test covers: round trip, digest, the five ids, rights and notices carried through 'Export source details', the previous draft preserved, an excerpt carrying only its lineage, and Back returning to the reader.

LEGACY RECEIVER (resolving the parity judge's mid-transition gap)
- SITE_ORIGIN, originAllowed, TYPES, HANDSHAKE_MS, TRANSFER_BYTES and createReceiver's opener path stay through cutover (PR 6), so the old Site's 'Open in Lyrics' keeps working until the move page replaces it.
- PR 6c deletes them, and their tests in scripts/test_library_import*.js, immediately after John confirms the move page is live, or 7 days after cutover if it is not deployed. Old-Site users then still have the bundle-download fallback.
- That returns about 1.5-2 KB gz to the page, and check_library_isolation then asserts that no 'chatgpt' string remains in codex.html or library/code.
- Bundles downloaded earlier still import through the file path, which has no origin check.
- Existing Lyrics drafts with snapshotId 5226 are unaffected: Lyrics reads only provenance.workingCopy, and every 5226 id and revision is unchanged in 317c.

## Performance plan

BASELINE (perf.md and the gate)
- Old Library: about 1,639 KiB Lighthouse payload. Boot was manifest (202 polls every 500 ms), then 5 sequential catalog pages of 250 collections (601,655 + 122,365 + 68,852 + 65,433 + 63,558 B), plus methods (278 KB raw) and a hidden default search (63,464 B). Mobile LCP was the loading placeholder; desktop LCP was lazy-loaded hafez.jpg; 8,597 DOM nodes; a 298 ms forced reflow.
- codexmusica.com today: codex.html 355,348 B gz. Every route waits on browse_boot.json (290,485 gz), plus engine.json (712,192 gz) when a session has cards (app.js:658-682, 17620-17628). After first paint, every route fetches engine.json and browse_prose.json (2,088,890 gz) (app.js:17667).

COLD #library BOOT
1. codex.html, net change at most +3.5 KB gz: the stub, the preload scripts and the boot guards, minus uiLibraryLink. The handshake code (about 1.5-2 KB) leaves in PR 6c.
2. <head> runs:
   - boot_preload.js, first in <head>: skips the browse_boot preload on #library;
   - theme boot;
   - engine_preload.js, which gains the same route test;
   - library_preload.js: core (<=20,480) and catalog.json (<=4,096), or on read routes reader (<=20,480) and the r/ head file.
3. DOMContentLoaded, with BOOT_ROUTE_LIBRARY true: no CATALOG_READY wait and no ENGINE_AT_BOOT. _initApp runs with deferWorkspace=true.
   - That is a guard-clause change, not a restructure. Catalog.warmSearchIndex, the uiAfterPaint engine start, pushHistory, both renderAll calls and uiRestoreSession are queued, in their current relative order, into _initWorkspace().
   - Everything else runs as today: icons, header, surfaces, every page's mount, the Escape and keyboard wiring.
   - Then uiNavigate('library').
   - Every other route calls exactly today's functions in today's order (deferWorkspace=false).
4. render() injects core (a cache hit), reads catalog.json and draws the first viewport (type covers plus text). After a double rAF it marks performance 'library:shelves-ready'.
5. After that milestone (or 'library:reader-ready'), at requestIdleCallback with a 5 s timeout:
   - in-viewport art: AVIF/WebP 240/480 via <picture>, the first two eager, the first with fetchpriority=high, <=60 KB total;
   - collections.json (78 KB) at low priority;
   - the reader chunk prefetched at low priority;
   - workspace boot with fetch priority 'low': browse_boot.json, then engine.json only if the session has cards, then _initWorkspace();
   - uiCheckAI after that.
   Hard rule: no Engine.start and no browse_prose.json while UI.view==='library'. The engine starts on the first visit to another route, or on any Engine.ensure.
6. Workspace controls clicked earlier (Save, Undo, Recipe sheet, AI recipe, other tabs) await uiEnsureWorkspace() with the panel's loading state, then act. Navigating to Genre or Instrument before the workspace is ready shows that page's skeleton until it is.

BYTES BEFORE EACH MILESTONE (gzip-6; data measured, chunks at their ceilings)
| Milestone | Bytes | Requests |
|---|---|---|
| shelves-ready | <= about 383 KB (358 + 20 + 4) | 3 critical: document, core, catalog.json |
| reader-ready, median reading | <= about 400 KB (358 + 20 + 20 + 2) | 4 |
| reader-ready, worst head file | 17.6 KB head; a deep ?offset adds one page file | |
- No request goes to api/ or to mcp.codexmusica.com before either milestone, and a saved session changes nothing.
- Under the applied Slow-4G harness (562.5 ms per request, about 184 KB/s, 4x CPU), the expected shelves-ready is about 3.0-3.4 s and reader-ready about 3.1-3.5 s on mobile, against an old shelves-ready estimated at >=8 s (to be measured in PR 0). Desktop: about 0.6-0.9 s.

EXISTING ROUTES
- They gain at most +3.5 KB of inline HTML, about 20 ms at 1.47 Mbps.
- A derived 56px header mark (build_favicon.js derived-asset pattern) replaces icon-192.png (29,654 B) on every route. That saves about 27 KB per cold load, but off the FCP/LCP path, so the claim is fewer bytes, not faster paint.
- The A/B gate below must show FCP and LCP neutral within threshold.
- Measured risk: boot_preload.js inserts the browse_boot preload from a script, which the preload scanner cannot see. Fallback if the existing-route A/B fails: restore the static <link> and accept browse_boot on the #library path, with the Library budgets re-derived (still about 0.6x old).

LAZY BOUNDARIES
- analysis chunk plus methods.json (52,749 gz): only for a Sound/Form/Rhythm/Language lens, Analyze, the method reference or an earlier analysis;
- compare chunk: on Compare;
- rights, meta and notices: on the Sources lens, provenance download, handoff or export;
- Render preconnect (anonymous): at idle; the credentialed pool only when the analysis chunk loads.
- Explicit decision: Library data does not wait behind api/engine.json, unlike the optional-download precedent (check_lazy_app.js:526-537). On #library the engine waits for the Library.

DOM
- Carousel windowed: visible cards plus 6, wrap-around by modulo.
- Rail virtualized: at most 40 rows rendered out of 2,279 (old: 1,428 children).
- Works: 50 rows.
- Reader: windowed, at most 3 loaded 250-line pages (750 rows) in the DOM. Farther pages are released and re-rendered on scroll, which covers Kalevala's 22,795 lines.
- Scroll work batched in rAF.
- Targets: Explore at most 1,500 elements; no long task over 200 ms after shelves-ready at 4x CPU; CLS at most 0.02. Fixed aspect-ratio frames and width/height on every image.

BYTE BUDGETS (new rows in scripts/check_payload_budget.js, gzip-6; the existing five are not raised)
| Row | Limit |
|---|---|
| library-stub | <=4,096 |
| library-core | <=20,480 |
| library-reader | <=20,480 |
| library-analysis | <=24,576 |
| library-compare | <=6,144 |
| library-shelves-path (codex.html + core + catalog.json) | <=393,216 |
| library-reader-path (codex.html + core + reader + largest r/ head file) | <=425,984 |
| page (existing) | 389,120 |
check_library_data enforces catalog.json <=4,096 gz, collections.json <=98,304 gz, every r/ head file <=24,576 gz and every art rendition <=25,600 B.

TIMING GATE (new check_library_perf.js plus _pages_server.js)
- Harness: Playwright Chromium against a local server emulating Pages (gzip for text types, .gz served raw, max-age=600). Render is the exact lyrics-image container for scenarios that touch it.
- Profiles:
  | Profile | Viewport | Network (CDP emulateNetworkConditions) | CPU |
  |---|---|---|---|
  | mobile | 412x823, DPR 1.75 | latency 562.5 ms, down 1,474.56 kbps, up 675 kbps (Lighthouse's applied Slow-4G constants; parity-risk-first's simulated constants are rejected) | 4x |
  | desktop | 1350x940 | 40 ms, 10,240 kbps | 1x |
- Milestone detection, symmetric for old and new (grafted from parity-risk-first): an init-script MutationObserver timestamps, at the rAF after the first painted match:
  - shelves-ready: first shelf heading plus first card title;
  - reader-ready: reading title plus first lyric line, with the ?line target in view.
  The new tab's performance marks are recorded for diagnosis, but the old-vs-new ratio uses the DOM conditions.
- Runs: n=9 fresh contexts per scenario, interleaved A/B against the merge-base on the same runner. Reports median, p90 and MAD, plus FCP and LCP observers, CDP encodedDataLength and request lists before each milestone, long tasks and DOM size.
- Scenarios:
  - PR subset, path-filtered on src/**, library/**, scripts/build_html.js: cold #library (mobile, desktop); cold #library/read/<median English id> (mobile); in-app Explore to reader; Works (mobile); #genre and #lyrics with and without a saved session (mobile). About 15 minutes.
  - Nightly: the full matrix, adding the Persian RTL reading, Kalevala with a deep ?offset, a saved session with 3 cards on #library, #instrument, #map and the desktop variants.
- Thresholds (caps confirmed against the PR 0 baseline; they can only be tightened without John):
  | Measure | Threshold |
  |---|---|
  | mobile shelves-ready median | <=0.55x the old Site's median and <=4.5 s |
  | mobile reader-ready, median reading | <=0.55x old and <=4.8 s |
  | mobile reader-ready, Kalevala deep offset | <=6.0 s |
  | saved-session shelves-ready | <=1.05x no-session |
  | desktop shelves-ready / reader-ready | <=0.5x old and <=1.2 s / 1.3 s |
  | in-app reader-ready (card or row click to reader-ready) | mobile <=1.5 s, desktop <=0.5 s |
  | static Works-ready | mobile <=1.5 s, desktop <=0.5 s |
  | search Works-ready against the local image | desktop <=1.0 s |
  | existing routes (#genre, #instrument, #map, #lyrics, each with and without a session) | FCP, LCP and first-view medians <= base + max(3%, 60 ms) mobile and + max(3%, 20 ms) desktop; bytes before first view <= base + 4 KB |
- Deterministic order assertions in check_lazy_app:
  - a #library boot requests nothing under api/ and nothing on mcp.codexmusica.com before shelves-ready;
  - no Engine.start or browse_prose while view==='library';
  - other routes make no library/ request at all, and their request order and boot-call trace equal the base.
- Old baseline: recorded once in PR 0 from a GitHub runner against the live chatgpt.site with the same harness (tests/perf/library-baseline.json: date, commit, runner, raw runs).
- After cutover: the same harness against https://codexmusica.com, plus PageSpeed Insights n=5, archived in docs/library-performance.md. If John approves the preview, the same run happens on production via ?library-preview=1 before cutover.

## Migration and retirement

EXISTING PRIVATE ANALYSIS JOBS
These are Render reader-jobs-v1 records under old-Site viewers, whose capabilities sit in Sites D1 library_jobs.
- Not migrated. Moving them would mean moving capabilities, and the viewer cookie belongs to the chatgpt.site origin.
- They stay usable through the old Site until the move page replaces it.
- After that nothing can address them. The store's 30-day sliding retention tombstones them (reader_job_store.js:13, 385-390), and the retirement PR includes an operator purge of jobs created under the old READER_SITE_ID to free the quota at once (needs John's acceptance).
- Users keep their inputs: declaration sets travel in the device-state file. Analysis is deterministic with zero provider calls, so a re-run on codexmusica.com reproduces the evidence; only snapshot_id differs in the identity.

PER-ORIGIN DEVICE STATE (IndexedDB 'codex-musica-library-v1' on chatgpt.site)
This state cannot be read from codexmusica.com.
- One final Sites deploy (PR 6b, John runs it) replaces the app with a static move page: no D1, R2 or bridge.
  - If local IndexedDB is non-empty, the page offers 'Save this device's Library data', which downloads codex-musica-library-device-state.v1.json: {protocol:'codex-musica.library-device-state', version:1, entries}.
  - The file contains: export selections, reading positions, shelf positions and interpretations (declaration sets only). Job ids, pending-export and analysis-export refs are dropped because they are useless.
  - Then 'Continue to the Library'. With empty IndexedDB it calls location.replace() at once.
- Native import: 'Import device data from the earlier Library' on #library/rights.
  - It validates the file and rewrites keys to the new snapshot-free schema:
    - export-selection: a set of {id, collection_id}, collection_id read from u/ shards;
    - position:{id}: {line_id, offset, revision};
    - interpretation:{id}:{revision}: {declarations, jobs:[]};
    - shelf-position:{lang}: carried over, because the carousel is kept.
  - Each entry is carried only when its (id, revision) matches the static u/ shard, else it is reported and skipped.
  - It then reports what it carried and what it dropped.
- New state lives in IndexedDB 'codex-musica-library-v1' on codexmusica.com with stores 'state' and 'evidence', separate from Lyrics' 'codex-musica-library-drafts'. Keys never contain a snapshot, so corpus updates no longer orphan selections, positions or declarations.
- Without the final deploy, users can still bring declarations through the old Site's own reading-declarations.json download, which the native editor imports. The release notes say so.

OLD chatgpt.site LINKS
The move page translates each path to a hash route on codexmusica.com:
| Old path | New URL |
|---|---|
| / | https://codexmusica.com/codex.html#library |
| /works?… | #library/works?… |
| /rights | #library/rights |
| /collections/:id | #library/collections/:id |
| /read/:id?revision&line&offset&span&precision&lens&compare | #library/read/:id?(same), snapshot dropped |
| /api/library/* | 410 {error:{code:'LIBRARY_MOVED', remedy}} |
codexmusica.com never links to chatgpt.site after cutover.

SITES WORKER
- Becomes the move page at cutover. John runs the Sites hosting workflow; the repo holds no credentials for it.
- Default: keep it 12 months for links in the wild, then John deletes the Sites project.
- GET /manifest, which writes D1/R2 state, is never used as a probe in any runbook. Live checks use the passive /library/v1/health.

D1/R2
- Contents: viewer-to-job bindings and receipts, 30-day exports, R2 copies of Render evidence, staged packs and the 60 download parts. None of it is unique, since all of it derives from the snapshot or is reproducible.
- Recommended: record row and object counts for the record, then delete both 30 days after the move page ships (John's acceptance).

RETAINED 5226 SNAPSHOT
- Stays in the image until the move page stops old-Site analysis calls, because the Site POSTs snapshot 5226.
- The retirement PR (PR 7) removes:
  - the mcp/Dockerfile:14-34 approved-library stage;
  - release_assets.py --retain-reader-catalog usage (247-266) and test_retained_reader_catalog.py;
  - the qualify_reader.mjs:71-94 5226 assertions, replaced by the per-id gate against the committed 5226 manifest;
  - mcp/README.md:246-253.
- The 5226 manifest and goldens stay as permanent fixtures.

library-site.yml
- PR 0 extends it to dump the Worker goldens.
- PR 6b retargets it to the move page: typecheck, plus a test that the page maps every route and writes no capability.
- PR 7 deletes it together with sites/library.
- Its census, viewer-isolation and held-refusal coverage moves to mcp/test_library_routes.mjs and check_library_data.

SITE_ORIGIN RECEIVER
- Kept through cutover.
- Deleted in PR 6c once the move page is confirmed live, or 7 days after cutover, together with its tests.
- File-bundle import remains.

BRIDGE
- After the move page ships: the /internal/reader router, reader_protocol.js, the raw-body capture for /internal/reader, and READER_BRIDGE_SECRET and READER_SITE_ID in the Render dashboard are removed in PR 7.
- The store and scheduler keep serving /library/v1, because PR 1 already decoupled them.

## No-regression gates

IMMUTABLE MANIFESTS (PR 0; append-only; their sha256 values are pinned as constants in the checker, so an edit fails)
- tests/library/units-5226b4fb.tsv.gz: 32,220 rows, 20,865 readable.
- tests/library/units-317c5afa.tsv.gz: 36,880 rows, 25,525 readable.
- Every unit is listed, not only the readable ones, so eligibility changes are classifiable.
- Columns: reading_unit_id, availability, reading_revision, artifact_sha256 (manifest artifacts[path]), normalized_sha256, admission verdicts.
- Header comment:
  - snapshot_id;
  - source revision: the catalog_sources.json corpus pin, 04d53f11 / 97ec4b0c;
  - policy basis: ADMITTED verdict set, 95-year rule (1931 cutoff at 2026), USA statement for Gutenberg, and the blob shas of quality/provenance.py and library/catalog.py;
  - rights_registry_sha256;
  - builder commit.
- Ledgers, all empty at launch:
  - tests/library/id-map.json: old to new id, accepted only with a matching normalized_sha256; shipped as library/data/id-map.json so old deep links redirect;
  - tests/library/eligibility-changes.json: {id, from, to, reason, approved_by:'John', date};
  - tests/library/revisions.json: accepted content revisions.

CHURN-SAFE RULE (resolving the feasibility fatal flaw)
- Gates compare the current build against the baselines, never against a manifest that must be re-committed per snapshot_id.
- A new snapshot id from an unrelated sources.tsv edit, with unchanged units, passes with no commit and no data regeneration.
- New baselines are appended only when corpus content changes, in the corpus PR itself.

CLASSIFIER (check_library_regression.js; JSON report artifact)
For each baseline id against the current output:
| Class | Meaning | Outcome |
|---|---|---|
| unchanged | readable in both, same revision | pass |
| added | new id | pass |
| missing | baseline id absent | FAIL unless id-mapped |
| changed-eligibility, readable to non-readable | demotion | FAIL unless ledgered with John's approval; rights corrections always win, and the gate makes them loud |
| changed-eligibility, non-readable to readable | promotion | allowed only when the catalog's own RightsResolver says readable; the builder never reads ledgers or flags to promote, so a restricted unit stays withheld until eligibility is established, even when flagged for John |
| revised | readable, revision differs | FAIL unless in revisions.json |
Expected today for 5226 to 317c: 20,865 readable unchanged, 4,660 added (all readable), 0 missing, 0 demoted, 0 revised. This matches 3PO's offline check, now enforced.

COUNT GATE
All of the following must be equal, at 25,525 for 317c:
- catalog.json census.readable_reading_units;
- the readable count in the projected-from manifest;
- the number of r/ head files;
- distinct ids across u/;
- distinct ids across w/;
- the sum of collections.json readable.
qualify_reader asserts the same total from Render's search store and the corpus PROVENANCE census, and replaces the literal 25525 at qualify_reader.mjs:89 with a read of the committed manifests.

PER-ID GATES (check_library_data)
- Every 5226-readable and every 317c-readable id has an r/ file whose revision equals the baseline's (or is ledgered).
- Every derived normalized_text hashes to normalized_sha256.
- Every derived line id equals the canonical id.
- Every reconstructed rights object, metadata object and provenance download is byte-equal to the canonical reading's.
- Static and Render agree: in the lyrics-image job, Render's readable (id, revision) set equals the committed u/ set.

RIGHTS AND LABEL GATES
- Every static file references only readable ids, and no held or research id has any r/, c/, w/ or u/ presence.
- No original source is served statically.
- Every r/ file carries required_attribution and notice refs whose shas exist and match.
- Label census (new): the export's derived_metadata.label_registry_sha256 equals sha256(lyric-harness/data/lyric_label_prefixes.json) (348 declarations across 30 files), and the count of readable units with non-empty source_labels equals the figure pinned in tests/library/data-manifest.json. A build at the wrong path yields zero labels and fails.
- Order parity (new): the static w/ and c/ order equals a Python sqlite3 run of the Worker's exact SQL over the same summaries.
- Summary parity (new): the search store's 36,880 summaries equal pack_export's compact_summary + source_basis.
- mcp/test_library_routes.mjs asserts:
  - held units get empty snippets and no search_hit;
  - held metadata has no body and no labels;
  - export and analysis refuse non-readable units (409 and 403);
  - SOURCES/ appears only for wholly readable sources.
- Fault classes prove each gate fires: library-readable-regression (drop one 5226 id), library-held-body-served, library-count-drift, library-labels-missing, library-capability-leak.

WHERE THEY RUN
1. verify job, every PR (cheap, over committed files): check_library_regression --committed, check_library_data --committed, check_library_isolation.
2. library-data job (new; always reports, so it can be a required check):
   - Exits early unless catalog inputs, the builders, library/data/** or tests/library/** changed. Also runs nightly.
   - Catalog inputs: lyric-harness/corpus/**, data/{sources.tsv, authority.tsv, library_identity_registry.json*, calibration_work_editions.json, lyric_label_prefixes.json}, library/**, quality/{provenance.py, lyric_reader.py, populate_authority.py}, lyric_harness.py.
   - Rebuilds the snapshot (205 s), the export (339 s) and the projection; compares decompressed content with projected_from excluded; reruns every gate on the fresh output. About 12-13 min and 0.7 GB RAM.
3. library-parity job (path-filtered on mcp/library_* and lyric-harness/library/search_store.py; nightly):
   - Sparse-checks out commit 031b7de's catalog inputs, as library-site.yml does with ceab2d61, rebuilding the pinned 317c exactly.
   - Runs the Node routes against the Worker goldens: at least 300 search queries (RTL, CJK, astral, ß, whitespace, 500-char cap, filters, offsets), readingPage samples including a header reading, hit projections, and ZIP sha256s.
4. lyrics-image job: qualify_reader asserts per-id readable ⊇ baselines, the static/Render agreement, search totals, corpus --verify-existing, viewer isolation and memory.
5. Post-publish smoke (smoke_library_live.js after sync-pages and after deploy-connector):
   - live catalog.json census;
   - 50 random r/ files against the manifest;
   - Render /library/v1/health counts;
   - the per-id skew count.

## Feature matrix (feature → route, data source, test)

| # | Feature | Old behaviour | Native route | Data source | Test |
|---|---|---|---|---|---|
| 1 | Library navigation tab (native route) | External <a target=_blank> to the chatgpt.site origin labelled 'Library (opens in a new tab)' | button.cm-tab[data-view=library], fifth UI_ROUTES entry, codex.html#library | inline stub in codex.html | check_ui_foundation stage K rewritten (button not anchor, no target=_blank, no external origin, aria-current, --cm-route-library); check_mobile_layout view-library >=44px; check_layout_usability five-entry header at 360/390/1000/1440 |
| 2 | Explore shelves (language-grouped collection cards with artwork) | Manifest (202 polling) then all catalog pages then one shelf per language in first-appearance order | #library (Explore tab) | static library/data/catalog.json (first 12 cards per language), then collections.json at idle | check_library_page section explore (order cym,fas,fin,eng,ltc,non; counts; 9 art matches); check_library_perf shelves-ready; check_lazy_app library sweep |
| 3 | Collection cards: artwork, type covers, counts | art() title+source_path match (special regexes for li-qingzhao and bilhana); pastel type cover; '{readable} readable · {recorded} recorded units' | #library card component | assets/library/art/<id>-{240,480}.{avif,webp}; catalog.json art records | check_library_page section cards (matching table for 8 artworks, token covers in both themes); build_library_art --check; per-rendition <=25,600 B |
| 4 | Shelf carousel mechanics and per-language position | Looping virtualized carousel (tripled items, visible+6), Arrow keys, middle copy focusable, IndexedDB shelf-position:{lang} with 500 ms debounce, 'position unsaved' | #library shelves (Library-owned windowed carousel) | IndexedDB codex-musica-library-v1 on codexmusica.com | check_library_page section carousel (wrap-around, <=visible+6 cards per shelf, keyboard, reload restores position, blocked IndexedDB shows 'position unsaved') |
| 5 | Card quick actions and ⋮ menu (Play, Add/Remove mixed, Open, Select, Artwork credit) | Hover/focus Play opens first readable unit with autoplay=1; Add toggles all readable units (aria-pressed mixed); DropdownMenu | #library cards; Play to #library/read/<first>?autoplay=1; .cm-menu | catalog.json first_readable_id or c/<id> head readable_ids (prefetched on hover/focus); selection entries {id, collection_id} with collections.json readable counts | check_library_page section card-actions (mixed state equals brute-force membership; autoplay consumed); check_ui_foundation menu focus and Escape |
| 6 | Collection rail | Every readable collection unvirtualized (1,428+ nodes), language filter, numbered spines, 'Export selection n', 'On this device', open at >=1100px | left rail on #library/* (overlay below 1100px), opens #library/collections/<id> | collections.json (preloaded low at >=1100px) | check_library_page section rail (2,279 reachable, <=40 DOM rows, active highlight, badge count); check_mobile_layout rail toggle; Reset layout restores |
| 7 | Section switcher and search shortcut | Explore/Works/Sources & rights buttons; Cmd/Ctrl+K focuses search | #library, #library/works, #library/rights (.cm-tab) | in-page | check_library_page section tabs (active tab follows route; Ctrl/Cmd+K only while #library current) |
| 8 | Topline, catalog label, error and retry states | '{n} readable collections · {n} reading units', 'Snapshot {8 hex}', .reader-alert with 'Retry opening the catalog' | #library header area | catalog.json census and projected_from | check_library_page section topline (values equal manifest; failed static fetch shows uiEmptyState danger + Retry); check_lazy_app E2 (no unhandled rejection, no ABSENT wording) |
| 9 | Works search | D1 instr() over folded title/contributor/body, NFC+casefold+whitespace, <=500 chars, ORDER BY title_search,id, 200 ms debounce, typing in reader switches to Works | #library/works?q=… | Render GET /library/v1/search (public, cached 300 s, query not logged) | library-parity job: >=300 queries equal Worker goldens on pinned 317c (ids, order, totals, snippets, body_position); mcp/test_library_routes search-differential vs Python sqlite3 running the Worker SQL; check_library_page section search |
| 10 | Search-hit projection and reader landing | projectSearchHit gives line_id, line_ids, row_offset, normalized_cp_range, source_ranges, precision, snippet; click passes ?line,?offset,?span,?precision | #library/works to #library/read/<id>?line=&offset=&span=&precision= | Render search_hit (Node port of search-hit.ts, LRU 64 MB) | library-parity hit goldens incl. header reading; check_library_page section marks (exact vs span; revision-mismatch lands by line_id without marks and says so) |
| 11 | Filters sheet | Language, Availability (readable default/all/held/metadata_only/research_only/rejected), Completeness, Contributor, Sort; live apply; Clear resets all | #library/works?language=&availability=&completeness=&contributor=&sort= (.cm-panel sheet) | default view static w/title/*; any non-default filter goes to Render search | test_library_routes filter parity (collection membership, ASCII lower() contributor); check_library_page section filters (URL params, Clear, Escape closes) |
| 12 | Works pagination | 50 rows, Previous/Next, 'a–b of total', offset in URL | #library/works?offset=n and #library/collections/<id>?offset=n | static 100-row w/ files and 250-row c/ pages sliced client-side; Render next_offset for searches | check_library_page section pagination (Next pushes, Back restores offset and scroll); check_library_data order parity vs Worker SQL |
| 13 | Works table, selection toggle, Select collection | Columns work/contributor/language/scope; toggle disabled unless readable; readable row opens reader, other row opens metadata sheet; 'Select collection' | #library/works, #library/collections/<id> | w/ and c/ rows (static) or Render items; c/ head readable_ids; IndexedDB export-selection | check_library_page section works-table (row routing by availability, held toggle disabled, Select collection adds every readable id) |
| 14 | Metadata sheet for held units | Right sheet: availability badge + Value tree of source_path, availability_reason, source_basis, work_reviewed_equivalence | #library/works?availability=held\|all (.cm-panel) | Render search items / GET /library/v1/metadata/:id (compact_summary + source_basis built from the full snapshot at image time); never static | check_library_data summary parity (store == pack_export summaries for 36,880 units); test_library_routes held-metadata-only (no body, snippet, search_hit or labels); check_library_page section held-sheet |
| 15 | Sources & rights: catalog census | 9 manifest counts, metadata-only note, 'Inspect all recorded availability' | #library/rights | catalog.json census; button runs Render search availability=all | check_library_page section census (36,880 units, 25,525 readable, 11,354 held, 1 research-only); count gate |
| 16 | Sources & rights: artwork credits | Credits, sources and notes for 8 artworks | #library/rights (+ card ⋮ and lightbox) | catalog.json artwork records (from artwork.json) | check_library_page section credits (8 credits identical to artwork.json); build_library_art --check |
| 17 | Sources & rights: method reference | Collapsible list with client filter over name/definition/capabilities; MethodDetail | #library/rights (.cm-accordion) | static library/data/methods.json (registry_hash gated) + analysis chunk | check_library_page section method-reference (223 methods; filter equals old predicate); check_library_data methods hash |
| 18 | Sources & rights: export panel | Count, format, credit note, Export selected, Export readable corpus, Resume, Forget, Clear, Download unsaved selection | #library/rights; tab badge shows selection count | IndexedDB; Render /library/v1/exports/plan and /exports/s/..., /corpus | check_library_page section export-panel (all six controls, re-plan on 409 SET_CHANGED, IndexedDB-blocked context offers library-selection.json) |
| 19 | Reader: normalized view | Paper with lyric/blank/structure lines, analysis numbers, indent, dir/lang; 250-row pages, Load next/preceding | #library/read/<id> | static r/<hh>/<id>.json.gz (+ .p<k>); normalized text and ranges derived | check_library_page section reader (RTL Persian, Kalevala paging and DOM windowing <=750 rows); check_library_data derived text hash for all units; check_library_perf reader-ready |
| 20 | Reader: source-transcription view | Checkbox shows all line kinds with physical numbers and source_text | #library/read/<id>?view=source (remembered via UILayout) | r/ lines source_text (when different) + source_cp_range | check_library_page section source-view (physical numbering, marks switch to source ranges) |
| 21 | Reader: text size | A−/A+ 16–32 px, default 20 | #library/read/<id> toolbar | UILayout.remember('library-text-size') | check_library_page section text-size (bounds, default, survives reload) |
| 22 | Line selection and passage actions | Line-number toggles; sticky bar Inspect, Compare passage, Annotate, Open excerpt in Lyrics, Clear; per-line ↗ to Sources lens | #library/read/<id> | static lines + derived line ids | check_library_page section passage-actions (each action; Escape clears selection last) |
| 23 | Reading position | IntersectionObserver saves {line_id, offset} to position:{snapshot}:{id} (800 ms); restores | #library/read/<id> (deep-link ?line wins) | IndexedDB position:{id} {line_id, offset, revision} | check_library_page section position (reload restores; revision change restores by line_id or shows notice; blocked IndexedDB shows unsaved) |
| 24 | Text marks | TextMarks exact/mapped marks from evidence or ?span anchor; evidence-highlight and passage-selected classes | #library/read/<id>?span=a:b&precision= | static ranges + Render evidence/search_hit | check_library_page section marks (goldens from text-marks.tsx on astral and RTL fixtures; token contrast both themes) |
| 25 | Inspector presentation (desktop column, mobile sheet) | 344 px sticky column; below 900 px bottom sheet 85svh; collapse; Inspect button | #library/read/<id> | UILayout pane library-inspector | check_mobile_layout inspector sheet reachable >=44px; check_library_page section inspector (splitter, Reset layout) |
| 26 | Lens: Summary | Physical rows, scope, coverage, Export analysis, Earlier analyses; ?lens replace | #library/read/<id>?lens=summary | r/ census + IndexedDB interpretations + Render job | check_library_page section lens-summary |
| 27 | Lens: Sound | Evidence minus form/language/syllable/token; Method select; selected-line filter; Load more | ?lens=sound | Render /library/v1/jobs/:id pages (client-verified, IndexedDB LRU); methods.json | check_library_page section lens-sound (predicate equals old lens filter on fixture evidence) |
| 28 | Lens: Form | Structure/Returns/Voices/Narrative from form_result | ?lens=form | Render evidence + hydrateEvidence/component port | check_library_page section lens-form (tree goldens from evidence-records.ts) |
| 29 | Lens: Rhythm | Syllable records or rhythm form_result | ?lens=rhythm | Render evidence | check_library_page section lens-rhythm |
| 30 | Lens: Language | language_result tree | ?lens=language | Render evidence | check_library_page section lens-language |
| 31 | Lens: Sources | Work/edition/contributors/metadata, rights + source_basis, required credits, engine identity, source labels, snapshot/revision/SHA256 | ?lens=sources | r/ header (source_labels, source_basis) + rights/meta shards + notices | check_library_page section lens-sources (Hafez MIT notice, Gutenberg terms, DCS credit, labels present on a labelled song); label census gate |
| 32 | Analysis jobs: create | POST /api/library/analyses relayed by the Worker over the HMAC bridge; per-viewer idempotency | 'Analyze entire work' / per-method buttons | Render POST /library/v1/analyses (cookie viewer, server-filled snapshot) | test_library_routes create (202/200, IDEMPOTENCY_CONFLICT, STALE_READING with current_revision, 403 held, QUEUE_FULL, per-IP outstanding cap, cookie minted only here, no capability in body or log); check_library_page section analyze |
| 33 | Analysis jobs: poll | GET jobs/{id} every 3 s while queued/running/deferred_requeue | inspector status | Render GET /library/v1/jobs/:id | test_library_routes viewer-isolation (other cookie 404); check_library_page section poll (stops on terminal states, pauses when hidden) |
| 34 | Analysis jobs: cancel | POST jobs/{id}/cancel with idempotency-key | Cancel button | Render POST /library/v1/jobs/:id/cancel | test_library_routes cancel (idempotent repeat); check_library_page section cancel |
| 35 | Analysis jobs: resume | POST jobs/{id}/resume from paused/cancelled/failed | Resume button | Render POST /library/v1/jobs/:id/resume | test_library_routes resume-identity (changed identity refused; older-snapshot job offers re-run) |
| 36 | Analysis jobs: delete | DELETE jobs/{id}, tombstone, related exports removed | Delete analysis | Render DELETE /library/v1/jobs/:id | test_library_routes delete-tombstone (repeat returns deleted; 410 after); IndexedDB reference removed |
| 37 | Evidence pages | manifest + results pages via verifiedPull with R2 cache; hydrateEvidence; EvidenceCard; Locate N lines | lenses 'Load more evidence · page n' | Render manifests/:sha, manifests/:sha/pages, pages/:sha (private immutable); client sha256 + IndexedDB 64 MB LRU | test_library_routes manifest-pages (STORAGE_CORRUPT on tampered store page); check_library_page section evidence (tampered response rejected client-side) |
| 38 | Earlier analyses | job ids in interpretation:{snapshot}:{id}:{revision} | Summary lens list | IndexedDB interpretation:{id}:{revision} + Render GET jobs/:id | check_library_page section earlier-analyses (404 reads 'earlier browser session' with re-run offer) |
| 39 | Latest evidence checkpoint | 'Load latest evidence checkpoint' when a newer manifest exists | inspector status | Render job.manifest_hash vs displayed hash | check_library_page section latest-checkpoint (fixture advances manifest_hash) |
| 40 | Declarations editor | 482-line client editor; Apply saves to device and prompts re-run; Advanced JSON; Download | Annotate / 'Reading interpretations' in inspector | analysis chunk (+ declaration-options.json bundled); IndexedDB; import of old reading-declarations.json | check_library_page section declarations (scripted output equals old editor goldens; Apply sets declaration_set in POST; invalid JSON refused; Site file imports) |
| 41 | Pronunciation choices | token reading_choices to declarations.pronunciations rows, 20 at a time | inspector after evidence | Render token evidence + IndexedDB | check_library_page section pronunciation (rows {line, token, word, phones, basis, source} equal goldens) |
| 42 | Comparison picker | metadata/{id} + search work= for other readings; free search limit 20, 250 ms debounce; ?compare | #library/read/<id>?compare=<id> (.cm-panel sheet) | static r/ header work_readings; free search via Render /library/v1/search limit 20 | check_library_page section compare-picker (candidates equal Worker work search; Escape closes and removes ?compare) |
| 43 | Aligned comparison and diff | alignLines + intraLine, source toggle, passage restriction, Earlier/Other/Differences, 250-row paging, reviewed badge | #library/read/<id>?compare=<other> | static r/ files (all pages) of both readings | check_library_page section compare-diff (golden alignment from compare-text.ts on fixture pairs; mobile single-column modes) |
| 44 | Read aloud | Web Speech voice select (Match language), speed 0.5–2, Play/Stop; card autoplay | reader Read aloud panel; ?autoplay=1 transient | static analysis lines (all pages); device speechSynthesis | check_library_page section read-aloud (speechSynthesis stub: one utterance per line, rate/voice applied, autoplay consumed) |
| 45 | Download: provenance | reading-provenance.json from whole reading | Sources lens 'Source details' | r/ + rights/meta shards + notices (exact rebuild) | check_library_data provenance byte-equality for every readable unit; check_library_page section download-provenance |
| 46 | Download: declarations | reading-declarations.json | declarations editor Download | IndexedDB / editor state | check_library_page section download-declarations (bytes equal goldens) |
| 47 | Download: unsaved selection | library-selection.json when IndexedDB failed | #library/rights export panel | in-memory selection | check_library_page section download-selection (IndexedDB denied) |
| 48 | Selection export ZIP (PROVENANCE/ATTRIBUTION/NOTICES) | POST exports + step loop + R2 chunks; resume via IndexedDB; viewer-isolated 30-day record | #library/rights 'Export selected readings'; reader Export selection toggle | Render POST /library/v1/exports/plan then GET /library/v1/exports/s/<set>/<format>.zip?sel= (stateless stream) | test_library_exports byte-equal to Worker goldens (text/json/csv), same request twice same sha256, SOURCES only for wholly readable, 409 for held; check_library_page section export |
| 49 | Analysis export ZIP | POST analyses/{job}/export + step loop; codex-musica-analysis.zip with ANALYSIS/* | Summary lens 'Export complete analysis' / 'Export partial checkpoint' | Render GET /library/v1/jobs/:id/exports/<manifest>.zip (cookie-bound) | test_library_exports analysis golden; partial flag; other viewer 404 |
| 50 | Whole-corpus export: text | Prebuilt 63.6 MB (5226) in 8 R2 parts via an 'all' export | #library/rights 'Export readable corpus' (Text) | Render GET /library/v1/corpus/317c5afae76b/text.zip (73,439,381 B, Range, X-Library-SHA256) | qualify_reader --verify-existing; test_library_routes corpus-range; smoke_library_live HEAD size/sha |
| 51 | Whole-corpus export: json | Prebuilt 305 MB (5226) in 37 parts | same panel (JSON) | Render /library/v1/corpus/<snap12>/json.zip (363,604,074 B) | qualify_reader sha256; no SOURCES entry for a withheld whole source |
| 52 | Whole-corpus export: csv | Prebuilt 117.5 MB (5226) in 15 parts | same panel (CSV) | Render /library/v1/corpus/<snap12>/csv.zip (140,958,923 B) | qualify_reader sha256; header equals CSV_FIELDS |
| 53 | Open in Lyrics (whole reading) | window.open + postMessage handshake to codex.html?cm_library_origin&nonce#lyrics; 8 MiB cap; bundle fallback | reader 'Open in Lyrics' to uiOpenInLyrics to push #lyrics | static r/ + shards + notices; Lyrics imports.library to lyLibraryReceiver.importEnvelope | test_library_import_inpage.js (five ids, digest, rights carried, previous draft preserved, Back returns); check_library_isolation (rule 1) |
| 54 | Open excerpt in Lyrics | Excerpt scope, lineage filtered, declarations [] | passage bar to #lyrics | in-page envelope | test_library_import_inpage.js excerpt (text and lineage equal selected lines) |
| 55 | Deep links | Path routes /, /works, /rights, /collections/:id, /read/:id with query state | codex.html#library[/works\|/rights\|/collections/<id>\|/read/<id>][?…] | shell uiRouteOf + page.route | check_library_page section deep-links (each form cold-boots; snapshot=5226 link opens with no error); check_ui_foundation K (sub-route survives boot; #genre…#lyrics and ?trad unchanged); move-page translation unit test |
| 56 | Back/Forward | pushState/popstate; '← Works' previousLocation + scroll restore | uiSubroute push/replace; hashchange to page.route(sub,{pop}) | history.state libScroll/libPrev | check_library_page section history (Explore to collection to reading to lens to Back/Forward; Lyrics handoff then Back); inventory history-back-between-sections names five sections |
| 57 | Device-persisted state (+ import from old Site) | IndexedDB codex-musica-library-v1 on chatgpt.site with snapshot-scoped keys; 'unsaved' notices | all #library routes; 'Import device data from the earlier Library' on #library/rights | IndexedDB codex-musica-library-v1 on codexmusica.com with snapshot-free keys (export-selection, position:{id}, interpretation:{id}:{revision}, shelf-position:{lang}, pending-export, analysis-export) + evidence store | check_library_page section device-state (each key persists; failure shows unsaved; import fixture remaps and reports); check_library_isolation (no cookie or capability in storage) |
| 58 | Your recipe on the Library route (one-workspace) | Not applicable (separate site) | #library with recipe:'sidebar' (collapsed default); 'Loading your recipe…' during deferred workspace | shell session (formats unchanged) | check_ui_foundation one-workspace on #library; fault library-loses-recipe; check_lazy_app (saved-session #library boot shows pending panel then cards, no EngineNotReadyError, navigation to every route before workspace ready works) |
| 59 | Design system and dark mode | Hard-coded light Google palette, no dark mode, own header | #surface-library scoped CSS on --cm-* tokens | src/theme.css tokens | check_ui_foundation D neutral dark surface; check_library_page renders every state light and dark |
| 60 | Reader Method filter and reference (added in Revision 2) | Method select filters evidence by method_id (reader.tsx:96,681,1044); the reader has its own Method reference list (1111), separate from the Rights page definition filter | #library/read/<id> inspector | static methods.json + Render evidence | check_library_page section reader-method-filter (predicate equals the old filter on fixture evidence; reference list equals the old reader list) |

## Gates and files

ADDED: SHELL AND PAGE CODE
- src/pages/library.js and src/pages/library.css: the inline stub.
- src/library/*.js: chunk sources (core, carousel, rail, works, rights, data, state, route, uuid5/sha1, reader, marks, inspector, evidence, analysis, declarations, pronunciation, compare, compare-text, speech, exports, handoff, inflate, icons).
- src/library_preload.js and src/boot_preload.js.
- library/code/*.<sha10>.js and library/code/previous.json: generated by build_html.js and committed like codex.html.

ADDED: DATA AND ART
- library/data/**: generated by scripts/build_library_data.py via the new lyric-harness/library/catalog_static_export.py.
- assets/library/art/*.{avif,webp}: built by the new build_library_art.js (--check).
- assets/library/art-src/* and assets/library/artwork.json: moved from sites/library.

ADDED: GATES AND TOOLING
- check_library_data.js: count, per-id, rights, label census, order parity, provenance byte-equality, size budgets.
- check_library_regression.js.
- check_library_page.js: Playwright over the flagged lazy build, with _pages_server and a local mcp server on a fixture snapshot built at test time from tests/library/fixture-sources.json (about 25 corpus files: sonnets, whitman, fas_hafez, a held ganjoor file, a DCS file, ltc, the generated research-only file, a labelled song file, one oversized header reading).
- check_library_perf.js and _pages_server.js.
- check_library_isolation.js: rule 1; no x-reader-* or secret names; no cookie or capability in storage; after PR 6c, no 'chatgpt' in codex.html or library/code.
- check_library_publish.js: check_atlas_publish-style servability.
- check_pages_size.js: tree <=950 MB, no file >=100 MB.
- smoke_library_live.js.
- test_library_import_inpage.js.

ADDED: TEST DATA
- tests/library/units-5226b4fb.tsv.gz and tests/library/units-317c5afa.tsv.gz.
- tests/library/id-map.json, eligibility-changes.json, revisions.json and data-manifest.json.
- tests/library/goldens/317c/** (Worker goldens).
- tests/perf/library-baseline.json.

ADDED: RENDER AND CATALOG
- lyric-harness/library/search_store.py and lyric-harness/library/test_search_store.py.
- mcp/library_routes.js, library_search.js, library_search_hit.js (port of search-hit.ts), library_exports.js, library_zip.js (port of zip-stream.ts) and library_viewer.js.
- mcp/test_library_routes.mjs and mcp/test_library_exports.mjs.

ADDED: DOCS
- docs/library.md: contract, hash grammar, data layout, refresh and retirement runbooks.
- docs/library-performance.md.

CHANGED: SHELL SOURCES
- src/workbench.js:
  - UI_ROUTES fifth entry (flag-gated until cutover); uiLibraryLink removed;
  - uiRouteOf at 156-163, 1011-1014 and 1047-1063; route and currentRoute hooks; imports registration;
  - new APIs uiSubroute, uiOpenInLyrics, uiEnsureWorkspace, uiLoadChunk;
  - deferred-workspace guards in uiStart (uiRestoreSession and renderAll queued);
  - CMLibraryImport dropped from /* global */ in PR 6c.
- src/app.js: BOOT_ROUTE_LIBRARY; _initApp(deferWorkspace) guard clauses and _initWorkspace(); ENGINE_AT_BOOT and CATALOG_READY not awaited on #library; low-priority workspace fetches; Engine.start and prose suppressed while view==='library'.
- src/engine_preload.js: route test.
- src/index.template.html: <!--@LIBRARY_PRELOAD--> marker; BOOT_PRELOAD emitted as a script.
- src/pages/lyrics.js: imports.library hook; the 'Library source' card icon becomes 'library'.
- src/library-import.js: handshake removed in PR 6c; importEnvelope, validateEnvelope, canonical and envelopeDigest kept.
- src/theme.css: --cm-route-library.
- src/workbench.css: nav icon colour, narrow rules retargeted (1300-1315 plus the listed selectors), 60% phone-sheet rule.

CHANGED: BUILD
- scripts/build_html.js:
  - PAGES += 'library';
  - chunk emission with the sha384 table;
  - LIBRARY_PRELOAD and BOOT_PRELOAD;
  - CODEX_LIBRARY=1 flag and the preview flag;
  - embedded build inlines chunks as passive blocks;
  - --check verifies chunk existence, integrity and ceilings.
- scripts/build_favicon.js: derived 56px header mark, used by uiStart's brand <img>. References updated in check_ui_foundation.js:207, ui_reachability_check.js:434 and build_atlas_standalone.js:130-132.

CHANGED: EXISTING GATES
- scripts/check_payload_budget.js: the seven new rows.
- scripts/check_lazy_app.js:
  - the shim serves library/ with arrayBuffer() and body for .gz;
  - a jsdom ResourceLoader for library/code;
  - the library route sweep;
  - boot-call trace equality for non-library routes (wrapping the global boot functions);
  - request-order assertions in both directions;
  - the deferred-workspace states.
- scripts/check_workbench.js: a Library-aware mcp mock in place of the blanket {ok:true, enabled:true}.
- scripts/check_ui_foundation.js: stage K rewritten for a native route; stage E loop gains library; stage D runs on #surface-library; one-workspace on library; header comment.
- scripts/check_mobile_layout.js: view-library, Library search, filter, tabs, inspector.
- scripts/check_layout_usability.js: five-entry header.
- scripts/ui_reachability_check.js PRECONDITIONS ('library view', 'library reader', 'library analysis'), and tests/ui_capability_inventory.md (navigation-library, one entry per feature row, five-section history, Counts).
- scripts/faults.js: library-loses-recipe, library-held-body-served, library-chatgpt-link, library-boot-waits-catalog, library-capability-persisted, library-readable-regression, library-count-drift, library-labels-missing, library-chunk-stale.
- scripts/test_library_import*.js: rewritten in PR 6c.

CHANGED: REPO CONFIGURATION
- scripts/_build_closure.js: src/library/** as closure, library/code/** as output, library/data/** and tests/library/** in a library-data class inert to the Node builders.
- scripts/check_artifact_fresh.js: library/code current plus previous generation, no stale extras.
- .prettierignore: library/data, library/code, tests/library.
- eslint.config.js: src/library as browser scripts, plus the no-restricted-globals isolation rule.
- package.json scripts: build:library-data, check:library-data, check:library, test:library-routes, check:library-perf, assets:library-art; wired into test:serial and test:app.

CHANGED: CI AND PUBLISHING
- .github/workflows/ci.yml:
  - verify runs the --committed gates;
  - new library-data, library-parity and library-perf jobs;
  - lyrics-image adds qualify additions and a GHA buildx cache scoped to the library Dockerfile stage.
- .github/workflows/sync-pages.yml and scripts/publish_guard.sh (+ check_publish_guard replay): publish library/code with codex.html and keep the previous generation.
- docs/branch-protection.md: library-data added as a required check.
- docs/ui-foundation.md and docs/production-workbench.md: five routes, hash grammar, new APIs, first-visit chunk rule, deferred workspace.

CHANGED: RENDER
- mcp/server_http.js: store and scheduler decoupled from the bridge secret; mount /library/v1; CORS changes; query redaction for /library/v1/search and /exports; /health and /ready library block.
- mcp/reader_job_store.js: capabilityFor; gzip-at-rest pages if approved.
- mcp/reader_routes.js: export the shared job-creation helper.
- mcp/ratelimit.js: LIBRARY_LIMITS.
- mcp/Dockerfile: search store in the assets stage; a dedicated library-downloads stage; ENV LIBRARY_DIR; the 5226 stage dropped in PR 7.
- mcp/qualify_reader.mjs: library routes, per-id and static agreement, corpus, memory peak; manifest read in place of literal counts.
- mcp/production-config.json: LIBRARY_PUBLIC; READER_REQUIRED=1 at cutover.
- Docs: mcp/READER_RUNTIME.md, mcp/README.md, mcp/PRIVACY.md, PRIVACY.md.
- scripts/check_deploy_memory.js: band re-measured if the peak moves.

RETIRED IN PR 7
sites/library/**, .github/workflows/library-site.yml, the Dockerfile approved-library stage, release_assets retention usage, test_retained_reader_catalog.py, mcp/README.md:246-253, /internal/reader with reader_protocol.js, and the READER_BRIDGE_SECRET and READER_SITE_ID dashboard secrets.

## Risks

- The shell boot change touches every route. Mitigations: _initApp gains guard clauses only, and non-library boots call the same functions in the same order. check_lazy_app enforces this with a boot-call trace equality check (global functions wrapped in jsdom) and request-order equality. The A/B timing gate against the merge-base covers timing, and fault library-boot-waits-catalog covers the boot gate. Residual risk remains on rarely exercised session-restore paths.
- Inserting the browse_boot preload from a script hides it from the preload scanner, so existing routes could start that fetch slightly later. The existing-route A/B gate decides. The fallback restores the static link and accepts browse_boot on the #library path.
- GitHub Pages scale: about 28.9k more files (from 35k to 64k) and about 68 MB more (the tree grows from 713 to about 782 MB) could slow or time out pages-build-deployment. PR 2 lands the data alone and measures the deploy. check_pages_size caps the tree at 950 MB. Contingency: serve r/ from Render with one constant change. Optionally move docs/everynoise-integrations (280 MB) out of the served tree.
- How Pages serves .json.gz (Content-Type and Content-Encoding) cannot be checked offline. Mitigations: a PR 0 probe file with a live header check, and a client magic-byte sniff with an inflate fallback.
- Pages publishes at merge, but Render promotes only after Production qualification. Units whose revision changed in a corpus PR therefore get STALE_READING on analysis, revision-mismatched search marks, or export 409s until promotion, typically up to a day. Revision addressing confines this to changed units, and smoke_library_live alerts if skew lasts more than 48 h.
- Render capacity on one standard instance. The search store and LRU add about 40-120 MB to the 1638 MiB bound, measured by qualify_reader. Public analysis can fill the 16-job queue. Corpus downloads (578 MB per full set) cost egress, and the image grows by about 0.7 GB with about 3-5 more minutes of build unless the library stage cache hits. Rate limits are process-local and reset on deploy.
- Persistent-disk deploys on Render are not zero-downtime, so search, held metadata, exports and analysis are briefly unavailable at each promotion. Reading, Explore, default Works lists, compare, provenance and the Lyrics handoff stay up because they are static.
- The reader storage quota stays tight without compression: about 100 analyses per 30 days at 256 MiB uncompressed. The recommended gzip-at-rest change is a store migration, and must read old uncompressed objects by sniffing.
- Safari ITP may cap the viewer cookie at 7 days, because mcp.codexmusica.com is a CNAME to Render. A Safari user idle for a week then loses access to their own earlier analyses. Re-runs are deterministic, and the UI and PRIVACY.md say so.
- Viewers are self-minted, so the per-viewer cap is weak. The per-IP outstanding cap and the mint limit are the real bounds, and a multi-IP client could still fill the queue. Analysis yields to lyric work, so lyrics are not starved, but Library users may see QUEUE_FULL.
- Port fidelity: Node re-implements SQLite instr, ASCII lower() and BINARY ordering, plus hit projection and exact ZIP bytes. Goldens captured from the Worker's own code on a pinned 317c rebuild, and a SQLite differential, guard this, but corners missing from the query set can still drift.
- Chunk ceilings may not hold: the reader chunk is likely 15-17 KB, not 11 KB. Budgets are set with headroom, and PR 4 re-derives them from the real port before they are treated as fixed.
- Chunk version skew under Pages' 10-minute cache is covered by keeping the previous generation, but a deploy that publishes twice within 10 minutes can still produce a 'site was updated, Reload' prompt.
- codex.html has no CSP. An XSS on codexmusica.com could act as the viewer through credentialed fetches, though it cannot read the HttpOnly cookie. A CSP is recommended as follow-up work.
- Rights surface moving to the main domain: held-unit titles that embed short body fragments (the ganjoor radif) appear through search, and Gutenberg texts admitted on a USA-only basis are served publicly. Both are unchanged from the approved Site but need John's explicit confirmation.
- Pre-existing exposure outside the Library's scope: Pages serves main verbatim, and held corpus files are tracked (for example lyric-harness/corpus/san_dcs_verse.txt and corpus/song/ltc_huajianji.txt). So held bodies are already fetchable at their repo paths, whatever the Library does.
- Device-state migration depends on one Sites deploy that John runs. Without it, old links break when the project is deleted, and selections and positions on the old origin are lost; only manual declaration files carry over.
- CI cost: library-data takes about 12-13 min on catalog-input PRs, including lexicon PRs that touch sources.tsv; it passes without regeneration when content is unchanged. library-perf adds about 15 min on src PRs plus a nightly full matrix, and library-parity adds about 10 min when its paths change. Runner variance is handled by interleaved A/B runs and medians.
- Some parity quirks are kept on purpose: the art() substring rule (a Dickinson cover on 'Charles Monroe Dickinson') and Welsh-first shelf order. John may want them fixed after parity ships.

## Owner decisions (base list; see Revision 1 changes above)

- Data plane split: reading, shelves, default lists, compare, provenance and the Lyrics handoff come from static files on codexmusica.com (Pages). Search, held metadata, exports, corpus packages and analysis come from mcp.codexmusica.com. Nothing else is hosted anywhere. Recommended: approve. It keeps reading up through Render deploys and costs no Render egress for reads.
- READER_RUNTIME.md amendment: a public /library/v1 browser family with an unsigned 256-bit HttpOnly __Host- viewer cookie and capabilities derived in-process. The rule that capabilities never appear in URLs, client persistence, analytics or logs stays verbatim. Recommended: approve. No new secret is required.
- Reader storage capacity: store evidence pages gzip-compressed at rest (about 18x smaller) and keep READER_STORAGE_MAX_BYTES at 256 MiB on the 1 GB disk, rather than raising the quota or shortening retention. Recommended: approve the compression change.
- Whole-corpus packages (578,002,378 B for 317c): bake them into the Render image and stream them from mcp.codexmusica.com with Range, limited to 6 downloads per IP per day and 2 concurrent. Recommended: approve and accept the egress. GitHub Release assets would put a github.com URL in the download, which is a different host.
- Held and research-only metadata rows on codexmusica.com, exactly as the approved Site shows them, including titles that embed short body fragments (the ganjoor radif). Bodies, snippets and labels stay refused. Recommended: keep.
- Public serving on codexmusica.com of Gutenberg texts admitted on Project Gutenberg's USA public-domain affirmation, with the USA statement shown on Sources & rights. Recommended: confirm.
- Final Sites deploy: one move page with a device-data download, path-to-hash redirects and 410 for /api/library/*, kept 12 months; then delete the Sites project. Recommended: yes. Without it, old links break and device state cannot move.
- Existing private analysis jobs and the old Site's D1/R2 state are not migrated. Record the counts, delete D1/R2 30 days after the move page ships, and purge the old Site's reader jobs at retirement. Recommended: accept; re-runs are deterministic.
- Remove the retained 5226 snapshot from the image and retire /internal/reader, READER_BRIDGE_SECRET and READER_SITE_ID in PR 7, after the move page stops old-Site analysis calls. Recommended: yes.
- Timing of SITE_ORIGIN receiver removal: in PR 6c, right after you confirm the move page is live, or 7 days after cutover if it is not deployed. Recommended: yes. Old-Site users keep the bundle download in that window.
- Recipe panel on the Library route: 'sidebar', collapsed by default and sharing Lyrics' preference, with a 'Loading your recipe…' state during the deferred workspace. Recommended: approve. The alternative 'dock' takes vertical reading space.
- Deferring browse_boot and engine.json on #library: both load at low priority after the first Library milestone, and the engine and genre prose never load while the Library is open. Recommended: approve.
- Navigation entry: label 'Library', the lucide library-big icon (book-open already means Form & story in Lyrics), fifth position, colour --cm-route-library = --cm-green. Recommended: approve.
- A derived 56px header brand mark generated from the approved master through build_favicon.js. It saves about 27 KB per cold load on every route. Recommended: approve.
- Pre-cutover production preview at codex.html?library-preview=1#library for 3PO and your acceptance and a production PageSpeed run, enabled only after every feature-matrix test is green and for at most 7 days. Recommended: yes.
- Performance thresholds: on mobile Slow 4G, shelves-ready and reader-ready at most 0.55x the old Site, under 4.5 s and 4.8 s; on desktop, at most 0.5x; existing routes within max(3%, 60 ms) on mobile. Caps are confirmed from the PR 0 baseline and only ever tightened. Recommended: approve.
- CI and readiness: Library qualification failures block image promotion in CI, but production /ready does not depend on the Library (no LIBRARY_REQUIRED). READER_REQUIRED=1 is pinned at cutover. Recommended: approve.
- Served-tree headroom: keep docs/everynoise-integrations (280 MB) published for now (about 782 MB in total), and pre-approve moving it if check_pages_size trips or the Pages deploy slows. Recommended: approve.
- Pre-existing exposure outside this design: held corpus files under lyric-harness/corpus are publicly fetchable from codexmusica.com because Pages serves main verbatim. Recommended: open a separate decision on serving an allowlisted tree; it does not block the Library.

## Phasing

Principle: the published codex.html changes nothing user-visible until PR 6. Every Library feature is built behind the build flag CODEX_LIBRARY=1, and CI builds and gates that flagged variant in a temporary directory. No partial tab ever ships. Render goes first because Pages publishes at merge.

PR 0: evidence (no behaviour change)
- tests/library/units-5226b4fb.tsv.gz and units-317c5afa.tsv.gz (every unit, pinned sha256), the empty ledgers, check_library_regression.js and fault library-readable-regression.
- library-site.yml extended to capture Worker goldens on a pinned 317c rebuild from commit 031b7de's sparse catalog inputs: at least 300 search queries, readingPage and whole-reading samples (including a header reading), hit projections, and ZIP sha256s for fixed text/json/csv selections and one analysis export. Committed to tests/library/goldens/317c/.
- check_library_perf.js and _pages_server.js with symmetric milestone detection. A manual-dispatch run records the old Site's baseline from a GitHub runner, plus the current-route baselines, in tests/perf/library-baseline.json.
- A Pages probe file with a live .json.gz header check.
- check_pages_size.

PR 1: Render, dark (LIBRARY_PUBLIC=0)
- server_http.js reader decoupling.
- mcp/library_routes.js, search, hit projection, exports, zip and viewer.
- ReaderJobStore.capabilityFor, and gzip-at-rest if approved.
- CORS, per-IP limits and query redaction.
- search_store.py in the assets stage; the cacheable library-downloads stage.
- qualify_reader additions.
- test_library_routes and test_library_exports against the goldens; the library-parity job.
- The check_workbench Library mock.
- READER_RUNTIME.md, PRIVACY.md and mcp/PRIVACY.md amendments.
- Deploy, then verify /library/v1/health on production.

PR 2: static data, live on Pages but unreferenced
- build_library_data.py and catalog_static_export.py (snapshot at lyric-harness/library/snapshot, labels asserted).
- library/data/** for 317c, art renditions.
- check_library_data (count, per-id, rights, label census, order and summary parity, budgets) and check_library_publish.
- The library-data CI job made required; prettier, eslint and closure classification.
- Measure the pages-build-deployment duration. If it fails or exceeds 7 min, switch r/ to the Render contingency before PR 4.

PR 3: shell infrastructure, neutral for the four routes
- uiRouteOf, route and currentRoute, uiSubroute, uiOpenInLyrics and the Lyrics imports hook.
- The deferred-workspace boot (guard clauses, _initWorkspace).
- Chunk emission, loader and SRI, LIBRARY_PRELOAD and boot_preload, the engine_preload route test.
- check_lazy_app boot-trace and request-order gates; check_artifact_fresh and the sync-pages/publish_guard generation handling.
- The derived brand mark.
- The A/B gate must show existing routes no slower.

PR 4: Library UI A (flagged)
- core: Explore with carousel and positions, cards, rail, tabs, Works (search, filters, pagination, table, held sheet), collection views, Rights (census, credits), export panel UI, selection, device state and its import.
- reader: normalized and source views, text size, selection and passage actions, position, marks, inspector, Summary and Sources lenses, read aloud, provenance download, Open in Lyrics (whole and excerpt).
- compare: picker and diff.
- check_library_page stages for all of these. Chunk ceilings re-derived from the real ports.

PR 5: Library UI B (flagged), then Render live
- analysis chunk: create, poll, cancel, resume, delete, evidence pages, earlier analyses, latest checkpoint, the four evidence lenses, method reference, declarations editor and download, pronunciation choices.
- Selection, analysis and corpus export wiring.
- The last commit sets LIBRARY_PUBLIC=1. The full feature matrix then runs from the flagged build against production Render.

PR 5b: preview (only if John approves)
The stub and chunks ship in production codex.html. The route is reachable only via ?library-preview=1, for 3PO and owner acceptance and a production PageSpeed run, for at most 7 days.

PR 6: cutover (single PR)
- Flip the flag: the fifth UI_ROUTES entry and the PAGES entry go live; uiLibraryLink is deleted.
- Rewrite stage K; update mobile, layout, reachability, inventory and faults; update the docs.
- Enforce the perf thresholds and budgets; pin READER_REQUIRED=1.
- Merge only when every feature_matrix test is green, the id and label gates are green on the production image, and production /library/v1/health reports analysis_available.

PR 6b: publish day (John runs the Sites deploy)
The move page goes live (device-data export, redirects, 410 for the API), and library-site.yml is retargeted to it.

PR 6c: after the move page is confirmed live, or 7 days after cutover
Delete the SITE_ORIGIN handshake and rewrite test_library_import*.js. check_library_isolation then asserts that no 'chatgpt' string remains.

PR 7: retirement (at least 30 days after PR 6b, with John's go-ahead)
- Delete sites/library and library-site.yml.
- Drop 5226 retention (Dockerfile, release_assets, qualify_reader, test_retained_reader_catalog, mcp/README).
- Drop /internal/reader, reader_protocol.js, READER_BRIDGE_SECRET and READER_SITE_ID.
- John deletes D1/R2 and the old reader jobs are purged.
- The manifests and goldens stay as permanent fixtures.

## Rationale

WHY PERF-FIRST IS THE BASE
perf-first had the highest total score: 21.5 (parity 7, performance 8.5, feasibility 6), against parity-risk-first 19 and ops-simplicity-first 16.5. Two judges named it the best architecture, for two reasons:
- It is the only design that takes the shell's 650 KB to 1.36 MB off the Library's critical path (app.js:658-682, 17620-17628).
- Its reads are resilient: static reading keeps working through Render deploys, which a persistent disk prevents from being zero-downtime (render.yaml:34-37).

FATAL AND SERIOUS FLAWS, AND HOW EACH IS RESOLVED
1. Two snapshot authorities on different deploy clocks (the feasibility judge's fatal flaw against perf-first). Verified:
   - catalog.py:634 folds sha256(sources.tsv) into snapshot_id;
   - lexicon PR 605b98487 forced repin f0dd2a006, the third repin in three days;
   - sync-pages publishes at merge, while deploy-connector waits for Production qualification.
   Resolved by:
   - addressing static files and analysis by (reading_unit_id, reading_revision); a revision hashes only that reading's own rights rows;
   - the server filling in snapshot_id;
   - snapshot-free device keys (grafted from ops-simplicity-first);
   - stateless export plans keyed by readable_ids_sha256;
   - a freshness comparison that excludes the projected_from label;
   - regression gates that compare against the baselines rather than a manifest re-committed per snapshot.
   An unrelated sources.tsv edit now changes nothing on Pages and requires no commit.
2. Held metadata losing source_basis (parity judge). The search store is built in the image's assets stage from the full /build/library-canonical, using catalog_site_export's own compact_summary and source_basis, and a summary-parity gate holds it there.
3. The label-path pitfall (parity and feasibility judges). Verified: catalog_site_export.py:175-179, and the scratch 317c export shows label_registry_sha256 None. Resolved by:
   - building at lyric-harness/library/snapshot;
   - asserting that the label reference is attached;
   - a label-census gate;
   - projecting from the verified packs, so the static data equals what the Worker served.
4. Static list order (parity judge). Verified: the Worker sorts on title_search, and 25,469 of 25,525 titles differ from their title_search. Resolved by sorting on (title_search UTF-8 bytes, id) and checking that order with a differential against the Worker's SQL in sqlite3.
5. parity-risk-first's measurement used Lighthouse's simulated constants. Only the applied Slow-4G constants are used here.
6. ops-simplicity-first's fatal flaws:
   - the carousel and shelf positions it dropped are kept, as a Library-owned windowed carousel;
   - its ungated saved-session path is gone, because the route-scoped boot makes a saved session cost nothing before shelves-ready, and that scenario is gated at <=1.05x.

GRAFTED FROM PARITY-RISK-FIRST
- Goldens captured from the Worker's own TypeScript before deletion, plus a SQLite differential.
- Store and scheduler decoupled from the bridge secret.
- Global caps on concurrent exports.
- Manifests listing every unit, not only readable ones.
- Symmetric MutationObserver milestones, so the old Site is measured the same way as the new tab.
- AVIF/WebP derivatives with a per-file budget.
- Passive embedded chunks, so jsdom gates run the real code.

GRAFTED FROM OPS-SIMPLICITY-FIRST
- The unsigned cookie with no new secret, and capabilityFor with no binding table.
- Stateless streamed exports.
- Snapshot-free device keys.
- The cookie-mint limit.
- In-app reader-ready and works-ready gates.
- The production preview flag.
- The hard rule of no Engine.start or prose download while the Library is the view.
- The verified point that sync-pages already serves tracked files.

WHERE THE JUDGES DISAGREED, AND WHAT WAS DECIDED
- Data plane: Pages or Render. Two designs put every byte on Render. Pages wins for reads because:
  - reading survives Render deploys, and Pages has a CDN with no egress cost;
  - revision addressing removes the skew objection;
  - one constant moves r/ to Render if Pages cannot host about 29k files.
- Cookie: signed or unsigned. Unsigned. Self-minted viewers make the per-IP outstanding cap the binding limit either way, and a signing key adds a secret whose loss orphans every analysis.
- Exports: per-viewer records or stateless. Stateless for public selection exports, because there is no private record to protect and the bytes are deterministic. Analysis exports stay cookie-bound.
- Rate limits: loosened from perf-first's after the shared-NAT concern (analysis creates 30/h with 4 outstanding per IP).
- Recipe mode: sidebar, the reading surface choice of perf-first and ops-simplicity-first, rather than dock.
- SITE_ORIGIN removal: neither at cutover (which leaves a window with no Lyrics handoff from the old Site) nor 30 days later (which leaves a 'chatgpt' string). It goes the day the move page is confirmed live.
- The boot-split risk all judges named: handled as guard clauses plus a boot-call trace gate, not a restructure.
- Snapshot pinning for old links: dropped, because every 5226 identity survives in 317c.

THE OPEN QUESTION ALL THREE DESIGNS MISSED
The 256 MiB reader quota against about 2-3 MB of uncompressed evidence per poem. Gzip at rest is recommended, which gives roughly 18x the capacity.
