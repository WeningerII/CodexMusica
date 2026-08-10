# Rhyme-type coverage — measured, not claimed

Produced by a 21-agent workflow, 3.8M tokens, 889 tool calls, 2026-08-10.

    601 type entries inventoried across 6 traditions
    106 distinct STRUCTURES after dedupe by shape (25 cross-tradition collisions)
      7 degrees of freedom derived from the list rather than assumed
    106 tested individually against the chosen design
     40 fully covered
     66 FAILING — 38 not even expressible, 28 expressible but not producible

**Coverage is 38%. The standard was ALL and this does not meet it.** Section 6
below says so in the report's own words, and says it does not become complete
even with all eight proposed additions.

## TWO DEFECTS IN THE WORKFLOW SCRIPT ITSELF, which were mine

The script passed data between phases through `JSON.stringify(...).slice(n)`.
Twice that truncated:

1. The CANON agent received roughly **92 of the 601** inventory entries — the
   payload was cut mid-way through the Welsh cell. So the 106 canonical
   structures are derived from a fraction of what was gathered, and the true
   count is higher. The agent flagged this itself and argued the AXES are
   robust because each is forced several times over from more than one family;
   the LIST is not.
2. The RESIDUE agent received **33 of the 66** failures, cut mid-sentence
   inside `symploce`. Its root-cause taxonomy and work plan are grounded in
   half the evidence, and it says so in its own section 0.

Neither number below should be quoted as final. Re-run with the slices removed.

---

I have verified the structural claims against the running code and prototyped the two fixes that carry the most weight. Here is the plan.

---

# ROOT-CAUSE ANALYSIS AND WORK PLAN

## 0. Scope caveat, stated first

The failure list I was given is **truncated at 33 entries** (it ends mid-sentence inside `symploce`). The brief says 66 failed. Everything below is grounded in those 33 plus direct measurement of `/home/user/CodexMusica/lyric-harness/quality/relations.py`. The cause taxonomy is structural, so I expect the missing 33 to redistribute across the same buckets — but **I have not seen them and I am not claiming they do.** Re-run the mapping in step 12.

Second caveat: the report measures a *design-3 proposal*. The shipped code is `relations.py` (design 2, 2,386 lines, 77 schemas, no importers yet). Several reported failures are **design-3 regressions against working design-2 code** — flagged as `[REGRESSION]` below. Do not port those backwards.

---

## 1. What I verified (all measured, not read)

| Claim | Result |
|---|---|
| `Span.unit` inert | CONFIRMED — `{'syllable'}` at all 6 sites; `SpanRule` has no `unit` field |
| `IdentityRule` resource read is positionwise | CONFIRMED — `sing~singing` **False**, `love~loving` **False**, `sing~sung` True |
| token identity dedupes by string | CONFIRMED — `'love me love me' ~ 'love me'` → AGREE **True** |
| `ChannelRule.required` inert in the verdict | CONFIRMED — the only `.required` read in the module is in `_bucket_key` |
| `SpanRule.terminator` | **WORSE THAN REPORTED** — never read anywhere in `_spans_at`. Entirely dead |
| `stanza` | CONFIRMED — `{0}` always |
| `neither_line_initial` | CONFIRMED absent; 25 placement kinds, left edge has only `both_line_initial` |
| `forall` unconditional | CONFIRMED — monorhyme on `cat/hat/moon/tune` returns one frame finding, verdict-free |
| `PresentVsAbsent` | CONFIRMED — `year/feared` **False**, `down/found` **False**, `rain/brains` **False** |
| `_project` across surfaces | CONFIRMED — `it's→it`, `my→is`, `birthday→None`: misaligned from index 2 |
| stub ingestion | CONFIRMED — `&c.` → token `c` → `S IY1`; `is_chorus_stub` exists in `lyric_harness` and `relations.py` never calls it |
| homographs | CONFIRMED — `wind` has 2 CMUdict entries; `Syllable.nucleus` is a `str` |
| `SequenceEqual/Suffix/SubsequenceOf` have no `__call__` | **FALSE for relations.py** — all three are implemented and correct. `[REGRESSION]` |

