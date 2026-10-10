# Native Library tab: design (consolidated, for owner review)

**Status:** Proposed, not implemented. Author R2; verifier 3PO. Consolidates review rounds: red-team (Revision 1), 3PO verdicts on 774435ca1 and 44577289c (Revisions 2–3).

Nothing in this document is approved. After R2 and 3PO agree, it goes to John, who makes the decisions listed under "Owner decisions". No implementation starts before then. This text states only the final contract. Earlier wording that a review round replaced has been removed, and "Review history" at the end traces each change to its finding.

Tool names written without a directory are planned files under scripts/. For example, `check_library_data.js` is a planned `scripts/` file that does not exist yet. Line references are to `main` at `031b7de`.

**How to review:** comment inline on this file in PR #519 (Files tab), or post typed comments on #519 (`[FINDING]`, `[QUESTION]`, `[VERDICT]`).

## What John asked for

The Library becomes a native tab on codexmusica.com, as much a part of the site as Genre, Instrument, Map and Lyrics, with no chatgpt.site URL and no link to another website. Every feature ships on day one, with no corners cut. The number of accessible works must not regress, and the tab serves the current catalog, not the old Site's earlier snapshot. Loading must be measurably faster than the old Site.

## Summary

- **Route.** The fifth `UI_ROUTES` entry in `codex.html`: a small inline stub plus SRI-pinned, same-origin code chunks loaded on first visit. No iframe and no other website. Deep links use `#library/works`, `#library/rights`, `#library/collections/<id>` and `#library/read/<id>?…`.
- **Reading data.** Static files on GitHub Pages under `library/data/`, projected from the verified, rights-filtered site export of main's current catalog. That catalog is snapshot 317c5afa: 25,525 readable units against the old Site's 20,865, with all 20,865 old ids kept.
  - Each reading lives under `r/<hh>/<reading_unit_id>/<rev16>-<proj12>/`, keyed by its revision and its projection identity, never by snapshot. A published directory never changes, so unrelated `sources.tsv` edits change nothing on Pages, and an old head can never be paired with a new page.
  - Retained older directories are deleted at once when a unit stops being readable.
- **Render (`mcp.codexmusica.com/library/v1`).** Serves only what needs a server: exact search, metadata for held units, ZIP exports, the whole-corpus packages, and analysis.
  - Analysis identity is a random HttpOnly `__Host-` cookie that Render mints. There is no signing secret in the browser.
  - Job capabilities are re-derived on the server and never leave it.
  - Every credentialed response stays `private, no-store`. Evidence is held only in a per-tab memory cache and renders only after a fresh authorized job read on every activation.
  - Selection exports are addressed by their exact content (`/library/v1/exports/p/<content_id>.zip`, from a server-held plan). Corpus packages are addressed by package hash (`/library/v1/corpus/<package_sha16>/<format>.zip`).
- **Performance.**
  - A `#library` boot skips the shell's catalog and engine waits, which cost 290 KB to 1 MB today. Shelves-ready needs about 3 requests and about 385 KB, all from Pages.
  - Pass requires both absolute caps (mobile Slow 4G: 4.5 s shelves-ready, 4.8 s reader-ready) and a live, same-scenario improvement over the old Site by a margin `m` that John sets (recommended 0.45, which is at most 0.55× the old time), with "ready" defined as usable.
- **No-regression gates.** Immutable per-id manifests for 5226 and 317c; a classifier that reconciles every id; count, rights and label-census gates; goldens captured from the Worker's own code; a synthetic CI timing comparison plus an authoritative live comparison on real hosts.
- **Reader store.** Bounded touches, incremental quota accounting with quiescent verification scans that fail closed while usage is unknown, maintenance off the request path, and gzip at rest in two rollback-safe phases.
- **Phasing.** Everything is built behind a build flag, and the tab goes live in one cutover PR. Render changes ship first, dark. The old Site announces an export window, then becomes a move page that redirects old links and offers device data for download. It is retired later, with John's go-ahead.

---

## Page integration

