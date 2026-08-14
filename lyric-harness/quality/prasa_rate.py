#!/usr/bin/env python3
"""Does the Digital Corpus of Sanskrit satisfy dvitīyākṣara-prāsa? -- measured.

WHY THIS FILE EXISTS

`quality/phonology/san.py` implements `prasa()`, `prasa_anchor()`,
`prasa_depth()` and `antya_prasa()`, and its author refused, in writing, to
claim that any real corpus satisfies dvitīyākṣara-prāsa: the module's own tests
run on constructed pādas that the author wrote, and a module tested only on
strings its author wrote is tested against itself (doctrine 37). That refusal
was correct and it left the claim untested. This file tests it.

THE PROBLEM THAT HAD TO BE SOLVED FIRST: WHERE IS THE PĀDA BOUNDARY?

dvitīyākṣara-prāsa is a claim about the SECOND AKṢARA OF EACH PĀDA. The DCS
`# text =` line is a HALF-VERSE -- two pādas -- and the corpus does not record
where the internal boundary falls. `san.scan_pada()` says so in its own
docstring and refuses to split. Guessing a midpoint would bias the very
position under test, because a boundary placed one akṣara early makes the
third akṣara the "second" one on every line at once.

The boundary is RECOVERED FROM THE METRE, and the recovery is a determination,
not a search:

  1. Scan the whole half-verse with `san.scan_pada()`; call its length N.
  2. Hypothesise a samavṛtta -- four identical pādas -- so the pāda is N/2
     akṣaras. Because splitting a word list cannot change how many VOWELS it
     contains, the syllable count of `words[:k]` is monotone in k, so AT MOST
     ONE word index k gives exactly N/2 akṣaras. There is nothing to choose
     between: either that k exists or a word straddles the boundary and the
     line is dropped. This is not doctrine 56's k-hypothesis search; k is 1.
  3. Require positive metrical evidence that the split is real, by either of
     two independent criteria:
       NAMED   both pādas match a template from the a-priori metre table
               below -- gaṇa strings taken from the tradition, not fitted to
               this corpus (doctrine 62: the tradition states the rule).
               Upajāti is handled for free by matching each pāda separately,
               which is what upajāti IS.
       SELFSIM the two pādas have IDENTICAL guru/laghu patterns up to the
               anceps final. For a 12-akṣara pāda that is a 1-in-2^11 accident
               if the split were wrong, and it needs no metre list at all --
               the corpus's own periodicity is the evidence.
     Ardhasama metres (puṣpitāgrā, viyoginī, aupacchandasika), whose odd and
     even pādas differ in length, are recovered from the named table only, with
     the split at the odd pāda's length.
  4. Anything else is REPORTED, NOT MEASURED. Lines that fail are counted by
     reason and printed.

WHICH TEXT LAYER, AND THE TENSION THAT CANNOT BE FULLY RESOLVED

Measured on the DCS `# text =` line: the FORM layer, word-segmented.

Prāsa is a claim about SOUND, so the metrical surface (saṃhitā, sandhi intact)
would be the right layer -- but saṃhitā has no word boundaries, and an
akṣara-initial consonant anchor is defined on the sequence of akṣaras, which
`scan_pada()` can only build from segmented input. The FORM layer is the most
surface-like segmented layer the corpus has: it retains sandhi on 17.2% of
Kirātārjunīya tokens and 4.4% of Gītagovinda's (the rest stand in pausa form,
`bhīruḥ ayam` for the transmitted `bhīrur ayaṃ`). So the layer measured is
neither the pure metrical surface nor the padapāṭha.

Two consequences, and the first is load-bearing:

  - The metre filter is ALSO a de-sandhi-damage filter. Where restoring a
    pausa form changed a syllable's weight -- a restored visarga making a light
    syllable heavy, a decoalesced vowel adding an akṣara -- the pāda no longer
    matches its template and the half-verse is dropped. The measured set is
    therefore enriched for lines the orthographic layer did not damage. That is
    a favourable selection and it is declared, not hidden.
  - The anchor itself is robust to most of the damage the filter does not
    catch, because de-sandhi rewrites word-FINAL material (visarga, anusvāra)
    far more often than word-initial material, and the anchor is an ONSET.
    `bhīruḥ` and `bhīrur` have the same second-akṣara onset `r`.

THE NULLS: A POSITIONAL CLAIM NEEDS A NULL THAT MOVES THE POSITION

Doctrine 56 -- a rate without a matched control is quoting the null back at
itself. Three nulls, because no single one is right and the disagreement
between them is itself the finding:

  N1  PERMUTE PĀDAS ACROSS VERSES, within a stratum of (text, pāda length,
      pāda parity).
      PRESERVES  every pāda intact: all its phonemes, its word order, its
                 second akṣara, its length, its metrical slot, its text.
      DESTROYS   only the fact that these particular pādas were composed
                 together as one verse.
      This is the narrowest possible null and the one that answers "did the
      poet coordinate the anchors of a verse?".

  N2  PERMUTE WORDS WITHIN EACH PĀDA.
      PRESERVES  the pāda's exact word inventory, every phoneme in it, its
                 word count, its akṣara count (word order cannot change how
                 many vowels a pāda has).
      DESTROYS   which word -- hence which akṣara -- lands SECOND, and which
                 lands last. It also destroys the metre, which is irrelevant
                 to a consonant-position claim and is stated because it is
                 true.
      This is the null that directly targets a POSITIONAL anchor, and it is
      the one doctrine 56 was written about.

  N3  RESAMPLE PĀDAS FROM THE WHOLE MEASURED POOL, matched on akṣara count
      only, with replacement, pooled across texts and metres.
      PRESERVES  the pāda intact and its length.
      DESTROYS   co-composition, and additionally the text and the metre.
      Destroys strictly more than N1. If N3 and N1 agree, stratification by
      text and metre is not carrying the result.

A null that destroys more than the constraint manufactures a positive; one
that destroys less manufactures a null. N1 destroys the least, so N1 is the
conservative one for a cross-pāda claim, and N2 is the conservative one for a
positional claim. Both are reported for every rule variant.

FIVE RULE VARIANTS, CHOSEN BY LIFT AND NOT BY YIELD

Doctrine 61: the hending rule that found the MOST was the worst of four,
because its chance rate nearly tripled. The same table is built here.

  V1  dvitīyākṣara   all pādas of the unit share the 2nd akṣara's initial
                     consonant. Computed by `san.prasa()` itself.
  V2  ādyakṣara      the same at akṣara 1.
  V3  akṣara-k       SOME position k has all pādas sharing their initial
                     consonant there. A search over k, and the mean k is
                     reported, because a searched rate is k hypotheses.
  V4  antya-prāsa    end-rhyme: `san.antya_prasa()` at depth 1 and depth 2.
  V5  free anuprāsa  some consonant begins a WORD in every pāda, at any
                     position. The loosest reading, included so the yield /
                     lift divergence is visible rather than argued.

CORPUS

Digital Corpus of Sanskrit -- Oliver Hellwig, DCS, 2010-2021, CC BY 4.0.
Kirātārjunīya (Bhāravi, 6th c.) and Gītagovinda (Jayadeva, 12th c.), the
sparse checkout of `dcs/data/conllu/files` only. `corpus/GRETIL/` in the same
repository is CC BY-NC-SA and is NEVER fetched; the sparse-checkout is
load-bearing, see the row for `OliverHellwig/sanskrit#dcs-conllu` in
`data/sources.tsv`.

Run:
  python3 quality/prasa_rate.py /home/user/ohs [n_replicates]
  python3 quality/prasa_rate.py /home/user/ohs --stage   # write the slice
  python3 quality/prasa_rate.py --check                  # staged slice only
  python3 quality/prasa_rate.py --check /home/user/ohs   # + ingestion figures

EXIT CODES, and the third one is doctrine 20's:
  0  every committed figure reproduces
  1  a figure MOVED -- see `PINNED` and repin with the superseded value visible
  2  CANNOT TELL -- the corpus this check reads is not present. Not a pass and
     not a failure; an input that was never there is a different result from a
     number that changed, and collapsing the two is the false negative
     doctrine 20 is about.
"""

import collections
import glob
import os
import random
import sys
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from quality.phonology import get                    # noqa: E402

#: Fixed. A null drawn from a fresh seed each run is a number nobody can check.
SEED = 20260810

SAN = get("san")

# ---------------------------------------------------------------------------
# The metre table. A PRIORI, from the tradition's own gaṇa descriptions -- not
# derived from this corpus. `g` guru, `l` laghu, `x` either. A pāda-final laghu
# comes back from san.pattern() as `?` and `san.scans_as()` licenses it against
# any template symbol, which is the anceps rule and is why every template below
# may write its final position as the metre's nominal weight.
# ---------------------------------------------------------------------------

GANA = {"ma": "ggg", "na": "lll", "bha": "gll", "ya": "lgg",
        "ja": "lgl", "ra": "glg", "sa": "llg", "ta": "ggl",
        "g": "g", "l": "l"}


def _t(spec):
    return "".join(GANA[p] for p in spec.split())