### One defect not in the 66, and it is the largest single loss

`_loci('line_final_token')` picks the last **surviving** token; `Unit.line_final` is `token == line_tokens - 1` over the **raw** token index. When a line's final token is out of dictionary the two disagree, `Placement('both_line_final')` returns False, and **the line's end-rhyme is silently deleted**.

```
i saw the cat zzzqx / i wore the hat zzzqx  ->  perfect rhyme instances: []
```

Measured on 40 files of `corpus/song/`: **596 of 7,914 lines (7.5%)**. There is also no `Stream.unreadable` field at all — `relations.py`'s `Stream` has 8 fields and that is not one of them, so three tokens vanished from `"the ele- phant zzzqx here"` leaving no record. Fix this before anything else; every rate in the repo computed on the English path is wrong by an unknown amount until it is.

---

## 2. How many distinct causes there really are

**Three classes, 27 causes — but only 8 are model gaps.**

- **8 missing degrees of freedom** (M1–M8): the model cannot hold the fact.
- **13 producer defects** (P1–P13): the coordinate exists and the producer does not read it, or reads it wrongly. No new DOF.
- **6 declared-input families** (R1–R6): not computable from text + phonology by any route.

The report consistently files defects as missing DOF. That inflates the apparent redesign. **Roughly half the 33 failures need no new coordinate at all.**

---

## 3. The eight missing degrees of freedom

### M1 · THE GRANULARITY LADDER — the single largest cause (13 of 33)

`Span.unit` is a lie: `SpanRule` has no `unit` field and `_spans_at` writes the literal `"syllable"` at every construction site. Every magnitude counts syllables.

Add one index over the *same* stream — not a second stream, which is what broke every `alt` read:

```python
@dataclass(frozen=True)
class Slot:
    """One element of one rung, indexed back onto the syllable spine."""
    j: int; rung: str; value: object
    owner: int              # the syllable Unit index it belongs to
    role: str = ""          # onset|nucleus|coda on the phone rung
    span: tuple = ()        # unit indices covered, on supra-syllabic rungs

# Stream gains: rungs: dict = field(default_factory=dict)

def _build_rungs(units, lines, tokens):
    ph = []
    for u in units:
        s = u.syl
        seq = ([("onset", c) for c in s.onset]
               + ([("nucleus", s.nucleus)] if s.nucleus else [])
               + [("coda", c) for c in s.coda])
        for role, v in seq:
            ph.append(Slot(len(ph), "phone", v, u.i, role))
    gr = []
    for u in units:
        # Syllable.text where the phonology supplies it (cym/fin/som);
        # otherwise the WORD's letters hang on its first unit and a
        # syllable-granular grapheme span REFUSES rather than guesses.
        t = u.syl.text or (u.token_text if u.tok_syl == 0 else "")
        for c in t:
            gr.append(Slot(len(gr), "grapheme", c, u.i))
    wd = [Slot(k, "word", units[ids[0]].token_text.lower(), ids[0], span=ids)
          for k, ids in enumerate(v for v in tokens.values() if v)]
    ln = [Slot(k, "line", k, ids[0], span=ids)
          for k, ids in enumerate(lines) if ids]
    return {"phone": tuple(ph), "grapheme": tuple(gr), "word": tuple(wd),
            "line": tuple(ln),
            "syllable": tuple(Slot(u.i, "syllable", u.syl, u.i, span=(u.i,))
                              for u in units)}

def _on_rung(stream, unit_ids, rung):
    if rung == "syllable":
        return tuple(unit_ids)
    own = set(unit_ids)
    return tuple(s.j for s in stream.rungs[rung]
                 if (set(s.span) & own) if s.span else s.owner in own)
```

`SpanRule` gains `unit: str = "syllable"`; `_spans_at` calls `_on_rung` before applying anchor and magnitude; `_anchor_pos` gains a phone branch (`last_stressed` = first non-onset slot of the last prominence-1 syllable).

**PROTOTYPED AND MEASURED.** With the phone rung:

