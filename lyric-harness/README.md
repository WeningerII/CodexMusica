# Lyric Harness MVP

Declaration-driven rhyme engine. The model proposes; this grades. Nothing is
scored without an explicit declaration (dialect, anchor rule, channel weights,
band thresholds) — print it with `python3 lyric_harness.py declaration`.

## Setup
Python 3.8+, no dependencies. First run downloads CMUdict (~3.5 MB) and a 20k
frequency list beside the script.

## Commands
    python3 lyric_harness.py demo                          # acceptance suite
    python3 lyric_harness.py score fire -- desire          # graded pair, sub-scores
    python3 lyric_harness.py score "shoulder blades" -- "cold as Hades"
    python3 lyric_harness.py candidates obstacle 20        # ranked rhyme field
    python3 lyric_harness.py meter "./././." "Line one here" "Line two here"
    python3 lyric_harness.py scheme AABB "L1..." "L2..." "L3..." "L4..."

## What it implements
- transcribe: CMUdict lookup, multiword, OOV flagged (pi + rho)
- anchor: last primary stress to end, fallback chain (alpha)
- score: multi-channel comparator — nucleus / coda / interior-onset / stress,
  each sub-score exposed; band-passed: REPEAT and RIME_RICHE are relations,
  not high scores (d, band-pass)
- candidates: reverse index over 20k common words, perfect/strong/slant tiers
- check_meter: syllable count + strong-position agreement vs template
- check_scheme: full pairwise score matrix diffed against target letters —
  violations, cross-letter collisions, transitivity-defect triangle count
- value flags: cliche_pair (30-pair seed list), shared_suffix (stem-checked),
  identical_word, semirhyme

## Known limits (deliberate MVP cuts)
- Weights are hand-set (`fitted: false` in the declaration). The fitting path
  is log-odds estimation from an annotated rhyme corpus, Hirjee-Brown style.
- Lexical stress is a proxy for scansion; monosyllable promotion/demotion is
  not modeled, so meter agreement is advisory.
- Cross-syllable coda redistribution (blades/Hades) scores conservatively.
- No beat grid (time layer), no perplexity strain check (doggerel signature),
  no performance vowel-deformation allowance. Inventoried, cut knowingly.
- OOV without G2P: coinages and slang (shiesty, blimini) transcribe empty
  and fragment chains; the g-dropping fallback (feelin' -> feeling, NG->N)
  covers the common case only. A real G2P model is the fix.
- Liquid codas score as hard mismatches against open syllables
  (bankroll/go/snow/pole reads as broken); a fitted matrix softens this.
- Compound stress: "door hinge" anchors on hinge per citation form; the forced
  rhyme with orange requires declaring the compound-stress anchor — which is
  the point.

## Graph mode (the primary object)
`python3 lyric_harness.py graph metidja.txt [theta]` — full pairwise score
matrix as a weighted graph, maximal cliques extracted (tolerance classes).
Cliques may OVERLAP; overlapping nodes are structures with no letter-scheme
representation (chained slant). Letter schemes, chains, and blueprints are
lossy projections of this graph. Calibrate on labeled forms; analyze on the
graph.

## Channel profiles (parts-of-word constraints)
`scheme AAAA --profile assonance` — nucleus-only agreement (Old French
laisse). `--profile rawi` — final-consonant identity, vowels free (Arabic
qafiya core). `prasa K line1 line2 ...` — identical consonant at syllable K
of every line (Indic positional constraint). Constraints bind channels and
positions, not just whole-anchor scalars; add profiles to PROFILES dict.

## Parts-of-word and positional systems
`internal "line"` — sliding detector: all rhyming position-pairs inside a
line (stressed-syllable anchors, windows 1-3, greedy non-overlap). `density
file` — fraction of syllables in any match, within-line plus adjacent-line.
`weight "line"` — guru/laghu pattern and matra count (Pingala; 'arud-ready).
`cynghanedd "line"` — croes/traws (consonant skeletons across the caesura),
sain (comma-split thirds), llusg (penult of final word vs earlier stress).
`qafiya L1 L2 ...` — group-level audit: establishes rawi/ridf/ta'sis/wasl
from the group, names defects per line (sinad, iqwa, ita; waw/ya interchange
licensed). Approximations: English vowel classes stand in for Arabic
letters; Welsh mutation and 'n' rules not modeled; weight is an English
mapping of guru/laghu.

## Discovery mode (through-composed verse)
`python3 lyric_harness.py chains lyric.txt` — no predeclared scheme. Detects
serial rhyme chains: a line joins by matching either of the chain's last two
rhyming members (interleave-safe for xAxA odd-rhyme structures); one
non-matching line is held as a filler if the next line rejoins. Reports
per-chain coherence and drift-floor — a floor below ~0.6 usually means two
sound families bridged by drift; the number is the diagnostic, read it.
Verification mode (scheme/song) is for declared forms; discovery is for rap
verse where chain lengths are improvised and the sound moves.

## Song structure layer
    python3 lyric_harness.py song quality/fixtures/song.blueprint.json \
        quality/fixtures/song.txt '--returns=6,13;7,14' --subdivision 2

checks a lyric sheet against a declared blueprint. A blueprint is BARS, not
stanzas: each section declares `bars`, `start_bar`, an optional `function` and
a `meter` OBJECT — `{"beats": 7, "unit": 8, "groups": [3, 2, 2]}` — and each
line declares the `bar`, `beat` and `duration` it is sung over. There is no
per-section line count and no per-section scheme; lines-per-section is
EMERGENT from where the lines fall on the grid. `song` cross-checks the
lyric's own `[Section]` markers against the blueprint's sections
(`STRUCTURE:`), then runs the same report `brief` runs, with meter
(`quality/fit.py`) and song function (`quality/grid.py`) joining the rhyme and
slop-floor findings.

The MANDATE is required and is not optional politeness — with nothing declared
to check against, the verb REFUSES and exits 2 rather than passing vacuously
(doctrine 20). `--returns=` is the spelling for a VERBATIM chorus: identity is
the requirement there, where `--groups=` would charge the same repeat as a
violation. `--subdivision N` is likewise declared and has no default; without
it the slot questions refuse rather than assume a sixteenth-note grid.
[Section] headers, Suno-compatible.

**A `meter` written as a signature STRING is refused, not parsed.**
`"meter": "4/4"` names a duration and cannot name a grouping — 7/8 admits 64
of them — so `grid`, `fit`, `function` and `song` all answer the same
`REFUSED — section 'intro' declares "meter": "4/4", a string; ...` at exit 2
rather than guessing. `quality/fixtures/string_meter.blueprint.json` is the
specimen; it was this repo's own root `blueprint.json` until 2026-08-14, and
the command line above used to name it.

## Next step
Wrap these six functions as MCP tools (mcp-builder pattern) and point the
model at them: draft -> check_scheme + check_meter -> revise flagged lines
only -> re-check.
