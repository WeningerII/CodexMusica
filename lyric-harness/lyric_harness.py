#!/usr/bin/env python3
"""
Lyric Harness MVP
Declaration-driven rhyme engine: transcribe, anchor, score, candidates,
check_meter, check_scheme, plus value-layer flags (cliche, repeat,
rime riche, shared suffix, semirhyme).

Every operation runs against an explicit DECLARATION. No hidden defaults:
the declaration prints with every report.

Data files expected beside this script (auto-downloaded by fetch_data()):
  cmudict.dict   - CMU Pronouncing Dictionary (General American citation forms)
  wordfreq20k.txt - 20k common-word list, rank order (candidate filtering)
"""

import json
import os
import re
import sys
import urllib.request
from dataclasses import dataclass, field, asdict

_KNOWN_WORDS = set()   # populated by Lexicon; used by the suffix stem check

HERE = os.path.dirname(os.path.abspath(__file__))
CMUDICT_PATH = os.path.join(HERE, "cmudict.dict")
FREQ_PATH = os.path.join(HERE, "wordfreq20k.txt")

CMUDICT_URL = "https://raw.githubusercontent.com/cmusphinx/cmudict/master/cmudict.dict"
FREQ_URL = "https://raw.githubusercontent.com/first20hours/google-10000-english/master/20k.txt"


def fetch_data():
    for path, url in ((CMUDICT_PATH, CMUDICT_URL), (FREQ_PATH, FREQ_URL)):
        if not os.path.exists(path):
            print(f"downloading {os.path.basename(path)} ...", file=sys.stderr)
            urllib.request.urlretrieve(url, path)


# ---------------------------------------------------------------------------
# Phoneme feature tables (exposed, editable: this IS part of the declaration)
# ---------------------------------------------------------------------------

# Vowels: (height 0=high..1=low, frontness 0=front..1=back, round, glide, rhotic)
VOWELS = {
    "IY": (0.00, 0.05, 0, "",  0), "IH": (0.15, 0.15, 0, "",  0),
    "EY": (0.30, 0.10, 0, "j", 0), "EH": (0.50, 0.20, 0, "",  0),
    "AE": (0.80, 0.25, 0, "",  0), "AA": (1.00, 0.85, 0, "",  0),
    "AO": (0.80, 0.95, 1, "",  0), "OW": (0.35, 0.90, 1, "w", 0),
    "UH": (0.20, 0.80, 1, "",  0), "UW": (0.05, 0.95, 1, "",  0),
    "AH": (0.55, 0.60, 0, "",  0), "ER": (0.45, 0.50, 0, "",  1),
    "AY": (1.00, 0.40, 0, "j", 0), "AW": (1.00, 0.50, 0, "w", 0),
    "OY": (0.60, 0.90, 1, "j", 0),
}

# Consonants: (voiced, place 0=labial..1=glottal, manner)
CONSONANTS = {
    "P": (0, 0.00, "stop"), "B": (1, 0.00, "stop"),
    "T": (0, 0.30, "stop"), "D": (1, 0.30, "stop"),
    "K": (0, 0.80, "stop"), "G": (1, 0.80, "stop"),
    "CH": (0, 0.45, "affricate"), "JH": (1, 0.45, "affricate"),
    "F": (0, 0.10, "fricative"), "V": (1, 0.10, "fricative"),
    "TH": (0, 0.20, "fricative"), "DH": (1, 0.20, "fricative"),
    "S": (0, 0.30, "fricative"), "Z": (1, 0.30, "fricative"),
    "SH": (0, 0.45, "fricative"), "ZH": (1, 0.45, "fricative"),
    "HH": (0, 1.00, "fricative"),
    "M": (1, 0.00, "nasal"), "N": (1, 0.30, "nasal"), "NG": (1, 0.80, "nasal"),
    "L": (1, 0.30, "liquid"), "R": (1, 0.35, "liquid"),
    "W": (1, 0.90, "glide"), "Y": (1, 0.60, "glide"),
}

MANNER_DIST = {
    ("stop", "stop"): 0.0, ("fricative", "fricative"): 0.0,
    ("affricate", "affricate"): 0.0, ("nasal", "nasal"): 0.0,
    ("liquid", "liquid"): 0.0, ("glide", "glide"): 0.0,
    ("stop", "affricate"): 0.30, ("fricative", "affricate"): 0.25,
    ("stop", "fricative"): 0.50, ("nasal", "stop"): 0.50,
    ("liquid", "glide"): 0.40, ("nasal", "liquid"): 0.60,
    ("nasal", "glide"): 0.70, ("nasal", "fricative"): 0.70,
    ("stop", "liquid"): 0.85, ("stop", "glide"): 0.90,
    ("fricative", "liquid"): 0.80, ("fricative", "glide"): 0.85,
    ("affricate", "nasal"): 0.70, ("affricate", "liquid"): 0.85,
    ("affricate", "glide"): 0.90,
}

# Legal onsets for syllabification (single consonants always legal)
LEGAL_ONSETS = {
    ("P", "R"), ("P", "L"), ("B", "R"), ("B", "L"), ("T", "R"), ("T", "W"),
    ("D", "R"), ("D", "W"), ("K", "R"), ("K", "L"), ("K", "W"), ("K", "Y"),
    ("G", "R"), ("G", "L"), ("G", "W"), ("F", "R"), ("F", "L"), ("F", "Y"),
    ("TH", "R"), ("SH", "R"), ("HH", "Y"), ("M", "Y"), ("N", "Y"),
    ("V", "Y"), ("B", "Y"), ("P", "Y"), ("S", "T"), ("S", "P"), ("S", "K"),
    ("S", "L"), ("S", "M"), ("S", "N"), ("S", "W"), ("S", "F"), ("S", "Y"),
    ("S", "T", "R"), ("S", "P", "R"), ("S", "K", "R"), ("S", "P", "L"),
    ("S", "K", "W"), ("S", "K", "Y"), ("S", "P", "Y"), ("S", "T", "Y"),
}

# pronouns/articles/copulas: weak everywhere, even phrase-final ("spit in it")
WEAK_ALWAYS = {
    "a", "an", "the", "it", "of", "and", "or", "'em", "i'm", "its",
}
# prepositions/particles: weak mid-phrase, STRESSED phrase-final ("lips off")
WEAK_NONFINAL = {
    "in", "on", "to", "at", "for", "with", "up", "off", "out", "down",
    "back", "by", "from", "is", "am", "are", "was", "be", "as", "so",
    "but", "if", "i", "this", "that", "my", "his", "her", "them", "your",
    "you", "he", "she", "we", "they", "me", "him", "us",
}

SUFFIXES = [
    "ation", "ition", "ology", "ability", "iness", "fully",
    "tion", "sion", "ment", "ness", "ing", "ity", "ous", "ily",
    "ed", "er", "es", "ly", "s",
]

CLICHE_PAIRS = {
    frozenset(p) for p in [
        ("fire", "desire"), ("love", "above"), ("heart", "apart"),
        ("pain", "rain"), ("cry", "die"), ("night", "light"),
        ("eyes", "skies"), ("girl", "world"), ("dance", "chance"),
        ("real", "feel"), ("way", "day"), ("go", "know"),
        ("true", "you"), ("baby", "crazy"), ("streets", "beats"),
        ("flow", "dough"), ("money", "honey"), ("sun", "fun"),
        ("alone", "phone"), ("tears", "years"), ("dreams", "seems"),
        ("soul", "whole"), ("mind", "find"), ("time", "rhyme"),
        ("free", "me"), ("high", "sky"), ("road", "load"),
        ("wrong", "strong"), ("game", "same"), ("cash", "stash"),
    ]
}


# Channel profiles: a scheme constraint is not one scalar — it can bind
# individual channels. assonance = nucleus-only (Old French laisse);
# rawi = final consonant identity, vowels free (Arabic qafiya core).
PROFILES = {
    "full": None,
    "assonance": {"weights": {"nucleus": 0.85, "coda": 0.0, "stress": 0.15},
                  "interior": {"nucleus": 0.65, "coda": 0.0, "onset": 0.2,
                               "stress": 0.15}},
    "rawi": {"weights": {"nucleus": 0.30, "coda": 0.55, "stress": 0.15},
             "interior": {"nucleus": 0.25, "coda": 0.45, "onset": 0.15,
                          "stress": 0.15},
             "require_final_consonant": True},
}


# ---------------------------------------------------------------------------
# Declaration
# ---------------------------------------------------------------------------

@dataclass
class Declaration:
    dialect: str = "cmudict (General American citation forms)"
    anchor: str = "last primary stress to end of unit"
    channel_weights: dict = field(default_factory=lambda: {
        "nucleus": 0.50, "coda": 0.35, "stress": 0.15,
    })
    # syllables after the stressed one: medial onsets carry the rhyme too
    channel_weights_interior: dict = field(default_factory=lambda: {
        "nucleus": 0.40, "coda": 0.25, "onset": 0.20, "stress": 0.15,
    })
    trailing_syllable_penalty: float = 0.15   # semirhyme discount / extra syllable
    theta_rhyme: float = 0.75                 # lower edge of the match band
    theta_repeat_onset: float = 0.95          # onset similarity above which full
                                              # identity is REPEAT/rime riche band
    # --- the conjunctive band (quality/BAND_PREREGISTRATION.md) -------------
    # A scalar band lets a strong nucleus BUY a coda mismatch: sun/much has an
    # identical nucleus (AH) and reaches .772 against a .75 band. That is
    # channel compensation, a property of any additive rule, so no comparator
    # fixes it -- RESULTS_MATRIX.md fitted one and it still cleared.
    #
    # The rule TYPES the edge rather than rejecting it. A relation the coda
    # does not support is ASSONANCE, which is a named member of the taxonomy,
    # not a non-relation. Rejecting it outright would delete assonance,
    # consonance, oblique and slant rhyme from a harness built to represent
    # them, which would be a worse defect than the leak.
    conjunctive_band: bool = True
    # CALIBRATED 2026-08-10, was 0.60 and hand-set from the first commit.
    # 0.60 was never a decision, it was a guess, and quality/redteam_band.py
    # measured what it cost: on 3,000 random CMUdict word pairs the band
    # admitted 11.10% as RHYME while rejecting only 7.2% of Shakespeare's
    # mandated pairs -- so the harness was MORE likely to marry two random
    # dictionary words than to fail one of his. `independents`/`powersoft`
    # passed, because AH~AA scores 0.730 and NTS~FT scores exactly 0.600.
    # Held out on an untouched half of the sonnets and an untouched half of the
    # random pairs, 0.80 cuts the false-positive rate 11.93% -> 4.67% for 0.6pp
    # of true-positive cost (6.4% -> 7.0% violations), and the separation goes
    # from NEGATIVE (-5.5pp) to +2.4pp. Doctrine 5 says ship a fit only if it
    # beats the hand-set value held out; this one does, in both halves, in the
    # same direction. Doctrine 22: the number now carries a rate.
    theta_coda: float = 0.80      # coda AGREEMENT, not coda evidence
    theta_nucleus: float = 0.60
    final_promotion: bool = True              # verse promotes unstressed finals:
                                              # argument/spent rhymes on -ment
    fitted: bool = False                      # weights hand-set, not corpus-fitted

    def show(self):
        return json.dumps(asdict(self), indent=2)


# ---------------------------------------------------------------------------
# Dictionary + transcription  (projection pi, prominence rho)
# ---------------------------------------------------------------------------

class Lexicon:
    def __init__(self):
        fetch_data()
        self.entries = {}          # word -> list of pronunciations (phone lists)
        with open(CMUDICT_PATH, encoding="utf-8", errors="replace") as f:
            for line in f:
                line = line.split("#")[0].strip()
                if not line:
                    continue
                parts = line.split()
                word = re.sub(r"\(\d+\)$", "", parts[0]).lower()
                phones = parts[1:]
                self.entries.setdefault(word, []).append(phones)
        _KNOWN_WORDS.update(self.entries.keys())
        self.freq_rank = {}
        if os.path.exists(FREQ_PATH):
            with open(FREQ_PATH, encoding="utf-8") as f:
                for i, w in enumerate(f):
                    self.freq_rank.setdefault(w.strip().lower(), i)

    def transcribe_word(self, word):
        """Return (phones, oov_flag). Naive fallback for out-of-vocabulary."""
        w = fold_apostrophes(word).lower().strip("'\"“”‘’.,;:!?()[]")
        if not w:
            return [], False
        if w in self.entries:
            return list(self.entries[w][0]), False
        # crude OOV fallback: strip trailing s / 's
        for suffix, tail in (("'s", ["Z"]), ("s", ["Z"])):
            if w.endswith(suffix) and w[: -len(suffix)] in self.entries:
                return list(self.entries[w[: -len(suffix)]][0]) + tail, False
        # elision: crown'd -> crowned
        if w.endswith("'d"):
            for cand in (w[:-2] + "ed", w[:-2] + "d"):
                if cand in self.entries:
                    return list(self.entries[cand][0]), False
        # g-dropping: feelin' -> feeling, with NG realized as N
        if w.endswith("in") and (w + "g") in self.entries:
            p = list(self.entries[w + "g"][0])
            if p and p[-1] == "NG":
                p[-1] = "N"
            return p, False
        return [], True

    def transcribe(self, text, phrase_final=True):
        """Text -> (phones, words, oov_words). Multiword safe.
        Strips parenthetical ad-libs; demotes function-word stress so the
        anchor reaches the content word (mosaic rhyme: "spit in it")."""
        text = text.replace("\u2019", "'").replace("\u2018", "'")
        text = re.sub(r"\([^)]*\)", " ", text)
        phones, oov = [], []
        words = [t for t in re.findall(r"[A-Za-z'’\-]+", text)
                 if re.search(r"[A-Za-z]", t)]
        for w in words:
            for piece in re.split(r"[-\u2011]", w):
                if not piece:
                    continue
                p, is_oov = self.transcribe_word(piece)
                if is_oov:
                    oov.append(piece)
                lw = piece.lower()
                is_final = phrase_final and (w == words[-1])
                if lw in WEAK_ALWAYS or (lw in WEAK_NONFINAL
                                         and not is_final):
                    p = [re.sub(r"[12]$", "0", ph) for ph in p]
                phones.extend(p)
        return phones, words, oov


# ---------------------------------------------------------------------------
# Syllabification + anchoring  (segmentation, anchor alpha)
# ---------------------------------------------------------------------------

def split_phone(ph):
    m = re.match(r"([A-Z]+)(\d)?$", ph)
    return (m.group(1), int(m.group(2)) if m.group(2) else None)