- additive `stow/hope, year/feared, down/found, rain/brains, prove/moved` → **5/5** (was 1/3)
- subtractive, the exact mirrors → **5/5**
- semirhyme `bend/ending` `('EH','N','D')` ⊂ `('EH','N','D','IH','NG')`, `time/climbing` → **2/2** (was 0/2)
- apocopated `dun/sunny, trap/happen, ease/treason` → **3/3** (was 0/3)
- amphisbaenic `step/pets`, `stop/pots` reversed-equal → **2/3** (`trot/tort` is `AA≠AO`, a dialect fact, not a model gap)

This also deletes the need for `PresentVsAbsent`, the `cluster` escape hatch, and any "channel-internal extension" predicate. It is one field and one index.

### M2 · THE FRAME IS NOT AN OBJECT

Three separate holes: `stanza` is always 0; `section` is a free string with no role; there is no position-within-frame; there is no phrase or bar.

```python
@dataclass(frozen=True)
class Unit:
    ...
    section: str = ""           # the printed label, unchanged
    section_role: str = ""      # verse|chorus|bridge|prechorus|refrain|tag
    section_instance: int = -1  # 0-based occurrence of that ROLE
    stanza: int = 0
    line_in_frame: int = -1     # this line's index inside its stanza/section
```

`build_stream` counts blank lines into `stanza` and takes a `roles=` map (the corpus already carries `[CHORUS 2]` tags — `corpus/song/eng_parlour_*.txt`). New placement kinds:

```python
if k == "same_section_role":     return U[a.head()].section_role == U[b.head()].section_role
if k == "same_section_instance": return (U[a.head()].section_role, U[a.head()].section_instance) \
                                     == (U[b.head()].section_role, U[b.head()].section_instance)
if k == "section_role_is":       return U[a.head()].section_role == self.args[0] == U[b.head()].section_role
if k == "line_index_in_frame":   return U[a.head()].line_in_frame == self.args[0] == U[b.head()].line_in_frame
```

And `normative` stops being a constant — this is the whole of the `repetition` failure:

```python
@dataclass(frozen=True)
class RelationSchema:
    normative: object = "attested"   # str OR ((Placement, status), ...) in order

    def status(self, a, b, stream):
        if isinstance(self.normative, str):
            return self.normative
        for pred, st in self.normative:
            if pred.holds(a, b, stream) is True:
                return st
        return "attested"

# repetition:
normative=((Placement("section_role_is", ("chorus",)), "required"),
           (Placement("same_section_instance"),        "forbidden"),
           (Placement("same_section_role"),            "deprecated"))
```

### M3 · A SPAN MAY NOT CROSS A FRAME EDGE

`terminator ∈ {word_edge, frame_edge}` are both **stopping** rules and neither is read. Enjambed rhyme is the exact converse of broken rhyme and only one got a coordinate.

```python
terminator: str = "word_edge"   # word_edge | frame_edge | crosses_frame
```

`_spans_at` must actually branch on it, and `crosses_frame` bounds itself by `magnitude` so it cannot leak the way `free_run` would (which would destroy the measured 42× frame partition).

### M4 · QUANTIFIERS RANGE ONLY OVER MEMBERS

`forall` appends unconditionally; `fraction`'s denominator is line-only. A union of disjoint cliques passes. **Measured: monorhyme on `cat/hat/moon/tune` returns one finding covering two rhyme classes.**

```python
@dataclass(frozen=True)
class Figure:
    ...
    over: str = "members"    # members | values | components
    channel: str = ""        # which channel carries the shared value

def _components(edges):
    par = {}
    def find(x):
        par.setdefault(x, x)
        while par[x] != x: par[x] = par[par[x]]; x = par[x]
        return x
    for e in edges: par[find(e.a.idx)] = find(e.b.idx)
    comp = {}
    for e in edges:
        for s in (e.a, e.b): comp.setdefault(find(s.idx), set()).add(s.idx)
    return list(comp.values())
```

In `assemble`, `forall` + `over='components'` requires **one** component to cover the frame population (monorhyme, radif); `over='values'` requires **one shared value** across every member (Somali higaad). Both currently return True on wrong input.

