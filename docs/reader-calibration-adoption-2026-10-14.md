# Approved reader calibration record adoption — 2026-10-14

John approved this bounded record adoption at 20:43 UTC after review of the following immutable receipts, measured at repair head `55e89f28eb98a2e133a427ab0d53f7823da584d0`:

- [Full comparator calibration, raw rows, provenance, parts source hashes and validation](https://github.com/WeningerII/CodexMusica/tree/0c31fdbc76a4077a3cdbd3d6adc93a82ff34ca4d/lyric-harness/quality/results/comparator_remeasurement_2026-10-14).
- [Full sonnet per-k procedure, raw scores and all seeds](https://github.com/WeningerII/CodexMusica/tree/c99aba0299372c1bbe5c907db90799aed063f5c5/lyric-harness/quality/results/sonnet_per_k_2026-10-14).

The comparator target is `51316f79c5093fa1750fbcde04975ddf8444407e38d8d929d73dc0086ddac2f4`. The repository pin writer measures its seven parts from the same unchanged comparator inputs. All 8,597 cold feature rows were recomputed, all five length curves hold, full song and short profiles reproduce all 21 constants each, and the corrected fast wrapper observes zero drift. The initial wrapper refusal selected system Python without nltk; both outcomes are preserved in the receipt. All 1,683 input hashes revalidated. Historical normalized record multisets match, with multiplicity retained; this is not raw TSV byte or order equality.

Verbatim curve-check conclusion:

> RESULT: HOLDS — the lyric row's 5 curves re-derive from the corpus

The two complete sonnet rows adopt the established four-decimal crossover and two-decimal percentage-point display precision:

| Bucket | Prior pairs / crossover / buys pp / clears | Adopted pairs / crossover / buys pp / clears | Unrounded measured crossover / buys pp |
| --- | --- | --- | --- |
| k=3–4 | 813 / 0.7594 / −0.17 / NO, 4 of 10 | 808 / 0.7590 / −0.16 / NO, 4 of 10 | 0.7589803820901831 / −0.16058170555497053 |
| k=5–8 | 208 / 0.6428 / +5.35 / yes, 10 of 10 | 207 / 0.6424 / +5.30 / yes, 10 of 10 | 0.642407362941597 / +5.301107706058865 |

The measurement uses all ten seeds 4242–4251 and all seven theta values. The six lost pairs are Gutenberg metadata/licence/address numeric endings preserved by reader v2. The existing corpus and 187-window population remain intact. The song-arm rows, theta_rhyme 0.75 and scalar CROSSOVER 0.72 remain unchanged. No reader, engine, timeout, or held safeguard change is part of this adoption. These are local calibration records, not live-service acceptance.

## Superseded comparator pin, preserved verbatim as JSON values

```json
{
  "fingerprint": "9d5d81461aec2c94c8997431b3211727f7db56686712c1678cd1348966dc0df8",
  "parts": {
    "Declaration()": "5f1ef1c954d2534cdcdcad5f817d5a33b6148ea194e93d2ffd7a34add802bb68",
    "_couplet_pairs": "942c42ed7326bedcc27b0e8b42671b4094c225d7b5773fec1227c3350c8e5a86",
    "cmudict.dict": "449bfdeafc1c748d11f822c78b4a77981a82635f5f6b7729253a9790d3683b85",
    "features.py": "80e6fb9f6df23662f16f61819eb4ee40f55e5fda0974ae20ef92db3e70888db1",
    "lyric_harness.py closure": "c0a100c4cbd445e51973166752a693023c38b65ef1c77b036fe43b13ae9d0152",
    "opensubtitles_en_50k.tsv": "1869ef3c76633403756cd7922c98599567e5a6f1a3f2c6e8eac0b894b955dc09",
    "predictability_frac": "b786e21a6e2d17e283a1829d21f6365524e72c51deaf2b148423d866f778c8c9"
  },
  "pinned_on": "",
  "verdict": "RESULT: HOLDS — the owner's NEAR ruling (Declaration.nucleus_licence_before_r = (('IH','IY'),), read by nucleus_agrees: IH~IY agree before a coda R; M-320) moved 2 of 7 inputs, Declaration() and the lyric_harness.py closure. The predictability memo was rebuilt from nothing over twelve shards (8,597 items, 34,701 CPU-s): length_curve_calibration.py check --rows HOLDS on all 5 curves, and song_profile_calibration.py --check (song and short) reproduces every shipped constant; expected_drift PASS. Three items' predictability moved, each by a NEAR rhyme the ruling restores (Hemans fear/hear, Hawker hear/near, Scollard fears/years' field). Nothing re-adopted. Still open: held-out E2 on short.",
  "verified_by": "quality/results/comparator_repin_2026-10-11/curve-check.txt",
  "version": 1
}
```
