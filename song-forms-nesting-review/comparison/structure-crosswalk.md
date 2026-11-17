# Prior structural survey against the English forms catalog

The survey has **623 data rows**. They describe several musical levels. The comparison catalog has **364 actual A–E rows**. The crosswalk preserves each survey occurrence by its one-based position after the TSV header. For example, the two Doxology records remain rows 329 and 419. The source file, both content hashes, the survey commit and its origin commit are recorded in [the JSON crosswalk](structure-crosswalk.json).

| Outcome for the survey occurrence | Rows | Interpretation |
|---|---:|---|
| Present | 14 | The catalog describes the same object in the specified sense, possibly also as a part within a larger work. |
| Alias, variant or coverage by subtypes | 23 | The record explains the scope of the correspondence. A subtype match can leave its broader family only partly covered. |
| Other layer | 534 | The cited object is principally a component, process, genre, performance instruction, instrumental organization or other level. |
| Attestation or scope unclear | 48 | An English-language realization, source sense, form-level distinction or sufficiently specific example remains unverified. |
| Supported catalog gap | 4 | A distinct sense or use has direct English-language evidence. The four require different kinds of representation. |

All 107 form and 35 process rows received individual comparison. A further 84 rows received individual treatment, including every exact normalized title/alias hit in the remaining layers, named vocal practices that can also stand alone, and terms with known changes of scale. The other 397 rows received a layer screen. That screen supports inventory coverage; it cannot establish that every term has been exhaustively researched in every tradition. The survey's corpus hit and attestation columns do not prove that a matching word denotes the same musical object. A named neighbor in the crosswalk can be an explicit warning against an equivalence.

## Four supported gaps

| Survey row | Form or sense | Evidence and limit |
|---:|---|---|
| 7 | Compound AABA | Larger A sections contain smaller sections such as verse and chorus. The catalog gives “compound AABA” as an alias for Extended AABA but models adding another B–A pair. The family needs a separate structural representation and an alias correction. [Hudson, with metal song analyses](https://www.mtosmt.org/issues/mto.21.27.1/mto.21.27.1.hudson.php) |
| 31 | Terminally climactic form | A previously unheard thematic high point arrives only at the end. A final chorus, ordinary coda or climactic bridge alone does not establish it. [Osborn’s formal definition](https://academic.oup.com/mts/article-abstract/35/1/23/1056491) and [his application to Radiohead](https://academic.oup.com/book/8275/chapter-abstract/153878627) |
| 304 | Medieval sung rondeau or roundel | Chaucer explicitly describes singing a roundel. The text of “Now welcome, somer” repeats two opening lines internally and all three at the close. The catalog’s poetic Rondeau, Roundel and Triolet have different specified returns. The English lyric and varying refrain lengths are verifiable. These witnesses do not establish a surviving melody or its exact phrase boundaries. [Chaucer’s text](https://rpo.library.utoronto.ca/content/parlement-fowls-0) and [the preceding passage identifying the song](https://original.sacred-texts.com/neu/eng/mect/mect52.htm) |
| 305 | Liturgical sequence | The US Catholic Easter liturgy prints an English-language Sequence. This is an attested English use in translation. It does not prove English-origin composition or the universal fit of the survey’s schematic progression of paired versicles. [Official English Easter Sequence](https://bible.usccb.org/bible/readings/041628.cfm) |

## Differences that change a proposed match

- **Musical accumulation and lyric accumulation.** Rows 2 and 10 concern growth of texture or a musical theme. Cumulative song adds textual items and recalls them. Spicer distinguishes two processes even within pop-rock. The source survey suggests a spelling variant, but that does not establish equivalence. [Spicer](https://doi.org/10.1017/S1478572204000052)
- **Recurring harmonic cycles and song form.** Rhythm changes can underlie an AABA number. Blowing changes can underlie improvised solos. Identical section order leaves the actual chords undetermined.
- **Whole work and part.** Doxology, Recitative, Couplet and Quatrain have independent catalog records and can also occur inside larger works. An ordinary tag is a possible song ending; the catalog’s Barbershop tag describes a freestanding close-harmony item. Lining out is a procedure used in a Lined-out hymn.
- **Translation and cultural identity.** Gazel has a ghazal-text sense and a distinct improvised vocal sense. A shared return between an instrumental Turkish or Arabic suite and an English-text form does not establish interchangeability. A lack of verified English evidence in this pass means the question remains open.
- **Source-level ambiguity.** Survey rows 16 and 21 split the gloss for Period and Sentence across source columns. The crosswalk keeps their literal gloss and notes the spill. The TSV is preserved intact.

The four supported gaps are findings from this comparison. They are not an exhaustive estimate of everything missing from the catalog. Some of the 48 open rows could qualify with direct evidence, and several musical processes can inform a form diagram without warranting their own catalog entries.