### Route and nav
- `UI_ROUTES` (src/workbench.js:44-49) gains `['library','Library','library']` as the fifth entry, after Lyrics.
- Icon: the unused `UI_ICONS` 'library' (lucide library-big). 'book-open' already means Form & story in Lyrics (src/pages/lyrics.js:371,930,3240). The Lyrics 'Library source' card (lyrics.js:2055) switches to 'library', so each icon keeps one meaning.
- Colour: `--cm-route-library: var(--cm-green)` in src/theme.css:168-173 (defined in both themes; this is the Library's own #1e8e3e), plus a nav svg rule beside src/workbench.css:1245-1256.
- At cutover:
  - delete `uiLibraryLink` (workbench.js:114-119) and its call (751);
  - retarget the narrow-header rules (workbench.css:1300-1315, plus the `.ui-nav-link` selectors at 85,104,109,537,583,589,963,1215) to `button.cm-tab[data-view=library]`: icon-only at <=440px and 900-1099px, label kept in aria-label and title, target >=44px;
  - scripts/build_html.js:229 `PAGES += 'library'`.
- Before cutover the entry exists only in two cases:
  - in the CI-only flagged build (`CODEX_LIBRARY=1`);
  - after PR 5, if John approves, behind a runtime preview flag: boot sees `?library-preview=1`. The flag is read in the head boot script, so it changes `UI_ROUTES` before page scripts register, and the param is consumed the way `?trad` is, so it does not survive tab switches.

### Code loading (three tiers, same document)
1. **Inline stub**, budget 'library-stub' <=4,096 B gz: src/pages/library.js, src/pages/library.css and src/library_preload.js.
   - Registers `uiRegisterPage({id:'library', recipe:'sidebar', mount, render, route, currentRoute, layout, resetLayout, escape, actions})`.
   - `actions` is the fixed list of 'lib-' names (no shell or page owns that prefix today). Each one delegates to the chunk once it has loaded.
   - `mount()` writes only static skeleton markup: Explore / Works / Sources & rights as a `.cm-tab` group, `.cm-search` and the Filter button; an empty rail; fixed-size shelf skeletons. It does no fetch and touches no lazy-only global.
   - The stub skeleton is byte-identical in the lazy and embedded builds. `#library` is excluded from `check_lazy_app`'s lazy/embedded first-view equality. A Library-specific first-view gate replaces it there: the skeleton must be byte-identical in both builds, and the data-bearing view is tested only in the lazy build.
   - `render()` calls the loader.
2. **First-visit chunks:** sources in src/library/*.js.
   - build_html.js emits them through the existing `squeeze()` as `library/code/<chunk>.<sha256-10>.js` and injects a `LIBRARY_CHUNKS {name:[file, sha384]}` table into the stub.
   - The chunks, with gzip-6 ceilings:

     | Chunk | Contents | Ceiling (B) |
     |---|---|---|
     | core | Explore and carousel, rail, Works, filters, search client, metadata sheet, Sources & rights, export panel, selection, device state, static data client | <=20,480 |
     | reader | paper, marks, selection, position, Summary and Sources lenses, read aloud, provenance download, Lyrics envelope | <=20,480 |
     | analysis | jobs, evidence hydration, Sound/Form/Rhythm/Language lenses, declarations, pronunciation, method reference | <=24,576 |
     | compare | picker, alignLines/intraLine | <=6,144 |
     | inflate | loaded only where DecompressionStream is missing | <=4,096 |

   - These ceilings are re-derived from the judges' check of the React sources: the reader-related sources gzip to 18,812 B before porting. PR 4 records the real ports and lowers each ceiling to measured +15%. Lowering needs no Lighthouse citation.
   - Each chunk carries its scoped CSS as a string, inserted as one `<style>`, and registers the lucide paths it needs into `UI_ICONS`, so codex.html does not grow.
   - **Chunk generations.** sync-pages and publish_guard keep every chunk generation published in the last **30 days** (about 70 KB gz per generation), tracked in a generation manifest under `library/code/`. A tab opened days earlier still finds its chunks under Pages' 600 s TTL.
   - **Chunk recovery.** Past 30 days, a chunk 404 or integrity failure shows uiEmptyState 'The site was updated' with Reload. Reload works in this order:
     1. The tab flushes pending device-state writes and verifies them by reading them back.
     2. If persistence failed, it does **not** reload. It shows the existing "unsaved" state and offers the device-state download.
     3. Otherwise it saves in-memory Library state (passage selection, filter text, inspector and lens) to `sessionStorage` and reloads to the same hash, which restores it.
     The existing save-failure and conflict safeguards are unchanged.
   - **Embedded build:** the same chunks are inlined as passive runtime blocks that only define `window.CMLibraryChunks[name]`, and the loader prefers them.
   - **Data and API bases.** The Library takes them from its own injected constants, `LIBRARY_DATA_BASE` and `LIBRARY_API_BASE`, never from `CODEX_LAZY_API`.
   - Under `file://` the stub shows 'The Library reads its catalog from codexmusica.com' and fetches nothing.
3. **Head preloads.** A new `<!--@LIBRARY_PRELOAD-->` marker emits src/library_preload.js, following the src/engine_preload.js precedent.
   - It acts only when the protocol is http(s) and `location.hash` matches `^#library(/|\?|$)`. It then adds:
     - `<link rel=preload as=script integrity>` for core;
     - `<link rel=preload as=fetch crossorigin>` for `library/data/catalog.json`;
     - on read routes, the reader chunk plus either the r/ head file at the reading's path key, when the link carries it, or the `u/<hh>` shard when it does not (see "Data plane"). Page files are named by content hash and listed in the head, so a deep page is fetched after the head, never preloaded;
     - when `matchMedia('(min-width:1100px)')` holds (rail open), collections.json with fetchpriority=low.
   - Other routes get nothing.
   - Pointer hover (`pointerenter` only, not focus) on the Library nav button adds rel=prefetch for core and catalog.json. The `check_lazy_app` "no library/ request" assertion exempts that explicit hover.
   - The static browse_boot `<link>` (build_html.js:634-636) becomes src/boot_preload.js, placed first in `<head>`. It emits the identical element except on `#library` (see "Performance plan" for the measured fallback).
   - `build_html --check` invariants are rewritten to allow `boot_preload`/`library_preload` in a fixed order, and `check_lazy_app`'s stored-state equivalence becomes route-aware.

### Hash grammar
- Form: `#library[/works|/rights|/collections/<collection_id>|/read/<reading_unit_id>][?params]`. Path names match the old Site, so translating its links is mechanical.
- List params: q, language, availability, completeness, contributor, sort, offset. Defaults (''/'all'/'0') are omitted, as before.
- Reader params: revision, line, offset, span=a:b, precision=exact|span, lens=summary|sound|form|rhythm|language|sources, view=source, compare=<id>, autoplay=1 (consumed with replaceState).
  - `revision` accepts either a full reading revision (old-Site links) or the `<rev16>-<proj12>` path key that the tab writes in its own links. Only the path key lets the head preload skip the `u/` shard.
- All Library state lives in the fragment. `location.search` is never written, so nothing leaks into other tabs' URLs, and `?trad` (workbench.js:1047-1063) is unchanged.
- An old `?snapshot=` is accepted and dropped. Every 5226 identity is unchanged in 317c (critic-verified). A notice appears only when `?revision` differs from the static revision.
- Shell changes are confined to the three places the critic named:
  - `uiRouteOf(hash)` returns `{view, sub}`, splitting at the first '/' or '?'. It is used in uiNavigate (156-163), the hashchange listener (1011-1014) and boot (1054-1063).
  - uiNavigate writes `'#'+view+sub`. On a nav click (sub undefined) it asks `page.currentRoute?.()`, so returning to the tab resumes where the reader was.
  - A same-view hashchange calls `page.route(sub,{pop:true})` without refocusing the nav button or re-applying the recipe mode.
  - New shell API: `uiSubroute(sub,{push,state})`.
- docs/ui-foundation.md:56-62 is amended in the same PR.

### Back/Forward
- Push: section switch, opening a collection or a reading, Works Next/Previous, the Lyrics handoff.
- Replace: q and filters (200 ms debounce, as the Site did), lens, the revision written after load, compare, removal of autoplay.
- Before a push, scrollY goes into `history.state.libScroll`; it is restored in a rAF after render.
- '← Works' calls `history.back()` when `history.state.libPrev` marks a Library list. Otherwise it pushes `#library/works` (the old previousLocation default).

### Recipe panel
- `recipe:'sidebar'`: collapsed by default, sharing Lyrics' remembered preference (workbench.js:207-231). This keeps the one-workspace contract. New fault library-loses-recipe mirrors faults.js #37.
- Below 900px it is the Recipe sheet, and `data-view='library'` joins the 60% phone-sheet rule (workbench.css:2350-2351).
- While the deferred workspace boots, the panel shows a 'Loading your recipe…' `.cm-status` (`data-engine-pending='recipe'`) instead of card rows.

### Hooks
- `escape()`: closes the topmost Library layer in this order: card ⋮ menu, filter sheet, comparison sheet, metadata sheet, mobile inspector sheet, passage selection. Focus returns to the opener. This runs last in the shell's Escape order (workbench.js:1647-1670).
- `layout()`: registers UILayout panes library-rail and library-inspector (default 344px).
- `resetLayout()`: clears both panes and the rail-open default.
- Text size and source view use `UILayout.remember('library-text-size')` and `('library-source-view')`. Nothing enters codex-workbench-v1.
- Ctrl/Cmd+K focuses the Library search only while `UI.view==='library'`. Ctrl/Cmd+Z/Y stay the shell's recipe undo/redo.

### Design-system mapping
- The Library's own header, nav, brand and 'Library.' bar are dropped; the shell owns them.

| Library element | Shell equivalent |
|---|---|
| section switcher, lenses | `.cm-tab` with aria-selected and uiTabIndex roving |
| search | `.cm-search` |
| selects | `.cm-select` / `.cm-input` |
| filter, comparison, metadata and mobile-inspector sheets | `.cm-panel` + `.cm-scrim` |
| ⋮ | `.cm-menu` |
| method reference | `.cm-accordion` |
| comparison modes | `.cm-segmented` |
| language and state badges | `.cm-chip` / `.cm-status` |
| progress | a `.cm-status` row with aria-live |
| empty, loading and failure states | uiEmptyState, never ABSENT wording such as '0 …' |
| toasts | showToast |
| Blob downloads | uiDownload |
| artwork credit | uiPhoto lightbox |

- Every hard-coded colour becomes a token:
  - exact mark: `--cm-accent-soft` fill with an `--cm-accent` underline;
  - mapped mark: dotted `--cm-text-muted`;
  - evidence highlight: `--cm-warning-soft`;
  - passage selection: `--cm-accent-soft`;
  - diff: `--cm-success-soft` / `--cm-danger-soft`;
  - verdict borders: `--cm-success` / `--cm-warning` / `--cm-border-strong` / `--cm-danger`;
  - rail spines cycle `--cm-blue`, `--cm-green`, `--cm-amber`, `--cm-violet`;
  - type covers: `--cm-surface-subtle` with a tinted top border;
  - reading font: the page-scoped `--lib-reading-font` (Georgia stack).
- All CSS is scoped to `#surface-library`.
- The looping, windowed carousel (items tripled, visible cards plus 6 rendered, only the middle copy focusable, Arrow keys step) is a Library-owned component. It is not uiRowsHTML, which only appends and never windows (workbench.js:1376-1388).

### Dark mode
- Comes entirely from tokens; the old Site had none.
- check_ui_foundation D asserts the visible `#surface-library` is neutral (R=G=B within 2).
- `check_library_page` checks mark, diff and verdict contrast in both themes.
- The reading container keeps dir and lang from the reading, so RTL Persian works.

### Rule 1
- The Library never reads app.cards, compileRecipeStack, envCardOf, Engine, Catalog or chat state, and never derives declarations from a recipe.
- Library to Lyrics is a text envelope only.
- `check_library_isolation.js` enforces this with a grep, plus an eslint no-restricted-globals rule over src/library/** and src/pages/library.js.

### Gates that run outside the lazy build
- The Library sections of `ui_reachability_check`, `check_workbench` and `check_mobile_layout` run against the **flagged lazy build**. `_pages_server.js` serves it with the fixture `library/data` tree and a local mcp server built on a fixture snapshot.
- jsdom gets shims for DecompressionStream, IndexedDB and `crypto.subtle`, or those tests run in Playwright instead.
- The feature matrix names the build each test runs in: lazy-flagged, embedded, Render (server tests) or production preview. `check_library_page` fails if a cited test id does not exist.

## Data plane

### Principle
- Every byte on a load path is static on Pages, same-origin, over the HTTP/2 connection codex.html already uses. Pages serves main verbatim (.nojekyll); .json gets transfer gzip; TTL 600 s. Pages ignores query strings, so no static content is versioned by a query.
- Static content is addressed by reading id, reading revision and projection identity, and carries no snapshot_id. So a sources.tsv edit that leaves readable units unchanged changes nothing on Pages.
  - catalog.py:634 folds sha256(sources.tsv) into snapshot_id, and lexicon PR 605b98487 forced repin f0dd2a006.
  - But `reading_revision = sha(reading)`: the revision hashes the whole reading, which embeds only its own sources.tsv rows (catalog.py:372-391,491). So the churn conclusion holds.
  - Enrichments (`source_labels`, `source_basis`, `work_reviewed_equivalence`) are added after the canonical revision is computed (`catalog_site_export.py:243-261`). They are therefore covered by a separate projection identity, `proj12`, not by the revision.
- Render is used for exact search, held metadata, ZIPs, corpus packages and analysis, and nothing else.

### Static builder
New `build_library_data.py` calls a new lyric-harness/library/catalog_static_export.py, which runs four steps.
1. `library.catalog build` into lyric-harness/library/snapshot (gitignored, .gitignore:54), with --repo-sha read from library/catalog_sources.json.
   - This is the layout library-site.yml uses.
   - It fixes the verified label pitfall: pack_export reads `canonical_source.parent.parent/data/lyric_label_prefixes.json` and silently attaches {} otherwise (catalog_site_export.py:175-179). The 317c export measured in an earlier session had label_registry_sha256 None and no references.
2. The unchanged verified exporter, run in order: export_snapshot, then pack_export, then attach_references(reference_dir=lyric-harness/library), then verify_export.
   - The builder asserts `derived_metadata.label_registry_sha256 == sha256(lyric-harness/data/lyric_label_prefixes.json)` and that the source_records and label_prefixes references are attached. This activates verify_export's held-body and held-label refusals (379-380) and its label identity check (319).
3. Projection from the verified packs, not from the canonical files. Pack summaries are compact_summary + source_basis (line 249), and rows carry source_labels. The static data therefore equals what the approved Worker served.
4. Deterministic output: canonical sorted JSON, gzip -9, mtime 0.

The builder sits outside the three traced builders, so lyric-harness stays inert for check_build_closure (_build_closure.js:74-85). It has its own gate, `check_library_data`.

### Layout: `library/data/`
Sizes are measured on 317c by scratchpad r1design/measure_e.py and measure_f.py, plus an earlier collection and unit-shard measurement. PR 2 re-measures every figure after the review changes below and re-sets the budgets from the measurement.

**Identity in every list and shard.** `catalog.json`, `collections.json`, `c/`, `w/` and `u/` files embed `data_id`. A mismatch between them refetches the stale file with `cache: 'reload'`. If the mismatch persists, the tab shows "The Library was just updated" with Reload, keeping the hash route.

1. **catalog.json** (plain; budget <=4,096 B gz). The only data before shelves-ready.
   - format:1;
   - data_id: sha256 of the content manifest;
   - projected_from {snapshot_id, repository_commit}, a provenance label excluded from freshness comparison (see "Snapshot labels");
   - census: the 11 manifest counts;
   - readable_ids_sha256;
   - the shelf languages in catalog order: cym 7, fas 1, fin 3, eng 2,195, ltc 66, non 7 readable collections;
   - the full recorded-language list for the Works filter, separate from the shelf list. It is computed from every collection, including held ones, as the old filter is (`library-app.tsx:1355-1358`). On the local 317c build all 2,327 collections cover eng, ltc, fas, fin, cym, non, san and msa, while the 2,279 readable collections cover only eng, ltc, cym, non, fin and fas. The list adds about 60 B;
   - per language: total plus the first 12 cards `[collection_id, title, readable, recorded, art_id, first_readable_id]`. `first_readable_id` is `readable_reading_unit_ids[0]` in catalog order;
   - only `art_id` for artwork. Rendition paths are derived from it. Artwork credit, source and note text is not in catalog.json;
   - collections_sha.
   Artwork matching uses the old art() rule (library-app.tsx:65-76), computed at build time: 9 collections match. Measured without artwork records: 3,733 B gz. PR 2 re-measures before the budget is fixed.
2. **artwork.json** (plain). Credit, source and note text for the 8 artworks, projected from assets/library/artwork.json. It is fetched by Sources & rights, the card ⋮ menu or the lightbox, never on the shelves path.
3. **collections.json** (plain). **All 2,327 collections** as `[collection_id, title, language, readable, recorded, art_id]`, with their readable count. The rail and shelves show only collections with readable > 0. The 48 collections with no readable unit add 48 rows; their titles are metadata the old Site already published. Measured for the 2,279 readable rows: 171,972 B raw / 78,387 gz; budget <=98,304 gz. Fetched at idle after shelves-ready, or preloaded low on wide screens. When a stored `shelf-position` exceeds the cards in catalog.json, collections.json is fetched on the critical path for that boot only, and the restore is deferred and swapped in place without layout shift.
4. **c/<collection_id>.json.gz** plus `.p<k>` pages of 250 rows.
   - Head: `{readable_ids, rows 0-249}`. `readable_ids` lists every readable unit in **catalog order**, so card Play opens `readable_ids[0]`, the same reading the old Play opens (`library-app.tsx:1310-1313`). Catalog order and display order differ in 707 of 2,279 readable collections (measured).
   - Display rows are sorted separately by (title_search UTF-8 bytes, reading_unit_id). This is the Worker's `ORDER BY r.title,r.id` over the folded column (library-api.ts:363-366; library-catalog.ts binds title_search into r.title). 25,469 of 25,525 readable titles differ from their title_search, so ordering by title would break parity.
   - Row: `[reading_unit_id, rev16-proj12, title, contributors, language, availability, completeness, edition8, work8, source_path, snippet, contributor_search]`.
     - `snippet` and `contributor_search` use the Worker's own definitions: snippet is `substr(search.text, 1, 180)` in code points of the folded body (`library-api.ts:360-367`; `library-app.tsx:1223,1231-1233`). The old table shows them even without a query.
   - About 2.2 MB gz in 2,317 files before the row text (1.61 MB for rows, plus about 0.6 MB of id lists), plus an estimated 2 MB gz for snippet and contributor text. The largest collection has 2,618 readable units.
   - Every unit belongs to exactly one collection (measured), so c/ files partition the readable set.
   - A deep link to a collection with no readable unit opens a Render search with `collection=<id>`, under the static title from collections.json.
5. **w/title/<k>.json.gz:** the default Works list (availability=readable, sort=title, no q), 100 rows per file in the same order and with the same row shape as c/. 256 files, 1,418,845 B gz before the row text, plus an estimated 2 MB gz for snippet and contributor text.
6. **u/<hh>.json.gz:** `[reading_unit_id, rev16-proj12, collection_id]` for every readable unit, sharded on the uuid's first two hex digits. 256 files, 1,236,554 B gz in total, at most 5,998 each. Used for:
   - finding the current path key for a deep link that lacks it;
   - deep-link revision checks;
   - selection membership for imported or old ids;
   - device-state import;
   - the count gate.
7. **r/: one immutable directory per reading projection.**
   - Path: `r/<hh>/<reading_unit_id>/<rev16>-<proj12>/` holds the reading's head file and its page files.
     - `rev16` is the first 16 hex of the reading revision.
     - `proj12` is the first 12 hex of the sha256 of the canonical projected head. That head includes every enrichment and the page-file hashes.
   - The head holds lines 0-249. Page files hold 250 rows each, for the 62 readings over 250 lines (172 page files). Each page file is named by its own content hash. The head lists every page's sha256, and the client verifies each page against it.
   - **A published directory never changes.** An enrichment-only change, such as new labels on an unchanged revision, gives a new `proj12` directory. The old directory's bytes stay identical.
   - **Embedded identity.** Every head and page file embeds `{reading_unit_id, reading_revision, page_index, page_count}`. The client checks all four against what it requested and **fails closed** on any mismatch: it discards the file, shows no text, and runs recovery.
   - **Global coordinates per page.** Every page file's header carries its page-start global offsets: `{row_start, analysis_line_start, normalized_cp_start, normalized_utf16_start, physical_line_start}`. The head carries the same for page 0. Within a page, ranges are derived cumulatively from those starts. No coordinate ever depends on a page that was not fetched.
   - Head content:
     - ids: id, revision, work, edition;
     - descriptive: title, language, direction, notation, completeness, collection_id, source_path, source_sha256, normalized_sha256, contributors[name, role, basis, source_declaration];
     - source: source_marks, source_labels, source_basis, work_reviewed_equivalence, census, source_map minus rows;
     - rights: required_attribution and notice shas inline, rights_ref, metadata_ref;
     - work_readings, only when the work has other readable readings (213 units). It excludes the current id, is title-ordered, and carries title and source_path, matching the old comparison picker's related list;
     - the page list with each page's sha256, and the page-0 start offsets.
   - Line: `[kind, text, indent, physical_line, analysis_line, source_cp_range, source_text only when it differs, source_ranges[codepoint, byte, utf16, physical_line, precision]]`.
   - Derived in the client, never shipped, and gated for every unit:
     - normalized_text = '\n'.join of lyric-row text;
     - normalized code-point and UTF-16 ranges, cumulative from the page's start offsets with +1 between lyric rows;
     - line ids = `'line_'+uuid5(7b347e4c…, 'line:'+id+':'+row)`;
     - source_map.rows = line ids.
     These follow from catalog.py:437-475 and 26-43.
   - Measured before the page list and offsets were added: 158.8 MB raw / 61.6 MB gz in total. Head file 2,006 B gz median, 3,812 at p90, 8,497 at p99, 17,564 max. Kalevala is 843,528 B gz across 92 files. Every head file stays <=24,576 B gz.
8. **rights/r-<hh>.json.gz** (256 shards) and **rights/rows-<hh>.json.gz** (64 shards).
   - 6,653 distinct rights objects interned by content hash: 730,671 B gz.
   - 2,785 shared sources.tsv rows: 355,030 B gz.
   - notices/<sha>.json: the Hafez MIT notice and two Gutenberg terms, 41,481 B.
   The client rebuilds the exact canonical rights object.
9. **meta/<hh>.json.gz** (64 shards): 2,273 distinct metadata headers, 2.59 MB raw.
10. **methods.json** (copy of lyric-harness/library/methods.json, 278,001 B; registry_hash gated) and reader-result.schema.json. declaration-options.json is bundled into the analysis chunk.
11. **Art renditions** in assets/library/art/<id>-{240,480}.{avif,webp}.
    - Derived by a new `build_library_art.js` using sharp (already a devDependency), byte-checked with --check, at most 25,600 B per file.
    - The originals move from sites/library/public/art to assets/library/art-src. Measured: 1,734,318 B of originals become about 127 KB of WebP at 272px.

### Where a reading's path key comes from
- List rows (`w/`, `c/`), `u/` shards, search results and the tab's own links carry the `rev16-proj12` path key, and the head preload uses it directly.
- A deep link without it, including every translated old-Site link, first fetches the `u/<hh>` shard (<=6 KB gz, one extra request), then the head.

### Retention and eligibility
- **Retention.** When a reading's revision or projection changes, the previous directory is kept for 30 days. An open tab holding an old list keeps working. When it next refreshes a shard, it lands on the new directory by `line_id`, with a notice.
- **Eligibility always wins over retention.**
  - Every build revalidates **all retained generations** against current eligibility.
  - When a unit is no longer readable, every retained file for it is deleted in the same commit, and its `u/` entry is removed.
  - The client then gets 404, finds no shard entry, and falls back to the metadata-only UI through `/library/v1/metadata/:id`, with the old "not readable" notice.
  - Eligibility is judged per unit, so an independently eligible older edition is unaffected when another edition changes.
- **Recovery on 404 for a readable unit.** After 30 days, or for a path key never published, the tab refetches the `u/` shard (`cache: 'reload'`) and opens the current directory with the "This reading was updated" notice, landing by `line_id` where it exists.
- **Held units.** A deep link to a held unit has no r/ directory. The tab fetches `/library/v1/metadata/:id` and shows the metadata sheet with the old "not readable" notice.

### Snapshot labels
- `projected_from` is **truthful**: that snapshot contains exactly this revision, and anyone can rebuild it from the recorded commit. Main's newest snapshot may not even be deployed yet.
- The UI labels both values honestly:
  - the topline and Sources lens show **"Readings: snapshot X"**, the projection;
  - analysis shows **"Analysed on snapshot Y"**, from Render.
  - When X ≠ Y, the Sources lens explains that both snapshots contain this exact revision. It says so only after confirming revision equality through `GET /library/v1/metadata/:id`, which returns the unit's `reading_revision`. `/library/v1/health` carries no per-unit data.
- The provenance download and the Lyrics envelope use `projected_from`. This keeps provenance working through Render outages.
- The nightly `library-data` job regenerates catalog.json only when content changes. So `projected_from` can lag main's label, and that lag is documented.

### Totals and fetch rules
- **Totals:** about 68 MB gz and about 28.9k files before the row-text additions (about +4 MB gz) and before retained generations, which add whatever changed in the last 30 days. The served tree goes from 713.3 MB to roughly 786 MB, under the 1 GB Pages limit. Gated by check_pages_size at <=950 MB and no file >=100 MB.
- Bulk files are .json.gz. The client sniffs `1f 8b` and inflates with DecompressionStream, or with the inflate chunk on old browsers. If Pages ever sends Content-Encoding, the bytes arrive already decoded and parse directly. A PR 0 probe file records the real headers.
- **Contingency:** the data client takes its r/ base URL from one constant. If PR 2's measured Pages deploy fails or exceeds 7 minutes with about 29k extra files, r/ is served from Render's `/library/v1/r/...`, with the same path shape, built from the same projection in the image. Nothing else changes.

### Render (`mcp.codexmusica.com/library/v1`)
Mounted by a new mcp/library_routes.js; the CHAT_BACKEND override is reused.
- The client never sends a snapshot. Every response names the server's snapshot_id and readable_ids_sha256.
- Public, uncredentialed GETs (CORS simple requests):
  - `GET /library/v1/health`: passive, no cookie, no writes. Returns `{contract:1, snapshot_id, readable_ids_sha256, counts, search_ready, analysis_available, corpus:{format:{bytes, sha256, url}}}`. Each corpus `url` is the package-hash URL (see "Exports and downloads").
  - `GET /library/v1/search?q&language&availability&completeness&work&collection&contributor&sort&offset&limit<=100`.
    - Returns `{snapshot_id, items:[compact_summary + source_basis + snippet + search_hit, each with reading_revision and its rev16-proj12 path key], total, next_offset}`.
    - Cache-Control: public, max-age=300, with an ETag. The app logger redacts the query string. That does not keep search terms out of Render's platform logs, and PRIVACY.md says exactly that. Search stays a cacheable GET for performance.
    - limit<=100 rather than the Worker's 250, because no UI asks for more than 50.
  - `GET /library/v1/metadata/:id`: compact_summary + source_basis + `reading_revision` for any availability. Held units get no body, no snippet and no labels.
  - Export and corpus routes: see "Exports and downloads".
- Viewer routes: see "Analysis and identity".

### Search store
New lyric-harness/library/search_store.py runs in the image's assets stage against /build/library-canonical, before release_assets filters held readings out. It imports compact_summary and source_basis from catalog_site_export, so the summaries equal the Worker's metadata column. It writes:
- body.bin: folded search.text for readable units, 19,009,282 B; held bodies are empty, exactly as in D1;
- UTF-8 columns for title_search and contributor_search, with offsets;
- two sort permutations computed in Python on UTF-8 bytes: (title_search, id) and (contributor_search, title_search, id);
- summaries and interned source_basis on disk, read by offset;
- **per-unit projection tables:** folded-body offset to row index; per row, the line-id seed and the code-point, UTF-16 and source ranges, read by offset;
- **per-unit ZIP entry tables:** the size and CRC32 of every entry, for READINGS `.json`, `.txt` and `.csv`, TRANSCRIPTIONS, PROVENANCE, ATTRIBUTIONS and NOTICES.

Query handling is a line-for-line port of the Worker's SQL:
- normalization: NFC, the Python casefold table, whitespace collapse, at most 500 chars, else 400 BAD_QUERY;
- match: Buffer.indexOf over title, contributor or body. Each hit is mapped to its unit by binary search and the scan resumes at the unit's end;
- filters:
  - equality on language, availability, completeness and work;
  - membership for collection;
  - contributor via `instr(lower(contributor_search), fold(x))`, with SQLite's ASCII-only lower() reproduced;
- snippet: substr(body,1,180) in code points of the folded body; body_position is 1-based;
- total is exact, and there is no ranking.

**Hit projection and export sizing are table lookups.** Hit projection is a Node port of search-hit.ts that reads the precomputed tables, run for returned readable hits only. Export plans sum the precomputed entry sizes, and streams copy pre-derived bytes.
- **No canonical reading is ever parsed with `JSON.parse` on a request path.** Kalevala's canonical reading is 33 MB, measured at 425-477 ms blocked and +131 MB heap when parsed, and an exact-length selection plan would otherwise scan up to 2.2 GB of readings, all on the event loop that also serves `/mcp` and `/chat`.
- Any residual parse runs in a `worker_thread` with concurrency 1 and a size cap.
- Memory for the store and tables is measured in qualify_reader against the 1638 MiB bound.

### Held metadata
The 11,354 held units and the 1 research-only unit never appear in static files. They reach the tab only through Render search (availability=held|all, and 'Inspect all recorded availability') and `/metadata/:id`. Each carries the Worker's compact_summary plus source_basis, built at image time from the full snapshot, so the metadata sheet keeps its recorded evidence exactly as the approved Site served it.

### Skew between Pages and Render
Pages publishes at merge (sync-pages on CI success). Render promotes after Production qualification (deploy-connector.yml). Under revision addressing, skew is limited to units whose revision changed in a corpus PR:
- Reading never breaks.
- Analysis create for a newer static revision gets `409 STALE_READING {current_revision}`. The UI says the analysis server updates within a day and offers 'Notify me by retrying later'.
- A search hit whose revision differs from the displayed revision lands by line_id, without span marks, and says so.
- An export plan containing an id not yet on Render gets `409 SELECTION_UNAVAILABLE` naming those ids.
- smoke_library_live reports the per-id skew count after each publish and promotion, and alerts if it is non-zero for more than 48 h.

### Data-plane gates
- `check_library_data` asserts that every file's embedded identity equals its path.
- `check_library_data` asserts that every page's start offsets equal the canonical reading's, and that the derived per-line normalized code-point and UTF-16 ranges equal canonical for every line of every unit.
- **Projection identity:** in `check_library_data`, a fixture with an unchanged revision and changed labels. The old URLs stay byte-identical (retained), a new `proj12` directory appears, and rows point to it.
- **Retention never outlives eligibility:** `check_library_data` asserts that no file in any retained generation belongs to a non-readable id. `check_library_page` stage `rights-correction` demotes a unit in a fixture: the retained URL is gone, and the tab shows metadata only.
- `check_library_page` stage `generations`:
  - (a) an old head with a new page, and (b) a new head with an old page, both served by `_pages_server` on purpose: the client rejects each and recovers;
  - (c) a 404 on a retired revision recovers to the current one;
  - (d) a `data_id` mismatch between catalog.json and `c/` triggers a reload, then the update notice.
- `check_library_page` stage `deep-offset` opens `?offset=500` and `?offset=22500` (Kalevala) and an astral-plane and RTL fixture at offset >= 500. It asserts that only the head and the target page were requested (request log), and that the `?span` marks land on the canonical characters.
- `check_library_page` asserts the language filter offers exactly the old option set, computed from all collections. `check_library_data` asserts that collections.json covers every collection id in the manifest.
- `check_library_data` asserts that Play's target equals `readable_reading_unit_ids[0]` for every readable collection.
- `check_library_data` keeps catalog.json at <=4,096 B gz.

## Analysis and identity

### Contract
A new browser family, `/library/v1`, on the existing service. It is separate from `/internal/reader`, which keeps its HMAC authenticator and stays out of CORS until retirement.

server_http.js:262-271 is split so that:
- ReaderJobStore and ReaderScheduler are built whenever READER_CATALOG_DIR and a durable directory exist;
- `/internal/reader` mounts only while READER_BRIDGE_SECRET and READER_SITE_ID are set;
- the `/library/v1` viewer routes mount when `LIBRARY_PUBLIC=1` (production-config pin; 0 until PR 5).

Without this split, removing the bridge secrets would silently disable public analysis.

### Viewer identity
- The cookie is unsigned and random, so no new secret is needed:
  `__Host-cm_library=<43-char base64url of 32 random bytes>; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=2592000`
- It is minted only by `POST /library/v1/analyses` when no valid cookie is present, so GETs never create state. Mints are rate-limited (decision 4).
- Max-Age slides on every viewer-route response, matching the 30-day retention.
- `viewer = 'lv1:'+sha256hex(value)`, which fits the store's `^[A-Za-z0-9_.:-]{1,200}$` check and is disjoint from the Site's viewers.
- codexmusica.com and www.codexmusica.com are same-site with mcp.codexmusica.com, so the Strict cookie travels with `fetch(…, {credentials:'include'})` and with download navigations. Page script can never read it.
- Why unsigned, over a signed cookie with LIBRARY_VIEWER_KEY:
  - a 256-bit random value cannot be guessed;
  - a non-browser client can fabricate viewers either way. For ordinary browsers the per-viewer limits bind; against a client that fabricates viewers, the per-IP abuse ceilings, the mint limit and the global queue cap are the real bound;
  - a signing key would be one more dashboard secret whose loss or rotation orphans every viewer's analyses.

### Capabilities never leave the server
- ReaderJobStore gains one trusted method, `capabilityFor(id, viewer)`. It returns the existing `HMAC(storeKey,'reader-v1\0id\0viewer')` from `_capability` (reader_job_store.js:359-364).
- The router re-derives the capability on every call, from the path's job id and the cookie's viewer, and passes it to get, cancel, resume, delete, readManifest, readManifestPage and readPage. It is never serialised.
- No binding table, receipt store or other new persistent state is added.
- The browser receives `{contract_version:1, job: publicReaderJob(record)}` (reader_routes.js:143-166). The job id is a reference, useless without the cookie, so job ids may live in device state, as the Site's reference ids did.

### Viewer routes (credentialed; bodies <=2 MiB)
- `POST /library/v1/analyses`
  - Body: `{contract_version:1, reading_unit_id, reading_revision, declaration_set?, requested_layers?, requested_methods?<=256, idempotency_key}`.
  - The server fills snapshot_id with its installed snapshot, then runs the pipeline `/internal/reader` already uses: validateRequest, prepareRequest, resolveIdentity, store.create, scheduler.kick. It is extracted into one shared helper, so both routers run identical code.
  - The server persists the exact accepted request, with the server-filled snapshot_id, in canonical form, as a sidecar object next to the job. It is deleted with the job, and the analysis export emits it verbatim (see "Exports and downloads").
  - At creation the store also records the hashes of the retained definitions in force (see "Retained definitions").
  - 202 for a new job, 200 for an exact retry (which refreshes the job).
  - 409 IDEMPOTENCY_CONFLICT; 409 STALE_READING {current_revision}; 403 READING_UNAVAILABLE for non-readable units; 429 QUEUE_FULL; 429 LONG_READING_BUSY; 503 STORE_RECOUNTING while store usage is unknown.
- `GET /library/v1/jobs/:id`
- `POST /library/v1/jobs/:id/cancel` and `/resume`, with an Idempotency-Key header (generated per click).
- `DELETE /library/v1/jobs/:id`: tombstone.
- `GET /library/v1/jobs/:id/manifests/:sha`
- `GET /library/v1/jobs/:id/manifests/:sha/pages?offset&limit<=250`
- `GET /library/v1/jobs/:id/pages/:sha?manifest=`
- `GET /library/v1/jobs/:id/exports/<manifest>.zip`

### Route behaviour
- Another viewer's job answers 404, and methods are routed strictly. The Worker quirk that answered `GET …/cancel` as a results read (library-api.ts:639-644) is not reproduced.
- **Every credentialed `/library/v1` response, job, manifest, page and analysis export alike, is sent with `Cache-Control: private, no-store`**, as today (`reader_routes.js:339,365`).
- The router re-hashes what it reads (503 STORAGE_CORRUPT on a mismatch). The client verifies sha256 with SubtleCrypto. This replaces the Worker's verifiedPull and R2 cache.
- A job read refreshes retention (existing store behaviour, bounded as below). That makes it a write, unlike the passive `/health`.

### Private evidence in the client
- **No persistent evidence cache.** There is no IndexedDB evidence store. Verified pages live in a per-tab in-memory cache only.
- **Fresh authorization before rendering.** Before any evidence renders, the tab makes a fresh `GET /library/v1/jobs/:id` and gets a 200. It then shows only pages whose hashes appear in the manifest that response names.
- **On every activation.** That fresh 200 is required before reusing in-memory evidence on every activation of a reader or job view:
  - route entry, including Back and Forward within the same document;
  - switching to an evidence lens;
  - returning to a hidden tab after more than 60 s.
  This governs later rendering and access. It cannot erase bytes already shown.
- On 404 (cookie lost or another viewer), 410 (expired or deleted) or a local Delete, that job's in-memory pages are dropped at once, and the device key `interpretation:{id}:{revision}` keeps only the declarations, not the job reference.
- Offline retention of private evidence is **not** proposed. It would be a separate, explicit product decision.

### CORS (mcp/server_http.js:217-244)
- Allow-Headers adds Idempotency-Key.
- `Access-Control-Allow-Credentials: true`, on `/library/v1/analyses*` and `/library/v1/jobs*` only (preflights included), using the existing exact-origin echo; boot already refuses wildcards.
- Expose-Headers: Retry-After, Content-Disposition, X-Library-Bytes, X-Library-SHA256.
- Max-Age: 600.
- CSRF: a foreign Origin is refused by the existing middleware (403); every non-GET must be application/json, which forces a preflight; and the cookie is SameSite=Strict.
- Search, metadata, export plans, selection exports and corpus stay uncredentialed.

### Rate limits and admission
- The old Site had no rate limiter. Its only bounds were 2 outstanding analyses per viewer and 16 waiting globally. Per-IP limits would penalize shared NAT (schools, offices).
- So the **binding analysis limits are per viewer**: 2 outstanding per viewer, as before, and creates at 30/h per viewer. Per-IP limits are **abuse ceilings** sized so a shared IP cannot plausibly reach them.
- **Long-reading rule:** a reading with more than 5,000 analysis lines may have at most **one** queued or running job service-wide. A second gets `429 LONG_READING_BUSY` with Retry-After.
- Mechanism: process-local windows keyed by clientIp with TRUSTED_PROXY_HOPS=1 (ratelimit.js `LIBRARY_LIMITS`). Every refusal is 429 with Retry-After, and the UI says when to retry. Export and corpus streams also have an idle timeout and a minimum transfer rate; the Render load-balancer duration limit is verified in PR 1.
- Every value, with its old behaviour and exact consequence, is in the table under owner decision 4. John chooses each one.
- Tests in `test_library_routes`:
  - 3 viewers behind one IP, each running 2 analyses: all succeed;
  - 7 viewers behind one IP, each running 2: the 7th is refused, as decision 4 states;
  - boundary users exactly at each limit and one over;
  - FIFO retry fairness under a held cap.

### Quotas
- Unchanged, and shared with reader-v1: 16 waiting, 1 running, 600 s leases, yields to lyric work, 30-day sliding retention, zero provider calls enforced in four layers.
- Evidence pages are stored uncompressed today (no gzip in reader_job_store.js). At about 2-3.3 MB per short poem (critic measurement), the 256 MiB quota holds only about 100 analyses per 30 days. "Storage at rest" below addresses this.
- Exports store nothing on disk except what the store already holds.

### Reader store under public load
Source-confirmed, not a measured production failure: every authorized read runs `_touch` → `_save` → `_capacity` → `_usage`, which stats every record and evidence object (`reader_job_store.js:295-328, 385-389, 1005-1006`). Every `_open` also runs `_reload`, `_prune` and `_collect` under the writer lock, and takes an exclusive lock file, runs `readdirSync` over every record, and parses and hashes each one (`reader_job_store.js:220-289,391-395`). A record cache alone does not fix this. All of the following land before `LIBRARY_PUBLIC=1`.

1. **Bounded durable touches.**
   - A read refreshes `accessed_at` and `expires_at` in memory.
   - It persists them durably only when the stored `expires_at` is more than 1 hour stale.
   - Effect: at most one touch-write per job per hour.
   - A crash loses at most 1 hour of sliding retention, which is stated in READER_RUNTIME.md.
2. **Intent and generation cover every mutation.**
   - Record writes, object writes (pages, manifests, refs, retained definitions and request sidecars) and object deletes all take the writer lock.
   - Each one writes `records/.pending {generation: g+1}` before its first byte, then publishes `records/.generation = g+1` (written atomically) and removes `.pending` after it completes.
   - This includes an object written before its record commits, so an orphan object left by a crash is covered by the intent marker.
3. **Incremental quota accounting.**
   - Usage is an in-memory counter. Once usage is known, each committed mutation applies its exact byte delta to the counter under the lock.
   - `_capacity` reads the counter and never scans.
   - A generation change from another writer schedules a recount, which is accepted only under the quiescence rule below.
4. **Verification scans are accepted only if quiescent.**
   - A verification scan runs off the request path every 15 minutes, within the per-tick bounds below. It reads `.generation = g0` with no `.pending` at the start.
   - At the end it takes the writer lock and checks that `.generation` is still `g0` and that no `.pending` exists. Only then does it publish the scan total as the counter, under that lock. A published total that differs from the counter logs `READER_USAGE_DRIFT` with both values.
   - Any mutation during the interval discards the scan, which retries later. There is no live-scan delta journal.
5. **Unknown usage fails closed.**
   - Usage is unknown:
     - at open, until the first accepted scan;
     - after a crash, detected when `.pending` exists or an object or record is newer than `.generation`;
     - after a discarded verification that found drift.
   - While usage is unknown, every **allocating or growing** write is refused with `503 STORE_RECOUNTING` and Retry-After: job creation, checkpoints, and touches that would grow a record. Reads continue.
   - **Cleanup** (deletes, expiry and orphan-object collection) continues under the same lock and intent fencing.
   - A recount is scheduled at once. With growing writes blocked, a scan is quiescent unless cleanup runs, so it converges quickly.
6. **Off-loop maintenance.** `_prune` and `_collect` (expiry and garbage collection) move from `_open` to a timer that runs one bounded batch per minute under the same writer lock. An expired job is still refused at read time by its `expires_at`, so correctness never depends on the sweep having run.
7. **Bounds per maintenance tick** (scan and sweep alike): <= 100 records, <= 500 objects, <= 64 MB of bytes read, <= 50 ms of wall time, yielding between batches.
8. **Read path.**
   - Records are cached in memory, validated by the generation counter, so a read re-validates only records that changed.
   - A read takes no exclusive lock unless it writes (a due touch).
   - Writers keep the existing `wx` lock, fencing, `atomicWrite` and digest checks unchanged.
9. **Client polling backs off** (see "Lifecycle parity").

**Tests** in `mcp/test_reader_store_bounds.mjs`:
- delta accounting equals a full scan after a randomized sequence of creates, checkpoints, deletes and expiries;
- **shrink-before-scan:** a file shrinks from 100 to 50 bytes during a scan. The scan is discarded, and the next accepted scan equals the full-scan truth;
- grow, delete and create interleavings during a scan;
- two store instances writing concurrently;
- a crash after a page object is written but before its record commits. On reopen, usage is unknown, growing writes get 503, the orphan is collected, a recount is accepted, and writes resume;
- **unknown-usage admission:** a create during unknown usage returns `503 STORE_RECOUNTING`, and a delete succeeds;
- the touch interval is honored;
- expired-but-unswept jobs are refused.

**Acceptance budgets** (`qualify_reader` scenario `store-load`): 2,000 evidence-bearing jobs, expiry in progress, and concurrent checkpoint writes from the scheduler, with 20 pollers.
- server-side job GET p99 <= 25 ms;
- event-loop delay p99 <= 50 ms;
- `/mcp` `tools/list` p99 within +20 ms of the no-load run;
- `/chat` latency is recorded in the same run.

A second `qualify_reader` scenario runs a Kalevala search hit and a near-full selection plan concurrently with `lyric_grade`, and asserts thresholds on event-loop delay p99, peak RSS and `/mcp` latency.

### Storage at rest: gzip in two phases
`workerPayload` hands `worker.py` physical page paths, which it opens as UTF-8 JSON (`reader_job_store.js:1101-1116`; `worker.py:74-87`). Sniffing in Node alone would break checkpoint and resume. So:

- **One reader in each runtime.**
  - Node `readPageObject(path)` and Python `read_page_object(path)` both sniff `1f 8b`.
  - Each inflates with a hard output bound equal to `READER_LIMITS.objectBytes`, refusing with `STORAGE_CORRUPT` beyond it, and verifies `sha256(uncompressed) == name`.
  - Plain objects are read as today.
  - `worker.py` `load_records` and every Node object read go through these functions.
- **Identity is unchanged:** sha256 over the uncompressed bytes. The served `Content-Encoding: gzip` bytes are the stored bytes. The client verifies the uncompressed hash.
- **Phase A** ships the dual readers and still writes plain objects. Rolling back past A is always safe.
- **Phase B** is a later deploy, after A has run qualified in production, and only with John's approval (decision 3). It turns on gzip writes with `READER_STORE_GZIP=1`. Measured ratio about 18× (2,045,168 B to 110,206 B), which raises capacity to roughly 1,800 analyses at the same 256 MiB.
- **Rollback compatibility is enforced outside the image.**
  - When phase B enables gzip writes, the store writes `store-format.json {"min_reader": "A"}`.
  - The deploy and qualification workflows read the candidate image's reader-format label and refuse any image below `min_reader`. That check lives outside the old image, which cannot know about gzip.
  - An image without `readPageObject` that finds `.gz`-magic objects fails readiness loudly rather than misreading them.
  - Render's dashboard rollback bypasses workflows, so the runbook forbids a dashboard rollback past phase A once `store-format.json` exists.
  - Rolling back from B to A stays valid, because A reads both.
- **Rollback to before phase A** requires `reader_store_inflate.mjs`, run under the exclusive writer lock.
  1. It checks free space >= the inflated size + 20%.
  2. It writes plain objects beside the gzip ones and verifies each hash.
  3. It removes the gzip objects and `store-format.json`.
  4. It keeps a checksum manifest for recovery.
- **Alternative (decision 3):** keep plain objects and raise `READER_STORAGE_MAX_BYTES` within the 1 GB disk. PR 1 measures the disk's other occupants before quoting a safe figure. With neither, public analysis capacity stays at about 100 analyses per 30 days.

**Tests:**
- mixed plain and gzip objects in one job;
- checkpoint, then restart, then resume through `worker.py`;
- an inflation bomb refused;
- hash mismatch refused;
- rollback B → A reads everything;
- the old-image startup check fails on gzip objects;
- the deploy gate refuses a pre-A image when `store-format.json` exists;
- the inflate conversion on a fixture store, including a simulated out-of-space refusal and an interrupted run that resumes.

### Retained definitions
- Job identity pins the reading revision, engine commit and resource fingerprint (`reader_scheduler.js:285-301`).
- At job creation the store keeps content-addressed copies of the exact `methods.json` and result schema in force, about 0.3 MB once per distinct fingerprint, deduplicated. The job record references their hashes.
- Analysis exports use these copies, never the current image's files (see "Exports and downloads").

### Logs
- The request logger already omits Cookie (server_http.js:139-150). Set-Cookie is never logged either.
- The query string is dropped from the app log for `/library/v1/search`, so search terms are not logged there. Export selections travel in the POST plan body, so no selection appears in any URL or log.
- Job ids are logged; they are references.

### READER_RUNTIME.md amendment (same PR as the routes)
1. Configuration table:
   - READER_BRIDGE_SECRET and READER_SITE_ID become optional; they mount only `/internal/reader`, while the Site exists.
   - New rows: LIBRARY_PUBLIC, READER_STORE_GZIP, and READER_REQUIRED pinned to 1 at cutover.
2. 'Install the same canonical catalog snapshot on the Site and Render' becomes 'Render serves and analyses one installed snapshot; the static Library reading plane is projected from the same catalog and addressed by reading revision.'
3. A new section, 'Public Library browser API (/library/v1)', covering:
   - the caller: the codexmusica.com Library tab;
   - identity: the Render-minted HttpOnly, Secure, SameSite=Strict, host-only `__Host-` viewer cookie;
   - the per-job capability is derived and checked in-process and never appears in responses, URLs, client persistence, analytics or logs;
   - Cookie and Set-Cookie values are never logged;
   - credentialed CORS only for the exact allowlist and only on viewer paths;
   - every credentialed response is `private, no-store`;
   - the rate limits and the long-reading rule (decision 4);
   - jobs share the reader-jobs-v1 store, admission and scheduler;
   - 30-day retention, zero provider calls;
   - bounded touches: a crash loses at most 1 hour of sliding retention;
   - `503 STORE_RECOUNTING` while store usage is unknown;
   - the gzip phases, `store-format.json`, and the ban on dashboard rollback past phase A once it exists.
4. Lines 42-44 keep their rule verbatim: raw backend capabilities never appear in URLs, client persistence, analytics or logs. Only the caller clause gains 'and the in-process /library/v1 router', and one sentence is added: 'The viewer cookie is an HttpOnly session credential, not a capability.'

Justification for the amendment:
- A browser cannot hold a signing secret.
- An HttpOnly cookie cannot be read by page script. codex.html has no CSP, so this is strictly safer than any token kept in IndexedDB.
- Losing the cookie loses only access to the viewer's own analyses, which can be re-run on the current reading.

### Privacy
PRIVACY.md and mcp/PRIVACY.md gain the cookie, its 30-day sliding life, the per-IP processing, and this sentence: "Library device data stays in your browser, except what you submit: search terms, declarations sent with an analysis, and selections sent to plan an export." PRIVACY.md also says that dropping the query string from the app logger does not keep search terms out of Render's platform logs.

### Lifecycle parity
- Same states and badges: Partial evidence / Complete report / Waiting for evidence.
- Polling every 3 s while queued, running or deferred_requeue, backing off to 15 s after 2 minutes, paused while the tab is hidden.
- Cancel while running or queued. Resume from paused, cancelled or failed, with unchanged identity. Delete in any state, leaving a tombstone.
- Evidence comes from manifest, then refs(offset, limit=1), then page bytes, verified; 'Load more evidence · page n' works as before.
- Earlier analyses come from device state `interpretation:{id}:{revision}`, refreshed with a fresh `GET jobs/:id` on every activation.
  - A 404 (cookie lost, or Safari's 7-day cap) reads 'This analysis belonged to an earlier browser session' and offers a re-run.
  - A job created on an older server snapshot stays readable from the store, labelled "Generated by engine `<commit8>` on revision `<rev8>`". Its resume offers 'Run again on the current catalog' when the revision is unchanged.
- 'Load latest evidence checkpoint' appears when job.manifest_hash differs from the displayed hash.
- Partial results never impersonate complete ones (store semantics unchanged).
- The Method select reads static methods.json (reader_requestable per language).

### Private-cache tests
`check_library_page` stage `private-cache`, run with a warmed browser:
- (a) clear the cookie and reopen the reading: no evidence renders, and the "earlier browser session" message shows;
- (b) delete the job, Back, Forward: nothing renders from cache;
- (c) expire the job server-side and reload: 410 handled, nothing renders;
- (d) response headers on every credentialed route are `no-store`;
- (e) within one document, clear the cookie, then Back/Forward to the reading: no evidence renders from memory, and the "earlier browser session" message shows.

## Exports and downloads

### One server ZIP writer
mcp/library_exports.js holds two parts:
- mcp/library_zip.js: zip-stream.ts ported verbatim. STORED ZIP64 with data descriptors, flags 0x808, fixed 1980-01-01 DOS time, deterministic entry order, CRCs from Node 22 zlib.crc32.
- Ports of bodyPart, csvLines (CSV_FIELDS), provenance and credits from library-exports.ts:125-305.

It reads canonical readings and wholly readable originals from the installed snapshot, entry sizes and CRCs from the search store's precomputed tables, and evidence from the reader store. There are no D1 leases, no R2 chunks, no step loop and no stored export records.

### Starting any download
A page never sees the status of a navigation it starts, and the `download` attribute is ignored across origins. So every download is validated first, and no error can replace the page.
1. **Validate before navigating.**
   - Every download first sends a CORS `HEAD` to the same URL: credentialed for analysis exports, uncredentialed for selection and corpus downloads.
   - The page handles these in place:
     - 409 `PLAN_STALE` and 409 `PLAN_EXPIRED`: re-plan transparently from the stored ids;
     - 409 `SELECTION_UNAVAILABLE`: name the ids;
     - 409 `EXPORT_READING_CHANGED` and 409 `EXPORT_DEFINITIONS_UNAVAILABLE`: offer "Run again on the current reading";
     - 404 on an analysis export: the "earlier browser session" message;
     - 404 on a corpus URL: re-plan to the current URL named in the error body;
     - 429: show Retry-After.
   - It navigates only after a 200.
2. **No error can replace the page.** Every error on a download path is served with `Content-Disposition: attachment; filename="library-download-error.txt"`. Even a race between HEAD and GET then produces a small file, never a page swap.

**Gate:** a `check_library_page` stage forces 409, 404 and 429 on each download path. It asserts the tab stays on `#library` with an in-page message, and that a forced GET-time error produces an attachment, not a navigation.

### Selection exports (text | json | csv; public, from a server-held plan)
A selection export is identified by its exact content, not by its membership.
- **Two identities:**
  - `membership_id = sha256(sorted ids)`, used only for "is this selection still valid";
  - `content_id = sha256(canonical {exporter_version, format, snapshot_id embedded in PROVENANCE, rights_registry_sha256, sorted [id, reading_revision] pairs})`.
  - The bytes are a deterministic function of the `content_id` inputs.
- **Plan.** `POST /library/v1/exports/plan {reading_unit_ids, format}`.
  - Ids must match `^reading_[A-Za-z0-9_-]+$`; they are deduplicated and sorted.
  - Any id not readable on the server answers `409 SELECTION_UNAVAILABLE`, naming the ids, as library-exports.ts:364-373 did.
  - Response: `{content_id, bytes, entries, url: /library/v1/exports/p/<content_id>.zip}`.
  - The server keeps the plan in a process-local LRU: 2,000 plans, 1 hour each, about 9 MB at the 4.3 KB maximum. No bitset or id list appears in any URL or log.
  - A selection covering every readable unit maps to the prebuilt corpus package URL, `/library/v1/corpus/<package_sha16>/<format>.zip` (the old 'prebuilt' mode).
- **Download.** `GET /library/v1/exports/p/<content_id>.zip`.
  - The server recomputes `content_id` from the held plan against the installed snapshot. Any difference returns `409 PLAN_STALE`. An evicted plan (restart or TTL) returns `409 PLAN_EXPIRED`.
  - The pre-navigation HEAD catches both, and the client re-plans transparently from its stored ids. The stored `pending-export` holds `{format, ids}`, never a URL.
  - The server streams the ZIP with an exact Content-Length (STORED sizes are known in advance) and `Content-Disposition: attachment`. The browser's own download UI shows progress, and nothing is buffered in page memory.

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
| Export selected readings | plan, HEAD, then download |
| Resume prepared export | re-plans from the stored `{format, ids}`, then HEAD and download |
| Forget export reference | clears device key `pending-export` `{format, ids}` |
| Clear selection | as before |
| Download unsaved selection | library-selection.json, when IndexedDB failed |
| Export readable corpus | the prebuilt package |

The client warns above an estimated 500 MB and steers to the corpus package.

Change from the Worker, stated openly and disclosed in the release notes: there is no per-viewer export record and no 30-day `410 EXPORT_EXPIRED`, and selection-export progress moves from an in-page toast to the browser's download UI. Viewer isolation existed to protect private records. A public, deterministic selection export has no record to protect, and regenerating it from the same content yields identical bytes.

**Tests** (`test_library_exports`):
- (a) revision churn: same ids, one revision changed, so `content_id` changes, the old URL gets `PLAN_STALE`, and the re-plan downloads new bytes;
- (b) snapshot-only churn: sources.tsv edited, no unit changed, so `content_id` changes through the PROVENANCE snapshot, and the same flow follows;
- (c) restart, then `PLAN_EXPIRED`, then re-plan;
- (d) the same plan twice yields identical sha256;
- (e) no `sel=` or id list appears in any request URL (request-log assertion).

### Analysis exports (cookie-bound)
- `GET /library/v1/jobs/:id/exports/<manifest>.zip`, started by navigation after a credentialed HEAD. Same-site navigations carry the Strict cookie.
- The manifest identity is checked first; partial checkpoints are allowed.
- **Reading entries** (READINGS, TRANSCRIPTIONS, PROVENANCE, ATTRIBUTIONS, NOTICES) are emitted only when the current image holds the job's exact `reading_revision`. Revisions are content hashes, so the bytes are the ones analysed.
  - Otherwise the export is refused with `409 EXPORT_READING_CHANGED`, and the UI offers "Run again on the current reading". The evidence stays viewable in the tab, labelled "Generated by engine `<commit8>` on revision `<rev8>`".
  - This is a truthful fail-closed choice, not unchanged export availability: some older analyses that the old Site would have exported cannot be exported after a corpus revision (decision 12).
- **Jobs created before retained definitions existed** have no retained copies. Their export is refused with `409 EXPORT_DEFINITIONS_UNAVAILABLE` unless their fingerprint equals the current one.
- The stream emits the reading's unit entries, then:
  - PROVENANCE.json (scope whole_reading_unit_analysis, analysis_manifest_hash, partial). It names the job's own `engine_commit`, `resource_fingerprint` and `snapshot_id`, never the current image's;
  - ATTRIBUTION.txt;
  - ANALYSIS/MANIFEST.json (exact bytes);
  - ANALYSIS/REQUEST.json: the bytes of the job's request sidecar, verbatim (canonical form, server-filled snapshot_id);
  - ANALYSIS/METHODS.json and ANALYSIS/RESULT_SCHEMA.json, from the job's retained definitions;
  - ANALYSIS/EVIDENCE/<8-digit n>.json, store pages in manifest order, hash-verified.
- 'Export complete analysis' or 'Export partial checkpoint' is offered according to manifest.partial.
- Device key `analysis-export:{job}:{hash}` keeps the url. It holds no secret.
- **REQUEST.json is an intentional, documented difference from the Worker.** The Worker wrote the browser's raw POST bytes, including the client-sent `snapshot_id`, `idempotency_key` and key order (`library-api.ts:518,581-588`; `library-exports.ts:666-683`). The new client does not send `snapshot_id`, so byte equality with the Worker is impossible by construction.

**Tests** (`test_library_exports` scenario `generation`):
1. Create a job.
2. Redeploy a fixture runtime with a changed methods file, then export. The retained definitions are emitted, and PROVENANCE names the old fingerprint.
3. Redeploy with the reading revised, then export: 409 `EXPORT_READING_CHANGED`.
4. A pre-change job with a different fingerprint: 409 `EXPORT_DEFINITIONS_UNAVAILABLE`.

### Whole-corpus exports
- Built by the existing deterministic `python -m library.catalog_downloads` in a dedicated, cacheable Dockerfile stage over the installed snapshot. Measured on 317c in 2 m 18 s:

  | Format | Bytes | Entries |
  |---|---|---|
  | text | 73,439,381 | 51,055 |
  | csv | 140,958,923 | 25,530 |
  | json | 363,604,074 | 27,809 |
  | total | 578,002,378 | |

- Every package carries PROVENANCE.json (canonical_manifest_sha256, body_policy, excluded_availability_counts, whole_original_sources), ATTRIBUTION.txt with the DCS credit, and NOTICES/.
- **URL by package identity:** `GET /library/v1/corpus/<package_sha16>/<format>.zip`. `package_sha16` is the first 16 hex of the package's own sha256, already recorded in the package manifest. A whole-selection export maps to that URL.
- The *.part-* files are deleted. Packages are served by sendFile with Content-Length, Accept-Ranges (so downloads can resume), ETag = sha256, X-Library-SHA256 and public immutable caching.
- An old package URL answers 404 with the current URL in its error body, and HEAD validation then re-plans.
- `/library/v1/health` lists each package's size, sha256 and URL, and the panel shows size and sha256 beside the links.
- verify_downloads runs in the build, and qualify_reader runs --verify-existing.
- They cannot live on Pages: csv and json are each over GitHub's 100 MB file limit, and 578 MB exceeds the headroom.

**Test:** an unchanged snapshot with changed exporter code gives a new package sha, a new URL, and an old URL that answers 404 with the current URL in its error body. HEAD validation then re-plans.

### Client-side downloads (uiDownload Blobs, no server)
- reading-provenance.json from the Sources lens: `{snapshot_id: projected_from, reading_unit_id, reading_revision, rights rebuilt exactly from the shards plus notice texts, source_map with derived rows, source_marks, source_labels, source_basis, work_reviewed_equivalence, metadata}`. Pretty-printed exactly as reader.tsx:999-1027.
- reading-declarations.json.
- library-selection.json.
- codex-musica-library-import.json, only if the in-page Lyrics import throws or the reading is over the transfer cap.

### Provenance, attribution and notices travel
- Every r/ head carries required_attribution and notice refs, and the paper footer shows 'Required credits', linking to the Sources lens.
- Every ZIP carries PROVENANCE.json, ATTRIBUTION.txt and NOTICES/.
- Every Lyrics envelope carries the full rights object with notice texts.
- Artwork credits appear on Sources & rights, in the card ⋮ menu and in the lightbox, from artwork.json; artwork is in no package.
- The Rights page states that Gutenberg admission is a USA public-domain statement.

### Determinism gates
- PR 0 captures goldens by running the Worker's own TypeScript (library-exports.ts, zip-stream.ts) against the pinned 317c fixture: ZIP sha256 for fixed selections in all three formats, one analysis export, and the Worker's own provenance download bytes for a golden sample. The analysis-export golden needs a live reader job: library-site.yml runs the image's reader backend for one short poem (22-26 s of CPU).
- mcp/test_library_exports.mjs requires byte equality with the selection goldens, and an identical sha256 for the same plan made twice.
- **The analysis-export golden is entry-level parity.** Every entry is byte-equal except `REQUEST.json`, which is compared field by field on reading_unit_id, reading_revision, declaration_set, requested_layers, requested_methods and snapshot_id.
- **Provenance download:** byte-equal to the Worker's own provenance download bytes, including its enrichments (source_basis, labels, notices), for the golden sample, and byte-equal to a canonical rebuild with `snapshot_id = projected_from.snapshot_id` for every readable unit, in `check_library_data`.
- Corpus sha256 must equal package-manifest.json in qualify_reader.

## Lyrics handoff

The handoff stays in the same document and carries text only, through the receiver Lyrics already ships. There is no window.open, nonce, origin check or postMessage handshake. The 8 MiB `TRANSFER_BYTES` cap is kept for the in-page handoff: above it, the reader offers an excerpt or the bundle download, as before.

1. Entry points: 'Open in Lyrics' (whole reading) in the paper header, and 'Open excerpt in Lyrics' (the selected analysis lines) in the passage bar.
2. The reader chunk loads every page of the reading from its static r/ directory, verifying each page against the head's hash list, plus the rights and meta shards and the notices. It builds exactly the codex-musica.library-import v1 envelope of library-client.ts:38-89:
   - handoffId and draftId: random UUIDs; createdAt.
   - payload.text: derived normalized_text, or the excerpt. For a whole reading the client first checks `sha256(text) == normalized_sha256`.
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
3. A new shell API, `uiOpenInLyrics(envelope)`, in workbench.js and listed in docs/ui-foundation.md's API table.
   - Lyrics exposes its importer through registration rather than a page-to-page global: src/pages/lyrics.js passes `imports:{library: (env) => lyLibraryReceiver.importEnvelope(env)}` to uiRegisterPage.
   - uiOpenInLyrics awaits `uiEnsureWorkspace()`, then calls `UI_PAGES.lyrics.imports.library(envelope)`. This is the no-binding path the JSON file import already uses (library-import.js:500-507; lyrics.js:5084-5098): validateEnvelope, then a durable atomic draft commit plus receipt in IndexedDB 'codex-musica-library-drafts'.
   - lyLibraryActivate then preserves the previous draft, detaches the writer and navigates to `#lyrics` with its toast (lyrics.js:1913-1977), pushed so that Back returns to the reading.
   - This replaces the old new-tab behaviour (`window.open`) with the same tab. It is a visible behaviour difference, decided under decision 10.
4. If the import throws (for example, IndexedDB is refused), the old fallback applies: download codex-musica-library-import.json with 'In Lyrics, choose Import'.

### Rule 1
- The envelope carries only Library text and the reader's own declarations.
- Nothing reads or writes recipe state, and Lyrics sends nothing back.
- Enforced by `check_library_isolation.js` (no recipe identifiers in src/library/** or src/pages/library.js) and `test_library_import_inpage.js`. That test covers: round trip, digest, the five ids, rights and notices carried through 'Export source details', the previous draft preserved, an excerpt carrying only its lineage, Back returning to the reader, and the transfer cap.

### Legacy receiver
- SITE_ORIGIN, originAllowed, TYPES, HANDSHAKE_MS and createReceiver's opener path stay through cutover (PR 6), so the old Site's 'Open in Lyrics' keeps working until the move page replaces it.
- PR 6c deletes them, and their tests in scripts/test_library_import*.js, immediately after John confirms the move page is live, or 7 days after cutover if it is not deployed. `TRANSFER_BYTES` stays, because the in-page handoff keeps the cap. Old-Site users then still have the bundle-download fallback.
- That returns about 1.5-2 KB gz to the page, and `check_library_isolation` then asserts that no 'chatgpt' string remains in codex.html or library/code.
- Bundles downloaded earlier still import through the file path, which has no origin check.
- Existing Lyrics drafts with snapshotId 5226 are unaffected: Lyrics reads only provenance.workingCopy, and every 5226 id and revision is unchanged in 317c.

## Performance plan

### Baseline (perf.md and the gate)
- **Old Library:** about 1,639 KiB Lighthouse payload.
  - Boot, from code: manifest (202 polls every 500 ms), then (the catalog pages in series ‖ methods) via `Promise.all`, then shelves (`library-app.tsx:469-485`). Methods is 278 KB raw, and a hidden default search adds 63,464 B.
  - PSI's five catalog entries (601,655 + 122,365 + 68,852 + 65,433 + 63,558 B) were the largest-payload subset, omitting `offset=1000`. They are not a measured complete waterfall.
  - Mobile LCP was the loading placeholder; desktop LCP was lazy-loaded hafez.jpg; 8,597 DOM nodes; a 298 ms forced reflow.
- **codexmusica.com today:** codex.html 355,348 B gz. Every route waits on browse_boot.json (290,485 gz), plus engine.json (712,192 gz) when a session has cards (app.js:658-682, 17620-17628). After first paint, every route fetches engine.json and browse_prose.json (2,088,890 gz) (app.js:17667).

### Cold `#library` boot
1. **codex.html growth.** The stub (<= 4 KB), the preload scripts and the boot guards, minus uiLibraryLink. PR 3 measures the marginal cost against a base that already has the derived brand mark, and budgets are re-set from that measurement: stub <= 4 KB, total codex.html growth <= 6 KB gz. That stays inside the existing 33,772 B page headroom, so no budget raise is needed. The handshake code (about 1.5-2 KB) leaves in PR 6c.
2. `<head>` runs:
   - boot_preload.js, first in `<head>`: skips the browse_boot preload on `#library`;
   - theme boot;
   - engine_preload.js, which gains the same route test;
   - library_preload.js: core (<=20,480) and catalog.json (<=4,096), or on read routes the reader chunk (<=20,480) and the r/ head file (or the `u/` shard when the link carries no path key).
3. DOMContentLoaded, with BOOT_ROUTE_LIBRARY true: no CATALOG_READY wait and no ENGINE_AT_BOOT. `_initApp` runs with deferWorkspace=true.
   - That is a guard-clause change, not a restructure. Catalog.warmSearchIndex, the uiAfterPaint engine start, pushHistory, both renderAll calls and uiRestoreSession are queued, in their current relative order, into `_initWorkspace()`.
   - The `CATALOG_READY` expression itself is route-gated, because it starts its fetch when the script is evaluated. The resize listener that calls `renderAll()` is guarded until the workspace is ready. Both are covered by the boot-trace gate.
   - Everything else runs as today: icons, header, surfaces, every page's mount, the Escape and keyboard wiring.
   - Then `uiNavigate('library')`.
   - Every other route calls exactly today's functions in today's order (deferWorkspace=false).
4. render() injects core (a cache hit), reads catalog.json and draws the first viewport (type covers plus text). After a double rAF it marks performance 'library:shelves-ready'.
5. After that milestone (or 'library:reader-ready'), at requestIdleCallback with a 5 s timeout:
   - in-viewport art: AVIF/WebP 240/480 via `<picture>`, the first two eager, the first with fetchpriority=high, <=60 KB total;
   - collections.json (about 78 KB) at low priority;
   - the reader chunk prefetched at low priority;
   - workspace boot with fetch priority 'low': browse_boot.json, then engine.json only if the session has cards, then `_initWorkspace()`;
   - uiCheckAI after that.
   - Workspace fetches pause while a Library chunk or r/ fetch is pending, so an in-app reader click does not contend with them. The click time is pinned in the scenario.
   - Hard rule: no Engine.start and no browse_prose.json while `UI.view==='library'`. The engine starts on the first visit to another route, or on any Engine.ensure.
6. Workspace controls clicked earlier (Save, Undo, Recipe sheet, AI recipe, other tabs) await `uiEnsureWorkspace()` with the panel's loading state, then act. Navigating to Genre or Instrument before the workspace is ready shows that page's skeleton until it is.

### Bytes before each milestone
gzip-6; data measured, chunks at their ceilings, codex.html at its growth budget.

| Milestone | Bytes | Requests |
|---|---|---|
| shelves-ready | <= about 385 KB (361 + 20 + 4) | 3 critical: document, core, catalog.json |
| reader-ready, median reading, link with path key | <= about 403 KB (361 + 20 + 20 + 2) | 4 |
| reader-ready, link without path key | adds the `u/<hh>` shard (<= 6 KB gz) | 5 |
| reader-ready, worst head file | 17.6 KB head; a deep `?offset` adds one page file, fetched after the head | |

- No request goes to api/ or to mcp.codexmusica.com before either milestone, and a saved session changes nothing.
- The header brand mark is counted in the shelves-path budget.
- Under the applied Slow-4G harness (562.5 ms per request, about 184 KB/s, 4× CPU), the expected shelves-ready is about 3.0-3.4 s and reader-ready about 3.1-3.5 s on mobile, against an old shelves-ready estimated at >=8 s (to be measured in PR 0). Desktop: about 0.6-0.9 s. These are estimates; only the measured comparison below decides.

### Existing routes
- They gain at most the measured codex.html growth (<= 6 KB gz of inline HTML, about 33 ms at 1.47 Mbps).
- A derived 56px header mark (build_favicon.js derived-asset pattern) replaces icon-192.png (29,654 B) on every route. That saves about 27 KB per cold load, but off the FCP/LCP path, so the claim is fewer bytes, not faster paint.
- The A/B gate below must show FCP and LCP neutral within threshold.
- Measured risk: boot_preload.js inserts the browse_boot preload from a script, which the preload scanner cannot see. Fallback if the existing-route A/B fails: restore the static `<link>` and accept browse_boot on the `#library` path, with the Library budgets re-derived.

### Lazy boundaries
- analysis chunk plus methods.json (52,749 gz): only for a Sound/Form/Rhythm/Language lens, Analyze, the method reference or an earlier analysis;
- compare chunk: on Compare;
- rights, meta and notices: on the Sources lens, provenance download, handoff or export;
- artwork.json: on Sources & rights, the card ⋮ menu or the lightbox;
- Render preconnect (anonymous): at idle; the credentialed pool only when the analysis chunk loads.
- Explicit decision: Library data does not wait behind api/engine.json, unlike the optional-download precedent (check_lazy_app.js:526-537). On `#library` the engine waits for the Library.

### DOM
- Carousel windowed: visible cards plus 6, wrap-around by modulo.
- Rail virtualized: at most 40 rows rendered out of 2,279 (old: 1,428 children).
- Works: 50 rows.
- Reader: windowed, at most 3 loaded 250-line pages (750 rows) in the DOM. Farther pages are released and re-rendered on scroll, which covers Kalevala's 22,795 lines.
- Scroll work batched in rAF.
- Targets: Explore at most 1,500 elements; no long task over 200 ms after shelves-ready at 4× CPU; CLS at most 0.02. Fixed aspect-ratio frames and width/height on every image.

### Byte budgets
New rows in scripts/check_payload_budget.js, gzip-6; the existing five are not raised.

| Row | Limit (B) |
|---|---|
| library-stub | <=4,096 |
| library-core | <=20,480 |
| library-reader | <=20,480 |
| library-analysis | <=24,576 |
| library-compare | <=6,144 |
| library-shelves-path (codex.html + core + catalog.json) | <=393,216 |
| library-reader-path (codex.html + core + reader + largest r/ head file) | <=425,984 |
| page (existing) | 389,120 |

`check_library_data` enforces catalog.json <=4,096 gz, collections.json <=98,304 gz, every r/ head file <=24,576 gz and every art rendition <=25,600 B. PR 2 re-sets the c/ and w/ budgets from the measured row text.

### Timing gate (`check_library_perf.js` plus `_pages_server.js`)

**Harness and profiles.** Playwright Chromium against a local server emulating Pages (gzip for text types, .gz served raw, max-age=600). Render is the exact lyrics-image container for scenarios that touch it.

| Profile | Viewport | Network (CDP emulateNetworkConditions) | CPU |
|---|---|---|---|
| mobile | 412x823, DPR 1.75 | latency 562.5 ms, down 1,474.56 kbps, up 675 kbps (Lighthouse's applied Slow-4G constants; simulated constants are rejected) | 4× |
| desktop | 1350x940 | 40 ms, 10,240 kbps | 1× |

**Ready means usable, measured the same way on both sides.** An init-script observer timestamps a milestone only when all four conditions hold for its target:
- shelves-ready targets the first shelf heading plus the first card title;
- reader-ready targets the reading title plus the first lyric line, with the `?line` target in view.

1. the target element is in the viewport and painted: IntersectionObserver ratio > 0, computed visibility, a non-zero box;
2. text is rendered in its final or fallback font after `document.fonts` settles, or within 100 ms;
3. no `aria-busy`, skeleton or loading indicator remains in that region;
4. an **immediate-action probe** passes, run during the deferred workspace boot:
   - shelves: activating the first card's Open starts navigation within 100 ms;
   - reader: Next page or a line toggle responds within 100 ms.

The new tab's performance marks are recorded for diagnosis only. `check_library_perf` implements the four conditions identically for old and new, and asserts the probe during deferred boot.

**Synthetic CI comparison, labelled synthetic in every report.**
- The old Site's responses (bodies, headers, content-encoding and the recorded `202` → `200` manifest sequence, with its exact 202 count) are pinned as fixtures.
- They are served through `_pages_server` with **zero server delay**, the same as the new tab's static files, under identical CDP throttling.
- The old client's own 500 ms manifest polling runs unchanged.
- Any unmatched request aborts the run (strict no-live fallback).
- This isolates client and payload differences. It does not claim production timing.

**Server delay is measured, not inferred.**
- PR 0 measures old-Site server time separately as TTFB minus a same-connection baseline RTT, n >= 30 per endpoint from the same runner. It is reported as a modelled-delay table.
- A second synthetic profile replays with those measured delays, and the report shows both.

**Calibration.** PR 0 runs the old Site live from the runner n = 9 times and reports synthetic-vs-live medians as a calibration ratio. No threshold uses an uncalibrated synthetic number.

**Authoritative comparison: real hosts.**
- Both the old Site and the new tab are run live, on the same runner, with the same throttling, interleaved, n >= 9 per side, plus a PageSpeed Insights run (n >= 5).
- Before cutover this uses the production preview (`?library-preview=1`). If John declines the preview, it happens immediately after cutover, with a rollback rule: revert if the pass condition below fails.

**Report integrity.** `check_library_perf` records the fixture provenance (date, runner, URL list). It refuses to emit a ratio when:
- the two sides used different modes;
- a fixture request was unmatched;
- calibration is missing.

The report labels every number synthetic, synthetic plus modelled delay, or live.

**Pass condition for "measurably faster".** Pass requires both:
- (a) the absolute caps in the table below;
- (b) a **live same-scenario improvement**: the new median <= `(1 − m)` × the old median, with the bootstrap 95% CI of the difference excluding zero.

The margin `m` is John's to set (decision 5). Recommended: 0.45, which is <= 0.55×. A 4.4 s new time against a 4.0 s old one therefore fails, whatever the cap.

**Thresholds.** Caps are confirmed against the PR 0 baseline, and they can only be tightened without John.

| Measure | Threshold |
|---|---|
| mobile shelves-ready median | <= 4.5 s, and the live improvement condition |
| mobile reader-ready, median reading | <= 4.8 s, and the live improvement condition |
| mobile reader-ready, Kalevala deep offset | <= 6.0 s |
| saved-session shelves-ready | <= 1.05× no-session |
| desktop shelves-ready / reader-ready | <= 1.2 s / 1.3 s, and the live improvement condition |
| in-app reader-ready (card or row click to reader-ready) | mobile <= 1.5 s, desktop <= 0.5 s |
| static Works-ready | mobile <= 1.5 s, desktop <= 0.5 s |
| search Works-ready against the local image | desktop <= 1.0 s |
| existing routes (#genre, #instrument, #map, #lyrics, each with and without a session) | FCP, LCP and first-view medians <= base + max(3%, 60 ms) mobile and + max(3%, 20 ms) desktop; bytes before first view <= base + the measured codex.html growth (<= 6 KB) |

**Runs.** n=9 fresh contexts per scenario, interleaved A/B against the merge-base on the same runner, for the new tab and the existing routes. Reports median, p90 and MAD, plus FCP and LCP observers, CDP encodedDataLength and request lists before each milestone, long tasks and DOM size.

**Scenarios.**
- PR subset, path-filtered on src/**, library/**, scripts/build_html.js: cold `#library` (mobile, desktop); cold `#library/read/<median English id>` (mobile); in-app Explore to reader; Works (mobile); `#genre` and `#lyrics` with and without a saved session (mobile). About 15 minutes.
- Nightly: the full matrix, adding the Persian RTL reading, Kalevala with a deep `?offset`, a saved session with 3 cards on `#library`, `#instrument`, `#map` and the desktop variants.

**Deterministic order assertions** in `check_lazy_app`:
- a `#library` boot requests nothing under api/ and nothing on mcp.codexmusica.com before shelves-ready;
- no Engine.start or browse_prose while `view==='library'`;
- other routes make no library/ request at all, except after explicit nav hover, and their request order and boot-call trace equal the base.

**Records.** The old-Site fixtures, the modelled-delay table, the calibration runs and the current-route baselines are recorded in PR 0 (tests/perf/library-baseline.json: date, commit, runner, raw runs). After cutover the same harness runs against https://codexmusica.com, plus PageSpeed Insights n=5, archived in docs/library-performance.md.

## Migration and retirement

### Existing private analysis jobs
These are Render reader-jobs-v1 records under old-Site viewers, whose capabilities sit in Sites D1 `library_jobs`.
- **Not migrated.** Moving them would mean moving capabilities, and the viewer cookie belongs to the chatgpt.site origin.
- They stay usable through the old Site until the move page replaces it.
- **Loss is stated plainly.** A re-run may **not** reproduce old evidence if the engine or resources changed, and that loss can be irreversible. Users keep their inputs, because declaration sets travel in the device-state file.
- **Export window.** Before the move page, the old Site announces a window in which users can export their analyses.
- **After a corpus revision**, exports of older analyses on codexmusica.com are refused where the analysed revision is no longer installed, with a re-run offered instead (see "Exports and downloads"). This is a truthful fail-closed choice, not unchanged export availability.
- After the move page nothing can address the old jobs. The store's 30-day sliding retention tombstones them (reader_job_store.js:13, 385-390).
- **Purge, with positive evidence of old-Site ownership.** The retirement PR includes an operator purge to free the quota at once.
  - The purge selector is an **allowlist** of `(job_id, viewer)` pairs exported from the old Site's D1 `library_jobs` bindings. John runs that export, since the repo holds no Sites credentials. It must happen before D1 is deleted.
  - A dry run lists the store records whose id **and** viewer both match. Unmatched or unknown records are left untouched.
  - The purge runs only after John confirms the exact dry-run count at action time. Design agreement is not that confirmation.
  - The tool defaults to dry-run.
  - **Test:** the purge tool on a fixture store with matched, viewer-mismatched and unknown records. Only exact matches are selected, and the default is dry-run.

### Per-origin device state (IndexedDB 'codex-musica-library-v1' on chatgpt.site)
This state cannot be read from codexmusica.com.
- **Move page.** One final Sites deploy (PR 6b, John runs it) replaces the app with a static move page: no D1, R2 or bridge.
  - If local IndexedDB is non-empty, the page offers 'Save this device's Library data', which downloads codex-musica-library-device-state.v1.json: `{protocol:'codex-musica.library-device-state', version:1, entries}`. The file carries every entry in its original shape.
  - Then 'Continue to the Library'. With empty IndexedDB it calls `location.replace()` at once.
- **Native import:** 'Import device data from the earlier Library' on `#library/rights`.
  - It validates the file and accepts the real old shapes:
    - `export-selection:<snap>` as `string[]` of ids only;
    - `position:<snap>:<id>` as `{line_id, offset}` **or a legacy bare string**;
    - `interpretation:<snap>:<id>:<rev>` as `{declarations, job_id?, previous?: [{id, declarations}]}`;
    - `analysis-export:<job>:<hash>`;
    - `pending-export`;
    - `shelf-position:<lang>` as a number.
  - Revisions resolve through the committed **5226 manifest**, using the snapshot in the key.
  - It rewrites keys to the new snapshot-free schema:
    - `export-selection`: a set of `{id, collection_id}`, with collection_id read from `u/` shards;
    - `position:{id}`: `{line_id, offset, revision}`;
    - `interpretation:{id}:{revision}`: the declarations plus **all `previous[].declarations` sets**, carried as declaration history. Imported entries carry no job reference; analyses run on codexmusica.com add theirs;
    - `shelf-position:{lang}`: carried over, because the carousel is kept.
  - Job ids are dropped. `pending-export` and `analysis-export` entries are dropped, because their job references and URLs cannot transfer.
  - Entries whose revision changed are kept with a notice, landing by `line_id` when the line exists.
  - Nothing is silently rejected or flattened. The import report lists every entry with its outcome.
- **New state** lives in IndexedDB 'codex-musica-library-v1' on codexmusica.com, with one store, 'state', separate from Lyrics' 'codex-musica-library-drafts'. There is no evidence store. Keys never contain a snapshot, so corpus updates no longer orphan selections, positions or declarations.
- Without the final deploy, users can still bring declarations through the old Site's own reading-declarations.json download, which the native editor imports. The release notes say so.

### Old chatgpt.site links
The move page translates each path to a hash route on codexmusica.com:

| Old path | New URL |
|---|---|
| / | https://codexmusica.com/codex.html#library |
| /works?… | #library/works?… |
| /rights | #library/rights |
| /collections/:id | #library/collections/:id |
| /read/:id?revision&line&offset&span&precision&lens&compare | #library/read/:id?(same), snapshot dropped |
| /api/library/* | 410 `{error:{code:'LIBRARY_MOVED', remedy}}` |

codexmusica.com never links to chatgpt.site after cutover.

### Sites Worker
- Becomes the move page in PR 6b, after the export window. John runs the Sites hosting workflow; the repo holds no credentials for it.
- Default: keep it 12 months for links in the wild, then John deletes the Sites project.
- GET /manifest, which writes D1/R2 state, is never used as a probe in any runbook. Live checks use the passive `/library/v1/health`.

### D1/R2
- Contents: viewer-to-job bindings and receipts, 30-day exports, R2 copies of Render evidence, staged packs and the 60 download parts. The snapshot-derived parts are reproducible. The evidence copies may not be, if the engine or resources changed, which is the possible irreversible loss under decision 12.
- Before deletion, John exports the `(job_id, viewer)` allowlist for the purge.
- Recommended: record row and object counts for the record, then delete both 30 days after the move page ships (John's acceptance).

### Retained 5226 snapshot
- Stays in the image until the move page stops old-Site analysis calls, because the Site POSTs snapshot 5226.
- The retirement PR (PR 7) removes:
  - the mcp/Dockerfile:14-34 approved-library stage;
  - release_assets.py --retain-reader-catalog usage (247-266) and test_retained_reader_catalog.py;
  - the qualify_reader.mjs:71-94 5226 assertions, replaced by the per-id gate against the committed 5226 manifest;
  - mcp/README.md:246-253.
- The 5226 manifest and goldens stay as permanent fixtures.

### library-site.yml
- PR 0 extends it to dump the Worker goldens, including one live reader job for the analysis-export golden.
- PR 6b retargets it to the move page: typecheck, plus a test that the page maps every route and writes no capability.
- PR 7 deletes it together with sites/library.
- Its census, viewer-isolation and held-refusal coverage moves to mcp/test_library_routes.mjs and `check_library_data`.

### SITE_ORIGIN receiver
- Kept through cutover.
- Deleted in PR 6c once the move page is confirmed live, or 7 days after cutover, together with its tests.
- File-bundle import remains.

### Bridge
- After the move page ships: the `/internal/reader` router, reader_protocol.js, the raw-body capture for `/internal/reader`, and READER_BRIDGE_SECRET and READER_SITE_ID in the Render dashboard are removed in PR 7.
- The store and scheduler keep serving `/library/v1`, because PR 1 already decoupled them.

## No-regression gates

### Immutable manifests
PR 0; append-only; their sha256 values are pinned as constants in the checker, so an edit fails.
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
  - tests/library/eligibility-changes.json: `{id, from, to, reason, approved_by:'John', date}`;
  - tests/library/revisions.json: accepted content revisions.

### Churn-safe rule
- Gates compare the current build against the baselines, never against a manifest that must be re-committed per snapshot_id.
- A new snapshot id from an unrelated sources.tsv edit, with unchanged units, passes with no commit and no data regeneration.
- New baselines are appended only when corpus content changes, in the corpus PR itself.

### Classifier (`check_library_regression.js`; JSON report artifact)
For each baseline id against the current output:

| Class | Meaning | Outcome |
|---|---|---|
| unchanged | readable in both, same revision | pass |
| unchanged-non-readable | non-readable in both, same availability | pass |
| added | new id | pass |
| missing | baseline id absent | FAIL unless id-mapped |
| changed-eligibility, readable to non-readable | demotion | FAIL unless ledgered with John's approval; rights corrections always win, and the gate makes them loud |
| changed-eligibility, non-readable to readable | promotion | allowed only when the catalog's own RightsResolver says readable; the builder never reads ledgers or flags to promote, so a restricted unit stays withheld until eligibility is established, even when flagged for John |
| changed-eligibility, non-readable to non-readable | any transition among held, research-only, rejected and metadata-only | pass; each transition is listed in the report |
| revised | readable, revision differs | FAIL unless in revisions.json |

- The report **reconciles every id**: the class totals sum to the 32,220 baseline ids plus the added ones, and to the 36,880 current ids.
- Expected today for 5226 to 317c: 20,865 readable unchanged, 4,660 added (all readable), 0 missing, 0 demoted, 0 revised. This matches 3PO's offline check. No new 5226→317c rerun is needed, since 3PO's exact-snapshot reconstruction stands for unchanged inputs; the gate enforces it from now on.

### Count gate
All of the following must be equal, at 25,525 for 317c:
- catalog.json census.readable_reading_units;
- the readable count in the projected-from manifest;
- the number of current r/ head files (one per readable id; retained generations excluded);
- distinct ids across u/;
- distinct ids across w/;
- the sum of collections.json readable.

qualify_reader asserts the same total from Render's search store and the corpus PROVENANCE census, and replaces the literal 25525 at qualify_reader.mjs:89 with a read of the committed manifests.

### Per-id gates (`check_library_data`)
- Every 5226-readable and every 317c-readable id has a current r/ directory whose revision equals the baseline's (or is ledgered).
- Every derived normalized_text hashes to normalized_sha256.
- Every derived line id equals the canonical id.
- Every reconstructed rights object and metadata object is byte-equal to the canonical reading's. The provenance download is byte-equal to the canonical rebuild with `snapshot_id = projected_from.snapshot_id` for every unit, and to the Worker's own provenance download bytes for the golden sample.
- Every file's embedded identity equals its path, and every page's start offsets equal canonical.
- Static and Render agree: in the lyrics-image job, Render's readable (id, revision) set equals the committed u/ set.

### Rights and label gates
- Every static file references only readable ids, and no held or research id has any r/, c/, w/ or u/ presence, in the current generation or any retained one.
- No original source is served statically.
- Every r/ head carries required_attribution and notice refs whose shas exist and match.
- **Label census:** the export's derived_metadata.label_registry_sha256 equals sha256(lyric-harness/data/lyric_label_prefixes.json) (348 declarations across 30 files), and the count of readable units with non-empty source_labels equals the figure pinned in tests/library/data-manifest.json. A build at the wrong path yields zero labels and fails.
- **Row-content parity:** the static w/ and c/ rows equal a Python `sqlite3` run of the Worker's exact SQL over the same summaries, in order and in content: title, snippet, contributor_search, edition8, work8, completeness and availability.
- **Summary parity:** the search store's 36,880 summaries equal pack_export's compact_summary + source_basis.
- mcp/test_library_routes.mjs asserts:
  - held units get empty snippets and no search_hit;
  - held metadata has no body and no labels;
  - export and analysis refuse non-readable units (409 and 403);
  - SOURCES/ appears only for wholly readable sources.
- Fault classes prove each gate fires: library-readable-regression (drop one 5226 id), library-held-body-served, library-count-drift, library-labels-missing, library-capability-leak.

### Where they run
1. **verify job**, every PR (cheap, over committed files): `check_library_regression --committed`, `check_library_data --committed`, `check_library_isolation`.
2. **library-data job** (new; always reports, so it can be a required check):
   - Exits early unless catalog inputs, the builders, library/data/** or tests/library/** changed. Also runs nightly.
   - Catalog inputs: lyric-harness/corpus/**, data/{sources.tsv, authority.tsv, library_identity_registry.json*, calibration_work_editions.json, lyric_label_prefixes.json}, library/**, quality/{provenance.py, lyric_reader.py, populate_authority.py}, lyric_harness.py.
   - Rebuilds the snapshot (205 s), the export (339 s) and the projection; compares decompressed content with projected_from excluded; revalidates retained generations against current eligibility; reruns every gate on the fresh output. About 12-13 min and 0.7 GB RAM.
3. **library-parity job** (path-filtered on mcp/library_* and lyric-harness/library/search_store.py; nightly):
   - Sparse-checks out commit 031b7de's catalog inputs, as library-site.yml does with ceab2d61, rebuilding the pinned 317c exactly.
   - Runs the Node routes against the Worker goldens: at least 300 search queries (RTL, CJK, astral, ß, whitespace, 500-char cap, filters, offsets), readingPage samples including a header reading, hit projections, and ZIP sha256s.
4. **lyrics-image job:** qualify_reader asserts per-id readable ⊇ baselines, the static/Render agreement, search totals, corpus --verify-existing, viewer isolation, memory, and the `store-load` and concurrent-heavy-request scenarios.
5. **Post-publish smoke** (`smoke_library_live.js` after sync-pages and after deploy-connector):
   - live catalog.json census;
   - 50 random current r/ directories against the manifest;
   - Render `/library/v1/health` counts;
   - the per-id skew count.

### CI and readiness
Library qualification failures block image promotion in CI, but production `/ready` does not depend on the Library (no LIBRARY_REQUIRED). READER_REQUIRED=1 is pinned at cutover.

## Feature matrix

Each row names an executable test in a build that can reach its data. "Lazy-flagged" is the `CODEX_LIBRARY=1` lazy build served by `_pages_server` with the fixture data tree and a local mcp server; "Render" is the server test suite or qualify_reader; "preview" is the production preview or the live comparison. Rate limits cited here are the proposed values in decision 4.

| # | Feature | Old behaviour | Native route | Data source | Test | Build |
|---|---|---|---|---|---|---|
| 1 | Library navigation tab (native route) | External <a target=_blank> to the chatgpt.site origin labelled 'Library (opens in a new tab)' | button.cm-tab[data-view=library], fifth UI_ROUTES entry, codex.html#library | inline stub in codex.html | check_ui_foundation stage K rewritten (button not anchor, no target=_blank, no external origin, aria-current, --cm-route-library); check_mobile_layout view-library >=44px; check_layout_usability five-entry header at 360/390/1000/1440; Library first-view gate (stub skeleton byte-identical in both builds) | lazy-flagged; embedded for the skeleton |
| 2 | Explore shelves (language-grouped collection cards with artwork) | Manifest (202 polling) then all catalog pages then one shelf per language in first-appearance order | #library (Explore tab) | static library/data/catalog.json (first 12 cards per language), then collections.json at idle | check_library_page section explore (order cym,fas,fin,eng,ltc,non; counts; 9 art matches); check_library_perf shelves-ready (four-condition ready; caps plus live improvement); check_lazy_app library sweep | lazy-flagged; preview for the live comparison |
| 3 | Collection cards: artwork, type covers, counts | art() title+source_path match (special regexes for li-qingzhao and bilhana); pastel type cover; '{readable} readable · {recorded} recorded units' | #library card component | assets/library/art/<id>-{240,480}.{avif,webp}; catalog.json art_id (rendition paths derived from it) | check_library_page section cards (matching table for 8 artworks, token covers in both themes); build_library_art --check; per-rendition <=25,600 B | lazy-flagged |
| 4 | Shelf carousel mechanics and per-language position | Looping virtualized carousel (tripled items, visible+6), Arrow keys, middle copy focusable, IndexedDB shelf-position:{lang} with 500 ms debounce, 'position unsaved' | #library shelves (Library-owned windowed carousel) | IndexedDB codex-musica-library-v1 'state' store on codexmusica.com; collections.json on the critical path when the stored position exceeds the catalog.json cards | check_library_page section carousel (wrap-around, <=visible+6 cards per shelf, keyboard, reload restores position including past card 12 without layout shift, blocked IndexedDB shows 'position unsaved') | lazy-flagged |
| 5 | Card quick actions and ⋮ menu (Play, Add/Remove mixed, Open, Select, Artwork credit) | Hover/focus Play opens first readable unit (readable_reading_unit_ids[0], catalog order) with autoplay=1; Add toggles all readable units (aria-pressed mixed); DropdownMenu | #library cards; Play to #library/read/<first>?autoplay=1; .cm-menu | catalog.json first_readable_id or c/<id> head readable_ids[0], both in catalog order (head prefetched on hover/focus); selection entries {id, collection_id} with collections.json readable counts; artwork credit from artwork.json | check_library_page section card-actions (mixed state equals brute-force membership; autoplay consumed); check_library_data Play target equals readable_reading_unit_ids[0] for every readable collection; check_ui_foundation menu focus and Escape | lazy-flagged |
| 6 | Collection rail | Every readable collection unvirtualized (1,428+ nodes), language filter, numbered spines, 'Export selection n', 'On this device', open at >=1100px | left rail on #library/* (overlay below 1100px), opens #library/collections/<id> | collections.json, all 2,327 collections with readable counts; rail shows readable > 0 (preloaded low at >=1100px) | check_library_page section rail (2,279 reachable, <=40 DOM rows, active highlight, badge count); check_library_data collections.json covers every manifest collection id; check_mobile_layout rail toggle; Reset layout restores | lazy-flagged |
| 7 | Section switcher and search shortcut | Explore/Works/Sources & rights buttons; Cmd/Ctrl+K focuses search | #library, #library/works, #library/rights (.cm-tab) | in-page | check_library_page section tabs (active tab follows route; Ctrl/Cmd+K only while #library current) | lazy-flagged |
| 8 | Topline, catalog label, error and retry states | '{n} readable collections · {n} reading units', 'Snapshot {8 hex}', .reader-alert with 'Retry opening the catalog' | #library header area | catalog.json census and projected_from, labelled 'Readings: snapshot X' | check_library_page section topline (values equal manifest; label reads 'Readings: snapshot X'; failed static fetch shows uiEmptyState danger + Retry; persistent data_id mismatch shows 'The Library was just updated'); check_lazy_app E2 (no unhandled rejection, no ABSENT wording) | lazy-flagged |
| 9 | Works search | D1 instr() over folded title/contributor/body, NFC+casefold+whitespace, <=500 chars, ORDER BY title_search,id, 200 ms debounce, typing in reader switches to Works | #library/works?q=… | Render GET /library/v1/search (public, cached 300 s, query not in the app log); 600/min per IP ceiling | library-parity job: >=300 queries equal Worker goldens on pinned 317c (ids, order, totals, snippets, body_position); mcp/test_library_routes search-differential vs Python sqlite3 running the Worker SQL, and 429 with Retry-After at the ceiling; check_library_page section search (Retry-After shown) | Render; lazy-flagged |
| 10 | Search-hit projection and reader landing | projectSearchHit gives line_id, line_ids, row_offset, normalized_cp_range, source_ranges, precision, snippet; click passes ?line,?offset,?span,?precision | #library/works to #library/read/<id>?line=&offset=&span=&precision= | Render search_hit (Node port of search-hit.ts over search_store.py's precomputed projection tables; no JSON.parse of a reading on the request path) | library-parity hit goldens incl. header reading; qualify_reader Kalevala hit concurrent with lyric_grade (event-loop p99, peak RSS, /mcp latency); check_library_page section marks (exact vs span; revision-mismatch lands by line_id without marks and says so) | Render; lazy-flagged |
| 11 | Filters sheet | Language, Availability (readable default/all/held/metadata_only/research_only/rejected), Completeness, Contributor, Sort; live apply; Clear resets all | #library/works?language=&availability=&completeness=&contributor=&sort= (.cm-panel sheet) | default view static w/title/*; language options from catalog.json's full recorded-language list; any non-default filter goes to Render search | test_library_routes filter parity (collection membership, ASCII lower() contributor); check_library_page section filters (language options equal the old set computed from all collections, incl. san and msa; URL params, Clear, Escape closes) | Render; lazy-flagged |
| 12 | Works pagination | 50 rows, Previous/Next, 'a–b of total', offset in URL | #library/works?offset=n and #library/collections/<id>?offset=n | static 100-row w/ files and 250-row c/ pages sliced client-side; Render next_offset for searches | check_library_page section pagination (Next pushes, Back restores offset and scroll); check_library_data row-content parity vs Worker SQL | lazy-flagged |
| 13 | Works table, selection toggle, Select collection | Columns work/contributor/language/scope with snippet and contributor text; toggle disabled unless readable; readable row opens reader, other row opens metadata sheet; 'Select collection' | #library/works, #library/collections/<id> | w/ and c/ rows with snippet and contributor_search (static) or Render items; c/ head readable_ids; IndexedDB export-selection | check_library_page section works-table (snippet and contributor text shown as before; row routing by availability, held toggle disabled, Select collection adds every readable id); check_library_data row-content parity | lazy-flagged |
| 14 | Metadata sheet for held units | Right sheet: availability badge + Value tree of source_path, availability_reason, source_basis, work_reviewed_equivalence | #library/works?availability=held\|all (.cm-panel); deep link to a held or demoted unit | Render search items / GET /library/v1/metadata/:id (compact_summary + source_basis + reading_revision, built from the full snapshot at image time); never static | check_library_data summary parity (store == pack_export summaries for 36,880 units); test_library_routes held-metadata-only (no body, snippet, search_hit or labels); check_library_page section held-sheet (deep link to a held unit shows the 'not readable' notice) | Render; lazy-flagged |
| 15 | Sources & rights: catalog census | 9 manifest counts, metadata-only note, 'Inspect all recorded availability' | #library/rights | catalog.json census; button runs Render search availability=all | check_library_page section census (36,880 units, 25,525 readable, 11,354 held, 1 research-only); count gate | lazy-flagged |
| 16 | Sources & rights: artwork credits | Credits, sources and notes for 8 artworks | #library/rights (+ card ⋮ and lightbox) | library/data/artwork.json, fetched only on these surfaces, never on the shelves path | check_library_page section credits (8 credits identical to artwork.json; no artwork.json request before shelves-ready); build_library_art --check | lazy-flagged |
| 17 | Sources & rights: method reference | Collapsible list with client filter over name/definition/capabilities; MethodDetail | #library/rights (.cm-accordion) | static library/data/methods.json (registry_hash gated) + analysis chunk | check_library_page section method-reference (223 methods; filter equals old predicate); check_library_data methods hash | lazy-flagged |
| 18 | Sources & rights: export panel | Count, format, credit note, Export selected, Export readable corpus, Resume, Forget, Clear, Download unsaved selection | #library/rights; tab badge shows selection count | IndexedDB pending-export {format, ids}; Render POST /library/v1/exports/plan, GET /library/v1/exports/p/<content_id>.zip, /library/v1/corpus/<package_sha16>/<format>.zip; export plans 120/h per IP | check_library_page section export-panel (all six controls; HEAD-validated transparent re-plan on 409 PLAN_STALE and PLAN_EXPIRED; SELECTION_UNAVAILABLE names the ids; forced 409/404/429 keep the tab on #library; IndexedDB-blocked context offers library-selection.json) | lazy-flagged |
| 19 | Reader: normalized view | Paper with lyric/blank/structure lines, analysis numbers, indent, dir/lang; 250-row pages, Load next/preceding | #library/read/<id> | static r/<hh>/<id>/<rev16>-<proj12>/ head + content-hashed page files (hashes listed in the head; embedded identity checked); normalized text and ranges derived from each page's start offsets | check_library_page section reader (RTL Persian, Kalevala paging and DOM windowing <=750 rows); check_library_page stages generations and deep-offset; check_library_data derived text hash, embedded identity and page offsets for all units; check_library_perf reader-ready | lazy-flagged; preview for the live comparison |
| 20 | Reader: source-transcription view | Checkbox shows all line kinds with physical numbers and source_text | #library/read/<id>?view=source (remembered via UILayout) | r/ lines source_text (when different) + source_cp_range | check_library_page section source-view (physical numbering, marks switch to source ranges) | lazy-flagged |
| 21 | Reader: text size | A−/A+ 16–32 px, default 20 | #library/read/<id> toolbar | UILayout.remember('library-text-size') | check_library_page section text-size (bounds, default, survives reload) | lazy-flagged |
| 22 | Line selection and passage actions | Line-number toggles; sticky bar Inspect, Compare passage, Annotate, Open excerpt in Lyrics, Clear; per-line ↗ to Sources lens | #library/read/<id> | static lines + derived line ids | check_library_page section passage-actions (each action; Escape clears selection last) | lazy-flagged |
| 23 | Reading position | IntersectionObserver saves {line_id, offset} to position:{snapshot}:{id} (800 ms); restores | #library/read/<id> (deep-link ?line wins) | IndexedDB position:{id} {line_id, offset, revision} | check_library_page section position (reload restores; revision change restores by line_id or shows notice; blocked IndexedDB shows unsaved) | lazy-flagged |
| 24 | Text marks | TextMarks exact/mapped marks from evidence or ?span anchor; evidence-highlight and passage-selected classes | #library/read/<id>?span=a:b&precision= | static ranges (from page start offsets) + Render evidence/search_hit | check_library_page section marks (goldens from text-marks.tsx on astral and RTL fixtures; token contrast both themes); deep-offset stage (?span lands on canonical characters) | lazy-flagged |
| 25 | Inspector presentation (desktop column, mobile sheet) | 344 px sticky column; below 900 px bottom sheet 85svh; collapse; Inspect button | #library/read/<id> | UILayout pane library-inspector | check_mobile_layout inspector sheet reachable >=44px; check_library_page section inspector (splitter, Reset layout) | lazy-flagged |
| 26 | Lens: Summary | Physical rows, scope, coverage, Export analysis, Earlier analyses; ?lens replace | #library/read/<id>?lens=summary | r/ census + IndexedDB interpretations + Render job (fresh authorized read on every activation) | check_library_page section lens-summary | lazy-flagged |
| 27 | Lens: Sound | Evidence minus form/language/syllable/token; Method select; selected-line filter; Load more | ?lens=sound | Render /library/v1/jobs/:id pages (private, no-store; client-verified; per-tab in-memory cache only); methods.json | check_library_page section lens-sound (predicate equals old lens filter on fixture evidence); private-cache stage | lazy-flagged |
| 28 | Lens: Form | Structure/Returns/Voices/Narrative from form_result | ?lens=form | Render evidence (fresh authorization) + hydrateEvidence/component port | check_library_page section lens-form (tree goldens from evidence-records.ts) | lazy-flagged |
| 29 | Lens: Rhythm | Syllable records or rhythm form_result | ?lens=rhythm | Render evidence (fresh authorization) | check_library_page section lens-rhythm | lazy-flagged |
| 30 | Lens: Language | language_result tree | ?lens=language | Render evidence (fresh authorization) | check_library_page section lens-language | lazy-flagged |
| 31 | Lens: Sources | Work/edition/contributors/metadata, rights + source_basis, required credits, engine identity, source labels, snapshot/revision/SHA256 | ?lens=sources | r/ head (source_labels, source_basis) + rights/meta shards + notices; 'Readings: snapshot X' from projected_from, 'Analysed on snapshot Y' from Render; revision equality via GET /library/v1/metadata/:id | check_library_page section lens-sources (Hafez MIT notice, Gutenberg terms, DCS credit, labels present on a labelled song; X ≠ Y explanation only after the metadata revision check); label census gate | lazy-flagged |
| 32 | Analysis jobs: create | POST /api/library/analyses relayed by the Worker over the HMAC bridge; per-viewer idempotency | 'Analyze entire work' / per-method buttons | Render POST /library/v1/analyses (cookie viewer, server-filled snapshot, request sidecar, retained definitions) | test_library_routes create (202/200, IDEMPOTENCY_CONFLICT, STALE_READING with current_revision, 403 held, QUEUE_FULL, 2 outstanding per viewer, 12-per-IP ceiling, 30/h per viewer and 120/h per IP creates, LONG_READING_BUSY, 503 STORE_RECOUNTING, 3 viewers behind one IP succeed, 7th viewer behind one IP refused, cookie minted only here and 30/h per IP, no capability in body or log); check_library_page section analyze | Render; lazy-flagged |
| 33 | Analysis jobs: poll | GET jobs/{id} every 3 s while queued/running/deferred_requeue | inspector status | Render GET /library/v1/jobs/:id; 600/min per IP ceiling | test_library_routes viewer-isolation (other cookie 404); check_library_page section poll (3 s backing off to 15 s after 2 min, stops on terminal states, pauses when hidden) | Render; lazy-flagged |
| 34 | Analysis jobs: cancel | POST jobs/{id}/cancel with idempotency-key | Cancel button | Render POST /library/v1/jobs/:id/cancel; 120/h per viewer | test_library_routes cancel (idempotent repeat); check_library_page section cancel | Render; lazy-flagged |
| 35 | Analysis jobs: resume | POST jobs/{id}/resume from paused/cancelled/failed | Resume button | Render POST /library/v1/jobs/:id/resume; 120/h per viewer | test_library_routes resume-identity (changed identity refused; older-snapshot job offers re-run) | Render |
| 36 | Analysis jobs: delete | DELETE jobs/{id}, tombstone, related exports removed | Delete analysis | Render DELETE /library/v1/jobs/:id (request sidecar deleted with the job); 120/h per viewer | test_library_routes delete-tombstone (repeat returns deleted; 410 after); private-cache stage (in-memory pages dropped; device key keeps only declarations) | Render; lazy-flagged |
| 37 | Evidence pages | manifest + results pages via verifiedPull with R2 cache; hydrateEvidence; EvidenceCard; Locate N lines | lenses 'Load more evidence · page n' | Render manifests/:sha, manifests/:sha/pages, pages/:sha (private, no-store; gzip-at-rest bytes served with Content-Encoding: gzip after phase B); client sha256 against the manifest named by a fresh job read; per-tab in-memory cache only | test_library_routes manifest-pages (STORAGE_CORRUPT on tampered store page); mcp/test_reader_store_bounds.mjs; check_library_page section evidence (tampered response rejected client-side) and private-cache stage | Render; lazy-flagged |
| 38 | Earlier analyses | job ids in interpretation:{snapshot}:{id}:{revision} | Summary lens list | IndexedDB interpretation:{id}:{revision} + Render GET jobs/:id (fresh 200 on every activation) | check_library_page section earlier-analyses (404 reads 'earlier browser session' with re-run offer; Back/Forward after cookie loss renders nothing from memory) | lazy-flagged |
| 39 | Latest evidence checkpoint | 'Load latest evidence checkpoint' when a newer manifest exists | inspector status | Render job.manifest_hash vs displayed hash | check_library_page section latest-checkpoint (fixture advances manifest_hash) | lazy-flagged |
| 40 | Declarations editor | 482-line client editor; Apply saves to device and prompts re-run; Advanced JSON; Download | Annotate / 'Reading interpretations' in inspector | analysis chunk (+ declaration-options.json bundled); IndexedDB; import of old reading-declarations.json | check_library_page section declarations (scripted output equals old editor goldens; Apply sets declaration_set in POST; invalid JSON refused; Site file imports) | lazy-flagged |
| 41 | Pronunciation choices | token reading_choices to declarations.pronunciations rows, 20 at a time | inspector after evidence | Render token evidence + IndexedDB | check_library_page section pronunciation (rows {line, token, word, phones, basis, source} equal goldens) | lazy-flagged |
| 42 | Comparison picker | metadata/{id} + search work= for other readings; free search limit 20, 250 ms debounce; ?compare | #library/read/<id>?compare=<id> (.cm-panel sheet) | static r/ head work_readings (current id excluded, title-ordered, with title and source_path); free search via Render /library/v1/search limit 20 | check_library_page section compare-picker (candidates equal Worker work search; Escape closes and removes ?compare) | lazy-flagged |
| 43 | Aligned comparison and diff | alignLines + intraLine, source toggle, passage restriction, Earlier/Other/Differences, 250-row paging, reviewed badge | #library/read/<id>?compare=<other> | static r/ directories (all pages) of both readings | check_library_page section compare-diff (golden alignment from compare-text.ts on fixture pairs; mobile single-column modes) | lazy-flagged |
| 44 | Read aloud | Web Speech voice select (Match language), speed 0.5–2, Play/Stop; card autoplay | reader Read aloud panel; ?autoplay=1 transient | static analysis lines (all pages); device speechSynthesis | check_library_page section read-aloud (speechSynthesis stub: one utterance per line, rate/voice applied, autoplay consumed) | lazy-flagged |
| 45 | Download: provenance | reading-provenance.json from whole reading | Sources lens 'Source details' | r/ + rights/meta shards + notices (exact rebuild; snapshot_id = projected_from) | check_library_data provenance byte-equality: canonical rebuild for every readable unit, Worker's own provenance download bytes for the golden sample; check_library_page section download-provenance | lazy-flagged |
| 46 | Download: declarations | reading-declarations.json | declarations editor Download | IndexedDB / editor state | check_library_page section download-declarations (bytes equal goldens) | lazy-flagged |
| 47 | Download: unsaved selection | library-selection.json when IndexedDB failed | #library/rights export panel | in-memory selection | check_library_page section download-selection (IndexedDB denied) | lazy-flagged |
| 48 | Selection export ZIP (PROVENANCE/ATTRIBUTION/NOTICES) | POST exports + step loop + R2 chunks; resume via IndexedDB; viewer-isolated 30-day record | #library/rights 'Export selected readings'; reader Export selection toggle | Render POST /library/v1/exports/plan (server-held plan) then HEAD and GET /library/v1/exports/p/<content_id>.zip (stateless stream); whole selection maps to /library/v1/corpus/<package_sha16>/<format>.zip; 2 concurrent streams per IP, 4 globally | test_library_exports byte-equal to Worker goldens (text/json/csv), same plan twice same sha256, SOURCES only for wholly readable, 409 for held, plan scenarios (a) revision churn, (b) snapshot-only churn, (c) PLAN_EXPIRED after restart, (d) identical sha256, (e) no sel= or id list in any URL; check_library_page section export (forced errors produce an attachment, never a navigation) | Render; lazy-flagged |
| 49 | Analysis export ZIP | POST analyses/{job}/export + step loop; codex-musica-analysis.zip with ANALYSIS/* | Summary lens 'Export complete analysis' / 'Export partial checkpoint' | Render GET /library/v1/jobs/:id/exports/<manifest>.zip (cookie-bound, credentialed HEAD first, no-store); REQUEST.json from the job's sidecar; METHODS.json and RESULT_SCHEMA.json from retained definitions | test_library_exports analysis golden as entry-level parity (REQUEST.json field by field); partial flag; other viewer 404; scenario generation (retained definitions emitted, 409 EXPORT_READING_CHANGED, 409 EXPORT_DEFINITIONS_UNAVAILABLE) | Render |
| 50 | Whole-corpus export: text | Prebuilt 63.6 MB (5226) in 8 R2 parts via an 'all' export | #library/rights 'Export readable corpus' (Text) | Render GET /library/v1/corpus/<package_sha16>/text.zip (73,439,381 B on 317c, Range, X-Library-SHA256); 6 Range-less starts per IP per day, 2 concurrent globally | qualify_reader --verify-existing; test_library_routes corpus-range and corpus-start limit; changed-exporter test (new package sha, new URL, old URL 404 naming the current one); smoke_library_live HEAD size/sha | Render |
| 51 | Whole-corpus export: json | Prebuilt 305 MB (5226) in 37 parts | same panel (JSON) | Render /library/v1/corpus/<package_sha16>/json.zip (363,604,074 B on 317c) | qualify_reader sha256; no SOURCES entry for a withheld whole source | Render |
| 52 | Whole-corpus export: csv | Prebuilt 117.5 MB (5226) in 15 parts | same panel (CSV) | Render /library/v1/corpus/<package_sha16>/csv.zip (140,958,923 B on 317c) | qualify_reader sha256; header equals CSV_FIELDS | Render |
| 53 | Open in Lyrics (whole reading) | window.open + postMessage handshake to codex.html?cm_library_origin&nonce#lyrics; 8 MiB cap; bundle fallback | reader 'Open in Lyrics' to uiOpenInLyrics to push #lyrics (same tab, decision 10) | static r/ (every page, hash-verified) + shards + notices; Lyrics imports.library to lyLibraryReceiver.importEnvelope; 8 MiB TRANSFER_BYTES cap kept | test_library_import_inpage.js (five ids, digest, rights carried, previous draft preserved, Back returns, over-cap reading offers excerpt or bundle); check_library_isolation (rule 1) | lazy-flagged |
| 54 | Open excerpt in Lyrics | Excerpt scope, lineage filtered, declarations [] | passage bar to #lyrics | in-page envelope | test_library_import_inpage.js excerpt (text and lineage equal selected lines) | lazy-flagged |
| 55 | Deep links | Path routes /, /works, /rights, /collections/:id, /read/:id with query state | codex.html#library[/works\|/rights\|/collections/<id>\|/read/<id>][?…] | shell uiRouteOf + page.route; u/<hh> shard when a reader link carries no path key | check_library_page section deep-links (each form cold-boots; snapshot=5226 link opens with no error; a link without a path key fetches the u/ shard, then the head; a held-only collection opens a Render search under its static title); check_ui_foundation K (sub-route survives boot; #genre…#lyrics and ?trad unchanged); move-page translation unit test | lazy-flagged |
| 56 | Back/Forward | pushState/popstate; '← Works' previousLocation + scroll restore | uiSubroute push/replace; hashchange to page.route(sub,{pop}) | history.state libScroll/libPrev | check_library_page section history (Explore to collection to reading to lens to Back/Forward; Lyrics handoff then Back); inventory history-back-between-sections names five sections | lazy-flagged |
| 57 | Device-persisted state (+ import from old Site) | IndexedDB codex-musica-library-v1 on chatgpt.site with snapshot-scoped keys; 'unsaved' notices | all #library routes; 'Import device data from the earlier Library' on #library/rights | IndexedDB codex-musica-library-v1 'state' store on codexmusica.com with snapshot-free keys (export-selection, position:{id}, interpretation:{id}:{revision}, shelf-position:{lang}, pending-export {format, ids}, analysis-export); no evidence store | check_library_page section device-state (each key persists; failure shows unsaved; import fixtures for every real old shape, revisions resolved through the 5226 manifest, all previous declaration sets carried, report lists every entry); check_library_isolation (no cookie or capability in storage) | lazy-flagged |
| 58 | Your recipe on the Library route (one-workspace) | Not applicable (separate site) | #library with recipe:'sidebar' (collapsed default); 'Loading your recipe…' during deferred workspace | shell session (formats unchanged) | check_ui_foundation one-workspace on #library; fault library-loses-recipe; check_lazy_app (saved-session #library boot shows pending panel then cards, no EngineNotReadyError, navigation to every route before workspace ready works) | lazy-flagged |
| 59 | Design system and dark mode | Hard-coded light Google palette, no dark mode, own header | #surface-library scoped CSS on --cm-* tokens | src/theme.css tokens | check_ui_foundation D neutral dark surface; check_library_page renders every state light and dark | lazy-flagged |
| 60 | Reader Method filter and reference | Method select filters evidence by method_id (reader.tsx:96,681,1044); the reader has its own Method reference list (1111), separate from the Rights page definition filter | #library/read/<id> inspector | static methods.json + Render evidence | check_library_page section reader-method-filter (predicate equals the old filter on fixture evidence; reference list equals the old reader list) | lazy-flagged |

## Gates and files

### Added: shell and page code
- src/pages/library.js and src/pages/library.css: the inline stub.
- src/library/*.js: chunk sources (core, carousel, rail, works, rights, data, state, route, uuid5/sha1, reader, marks, inspector, evidence, analysis, declarations, pronunciation, compare, compare-text, speech, exports, handoff, inflate, icons).
- src/library_preload.js and src/boot_preload.js.
- library/code/*.<sha10>.js and the library/code generation manifest (30 days of generations): generated by build_html.js and committed like codex.html.

### Added: data and art
- library/data/**, including artwork.json and the retained generations: generated by `build_library_data.py` via the new lyric-harness/library/catalog_static_export.py.
- assets/library/art/*.{avif,webp}: built by the new `build_library_art.js` (--check).
- assets/library/art-src/* and assets/library/artwork.json: moved from sites/library.

### Added: gates and tooling
- `check_library_data.js`: count, per-id, rights, label census, row-content and summary parity, provenance byte-equality, embedded identity, page offsets, projection identity, retained-generation eligibility, Play target, collection coverage, size budgets.
- `check_library_regression.js`.
- `check_library_page.js`: Playwright over the flagged lazy build, with `_pages_server` and a local mcp server on a fixture snapshot built at test time from tests/library/fixture-sources.json (about 25 corpus files: sonnets, whitman, fas_hafez, a held ganjoor file, a DCS file, ltc, the generated research-only file, a labelled song file, one oversized header reading). Stages include generations, deep-offset, rights-correction, private-cache and the forced download errors. It fails if a feature-matrix test id does not exist.
- `check_library_perf.js` and `_pages_server.js`.
- `check_library_isolation.js`: rule 1; no x-reader-* or secret names; no cookie or capability in storage; after PR 6c, no 'chatgpt' in codex.html or library/code.
- `check_library_publish.js`: check_atlas_publish-style servability.
- `check_pages_size.js`: tree <=950 MB, no file >=100 MB.
- `smoke_library_live.js`.
- `test_library_import_inpage.js`.
- `reader_store_inflate.mjs`: converts a gzip store back to plain objects under the writer lock (rollback to before phase A).
- An operator purge tool for old-Site jobs, driven by the D1 `(job_id, viewer)` allowlist, dry-run by default.

### Added: test data
- tests/library/units-5226b4fb.tsv.gz and tests/library/units-317c5afa.tsv.gz.
- tests/library/id-map.json, eligibility-changes.json, revisions.json and data-manifest.json.
- tests/library/goldens/317c/** (Worker goldens, including the provenance download sample and the analysis export).
- tests/perf/library-baseline.json and the pinned old-Site response fixtures.

### Added: Render and catalog
- lyric-harness/library/search_store.py (with projection and ZIP entry tables) and lyric-harness/library/test_search_store.py.
- mcp/library_routes.js (including the export-plan LRU), library_search.js, library_search_hit.js (port of search-hit.ts), library_exports.js, library_zip.js (port of zip-stream.ts) and library_viewer.js.
- mcp/test_library_routes.mjs, mcp/test_library_exports.mjs and mcp/test_reader_store_bounds.mjs.

### Added: docs
- docs/library.md: contract, hash grammar, data layout, refresh and retirement runbooks, including the ban on dashboard rollback past phase A once `store-format.json` exists, and the purge procedure.
- docs/library-performance.md.

### Changed: shell sources
- src/workbench.js:
  - UI_ROUTES fifth entry (flag-gated until cutover); uiLibraryLink removed;
  - uiRouteOf at 156-163, 1011-1014 and 1047-1063; route and currentRoute hooks; imports registration;
  - new APIs uiSubroute, uiOpenInLyrics, uiEnsureWorkspace, uiLoadChunk;
  - deferred-workspace guards in uiStart (uiRestoreSession and renderAll queued);
  - CMLibraryImport dropped from /* global */ in PR 6c.
- src/app.js: BOOT_ROUTE_LIBRARY; `_initApp(deferWorkspace)` guard clauses and `_initWorkspace()`; ENGINE_AT_BOOT and CATALOG_READY not awaited on #library, with the CATALOG_READY expression route-gated; the resize handler guarded until the workspace is ready; low-priority workspace fetches that pause during Library fetches; Engine.start and prose suppressed while view==='library'.
- src/engine_preload.js: route test.
- src/index.template.html: `<!--@LIBRARY_PRELOAD-->` marker; BOOT_PRELOAD emitted as a script; the preview flag read in the head boot script.
- src/pages/lyrics.js: imports.library hook; the 'Library source' card icon becomes 'library'.
- src/library-import.js: handshake removed in PR 6c; importEnvelope, validateEnvelope, canonical, envelopeDigest and the TRANSFER_BYTES cap kept.
- src/theme.css: --cm-route-library.
- src/workbench.css: nav icon colour, narrow rules retargeted (1300-1315 plus the listed selectors), 60% phone-sheet rule.

### Changed: build
- scripts/build_html.js:
  - PAGES += 'library';
  - chunk emission with the sha384 table;
  - LIBRARY_PRELOAD and BOOT_PRELOAD;
  - LIBRARY_DATA_BASE and LIBRARY_API_BASE constants;
  - CODEX_LIBRARY=1 flag and the preview flag;
  - embedded build inlines chunks as passive blocks;
  - --check verifies chunk existence, integrity and ceilings, and allows boot_preload/library_preload in a fixed order.
- scripts/build_favicon.js: derived 56px header mark, used by uiStart's brand `<img>`. References updated in check_ui_foundation.js:207, ui_reachability_check.js:434 and build_atlas_standalone.js:130-132.

### Changed: existing gates
- scripts/check_payload_budget.js: the seven new rows.
- scripts/check_lazy_app.js:
  - the shim serves library/ with arrayBuffer() and body for .gz;
  - a jsdom ResourceLoader for library/code;
  - the library route sweep;
  - `#library` excluded from lazy/embedded first-view equality, replaced by the Library first-view gate;
  - route-aware stored-state equivalence;
  - boot-call trace equality for non-library routes (wrapping the global boot functions);
  - request-order assertions in both directions, exempting explicit nav hover;
  - the deferred-workspace states.
- scripts/check_workbench.js: a Library-aware mcp mock in place of the blanket {ok:true, enabled:true}; its Library section runs on the flagged lazy build.
- scripts/check_ui_foundation.js: stage K rewritten for a native route; stage E loop gains library; stage D runs on #surface-library; one-workspace on library; header comment.
- scripts/check_mobile_layout.js: view-library, Library search, filter, tabs, inspector, on the flagged lazy build.
- scripts/check_layout_usability.js: five-entry header.
- scripts/ui_reachability_check.js PRECONDITIONS ('library view', 'library reader', 'library analysis'), run on the flagged lazy build, and tests/ui_capability_inventory.md (navigation-library, one entry per feature row, five-section history, Counts).
- scripts/faults.js: library-loses-recipe, library-held-body-served, library-chatgpt-link, library-boot-waits-catalog, library-capability-persisted, library-readable-regression, library-count-drift, library-labels-missing, library-capability-leak, library-chunk-stale.
- scripts/test_library_import*.js: rewritten in PR 6c.

### Changed: repo configuration
- scripts/_build_closure.js: src/library/** as closure, library/code/** as output, library/data/** and tests/library/** in a library-data class inert to the Node builders.
- scripts/check_artifact_fresh.js: library/code current plus every generation within 30 days, no stale extras.
- .prettierignore: library/data, library/code, tests/library.
- eslint.config.js: src/library as browser scripts, plus the no-restricted-globals isolation rule.
- package.json scripts: build:library-data, check:library-data, check:library, test:library-routes, check:library-perf, assets:library-art; wired into test:serial and test:app.

### Changed: CI and publishing
- .github/workflows/ci.yml:
  - verify runs the --committed gates;
  - new library-data, library-parity and library-perf jobs;
  - lyrics-image adds the qualify additions and a GHA buildx cache scoped to the library Dockerfile stage. The library stages are ordered before the per-run ARGs, so editing the Dockerfile keeps the capacity-receipt cache.
- .github/workflows/sync-pages.yml and scripts/publish_guard.sh (+ check_publish_guard replay): publish library/code with codex.html and keep 30 days of chunk generations.
- The deploy and qualification workflows (deploy-connector.yml among them): read the candidate image's reader-format label and refuse any image below `store-format.json`'s `min_reader`.
- docs/branch-protection.md: library-data added as a required check.
- docs/ui-foundation.md and docs/production-workbench.md: five routes, hash grammar, new APIs, first-visit chunk rule, deferred workspace.
- Corpus PRs are serialized, then regenerated after rebase with `npm run build:library-data`, which is deterministic, because two concurrent corpus PRs both rewrite binary data files that cannot be merged by hand.

### Changed: Render
- mcp/server_http.js: store and scheduler decoupled from the bridge secret; mount /library/v1; CORS changes; query redaction for /library/v1/search; /health and /ready library block.
- mcp/reader_job_store.js: capabilityFor; bounded touches; intent and generation markers on every mutation; incremental usage counter with quiescent verification and fail-closed unknown usage (`503 STORE_RECOUNTING`); timer-driven prune and collect; record cache; `readPageObject`; gzip writes behind `READER_STORE_GZIP=1` and `store-format.json`; retained definitions; request sidecars.
- mcp/worker.py: `read_page_object` used by `load_records`.
- mcp/reader_routes.js: export the shared job-creation helper.
- mcp/ratelimit.js: LIBRARY_LIMITS (per viewer and per IP, as decided under decision 4) and the long-reading rule.
- mcp/Dockerfile: search store in the assets stage; a dedicated library-downloads stage; ENV LIBRARY_DIR; the reader-format image label; the 5226 stage dropped in PR 7.
- mcp/qualify_reader.mjs: library routes, per-id and static agreement, corpus, memory peak, the `store-load` scenario and the concurrent heavy-request scenario; manifest read in place of literal counts.
- mcp/production-config.json: LIBRARY_PUBLIC; READER_REQUIRED=1 at cutover.
- Docs: mcp/READER_RUNTIME.md, mcp/README.md, mcp/PRIVACY.md, PRIVACY.md.
- scripts/check_deploy_memory.js: band re-measured if the peak moves.

### Retired in PR 7
sites/library/**, .github/workflows/library-site.yml, the Dockerfile approved-library stage, release_assets retention usage, test_retained_reader_catalog.py, mcp/README.md:246-253, /internal/reader with reader_protocol.js, and the READER_BRIDGE_SECRET and READER_SITE_ID dashboard secrets.

## Risks

- **Shell boot change touches every route.** `_initApp` gains guard clauses only, and non-library boots call the same functions in the same order. check_lazy_app enforces this with a boot-call trace equality check (global functions wrapped in jsdom) and request-order equality. The A/B timing gate against the merge-base covers timing, and fault library-boot-waits-catalog covers the boot gate. Residual risk remains on rarely exercised session-restore paths.
- **Script-inserted browse_boot preload.** Inserting it from a script hides it from the preload scanner, so existing routes could start that fetch slightly later. The existing-route A/B gate decides. The fallback restores the static link and accepts browse_boot on the #library path.
- **GitHub Pages scale.** About 28.9k more files (from 35k to 64k, plus retained generations) and about 72 MB more (the tree grows from 713 to roughly 786 MB) could slow or time out pages-build-deployment. PR 2 lands the data alone and measures the deploy. check_pages_size caps the tree at 950 MB. Contingency: serve r/ from Render with one constant change. Optionally move docs/everynoise-integrations (280 MB) out of the served tree, which can be pre-approved if check_pages_size trips or the Pages deploy slows.
- **How Pages serves .json.gz** (Content-Type and Content-Encoding) cannot be checked offline. Mitigations: a PR 0 probe file with a live header check, and a client magic-byte sniff with an inflate fallback.
- **Pages/Render skew.** Pages publishes at merge, but Render promotes only after Production qualification. Units whose revision changed in a corpus PR therefore get STALE_READING on analysis, revision-mismatched search marks, or export 409s until promotion, typically up to a day. Revision addressing confines this to changed units, and smoke_library_live alerts if skew lasts more than 48 h.
- **Render capacity on one standard instance.** The search store and its tables add about 40-120 MB to the 1638 MiB bound, measured by qualify_reader. Public analysis can fill the 16-job queue. Corpus downloads (578 MB per full set) cost egress, and the image grows by about 0.7 GB with about 3-5 more minutes of build unless the library stage cache hits. Rate limits and the export-plan LRU are process-local and reset on deploy; an evicted plan re-plans transparently.
- **Persistent-disk deploys on Render are not zero-downtime**, so search, held metadata, exports and analysis are briefly unavailable at each promotion. Reading, Explore, default Works lists, compare, provenance and the Lyrics handoff stay up because they are static.
- **Reader storage quota.** Without phase B, capacity stays at about 100 analyses per 30 days at 256 MiB uncompressed. Phase B is a store migration. A dashboard rollback past phase A after `store-format.json` exists would bypass the workflow gate, so the runbook forbids it, and the old image fails readiness loudly rather than misreading gzip objects.
- **Store recount windows.** While usage is unknown (at open, after a crash, after drift), allocating writes get `503 STORE_RECOUNTING`. With writes blocked, a quiescent scan converges quickly, but analysis creation pauses for that window. A crash also loses at most 1 hour of sliding retention.
- **Safari ITP** may cap the viewer cookie at 7 days, because mcp.codexmusica.com is a CNAME to Render. A Safari user idle for a week then loses access to their own earlier analyses. The UI and PRIVACY.md say so and offer a re-run.
- **Self-minted viewers.** The per-viewer caps bind ordinary browsers, but a client that fabricates viewers is bounded only by the per-IP ceilings, the mint limit and the global queue, and a multi-IP client could still fill the queue. Analysis yields to lyric work, so lyrics are not starved, but Library users may see QUEUE_FULL. The long-reading rule stops one reading such as Kalevala from occupying the single CPU repeatedly.
- **Irreversible loss of old analyses.** Old private jobs are not migrated, and a re-run may not reproduce old evidence if the engine or resources changed. The export window and decision 12 make this explicit.
- **Port fidelity.** Node re-implements SQLite instr, ASCII lower() and BINARY ordering, plus hit projection and exact ZIP bytes. Goldens captured from the Worker's own code on a pinned 317c rebuild, and a SQLite differential, guard this, but corners missing from the query set can still drift.
- **Chunk ceilings may not hold:** the reader chunk is likely 15-17 KB, not 11 KB. Budgets are set with headroom, and PR 4 re-derives them from the real port before they are treated as fixed.
- **Chunk version skew.** Keeping 30 days of chunk generations covers tabs opened days earlier. Past that, the recovery reloads to the same hash only after device-state writes are verified; if they are not, the tab stays put and offers the device-state download.
- **No CSP on codex.html.** An XSS on codexmusica.com could act as the viewer through credentialed fetches, though it cannot read the HttpOnly cookie. A CSP is recommended as follow-up work.
- **Rights surface moving to the main domain.** Held-unit titles that embed short body fragments (the ganjoor radif) appear through search, and Gutenberg texts admitted on a USA-only basis are served publicly. Both are unchanged from the approved Site but need John's explicit confirmation (decisions 8 and 9). The static projection stays strictly within verified eligibility, existing exposure never justifies widening it, and John's approval never substitutes for rights evidence.
- **Pre-existing exposure outside the Library's scope.** Pages serves main verbatim, and held corpus files are tracked (for example lyric-harness/corpus/san_dcs_verse.txt and corpus/song/ltc_huajianji.txt). So held bodies are already fetchable at their repo paths, whatever the Library does. This is decision 15.
- **Device-state migration depends on one Sites deploy that John runs.** Without it, old links break when the project is deleted, and selections and positions on the old origin are lost; only manual declaration files carry over.
- **CI cost.** library-data takes about 12-13 min on catalog-input PRs, including lexicon PRs that touch sources.tsv; it passes without regeneration when content is unchanged. library-perf adds about 15 min on src PRs plus a nightly full matrix, and library-parity adds about 10 min when its paths change. Runner variance is handled by interleaved A/B runs and medians.
- **Parity quirks kept on purpose:** the art() substring rule (a Dickinson cover on 'Charles Monroe Dickinson') and Welsh-first shelf order. John may want them fixed after parity ships.

## Phasing

Principle: the published codex.html changes nothing user-visible until PR 6. Every Library feature is built behind the build flag `CODEX_LIBRARY=1`, and CI builds and gates that flagged variant in a temporary directory. No partial tab ever ships. Render goes first because Pages publishes at merge.

**PR 0: evidence (no behaviour change)**
- tests/library/units-5226b4fb.tsv.gz and units-317c5afa.tsv.gz (every unit, pinned sha256), the empty ledgers, `check_library_regression.js` with the full classifier and id reconciliation, and fault library-readable-regression.
- library-site.yml extended to capture Worker goldens on a pinned 317c rebuild from commit 031b7de's sparse catalog inputs: at least 300 search queries, readingPage and whole-reading samples (including a header reading), hit projections, ZIP sha256s for fixed text/json/csv selections, the Worker's own provenance download bytes for a golden sample, and one analysis export from a live reader job (one short poem, 22-26 s of CPU). Committed to tests/library/goldens/317c/.
- `check_library_perf.js` and `_pages_server.js` with the four-condition ready definition. The old Site's responses pinned as fixtures; old-Site server delay measured (n >= 30 per endpoint) into the modelled-delay table; the live calibration run (n = 9); the current-route baselines; all recorded in tests/perf/library-baseline.json.
- A Pages probe file with a live .json.gz header check.
- check_pages_size.

**PR 1: Render, dark (`LIBRARY_PUBLIC=0`)**
- server_http.js reader decoupling.
- mcp/library_routes.js, search, hit projection over precomputed tables, the export-plan LRU, exports, zip and viewer.
- ReaderJobStore: capabilityFor; bounded touches; intent and generation markers on every mutation; the usage counter with quiescent verification and fail-closed unknown usage; timer-driven maintenance; the record cache; retained definitions; request sidecars.
- Phase A of storage at rest: `readPageObject` and `read_page_object`, still writing plain objects; the old-image readiness check; the workflow gate on `store-format.json`; `reader_store_inflate.mjs`.
- CORS, rate limits as John decides them, the long-reading rule, and query redaction.
- search_store.py in the assets stage; the cacheable library-downloads stage with package-hash corpus URLs.
- qualify_reader additions, including `store-load` and the concurrent heavy-request scenario; mcp/test_reader_store_bounds.mjs.
- test_library_routes and test_library_exports against the goldens; the library-parity job.
- The check_workbench Library mock.
- READER_RUNTIME.md, PRIVACY.md and mcp/PRIVACY.md amendments.
- Measure the persistent disk's other occupants, so a quota raise can be quoted if John prefers it to phase B.
- Deploy, then verify `/library/v1/health` on production.

**Phase B deploy (a later Render deploy, only with John's approval, decision 3)**
After phase A has run qualified in production, a later deploy sets `READER_STORE_GZIP=1`, and the store writes `store-format.json {"min_reader": "A"}`.

**PR 2: static data, live on Pages but unreferenced**
- `build_library_data.py` and catalog_static_export.py (snapshot at lyric-harness/library/snapshot, labels asserted).
- library/data/** for 317c in the `<rev16>-<proj12>` layout, with row text, all collections, artwork.json and the full language list; art renditions.
- `check_library_data` (count, per-id, rights, label census, row-content and summary parity, identity, offsets, projection and retention gates, budgets) and `check_library_publish`.
- The library-data CI job made required; prettier, eslint and closure classification.
- Measure the pages-build-deployment duration. If it fails or exceeds 7 min, switch r/ to the Render contingency before PR 4.
- Re-measure catalog.json, collections.json, c/ and w/ sizes, and fix their budgets.

**PR 3: shell infrastructure, neutral for the four routes**
- uiRouteOf, route and currentRoute, uiSubroute, uiOpenInLyrics and the Lyrics imports hook.
- The deferred-workspace boot (guard clauses, `_initWorkspace`).
- Chunk emission, loader and SRI, LIBRARY_PRELOAD and boot_preload, the engine_preload route test.
- check_lazy_app boot-trace and request-order gates; check_artifact_fresh and the sync-pages/publish_guard 30-day generation handling.
- The derived brand mark, then the measured codex.html growth (stub <= 4 KB, total <= 6 KB gz).
- The A/B gate must show existing routes no slower.

**PR 4: Library UI A (flagged)**
- core: Explore with carousel and positions, cards, rail, tabs, Works (search, filters, pagination, table, held sheet), collection views, Rights (census, credits), export panel UI, selection, device state and its import.
- reader: normalized and source views, text size, selection and passage actions, position, marks, inspector, Summary and Sources lenses, read aloud, provenance download, Open in Lyrics (whole and excerpt).
- compare: picker and diff.
- check_library_page stages for all of these. Chunk ceilings re-derived from the real ports.

**PR 5: Library UI B (flagged), then Render live**
- analysis chunk: create, poll, cancel, resume, delete, evidence pages, earlier analyses, latest checkpoint, the four evidence lenses, method reference, declarations editor and download, pronunciation choices.
- Selection, analysis and corpus export wiring.
- The last commit sets `LIBRARY_PUBLIC=1`, which needs every PR 1 store change to be live first. The full feature matrix then runs from the flagged build against production Render.

**PR 5b: preview (only if John approves, decision 6)**
The stub and chunks ship in production codex.html. The route is reachable only via `?library-preview=1`, enabled only after every feature-matrix test is green and for at most 7 days. It serves 3PO and owner acceptance and the authoritative live comparison (both hosts, n >= 9 per side, plus PageSpeed Insights n >= 5).

**PR 6: cutover (single PR)**
- Flip the flag: the fifth UI_ROUTES entry and the PAGES entry go live; uiLibraryLink is deleted.
- Rewrite stage K; update mobile, layout, reachability, inventory and faults; update the docs.
- Enforce the perf thresholds and budgets; pin READER_REQUIRED=1.
- Merge only when every feature-matrix test is green, the id and label gates are green on the production image, production `/library/v1/health` reports analysis_available, and the live comparison passed on the preview. Without a preview, the live comparison runs immediately after cutover, and the cutover is reverted if it fails.
- Before the move page, the old Site announces the window in which users can export their analyses.

**PR 6b: publish day (John runs the Sites deploy)**
After the export window, the move page goes live (device-data export, redirects, 410 for the API), and library-site.yml is retargeted to it.

**PR 6c: after the move page is confirmed live, or 7 days after cutover**
Delete the SITE_ORIGIN handshake and rewrite test_library_import*.js. check_library_isolation then asserts that no 'chatgpt' string remains.

**PR 7: retirement (at least 30 days after PR 6b, with John's go-ahead)**
- Delete sites/library and library-site.yml.
- Drop 5226 retention (Dockerfile, release_assets, qualify_reader, test_retained_reader_catalog, mcp/README).
- Drop /internal/reader, reader_protocol.js, READER_BRIDGE_SECRET and READER_SITE_ID.
- John exports the `(job_id, viewer)` allowlist from D1. The purge dry-run lists exact matches, and the purge runs only after John confirms that exact count at action time.
- John then deletes D1/R2, after recording row and object counts.
- The manifests and goldens stay as permanent fixtures.

## Owner decisions

These 15 decisions replace every earlier list. Each gives R2's recommendation. John decides each one.

1. **Data plane split.** Static reading on Pages: reading, shelves, default lists, compare, provenance and the Lyrics handoff. Search, held metadata, exports, corpus and analysis on Render. Nothing else is hosted anywhere. *Recommended: approve.* It keeps reading up through Render deploys and costs no Render egress for reads.
2. **READER_RUNTIME.md amendment.** The public `/library/v1` family, an unsigned HttpOnly `__Host-` viewer cookie, capabilities derived in-process, and the no-capability rule kept verbatim. *Recommended: approve.* No new secret is required.
3. **Reader store capacity.** Phase-B gzip at rest for the shared reader store (about 18× capacity, roughly 1,800 analyses at 256 MiB), or a quota raise within the 1 GB disk sized from PR 1's disk measurement. With neither, public analysis capacity is about 100 analyses per 30 days. *Recommended: gzip, two-phase.*
4. **Rate limits and the long-reading rule.** *John chooses each value.* The old Site had no rate limiter; its only bounds were 2 outstanding analyses per viewer and 16 waiting globally. The binding analysis limits are per viewer. Per-IP limits are abuse ceilings, and for each one the alternative is no ceiling, depending on the abuse model John accepts.

   | Traffic | Old Site | Proposed | Exact consequence | Alternative |
   |---|---|---|---|---|
   | search | none | 600/min per IP (abuse ceiling), with Retry-After shown in the UI | the 601st search within a minute from one network address waits for Retry-After | no ceiling |
   | analysis outstanding | 2 per viewer, 16 waiting globally | 2 per viewer (unchanged); 12 per IP ceiling; 16 waiting globally (unchanged) | a 7th viewer behind one network address, while 6 viewers there each run 2, is refused | no per-IP ceiling |
   | analysis creates | none | 30/h per viewer; 120/h per IP ceiling | a viewer's 31st create in an hour, or the 121st from one network address, waits for Retry-After | no ceiling |
   | long readings (> 5,000 analysis lines) | none | at most **one** queued or running job per such reading, service-wide | a second job on that reading gets `429 LONG_READING_BUSY` with Retry-After | no rule |
   | job reads | none (Worker relay) | 600/min per IP, plus client poll backoff (3 s, rising to 15 s after 2 min) | the 601st job read within a minute from one network address waits for Retry-After | no ceiling |
   | cancel / resume / delete | none | 120/h per viewer | a viewer's 121st action in an hour waits for Retry-After | no limit |
   | cookie mints | n/a | 30/h per IP | the 31st new browser behind one network address in an hour cannot start its first analysis until Retry-After | no limit |
   | export plans | none | 120/h per IP | the 121st plan in an hour from one network address waits for Retry-After | no ceiling |
   | export streams | none (step loop) | 2 concurrent per IP, 4 globally, with an idle timeout and a minimum transfer rate | a 3rd simultaneous download from one network address, or a 5th service-wide, waits for Retry-After | no ceiling |
   | corpus downloads | none | 6/day per IP (Range-less or bytes=0- starts only; resumes are free), 2 concurrent globally, with an idle timeout and a minimum transfer rate | a classroom of 7 behind one network address cannot each start one; a 3rd concurrent download service-wide waits | no ceiling |

   Tests cover boundary users (exactly at each limit, one over), FIFO retry fairness under a held cap, 3 viewers behind one IP each running 2 (all succeed), and 7 viewers behind one IP (the 7th refused).
5. **"Measurably faster" margin `m`.** Pass needs the caps and a live improvement: new median <= `(1 − m)` × old median, with the bootstrap 95% CI of the difference excluding zero. *Recommended: 0.45.*
6. **Production preview before cutover**, for the live comparison and acceptance, at `codex.html?library-preview=1#library`, enabled only after every feature-matrix test is green and for at most 7 days. *Recommended: yes.* If declined, the live comparison runs immediately after cutover with a rollback rule.
7. **Whole-corpus packages on Render with Range** (578,002,378 B for 317c), baked into the image and streamed from mcp.codexmusica.com at package-hash URLs. *Recommended: approve and accept egress.* GitHub Release assets would put a github.com URL in the download, which is a different host.
8. **Held and research-only metadata on codexmusica.com**, as the old Site shows it, including radif-bearing titles; bodies and labels refused. *Recommended: keep.*
9. **Public serving of USA-only Gutenberg admissions**, with the USA statement shown on Sources & rights. *Recommended: confirm.*
10. **"Open in Lyrics" in the same tab** (push `#lyrics`; Back returns to the reading), replacing the old new-tab behaviour. A visible difference, not presented as parity. *Recommended: approve.*
11. **Final Sites deploy as a move page:** export window, device-data download, redirects, 410 for the API, kept 12 months, then the Sites project is deleted. *Recommended: yes.* Without it, old links break and device state cannot move.
12. **Old private jobs and D1/R2.** Old private jobs and D1/R2 are not migrated. **Possible irreversible loss** is stated, and an export window comes before the move page. After a corpus revision, exports of older analyses are refused where the analysed revision is no longer installed, with a re-run offered instead. The purge uses the D1 allowlist and needs John's action-time confirmation of the exact count. *Recommended: accept the plan; confirm at action time.*

    **Trade-off, stated for John:** refusing to export a historical analysis whose reading revision is no longer installed is a truthful fail-closed choice. It is **not** unchanged export availability: some older analyses that the old Site would have exported cannot be exported after a corpus revision, and the user is offered a re-run instead. A re-run may not reproduce the old evidence if the engine or resources changed.
13. **Retire 5226, `/internal/reader` and the bridge secrets after the move page** (PR 7, after the move page stops old-Site analysis calls). *Recommended: yes.*
14. **Navigation entry, recipe panel mode, deferred workspace, derived brand mark.** Label 'Library', the lucide library-big icon, fifth position, colour `--cm-route-library` = `--cm-green`; recipe panel 'sidebar', collapsed by default and sharing Lyrics' preference, with a 'Loading your recipe…' state (the alternative 'dock' takes vertical reading space); browse_boot and engine.json deferred at low priority on `#library`, with no engine or genre prose while the Library is open; a derived 56px header mark from the approved master through build_favicon.js, saving about 27 KB per cold load on every route. *Recommended: approve.*
15. **Pre-existing exposure of held corpus files on Pages.** Held corpus files under lyric-harness/corpus are publicly fetchable from codexmusica.com because Pages serves main verbatim. This is a **separate decision**, taken alongside cutover; it does not block the Library. One option is serving an allowlisted tree.

## Why this architecture

The performance-first design scored highest (21.5 against 19 and 16.5) and was named the best architecture by two of three judges. It is the only design that takes the shell's 650 KB to 1.36 MB off the Library's critical path (app.js:658-682, 17620-17628), and its reads survive Render deploys, which a persistent disk prevents from being zero-downtime (render.yaml:34-37). Its fatal flaw, two snapshot authorities on different deploy clocks, is removed by addressing static files and analysis by reading revision and projection identity, having the server fill in snapshot_id, using snapshot-free device keys, identifying exports by content, and gating against baselines rather than per-snapshot manifests. The synthesis grafted in the parity design's Worker goldens, store decoupling, all-unit manifests and symmetric milestones, and the operations design's unsigned cookie, stateless streamed exports, preview flag and the rule of no engine start while the Library is the view.

## Review history

The base was a synthesis of three independent designs (performance-first, parity-and-risk-first, operations-first), scored by three judges and built on the performance-first design. Two red-team reviewers then checked it against the code at `031b7de` and a locally built copy of snapshot 317c (Revision 1). 3PO's [verdict on `774435ca1`](https://github.com/WeningerII/CodexMusica/pull/519#issuecomment-6101557150) gave Revision 2, and the [verdict on `44577289c`](https://github.com/WeningerII/CodexMusica/pull/519#issuecomment-6101621407) gave Revision 3. C3 was corrected again after 3PO's third verdict.

### Revision 1: red-team blockers

| ID | Change |
|---|---|
| B1 | w/ and c/ rows gained the Worker's `snippet` and `contributor_search`; order parity became a row-content differential. |
| B2 | catalog.json carries the full recorded-language list (adds san, msa); collections.json lists all 2,327 collections; held-only collections deep-link to a Render search. |
| B3 | The c/ head keeps `readable_ids` in catalog order, so Play opens the same reading as the old Site. |
| B4 | Every download is validated by a CORS HEAD first, and every download-path error is an attachment, never a page. |
| B5 | Analysis-export REQUEST.json comes from a canonical server-side request sidecar; the golden became entry-level parity. |
| B6 | Two honest labels ("Readings: snapshot X", "Analysed on snapshot Y"); provenance and the Lyrics envelope use `projected_from`. |
| B7 | Binding analysis limits moved to per viewer; per-IP limits became abuse ceilings; every limit went to John as a decision. |
| B8 | Artwork text moved out of catalog.json into artwork.json, keeping catalog.json under 4,096 B gz. |
| B9 | The Library uses its own data and API constants; its gate sections run on the flagged lazy build; `#library` left the lazy/embedded first-view equality. |
| B10 | Search-hit projection and export sizing became table lookups precomputed in the image; no request-path JSON.parse of a reading. |
| B11 | Record cache validated by a generation counter, plus client poll backoff (later folded into V3). |
| B12 | Timing compared on one path, with a production acceptance run (later replaced by V8 and V9). |

Non-blocking notes N1–N21 were folded into their sections: N1 (decision 10), N2 (critical-path collections.json for a far shelf position), N3 (held deep link to metadata), N4 (codex.html growth <= 6 KB gz, measured), N5 (revision wording), N6 (platform-log caveat in PRIVACY.md), N7 (decision 15), N8 (work_readings order), N9 (export differences in release notes), N10 (build_html --check and route-aware equivalence), N11 (route-gated CATALOG_READY and resize guard), N12 (preview flag read in the head), N13 (brand mark in the shelves budget), N14 (workspace fetches pause), N15 (stream idle timeouts), N16 (Dockerfile stage order), N17 (serialized corpus PRs), N18 (`data_id` in every list and shard), N19 (8 MiB cap kept), N20 (prefetch on pointerenter only), N21 (replaced by the long-reading rule in decision 4).

### Revision 2: 3PO verdict on 774435ca1

| ID | Change |
|---|---|
| V1 | Reading files addressed by revision and never changed once published; embedded identity checked fail-closed; 30-day retention; `data_id` reload; 404 recovery. |
| V2 | Every page carries its own global start offsets, so a deep link needs only the head and the target page. |
| V3 | Bounded durable touches, incremental quota accounting, maintenance moved off the request path, and lock-free cached reads, all before `LIBRARY_PUBLIC=1`. |
| V4 | gzip at rest read by one bounded reader in Node and in Python, shipped as phase A (readers) and phase B (writes), with scoped owner approval. |
| V5 | Methods and result schema retained by fingerprint; analysis exports never mix generations (`EXPORT_READING_CHANGED`, `EXPORT_DEFINITIONS_UNAVAILABLE`). |
| V6 | Selection exports identified by `content_id` from a server-held plan; no bitset in any URL; `PLAN_STALE` / `PLAN_EXPIRED` re-plan. |
| V7 | Every credentialed response stays `private, no-store`; the IndexedDB evidence store was removed; evidence renders only after a fresh authorized job read. |
| V8 | A synthetic CI comparison with pinned fixtures and zero server delay, measured server delay, calibration, and an authoritative live comparison on real hosts. |
| V9 | Pass needs the caps and a live improvement by margin `m`; "ready" means usable, with an immediate-action probe. |

Revision 2 also adopted: verified revision equality for the B6 note; the B7 consequences and the long-reading rule; the classifier's non-readable classes and full id reconciliation; feature row 60; fixtures for the real old device-state shapes; rights wording; plain statement of retirement loss; the privacy sentence; the corrected old-boot evidence; 30 days of chunk generations; and the consolidated list of 15 owner decisions.

### Revision 3: 3PO verdict on 44577289c

| ID | Change |
|---|---|
| C1 | Reading paths carry projection identity, `r/<hh>/<id>/<rev16>-<proj12>/`, with content-hashed page files listed in the head. |
| C2 | Every build revalidates retained generations; a unit that stops being readable loses every retained file and its `u/` entry in the same commit. |
| C3 | Intent and generation markers cover every record and object mutation; verification scans are accepted only if quiescent, with no delta journal; unknown usage fails closed with `503 STORE_RECOUNTING` while cleanup continues. (Corrected after 3PO's third verdict, replacing a scan-plus-journal scheme and a fixed reserve margin that were both unsafe.) |
| C4 | `store-format.json` and a workflow gate enforce rollback compatibility outside the image; rollback past phase A needs `reader_store_inflate.mjs`. |
| C5 | Corpus URLs use package identity, `/library/v1/corpus/<package_sha16>/<format>.zip`. |
| C6 | A fresh authorized job read is required on every activation, including Back/Forward within one document. |
| C7 | The purge selector is an allowlist of `(job_id, viewer)` pairs from the old Site's D1, with a dry run and John's action-time confirmation of the exact count. |

Revision 3 also clarified that the B6 revision check uses `GET /library/v1/metadata/:id`, stated the V5 trade-off for John, made chunk reload recovery verify device-state writes first, and reworded decision 12.
