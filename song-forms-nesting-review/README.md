# Song Forms nesting review

Open `dist/index.html` after extracting the whole ZIP. Search for **Binary** to see how the diagram handles competing descriptions of a repeat. Search for **Petrarchan sonnet**, open a connection’s **Evidence**, and inspect the basis for each direction. **View source entry** exposes the original wording. The five navigation groups preserve the catalog’s organization. Membership in a group or a similar title supplies no evidence of descent.

## What the audit establishes

Six reviewers covered the five tables, splitting the largest table in two. Every one of the 364 entries has a source line, a judgment on its internal structure, and a disposition for each previously displayed direct relationship. The original closing count of 378 conflicts with the five tables (61, 89, 105, 65, 44). Comparing every field of R2’s posted inventory found the same 364 entries in order. Fourteen structure descriptions and one title differ. R2 describes the inventory as a knowledge survey, so matching rows provide a provenance check, not independent corroboration.

| Review result | Count |
|---|---:|
| Source-supported within the documented scope of the diagram | 232 |
| Partial models with an explicit limitation | 106 |
| Entries with conflicting accounts | 26 |
| Entries whose structured model changed | 252 |
| Entries with changed nesting | 206 |
| Corrected alias fields out of 177 originally populated | 75 |
| Previously displayed directed assertions audited | 207 |
| Retained / removed old assertions | 200 / 7 |
| Added / withheld new assertions | 60 / 10 |
| Supported directed assertions available in the corrected explorer | 260 |

Counts of edits overlap. Of the 277 candidate assertions, 260 are supported, seven ambiguous and ten rejected. Each has an individually described basis. Direct assertions include components, variants, comparisons, shared features and six other qualified connections. Their count is not the number of unique unordered pairs or mandatory containment edges. Additional references occur in 172 of the 364 nesting reviews, with 130 distinct URLs. Other records rely on the supplied catalog for their scoped diagram. Evidence from the alias and gap comparisons is recorded separately. The 364 entries all have a displayable diagram; that does not establish 364 executable rules or worldwide catalog completeness.

## Where to inspect a change

| File | Contents |
|---|---|
| `english-forms.md` | Original source, SHA-256 c2b6bfb4d73611eba7e455ab8d2e2c455092fb8277909faa718a702e3b49233c |
| `coverage.tsv` | All 364 records, line numbers, disposition, diagram mode, change flags, original and reviewed connection counts, reasoning and sources |
| `relationships.tsv` | All 277 directed candidate assertions, including decisions to remove or withhold a connection |
| `model-changes.json` | Original and corrected values for each changed field in each of the 252 revised models |
| `baseline/`, `models/`, `audit/` | Original display code and models, revised JSON models and row-by-row review |
| `comparison/alias-overrides.json`, `comparison/alias-notes.md` | Every edited alias field, its reason, and distinctions that affect search |
| `comparison/r2-post.md`, `comparison/r2-row-diff.tsv` | Posted inventory and five-field comparison of all 364 entries |
| `comparison/issue-676-crosswalk.tsv`, `comparison/meta-forms.json` | All 320 term placements from #676 and individual findings on the 62 meta/form terms |
| `comparison/structure-crosswalk.md`, `comparison/structure-crosswalk.json` | Findings and all 623 rows of the earlier repository survey |
| `comparison/song-gaps.json`, `comparison/external-poetry.json` | Seven bounded music reference comparisons and two poetry glossary comparisons, including the disposition of each glossary headword |
| `comparison/meter.md`, `comparison/meter-crosswalk.tsv` | Runtime inspection, five comparator checks, seven structural boundary witnesses, and all 203 meter IDs with corrected evidence status |

## Examples that affect the model

- Extended AABA adds sections to an existing pattern. Compound AABA groups smaller sections inside the large A and B sections. The reviewed aliases remove that false equivalence. The catalog can still represent the compound design as a distinct future entry. [Hudson](https://www.mtosmt.org/issues/mto.21.27.1/mto.21.27.1.hudson.php)
- Binary has two main parts. The source implies a repeated AB pair, while an introductory music-theory reference describes the common practice of repeating each reprise. The corrected diagram keeps the two parts and explains the repeat question. [Open Music Theory](https://viva.pressbooks.pub/openmusictheory/chapter/binary-form/)
- The structural survey yielded four supported gaps in a specified sense: compound AABA, terminally climactic form, the medieval sung rondeau, and the liturgical sequence attested in English translation. An English translation establishes use in English; whether English-origin composition is required is a separate catalog policy. Forty-eight survey records need stronger evidence of scope, identity or English use. All 107 form rows, all 35 process rows and 84 additional rows received individual comparison. The remaining 397 received a layer screen. See `comparison/structure-crosswalk.md` for each claim and its sources.
- The music comparison distinguishes additional design candidates such as AABC from subtypes such as sectional or continuous verse–chorus, and from performance practices such as a head arrangement. Fifteen findings in that file include corrections, aliases and hierarchy. Several overlap the previous survey.
- The poetry comparison screened 163 Academy headwords and 35 Harvard headings. List poem and verbless poetry are missing in their own structural senses. Blazon and palinode organize rhetoric, while chance operations describe a procedure. An entry like elegy conveys a genre and supplies no necessary universal sequence. The glossary findings include sources and scope for each case. [Academy](https://poets.org/glossary) · [Harvard](https://poetry.harvard.edu/glossary-poetic-genres)

## Where meter belongs

Attach a documented expectation to the smallest unit it governs: the stress, quantity or syllable count of a line or phrase, or a pattern of alternating lines in a stanza. Carry the evidence, the language/adaptation and whether that expectation is required, typical, optional or disputed. Keep rhyme relations and musical pulse or bar counts separate. A form can link to several readings. A meter can be shared by many forms.

Of 203 earlier research IDs, 88 have a documented counterpart, component, comparison or limited analogy in this catalog; 115 remain without a direct link. Their underlying attestation and implementation states differ. The shipped strict comparator at the audited revision can check an explicitly supplied stress pattern. The separate named-meter recognition work was parked. The prototype uses JSON records and JavaScript for presentation, with Python for the offline build. It contains no recognition or writing validator for these 364 forms. The repository’s existing Python planner and declared-meter code remain the relevant owners for future semantics. The complete meter study identifies which boundaries belong to the narrow Stage 7c and which are deferred to #804.

## Run and review

Open the extracted `dist/index.html` with a current browser or serve `dist` locally. No install is required. From the extracted folder, `python3 reconcile.py` regenerates the data and change ledgers and checks the integrity of the source rows, model keys, tree nodes and connection dispositions. Source files and output use UTF-8. The live browser check covered catalog counts, the Binary source conflict, keyboard search/selection, and expanded directional evidence on the Petrarchan/Miltonic relationship.

Review sequence: R2 checks the evidence, challenged claims and proposed scope first. Reconcile those findings before Andrej reviews. The 106 partial and 26 contested diagrams, 48 unresolved structural comparisons and translation boundary are explicit review targets. This is a portable review of data and presentation. Implementation choices for the production planner remain with its Stage 4/5 owners.
