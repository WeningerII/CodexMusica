# Rhyme organization redesign: L-1 and L-2

Registered before implementation or evaluation. The commit containing this file
precedes the implementation. The old negative findings remain evidence about the
old instrument; they are not targets to fit away.

## Unit and claim

An observed rhyme edge is a descriptive relation, not a statistical discovery.
The inferential unit is **one item's organization within a declared stratum**.
There is no claim of individual-pair, syllable-event, timing, quality, or
cross-language significance. A significant item must never certify every edge
in it. The previous per-position false-event capability remains unestablished.

Two tests are declared together, before seeing their results:

* `internal`: number of affirmed rhyme edges within a line with at least one
  nonfinal word. Shuffle nonfinal word occurrences across the item's nonfinal
  slots, holding all final words and all line token counts fixed.
* `end`: number of affirmed edges between final words up to four lines apart.
  Shuffle only final word occurrences among final slots. This conditions on
  the end-word vocabulary rather than comparing content words to articles.

Both nulls preserve the full word-occurrence inventory, including repetitions
and unreadable words. They destroy the placement their own statistic reads.
The null hypothesis for each is uniform exchangeability in that declared pool,
conditional on the fixed words. This is a model, not an assertion that natural
language is randomly written. No rhyme scheme or beat is inferred from the text.

Word relations use the shipped English comparator, its declared band and a
minimum total of 0.80. Every lexical pronunciation combination must agree;
an unresolved pair is disclosed and contributes no affirmed edge. Identical
tokens never count as rhyme. Unknown occurrences retain their slots and remain
in the permutation pool. The statistic therefore concerns **affirmed edges in
the readable inventory**, not the unknown relations. No phonetic threshold is
fitted in this work.

## Error control and refusal

For each fixed statistic use `(1 + count(null >= observed))/(B + 1)` with
uniform independent permutations, identity allowed, and inclusive ties. Use
Bonferroni over both predeclared strata, including empty or refused strata:
`p_adjusted = min(1, 2*p)`. Thus under either true exchangeability null its
rejection probability is at most alpha/2; the union bound controls the chance
of any false stratum discovery per item at alpha without independent edges or
independent strata. Alpha is 0.05, B is 999, seed is 20260915 by default.

Refuse insufficient Monte Carlo resolution, missing comparison opportunities,
and a sampled null with no variation. Report refusals separately from tested
nonsignificance and retain the family size. Neither failure to reject nor a
refusal means there is no rhyme. Export no statistically certified positions.
Automatic legacy time inference must refuse: its independent-slot null does
not preserve paired events. Caller-supplied slot controls remain a separately
labelled research seam, not production timing evidence.

The mathematical error bound is conditional on exchangeability and uniform
random draws. A fixed seed makes a run reproducible; one deterministic run
cannot itself establish a long-run guarantee. The simulation checks the code,
not the truth of an exchangeability assumption for poetry.

## Frozen evaluation

1. Exact small permutation orbits: inclusive ranks must be super-uniform;
   both tests together must respect family alpha. Include ties and a positive
   arrangement so an always-refuse implementation cannot pass everything.
2. 1,000 independent H0 layouts of a 14-line, 8-word synthetic inventory,
   with distinct rhyme pairs planted internally and at line ends before
   shuffling. The entire two-test path runs each time. Reject the implementation
   if the binomial upper-tail probability under p=0.05 is below 0.01.
   Repeat the evaluation at independent seeds, reporting each separately.
3. 100 independently randomized layouts with those same paired words restored
   to their declared same-line / adjacent-line slots. Require at least 80%
   detection in each stratum. This is a capability control, never calibration.
4. Every parsed Shakespeare sonnet numbered above 30 (the first 30 informed
   the old detector). Evaluate real text and four independently scrambled twins
   each, with all parameters fixed. End-organization detection must be at
   least 50% of real items and exceed scrambled detection by at least 30
   percentage points. H0 twins must satisfy the same binomial check. Disclose
   coverage, refusals, raw counts, null means, excess and adjusted p-values.
   These sonnets are held apart from the previous 30-item calibration, **not
   an unseen corpus**. Internal separation is reported without a required
   direction: sonnets were never an attested internal-rhyme positive control.

If any gate fails, publish the failure and leave the relevant capability open;
do not change the statistic, population, thresholds or seeds to make it pass.
This work can establish a replacement organization test without establishing
individual-event localization or internal periodicity. MISSING must distinguish
those claims rather than close the historical entries by changing their units.

Method: [Phipson and Smyth, permutation p-values](https://arxiv.org/abs/1603.05766).
The family bound follows directly from the union bound and does not use Šidák's
independence assumption or BH's dependence assumptions.