### M5 · NO MAXIMALITY, AND SUBSUMPTION IS KEYED ON EXACT SPAN IDENTITY

`anchor='searched'` returns every sub-extent with no maximality, so the denominator a fraction divides is saturated with sub-spans of the same repetend (measured: 26 distinct span texts on Crosby, and the list is every sub-run). And demotion keyed on `tuple(sorted(tuple(s.idx) ...))` can never fire between schemas with different span geometry — which is why homoioteleuton never demotes a perfect rhyme.

```python
def _contains(sup, sub):
    """CONTAINMENT, not equality. Exact-key demotion is why a 1-syllable affix
    span could never suppress a 2-syllable rhyme claim over the same words."""
    A = [set(s.idx) for s in sup.bind.values()]
    B = [set(s.idx) for s in sub.bind.values()]
    return len(A) == len(B) and all(any(b <= a for a in A) for b in B)
```

Apply maximality **after** evaluation, on bindings, never on the domain — a sub-span may be the only one that rhymes. Add `demotes: tuple = ()` to `RelationSchema` (design 3 has it; `relations.py` does not) and have `arbitrate` inspect verdicts, which it currently does not.

### M6 · NOTHING ON AN EDGE CARRIES A MAGNITUDE

Parechesis is a **density** claim. `ChannelRule` has 5 fields and none is a threshold; `Figure.fraction` quantifies over members in a frame, not over how much material one edge shares.

```python
@dataclass(frozen=True)
class Overlap(Predicate):
    min_shared: int = 0
    min_jaccard: float = 0.0
    ordered: bool = False
    name: str = "OVERLAP"

    def __call__(self, x, y):
        if x is None or y is None:
            return Read(None, False, "unreadable")
        X, Y = tuple(x), tuple(y)
        from collections import Counter
        n = _lcs_len(X, Y) if self.ordered else sum((Counter(X) & Counter(Y)).values())
        j = n / max(1, len(set(X) | set(Y)))
        return Read(n >= self.min_shared and j >= self.min_jaccard,
                    bool(X and Y), f"shared={n} jaccard={j:.3f}")
```

**Do not adopt design 3's `Know`.** Conflating content with epistemic alternatives in one `frozenset` makes `Know.among({T,N,S})` vs `Know.among({T,K})` report *undecidable* for "these two lines share T". `relations.py` reads raw values and has no such problem. If `Know` is adopted, it needs `alts` (epistemic) and `value` (content) as **separate** fields.

### M7 · ALIGNMENT HAS ONLY ONE SHAPE (three sub-additions)

**(a) `scope` and `flatten` are one coordinate and must be two.** `sequence` is a scope *value* covering the whole span, mutually exclusive with `post_anchor`, so "flatten the post-anchor material and compare" is unwritable — which is exactly mosaic and compound rhyme.

```python
@dataclass(frozen=True)
class ChannelRule:
    channel: str; predicate: object
    scope: str = "each"     # each|anchor|post_anchor|first|last|whole|unmatched_a|unmatched_b
    flatten: bool = False   # read the scope's positions as ONE element sequence
    surface: str = "phonemic"; required: bool = True
```

**(b) A gapped aligner.** Every aligner is edge-anchored, so unmatched material is overhang *by construction* and a licensed substitution at an unknown interior position has no shape.

```python
def align_gapped(ka, kb):
    p = 0
    while p < min(len(ka), len(kb)) and ka[p] == kb[p]: p += 1
    s = 0
    while s < min(len(ka), len(kb)) - p and ka[-1-s] == kb[-1-s]: s += 1
    return p, s, ka[p:len(ka)-s], kb[p:len(kb)-s]
```

plus a gap policy on the schema: `gap ∈ {substitution, insertion, any}` — `substitution` requires **both** residues non-empty.

**PROTOTYPED AND MEASURED — 5/5**, including both false positives the shipped schema produced:

