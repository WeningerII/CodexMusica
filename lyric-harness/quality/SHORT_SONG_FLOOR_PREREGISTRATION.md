# Pre-registration: a SHORT-SONG floor profile (under 200 tokens)

**Registered 2026-09-01, before any number below 200 tokens was read off
for this purpose**, under the owner's delegation of 2026-09-01 (*"I leave
the answers to your capable hands and taste"*). The instrument is
`quality/song_profile_calibration.py --profile short`; the results, and the
adoption or the refusal, are `quality/RESULTS_SHORT_SONG_FLOOR.md`.

## 0. Why this cell exists

The `song` profile in `quality/floor.py` grades a lyric sheet of **200–400
tokens** (re-adopted 2026-08-26, `MISSING.md` M-133). Below 200 tokens a
song reaches no profile and the floor REFUSES (`UncalibratedLength`), or is
graded inside the `song` profile's 1.25× tolerance band (160–200) with every
length-sensitive finding downgraded to a note. `MISSING.md` M-181 measured
the consequence on the banked series: the five songs a listener preferred
are the SHORT ones, and four of the five sit below the floor the planner
volunteers inside (`plan.song_line_counts` reads the profile with
`n_lines == 0`, so the planner's envelope is **22–55 lines** and a
twelve-line song has probability zero from the front door). M-191 removed
the density half of that finding; this cell is the length half.

The gap is a calibration, not a threshold: nothing may be graded at a
length nothing was measured at (doctrine 15, 58), and the existing band
rule already REFUSED to extend the `song` band downward — every candidate
reaching under 150 tokens fails on a named sub-bin (`RESULTS_SONG_FLOOR.md`
§1, §10: 100–400 fails on `mattr` at 100–150 and on anaphora at 100–150;
150–400 fails on predictability at 150–200). A profile that moves across
its own band is two profiles reported as one. So the question is whether
a SEPARATE profile, with its own band and its own thresholds, clears the
same rule below 200.

## 1. The rule, verbatim, and the one restriction

The band rule is `song_profile_calibration.band_ok` / `pick_band`,
UNCHANGED: (i) every 50-token sub-bin holds ≥ `MIN_BIN` = 100 items;
(ii) every sub-bin's own threshold sits within `HOM` of the band-wide one
(mattr 0.02, fwr 0.02, cv 0.02, anaphora 0.03, predictability 0.05);
(iii) the band is the WIDEST contiguous range satisfying both, ties broken
by item count; and the band holds ≥ `MIN_BAND_N` = 300 items.

The ONE restriction, declared here: the candidate edges are
`range(50, 201, 50)`, so the candidates are 50–100, 50–150, 50–200,
100–150, 100–200 and 150–200. The upper edge is fixed at 200 because that
is where the `song` profile's measured range begins; two profiles that
cover one token count would make `declaration_for` a tie, which §4 rules
on rather than leaves to list order.

## 2. The checks, and which of them this cell can afford

The five checks are the `song` profile's five, computed by the same
functions over the same corpus (`corpus/song/eng_*.txt`, the `--- TITLE:`
items). The fifth, `predictable_pair_fraction_max`, is 96% of a cold run's
cost (the module docstring: ~0.64 CPU-s per DISTINCT end word). This cell
runs in two declared stages:

* **Stage A — four checks** (`--profile short --without-predictability`):
  mattr, fwr, anaphora, cv, exact over the whole corpus, ~75 CPU-s cold.
  The band is picked on these four. If a band clears, the profile is
  ADOPTED with four thresholds and `predictable_pair_fraction_max` ABSENT —
  the `section` profile's own precedent (*"absent from this profile because
  its threshold was never measured at this length, so it does not run here
  rather than borrowing the sonnet cut"*). `PREDICTABLE_RHYME` then does not
  fire at this length, and `loop.MANDATORY_PURSUE`'s pursue of it is
  calibration-gated by construction (M-66).
* **Stage B — the fifth check** (`--profile short`, predictability computed
  ONLY for items inside the search range, `pred_max_tokens=200`): if it is
  run, the band is re-picked on all five and the fifth threshold joins the
  row; a band that clears four and fails five is REFUSED on five and the
  four-check adoption stands with the refusal recorded beside it.

## 3. What is adopted, and from what

If a band clears: a `Profile(name="short", n_lines=0, …)` row in
`quality/floor.py` with the band's 5th/95th percentiles, `n_human` the
band's item count, `n_generated=0` (no generated class exists at this
length — the profile's evidence is the held-out false-positive rate and
the note says so, as `song`'s does), the held-out FPR per check and the
union from `report_fpr` at 200 seeds, and `tolerance` MEASURED by
`report_tolerance` — the multiplier at which the union FPR first rises
more than one point over the exact band, or 1.25 if that is where `song`'s
did, stated either way.

If no band clears: the refusal is recorded with the named sub-bin and no
row ships. The planner's envelope then stays 22–55 lines and M-181's
length half stays open.

## 4. The tie-break, ruled before the row exists

`floor.declaration_for(n_tokens)` returns the FIRST profile in `PROFILES`
that covers the count. `sonnet` covers 108–126 tokens, and a short-song
band reaching 108 would cover them too; a 20-line song of 115 tokens is not
a sonnet, and a 14-line one may be. The rule: `declaration_for` takes the
text's LINE COUNT beside its token count, and among the profiles covering
the token count prefers (a) a profile whose `n_lines` equals the line count
exactly, then (b) a profile whose unit fixes no line count (`n_lines == 0`),
then (c) list order. A caller that passes no line count keeps today's
answer byte for byte. The gate (`Floor.check`) passes `len(lines)`.

## 5. What the planner inherits, automatically

`plan.song_line_counts()` unions the reach of EVERY profile with
`n_lines == 0` — it was written that way on 2026-08-24 (M-106) so that a
second lyric-sheet profile would widen the envelope without a planner
edit. The envelope's new floor is `ceil(short.lo / tokens-per-line hi)`;
the value is READ, and the docstring's "22..55" is repinned to whatever it
reads.

## 6. Falsifiers, named

* E1 — no candidate band clears the four-check rule: refusal, no row.
* E2 — a band clears on four and the union held-out FPR at that band
  exceeds 30% (the `song` profile's is 20.22%): the profile is NOT adopted
  on the argument that a gate interrupting a human songwriter one time in
  three is a different instrument from the one calibrated at 200–400, and
  the figure is recorded.
* E3 — the tie-break changes any verdict on a corpus item: measured by
  sweeping `declaration_for` with and without line counts over the corpus;
  a change is reported and is not a reason to withdraw the rule, but it is
  a reason to say which items moved.
