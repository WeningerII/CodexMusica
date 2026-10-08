# PG 69378 — Negro Workaday Songs (1926)

The byte-pinned original-text witness yields 329 auditable verse units: 271 eligible before common deduplication and 58 exclusions. These are extraction counts, not a claim that the book advertises 329 complete songs. Its contents lists chapters.

`source.txt.gz` preserves the original downloaded HTTP bytes. `adapter.py` reproduces `candidates.json` offline. Song boundaries follow printed headings and separately lettered versions. Ten unheaded units have affirmative, source-specific completeness decisions; analytical excerpts are not concatenated into new songs. Complete four-line work songs remain eligible. Pronunciation gaps never decide inclusion.

Supplied sung improvisation is preserved as a performance witness, including Left Wing Gordon's continuous songs and Dupree's Jail Song. That differs from assembling fragments into a song ourselves. Incipit titles are identified in each decision. Three claimed compositions retain Sanctified Mary Harris's qualified credit. The compilers are not song authors.

The source expressly identifies a condensed Death Letter Blues version and a Stewball fragment; both are excluded. Conversely, the music chapter expressly says Stagolee, Railroad Bill and She Asked Me in de Parlor are reprinted in full; their full lyric blocks are admitted, without duplicating score underlay.

Run from the repository root:

```sh
PYTHONDONTWRITEBYTECODE=1 python lyric-harness/imports/gutenberg-next-ten/69378/test_data.py
```

All seven checks pass. Common integration, duplicate decisions, catalogue admission and deployment are owned by the batch integrator.

The exact reviewed containment pair is processed with `69378:line03773` before `69378:line01857`: ordinary deduplication therefore retains the complete 48-line Free Labor Gang Song and its forty additional lines. The separately headed eight-line That Ol’ Letter remains an eligible source unit in the full candidate ledger, preserving its text and coordinates, but is suppressed as a contained duplicate during integration. This is a source-specific processing priority, with no duplicate exception or threshold change.