| pair | prefix/suffix | gapA / gapB | verdict |
|---|---|---|---|
| rain it raineth / wind it bloweth | 1/2 | `[rain,it,raineth]` / `[wind,it,bloweth]` | **True** |
| a ring of / a chain of | 4/4 | `[ring]` / `[chain]` | **True** |
| a skeely skipper / a gude sailor | 6/0 | `[skeely,skipper]` / `[gude,sailor]` | **True** |
| Calling to-day, calling to-day / Calling to-day | 1/1 | `[to-day,calling]` / `[]` | **False** (insertion) |
| Jesus is calling / … the weary to rest | 3/0 | `[]` / `[the,weary,to,rest]` | **False** (insertion) |

**(c) Whole-member vs positionwise identity reads.** Identity is a property of the member (a lexeme, a root), not a sequence over its syllables.

```python
@dataclass(frozen=True)
class IdentityRule:
    level: str; predicate: object
    read: str = "member"     # member | positionwise
```

### M8 · NO JOINT, PAIR-KEYED RESOURCE

The report's proof is sound and I accept it without re-deriving: every predicate has the shape `f(read(a), read(b))` with each read derived from one member, so every channel relation is an **equivalence relation** — reflexive, symmetric, transitive. A precedent register is a set of attested pairs and is not transitive (`love~prove`, `prove~move`, not `love~move`). No per-member surface or quotient reproduces it.

```python
@dataclass(frozen=True)
class JointRule:
    resource: str            # 'licence' | 'slang' | 'sense_pair'
    predicate: object = None
    def read(self, a, b, stream):
        fn = stream.declaration.get("resources", {}).get(self.resource)
        if fn is None:
            return Read(None, False, f"no {self.resource} register declared")
        return Read(fn(_key(a, stream), _key(b, stream)), True)
```

This adds the *shape*. The *content* is a declared input (see §5).

---

## 4. The thirteen defects (no new coordinate)

| # | Defect | Fix | Closes |
|---|---|---|---|
| **P0** | `line_final` disagrees with the `line_final_token` locus when the last token is OOV; **7.5% of song lines lose end-rhyme**; no `Stream.unreadable` field exists | derive `line_final` from the line's last surviving unit at build time; add `unreadable: list` and write to it | *every English rate in the repo* |
| P1 | `ChannelRule.required` never read by `evaluate` | filter `vals` by `cr.required`; carry it in the read key | multisyllabic, Snorri's *fegra* |
| P2 | `SpanRule.terminator` never read at all | branch on it in `_spans_at` | enjambed, broken |
| P3 | `assemble`: `forall` unconditional, `fraction` denominator line-only | `_population(schema, frame, stream)` per frame kind + M4 | higaad, monorhyme, repetend |
| P4 | identity resource branch builds a tuple of span length | M7c `read='member'` | polyptoton, homoioteleuton |
| P5 | token identity dedupes by **string** | dedupe by `(line, token)` coordinate | refrain, repetition, symploce |
| P6 | `PresentVsAbsent` tests whole-channel emptiness | delete it; M1 phone rung + prefix test | additive, subtractive |
| P7 | `_project` aligns by `(line, token, tok_syl)` index | require the alt to carry back-pointers, or Refuse on any length change | all 6 alt-surface types |
| P8 | `stanza = 0` unconditional | count blank lines (M2) | 5 shipped schemas |
| P9 | `realise` prunes `a.head() > b.head()`, conflating canonical order with member identity | make the overhang-bearing member a **declared role**, not a text position | apocopated vs semirhyme |
| P10 | chorus stubs ingested as words (`&c` → `S IY1`, `etc` → 4 syllables of *etcetera*) | call the existing `lyric_harness.is_chorus_stub()` from `build_stream` | refrain by reference |
| P11 | one pronunciation per word; `wind` has 2 CMUdict entries | `Phonology.syllabify` returns alternatives; `Know.alts` finally has a producer | historical, all near-rhyme rates |
| P12 | `[REGRESSION]` design 3 declares `SequenceEqual/SequenceSuffix/SubsequenceOf` with no `__call__` | keep design 2's implementations | amphisbaenic, parechesis, mosaic |