#: samavṛtta: all four pādas share one template (upajāti mixes two, which is
#: handled by matching each pāda independently against the whole set).
SAMAVRTTA = {
    8: {
        # śloka/anuṣṭubh pathyā: 5th laghu, 6th guru everywhere; 7th guru in
        # the odd pādas and laghu in the even. 1-4 and 8 are free.
        "anustubh_pathya_odd": "xxxxlggx",
        "anustubh_pathya_even": "xxxxlglx",
    },
    11: {
        "indravajra": _t("ta ta ja g g"),
        "upendravajra": _t("ja ta ja g g"),
        "rathoddhata": _t("ra na ra l g"),
        "svagata": _t("ra na bha g g"),
        "salini": _t("ma ta ta g g"),
    },
    12: {
        "vamsastha": _t("ja ta ja ra"),
        "indravamsa": _t("ta ta ja ra"),
        "drutavilambita": _t("na bha bha ra"),
        "totaka": _t("sa sa sa sa"),
        "bhujangaprayata": _t("ya ya ya ya"),
        "pramitaksara": _t("sa ja sa sa"),
    },
    13: {
        "praharsini": _t("ma na ja ra g"),
        "rucira": _t("ja bha sa ja g"),
        "manjubhasini": _t("sa ja sa ja g"),
    },
    14: {
        "vasantatilaka": _t("ta bha ja ja g g"),
        "vamsapatrapatita": _t("bha ra na bha g g"),
    },
    15: {"malini": _t("na na ma ya ya")},
    17: {
        "sikharini": _t("ya ma na sa bha l g"),
        "mandakranta": _t("ma bha na ta ta g g"),
        "harini": _t("na sa ma ra sa l g"),
        "prthvi": _t("ja sa ja sa ya l g"),
    },
    19: {"sardulavikridita": _t("ma sa ja sa ta ta g")},
    21: {"sragdhara": _t("ma ra bha na ya ya ya")},
}

#: ardhasama: odd and even pādas differ in LENGTH, so the split is not at N/2
#: and the named template is the only evidence available for it.
ARDHASAMA = {
    "puspitagra": (_t("na na ra ya"), _t("na ja ja ra g")),
    "viyogini": (_t("sa sa ja g"), _t("sa bha ra l g")),
    "aupacchandasika": (_t("sa sa ja g g"), _t("sa bha ra l g g")),
}

for _n, _tbl in SAMAVRTTA.items():
    for _nm, _tp in _tbl.items():
        assert len(_tp) == _n, (_nm, len(_tp), _n)


# ---------------------------------------------------------------------------
# ingestion
# ---------------------------------------------------------------------------

def load_dcs(root):
    """-> [(text, chapter, verse, subcounter, line)] from the sparse checkout.

    Reads ONLY the `# text =` comment, which is the DCS's word-segmented FORM
    layer. Refuses to walk anything named GRETIL: that tree is CC BY-NC-SA and
    this repository must never ingest it, so the guard is here and not only in
    the checkout.
    """
    base = os.path.join(root, "dcs", "data", "conllu", "files")
    if not os.path.isdir(base):
        sys.exit(f"no DCS checkout at {base!r}. See the module docstring.")
    if glob.glob(os.path.join(root, "corpus", "GRETIL")):
        sys.exit("corpus/GRETIL/ is present in this checkout and is "
                 "CC BY-NC-SA. Re-clone with the sparse-checkout.")
    out = []
    for path in sorted(glob.glob(os.path.join(base, "*", "*.conllu"))):
        text = os.path.basename(os.path.dirname(path))
        chapter = os.path.basename(path)
        verse = sub = None
        pending = None
        for raw in open(path, encoding="utf-8"):
            if raw.startswith("# text = "):
                pending = raw[len("# text = "):].strip()
                verse = sub = None
            elif raw.startswith("# sent_counter = "):
                verse = raw.split("=", 1)[1].strip()
            elif raw.startswith("# sent_subcounter = "):
                sub = raw.split("=", 1)[1].strip()
                if pending is not None and verse is not None:
                    out.append((text, chapter, verse, sub, pending))
                    pending = None
    return out


def check_notation(lines):
    """The previous cell's reported facts about this data, re-verified here
    rather than assumed. Returns a dict; the caller prints it."""
    chars, comb, nonnfc = set(), 0, 0
    for _t, _c, _v, _s, line in lines:
        chars.update(line)
        if unicodedata.normalize("NFC", line) != line:
            nonnfc += 1
        comb += sum(1 for ch in line if unicodedata.combining(ch))
    return {"lines": len(lines), "distinct_chars": len(chars),
            "combining_marks": comb, "not_NFC": nonnfc,
            "chars": "".join(sorted(chars))}


# ---------------------------------------------------------------------------
# pāda boundary recovery
# ---------------------------------------------------------------------------

def _word_index_at(words, n):
    """-> the word index k with exactly n akṣaras in words[:k], else None.

    Unique when it exists: splitting a word list cannot change how many vowels
    it holds, so the running akṣara count is strictly monotone in k. This is a
    determination, not a search over k.
    """
    total = 0
    for k, w in enumerate(words):
        total += len(SAN.scan_pada(w))
        if total == n:
            return k + 1
        if total > n:
            return None
    return None


def recover(line):
    """-> (padas, metre, criterion) or (None, reason, None).

    `padas` is a list of pāda strings. `criterion` is 'named' or 'selfsim'.
    """
    pat = SAN.pattern(line)
    if pat is None:
        return None, "unreadable", None
    words = line.split()
    n_total = len(pat)

    # ardhasama first: its split is not at N/2, so a samavṛtta hypothesis on
    # the same length would be answering a different question.
    for name, (odd, even) in ARDHASAMA.items():
        if n_total != len(odd) + len(even):
            continue
        k = _word_index_at(words, len(odd))
        if k is None:
            continue
        a, b = " ".join(words[:k]), " ".join(words[k:])
        if SAN.scans_as(a, odd) and SAN.scans_as(b, even):
            return [a, b], name, "named"

    if n_total % 2:
        return None, "odd length, no ardhasama match", None
    n = n_total // 2
    k = _word_index_at(words, n)
    if k is None:
        return None, "word straddles the pada boundary", None
    a, b = " ".join(words[:k]), " ".join(words[k:])

    table = SAMAVRTTA.get(n, {})
    m1 = [nm for nm, tp in table.items() if SAN.scans_as(a, tp)]
    m2 = [nm for nm, tp in table.items() if SAN.scans_as(b, tp)]
    if m1 and m2:
        label = m1[0] if m1[0] == m2[0] else f"upajati({m1[0]}/{m2[0]})"
        return [a, b], label, "named"

    # no name, but the two halves scan IDENTICALLY up to the anceps final --
    # the corpus's own periodicity is evidence for the split.
    pa, pb = SAN.pattern(a), SAN.pattern(b)
    if pa and pb and len(pa) == len(pb) == n and pa[:-1] == pb[:-1]:
        return [a, b], f"selfsim({n}:{pa[:-1]}x)", "selfsim"
    return None, f"no metre at pada length {n}", None


# ---------------------------------------------------------------------------
# per-pāda features. Everything a rule variant reads is derived ONCE from
# san's own scansion, so the null and the observation are scored identically.
# ---------------------------------------------------------------------------

def _endkey(sylls, depth):
    """The key `san.antya_prasa()` builds: the last `depth` akṣaras of the
    pāda's last word, IN FULL -- onset, nucleus and coda. Rebuilt here from
    `san.syllabify()` rather than called through `antya_prasa()` for every one
    of the millions of null pādas, and `main()` asserts the two agree on every
    observed pāda before any null is drawn."""
    if len(sylls) < depth:
        return None
    return tuple((x.onset, x.nucleus, x.coda) for x in sylls[-depth:])


def features(pada):
    sylls = SAN.scan_pada(pada)
    onsets = tuple(s.onset[0] if s.onset else None for s in sylls)
    words = pada.split()
    inits = set()
    for w in words:
        sw = SAN.syllabify(w)
        if sw and sw[0].onset:
            inits.add(sw[0].onset[0])
    last = SAN.syllabify(words[-1]) if words else []
    return {"text": pada, "n": len(sylls), "onsets": onsets,
            "inits": frozenset(inits), "end1": _endkey(last, 1),
            "end2": _endkey(last, 2), "nwords": len(words)}


# ---------------------------------------------------------------------------
# rule variants. Each takes a unit (a list of per-pāda feature dicts) and
# returns a number in [0, 1] -- 1/0 for the binary rules, a share for the
# continuous ones. Continuous statistics are included because "all m pādas
# agree" has almost no power at m=4 (doctrine 20: an underpowered statistic
# reporting 0% is not the same claim as a null).
# ---------------------------------------------------------------------------

def _agree_at(unit, i):
    """-> the shared consonant at akṣara i, False if the pādas disagree, None
    if some pāda is too short or vowel-initial there. None and False both mean
    'the rule does not fire', and both stay in the DENOMINATOR (doctrine 27)."""
    got = []
    for f in unit:
        if i >= len(f["onsets"]) or f["onsets"][i] is None:
            return None
        got.append(f["onsets"][i])
    return got[0] if len(set(got)) == 1 else False


def _share_at(unit, i):
    """-> the largest share of the unit's pādas carrying one consonant at
    akṣara i. This is exactly what `san.prasa()` returns for i = 1."""
    counts = collections.Counter()
    for f in unit:
        if i < len(f["onsets"]) and f["onsets"][i] is not None:
            counts[f["onsets"][i]] += 1
    return max(counts.values()) / len(unit) if counts else 0.0


def v_dvitiya(unit):
    return 1.0 if _agree_at(unit, 1) not in (None, False) else 0.0


def v_dvitiya_share(unit):
    return _share_at(unit, 1)


