# Poem comparison adapter

This directory preserves the analysis code for this one supplied Frost poem. The browser is self-contained in `dist/`; regeneration additionally needs the sibling `frost_pair_analysis` and `frost_notation` directories. Codex Musica is pinned to commit `022fb015a9c567712e873fbf63f8e19a0ae2b417`, with its verified pronunciation assets.

## Pronunciation scopes

Both scopes compare all **108 word occurrences and 5,778 distinct occurrence pairs**, using the same category order and schema contracts.

- **Annotated reading** is the default. Each occurrence is pinned to a supported pronunciation matching the existing displayed vowel and consonant qualities. Among matching options, supported stress choices closest to the annotation are preferred. The original four-foot grid remains an editorial delivery; lexical stress is not silently replaced by its capitals or weak positions.
- **All supported pronunciations** retains CMU alternatives and the explicit sourced additions below. Its labels collect support across whole readings; they need not all hold in one performance. Recorded witnesses provide positive support, not a complete per-reading table of false results. The fixed grid remains the reference reading in this scope.

`poem_readings.py` normalizes **AH0 schwa separately from AH1/AH2 STRUT**, before reading merge or prominence handling. It also applies Codex Musica’s existing **IH/IY-before-coda-R** licence. Every stream builder must call `normalize_reader(reader)`, including native alternate-reading trials. `annotated_phonology(base, poem)` supplies occurrence pins; `annotated_manifest(base, poem)` records their selection and provenance.

### Sourced additions

These declarations preserve the established grid without pretending the missing readings were in CMUdict. They are added alongside its original alternatives, not substituted globally.

| Word | Declared phones | Source |
| --- | --- | --- |
| of | `AH0 V` | [Cambridge: auction of promises](https://dictionary.cambridge.org/us/pronunciation/english/auction-of-promises), US weak /əv/ |
| promises | `P R AA1 M IH0 S IH0 Z` | Same Cambridge entry, US /ˈprɑː.mɪsɪz/ |
| darkest | `D AA1 R K IH0 S T` | Compositional declaration: native **dark** plus [Cambridge -est](https://dictionary.cambridge.org/pronunciation/english/est), US /ɪst/ |

## Modules and coverage

- `english_schema_contracts.py` supplies audited English declarations to the existing native evaluator. It records corrections to stressed anchors, complete-tail coverage, terminal addition/subtraction, final weak-syllable selection, and reversal. The native checkout is not patched.
- `run_frost_pairs.py` evaluates E1–E22 under the selected pronunciation scope and checks positive consonant evidence before displaying E5, E7, or E9. E10 is the inclusive displayed E4-or-E5 umbrella.
- `add_frost_classifications.py` adds the existing E63 morphology-based homeoteleuton, E66 trite-rhyme list, and H1 spelling-based homeoteleuton observations to the matching base file.
- `build_data.py` packages both scopes with the preserved poem annotations. It checks base/add-on hashes and emits `dist/data.js`.

E1–E22 is the retained catalogue, **not a claim that all 22 are fully determined for every pair or that they exhaust English rhyme terminology**. E6 requires a whole-line comparison; E17 requires a delivered surface; E21 requires historical pronunciation; E22 has no executable native schema. Unavailable and undecided outcomes remain distinct from negative findings. Supplemental morphology and spelling classifications retain their own operational limits in the data.

## Regenerate

Run these preserved scripts from the Site directory. `FROST_ANALYSIS_ROOT` identifies the directory containing the pinned `CodexMusica` checkout and generated comparison files; its parent contains `frost_notation`. `FROST_SITE_ROOT` identifies this Site. Both settings are honored by the pronunciation module, including when its source is restored from this directory.

```sh
export FROST_ANALYSIS_ROOT="$(pwd)/../frost_pair_analysis"
export FROST_SITE_ROOT="$(pwd)"

python analysis/test_poem_readings.py
python analysis/test_english_schema_contracts.py
python analysis/test_frost_pair_evidence.py

python analysis/run_frost_pairs.py --reading all
python analysis/add_frost_classifications.py --reading all
python analysis/run_frost_pairs.py --reading annotated
python analysis/add_frost_classifications.py --reading annotated

python analysis/build_data.py
node analysis/verify-data.cjs
```

The two base files are `frost_rhyme_pairs.json` and `frost_annotated_pairs.json`; their add-ons are `frost_extra_classifications.json` and `frost_annotated_extra_classifications.json`. Do not mix scopes. Changes to the schema or pronunciation modules require regenerating both base files and both add-ons; module and base hashes enforce this.

The original annotation audit retains its historical comparison hash. Current results, add-ons, pronunciation declarations, and browser data carry their own provenance. Local paths are regeneration inputs, not browser dependencies.

## Declared rhetorical refinement

`data.js` preserves the source calculation above. `build-scope-refinement.py` recomputes first-consonant agreement and positioned ending agreement from the saved complete pronunciation manifest; the browser applies those explicit changes after loading the original data. E9 remains147, A1 adds235 initial-consonant pairs, and active E63 uses34 sound-and-position pairs instead of the five affix-heuristic results. H1 retains its predicate with a precise spelling label. See `RHETORIC.md` for scope and regeneration.
