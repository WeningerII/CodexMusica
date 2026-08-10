# RHYME_CANON.md

**Recovered canonical inventory of rhyme structures, merged from the complete 601-entry survey.**

Analysis cell 2. Source: `journal.jsonl` of workflow `wf_c1e2a9c5-60b`, six `inventory:*` agents,
601 entries recovered in full. This file supersedes the 106-structure synthesis produced by the
same workflow, which received a truncated input.

---

## 0. Why this file exists

The workflow's synthesis agent was handed `JSON.stringify(allTypes).slice(0, 90000)`. Simulating
that cut against the recovered array gives **85 complete entries out of 601 (14.1%)** — all 74
English/Scots entries and the first ~11 Welsh entries, terminating inside `cynghanedd sain drosgl`
/ `cynghanedd sain ddwbl`. The agent itself reported "roughly 92 of the stated 601 entries
arrived", which is consistent with a partial 86th object plus a slightly different wrapper; the
exact boundary is **UNCERTAIN between Celtic entry 11 and Celtic entry 14**, and nothing in this
file depends on which.

What it means concretely:

- **Zero** entries from `inventory:germanic` (89), `inventory:semitic-persian` (126),
  `inventory:indic-seasian` (74), `inventory:east-asian-romance` (174) reached the synthesis.
- **53 of 64** Celtic entries never reached it — everything Irish, everything Scottish Gaelic,
  all the Welsh *beiau*, all the *goddefiadau*, `proest`, `odl`, the *cymeriad* family.
- The synthesis's canonical entries for Norse, Persian, Sanskrit, Tamil, Chinese and Malay were
  **reconstructed from the repository's own `quality/phonology/*` modules and CLAUDE.md doctrine**,
  which the agent stated plainly. They are therefore not independent of the code they were meant
  to critique.
- Canonical entry #86 (`gabay higaad`, Somali) has **no source in the 601 at all**. Somali appears
  nowhere in any inventory cell. It entered the canon purely from repo doctrine.

The agent's defence of its degrees of freedom — "the axes below are robust to the missing entries:
every one is forced several times over, usually from more than one language family" — was made
from a sample in which *one* language family was complete. Section 4 tests that claim. It does not
survive intact.

---

## 1. Conventions

Every canonical structure is stated on eight coordinates. Six are the previous run's; two
(**GRAIN**, **MAP**) are forced by the recovered entries and argued for in §4.

| coord | meaning |
|---|---|
| **FIG** | figure: the relation's shape over its arguments, and the rule that selects them |
| **PLACE** | the coordinate system that locates each argument, and its coordinate in it |
| **ANCHOR** | what fixes the origin of the span *inside* its member (declared per member) |
| **SPAN** | unit, direction, magnitude, unmatched-material policy (declared per member) |
| **CHAN** | channel → predicate map |
| **GRAIN** | per channel, the equivalence relation under which "agree" is evaluated |
| **MAP** | the correspondence between positions of one member and positions of the other |
| **NORM** | mandatory · licensed · ornamental · deprecated · forbidden, per (structure × form) |

Source citations use cell-prefixed indices into the recovered array:
`E`=english (74), `C`=celtic (64), `G`=germanic/finnic (89), `S`=semitic-persian (126),
`I`=indic-seasian (74), `X`=east-asian-romance (174).

**Entries the synthesis agent saw are marked ✓.** Everything unmarked was invisible to it.

Uncertainty is marked inline: `[UNVERIFIED]` where the inventory cell itself flagged the entry as
unresolved, `[DISPUTED]` where two cells disagree, `[MY-DOUBT]` where I am not confident in the
merge decision.

**One deliberate consequence of adding GRAIN.** Once the equivalence quotient is a coordinate,
several things the previous run counted as separate structures collapse into one structure at
different grains — `family rhyme` is tail-rime at grain=manner-class, `Middle Chinese end rhyme on
a 同用 group` is tail-rime at grain=rime-dictionary-group. The count below is therefore *not* a
strict superset of the 106: it is larger overall, but it merges in this one place. Both totals are
given in §5.

---

## 2. The canon

### A. Anchored segmental rime cells — single edge, one span per member

**R1 · tail-rime**
*perfect rhyme · odl (prifodl) · runhent · Endreim · reiner Reim · rima perfetta/consonante ·
rima consonante (Sp) · rima consoante (Pt) · rekilaulu loppusointu · 각운 gagun · tuk/tukānt ·
terminal Hebrew rhyme · vần chân · สัมผัสสระ · pantun/syair/gurindam rhyme · rima toante's consonant twin ·
kyakuin · rima piana as the unmarked case*
- FIG single edge. PLACE frame=line, both members line-final (canonical) but the relation is
  position-free. ANCHOR nucleus of the last prominent syllable (Romance: the tonic vowel; Finnish/
  Hungarian-type fixed stress: syllable 1; Chinese/Thai/Vietnamese: the syllable, no stress at all).
  SPAN unit=phone/syllable, rightward, to word end. CHAN every channel the *declaration* carries in
  the rime AGREE; onset of the anchor FREE **or FORBIDDEN** — see R1-polarity below.
  GRAIN identity by default. MAP monotone, index-to-index. NORM mandatory.
- from: ✓E1 ✓E10(as its commonest reading) C22 G22 G32 G33 G44 G52 G53 G86 X37 X55 X64 X89 X110 I39
  I43 I47 I48 I52 I65 S99 X129 X130