def v_adya(unit):
    return 1.0 if _agree_at(unit, 0) not in (None, False) else 0.0


def v_adya_share(unit):
    return _share_at(unit, 0)


def _k_of(unit):
    return min(f["n"] for f in unit)


def v_anyk(unit):
    for i in range(_k_of(unit)):
        if _agree_at(unit, i) not in (None, False):
            return 1.0
    return 0.0


def v_anyk_share(unit):
    return max((_share_at(unit, i) for i in range(_k_of(unit))), default=0.0)


def _end_agree(unit, key):
    keys = [f[key] for f in unit]
    return 1.0 if None not in keys and len(set(keys)) == 1 else 0.0


def v_antya1(unit):
    return _end_agree(unit, "end1")


def v_antya2(unit):
    return _end_agree(unit, "end2")


def v_antya1_share(unit):
    counts = collections.Counter(f["end1"] for f in unit if f["end1"])
    return max(counts.values()) / len(unit) if counts else 0.0


def v_free(unit):
    return 1.0 if frozenset.intersection(*[f["inits"] for f in unit]) else 0.0


#: (label, fn, kind). 'binary' rules are rates; 'share' rules are means.
VARIANTS = [
    ("V1 dvitiyaksara  aksara 2 all", v_dvitiya, "binary"),
    ("V1 dvitiyaksara  aksara 2 share", v_dvitiya_share, "share"),
    ("V2 adyaksara     aksara 1 all", v_adya, "binary"),
    ("V2 adyaksara     aksara 1 share", v_adya_share, "share"),
    ("V3 aksara-k      searched  all", v_anyk, "binary"),
    ("V3 aksara-k      searched  share", v_anyk_share, "share"),
    ("V4 antya-prasa   depth 1   all", v_antya1, "binary"),
    ("V4 antya-prasa   depth 1   share", v_antya1_share, "share"),
    ("V4 antya-prasa   depth 2   all", v_antya2, "binary"),
    ("V5 free anuprasa any word  all", v_free, "binary"),
]


def score_all(units):
    """-> {variant label: value}. One pass, so every variant is scored on the
    identical set of units and the table is internally comparable.

    THE DENOMINATOR HERE IS `len(units)` = MANDATED, NOT JUDGED. That is a
    doctrine 79 collapse and it is left standing on purpose -- see
    `state_counts()` below for the three counts, the measured size of the
    collapse, and why the rate is disclosed rather than silently repinned.
    """
    n = len(units)
    out = {}
    for label, fn, _kind in VARIANTS:
        out[label] = sum(fn(u) for u in units) / n if n else 0.0
    return out


# ---------------------------------------------------------------------------
# DOCTRINE 79 -- REFUSED, JUDGED and MANDATED are three counts, never summed,
# and a refusal must not be scored as a judged NO.
#
# THE COLLAPSE, NAMED. `_agree_at` returns three things and its own docstring
# says so -- a consonant (the rule FIRED), `False` (the pādas were compared and
# DISAGREE), and `None` (some pāda is too short, or is VOWEL-INITIAL at that
# akṣara, so there is no consonant to compare and the question cannot be put).
# `v_dvitiya`/`v_adya`/`v_anyk` then map both `None` and `False` to 0.0, and
# `score_all` divides by every unit. So a pāda the instrument CANNOT ASK about
# is scored as a pāda that ANSWERED NO. That is doctrine 20's "inconclusive by
# construction is not null" and doctrine 28's "none vs cannot tell", inside one
# `in (None, False)`.
#
# `_agree_at`'s docstring cites doctrine 27 for keeping both in the
# denominator. Doctrine 27 is about not conditioning a NULL on the filter it
# calibrates, which is a different question from what a rate's denominator
# means, and it does not license the collapse.
#
# HOW BIG IT IS -- MEASURED 2026-08-14, not argued, and it is not uniform:
#
#   V1 dvitīyākṣara  half-verse   2 refused of 1930  (0.10%)   6.995% -> 7.002%
#   V1 dvitīyākṣara  verse        2 refused of  816  (0.25%)   0.000% -> 0.000%
#   V2 ādyakṣara     half-verse 592 refused of 1930 (30.67%)   7.306% -> 10.538%
#   V2 ādyakṣara     verse      409 refused of  816 (50.12%)   0.245% ->  0.491%
#   V4 antya depth 2 half-verse 122 refused of 1930 (6.32%)
#   V5 free anuprāsa half-verse 118 refused of 1930 (6.11%)
#
# So THE HEADLINE IS SAFE AND THE COLLAPSE IS REAL. `data/sources.tsv:91`
# publishes V1 at 135/1930 = 6.995%, and V1's refusal rate is 2 in 1930 --
# dormant, exactly as `audit_hafez_radif.py` found its own collapse dormant at
# 0 refused of 495. But V2 is refused on nearly a THIRD of half-verses and on
# HALF of verses, because a Sanskrit pāda beginning with a vowel has no initial
# consonant to share, and its published-shaped rate is 3.23 points low as a
# result. The branch is dormant in the number this repo quotes and live in the
# table printed beside it.
#
# WHY THE RATE IS NOT REPINNED HERE. `score_all` and the nulls are left
# BYTE-IDENTICAL so every figure in `data/sources.tsv:91` reproduces unchanged;
# that row is not this cell's to move, and a rate that changed silently under a
# `--check` being added in the same commit would be the worst of both. What is
# added is DISCLOSURE and a PIN: the three counts are printed next to the rate
# and committed in `PINNED`, so the refusal count is mechanical from now on and
# the day a re-ingestion moves it, `--check` goes red instead of the rate
# sliding quietly. Doctrine 17 -- keep the superseded reading visible.
#
# IS A VOWEL-INITIAL AKṢARA REALLY A REFUSAL? It is stated as one, not assumed.
# The rule under test is agreement of an INITIAL CONSONANT, so a pāda with no
# consonant in that slot is outside the rule's domain rather than a poet's
# failure to satisfy it -- and the neighbouring traditions agree the question is
# open, since Tamil etukai lets a vowel-initial second syllable agree by VOWEL.
# Pinning all three counts is what makes both readings available to a later
# reader: `carrying/judged` and `carrying/mandated` are both derivable from the
# committed numbers, and neither is buried in a single printed percentage.
# ---------------------------------------------------------------------------

#: The three states, spelled once so every variant answers the same vocabulary.
YES, NO, REFUSED = "yes", "no", "refused"


def agree_state(unit, i):
    """-> YES / NO / REFUSED for a fixed-position rule at akṣara `i`."""
    a = _agree_at(unit, i)
    if a is None:
        return REFUSED
    return NO if a is False else YES


def anyk_state(unit):
    """-> YES / NO / REFUSED for V3, the SEARCHED rule.

    REFUSED only if EVERY searched position refused; one position that was
    actually compared makes the unit judged, whatever the search then found.
    """
    judged = False
    for i in range(_k_of(unit)):
        a = _agree_at(unit, i)
        if a is None:
            continue
        judged = True
        if a is not False:
            return YES
    return NO if judged else REFUSED


def end_state(unit, key):
    """-> YES / NO / REFUSED for the antya-prāsa rules. A pāda whose last word
    is shorter than the depth has NO rhyme key, so the unit cannot be judged --
    `_end_agree` scores that 0.0, the same collapse one layer over."""
    keys = [f[key] for f in unit]
    if any(k is None for k in keys):
        return REFUSED
    return YES if len(set(keys)) == 1 else NO


def free_state(unit):
    """-> YES / NO / REFUSED for V5. A pāda with no word-initial consonant at
    all supplies nothing to intersect, so the unit is refused, not a NO."""
    if any(not f["inits"] for f in unit):
        return REFUSED
    return YES if frozenset.intersection(*[f["inits"] for f in unit]) else NO


#: (label, state fn, the BINARY scorer it must agree with). The pairing is the
#: point: `state_counts` asserts `state is YES` iff the shipped scorer returns
#: 1.0, so the disclosure is provably about the SAME predicate the rate and the
#: nulls use, and not a second predicate that happens to look similar.
STATEFUL = [
    ("V1 dvitiyaksara  aksara 2 all", lambda u: agree_state(u, 1), v_dvitiya),
    ("V2 adyaksara     aksara 1 all", lambda u: agree_state(u, 0), v_adya),
    ("V3 aksara-k      searched  all", anyk_state, v_anyk),
    ("V4 antya-prasa   depth 1   all", lambda u: end_state(u, "end1"),
     v_antya1),
    ("V4 antya-prasa   depth 2   all", lambda u: end_state(u, "end2"),
     v_antya2),
    ("V5 free anuprasa any word  all", free_state, v_free),
]


def state_counts(units):
    """-> {label: (mandated, judged, refused, carrying)}. FOUR numbers, and the
    first three are doctrine 79's three counts, NEVER SUMMED."""
    out = {}
    for label, state_fn, score_fn in STATEFUL:
        mandated = len(units)
        judged = refused = carrying = 0
        for u in units:
            st = state_fn(u)
            fired = score_fn(u) == 1.0
            if (st == YES) != fired:
                # The three-state view and the shipped binary scorer have come
                # apart, so the disclosure would be about a DIFFERENT predicate
                # from the rate and the nulls. Refuse rather than print a
                # triple nobody can trace back to the published number.
                sys.exit(f"state/scorer disagree on {label!r}: state={st}, "
                         f"scorer fired={fired}, pāda={u[0]['text']!r}. "
                         f"Refusing to report counts for a predicate that is "
                         f"not the one scored.")
            if st == REFUSED:
                refused += 1
            else:
                judged += 1
                carrying += fired
        out[label] = (mandated, judged, refused, carrying)
    return out