def syllabify(phones):
    """List of syllables: dicts with onset, nucleus, stress, coda."""
    # locate nuclei
    nuclei = [i for i, ph in enumerate(phones) if split_phone(ph)[0] in VOWELS]
    if not nuclei:
        return []
    sylls = []
    prev_end = 0
    for k, ni in enumerate(nuclei):
        base, stress = split_phone(phones[ni])
        sylls.append({"onset": [], "nucleus": base, "stress": stress or 0,
                      "coda": []})
    # distribute consonants
    # consonants before first nucleus -> onset of first syllable
    sylls[0]["onset"] = [split_phone(p)[0] for p in phones[:nuclei[0]]]
    for k in range(len(nuclei)):
        start = nuclei[k] + 1
        end = nuclei[k + 1] if k + 1 < len(nuclei) else len(phones)
        cluster = [split_phone(p)[0] for p in phones[start:end]]
        if k + 1 == len(nuclei):
            sylls[k]["coda"] = cluster
        else:
            # maximize legal onset of NEXT syllable
            cut = len(cluster)  # default all to coda
            for j in range(len(cluster)):
                cand = tuple(cluster[j:])
                if len(cand) == 1 or cand in LEGAL_ONSETS:
                    cut = j
                    break
            sylls[k]["coda"] = cluster[:cut]
            sylls[k + 1]["onset"] = cluster[cut:]
    return sylls


def anchor(sylls, mode="last_stressed"):
    """Anchor slice: from the LATEST stressed syllable (primary or
    secondary) to end — rap anchors on late secondaries (applesauce).
    Falls back to last syllable."""
    if not sylls:
        return []
    idx = None
    for i in range(len(sylls) - 1, -1, -1):
        if sylls[i]["stress"] in (1, 2):
            idx = i
            break
    if idx is None:
        idx = len(sylls) - 1
    return sylls[idx:]


# ---------------------------------------------------------------------------
# Readability — the recorded refusal
#
# An unreadable word must produce a RECORDED REFUSAL, never a missing relation.
# The whole doctrine of this project is that unknown never produces an answer;
# on this path it was producing SILENCE, which is worse, because silence is
# indistinguishable from a measurement.
# ---------------------------------------------------------------------------

#: The relation `score()` already returns when either side has no anchor. It is
#: a REFUSAL, not a verdict: nothing was compared. Consumers must never fold it
#: into a "does not rhyme" count -- doing so attributes to the poet a failure
#: that belongs to the dictionary.
NO_ANCHOR = "NO_ANCHOR"


def line_tokens(text):
    """The line's word tokens, in order, before any dictionary filtering.

    Factored out of `line_anchors` and `word_syllable_map`, which carried the
    same three lines twice. This is the only definition of "the words of a
    line" the rhyme path may use; see `raw_final_token`.
    """
    norm = text.replace("’", "'").replace("‘", "'")
    norm = re.sub(r"\([^)]*\)", " ", norm)
    return [t for t in re.findall(r"[A-Za-z'\-]+", norm)
            if re.search(r"[A-Za-z]", t)]


def raw_final_token(text):
    """The line's ACTUAL last word, before any dictionary filtering.

    This is the token an end-rhyme is ON, and every rhyme-word lookup in this
    file has to agree with it. A path that instead takes the last word the
    DICTIONARY COULD READ substitutes an earlier word without saying so: on
    `i saw the cat zzzqx` it reports the rhyme word as `cat`, and on
    Shakespeare's `Thou dost beguile the world, unbless some mother. / ...
    grow'st` it reports `thou`. Measured in `_qafiya_parts` (which reads
    `word_syllable_map`, and that map emits nothing at all for an unreadable
    word) at 5.14% of corpus/song/ lines and 2.87% of sonnet lines before this
    was fixed. Compare against this function before trusting any end word.
    """
    toks = line_tokens(text)
    return toks[-1] if toks else None


def line_readability(lex, text, anchors=None):
    """Per-line readability record -- the RECORDED REFUSAL.

    The rhyme path has exactly one way to fail on an unreadable word, and it is
    not an error: `line_anchors` returns no anchor, `score` returns relation
    NO_ANCHOR with total 0.0, and every band test then says "not a rhyme".
    That answer is wrong in kind. The harness did not judge the pair and find
    it wanting; it could not read one of the words. A caller must be able to
    tell those apart, so every entry point that reports relations now also
    reports these records.

    NO PRONUNCIATION IS GUESSED. CLAUDE.md known gap 1 proposes g2p-en as a
    transcribe fallback; that is a separate, declared decision and it is not
    taken here. Guessing a pronunciation for `zzzqx` would replace a silent
    deletion with a silent invention, which is the worse of the two. This
    refuses and records.

    -> dict:
      final_token          the raw last word (`raw_final_token`), or None
      readable             False iff the END RHYME cannot be read
      final_unreadable     the end word specifically produced no anchor
      unreadable           every token in the line CMUdict could not read
      interior_unreadable  unreadable tokens before the last
      reason               a sentence naming the instrument, or None
    """
    toks = line_tokens(text)
    final = toks[-1] if toks else None
    _, _, oov = lex.transcribe(text)
    unreadable = list(dict.fromkeys(oov))
    if final is None:
        return {"text": text, "final_token": None, "readable": False,
                "final_unreadable": False, "unreadable": unreadable,
                "interior_unreadable": unreadable,
                "reason": "no word tokens in the line: nothing to anchor on"}
    if anchors is None:
        anchors, _, _ = line_anchors(lex, text)
    # The refusal condition is defined by the shipped path itself: an end word
    # is unreadable exactly when `line_anchors` yields nothing for it. Deriving
    # it any other way would let the record and the behaviour drift apart.
    final_unreadable = not anchors
    fin = fold_apostrophes(final).lower()
    interior = [w for w in unreadable if fold_apostrophes(w).lower() != fin]
    reason = None
    if final_unreadable:
        reason = (f"CMUdict has no pronunciation for the end word {final!r}; "
                  f"the harness refuses rather than guessing one (no G2P "
                  f"fallback). This line's end-rhyme is UNKNOWN, not absent.")
    elif interior:
        reason = (f"end word {final!r} is readable, but "
                  f"{len(interior)} interior token(s) are not "
                  f"({', '.join(sorted(interior))}); a multi-syllable anchor "
                  f"reaching back past one of them is reading a line with a "
                  f"hole in it.")
    return {"text": text, "final_token": final,
            "readable": not final_unreadable,
            "final_unreadable": final_unreadable,
            "unreadable": unreadable, "interior_unreadable": interior,
            "reason": reason}


def readability_records(lex, lines, anchors=None):
    """`line_readability` over a list, with 1-based line numbers attached."""
    out = []
    for i, line in enumerate(lines):
        rec = line_readability(lex, line,
                               anchors[i] if anchors is not None else None)
        rec["line"] = i + 1
        out.append(rec)
    return out


def refusals_for_pairs(records, pairs):
    """Which of `pairs` (0-based `(i, j)`) cannot be judged, and why.

    A pair is REFUSED when either side's end word is unreadable. Refused pairs
    are not violations and must never be counted as any: the denominator of a
    violation rate is the pairs that were JUDGED.
    """
    out = []
    for i, j in pairs:
        bad = [r for r in (records[i], records[j]) if r["final_unreadable"]]
        if bad:
            out.append({
                "lines": (i + 1, j + 1),
                "endwords": (records[i]["final_token"],
                             records[j]["final_token"]),
                "unreadable": [r["final_token"] for r in bad],
                "reason": bad[0]["reason"],
            })
    return out


def _phone_owners(lex, words):
    """Which WORD each phone of `words` came from -> list of word indices.

    A mirror of `Lexicon.transcribe(..., phrase_final=False)` that keeps the
    provenance that method discards. It is a mirror rather than a rewrite of
    `transcribe` because `transcribe` is on the shipped path and the sonnet
    oracle is calibrated against it; the caller checks that this returns
    exactly as many owners as `transcribe` returned phones and DROPS the
    provenance if it does not, so a future divergence costs a report line
    rather than a mislabelled span.
    """
    owners = []
    for k, w in enumerate(words):
        for piece in re.split(r"[-‑]", w):
            if not piece:
                continue
            p, _ = lex.transcribe_word(piece)
            lw = piece.lower()
            if lw in WEAK_ALWAYS or lw in WEAK_NONFINAL:
                pass          # stress rewrite does not change the phone count
            owners.extend([k] * len(p))
    return owners


def _tag_span_words(sylls, phones, owners, words):
    """Tag each syllable with the word its NUCLEUS came from.

    The nucleus, not the onset: `syllabify` maximises the onset of the next
    syllable, so consonants cross word boundaries and the only phone whose
    word is never in doubt is the vowel. Tagging is best-effort -- if the
    phone list and the owner list have drifted apart, nothing is tagged and
    `span_provenance` then returns None rather than a guess.
    """
    nuclei = [i for i, ph in enumerate(phones) if split_phone(ph)[0] in VOWELS]
    if len(nuclei) != len(sylls) or len(owners) != len(phones):
        return
    total = {}
    for ni in nuclei:
        total[owners[ni]] = total.get(owners[ni], 0) + 1
    seen = {}
    for k, ni in enumerate(nuclei):
        w = owners[ni]
        seen[w] = seen.get(w, 0) + 1
        sylls[k]["widx"] = w
        sylls[k]["word"] = words[w]
        sylls[k]["syl_in_word"] = seen[w]
        sylls[k]["word_syllables"] = total[w]


def line_anchors(lex, text, promote=False):
    """All anchor readings of a line: the last word cycles through its
    dictionary pronunciation variants (homographs: live, wind, read).
    promote=True adds the metrically-promoted bare-final-syllable variant —
    licensed only by a declared metrical template (verification mode).

    On an unreadable end word this returns NO anchors -- it does not fall back
    to the preceding word. That much was always right (measured). What was
    wrong is that every caller threw the third return value away; see
    `line_readability`.

    Each syllable now carries the WORD it came from (`word`, `widx`,
    `syl_in_word`, `word_syllables`). These candidates are the k hypotheses
    `best_score` maximises over, and until the tags existed the winner could
    not say which words it had read -- so a mosaic reach like `get to go` was
    reported under the end word `go`. See `span_provenance`.
    """
    words = line_tokens(text)
    if not words:
        return [], "", []
    prefix = " ".join(words[:-1])
    last = words[-1]
    pre_phones, _, pre_oov = (lex.transcribe(prefix, phrase_final=False)
                              if prefix else ([], [], []))
    pre_owners = _phone_owners(lex, words[:-1]) if prefix else []
    if len(pre_owners) != len(pre_phones):
        pre_owners = None            # cannot attribute: refuse to guess
    lw = fold_apostrophes(last).lower().strip("'\".,;:!?()[]")
    variants = lex.entries.get(lw, [])[:4]
    oov = list(pre_oov)
    if not variants:
        p, _, oo = lex.transcribe(last)   # handles hyphenated compounds
        oov.extend(oo)
        variants = [p] if p else []
    anchors = []
    for var in variants:
        v = list(var)
        if lw in WEAK_ALWAYS:
            v = [re.sub(r"[12]$", "0", ph) for ph in v]
        full = pre_phones + v
        sylls = syllabify(full)
        if pre_owners is not None:
            _tag_span_words(sylls, full,
                            pre_owners + [len(words) - 1] * len(v), words)
        stressed = [i for i, s in enumerate(sylls)
                    if s["stress"] in (1, 2)]
        starts = stressed[-2:] if stressed else [len(sylls) - 1]
        for st in starts:
            anchors.append(sylls[st:])
    if promote:
        # metrical promotion: bare final syllable, stress promoted
        promoted = []
        for a in anchors:
            if len(a) >= 2:
                last_syl = dict(a[-1])
                last_syl["stress"] = 1
                promoted.append([last_syl])
        anchors.extend(promoted)
    # dedup identical anchors
    seen, uniq = set(), []
    for a in anchors:
        key = tuple((s["nucleus"], tuple(s["coda"]), tuple(s["onset"]),
                     s["stress"]) for s in a)
        if key not in seen:
            seen.add(key)
            uniq.append(a)
    return uniq, last, oov


def span_provenance(anc):
    """Which WORDS a scored span covers -> dict, or None when it cannot say.

    None is returned for an anchor built outside `line_anchors` (the matrix
    evaluator does this) rather than a plausible guess, because a provenance
    record that is sometimes invented is worse than one that is sometimes
    absent -- the whole point of it is that it can be trusted.
    """
    if not anc:
        return None
    if any("widx" not in s for s in anc):
        return None
    runs = []
    for s in anc:
        if not runs or runs[-1]["widx"] != s["widx"]:
            runs.append({"widx": s["widx"], "word": s["word"],
                         "first_syllable": s["syl_in_word"],
                         "word_syllables": s["word_syllables"],
                         "syllables": 0})
        runs[-1]["syllables"] += 1
    return {"words": [r["word"] for r in runs],
            "text": " ".join(r["word"] for r in runs),
            "widx": [r["widx"] for r in runs],
            "runs": runs,
            "syllables": len(anc),
            "partial_word": runs[0]["first_syllable"] > 1,
            "endword_only": len(runs) == 1}


def span_label(prov):
    """A span as a reader can check it: the words, and how much of the FIRST
    one the span actually reaches.

    `receipt` scored on its last syllable is not the same evidence as
    `receipt` scored whole, and printing the bare word for both is this
    file's own defect one level down. A leading `-` marks a span that starts
    inside its first word, and the bracket says which word and how much of it
    -- naming the word, because `-enjoys it (1 of 2)` is ambiguous about
    which of the two words the fraction describes.
    """
    if prov is None:
        return "?"
    if not prov["runs"]:
        return "?"
    words = list(prov["words"])
    if prov["partial_word"]:
        words[0] = "-" + words[0]
    lab = " ".join(words)
    if prov["partial_word"]:
        r = prov["runs"][0]
        lab += (f" [last {r['syllables']} of {r['word_syllables']} syllables"
                f" of {r['word']!r}]")
    return lab


def spans_note(s):
    """The provenance of a `best_score` number, as one printable line.

    Doctrine 45: a checker that silently picks a coordinate is making a claim
    it never states. `best_score` picks ONE span pair out of k, and every
    consumer printed the resulting number beside the two END WORDS -- which
    are not in general what was compared. `go/receipt 0.579 RHYME` was
    `get to go` ~ the last syllable of `receipt`.

    Doctrine 56 is the other half: a max over k hypotheses needs a null under
    the same search, and k has to be recorded before that null can be built.
    Returns "" when there is nothing to report (no `spans` key).
    """
    sp = (s or {}).get("spans")
    if not sp:
        return ""
    note = (f"scored on: {span_label(sp['a'])}  ~  {span_label(sp['b'])}"
            f"   (best of k={sp['search_k']}")
    if sp["tied_at_max"] > 1:
        note += f", {sp['tied_at_max']} tied at the max"
    note += ")"
    if sp["mosaic"]:
        which = ("both sides" if sp["mosaic_a"] and sp["mosaic_b"]
                 else "left" if sp["mosaic_a"] else "right")
        note += (f"   MOSAIC ({which}): the winning span reaches back past "
                 f"the end word")
    return note


