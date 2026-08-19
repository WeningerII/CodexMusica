# Corpus loading protocol — English expansion

Adopted 2026-08-19, with the taxonomy foundation (quality/corpus_taxonomy.py,
data/song_regions.tsv, data/song_functions_eng.tsv,
data/calibration_manifest.tsv). This is the working protocol for the
loading sittings. Read `lyric-harness/CLAUDE.md` first — the standing
rules outrank this file — and read METHOD part D (doctrines 34, 38, 39,
40, 44, 49, 54, 80, 85, 92, 93) before touching any source.

## The goal, in one sentence

Better group coverage begets deeper calibrations: coverage is a GRID
(region × function cells, `python3 quality/corpus_taxonomy.py` prints it), and
loading exists to fill cells the calibrations need — never to equalize
file sizes, which no measurement rewards.

## The taxonomy in one paragraph

Language is the senior axis (the corpus filename prefix; it dispatches
the phonology, doctrine 45). REGION/tradition (single-valued; global
table) and FUNCTION/venue (N values, each independently attested;
per-language table) are per-song coordinates: `# region:` /
`# function:` file headers set the default, `--- REGION:` /
`--- FUNCTION:` lines under a song's `--- TITLE:` override it, and blank
means UNDECLARED — evidence-or-blank, never a guess. Both vocabularies
are closed sets (`quality/corpus_taxonomy.py --check` is the gate); a new value
enters by adding a defined row in the same commit as its first song.
The filename group token (american/hymn/british/parlour/celtic/hall) is
the acquisition-batch label and carries no analytic weight — the proof
is in the corpus: the English Taylor sisters sit in `eng_american_*`
files with `# region: english`.

## Reserved values (named now so a hurried session cannot misfile them)

Regions: `welsh` (Anglo-Welsh song in English), `african_american`
(spirituals, work songs — NOT to be filed under `american`; that repeats
the axis collapse), `canadian`, `australian`. Functions: `work`
(shanties, hollers, bothy and prison songs), `spiritual` (African
American sacred outside hymnbook liturgy), `tin_pan_alley` (US
commercial sheet song, the ~1885–1929 PD slice). Each enters its table
with its first staged song. Deferred by decision, no value reserved:
minstrelsy — staging that repertoire raises handling questions that get
their own sitting first. Noted, no row yet: Elizabethan ayres
(Campion/Dowland are staged from a song-book anthology and sit honestly
function-blank until a vocabulary decision is earned by material).

## Adjudications already made (do not re-litigate; amend by sitting)

- Where an author's birth tradition and the songs' institutional
  tradition diverge, the SONGS' tradition wins: Lyte, Montgomery, Tate,
  Tate&Brady carry `english` (Anglican hymnody / the New Version
  psalter), while Borthwick is `scottish` (Free Church) and C. F.
  Alexander `irish` (Church of Ireland).
- Addison's file carries NO function: his staged source is a Poetical
  Works, not a hymnal. The other 33 hymn files are hymnal-attested.
- The `parlour` group's sources are NOT parlour anthologies: they are
  war-ballad collections (sawyer/work/hays → `patriotic`), Beadle's dime
  songsters and a circus songster (→ blank; a dime songster attests no
  function in the vocabulary). Nobody currently carries `parlour` as a
  seeded function — the first parlour attestations will come from real
  drawing-room sources, per song.
- Elliott (the Corn Law Rhymer) is function-blank: his staged source is
  the Oxford Book of English Verse, which attests nothing functional.
  `political` waits for a Corn-Law-Rhymes edition.
- Dunbar, Wheatley and Harper carry `american`; when `african_american`
  activates as a tradition row, re-seeding them is in scope for that
  same sitting.
- Per-song refinement lanes (real evidence exists in `--- SOURCE:`
  lines): Carroll (3 children's books + 1 adult collection), the
  Taylors (children's collections + a general anthology), D'Urfey
  (stage vs convivial per song), Gilbert (Bab Ballads vs Savoy Songs),
  Foster/Root/Russell/Bayly (per-songster attribution).

## Pass 1 — same-gate top-ups (the cheap pass; do this first)

For each already-cited edition (the file headers' `# source:` rows, md5
pinned): fetch the SAME bytes, count the marked songs it contains, and
compare against what was extracted. Anything marked and unextracted
enters under the existing gate — no new licence work.

CITATION CONVENTION, learned the hard way (2026-08-19, the first
verification sweep): seven sources were cited as `NNNNN.n.txt` with a
hash no upstream file carries — the original staging normalized CRLF
line endings to LF and pinned the NORMALIZED bytes, and the rule lived
only in a dead session's memory. All 105 citations now verify: 95
upstream-byte-identical, 3 filename spellings corrected (the repo ships
`-0`/`-8` variants; same bytes), and the 7 derived pins re-spelled to
carry BOTH hashes — upstream md5 first, then "(staged after CRLF->LF
newline normalization ...) as NNNNN.n.txt md5 ...". To verify a derived
pin: fetch the named upstream file, replace \r\n with \n, md5 the
result. A future staging that transforms bytes records the
transformation IN the citation, in this same shape — a hash whose
recipe is unwritten is a rumor with a checksum. Discipline:

1. The mark is the admission rule (doctrine 93): hymnal membership, a
   printed CHORUS/song heading, a song-anthology's own framing. No mark,
   no entry — poems do not become songs by proximity.
2. New songs append to the existing author file, under its header;
   apparatus conventions exactly as the file already uses them. Per-song
   `--- SOURCE:` when the file has multiple sources.
3. Taxonomy: the file header seeds; add per-song lines only on per-song
   evidence. `quality/corpus_taxonomy.py --check` before every commit.
4. The staged-file md5s recorded in `local:corpus/...` rows of
   data/sources.tsv must be repinned in the same commit (the corpus
   audit's check C fails loudly if forgotten — that is it working).

## Pass 2 — new sources, chosen by cell need

Pick sources by which grid cells a calibration needs filled (the report
names the thin cells), never by author-count equality. Every new source
is a full gate: data/sources.tsv row first (licence, edition date,
jurisdiction, evidence — doctrines 38/40/54/80), then staging.
**ESCALATION IS MANDATORY here: licence and provenance verdicts go to
the owner before anything enters the tree.** A refused source is a
recorded row (doctrine 39), not a memory.

## Batching and the manifest

Loading changes the population every corpus-calibrated constant
describes. The discipline: load in BATCHES on the working branch; at
batch end run `python3 quality/corpus_manifest.py --check` — drift
(exit 3) is the expected mid-load ANSWER — then, in ONE closing sitting:
re-derive and re-adopt the corpus-calibrated constants (meter bands,
floor profiles, the modal/end-word tables, structure-census rates —
each by its own preregistered pattern), re-run their `--check` lanes,
and `--write` a fresh manifest in the same commit. Never drip single
songs into a corpus whose checks are green-by-coincidence. The nightly
lanes still measure the LIVE tree; rewiring them to the manifest
snapshot is its own future sitting and is NOT licensed by this file.

## What the loading sessions must not do

- No licence/provenance verdicts without the owner (see Pass 2).
- No new vocabulary values without a table row in the same commit; no
  re-litigating the adjudications above outside a sitting.
- No touching the recipe engine, mcp/, or anything the connector serves
  (standing rule 1; the taxonomy is corpus-side only).
- No re-adoption of calibrated constants mid-batch; no manifest --write
  outside the closing sitting.
- Test songs never enter the repo; scratchpad only (standing rules).
- All work on the designated branch; suites relevant to touched layers
  run before every commit, results read from output files.
