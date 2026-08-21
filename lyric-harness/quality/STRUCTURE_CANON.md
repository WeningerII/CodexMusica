# STRUCTURE_CANON.md — a world survey of song-section vocabulary

**Compiled 2026-08-21 from sixteen concurrent per-family surveys, one per
tradition family, each producing rows with a cited source and an attestation
measured against the staged corpus.** Artifact:
`data/structure_canon.tsv`, **623 rows over 15 family labels**. This document
is the reading; the TSV is the data.

**THIS IS A SURVEY AND NOT A VOCABULARY, and the distinction is the whole
point.** `quality/RHYME_CANON.md` is the precedent: a 601-entry world survey
sits beside an engine that ships 49 named types and a mandate door that admits
2. A canon row records that a tradition names a thing. **A vocabulary value is
a claim that this repository can read it.** Nothing here becomes a value until
a text carrying it is staged, which is `CORPUS_LOADING_PROTOCOL.md`'s existing
rule, and the survey is what proves that rule is load-bearing rather than
cautious:

> **495 of 623 rows (79.5%) report ZERO attestation.** Building a section
> vocabulary from this list would create ~495 declared-but-unread values —
> the "declared-but-unread defect in a taxonomy hat" the protocol already
> refuses. Eight terms the owner's list expected (`sèist`, `penillion`,
> `toddaid`, `gwawdodyn`, `takhallus`, `matlaʿ`, `qafiya`, `anuṣṭubh`) occur
> in **0 files**.