def best_score(ancs_a, ancs_b, decl, word_a=None, word_b=None, profile=None):
    """Max score over pronunciation variants of both sides — and a record of
    WHICH pair of spans produced the number.

    The selection is unchanged (first strict maximum wins, so no verdict
    moves); what is added is the `spans` key on the returned score, naming the
    winning span pair, the words each covers, and the size of the search it
    won. Without it a consumer can only print the end words, and when the
    winner is an interior mosaic reach those name a pair that had nothing to
    do with the number. BACKLOG 1.2 / adversary 7.
    """
    cand_a = ancs_a or [[]]
    cand_b = ancs_b or [[]]
    best, won, ties, k = None, (None, None), 0, 0
    for aa in cand_a:
        for ab in cand_b:
            k += 1
            s = score(aa, ab, decl, word_a, word_b, profile=profile)
            if best is None or s["total"] > best["total"]:
                best, won, ties = s, (aa, ab), 1
            elif s["total"] == best["total"]:
                ties += 1
    if best is None:
        return best
    pa, pb = span_provenance(won[0]), span_provenance(won[1])
    mosaic_a = bool(pa and not pa["endword_only"])
    mosaic_b = bool(pb and not pb["endword_only"])
    best["spans"] = {
        "a": pa, "b": pb,
        "anchor_a": won[0], "anchor_b": won[1],
        # doctrine 56: k is the size of the search the max was taken over.
        # Recording it is the precondition for a null under the same search;
        # `beat` is how many candidates the winner beat.
        "search_k": k, "beat": k - 1,
        "candidates_a": len(cand_a), "candidates_b": len(cand_b),
        # A tie means the named span is ONE of several that produce this
        # number, so the report has to say so rather than pick in silence.
        "tied_at_max": ties,
        "mosaic_a": mosaic_a, "mosaic_b": mosaic_b,
        "mosaic": mosaic_a or mosaic_b,
    }
    return best


# ---------------------------------------------------------------------------
# Comparator d — multi-channel, graded, band-passed
# ---------------------------------------------------------------------------

def vowel_sim(a, b):
    if a == b:
        return 1.0
    fa, fb = VOWELS[a], VOWELS[b]
    d = (0.35 * abs(fa[0] - fb[0]) + 0.45 * abs(fa[1] - fb[1])
         + 0.10 * (fa[2] != fb[2]) + 0.15 * (fa[3] != fb[3])
         + 0.10 * (fa[4] != fb[4]))
    return max(0.0, 1.0 - d)


def cons_sim(a, b):
    if a == b:
        return 1.0
    ca, cb = CONSONANTS[a], CONSONANTS[b]
    key = (ca[2], cb[2]) if (ca[2], cb[2]) in MANNER_DIST else (cb[2], ca[2])
    d = (0.30 * (ca[0] != cb[0]) + 0.25 * abs(ca[1] - cb[1])
         + 0.45 * MANNER_DIST.get(key, 1.0))
    return max(0.0, 1.0 - d)