def print_state_counts(units, uname):
    """The doctrine 79 table, printed next to the rates it qualifies."""
    print(f"\n  doctrine 79 -- MANDATED / JUDGED / REFUSED for {uname}, three "
          f"counts, never summed.")
    print(f"  The rates above divide by MANDATED. Both denominators are shown "
          f"so neither is buried.")
    print(f"    {'variant':<34}{'MAND':>7}{'JUDGED':>8}{'REFUSED':>9}"
          f"{'CARRY':>7}{'/mand':>9}{'/judged':>9}")
    sc = state_counts(units)
    for label, _s, _f in STATEFUL:
        man, jud, ref, car = sc[label]
        print(f"    {label:<34}{man:>7}{jud:>8}{ref:>9}{car:>7}"
              f"{car / man if man else 0:>9.3%}"
              f"{car / jud if jud else 0:>9.3%}")
    print("    A REFUSED unit could not be asked -- too short, or VOWEL-INITIAL "
          "at the anchor, so")
    print("    there is no consonant to compare. It is not a pāda that answered "
          "NO (doctrine 20/28).")
    return sc


# ---------------------------------------------------------------------------
# nulls. Each is a *maker*: called with no arguments, returns one replicate.
# Replicates are streamed and scored one at a time, never materialised.
# ---------------------------------------------------------------------------

def make_permute(units, strata, rng):
    """N1 -- permute pādas across verses inside a stratum."""
    def maker():
        out = [list(u) for u in units]
        for _key, slots in strata.items():
            pool = [units[i][j] for i, j in slots]
            rng.shuffle(pool)
            for (i, j), f in zip(slots, pool):
                out[i][j] = f
        return out
    return maker


def make_shuffle_words(units, rng):
    """N2 -- permute the words inside each pāda, then RESCAN.

    Rescanning is the point: word order changes which akṣara is second, and
    Sanskrit resyllabifies across word boundaries, so the shuffled pāda's
    scansion has to be rebuilt from the string rather than permuted."""
    def maker():
        out = []
        for u in units:
            new = []
            for f in u:
                w = f["text"].split()
                rng.shuffle(w)
                new.append(features(" ".join(w)))
            out.append(new)
        return out
    return maker


def _draw_distinct(pools, rng, tries=12):
    """Draw one pāda from each pool, DISTINCT where the pools allow it.

    A null unit that contains the same pāda twice agrees with itself at every
    position, so allowing repeats would hand the null a source of agreement
    that no real verse has. Falls back to a repeat only when the pools cannot
    supply a distinct one -- and then it has done so for both the observation's
    comparator and nothing else, which is the fair direction."""
    out, seen = [], set()
    for pool in pools:
        pick = rng.choice(pool)
        for _ in range(tries):
            if id(pick) not in seen:
                break
            pick = rng.choice(pool)
        seen.add(id(pick))
        out.append(pick)
    return out


def make_resample(units, by_len, rng):
    """N3 -- draw each pāda from the measured pādas of the same akṣara count,
    pooled across texts and metres, distinct within a unit."""
    def maker():
        return [_draw_distinct([by_len[f["n"]] for f in u], rng)
                for u in units]
    return maker


def null_table(maker, n_rep):
    """-> {variant label: [rate per replicate]}, streamed."""
    acc = collections.defaultdict(list)
    for _ in range(n_rep):
        for label, val in score_all(maker()).items():
            acc[label].append(val)
    return acc