---

## 5. Genuinely not producible — and exactly what a caller must supply

These are **not** gaps to close. Each is already a correct `Refusal`; keep it that way and name the input.

| Type | Required input | Shape |
|---|---|---|
| antanaclasis | word-sense oracle | `sense(unit) -> sense_id` per **occurrence**. No phonology computes it; without it antanaclasis is indistinguishable from repetition by construction. |
| wrenched, transformative/bent | delivered prominence surface | per-unit `(prominence, phones)` **with back-pointers** to the base stream. Doctrine 4 forbids deriving it. |
| sung-delivery | sung transcription + audio | plus a **melodic phrase frame** (M2). `beat` is honestly refused; the phrase has no field to refuse *with* — add one. |
| historical rhyme | a dated phonology module | e.g. `phonology/enm.py`. English is not a declared module at all (F-1). |
| dialect rhyme | a per-dialect phonology module | `guid`/`blude` are not in CMUdict — the *reference* surface cannot read the words. Scots/AAVE modules, not a spelling filter (F-3). |
| Scots vowel-length | vowel length **on `Syllable`** + a morph-boundary resource | `moras` cannot carry it (`brewed`/`brood` are both `B R UW1 D`, both close in /d/). Also needs a route from a resource into a **channel** — `surface='derived'` has no `provides()` branch and refuses forever. |
| conventional-licence | pair-keyed precedent register | `licence(word_a, word_b) -> bool`. M8 gives the shape; the content is attestation. |
| rhyming slang | pair-keyed slang lexicon | the constitutive member (`feet`) is **absent from the text**. Declare it a permanent Refusal in the class of `beat`. |
| offbeat internal | beat grid | doctrine 4 — permanent. Also needs a syllable→beat map (G-1) and a `bar` value in `Figure.frame`; the design is right that this is a point in the model and wrong that only the grid is missing. |
| refrain by reference | stub-resolution map | `line -> target line range`. Independently, **fix P10 now** — the corruption is global while the refusal is per-schema. |

---

## 6. Does coverage become complete? No.

Of the 33 failures I hold:

- **17 close outright**, verified where I could run them: additive, subtractive, semirhyme, apocopated, amphisbaenic (2/3 — `trot/tort` is dialect), multisyllabic, enjambed, interlaced, incremental repetition (5/5), refrain/chorus, repetend, anaphora, symploce, alliteration (higaad + monorhyme), polyptoton, homoioteleuton, repetition.
  Four of these (polyptoton, homoioteleuton, repetition, refrain) close only **given a declared lookup table** — a morphology map, section labels. That is a lexicon, not a judgement, and the corpus already carries the section tags. I count them closed; flag them if you disagree.

- **5 close only in part**, each with a named residue:
  - **mosaic / compound** — prototyped: phone rung + post-anchor flatten + a declared function-word reduction table takes it from **4/9 to 6/9** (`nitrate/night rate`, `china/sign a`, `attack/a tack`, `cargo/star go`, `cheater/cheat her`, `meter/meet her`). Residue: `poet/know it` (`OW AH T` vs `OW IH T`), `bottom/got them` (`DH` retained), `cavalry/have all we` — these need a **tolerance band or a delivered surface**, not a coordinate. Note the report's diagnosis is wrong here: the primary blocker is not cross-word resyllabification but `anchor='last_stressed'` landing on a citation-stressed **function word** (`her`, `them`, `we`), collapsing the span to one phone.
  - **eye rhyme** — the orthography is *in the text*; this is not a Refusal. The grapheme rung closes it at **word** granularity. At syllable granularity it must Refuse on the CMUdict path, where `Syllable.text` is empty and no grapheme↔syllable alignment exists.
  - **broken rhyme** — M3 plus a cross-line token closes it for near-phonemic phonologies (`fin.syllabify('kuningas')` carries `.text`, so a printed break is locatable by cumulative orthographic length). It **refuses on English**: `syllabify('ele-')` returns `[]`, no G2P, and English is the tradition where broken rhyme is attested.
  - **parechesis** — M6 makes it expressible; the threshold is a **calibration**, not a discovery. Per doctrine 18/58 it must travel with its length profile or it will read as a refrain-count bug again.
  - **alliteration** — 9 of 11 frames close. Old English / Middle English / dróttkvætt still need a **lift searcher** (the analogue of `search_caesura`, with its own `search_k`), or they stay caller-asserted. That is writable — `meter.py` exists — but it is not written.