def cluster_sim(a, b):
    """Align two consonant clusters, Needleman-Wunsch, similarity 0..1."""
    if not a and not b:
        return 1.0
    if not a or not b:
        return 0.0
    n, m = len(a), len(b)
    dp = [[0.0] * (m + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            dp[i][j] = max(dp[i - 1][j - 1] + cons_sim(a[i - 1], b[j - 1]),
                           dp[i - 1][j], dp[i][j - 1])
    return 2.0 * dp[n][m] / (n + m)


RHYME_RELATIONS = {"RHYME", "RIME_RICHE"}
#: Named relations the conjunctive band produces that are NOT rhyme. They are
#: members of the taxonomy, not failures, and consumers that ask "is this a
#: rhyme?" must answer no while the graph keeps the name.
NEAR_RELATIONS = {"ASSONANCE", "CONSONANCE"}


def admits(s, theta):
    """Does this scored pair count as RHYME at `theta`?

    Two conditions, and the second is what the conjunctive band adds: the
    scalar has to clear the band AND the relation has to be a rhyme relation.
    Before this, an ASSONANCE edge whose nucleus carried it over theta was
    admitted as rhyme -- that is the sun/much leak, and it lives here rather
    than in the comparator.
    """
    return s is not None and s["total"] >= theta and \
        s["relation"] in RHYME_RELATIONS


def channel_agreement(anc_a, anc_b, decl):
    """Does each channel AGREE across the whole anchor? -> (nucleus, coda).

    AGREEMENT IS NOT EVIDENCE, and conflating them breaks the language. Two
    ABSENT codas carry no evidence -- the fitted matrix correctly scored
    empty-vs-empty at 0.000 bits -- but they plainly agree, and see/free is a
    perfect rhyme. Reading both-empty as disagreement would silently delete
    every open-syllable rhyme in English, which is a quarter of the mandated
    pairs in the sonnets.

    Conjunctive across syllables as well as channels: the weakest aligned
    syllable decides, so a strong first syllable cannot buy a weak second.

    ALIGNED FLUSH RIGHT, and it was not until 2026-08-10.

    The line below used to read `for i in range(n)` over `anc_a[i]`/`anc_b[i]`,
    which aligns the two spans from the HEAD. Rhyme aligns from the TAIL. For
    two anchors of EQUAL length the two are the same computation, which is why
    every test in this repo passed for the life of the project and why the
    sonnet oracle never moved: a test author reaching for an example reaches
    for `nation`/`station`.

    It differs the moment the spans have different syllable counts -- which is
    the mosaic and multisyllabic reach, the thing `line_anchors` exists to
    produce. Measured on the 152 sonnets: 67.8% of candidate anchor-span pairs
    are unequal-length, and head vs tail alignment DISAGREE on 79.9% of those,
    54.1% of all pairs. The case that exposed it: `get to go` against `ceipt`
    compared `get`(EH,T) with `ceipt`(IY,T), found the T codas identical and
    the front vowels close, and returned (True, True) -- so a 0.579 pair was
    typed RHYME. Tail-aligned it is (False, False), nucleus similarity 0.245.

    This is doctrine 83's defect in the SHIPPED comparator rather than in the
    taxonomy: there, suffix alignment was the function instead of a parameter
    of it; here, head alignment was the function and nobody had written a pair
    whose lengths differ.
    """
    n = min(len(anc_a), len(anc_b))
    if not n:
        return False, False
    ta, tb = anc_a[-n:], anc_b[-n:]
    nuc = min(vowel_sim(ta[i]["nucleus"], tb[i]["nucleus"])
              for i in range(n))
    codas = []
    for i in range(n):
        ca, cb = ta[i]["coda"], tb[i]["coda"]
        codas.append(1.0 if (not ca and not cb) else cluster_sim(ca, cb))
    return nuc >= decl.theta_nucleus, min(codas) >= decl.theta_coda


def score(anc_a, anc_b, decl, word_a=None, word_b=None, profile=None):
    """Score two anchors. Returns dict with total, per-channel sub-scores,
    relation (RHYME / REPEAT / RIME_RICHE band flags), and value flags."""
    out = {"total": 0.0, "syllables": [], "relation": "RHYME", "flags": []}
    if not anc_a or not anc_b:
        out["relation"] = "NO_ANCHOR"
        return out
    # left-align at the stressed syllable; trailing extras penalized
    n = min(len(anc_a), len(anc_b))
    extra = abs(len(anc_a) - len(anc_b))
    prof = PROFILES.get(profile) if isinstance(profile, str) else profile
    if prof:
        w0 = prof["weights"]
        wi = prof.get("interior", prof["weights"])
    else:
        w0, wi = decl.channel_weights, decl.channel_weights_interior
    total = 0.0
    for i in range(n):
        sa, sb = anc_a[i], anc_b[i]
        ns = vowel_sim(sa["nucleus"], sb["nucleus"])
        cs = cluster_sim(sa["coda"], sb["coda"])
        os_ = cluster_sim(sa["onset"], sb["onset"])
        st = 1.0 if (sa["stress"] > 0) == (sb["stress"] > 0) else 0.0
        if i == 0:
            # first onset is the rhyme-defining exclusion: shown, not scored
            syl_total = (w0["nucleus"] * ns + w0["coda"] * cs
                         + w0["stress"] * st)
        else:
            syl_total = (wi["nucleus"] * ns + wi["coda"] * cs
                         + wi["onset"] * os_ + wi["stress"] * st)
        total += syl_total
        out["syllables"].append({
            "nucleus": round(ns, 3), "coda": round(cs, 3),
            "onset": round(os_, 3), "stress": st,
        })
    total /= n
    total -= decl.trailing_syllable_penalty * extra
    if prof and prof.get("require_final_consonant"):
        ca = anc_a[-1]["coda"][-1:] if anc_a[-1]["coda"] else []
        cb = anc_b[-1]["coda"][-1:] if anc_b[-1]["coda"] else []
        if ca != cb or not ca:
            total = 0.0
            out["flags"].append("rawi mismatch: final consonant differs")
    out["total"] = round(max(0.0, total), 3)
    if extra == 1:
        out["flags"].append("semirhyme")
    # band-pass, typed: a relation the coda does not support is ASSONANCE, and
    # one the nucleus does not support is CONSONANCE. Both are named members of
    # the taxonomy, so this relabels rather than rejects.
    #
    # The `assonance` profile turns the rule OFF by declaring theta_coda 0 --
    # that profile exists precisely to score nucleus-only agreement, and
    # applying a coda requirement to it would be incoherent. `rawi` already
    # carries require_final_consonant, which is this rule's stricter special
    # case for a form that demands one.
    conj = decl.conjunctive_band and not (prof and prof.get("weights", {})
                                          .get("coda", 1.0) == 0.0)
    if conj and out["relation"] == "RHYME":
        nuc_ok, coda_ok = channel_agreement(anc_a, anc_b, decl)
        if nuc_ok and not coda_ok:
            out["relation"] = "ASSONANCE"
            out["flags"].append(
                "conjunctive band: nucleus agrees, coda does not")
        elif coda_ok and not nuc_ok:
            out["relation"] = "CONSONANCE"
            out["flags"].append(
                "conjunctive band: coda agrees, nucleus does not")
        elif not nuc_ok and not coda_ok:
            out["relation"] = "NO_RELATION"
            out["flags"].append("conjunctive band: neither channel agrees")

    # band-pass: identity is not rhyme
    if word_a and word_b:
        wa, wb = word_a.lower().strip(), word_b.lower().strip()
        la, lb = wa.split()[-1], wb.split()[-1]
        # structural identity: same shape, every channel equal incl. onsets
        full_identity = (extra == 0 and all(
            anc_a[i]["nucleus"] == anc_b[i]["nucleus"]
            and anc_a[i]["coda"] == anc_b[i]["coda"]
            and anc_a[i]["onset"] == anc_b[i]["onset"]
            for i in range(n)))
        if wa == wb:
            out["relation"] = "REPEAT"
            out["flags"].append("identical_word")
        elif full_identity:
            out["relation"] = "RIME_RICHE"
            out["flags"].append("band_edge: identical sound, different word")
        if frozenset((la, lb)) in CLICHE_PAIRS:
            out["flags"].append("cliche_pair")
        for suf in SUFFIXES:
            if (la.endswith(suf) and lb.endswith(suf)
                    and len(la) > len(suf) + 1 and len(lb) > len(suf) + 1):
                if len(suf) <= 2 and not (
                        la[: -len(suf)] in _KNOWN_WORDS
                        and lb[: -len(suf)] in _KNOWN_WORDS):
                    continue   # -er/-ed/-es/-s only count on real stems
                out["flags"].append(f"shared_suffix: -{suf}")
                break
    return out


# ---------------------------------------------------------------------------
# Candidates — reverse index over the lexicon
# ---------------------------------------------------------------------------

class CandidateEngine:
    def __init__(self, lex, decl):
        self.lex, self.decl = lex, decl
        self.index = []  # (word, anchor, rank)
        for word, prons in lex.entries.items():
            if not re.fullmatch(r"[a-z']+", word):
                continue
            rank = lex.freq_rank.get(word)
            if rank is None:
                continue  # MVP: only common words as candidates
            sylls = syllabify(prons[0])
            anc = anchor(sylls)
            if anc:
                self.index.append((word, anc, rank))

    def candidates(self, text, n=20, include_perfect=True):
        phones, words, oov = self.lex.transcribe(text)
        anc_q = anchor(syllabify(phones))
        if not anc_q:
            return {"error": "no anchor", "oov": oov}
        query_word = words[-1].lower() if words else ""
        scored = []
        for word, anc, rank in self.index:
            if word == query_word:
                continue
            s = score(anc_q, anc, self.decl, query_word, word)
            if s["relation"] == "RIME_RICHE" and not include_perfect:
                continue
            if s["total"] >= self.decl.theta_rhyme - 0.15:
                scored.append((s["total"], rank, word, s))
        scored.sort(key=lambda t: (-t[0], t[1]))
        out = []
        for tot, rank, word, s in scored[:n]:
            tier = ("perfect" if tot >= 0.97 else
                    "strong" if tot >= self.decl.theta_rhyme else "slant")
            out.append({"word": word, "score": tot, "tier": tier,
                        "flags": s["flags"]})
        return {"query": text, "anchor_syllables": len(anc_q),
                "oov": oov, "candidates": out}


# ---------------------------------------------------------------------------
# Meter check
# ---------------------------------------------------------------------------

def stress_string(sylls):
    return "".join("/" if s["stress"] in (1, 2) else "." for s in sylls)


def check_meter(lex, lines, template=None):
    """template: string like './'*4 for iambic tetrameter ('.' weak, '/' strong).
    Lexical stress is a proxy for scansion; monosyllables count as flexible."""
    report = []
    for i, line in enumerate(lines):
        phones, words, oov = lex.transcribe(line)
        sylls = syllabify(phones)
        ss = stress_string(sylls)
        entry = {"line": i + 1, "text": line, "syllables": len(sylls),
                 "stress": ss, "oov": oov}
        if template:
            entry["target_syllables"] = len(template)
            entry["syllable_match"] = (len(sylls) == len(template))
            # agreement over strong positions only (weak positions flexible)
            agree = sum(1 for a, b in zip(ss, template) if b == "/" and a == "/")
            strongs = template.count("/")
            entry["strong_position_agreement"] = (
                round(agree / strongs, 2) if strongs else None)
        report.append(entry)
    return report


# ---------------------------------------------------------------------------
# Scheme check — the graph, diffed against the target letters
# ---------------------------------------------------------------------------


#: X / x / . mark an UNRHYMED SINGLETON, never a rhyme class. `quality/
#: schemes.py` has always said so ("an unrhymed line is a singleton BLOCK, not
#: a missing value"); the spine disagreed with it in THREE separate places --
#: the mandate list, the violation loop, and `revise._partner` -- so declaring
#: lines free mandated them all to rhyme with each other. One function now, so
#: the three cannot drift apart again (the shape of cell 3's _CAP_OF_LEVEL fix).
SCHEME_FREE = {"X", "."}


def scheme_class(ch):
    """-> the rhyme class of a scheme character, or None if it is free."""
    c = (ch or "").upper()
    return None if c in SCHEME_FREE else c


def same_scheme_class(a, b):
    """-> True only when both characters name the SAME, non-free class."""
    ca, cb = scheme_class(a), scheme_class(b)
    return ca is not None and ca == cb


def check_scheme(lex, lines, scheme, decl, profile=None):
    """Diff the graph against the declared letters.

    A mandated pair whose end word cannot be read is a REFUSAL, not a
    violation. It used to be reported as `below theta_rhyme`, which says
    "these lines do not rhyme" about a pair the harness never compared -- on
    the sonnet battery that misattribution was 50 of 123 violations (40.7%),
    and it named Shakespeare rather than CMUdict as the thing at fault. The
    refusals now leave `violations` and appear in `refusals`, and the counts
    that make a rate computable are returned explicitly: divide by
    `pairs_judged`, never by `pairs_mandated`.
    """
    assert len(scheme) == len(lines), "scheme length must equal line count"
    anchors, endwords = [], []
    for line in lines:
        ancs, last, _ = line_anchors(lex, line,
                                     promote=decl.final_promotion)
        anchors.append(ancs)
        endwords.append(last)
    records = readability_records(lex, lines, anchors)
    n = len(lines)
    matrix = [[None] * n for _ in range(n)]
    violations, collisions = [], []
    # X / x / . are UNRHYMED SINGLETONS, never a rhyme class.
    #
    # This line used to read `scheme[i].upper() == scheme[j].upper()` with no
    # exclusion, so two lines both marked X compared equal and became a
    # MANDATED PAIR. Declaring 24 lines of a 41-line lyric free therefore
    # mandated all 276 of their pairs to rhyme with each other, and the brief
    # came back demanding that "does" rhyme with "heat".
    #
    # `quality/schemes.py` has always been right about this -- its `parse()`
    # docstring says an unrhymed line is a singleton BLOCK, not a missing
    # value, so ABXB and ABCB are the same partition. The spine disagreed with
    # it, silently, and nothing caught the disagreement because no song had
    # ever been run through both. Found 2026-08-10 by writing one.
    #
    # The sonnet oracle is unaffected: ABABCDCDEFEFGG contains no X, so the
    # battery's 1064 mandated pairs and its 73/1014 are unchanged.
    mandated = [(i, j) for i in range(n) for j in range(i + 1, n)
                if same_scheme_class(scheme[i], scheme[j])]
    refusals = refusals_for_pairs(records, mandated)
    refused = {r["lines"] for r in refusals}
    for i in range(n):
        for j in range(i + 1, n):
            s = best_score(anchors[i], anchors[j], decl,
                           endwords[i], endwords[j], profile=profile)
            matrix[i][j] = s
            same = same_scheme_class(scheme[i], scheme[j])
            if same:
                if (i + 1, j + 1) in refused:
                    continue          # refused: recorded, never judged
                if s["relation"] == "REPEAT":
                    violations.append(
                        (i + 1, j + 1, s["total"],
                         "REPEAT not rhyme (identical word)"))
                elif s["relation"] in NEAR_RELATIONS:
                    violations.append(
                        (i + 1, j + 1, s["total"],
                         f"{s['relation']} not rhyme (conjunctive band)"))
                elif s["relation"] == NO_ANCHOR:
                    # Unreachable via an unreadable END word (those are already
                    # in `refusals`); reachable if a line has no word tokens.
                    violations.append(
                        (i + 1, j + 1, s["total"],
                         "NO_ANCHOR: nothing to compare (not a rhyme verdict)"))
                elif s["total"] < decl.theta_rhyme:
                    violations.append(
                        (i + 1, j + 1, s["total"],
                         f"below theta_rhyme={decl.theta_rhyme}"))
            else:
                if s["total"] >= 0.9:
                    collisions.append(
                        (i + 1, j + 1, s["total"],
                         "unintended rhyme across scheme letters"))
    # transitivity defect within letter groups: a~b, b~c, a!~c.
    # A triangle containing a refused edge is UNKNOWN, not defective: a missing
    # edge there is a missing measurement. Counting it would manufacture a
    # structural finding out of an unreadable word.
    defect = 0
    unknown_triangles = 0
    groups = {}
    for idx, letter in enumerate(scheme.upper()):
        groups.setdefault(letter, []).append(idx)
    for letter, members in groups.items():
        for a in range(len(members)):
            for b in range(a + 1, len(members)):
                for c in range(b + 1, len(members)):
                    i1, i2, i3 = members[a], members[b], members[c]
                    def ok(x, y):
                        s = matrix[min(x, y)][max(x, y)]
                        return admits(s, decl.theta_rhyme)
                    if any((min(x, y) + 1, max(x, y) + 1) in refused
                           for x, y in ((i1, i2), (i2, i3), (i1, i3))):
                        unknown_triangles += 1
                        continue
                    edges = [ok(i1, i2), ok(i2, i3), ok(i1, i3)]
                    if sum(edges) == 2:
                        defect += 1
    return {"scheme": scheme, "endwords": endwords,
            "pair_scores": [
                {"lines": (i + 1, j + 1), "endwords": (endwords[i], endwords[j]),
                 "score": matrix[i][j]["total"],
                 "relation": matrix[i][j]["relation"],
                 "flags": matrix[i][j]["flags"],
                 # The number's PROVENANCE, beside the number. `endwords` is
                 # the pair the scheme mandates; `spans` is the pair that was
                 # actually compared, and they differ whenever the winning
                 # anchor is a mosaic reach.
                 "spans": matrix[i][j].get("spans"),
                 "spans_note": spans_note(matrix[i][j])}
                for i in range(n) for j in range(i + 1, n)],
            "violations": violations, "collisions": collisions,
            "refusals": refusals,
            "readability": records,
            "pairs_mandated": len(mandated),
            "pairs_refused": len(refusals),
            "pairs_judged": len(mandated) - len(refusals),
            "transitivity_defect_triangles": defect,
            "transitivity_unknown_triangles": unknown_triangles}


# ---------------------------------------------------------------------------
# Graph mode — the primary object. Chains, partitions, and letter schemes
# are all lossy projections of this.
# ---------------------------------------------------------------------------

def bron_kerbosch(R, P, X, adj, out):
    if not P and not X:
        if len(R) >= 2:
            out.append(sorted(R))
        return
    pivot = max(P | X, key=lambda v: len(adj[v]), default=None)
    for v in list(P - (adj[pivot] if pivot is not None else set())):
        bron_kerbosch(R | {v}, P & adj[v], X & adj[v], adj, out)
        P.discard(v)
        X.add(v)


def rhyme_graph(lex, lines, decl, theta=None, profile=None):
    """Full pairwise score matrix -> weighted graph -> maximal cliques
    (tolerance classes). Cliques may OVERLAP: those structures have no
    letter-scheme representation. The graph is the answer; everything
    else is a view.

    An unreadable end word used to make a node vanish from the graph in
    complete silence: `line_anchors` gave nothing, `score` said NO_ANCHOR,
    `admits` said no, the node ended up isolated, and the `oov` this function
    already computed was DISCARDED from the return value. A reader then could
    not tell an isolated node from an unread one. Isolation is now typed:
    `unreadable_nodes` names the nodes nothing could be measured about, and
    `refused_edges` names the pairs that were never compared. An edge missing
    for a refused pair is a missing MEASUREMENT, not a measured non-relation.
    """
    if theta is None:
        theta = decl.theta_rhyme
    data = []
    for line in lines:
        ancs, last, oov = line_anchors(lex, line)
        data.append({"anchor": ancs, "endword": last, "oov": oov})
    records = readability_records(lex, lines, [d["anchor"] for d in data])
    n = len(data)
    edges = []
    edge_spans = []
    refused = []
    adj = {i: set() for i in range(n)}
    for i in range(n):
        for j in range(i + 1, n):
            if records[i]["final_unreadable"] or records[j]["final_unreadable"]:
                refused.append((i, j))
                continue
            s = best_score(data[i]["anchor"], data[j]["anchor"], decl,
                           data[i]["endword"], data[j]["endword"],
                           profile=profile)
            if admits(s, theta) or s["relation"] == "REPEAT":
                edges.append((i, j, s["total"], s["relation"]))
                # A parallel list, index-aligned with `edges`, because the
                # edge tuple's arity is pinned by a regression test and an
                # edge weight that quietly grew a fifth field would break a
                # reader who unpacks it. See `spans_note`.
                edge_spans.append({"nodes": (i, j),
                                   "spans": s.get("spans"),
                                   "note": spans_note(s)})
                adj[i].add(j)
                adj[j].add(i)
    cliques = []
    bron_kerbosch(set(), set(range(n)), set(), adj, cliques)
    membership = {}
    for ci, cl in enumerate(cliques):
        for v in cl:
            membership.setdefault(v, []).append(ci)
    overlapping = {v: cs for v, cs in membership.items() if len(cs) > 1}
    return {"endwords": [d["endword"] for d in data],
            "edges": edges, "edge_spans": edge_spans, "cliques": cliques,
            "overlapping_nodes": overlapping,
            "letter_representable": not overlapping,
            "readability": records,
            "unreadable_nodes": [
                {"node": r["line"] - 1, "line": r["line"],
                 "endword": r["final_token"], "reason": r["reason"]}
                for r in records if r["final_unreadable"]],
            "refused_edges": refusals_for_pairs(records, refused),
            "pairs_total": n * (n - 1) // 2,
            "pairs_refused": len(refused),
            "pairs_judged": n * (n - 1) // 2 - len(refused)}


# ---------------------------------------------------------------------------
# Chain inference — discovery mode for through-composed verse
# ---------------------------------------------------------------------------

def infer_chains(lex, lines, decl, theta_chain=None, comparator=None):
    """Discovery mode: no predeclared scheme. A line joins the open chain by
    matching either of the chain's last TWO rhyming members (interleave-safe:
    xAxA odd-rhyme structures). One consecutive non-matching line is held as
    a filler if the following line rejoins; two consecutive misses close the
    chain. Chains may drift (neighbor coherence, not global): the tolerance
    structure.

    The per-chain `oov` field used to be collected over MEMBERS only. An
    unreadable line cannot match anything, so it is exactly the line that ends
    up a FILLER -- which means the one field that recorded unreadability
    systematically dropped it in the only case where it mattered. Measured on
    the constructed case: a chain whose filler is `zzzqx` reported `oov: []`.
    `oov` now covers fillers too, and `unreadable` names, per chain, which of
    its lines the harness could not read and why.
    """
    if theta_chain is None:
        theta_chain = decl.theta_rhyme
    data = []
    for line in lines:
        ancs, last, oov = line_anchors(lex, line)
        data.append({"anchor": ancs, "endword": last, "oov": oov})
    records = readability_records(lex, lines, [d["anchor"] for d in data])

    def match(i, j):
        s = best_score(data[i]["anchor"], data[j]["anchor"], decl,
                       data[i]["endword"], data[j]["endword"])
        if comparator is not None:
            # Fitted log-odds. theta_chain is then a calibrated
            # false-positive rate, not a point on a [0,1] similarity.
            best = None
            for aa in (data[i]["anchor"] or [[]]):
                for ab in (data[j]["anchor"] or [[]]):
                    t, _ = comparator.score(aa, ab)
                    if t is not None and (best is None or t > best):
                        best = t
            # The conjunctive band is ORTHOGONAL to the comparator and must
            # apply to both, or the two are not comparable. Without this the
            # fitted path was measured band-off against a band-on hand-set
            # baseline, which conflates two separate changes.
            ok = (best is not None and best >= theta_chain
                  and s["relation"] in RHYME_RELATIONS)
            return ok or s["relation"] == "REPEAT"
        return admits(s, theta_chain) or s["relation"] == "REPEAT"

    chains = []
    members, fillers, pending = [0], [], None
    for i in range(1, len(data)):
        tail = members[-2:]
        if any(match(i, t) for t in reversed(tail)):
            if pending is not None:
                fillers.append(pending)
                pending = None
            members.append(i)
        elif pending is None:
            pending = i
        else:
            chains.append((members, fillers))
            members, fillers = [pending], []
            pending = None
            tail = members[-2:]
            if any(match(i, t) for t in reversed(tail)):
                members.append(i)
            else:
                chains.append((members, []))
                members = [i]
    if pending is not None:
        chains.append((members, fillers))
        members, fillers = [pending], []
    chains.append((members, fillers))

    out = []
    for members, fillers in chains:
        pairs = []
        span_pairs = []
        for a in range(len(members)):
            for b in range(a + 1, len(members)):
                s = best_score(data[members[a]]["anchor"],
                               data[members[b]]["anchor"], decl,
                               data[members[a]]["endword"],
                               data[members[b]]["endword"])
                pairs.append(s["total"])
                sp = s.get("spans")
                if sp and sp["mosaic"]:
                    span_pairs.append(
                        {"lines": (members[a] + 1, members[b] + 1),
                         "note": spans_note(s)})
        ends = [data[m]["endword"].lower() for m in members]
        out.append({
            "figure": ("epiphora" if len(members) >= 3
                       and len(set(ends)) == 1 else "rhyme"),
            "lines": [m + 1 for m in members],
            "endwords": [data[m]["endword"] for m in members],
            "fillers": [(f + 1, data[f]["endword"]) for f in fillers],
            "length": len(members),
            "mean_coherence": (round(sum(pairs) / len(pairs), 3)
                               if pairs else None),
            "max_drift": (round(min(pairs), 3) if pairs else None),
            # `mean_coherence` is a mean over pairs and the endwords printed
            # beside it are only the pairs' LABELS. These are the pairs whose
            # contribution came from a span reaching past the end word, so a
            # reader can tell a chain of end rhymes from a chain of mosaics.
            "mosaic_pairs": span_pairs,
            # members AND fillers: a filler is where an unreadable line lands.
            "oov": sorted({w for m in list(members) + list(fillers)
                           for w in data[m]["oov"]}),
            "unreadable": [
                {"line": m + 1, "endword": records[m]["final_token"],
                 "role": "member" if m in members else "filler",
                 "reason": records[m]["reason"]}
                for m in sorted(set(members) | set(fillers))
                if records[m]["final_unreadable"]],
        })
    return out


def check_prasa(lex, lines, position=2):
    """Indic prasa: identical consonant at a fixed syllable position in
    every line (default: onset of syllable 2). Positional constraint —
    line-end anchoring does not apply."""
    report = []
    consonants = []
    for line in lines:
        phones, _, oov = lex.transcribe(line)
        sylls = syllabify(phones)
        c = (sylls[position - 1]["onset"][:1]
             if len(sylls) >= position else [])
        consonants.append(c[0] if c else None)
        report.append({"line": line, "consonant": c[0] if c else None,
                       "oov": oov})
    target = consonants[0]
    ok = all(c == target and c is not None for c in consonants)
    return {"position": position, "target": target, "satisfied": ok,
            "lines": report}


# ---------------------------------------------------------------------------
# Song structure — blueprint layer (declared, not discovered)
# ---------------------------------------------------------------------------

def parse_lyric_sections(text):
    """Split a lyric sheet on [Section Name] headers (Suno-compatible)."""
    sections, name, buf = [], None, []
    for raw in text.splitlines():
        line = raw.strip()
        m = re.fullmatch(r"\[(.+)\]", line)
        if m:
            if name is not None:
                sections.append((name, buf))
            name, buf = m.group(1).strip(), []
        elif line:
            buf.append(line)
    if name is not None:
        sections.append((name, buf))
    return sections


def group_sounds(lex, lines, scheme, decl):
    """Representative end-anchor per scheme letter (first line of each group).

    A letter whose representative line is unreadable gets an EMPTY anchor, and
    `check_song` then skips it in every cross-section comparison -- silently,
    as though the group had been checked and found novel. The empty anchor is
    kept (callers test it) and the reason is carried alongside so the skip is
    visible.
    """
    sounds = {}
    for i, letter in enumerate(scheme.upper()):
        if letter not in sounds and i < len(lines):
            ancs, last, _ = line_anchors(lex, lines[i])
            sounds[letter] = (ancs[0] if ancs else [], last)
    return sounds


def check_song(lex, blueprint, lyric_text, decl):
    """Blueprint: {"sections":[{"name","type","lines","scheme"} |
    {"name","type","ref": prior name}]}. Chorus refs demand verbatim identity.
    Advisory flags: structural monotony, cross-verse sound reuse,
    bridge non-novelty."""
    got = parse_lyric_sections(lyric_text)
    report = {"sections": [], "violations": [], "advisories": [],
              "refusals": []}
    first_instance = {}          # section name -> lines (for refs)
    verse_sounds = []            # [(section, letter, anchor, endword)]
    schemes_seen = []

    for k, spec in enumerate(blueprint["sections"]):
        if k >= len(got):
            report["violations"].append(
                f"missing section: {spec['name']}")
            continue
        gname, glines = got[k]
        entry = {"name": spec["name"], "found": gname,
                 "lines": len(glines)}
        if gname.lower() != spec["name"].lower():
            report["advisories"].append(
                f"section {k+1} named '{gname}', blueprint says "
                f"'{spec['name']}'")

        if "ref" in spec:                     # repeated section: identity
            ref_lines = first_instance.get(spec["ref"])
            if ref_lines is None:
                report["violations"].append(
                    f"{spec['name']}: ref '{spec['ref']}' never defined")
            elif [l.lower() for l in glines] != [l.lower()
                                                 for l in ref_lines]:
                report["violations"].append(
                    f"{spec['name']}: chorus identity broken — repeated "
                    f"section must match '{spec['ref']}' verbatim")
            entry["identity"] = "checked"
            report["sections"].append(entry)
            continue

        first_instance.setdefault(spec["name"], glines)
        if len(glines) != spec["lines"]:
            report["violations"].append(
                f"{spec['name']}: {len(glines)} lines, blueprint says "
                f"{spec['lines']}")
        scheme = spec.get("scheme")
        if scheme and len(glines) == len(scheme):
            res = check_scheme(lex, glines, scheme, decl)
            entry["scheme_violations"] = res["violations"]
            entry["collisions"] = res["collisions"]
            entry["scheme_refusals"] = res["refusals"]
            for v in res["violations"]:
                report["violations"].append(
                    f"{spec['name']} L{v[0]}-L{v[1]}: {v[3]} "
                    f"(score {v[2]})")
            # A refused pair is NOT a violation. It has to surface anyway, or
            # an unreadable end word makes a mandated rhyme disappear from the
            # song report entirely.
            for r in res["refusals"]:
                report["refusals"].append(
                    f"{spec['name']} L{r['lines'][0]}-L{r['lines'][1]}: "
                    f"{r['reason']}")
            schemes_seen.append((spec["name"], spec["type"], scheme))
            sounds = group_sounds(lex, glines, scheme, decl)
            # cross-section sound reuse / bridge novelty
            for letter, (anc, endword) in sounds.items():
                for (pname, pletter, panc, pend) in verse_sounds:
                    if pname == spec["name"] or not anc or not panc:
                        continue
                    s = score(anc, panc, decl)
                    if s["total"] >= 0.9:
                        kind = ("bridge non-novelty"
                                if spec["type"] == "bridge"
                                else "rhyme sound reuse")
                        # `group_sounds` takes the FIRST anchor reading of the
                        # group's first line, which may be a mosaic reach --
                        # so the endword beside this number is a label, not
                        # necessarily the evidence. Name the spans.
                        pa = span_provenance(anc)
                        pb = span_provenance(panc)
                        report["advisories"].append(
                            f"{kind}: {spec['name']} group {letter} "
                            f"({endword}) ~ {pname} group {pletter} "
                            f"({pend}) at {s['total']}   "
                            f"scored on: {span_label(pa)} ~ {span_label(pb)}")
            for letter, (anc, endword) in sounds.items():
                verse_sounds.append((spec["name"], letter, anc, endword))
        report["sections"].append(entry)

    # structural monotony: every non-chorus section on one scheme
    core = [s for s in schemes_seen if s[1] != "chorus"]
    if len(core) >= 3 and len({s[2] for s in core}) == 1:
        report["advisories"].append(
            f"structural monotony: every section runs {core[0][2]} — "
            f"deliberate (drill, ghazal) or flat; declared intent decides")
    return report





LONG_VOWELS = {"IY", "UW", "AA", "AO", "ER", "EY", "OW", "AY", "AW", "OY"}


def syllable_weight(s):
    return "G" if (s["nucleus"] in LONG_VOWELS or s["coda"]) else "L"


def line_weights(lex, text):
    phones, _, oov = lex.transcribe(text)
    sylls = syllabify(phones)
    pattern = "".join(syllable_weight(s) for s in sylls)
    matra = sum(2 if c == "G" else 1 for c in pattern)
    return pattern, matra, oov


def word_syllable_map(lex, text):
    """Syllables of a line, each tagged with the word and word index it came
    from.

    A word CMUdict cannot read contributes NO syllables, so `out[-1]["word"]`
    is the last word the dictionary could READ, which is not in general the
    line's last word. Anything that wants the rhyme word must use
    `raw_final_token`, and `widx` is kept so a caller can see the gap.
    """
    words = line_tokens(text)
    out = []
    for k, w in enumerate(words):
        phones = []
        for piece in re.split(r"[-\u2011]", w):
            if not piece:
                continue
            p, _ = lex.transcribe_word(piece)
            phones.extend(p)
        lw = fold_apostrophes(w).lower().strip("'\".,;:!?()[]")
        final = (k == len(words) - 1)
        if lw in WEAK_ALWAYS or (lw in WEAK_NONFINAL and not final):
            phones = [re.sub(r"[12]$", "0", ph) for ph in phones]
        for s in syllabify(phones):
            s = dict(s)
            s["word"] = w
            s["widx"] = k
            out.append(s)
    return out


def _span_words(sylls, i, j):
    seen = []
    for s in sylls[i:j]:
        if not seen or seen[-1] != s["word"]:
            seen.append(s["word"])
    return " ".join(seen)


def internal_matches(lex, text_a, decl, text_b=None, theta=None,
                     max_window=3):
    if theta is None:
        theta = decl.theta_rhyme + 0.05
    A = word_syllable_map(lex, text_a)
    same = text_b is None
    B = A if same else word_syllable_map(lex, text_b)

    def anchors(X):
        out = []
        for i, s in enumerate(X):
            if s["stress"] in (1, 2):
                for L in range(1, max_window + 1):
                    if i + L <= len(X):
                        out.append((i, i + L))
        return out

    cands = []
    for (i, j) in anchors(A):
        for (k, m) in anchors(B):
            if same and k < j:
                continue
            if same and {x["widx"] for x in A[i:j]} == \
                    {x["widx"] for x in B[k:m]}:
                continue          # a word cannot rhyme with itself
            s = score(A[i:j], B[k:m], decl,
                      _span_words(A, i, j), _span_words(B, k, m))
            if s["total"] >= theta or s["relation"] == "RIME_RICHE":
                cands.append((s["total"], (j - i) + (m - k),
                              i, j, k, m, s))
    cands.sort(key=lambda t: (-t[0], -t[1]))
    used_a, used_b, picked = set(), set(), []
    for tot, ln, i, j, k, m, s in cands:
        if any(x in used_a for x in range(i, j)):
            continue
        if any(x in used_b for x in range(k, m)):
            continue
        used_a.update(range(i, j))
        used_b.update(range(k, m))
        picked.append({"a": _span_words(A, i, j), "a_syll": (i, j),
                       "b": _span_words(B, k, m), "b_syll": (k, m),
                       "score": tot, "relation": s["relation"],
                       "flags": s["flags"]})
    return picked, len(A), len(B)


def rhyme_density(lex, lines, decl, theta=None):
    """Share of a line's syllables caught in an internal or cross-line match.

    `internal_matches` reads `word_syllable_map`, so an unreadable word is not
    in the denominator OR the numerator -- the density is computed over the
    readable part of the line and printed as if it were the line. Measured: two
    lines whose end word is `zzzqx` return 0.75 with no indication that a word
    was skipped. The number is left as it was (it is a fact about the readable
    material) and `unreadable` now says what was not in it.
    """
    per_line = []
    matched = [set() for _ in lines]
    totals = []
    for idx, line in enumerate(lines):
        picked, nA, _ = internal_matches(lex, line, decl, theta=theta)
        totals.append(nA)
        for p in picked:
            matched[idx].update(range(*p["a_syll"]))
            matched[idx].update(range(*p["b_syll"]))
    for idx in range(len(lines) - 1):
        picked, _, _ = internal_matches(lex, lines[idx], decl,
                                        text_b=lines[idx + 1],
                                        theta=theta)
        for p in picked:
            matched[idx].update(range(*p["a_syll"]))
            matched[idx + 1].update(range(*p["b_syll"]))
    for idx in range(len(lines)):
        d = len(matched[idx]) / totals[idx] if totals[idx] else 0.0
        per_line.append(round(d, 3))
    overall = (sum(len(m) for m in matched) / sum(totals)
               if sum(totals) else 0.0)
    records = readability_records(lex, lines)
    return {"per_line": per_line, "overall": round(overall, 3),
            "readability": records,
            "unreadable": [{"line": r["line"], "words": r["unreadable"],
                            "reason": r["reason"]}
                           for r in records if r["unreadable"]]}


def consonant_skeleton(sylls):
    li = None
    for i in range(len(sylls) - 1, -1, -1):
        if sylls[i]["stress"] in (1, 2):
            li = i
            break
    if li is None:
        li = len(sylls) - 1
    cons = []
    for i, s in enumerate(sylls):
        if i < li:
            cons.extend(s["onset"])
            cons.extend(s["coda"])
        elif i == li:
            cons.extend(s["onset"])
    return cons



#: Typographic apostrophes fold to U+0027 BEFORE any word is extracted.
#:
#: Doctrine 26 was written after a curly apostrophe split `prepar'd` and put
#: the token `d` into an English rhyme table 75 times, which FLIPPED TWO
#: REGISTERED VERDICTS. The fix went into cym.py and fas.py and never came
#: back here: three strip sites in this file, and only ONE of them listed the
#: curly forms -- and stripping edges never helped anyway, because in `weep'd`
#: the apostrophe is INSIDE the word.
#:
#: The song corpus made it unavoidable: 7,550 curly apostrophes across 30
#: files, against 41,925 straight ones, so the SAME WORD arrives in two
#: typographies from two printers and produced two different end words.
APOSTROPHES = "\u2019\u2018\u02bc\u02bb\u055a\uff07`\u00b4"


def fold_apostrophes(text):
    """-> text with every typographic apostrophe folded to U+0027."""
    for ch in APOSTROPHES:
        text = text.replace(ch, "'")
    return text


#: English enclitics that a 19th-century compositor may set with a SPACE before
#: the apostrophe: `There 's high and low`, `Wha 'll buy caller herrin'`.
#: Rogers's 1855 Modern Scottish Minstrel does it 189 times in Nairne and 81 in
#: Hogg, against THIRTEEN in all 17,555 lines of Burns -- same language, same
#: register, opposite tokenisation, purely because of the edition.
#:
#: Splitting there inflates the word count by up to 25% on an affected line,
#: which is the same defect class as fin.py counting a bare hyphen as a word.
#: The set is CLOSED and each member must be the WHOLE token, so word-initial
#: apheresis is untouched: Dorset's `'ithin`, `'twer`, `'oman` are single
#: tokens and never match, and neither does Scots `a'` or `o'`.
ENCLITICS = ("'s", "'ll", "'re", "'ve", "'d", "'m", "'t", "'n")
_SPACED_ENCLITIC = re.compile(
    r"(\w)\s+('(?:s|ll|re|ve|d|m|t|n))\b", re.I)


def join_spaced_enclitics(text):
    """`There 's` -> `There's`. Leaves apheresis and elision alone."""
    return _SPACED_ENCLITIC.sub(r"\1\2", fold_apostrophes(text))


#: A line that is not a line: `Oh, my poor Nelly Gray, &c.` is the printer's
#: shorthand for "and the rest of the chorus", i.e. LINE IDENTITY BY
#: REFERENCE. There are 941 of them in the English song corpus. Its last token
#: strips to `&c`, which is not a word and would enter the rhyme data as one.
#:
#: THE CONVENTION IS NOT ENGLISH, so the LANGUAGE IS A COORDINATE (doctrine
#: 45). The same mechanism, doing the same job in the same position, is spelt
#: differently in each printing tradition, and a single anonymous regex would
#: be a checker silently picking a language. Each entry is (language, gloss,
#: pattern); `chorus_stub_match` returns WHICH one fired.
#:
#: Every pattern is ANCHORED at end of line, because that is where the
#: abbreviation stands in all of them -- these are not general abbreviation
#: detectors and must not become them. `j. n. e.` mid-line is a writer using
#: the phrase, not a printer pointing at a refrain.
CHORUS_STUB_FORMS = (
    # `&c.` / `etc.` -- English songsters. 941 instances.
    ("eng", "&c. / etc. (et cetera)",
     re.compile(r"&c\.?$|&amp;c\.?$|\betc\.?$", re.I)),
    # `j. n. e.` = ja niin edelleen. In the Kanteletar's cumulative chain-songs
    # every verse after the first is abbreviated this way -- a refrain pointer
    # doing exactly `&c.`'s job, in 1840 Finnish. The tokens `j` and `n` are
    # unreadable to fin.py; the `e` IS readable and enters the vowel-initial
    # alliteration class as a word Lonnrot never wrote, which is the worse of
    # the two failures because it is silent.
    ("fin", "j. n. e. (ja niin edelleen)",
     re.compile(r"\bj\.\s*n\.\s*e\.?$", re.I)),
    # `d. s. b.` = dan sebagainya. Recorded in MISSING.md M-4 as ~100
    # instances in the Malay corpus; measured 2026-08-11, this corpus contains
    # ZERO -- see that cell's report. The pattern ships anyway because the
    # convention is real in Malay printing and costs nothing while it matches
    # nothing; it is declared here so the next Malay text is read correctly,
    # and it is NOT evidence that the recorded count was right.
    ("msa", "d. s. b. (dan sebagainya)",
     re.compile(r"\bd\.\s*s\.\s*b\.?$", re.I)),
)

#: What may stand BETWEEN the abbreviation and the end of the line and still
#: leave it a stub: closing quotes, and the EDITOR's own additions -- a
#: footnote reference `[41]` or a parenthetical gloss. Doctrine 58: an
#: editorial bracket is a coordinate, so the allowance is declared here and
#: named in the code rather than hidden inside three regexes.
#:
#: In the Kanteletar it is the difference between catching 6 of 8 stubs and
#: catching 8 of 8: `Aita mulle päälle kaatui j. n. e. [41]` and
#: `Pytikästä j. n. e. (vaikka loppumattomaan).` are stubs whose printer put
#: something after the pointer. Bounded to 60 characters and to bracketed
#: groups so this stays a tail-stripper and does not become a licence to
#: search the whole line.
_STUB_EDITORIAL_TAIL = re.compile(
    r"(?:\s*[\[(][^\[\]()]{0,60}[\])])*\s*[\"'”’.,;:!?]*\s*$")

#: Back-compatible single pattern: any declared convention. Kept because it
#: was the module's public name, and because a caller that does not care which
#: language answered should not have to iterate the table.
CHORUS_STUB = re.compile(
    "|".join(f"(?:{p.pattern})" for _, _, p in CHORUS_STUB_FORMS), re.I)


def chorus_stub_match(line, language=None):
    """-> (language, gloss) of the refrain-pointer convention this line uses,
    or None.

    `language=None` tries every declared convention and REPORTS which one
    fired; naming a language restricts the test to that tradition, so a result
    can say which printing convention it read rather than leaving it implicit.
    """
    s = _STUB_EDITORIAL_TAIL.sub("", line.strip())
    for lang, gloss, pat in CHORUS_STUB_FORMS:
        if language is not None and lang != language:
            continue
        if pat.search(s):
            return (lang, gloss)
    return None


def is_chorus_stub(line, language=None):
    """True if the line is an abbreviated chorus return rather than sung text.

    Such a line must be EXCLUDED from rhyme extraction and RESOLVED against
    the chorus it points at -- it is not evidence about rhyme, it is a
    pointer. See MISSING.md A-1 and M-4. Use `chorus_stub_match` when the
    answer needs to say which language's convention it recognised.
    """
    return chorus_stub_match(line, language) is not None


def _final_bits(sylls):
    """(line-final consonant, final stressed vowel) for groes strictness."""
    fc = sylls[-1]["coda"][-1] if sylls and sylls[-1]["coda"] else None
    fv = None
    for i in range(len(sylls) - 1, -1, -1):
        if sylls[i]["stress"] in (1, 2):
            fv = sylls[i]["nucleus"]
            break
    return fc, fv


def check_cynghanedd(lex, text, decl, language="cym", caesura="marked"):
    """Cynghanedd, on the phonology of the language it belongs to.

    THE DEFECT THIS FIXES. This function has existed since the first commit and
    built its consonant skeleton with `word_syllable_map` -- CMUdict. Cynghanedd
    is a WELSH form and its whole substance is the consonant skeleton, so
    checking it on English phonemes meant the checker had never read a word of
    Welsh. The seven rule errors this function found are real findings about the
    RULES; they were never findings about Welsh, and nothing here said so.

    Welsh has eight digraphs -- ch dd ff ng ll ph rh th -- that are SINGLE
    consonants. An English reading splits `ll` into two /l/ and `dd` into two
    /d/, which corrupts every skeleton in the language while still producing
    plausible output. That is why this could not be approximated.

    `language` is now a coordinate of the declaration rather than an assumption
    (doctrine 1), and it DEFAULTS TO WELSH because that is what cynghanedd is.
    `language="eng"` keeps the original path for English-language imitation --
    Hopkins wrote it, and grading an English attempt at consonantal answering is
    a real use -- but it is now something a caller asks for by name.

    `caesura` is passed through to the Welsh path and is a declared coordinate:
    "marked" refuses a line whose caesura is not printed, "search" tries every
    word boundary and reports how many. A searched rate is not comparable with
    an unsearched one, which is why the caller has to name which it wanted.

    -> {"language", "phonology", "found": [(type, why)], "why_not": str,
        "positions_tried": int}
    """
    if language == "cym":
        from quality.phonology import get   # lazy: no base -> quality cycle
        w = get("cym")
        if caesura == "search":
            hit = w.cynghanedd_scan(text)
            kind, detail, tried = (hit["type"], hit["detail"],
                                   hit["positions_tried"])
        else:
            kind, detail = w.cynghanedd(text, caesura=caesura)
            tried = 1
        return {"language": "cym", "phonology": w.notation,
                "found": [(kind, detail)] if kind else [],
                "why_not": "" if kind else detail,
                "positions_tried": tried}
    if language != "eng":
        raise ValueError(
            f"no cynghanedd phonology for {language!r}. Declared: 'cym' "
            f"(Welsh, the language of the form) and 'eng' (English "
            f"imitation). A language without a declared phonology is refused "
            f"rather than scored with another language's rules.")
    found = []
    parts = [p.strip() for p in text.split(",") if p.strip()]
    if len(parts) == 2:
        ma = word_syllable_map(lex, parts[0])
        mb = word_syllable_map(lex, parts[1])
        sa, sb = consonant_skeleton(ma), consonant_skeleton(mb)
        strict = []
        fca, fva = _final_bits(ma)
        fcb, fvb = _final_bits(mb)
        if fca and fca == fcb:
            strict.append("defect: identical line-final consonants")
        if fva and fva == fvb:
            strict.append("defect: identical final stressed vowels")
        if sa and sa == sb:
            found.append(("croes", f"skeleton {sa} answered exactly"
                          + ("; " + "; ".join(strict) if strict else "")))
        elif sa and len(sb) > len(sa) and sb[-len(sa):] == sa:
            found.append(("traws",
                          f"skeleton {sa} answered after unanswered "
                          f"bridge {sb[:-len(sa)]}"
                          + ("; " + "; ".join(strict) if strict else "")))
        elif sa and sb:
            chime = cluster_sim(sa, sb)
            if chime >= 0.6:
                found.append(("chime",
                              f"graded skeleton similarity {chime:.2f} "
                              f"({sa} ~ {sb}): cynghanedd-adjacent, "
                              f"not strict"))
    if len(parts) == 3:
        a1 = anchor(word_syllable_map(lex, parts[0]))
        a2 = anchor(word_syllable_map(lex, parts[1]))
        s12 = score(a1, a2, decl)
        m2 = word_syllable_map(lex, parts[1])
        m3 = word_syllable_map(lex, parts[2])
        o2 = anchor(m2)[0]["onset"] if anchor(m2) else []
        link = None
        for s in m3:
            if s["stress"] in (1, 2) and o2 and s["onset"] == o2:
                link = s["word"]
                break
        if s12["total"] >= decl.theta_rhyme and link:
            found.append(("sain",
                          f"parts 1-2 rhyme at {s12['total']}, part-3 "
                          f"link on onset {o2} at '{link}'"))
    sylls = word_syllable_map(lex, text)
    if len(sylls) >= 3 and sylls[-1]["stress"] == 0:
        final_word = sylls[-1]["word"]
        word_sylls = [s for s in sylls if s["word"] == final_word]
        if len(word_sylls) >= 2 and word_sylls[-2]["stress"] in (1, 2):
            pen = [word_sylls[-2]]
            limit = len(sylls) - len(word_sylls)
            for i in range(limit):
                if sylls[i]["stress"] in (1, 2):
                    s = score(pen, [sylls[i]], decl)
                    if s["total"] >= 0.9:
                        found.append(
                            ("llusg",
                             f"penult of '{final_word}' rhymes "
                             f"'{sylls[i]['word']}' at {s['total']}"))
                        break
    return {"language": "eng",
            "phonology": "CMUdict General American — ENGLISH IMITATION of a "
                         "Welsh form, not cynghanedd on Welsh",
            "found": found, "why_not": ""}


RIDF_CLASS = {"AA": "alif", "UW": "waw", "OW": "waw",
              "IY": "ya", "AY": "ya", "EY": "ya"}


def _qafiya_parts(lex, line):
    """Rawi/ridf/ta'sis/wasl of a line's rhyme word, or a REFUSAL.

    This is where the shipped file carried `relations.py`'s bug: it took
    `word_syllable_map(...)[-1]["word"]`, the last word the DICTIONARY COULD
    READ, and called it the rhyme word. When the line's real last word is out
    of dictionary the two disagree and an earlier word is silently promoted to
    rhyme word -- measured at 9,812 of 190,804 corpus/song/ lines (5.14%) and
    61 of 2,128 sonnet lines (2.87%). Shakespeare's `grow'st` lines reported
    their rhyme word as `thou`; `zun` reported `the`. The whole qafiya profile
    is a MAJORITY over these, so a few substituted function words move the
    established rawi for every other line as well.

    It now refuses instead. Returning None was also not safe: `check_qafiya`
    read None as "radif/refrain line: licensed", turning 241 unreadable
    corpus/song/ lines into clean passes, so the refusal is typed.
    """
    final = raw_final_token(line)
    sylls = word_syllable_map(lex, line)
    if not sylls or final is None:
        return {"unreadable": True, "endword": final,
                "reason": (f"no readable syllable in the line; CMUdict reads "
                           f"none of it. Refused, not licensed.")}
    endword = sylls[-1]["word"]
    if endword != final:
        return {"unreadable": True, "endword": final,
                "reason": (f"CMUdict has no pronunciation for the end word "
                           f"{final!r}; the last READABLE word is "
                           f"{endword!r}. Refused rather than rhyming on "
                           f"{endword!r}, which is not the rhyme word.")}
    ws = [s for s in sylls if s["word"] == endword]
    ri = None
    for i in range(len(ws) - 1, -1, -1):
        if ws[i]["stress"] in (1, 2):
            ri = i
            break
    if ri is None:
        ri = len(ws) - 1
    rs = ws[ri]
    rawi = rs["coda"][-1] if rs["coda"] else (
        rs["onset"][-1] if rs["onset"] else None)
    ridf = (RIDF_CLASS.get(rs["nucleus"])
            if rs["coda"] and rs["nucleus"] in LONG_VOWELS else None)
    tasis = (ri >= 1 and ws[ri - 1]["nucleus"] == "AA"
             and bool(rs["onset"]))
    wasl = "".join(s["nucleus"] + "".join(s["coda"])
                   for s in ws[ri + 1:])
    wasl_nucleus = ws[ri + 1]["nucleus"] if ri + 1 < len(ws) else None
    return {"endword": endword, "rawi": rawi, "ridf": ridf,
            "tasis": tasis, "wasl": wasl, "wasl_nucleus": wasl_nucleus,
            "unreadable": False, "reason": None}


def check_qafiya(lex, lines, decl):
    norm = [re.sub(r"[^a-z ]", "", l.lower()).strip() for l in lines]
    from collections import Counter as _C
    counts = _C(norm)
    refrain = {i for i, nl in enumerate(norm) if counts[nl] >= 3}
    parts = [None if i in refrain else _qafiya_parts(lex, lines[i])
             for i in range(len(lines))]

    def majority(key):
        # A refused line contributes NOTHING to the established profile. It
        # used to contribute a substituted function word, and the profile is a
        # majority, so one unreadable end word could move the declared rawi for
        # every other line in the poem.
        vals = [p[key] for p in parts
                if p and not p.get("unreadable") and p[key] is not None]
        if not vals:
            return None
        return max(set(vals), key=vals.count)

    prof = {k: majority(k) for k in ("rawi", "ridf", "tasis",
                                     "wasl", "wasl_nucleus")}
    audit, seen, refusals = [], {}, []
    for i, p in enumerate(parts):
        defects = []
        if p is None:
            audit.append((i + 1, "", ["radif/refrain line: licensed"]))
            continue
        if p.get("unreadable"):
            refusals.append({"line": i + 1, "endword": p["endword"],
                             "reason": p["reason"]})
            audit.append((i + 1, p["endword"] or "",
                          [f"REFUSED (not a defect): {p['reason']}"]))
            continue
        if p["rawi"] != prof["rawi"]:
            defects.append(f"rawi differs ({p['rawi']} vs "
                           f"{prof['rawi']}): not in the qafiya")
        if prof["ridf"] and p["ridf"] != prof["ridf"]:
            if {p["ridf"], prof["ridf"]} <= {"waw", "ya"}:
                pass
            else:
                defects.append(f"sinad al-ridf ({p['ridf']} vs "
                               f"{prof['ridf']})")
        if prof["tasis"] and not p["tasis"]:
            defects.append("sinad al-ta'sis (foundation alif missing)")
        if prof["wasl_nucleus"] and p["wasl_nucleus"] and \
                p["wasl_nucleus"] != prof["wasl_nucleus"]:
            defects.append(f"iqwa (post-rawi vowel {p['wasl_nucleus']} "
                           f"vs {prof['wasl_nucleus']})")
        ew = p["endword"].lower()
        if ew in seen:
            defects.append(f"ita (rhyme word repeats line {seen[ew]})")
        else:
            seen[ew] = i + 1
        audit.append((i + 1, p["endword"], defects))
    return {"profile": prof, "audit": audit, "refusals": refusals,
            "lines_total": len(lines), "lines_refused": len(refusals),
            "lines_judged": len(lines) - len(refusals)
            - sum(1 for p in parts if p is None)}


def dedupe_findings(findings):
    """Collapse identical findings, order preserved. BACKLOG 1.5.

    A slop-floor `Finding` carries one entry in `locations` per PAIR it was
    found on, and the revision loop fans it out one brief entry per entry --
    so a line standing in six shared-suffix pairs got the identical
    SHARED_SUFFIX paragraph six times. Cosmetic, and it actively buries the
    findings that are NOT repeated, which are the ones a writer needs.

    Keyed on (code, rendered text) rather than on identity, so two genuinely
    different findings of the same code both survive and only a true
    duplicate is dropped. This is the PRINT-layer guard: the fan-out itself
    lives in quality/revise.py and is that file's owner's to fix. Both are
    idempotent, so the guard is harmless once it is.
    """
    seen, out = set(), []
    for f in findings:
        key = (getattr(f, "code", None), str(f))
        if key in seen:
            continue
        seen.add(key)
        out.append(f)
    return out


def _fmt_score(w1, w2, s):
    lines = [f"{w1}  ~  {w2}",
             f"  total: {s['total']}   relation: {s['relation']}"]
    note = spans_note(s)
    if note:
        lines.append(f"  {note}")
    for k, syl in enumerate(s["syllables"]):
        lines.append(f"  syllable {k+1}: nucleus {syl['nucleus']}"
                     f"  coda {syl['coda']}  onset {syl['onset']}"
                     f"  stress {'match' if syl['stress'] else 'MISMATCH'}")
    if s["flags"]:
        lines.append(f"  flags: {', '.join(s['flags'])}")
    return "\n".join(lines)


def _rel_show(stream, inst):
    """One relation instance as text: the two spans, in words."""
    def span_text(sp):
        us = [stream.units[i] for i in sp.idx if 0 <= i < len(stream.units)]
        toks, seen = [], set()
        for u in us:
            if (u.line, u.token) not in seen:
                seen.add((u.line, u.token))
                toks.append(u.token_text)
        lines = sorted({u.line + 1 for u in us})
        return f"L{'/'.join(map(str, lines))} {' '.join(toks)}"
    return f"{span_text(inst.a)}  ~  {span_text(inst.b)}"


def main():
    decl = Declaration()
    args = sys.argv[1:]
    if not args or args[0] in ("-h", "--help"):
        print(__doc__)
        print("commands:\n"
              "  score  W1 -- W2         graded pair score with sub-scores\n"
              "  candidates W [n]        ranked rhyme candidates\n"
              "  meter  'template' L...  meter check ('.'=weak '/'=strong)\n"
              "  scheme SCHEME L1 L2 ... scheme check, e.g. AABB\n"
              "  demo                    run the acceptance suite\n"
              "  declaration             print the active declaration\n"
              "\nthe quality layer (each says which module answered):\n"
              "  wiring                  which verb runs on which layer,\n"
              "                          plus any STRANDED module\n"
              "  types  W1 -- W2         full rhyme-type coordinate: 9 axes,\n"
              "                          per-member anchor, traditional names\n"
              "  partition FILE|L...     the rhyme scheme as a SET PARTITION,\n"
              "                          canonical RGS, crossings/nestings --\n"
              "                          and it refuses when the cliques\n"
              "                          overlap, because then no letter\n"
              "                          scheme exists at all\n"
              "  cycle  N/D [a+b+c]      metric cycle in exact rationals\n"
              "  relations FILE          named relation instances found\n"
              "  brief  FILE [SCHEME]    what to revise, and what is FORBIDDEN\n"
              "  verify BEFORE AFTER [SCHEME] [lines]  did the revision earn it\n"
              "  readability FILE        what the ingestion layer could not read")
        return
    cmd = args[0]
    lex = Lexicon()

    if cmd == "declaration":
        print(decl.show())

    elif cmd == "score":
        rest = " ".join(args[1:])
        w1, w2 = [s.strip() for s in rest.split("--")]
        _, _, oov1 = lex.transcribe(w1)
        _, _, oov2 = lex.transcribe(w2)
        ancs1, _, _ = line_anchors(lex, w1)
        ancs2, _, _ = line_anchors(lex, w2)
        s = best_score(ancs1, ancs2, decl, w1, w2)
        if oov1 or oov2:
            print(f"  WARNING out-of-vocabulary: {oov1 + oov2}")
        print(_fmt_score(w1, w2, s))

    elif cmd == "candidates":
        word = args[1]
        n = int(args[2]) if len(args) > 2 else 20
        eng = CandidateEngine(lex, decl)
        res = eng.candidates(word, n)
        print(f"candidates for '{word}' "
              f"(anchor {res['anchor_syllables']} syllable(s)):")
        for c in res["candidates"]:
            fl = f"   [{', '.join(c['flags'])}]" if c["flags"] else ""
            print(f"  {c['score']:.3f}  {c['tier']:<8} {c['word']}{fl}")

    elif cmd == "meter":
        template = args[1]
        lines = args[2:]
        for e in check_meter(lex, lines, template):
            mark = "ok " if e.get("syllable_match") else "BAD"
            print(f"  L{e['line']} [{mark}] {e['syllables']} syl "
                  f"(target {e.get('target_syllables')})  "
                  f"stress {e['stress']}  "
                  f"strong-pos agreement {e.get('strong_position_agreement')}"
                  + (f"  OOV:{e['oov']}" if e["oov"] else ""))

    elif cmd == "internal":
        picked, nA, _ = internal_matches(lex, " ".join(args[1:]), decl)
        for p in picked:
            print(f"  {p['a']} ~ {p['b']}  {p['score']}  {p['relation']}")
        if not picked:
            print("  no internal matches")

    elif cmd == "weight":
        pat, matra, oov = line_weights(lex, " ".join(args[1:]))
        print(f"  {pat}  ({len(pat)} syllables, {matra} matras)"
              + (f"  OOV {oov}" if oov else ""))

    elif cmd == "density":
        lines = [l.strip() for l in open(args[1]).read().splitlines()
                 if l.strip() and not l.strip().startswith("[")]
        res = rhyme_density(lex, lines, decl)
        for i, d in enumerate(res["per_line"]):
            print(f"  L{i+1}: {d}")
        print(f"  overall density: {res['overall']}")
        for u in res["unreadable"]:
            print(f"  UNREADABLE L{u['line']}: {u['words']} "
                  f"(not in the numerator or the denominator)")

    elif cmd == "cynghanedd":
        rest = args[1:]
        language = "cym"
        if rest and rest[0].startswith("--lang="):
            language = rest[0].split("=", 1)[1]
            rest = rest[1:]
        res = check_cynghanedd(lex, " ".join(rest), decl, language=language)
        print(f"  phonology: {res['language']} — {res['phonology']}")
        if not res["found"]:
            print(f"  no cynghanedd detected"
                  + (f": {res['why_not']}" if res["why_not"] else ""))
        for kind, why in res["found"]:
            print(f"  {kind.upper()}: {why}")

    elif cmd == "qafiya":
        lines = (open(args[1]).read().splitlines()
                 if len(args) == 2 else args[1:])
        lines = [l.strip() for l in lines if l.strip()]
        res = check_qafiya(lex, lines, decl)
        print(f"  established profile: {res['profile']}   "
              f"(from {res['lines_judged']} judged line(s); "
              f"{res['lines_refused']} refused)")
        for n, ew, defects in res["audit"]:
            print(f"  L{n} ({ew}): "
                  + ("; ".join(defects) if defects else "sound"))

    elif cmd == "graph":
        lines = [l.strip() for l in open(args[1]).read().splitlines()
                 if l.strip() and not l.strip().startswith("[")]
        th = float(args[2]) if len(args) > 2 else None
        g = rhyme_graph(lex, lines, decl, theta=th)
        print(f"nodes {len(g['endwords'])}  edges {len(g['edges'])}  "
              f"pairs judged {g['pairs_judged']}/{g['pairs_total']}"
              + (f"  REFUSED {g['pairs_refused']}"
                 if g["pairs_refused"] else ""))
        for u in g["unreadable_nodes"]:
            print(f"  UNREADABLE L{u['line']} ({u['endword']}): "
                  f"{u['reason']}")
        for k, (i, j, sc, rel) in enumerate(g["edges"]):
            print(f"  L{i+1}({g['endwords'][i]}) -- L{j+1}"
                  f"({g['endwords'][j]})  {sc}  {rel}")
            note = g["edge_spans"][k]["note"]
            if note:
                print(f"        {note}")
        print("maximal cliques (tolerance classes):")
        for cl in g["cliques"]:
            print("  {" + ", ".join(f"L{v+1} {g['endwords'][v]}"
                                    for v in cl) + "}")
        if g["overlapping_nodes"]:
            print("OVERLAPPING nodes (no letter-scheme representation):")
            for v, cs in g["overlapping_nodes"].items():
                print(f"  L{v+1} ({g['endwords'][v]}) in cliques {cs}")
        else:
            print("disjoint cliques: letter-representable")

    elif cmd == "prasa":
        pos = int(args[1])
        res = check_prasa(lex, args[2:], pos)
        for r in res["lines"]:
            print(f"  syllable-{pos} consonant "
                  f"{r['consonant'] or '-'}: {r['line']}")
        print(f"  prasa at position {pos}: "
              f"{'SATISFIED' if res['satisfied'] else 'BROKEN'} "
              f"(target {res['target']})")

    elif cmd == "chains":
        lines = [l.strip() for l in open(args[1]).read().splitlines()
                 if l.strip() and not l.strip().startswith("[")]
        th = float(args[2]) if len(args) > 2 else None
        for ch in infer_chains(lex, lines, decl, theta_chain=th):
            single = ch["length"] == 1
            tag = ("free " if single else
                   "EPIPH" if ch.get("figure") == "epiphora" else "chain")
            fill = (f"   fillers {['L%d %s' % f for f in ch['fillers']]}"
                    if ch["fillers"] else "")
            print(f"  {tag} L{ch['lines'][0]}-L{ch['lines'][-1]} "
                  f"({ch['length']}): {' / '.join(ch['endwords'])}"
                  + (f"   coherence {ch['mean_coherence']}"
                     f" drift-floor {ch['max_drift']}" if not single else "")
                  + fill
                  + (f"   OOV {ch['oov']}" if ch["oov"] else ""))
            for m in ch.get("mosaic_pairs", []):
                print(f"    L{m['lines'][0]}-L{m['lines'][1]} {m['note']}")
            for u in ch["unreadable"]:
                print(f"    UNREADABLE L{u['line']} ({u['endword']}, "
                      f"{u['role']}): {u['reason']}")

    elif cmd == "song":
        blueprint = json.load(open(args[1]))
        lyric = open(args[2]).read()
        res = check_song(lex, blueprint, lyric, decl)
        for s in res["sections"]:
            print(f"  section: {s['name']:<10} lines {s['lines']}")
        for v in res["violations"]:
            print(f"  VIOLATION: {v}")
        for r in res["refusals"]:
            print(f"  REFUSED:   {r}")
        for a in res["advisories"]:
            print(f"  advisory:  {a}")
        if not res["violations"]:
            print("  structure: clean"
                  + (" on what could be read; see REFUSED above"
                     if res["refusals"] else ""))

    elif cmd == "scheme":
        scheme = args[1]
        rest = args[2:]
        profile = None
        if rest and rest[0] == "--profile":
            profile = rest[1]
            rest = rest[2:]
        lines = rest
        res = check_scheme(lex, lines, scheme, decl, profile=profile)
        by_pair = {p["lines"]: p for p in res["pair_scores"]}
        print(f"scheme {scheme}  endwords {res['endwords']}")
        for p in res["pair_scores"]:
            print(f"  L{p['lines'][0]}-L{p['lines'][1]} "
                  f"({p['endwords'][0]}/{p['endwords'][1]}): "
                  f"{p['score']}  {p['relation']}"
                  + (f"  [{', '.join(p['flags'])}]" if p["flags"] else ""))
            if p["spans_note"]:
                print(f"        {p['spans_note']}")
        for v in res["violations"]:
            print(f"  VIOLATION L{v[0]}-L{v[1]} score {v[2]}: {v[3]}")
            note = (by_pair.get((v[0], v[1])) or {}).get("spans_note")
            if note:
                print(f"        {note}")
        for r in res["refusals"]:
            print(f"  REFUSED   L{r['lines'][0]}-L{r['lines'][1]}: "
                  f"{r['reason']}")
        for c in res["collisions"]:
            print(f"  COLLISION L{c[0]}-L{c[1]} score {c[2]}: {c[3]}")
        print(f"  mandated {res['pairs_mandated']}  judged "
              f"{res['pairs_judged']}  refused {res['pairs_refused']}"
              + ("   (a violation RATE divides by judged, not mandated)"
                 if res["pairs_refused"] else ""))
        print(f"  transitivity defect triangles: "
              f"{res['transitivity_defect_triangles']}"
              + (f"  (unknown: {res['transitivity_unknown_triangles']})"
                 if res["transitivity_unknown_triangles"] else ""))

    # ---------------------------------------------------------------------
    # THE QUALITY LAYER, REACHABLE.  Until this block existed, lyric_harness
    # imported nothing from quality/ but `quality.phonology.get`, so 11,540
    # lines of tested production code -- the whole rhyme-type space, the
    # set-partition scheme space, the metric-cycle system, the revision loop
    # -- could not be run by any user-facing path.  Every verb below declares
    # which layer answered it; `wiring` prints the map.
    #
    # These are ADDITIVE.  The fifteen original verbs are untouched, because
    # battery.py is the only calibrated oracle in the project and silently
    # re-pointing `score` or `scheme` at a different comparator would move
    # every recorded number without a single test noticing.
    # ---------------------------------------------------------------------
    elif cmd == "wiring":
        import importlib
        import os as _os
        rows = [
            ("score / candidates / graph / chains", "lyric_harness.py", "spine"),
            ("scheme (letters)", "lyric_harness.py", "spine"),
            ("meter (template)", "lyric_harness.py", "spine"),
            ("song / qafiya / prasa / cynghanedd", "lyric_harness.py", "spine"),
            ("types", "quality/rhyme_types.py", "9-axis coordinate + anchor"),
            ("partition", "quality/schemes.py", "set partitions, Bell numbers"),
            ("cycle", "quality/meter.py", "exact-rational metric cycles"),
            ("relations", "quality/relations.py", "77 named relation schemas"),
            ("brief / verify", "quality/revise.py", "the revision loop"),
            ("readability", "quality/readability.py", "ingestion refusals"),
            ("grid", "quality/grid.py", "bar grid, stanza lock"),
        ]
        print("VERB -> LAYER")
        for verb, mod, what in rows:
            print(f"  {verb:38s} {mod:28s} {what}")
        print("\nIMPORT REACHABILITY (production modules with no non-test caller)")
        # AST, not regex.  The first version of this check used a regular
        # expression and under-reported: it could not see a parenthesised
        # multi-name import, nor a LAZY import inside a function body -- which
        # is exactly how this file reaches quality/, to avoid the base->quality
        # cycle.  A wiring audit that reports a wired module as STRANDED is
        # worse than no audit, so it walks the tree.
        import ast as _ast
        base = _os.path.dirname(_os.path.abspath(__file__))
        prod = []
        for root, _, fs in _os.walk(base):
            if any(x in root for x in (".git", "__pycache__")):
                continue
            for f in fs:
                if f.endswith(".py"):
                    prod.append(_os.path.relpath(_os.path.join(root, f), base))
        imported = set()
        for m in prod:
            if _os.path.basename(m).startswith("test_"):
                continue
            try:
                tree = _ast.parse(open(_os.path.join(base, m),
                                       errors="replace").read())
            except SyntaxError:
                continue
            for node in _ast.walk(tree):
                names = []
                if isinstance(node, _ast.Import):
                    names = [a.name for a in node.names]
                elif isinstance(node, _ast.ImportFrom):
                    root_mod = node.module or ""
                    names = [root_mod] + [f"{root_mod}.{a.name}"
                                          for a in node.names]
                for n in names:
                    for part in (n, n.split(".")[-1]):
                        imported.add(part)
                    imported.add(n.replace(".", "/") + ".py")
        def _stranded(m):
            b = _os.path.basename(m)
            if b.startswith("test_") or b == "__init__.py":
                return False
            if "data/" in m or b == "lyric_harness.py":
                return False
            return _os.path.splitext(b)[0] not in imported
        orphan = [m for m in sorted(prod) if _stranded(m)]
        # "Runnable as a script" is the honest signal for a one-shot runner,
        # not a filename prefix: quality/kalevala_rate.py and hafez_rate.py are
        # exactly as standalone as audit_*.py and were being reported as
        # stranded because they do not happen to start with the right word.
        # A `__main__` block is the author saying this is meant to be RUN.
        def _runnable(m):
            try:
                t = _ast.parse(open(_os.path.join(base, m),
                                    errors="replace").read())
            except SyntaxError:
                return False
            return any(isinstance(n, _ast.If)
                       and _ast.dump(n.test).find("__main__") >= 0
                       for n in t.body)
        runners = [m for m in orphan if _runnable(m)]
        stranded = [m for m in orphan if m not in runners]
        print(f"  one-shot runners, standalone by design "
              f"(`__main__`): {len(runners)}")
        tot = 0
        for m in stranded:
            n = sum(1 for _ in open(_os.path.join(base, m), errors="replace"))
            tot += n
            print(f"  STRANDED  {m}  ({n} lines) — a library with no caller "
                  f"and no way to run it")
        if not stranded:
            print("  STRANDED  none — every production module is either "
                  "imported or runnable")
        else:
            print(f"  stranded total: {tot:,} lines")

    elif cmd == "types":
        from quality import rhyme_types as RT
        from quality.phonology import get as _getphon
        rest, lang, preset = args[1:], "eng", None
        keep = []
        for a in rest:
            if a.startswith("--lang="):
                lang = a.split("=", 1)[1]
            elif a.startswith("--preset="):
                preset = a.split("=", 1)[1]
            else:
                keep.append(a)
        w1, w2 = [s.strip() for s in " ".join(keep).split("--")]
        phon = _getphon(lang)
        kw = {"preset": preset} if preset else {}
        try:
            t = RT.classify_pair(w1, w2, phon, **kw)
        except RT.Indeterminate as e:
            print(f"  INDETERMINATE: {e}")
            return
        if t is None:
            print(f"  UNREADABLE in {lang}: the phonology refuses one or both "
                  f"members. That is a refusal, not a non-rhyme.")
            return
        print(f"  phonology: {lang} — {phon.name}")
        print(f"  agreement (onset,nucleus,coda) per syllable: {t.agreement}")
        print(f"  cells: {t.cells()}")
        for side, a in (("A", t.anchor_a), ("B", t.anchor_b)):
            print(f"  anchor {side}: {a.rule} / {a.determinacy} / span "
                  f"{a.span}" + (f" / index {a.index}" if a.index is not None
                                 else ""))
        for ax in ("identity", "stress", "position", "boundary", "length",
                   "realisation"):
            print(f"  {ax}: {getattr(t, ax)}")
        names = t.names()
        _un = ("UNNAMED at this coordinate — the space is larger than the "
               "vocabulary, and that is the point of it being a space")
        print(f"  NAMES: {', '.join(names) if names else _un}")
        print(f"  verdict: {t.verdict()}   alliterates: {t.alliterates()}")
        route = getattr(t, "route", None)
        if route:
            print(f"  route: {route}   "
                  f"(doctrine 84 — 'declared_relation' means the phonology "
                  f"answered, not the channels)")

    elif cmd == "partition":
        from quality import schemes as SC
        src = args[1:]
        if len(src) == 1 and os.path.exists(src[0]):
            lines = [l.strip() for l in open(src[0]).read().splitlines()
                     if l.strip() and not l.strip().startswith("[")]
        else:
            lines = src
        g = rhyme_graph(lex, lines, decl)
        cov = SC.Cover(n_lines=len(lines),
                       groups=[sorted(c) for c in g["cliques"]])
        part = cov.to_partition()
        print(f"lines {len(lines)}   cliques {len(g['cliques'])}")
        if part is None:
            print("  NO LETTER SCHEME EXISTS for this text.")
            print("  The maximal cliques OVERLAP, so no assignment of one "
                  "letter per line can represent it (doctrine 2). The graph "
                  "is the object; a letter scheme is a lossy projection and "
                  "here the projection does not exist.")
            for v, cs in g["overlapping_nodes"].items():
                print(f"    L{v+1} ({g['endwords'][v]}) in cliques {cs}")
            return
        code = SC.canonical(part)
        c = SC.coordinates(code)
        print(f"  canonical RGS: {code}")
        print(f"  letters:       {SC.label(code)}")
        print(f"  sounds {c.n_sounds}  block sizes {c.block_sizes}  "
              f"singletons {c.singletons}")
        print(f"  max span {c.max_span}  mean span {c.mean_span}  "
              f"crossings {c.crossings}  nestings {c.nestings}  "
              f"adjacencies {c.adjacencies}")
        n = len(lines)
        print(f"  this is ONE of B({n}) = {SC.bell(n):,} partitions of "
              f"{n} lines")
        named = SC.identify(code)
        _un = ("UNNAMED — and the harness says so rather than snapping to "
               "the nearest named scheme")
        print(f"  identified as: {named or _un}")

    elif cmd == "cycle":
        from fractions import Fraction as _F
        from quality import meter as MT
        spec = args[1] if len(args) > 1 else "4/4"
        num, den = spec.split("/")
        groups = tuple(int(x) for x in args[2].split("+")) if len(args) > 2 \
            else ()
        cy = MT.Cycle(pulses=_F(num), unit=int(den), groups=groups)
        print(f"  cycle {spec}   pulses {cy.pulses}  unit {cy.unit}")
        print(f"  bar duration: {cy.pulses}/{cy.unit} = "
              f"{_F(cy.pulses, cy.unit)} whole notes (exact rational, so "
              f".125/1 through 64/32 and fractional numerators all hold)")
        pg = cy.pulse_groups()
        print(f"  pulse groups: {pg if pg else 'NONE DECLARED'}")
        if pg is None:
            n = int(cy.pulses) if cy.pulses.denominator == 1 else 0
            if n:
                print(f"    {spec} admits {MT.n_compositions(n):,} ordered "
                      f"groupings ({', '.join('+'.join(map(str, c)) for c in list(MT.compositions(n))[:4])}"
                      f", ...). The harness returns None rather than asserting "
                      f"one -- a conventional grouping is a CONVENTION and is "
                      f"labelled as such by conventional_grouping().")
                print(f"    conventional: {cy.conventional_grouping()}")

    elif cmd == "relations":
        from quality import relations as RL
        from quality.phonology import get as _getphon
        rest, lang, want = args[1:], "eng", None
        keep = []
        for a in rest:
            if a.startswith("--lang="):
                lang = a.split("=", 1)[1]
            elif a.startswith("--schema="):
                want = a.split("=", 1)[1]
            else:
                keep.append(a)
        # Blank lines are KEPT: relations.py derives the stanza frame from
        # them (its P8 fix), and five schemas declare frame="stanza". Stripping
        # them first -- which every other verb here does -- would silently put
        # the whole text in stanza 0 and make those five unreachable.
        raw = [l.rstrip() for l in open(keep[0]).read().splitlines()
               if not l.strip().startswith("[")]
        lines = [l for l in raw if l.strip()]
        phon = _getphon(lang)
        st = RL.build_stream(raw, phon,
                             stanzas=RL.stanzas_from_blank_lines(raw))
        print(f"  phonology {lang}   lines {len(lines)}   "
              f"units {len(st.units)}   UNREADABLE tokens "
              f"{len(st.unreadable)}")
        if st.unreadable:
            print(f"    dropped: {[u for u in st.unreadable[:8]]}"
                  f"{' ...' if len(st.unreadable) > 8 else ''}")
        found = refused = 0
        for sch in RL.all_schemas().values():
            if want and want.lower() not in sch.name.lower():
                continue
            out = RL.realise(sch, st)
            if isinstance(out, RL.Refusal):
                refused += 1
                if want:
                    print(f"  REFUSED {sch.name}: needs "
                          f"{out.capability} — {out.detail}")
                continue
            hits = [i for i in out if i.verdict is True]
            if hits:
                found += 1
                print(f"  {sch.name}  ({len(hits)} instance(s))")
                for i in hits[:4]:
                    print(f"      {_rel_show(st, i)}")
        print(f"  schemas finding something: {found}   "
              f"refusing on a capability {lang} does not have: {refused}")
        print("  TWO THINGS THESE COUNTS ARE NOT:")
        print("   1. EVIDENCE. `search_k` is carried on every span and "
              "nothing consumes it, so there is no matched control here "
              "(doctrines 56/61). These are instances.")
        print("   2. CLAIMS ABOUT A TRADITION. `RelationSchema.traditions` "
              "is declared on all 77 schemas and populated on ZERO of them, "
              "so every schema is run against every language and there is no "
              "honest filter to apply. When 'Middle Chinese end rhyme "
              "(同用 group)' fires on English, the RULE SHAPE matched — the "
              "tradition did not (doctrine 43). This verb will not pretend "
              "otherwise by hiding the row.")

    elif cmd == "grid":
        from fractions import Fraction as _F
        from quality import grid as GR
        bp = json.load(open(args[1]))
        secs, lines = [], []
        for s in bp.get("sections", []):
            m = s.get("meter", {})
            secs.append(GR.Section(
                name=s["name"], bars=int(s["bars"]),
                start_bar=int(s.get("start_bar", 1)),
                meter=GR.Meter(beats=int(m.get("beats", 4)),
                               unit=int(m.get("unit", 4)),
                               groups=tuple(m.get("groups", ())))))
        for l in bp.get("lines", []):
            lines.append(GR.Line(
                text=l.get("text", ""), bar=int(l["bar"]),
                beat=_F(str(l.get("beat", 1))),
                duration=_F(str(l.get("duration", 4))),
                section=l.get("section", "")))
        song = GR.Song(sections=secs, lines=lines)
        total = sum(s.bars for s in secs)
        print(f"  sections {len(secs)}  bars {total}  lines {len(lines)}")
        for s in secs:
            g = s.meter.groups or "none declared"
            print(f"    {s.name:<12} bars {s.bars:>3}  "
                  f"{s.meter.beats}/{s.meter.unit}  groups {g}")
        u = GR.uniformity(song)
        print(f"  uniformity: {u}")
        findings = GR.stanza_lock(song)
        if not findings:
            print("  STANZA LOCK: not fired — the song is not one shape "
                  "repeated")
        for f in findings:
            print(f"  [{f.code}] {f.message}")
            if f.evidence:
                print(f"      {f.evidence}")
        pp = GR.phrase_profile(song)
        print(f"  phrase profile: {pp}")

    elif cmd == "readability":
        from quality import readability as RD
        lines = RD.read_lines(args[1])
        rep = RD.report(lex, lines)
        for f in rep["findings"]:
            print(f"  [{f.severity.upper()}] {f.code}: {f.message}")
            if f.evidence:
                print(f"      {f.evidence}")
        print(f"  lines {len(lines)}   refusals {len(rep.get('refusals', []))}")

    elif cmd in ("brief", "verify"):
        from quality.revise import Reviser
        rv = Reviser(lex=lex, decl=decl)
        if cmd == "brief":
            lines = [l.rstrip() for l in open(args[1]).read().splitlines()
                     if l.strip() and not l.strip().startswith("[")]
            scheme = args[2] if len(args) > 2 else None
            briefs = rv.brief(lines, scheme)
            if not briefs:
                print("  nothing flagged — every mandated pair passes the "
                      "band on the lines the harness could read")
            for b in briefs:
                print(f"  L{b.line_no}: {b.text}")
                for f in dedupe_findings(b.findings):
                    print(f"      FINDING {f}")
                if b.must_rhyme_with:
                    print(f"      must rhyme with L{b.must_rhyme_with}")
                if b.forbidden_modal:
                    print(f"      FORBIDDEN (modal — doctrine 9): "
                          f"{', '.join(b.forbidden_modal)}")
                if b.candidates:
                    print(f"      offered: {', '.join(b.candidates[:12])}")
        else:
            before = [l.rstrip() for l in open(args[1]).read().splitlines()
                      if l.strip() and not l.strip().startswith("[")]
            after = [l.rstrip() for l in open(args[2]).read().splitlines()
                     if l.strip() and not l.strip().startswith("[")]
            scheme = args[3] if len(args) > 3 else None
            targeted = ({int(x) for x in args[4].split(",")}
                        if len(args) > 4 else None)
            v = rv.verify(before, after, scheme, targeted=targeted)
            print(f"  VERDICT: {'ACCEPTED' if v.get('accepted') else 'REJECTED'}")
            for r in v.get("reasons", []):
                print(f"    {r}")
            for k in ("fixed", "broken", "untargeted", "modal_taken"):
                if v.get(k):
                    print(f"    {k}: {v[k]}")

    elif cmd == "demo":
        print("DECLARATION")
        print(decl.show())
        print("\n--- score: the cliche that is phonetically perfect ---")
        for a, b in [("fire", "desire"), ("orange", "door hinge"),
                     ("hospital", "obstacle"), ("bear", "bare"),
                     ("day", "day"), ("bend", "ending"),
                     ("nation", "station"), ("love", "move")]:
            p1, _, _ = lex.transcribe(a)
            p2, _, _ = lex.transcribe(b)
            s = score(anchor(syllabify(p1)), anchor(syllabify(p2)),
                      decl, a.split()[-1], b.split()[-1])
            print(_fmt_score(a, b, s))
        print("\n--- candidates: what kills fire/desire ---")
        eng = CandidateEngine(lex, decl)
        for q in ("desire", "obstacle"):
            res = eng.candidates(q, 12)
            print(f"{q}:")
            for c in res["candidates"]:
                fl = f"   [{', '.join(c['flags'])}]" if c["flags"] else ""
                print(f"  {c['score']:.3f}  {c['tier']:<8} {c['word']}{fl}")
        print("\n--- scheme check: AABB with a planted failure ---")
        lines = ["The river took the bridge at dawn",
                 "and no one saw the water again",
                 "the cattle waded through the silt",
                 "past every fence the county rebuilt"]
        res = check_scheme(lex, lines, "AABB", decl)
        for p in res["pair_scores"]:
            print(f"  L{p['lines'][0]}-L{p['lines'][1]} "
                  f"({p['endwords'][0]}/{p['endwords'][1]}): "
                  f"{p['score']}  {p['relation']}")
            if p["spans_note"]:
                print(f"        {p['spans_note']}")
        print(f"  violations: {res['violations']}")
        print(f"  collisions: {res['collisions']}")
        print("\n--- meter: iambic tetrameter check ---")
        for e in check_meter(lex, ["The river took the bridge at dawn",
                                   "a broken analytical excuse"],
                             "./" * 4):
            print(f"  L{e['line']} {e['syllables']} syl target 8  "
                  f"stress {e['stress']}  "
                  f"agreement {e['strong_position_agreement']}")
    else:
        print(f"unknown command {cmd}")


if __name__ == "__main__":
    main()