def report(label, obs, nulls, n_rep, indent=6):
    nulls = sorted(nulls)
    med = nulls[len(nulls) // 2]
    lo, hi = nulls[0], nulls[-1]
    beat = sum(1 for x in nulls if x >= obs - 1e-12)
    p = (beat + 1) / (n_rep + 1)
    floor = 1.0 / (n_rep + 1)
    pad = " " * indent
    lift = (obs / med) if med else float("inf")
    print(f"{pad}{label:<26} null med {med:7.3%} min {lo:7.3%} "
          f"max {hi:7.3%}")
    print(f"{pad}{'':<26} obs-nullmax {obs - hi:+7.3%}  lift x{lift:5.2f}  "
          f"p {p:.4f} (floor {floor:.4f}, n={n_rep})")
    if lo == hi == obs:
        print(f"{pad}{'':<26} -> DEGENERATE: this null is an IDENTITY for "
              f"this rule. It cannot move the statistic, so it controls "
              f"nothing (doctrine 14).")
    elif abs(p - floor) < 1e-12:
        print(f"{pad}{'':<26} -> p is AT the floor: no replicate reached "
              f"{obs:.3%}. Read the gap to the null MAX, not the p.")
    return p


# ---------------------------------------------------------------------------
# ingestion of the recovered set
# ---------------------------------------------------------------------------

def build(root, verbose=True):
    lines = load_dcs(root)
    facts = check_notation(lines)
    if verbose:
        print(f"DCS `# text =` lines: {facts['lines']}   distinct characters: "
              f"{facts['distinct_chars']}   combining marks: "
              f"{facts['combining_marks']}   non-NFC lines: {facts['not_NFC']}")
        print(f"  inventory: {facts['chars']!r}")
        print(f"  grid unit: {SAN.grid_unit}")
        print(f"  relation:  {SAN.relation}\n")

    recovered, reasons = [], collections.Counter()
    for text, chapter, verse, sub, line in lines:
        padas, metre, crit = recover(line)
        if padas is None:
            reasons[metre] += 1
            continue
        recovered.append({"text": text, "chapter": chapter, "verse": verse,
                          "sub": sub, "line": line, "padas": padas,
                          "metre": metre, "criterion": crit})
    if verbose:
        n = len(recovered)
        print(f"PĀDA BOUNDARY RECOVERED on {n}/{len(lines)} half-verses "
              f"= {n / len(lines):.1%}")
        for c, v in collections.Counter(
                r["criterion"] for r in recovered).most_common():
            print(f"    criterion {c:<9} {v}")
        by_text = collections.Counter(r["text"] for r in recovered)
        tot_text = collections.Counter(l[0] for l in lines)
        for t in sorted(tot_text):
            print(f"    {t:<16} {by_text[t]}/{tot_text[t]} "
                  f"= {by_text[t] / tot_text[t]:.1%}")
        print("  NOT recovered, by reason -- reported, not measured:")
        for r, v in reasons.most_common():
            print(f"    {r:<42} {v}")
        print("  metres identified (top 15):")
        for m, v in collections.Counter(
                r["metre"] for r in recovered).most_common(15):
            print(f"    {m:<48} {v}")
        print()
    return lines, recovered


# ---------------------------------------------------------------------------
# THE POSITIVE CONTROL (doctrine 31) AND ITS PARTNER (doctrine 41)
#
# A null is uninterpretable until the instrument has been shown to detect a
# signal it is pointed at. This control is synthetic, needs no second corpus,
# and is built from the measured pādas themselves so that length, phoneme
# inventory and metre are all preserved:
#
#   ARM A  plant dvitīyākṣara-prāsa in a fraction f of the units, by drawing
#          each unit's pādas from the same length pool but CONSTRAINED to
#          share their 2nd-akṣara consonant. The remaining 1-f of units are
#          drawn at random from the same pool, i.e. they are the N3 null.
#          f = 0 therefore reproduces the null exactly, which is the check
#          that the arm is calibrated.
#   ARM B  the same planting at akṣara 3 instead of akṣara 2 -- the
#          same-positions-no-signal arm. V1 must NOT fire on arm B. If it does,
#          V1 is reading a general coincidence rate and not the position it
#          names, and every arm-A pass would have been for the wrong reason.
# ---------------------------------------------------------------------------

def plant(units, by_len, rng, frac, position):
    by_len_pos = {}
    for n, pool in by_len.items():
        d = collections.defaultdict(list)
        for f in pool:
            if position < len(f["onsets"]) and f["onsets"][position]:
                d[f["onsets"][position]].append(f)
        by_len_pos[n] = d
    def maker():
        out = []
        for u in units:
            lens = [f["n"] for f in u]
            if rng.random() < frac:
                shared = set(by_len_pos[lens[0]])
                for n in lens[1:]:
                    shared &= set(by_len_pos[n])
                # only plant where the pools can supply DISTINCT pādas; a unit
                # built from one pāda repeated would agree at every position
                # and would make arm B pass for the wrong reason.
                ok = [c for c in sorted(shared)
                      if sum(len(by_len_pos[n][c]) for n in lens) > len(lens)]
                if ok:
                    c = rng.choice(ok)
                    out.append(_draw_distinct([by_len_pos[n][c]
                                               for n in lens], rng))
                    continue
            out.append(_draw_distinct([by_len[n] for n in lens], rng))
        return out
    return maker


def positive_control(units, by_len, n_rep):
    print("\n" + "=" * 78)
    print("POSITIVE CONTROL -- planted signal, same pādas, same lengths")
    print("=" * 78)
    for position, arm in ((1, "ARM A  planted at akṣara 2 (the rule's own "
                              "position)"),
                          (2, "ARM B  planted at akṣara 3 (doctrine 41: the "
                              "same-positions-no-signal arm)")):
        print(f"\n  {arm}")
        rng0 = random.Random(SEED + 77)
        base = null_table(plant(units, by_len, rng0, 0.0, position), n_rep)
        for frac in (0.0, 0.05, 0.10, 0.20, 0.40):
            rng = random.Random(SEED + 88)
            obs = score_all(plant(units, by_len, rng, frac, position)())
            row = []
            for label in ("V1 dvitiyaksara  aksara 2 all",
                          "V1 dvitiyaksara  aksara 2 share",
                          "V3 aksara-k      searched  all"):
                nl = sorted(base[label])
                o = obs[label]
                beat = sum(1 for x in nl if x >= o - 1e-12)
                p = (beat + 1) / (n_rep + 1)
                row.append(f"{label.split()[0]}={o:6.2%} p={p:.3f}")
            print(f"    planted f={frac:4.0%}   " + "   ".join(row))
        print("      (f=0 is the null itself; p there should sit near 0.5)")


# ---------------------------------------------------------------------------
# A SECOND, REAL-TEXT CONTROL: end-rhyme at the DCS line end.
#
# It needs NO boundary recovery -- the line end is recorded -- so it is
# available on the whole corpus including the Gītagovinda songs that the metre
# filter drops. Jayadeva's aṣṭapadī is the textbook antya-prāsa text and
# Bhāravi's kāvya is not, so the contrast between the two is a real-data check
# on the same rhyme predicate the V4 variants use. Pairs whose final WORDS are
# identical are EXCLUDED: that is REPEAT, not rhyme (doctrine 3), and the
# Gītagovinda's refrain would otherwise carry the arm on its own.
# ---------------------------------------------------------------------------

def lineend_control(root, n_rep):
    print("\n" + "=" * 78)
    print("REAL-TEXT CONTROL -- antya-prāsa between ADJACENT DCS lines")
    print("  (no pāda boundary needed; identical final words EXCLUDED as "
          "REPEAT, doctrine 3)")
    print("=" * 78)
    by_chapter = collections.defaultdict(list)
    for text, chapter, _v, _s, line in load_dcs(root):
        by_chapter[(text, chapter)].append(line)

    def rate_of(chapters):
        hit = judged = 0
        for ls in chapters:
            for a, b in zip(ls, ls[1:]):
                wa, wb = a.split()[-1], b.split()[-1]
                if wa == wb:
                    continue
                judged += 1
                if SAN.antya_prasa([a, b], depth=1)[1] == 1.0:
                    hit += 1
        return hit, judged

    for text in sorted({t for t, _c in by_chapter}):
        chapters = [v for (t, _c), v in by_chapter.items() if t == text]
        hit, judged = rate_of(chapters)
        obs = hit / judged if judged else 0.0
        rng = random.Random(SEED + 5)
        nulls = []
        for _ in range(n_rep):
            shuf = []
            for ls in chapters:
                c = list(ls)
                rng.shuffle(c)
                shuf.append(c)
            h, j = rate_of(shuf)
            nulls.append(h / j if j else 0.0)
        print(f"\n  {text}: {hit}/{judged} = {obs:.2%}")
        report("N1' permute lines/chapter", obs, nulls, n_rep)


# ---------------------------------------------------------------------------
# IS THE POOLED NULL HIDING A POSITIVE IN ONE METRE?
#
# A rate pooled over twenty metres and two poets can be null while one stratum
# carries the constraint. Broken out here -- and with the family-wise cut
# stated, because twenty strata is twenty hypotheses and a per-stratum 0.05
# is not a 0.05 (doctrine 22: state a threshold as a false-positive rate; the
# per-comparison rate is not the family's).
# ---------------------------------------------------------------------------

def by_metre(recovered, cache, n_rep, min_n=25):
    print("\n" + "=" * 78)
    print("V1 dvitīyākṣara BY METRE -- is the pooled null hiding a stratum?")
    print("=" * 78)
    groups = collections.defaultdict(list)
    for r in recovered:
        groups[(r["text"], r["metre"])].append([cache[p] for p in r["padas"]])
    big = {k: v for k, v in groups.items() if len(v) >= min_n}
    m = len(big)
    alpha = 0.05 / m if m else 0.05
    print(f"  strata with n >= {min_n}: {m}   family-wise cut alpha/m = "
          f"{alpha:.4f}   empirical p floor = {1 / (n_rep + 1):.4f}")
    print(f"    {'text / metre':<46}{'n':>5}{'R_obs':>9}{'nullmed':>9}"
          f"{'nullmax':>9}{'p':>8}")
    rows = []
    for key, units in sorted(big.items(), key=lambda kv: -len(kv[1])):
        rng = random.Random(SEED + 3)
        pool = [f for u in units for f in u]
        obs = sum(v_dvitiya(u) for u in units) / len(units)
        nulls = []
        for _ in range(n_rep):
            shuf = list(pool)
            rng.shuffle(shuf)
            it = iter(shuf)
            nulls.append(sum(v_dvitiya([next(it) for _ in u])
                             for u in units) / len(units))
        nulls.sort()
        p = (sum(1 for x in nulls if x >= obs - 1e-12) + 1) / (n_rep + 1)
        rows.append((key, len(units), obs, nulls[len(nulls) // 2],
                     nulls[-1], p))
    for (text, metre), n, obs, med, hi, p in rows:
        mark = "  <== beats alpha/m" if p < alpha else ""
        print(f"    {text[:14] + ' / ' + metre:<46}{n:>5}{obs:>9.2%}"
              f"{med:>9.2%}{hi:>9.2%}{p:>8.4f}{mark}")
    hits = [r for r in rows if r[5] < alpha]
    print(f"  strata clearing the family-wise cut: {len(hits)} of {m}")


# ---------------------------------------------------------------------------
# HOW MUCH DOES THE TEXT LAYER MATTER? -- measured, not argued.
#
# The module docstring says the FORM layer is partially de-sandhied and that
# the anchor should survive it, because de-sandhi rewrites word-FINAL material
# and the anchor is an ONSET. That is an argument. This turns it into a number:
# rebuild every measured pāda from the DCS `Unsandhied` field instead of FORM,
# split at the SAME word index, and count how often the 2nd-akṣara anchor moves.
# ---------------------------------------------------------------------------

def unsandhied_lines(root):
    """-> {(text, chapter, verse, sub): [per-surface-token unsandhied form]}.

    A CoNLL-U multiword range row (`4-5 vanabhuvaḥ`) is ONE surface token in
    the `# text =` line and expands to several unsandhied words, so the
    expansion is joined with a space and the surface token count -- hence the
    word index the pāda split uses -- is preserved."""
    base = os.path.join(root, "dcs", "data", "conllu", "files")
    out = {}
    for path in sorted(glob.glob(os.path.join(base, "*", "*.conllu"))):
        text = os.path.basename(os.path.dirname(path))
        chapter = os.path.basename(path)
        verse = sub = None
        toks, skip_to = [], 0
        rows = []

        def flush():
            if verse is not None and sub is not None and toks:
                out[(text, chapter, verse, sub)] = list(toks)

        for raw in open(path, encoding="utf-8"):
            if raw.startswith("# text = "):
                flush()
                toks, rows, skip_to, verse, sub = [], [], 0, None, None
            elif raw.startswith("# sent_counter = "):
                verse = raw.split("=", 1)[1].strip()
            elif raw.startswith("# sent_subcounter = "):
                sub = raw.split("=", 1)[1].strip()
            elif raw[:1].isdigit():
                rows.append(raw.rstrip("\n").split("\t"))
                if len(rows[-1]) < 10:
                    continue
                ident, form, misc = rows[-1][0], rows[-1][1], rows[-1][9]
                if "-" in ident:
                    a, b = (int(x) for x in ident.split("-"))
                    toks.append([ident, form, []])
                    skip_to = b
                    continue
                uns = form
                for kv in misc.split("|"):
                    if kv.startswith("Unsandhied="):
                        uns = kv[len("Unsandhied="):]
                if int(ident) <= skip_to and toks and toks[-1][2] is not None:
                    toks[-1][2].append(uns)
                else:
                    toks.append([ident, form, [uns]])
        flush()
    return {k: [" ".join(t[2]) if t[2] else t[1] for t in v]
            for k, v in out.items()}


def layer_sensitivity(root, recovered):
    print("\n" + "=" * 78)
    print("TEXT LAYER -- FORM (measured) vs Unsandhied (the padapāṭha layer)")
    print("=" * 78)
    uns = unsandhied_lines(root)
    moved_n = moved_anchor = moved_end = comparable = 0
    alt_units, form_units = [], []
    for r in recovered:
        key = (r["text"], r["chapter"], r["verse"], r["sub"])
        toks = uns.get(key)
        if not toks or len(toks) != len(r["line"].split()):
            continue
        k = len(r["padas"][0].split())
        a, b = " ".join(toks[:k]), " ".join(toks[k:])
        if not a.strip() or not b.strip():
            continue
        pair_f = [features(p) for p in r["padas"]]
        pair_a = [features(p) for p in (a, b)]
        comparable += 1
        for f, g in zip(pair_f, pair_a):
            if f["n"] != g["n"]:
                moved_n += 1
            fa = f["onsets"][1] if len(f["onsets"]) > 1 else None
            ga = g["onsets"][1] if len(g["onsets"]) > 1 else None
            if fa != ga:
                moved_anchor += 1
            if f["end1"] != g["end1"]:
                moved_end += 1
        form_units.append(pair_f)
        alt_units.append(pair_a)
    if not comparable:
        print("  no comparable lines")
        return
    p = comparable * 2
    print(f"  comparable half-verses {comparable}  ({p} pādas)")
    print(f"    akṣara COUNT differs between layers   {moved_n:5d} = "
          f"{moved_n / p:6.2%}")
    print(f"    2nd-akṣara ANCHOR differs             {moved_anchor:5d} = "
          f"{moved_anchor / p:6.2%}   <- the number the choice of layer costs")
    print(f"    line-final RHYME KEY differs          {moved_end:5d} = "
          f"{moved_end / p:6.2%}")
    fs, as_ = score_all(form_units), score_all(alt_units)
    print("  the same rules scored on each layer:")
    for label, _fn, _kind in VARIANTS:
        print(f"    {label:<34} FORM {fs[label]:7.3%}   "
              f"Unsandhied {as_[label]:7.3%}   Δ {as_[label] - fs[label]:+7.3%}")


# ---------------------------------------------------------------------------

def build_units(recovered):
    """-> (cache, half, half_meta, verse_units, verse_meta, by_len).

    Extracted from `main()` UNCHANGED so `measure()` can build the identical
    units without drawing a single null. A `--check` that rebuilt the units by
    its own slightly different route would be checking its own arithmetic.
    """
    cache = {}
    for r in recovered:
        for p in r["padas"]:
            if p not in cache:
                cache[p] = features(p)

    half = [[cache[p] for p in r["padas"]] for r in recovered]
    half_meta = [(r["text"], r["metre"]) for r in recovered]

    byverse = collections.defaultdict(dict)
    for r in recovered:
        byverse[(r["text"], r["chapter"], r["verse"])][r["sub"]] = r
    verse_units, verse_meta = [], []
    for _key, subs in sorted(byverse.items()):
        if "1" in subs and "2" in subs and subs["1"]["metre"] == subs["2"]["metre"]:
            a, b = subs["1"], subs["2"]
            verse_units.append([cache[p] for p in a["padas"] + b["padas"]])
            verse_meta.append((a["text"], a["metre"]))

    by_len = collections.defaultdict(list)
    for f in cache.values():
        by_len[f["n"]].append(f)
    return cache, half, half_meta, verse_units, verse_meta, by_len


def main(root, n_rep=1000, stage=False, controls=True):
    lines, recovered = build(root)
    if stage:
        return stage_slice(recovered, lines)

    cache, half, half_meta, verse_units, verse_meta, by_len = \
        build_units(recovered)

    dis = end_dis = 0
    for r in recovered:
        best, share, _a = SAN.prasa(r["padas"])
        u = [cache[p] for p in r["padas"]]
        if (v_dvitiya(u) == 1.0) != (share == 1.0 and best is not None):
            dis += 1
        if abs(v_dvitiya_share(u) - share) > 1e-12:
            dis += 1
        for depth, key in ((1, "end1"), (2, "end2")):
            _b, _s, keys = SAN.antya_prasa(r["padas"], depth=depth)
            if [cache[p][key] for p in r["padas"]] != keys:
                end_dis += 1
    print(f"self-check: V1 vs san.prasa() disagreements = {dis}; "
          f"end key vs san.antya_prasa() disagreements = {end_dis} "
          f"(both must be 0 -- the cache exists only so the nulls can be "
          f"scored without re-entering san for every one of millions of "
          f"replicate pādas; the numbers are san's own)")
    if dis or end_dis:
        sys.exit("cache disagrees with san.py; refusing to report a rate.")

    for uname, units, meta in (("half-verse (2 pādas)", half, half_meta),
                               ("verse (4 pādas)", verse_units, verse_meta)):
        if not units:
            continue
        print("\n" + "=" * 78)
        print(f"UNIT: {uname}   n = {len(units)}")
        nwords = [f["nwords"] for u in units for f in u]
        one = sum(1 for x in nwords if x == 1)
        print(f"  pādas {len(nwords)}   mean words/pāda "
              f"{sum(nwords) / len(nwords):.2f}   single-word pādas "
              f"(N2 is a no-op on those) {one} = {one / len(nwords):.1%}")
        ks = [_k_of(u) for u in units]
        print(f"  V3 searches a mean of {sum(ks) / len(ks):.1f} positions per "
              f"unit -- doctrine 56, that is k hypotheses per unit")
        strata = collections.defaultdict(list)
        for i, u in enumerate(units):
            for j, f in enumerate(u):
                strata[(meta[i][0], f["n"], j % 2)].append((i, j))
        sizes = sorted(len(v) for v in strata.values())
        print(f"  N1 strata (text, pāda length, parity): {len(strata)}   "
              f"sizes min {sizes[0]} med {sizes[len(sizes) // 2]} "
              f"max {sizes[-1]}")
        print("=" * 78)

        print_state_counts(units, uname)

        obs = score_all(units)
        print(f"  running {3 * n_rep} null replicates ...")
        n1 = null_table(make_permute(units, strata, random.Random(SEED)),
                        n_rep)
        n2 = null_table(make_shuffle_words(units, random.Random(SEED + 1)),
                        n_rep)
        n3 = null_table(make_resample(units, by_len, random.Random(SEED + 2)),
                        n_rep)

        rows = []
        for label, _fn, kind in VARIANTS:
            o = obs[label]
            cnt = (f"({round(o * len(units))}/{len(units)})"
                   if kind == "binary" else "(mean share)")
            print(f"\n  {label}   R_obs = {o:.3%} {cnt}")
            report("N1 permute padas", o, n1[label], n_rep)
            report("N2 shuffle words in pada", o, n2[label], n_rep)
            report("N3 resample by length", o, n3[label], n_rep)
            m1 = sorted(n1[label])[n_rep // 2]
            m2 = sorted(n2[label])[n_rep // 2]
            rows.append((label, o, m1, m2,
                         o / m1 if m1 else float("inf"),
                         o / m2 if m2 else float("inf")))

        print(f"\n  LIFT TABLE -- {uname}. Doctrine 61: pick by lift, never "
              f"by yield.")
        print(f"    {'variant':<34}{'R_obs':>9}{'N1 med':>9}{'lift':>7}"
              f"{'N2 med':>9}{'lift':>7}")
        for label, o, m1, m2, l1, l2 in sorted(rows, key=lambda r: -r[1]):
            print(f"    {label:<34}{o:>9.2%}{m1:>9.2%}{l1:>7.2f}"
                  f"{m2:>9.2%}{l2:>7.2f}")

        depths = []
        for u in units:
            last = [f["text"].split()[-1] for f in u]
            depths.append(min(SAN.prasa_depth(last[0], x) or 0
                              for x in last[1:]))
        hist = collections.Counter(depths)
        print(f"\n  antya-prāsa depth (san.prasa_depth: shared trailing "
              f"PHONEMES, min over the unit)")
        for d in sorted(hist):
            print(f"      {d:2d} phonemes {hist[d]:5d} = "
                  f"{hist[d] / len(depths):6.2%}")

    if controls:
        positive_control(half, by_len, n_rep)
        by_metre(recovered, cache, n_rep)
        lineend_control(root, min(n_rep, 200))
        layer_sensitivity(root, recovered)


HEADER = """\
# san_dcs_verse.txt -- Sanskrit verse slice, with PĀDA BOUNDARIES RECOVERED
#
# SOURCE      Digital Corpus of Sanskrit (DCS).
# ATTRIBUTION Oliver Hellwig: Digital Corpus of Sanskrit (DCS). 2010-2021.
# LICENCE     CC BY 4.0   (SPDX: CC-BY-4.0)
#             The CC BY 4.0 grant covers Hellwig's digitisation and annotation,
#             which is the layer reproduced here. The attribution line above is
#             required by that licence and must travel with any copy.
# WORKS       Kirātārjunīya (Bhāravi, 6th c. CE); Gītagovinda (Jayadeva,
#             12th c. CE). Both are many centuries out of any copyright term;
#             the licence applies to the modern corpus, not to the verse.
# UPSTREAM    https://github.com/OliverHellwig/sanskrit
#             path dcs/data/conllu/files/   SPARSE CHECKOUT, LOAD-BEARING:
#             the sibling tree corpus/GRETIL/ in the same repository is
#             CC BY-NC-SA and is NOT fetched and NOT reproduced here.
#               git clone --depth 1 --filter=blob:none --sparse \\
#                   https://github.com/OliverHellwig/sanskrit
#               git -C sanskrit sparse-checkout set --cone \\
#                   dcs/data/conllu/files
#
# WHAT THIS SLICE IS
#   One row per DCS `# text =` half-verse whose PĀDA BOUNDARY was positively
#   recovered by quality/prasa_rate.py. The split is the unique word index
#   holding N/2 akṣaras (or the odd pāda's length for an ardhasama metre),
#   confirmed either by both pādas matching a named metre template
#   (criterion 'named') or by the two pādas scanning identically up to the
#   anceps final (criterion 'selfsim'). Half-verses with no identified metre,
#   or where a word straddles the boundary, are NOT here; the run prints their
#   counts by reason.
#
# TEXT LAYER  the DCS `# text =` FORM layer: word-segmented and partially
#             de-sandhied (sandhi retained on 17.2% of Kirātārjunīya tokens
#             and 4.4% of Gītagovinda's). It is NOT the pure saṃhitā metrical
#             surface; it is the only layer that supplies word boundaries.
# NOTATION    IAST, Unicode NFC, lowercase. 0 combining marks, 0 non-NFC lines.
#
# COLUMNS, tab separated
#   text | chapter file | verse | half | metre | criterion | pada1 " | " pada2
# The ' | ' inside the last column is the RECOVERED pāda boundary. It is this
# file's contribution and it is NOT in the DCS.
"""


def stage_slice(recovered, lines):
    out = os.path.abspath(os.path.join(HERE, "..", "corpus",
                                       "san_dcs_verse.txt"))
    with open(out, "w", encoding="utf-8") as fh:
        fh.write(HEADER)
        fh.write(f"#\n# ROWS  {len(recovered)} of {len(lines)} DCS "
                 f"`# text =` lines\n#\n")
        for r in recovered:
            fh.write("\t".join([r["text"], r["chapter"], r["verse"],
                                r["sub"], r["metre"], r["criterion"],
                                " | ".join(r["padas"])]) + "\n")
    print(f"\nstaged {len(recovered)} half-verses -> {out}")
    print("doctrine 34: this file needs a row in data/sources.tsv. This cell "
          "is forbidden to edit that file; the row text is in the report.")
    return out


# ---------------------------------------------------------------------------
# `--check` -- THE COMMITTED FIGURES, so a drift goes red instead of a human
# being expected to read a 300-line report off the screen and compare.
#
# Until 2026-08-14 this runner printed its rates, its three nulls, its positive
# control and its layer table and EXITED 0 whichever way every one of them
# came out. It is the eighth instrument of that shape found in one session,
# after audit_spans, audit_corpus, audit_tang_null, audit_kalevala_null,
# canon_sources (twice) and audit_hafez_radif. Doctrine 48: a principle that
# lives only in prose gets followed exactly as often as somebody remembers it.
#
# MEASURED 2026-08-14, and -- as with the Hafez arm and unlike the Tang and
# Kalevala ones -- NOTHING HAD DRIFTED. Every figure `data/sources.tsv:91`
# publishes reproduces exactly: 1930/2771 half-verses recovered, V1 firing on
# 135/1930 = 6.995%, 0 of 816 at the verse unit, 16 per-metre strata at n>=25,
# Gītagovinda's line-end antya-prāsa at 179/680 = 26.32%, and the layer table's
# 42.60% / 27.45% / 5.01%. So there is no repin here -- THE PIN IS THE FINDING,
# because the numbers were previously true by nobody's checking.
#
# TWO INPUTS, AND THE CHEAP ONE IS THE ONE CI CAN RUN.
#   `--check`        reads `corpus/san_dcs_verse.txt`, the slice this runner
#                    itself stages, which is IN THIS REPOSITORY and carries all
#                    1930 recovered half-verses with their pāda boundaries. No
#                    15,900-file external checkout needed. Doctrine 34 staged
#                    that file exactly so the result could be re-run, and until
#                    now nothing ever re-ran it.
#   `--check ROOT`   additionally re-derives the INGESTION-side figures from
#                    the DCS itself -- the 2771 `# text =` lines, the 841
#                    not-recovered reasons, the Unsandhied layer table and the
#                    line-end control -- none of which the slice can supply,
#                    because the slice is by construction the half that was
#                    recovered.
# A slice-only run prints the root-only figures as SKIP, never as [ok]. A check
# that silently reported PASS on a smaller question than it was asked is the
# decoration this whole exercise exists to remove.
#
# WHAT IS PINNED, AND WHAT IS DELIBERATELY NOT.
#   PINNED: counts. Every one is EXACT over a fixed corpus at a fixed rule --
#   recovery counts, the doctrine 79 triples per variant per unit, the strata
#   structure, the line-end hits and the layer-sensitivity counts. They are
#   pinnable because re-running them cannot return a different number.
#   NOT PINNED: every null median, min, max, lift and empirical p; the positive
#   control's planted-detection rates; and the "0 of 16 strata clear alpha/m"
#   line, which is a statement about 16 Monte Carlo p-values. Those ride a
#   permutation draw, and doctrine 57 says an empirical p at 1/(n+1) reports
#   the RESOLUTION and not the effect -- pinning a sample would fail on the
#   seed and pass on nothing. Same call `audit_tang_null.py`,
#   `audit_kalevala_null.py` and `audit_hafez_radif.py` all make.
#
# Doctrine 58: these are counts, and a count is a coordinate of a threshold AND
# of a rendering (doctrine 91). Argue them and repin with the superseded value
# visible and dated (doctrine 17); do not tune `recover()` or `features()` to
# meet them.
# ---------------------------------------------------------------------------

DEFAULT_SLICE = os.path.abspath(os.path.join(HERE, "..", "corpus",
                                             "san_dcs_verse.txt"))

#: Keys that only a `--check ROOT` run can supply. A slice-only run must SKIP
#: these, never quietly pass them.
ROOT_ONLY = ("dcs_lines", "not_recovered", "reason_odd_length",
             "reason_straddle", "layer_comparable", "layer_moved_aksara_count",
             "layer_moved_anchor", "layer_moved_end_key",
             "lineend_Gitagovinda", "lineend_Kiratarjuniya")

PINNED = {
    # -- recovery, from the slice ------------------------------------------
    "recovered": 1930,
    "criterion_named": 1907,
    "criterion_selfsim": 23,
    "recovered_Gitagovinda": 53,
    "recovered_Kiratarjuniya": 1877,
    "half_units": 1930,
    "verse_units": 816,
    "single_word_padas": 267,
    "n1_strata_half": 30,
    "strata_ge25": 16,
    "strata_ge25_units": 1841,
    "strata_ge25_carrying": 130,

    # -- doctrine 79, THREE COUNTS + the numerator, per variant per unit ----
    #    (mandated, judged, refused, carrying). NEVER SUMMED, and `refused` is
    #    pinned in its own right: V1's 2 is the number that says the headline
    #    rate is safe, and V2's 592 is the number that says the collapse is
    #    real. If a re-ingestion starts refusing differently, the published
    #    rate would slide while `carrying` alone still matched.
    "counts79": {
        "half-verse (2 pādas)": {
            "V1 dvitiyaksara  aksara 2 all": (1930, 1928, 2, 135),
            "V2 adyaksara     aksara 1 all": (1930, 1338, 592, 141),
            "V3 aksara-k      searched  all": (1930, 1930, 0, 1128),
            "V4 antya-prasa   depth 1   all": (1930, 1930, 0, 28),
            "V4 antya-prasa   depth 2   all": (1930, 1808, 122, 0),
            "V5 free anuprasa any word  all": (1930, 1812, 118, 737),
        },
        "verse (4 pādas)": {
            "V1 dvitiyaksara  aksara 2 all": (816, 814, 2, 0),
            "V2 adyaksara     aksara 1 all": (816, 407, 409, 2),
            "V3 aksara-k      searched  all": (816, 816, 0, 14),
            "V4 antya-prasa   depth 1   all": (816, 816, 0, 0),
            "V4 antya-prasa   depth 2   all": (816, 722, 94, 0),
            "V5 free anuprasa any word  all": (816, 717, 99, 23),
        },
    },

    # -- DOCTRINE 28, and the zeros are the reason this block exists --------
    #    `data/sources.tsv:91` publishes "at the 4-pāda verse unit it fires on
    #    0 of 816". A bare 0 is exactly the figure doctrine 28 says must be
    #    resolved, because it has two completely different readings: NONE (the
    #    verses were asked and none carries prāsa) or CANNOT TELL (the
    #    instrument could not ask). MEASURED: 814 of the 816 were JUDGED and 2
    #    REFUSED, so the zero is a REAL NONE over 814 judged verses, not an
    #    artefact of refusal. Same determination for V4 depth 2, which reads 0
    #    at BOTH units over 1808 and 722 judged, and for the malini stratum's
    #    0 of 26, which has 0 refusals. Recorded as its own pin so the
    #    determination survives the next reader.
    "verse_V1_zero_is_over_judged": 814,
    "malini_n": 26,
    "malini_refused": 0,
    "malini_carrying": 0,

    # -- root-only: ingestion, layer and line-end control --------------------
    "dcs_lines": 2771,
    "not_recovered": 841,
    "reason_odd_length": 357,
    "reason_straddle": 315,
    "layer_comparable": 1858,
    "layer_moved_aksara_count": 1583,
    "layer_moved_anchor": 186,
    "layer_moved_end_key": 1020,
    #: (hit, judged) with identical final WORDS excluded as REPEAT (doctrine 3).
    #: The 6.16x lift this repo quotes is hit/judged over a null MAX and only
    #: the numerator and denominator are pinnable.
    "lineend_Gitagovinda": (179, 680),
    "lineend_Kiratarjuniya": (52, 2059),
}


def read_slice(path):
    """-> the same `recovered` shape `build()` returns, from the staged slice.

    The slice is this runner's OWN output, so reading it back re-derives every
    per-pāda feature from the same strings `build()` would have handed on. What
    it cannot re-derive is anything about the half-verses that were NOT
    recovered -- they are not in the file -- which is exactly the ROOT_ONLY set.
    """
    out = []
    for raw in open(path, encoding="utf-8"):
        if raw.startswith("#") or not raw.strip():
            continue
        f = raw.rstrip("\n").split("\t")
        if len(f) < 7:
            continue
        out.append({"text": f[0], "chapter": f[1], "verse": f[2], "sub": f[3],
                    "line": " ".join(f[6].split(" | ")), "metre": f[4],
                    "criterion": f[5], "padas": f[6].split(" | ")})
    return out


def measure(root=None, slice_path=None):
    """-> the deterministic figures ONLY. Draws no null and touches no RNG.

    `check` does not read a null, so it does not pay for one: a full `main()`
    run is 3000 replicates per unit plus a positive control, and none of that
    can be pinned anyway (doctrine 57).
    """
    m = {}
    if root:
        lines, recovered = build(root, verbose=False)
        m["dcs_lines"] = len(lines)
        reasons = collections.Counter()
        for _t, _c, _v, _s, line in lines:
            padas, why, _crit = recover(line)
            if padas is None:
                reasons[why] += 1
        m["not_recovered"] = sum(reasons.values())
        m["reason_odd_length"] = reasons["odd length, no ardhasama match"]
        m["reason_straddle"] = reasons["word straddles the pada boundary"]
    else:
        recovered = read_slice(slice_path or DEFAULT_SLICE)

    m["recovered"] = len(recovered)
    crit = collections.Counter(r["criterion"] for r in recovered)
    m["criterion_named"] = crit["named"]
    m["criterion_selfsim"] = crit["selfsim"]
    bytext = collections.Counter(r["text"] for r in recovered)
    m["recovered_Gitagovinda"] = bytext["Gītagovinda"]
    m["recovered_Kiratarjuniya"] = bytext["Kirātārjunīya"]

    cache, half, half_meta, verse_units, _vm, _bl = build_units(recovered)
    m["half_units"] = len(half)
    m["verse_units"] = len(verse_units)
    nwords = [f["nwords"] for u in half for f in u]
    m["single_word_padas"] = sum(1 for x in nwords if x == 1)
    strata = collections.defaultdict(list)
    for i, u in enumerate(half):
        for j, f in enumerate(u):
            strata[(half_meta[i][0], f["n"], j % 2)].append((i, j))
    m["n1_strata_half"] = len(strata)

    m["counts79"] = {"half-verse (2 pādas)": state_counts(half),
                     "verse (4 pādas)": state_counts(verse_units)}
    m["verse_V1_zero_is_over_judged"] = \
        m["counts79"]["verse (4 pādas)"]["V1 dvitiyaksara  aksara 2 all"][1]

    groups = collections.defaultdict(list)
    for r in recovered:
        groups[(r["text"], r["metre"])].append([cache[p] for p in r["padas"]])
    big = {k: v for k, v in groups.items() if len(v) >= 25}
    m["strata_ge25"] = len(big)
    m["strata_ge25_units"] = sum(len(v) for v in big.values())
    m["strata_ge25_carrying"] = sum(int(sum(v_dvitiya(u) for u in v))
                                    for v in big.values())
    mal = groups.get(("Kirātārjunīya", "malini"), [])
    m["malini_n"] = len(mal)
    m["malini_refused"] = sum(1 for u in mal
                              if agree_state(u, 1) == REFUSED)
    m["malini_carrying"] = int(sum(v_dvitiya(u) for u in mal))

    if root:
        uns = unsandhied_lines(root)
        moved_n = moved_anchor = moved_end = comparable = 0
        for r in recovered:
            toks = uns.get((r["text"], r["chapter"], r["verse"], r["sub"]))
            if not toks or len(toks) != len(r["line"].split()):
                continue
            k = len(r["padas"][0].split())
            a, b = " ".join(toks[:k]), " ".join(toks[k:])
            if not a.strip() or not b.strip():
                continue
            comparable += 1
            for f, g in zip([features(p) for p in r["padas"]],
                            [features(p) for p in (a, b)]):
                moved_n += f["n"] != g["n"]
                fa = f["onsets"][1] if len(f["onsets"]) > 1 else None
                ga = g["onsets"][1] if len(g["onsets"]) > 1 else None
                moved_anchor += fa != ga
                moved_end += f["end1"] != g["end1"]
        m["layer_comparable"] = comparable
        m["layer_moved_aksara_count"] = moved_n
        m["layer_moved_anchor"] = moved_anchor
        m["layer_moved_end_key"] = moved_end

        by_chapter = collections.defaultdict(list)
        for text, chapter, _v, _s, line in load_dcs(root):
            by_chapter[(text, chapter)].append(line)
        for text, key in (("Gītagovinda", "lineend_Gitagovinda"),
                          ("Kirātārjunīya", "lineend_Kiratarjuniya")):
            hit = judged = 0
            for (t, _c), ls in by_chapter.items():
                if t != text:
                    continue
                for a, b in zip(ls, ls[1:]):
                    if a.split()[-1] == b.split()[-1]:
                        continue          # REPEAT, not rhyme (doctrine 3)
                    judged += 1
                    hit += SAN.antya_prasa([a, b], depth=1)[1] == 1.0
            m[key] = (hit, judged)
    return m


def check(m, rooted):
    """-> exit code. 0 pass / 1 a figure moved / 2 cannot tell.

    FAILS LOUDLY; it does not report and continue. And it does not report PASS
    on a question it did not ask -- a slice-only run SKIPS the root-only rows
    by name rather than counting them clean.
    """
    print()
    print("=" * 74)
    print("CHECK -- the committed prāsa figures against this run")
    print("=" * 74)
    print(f"  input: {'DCS checkout (full)' if rooted else DEFAULT_SLICE}")
    if not rooted:
        print("  slice-only: the ingestion, layer and line-end rows below are "
              "SKIPPED, not passed.")
    print()
    bad = skipped = 0

    def row(k, want, have):
        nonlocal bad
        ok = have == want
        bad += not ok
        print(f"  [{'ok  ' if ok else 'FAIL'}] {k:28s} committed {want}"
              + ("" if ok else f", measured {have}"))

    for k in ("recovered", "criterion_named", "criterion_selfsim",
              "recovered_Gitagovinda", "recovered_Kiratarjuniya",
              "half_units", "verse_units", "single_word_padas",
              "n1_strata_half", "strata_ge25", "strata_ge25_units",
              "strata_ge25_carrying", "verse_V1_zero_is_over_judged",
              "malini_n", "malini_refused", "malini_carrying"):
        row(k, PINNED[k], m.get(k))

    print()
    print("  doctrine 79 -- (mandated, judged, refused, carrying) per variant. "
          "THREE COUNTS,")
    print("  NEVER SUMMED. `refused` is pinned in its own right: a re-ingestion "
          "that starts")
    print("  refusing differently slides the published rate while `carrying` "
          "still matches.")
    for uname, table in PINNED["counts79"].items():
        print(f"    {uname}")
        got = (m.get("counts79") or {}).get(uname, {})
        for label, want in table.items():
            have = got.get(label)
            ok = have == want
            bad += not ok
            print(f"      [{'ok  ' if ok else 'FAIL'}] {label:34s} committed "
                  f"{want}" + ("" if ok else f", measured {have}"))

    print()
    for k in ROOT_ONLY:
        if not rooted:
            skipped += 1
            print(f"  [SKIP] {k:28s} committed {PINNED[k]}   "
                  f"(needs the DCS checkout)")
        else:
            row(k, PINNED[k], m.get(k))

    print()
    print("  NOT PINNED, on purpose (doctrine 57): every null median/min/max, "
          "every lift,")
    print("  every empirical p, the positive control's planted rates, and the "
          "per-metre")
    print("  family-wise verdict -- all ride a permutation draw, so a pin would "
          "fail on the")
    print("  seed and pass on nothing. Read them off a full run.")

    if bad:
        print()
        print(f"  {bad} figure(s) moved. The DCS checkout, the metre table, the "
              f"pāda-boundary")
        print("  recovery or san.py's scansion has changed under this arm.")
        print("  Repin with the date and keep the superseded value visible "
              "(doctrine 17).")
        print("  data/sources.tsv:90 and :91 quote these numbers and would need "
              "the same repin.")
    if skipped:
        print(f"\n  {skipped} row(s) SKIPPED -- rerun as "
              f"`prasa_rate.py --check ROOT` to check them.")
    print()
    print("RESULT:", "PASS" if not bad else "FAIL")
    return 0 if not bad else 1


if __name__ == "__main__":
    if "--check" in sys.argv:
        argv = [a for a in sys.argv[1:] if a != "--check"]
        root = argv[0] if argv else None
        # DOCTRINE 20/28: "cannot tell" is not "pass" and is not "fail", so it
        # gets its own exit code. A caller in a pipeline has to be able to tell
        # a figure that MOVED (1) from an input that was never there (2) --
        # collapsing them would report a missing corpus as a drifted number.
        if root and not os.path.isdir(os.path.join(root, "dcs", "data",
                                                   "conllu", "files")):
            print(f"CANNOT TELL: no DCS checkout at {root!r}. Run `--check` "
                  f"with no argument to check the staged slice, or see the "
                  f"module docstring for the fetch.")
            print("RESULT: CANNOT TELL")
            sys.exit(2)
        if not root and not os.path.isfile(DEFAULT_SLICE):
            print(f"CANNOT TELL: the staged slice {DEFAULT_SLICE!r} is "
                  f"missing. Restage it with `prasa_rate.py ROOT --stage`.")
            print("RESULT: CANNOT TELL")
            sys.exit(2)
        sys.exit(check(measure(root=root), rooted=bool(root)))
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    _rest = sys.argv[2:]
    main(sys.argv[1],
         n_rep=int(_rest[0]) if _rest and _rest[0].isdigit() else 1000,
         stage="--stage" in _rest,
         controls="--no-controls" not in _rest)
