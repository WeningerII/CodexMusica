# Pre-registration — the reader amendment: calibrate with the declared G2P fallback

The third registration in this series, following the owner's decision
between the two forks `RESULTS_METER_BANDS_AMENDMENT.md` names. Committed
with the seam code and BEFORE any corpus-wide number under the new reader
exists; `git log` proves the order, as it did twice before.

## Disclosed: what has been looked at under the new reader

Word-level probes only, no corpus aggregates: a 30-word dialect list
(Scots, Dorset, elision, 17th-century forms) read 19/30 at
`fallback="high"` and 26/30 at `fallback="low"` — the four still refusing
at low are `sae`, `frae`, `wi'`, `nae`, high-frequency Scots function
words, which is why the exclusion prediction below is not near-zero. A
syllable-count spot check of 18 dialect words at low matched the ear on 16;
the two misses are named — `hame` read as 2, `thease` as 3, both
overcounts from letter-layer vowel groups. No line, file, or percentile
has been measured with the fallback anywhere.

## The reader, exactly

`quality.fit.read_line(text, phon=quality.phonology.eng.English(fallback="low"))`.

One seam is changed in production code so this is possible without lying:
`fit._english_lexicon` learns a `fallback` key and `read_line`'s English
branch derives it from `getattr(phon, "fallback", None)` — the phonology is
the single source of truth, so the refusal list (`phon.unreadable`) and the
syllable source (`word_syllable_map`'s Lexicon) can never disagree about
which words were read. Without this, passing a fallback phonology would
mark a dialect word READ while its syllables silently vanished from the
count — the exact near-miss shape this repo documents and refuses.

## Why "low" is honest here when it is refused elsewhere

`test_g2p.test_letter_layer_costs_more_than_it_buys` measured the letter
layer as net-harmful and the shipped default keeps it off. That measurement
is about RHYME COMPARISON: among pairs only the letter layer could judge,
roughly half were violations — predicted phone identity at word ends is not
trustworthy. **The band never compares phones.** It counts syllables and
stress marks. Syllable counts from spelling are robust (16/18 above, both
misses overcounts); stress on derived words is a PREDICTION, and instead of
trusting it, this registration makes it stand trial: the adoption rule
below tests the derived lines against the dictionary-certain lines and
refuses the prominence band if they disagree.

**Instrument match**: adopting a band calibrated at `fallback="low"`
commits the band CHECK to reading draft lines with the same declared
coordinate. The CLI's global `--fallback` flag already exists; wiring it
through the band check is the enforcement sitting's work and is named here
as an adoption condition, not left implicit.

## Declared coordinates

| coordinate | value |
|---|---|
| population, lyric-line filter, percentile method, points, band cut | unchanged from `METER_BANDS_PREREGISTRATION.md` |
| reader | `English(fallback="low")` via the seam above |
| exclusion | unchanged: refused tokens (NUMERAL, the fallback's own residual OUT_OF_LEXICON), ZERO_UNITS, undecided prominence |
| per-line tag | `derived` = number of tokens read by a non-dictionary layer (`phon.derived`); 0 means the line is dictionary-certain |
| the split | CERTAIN lines (derived = 0) vs DERIVED lines (derived ≥ 1) — disjoint, so agreement is not diluted by overlap |
| agreement test | nearest-rank p5/p50/p95 of each quantity, CERTAIN vs DERIVED, tolerance ±1 |
| runner | `python3 quality/meter_bands.py --reader=fallback-low` (the bare command still reproduces run one unchanged) |

## Adoption rule, declared before the numbers

Hard gate first: aggregate exclusion under the new reader must be ≤ 25%
(the original registered ceiling) or nothing is adopted and the calibration
stops. Past the gate, each quantity adopts INDEPENDENTLY:

- **DENSITY** adopts the full pool's [p5, p95] syllables/line iff CERTAIN
  and DERIVED agree within ±1 at p5/p50/p95 on syllables.
- **PROMINENCE** adopts the full pool's [p5, p95] prominent/line iff
  CERTAIN and DERIVED agree within ±1 at p5/p50/p95 on prominent counts.

Partial adoption is a declared outcome, not a failure mode: if the derived
lines' predicted stress warps their prominence envelope, DENSITY may still
adopt while PROMINENCE refuses and waits for a better reader.

## Predictions

**R1 — the gap mostly closes.** Aggregate exclusion falls from 31.09% to
at most 10%. Not near zero: `sae`/`frae`/`wi'`/`nae` still refuse and they
are common exactly where the exclusions were.

**R2 — conservation: must hold everywhere**, same code, same consequence
(a violation refuses the whole run).

**R3 — sung lines are sung lines.** CERTAIN vs DERIVED agree within ±1 at
every registered point on SYLLABLES. Dialect verse is not longer or
shorter per line; it is differently spelled.

**R4 — the stress prediction survives its trial.** CERTAIN vs DERIVED
agree within ±1 on PROMINENT counts too. Less confident than R3 — the
derived stress channel is a prediction and the two named overcounts push
one way — so this is the prediction most likely to miss, and if it misses,
the partial-adoption outcome is the result.

**R5 — the pool moves little.** The full-pool envelope under the new
reader sits within ±1 of run one's certain-line envelope ([4,11] / [2,7]
at the cut) at p5/p50/p95 — the newly readable 30% does not overturn what
the readable 70% already said.

## What would falsify this registration

- R2 fails: the reader is broken; everything above it is void.
- The hard gate fails (exclusion > 25%): the fallback did not restore the
  population and the calibration stops with no bands, again.
- R3 AND R4 both fail: the derived lines are a different population under
  this reader; no band adopts, and the next registered step is population
  redesign — the other fork — not a fourth reading of this one.

A single quantity failing its agreement is the declared partial outcome,
reported beside the one that held. Nothing in this file is edited after
the run; misses are reported next to their numbers in
`RESULTS_METER_BANDS_READER.md`.
