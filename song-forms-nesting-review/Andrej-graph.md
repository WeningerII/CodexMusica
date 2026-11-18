# Relationship and nesting decisions

This review addresses findings 3–8, the broader-class observation and the six relationship captions in finding 2. It applies to the 364 diagrams in this package. The evidence for a relation describes precisely the form, realization or component to which it applies. [Andrej’s review](https://github.com/WeningerII/CodexMusica/pull/857#issuecomment-6968098933)

## How to read a relationship

| Kind | What the stored direction asserts | Example |
| --- | --- | --- |
| variant | The source is a specific form or documented adaptation of the target. An invariant or inherited mechanism is identified for the relevant tradition. | A clerihew is a four-line form. A Kyoka preserves the Japanese tanka sound-unit pattern. |
| contains | A designated part of the source realizes the target unit. The evidence identifies whether this is required, typical or one option; each supported row has at least one scope path into the displayed tree. | A clerihew contains two rhyming couplets; the Dozens can use a couplet in one turn. |
| shares-feature | Two forms share a specified property. This includes one documented complete setting of a more variable family. | The illustrated four-line Asclepiad and Ruthless rhyme settings share the span of a quatrain. |
| comparison | A particular structural comparison is worth making, including the differences that distinguish the entries; neither membership nor historical descent follows. | The long Gwawdodyn and a six-line Hir a thoddaid both have an opening quatrain followed by a linked toddaid, but their measures differ. |
| other | The evidence describes a specific contextual use outside the above relations. | The Onegin stanza served as a recurring unit in a verse novel. Verse novels can have other units. |

A scope of `1.2` means the second child of the first top-level diagram node. A numeric span becomes a component when the diagram and evidence distinguish a formal role, such as alternating opening lines before a separate close. A form may link both to a general unit for its size and to a narrower form for its scheme. A relationship is stored once even when useful to navigate in either direction. When two observations for one pair matter, the canonical explanation preserves their scope.

## What changed

| Finding | Decisions |
| --- | --- |
| 3 · Types | Both Clerihew and Ruthless rhyme contain couplets in their AABB setting. Clerihew is a four-line form. The four-line Ruthless and Asclepiad examples establish a shared feature of variable forms. The complete illustrated units in Tumbling verse, Tail-rhyme stanza, Rispetto and Anacreontic verse were likewise distinguished from defining subtypes. The complete fixed Rondelet and Triolet were retyped as variants of a septet and octave respectively. |
| 4 · Repeated facts | Retained the original 404 directed decisions. Archived 20 redundant supported reverse statements by marking them redirected and recording their supported canonical partner. Fourteen are symmetric paired statements, five restate a component or subtype inversely and Canon → Round separately restated the narrower Round → Canon subtype. This yields 363 unordered pairs in the previous 383 supported rows. Where opposite captions or sources supplied complementary details, the canonical row preserves the common scoped finding. The explorer can navigate the original pair from either endpoint. |
| 5 · Nesting and broader classes | The four opening lines before a distinct close qualify as quatrains in Venus and Adonis, Hallelujah metre, the long Gwawdodyn and the six-line setting of Hir a thoddaid. The depicted Music-hall song and Parlour ballad contain eight-line verse components on the same grounds as the four-line Gospel song example. Christ’s Kirk and Pearl each contain an opening octave and share its ABABABAB scheme with Sicilian octave. Tanaga now points to Quatrain as well as Monorhymed quatrain; Spenserian stanza points to its opening octave as well as the narrower Monk’s Tale comparison. These decisions make the different facts explicit without generating transitive relationships for the whole graph. |
| 6 · Component witnesses | All 196 supported containment decisions locate the component in the source diagram. Dozens illustrates the possible rhyming couplet in a turn. Stornello now shows its two-line and three-line alternatives. Those complete settings are shared features of the family. Optional recitative, couplet and hymn-meter settings were reviewed with the same rule. The optional meter relationship no longer cites a meter recipe absent from the target’s list. |
| 7 · Inheritance | Strophic with refrain retains the recurring tune across changing verse text. Extempo identifies improvised topical calypso verses; its responsive contest does not have to reproduce the fixed chorus in the particular Calypso example. The Tanka tree now distinguishes Japanese sound units from variable English syllable counts and lineation. Kyoka inherits the Japanese pattern. |
| 8 · Screen | Added one-, nine- and ten-line candidates, “full” and other qualified lengths, numbered opening/middle/closing headings, consecutive numbered verse-line children and independently marked rhyme-line children. The flagged long Welsh forms have a deliberately reviewed cross-form comparison: the six-line settings start with four nine-syllable versus four ten-syllable lines, and their closing toddaid ends with nine versus ten syllables. |
| 2 · Captions | Reworded the underlying Virelai → Lai, Virelai nouveau → Virelai, both Haiku/Senryu captions, Acrostic → Abecedarian and Cut-up poem → Found poem captions to state the structural claim. Independent evidence, where available, is recorded separately. |

The 20 new unique pairs are recoverable from the directed records. Their sources and targets follow.

| Source | Targets added |
| --- | --- |
| Music-hall song; Parlour ballad | Octave / huitain for each |
| Kyrielle | Tercet for the three changing lines before the refrain |
| Tanaga | Quatrain |
| Gwawdodyn | Quatrain; Hir a thoddaid |
| Hir a thoddaid; Hallelujah metre | Quatrain for each |
| Paradelle | Quatrain for the two doubled lines preceding the recombination |
| Ottava rima | Sestet / sixain |
| Spenserian stanza | Octave / huitain |
| Décima espinela | Couplet |
| Christ's Kirk stanza | Octave / huitain; Sicilian octave |
| Pearl stanza | Octave / huitain; Sicilian octave; Quatrain |
| Cherry and Slae stanza | Quatrain; Tercet |
| Haiga | Tercet in the depicted three-line haiku |

## Verification and limits

The current package has 424 directed decisions. The 383 supported rows are 383 distinct unordered pairs: 196 contains, 83 shares-feature, 76 variant, 27 comparison and one contextual other. The decision history also contains 20 redirected, 16 rejected and five ambiguous rows. A redirected row preserves the earlier wording and points to its canonical fact. Rejected and ambiguous claims remain outside the displayed graph.

Run `python3 -I -B audit_units.py --check` from this directory. The check reconstructs the TSV, matches 364 headings to their six model and audit files, walks 2,213 diagram nodes and finds 341 source-node/target matches covering 253 distinct directed source/target candidates. All 341 have decisions. It checks all containment paths, equality of displayed and supported outgoing edges, exact reverse redirects, unique current displayed pairs and the absence of cycles in the subtype hierarchy. It fails on a new lexical match that has no decision. Read `model-unit-crosswalk.tsv` for the paths, matches, directional verdicts and reasons.

The vocabulary is bounded. An ending of one line does not make a complete monostich. One nine-line stanza need not use the Nonet’s nine-to-one syllable count; a ten-line Keatsian ode stanza need not use the Dizain’s rhyme pattern. Four full lines plus a half-line form the shortened answer in the Curtal sonnet. Counting only its first four would split a single formal unit. Likewise the five lines remaining before CC in Rhyme royal have no separate five-line role here. The inventory records these decisions individually. It cannot infer all semantic relationships from titles, counts or tree shapes, and the structural test checks internal consistency rather than independently establishing historical facts.
