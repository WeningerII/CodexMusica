# Narrative proxy calibration — first recorded run, 2026-08-25

Registered protocol: `quality/NARRATIVE_BANDS_PREREGISTRATION.md`.
Instrument: `quality/narrative_bands.py` (whose `PINNED` block carries
this run's headline counts and whose `--check` re-derives them). Run
under the registration's own rules: population is the sung English
corpus whose own marks declare sections, banked songs structurally
excluded, content partition as declared (types outside
`features.FUNCTION_TAGS` over `line_tokens`), null seeded at 20260825
with 10 draws. One presentation note kept for honesty: the run's printed
P2 label predates a label-only edit and reads "same-function pairs"; the
COUNT it prints (1,676) is the invariant-return population exactly
(burden 1,184 + refrain 382 + chorus 110), and `--check` re-derives it.

**Population: 8,667 songs, 0 refused for missing marks, 409 blocks
skipped with no content types — three counts, never summed.** The zero
is a fact about this corpus's staging discipline (every staged song
carries at least one function mark), not about the refusal path, which
the smoke run exercised.

## P1 — cross-seam continuity: SEPARATES, AND IS REFUSED AS AN ENFORCEMENT INSTRUMENT

Observed nonzero-continuity rate over 40,970 adjacent seams: **0.5902**.
The within-song shuffle null, all ten draws: 0.5805–0.5862, median
**0.5824**. The observation sits above the entire null range, so real
adjacency does carry more continuity than shuffled adjacency — the
registration's outright-refusal clause does not fire on direction.
**It is refused anyway, on SIZE**: the excess is **+0.78pp**, and an
instrument whose whole between-condition separation is under one point
cannot state any threshold as a usable false-positive rate (doctrine
22); at ten draws the resolution behind "above all ten" is also modest
(doctrine 57). A scalar cross-seam continuity check will not ship.

**The salvage is the by-pair table, and it is the run's real P1
finding: continuity is a FUNCTION-PAIR coordinate, not a scalar.** The
spread across seam types is thirty points where adjacency-vs-null was
under one: verse→verse **0.6136** (n=36,582), chorus↔verse **≈0.63**
(n=419), against verse→burden **0.358** (n=1,567), burden→verse
**0.4009** (n=1,332), verse→refrain **0.3472** (n=530), refrain→verse
**0.3275** (n=510). Human invariant refrains share markedly LESS
vocabulary with their neighbours than verses share with each other —
the fixed text is its own lexical island. Consequence for the layer:
any later continuity check must be keyed by the seam's function pair,
and a naive "adjacent sections should share words" rule would charge
every well-made burden in the corpus. Nothing is adopted from P1 in
this sitting or the next; if a keyed version is ever proposed, it gets
its own registration.

## P2 — room between returns: A NEAR-UNIVERSAL LAW, MEASURED

Over **1,676** consecutive instance pairs of the invariant-return marks
(burden, chorus, hook, refrain, tag as staged in this corpus), the
back-to-back rate is **0.0048** — burden 0 of 1,184, refrain 0.0026 of
382, chorus 0.0636 of 110. Human practice puts material between
invariant returns in **99.5%** of cases. The verse row (excluded from
the headline by its own gloss — "returns with NEW WORDS") runs the
opposite way at **0.947** back-to-back over 38,974 pairs, which is the
exclusion decision validated by thirty-odd points of daylight in each
direction: verses succeed each other; invariant returns almost never
do. This is the reframe precondition of `NARRATIVE_DESIGN.md` §D
measured against practice, and it holds so widely that when the layer
later discloses "this plan's returns leave no room to re-mean," it will
be describing a shape human songs almost never take. **Per the
registration, nothing is adopted in this sitting** — the number is
banked here and in `PINNED`, and any note or gate built on it comes
with its own sitting and its own FPR statement.

## P3 — deferred, as registered

Not run, by the registration's own deferral; naming it there is what
keeps a later run from being scope creep.

## What this run hands the next steps

Step 4 (plan-time build) gains one measured fact it can already use as
DISCLOSURE shape: back-to-back invariant returns are a 0.5%-of-practice
event. Step 5's enforcement split gains one closed door (scalar P1) and
one door left ajar with conditions (function-pair-keyed continuity,
registration required). The harm-check experiment
(`quality/NARRATIVE_PREREGISTRATION.md`) is untouched by any of this —
its instruments are the panel and the feature register, not these
proxies.
