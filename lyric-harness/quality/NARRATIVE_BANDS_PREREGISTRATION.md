# Narrative proxy calibration — preregistration

**REGISTERED 2026-08-25, BEFORE THE RUNNER EXISTS OR A NUMBER IS TAKEN.**
Status: **REGISTERED — no results.** The meter-bands pattern: register →
build the runner → measure → RESULTS document → adopt or refuse. Nothing
in this document fires on any draft; adoption, if it comes, feeds the
LATER enforcement split (`quality/NARRATIVE_DESIGN.md` §E names it as
step 5's question, not this document's).

## 1 · The question

What do the mechanical narrative proxies actually run at in human songs
— so that when the narrative layer's checks ship, every threshold
carries a measured distribution and a false-positive rate instead of a
guess (doctrine 22: state a threshold as an FPR; doctrine 58: a count
nobody calibrated is a threshold nobody wrote down).

## 2 · Population, declared

Sung English songs under `corpus/song/` whose SECTIONING the text itself
declares — the corpus's own block marks read by the existing marked-song
reader. A song with no marks is OUT of the population, refused rather
than auto-sectioned: a sectioning invented by the instrument would be
measured as though the writer had declared it (the `recover.py` rule).
Wordless blocks contribute no lyric tokens and are skipped with their
skip counted. The banked songs calibrate nothing (doctrine 13/14).

## 3 · The proxies, declared before measurement

- **P1 — cross-seam continuity.** For each ADJACENT section pair: does
  at least one content type recur across the seam, and at what share of
  the smaller section's content types? Content partition spelled now,
  because run 5 taught us the spelling drifts: types whose in-context
  POS tag falls outside `features.FUNCTION_TAGS`, over `line_tokens`.
  Reported as a distribution over seams, split by the seam's function
  pair where both sides declare one.
- **P2 — room between returns.** For each returning mark: the share of
  instance pairs with at least one intervening section, and the
  back-to-back rate. This is the decidable precondition of the reframe
  trajectory (`NARRATIVE_DESIGN.md` §D) measured against practice.
- **P3 — person/tense frame consistency.** NAMED AND DEFERRED to a
  second pass: it needs the tagger across every line of the corpus and
  its own error analysis; registering the name now keeps a later run
  from looking like scope creep.

## 4 · The null, declared with the measurement

P1's headline is only readable against a matched null: the SAME
statistic over WITHIN-SONG SECTION SHUFFLES (the indent-ladder pattern —
a permutation null from the song's own material, so vocabulary and
length are controlled by construction). The claim worth having is not
"human seams share words" but "ADJACENT seams share more than shuffled
ones," with the excess reported as a series, not a point (doctrine 89).
If real adjacency does NOT separate from its own null, P1 is refused as
an instrument and the refusal is the result (doctrine 71).

## 5 · The instrument

A new module in the meter-bands mold — one runner, `--check`
re-derivation of anything adopted, constants declared in the module that
owns them, and the calibration manifest snapshotting which corpus state
the numbers describe. Built AFTER this registration, and its first run's
counts land in a RESULTS document, not in prose memory.

## 6 · What cannot come out of this

No story shapes, no plot inventory, no sampling of corpus narrative
structure (move 37 — the corpus tunes instruments, never supplies
content). No per-song judgment of any banked song. No threshold adopted
in the same sitting it is first measured.

---
**RESULTS BELOW THIS LINE ONLY. Nothing above it moves after this
commit.**

First recorded run, 2026-08-25 — full account in
`quality/RESULTS_NARRATIVE_BANDS.md`, counts pinned in
`quality/narrative_bands.py`. Headlines: 8,667 songs / 40,970 seams;
P1 separates from its shuffle null (0.5902 against a 0.5805–0.5862
null range) and is REFUSED as an enforcement instrument on size
(+0.78pp), with the salvage being that continuity is a function-pair
coordinate (verse→verse 0.61 against verse→refrain 0.35); P2's
back-to-back rate over 1,676 invariant-return pairs is 0.0048 — the
reframe precondition is a near-universal law of the corpus. P3
deferred as registered. Nothing adopted this sitting, per §6.