**79 rows are `UNCITED`** and say so. That is a feature: an agent that could
not find a reference work wrote `UNCITED` rather than inventing a page number,
and several reported the near-miss instead ("the object is citable, the
compound noun is the surveyor's coinage").

---

## 1. HALF THE LIST IS NOT SECTION VOCABULARY

The single most useful result, and it arrives before any function is assigned.

| layer | rows | what it is |
|---|---:|---|
| **section** | **314** | a named span of a song — the only layer that takes a function |
| form | 107 | a pattern OVER sections (AABA, bar form, twelve-bar) |
| perform | 62 | an artifact a lyric sheet cannot carry (riser, fade, reverb tail) |
| process | 35 | a whole-piece logic with no fixed span boundaries (jo-ha-kyū) |
| phrase | 34 | a unit BELOW a section |
| device | 29 | a sound or repetition device, not a span (radif, epistrophe) |
| boundary | 12 | the JOIN between two sections, not a span |
| meta | 14 | a term ABOUT structure rather than a structure |
| other / unresolved | 16 | including 2 explicitly `out_of_scope` |

**So a "song structure vocabulary" built from a term list would have been
about 50% wrong by construction** — not in its content but in its LAYER. The
per-family share of true sections runs from **8%** (the form-layer batch, as
designed) to **68%** (Chinese/Korean).

**`perform` at 62 rows is the second result.** Those are **permanently
refusable, not missing** — the repo already ships the pattern in executable
form (`quality/fit.py` refuses every groove and microtiming question BY NAME
with `STATUSES = ("SCHEDULED", "PERMANENT")`), and `M-22`/`C-4` are the
precedent for a refusal that is an answer.

---

## 2. THE CLOSED EIGHT ABSORBS 314 TERMS, AND SIX SAY IT DOES NOT FIT

Function assignments over the 314 section rows:

| function | rows |
|---|---:|
| medial | 53 |
| goal | 46 |
| rear_framing | 42 |
| front_framing | 35 |
| initiating | 34 |
| contrasting | 34 |
| instrumental | 34 |
| connective | 17 |

The spread is even, which is the evidence for a GLOBAL closed set: sthayi,
coro, pallavi, estribillo, mukhda, nakarat and chorus all land on `goal`
without argument, from six unrelated traditions.

**EIGHT ROWS CARRY A STRAIN MARKER, and they cluster in two places:**

| term | family | assigned | why it strains |
|---|---|---|---|
| Siubhal · Taorluath · Crunluath · Crunluath a-mach | N/E European | `medial — STRAINS` | pìobaireachd is theme-and-variation: same material at increasing complexity, in a FIXED monotone order |
| Jo · Ha · Kyū | Japanese | `front_framing`/`medial`/`rear_framing` **(lossy)** | phases of an accelerating process, not spans with independent functions |
| Escobilla | Iberian/Mediterranean | `instrumental (strained)` | a danced footwork section; "instrumental" is true and carries no information |

**THE PÌOBAIREACHD CASE NAMES WHAT IS MISSING, and it is not a ninth
function.** `contrasting` is false by definition (the variations do not
contrast, they elaborate), `goal` is false (the piece points back at the
ùrlar), `instrumental` is true of all six sections and therefore carries zero
bits, and `medial` survives only by elimination while implying the four
variations are interchangeable — the opposite of the truth. What the set lacks
is **two fields, not one name**: a POINTER (*elaborates: ùrlar*, where
`contrasts_with` points the wrong way) and a RANK (siubhal < taorluath <
crunluath < a-mach). **`quality/grid.py` models no ordering over sections at
all** — `instances()` keys on a counter explicitly declared not to be a return
count, and `FormConvention` has no `ordered` field.

Two more coordinates were named independently: a **tempo/metre** one (Chinese
banshi and Korean sanjo movements both collapse to `medial`), and a
**delivery-mode** one (pansori's aniri vs chang — spoken vs sung).

---

## 3. THE CONVERGENCES — one object, many names

The `same_object_as` column is where the survey earns its keep. Counting how
often each English/repo anchor is named as the equivalent of a foreign term:

| anchor | named by |
|---|---:|
| chorus | 55 rows |
| verse | 51 |
| bridge | 34 |
| intro | 26 |
| refrain | 24 |
| burden | 21 |
| turnaround | 21 |
| solo | 20 |
| coda | 18 |
| vamp | 17 |

**`bridge` at 34 is the alarming one, not the reassuring one.** It is named
across traditions that mean three different things by it — the pop bridge (a
contrasting departure), the sonata bridge (a modulating connective that
RECURS), and "bridge-passage" (a link). `SECTION_FUNCTIONS["bridge"]` is
declared four ways over as the pop sense. **This is `M-24`'s central evidence**:
a name table with no language coordinate cannot hold all three.

**Two cross-family identities worth recording as findings rather than rows:**
- **The unmetered improvised opening** is one functional object under at least
  four names — Arabic/Turkish *taqsim*, Persian *daramad*, klezmer *doina*,
  flamenco *salida*/*temple*, Hindustani *alap*. All `front_framing`, all
  free-rhythm, all preceding the metred body.
- **Call-and-response** appears in African, Latin American (*pregón*/*coro*),
  gospel and sea-shanty material. **It is not two sections — it is a RELATION
  between two sections**, and the repo cannot declare it: `grid.py` has section
  functions and recurrence contracts but no "this section answers that one"
  edge. The African survey names this as the single highest-value gap in its
  batch, and the Finnish corpus already refuses the same object under
  `MARK_REFUSED["PART"]`.

---

## 4. WHAT THE SURVEY FOUND THAT IS NOT A ROW

Recorded here because a canon document is where a later session looks, and
each of these is filed as its own entry:

- **`M-24`** — the section vocabulary is keyed on a bare token with no
  language coordinate. Three families hit this independently.
- **`M-25`** — 940 one-line `[VERSE]` blocks whose only line is apparatus;
  `ltc_huajianji.txt` declaring a 片 convention it does not implement; the 片
  boundary having one witness that is not the spec.
- **`M-26`** — the variation ladder answers `VERBATIM` to Carnatic *sangati*
  and Hindustani *bol-baant*, whose variation is not in the words.
- **A staging-vs-record finding**: `RESULTS_MARK_COVERAGE.md` lists `solo`
  among 17 unwitnessed functions, and a staged source **prints** `SOLO` as a
  structural label where the stager converted `CHORUS` to a mark and left
  `SOLO` as body text. The blanks in the function table are **partly a loading
  decision, not a fact about the printed record**.

---

## 5. HOW TO USE THIS

1. **Do not create vocabulary values from this file.** A row is a citation.
2. **When a text is staged, its tradition's rows become candidates** — and the
   attestation column tells you which were expected to appear.
3. **The layer column is the first question, not the function.** Half of any
   new term list will not be section vocabulary.
4. **`UNCITED` is a real value.** 79 rows carry it and they are the rows a
   reference-library session should take first.