- **11 are not producible**, listed in §5.

**17 + 5 partial + 11 = 33. The standard is ALL and this does not meet it.** It also cannot: `antanaclasis`, `offbeat` and `rhyming slang` are not gaps, they are boundaries, and the honest deliverable is a Refusal that names its capability — which the design already does correctly and should be counted as *finished*, not *failed*.

---

## 7. ORDERED WORK PLAN

**Phase 0 — stop the bleeding (½ day). Do this before any measurement is quoted again.**
1. `P0`: derive `line_final` from the last surviving unit; add `Stream.unreadable` and write to it. Re-measure every English rate in the repo.
2. `P10`: call `lyric_harness.is_chorus_stub()` from `build_stream`.
3. `P1`, `P2`, `P5`, `P6` — four small, independent fixes (`required`, `terminator`, identity dedupe, delete `PresentVsAbsent`).

**Phase 1 — M1, the granularity ladder (largest payoff, 13 types).**
4. `Slot`, `Stream.rungs`, `_build_rungs`, `_on_rung`, `SpanRule.unit`, phone branch in `_anchor_pos`.
5. Rewrite additive / subtractive / semirhyme / apocopated / amphisbaenic on the phone rung; regression-test against the 15 pairs above.
6. Grapheme rung; rewrite eye rhyme as a word-granular type that Refuses at syllable granularity.

**Phase 2 — M7, alignment (6 types).**
7. Split `scope` / `flatten`; rewrite mosaic and compound on `post_anchor + flatten`.
8. `align_gapped` + gap policy; rewrite incremental repetition. Verify 5/5.
9. `IdentityRule.read='member'`; rewrite polyptoton and symploce.

**Phase 3 — M2/M4/M5, frames, quantifiers, arbitration (8 types).**
10. `stanza` from blank lines; `section_role`/`section_instance`/`line_in_frame`; the four new placement kinds; `normative` as a map.
11. `Figure.over`, `_components`, `_population`; rewrite higaad, monorhyme, radif, paroemion.
12. `_contains`, `demotes`, verdict-aware `arbitrate`, maximality on bindings; rewrite repetend, anaphora, homoioteleuton demotion.

**Phase 4 — M3/M6/M8, the remainder (5 types).**
13. `terminator='crosses_frame'`; enjambed rhyme. Cross-line token fusion; broken rhyme with an explicit English Refusal.
14. `Overlap` predicate; **calibrate** the parechesis threshold on Whitman + a matched null and record the length profile.
15. `JointRule` shape only. Ship it empty and refusing.

**Phase 5 — declare the boundaries (½ day).**
16. Add a `phrase` frame field so sung-delivery can refuse **by name** (today it cannot — there is no field). Add `bar` to `Figure.frame` for the same reason.
17. Write the 11 permanent Refusals into `capability_report` with the exact caller obligation from §5, and add each to `MISSING.md` as a `BLOCKED` entry with its required input.

**Phase 6 — verify the claim.**
18. Re-run the full 106 against the amended model, **including the 33 failures I was never shown**, and re-derive this table. Do not carry my counts forward as evidence for entries I did not see.

**Two things to decide before Phase 1**, because they change the shape of the work:
- Is a **declared function-word reduction table** (a word list + reduced pronunciations, computable, no oracle) acceptable as a producer? It is the difference between mosaic at 4/9 and 6/9. I believe it is — it is a phonology fact, not a judgement about the poem — but it is a doctrine call, not mine.
- `apocopated` and `semirhyme` are **one point** in any model where member order is text order. Either give the overhang-bearing member a declared role (P9) or merge the two registry entries. Keeping both names over one coordinate is the defect the redesign exists to abolish.