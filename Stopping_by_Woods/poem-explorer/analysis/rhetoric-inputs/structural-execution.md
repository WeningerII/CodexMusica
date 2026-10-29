# Whole-poem structural application

The files analyze the canonical 16-line, 108-occurrence poem in `../poem.json`. All occurrences retain global IDs 1–108 and line/word IDs such as `L01W01`. The title is excluded. No Sites source or CodexMusica source was changed.

## Display and application records

- `findings.json`: 16 grouped findings for the interactive reading, each with exact IDs, witnesses, sources, execution mode, and scope. Overlapping labels remain attached to the same evidence.
- `method_application.json`: all 40 assigned inventory entries. The application states are 14 observed, 11 checked with no match under the stated rule, 11 interpretation or component only, and 4 not executed. These are method-entry counts, not a claim that the poem contains 14 independent rhetorical effects.
- `structural_audit.json`: complete lexical recurrence table, including articles and pronouns; all 15 line-boundary decisions; source-inspired finite phrase checks; initials and alphabet checks; input and script hashes; and positive/negative sanity checks.
- `native_prd_results.json`: every native repetition output, including low-specificity function-word matches, exceptions, units, and stop-filter settings.

## What actually ran

The existing audited CodexMusica pair pipeline ran on all 5,778 unordered pairs in both annotated-pronunciation and all-dictionary modes. The selected annotated reading has 911 pairs with positive evidence, while the dictionary union has 1,248. These totals include many kinds of sound and identity relationships; they are not counts of perfect rhymes. Every absence-only flag, refused capability, and pronunciation witness remains in the full JSON.

The add-on route also ran in both modes. In the selected reading it returns five positive-evidence E63 homeoteleuton pairs and two E66 trite-list pairs. The homeoteleuton result is the existing declared ending/morphology scope; it is not an independent proof that the paired words have the same productive grammatical suffix. The E66 witnesses are know / go, with go appearing in both final lines.

Unmodified PRD finder functions ran with manual token/unit adapters: 16 verse-line units and six period-delimited grammatical sentences, each with the source stop filters and with no lexical stop filter. No Stanza parser or POS tagger was run. There are 36 records: 34 completed finder/composition outputs, one native IndexError, and one dependent composition skipped because of that error.

The exact-line comparator, bounded phrase/word recurrence checks, nonempty-onset fractions, letter-set checks, and finite anagram/palindrome/ABBA enumerations are explicitly this-run adaptations. The unchanged JaDe punctuation gate was extracted and executed, but its POS/dependency classifier was not run. Clause structures and morphological families were reviewed manually. Rhetorica, Webis, CorpusSearch, Prosodic, AcrosticSleuth, LanguageTool, and LaROS were not represented as executed packages.

## Findings that matter to interpretation and implementation

The complete seven-word final line repeats immediately. PRD's default line rules emit anaphora and epistrophe witnesses but truncate the beginning to And miles and the ending to sleep. With stop filters removed, the anaphora extender throws IndexError at the duplicated ending. The bounded adapter verifies the complete 14-token span. Phrase-inclusive epizeuxis is a source-permitted name for this repetition; a strict single-word definition has no match. Symploce is a formal source output, but definitions requiring a changing middle are not satisfied. The complete repeated blocks are adjacent and therefore fail Rhetorica's nonadjacent Conduplicatio condition; shorter repeated subphrases can satisfy that finite condition and are retained in the audit.

PRD's sentence-level polysyndeton candidate combines the adjective-list and in line 13 with the coordinators in lines 15 and 16. Those occur at different grammatical levels, so this raw match is retained as a candidate rather than promoted to a proven construction. Ordinary I and the recurrences likewise remain inspectable as formal matches without automatically asserting rhetorical emphasis.

There is one concrete sound-schema boundary: sound’s and sweep share initial /s/, but their full onsets are /s/ and /sw/. The existing E9 whole-onset equality predicate does not match them. The grouped display explicitly uses a broader first-consonant adaptation for that witness. All /h/, /w/, and /d/ headline witnesses do satisfy E9. Whose / His has positive alliteration, coda consonance, pararhyme, and umbrella slant-rhyme evidence, but no perfect-rhyme label. Are / village has no positive pair label in the selected reading.

Stop / stopping and dark / darkest are manually checked inflectional families. The native WordNet derivational-family classifier was not run. The repeated noun-plus-infinitive shape promises to keep / miles to go is a manually checked structural parallel; the first has five syllables and the second three in the preserved pronunciation, so equal three-word counts do not by themselves establish equal cola.

All 16 lines have eight vowel nuclei in the preserved pronunciation realization. This verifies syllable totals and does not replace the existing editorial meter or supply a new automatic scansion. No line reaches the source-declared paroemion threshold of 0.8; the maximum nonempty-onset fraction is 3/7. No nontrivial whole-word anagram pair, whole word of at least two letters that is a palindrome, whole-line palindrome, or whole-poem palindrome was found under the explicit normalization. The poem omits j and x; this establishes non-pangram status and a physical letter absence, not intentional lipogram composition. Initial extraction alone was not treated as an acrostic discovery.

## Reproduction

Run `run_native_prd.py` to recreate the source repetition results. Run `build_structural_findings.py` to recreate the grouped findings, 40-entry application ledger, and structural audit from the canonical poem and saved audited pair runs. The pair reruns use the existing `frost_pair_analysis/run_frost_pairs.py` and `add_frost_classifications.py` commands with annotated and all reading modes.

The source hashes and upstream commits are embedded in the saved native and pair JSON. Sanity checks confirm the exact 108-ID population, seven-word final-line duplication, the absence of a positive are/village relationship, the non-perfect status of whose/his, the identity-only sleep/sleep classification, nonempty-onset paroemion evidence, and validity of all display spans.