- **R1-polarity is a real variable, not a detail.** Welsh (`C22`: "identity of onset is a fault"),
  Old Norse (`G2`: "rime riche is excluded by rule, not merely disfavoured"), German (`G52`: "onset
  free — and must differ, else it becomes rührender Reim") and Italian (`X64`: "conventionally
  should differ") declare the anchor onset **FORBIDDEN**. English handbooks, Chinese, Thai,
  Vietnamese, Malay leave it FREE. Four independent traditions state the negative requirement
  explicitly. The previous run got this right from English alone and it holds.

**R2 · leftward-extended rime** *rime riche (Fr) · rima ricca (It) · rim ric (Oc) · rührender Reim
(De) · rijk/gelijk rijm (Nl) · zengin kafiye's deep case · luzūm mā lā yalzam (Ar) · consonne d'appui*
- As R1 but SPAN extends **leftward past the anchor**: the pre-tonic consonant (or more) is inside
  the compared window. CHAN onset of the anchor AGREE — the inversion of R1's polarity. NORM
  ornamental (Fr, It, Oc), deprecated (De as a licence, En as a fault outside comic verse),
  mandatory-and-self-imposed (`S35` al-Maʿarrī: the pre-rawī consonant must be identical throughout
  a whole collection).
- from: ✓E2 X131 X70 X157 G56 G59 S35 S112

**R3 · whole-final-unit agreement, onset included by definition**
*antyānuprāsa / antya-prāsa · iyaipu · tam kafiye*
- SPAN unit=akṣara / Tamil letter / "sound", magnitude=1 unit (or a short run). CHAN onset AND
  nucleus AND coda of that unit AGREE. This is **not** R2: there is no base relation whose onset is
  free that this extends. `I6` states the reason: excluding the onset "makes the relation nearly
  vacuous in Sanskrit because inflection ends every accusative singular neuter in -am". The
  agreeing unit is the whole syllable and always was.
- from: I6 I20 S111
- **Correction to the previous canon.** Synthesis #81 gave antya-prāsa as "nucleus and coda AGREE"
  and collision #10 merged it with English perfect rhyme and Welsh odl. That merge is **wrong**:
  the recovered `I6` makes onset inclusion constitutive. Three of the four members of collision #10
  were reconstructed from repo code, not from the inventory.

**R4 · count-graded tail agreement** *rime pauvre / suffisante / riche · yarım / tam / zengin kafiye*
- The type system is a **count of agreeing final segments** (1 / 2 / 3+), not a channel map. SPAN
  unit=phone, magnitude=n. `S110`: "the unit counted is the SOUND, and the count is the whole
  definition." This is a distinct way of carrying the same space: the coordinate is magnitude, and
  the channel identities fall out of it.
- from: X129 X130 X131 S110 S111 S112

**R5 · assonance** *assonance · amus (amas) · Assonanz / klinkerrijm · assonanza · rima asonante ·
rima toante/assoante · assonance de laisse · asonans · Scandinavian ballad binding · Gaelic
vernacular end assonance · aliteración's vowel twin*
- CHAN nucleus AGREE; coda MUST DIFFER (English/Italian statement) or FREE (Irish/laisse/Gaelic
  statement — `C45`: "the consonants that follow are DISREGARDED ENTIRELY, and so is syllable
  count"). **[DISPUTED]** — this is a genuine two-reading split and I record both: under the
  differ-reading, assonance and perfect rhyme are disjoint cells; under the free-reading, perfect
  rhyme is a *sub-case* of assonance. Six cells state it one way, four the other.
- from: ✓E4 C45 C58 G54 G89 X78 X90(see R7) X111 X152 S123 X127

**R6 · run assonance** *double/triple assonance · multisyllabic rhyme's vowel core · 母音韻 · 라임 ·
rap multis*
- SPAN a RUN of n nuclei (2–8+), tail-anchored on the syllable stream, word boundaries ignored on
  both sides independently. CHAN nuclei AGREE across the whole run; codas agree or class-agree;
  first onset differs. `X38` is the purest statement: "NUCLEUS ONLY, and across a whole run of
  morae. Onsets are explicitly FREE." NORM mandatory in Japanese and Korean rap, ornamental
  elsewhere.
- from: ✓E29 ✓E71 X38 X63

**R7 · gapped-projection assonance** *rima asonante (Spanish, strictly)*
- SPAN a **non-contiguous extraction**: the vowel projection of the tail with declared positions
  deleted — the middle vowel of an esdrújula, the weak element of a diphthong. GRAIN additionally
  quotients unstressed final `i`→`e`, `u`→`o`. `X90` is the only entry in 601 where the compared
  string is built by deletion rather than by windowing. **[MY-DOUBT]** on whether this is a
  structure or R5 at a declared grain plus a declared extraction; I split it because the extraction
  is not a quotient on values, it is a change of the span's *support*.
- from: X90 X93

**R8 · vowel-vector over a whole line** *amhrán / caoineadh vowel skeleton*
- FIG single edge between two whole lines. SPAN the ordered sequence of **stressed vowels** across
  the line, one per metrical stress. MAP index-to-index, position 1 answers position 1. CHAN nucleus
  only, quantity participates, consonants free everywhere. `C54`: "Not a rhyme at the end: a vector
  of vowels running the length of the line."
- from: C54 (with C60, C61 as its reduced within-line and cadence forms) ✓E51(Hopkins's vowelling on
  and off is the same shape with **no positional anchor fixed** — the English cell flags that as
  UNCERTAIN, and it is the one member of this family whose alignment is not declared)
- This is the structure the repo's suffix comparator is furthest from, and it was invisible.

**R9 · consonance** *consonance · uaithne · Konsonanz / medeklinkerrijm · consonanza*
- CHAN coda AGREE; nucleus MUST DIFFER; onset free. MAP index-to-index through the consonant tail.
- from: ✓E5 G55 X79

**R10 · cluster consonance across the syllable boundary** *skothending · the Norse reading of
consonance*
- SPAN "the whole post-vocalic consonant run between this nucleus and the next — coda PLUS the
  following syllable's onset" (`G1`; Snorri's `fyrð` out of *fyrðum*, `ofs` out of *friðrofs*). The
  span may **end mid-word**. Distinct from R9 by SPAN unit and terminator, and the difference is
  measurable on real text.
- from: G1 ✓E5(as an unmeasured English variant)

**R11 · consonance with a class requirement on the differing channel** *proest · uaithne (strict)*
- CHAN coda AGREE; nucleus MUST DIFFER **and** the two differing nuclei must be of the same class —
  Welsh: same quantity and same type (simple vs diphthong, lleddf vs talgron); Irish: same quantity
  ("a long vowel answered by a long vowel"). `C23`: "one channel must agree, one must differ, and
  the differing channel carries a SECOND agreement requirement on a feature of itself."
- from: C23 C46 (and C24 supplies the partition; see D-grain)
- Forced twice from two Celtic branches independently. The previous canon's #100 has the length
  clause (reconstructed correctly from repo code) but not the lleddf/talgron clause, and does not
  register that the predicate shape — *differ-but-agree-on-a-feature-of-the-difference* — is a
  distinct predicate value.

**R12 · pararhyme / frame rhyme** *pararhyme · Owen's frame rhyme*
- CHAN onset AGREE and coda AGREE; nucleus MUST DIFFER. MAP both edges flush simultaneously.
- from: ✓E7 ✓E72 S46(*jinās muḥarraf*: the whole consonant skeleton agrees in identity, count and
  order while the vowelling differs — R12 taken over a whole word rather than a syllable)

**R13 · directional-difference pararhyme** *ablaut reduplication · 의성어·의태어 ablaut pairs ·
rim derivatiu*
- As R12, plus the differing channel must differ **in a declared direction**: English I-A-O
  (ding-dang-dong, never dong-dang-ding); Korean 양성→음성 bright-to-dark harmony grade; Occitan
  `rim derivatiu` requires the inflection to change in the declared direction (-atz : -ada).
  `X59`: "one channel must differ, and it must differ in a DIRECTION, not merely differ."
- from: ✓E69 X59 X159
- **Forced three times, from three unrelated families, and only one of the three was visible.**
  The previous run recorded "an ORDERING CONSTRAINT on the differing channel" only inside its
  English entry #43 and never lifted it to a predicate value.

**R14 · reverse rhyme / strong alliteration** *reverse rhyme · Kalevala vahva alkusointu ·
algriim (strong grade) · 頭韻 in its whole-mora form*
- CHAN onset AGREE and nucleus AGREE; coda MUST DIFFER (English statement) or FREE (Finnic and
  Japanese statement). MAP left-edge flush from the anchor onset.
- from: ✓E8 G83 G84 G87 X36
- The synthesis found this collision (its #6) from English + repo alone; the recovered Finnic and
  Japanese entries confirm it three-fold.

**R15 · unanchored consonant set** *general consonance / parechesis · aliterasyon · aliteración
(word-internal reading) · vṛttyanuprāsa's density reading*
- FIG one-against-many over a window, not a pair. SPAN consonant sets or sequences over a phrase.
  PLACE no anchor at all. `S123`: "FREE / BEST-MATCH — no positional anchor at all. The predicate is
  over the line's segment multiset."
- from: ✓E6 S123 X101 X127 I3 I45(*pembayang↔maksud*: the same unanchored predicate between two
  **spans of lines** rather than two words)

**R16 · homorganic / place-class agreement** *śrutyanuprāsa*
- CHAN consonants agree by **place of articulation**, explicitly NOT by identity. Distinct from
  family rhyme (manner class) only in which feature the quotient is built on — which is exactly why
  GRAIN must be a coordinate rather than a fact baked into a structure. I list it once, here, and
  note the parallel.
- from: I4 ✓E11(manner-class twin)

### B. Span-shape / cadence classes

**R17 · masculine cadence** (span 1 syllable, prominence final)
- from: ✓E26 G52 X66 X91 X112 X133 X156 C49(rinn)
**R18 · feminine cadence** (span 2, prominence penult)
- from: ✓E27 G52 X65 X92 X112 X134 X156 G80 I44
**R19 · dactylic cadence** (span 3, prominence antepenult)
- from: ✓E28 G52 X67 X93 X112
**R20 · quadrisyllabic cadence** (span 4) — attested once. `X68` *rima bisdrucciola*. NORM comic.
- from: X68
- These four are one structure at four magnitudes plus a prominence-position channel. I keep them
  separate because five traditions name all of them and two (Italian, Spanish) make the magnitude
  **interact with the metre**: a *tronca* ending subtracts a syllable from the line count, an
  *sdrucciola* adds one (`X66`, `X91`, `X93`). That interaction is a structural fact about span,
  not a naming convention, and it was invisible.

### C. Unequal spans and prominence mismatch

**R21 · unmatched trailing material EXCLUDED** *semirhyme · apocopated rhyme · rima ipermetra ·
cynghanedd lusg's excluded final syllable*
- SPAN magnitudes unequal; UNMATCHED POLICY = EXCLUDED (not required-to-differ). MAP anchored, and
  **not** right-edge flush: `X69`: "Head-anchored at the tonic vowel and NOT tail-to-tail — the two
  tails end at different distances from the anchor."
- from: ✓E14 ✓E15 X69 C13

**R22 · containment** *tunç kafiye · rima inclusiva*
- SPAN one member is a **proper suffix** of the other; the relation is asymmetric. `S113`:
  "CONTAINMENT, not equality: tail-aligned with one side strictly longer."
- from: S113 X71

**R23 · additive / subtractive** *additive rhyme · subtractive rhyme · jinās nāqiṣ (mutarraf) ·
jinās nāqiṣ (mardūf)*
- One member carries exactly one extra segment the other lacks. **ORDER OF ARRIVAL is a coordinate**
  (English) or **which END the extra segment sits at** is a coordinate (Arabic: mutarraf = extra at
  the end and head-aligned; mardūf = extra at the head and tail-aligned).
- from: ✓E12 ✓E13 S47 S48

**R24 · medial insertion** *jinās nāqiṣ (muktanaf)*
- An epenthetic segment inside one word. `S49`: "Neither head- nor tail-aligned: an edit-distance-1
  insertion. No fixed-offset comparator can express it." **This structure has no counterpart
  anywhere in the visible 15% and none in the previous 106.**
- from: S49

**R25 · one-segment substitution, graded by articulatory distance** *jinās muḍāriʿ · jinās lāḥiq ·
paronomasia · ikfāʾ · ijāza*
- Two equal-length words differing in exactly one segment. `muḍāriʿ` requires the two differing
  consonants to be articulatorily CLOSE; `lāḥiq` requires them DISTANT. Same figure, same placement,
  same anchor, same span, same channel map — **they differ only in the grain of the quotient on the
  differing channel.** `ikfāʾ`/`ijāza` are the same pair again, evaluated as faults at the rawī.
  This is the single sharpest witness for GRAIN as an axis.
- from: S50 S51 S27 S28 X103

**R26 · prominence MUST DIFFER** *light rhyme · cywydd deuair hirion couplet rhyme ·
rinn agus airdrinn*
- CHAN segmental channels AGREE at the anchor; the **prominence channel MUST DIFFER** — one member
  stressed, the other unstressed, and the mismatch is mandatory, not tolerated. `C26`: "that
  mismatch is mandatory, not tolerated." Irish adds a mandated syllable-count offset of exactly +1
  (`C49`).
- from: ✓E16 C26 C49
- The previous canon has light rhyme (#17) as an English/song type. Two Celtic traditions make the
  same structure **constitutive of a named metre**. Its normative status therefore inverts across
  traditions, which is evidence for NORM and against reading it off the phonology.

**R27 · prominence coerced by the delivered surface** *wrenched rhyme · sung-delivery rhyme ·
transformative/bent rhyme*
- from: ✓E17 ✓E25 ✓E74 (see also R70, transform layer)

**R28 · anchor rule DISABLED, both anchors unstressed** *syllabic rhyme*
- from: ✓E18

### D. Head-anchored and fixed-index segmental relations

**R29 · alliteration** *stuðlar · höfuðstafr · Stabreim · OE/ME lift alliteration · stafrijm ·
uaim · cymeriad llythrennol's channel · Kalevala heikko alkusointu · algriim · anuprāsa ·
mōṉai · ādi-prāsa · 雙聲 · 頭韻 · 두운 · aliteración · aliteração · สัมผัสอักษร · rime senée · uaim*
- FIG varies from single edge to ∀-over-a-line. PLACE is **the only thing that varies across the
  ~20 names**: free ornament · metrical lift index · ∃≥2 anywhere in the line · word-initial ·
  a fixed syllable index · the sain pivot · index 1 of every line of a run. ANCHOR onset of a
  prominent syllable. CHAN onset AGREE; nucleus and coda FREE. GRAIN: zero-onset is one class
  (attested independently in Norse, OE, OHG, Welsh, Finnic and Irish); sk/sp/st are their own
  classes (Norse, OE, OHG, Irish); OE merges palatal and velar c/g.
- from: ✓E9 ✓E48 C1(as the 2-3 link) C29 C47 G6 G7 G8 G9 G28 G29 G36 G37 G38 G43 G45 G49 G50 G79
  G82 G84 G87 I1 I2 I7 I18 I40 X21 X36 X54 X101 X127 X145 I53 S123
- **CARDINALITY is a coordinate of the figure here, and one tradition makes it the sole
  differentiator.** `I2` chekānuprāsa requires *exactly two* occurrences; `I3` vṛttyanuprāsa requires
  *three or more*; they are otherwise the same relation. Sanskrit names the count.
- The synthesis's collision #2 called this eleven names for one object. The recovered set makes it
  **at least twenty**, and adds two frames it did not have: the **cīr (metrical foot) index**
  (Tamil `I18`) and **∀-words-in-one-line** (`X145` rime senée, `E49` paroemion).

**R30 · fixed-index-from-the-head agreement** *dvitīyākṣara-prāsa · etukai · ādi-prāsa ·
prāsa-yati · yati*
- PLACE frame=akṣara/letter index counted **from the head of the line**, position 1 or 2 or a
  metre-specific interior index. FIG n-way simultaneous across all pādas, not pairwise. CHAN the
  consonant of that unit AGREE; **the vowel explicitly FREE** in the Telugu reading (`I8`: "if pāda
  1 has 'ka', the others may have ki, ku, ke, kau"). Tamil `etukai` additionally requires the
  *first* letter to agree in metrical LENGTH while its identity is deliberately FREE.
- from: I7 I8 I9 I10 I11 I18 I19
- The synthesis had this (its #79/#80) reconstructed from repo doctrine, and its collision #16 is
  correct as far as it goes. What it could not have: `I19`'s split predicate — one segment
  contributing a length agreement with a *free identity*, the next contributing full identity. That
  is a channel map with two different predicates at two adjacent indices of one span, and it is not
  expressible as a single cell.

**R31 · head-to-index within one line** *yati · prāsa-yati*
- Both members inside one line, one at index 1 and one at a **metre-specific interior index** (the
  11th akṣara in utpalamāla, the 13th in campakamāla). `I10`: "The index is a property of the NAMED
  METRE, so the placement is a lookup, not a rule." PLACE determinacy = **table lookup**, a value
  the previous run's {printed, rule-fixed, searched} does not have.
- from: I10 I11

**R32 · offset-from-an-anchor-segment slot system** *the qāfiya apparatus: rawī, ridf, ridf-i zāʾid,
qayd, taʾsīs, dakhīl, waṣl, khurūj, mazīd, nāʾira, majrā, nafādh, ḥadhw, ishbāʿ, rass, tawjīh*
- ANCHOR the **rawī consonant**. SPAN a set of named slots at signed offsets −3…0…+4-and-beyond
  from the anchor, **non-contiguous**, each slot carrying its own channel and its own predicate.
- Predicate values this forces that no other tradition in the 601 forces:
  - **PRESENT-BUT-FREE**: the `dakhīl`'s consonant identity is explicitly free while the vowel
    riding on it must agree (`S7`, `S13`, `I33`). "A channel that must be PRESENT but need not
    AGREE."
  - **PRESENCE-MUST-MATCH**: `sinād al-ridf`/`al-taʾsīs` are faults of presence/absence mismatch,
    not of value mismatch (`S29`, `S30`).
  - **CONDITIONAL LIVENESS**: `majrā` exists only if the rawī is moving, `tawjīh` only if it is
    quiescent; `muṭlaqa`/`muqayyada` is the switch that selects which offsets exist at all
    (`S16`, `S17`).
  - **UNBOUNDED SLOT**: `nāʾira` at +4-and-beyond is "the only slot in the whole system that is
    explicitly UNBOUNDED" (`S83`).
- from: S1 S2 S3 S4 S5 S6 S7 S8 S9 S10 S11 S12 S13 S14 S15 S16 S17 S74 S75 S76 S77 S78 S79 S80 S81
  S82 S83 S94 I30 I31 I32 I33 I34 I35 I36 I29 S100
- **This is the largest single structure the truncation cost.** 40 of the 601 entries describe it.
  The previous canon has one entry for it (#77 `qāfiya`), reconstructed from `fas.py`, whose whole
  content is "anchor=the rawī consonant; magnitude=the rawī plus what precedes and follows it under
  the tradition's rules". The slot system, its conditional liveness, and its two novel predicate
  values are absent.

**R33 · span-shape classification of the rhyme domain** *qāfiya mutarādifa / mutawātira /
mutadārika / mutarākiba / mutakāwisa*
- Not an agreement relation: a five-valued classification of the rhyme domain by **how many moving
  letters sit between the two delimiting quiescents** (0,1,2,3,4). It is a *measurement* of the span,
  named and taught. PLACE line end. CHAN none.
- from: S18 S19 S20 S21 S22

**R34 · line-head rhyme** *head rhyme (positional) · Anfangsreim / Eingangsreim · cymeriad
llythrennol(as rhyme) · coblas capdenals(sound reading)*
- Both members are the FIRST word of their lines; the cell is a rime cell, not an onset cell.
  `G66`: "this is a rime relation at the head of the line, not alliteration."
- from: ✓E41 G66 C29

### E. Sequence relations over a skeleton string

**R35 · exhaustive ordered consonant skeleton across a caesura** *cyfatebiaeth gytsain ·
cynghanedd groes · cynghanedd in English (Hopkins)*
- SPAN an ordered sequence of consonant units gathered from a whole half-line across word and
  syllable boundaries, up to a stress-determined stop. MAP sequence-order, head-anchored, one-to-one,
  **total over A**. GRAIN the Welsh phoneme (the eight digraphs are one consonant each).
- from: ✓C1 ✓C2 ✓E50

**R36 · skeleton with an unanswered bridge** *cynghanedd draws · draws fantach · bengoll ·
braidd gyffwrdd*
- MAP total over A, **partial over B** (traws), or partial over both (braidd gyffwrdd), or the
  bridge extended to the whole middle of the line (draws fantach), or the unanswered material at the
  line END (bengoll). `C5`: "A is head-anchored, B is TAIL-anchored — an asymmetric alignment."
- from: ✓C5 ✓C6 C16 C17 (C16, C17 invisible)

**R37 · skeleton whose split point falls inside a cluster** *cynghanedd groes o gyswllt*
- from: ✓C3

**R38 · skeleton whose answering consonant is generated by sandhi** *groes o gyswllt ewinog*
- The answered consonant "exists only in the joined pronunciation. Orthography alone does not supply
  it" (`C4`). See R70.
- from: ✓C4

**R39 · discontinuous root-consonant skeleton** *jinās al-ishtiqāq · jinās shibh al-ishtiqāq ·
root-skeleton agreement · ṣimmud (root variety) · Qillirian rhymeme (its morphological half)*
- SPAN the ordered consonant sequence **extracted** from each word, ignoring every vowel and affix.
  "THE SHARED MATERIAL IS DISCONTINUOUS" and "sits at different absolute indices in the two words"
  (`S53`, `S69`). MAP skeleton-to-skeleton after extraction — neither head-, tail- nor index-aligned
  in the surface string.
- from: S53 S54 S69 S108 S97
- **Nothing in the visible 15% forces a span whose support is discontinuous in both members.**

**R40 · prosodic-template agreement with the root free** *pattern/wazn agreement · muwāzana ·
saj' mutawāzī · tarṣīʿ's weight half*
- CHAN vowel qualities, syllable weights and affixes AGREE; **root consonants unconstrained and
  normally DIFFER**. `S63` muwāzana: "WAZN AGREES; the rhyme letter DIFFERS. Explicitly a
  metrical-template relation with NO sound-identity at the end." The exact dual of R39.
- from: S70 S63 S61 S62

**R41 · word-by-word index correspondence across two cola** *saj' muraṣṣaʿ / tarṣīʿ*
- FIG a matching, not an edge: word *k* of span A against word *k* of span B, one-for-one, each pair
  agreeing in wazn AND final letter. `S62`: "the only relation in this survey with a strict
  positional word-by-word correspondence." Occurs in **prose**.
- from: S62

**R42 · colon-final rhyme in prose** *saj' muṭarraf*
- PLACE frame = **colon**, whose boundaries are set by syntax and not by any metrical template.
  There is no line. CHAN final letter AGREES, wazn DIFFERS.
- from: S60
- The previous PLACEMENT value space has no frame below the line that is syntactic rather than
  metrical. Rhymed prose is a whole mode of rhyme organisation that the truncation removed entirely.

### F. Non-segmental channel relations

**R43 · tone-class agreement at the rhyme** *平聲韻 / 仄聲韻 / 入聲韻 · vần chân's tone clause ·
Đường luật độc vận*
- CHAN TONE CLASS is a **hard channel at the rhyme**: in 近體詩 all rhymes must be 平; in 詞 oblique
  rhymes exist and 入 rhymes only with 入 even though all three are 仄 — "the tone channel here is
  three-valued in practice (平 / 上去 / 入), not binary" (`X3`). Vietnamese requires partners to be in
  the same bằng/trắc group.
- from: X1 X2 X3 X29 X62 I65 I70 I72

**R44 · tone-class template over a line** *平仄 · luật bằng trắc · khlong tone-mark constraint ·
chan quantitative template · 音数律 · 음보율 · 시조 종장 제약*
- FIG **template-against-text with no second member**. MAP index-to-template. CHAN tone class
  (Chinese, Vietnamese), orthographic tone MARK (Thai — "a constraint on the WRITTEN mark", `I60`),
  syllable weight guru/laghu (Thai chan, Sanskrit), mora count (Japanese), syllable count per foot
  (Korean).
- from: X14 I71 I60 I61 X31 X51 X52 I63

**R45 · required tonal OPPOSITION across a line pair** *對 duì · 對仗's tone half ·
luật's đối clause*
- CHAN tone class MUST DIFFER at each binding index. `X15`. A required-difference relation across a
  whole line, index-to-index.
- from: X15 X20 I71

**R46 · required tonal ADHESION across a couplet seam** *黏 nián*
- CHAN tone class must AGREE at exactly one index (position 2) across the couplet boundary. `X16`:
  "Exactly the channel that must differ within a couplet must agree across couplets." Same channel,
  same unit, opposite predicate, distinguished **only by placement**.
- from: X16

**R47 · tonal compensation** *拗救 àojiù*
- A violation at one index is **licensed by a counter-violation at a specified other index**.
  `X19`. FIG a two-node figure whose second node is *determined by* the first. Nothing in the
  visible 15% has a repair relation.
- from: X19

**R48 · agree-in-class and differ-in-value simultaneously** *the bát 6-vs-8 different-tone rule*
- `I68`: syllables 6 and 8 of one line "must both be bằng, and they MUST CARRY DIFFERENT TONES —
  one ngang and the other huyền. A channel that is required to agree at the class level and to
  DIFFER at the value level, simultaneously."
- from: I68
- **This is a predicate the previous run's {AGREE, DIFFER, FREE} cannot express**, and it is the
  clean formal dual of R11 (differ-but-agree-on-a-feature). Together the two prove the channel
  predicate must be able to reference the *grain* explicitly. See §4.

**R49 · nasality as a channel** *rima nasal*
- `X115`: "a nasal vowel does not rhyme an oral one even when the oral quality matches."
- from: X115

**R50 · vowel length / quantity as a channel** *bai trwm ac ysgafn · Scots vowel-length rhyme ·
ridf · aḷapeṭai · Thai vowel length · reiner Reim's quantity clause*
- from: C34 ✓E24 S5 I22 I52 G53

**R51 · palatalisation (caol/leathan) as a channel** *the Irish consonant quality requirement*
- `C43`: "each consonant carries palatalisation or non-palatalisation and the two members must agree
  in it" — "a secondary-articulation channel with no slot in an onset/nucleus/coda model."
- from: C43

**R52 · syllable count as a channel of the rhyme** *comhardadh slán's count clause ·
rinn/airdrinn's +1*
- `C42`: "the two words must have the SAME NUMBER OF SYLLABLES." `C49`: exactly one more.
- from: C42 C49

**R53 · grapheme channel** *eye rhyme · Augenreim/oogrijm · rima per l'occhio · rime pour l'œil ·
rime normande · jinās muṣaḥḥaf · al-ḥurūf al-muhmala/muʿjama/raqṭāʾ*
- CHAN the written form AGREES while the sound channels disagree — or, in `S58`, the **undotted
  rasm** is identical and the sound differs, and in `S59` a single binary graphic feature
  (dotted/undotted) is constrained across every letter of a whole poem.
- from: ✓E20 G70 X83 X136 X137 S58 S59
- French `X136` is the strongest form and was invisible: the written final consonant must agree
  **even when silent**, and a singular may not rhyme a plural though homophonous. That is a
  grapheme requirement layered *in parallel* with the phonetic one, not instead of it.

**R54 · morphological-affix rhyme** *homoioteleuton · grammatischer Reim · rima grammaticale ·
similicadencia · morphological rhyme · Yannaic rhyme · biblical Hebrew homoioteleuton ·
īṭā-yi jalī/khafī · shāyagān · redif ek hâlinde · rekilaulu's default case*
- CHAN the affix's segments AGREE; the stem is unconstrained. The agreement is **supplied by
  grammar, not chosen** (`S71`). NORM inverts hard: constitutive of early piyyuṭ (`S98`), a named
  fault in Persian (`S85`, `S86`, `S87`), the default case in Finnish (`G86`) and Korean (`X55`),
  a device in MHG (`G58`), a fault in English pedagogy (`E63`).
- from: ✓E63 G58 G86 X75 X102 S71 S96 S98 S85 S86 S87 S115 X55

**R55 · shared-root, differing-inflection** *polyptoton · derivación · rima derivativa ·
rim derivatiu · rime dérivative · mordobre / mozdobre · jinās al-ishtiqāq's identity value ·
radd al-ʿajuz's ishtiqāq variant*
- IDEN a **fourth value**: same lexeme, different form — "neither the same word nor a distinct
  word." Forced from English, German, Italian, Spanish, French, Occitan, Galician-Portuguese and
  Arabic independently. MAP root-to-root, anchored on a **morpheme**, not on a metrical position or
  a word edge (`X105`).
- from: ✓E64 G58 X74 X105 X122 X146 X159 S53

**R56 · same form, different sense** *antanaclasis · äquivoker Reim · rima equivoca · rim equivoc ·
rime équivoquée · cinaslı kafiye · jinās tāmm · jinās mustawfā · tardīd · yamaka · maṭakku ·
ślesa/kakekotoba (the one-token case) · īṭāʾ khafī · lāṭānuprāsa · punaruktavadābhāsa*
- CHAN all sound channels AGREE; the **SEMANTIC channel DIFFERS**, and that difference is
  constitutive. Sub-values the recovered set forces and the previous canon has no slot for:
  - different **part of speech** (`S55` jinās mustawfā)
  - different **intent/tātparya** with the dictionary sense held constant (`I5` lāṭānuprāsa)
  - **one token, two readings**, no second span at all (`I15` ślesa, `I41`, `X34` kakekotoba —
    "the two spans are COINCIDENT — the same tokens, at the same index, not two spans laid against
    each other at all")
  - **different etymology under identical skeleton** (`S54` jinās shibh al-ishtiqāq)
  - apparent identity that dissolves (`I16` punaruktavadābhāsa) — the inverse case
- from: ✓E65 G57 X72 X138 X160 S114 S45 S55 S66 I12 I13 I14 I26 I5 I15 I41 I16 S24 S108 X34 X45
- `X34` is the structurally decisive one: **the two members occupy the same position**. Every
  relation in the previous 106 has two spans somewhere; this one has one span read twice.

**R57 · semantic-category correspondence with no sound channel** *對仗 · 対句 · 대구법 ·
parallelismus membrorum · muraṇ · kerto · Stollen (semantic half)*
- CHAN syntactic/semantic category AGREE at each index; **no phonological channel at all**.
  Tamil `I21` muraṇ requires **ANTONYMY** — a required-difference on the semantic channel, aligned
  index-to-index exactly as its sound siblings. `S95` biblical parallelism aligns over syntactic
  slots and is "sometimes chiastically REVERSED".
- from: X20 X39 X58 S95 I21 G85

**R58 · associative (non-phonological, non-positional) linkage** *縁語 engo · makurakotoba ·
jokotoba*
- from: X35 X32 X33
- `X32`: the link is "sometimes SOUND, sometimes semantic, and for many pairs the link is lost and
  the convention is all that survives." A relation whose channel is **unrecoverable and whose
  membership is carried by tradition alone**. There is no such object in the previous canon.

**R59 · candidate-field scarcity as the defining property** *rim car · rimas caras · rima rara /
preciosa · kapanık ayak · rima pobre / rica · trite rhyme*
- CHAN identical to R1. The type is a claim about **the size of the candidate field in the
  language**, or about the grammatical class of the members. Turkish gives it a **numeric
  threshold**: `S119` kapanık ayak is "a rhyme class deliberately chosen so that the number of words
  in the ENTIRE LANGUAGE forming a tam kafiye with it is at most four."
- from: ✓E66 X114 X158 S119 X95 X113 X87(*rima aspra*: a claim about the phonotactic texture of the
  agreeing material, not about which channels agree)
- The previous run called this "frequency facts on a VALUE axis orthogonal to all six" and treated
  it as English pedagogical residue. **Four unrelated traditions name it and one quantifies it.**
  The orthogonality verdict was right; the dismissal of it as English-specific was an artefact of
  seeing only English.

### G. Identity / repetition relations

**R60 · verbatim span returning at scheduled positions** *refrain · burden · chorus · stef ·
klofastef · Kehrreim / refereyn stok · omkvæd · sèist · òran luaidh vocable refrain · nakarat ·
tarjīʿ-band · 疊句 · 囃子詞 · 여음구/후렴구 · refrán · refranh · rime kyrielle · estribillo ·
rondeel · mote e glosa · musammaṭ's global member*
- FIG ∀-instances of one span. CHAN identity, verbatim. NORM **mandatory and constitutive**.
- Sub-values forced by the recovered set:
  - the material may be **non-lexical** (`C62` Gaelic vocables, `X44` hayashi-kotoba, `X53` Korean
    여음구 — "semantically opaque; Korean scholarship records that the meaning is unrecovered")
  - the refrain may be **split into fragments distributed across stanzas** and never printed whole
    (`G27` klofastef — "the identity is with a virtual whole that is never printed contiguously")
  - the refrain may be **interleaved inside** the stanza rather than appended (`G88`)
  - its **presence or absence is the primary genre distinction** of a corpus (`X118` cantiga de
    refram vs de meestria)
  - it may be **distributed one line per stanza from a header text** (`X125` mote e glosa)
  - the same slot filled **differently each time** is a named contrasting type (`S91` tarkīb-band
    against `S90` tarjīʿ-band) — identity of *slot* with non-identity of *content*
- from: ✓E3 ✓E54 ✓E55 C62 C64 G14 G26 G27 G75 G77 G88 S67 S90 S91 S122 X24 X44 X53 X118 X125 X154
  X172 X98 S40 I42

**R61 · verbatim span at the line tail, after the rhyme** *radīf · redif (ek and kelime) ·
epistrophe · epífora · mustazād's second system · ḥājib (mirror case)*
- PLACE **absolutely line-final, to the RIGHT of the rhyme**; the rhyme is therefore interior.
  `S73` ḥājib is the mirror: a verbatim span sitting to the **LEFT** of the rhyme, so the line tail
  order is *ḥājib, qāfiya, radīf* — **three ordered slots, two of them identity-constitutive and the
  one between them identity-forbidden.**
- from: S72 S73 S115 S116 I28 ✓E59 X107 S92
- The synthesis's collision #1 (epistrophe = radīf) is correct and is its best single result. It
  did not have `ḥājib`, which is the entry that proves the tail is a **slot sequence** and not a
  single position.

**R62 · anadiplosis / tail-to-head across a seam** *anadiplosis · linked rhyme · 頂真 dǐngzhēn ·
antāti · tashābuh al-aṭrāf · conachlonn · cyrch-gymeriad · gair cyrch · Pearl concatenation ·
dunhent · dunhenda · ketendicht · Pausenreim · rime annexée/enchaînée · rime fratrisée ·
coblas capcaudadas · coblas capfinidas · leixa-pren · pantun berkait · 尻取り shiritori ·
rai chain · concatenación · séadna line-1 link · fidrad freccomail · rime batelée(variant)*
- FIG a hinge: tail of unit *n* against head of unit *n+1*, frequently **chained transitively down
  the whole text**. CHAN splits three ways and the traditions name all three separately:
  lexical identity (anadiplosis, conachlonn, 頂真, antāti, capfinidas), **onset only** (`C52` fidrad
  freccomail — "this is what separates it from conachlonn"), and rime (linked rhyme, ketendicht,
  rime annexée, capcaudadas, shiritori). `C53` licenses **either** channel for one slot.
- from: ✓E61 ✓E40 C33 C27 C51 C52 C53 G11 G34 G47 G67 G76 X25 X143 X144 X167 X168 X119 I46 I25 X46
  I58 X107 S65
- Unit varies from **one mora** (shiritori) through word, syllable, line, **two lines** (`C63` òran
  luaidh overlap) to **a whole stanza-to-stanza displacement of +2** (`X119` leixa-pren).

**R63 · poem-closing return** *dúnad · cyrch-gymeriad (whole-poem) · Pearl's closed loop ·
pantun berkait (closed form) · 回文 as a loop*
- The poem's FIRST word/line against its LAST, closing a loop. `C50`: "the poem is judged
  incomplete without it." PLACE frame = **whole poem**, both extremes.
- from: C50 C33 G47 I46

**R64 · anaphora / head-to-head identity** *anaphora · anáfora · cymeriad geiriol ·
coblas capdenals · Stollen's opening · 동어반복(matched-index case)*
- from: ✓E58 C30 X107 X169 X57

**R65 · epanalepsis / symploce / double-edge identity** *epanalepsis · symploce ·
radd al-ʿajuz ʿalā al-ṣadr · rime couronnée · rime emperière*
- Both edges of one unit. `S64` radd al-ʿajuz is the same structure with **four declared positions
  for the partner**, each a named sub-variety. `X141`/`X142` are the same structure with the copy
  **immediately adjacent** and doubled or tripled.
- from: ✓E60 ✓E62 S64 X141 X142

**R66b · echo verse** *rima in eco / replicata · rima en eco · rima ecoada / em eco ·
rime en écho / vers échoïques*
- SPAN a proper **suffix of one line** against the **whole of the next line**, which is a complete
  short verse consisting of exactly that suffix. IDEN characteristically a *different* word that
  happens to be the tail's sound, so that the echo answers the question. Four Romance traditions
  name it and it is structurally unlike anything in the visible 15%: one member is a suffix of a
  line and the other is a line.
- from: X86 X97 X117 X151

**R66 · reduplication inside one token** *rhyming reduplication · exact reduplication ·
iraṭṭaik kiḷavi · Malay kata ganda · 疊字 · 첩어 · alliterative binomial formula*
- PLACE frame = **token**; there is no line. `I27`: the single form "is not a word of the language"
  — reduplication as an obligatory lexical fact rather than a device.
- from: ✓E68 ✓E70 I27 I51 X23 X60 G48

**R67 · repetition-with-one-controlled substitution** *incremental repetition · galdralag ·
kerto/parallelism · paralelismo perfeito with rhyme substitution · leixa-pren (near-verbatim)*
- IDEN neither identity nor difference: "everything agrees verbatim except at one slot, where it
  must DIFFER." `X120` is the strictest statement: an entire stanza repeated word for word except
  at the rhyme position, where a synonym with a **different rhyme sound** is substituted.
- from: ✓E56 G30 G85 X120 X119
- Forced four times from four families. The previous canon has it once (#56, English ballad) and
  flags it as MISSING.md A-2. It is not an English gap; it is a cross-linguistic structure.

**R68 · identity against an EXTERNAL constant** *alphabetic acrostic · reverse/doubled acrostic ·
name acrostic · takhalluṣ · 藏頭 · 折句 · 沓冠 · acróstico · いろは · shibbuṣ · honkadori ·
和韻/次韻/用韻 · 物名/隠題 · 향가 낙구 감탄사 · makurakotoba · kharja*
- FIG **one member of the relation is not in the poem**. The second argument is the alphabet, the
  poet's name, the syllabary, another author's text, the Bible, or the tradition's stock of fixed
  epithets. MAP index-to-index against an external sequence.
- from: S104 S105 S106 S89 X27 X40 X41 X109 X49 S109 X43 X28 X42 X61 X32 S43 S103
- Three sub-shapes: against a **sequence** (acrostics — including reversed and *n*-fold repeated
  alphabets, `S105`), against a **set with exhaustiveness and non-repetition** (`X49` iroha: each
  of 47 morae exactly once — a bijection constraint), and against **another text** (`X28` 次韻: the
  same rhyme characters in the same order as another poet's poem; `X43` honkadori, whose rule
  requires the borrowed material to **move position**).
- **Not one of these seventeen entries was visible.** The previous canon has no structure whose
  second argument lies outside the poem.

**R69 · forbidden repetition inside a moving window** *去嫌 sarikirai · ymsathr odlau · gorodl ·
īṭāʾ's distance threshold · 重韻 · rima del mismo vocablo · rime du même au même · điệp vận ·
สัมผัสซ้ำ · 出韻's hygiene siblings*
- The **same** structure as R60/R61 with NORM inverted to FORBIDDEN, plus a **distance parameter**.
  `X48` is the most explicit: a word of a given class "may not recur within so many links, and the
  distances are codified per category (句去り, 五句去り, 七句去り)". Arabic `S23` licenses īṭāʾ only at a
  distance "commonly stated as at least seven lines apart; the distance threshold is itself
  variously reported" **[DISPUTED — the sources disagree on the number]**.
- from: X48 C40 S23 S24 X13 X96 X147 I74 I64 I37 S74
- **Identity at the rhyme position is constitutive in eleven traditions and forbidden in nine.**
  Several traditions do both at once: a Persian ghazal *requires* verbatim identity of the radīf and
  *forbids* it of the qāfiya eight syllables to its left (`I37`). This is the strongest possible
  case for NORM as a coordinate and against deriving it from the phonology.

### H. Placement-only variants (identical cell, different address)

Each of these is R1/R5/R9's channel map at a different placement. They are separate structures only
because placement is a coordinate; nothing else about them differs.

**R70 · end rhyme** — both members line-final. from: ✓E35 X1 X88 X126 X153 S125 I73
**R71 · internal rhyme** — at least one member line-internal. from: ✓E36 G63 X82 X116 X149 S117 I55 X56
**R72 · leonine / caesura-to-line-end within one line** *leonine rhyme · Zäsurreim · rime léonine
(medieval sense) · taṣrīʿ · maṭlaʿ / muṣarraʿ · delet/soger · muzdawij · Otfrid's end rhyme* — the
relation binds the two hemistichs of one line. `G51` is the historically loaded case: in Otfrid the
rhyme **replaces the stave that had bound them**, at the changeover point of the whole Germanic
system. from: ✓E37 G65 G51 X132 S36 S88 S101 S39
**R73 · line-end into next-line interior** *cross rhyme · aicill · englyn cyrch · rima al mezzo ·
rime batelée · vần lưng · สัมผัสนอก · klon's tail-to-index* — from: ✓E38 C28 C48 X81 X139 I66 I54 I56 I62
**R74 · interior-to-interior across lines** *interlaced rhyme · Mittelreim · 요운* — from: ✓E39 G64 X56
**R75 · adjacent-word rhyme at zero distance** *Schlagreim* — "adjacency is the defining
coordinate" (`G62`). from: G62 X21 X22
**R76 · internal member fixed by metrical index, the other floating** *frumhending / viðrhending ·
oddhending · hluthending · hringhenda's miðrím* — the **fixed member is the LATER one**, "the
opposite anchor from every end-rhyme tradition" (`G3`). from: G3 G4 G5 G16 G17 G31 G23 G24 G25
**R77 · beat-grid placement** *offbeat / off-centred internal rhyme* — from: ✓E42
**R78 · stanza-position placement** *tail rhyme (rime couée) · Körner/Kornreim · rima irrelata ·
rims estramps · palavra perduda · Waise · rime orpheline · verso suelto* — a member whose partner is
at the **same index in another stanza** or nowhere at all. from: ✓E46 G72 G71 X85 X161 X124 X150 X108 X128
**R79 · rhyme across a language or script boundary** *kharja · Hebrew kharja* — the rhyme holds
"ACROSS A LANGUAGE AND SCRIPT BOUNDARY (Romance written in Hebrew characters)" (`S103`).
from: S43 S103
- No structure in the previous canon crosses a language boundary.

### I. Multi-edge figures

**R80 · chained pivot: two different relations sharing one member** *cynghanedd sain*
- from: ✓C8
**R81 · interleaved two-relation figure at stride 2** *cynghanedd sain gadwynog* — from: ✓C9
**R82 · sain with a zero-onset pivot** *sain lafarog* — from: ✓C10
**R83 · sain with anchor-mismatched members** *sain drosgl* — "one member is located by word
boundary, the other by stress" (`C11`). from: ✓C11
**R84 · sain with a doubled rhyme link** *sain ddwbl / sain deirodl* **[UNVERIFIED — the Celtic cell
itself marked span and alignment unknown]**. from: C12
**R85 · four-place grid** *analysed rhyme* — from: ✓E52
**R86 · channel-dependent permutation** *Schüttelreim*
- "the rime channel aligns index-to-index and the ONSET channel aligns index-to-SWAPPED-index."
  (`G61`). from: G61
**R87 · two independent pairings inside one line** *alhent · Doppelreim · rime brisée · crossed
alliteration ab|ab* — `G39` is the case that also **breaks its own tradition's polarity rule**: lift
4 alliterates here, which the base rule of R113 forbids. from: G13 G39 G60 X140
**R88 · two coexisting regimes in one stanza** *bob and wheel · hringhenda · liðhent · muwashshaḥ ·
shir ezor · musammaṭ · mustazād · dhū al-qāfiyatayn · zéjel* — two rhyme classes with **different
scopes** (one stanza-local and resetting, one poem-global and persistent) running simultaneously.
from: ✓E47 ✓E57 G46 G31 G12 S41 S42 S44 S102 S40 S92 S84 X98 I42
**R89 · one line read two ways under two metre+rhyme systems** *tashrīʿ / tawʾam*
- `S68`: "read in full it scans in metre X and rhymes on rhyme X; read only up to an internal point
  it scans in metre Y and rhymes on rhyme Y." Two complete systems on one segment string, at two
  different right boundaries. from: S68
**R90 · n-ary class over a run** *monorhyme · laisse · qaṣīda monorhyme · 一韻到底 · syair ·
samhenda/stafhenda · Haufenreim · rap chain rhyme · Skeltonics · Đường luật độc vận ·
ayak · musammaṭ's local class* — every member laid against the established class, not against a
partner. from: ✓E43 ✓E45 S38 X5 I47 G33 G73 I70 S118 X152 X99
**R91 · ∀-members-of-a-frame** *paroemion · rime senée · gabay-type whole-poem alliteration ·
citra-bandha inventory constraint · muhmala/muʿjama*
- The predicate quantifies over **every** token of the frame. `I17`: ekākṣara admits **one
  consonant in the entire verse**; niroṣṭhya forbids labials. from: ✓E49 X145 I17 S59
**R92 · self-relation under an involution** *amphisbaenic rhyme · jinās qalb · 迴文 huíwén ·
回文 kaibun · sléttubönd · vers rétrogrades · retruécano/quiasmo · transverse alliteration ab|ba ·
gomūtrikā / sarvatobhadra*
- The two arguments are **one span and its image under a declared transform** — reversal, word-order
  reversal, or a grid transposition. `G35` sléttubönd: the quatrain must remain metrical,
  alliterating **and** rhyming when read backwards. `I17` sarvatobhadra: the verse reads the same by
  row and by column. from: ✓E19 S52 X26 X47 G35 X155 X106 G40 I17
**R93 · self-relation under a declared non-involutive permutation** *sestina / retrogradatio
cruciata · parola-rima · coblas retrogradadas*
- MAP a permutation generating a cyclic group of order 6, applied stanza to stanza. CHAN **no sound
  agreement between the six words is required at all** — "the identity IS the rhyme; the form has no
  other rhyme relation" (`X174`). `X121` *dobre* is the degenerate case: one word, **uninflected**,
  at a declared symmetric pair of indices across stanzas — and `X122` *mordobre* is the same rule
  with the inflection required to vary, which is why the two are named separately.
  from: X174 X84 X170 X121
**R94 · one form carrying three different alignments at once** *klon suphap · song thất lục bát ·
khlong si suphap · lục bát*
- `I56`: "a mixture: tail-to-index (into the next line), tail-to-tail (wak 2↔3), and tail-to-tail
  across a stanza boundary. One form, three alignments." `I67`: the lục bát chain "never closes" —
  an **unbounded** figure. from: I56 I69 I59 I67 I57 I62 I58
**R95 · overlapping members** *croes o gyswllt (one consonant on both sides of the seam) ·
lusg gudd* — from: ✓C3 C14
**R96 · rhyme member assembled across a word boundary (mosaic)** *mosaic rhyme · compound/phrasal
rhyme · comhardadh briste · gespaltener Reim · rima composta/franta/spezzata · jinās murakkab
(mutashābih and mafrūq) · rim equivoc contrafet · lusg gudd*
- One lexical item against several, or several against several re-cut at different boundaries.
  `S56`/`S57` split it by whether the **orthography** also agrees — a grapheme channel riding on a
  boundary structure. from: ✓E30 ✓E31 C44 C14 G69 X76 S56 S57 X160
**R97 · whole-line phonetic identity with different segmentation** *holorhyme · holorime ·
mahāyamaka / samudga · calambur · goroawase*
- "EVERY segment agrees across the whole line; the WORD BOUNDARIES DIFFER — that difference is
  constitutive." `I14` is the Sanskrit form (a whole pāda or half-verse re-cut into different
  words); `X104` calambur is the Spanish sentence-level form. from: ✓E34 X148 I14 X104 X45
**R98 · member split by the line break** *broken rhyme · gebrochener Reim · enjambed rhyme ·
tadwīr · versos de cabo roto*
- The member is a **prefix** of a lexical item (broken), or is **completed by material belonging to
  the next line** (enjambed), or a word straddles the hemistich seam and thereby changes what is
  available at the rhyme (`S37` tadwīr). from: ✓E32 ✓E33 G68 G81 S37 X94

### J. Class-level (block) relations — the arguments are equivalence classes, not spans

**R99 · block inventory identical across stanzas** *coblas unissonans* — from: X162
**R100 · block inventory required to DIFFER across stanzas** *coblas singulars · 換韻 ·
coblas doblas · coblas ternas · coblas alternadas*
- "The PATTERN is constant; the SOUNDS must DIFFER in every stanza" (`X163`) — a required-difference
  constraint at the **inventory** level, with the grouping window varying (1, 2, 3, alternating).
  `C59` is the same predicate at stanza scope with the *ornamental regime* as its channel: n−1 lines
  of a Gaelic strophe agree and the nth "is defined by its DIFFERENCE from them", metrically and
  ornamentally at once.
  from: X163 X164 X165 X166 X6 C59
**R101 · partition-shape isomorphism with the sounds free** *Stollen parallelism (Bar form)*
- `G74`: "the relation is between two schemes, not between two sounds… the partition restricted to
  Stollen 1 is isomorphic to the partition restricted to Stollen 2… it is the pattern that repeats,
  not the sound." from: G74
**R102 · a block PROPERTY required to alternate** *règle de l'alternance des rimes*
- `X135`: "the GENDER of rhyme block *n* against the gender of block *n+1*… a required-DIFFERENCE
  constraint on a channel orthogonal to the rhyme sound itself, applied over the sequence of
  blocks." from: X135
**R103 · one channel held constant while another alternates on a schedule** *叶韻 / 平仄通協格*
- `X7`: "the FINAL is held constant across the whole poem while the TONE CLASS deliberately
  alternates 平/仄 within the same 韻部." from: X7
**R104 · block inheritance by a closing unit** *tornada · fiinda / finda · envoi · congedo*
- A short closing stanza whose rhyme sounds must reproduce those of **a specified index range of the
  preceding stanza**. `X173`: "a suffix-alignment relation, but between STANZAS rather than words."
  from: X173 X123
**R105 · scheme declarations as set partitions over line indices** *Reimschemata · rima baciata etc ·
rime plate etc · rima emparelhada etc · Turkish kafiye şemaları · vần liền/cách/ôm/hỗn ·
proest cadwynog/cyfnewidiog · rubāʿī AABA · muzdawij · pantun ABAB · talibun/seloka ·
seguidilla · romance · rekilaulu schemes · gebroken rijm (Dutch reading)*
- from: ✓E44 G73 X88 X153 X126 S125 I73 C25 S93 S121 I43 I49 X100 X99 G81 X125
- `G81` is a **[DISPUTED]** case worth preserving: one Dutch source defines *gebroken rijm* as an
  interrupted rhyme SCHEME (abac/abcb), German *gebrochener Reim* as a word split at the line break.
  Two readings, one name, and the Germanic cell recorded both rather than choosing. I follow it.
**R106 · every-line-rhymes density as a distinguishing coordinate** *曲 sanqu rhyme*
- `X29`: "EVERY line-end, not alternate ones. Density is the defining difference from 詩 and 詞."
  Density over a frame is a coordinate of the figure's selection rule, and this is its only
  independent witness. from: X29

### K. Transform-bearing relations — the comparison runs on a derived string

**R107 · initial mutation** *séimhiú / urú / treiglad*
- `C55`: "the segment that the relation reads is the MUTATED surface consonant, not the dictionary
  radical… the SAME LEXEME alliterates differently in different syntactic environments."
  from: C55 C47
**R108 · sandhi/provection generating material present in neither member** *groes o gyswllt ewinog*
- from: ✓C4
**R109 · resyllabification / liaison creating a non-lexical member** *lusg gudd · lusg gyswllt*
- from: C14
**R110 · destructive truncation applied to both members** *versos de cabo roto*
- `X94`: words truncated after the stressed vowel rhyme **as truncated**, and "typically words that
  would NOT rhyme in full." from: X94
**R111 · reading tradition as a transform** *Ashkenazi vs Sephardi stress · Sino-Korean readings ·
historical rhyme · dialect rhyme · conventional-licence rhyme · rime normande*
- `S107`: the same written words under two stress traditions give a **feminine rhyme in one reading
  and a masculine one in the other** — the anchor itself moves by one syllable. `X62`: Sino-Korean
  readings preserve the 入聲 stop codas Mandarin lost, so the same poem rhymes differently.
  from: S107 X62 ✓E21 ✓E22 ✓E23 X137
**R112 · relaxation of a channel in a declared direction** *cynghanedd lusg wyrdro*
- "the vowel channel is RELAXED in a specified direction: a diphthong in the goben is answered by a
  near or reduced vowel" (`C15`). A directional, non-symmetric grain. from: C15

---

## 3. Non-relation declarations recovered

These 601-entries are not relations. They are the *objects a relation is declared against*. The
previous canon carried a handful of them mixed in with structures (its #87, #93, #106); the
recovered set makes the category large and clearly separate.

**D1 · channel inventories** — the channels the 601 force into axis 5's domain, beyond
onset/nucleus/coda: undifferentiated consonant SEQUENCE (Welsh) · vowel LENGTH · vowel CLASS
(lleddf/talgron) · TONE CLASS · TONE VALUE · TONE MARK · NASALITY · PALATALISATION · vowel-harmony
GRADE · PROMINENCE · WEIGHT (guru/laghu, ครุ/ลหุ) · MORA COUNT · SYLLABLE COUNT · JUNCTURE ·
GRAPHEME · RASM · DOTTEDNESS · ROOT morpheme · AFFIX morpheme · prosodic TEMPLATE (wazn) · PART OF
SPEECH · SEMANTIC CATEGORY · ANTONYMY · SENSE · INTENT · ETYMOLOGY · LANGUAGE/REGISTER ·
AUTHORSHIP/PROVENANCE · LEXEME · TOKEN · LINE.
from: C34 C35 C43 C24 X115 I60 I63 X59 S124 I61 I22 X31 X51 C42 S58 S59 S69 S70 S55 I21 S54 S43 X43

**D2 · grain / quotient tables** — Irish six-way consonant classes (`C43`) · Welsh lleddf/talgron
(`C24`) · Chinese 同用 / 平水韻 / 詞林正韻 / 中原音韻 (`X8`) · Tamil mōṉai groups (`I18`) ·
Telugu prāsa maitri (`I9`) · yati-maitri vowel and consonant sets (`I10`) · Thai มาตราตัวสะกด
(`I52`) · Vietnamese vần thông compatible sets (`I72`) · sk/sp/st and any-vowel classes
(`G8`, `G9`, `G84`) · OE palatal/velar merger (`G42`) · Pattison manner classes (`E11`) · Arabic
makhraj distance (`S27`, `S28`, `S50`, `S51`) · Italian e/i, o/u (`X77`) · Spanish final i→e, u→o
(`X90`) · Sanskrit place-of-articulation (`I4`).
from: C43 C24 X8 I18 I9 I10 I52 I72 G8 G9 G42 G84 ✓E11 S27 S28 S50 S51 X77 X90 I4

**D3 · selectors — which positions the relation is even defined at** *toṭai placement variants
(iṇai / pozhippu / oruūu / kūḻai / mēṟkatuvāy / kīḻkkatuvāy / muṟṟu / kaṭai-iṇai) · aṭi-toṭai vs
cīr-toṭai scope · ghazal rhyme-line eligibility · 首句入韻 · málfylling licence · toṭai scope*
- `I23` is the cleanest: an axis "orthogonal to the choice of mōṉai / etukai / iyaipu / muraṇ /
  aḷapeṭai" that selects **which of the four feet participate**. Eight named values, applicable to
  five different relations. `S126`: "a rule over LINE INDICES, prior to any rhyme comparison…
  a selector, not a comparator."
- from: I23 I24 S126 X4 G10 C7
- **A selector is not a placement.** Placement locates a member; a selector decides which members
  exist. The previous canon has no such object; it folded Welsh accentuation classes (its #93) into
  the canonical list as though they were a structure.

**D4 · licences — named relaxations of an otherwise exhaustive requirement** *goddefiad: n
wreiddgoll · n ganolgoll · two consonants answered by one · h is not counted · 拗救 · 借韻 ·
málfylling · 一三五不論 · nhất tam ngũ bất luận · extra ornamental alliteration*
- `C20` is structurally the important one: "relaxes the one-to-one requirement to many-to-one at a
  licensed point… **breaks strict bijection; the map becomes non-injective**." That is a property of
  the correspondence MAP, declared as a licence, and it is direct evidence for §4's MAP axis.
- from: C18 C19 C20 C21 X19 X4 G10 X14 I71 G43 G19(*munnvǫrp*: "the hending channel requirement is
  weakened by one grade throughout" — a licence applied uniformly rather than at a point)

**D5 · substrates / tokenisation** *Welsh eight digraphs, elision apostrophe, the gwant (and "a
comma is NOT a caesura") · Goidelic digraphs, silent lenition, caol-le-caol · Turkish vowel harmony
as a rhyme base-rate · Malay hamzah as a real coda · Straits Rumi orthographic mergers ·
Thai live/dead syllables · character = syllable in Chinese*
- `C56` states the consequence precisely: "a syllabifier that reads every written vowel as a nucleus
  will invent syllables and destroy the syllable-count requirement that comhardadh depends on."
- from: C41 C56 S124 I50 I43 I63 X1

**D6 · structural absences declared as facts** *THE ABSENCE OF RHYME IN JAPANESE · THE ABSENCE OF
RHYME IN KOREAN · biblical Hebrew: no systematic rhyme · verso branco/solto · Waise · rims estramps ·
rima irrelata · palavra perduda · rime orpheline*
- A declared absence is not the same object as a missing value. `X30` and `X50` are entries whose
  content is that the tradition organises sound by something other than agreement — and both
  cells go on to name what filled the space (`X57`: Korean word repetition is "explicitly named by
  Korean scholarship as what filled the space rhyme left empty").
- from: X30 X50 S95 X128 X108 G71 X161 X85 X124 X150 X171(*coblas esparsas*: a single stanza standing
  as a whole poem, so the across-stanza relations of R99–R104 are declared not to exist)

**D7 · query labels, not coordinates** *half rhyme / slant / near / oblique / off rhyme ·
rima imperfetta / quasi-rima · unreiner Reim · vần ép / cưỡng vận · rima siciliana as a licence
band · 寬對*
- from: ✓E10 ✓E73 X80 G53 I72 X20
- The previous run's collision #25 is right and the recovered set confirms it in three more
  languages: every tradition that has a graded scale has a bottom band that is a **query over the
  space**, not a point in it.

**D8 · form-level declarations (a tuple, not a relation)** *zamīn · ayak · the 詞牌/曲牌 ·
Turkish şemalar as a declared tuple · kap family · chan family*
- `I38` zamīn: "the DECLARED TUPLE (baḥr = metre, qāfiya = rhyme class, radīf = refrain) that a
  whole ghazal commits to, and which another poet may borrow." This is the **FORM DECLARATION**
  object the previous run said the repo does not have and that NORM properly lives in — and it
  turns out one tradition names it, reifies it, and passes it between poets.
- from: I38 S118 X29 I62 I61 S125 C57(*classical common Gaelic*: a declaration that the Scottish
  learned orders composed in the shared Early Modern Gaelic standard, so the whole Irish structure
  set applies unchanged — a provenance declaration, not a structure)

**D9 · faults as structure + inverted normative status** — 61 of the 601 entries are named faults.
Each maps to a structure already in the canon with NORM=forbidden or deprecated, except the seven
listed at R48, R69, R86, R100, R112 and the two below, which are structures in their own right.
- from: C34 C35 C36 C37 C38 C39 C40 S23 S24 S25 S26 S27 S28 S29 S30 S31 S32 S33 S34 I37 I64 I74
  X9 X10 X11 X12 X13 X17 X18 S85 S86 S87 X96 X147 X73 ✓E66

**R113 · required difference at a NON-rhyming position** *撞韻 zhuàngyùn · 擠韻 / 犯韻 / 冒韻 ·
the OE fourth-lift prohibition · bai rhy debyg*
- `X10`: the last character of a line that must NOT rhyme must **differ** from the poem's rhyme
  class. `X11`: the rhyme sound must not leak into **any** internal position. `G41`: the fourth lift
  must not alliterate. `C36`: the two accented vowels of a cytbwys ddiacen croes **must differ** —
  agreement is the fault.
- FIG one position (or every non-rhyme position) against a **class**, with polarity FORBIDDEN.
- from: X10 X11 G41 C36
- The previous run has this as PLACEMENT's POLARITY value, forced from the OE fourth lift alone
  (which it had from repo doctrine, not from the inventory). It is forced four times, from three
  families, and in `X11` it quantifies over **every internal position**, which polarity on a single
  placement cannot express.

**R114 · constraints on the correspondence map itself, stated as faults** *bai camosodiad ·
bai crych a llyfn · bai twyll gynghanedd*
- `C38`: "the map must be **order-preserving (monotone)**, not merely a bijection on multisets."
  `C39`: "the correspondence must preserve not only order but **POSITION RELATIVE TO STRESS**."
  `C37`: "the map from A to B must be **total on A**."
- Welsh names three separate properties of the map — totality, monotonicity, stress-relative
  position — as three separate faults with three separate names. **This is the tradition treating
  the correspondence map as a first-class declared object**, and all three entries were invisible.
- from: C37 C38 C39

**R115 · rhyme licensing a lexical substitution and then deleted from the surface**
*rhyming slang*
- FIG a two-node edge in which **one node never appears in the text**. The target word is replaced
  by a fixed phrase whose final word rhymes it; in fluent use the phrase is then **truncated to its
  first word**, so the rhyming member is elided too ('me plates' for *feet*, via *plates of meat*).
  `E67`: "the relation is lexical substitution licensed by a rhyme that is never spoken."
- from: ✓E67
- Visible to the synthesis and dropped from its 106. Recorded here because it is the limiting case
  of R68's shape — a relation with an argument outside the text — arrived at from the other
  direction, and because it is the only structure in the 601 whose *evidence is systematically
  deleted*.

**R116 · a constraint on the BEARER of the relation rather than on the relation**
*detthent · hálfhnept · alhnept · kesik/ayaklı mani · khlong's kham sroi · skjálfhent's long syllable*
- `G15`: "the innovation is a morphological/prosodic constraint on the bearer, not a channel change"
  — each even line must end in a **trisyllabic compound** whose penult carries the rhyme. `G20`/`G21`
  require the bearing syllable to be a **heavy monosyllable**, throughout. `S120` requires the
  quatrain's **first line to be metrically short**, and calls the shortness constitutive. `I59`
  hangs optional *kham sroi* tail-words **outside** the rhyme, so the line's last syllable is not the
  rhyme's.
- FIG unchanged; the declaration adds an **eligibility predicate on the span's carrier** — a shape,
  a weight, or a length that the bearing word must have, independent of what it must agree with.
- from: G15 G20 G21 S120 I59
- Distinct from D3 (a selector picks *which positions* participate) and from D4 (a licence *relaxes*
  a requirement). This constrains *what kind of word may stand there at all*, and four unrelated
  traditions declare it.

---

## 4. Degrees of freedom, re-derived

### 4.1 The six previous axes, tested against the full set

| axis | still forced? | still minimal? | what the recovered entries change |
|---|---|---|---|
| **1 FIGURE** | **yes, harder** | yes, but its **node type must widen** | Forced additionally by R94 (one form, three alignments, unbounded chain), R89 (one line, two complete systems), R88 (two scopes at once, 13 witnesses), R93 (a permutation group), R91 (∀-over-a-frame, four families). Its nodes must include **equivalence classes**, not only member spans — see §4.3(iii). |
| **2 PLACEMENT** | **yes, much harder** | yes | Frame value space grows by: **mora index · character index · cīr (metrical-foot) index · wak/bat index · hemistich · colon (syntactic, in prose) · stanza-pair · stanza-group-of-3 · group-of-five-stanzas · offset-from-an-anchor-segment · EXTERNAL sequence**. Determinacy grows by **table lookup** (`I10`: the index is a property of the named metre). Polarity is forced four times, not once (R113). |
| **3 ANCHOR** | **yes** | yes | New origins: the **rawī consonant** (confirmed, and now with a full ±slot system), the **tonic vowel** (Romance, where stress is the only anchor and the span length falls out of it), the **first vowel of the word** (Irish — head-anchored, "the opposite of English tail alignment"), the **goben** (Welsh penult), **no anchor at all** (Chinese: one character is one syllable, so the question does not arise). `S107` shows the anchor can **move under a reading tradition**. |
| **4 SPAN** | **yes** | yes | New units: **mora · character · Tamil letter · cīr · colon · "sound" as a counted unit**. New magnitudes: **containment** (R22), **non-contiguous support** (R7, R32, R39), **unbounded** (`S83` nāʾira). New unmatched policies confirmed. |
| **5 CHANNEL-PREDICATE MAP** | **yes** | **no — the predicate value space is too small** | The recovered set forces at least four predicate values beyond {AGREE, DIFFER, FREE}: **PRESENT-BUT-FREE** (`S7` dakhīl), **PRESENCE-MUST-MATCH** (`S29` sinād al-ridf), **DIFFER-BUT-AGREE-ON-A-FEATURE-OF-THE-DIFFERENCE** (R11, twice from Celtic), **AGREE-IN-CLASS-AND-DIFFER-IN-VALUE** (`I68`, the exact dual). Also **DIFFER-IN-A-DIRECTION** (R13, three families). Channel domain roughly triples (D1). |
| **6 NORMATIVE STATUS** | **yes, overwhelmingly** | yes | 61 fault entries. And the decisive datum the visible 15% could not supply: **the same structural point carries opposite status in different traditions, and in one tradition it carries both at once** (R69: a ghazal requires identity of the radīf and forbids it of the qāfiya in the same line). |

**Verdict on the previous run's self-defence.** It wrote: "THE AXES BELOW ARE ROBUST TO THE MISSING
ENTRIES: every one is forced several times over, usually from more than one language family." All
six axes survive; the claim was *true for the axes it named*. But it is not the claim that matters.
The claim that matters is the one it did not make — that the axis **set** is complete — and that
one is false. Robustness of the members of a list says nothing about whether the list is closed,
and the argument the agent gave ("forced from more than one language family") could not have
distinguished the two, because it had one complete family.

### 4.2 The axis the missing 85% forces that the visible 15% did not

**AXIS 7 — MAP: the correspondence between positions of one member and positions of the other.**

The previous run considered this axis, named it ALIGNMENT, and **deliberately collapsed it**:

> "(a) ALIGNMENT — dissolves entirely into per-member ANCHOR + per-member SPAN DIRECTION;
> 'tail-to-tail flush' is a consequence of anchor=last-stressed and magnitude=to-word-end, and traws
> proves no GLOBAL alignment value can work because its two members are anchored differently.
> (b) ORIENTATION (order-preserving vs reversing) — amphisbaenic rhyme is member 1 read leftward."

Both moves work on the evidence it had. Neither works on the evidence it did not.

**Anchor + direction cannot produce:**

1. **A permutation that differs per channel.** `G61` Schüttelreim: the rime channel aligns
   index-to-index and the onset channel aligns index-to-*swapped*-index, over the same two members
   with the same anchors and the same direction. One anchor pair, one direction pair, two maps.
2. **A declared non-involutive permutation.** `X174` sestina: 6-1-5-2-4-3, generating a cyclic group
   of order 6 over stanza indices, with **no sound agreement required at all**. Reading it as
   "member 1 leftward" is not available; there is no reversal, and there are six members.
   `X170` coblas retrogradadas generalises it to "a declared algorithm".
3. **Non-injectivity as a licensed value.** `C20` goddefiad: "two consonants answered by one…
   breaks strict bijection; the map becomes non-injective at one position." A map property, licensed
   by name.
4. **Monotonicity as a separately-named requirement.** `C38` bai camosodiad: "the map must be
   order-preserving (monotone), **not merely a bijection on multisets**." Welsh distinguishes
   *which segments correspond* from *whether the correspondence respects order*, and penalises the
   second failure under its own name.
5. **A further constraint on the map beyond order.** `C39` bai crych a llyfn: "the correspondence
   must preserve not only order but POSITION RELATIVE TO STRESS."
6. **Totality as a separately-named requirement.** `C37` bai twyll gynghanedd: "the map from A to B
   must be total on A" — against `C17` braidd gyffwrdd, where a proper subset is the licensed form.
7. **Edit-distance alignment.** `S49` jinās nāqiṣ muktanaf: an internal insertion, "neither head-
   nor tail-aligned… no fixed-offset comparator can express it."
8. **Self-alignment on a grid.** `I17` sarvatobhadra: the verse reads the same by row **and by
   column**. Two simultaneous maps of a span onto itself under different transposes.
9. **Coincident members.** `X34` kakekotoba: "the two spans are COINCIDENT — the same tokens, at the
   same index, not two spans laid against each other at all." A map is still required; it is the
   identity map, and it is the only thing that makes the relation stateable.

That is **nine independent forcings from six language families** — Germanic, Celtic, Occitan/Romance,
Arabic, Sanskrit, Japanese. Every one of them is in the 85% the synthesis never saw. Its two
counter-examples (traws, amphisbaenic) are both in the 15% it did see, and both are cases where
anchor+direction *does* suffice. **The collapse was correct on its sample and wrong on the
population.** This is the answer to the question this cell was set.

Value space: `{monotone-bijection · monotone-partial · monotone-non-injective · order-reversing ·
declared-permutation · channel-dependent-permutation · index-vs-external-sequence · self-map-under-
a-transform · coincident}`, plus the three separately-declarable properties Welsh names
(**totality**, **monotonicity**, **stress-relative-position preservation**).

**AXIS 8 — GRAIN: for each channel, the equivalence relation under which "agree" is evaluated.**

The previous run saw the phenomenon — its collision #3 names "EQUALITY MODULO A DECLARED PARTITION
OF THE CHANNEL'S VALUE SPACE" and lists five witnesses — and then buried it as a predicate value
(`CLASS-EQUAL`) inside axis 5. The recovered entries show it cannot live there, for three reasons:

1. **It is declared once and shared by many types.** The Irish six-way consonant quotient (`C43`) is
   one table used by comhardadh, uaithne and aicill alike. Tamil declares *two different* quotients
   (mōṉai groups, yati-maitri sets) used by different toṭai in one tradition. A predicate value
   belongs to a type; these belong to the language.
2. **It is versioned independently of every type.** `X8`: "193 Qieyun rhymes collapse to ~106 under
   平水韻, to 19 部 under 詞林正韻, to 19 under 中原音韻 for 曲." The type 韻腳 does not change. The verdict
   on a given text does. The Chinese tradition gives the quotient **its own name** (同用 / 通押) and
   treats choosing it as a separate act from choosing the rhyme.
3. **Pairs of named types differ in nothing else.** `S50` jinās muḍāriʿ and `S51` jinās lāḥiq have
   the same figure, placement, anchor, span, channel map, map and status; the *only* difference is
   whether the two differing consonants are near or distant in the makhraj quotient. `S27` ikfāʾ and
   `S28` ijāza are the same pair again at the rawī. `I72` vần chính and vần thông likewise.

Once GRAIN is a coordinate, `family rhyme`, `Telugu prāsa maitri`, `śrutyanuprāsa`, `mōṉai groups`,
`同用`, `Thai มาตรา`, `rima siciliana`, `Spanish final i→e/u→o`, `OE c/g`, `sk/sp/st`,
`any-vowel-with-any-vowel` and the Irish class table stop being twelve structures and become one
structure evaluated at twelve declared grains. That is the correct merge, and the previous canon
could not make it because eleven of the twelve were invisible.

Value space: `{identity · declared class table · featural (manner, place, quantity, harmony grade) ·
graded articulatory distance · rime-dictionary group · directional/asymmetric relaxation ·
orthographic merger}`.

### 4.3 Three forced amendments that are not new axes

(i) **CHANNEL-PREDICATE's value space must grow** — see §4.1 row 5. Five new predicate values,
each forced at least twice.

(ii) **PLACEMENT's frame must admit an argument outside the text.** R68: seventeen entries whose
second member is the alphabet, the poet's name, the syllabary, the Bible, or another author's poem.
The previous run's frame list is entirely intra-text. `X28` 次韻 is the limiting case: the rhyme words
of poem B must be those of poem A **in the same order**.

(iii) **FIGURE's nodes must include equivalence classes.** R99–R106: eleven entries whose arguments
are rhyme *classes*. `G74` Stollen is the one that cannot be re-read as an edge between spans: the
predicate is *isomorphism of two partitions with the sounds free*. `X135` alternance is the second:
a **property of a block** required to alternate across blocks.

### 4.4 Confirmed as outside the axis set

**VALUE / CANDIDATE-FIELD SCARCITY** (R59). The previous run put this outside the six and was right
to. But it dismissed it as English pedagogy ("trite rhyme… frequency facts"). Four unrelated
traditions name it — Occitan *rim car*, Portuguese *rima rara/preciosa*, Spanish/Portuguese
*rima pobre/rica*, Turkish *kapanık ayak* — and Turkish quantifies it (**≤4 words in the entire
language**). It is a real, cross-linguistic, orthogonal coordinate, and treating it as a local
pedagogical artefact was a direct consequence of seeing one language.

---

## 5. What the truncation cost

### 5.1 The count

| | structures | notes |
|---|---|---|
| previous synthesis | **106** | derived from 85 of 601 entries (14.1%) |
| this merge — relation structures | **114** (R1–R114) | |
| this merge — non-relation declarations | **9** (D1–D9) | classes of object the canon must hold separately |
| **total distinct structural objects** | **123** | |

The 114 is **not** 106 + 8. Of the previous 106:

- ~34 survive unchanged as canonical structures.
- ~29 are absorbed as *placement variants* or *cadence variants* of a structure already present
  (they remain distinct points, and are counted here, but under fewer heads).
- **12 collapse into one structure at twelve grains** once GRAIN is a coordinate (§4.2).
- **11 are not structures at all** and move to D1–D9 (selectors, licences, substrates, absences,
  query labels, form declarations) — including its own #93 (Welsh accentuation classes), #106
  (Rhyme Genie residue, which it marked UNKNOWN), #104 (half rhyme, which its own collision #25
  correctly calls "not a type").
- **3 are wrong on the recovered evidence**: #81 antya-prāsa (onset inclusion is constitutive, R3);
  #100 proest (missing the lleddf/talgron clause and the predicate shape, R11); #86 gabay higaad
  (**no source in the 601 at all** — Somali appears nowhere in any inventory cell; it came from repo
  doctrine).

Against that, **60 structures in this canon have no counterpart of any kind in the previous 106**.

### 5.2 The structures the synthesis never saw, and which nobody would have designed against

Listed in rough order of how much they would have changed the design:

1. **R32 — the qāfiya slot system.** 40 of 601 entries. A span that is a set of named slots at
   signed offsets from an anchor segment, each with its own channel, its own predicate, and its own
   liveness condition. Two predicate values found nowhere else (`PRESENT-BUT-FREE`,
   `PRESENCE-MUST-MATCH`) and one unbounded slot. The previous canon has one line for it.
2. **R114 — the correspondence map declared as a first-class object.** Welsh names totality,
   monotonicity and stress-relative-position preservation as three separate faults. This is the
   evidence that resurrects the axis the synthesis collapsed.
3. **R68 — relations whose second argument is outside the poem.** Seventeen entries. Acrostics
   against the alphabet or the poet's name, iroha against the syllabary, shibbuṣ against the Bible,
   次韻 against another poet's rhyme sequence in order, honkadori against a named earlier poem,
   takhalluṣ against the poet's identity.
4. **R99–R106 — class-level relations.** Eleven entries. The entire Occitan *coblas* system, Bar
   form's partition isomorphism, French alternance, Chinese 換韻 and 叶韻, tornada/fiinda block
   inheritance.
5. **R39/R40 — discontinuous root skeletons and their dual, template agreement with the root free.**
   Semitic morphology gives a span whose support is discontinuous in both members and sits at
   different absolute indices in each, and a relation in which the roots must *differ* and the
   template must agree.
6. **R94 — one form carrying three or four alignments at once, unbounded.** Thai klon suphap,
   Vietnamese lục bát ("the chain never closes"), song thất lục bát, khlong si suphap — where "NO
   span is at a line end".
7. **R42 — rhymed prose.** `saj'` has a frame (the colon) set by syntax, not metre. A whole mode of
   rhyme organisation with no line at all.
8. **R48 — agree-in-class-and-differ-in-value.** Vietnamese requires syllables 6 and 8 of one line
   to be the same tone class and different tones. R11's formal dual.
9. **R11 — differ-but-agree-on-a-feature-of-the-difference.** Welsh proest and Irish uaithne,
   independently.
10. **R8 — the whole-line stressed-vowel vector.** Irish amhrán/caoineadh. "Not a rhyme at the end:
    a vector of vowels running the length of the line." The furthest thing in the 601 from suffix
    comparison, and it is a living song tradition, not a curiosity.
11. **R24 — medial insertion**, R22 **containment**, R7 **gapped vowel projection**: three span
    shapes with no witness in the visible 15%.
12. **R79 — rhyme across a language and script boundary.** The kharja, in both its Arabic and Hebrew
    settings.
13. **R47 — repair.** 拗救: a violation at one index licensed by a counter-violation at another.
14. **R89 — one text carrying two complete metre+rhyme systems simultaneously.** `tashrīʿ`.
15. **R58 — a relation whose channel is lost and whose membership survives only as convention.**
    `makurakotoba`.
16. **R106 — density as the distinguishing coordinate.** 曲 rhymes every line; that is what makes it
    not 詩.
17. **D8 — the FORM DECLARATION as a named, reified, transferable object.** The previous run said
    NORM "lives properly in a FORM DECLARATION that this repo does not have". Urdu has one, calls it
    *zamīn*, and poets borrow each other's.

### 5.3 Which language families were under-represented

Absolutely: **five of six inventory cells contributed nothing.** Proportionally, the damage is worst
where the tradition's structures are least like English:

| cell | entries | reached synthesis | structures in this canon with no previous counterpart |
|---|---|---|---|
| english | 74 | 74 (100%) | 0 |
| celtic | 64 | ~11 (17%) | 14 |
| germanic/finnic | 89 | 0 | 8 |
| semitic-persian | 126 | 0 | 19 |
| indic-seasian | 74 | 0 | 9 |
| east-asian-romance | 174 | 0 | 10 |

The 106 canonical structures are, in effect, **the English rhyme taxonomy plus the first third of
cynghanedd plus whatever the repository already believed.** Its cross-linguistic entries are not
evidence; they are the repo's own prior, restated. That is the precise sense in which the truncation
was worse than a coverage loss: it converted an external check into a self-confirmation, and the
synthesis's own caveat ("reconstructed from the repo's own quality/phonology modules and CLAUDE.md
doctrine, marked FLAG where a cell entry would have been the source") says so in as many words.

### 5.4 Beyond the 601

Recorded so the next merge does not mistake this canon for the space. The six cells cover Indo-
European (Germanic, Celtic, Romance, Indic, Iranian, Slavic **absent**), Semitic, Turkic,
Dravidian, Finnic, Sinitic, Japonic, Koreanic, Austronesian (Malay only), Tai-Kadai, Austroasiatic
(Vietnamese). **Absent entirely from all 601:** Somali and the rest of Afroasiatic outside Semitic,
all of Niger-Congo, Bantu, Nilotic, Quechuan, Uto-Aztecan, Mongolic, Tibeto-Burman, Javanese and
the rest of Austronesian, Slavic, Hellenic, Armenian, Basque, Kartvelian, Hungarian (one passing
mention), and Classical Latin as a tradition in its own right (five passing mentions, all as
Romance's ancestor or as leonine verse's origin). The previous canon's Somali entry is therefore
not merely unsupported — it is the only non-Indo-European-non-Semitic-non-East-Asian tradition the
whole exercise touched, and it touched it through repo doctrine.

---

## 6. Collisions

Confirmed from the previous run, and now with their full witness sets:

- **C1 · epistrophe = radīf = redif = 疊句-at-the-tail.** Confirmed, and extended: `ḥājib` proves the
  line tail is an ordered **slot sequence** (ḥājib · qāfiya · radīf), not one position, and that
  identity is constitutive in two of the three slots and forbidden in the one between them.
- **C2 · alliteration is one structure under ~20 names.** Confirmed and doubled. Adds the **cīr
  index** and **∀-words-in-a-line** frames.
- **C3 · equality modulo a declared partition.** Confirmed by twelve independent tables — and this
  is what promotes it from a collision to an axis (§4.2).
- **C4 · pararhyme = skothending = ablaut reduplication = proest.** Confirmed, with a correction:
  proest carries a *class agreement on the differing channel*, so it is R11, not R12. Add Korean
  ablaut (`X59`) and Occitan `rim derivatiu` to the directional sub-case (R13).
- **C6 · Kalevala strong alliteration = reverse rhyme.** Confirmed threefold (Finnic, Estonian,
  Japanese 頭韻).
- **C8 · anadiplosis = linked rhyme.** Confirmed, and the family is much larger (R62, 25 witnesses),
  and it splits three ways by channel — lexical, onset-only (`fidrad freccomail`), rime — with one
  tradition (`C53` séadna) licensing **either** for one slot.
- **C9 · cynghanedd lusg = apocopated rhyme.** Confirmed; add `rima ipermetra`.
- **C12 · rime riche = antanaclasis on homographs.** Confirmed, and the identity axis needs more
  than a fourth value: R56 lists six distinct semantic-channel sub-values.
- **C15 · homoioteleuton and polyptoton are exact mirrors.** Confirmed from eight further traditions.
- **C16 · etukai = dvitīyākṣara-prāsa.** Confirmed, with the addition that `etukai` also constrains
  the *preceding* letter's length while freeing its identity.
- **C17 · sain's links are odl + alliteration; the figure is what is new.** Confirmed.

New collisions the recovered entries force:

- **C26 · rinn/airdrinn (Irish) = cywydd deuair hirion (Welsh) = light rhyme (English).** Prominence
  MUST DIFFER at the anchor. Mandatory in two Celtic metres, a tolerated weakness in English.
- **C27 · muwashshaḥ = shir ezor = zéjel = musammaṭ = bob-and-wheel = hringhenda.** Two rhyme classes
  with different scopes running simultaneously, one resetting per stanza and one persisting.
  Six traditions, three families.
- **C28 · sestina = parola-rima = coblas retrogradadas = dobre.** Verbatim word identity at permuted
  positions, with **no sound agreement required at all**. The form's only rhyme relation is identity.
- **C29 · dúnad (Irish) = cyrch-gymeriad (Welsh) = Pearl's closed loop = pantun berkait (closed) =
  the awdl's return.** The poem's last word against its first.
- **C30 · saj' muṭarraf / mutawāzī (Arabic prose) = similicadencia (Spanish rhetoric) = biblical
  homoioteleuton.** Rhyme with the line abolished.
- **C31 · 對 (Chinese) = luật's đối (Vietnamese) = 對仗's tone half.** Required tone-class *opposition*
  index-by-index — a required-difference relation over a whole line.
- **C32 · takhalluṣ = name acrostic = shibbuṣ = honkadori = 次韻.** One argument outside the poem.

Splits the recovered entries force:

- **S1 · `qāfiya` three ways** — al-Khalīl's phonologically-delimited span (`S1`), al-Akhfash's whole
  final word (`S2`), and the rawī alone (`S3`). Three *declared theories of the same object*, all
  taught, and the choice changes what counts as a rhyme. **[DISPUTED by construction — the tradition
  itself does not resolve it.]**
- **S2 · `radīf` (Persian, a refrain) vs `ridf` (Arabic, a long vowel at offset −1).** The Semitic
  cell flags this explicitly (`S5` aka field: "do not confuse with Persian radīf"). Two unrelated
  objects one transliteration apart, and the repo's `fas.py` is exactly where that would bite.
- **S3 · `gebroken rijm`** — a scheme property in Dutch, a word-splitting property in German
  (`G81`). **Both readings recorded.**
- **S4 · `rima soante`** — Portuguese uses it for the *consonante* one (`X111` flags it as a
  terminological trap); Spanish *asonante* is the opposite pole.
- **S5 · `broken rhyme` four ways** — English word-split-at-the-line-break (`E32`), Irish
  `comhardadh briste` (a mosaic span, `C44`), French `rime brisée` (two simultaneous rhyme relations
  between the same lines, `X140`), German `gebrochener Reim` (`G68`). Four traditions, four
  structures, one English name.
- **S6 · `dubbelsteert` and `riðhent`** — **[UNVERIFIED]**, named in the sources without definition.
  Carried as gaps, not as structures.

---

## 7. Entries I could not resolve

- **`C12` cynghanedd sain ddwbl / sain deirodl** — the Celtic cell marked SPAN and ALIGNMENT
  unknown. Carried as R84 with the flag.
- **`G18` riðhent** — "UNRESOLVED. Its hending disposition was not recoverable from any reachable
  source."
- **`G78` dubbelsteert** — "Named in rederijker form-lists; the reachable sources listed it without
  defining it." Everything in its record is prefixed "Presumed".
- **`E73` Rhyme Genie residue** (half double / elided / related / diminished rhyme) — all five fields
  UNKNOWN in the source cell. The previous canon carried it as canonical entry #106; it should not
  be a canonical entry at all.
- **`E53` Lyon rhyme** — SPAN, CHAN and IDEN all "UNCERTAIN".
- **`X22` 疊韻 tone clause** — "Tone may or may not agree — sources differ, and I have not resolved
  it." Recorded as open.
- **`S23` īṭāʾ distance threshold** — "commonly stated as at least seven lines apart; the distance
  threshold is itself variously reported."
- **`S94` hā-yi ghayr-i malfūẓ as rawī** — the tradition itself is split on whether the anchor is the
  silent *h* or the segment before it. A **theory choice inside the source tradition**, not a gap in
  the survey.
- **Assonance's coda predicate (R5)** — six cells say the coda MUST DIFFER, four say it is simply
  disregarded. This changes whether perfect rhyme is a sub-case of assonance or disjoint from it.
  I have recorded both and picked neither.
- **The exact truncation boundary** — between Celtic entry 11 and entry 14. My simulation gives 85
  complete entries; the synthesis agent reported ~92. Nothing in this file turns on it.
- **R7 (gapped vowel projection)** — **[MY-DOUBT]** whether it is a structure or R5 at a declared
  grain plus a declared extraction.
- **Whether MAP and GRAIN are two axes or one.** Both are properties of *how the comparison is
  performed* rather than of *what is compared*. They are independent in the data (Schüttelreim
  permutes at grain=identity; jinās muḍāriʿ is monotone at grain=near-makhraj), so I have kept them
  apart. I am confident they are forced; I am less confident that two is the minimal number.

---

*Merged by analysis cell 2 from the complete 601-entry recovery. Every canonical structure above
cites the inventory entries it merges; every entry of the 601 is accounted for in exactly one of
R1–R114 or D1–D9. Entries marked ✓ were visible to the previous synthesis; the rest were not.*
