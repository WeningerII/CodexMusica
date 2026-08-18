#!/usr/bin/env python3
"""
Lyric Harness MVP
Declaration-driven rhyme engine: transcribe, anchor, score, candidates,
check_meter, check_scheme, plus value-layer flags (cliche, repeat,
rime riche, shared suffix, semirhyme).

Every operation runs against an explicit DECLARATION. No hidden defaults:
the declaration prints with every report.

Data files expected beside this script:
  cmudict.dict - CMU Pronouncing Dictionary (General American citation
                 forms), auto-downloaded by fetch_data().
  data/opensubtitles_en_50k.tsv - 50k spoken-register word list, rank
                 order (candidate filtering; membership of the whole
                 candidate pool -- CandidateEngine skips any word with no
                 rank). Repo-committed and provenance-gated (data/sources.tsv,
                 doctrine 85), not fetched over the network. Doctrine 9's
                 modal exclusion in quality/revise.py additionally reads the
                 call-conditional table in data/song_*.tsv -- see
                 quality/frequency.py for why the two are different
                 instruments and quality/RESULTS_SONG_FREQUENCY.md for what
                 each buys.
"""

import json
import math
import os
import re
import sys
import textwrap
import urllib.request
from dataclasses import dataclass, field, asdict

_KNOWN_WORDS = set()   # populated by Lexicon; used by the suffix stem check

HERE = os.path.dirname(os.path.abspath(__file__))
CMUDICT_PATH = os.path.join(HERE, "cmudict.dict")
FREQ_PATH = os.path.join(HERE, "data", "opensubtitles_en_50k.tsv")

CMUDICT_URL = "https://raw.githubusercontent.com/cmusphinx/cmudict/master/cmudict.dict"


def fetch_data():
    if not os.path.exists(CMUDICT_PATH):
        print(f"downloading {os.path.basename(CMUDICT_PATH)} ...", file=sys.stderr)
        urllib.request.urlretrieve(CMUDICT_URL, CMUDICT_PATH)
    if not os.path.exists(FREQ_PATH):
        # Repo-committed and provenance-gated (data/sources.tsv), not a raw
        # upstream mirror -- the file adds a `#` header and a rank column
        # this repo generated, so re-fetching hermitdave/FrequencyWords over
        # the network would not reproduce it. Refuse loudly rather than
        # silently substituting a different file (doctrine 34).
        raise FileNotFoundError(
            f"{FREQ_PATH} is missing. It ships with the repo; if it is "
            f"absent, restore it from version control rather than "
            f"re-fetching -- see its row in data/sources.tsv.")


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

# The English regular -s suffix (plural, 3sg, possessive) has ONE form whose
# realisation is fixed by the base's last phone. `transcribe_word`'s OOV
# fallback used to append a hard-coded Z to every base, which is right for the
# voiced class and impossible for the other two: it produced `wights` =
# W AY1 T Z, and English has no /tz/ coda.
#
# MEASURED AGAINST CMUDICT ITSELF, which is the only test that means anything
# here (doctrine 37 -- test a phonology against its tradition, not against its
# own rules). Over the 12,470 dictionary words ending in orthographic -s whose
# base is a true phonetic PREFIX of them, the rule below predicts the suffix
# for 96.61% against the append-Z fallback's 66.03%. By class:
#     class            n     rule    append-Z
#     voiceless     3,322   99.8%        0.2%
#     voiced/other  8,342   98.6%       98.6%
#     sibilant        806   62.8%        0.0%
# The sibilant residue is not a competing rule: CMUdict writes that syllable
# IH0 Z 506 times and AH0 Z 211 times, and AH~IH is precisely the pair
# `Declaration.nucleus_licence` already declares as one reduced vowel written
# two ways, so the remainder is absorbed one channel down rather than lost.
PLURAL_S_SIBILANT = ("S", "Z", "SH", "ZH", "CH", "JH")   # -> a syllable, IH0 Z
PLURAL_S_VOICELESS = ("P", "T", "K", "F", "TH")          # -> S
# everything else (voiced obstruents, nasals, liquids, glides, vowels) -> Z


def plural_s_tail(base):
    """The phones the regular -s suffix adds after `base`. -> list."""
    if not base:
        return ["Z"]
    if base[-1] in PLURAL_S_SIBILANT:
        return ["IH0", "Z"]
    if base[-1] in PLURAL_S_VOICELESS:
        return ["S"]
    return ["Z"]


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
class _DeclarationChannels:
    """What `PROFILES["full"]` holds: USE THE DECLARATION'S OWN WEIGHTS.

    IT USED TO HOLD `None`, AND THAT IS THE WHOLE DEFECT. Every reader
    reached the table through `PROFILES.get(profile)`, which returns `None`
    for `"full"` -- a legitimate, declared profile name -- and ALSO returns
    `None` for a name the table does not have. So by the time any weight was
    read, `profile="full"` and `profile="bogus"` were the SAME VALUE, and the
    second silently became the first. Measured at the CLI on one quatrain
    (`scheme ABAB dawn again silt rebuilt`): `--profile bogus` was
    BYTE-IDENTICAL to no flag at all and exited 0, while `--profile
    assonance` moved the violation count 2 -> 1 on the same four words. A
    coordinate that changes a measurement must not be reachable by typo.

    Falsy, and `.get` answers like an empty mapping, so every `if prof:` and
    `prof.get(...)` guard downstream reads exactly as it did when this was
    `None` -- the arithmetic is untouched. What changes is that the default is
    now DISTINGUISHABLE from an unrecognised name, which is what lets
    `channel_profile()` raise instead of guessing.
    """

    __slots__ = ()

    def __bool__(self):
        return False

    def get(self, key, default=None):
        return default

    def __repr__(self):
        return "<full: the Declaration's own channel weights>"


#: The explicit sentinel `PROFILES["full"]` holds. NOT `None` -- see above.
DECLARATION_CHANNELS = _DeclarationChannels()

PROFILES = {
    "full": DECLARATION_CHANNELS,
    "assonance": {"weights": {"nucleus": 0.85, "coda": 0.0, "stress": 0.15},
                  "interior": {"nucleus": 0.65, "coda": 0.0, "onset": 0.2,
                               "stress": 0.15}},
    "rawi": {"weights": {"nucleus": 0.30, "coda": 0.55, "stress": 0.15},
             "interior": {"nucleus": 0.25, "coda": 0.45, "onset": 0.15,
                          "stress": 0.15},
             "require_final_consonant": True},
}


class UnknownProfile(ValueError):
    """A channel-profile name `PROFILES` does not have.

    A `ValueError` on purpose: the CLI already has ONE refusal shape for a
    declared coordinate it cannot read (`_blueprint_or_refuse`), and this
    joins it rather than adding a second. A NAMED subclass so a caller that
    wants to tell "you typed a profile that does not exist" apart from "your
    blueprint's time signature is undeclared" can, without matching on
    message text.
    """


def channel_profile(profile):
    """`None` | a name | a pre-built dict -> the channel profile to score under.

    THE LOOKUP RAISES. `PROFILES.get(profile)` did not, and every caller of
    `score`/`best_score`/`check_scheme`/`rhyme_graph` inherited that: a
    library caller passing `profile="assonanace"` got the DEFAULT channel
    weights and no signal of any kind that the profile it declared had been
    dropped. The CLI's `--profile` was one surface of that hole; this is the
    hole.

    `None` means "not declared" and returns the same sentinel `"full"` names,
    because they are the same reading -- what neither of them is, any more, is
    the same as a name nobody declared.
    """
    if profile is None:
        return DECLARATION_CHANNELS
    if not isinstance(profile, str):
        # A pre-built weights dict, handed in directly. Unchanged: this path
        # never went through the table and was never ambiguous.
        return profile
    try:
        return PROFILES[profile]
    except KeyError:
        raise UnknownProfile(
            f"{profile!r} is not a declared channel profile; declared "
            f"profiles are {', '.join(sorted(PROFILES))}. The channel "
            f"weights are a coordinate of the declaration (doctrine 1), so "
            f"an unrecognised name is REFUSED rather than quietly scored "
            f"under the default weights -- which is what `PROFILES.get()` "
            f"did, and which made an unknown profile byte-identical to no "
            f"profile at all.") from None


# ---------------------------------------------------------------------------
# Declaration
# ---------------------------------------------------------------------------

@dataclass
class Declaration:
    dialect: str = "cmudict (General American citation forms)"
    anchor: str = "last primary stress to end of unit"
    # --- WHAT SATISFIES A MANDATE (owner's widening, 2026-08-18) -----------
    # The admitted relation set, DECLARED. Default is the historical pair, so
    # every undeclared run is byte-identical to before the coordinate
    # existed. Widening to ASSONANCE / CONSONANCE is a legal declared move —
    # the counterweight to the homeoteleuton class ban, so a writer pushed
    # off the lazily-spelled end of perfect rhyme has the taxonomy's named
    # near relations as first-class options instead of a shrunken pool. The
    # repo's own count decided this shape: 601 surveyed structures, ~116
    # canonical, 49 the engine names — and the door admitted 2. Validated in
    # __post_init__ against ADMITTABLE_RELATIONS: an unknown name refuses at
    # declaration time, not silently at grade time (doctrine 20).
    admit: tuple = ("RHYME", "RIME_RICHE")

    def __post_init__(self):
        bad = [r for r in self.admit if r not in ADMITTABLE_RELATIONS]
        if bad:
            raise ValueError(
                f"admit={self.admit!r} names {bad} — not admittable. The "
                f"declared vocabulary is {sorted(ADMITTABLE_RELATIONS)} "
                f"(REPEAT is licensed by repeat_licence, never admitted "
                f"as rhyme).")
        if not any(r in RHYME_RELATIONS for r in self.admit):
            raise ValueError(
                f"admit={self.admit!r} contains no rhyme relation — a "
                f"mandate satisfiable ONLY by near relations is not a "
                f"rhyme mandate, and declaring one is more likely a typo "
                f"than a form. Include RHYME (or RIME_RICHE) alongside "
                f"the near relations.")
    channel_weights: dict = field(default_factory=lambda: {
        "nucleus": 0.50, "coda": 0.35, "stress": 0.15,
    })
    # syllables after the stressed one: medial onsets carry the rhyme too
    channel_weights_interior: dict = field(default_factory=lambda: {
        "nucleus": 0.40, "coda": 0.25, "onset": 0.20, "stress": 0.15,
    })
    trailing_syllable_penalty: float = 0.15   # semirhyme discount / extra syllable
    theta_rhyme: float = 0.75                 # lower edge of the match band
    # `theta_repeat_onset: float = 0.95` STOOD HERE UNTIL 2026-08-15, described
    # as "onset similarity above which full identity is REPEAT/rime riche
    # band". THERE IS NO SUCH BAND. `score()` decides REPEAT by `wa == wb` and
    # RIME_RICHE by every channel comparing EQUAL with no extra syllable --
    # exact identity, never a threshold. MEASURED before removal: the six-pair
    # relation/score/flag report is md5 c9b9e7bf4bd2 at 0.0, at 0.5 and at 1.0,
    # byte-identical, and 0.0 vs 1.0 are the two ends that would make
    # EVERYTHING or NOTHING a REPEAT if the band existed. A Declaration field
    # is where a disagreement is located (doctrine 1); this one could not hold
    # one, which is worse than a missing setting because it reads as a knob.
    # The exactness is deliberate -- "identity is not rhyme" is a band-PASS,
    # not a similarity call -- so the repair is to stop advertising a
    # threshold, not to introduce one.
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
    # --- THE SHAPE OF THE CODA QUESTION (doctrine 1, 84, 94) ----------------
    # DECLARED 2026-08-11. `theta_coda` above is a cut on `cluster_sim`, and
    # NO VALUE OF IT REACHES `wall`/`floor`: `cons_sim('R','L')` is 0.9875 and
    # is the ARGMAX of the entire 276-pair consonant matrix, so the only cuts
    # that refuse a lateral against a rhotic are the cuts that refuse every
    # non-identical pair in English. That is not a threshold problem, and two
    # cells found it from different directions on the same day -- `ear`/`will`
    # from the revision loop, `wall`/`floor`/`call`/`more` from a song.
    #
    # The construction is why, and it is general rather than a liquid quirk:
    #   d = 0.30*(voicing differs) + 0.25*|place difference| + 0.45*MANNER_DIST
    # Manner IDENTITY is worth 0.45 of a 1.0 budget while the whole place axis
    # can take away at most 0.25, so EVERY same-manner same-voicing pair scores
    # >= 0.75 whatever its place distance (measured floor 0.7750, F~HH). At
    # `theta_coda` 0.80 that admits 36 of 276 unordered non-identical pairs as
    # AGREEING codas -- 15 fricative, 6 stop, 3 nasal, 1 glide, 1 liquid and 10
    # affricate crossings. `S`~`TH` (0.975, miss/myth), `P`~`T` (0.925,
    # cap/cat), `M`~`N` (0.925), `B`~`D` (0.925, rob/rod), `K`~`T` (0.875,
    # back/bat). None of those is a General American rhyme. R~L is not one
    # defect; it is the top row of a class.
    #
    # THE SCALAR'S ADMITTED SET AND THE ATTESTED SET ARE ALMOST DISJOINT, which
    # is the finding that decides the shape rather than the cut. Over the 1003
    # readable mandated sonnet pairs, exactly 4 distinct non-identical coda
    # pairs clear 0.80 (5 observations: words/affords, deserts/parts,
    # costs/boast, remember'd/tender'd) while the ones the corpus actually
    # attests -- S~Z x8, D~RD x4, RT~T x3, RTH~TH x3 -- are all REFUSED by it.
    # In the fit half, of the 25 distinct non-identical coda pairs the scalar
    # admits anywhere, 4 occur at all in mandated positions; in the held-out
    # half, 1 of 26 does. Spearman(cluster_sim, lift) is +0.156 and +0.122
    # across the two halves -- the same "no ordering information" verdict
    # `vowel_sim` got at +0.02/-0.03, and read the same way (doctrine 57):
    # what reproduces is that it is small, not the digit.
    #
    #   "scalar"    min cluster_sim over the aligned syllables >= theta_coda.
    #               The incumbent from the first commit. REACHABLE, and kept
    #               reachable on purpose (doctrine 84) so the leak above stays
    #               demonstrable rather than optimised away.
    #   "identity"  the coda tuples must be equal. The redteam's REFERENCE LINE
    #               on this channel, promoted to a shape, and SHIPPED -- see the
    #               held-out table below.
    #   "licensed"  identity plus `coda_licence`, the two-tier rule the nucleus
    #               channel has. Reachable, and its licence is EMPTY by default,
    #               which is a measured result and not an oversight. See
    #               `coda_licence`.
    #
    # PRICED HELD-OUT, fit half 0 / held half 1, both arms, before shipping
    # (`quality/redteam_band.py` §7). FPR is against the strict-identity
    # reference on 4,000 random CMUdict pairs, seed 20260810; `refused` is the
    # share of the sonnets' readable mandated pairs the band declines:
    #        shape             FIT FPR  FIT refused   HELD FPR  HELD refused
    #        scalar 0.80         3.55%       12.28%      3.65%         9.44%
    #        scalar 0.90         2.55%       12.28%      2.60%         9.44%
    #        scalar 0.95         2.25%       12.48%      2.30%         9.44%
    #        identity            2.05%       12.48%      2.15%         9.44%
    # Identity cuts the false-positive rate by a third in BOTH halves and costs
    # +0.20pp of mandated pairs in the fit half and EXACTLY ZERO in the held-out
    # half. Doctrine 5's bar is that a change must beat the incumbent held out;
    # this does, in the same direction in both halves, which is the same
    # standard `theta_coda` 0.60 -> 0.80 was shipped on (doctrine 94).
    #
    # Note what the sweep rows show and the ratchet does not: `scalar 0.95`
    # already pays the full true-positive cost and still admits `wall`/`floor`.
    # There is no cut that buys the fix, which is why this is a SHAPE change.
    #
    # Doctrine 24 still governs the consequence: this decides RHYME vs
    # ASSONANCE, it does not reject. `wall`/`floor` is ASSONANCE now -- a named
    # member of the taxonomy, identical nucleus, differing coda -- not a
    # non-relation, and the graph keeps the edge and the name.
    coda_agreement: str = "identity"          # "scalar"|"identity"|"licensed"
    # Unordered consonant pairs that AGREE in a coda without being identical.
    #
    # EMPTY, AND THE EMPTINESS IS THE RESULT. The nucleus channel has exactly
    # one licensed pair (AH~IH) because CMUdict demonstrably writes one reduced
    # vowel two ways, checkable against the dictionary with no poem involved.
    # This cell went looking for the coda's equivalent and there is not one.
    #
    # S~Z was the candidate: 8 observations, the best-attested non-identical
    # coda pair in the mandated sonnet positions. Held out it is a real trade --
    # FPR 2.10%/2.40% against identity's 2.05%/2.15%, mandated refusals
    # 11.49%/8.84% against 12.48%/9.44% -- so it buys true positives and pays
    # false ones, and neither shape dominates. What decides it is WHAT THE EIGHT
    # OBSERVATIONS ARE, and every one is some other layer's defect wearing a
    # coda mismatch:
    #   * `wights`/`knights` is not CMUdict at all. `wights` is absent from the
    #     dictionary and reaches the comparator through `transcribe_word`'s OOV
    #     plural fallback, which appended a hard-coded Z after ANY base. English
    #     -s is /s/ after a voiceless obstruent, so `W AY1 T Z` is a phone
    #     sequence English does not have. That is the INGESTION layer and it is
    #     fixed there, in `PLURAL_S_VOICELESS` (515 distinct words across the
    #     corpora had the same impossible coda).
    #   * `muse`/`use` is a HOMOGRAPH: CMUdict lists `use` only as the noun
    #     Y UW1 S, and Shakespeare's is the verb /juːz/, which rhymes exactly.
    #   * `glass`/`was`, `pass`/`was`, `is`/`amiss`, `this`/`is` are Early
    #     Modern English, the same class as love/prove -- and doctrine 94's own
    #     warning says a threshold cannot be calibrated on a corpus whose
    #     dialect differs from the declared one on the channel the difference
    #     lives in.
    # So the licence would have been a comparator-shaped patch over an
    # ingestion bug, a homograph and a dialect gap: doctrine 79's triage error
    # made three times in one tuple. The MECHANISM ships and stays reachable
    # (doctrine 84) so a later cell with real evidence can fill it; the licence
    # does not, for the same reason the fitted matrix does not (known gap 2) --
    # nothing showed it helped.
    coda_licence: tuple = ()
    # ...and where a licence IS declared it applies only when the licensed pair
    # is the LAST phone of both codas. That is the restriction that keeps a
    # licence a claim about a word-final morpheme rather than a claim that two
    # phones are interchangeable everywhere. It moves NO number on either
    # corpus at the shipped empty licence, and it is declared rather than
    # assumed so that the claim a future licence makes is bounded in advance.
    coda_licence_final_only: bool = True
    # NOT CALIBRATED, and now DECLARED as uncalibrated rather than left
    # unexamined (BACKLOG 1.3). `five`/`of` passes at nucleus similarity 0.603
    # against this 0.600, which is a coin flip wearing a verdict; `bed`/`bead`
    # "agree" at 0.758. The cut admits 40 of the 105 unordered non-identical
    # CMU vowel pairs (38%) -- the whole space is enumerable, so what the
    # number means is a list rather than an intuition, and
    # `quality/test_nucleus.py` prints it.
    #
    # IT IS NOT RAISED, and the reason has changed from "a worse trade" to
    # something sharper that the trade table could not see. theta_coda was
    # priced against the sonnets' mandated pairs and that was sound: what
    # 0.60 -> 0.80 cost there is S~Z x8 (`glass`/`was`, `muse`/`use`) and
    # D~RD x2 -- the VOICING OF A FINAL OBSTRUENT, which English did not
    # change between 1609 and General American. The NUCLEUS is the channel
    # where four centuries of sound change live, and the same corpus prices it
    # completely differently. Measured, tightening 0.60 -> 0.70 costs 31 of
    # 1003 judged mandated pairs, and every one falls into one of three
    # categories with NO remainder -- `quality/test_nucleus.py` asserts the
    # absence of a fourth rather than trusting this list:
    #   * 25 are a VOWEL DIFFERENCE in the declared dialect -- gone/alone
    #     (AO~OW x10), tongue/song (AH~AO x7), have/grave (AE~EY x4),
    #     blood/good (AH~UH x2). 24 are stressed against stressed; the odd one
    #     is perpetual/thrall, an unstressed final promoted against a stressed
    #     syllable, which belongs to `final_promotion` and not here. In the
    #     DECLARED dialect these do not rhyme, which is the same sentence this
    #     project already accepts for love/prove, and refusing them is correct.
    #   * 6 are CMUdict spelling ONE reduced vowel two ways -- graces/faces,
    #     antiquity/iniquity, committed/fitted; the sub-0.70 mismatch is AH0
    #     against IH0 in every one, and it is doubly-UNSTRESSED in 6 of 6.
    #     That is an INGESTION fact, not a rhyme fact (see nucleus_licence).
    # Not one is a General American slant rhyme. So the sonnets cannot price
    # this threshold in either direction: the "true positives" a tightening
    # costs are dialect coverage and a dictionary artifact, and the 8.47% of
    # mandated pairs the channel ALREADY refuses at 0.60 (approve/love,
    # die/memory, give/live, are/care) are the same kind of object. A
    # threshold cannot be calibrated on a corpus whose dialect differs from
    # the declared one, on the channel the dialect difference lives in.
    theta_nucleus: float = 0.60
    # --- THE SHAPE OF THE NUCLEUS QUESTION (doctrine 1, 84) -----------------
    # A scalar cut on a graded similarity matrix is a SHAPE, and it was never
    # declared as one -- it was the function. Measured before being kept:
    # Spearman between `vowel_sim` and each non-identical vowel pair's LIFT
    # (its rate in mandated sonnet rhyme positions over its rate in a random
    # background) is +0.02 on a 3,000-pair background and -0.03 on a 6,000-pair
    # one: |rho| < 0.05 and THE SIGN IS NOT STABLE, which is the finding rather
    # than either number (doctrine 57 -- read what the statistic can resolve).
    # The matrix's ordering carries essentially no information about which
    # vowel pairs a form actually rhymes. The two extremes make it concrete:
    # `IH~IY` scores 0.902 and is ADMITTED, appearing once in the mandated
    # positions against 81 background occurrences (lift 0.24); `AY~IY` scores
    # 0.342 and is REFUSED, appearing 10 times against 20 (lift 6.55).
    #
    #   "scalar"    min vowel_sim over the aligned syllables >= theta_nucleus.
    #               SHIPPED, and shipped as the incumbent rather than as the
    #               winner: no alternative beat it on a metric this corpus can
    #               honestly supply (see theta_nucleus above).
    #   "identity"  the nuclei must be the same phoneme. This is the redteam's
    #               REFERENCE LINE promoted to a reachable shape. Held out it
    #               is 0.20% FPR against the scalar's 3.50% -- and 19.5% of
    #               mandated pairs against 9.4%, because it deletes every near
    #               rhyme, which is exactly what doctrine 94 warns a band tuned
    #               to agree with identity would do. Reachable so the claim is
    #               checkable, NOT proposed.
    #   "licensed"  identity plus `nucleus_licence`, the two-tier rule.
    nucleus_agreement: str = "scalar"          # "scalar"|"identity"|"licensed"
    # Unordered vowel pairs that AGREE without being identical, for the
    # `licensed` shape. The default holds exactly one pair and it is not a
    # judgement about English: CMUdict writes ONE reduced vowel two ways, and
    # the dictionary says so itself -- of its 8,445 words with more than one
    # listed pronunciation, 1,046 (12.4%) collapse to a single pronunciation
    # the moment AH0 and IH0 are read as the same symbol. That is checkable
    # against the dictionary with no poem involved.
    nucleus_licence: tuple = (("AH", "IH"),)
    # ...and the licence applies only where BOTH aligned syllables are
    # unstressed, because that condition is what separates the ingestion fact
    # from a claim about vowels. In mandated sonnet positions AH~IH is
    # 100% doubly-unstressed (6 of 6); in a random background it is 72%
    # (394 of 545). Set False to license the pair everywhere and watch the
    # difference, which is the point of it being a coordinate.
    nucleus_licence_unstressed_only: bool = True
    # --- WHICH END THE SCALAR ALIGNS FROM (doctrine 1, 84, 95) --------------
    # DECLARED 2026-08-11. It was not, and that is the whole point of this
    # coordinate existing: `channel_agreement` was fixed to align flush RIGHT
    # on 2026-08-11 (doctrine 95) and `score` fifty lines below it still read
    # `anc_a[i]` against `anc_b[i]` -- flush LEFT. So the two halves of ONE
    # comparison read the same two anchors differently: the band asks its
    # question tail-aligned and the scalar computes head-aligned. Nothing in
    # the repo said so, which means either reading could have arrived by
    # accident and no test would have noticed.
    #
    # It is NOT a defect, and that is measured rather than assumed. Held out
    # (quality/test_align.py, and the corpora it prints): on a random-pair FPR
    # corpus and on the sonnets' mandated pairs, split in half,
    #   * the sonnet oracle does not move at all -- 82/1014 either way, in both
    #     halves (43 and 39), because a mandated pair's best alignment is
    #     already the equal-length one (doctrine 95's own blind spot, from the
    #     other side). RE-MEASURED 2026-08-11 under `coda_agreement`
    #     "identity": the invariant survives the shape change and only the
    #     digit moved, 81 -> 82, which is the repin argued in `battery.py`;
    #   * the RELATION never flips, because the relation is decided by
    #     `channel_agreement`, which tail-aligns on its own regardless;
    #   * the scalar `total` moves on ~61% of random pairs, i.e. on essentially
    #     every unequal-length pair;
    #   * the admitted-false-positive rate moves by <0.1pp and in the direction
    #     that favours the SHIPPED head reading, which is inside anyone's noise.
    # Doctrine 5 forbids shipping a change that does not beat the incumbent
    # held out. This one does not beat it, so `head` STAYS -- and the
    # difference stays reachable, because a doctrine whose demonstration has
    # been optimised away is a sentence nobody can check (doctrine 84).
    #
    # The two readings are different QUESTIONS, not a right and a wrong answer:
    #   head  the anchor is a span STARTING at the last stress, so syllable 0
    #         is the stressed syllable on both sides and the comparison is
    #         "how alike are these two feet, read forwards from the stress".
    #         Trailing material the other side does not have is charged once,
    #         through `trailing_syllable_penalty`, rather than twice.
    #   tail  rhyme is a suffix relation, so the last syllables must face each
    #         other. This is what the BAND asks, and the band is what decides
    #         RHYME vs ASSONANCE vs CONSONANCE.
    # The scalar is a magnitude and the band is a verdict; they are allowed to
    # read the same anchors differently as long as which one does what is
    # DECLARED. Before this field it was not.
    scalar_alignment: str = "head"            # "head" | "tail"
    final_promotion: bool = True              # verse promotes unstressed finals:
                                              # argument/spent rhymes on -ment
    fitted: bool = False                      # weights hand-set, not corpus-fitted

    def show(self):
        return json.dumps(asdict(self), indent=2)


# ---------------------------------------------------------------------------
# Dictionary + transcription  (projection pi, prominence rho)
# ---------------------------------------------------------------------------

class _DictionaryOnlyLexicon:
    """`Fallback._dictionary`'s view of a `Lexicon`, with no fallback and none
    of `transcribe_word`'s own suffix/elision heuristics -- just the bare
    entries.

    `quality.g2p.Fallback.read` starts by trying `lex.transcribe_word(w)`, so
    handing it the REAL `Lexicon` whose `transcribe_word` is the one calling
    INTO the fallback would recurse: OOV -> ask the fallback -> the fallback
    asks `transcribe_word` -> still OOV -> ask the fallback again, forever.
    This is the non-recursive base case `Fallback` is built to wrap, standing
    in only for the one method it calls.
    """
    def __init__(self, entries, freq_rank):
        self.entries = entries
        self.freq_rank = freq_rank

    def transcribe_word(self, word):
        w = fold_apostrophes(word).lower().strip("'\"“”‘’.,;:!?()[]")
        if w in self.entries:
            return list(self.entries[w][0]), False
        return [], True


class Lexicon:
    def __init__(self, fallback=None, strip_parens=True):
        """`fallback` is a DECLARED coordinate, `None` by default -- omitting
        it reproduces every transcription this class has ever returned,
        unchanged. Passing `"high"` or `"low"` (the same vocabulary
        `quality.g2p.Fallback.min_confidence` uses) builds one and consults
        it for a word the dictionary and this class's own suffix/elision
        heuristics both still refuse.

        THIS DOES NOT CLOSE KNOWN GAP 1. `Fallback` reads morphology
        (`viewest`, `savour`), elision (`o'er`, `groun'`) and compounds --
        every layer that is dictionary-derived. A genuine coinage
        (`hypotenuse`, `shiesty`) has no stem or elision pattern to derive
        from and still refuses at `min_confidence="high"`; only
        `min_confidence="low"` reaches the letter-to-sound layer, which
        `quality/test_g2p.py`'s `test_letter_layer_costs_more_than_it_buys`
        measures as net harmful and which this wiring does not change the
        default away from. `lex.g2p_fallback`,
        when set, is the `Fallback` instance itself, so a caller can read
        `.counts` afterward and see exactly how many words were read at
        which layer -- this class keeps no second, shadow tally.

        `strip_parens` -- see `line_tokens`, whose declaration this shares.
        `True` by default: `(...)` is read as a non-sung aside, same as
        every caller of this class before the coordinate existed. Every
        function in this file that reads a line's words through a `Lexicon`
        (`transcribe`, and everything `line_anchors`/`line_readability`/
        `word_syllable_map` do with one) consults `lex.strip_parens` rather
        than taking a parameter of its own, so this is the ONE place a
        caller declares which of the two traditions -- literary aside or
        voice attribution -- the text in front of it was written in.
        """
        fetch_data()
        self.entries = {}          # word -> list of pronunciations (phone lists)
        self.freq_rank = {}
        self.strip_parens = strip_parens
        self.g2p_fallback = None
        if fallback is not None:
            from quality.g2p import Fallback
            # `self.entries`/`self.freq_rank` are populated below, AFTER this
            # call -- but the shim holds the SAME dict objects, so it sees
            # every entry once the loops below finish. Order relative to
            # those loops does not matter; identity of the dict objects is
            # what makes this work.
            self.g2p_fallback = Fallback(
                _DictionaryOnlyLexicon(self.entries, self.freq_rank),
                min_confidence=fallback)
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
        # data/opensubtitles_en_50k.tsv: `# ...` provenance comments, then a
        # literal `word\tcount\trank` header, then data rows in descending-
        # frequency order -- rank 0 is the first data row, not the header.
        if os.path.exists(FREQ_PATH):
            with open(FREQ_PATH, encoding="utf-8") as f:
                for line in f:
                    if line.startswith("#") or line.startswith("word\t"):
                        continue
                    w = line.split("\t", 1)[0].strip().lower()
                    if w:
                        self.freq_rank.setdefault(w, len(self.freq_rank))

    def transcribe_word(self, word):
        """Return (phones, oov_flag). Naive fallback for out-of-vocabulary."""
        w = fold_apostrophes(word).lower().strip("'\"“”‘’.,;:!?()[]")
        if not w:
            return [], False
        if w in self.entries:
            return list(self.entries[w][0]), False
        # OOV fallback: strip trailing s / 's and re-attach the suffix with
        # its VOICING, which is fixed by the base's last phone (see
        # PLURAL_S_SIBILANT / PLURAL_S_VOICELESS). This used to append a
        # hard-coded ["Z"], which produced phone sequences English does not
        # have -- `wights` came out W AY1 T Z, and /tz/ is not an English
        # coda. Found by cell BA from the comparator end: `wights`/`knights`
        # was the best-attested non-identical coda pair in the sonnets'
        # mandated positions and looked like evidence for licensing S~Z in the
        # band, when it was this line. That is doctrine 79's triage error
        # arriving at the comparator from the ingestion layer, and the fix
        # belongs here.
        for suffix in ("'s", "s"):
            if w.endswith(suffix) and w[: -len(suffix)] in self.entries:
                base = list(self.entries[w[: -len(suffix)]][0])
                return base + plural_s_tail(base), False
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
        if self.g2p_fallback is not None:
            # `word`, not `w`: this method's own `.strip()` above removes a
            # BOUNDARY apostrophe (needed so dictionary lookups aren't keyed
            # on punctuation), but that is exactly the character
            # `Fallback._final_apostrophe` reads to find `groun'`/`thro'` --
            # `read()` does its own normalization, and its strip set omits
            # apostrophes for that reason. Passing the already-stripped `w`
            # here would silently disable that layer.
            r = self.g2p_fallback.read(word)
            if r is not None:
                return list(r.phones), False
        return [], True

    def transcribe(self, text, phrase_final=True):
        """Text -> (phones, words, oov_words). Multiword safe.
        Reads `self.strip_parens` (see `Lexicon.__init__`) to decide whether
        `(...)` is a non-sung aside (stripped, the default) or real words in
        a second voice (kept). Demotes function-word stress so the anchor
        reaches the content word (mosaic rhyme: "spit in it")."""
        text = text.replace("\u2019", "'").replace("\u2018", "'")
        if self.strip_parens:
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


def is_apparatus_line(line):
    """True if `line` is apparatus (a section marker, source note, or

    comment) rather than sung text. Matches the convention already used
    throughout `quality/` (readability.py's `read_lines`, grid.py's
    `read_marked_songs`, fin_rhyme_rate.py, audit_register.py, etc.): a
    `[Section]` header, a `---` source note, or a `#` comment -- the last
    of which is the place a stage direction belongs, since unlike a bare
    `(...)` parenthetical it is unambiguously apparatus and never scored.

    `---`, WITH NO TRAILING SPACE, AND THAT IS THE WHOLE OF THE 2026-08-13
    CONVERGENCE. Two readers were still spelling this rule themselves after
    the 2026-08-12 centralization and both spelled it wrong, in opposite
    ways, and both now CALL this function:

      `quality/readability.py`'s `read_lines` tested `--- ` with a trailing
      space. A four-hyphen epigraph is not `--- `, so four Wordsworth
      epigraphs in `corpus/song/eng_british_felicia_hemans.txt` were verse to
      that one reader and apparatus to every other. `lines_countable`
      151,898 -> 151,894 -- which is the figure `quality/
      RESULTS_HYPHEN_REFUSAL.md` and `token_pieces` below had recorded all
      along, so the fix closed a self-contradicting record rather than moving
      an agreed number.

      `quality/grid.py`'s `read_marked_songs` never stripped before its test
      and routed `[` through `^\\[([^\\]]*)\\]`, so a bracket with NO CLOSING
      `]` matched nothing, opened no block, and was scored as a LYRIC: 133
      lines in 19 files across 130 blocks, 14 of which had a stage direction
      (`[Exeunt.`, `[Drinks.`, `[Music:`) as their entire content.

    STILL OUTSTANDING, and it is a different lot's to close: five more
    `startswith("--- ")` sites survive (`quality/negative_control.py`,
    `cym_rhyme_rate.py` x2, `test_cym.py`, `test_phonology.py`), all on the
    Welsh/negative-control path. They are not measured here because this cell
    does not own them; `grep -rn 'startswith("--- ")'` is the whole list.
    """
    s = line.strip()
    return s.startswith("[") or s.startswith("---") or s.startswith("#")


class UndecodableLyricFile(Exception):
    """A file this harness was told to read as text is not valid UTF-8.

    NOT AN `OSError`, WHICH IS THE WHOLE REASON THIS CLASS EXISTS.
    `__main__`'s handler has caught `OSError` since 2026-08-15 and turns a
    missing file or a directory into `REFUSED ... ` at exit 2 -- and
    `UnicodeDecodeError` is a `ValueError`, so it sailed straight past that
    handler and out as Python's own uncaught exception at exit 1. MEASURED
    at `6d204a7`, on one undecodable file, over the verbs that read a lyric:

        chains graph density relations qafiya partition refrain -> exit 1
        brief verify revise song                                -> exit 2
        readability                                             -> exit 0

    Exit 1 is the code a caller reads as "the harness crashed" (doctrine 20),
    so seven verbs blamed themselves for the caller's file. `readability`
    is worse and is the entry below this one.

    AND THE FOUR AT **2** ARE NOT THE GOOD ROW. They refused in another
    layer's words: their `except ValueError` is the BLUEPRINT/DRAFT LENGTH
    MISMATCH handler, `UnicodeDecodeError` IS a `ValueError`, and the message
    that came out was `REFUSED — 'utf-8' codec can't decode byte 0xff in
    position 0` — right code, right shape, and on `verify BEFORE AFTER`,
    holding two files, naming NEITHER of them. Deriving from `Exception`
    rather than `ValueError` is what stops that clause catching this.

    AND THE EXCEPTION CARRIES NO FILENAME, which is why this is a class and
    not one more clause on `__main__`'s `except`. `UnicodeDecodeError` knows
    the byte, the offset and the codec and NOT the path -- so a handler at
    the top could say "not valid UTF-8" and could not say WHICH FILE, on a
    verb like `verify BEFORE AFTER` that is holding two. Raised where the
    path is in scope, it names both.
    """

    def __init__(self, path, err):
        self.path = path
        self.err = err
        byte = err.object[err.start]
        super().__init__(f"{path} — not valid UTF-8: byte 0x{byte:02x} at "
                         f"offset {err.start} ({err.reason})")


def read_lyric_text(path):
    """-> str. A lyric or corpus file's text, decoded STRICTLY.

    The one definition of "read this file as text" for every reader in this
    project that grades words: `load_lyric_lines` below and
    `quality/readability.py`'s `read_lines`, which had its own second
    spelling of it and got it wrong in the direction that is hardest to see.

    TEXT MODE, `f.read()`, ON PURPOSE -- not `open(path, "rb").decode()`.
    Universal-newline translation happens during the read, so a `\\r\\n` or
    lone-`\\r` file splits the same way it always has here; decoding bytes by
    hand would silently stop translating. And `.splitlines()` rather than
    `.split("\\n")` is what `load_lyric_lines` has always done, so `read_lines`
    adopting this function inherits `.splitlines()`'s extra separators (VT,
    FF, FS/GS/RS, NEL, U+2028, U+2029). MEASURED before the swap over all 279
    decodable files under `corpus/`, `quality/fixtures/` and `examples/`:
    **0 files** contain any of them, so the two readers split every file in
    this repository identically and no recorded line count moves (doctrine 58
    -- the equivalence is measured, not assumed from the shape of the code).
    """
    try:
        with open(path, encoding="utf-8") as f:
            return f.read()
    except UnicodeDecodeError as e:
        raise UndecodableLyricFile(path, e) from e


def load_lyric_lines(path):
    """-> list[str]. Non-empty, non-apparatus lines from a lyric file, in

    the same shape every CLI verb below expects: stripped, in order, blank
    and apparatus lines dropped. One definition so every verb agrees on
    what counts as sung text.
    """
    return [l.strip() for l in read_lyric_text(path).splitlines()
            if l.strip() and not is_apparatus_line(l)]


# A single `FILE|L...` token that is NOT on disk: is it a mistyped path, or a
# one-word lyric line? Both readings are real, the verb cannot tell, and it
# picked one silently -- so `qafiya nope.txt` GRADED THE PATH, reporting
# `L1 (txt)` with the extension as the rhyme word, at exit 0. A wrong answer
# at the success code, which is worse than the traceback the same typo earns
# on every sibling verb.
#
# IT REFUSES ONLY FOR A TOKEN CARRYING A PATH MARKER, because the genuinely
# ambiguous reading is narrower than the merely-absent one. `the cattle waded
# through the silt` has whitespace and no marker: a LINE, unambiguously, and
# `quality/test_verbs.py` has run exactly that. `silt` is a LINE too -- a bare
# word with no separator and no extension is likelier sung than typed at a
# shell. What refuses is a separator anywhere (`draft/verse.txt`, `../song`)
# or a filename extension at the end (`nope.txt`).
#
# MEASURED AS A FALSE-POSITIVE RATE, over the 450,271 sung lines of
# `corpus/song/` -- doctrine 22, state a threshold as an FPR and not as an
# argument about how paths tend to look. **29 lines match, 0.0064%**, and the
# split is the whole finding: **29 by the separator half, 0 by the extension
# half.** Not one of the 29 is sung -- `http://www.ccel.org/...`, four Finnish
# dates (`22/9 1879.`), Byron's transliterated Greek -- so they are apparatus
# the corpus filter did not catch, and the extension half, which is the half a
# mistyped path actually trips, has a measured zero.
_PATH_SHAPED = re.compile(r"[/\\]|\.[A-Za-z0-9]{1,5}$")


def _lyric_source(src, verb):
    """-> list[str] | None. The `FILE|L...` argument shape, decided ONCE.

    `None` means "the arguments ARE the lines" and the caller applies its own
    normalization -- `qafiya` strips and drops blanks, `partition` does not,
    and this function does not quietly make them agree on a question it was
    not asked. What it decides is the READING, which they did agree on and
    both spelled themselves: `os.path.exists(src[0])`, with the else-branch
    taking a path-shaped token as a lyric.
    """
    if len(src) == 1 and os.path.exists(src[0]):
        return load_lyric_lines(src[0])
    if len(src) == 1 and _PATH_SHAPED.search(src[0]):
        _refuse(f"{verb} — {src[0]!r} is not a file, and it is path-shaped",
                detail=[f"the argument is `{verb} FILE|L...`: one token that "
                        f"EXISTS on disk is read as a lyric FILE, anything "
                        f"else as the lyric LINES themselves. This token is "
                        f"on neither side — it is not on disk, and it carries "
                        f"a path separator or a filename extension.",
                        "Reading it as a one-word lyric would grade the PATH: "
                        "`qafiya nope.txt` reported `L1 (txt)`, the extension "
                        "scored as the rhyme word, at exit 0.",
                        "If you meant the FILE, the path is read relative to "
                        "the working directory. If you meant a LINE, pass it "
                        "alongside the others — one line establishes no "
                        "qafiya profile and partitions into one singleton."])
    return None


def line_tokens(text, strip_parens=True):
    """The line's word tokens, in order, before any dictionary filtering.

    Factored out of `line_anchors` and `word_syllable_map`, which carried the
    same three lines twice. This is the only definition of "the words of a
    line" the rhyme path may use; see `raw_final_token`.

    `strip_parens` is a DECLARED coordinate, True by default -- omitting it
    reproduces every tokenization this function has ever returned, unchanged.
    True erases `(...)` spans before tokenizing, on the assumption that
    parenthetical text is a stage direction, not sung. FOUND WRONG FOR ONE
    CALLER AND RIGHT FOR ANOTHER, IN THE SAME COMMIT that added this
    parameter: `corpus/song/` (196 files) uses `(...)` the traditional
    literary way -- an aside, same as Carroll's "(We know it to be true):",
    genuinely not sung -- and `data/song_endword_en.tsv`/
    `song_rhymepair_en.tsv` were built on that reading (doctrine 91: build the
    population the same way the grader reads). A caller writing in
    voice-attribution notation instead -- a whole line in parens as backup
    vocal, a trailing `(ad lib)` as a second voice cutting in -- means the
    OPPOSITE: real sung words, just not the lead's. The same character
    sequence is genuinely ambiguous between two traditions this harness reads
    text from, which is doctrine 1's case exactly: the reading is a
    declaration, not something the function may assume either way. Pass
    `False` to keep parenthetical (and `*asterisk*`-wrapped, never special
    here) text as real words; `quality/build_song_frequency.py` never passes
    it, so the shipped frequency tables are unaffected.
    """
    norm = text.replace("’", "'").replace("‘", "'")
    if strip_parens:
        norm = re.sub(r"\([^)]*\)", " ", norm)
    return [t for t in re.findall(r"[A-Za-z'\-]+", norm)
            if re.search(r"[A-Za-z]", t)]


def raw_final_token(text, strip_parens=True):
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

    `strip_parens` -- see `line_tokens`, whose declaration this one shares.
    """
    toks = line_tokens(text, strip_parens=strip_parens)
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
      final_unreadable_cause
                           `"token"` when NOTHING in the end word read,
                           `"piece"` when its LAST hyphen piece did not while
                           an earlier one did, else None. The two are
                           different defects with different remedies and a
                           single count over both sends them to one layer
                           (doctrine 44's separation, applied to a defect);
                           `"piece"` is also the coordinate that keeps the
                           corpus-wide unreadable-end-word rate comparable
                           across the rule change that introduced it
      final_unread_pieces  the pieces OF THE END TOKEN that did not read
      unreadable           every token in the line CMUdict could not read
      interior_unreadable  unreadable tokens STRICTLY BEFORE the last one
      reason               a sentence naming the instrument, or None

    `interior_unreadable` IS NOW DERIVED BY POSITION (2026-08-11). It was
    every unreadable string whose folded form differed from the WHOLE final
    token, and `transcribe` emits hyphen PIECES, so `zide` of `hill-zide` --
    part of the END word -- was filed as an INTERIOR unreadable and the reason
    string said "a multi-syllable anchor reaching back past one of them is
    reading a line with a hole in it". Measured over the 143 English song
    files, that misfiling was **328 of 328** cases (327 of 327 after cell AC's
    de-duplication). "Interior" and "inside the end word" mean opposite things
    to every consumer downstream -- one is a mosaic-reach warning about
    material the anchor may cross, the other is the rhyme word itself not
    being read -- and collapsing them is doctrine 28. Nothing is deleted:
    the pieces move to `final_unread_pieces` (doctrine 24 -- a rule that would
    delete a category RELABELS instead).
    """
    toks = line_tokens(text, strip_parens=lex.strip_parens)
    final = toks[-1] if toks else None
    _, _, oov = lex.transcribe(text)
    unreadable = list(dict.fromkeys(oov))
    if final is None:
        return {"text": text, "final_token": None, "readable": False,
                "final_unreadable": False, "final_unreadable_cause": None,
                "final_unread_pieces": [], "unreadable": unreadable,
                "interior_unreadable": unreadable,
                "reason": "no word tokens in the line: nothing to anchor on"}
    if anchors is None:
        anchors, _, _ = line_anchors(lex, text)
    # The refusal condition is defined by the shipped path itself: an end word
    # is unreadable exactly when `line_anchors` yields nothing for it. Deriving
    # it any other way would let the record and the behaviour drift apart.
    # That invariant is why the hyphen refusal was put in `line_anchors` and
    # only its CAUSE is re-derived here.
    final_unreadable = not anchors
    fin_read, fin_unread = token_pieces(lex, final)
    # Interior means BEFORE THE LAST TOKEN, by position -- not "spelled
    # differently from the last token".
    interior = []
    for t in toks[:-1]:
        interior.extend(token_pieces(lex, t)[1])
    interior = list(dict.fromkeys(interior))
    cause = None
    if final_unreadable:
        cause = ("piece" if unread_final_piece(lex, final)[0] is not None
                 else "token")
    reason = None
    if cause == "piece":
        reason = (f"the end word {final!r} is a compound and CMUdict has no "
                  f"pronunciation for its LAST piece "
                  f"({', '.join(fin_unread)}); the pieces that DO read "
                  f"({' '.join(fin_read)}) are not the rhyme word, so the "
                  f"harness refuses rather than anchoring on them. This "
                  f"line's end-rhyme is UNKNOWN, not absent, and the gap is "
                  f"the lexicon's, not the poet's.")
    elif final_unreadable:
        reason = (f"CMUdict has no pronunciation for the end word {final!r}; "
                  f"the harness refuses rather than guessing one (no G2P "
                  f"fallback). This line's end-rhyme is UNKNOWN, not absent.")
    elif fin_unread:
        reason = (f"end word {final!r} reads on its LAST piece "
                  f"({fin_read[-1] if fin_read else '?'}), which is the rhyme "
                  f"word, but {len(fin_unread)} earlier piece(s) of the same "
                  f"token are not in the lexicon "
                  f"({', '.join(sorted(fin_unread))}); the anchor is right "
                  f"and the LABEL overstates what was read.")
    elif interior:
        reason = (f"end word {final!r} is readable, but "
                  f"{len(interior)} interior token(s) are not "
                  f"({', '.join(sorted(interior))}); a multi-syllable anchor "
                  f"reaching back past one of them is reading a line with a "
                  f"hole in it.")
    return {"text": text, "final_token": final,
            "readable": not final_unreadable,
            "final_unreadable": final_unreadable,
            "final_unreadable_cause": cause,
            "final_unread_pieces": fin_unread,
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


HYPHEN_SPLIT = re.compile(r"[-‑]")


def token_pieces(lex, token):
    """A hyphenated token -> (pieces READ, pieces NOT read).

    `Lexicon.transcribe` splits a token on its hyphens and looks each piece up
    on its own, so a compound whose pieces do not all read still yields
    phones -- from the pieces that do. Nothing downstream could see that:
    `line_anchors` found an anchor, `line_readability` set
    `final_unreadable = False`, and the span's own provenance recorded the
    WHOLE token as the word it covered.

    MEASURED at commit `2f2d26c` over the 143 `corpus/song/eng_*.txt` files,
    151,894 line ends taken as `line_tokens`-non-empty lines outside the
    `#`/`---`/`[` markers (189,261 counting every non-blank line; at the time
    this was measured, `quality.readability.read_lines` did NOT exclude those
    markers and returned 188,805 -- FIXED 2026-08-12, and `read_lines` now
    returns 151,894 on the current corpus, THE SAME FIGURE, because as of
    2026-08-13 it calls `is_apparatus_line` rather than spelling the rule a
    second time. It carried its own `--- ` WITH A TRAILING SPACE for a day and
    returned 151,898 on that spelling: the difference is four Wordsworth
    epigraphs in `eng_british_felicia_hemans.txt` that open on FOUR hyphens,
    which `--- ` cannot match and `---` does -- doctrine 91, the count is a
    coordinate of the rendering, and a corpus cell was de-duplicating this
    corpus in the same round so it is pinned to a COMMIT and not to a
    date): **323 line ends
    have an unread piece inside an end token that yields phones**, and the
    split by WHICH piece is the triage:

      174 the LAST piece is unread, so any anchor would be built from an
          earlier one and the verdict would be on a string that is not the
          rhyme word -- `hill-zide` anchored on `hill`, `a-vound` on the
          participial `a-` whose only phone is a schwa. ANCHOR layer, a wrong
          answer, **and REFUSED as of 2026-08-11** (`unread_final_piece`,
          `quality/RESULTS_HYPHEN_REFUSAL.md`);
      149 an earlier piece is unread and the last one reads, so the anchor is
          on the right piece and only the LABEL overstates -- `threshing-floor`
          scored on `floor`. REPORT layer, and NOT refused: `span_kind`
          returns `substituted` and `span_label` prints both pieces.

    Three earlier figures and why they differ, because a fourth would
    otherwise appear next round (METHOD's own rule at doctrine 70's
    amendment). Cell U measured the union at **293** on a 189,985-line
    denominator and triaged all of it as ingestion. Cell AB re-cut it at
    **328 = 179 + 149** on 153,115. Cell AC's de-duplication took that to
    327 = 178 + 149 on 151,894 -- the CORPUS moved, not the rule. And the
    letterless guard above takes it to 323 = 174 + 149: `pie--'` and three
    like it were counting a closing quote as an unread piece. Every step is a
    coordinate, and only the last one is a correction.

    A PIECE WITH NO LETTER IS NOT A WORD AND IS NOT COUNTED (added 2026-08-11).
    `line_tokens` already requires a Latin letter of every token it emits, and
    this function has to agree with it or the two disagree about what a word
    is. `--` is an em dash the token regex glued in, so `pie--'` splits to
    `pie` and `'` and the bare quote was being recorded as an unread PIECE:
    four line ends (three in `eng_british_lewis_carroll.txt`, one in
    `eng_british_percy_bysshe_shelley.txt`) were counted as substitutions with
    nothing substituted, and under the refusal rule below they would have had
    a correct verdict withdrawn on the strength of a typesetter's punctuation.
    Doctrine 55's shape one layer down: before treating a mark as structure,
    ask whether it is evidence of the form or an artifact of the edition.
    """
    read, unread = [], []
    for p in HYPHEN_SPLIT.split(token):
        if not p or not re.search(r"[A-Za-z]", p):
            continue
        ph, is_oov = lex.transcribe_word(p)
        (unread if (is_oov or not ph) else read).append(p)
    return read, unread


def unread_final_piece(lex, token):
    """The ANCHOR-layer half of `token_pieces` -> `(read, unread)` or
    `(None, None)`.

    True exactly when the token's LAST letter-bearing hyphen piece is not in
    the lexicon while an earlier one is, which is the case where an anchor
    built from what DID read is an anchor on a string that is not the rhyme
    word: `hill-zide` anchored on `hill`, `a-vound` on the participial `a-`.

    ONE definition, read by `line_anchors` (which refuses) and by
    `line_readability` (which records the cause). Two derivations of the same
    predicate is how a record and a behaviour drift apart, and this module's
    own docstring for `line_readability` says the record must be derived from
    the shipped path rather than beside it.

    `(None, None)` covers three different negatives and they are not
    distinguished here because none of them is this defect: the token has no
    hyphen, the last piece reads (that is the REPORT-layer half —
    `threshing-floor` anchored on `floor`, where the anchor is right and only
    the label overstates), or NOTHING in the token reads (already a refusal
    under the older rule, since `transcribe` then yields no phones at all).
    """
    if not token or not HYPHEN_SPLIT.search(token):
        return None, None
    pieces = [p for p in HYPHEN_SPLIT.split(token)
              if p and re.search(r"[A-Za-z]", p)]
    if len(pieces) < 2:
        return None, None
    read, unread = token_pieces(lex, token)
    if read and unread and pieces[-1] in unread:
        return read, unread
    return None, None


def _tag_span_words(sylls, phones, owners, words, lex=None):
    """Tag each syllable with the word its NUCLEUS came from.

    The nucleus, not the onset: `syllabify` maximises the onset of the next
    syllable, so consonants cross word boundaries and the only phone whose
    word is never in doubt is the vowel. Tagging is best-effort -- if the
    phone list and the owner list have drifted apart, nothing is tagged and
    `span_provenance` then returns None rather than a guess.

    `word_unread` is the hyphen half of the same idea: a span may name a token
    that is only partly the string it was built from, and a provenance record
    that cannot say so is the defect it exists to fix, one level down. See
    `token_pieces`.
    """
    nuclei = [i for i, ph in enumerate(phones) if split_phone(ph)[0] in VOWELS]
    if len(nuclei) != len(sylls) or len(owners) != len(phones):
        return
    total = {}
    for ni in nuclei:
        total[owners[ni]] = total.get(owners[ni], 0) + 1
    pieces = {}
    if lex is not None:
        for w in set(owners[ni] for ni in nuclei):
            tok = words[w]
            if HYPHEN_SPLIT.search(tok):
                pieces[w] = token_pieces(lex, tok)
    seen = {}
    for k, ni in enumerate(nuclei):
        w = owners[ni]
        seen[w] = seen.get(w, 0) + 1
        sylls[k]["widx"] = w
        sylls[k]["word"] = words[w]
        sylls[k]["syl_in_word"] = seen[w]
        sylls[k]["word_syllables"] = total[w]
        rd, un = pieces.get(w, (None, None))
        sylls[k]["word_read"] = tuple(rd) if rd is not None else ()
        sylls[k]["word_unread"] = tuple(un) if un is not None else ()


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
    words = line_tokens(text, strip_parens=lex.strip_parens)
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
        # THE HYPHEN REFUSAL, 2026-08-11. `transcribe` splits a compound on
        # its hyphens and looks each piece up alone, so a token whose LAST
        # piece is missing from the lexicon still yields phones -- from the
        # earlier pieces. Every anchor built from those is an anchor on a
        # string that is NOT the rhyme word, and until now the harness scored
        # it, passed the band on it, and reported the line READABLE:
        # `hill-zide` anchored on `hill`, `a-vound` on the participial `a-`
        # whose only phone is a schwa. Doctrine 79 -- the honest output is a
        # refusal, and a refusal is not a failure. The price is measured in
        # `quality/RESULTS_HYPHEN_REFUSAL.md` on BOTH populations: zero on the
        # sonnet battery (no mandated sonnet pair reads on anything but its
        # last piece) and 174 line ends on the 143-file English song corpus,
        # 84 of them in one Dorset file (doctrine 67 -- a refusal rate is not
        # a tax, measure WHERE it falls).
        if unread_final_piece(lex, last)[0] is not None:
            variants = []
    anchors = []
    for var in variants:
        v = list(var)
        if lw in WEAK_ALWAYS:
            v = [re.sub(r"[12]$", "0", ph) for ph in v]
        full = pre_phones + v
        sylls = syllabify(full)
        if not sylls:
            # An all-consonant CMUdict entry (`sh` -> `SH`, the interjection,
            # is the corpus case that found this: a censored 18th-century
            # name, `_Sh----_`, tokenizes to `sh`) has phones but no vowel
            # nucleus, so `syllabify` finds no syllable to anchor on. Without
            # this guard `starts` fell through to `[len(sylls) - 1] = [-1]`
            # and `sylls[-1:]` on an empty list silently produced an EMPTY
            # anchor -- not a refusal, a hollow reading that crashed the
            # first caller to index into it (`RhymeField.field`). A variant
            # with no syllables is exactly the "unreadable" case this
            # function's own docstring says returns no anchor; skip it the
            # same way, rather than let a phone list stand in for one.
            continue
        if pre_owners is not None:
            _tag_span_words(sylls, full,
                            pre_owners + [len(words) - 1] * len(v), words,
                            lex=lex)
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
                         "read": tuple(s.get("word_read") or ()),
                         "unread": tuple(s.get("word_unread") or ()),
                         "syllables": 0})
        runs[-1]["syllables"] += 1
    return {"words": [r["word"] for r in runs],
            "text": " ".join(r["word"] for r in runs),
            "widx": [r["widx"] for r in runs],
            "runs": runs,
            "syllables": len(anc),
            "partial_word": runs[0]["first_syllable"] > 1,
            # A token whose hyphen pieces did not all read: the span's own
            # label names more STRING than was ever transcribed, which is this
            # module's defect inside a single word. `token_pieces`.
            "substituted": any(r["unread"] for r in runs),
            "unread": tuple(p for r in runs for p in r["unread"]),
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
    # The hyphen case, printed at the SAME place, because a reader shown
    # `hill-zide` has no way to know the harness read `hill`. The word that
    # was actually transcribed is named; the pieces that were not are named
    # too, since which piece failed is the whole triage (`token_pieces`).
    for r in prov["runs"]:
        if r["unread"]:
            lab += (f" [read as {' '.join(r['read']) or 'nothing'!s}: "
                    f"{', '.join(r['unread'])} not in the lexicon, "
                    f"inside {r['word']!r}]")
    return lab


#: How a scored span stands to the END WORD a report prints beside it.
#: These four names are the partition adversary 7 measures over; they are
#: exhaustive and disjoint by construction in `span_kind`.
SPAN_EXACT = "exact"          #: the span IS the end word, whole
SPAN_PART = "part"            #: the span is INSIDE the end word (anchor cut)
SPAN_REACH = "reach"          #: the span reaches back PAST the end word
SPAN_SUBSTITUTED = "substituted"     #: the token did not all read (hyphen)
SPAN_UNATTRIBUTED = "unattributed"   #: no provenance; nothing may be claimed

#: The order the kinds are checked in, worst first. Exhaustive and disjoint.
SPAN_KINDS = (SPAN_UNATTRIBUTED, SPAN_SUBSTITUTED, SPAN_REACH, SPAN_PART,
              SPAN_EXACT)


def span_kind(prov):
    """-> which of the five SPAN_* names describes this span.

    The question is not "is this mosaic". It is the reporting question: **may
    a reader be shown the end word as the evidence for this number?** Four
    ways the answer is no, and they are different defects:

      `substituted` — a hyphenated token did not all read, so the label names
        a string the harness never transcribed: `hill-zide` is anchored on
        `hill`. Ranked worst because the other three name the right string
        and get its extent wrong, while this one names a different string.
        See `token_pieces` for the 328 measured instances and their split;
      `reach` — the span covers MORE than the end word (`get to go`), so the
        printed word is one member of the evidence and the number is not
        about it alone;
      `part`  — the span covers LESS (`-ceipt` of `receipt`), so the printed
        word claims evidence that was never compared;
      `unattributed` — the anchor was not built by `line_anchors`, so there is
        nothing to check the claim against and a guess would be worse than a
        refusal (`span_provenance`). Ranked first because it is the only one
        where the answer is "cannot tell" rather than a defect (doctrine 28).

    `part` is the common case and it is not a bug — it is the declared anchor
    rule, visible. It is still a case where the printed label and the compared
    span are different objects, and doctrine 45 is about saying so.
    """
    if prov is None:
        return SPAN_UNATTRIBUTED
    if prov.get("substituted"):
        return SPAN_SUBSTITUTED
    if not prov["endword_only"]:
        return SPAN_REACH
    if prov["partial_word"]:
        return SPAN_PART
    return SPAN_EXACT


def _norm_word(w):
    """A word as `line_tokens` would leave it, for comparing a printed label
    against a span's own record of what it covered."""
    return fold_apostrophes(w or "").lower().strip("'\".,;:!?()[]")


class Attribution(dict):
    """WHICH two spans produced a number — one immutable record.

    A dict subclass so every existing reader keeps working, and FROZEN after
    construction so the record cannot be edited into agreement with whatever
    a caller wished it said. `span_provenance` already refuses to invent a
    provenance; a mutable record would let one be invented a step later.

    Reachable as attributes rather than only as keys, because the two
    questions a report has to answer -- `exact` (may I print the end words as
    the evidence?) and `differs` (must I print the spans instead?) -- are
    derived, and a derived value stored as a bare key is a value someone
    recomputes differently. Doctrine 45.
    """

    def __init__(self, *a, **kw):
        super().__init__(*a, **kw)
        self._frozen = True

    # -- frozen -----------------------------------------------------------
    # `_frozen` is set at the END of __init__ and read with getattr(...,
    # False), so copy/pickle -- which build the object without calling
    # __init__ and then fill it -- still work. The guard is against a LATER
    # caller rewriting the record, which is the only way it could lie.
    def _locked(self):
        if getattr(self, "_frozen", False):
            raise TypeError(
                "Attribution is frozen: a provenance record that can be "
                "edited after the fact is a provenance record that can be "
                "invented. Build a new one.")

    def __setitem__(self, k, v):
        self._locked()
        super().__setitem__(k, v)

    def __delitem__(self, k):
        self._locked()
        super().__delitem__(k)

    def update(self, *a, **kw):
        self._locked()
        super().update(*a, **kw)

    def pop(self, *a):
        self._locked()
        return super().pop(*a)

    def popitem(self):
        self._locked()
        return super().popitem()

    def clear(self):
        self._locked()
        super().clear()

    def setdefault(self, *a):
        self._locked()
        return super().setdefault(*a)

    # -- the reporting questions ------------------------------------------
    @property
    def kind_a(self):
        return self["kind_a"]

    @property
    def kind_b(self):
        return self["kind_b"]

    @property
    def kinds(self):
        return (self["kind_a"], self["kind_b"])

    @property
    def exact(self):
        """-> True when BOTH spans are exactly their end word, whole, so a
        report may print the two end words as the evidence."""
        return self["kind_a"] == SPAN_EXACT and self["kind_b"] == SPAN_EXACT

    @property
    def differs(self):
        """-> True when the pair a report would print is NOT the pair that
        was compared. The measured quantity of adversary 7."""
        return not self.exact

    @property
    def mosaic(self):
        return self["mosaic"]

    @property
    def tied(self):
        """-> True when the named span is ONE OF SEVERAL at the maximum."""
        return self["tied_at_max"] > 1

    def claims(self, word_a, word_b):
        """-> True when `word_a`/`word_b` really are what was compared.

        The check a report line makes about itself. Two words and a number on
        one line is an assertion; this is the assertion, evaluated.
        """
        return (self._side(self["a"], word_a)
                and self._side(self["b"], word_b))

    @staticmethod
    def _side(prov, word):
        if prov is None or word is None:
            return False
        return (span_kind(prov) == SPAN_EXACT
                and _norm_word(prov["words"][0]) == _norm_word(word))

    def note(self):
        return spans_note({"spans": self})


class Scored(dict):
    """A score and the two spans that produced it, as ONE object.

    Adversary 7's floor was "every score carries the two spans that produced
    it". Carrying them as a KEY on a plain dict meets the words and not the
    point: a key is a flag, and this file's own history is a list of flags
    nobody read. `check_scheme` copied `s["total"]` into a field called
    `score` and left the provenance behind in a sibling field; the violation
    tuples carried the float alone; `battery.py` then printed `it / it` twice
    in its failing-pair table, and both were `enjoys it` ~ `destroys it`.

    So the TYPE is the marker, exactly as `Readings` is a frozenset rather
    than a list-with-a-flag and `FitRefusal.__bool__` RAISES rather than
    being quietly falsy. `best_score` returns a `Scored`; `score` returns a
    plain dict; the difference between "this number came out of a search over
    k hypotheses" and "this number is one comparison" is now visible to
    `isinstance` rather than to whoever remembers to look for a key.

    Two hostilities, both aimed at separation rather than at reading:

      - `spans` cannot be removed, and cannot be replaced by anything that is
        not an `Attribution`. A caller may not strip the provenance and hand
        on a number that looks the same;
      - `str()` renders the number WITH its provenance, so a consumer that
        formats the object rather than digging out `["total"]` cannot print a
        bare number by accident.

    Everything a reader did before still works: `s["total"]`, `s["relation"]`,
    `s["flags"]`, `s["spans"]["a"]`. Nothing about the verdict moves; this is
    a reporting change and `battery.py` is the pin on that (test 7 of
    `quality/test_spans.py`).
    """

    def __setitem__(self, k, v):
        if k == "spans" and not isinstance(v, Attribution):
            raise TypeError(
                "Scored['spans'] must be an Attribution: replacing it with a "
                "plain value is how a provenance record stops being one.")
        super().__setitem__(k, v)

    def __delitem__(self, k):
        if k == "spans":
            raise TypeError(
                "a Scored cannot be separated from its spans -- that "
                "separation IS the defect (BACKLOG 1.2, doctrine 45)")
        super().__delitem__(k)

    def pop(self, k, *a):
        if k == "spans":
            raise TypeError(
                "a Scored cannot be separated from its spans -- that "
                "separation IS the defect (BACKLOG 1.2, doctrine 45)")
        return super().pop(k, *a)

    @property
    def total(self):
        return self["total"]

    @property
    def relation(self):
        return self["relation"]

    @property
    def spans(self):
        """-> the `Attribution`. Never None on a `Scored`: an anchor with no
        word tags gives an Attribution whose sides are None, which is a
        REFUSAL to attribute and not an absent record."""
        return self["spans"]

    def claims(self, word_a, word_b):
        return self.spans.claims(word_a, word_b)

    def __str__(self):
        note = spans_note(self)
        head = f"{self['total']}  {self['relation']}"
        return f"{head}   {note}" if note else head


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
    if sp.get("substituted"):
        which = ("both sides"
                 if sp.get("substituted_a") and sp.get("substituted_b")
                 else "left" if sp.get("substituted_a") else "right")
        note += (f"   SUBSTITUTED ({which}): a hyphen piece of the token "
                 f"never reached the lexicon, so the label names a string "
                 f"the harness did not read")
    return note


def report_pair(s, word_a, word_b, indent="        "):
    """A score, the two words a caller wants to print beside it, and the
    CHECK that those two words are what produced it -> lines of text.

    The one sanctioned way to render a number next to a pair of words. It
    exists because the defect was never that the provenance was unavailable
    after `best_score` recorded it -- it was that a consumer holding both
    printed only one, and nothing in the shape of the data objected. Here the
    label and the evidence are rendered by the same call, and when they are
    not the same thing the line says which is which:

        (go/receipt): 0.579  RHYME
            NAMED PAIR IS NOT THE EVIDENCE: left reaches past `go`,
            right is part of `receipt`
            scored on: get to go  ~  -receipt [last 1 of 2 syllables ...]

    Returns a list of lines, first line unindented, so callers keep their own
    prefixes. Doctrine 24's shape: it RELABELS the line rather than
    suppressing the number, because the mosaic reach is correct behaviour and
    only the report was wrong.
    """
    head = f"({word_a}/{word_b}): {s['total']}  {s['relation']}"
    sp = (s or {}).get("spans")
    if not sp:
        return [head]
    out = [head]
    claimed = (sp.claims(word_a, word_b) if isinstance(sp, Attribution)
               else True)
    if not claimed:
        why, loud = [], False
        for which, prov, word in (("left", sp["a"], word_a),
                                  ("right", sp["b"], word_b)):
            k = span_kind(prov)
            if k == SPAN_SUBSTITUTED:
                why.append(f"{which} `{word}` was read as "
                           f"`{' '.join(prov['runs'][-1]['read'])}` "
                           f"({', '.join(prov['unread'])} unread)")
                loud = True
            elif k == SPAN_REACH:
                why.append(f"{which} reaches past `{word}`")
                loud = True
            elif k == SPAN_UNATTRIBUTED:
                why.append(f"{which} cannot be attributed")
                loud = True
            elif k == SPAN_PART:
                why.append(f"{which} is part of `{word}`")
            elif _norm_word(prov["words"][0]) != _norm_word(word):
                why.append(f"{which} is `{prov['words'][0]}`, not `{word}`")
                loud = True
        # THE BANNER IS GRADED AND THE MEASUREMENT IS NOT. `part` alone --
        # the declared anchor cut, `-again` of `again` -- is 380 of the
        # sonnets' 1014 judged pairs, so banging a NOT THE EVIDENCE drum on
        # every one of them would train a reader to skip the line that
        # matters. It is still counted as not-claimed by `spans_claim`, and
        # the anchor cut is still printed in the span label below. Doctrine
        # 91: the count is a coordinate of the RENDERING, so the rendering
        # says less than the count and the two are named separately rather
        # than reconciled by quietly dropping cases.
        if why and loud:
            out.append(f"{indent}NAMED PAIR IS NOT THE EVIDENCE: "
                       + ", ".join(why))
    note = spans_note(s)
    if note:
        out.append(f"{indent}{note}")
    return out


def best_score(ancs_a, ancs_b, decl, word_a=None, word_b=None, profile=None):
    """Max score over pronunciation variants of both sides — and a record of
    WHICH pair of spans produced the number, in the SAME object.

    The selection is unchanged (first strict maximum wins, so no verdict
    moves); what is added is that the return value is a `Scored` carrying an
    `Attribution`, naming the winning span pair, the words each covers, and
    the size of the search it won. Without it a consumer can only print the
    end words, and when the winner is an interior mosaic reach those name a
    pair that had nothing to do with the number. BACKLOG 1.2 / adversary 7.
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
    out = Scored(best)
    dict.__setitem__(out, "spans", Attribution({
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
        # The hyphen half: the label names a string that was not all read.
        "substituted_a": bool(pa and pa["substituted"]),
        "substituted_b": bool(pb and pb["substituted"]),
        "substituted": bool((pa and pa["substituted"])
                            or (pb and pb["substituted"])),
        # The reporting verdict, computed HERE so every consumer reads the
        # same one. `kind_*` is the five-way partition adversary 7 sweeps.
        "kind_a": span_kind(pa), "kind_b": span_kind(pb),
    }))
    return out


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

#: What a Declaration may ADMIT as satisfying a mandate (`Declaration.admit`).
#: The default is the historical pair; the near relations are LEGAL DECLARED
#: MOVES — the owner's 2026-08-18 finding: a 601-entry world survey
#: (quality/RHYME_CANON.md), ~116 canonical structures, 49 named engine
#: types, and the grader's door admitted two. Widening is BY DECLARATION,
#: never by default: an undeclared assonance still violates, because a
#: mandate satisfied by any near-miss is the sun/much leak wearing a
#: liberty's name. REPEAT is deliberately absent — identity has its own
#: licence machinery (`repeat_licence`) and admitting it here would let a
#: copied word satisfy a rhyme.
ADMITTABLE_RELATIONS = frozenset(RHYME_RELATIONS | NEAR_RELATIONS)


def spelled_rime(word, stress_from_end=None):
    """-> the ORTHOGRAPHIC rime: the spelling from THE RHYMING SYLLABLE's
    vowel letters to the end. hair -> 'air', chair -> 'air', stove ->
    'ove', prayer -> 'ayer', sown -> 'own', bone -> 'one' — and with the
    stress anchor, silver -> 'ilver' against deliver -> 'iver'.

    THE HOMEOTELEUTON PREDICATE (owner's rule, 2026-08-18): two admitted
    rhyme partners whose spelled rimes are IDENTICAL found each other by
    pattern-matching the ending — the laziest class there is, ranked
    beneath every frequency judgment and banned outright, whatever the
    corpus says. This is a fact about SPELLING on purpose: same-sound
    different-spelling pairs (bone/sown, prayer/hair) are where a writer
    has actually reached, and they are judged by the frequency tier
    instead. y counts as a vowel letter (day/way share 'ay'); w does not
    (sown's rime is 'own'). Only ever consulted on pairs the comparator
    already ADMITS, so eye-rhymes (come/home) never reach it.

    `stress_from_end` anchors the rime at the RHYMING syllable, counted in
    vowel groups from the end (1 = the last), exactly as the approved
    definition says — "the string from the rhyming syllable's vowel
    letters to the end". Without it the rime anchors at the last vowel
    group, WHICH OVER-REACHES on feminine rhymes: silver/deliver would
    share '-er' and the entire unstressed -er/-ing/-ed rhyme space would
    be one banned class — precisely the "closing rhyme classes" the owner
    ruled out. Callers with a lexicon derive it from the anchor rule the
    whole harness already uses (last primary stress; see
    `Reviser._spelled_rime`); the bare form is exact for every monosyllable
    and every word stressed on its last full vowel group, which is all 19
    cases the rule was argued on. Silent final -e never counts as a group
    of its own (stove/bone/make fold), so groups approximate SPOKEN
    syllables and the from-end count transfers.
    """
    w = fold_apostrophes(str(word)).lower().strip("'\"“”‘’.,;:!?()[]-")
    letters = [c for c in w if c.isalpha()]
    w = "".join(letters)
    if not w:
        return ""
    vowels = set("aeiouy")
    groups = []          # (start, end) of maximal vowel-letter runs
    i = 0
    while i < len(w):
        if w[i] in vowels:
            j = i
            while j < len(w) and w[j] in vowels:
                j += 1
            groups.append((i, j))
            i = j
        else:
            i += 1
    if not groups:
        return w
    # word-final silent -e: an 'e'-only final group at the very end, with a
    # consonant between it and an earlier vowel group (stove, bone, make) —
    # folded BEFORE the from-end count, so it is never a syllable.
    if (len(groups) >= 2 and groups[-1][1] == len(w)
            and set(w[groups[-1][0]:groups[-1][1]]) == {"e"}
            and groups[-2][1] < groups[-1][0]):
        groups = groups[:-1]
        groups[-1] = (groups[-1][0], len(w))  # extend through the folded e
    k = 1 if stress_from_end is None else max(1, int(stress_from_end))
    start = groups[-k][0] if k <= len(groups) else groups[0][0]
    return w[start:]


def admits(s, theta, relations=None):
    """Does this scored pair count as satisfying a mandate at `theta`?

    Two conditions, and the second is what the conjunctive band adds: the
    scalar has to clear the band AND the relation has to be in the admitted
    set. Before this, an ASSONANCE edge whose nucleus carried it over theta
    was admitted as rhyme -- that is the sun/much leak, and it lives here
    rather than in the comparator.

    `relations` is `Declaration.admit` when a declaration is in play and
    None everywhere else — None means the historical {RHYME, RIME_RICHE},
    so every caller that never learned the coordinate behaves byte-for-byte
    as it always has. A declared set is validated against
    ADMITTABLE_RELATIONS by the Declaration, not re-checked here.
    """
    rel = RHYME_RELATIONS if relations is None else relations
    return s is not None and s["total"] >= theta and \
        s["relation"] in rel

#: THE UNINTENDED-RHYME CUT, and it lives HERE because two modules apply it to
#: the same question and one definition is the only thing that keeps them
#: equal. `check_scheme` below and `quality/revise.py`'s collision scan report
#: the SAME SET — every pair at or above this scalar that shares no group —
#: and `revise.py`'s own `COLLISION_CUT_IS_SCALAR_ONLY` finding says in as many
#: words that "the two constants must not drift". UNTIL 2026-08-16 NOTHING
#: STOPPED THEM: this module spelled a bare literal and `revise.py` declared a
#: second constant of its own, so a lot moving either moved exactly one. `quality/mutate.py`
#: QR6 is the proof rather than the worry — it raises the threshold to 1.1 to
#: check the constant is load-bearing, and against the old spelling it moved
#: `revise.py` ALONE, leaving the two halves of the repo reporting different
#: collision sets while every suite stayed green.
#:
#: NOT UNIFIED WITH EVERY OTHER 0.9 IN THIS FILE, and that is a decision and
#: not an oversight: `check_cynghanedd`'s llusg test also reads `>= 0.9` and is
#: a DIFFERENT QUESTION — does a final penult rhyme an earlier syllable in the
#: same line — which happens to have been given the same number. Binding it to
#: this name would make a Welsh-imitation rule move whenever the English
#: collision report was retuned (doctrine 1: one coordinate, one question).
THETA_COLLISION = 0.9

# `admits()` is defined ABOVE, beside RHYME_RELATIONS / ADMITTABLE_RELATIONS
# — one definition, one predicate. A second copy stood here until 2026-08-18
# and, being later in the file, silently SHADOWED the parameterized one: the
# `relations=` keyword raised TypeError on the first call. One question, one
# name, ONE definition (doctrine 1).


def nucleus_agrees(ta, tb, decl):
    """The nucleus channel's PREDICATE shapes: `identity` and `licensed`.

    The scalar shape is not here — it is the `min(vowel_sim(...))` in
    `channel_agreement`, unchanged and still the default. This function exists
    because "a cut on a graded similarity matrix" is a SHAPE and it was never
    declared as one; making the alternatives reachable is what keeps the
    difference measurable (doctrine 84).

    `licensed` is the two-tier rule: identity, plus `decl.nucleus_licence`.
    The default licence is one pair, AH~IH, and it is an INGESTION fact rather
    than a claim about vowels — CMUdict writes one reduced vowel two ways, and
    1,046 of its 8,445 multi-pronunciation words collapse to a single
    pronunciation once the two symbols are read as one. `graces`/`faces` and
    `committed`/`fitted` are perfect rhymes whose only difference in CMUdict is
    which of the two symbols it chose for the unstressed syllable, and charging
    the comparator for that is the ingestion/comparator triage error (doctrine
    79) one layer down. `nucleus_licence_unstressed_only` is what
    keeps it an ingestion fact: in mandated sonnet positions AH~IH is 100%
    doubly-unstressed, in a random background 72%.
    """
    if decl.nucleus_agreement not in ("scalar", "identity", "licensed"):
        # An undeclared shape must be loud. Falling through to `identity` would
        # be a coordinate quietly lying about its own range.
        raise ValueError(
            f"Declaration.nucleus_agreement must be 'scalar', 'identity' or "
            f"'licensed', got {decl.nucleus_agreement!r}")
    lic = {tuple(sorted(p)) for p in decl.nucleus_licence}
    for x, y in zip(ta, tb):
        if x["nucleus"] == y["nucleus"]:
            continue
        if decl.nucleus_agreement != "licensed":
            return False
        if tuple(sorted((x["nucleus"], y["nucleus"]))) not in lic:
            return False
        if decl.nucleus_licence_unstressed_only and not (
                x["stress"] == 0 and y["stress"] == 0):
            return False
    return True


def coda_agrees(ta, tb, decl):
    """The coda channel's PREDICATE shapes: `identity` and `licensed`.

    The exact mirror of `nucleus_agrees`, and it exists for the same reason:
    "a cut on a graded similarity matrix" is a SHAPE, and on this channel it
    was the function rather than a declared coordinate. The scalar shape is
    still the `min(cluster_sim(...))` in `channel_agreement`.

    THE CLUSTER RULE IS SAME-LENGTH, POSITION-WISE. Two codas agree if they
    have the same number of phones and each aligned phone is identical or an
    unordered member of `decl.coda_licence`. A licence is a claim about ONE
    segment, so extending it to a Needleman-Wunsch alignment over unequal
    lengths would let a licence buy a DELETION, which is a different claim
    entirely -- that is `nelms`/`seashells` (LMZ ~ LZ), admitted by the scalar
    at exactly 0.800, and it is not an English rhyme.

    Two ABSENT codas agree, here as in the scalar (doctrine 25): `see`/`free`.
    That falls out of `() == ()` and needs no special case.
    """
    if decl.coda_agreement not in ("scalar", "identity", "licensed"):
        # Same reason as nucleus_agrees: an undeclared shape must be loud.
        raise ValueError(
            f"Declaration.coda_agreement must be 'scalar', 'identity' or "
            f"'licensed', got {decl.coda_agreement!r}")
    lic = {tuple(sorted(p)) for p in decl.coda_licence}
    for x, y in zip(ta, tb):
        ca, cb = tuple(x["coda"]), tuple(y["coda"])
        if ca == cb:
            continue
        if decl.coda_agreement != "licensed":
            return False
        if len(ca) != len(cb):
            return False
        for k, (p, q) in enumerate(zip(ca, cb)):
            if p == q:
                continue
            if tuple(sorted((p, q))) not in lic:
                return False
            if decl.coda_licence_final_only and k != len(ca) - 1:
                return False
    return True


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
    if decl.nucleus_agreement != "scalar":
        # A non-scalar SHAPE answers this channel with a predicate instead of
        # a magnitude, so its verdict is folded into the same `nuc` the return
        # line reads and `theta_nucleus` still names the cut. Infinities rather
        # than 1.0/0.0 so that no value of `theta_nucleus` can invert a shape's
        # answer: one coordinate silently overriding another would be doctrine
        # 1 broken inside the tuple.
        nuc = float("inf") if nucleus_agrees(ta, tb, decl) else float("-inf")
    codas = []
    for i in range(n):
        ca, cb = ta[i]["coda"], tb[i]["coda"]
        codas.append(1.0 if (not ca and not cb) else cluster_sim(ca, cb))
    if decl.coda_agreement != "scalar":
        # A non-scalar SHAPE answers this channel with a predicate instead of
        # a magnitude, exactly as the nucleus does above, and infinities keep
        # any value of `theta_coda` from inverting it.
        #
        # PER SYLLABLE, deliberately, even though `coda_agrees` would happily
        # take the whole span: the conjunction across syllables has to stay in
        # the `min(...)` below, where the band's other channel reads it and
        # where `quality/mutate.py` M3 and M5 test it. Hiding it inside the
        # predicate would leave two mutants with nothing to break and the
        # suite would report that as strength.
        codas = [float("inf") if coda_agrees([x], [y], decl)
                 else float("-inf") for x, y in zip(ta, tb)]
    return nuc >= decl.theta_nucleus, min(codas) >= decl.theta_coda


def score(anc_a, anc_b, decl, word_a=None, word_b=None, profile=None):
    """Score two anchors. Returns dict with total, per-channel sub-scores,
    relation (RHYME / REPEAT / RIME_RICHE band flags), and value flags."""
    out = {"total": 0.0, "syllables": [], "relation": "RHYME", "flags": []}
    if not anc_a or not anc_b:
        out["relation"] = "NO_ANCHOR"
        return out
    # WHICH END THE COMPARISON ALIGNS FROM IS A DECLARED COORDINATE, and it is
    # deliberately NOT the same as `channel_agreement`'s. See
    # `Declaration.scalar_alignment` for the held-out measurement that left the
    # default where it is, and `quality/test_align.py` for the pin. Trailing
    # extras are penalized once, through `trailing_syllable_penalty`.
    n = min(len(anc_a), len(anc_b))
    extra = abs(len(anc_a) - len(anc_b))
    if decl.scalar_alignment == "tail":
        # Flush RIGHT, the band's reading: slice both spans to their last n
        # syllables so the loop below compares last-against-last. Everything
        # downstream is safe under this rebinding and it is worth saying why
        # rather than leaving it to be rediscovered: `extra` is already taken
        # from the ORIGINAL lengths; `anc_a[-1]` (the rawi check) is the same
        # element either way; and `full_identity` is guarded by `extra == 0`,
        # which is exactly the case where the slice is the identity map.
        anc_a, anc_b = anc_a[-n:], anc_b[-n:]
    elif decl.scalar_alignment != "head":
        # An undeclared value must be loud, not silently one of the two.
        raise ValueError(
            f"Declaration.scalar_alignment must be 'head' or 'tail', "
            f"got {decl.scalar_alignment!r}")
    # `channel_profile`, NOT `PROFILES.get`: an unknown name RAISES here
    # rather than returning `None` and being scored under `decl`'s own
    # weights, which is what made an undeclared profile indistinguishable
    # from the declared `full` (see `_DeclarationChannels`). The sentinel is
    # falsy and answers `.get` like an empty mapping, so the three reads of
    # `prof` below are unchanged.
    prof = channel_profile(profile)
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
        """-> ONE dict shape, always, whether or not the query reads.

        The no-anchor return used to be `{"error", "oov"}` and nothing else,
        so a caller that read `res["anchor_syllables"]` or `res["candidates"]`
        -- the two keys the success return exists to carry -- raised KeyError
        on every unreadable query instead of seeing a refusal. The CLI's own
        `candidates` verb did exactly that and crashed on `hypotenuse`, this
        repo's OWN canary word (known gap 1); `quality/revise.py` escaped
        only because `_field` happens to read `res.get("candidates", [])`.
        A refusal is not a failure and it is not an empty field either
        (doctrine 79) -- `error` is set and the counts are honest zeroes, so
        no consumer can mistake "cannot tell" for "none" (doctrine 28).
        """
        phones, words, oov = self.lex.transcribe(text)
        anc_q = anchor(syllabify(phones))
        if not anc_q:
            return {"query": text, "anchor_syllables": 0, "oov": oov,
                    "candidates": [], "error": "no anchor"}
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
    # FAIL FAST ON THE PROFILE, before a single anchor is read. `score()`
    # would raise on it anyway, but it does so once per PAIR from four frames
    # down, and this function's whole contract is "the comparator these
    # counts were obtained under" -- an undeclared comparator is not a thing
    # to discover partway through a matrix.
    channel_profile(profile)
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
                elif s["relation"] in NEAR_RELATIONS and \
                        s["relation"] not in decl.admit:
                    # An ADMITTED near relation falls through to `admits()`
                    # below and satisfies on its scalar — the declared
                    # widening (`Declaration.admit`), never the default.
                    violations.append(
                        (i + 1, j + 1, s["total"],
                         f"{s['relation']} not rhyme (conjunctive band; "
                         f"not in the declared admit set)"))
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
                elif not admits(s, decl.theta_rhyme,
                                relations=frozenset(decl.admit)):
                    # THE SECOND COPY OF THE SAME BLACKLIST, and it had the
                    # same hole. See `quality/revise.py`'s `grade()` for the
                    # measurement (`debenture`/`thermco`, 0.788 against theta
                    # 0.75, "neither channel agrees", reported as no
                    # violation). `NO_RELATION` is not REPEAT, not in
                    # NEAR_RELATIONS, not NO_ANCHOR, and can sit above theta —
                    # so it fell out of an enumerated chain into silence.
                    #
                    # THAT THIS LIST EXISTS TWICE IS THE STANDING DEFECT and
                    # is left standing deliberately: `grade()` and
                    # `check_scheme` are two readers of one question and the
                    # record already says they must not drift, so both ends
                    # move together here rather than one being taught to call
                    # the other in the same commit that fixes what they say.
                    violations.append(
                        (i + 1, j + 1, s["total"],
                         f"{s['relation']} not rhyme (conjunctive band)"))
            else:
                if s["total"] >= THETA_COLLISION:
                    # THE CUT IS THE NAMED CONSTANT SINCE 2026-08-16 —
                    # it was the literal `0.9` here and `THETA_COLLISION`
                    # in `quality/revise.py`, two spellings of one number
                    # that the collision finding itself says must not
                    # drift. One definition now, at the top of this file.
                    # RELATION IS CARRIED NOW (2026-08-11), not dropped. A
                    # scalar-only cut here reported correctly-typed ASSONANCE
                    # and CONSONANCE edges under the label "unintended
                    # rhyme" -- a report-layer defect distinct from the
                    # comparator (cell BA found it while investigating a
                    # false claim in this repo's own commit history: what
                    # looked like the coda channel admitting `will`/`gun` was
                    # actually this loop printing an ASSONANCE edge under a
                    # RHYME-shaped message). The caller filters on
                    # `s["relation"]` now instead of assuming every member is
                    # a rhyme; `quality/revise.py`'s collision partition
                    # already did this independently and this brings the raw
                    # `scheme`/`song` CLI print into agreement with it.
                    collisions.append(
                        (i + 1, j + 1, s["total"], s["relation"],
                         "unintended rhyme across scheme letters"
                         if s["relation"] in ("RHYME", "RIME_RICHE")
                         else f"unintended {s['relation']} across scheme "
                              f"letters, NOT a rhyme"))
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
                        return admits(s, decl.theta_rhyme,
                                      relations=frozenset(decl.admit))
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
                 "spans_note": spans_note(matrix[i][j]),
                 # The CLAIM the report line makes, evaluated. `endwords` and
                 # `score` on one row is an assertion that those two words
                 # produced that number; this is that assertion's verdict, so
                 # a consumer does not have to re-derive it and derive it
                 # differently. Adversary 7.
                 "spans_claim": matrix[i][j]["spans"].claims(
                     endwords[i], endwords[j]),
                 "spans_kinds": matrix[i][j]["spans"].kinds}
                for i in range(n) for j in range(i + 1, n)],
            "violations": violations,
            # Index-aligned with `violations`, exactly as `edge_spans` is with
            # `edges`, because the violation tuple's arity is what battery.py
            # and every triage script unpack and a fifth field would break
            # them. A violation whose number came from other spans is a
            # violation somebody will triage to the wrong layer.
            "violation_spans": [
                {"lines": (v[0], v[1]),
                 "endwords": (endwords[v[0] - 1], endwords[v[1] - 1]),
                 "spans": matrix[v[0] - 1][v[1] - 1]["spans"],
                 "claim": matrix[v[0] - 1][v[1] - 1]["spans"].claims(
                     endwords[v[0] - 1], endwords[v[1] - 1]),
                 "note": spans_note(matrix[v[0] - 1][v[1] - 1])}
                for v in violations],
            "collisions": collisions,
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
    # Same fail-fast as `check_scheme`, and for the same reason: the graph IS
    # the primary object (doctrine 2), so which comparator built it is not a
    # detail that may be silently substituted.
    channel_profile(profile)
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


# `group_sounds`/`check_song`, the OLD blueprint schema this file's `song`
# verb used to read ({"sections":[{"name","type","lines","scheme"} |
# {"name","type","ref": prior name}]}), were REMOVED 2026-08-12. Every
# blueprint shipped in this repo had already moved to the bar-grid shape
# (bars/start_bar/meter/function, per-line bar/beat/duration) that
# `quality/grid.py`/`quality/fit.py`/`quality/revise.py` all read, and
# `check_song` could not process that shape at all -- it refused by name on
# EVERY real blueprint in `examples/`, silently, since the rewrite. `song`
# now reads the same shape and the same Reviser pipeline `brief`/`verify`/
# `revise --blueprint=` do; see its dispatch in `main()`.





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
    words = line_tokens(text, strip_parens=lex.strip_parens)
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
    rhyme word -- REMEASURED 2026-08-11 at **9,806 of 189,985** corpus/song/
    lines (5.16%) and 61 of 2,128 sonnet lines (2.87%). Shakespeare's `grow'st`
    lines reported their rhyme word as `thou`; `zun` reported `the`. The whole
    qafiya profile is a MAJORITY over these, so a few substituted function
    words move the established rawi for every other line as well.

    Both figures here were `9,812 of 190,804` until the attribution cell
    removed 819 duplicated lines from the two Lyrical Ballads files and one
    hymn from the Tate file. The DIRECTION is the part worth keeping: the
    corpus lost 819 lines and the unreadable end-word rate went UP, 5.2677% ->
    5.2873%, because only 6 of the 819 that left had an unreadable end word.
    Every rate this repo measured over corpus/song/ before that date was
    diluted by text that was in it twice. `quality/test_readability.py` pins
    all four numbers.

    THE SUBSTITUTION IS NOT ONLY BETWEEN WORDS. It survives INSIDE one, on a
    hyphen, where `raw_final_token` and the syllable map agree and there is
    nothing left to disagree: 328 song line ends read a compound whose pieces
    did not all reach the lexicon. See `token_pieces` and `span_kind`'s
    `substituted`.

    It now refuses instead. Returning None was also not safe: `check_qafiya`
    read None as "radif/refrain line: licensed", turning 241 unreadable
    corpus/song/ lines into clean passes, so the refusal is typed.
    """
    final = raw_final_token(line, strip_parens=lex.strip_parens)
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

    #: key -> {"candidates": [...], "count": n} for every profile slot the
    #: text left TIED. Empty when every slot had an outright winner. See
    #: `majority`; `profile` alone cannot carry this, which is the point.
    tied = {}

    def majority(key):
        # A refused line contributes NOTHING to the established profile. It
        # used to contribute a substituted function word, and the profile is a
        # majority, so one unreadable end word could move the declared rawi for
        # every other line in the poem.
        #
        # THE TIE IS NOT BROKEN BY THE SET'S ITERATION ORDER ANY MORE, and
        # that is doctrine 66 firing on this repo's own corpus. The line was
        # `max(set(vals), key=vals.count)`; `set` iteration is salted by
        # PYTHONHASHSEED, so on `corpus/song/eng_hymn_newton.txt` five runs of
        # the SAME command returned rawi D, R, R, D, D under seeds 0-4. Not a
        # near-miss: once the reader below is fixed, 23 of the 143
        # `corpus/song/eng_*.txt` files leave some slot tied -- 12 on rawi
        # (three of those four- and five-way), 10 on wasl_nucleus, 1 on ridf
        # -- and wasl_nucleus and ridf drive `iqwa` and `sinad al-ridf`
        # defects, so this was never a rawi-only problem.
        #
        # Sorting the candidates makes the pick reproduce. It does NOT make
        # the pick meaningful -- first-alphabetically is an arbitrary rule,
        # and a tie means the text genuinely does not establish this slot.
        # So the tie is RECORDED rather than swallowed: doctrines 20 and 28
        # want "cannot tell" kept mechanically distinct from a finding, and
        # here the two failure modes are already distinguishable in the return
        # value -- `None` means NO line offered a value for this slot, while a
        # `tied` entry means several did and the corpus does not choose among
        # them. Silently returning one of them collapses that distinction into
        # a coin flip. The caller discloses it; see `main`'s `qafiya` verb.
        vals = [p[key] for p in parts
                if p and not p.get("unreadable") and p[key] is not None]
        if not vals:
            return None
        counts = _C(vals)
        top = max(counts.values())
        # Homogeneous per key -- every value here is a phoneme/class string,
        # or (for `tasis`) a bool -- so a plain sort is total and stable.
        winners = sorted(v for v, n in counts.items() if n == top)
        if len(winners) > 1:
            tied[key] = {"candidates": list(winners), "count": top}
        return winners[0]

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
    return {"profile": prof, "profile_tied": tied, "audit": audit,
            "refusals": refusals,
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


# ---------------------------------------------------------------------------
# THE ROLLUP — ONE FACT ABOUT THE DRAFT, SAID ONCE
#
# MEASURED, not guessed at. A real `song` run on a 16-line draft against a
# blueprint declaring `--subdivision 1` printed 91 findings over 208 lines, of
# which 48 were three codes each firing on ALL SIXTEEN lines --
# `SLOTS_EXCEEDED` x16, `CROWDED` x16, `PROMINENCE_EXCEEDS_HEADS` x16. Every
# one is CORRECT: the declared grid really is too tight for every line. But
# sixteen copies of one fact is one fact, and stating it sixteen times buries
# the three `REPEAT_IN_VERSE` flags that are the actual craft criticism.
#
# WHAT THIS IS NOT. It is not a filter and it does not decide anything. The
# FINDINGS are unchanged, the counts are unchanged, the severities are
# unchanged, and `song`'s exit code is computed from the finding set BEFORE
# this runs -- rendering may never move a verdict (doctrine 91: a count is a
# coordinate of the RENDERING, and this is the rendering). A rolled-up code
# names every line it fired on and carries its own count; nothing is summed
# across codes or across severities (doctrine 79).
#
# TWO RULES, ONE THRESHOLD, both spelled here so the number is not one nobody
# wrote down (doctrine 58):
#   SATURATED  the code fires on >= ROLLUP_SATURATION of the BRIEFED lines --
#              "(nearly) every line", which is a statement about the draft as
#              a whole rather than about any line in it.
#   IDENTICAL  every occurrence RENDERS THE SAME CHARACTERS. That is one fact
#              fanned out, not N measurements that happen to share a code:
#              `ANAPHORA_OVERLOAD` is a whole-draft rate attached to each of
#              the lines that carry the opening word, so its message, its
#              evidence AND its `locations` list are byte-identical on all of
#              them. A per-PAIR code (`NEAR_COLLISION`, `SCHEME_COLLISION`)
#              names different words every time and is never caught by this.
# Both need ROLLUP_MIN_LINES before they fire at all, so a four-line draft is
# rendered exactly as it was before this existed.
# ---------------------------------------------------------------------------

#: Share of the BRIEFED lines a code must fire on to be one fact about the
#: draft. 0.80 and not 1.00: the one-line-short case is the same fact --
#: on the measured 16-line run `SLOTS_EXCEEDED` would still have printed 15
#: blocks had a single short line fit its bar.
ROLLUP_SATURATION = 0.80

#: Below this many lines a rollup saves nothing and costs a reader the
#: per-line detail. Four is also the shortest draft `quality/floor.py` has a
#: calibrated profile for, so nothing shorter than a quatrain is ever folded.
ROLLUP_MIN_LINES = 4


def line_range(nums):
    """-> 'L1-L16' when the lines are contiguous, else every line named.

    NEVER truncated with an ellipsis. The rollup's whole warrant is that it
    loses nothing, and "L1, L3, L7 and 6 others" loses the six.
    """
    ns = sorted(set(nums))
    if not ns:
        return "no line"
    if len(ns) > 2 and ns == list(range(ns[0], ns[-1] + 1)):
        return f"L{ns[0]}-L{ns[-1]}"
    return ", ".join(f"L{n}" for n in ns)


def rollup_findings(briefs):
    """Group every per-line finding by (code, severity) and say which groups
    are ONE FACT. -> (groups, rolled).

    `groups` is {(code, severity): [(line_no, finding), ...]} in first-seen
    order; `rolled` is {(code, severity): "saturated" | "identical"} for the
    subset that renders as a single row. A key absent from `rolled` prints
    per line exactly as it always has.

    Pure and module-level on purpose: this is the arithmetic the report's
    headline counts are computed from, and a rendering rule that can only be
    checked by reading stdout is a rule nobody checks (`quality/test_verbs.py`
    §15 calls it directly).
    """
    n_briefed = len(briefs)
    groups = {}
    for b in briefs:
        for f in dedupe_findings(b.findings):
            key = (getattr(f, "code", "?"), getattr(f, "severity", "note"))
            groups.setdefault(key, []).append((b.line_no, f))
    need = math.ceil(ROLLUP_SATURATION * n_briefed) if n_briefed else 0
    rolled = {}
    for key, items in groups.items():
        lines_hit = {ln for ln, _ in items}
        if len(lines_hit) < ROLLUP_MIN_LINES:
            continue
        if len(lines_hit) >= need:
            rolled[key] = "saturated"
        elif len({str(f) for _, f in items}) == 1:
            rolled[key] = "identical"
    return groups, rolled


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


# ---------------------------------------------------------------------------
# THE USAGE TEXT AND THE WIRING MAP, AS DATA
#
# Both were previously inline in `main()`, and both went stale the moment a
# cell shipped a layer: on 2026-08-11 four tested layers -- quality/fit.py,
# `grid.Section.function`, `schemes.parse_refrain`, and three standalone
# runners -- had no verb, and the eleven-row wiring table still reported the
# harness fully plugged in. A map that is out of date is worse than absent,
# because it answers.
#
# So they are values now, and `wiring` CROSS-CHECKS them against the dispatch
# itself by walking this file's AST for `cmd == "..."`. A verb that is
# dispatched and unmapped is a printed row, not an omission somebody has to
# notice. Doctrine 48: a principle that lives only in prose gets followed
# exactly as often as someone remembers it -- and this one had to be
# remembered eight times in one round.
# ---------------------------------------------------------------------------

USAGE = """--fallback=high|low, BEFORE any verb, on any command: opts every
verb's Lexicon into quality/g2p.py's morphology/elision/compound layer for
words CMUdict refuses outright (viewest, o'er, savour, groun'). Omitted by
default -- a refusal stays a refusal unless this is declared. 'low' also
reaches the letter-to-sound layer, measured net harmful
(quality/test_g2p.py); 'high' does not.

--voices, BEFORE any verb, same standing as --fallback: declares that
`(...)`/`*...*` in the lyric file that follows is voice-attribution
notation (who's singing -- a second voice, a group) rather than a
non-sung stage direction, so those words are read and scored like any
other. Omitted by default -- parenthetical text is stripped before
scoring exactly as it always has been, which is the correct reading for
this repo's own corpus/song/ (traditional literary asides, not vocal
attribution) and for anyone not writing in this notation.

commands (the fifteen spine verbs):
  declaration             print the active declaration
  score  W1 -- W2         graded pair score with sub-scores
  candidates W [n]        ranked rhyme candidates
  meter  'template' L...  meter check ('.'=weak '/'=strong)
  scheme SCHEME L1 L2 ... scheme check, e.g. AABB
                          [--profile full|assonance|rawi] (or --profile=,
                          either position) REBINDS THE CHANNEL WEIGHTS every
                          score is computed under, so it is printed in the
                          report on every run and an undeclared name REFUSES
                          at exit 2 rather than falling back to `full`
  song   BLUEPRINT LYRIC [MANDATE] [--subdivision N] [--isochronous]
                          the marked [Section] lyric against the bar-grid
                          BLUEPRINT (positional, not --blueprint=): cross-
                          checks section names/line counts (STRUCTURE), then
                          runs the SAME brief report as `brief`, with meter
                          and song-function joining the finding set (see
                          `brief`, below). REBUILT 2026-08-12 off the dead
                          per-section {"lines", "scheme"} schema; MANDATE is
                          required for the same reason it is on `brief` --
                          doctrine 20.
                          EXIT CODES, and `song` is the only verb with three:
                          0 answered and no line carries a flag; 2 REFUSED
                          (no mandate, a blueprint/draft mismatch — the
                          harness did not answer); 3 answered and at least
                          one line carries a FLAG. NOTES never move it. This
                          is the WHOLE-SONG verb, so it is the one a pipeline
                          gates on; it used to exit 0 with sixteen flags
                          standing
  chains FILE [theta]     inferred rhyme chains
  graph  FILE [theta]     the full pairwise matrix, cliques and overlaps
  internal "line"         internal (within-line) matches
  density FILE            rhyme density per line
  weight "line"           syllable weights and matras
  qafiya FILE|L...        Arabic/Persian qafiya profile audit
  cynghanedd [--lang=cym|eng] "line"   Welsh consonantal answer
  prasa  K L...           position-K consonant agreement
  demo                    run the acceptance suite

the quality layer (each says which module answered):
  wiring                  which verb runs on which layer, which verbs are
                          dispatched and NOT on the map, and any STRANDED
                          module
  types  W1 -- W2 [--lang=] [--preset=]
                          full rhyme-type coordinate: 9 axes, per-member
                          anchor, traditional names
  partition FILE|L...     the rhyme scheme as a SET PARTITION, canonical RGS,
                          crossings/nestings -- and it refuses when the
                          cliques overlap, because then no letter scheme
                          exists at all
  cycle  N/D [a+b+c]      metric cycle in exact rationals
  relations FILE [--schema=] [--lang=]   named relation instances found
  grid   BLUEPRINT        bar grid, uniformity, stanza lock, phrase profile
  fit    BLUEPRINT [--subdivision N] [--isochronous] [-v]
                          DO THE WORDS FIT THE BARS -- syllables against the
                          pulses of the bar they are declared in. The
                          subdivision is a DECLARED coordinate with no
                          default; without it the slot questions refuse
  function BLUEPRINT [--function=SECTION:FN,...] [--title=T] [--hook=H]
                          section FUNCTION, not section name: does the chorus
                          return in the same slot, does the bridge contrast,
                          is the title in the hook. An undeclared function
                          REFUSES rather than reading 'chorus' out of a name
  refrain NOTATION|FORM [FILE]
                          the A-1 notation (capital = VERBATIM return,
                          lowercase = rhyme only): villanelle, triolet,
                          rondel, ballade... and, given a lyric, whether the
                          refrains actually came back
  brief  FILE [MANDATE] [--blueprint=B] [--subdivision N] [--isochronous]
                          what to revise, and what is FORBIDDEN.
                          MANDATE is a letter scheme (ABAB; X = free),
                          --groups=1,3;2,4 (1-based, may OVERLAP), --returns=
                          11,19,27;12,20,28 (same syntax, but each group is a
                          RETURN CLASS -- REPEAT is the REQUIREMENT, not a
                          violation; use this for a verbatim chorus/refrain,
                          NOT --groups=, which defaults every pair to
                          REQUIRE_RHYME and would charge an identical return
                          --structures=LABEL:NAME,... declares which catalog
                          row each group DEMANDS (quality/structures.py names()
                          lists the 58; world aliases resolve) -- shipped by
                          the Kalevala adoption 2026-08-18
                          SCHEME_VIOLATION for being exactly identical), or
                          --cliques (the song's own graph structure).
                          With NO mandate it REFUSES: nothing declared means
                          nothing mandated, and "nothing flagged" about that
                          is a vacuous pass (doctrine 20). --blueprint joins
                          meter (quality/fit.py) and song-function
                          (quality/grid.py) to the SAME finding set --
                          omitted, only rhyme and the slop floor are asked,
                          same as before this flag existed
  verify BEFORE AFTER [MANDATE] [lines] [--blueprint=B] [--subdivision N]
         [--isochronous]  did the revision earn it
  revise FILE [MANDATE] [--blueprint=B] [--subdivision N] [--isochronous]
         [--propose=stub|replay:PATH|defer:PATH|call:MODULE:FACTORY]
                          the automated write-check-fix LOOP: brief() and
                          verify() driven to convergence (quality/loop.py).
                          Two tiers -- swap a flagged line's own word, or
                          BACKTRACK an anchor when `joint_conflict` says no
                          word answers a pivot at all -- and three stop
                          conditions: success, no_progress, or the declared
                          max_rounds.
                          --propose= says WHO WRITES THE LINE, and `stub` is
                          the DEFAULT: quality/loop.py's mechanical
                          single-word splice, which proves the control flow
                          and does not write. `replay:PATH` re-runs recorded
                          proposals and reaches nothing outside the process,
                          which is how the loop is driven over real proposed
                          text in CI. `call:MODULE:FACTORY` is the SEAM and
                          the caller states it: MODULE is any importable
                          module you supply, FACTORY an attribute on it
                          returning callable(prompt) -> str, wrapped in
                          quality/propose.py's ModelProposer. This harness
                          names no module of its own and has NO default one
                          -- an undeclared coordinate REFUSES with exit 2
                          rather than being guessed at, the same way
                          --subdivision does, and every failure to meet the
                          contract is a printed refusal, never a traceback
                          and never a silent downgrade to the stub
  plan --seed=N [--form=verse-chorus] [--lines=N] [--fill=DRAFT]
       [--out=PATH]      the PLANNING phase: a request in, a blueprint and
                          a mandate out (quality/plan.py). Structure from a
                          declared pattern grammar, schemes from the FULL
                          rgs() enumeration, meters from a declared cycle
                          set -- every free choice seeded, disclosed beside
                          its choice set, and reproducible byte for byte.
                          Writes NO WORDS: emits line SLOTS, the writer
                          brief, and the exact grading command. --fill=DRAFT
                          completes the blueprint from a finished draft
                          (count mismatch REFUSED, never zipped). Unknown
                          forms, blocked forms and unattainable lengths
                          refuse by name with the alternatives listed
  readability FILE        what the ingestion layer could not read"""


#: verb spelling -> (module that answers it, what that layer is).
#: `wiring` prints this and then checks it against the dispatch.
VERB_LAYERS = (
    ("declaration", "lyric_harness.py", "the declaration tuple itself"),
    ("score / candidates / graph / chains", "lyric_harness.py", "spine"),
    ("scheme (letters)", "lyric_harness.py", "spine"),
    ("meter (template)", "lyric_harness.py", "spine"),
    ("qafiya / prasa / cynghanedd", "lyric_harness.py", "spine"),
    ("internal / density / weight", "lyric_harness.py", "spine"),
    ("demo", "lyric_harness.py", "the acceptance suite"),
    ("wiring", "lyric_harness.py", "this map, checked against the dispatch"),
    ("types", "quality/rhyme_types.py", "9-axis coordinate + anchor"),
    ("partition", "quality/schemes.py", "set partitions, Bell numbers"),
    ("refrain", "quality/schemes.py", "A-1 notation: the VERBATIM return"),
    ("cycle", "quality/meter.py", "exact-rational metric cycles"),
    ("relations", "quality/relations.py", "77 named relation schemas"),
    ("brief / verify / song", "quality/revise.py",
     "the revision loop -- song adds a structural pre-check against "
     "quality/grid.py, then shares this same report"),
    ("revise", "quality/loop.py", "the automated write-check-fix loop, "
     "driven on top of brief/verify"),
    ("plan", "quality/plan.py", "the planning phase -- request to "
     "blueprint + mandate, generated from the enumerated scheme space"),
    ("readability", "quality/readability.py", "ingestion refusals"),
    ("grid", "quality/grid.py", "bar grid, stanza lock"),
    ("function", "quality/grid.py", "section function, returns, hook"),
    ("fit", "quality/fit.py", "syllables against the bar's pulses"),
)


def _mapped_verbs():
    """-> the verb names VERB_LAYERS claims to cover, one per name."""
    out = set()
    for verbs, _, _ in VERB_LAYERS:
        for v in verbs.split("/"):
            v = v.split("(")[0].strip()
            if v:
                out.add(v)
    return out


def _dispatched_verbs(path=None):
    """-> every verb `main()` actually dispatches, read from the AST.

    Not a hand-kept list, for the same reason `wiring`'s import check walks
    the tree rather than grepping: a hand-kept list of what is wired is the
    thing that went stale. This reads `cmd == "x"` and `cmd in (...)` out of
    `main` itself, so the only way to add a verb without appearing here is to
    not add a verb.
    """
    import ast as _ast
    src = open(path or os.path.abspath(__file__), errors="replace").read()
    fn = next((n for n in _ast.walk(_ast.parse(src))
               if isinstance(n, _ast.FunctionDef) and n.name == "main"), None)
    out = set()
    if fn is None:
        return out
    for node in _ast.walk(fn):
        if not isinstance(node, _ast.Compare):
            continue
        if not (isinstance(node.left, _ast.Name) and node.left.id == "cmd"):
            continue
        for op, comp in zip(node.ops, node.comparators):
            if isinstance(op, _ast.Eq) and isinstance(comp, _ast.Constant):
                out.add(comp.value)
            elif isinstance(op, _ast.In) and isinstance(comp,
                                                        (_ast.Tuple, _ast.List,
                                                         _ast.Set)):
                for e in comp.elts:
                    if isinstance(e, _ast.Constant):
                        out.add(e.value)
    return {v for v in out if isinstance(v, str)}


def _flag_value(args, flag, eq_only=False):
    """-> the value of `--flag=V`, or of `--flag V`, or None.

    Both spellings, because the quality-layer verbs already use `--lang=cym`
    and cell R's `fit` patch used `--subdivision 2`, and a caller should not
    have to remember which verb chose which. `eq_only` for values that may
    contain a space.
    """
    pre = flag + "="
    for a in args:
        if a.startswith(pre):
            return a.split("=", 1)[1]
    if not eq_only and flag in args:
        i = args.index(flag)
        if i + 1 < len(args):
            return args[i + 1]
    return None


def _strip_flag(args, flag, bare=False):
    """-> `args` with `--flag=V`, `--flag V`, or a bare `--flag` removed.

    THE COMPANION `_flag_value` NEVER HAD, and its absence is why `--profile`
    was only ever recognised in FIRST POSITION: the `scheme` verb read
    `rest[0] == "--profile"` and then consumed the flag by slicing `rest[2:]`,
    so reading and removing were two different pieces of code that agreed on
    exactly one spelling in exactly one place. `--profile=assonance` -- the
    `=` spelling every sibling flag on every other verb accepts -- matched
    neither, fell through into the LINE LIST as a fifth line, and died on
    `check_scheme`'s length assertion with a traceback at exit 1; a trailing
    `--profile assonance` after the lines did the same.

    One reader, one remover, both spellings, any position, so no site has to
    spell the parse twice and get it right twice. `bare` for a presence flag
    that takes no value at all (`--isochronous`, `--voices`), where the token
    AFTER the flag is an ordinary argument and must not be eaten.
    """
    out, skip, pre = [], False, flag + "="
    for a in args:
        if skip:
            skip = False
            continue
        if a == flag:
            skip = not bare
            continue
        if a.startswith(pre):
            continue
        out.append(a)
    return out


def _refuse(msg, sides=(), detail=()):
    """Print the ONE refusal shape and exit 2. Never returns.

    `_blueprint_or_refuse` has printed `  REFUSED -- {e}` at exit 2 since the
    `song` verb's own handler was generalised, and `--fallback=high|low` had
    a second, hand-rolled copy of the same idea two hundred lines away. This
    is that shape, extracted, so a flag that refuses does not have to invent
    one -- and so a caller in a pipeline can tell a refusal (2) from a pass
    (0) and from a crash (1) on EVERY flag rather than on the two whose
    authors happened to remember.

    TWO SUB-LISTS, TWO MEANINGS, AND THEY ARE NOT INTERCHANGEABLE. They were
    briefly two different FUNCTIONS of the same name, landing from two cells
    at the same insertion point -- `_refuse(msg, sides)` iterating PAIRS and
    `_refuse(msg, detail)` iterating STRINGS. Python keeps the second
    definition silently, so whichever lost the race would have had every one
    of its call sites unpack a string into `role, path` (`ValueError: too
    many values to unpack`) or print a tuple where a sentence belongs. That
    exact shadowing already crashed the `song` verb on this branch once, so
    the two are ONE function with two named parameters and neither is
    positional past the message:

      `sides`   [(role, path)] -- WHICH FILE IS WHICH, for a verb handed two
                of them (doctrine 79: the declaration and the draft are
                different things, and a caller cannot fix the right one
                without being told which is which).
      `detail`  [str] -- the sentences under the refusal: what was looked
                for, what was NOT silently substituted, and what to type
                instead. A flag refusal has no second file to name; it has
                a contract the caller can still meet.
    """
    print(f"  REFUSED — {msg}")
    for role, path in sides:
        print(f"    {role}: {path}")
    for ln in detail:
        print(f"    {ln}")
    sys.exit(2)


def _value_in_vocabulary_or_refuse(flag, value, vocabulary, why=""):
    """Membership-test a flag's value AT THE PARSE SITE, or refuse.

    AT THE PARSE SITE is the whole point, and it is where `--profile` did not
    have one. `PROFILES.get(profile)` three layers down returned the default
    weights for an unrecognised name, so `scheme ABAB --profile bogus dawn
    again silt rebuilt` was byte-identical to the same command with no flag
    -- same numbers, same relations, same counts, exit 0 -- while `--profile
    assonance` moved the violation count on those same four words. A flag
    that CHANGES A MEASUREMENT and accepts a name the harness does not have
    is a silent comparator substitution, which is doctrine 1 broken at the
    one place a user could still have seen it.

    The vocabulary is NAMED in the message, the same way `--fallback`'s and
    `grid.as_function`'s already are: a refusal that does not say what would
    have been accepted makes the reader guess a second time.
    """
    if value in vocabulary:
        return value
    _refuse(f"{flag} wants one of {', '.join(sorted(vocabulary))}; got "
            f"{value!r}." + (f" {why}" if why else ""))


def _bare_flag_or_refuse(args, flag, subject):
    """-> True/False for a PRESENCE flag, refusing the `=` spelling loudly.

    `--isochronous` takes no value, and the two flags standing beside it on
    the same verbs (`--blueprint=`, `--subdivision`) both take one -- so
    `--isochronous=true` is the natural guess, and `"--isochronous" in args`
    is simply False for it. Measured on `fit quality/fixtures/
    song.blueprint.json --subdivision 2`: `--isochronous=true` was
    BYTE-IDENTICAL to omitting the flag, restoring 16 `NO_SETTING` refusals
    at exit 0, and the string "isochron" appeared NOWHERE in either report --
    so there was nothing to read even for a reader who went looking. A value
    on a valueless flag is a REFUSAL now, not a shrug.
    """
    if flag in args:
        return True
    for a in args:
        if a.startswith(flag + "="):
            _refuse(f"{flag} takes NO value -- it is a bare presence flag "
                    f"declaring {subject}, and {a!r} is not it. Write "
                    f"{flag} on its own to declare it; omit it to leave it "
                    f"UNDECLARED.")
    return False


def _no_unknown_flags_or_refuse(rest, known, verb):
    """Refuse a flag this verb does not have, rather than ignoring it.

    `--isochronus` -- one letter short of `--isochronous` -- was silently not
    the flag: the membership test that reads it did not match, the declared
    assumption was dropped, `fit` printed a full report at exit 0, and the 16
    restored `NO_SETTING` refusals were the only trace. A typo in a flag that
    changes a measurement has to be louder than the measurement it changed.

    Call it with the flag VALUES already stripped (`_strip_flag`), so
    `--subdivision -1`'s value is not itself read as an unknown flag.
    """
    bad = [a for a in rest if a.startswith("-")]
    if bad:
        _refuse(f"{verb} has no flag {bad[0].split('=', 1)[0]!r}. It takes: "
                f"{', '.join(known)}. An unrecognised flag is refused rather "
                f"than ignored -- a flag that is silently not read leaves a "
                f"report that looks exactly like one you never asked for.")


def _phonology_or_refuse(lang):
    """`--lang=X` -> the declared phonology, or the ONE refusal shape.

    `quality.phonology.get` already refuses correctly AND names its whole
    declared vocabulary in the message -- it just did it as an `Unsupported`
    traceback at exit 1, on `types` and on `relations` both, while
    `--fallback=bogus` two hundred lines up printed a named refusal at exit
    2. The message is carried through verbatim; what changes is that a caller
    in a pipeline can now tell this refusal from a crash.
    """
    from quality.phonology import get as _get, Unsupported
    try:
        return _get(lang)
    except Unsupported as e:
        _refuse(f"--lang={lang}: {e}")


def _subdivision_or_refuse(FT, raw, source):
    """`--subdivision N` -> a `quality.fit.Subdivision`, or refuse by name.

    Both failures on this flag were tracebacks at exit 1 -- `int(raw)` raising
    `invalid literal for int() with base 10: 'x'`, and
    `Subdivision.__post_init__` raising `slots_per_pulse must be >= 1` -- one
    screen away from `--fallback`, which refuses by name at exit 2. Same
    class of user mistake, two different answers, decided by which flag was
    typed. The MESSAGES were never the problem and are carried through
    unchanged; the shape and the exit code were.
    """
    if raw is None:
        return None
    try:
        return FT.Subdivision(slots_per_pulse=int(raw), source=source)
    except ValueError as e:
        _refuse(f"--subdivision wants a positive whole number of slots per "
                f"pulse; got {raw!r} ({e}). It is a DECLARED coordinate with "
                f"no default -- omit it entirely and the slot questions "
                f"refuse rather than assume a sixteenth-note grid.")


def _number_or_refuse(raw, cast, role, usage, extra=""):
    """-> cast(raw), or the ONE refusal shape at exit 2. Never returns wrong.

    `_subdivision_or_refuse` above did this for ONE flag on 2026-08-14 and
    the argument it was written on is general: `int(raw)`/`float(raw)` on a
    positional the caller typed is the SAME class of user mistake as a bad
    `--subdivision`, and it was answered differently -- exit 1, a bare
    `ValueError: invalid literal for int() with base 10: 'two'` -- purely by
    which slot the wrong text landed in. MEASURED at `be8d1ea`, all exit 1:

        candidates lines two        chains FILE x        graph FILE x
        prasa x LINES               cycle x              cycle 4

    Exit 1 is Python's own uncaught-exception code, so five verbs told a
    caller the harness had crashed when the caller had mistyped a number
    (doctrine 20). The MESSAGE was never the problem -- the underlying
    `ValueError` says exactly what is wrong with the text and is carried
    through unchanged; the SHAPE and the exit code were.
    """
    try:
        return cast(raw)
    except (TypeError, ValueError) as e:
        _refuse(f"{role} wants {'a whole number' if cast is int else 'a number'}"
                f"; got {raw!r} ({e})",
                detail=[f"usage: {usage}"] + ([extra] if extra else []))


def _two_sides_or_refuse(rest, verb, usage):
    """-> (left, right) around a single `--`, or refuse by name.

    `score` and `types` both read `w1, w2 = [s.strip() for s in
    rest.split("--")]`, which raises on BOTH sides of the arity: too few
    fields (`score dawn again`, no separator) is `not enough values to
    unpack`, and too many (`score dawn -- again --nope`, where an unknown
    flag splits a third field) is `too many values to unpack`. Both were
    exit 1. The separator IS this verb's grammar, so a missing one is the
    ordinary user mistake, not a defect in the grader.
    """
    parts = [s.strip() for s in rest.split("--")]
    if len(parts) != 2 or not parts[0] or not parts[1]:
        _refuse(f"{verb} compares TWO words and needs `--` between them; "
                f"got {len(parts)} field(s) from {rest!r}",
                detail=[f"usage: {usage}",
                        "a third field usually means an unrecognised flag "
                        "was counted as one side of the comparison."])
    return parts[0], parts[1]


def _is_scheme_notation(spec):
    """-> True if `spec`'s distinct letters are the alphabet's first N.

    Which is what a rhyme scheme IS. 7 of the 8 forms `quality/schemes.py`
    ships satisfy it; `zzznotaform` draws on {z,n,o,t,a,f,r,m} and does not.
    THE EIGHTH IS WHY THIS IS NOT THE WHOLE TEST, and it was found by running
    the rule over the shipped vocabulary before trusting it: the rondeau's
    `aabba aabR aabbaR` uses `R` for the RENTREMENT, a conventional letter
    outside the run, so a strict prefix rule refuses a real notation.
    """
    letters = {c.lower() for c in spec if c.isalpha()}
    return bool(letters) and letters == {
        chr(ord("a") + i) for i in range(len(letters))}


def _refrain_spec_or_refuse(name, forms):
    """-> the A-1 spec for `name`, refusing a mistyped FORM rather than
    reading it as notation. Discloses which of the two readings it took.

    `spec = FORMS.get(args[1], args[1])` is the silent downgrade: `refrain
    zzznotaform` printed `rhyme partition: AAABCDEFCGH` at exit 0 -- eleven
    "lines" that are the letters of the typo -- while the verb already knew
    the declared vocabulary and prints it when called with no argument.

    THE TWO READINGS GENUINELY OVERLAP IN SHAPE, so this refuses on a
    CONJUNCTION and discloses otherwise (doctrine 20: the reading is stated,
    never assumed). A token is a mistyped form when it is not declared AND
    carries no capital AND is not an alphabet-prefix scheme. Each signal
    alone is too weak -- `abab` is a real capital-less notation, the rondeau
    is a real non-prefix one -- and every one of the 8 shipped specs carries
    a capital, because a notation with none marks no verbatim return at all
    and this verb's whole subject is the return.
    """
    if name in forms:
        return forms[name], f"named form {name!r}"
    if not any(c.isupper() for c in name) and not _is_scheme_notation(name):
        _refuse(f"refrain — {name!r} is not a declared form, and does not "
                f"read as A-1 notation either",
                detail=[f"declared forms: {', '.join(sorted(forms))}",
                        "A-1 notation is a rhyme scheme where a CAPITAL is a "
                        "line that must come back VERBATIM — `ABaAabAB`. "
                        f"{name!r} has no capital and its letters are not the "
                        f"alphabet's first few, so reading it as notation "
                        f"would print a partition of the typo itself."])
    return name, "raw A-1 notation (no declared form of that name)"


def _blueprint_or_refuse(fn, *a, **k):
    """Run a blueprint reader, or print the ONE refusal shape and exit 2.

    The `song` verb has had this since 2026-08-12 and the argument is written
    out where it lives (see the `except ValueError` near the bottom of
    `main`): one refusal shape, reached by every verb that can provoke it,
    because a user-facing verb tracebacking where its sibling refuses is the
    same defect twice. `grid`, `fit` and `function` were outside that handler
    and printed a raw traceback on the identical bad file.

    Deliberately `ValueError` and no wider, for the reason recorded at the
    other site: it is the blueprint-reading family a wrong file provokes --
    an undeclared time signature, `pulses must be positive`, `groups (3, 3)
    sum to 6, not 4`, and `json.JSONDecodeError`, which is a subclass. It
    does NOT catch `KeyError`, because `KeyError: 'bars'` from a malformed
    section is indistinguishable at this frame from a `KeyError` that is a
    real defect in the spine -- and one of those was found precisely because
    it escaped.

    `_reraise=` NAMES THE ValueError SUBCLASSES THIS MUST NOT SWALLOW, and it
    exists because the first version of this helper swallowed one. `ValueError`
    is a wide net and `grid.UnknownFunction` is a subclass of it, so catching
    the family caught the one member `_grid_song`'s own docstring says is
    "deliberately not caught". `quality/test_verbs.py` failed on it inside the
    hour, and it was right to: a blueprint declaring "vibes" is a defect in
    ("middle8" was this sentence's example until 2026-08-18, when the
    bridge row's aliases made it resolve — the mechanism is unchanged)
    a DECLARED coordinate, not a file this reader could not read, and the two
    must not reach the operator wearing the same word. `except ()` matches
    nothing, so the default is a no-op.
    """
    reraise = k.pop("_reraise", ())
    try:
        return fn(*a, **k)
    except reraise:
        raise
    except ValueError as e:
        _refuse(e)
# ---------------------------------------------------------------------------
# WHO WRITES THE LINE — `--propose=stub|replay:PATH|defer:PATH|call:MODULE:FACTORY`
#
# `revise` drives `quality/loop.py`'s accept/reject/retry/backtrack/stop
# control flow, and until this flag existed the only thing it could drive was
# `default_propose`, a single-word splice whose output reads "boarded up the
# main". That proposer exists to prove the control flow and says so in its own
# docstring; it is not a way to get a line. `revise_loop` has taken
# `propose=`/`propose_pair=` since it was written and NOTHING on this command
# line could hand it one -- the same built-and-tested-was-not-the-reachable
# shape `--blueprint` and `--fallback` were, one layer further in.
#
# `stub` IS THE DEFAULT AND STAYS IT. A default that opens a socket is not a
# default: CI runs `quality/test_verbs.py`, which runs `revise`, and a run
# that reached out over the network would make a test suite's result depend on
# a remote service being up. Reaching anything at all is a DECLARED coordinate
# (doctrine 1), spelled on the command line, never inferred from an
# environment variable happening to be set.
#
# `replay:PATH` REACHES NOTHING AT ALL. It reads proposals recorded from an
# earlier run, so the loop's control flow can be driven over REAL proposed
# text in CI and in review, reproducibly -- which a live call is not.
#
# `call:MODULE:FACTORY` IS THE SEAM, AND THE CALLER STATES IT. This project's
# first page says the model proposes and these tools grade. The proposing half
# is not this repo's to ship: an adapter that dials one service is a choice
# about a vendor, a product and a price, made inside a music repository, and
# every one of those is the caller's to make and to change without touching
# this file. So the harness NAMES NOTHING. It is told which module to import
# and which attribute on it produces the call, it checks that what came back
# meets the contract below, and it refuses by name when it does not.
#
#   MODULE   any importable module -- installed, or on PYTHONPATH, or beside
#            this script. The harness imports exactly what it is told.
#   FACTORY  an attribute on it (dotted paths walked) that, CALLED WITH NO
#            ARGUMENTS, returns the `call` a `ModelProposer` takes:
#            `callable(prompt) -> str`.
#
# THERE IS NO DEFAULT MODULE AND NO FALLBACK ONE, the same way `--subdivision`
# has no default: an undeclared coordinate REFUSES rather than being guessed
# at, and a guess here would be this file choosing a vendor by omission.
#
# `quality/propose.py` IS IMPORTED LAZILY, inside the one branch that needs
# it. It is another cell's module and may not have landed; `stub` and
# `replay:` must keep working meanwhile, and a top-level import would make the
# whole CLI un-runnable until it exists. `wiring`'s import reachability walks
# the AST and reads lazy imports inside function bodies (its own comment says
# so), so it is NOT reported STRANDED on the strength of being imported this
# way.
# ---------------------------------------------------------------------------

#: THE CONTRACT, keyed on the ROLE rather than on a module name, because only
#: one of the two roles has a name this file is entitled to know. Printed by
#: the refusals, so a caller reads what was checked rather than "it did not
#: work", and a sibling cell reads what it has to satisfy.
#:
#: `quality.propose` is this repo's own and vendor-neutral: `ModelProposer`
#: takes any `callable(prompt) -> str`. Its members are PROBED in order and
#: the first hit wins, because that seam is a sibling's to spell.
#:
#: The other row has no probe list on purpose. The caller declared the exact
#: attribute in `--propose=call:MODULE:FACTORY`, so there is nothing to guess
#: at -- guessing would be the failure mode this whole spelling removes.
PROPOSE_CONTRACT = {
    "quality.propose": ("ModelProposer",),
    "MODULE:FACTORY (declared by --propose=call:)":
        ("FACTORY() -> callable(prompt) -> str",),
}


def _first_attr(mod, names):
    """-> (name, value) for the first of `names` `mod` actually has, else
    (None, None). The probe is declared in `PROPOSE_CONTRACT` rather than
    guessed at the call site, so a refusal can print what it looked for."""
    for n in names:
        if hasattr(mod, n):
            return n, getattr(mod, n)
    return None, None


def _replay_proposer(path):
    """-> (propose, propose_pair, disclosure) reading recorded proposals.

    THE FILE IS THE RECORD OF A RUN, not a script: JSON, one object.

        {"propose": [{"line": 3, "attempt": 0, "text": "..."}],
         "propose_pair": [{"pivot": "...", "anchor": "...",
                           "pivot_word": "...", "anchor_word": "...",
                           "new_pivot": "...", "new_anchor": "..."}]}

    THE TWO ARE KEYED DIFFERENTLY BECAUSE THE LOOP CALLS THEM DIFFERENTLY.
    Tier 1's `propose(brief, lines, attempt, reasons=None, whole=())` has a
    line number, so (line, attempt) is its key. Tier 2's
    `propose_pair(pair_brief)` is handed ONE `quality.loop.PairBrief`, whose
    two `_word` fields are THE WORDS THIS ATTEMPT IS ASKING FOR rather than
    the ones currently at the two line ends — so the key is the four
    coordinates that identify the proposal: the two texts as they stand and
    the two words being asked for. Keying on the pivot's line number alone
    would collapse every attempt in one backtrack search into a single
    record and replay the first one forever.

    READ OFF THE `PairBrief` BY ATTRIBUTE, never by unpacking. The contract
    moved on 2026-08-14 from four positional strings to one object, and this
    reader is duck-typed the same way `quality/propose.py` is: it takes
    `getattr`s off whatever it is handed, so a hand-built stand-in in a test
    replays exactly as the real one does.

    A MISS IS A MISS AND IS COUNTED. Returning `None` for an unrecorded key
    is exactly what the stub does when it runs out of candidates — the loop
    reads it as "this proposer gave up here", which is true. What would be
    dishonest is a miss that silently fell back to the stub's word swap, so
    it does not: the counts are printed under the result, and a replay that
    matched NOTHING says so rather than reporting the loop's verdict on a
    draft no recorded proposal ever touched.
    """
    try:
        with open(path) as fh:
            rec = json.load(fh)
    except OSError as e:
        _refuse(f"--propose=replay:{path} — {e.strerror or e}",
                detail=["`replay:PATH` reads a recorded run; the path is read "
                 "relative to the working directory, not to the lyric file"])
    except ValueError as e:                    # json.JSONDecodeError IS-A this
        _refuse(f"--propose=replay:{path} — not readable as JSON: {e}",
                detail=['expected {"propose": [{"line": N, "attempt": N, '
                 '"text": "..."}], "propose_pair": [...]}'])
    if not isinstance(rec, dict):
        _refuse(f"--propose=replay:{path} — the top level is "
                f"{type(rec).__name__}, not an object",
                detail=['expected {"propose": [...], "propose_pair": [...]}'])
    ones, pairs = {}, {}
    try:
        for r in rec.get("propose", []):
            ones[(int(r["line"]), int(r["attempt"]))] = r["text"]
        for r in rec.get("propose_pair", []):
            pairs[(r["pivot"], r["anchor"],
                   r["pivot_word"], r["anchor_word"])] = (r["new_pivot"],
                                                          r["new_anchor"])
    except (KeyError, TypeError, ValueError) as e:
        _refuse(f"--propose=replay:{path} — a record is malformed: {e!r}",
                detail=["`propose` records need line/attempt/text; `propose_pair` "
                 "records need pivot/anchor/pivot_word/anchor_word/"
                 "new_pivot/new_anchor"])
    if not ones and not pairs:
        _refuse(f"--propose=replay:{path} — the file parses and records "
                f"NOTHING (0 propose, 0 propose_pair)",
                detail=["an empty replay would drive the loop with a proposer that "
                 "gives up on every line, and report that as the loop's "
                 "verdict on the draft. Doctrine 20: that is a refusal, not "
                 "a result"])
    tally = {"hit": 0, "miss": 0}

    def propose(brief, lines, attempt, reasons=None, whole=()):
        # `whole` is accepted and unused, exactly as `reasons` is: a replay
        # answers from a record and reads neither. A proposer that WRITES
        # reads both (`quality/propose.py` renders them into the prompt);
        # this one only has to have the signature the loop calls.
        text = ones.get((brief.line_no, attempt))
        tally["hit" if text is not None else "miss"] += 1
        return text

    def propose_pair(pair_brief):
        key = (getattr(pair_brief, "pivot_text", None),
               getattr(pair_brief, "anchor_text", None),
               getattr(pair_brief, "pivot_word", None),
               getattr(pair_brief, "anchor_word", None))
        hit = pairs.get(key)
        tally["hit" if hit is not None else "miss"] += 1
        return hit

    def disclosure(done=False):
        head = (f"  PROPOSER: replay:{path} — {len(ones)} recorded line "
                f"proposal(s), {len(pairs)} recorded pair(s)")
        if not done:
            return head + "; nothing outside this process is reached by " \
                          "this spelling"
        return (f"{head}; {tally['hit']} consulted and answered, "
                f"{tally['miss']} asked and NOT recorded (the loop read "
                f"those as this proposer giving up, never as the stub's "
                f"word swap)"
                + ("" if tally["hit"] else
                   ". NOT ONE recorded proposal matched what the loop asked "
                   "for, so every line below is the loop's verdict on the "
                   "draft it was handed and no recorded text was tried"))
    return propose, propose_pair, disclosure


class _NeedProposal(Exception):
    """The loop asked for a line nobody has written yet. NOT an error.

    This is the control flow `defer:` exists for, and it is an exception
    because the loop is a CALL STACK: `revise_loop` -> `_try_tier1` ->
    `propose`, and the proposer is four frames down with no way to return
    "stop, ask a human, and come back later" through a contract whose return
    type is `str | None`. `None` already means something else and means it
    load-bearingly — the loop reads it as THIS PROPOSER GAVE UP and moves on,
    which is the one reading a suspension must not have.
    """

    def __init__(self, kind, record, prompt):
        super().__init__(f"a {kind} proposal is required")
        self.kind, self.record, self.prompt = kind, record, prompt


def _defer_state(path):
    """-> the deferred-run state at `path`, or an empty one. Never raises."""
    empty = {"version": 1, "answered": {"propose": [], "propose_pair": []},
             "pending": None}
    if not os.path.exists(path):
        return empty
    try:
        with open(path, encoding="utf-8") as fh:
            st = json.load(fh)
    except OSError as e:
        _refuse(f"--propose=defer:{path} — {e.strerror or e}")
    except ValueError as e:
        _refuse(f"--propose=defer:{path} — not readable as JSON: {e}",
                detail=["this file is written by this verb; if you edited it, "
                        "only the `pending.answer` field is yours to fill"])
    if not isinstance(st, dict) or "answered" not in st:
        _refuse(f"--propose=defer:{path} — not a deferred-run state",
                detail=['expected {"answered": {...}, "pending": {...}}'])
    st.setdefault("pending", None)
    st["answered"].setdefault("propose", [])
    st["answered"].setdefault("propose_pair", [])
    return st


def _defer_proposer(path):
    """-> (propose, propose_pair, disclosure) that SUSPENDS instead of guessing.

    THE PROBLEM THIS SOLVES, stated plainly because it is not a Python
    problem and the first diagnosis of it in this project said it was. A
    proposer is `callable(prompt) -> str`; anything can be one. What cannot
    happen is a CHILD PROCESS re-entering the agent that spawned it: while
    `revise_loop` runs, whoever started it is blocked waiting for it to
    return, so a proposer that needs a writer's judgement has nobody to ask.
    `call:` answers this by reaching a service — which needs a credential and
    is not always available. `defer:` answers it WITHOUT reaching anything:
    the loop stops at the first unanswered request, writes down exactly what
    it asked for, and exits. The writer answers in the file. The same command
    run again picks up where it stopped.

    SO THE LOOP IS NOT DRIVEN, IT IS RESUMED, and that is the whole design.
    Re-running replays every answer already given IN ORDER and continues past
    them — which is sound only because `revise_loop` is deterministic:
    verified by inspection (it iterates no set in its control flow, doctrine
    66) and empirically (three separate processes, byte-identical output, so
    hash randomisation would have shown).

    ENFORCEMENT IS THE POINT, not convenience. There is no path from "flags
    outstanding" to a final draft except through the gates, because this verb
    will not emit one until the loop it is resuming actually converges. A
    writer who skips a round does not get a worse song; they get exit 4 and
    the same question again. That matters because the failure this closes was
    never that the loop was wrong — it was that a writer with the discipline
    to run it by hand is a writer who can also decide not to.

    THE STATE FILE'S `answered` BLOCK IS A REPLAY FILE, byte-for-byte the
    schema `--propose=replay:` reads, and that is deliberate rather than
    convenient: a finished deferred run is a recorded run, so the session
    that wrote a song can be re-run by anyone with no writer present and no
    credential (doctrine 14's independence, and the only way a measurement
    involving a writer is reproducible here at all).
    """
    from quality import propose as PR
    st = _defer_state(path)
    pend = st.get("pending")
    if pend is not None:
        # A pending request with no answer is the gate. Refusing to advance is
        # the enforcement; printing the prompt again is so the writer never has
        # to go looking for what was asked.
        if pend.get("answer") in (None, "", {}):
            print(f"  SUSPENDED — a {pend['kind']} proposal is required and "
                  f"`pending.answer` in {path} is still empty.")
            print(f"  Answer it there, then run the same command again.\n")
            print(pend.get("prompt", ""))
            sys.exit(4)
        # Answered: fold it into the record and clear the slot. The loop below
        # re-runs from the top and replays it along with everything earlier.
        rec, ans = dict(pend["record"]), pend["answer"]
        if pend["kind"] == "propose":
            parsed = ans if isinstance(ans, str) else None
            parsed = PR.parse_line(parsed) if parsed is not None else None
            if parsed is None:
                _refuse(f"--propose=defer:{path} — `pending.answer` is not "
                        f"unambiguously one line",
                        detail=["`quality.propose.parse_line` is STRICT on "
                                "purpose: a mis-parsed answer writes a line "
                                "nobody proposed into the draft, and verify() "
                                "cannot catch that — a mis-parsed line is just "
                                "a changed line, which is what was asked for."])
            rec["text"] = parsed
            st["answered"]["propose"].append(rec)
        else:
            parsed = PR.parse_pair(ans) if isinstance(ans, str) else None
            if parsed is None:
                _refuse(f"--propose=defer:{path} — `pending.answer` is not a "
                        f"readable PIVOT/ANCHOR pair",
                        detail=["tier 2 has TWO slots and their order is not "
                                "something a response format can be trusted "
                                "to have got right, so both markers are "
                                "required (quality/propose.py `parse_pair`)."])
            rec["new_pivot"], rec["new_anchor"] = parsed
            st["answered"]["propose_pair"].append(rec)
        st["pending"] = None

    ones = {(int(r["line"]), int(r["attempt"])): r["text"]
            for r in st["answered"]["propose"]}
    pairs = {(r["pivot"], r["anchor"], r["pivot_word"], r["anchor_word"]):
             (r["new_pivot"], r["new_anchor"])
             for r in st["answered"]["propose_pair"]}
    tally = {"hit": 0}

    def _suspend(kind, record, prompt):
        st["pending"] = {"kind": kind, "record": record, "prompt": prompt,
                         "answer": None}
        raise _NeedProposal(kind, record, prompt)

    def propose(brief, lines, attempt, reasons=None, whole=()):
        text = ones.get((brief.line_no, attempt))
        if text is not None:
            tally["hit"] += 1
            return text
        _suspend("propose",
                 {"line": brief.line_no, "attempt": attempt, "text": None},
                 PR.render_line(brief, lines, whole=whole, attempt=attempt,
                                reasons=reasons))

    def propose_pair(pair_brief):
        key = (getattr(pair_brief, "pivot_text", None),
               getattr(pair_brief, "anchor_text", None),
               getattr(pair_brief, "pivot_word", None),
               getattr(pair_brief, "anchor_word", None))
        hit = pairs.get(key)
        if hit is not None:
            tally["hit"] += 1
            return hit
        _suspend("propose_pair",
                 {"pivot": key[0], "anchor": key[1], "pivot_word": key[2],
                  "anchor_word": key[3], "new_pivot": None,
                  "new_anchor": None},
                 PR.render_pair(pair_brief))

    def disclosure(done=False):
        n = len(ones) + len(pairs)
        head = (f"  PROPOSER: defer:{path} — {n} answer(s) already given, "
                f"replayed in order")
        if not done:
            return (head + "; nothing outside this process is reached, and "
                    "the loop SUSPENDS at the first unanswered request "
                    "rather than guessing")
        return (f"{head}; {tally['hit']} consulted and answered. The loop ran "
                f"to a stop condition, so this state is COMPLETE and its "
                f"`answered` block is a valid --propose=replay: file")

    disclosure.state = st                    # the verb writes it on suspension
    return propose, propose_pair, disclosure


def _resolve_proposer(spec):
    """`--propose=`'s value -> (propose, propose_pair, disclosure).

    `disclosure(done=False)` is printed TWICE — once before the loop, for
    the identity, and once after it with `done=True`, because `replay:` only
    knows how much of its record was actually consulted once the run is over
    and a proposer that answered nothing must say so under its own result
    rather than only in a count nobody re-reads. Every failure in this
    function is a printed refusal and exit 2, never a traceback and never a
    silent fall back to the stub.
    """
    if spec == "stub":
        def disclosure(done=False):
            return ("  PROPOSER: stub (the default) — quality/loop.py's "
                    "`default_propose`, a single-word splice that proves the "
                    "loop's control flow and does not write. Nothing outside "
                    "this process was reached. `--propose=replay:PATH` or "
                    "`--propose=call:MODULE:FACTORY` for text something else "
                    "actually wrote")
        return None, None, disclosure           # `revise_loop`'s own defaults

    if spec.startswith("replay:"):
        return _replay_proposer(spec.split(":", 1)[1])

    if spec.startswith("defer:"):
        return _defer_proposer(spec.split(":", 1)[1])

    if not spec.startswith("call:"):
        _refuse(f"--propose wants 'stub', 'replay:PATH', 'defer:PATH' or "
                f"'call:MODULE:FACTORY', got {spec!r}",
                detail=["a value this flag does not define is not coerced to the "
                 "nearest one and is not defaulted to `stub` (doctrine 1) — "
                 "the same shape `--fallback=bogus` already holds"])

    # `call:MODULE:FACTORY`. EVERY NAME HERE CAME OFF THE COMMAND LINE. This
    # file imports what it was told to import and nothing else; there is no
    # default module, no fallback module and no probe list for the caller's
    # half of the seam, because a guess at any of the three would be this
    # harness choosing a proposer on the writer's behalf.
    rest = spec[len("call:"):]
    if ":" not in rest or not rest.split(":", 1)[0].strip() \
            or not rest.split(":", 1)[1].strip():
        _refuse(f"--propose=call: — MODULE and FACTORY are both required, "
                f"got {rest!r}",
                detail=["spelling: --propose=call:MODULE:FACTORY, e.g. "
                 "`--propose=call:my_adapters.drafting:make_call`",
                 "MODULE is any importable module you supply; FACTORY is an "
                 "attribute on it (dotted paths are walked) that, called "
                 "with NO arguments, returns callable(prompt) -> str",
                 "nothing is assumed for an omitted half — an undeclared "
                 "coordinate refuses rather than being guessed at, the same "
                 "way `--subdivision` does (doctrine 1)"])
    mod_name, attr_path = rest.split(":", 1)
    mod_name, attr_path = mod_name.strip(), attr_path.strip()

    # THE CALLER'S HALF IS RESOLVED FIRST, and the order is a decision. Both
    # halves have to be there, so either could be checked first — but one of
    # them is a string the caller typed on this command line and the other is
    # a module they did not name, and a refusal about the thing they typed is
    # the one they can act on. Resolving `quality/propose.py` first would
    # answer `--propose=call:no_such_module:x` by complaining about a file
    # the caller never mentioned.
    import importlib
    try:
        mod = importlib.import_module(mod_name)
    except ImportError as e:
        _refuse(f"--propose=call:{mod_name}:{attr_path} — {mod_name!r} is "
                f"not importable ({e})",
                detail=["this harness imports exactly the module it is told to and "
                 "names none of its own — nothing is substituted for one it "
                 "cannot find",
                 "the module must be installed, on PYTHONPATH, or beside "
                 "lyric_harness.py"])
    obj, walked = mod, mod_name
    for part in attr_path.split("."):
        walked += "." + part
        if not hasattr(obj, part):
            _refuse(f"--propose=call:{mod_name}:{attr_path} — {mod_name!r} "
                    f"has no {walked[len(mod_name) + 1:]!r}",
                    detail=[f"resolved as far as {walked.rsplit('.', 1)[0]!r}",
                     "FACTORY is the attribute YOU declared, so it is not "
                     "searched for under another name"])
        obj = getattr(obj, part)
    if not callable(obj):
        want = PROPOSE_CONTRACT["MODULE:FACTORY (declared by "
                                "--propose=call:)"][0]
        _refuse(f"--propose=call:{mod_name}:{attr_path} — the declared "
                f"FACTORY is a {type(obj).__name__}, not callable",
                detail=[f"the contract is {want}"])
    try:
        call = obj()
    except TypeError as e:
        _refuse(f"--propose=call:{mod_name}:{attr_path} — the declared "
                f"FACTORY did not accept a no-argument call: {e}",
                detail=["FACTORY is called with NO arguments and must return the "
                 "callable(prompt) -> str, so anything it needs — an "
                 "endpoint, a credential, a model choice, a budget — is "
                 "closed over on YOUR side of this seam and named nowhere "
                 "in this repository"])
    if not callable(call):
        _refuse(f"--propose=call:{mod_name}:{attr_path} — FACTORY() returned "
                f"a {type(call).__name__}, not a callable",
                detail=["quality/propose.py's ModelProposer takes one `call`, and "
                 "calls it with a rendered prompt"])

    # THE CALLER'S HALF IS SATISFIED. Now this repo's own, and it is the
    # LAST thing checked for the reason given above.
    try:
        from quality import propose as PR
    except ImportError as e:
        _refuse(f"--propose=call:{mod_name}:{attr_path} — the declared "
                f"FACTORY resolved, and quality/propose.py is not importable "
                f"({e})",
                detail=["the prompt renderer is another cell's module and may not "
                 "have landed yet; `--propose=stub` and "
                 "`--propose=replay:PATH` do not need it",
                 "NOTHING was called on your side before this refusal — the "
                 "FACTORY was invoked, the callable it returned was not"])
    # PROBED, not assumed: `ModelProposer` is a sibling's to spell and an
    # `AttributeError` from three frames down is exactly the traceback this
    # flag's whole shape exists to replace.
    _pname, Proposer = _first_attr(PR, PROPOSE_CONTRACT["quality.propose"])
    if Proposer is None:
        _refuse("--propose=call: — quality/propose.py has no "
                f"{PROPOSE_CONTRACT['quality.propose'][0]}",
                detail=[f"probed for: "
                 f"{', '.join(PROPOSE_CONTRACT['quality.propose'])}"])
    try:
        proposer = Proposer(call)
    except TypeError as e:
        _refuse(f"--propose=call:{mod_name}:{attr_path} — ModelProposer(call) "
                f"did not accept it: {e}",
                detail=["quality/propose.py's ModelProposer takes one `call`"])
    one = getattr(proposer, "propose", None)
    two = getattr(proposer, "propose_pair", None)
    if one is None:
        _refuse("--propose=call: — the ModelProposer has no `.propose`",
                detail=["quality/loop.py calls propose(brief, lines, attempt, "
                        "reasons=None, whole=()) and "
                        "propose_pair(pair_brief)"])

    def disclosure(done=False):
        return (f"  PROPOSER: call:{mod_name}:{attr_path} — DECLARED on the "
                f"command line and imported as named; this harness supplied "
                f"no module of its own. Wrapped in quality/propose.py's "
                f"{Proposer.__name__}. Whatever that call reaches, and what "
                f"it costs, is on the far side of this seam"
                + ("" if two is not None else
                   ". NO `.propose_pair`: tier 2 (the backtrack) fell back "
                   "to quality/loop.py's own stub pair-swap, so any "
                   "backtracked line is a SPLICE and not proposed text"))
    return one, two, disclosure


def _grid_song(GR, bp):
    """A blueprint dict -> a `quality.grid.Song`. One loader, two verbs.

    IT USED TO BE A THIRD LOADER, WHICH IS WHAT THIS DOCSTRING'S OWN FIRST
    LINE SAID IT WAS NOT. Until 2026-08-14 this function re-derived the
    blueprint shape by hand alongside `grid.song_from_blueprint` and
    `fit.from_blueprint`, and got three coordinates wrong in the same
    direction, all toward the common-time cliche the harness exists to
    resist:

      * `meter` fell to 4/4 in silence. Worse, after the 2026-08-14 refusal
        landed in the other two readers it did NOT pass `declared=`, so the
        invented 4/4 inherited `Meter.declared = True` -- the coordinate
        added to DETECT the default ended up certifying it, and `stanza_lock`
        then charged the writer with a `METER_LOCKED` monotony that no
        blueprint had declared and the harness had invented.
      * `start_bar` fell to the literal 1 instead of the running cursor both
        siblings keep, so every section began at bar 1 and they all overlapped
        -- and `grid.py` attributes lines to sections by bar range, so a whole
        song collapsed onto its first section.
      * `beat`/`duration` fell to 1 and 4, and a `duration` of 4 is the same
        4/4 assumption smuggled in as a span; under a declared 7/8 it silently
        covers 4 of 7 pulses and fires `CROWDED` off a span nobody wrote.

    So this delegates now. `function` and `title` remain DECLARED coordinates
    read straight through: an absent `function` stays UNDECLARED and every
    function check refuses -- the harness must not read "chorus" out of a
    section's NAME. `GR.UnknownFunction` is deliberately not caught: a
    blueprint declaring "vibes" has a defect ("middle8" resolves since
    the 2026-08-18 aliases), and swallowing it would hand
    back a silently UNDECLARED section.

    The `hooks` half of the reader's pair is dropped here on purpose -- the
    `function` verb assembles its own hook list from the blueprint AND from
    `--hook=` flags, and taking this one too would double every hook.
    """
    song, _hooks = GR.song_from_blueprint(bp)
    return song


def main():
    decl = Declaration()
    args = sys.argv[1:]

    # --fallback=high|low is a GLOBAL declared coordinate: `Lexicon()` is
    # built once here, before any verb dispatches, so it cannot live inside
    # one verb's own flag parsing the way --blueprint does for brief/verify/
    # revise. Consumed before `cmd` is read from `args`, so it works ahead of
    # EVERY verb and is never mistaken for the verb name itself.
    #
    # `eq_only` on purpose. --blueprint/--subdivision accept a following
    # space-separated token because each is read inside ONE verb's own
    # argument list, where the shape of what follows is already known.
    # --fallback sits ahead of an ARBITRARY verb's own arguments -- "
    # --fallback high FILE.txt" would have no way to tell "high" the
    # fallback value from "high" a file whoever ran the command happened to
    # name that. `=` removes the ambiguity instead of guessing past it.
    fallback = _flag_value(args, "--fallback", eq_only=True)
    if fallback is not None:
        if fallback not in ("high", "low"):
            # THE MODEL THE OTHER FLAGS NOW COPY. Text unchanged apart from
            # the `REFUSED --` prefix `_refuse` supplies: this flag has
            # validated and exited 2 since it was written, and what was wrong
            # was that it did so ALONE, in its own hand-rolled shape, while
            # `--profile`, `--isochronous` and `--schema=` beside it took an
            # undeclared value and changed a measurement in silence.
            _refuse(f"--fallback wants 'high' or 'low', got {fallback!r} "
                    f"(quality.g2p.Fallback.min_confidence's own vocabulary; "
                    f"doctrine 1 -- not free text, not coerced)")
        args = [a for a in args if not a.startswith("--fallback=")]

    # --voices is a GLOBAL, bare-presence flag (no value, like --isochronous)
    # sitting alongside --fallback for the same reason: `Lexicon()` is built
    # once here, before any verb dispatches. Declares that `(...)` (and
    # `*asterisk*`, never special) text in the lyric file that follows is
    # voice-attribution notation -- real sung words in a second voice or a
    # group, not a non-sung aside -- so `line_tokens`/`Lexicon.transcribe`
    # keep those words instead of erasing them. Omitted, nothing changes:
    # every verb reads `(...)` as a stage direction exactly as it always has.
    voices = _bare_flag_or_refuse(
        args, "--voices",
        "that `(...)`/`*...*` in the lyric file is VOICE-ATTRIBUTION notation "
        "(a second voice, a group) rather than a non-sung stage direction")
    if voices:
        args = [a for a in args if a != "--voices"]

    if not args or args[0] in ("-h", "--help"):
        print(__doc__)
        print(USAGE)
        return
    cmd = args[0]
    lex = Lexicon(fallback=fallback, strip_parens=not voices)

    if cmd == "declaration":
        print(decl.show())

    elif cmd == "score":
        rest = " ".join(args[1:])
        w1, w2 = _two_sides_or_refuse(rest, "score", "score A -- B")
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
        n = (_number_or_refuse(args[2], int, "candidates N",
                              "candidates W [n] [--modal]")
             if len(args) > 2 else 20)
        eng = CandidateEngine(lex, decl)
        res = eng.candidates(word, n)
        # A query the declared dialect cannot READ is a REFUSAL, named and
        # exited 2 -- never a traceback, and never an empty field printed as
        # though the search had run and found nothing (doctrine 79: the
        # refusal is charged to CMUdict, not to the word; doctrine 28: a
        # caller in a pipeline has to be able to tell "cannot tell" from
        # "none"). This verb raised `KeyError: 'anchor_syllables'` on every
        # OOV query for as long as it has shipped -- including on
        # `hypotenuse`, the canary this repo's own known gap 1 names.
        if res.get("error"):
            print(f"  REFUSED — '{word}': {res['error']}. Its end word is "
                  f"not readable in the declared dialect "
                  f"(out-of-vocabulary: {res['oov'] or 'none'}), so there is "
                  f"no anchor to search a candidate field against. Nothing "
                  f"here says the word has no rhymes. `--fallback=high|low`, "
                  f"ahead of the verb, reaches quality/g2p.py's derivation "
                  f"layers; known gap 1 says what that does and does not "
                  f"close.")
            sys.exit(2)
        print(f"candidates for '{word}' "
              f"(anchor {res['anchor_syllables']} syllable(s)):")
        for c in res["candidates"]:
            fl = f"   [{', '.join(c['flags'])}]" if c["flags"] else ""
            print(f"  {c['score']:.3f}  {c['tier']:<8} {c['word']}{fl}")
        # WHICH ORDERING THIS IS, AND THE OTHER ONE — FIXED 2026-08-15.
        # THE DEFECT: this verb ranks by RHYME SCORE and the loop's modal
        # exclusion ranks by FREQUENCY, and neither said so. They are two
        # answers to one question — "is this rhyme too predictable" — and the
        # one a writer can reach from the command line is NOT the one the
        # grader enforces. MEASURED on 'lines': this verb's top 7 is
        # signs/mines/designs/shines/headlines/airlines/whines and the loop
        # forbade shines/signs/designs/vines/declines/pines/sign — THREE in
        # common. A writer pre-screening a rhyme here was screening against
        # the wrong list and had nothing to tell them (doctrine 1: one
        # question, one reading, and where there are two they are declared).
        # `modal_field` is the LOOP'S OWN method, called here rather than
        # reimplemented, so the two cannot drift.
        print(f"\n  ORDERED BY RHYME SCORE, high to low. This is NOT the "
              f"order doctrine 9 forbids on: `--modal` prints the loop's own "
              f"set, which is ranked by FREQUENCY over the words the GRADER "
              f"would accept, and the two lists differ.")
        # A BARE FLAG, AND `--modal=yes` WAS SILENTLY NOT IT — 2026-08-15.
        # `"--modal" in args` is an exact membership test, so the `=`
        # spelling every sibling flag on this file accepts fell through and
        # the run came back BYTE-IDENTICAL to passing no flag at all: the
        # caller who asked for the FREQUENCY-ranked forbidden set was handed
        # the RHYME-SCORE list, which is the exact substitution §22 exists to
        # stop. It takes no value, so a value is refused rather than guessed.
        _modal_eq = [a for a in args if a.startswith("--modal=")]
        if _modal_eq:
            _refuse(f"--modal takes no value; got {_modal_eq[0]!r}",
                    detail=["usage: candidates W [n] --modal",
                            "bare `--modal` prints the loop's own "
                            "FREQUENCY-ranked forbidden set; without it the "
                            "list is ranked by RHYME SCORE, and the two "
                            "differ (doctrine 9)."])
        if "--modal" in args:
            from quality.revise import (Reviser as _Rv,
                                        ReviseDeclaration as _RD)
            offered, forbidden = _Rv(lex=lex, decl=decl).modal_field(word)
            # THE CLAIM IS SCOPED NOW — 2026-08-16. It read "what `verify()`
            # rejects a revision for taking" flat, and that is true only for
            # a line in ONE mandated group. `brief()` enforces off
            # `joint_field(calls, ...)` — a head over the INTERSECTION of
            # every call's field, ranked on the summed conditional — so for a
            # PIVOT the two are different POPULATIONS, not just different
            # orders, and this verb takes one word and cannot express a pivot
            # at all. It was also wrong a second way until the same day: the
            # list `brief()` printed carried the INCUMBENT as well, so the
            # two sets were not the same KIND of object. The split fixed that
            # half; this states the half that remains.
            print(f"\n  FORBIDDEN (modal — doctrine 9), what `verify()` "
                  f"rejects a revision for MOVING TO on a line in ONE "
                  f"mandated group, modal_exclusion="
                  f"{_RD().modal_exclusion}:")
            print(f"    {', '.join(forbidden) or '(none)'}")
            print(f"  A PIVOT is a different question: a line in k groups is "
                  f"enforced against the head of the INTERSECTION of its k "
                  f"fields, which this one-word verb cannot state.")
            print(f"  OFFERED after the exclusion ({len(offered)}):")
            print(f"    {', '.join(offered[:24]) or '(none)'}")

    elif cmd == "meter":
        template = args[1]
        lines = args[2:]
        # ZERO LINES ITERATED ZERO TIMES AND THE VERB FELL OFF THE END —
        # exit 0, stdout empty, stderr empty, which a caller in a pipeline
        # reads as "meter checked, nothing wrong" (doctrine 20). A verb whose
        # entire output is per-line has nothing to say about no lines, and
        # saying nothing is the one answer it must not give.
        # AND AN UNRECOGNISED FLAG WAS SCORED AS A LINE OF VERSE. `meter`
        # declares no flags at all, so every `--token` in the line list is a
        # mistake, and it was measured as one syllable of sung text.
        _no_unknown_flags_or_refuse(lines, ("(none — meter takes no flags)",),
                                    "meter")
        if not lines:
            _refuse("meter was given a TEMPLATE and no lines to check it "
                    "against",
                    detail=["usage: meter TEMPLATE L...",
                            "every line of this verb's output is per-line, "
                            "so an empty draft produces an empty report that "
                            "is indistinguishable from a clean one."])
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
        lines = load_lyric_lines(args[1])
        res = rhyme_density(lex, lines, decl)
        for i, d in enumerate(res["per_line"]):
            print(f"  L{i+1}: {d}")
        print(f"  overall density: {res['overall']}")
        for u in res["unreadable"]:
            print(f"  UNREADABLE L{u['line']}: {u['words']} "
                  f"(not in the numerator or the denominator)")

    elif cmd == "cynghanedd":
        # SAME DEFECT AS `scheme --profile`, FOUND WHILE FIXING IT: `--lang=`
        # was read in FIRST POSITION ONLY, so `cynghanedd "the cattle waded"
        # --lang=eng` was scored under the DEFAULT Welsh phonology AND had
        # the literal token `--lang=eng` joined into the line it scored.
        # Doctrine 45 -- every result declares which phonology produced it --
        # held in the printed header and not in the parse.
        rest = args[1:]
        language = _flag_value(rest, "--lang", eq_only=True) or "cym"
        _value_in_vocabulary_or_refuse(
            "--lang", language, ("cym", "eng"),
            "cynghanedd is a WELSH form: 'cym' is the language of the form "
            "and 'eng' is a labelled English imitation (doctrine 45). "
            "Another language's phonology is refused, not substituted.")
        rest = _strip_flag(rest, "--lang")
        res = check_cynghanedd(lex, " ".join(rest), decl, language=language)
        print(f"  phonology: {res['language']} — {res['phonology']}")
        if not res["found"]:
            print(f"  no cynghanedd detected"
                  + (f": {res['why_not']}" if res["why_not"] else ""))
        for kind, why in res["found"]:
            print(f"  {kind.upper()}: {why}")

    elif cmd == "qafiya":
        # THE LAST READER THAT SCORED APPARATUS AS SUNG TEXT. It was
        # `open(args[1]).read().splitlines()` filtered for blanks only -- no
        # `is_apparatus_line`, no `encoding="utf-8"` -- while every sibling
        # verb (density, graph, chains, partition, refrain, brief, verify,
        # revise) went through `load_lyric_lines` and `relations`/`song`
        # spell the apparatus test inline. So this one verb scored
        # `#` provenance headers and `--- TITLE:` markers as sung text: over
        # `corpus/song/eng_*.txt` it admitted 36,948 lines of the 189,261 it
        # read that `load_lyric_lines` drops (19.5%). That is not cosmetic,
        # it moves the ANSWER -- on `corpus/song/eng_hymn_newton.txt` the
        # established rawi flips, and one run charged "ita (rhyme word
        # repeats line 2)" against a fragment of an md5 checksum.
        #
        # The file-vs-lines guard is `partition`'s, for `partition`'s reason:
        # the documented usage is `qafiya FILE|L...`, so a two-token
        # invocation whose second token is a LINE must not be opened as a
        # path. `os.path.exists` decides, exactly as it does there -- and
        # BOTH verbs spelled that decision themselves until 2026-08-15, which
        # is how they came to share a defect neither could see: the
        # else-branch read a MISTYPED PATH as a lyric line. `_lyric_source`
        # is the one definition now; the normalization below stays here.
        src = args[1:]
        lines = _lyric_source(src, "qafiya")
        if lines is None:
            lines = [l.strip() for l in src if l.strip()]
        res = check_qafiya(lex, lines, decl)
        print(f"  established profile: {res['profile']}   "
              f"(from {res['lines_judged']} judged line(s); "
              f"{res['lines_refused']} refused)")
        # A tie is DISCLOSED, not resolved behind the reader's back: "this
        # text does not establish a single rawi" is a real answer about the
        # text, and it is the answer for 12 of the 143 English corpus files.
        # The audit below is scored against one arbitrary candidate, so
        # saying which -- and what it was tied with -- is the difference
        # between a reproducible report and a reproducible-looking one.
        for key, t in sorted(res["profile_tied"].items()):
            cands = ", ".join(repr(c) for c in t["candidates"])
            print(f"  TIED: the text does not establish {key} -- "
                  f"{cands} each occur {t['count']} time(s). Scoring the "
                  f"audit below against {t['candidates'][0]!r}, the first "
                  f"in sort order, so the run reproduces; another candidate "
                  f"would score it differently.")
        for n, ew, defects in res["audit"]:
            print(f"  L{n} ({ew}): "
                  + ("; ".join(defects) if defects else "sound"))

    elif cmd == "graph":
        lines = load_lyric_lines(args[1])
        th = (_number_or_refuse(args[2], float, "graph THETA",
                                "graph FILE [theta]")
              if len(args) > 2 else None)
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
        pos = _number_or_refuse(args[1], int, "prasa K",
                                "prasa K L...")
        res = check_prasa(lex, args[2:], pos)
        for r in res["lines"]:
            print(f"  syllable-{pos} consonant "
                  f"{r['consonant'] or '-'}: {r['line']}")
        print(f"  prasa at position {pos}: "
              f"{'SATISFIED' if res['satisfied'] else 'BROKEN'} "
              f"(target {res['target']})")

    elif cmd == "chains":
        lines = load_lyric_lines(args[1])
        th = (_number_or_refuse(args[2], float, "chains THETA",
                                "chains FILE [theta]")
              if len(args) > 2 else None)
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

    elif cmd == "scheme":
        # `--profile` IS THE COMPARATOR. It rebinds the channel weights every
        # number below is computed under, so it is a declared coordinate in
        # exactly doctrine 1's sense -- and it was read by `rest[0] ==
        # "--profile"` with no membership test and consumed by a slice, which
        # got three separate things wrong at once:
        #
        #   * AN UNKNOWN NAME WAS THE DEFAULT. `PROFILES.get(profile)` three
        #     frames down returned `None` for `bogus` and `None` for `full`
        #     alike, so `scheme ABAB --profile bogus dawn again silt rebuilt`
        #     was BYTE-IDENTICAL to the same command with no flag (md5
        #     c41b1dcd..., both), exit 0, while `--profile assonance` on
        #     those four words moves the violation count 2 -> 1. The library
        #     half is closed at `channel_profile`; this is the parse site,
        #     where a user can still be told.
        #   * `--profile=assonance` -- the spelling every sibling flag
        #     accepts -- was not the flag. It fell into the LINE LIST and
        #     died on `check_scheme`'s length assertion, traceback, exit 1.
        #   * so did a trailing `--profile assonance` after the lines.
        #
        # `_flag_value`/`_strip_flag` take both spellings in any position;
        # the membership test is `_value_in_vocabulary_or_refuse`, the shape
        # `--fallback` has had since it was written.
        scheme = args[1]
        rest = args[2:]
        profile = _flag_value(rest, "--profile")
        if profile is not None:
            _value_in_vocabulary_or_refuse(
                "--profile", profile, PROFILES,
                "The profile rebinds the CHANNEL WEIGHTS every score below "
                "is computed under, so an unrecognised name cannot fall "
                "through to the default ones -- that is a silent comparator "
                "substitution (doctrine 1).")
            rest = _strip_flag(rest, "--profile")
        lines = rest
        # AN AssertionError AT EXIT 1 WHERE `brief` AND `song` REFUSE THE
        # IDENTICAL MISMATCH AT 2 — 2026-08-15. `check_scheme`'s own
        # `assert len(scheme) == len(lines)` is a library CONTRACT and stays
        # exactly where it is; what was missing is the verb reading its own
        # arguments before handing them over. It bites twice, and the second
        # is the quiet one: any unrecognised flag on this verb is counted as
        # a FIFTH LINE, so `scheme AABB a b c d --nope` failed on arity and
        # blamed the scheme.
        _no_unknown_flags_or_refuse(lines, ("--profile assonance|rawi",),
                                    "scheme")
        if len(scheme) != len(lines):
            _refuse(f"scheme — the scheme {scheme!r} is {len(scheme)} "
                    f"character(s) and the draft is {len(lines)} line(s)",
                    detail=["usage: scheme LETTERS [--profile P] L...",
                            "one letter per line, in order. A stray token "
                            "counts as a line, so an unrecognised flag "
                            "reaches this check as an extra one."])
        res = check_scheme(lex, lines, scheme, decl, profile=profile)
        # THE COMPARATOR, NAMED, ON EVERY RUN -- declared or not. Nothing in
        # this report said which profile produced it, so a run under
        # non-default channel weights and a run under the default ones were
        # two identically-shaped reports whose numbers disagreed, with the
        # deciding coordinate visible only in the shell history. Doctrine 1
        # broken in the RENDERING (doctrine 91): the declaration was read
        # correctly and then not stated. House style is `fit`'s `subdivision:
        # ... DECLARED` and `function`'s `rhyme key: ...` lines.
        print(f"  profile: "
              + (f"{profile} — channel weights DECLARED at the command "
                 f"line, not the Declaration's"
                 if profile is not None and PROFILES[profile] else
                 f"{profile} — the Declaration's own channel weights, "
                 f"DECLARED at the command line" if profile is not None else
                 "NONE DECLARED — the Declaration's own channel weights "
                 "(equivalent to --profile full)"))
        print(f"scheme {scheme}  endwords {res['endwords']}")
        for p in res["pair_scores"]:
            head, *rest = report_pair(
                {"total": p["score"], "relation": p["relation"],
                 "spans": p["spans"]},
                p["endwords"][0], p["endwords"][1])
            print(f"  L{p['lines'][0]}-L{p['lines'][1]} {head}"
                  + (f"  [{', '.join(p['flags'])}]" if p["flags"] else ""))
            for line in rest:
                print(line)
        for v, vs in zip(res["violations"], res["violation_spans"]):
            print(f"  VIOLATION L{v[0]}-L{v[1]} score {v[2]}: {v[3]}")
            if not vs["claim"]:
                print(f"        the MANDATE names "
                      f"{vs['endwords'][0]}/{vs['endwords'][1]}; that is not "
                      f"what was compared -- triage the SPANS below, not "
                      f"those two words")
            if vs["note"]:
                print(f"        {vs['note']}")
        for r in res["refusals"]:
            print(f"  REFUSED   L{r['lines'][0]}-L{r['lines'][1]}: "
                  f"{r['reason']}")
        for c in res["collisions"]:
            print(f"  COLLISION L{c[0]}-L{c[1]} score {c[2]} "
                  f"[{c[3]}]: {c[4]}")
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
        print("VERB -> LAYER")
        for verb, mod, what in VERB_LAYERS:
            print(f"  {verb:38s} {mod:28s} {what}")

        # THE MAP CHECKS ITSELF. Eleven rows sat here while four shipped
        # layers had no verb at all, and the table went on reporting the
        # harness fully wired. A map nobody can falsify is decoration, so the
        # dispatch is read out of this file's own AST and the usage text is
        # searched for every verb it dispatches.
        print("\nTABLE COVERAGE (the map, checked against the dispatch)")
        disp = _dispatched_verbs()
        mapped = _mapped_verbs()
        undoc = sorted(v for v in disp
                       if not re.search(rf"^\s*{re.escape(v)}\b",
                                        USAGE, re.M))
        unmapped = sorted(disp - mapped)
        phantom = sorted(mapped - disp)
        print(f"  dispatched {len(disp)}   on the map {len(mapped)}   "
              f"in --help {len(disp) - len(undoc)}/{len(disp)}")
        for v in unmapped:
            print(f"  UNMAPPED      {v} — dispatched and not on the map "
                  f"above, so `wiring` was lying about it")
        for v in phantom:
            print(f"  PHANTOM       {v} — on the map and not dispatched "
                  f"anywhere in main()")
        for v in undoc:
            print(f"  UNDISCOVERABLE {v} — dispatched and absent from "
                  f"--help; a verb nobody can find is a verb nobody runs")
        if not (unmapped or phantom or undoc):
            print("  every dispatched verb is on the map and in --help, and "
                  "every mapped verb is dispatched")

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
        # A COUNT IS NOT DISCOVERABILITY. "standalone by design" was true of
        # quality/audit_corpus.py, quality/relations_null.py and
        # quality/ltc_overlap.py the whole time they were unfindable: nobody
        # reads a number and learns that the corpus auditor exists. So each
        # one is named with the command that runs it and its own first line.
        # These do NOT become verbs — a one-shot audit over 258 corpus files
        # is not a thing to put behind `lyric_harness.py <verb>`, and wrapping
        # it would make the spine own a runtime it cannot bound.
        for m in sorted(runners):
            try:
                doc = _ast.get_docstring(_ast.parse(
                    open(_os.path.join(base, m), errors="replace").read()))
            except SyntaxError:
                doc = None
            head = (doc or "").strip().splitlines()[0] if doc else ""
            print(f"    python3 {m:<34} {head[:76]}")
        # RUNNABLE AND IMPORTED — the blind spot this verb had until
        # 2026-08-13. `runners` above is drawn from `orphan`, and `orphan`
        # excludes anything that appears in an import anywhere, so a module
        # that is BOTH a library and a command could never reach either list.
        # `battery.py` was the case that matters: the first line of CLAUDE.md's
        # Test discipline, absent from README, and invisible to the one verb
        # written so that "is this plugged in?" is a command rather than an
        # audit -- because `audit_spans.py` and `redteam_band.py` import it.
        # `verify_doctrines.py` the same, via `counters.py`/`audit_register.py`.
        # A COUNT IS NOT DISCOVERABILITY applies here too: these are named,
        # with the command that runs them, exactly like the standalone set.
        also = sorted(m for m in prod
                      if m not in orphan
                      and not _os.path.basename(m).startswith("test_")
                      and _os.path.basename(m) != "__init__.py"
                      and "data/" not in m
                      and _runnable(m))
        print(f"\n  ALSO RUNNABLE, and imported by production code "
              f"(`__main__` + a caller): {len(also)}")
        print("    not 'standalone by design' -- these are libraries you can "
              "also run, and the count above deliberately excludes them")
        for m in also:
            try:
                doc = _ast.get_docstring(_ast.parse(
                    open(_os.path.join(base, m), errors="replace").read()))
            except SyntaxError:
                doc = None
            head = (doc or "").strip().splitlines()[0] if doc else ""
            print(f"    python3 {m:<34} {head[:76]}")

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
        rest, lang, preset = args[1:], "eng", None
        keep = []
        for a in rest:
            if a.startswith("--lang="):
                lang = a.split("=", 1)[1]
            elif a.startswith("--preset="):
                preset = a.split("=", 1)[1]
            else:
                keep.append(a)
        w1, w2 = _two_sides_or_refuse(
            " ".join(keep), "types",
            "types W1 -- W2 [--lang=] [--preset=]")
        # BOTH of this verb's flags name a declared vocabulary, both already
        # refuse an undeclared value with a message that names it, and both
        # did it as a traceback at exit 1 -- `phonology.Unsupported` and
        # `rhyme_types.classify_pair`'s `ValueError`. Same class of mistake
        # as `--fallback=bogus`, one screen away, which refuses at exit 2.
        # Membership-tested HERE, at the parse site, so the refusal names the
        # FLAG the user typed rather than the parameter four frames down.
        phon = _phonology_or_refuse(lang)
        if preset is not None:
            _value_in_vocabulary_or_refuse(
                "--preset", preset, RT.PRESETS,
                "A preset sets the ANCHOR RULE and the channel selection at "
                "once (doctrine 83), so an unrecognised name cannot fall "
                "through to the default pair.")
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

    elif cmd == "plan":
        from quality import plan as PLN
        rest = args[1:]
        seed = _flag_value(rest, "--seed")
        form = _flag_value(rest, "--form") or "verse-chorus"
        nlines = _flag_value(rest, "--lines")
        fill = _flag_value(rest, "--fill")
        out_path = _flag_value(rest, "--out")
        rest = _strip_flag(rest, "--seed")
        rest = _strip_flag(rest, "--form")
        rest = _strip_flag(rest, "--lines")
        rest = _strip_flag(rest, "--fill")
        rest = _strip_flag(rest, "--out")
        if rest:
            _refuse(f"plan does not take {rest[0]!r}",
                    detail=["usage: plan --seed=N [--form=verse-chorus] "
                            "[--lines=N] [--fill=DRAFT] [--out=PATH]",
                            "an unrecognised flag is refused rather than "
                            "ignored -- a flag silently not read leaves a "
                            "plan that looks exactly like one you never "
                            "asked for"])
        try:
            the_plan = PLN.make_plan(
                seed=int(seed) if seed is not None else None,
                form=form,
                lines=int(nlines) if nlines is not None else None)
        except PLN.PlanRefused as e:
            _refuse(str(e))
        except ValueError:
            _refuse("plan --seed and --lines take integers")
        pat = the_plan["choices"]["pattern"]
        print(f"  PLAN: form={form} seed={seed} -> "
              f"{the_plan['total_lines']} line(s), "
              f"{len(the_plan['sections'])} section(s): "
              f"{'-'.join(pat['functions'])}")
        print(f"    (pattern drawn from {pat['chosen_from']})")
        m = the_plan["choices"]["meter"]["value"]
        print(f"  METER: {m['beats']}/{m['unit']} as "
              f"{tuple(m['groups'])} -- "
              f"{the_plan['choices']['meter']['chosen_from']}; "
              f"subdivision {the_plan['subdivision']}, "
              f"{the_plan['choices']['bars_per_line']} bar(s) per line")
        for func, sch in the_plan["choices"]["schemes"].items():
            note = ("with a mandated pair" if sch["lines"] > 1
                    else "(a one-line section mandates no pair)")
            print(f"  SCHEME {func}: {sch['lines']} line(s), rgs "
                  f"{tuple(sch['rgs'])} -- one of {sch['chosen_from']} "
                  f"{note}")
        print(f"  GROUPS : {the_plan['groups']}")
        print(f"  RETURNS: {the_plan['returns'] or '(none)'}")
        print()
        print(the_plan["writer_brief"])
        print()
        if fill:
            with open(fill, encoding="utf-8") as fh:
                draft_lines = [l.rstrip("\n") for l in fh if l.strip()]
            try:
                bp = PLN.fill_plan(the_plan, draft_lines)
            except PLN.PlanRefused as e:
                _refuse(str(e))
            payload, what = bp, "completed blueprint"
        else:
            payload = the_plan
            what = "plan (line slots empty -- the writer is outside)"
        if out_path:
            with open(out_path, "w", encoding="utf-8") as fh:
                json.dump(payload, fh, indent=1, sort_keys=True)
                fh.write("\n")
            print(f"  WROTE {what} -> {out_path}")
        else:
            print(json.dumps(payload, indent=1, sort_keys=True))
        print()
        print("  GRADE IT: " + PLN.grading_command(
            the_plan, draft_path=fill or "DRAFT.txt",
            bp_path=out_path or "BP.json"))
    elif cmd == "partition":
        from quality import schemes as SC
        src = args[1:]
        lines = _lyric_source(src, "partition")
        if lines is None:
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
        if spec.count("/") != 1 or not all(spec.split("/")):
            _refuse(f"cycle wants a time signature as N/D; got {spec!r}",
                    detail=["usage: cycle N/D [a+b+c]"])
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
        # `encoding="utf-8"` for `load_lyric_lines`'s reason, not its
        # reading: this verb genuinely cannot call it (blank lines are
        # load-bearing here, see above), but it read the same UTF-8
        # corpus through a locale-dependent decode. 169 of the
        # `corpus/song/*.txt` files hold non-ASCII bytes, so under
        # `LC_ALL=C` this raised UnicodeDecodeError rather than reading
        # a curly apostrophe.
        #
        # `read_lyric_text` 2026-08-15, for the same reason one step on: the
        # decode was right and it was a SECOND SPELLING of a rule that now
        # has one definition, so this verb alone turned an undecodable file
        # into a raw `UnicodeDecodeError` at exit 1 after every sibling had
        # learned to refuse it. What that function does NOT do is drop blank
        # lines -- it returns the text -- so the split and both filters below
        # stay here, where the stanza frame needs them.
        raw = [l.rstrip() for l in read_lyric_text(keep[0]).splitlines()
               if not is_apparatus_line(l)]
        lines = [l for l in raw if l.strip()]
        phon = _phonology_or_refuse(lang)
        st = RL.build_stream(raw, phon,
                             stanzas=RL.stanzas_from_blank_lines(raw))
        # --schema= IS A SUBSTRING FILTER OVER THE POPULATION THE TWO COUNTS
        # BELOW ARE TAKEN FROM, and an unmatched value used to filter all 77
        # schemas out and print `schemas finding something: 0   refusing on a
        # capability eng does not have: 0` at exit 0 -- the SAME SHAPE as a
        # genuine null, wrapped in the two paragraphs about how to read these
        # counts, and reachable by no other flag (no filter gives 25/26 on
        # this repo's own fixture). Two changes, and they are different
        # fixes:
        #
        #   * A FILTER THAT SELECTED NOTHING REFUSES. It is not a null and
        #     must not be printed in a null's shape.
        #   * THE FILTER IS DISCLOSED ON EVERY RUN, matched or not, because
        #     `found`/`refused` are counts over a POPULATION and a count
        #     whose denominator was silently changed is doctrine 91's defect
        #     exactly. The filter stays a substring match on purpose -- it is
        #     how `--schema=rhyme` reaches a family -- so saying HOW MANY of
        #     the 77 it selected is the only way a reader can tell a narrow
        #     filter from a wide one.
        all_schemas = list(RL.all_schemas().values())
        selected = [s for s in all_schemas
                    if not want or want.lower() in s.name.lower()]
        if want and not selected:
            _refuse(
                f"--schema={want!r} matched 0 of {len(all_schemas)} relation "
                f"schemas. It is a SUBSTRING match on the schema NAME, not a "
                f"schema id, and a filter that selects nothing is refused "
                f"rather than reported as a null: `schemas finding "
                f"something: 0` would be the same sentence this verb prints "
                f"about a text that genuinely carries no named relation. The "
                f"vocabulary is:\n"
                + textwrap.fill(", ".join(sorted(s.name for s in all_schemas)),
                                width=74, initial_indent="      ",
                                subsequent_indent="      "))
        print(f"  phonology {lang}   lines {len(lines)}   "
              f"units {len(st.units)}   UNREADABLE tokens "
              f"{len(st.unreadable)}")
        print(f"  schema filter: "
              + (f"{want!r} — {len(selected)} of {len(all_schemas)} "
                 f"schemas asked (SUBSTRING match on the name). The two "
                 f"counts below are over those {len(selected)}, not over the "
                 f"registry"
                 if want else
                 f"NONE DECLARED — all {len(all_schemas)} schemas asked"))
        if st.unreadable:
            print(f"    dropped: {[u for u in st.unreadable[:8]]}"
                  f"{' ...' if len(st.unreadable) > 8 else ''}")
        found = refused = 0
        scope = {}
        burdens = []            # (schema name, search_burden) for FIRING ones
        for sch in selected:
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
                # M-15 CLOSED: the schema now declares which traditions cite
                # it, so the verb can say whether a hit is IN TRADITION or
                # only a rule-shape match (doctrine 43/45).
                sc = RL.tradition_scope(sch, lang)
                tag = {"in_tradition": "", "cell_cited": "[SOURCE SILENT] ",
                       "rule_shape": "[RULE SHAPE ONLY] ",
                       "unsourced": "[UNSOURCED SCHEMA] "}.get(sc, "")
                scope[sc] = scope.get(sc, 0) + 1
                # Doctrine 56, asked of the schemas that actually FIRED --
                # the burden behind THESE counts, not a whole-registry
                # average that no printed number was obtained under.
                burdens.append((sch.name, RL.search_burden(sch, st)))
                print(f"  {tag}{sch.name}  ({len(hits)} instance(s))")
                for t in getattr(sch, "traditions", ())[:2]:
                    print(f"      canon {getattr(t, 'source', '?')}: "
                          f"{getattr(t, 'name', t)}")
                for i in hits[:4]:
                    print(f"      {_rel_show(st, i)}")
        print(f"  schemas finding something: {found}   "
              f"refusing on a capability {lang} does not have: {refused}")
        print("  TWO THINGS THESE COUNTS ARE NOT:")
        # `RL.search_burden(schema, stream)` takes TWO arguments; this call
        # site passed ONE, inside a blanket `except Exception` that turned the
        # resulting TypeError into `burden = None` -- which renders as the
        # clause below simply not being there. So the doctrine 56 disclosure
        # this paragraph PROMISES ("`search_k` is now consumed") had never
        # once run, on any input, and nothing reported that. The handler is
        # GONE rather than narrowed: `search_burden` already catches the one
        # exception its own enumeration raises (`NoReferent`, per rule), and
        # every schema counted here has already had `realise` enumerate the
        # same spans without raising, so anything thrown from this line is a
        # programming error and belongs in the open. Doctrine 48 -- a
        # principle that lives only in prose gets followed exactly as often
        # as someone remembers it, and a handler that cannot tell a bug from
        # a capability gap is what let this one survive unnoticed.
        loci = sum(b["members"] for _, b in burdens)
        searched = sum(b["searched"] for _, b in burdens)
        worst = max(burdens, key=lambda t: t[1]["mean_k"], default=None)
        # loci and `searched` are the same kind of count and may be summed;
        # mean_k is NOT averaged across schemas (doctrine 79 -- never sum
        # what asks different things of a reader). The heaviest schema is
        # NAMED, because that is the one whose bare rate is quoting the null
        # back at itself.
        burden = (f"{loci} member span(s) over {len(burdens)} firing "
                  f"schema(s), {searched} of them reached by a search over "
                  f"more than one hypothesis; heaviest {worst[0]!r} at "
                  f"mean_k {worst[1]['mean_k']:.2f}, max_k "
                  f"{worst[1]['max_k']}") if burdens else ""
        print("   1. EVIDENCE. These are INSTANCES. `search_k` is now "
              "consumed — `search_burden()` reports the hypotheses per locus"
              + (f", here {burden}" if burden else "") + " — but a count "
              "obtained by search still needs a null under the SAME search "
              "(doctrines 56/61). `quality/relations_null.py` is that null, "
              "and it found `line_permutation` to be the IDENTITY MAP for "
              "every schema with no bounded line-distance placement, and "
              "`internal rhyme` to sit BELOW chance at lift 0.897.")
        print("   2. CLAIMS ABOUT A TRADITION — unless the row says so. "
              f"scope: {scope}. `traditions` is now sourced on 75 of 77 "
              "schemas (M-15 closed), so a hit is labelled IN TRADITION, "
              "[RULE SHAPE ONLY], [SOURCE SILENT] where the citing canon "
              "entry names no tradition, or [UNSOURCED SCHEMA]. When 'Middle "
              "Chinese end rhyme (同用 group)' fires on English the RULE "
              "SHAPE matched and the tradition did not (doctrine 43); the "
              "row is printed and labelled, never hidden. NOTE: every "
              "citation resolves to RHYME_CANON.md inside this repo — the "
              "graph is closed, see quality/RESULTS_REGISTER_AUDIT.md.")

    elif cmd == "grid":
        from quality import grid as GR
        bp = _blueprint_or_refuse(lambda p: json.load(open(p)), args[1])
        song = _blueprint_or_refuse(_grid_song, GR, bp,
                                   _reraise=(GR.UnknownFunction,))
        secs, lines = song.sections, song.lines
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

    elif cmd == "fit":
        # `grid` says how many BARS a section has. This says whether the WORDS
        # go in them: MISSING.md G-1/G-2/G-3, and the first reader `Line.beat`
        # and `Line.duration` have ever had.
        #
        # --subdivision N is a DECLARED coordinate and there is no default.
        # Without it the slot questions REFUSE rather than assuming a
        # sixteenth-note grid -- the same refusal `meter.pulse_groups` makes
        # about an undeclared 7/8.
        #
        # --isochronous IS A MEASUREMENT SWITCH AND IT WAS REACHABLE BY LUCK.
        # It declares the assumption that the pulses are evenly spaced, which
        # is what lets the slot questions be asked at all; without it 16
        # placements on this repo's own fixture answer NO_SETTING. It is a
        # BARE presence flag standing between two flags that take values, so
        # `--isochronous=true` is the natural guess and `"--isochronous" in
        # args` is simply False for it. Measured on `fit quality/fixtures/
        # song.blueprint.json --subdivision 2`: `--isochronous=true` and the
        # one-letter typo `--isochronus` were each BYTE-IDENTICAL to omitting
        # the flag (md5 a5ae7335..., all three), exit 0, 16 NO_SETTING
        # refusals restored -- and the string "isochron" appeared NOWHERE in
        # the report either way, so there was nothing to read even for a
        # reader who went looking. Three fixes, and the third is the one that
        # matters: refuse the `=` spelling, refuse the typo, and STATE THE
        # COORDINATE unconditionally.
        from quality import fit as FT
        sub_arg = _flag_value(args, "--subdivision")
        sub = _subdivision_or_refuse(
            FT, sub_arg,
            "lyric_harness.py fit --subdivision, an explicit decision "
            "by whoever ran the command")
        isochronous = _bare_flag_or_refuse(
            args, "--isochronous", "that the pulses are evenly spaced in "
            "time (there is no audio and no tempo here, so isochrony is an "
            "ASSUMPTION and never a measurement)")
        _no_unknown_flags_or_refuse(
            _strip_flag(_strip_flag(
                [a for a in args[2:] if a != "-v"], "--subdivision"),
                "--isochronous", bare=True),
            ("--subdivision N", "--isochronous", "-v"), "fit")
        assume = FT.Isochrony(
            source="lyric_harness.py fit --isochronous, an explicit "
                   "assumption by whoever ran the command") \
            if isochronous else None
        song = _blueprint_or_refuse(FT.fit_song, args[1], subdivision=sub,
                                    assume=assume, strip_parens=not voices)
        print(f"  module: quality/fit.py — syllables against the pulses of "
              f"the bar they are declared in")
        print(f"  subdivision: "
              + (f"{sub.s} slot(s) per pulse, DECLARED" if sub else
                 "NONE DECLARED — the slot questions refuse rather than "
                 "assume one"))
        # THE SAME LINE THE SUBDIVISION HAS ALWAYS HAD, for the coordinate
        # standing next to it. Isochrony was named NOWHERE in this report, so
        # `--isochronous` silently taken and `--isochronous` silently dropped
        # printed the same header over different numbers.
        print(f"  isochrony: "
              + (f"ASSUMED, DECLARED at the command line — "
                 f"{assume.source}" if assume else
                 "NONE DECLARED — the placements that need an even pulse "
                 "answer NO_SETTING rather than assume one (there is no "
                 "audio and no declared tempo, so this is never a "
                 "measurement)"))
        print(FT.report(song, verbose="-v" in args))
        print("\n  WHAT THIS LAYER CANNOT BE ASKED, AND WHY")
        for q, why in FT.UNANSWERABLE:
            print(f"    X {q}")
            print(f"        {why}")

    elif cmd == "function":
        # SECTION FUNCTION, WHICH IS NOT SECTION NAME. "chorus2" and "verse1"
        # are strings; `Section.function` is the declared coordinate, and an
        # absent one REFUSES. The three CLI flags below are declarations by
        # whoever ran the command -- the same standing as `fit --subdivision`
        # -- and they exist because a blueprint that predates the coordinate
        # cannot be made to answer any other way without inferring, which is
        # the one thing this layer is built not to do.
        from quality import grid as GR
        bp = _blueprint_or_refuse(
            lambda path: json.load(open(path, encoding="utf-8")), args[1])
        decls = []
        fnspec = _flag_value(args, "--function", eq_only=True)
        if fnspec:
            byname = {}
            for pair in fnspec.split(","):
                if ":" not in pair:
                    # WAS `print(...); return` -- a refusal at EXIT 0, which
                    # a caller in a pipeline reads as a pass over a blueprint
                    # nothing was declared on. Same for the one below.
                    _refuse(f"--function wants SECTION:FUNCTION, got "
                            f"{pair!r}")
                k, v = pair.split(":", 1)
                byname[k.strip()] = v.strip()
            # THE VALUE, MEMBERSHIP-TESTED AT THE PARSE SITE. `grid.
            # as_function` already refuses an undeclared function and names
            # the whole 21-word vocabulary, and it did so from inside
            # `song_from_blueprint` as an `UnknownFunction` traceback at exit
            # 1. Asking it HERE separates the two cases
            # `_blueprint_or_refuse`'s `_reraise=` exists to keep apart: a
            # bad value TYPED ON THIS COMMAND LINE is a flag refusal like
            # `--fallback`'s, while a bad value DECLARED IN THE BLUEPRINT
            # FILE is a defect in that file's own coordinate and still
            # raises, uncaught, exactly as that helper's docstring requires.
            for k, v in sorted(byname.items()):
                try:
                    GR.as_function(v)
                except GR.UnknownFunction as e:
                    _refuse(f"--function={k}:{v} — {e}")
            for s in bp.get("sections", []):
                if s["name"] in byname:
                    s["function"] = byname[s["name"]]
            unknown = sorted(set(byname) - {s["name"]
                                            for s in bp.get("sections", [])})
            if unknown:
                _refuse(f"--function names no such section: {unknown}. The "
                        f"blueprint declares: "
                        f"{sorted(s['name'] for s in bp.get('sections', []))}")
            decls.append(f"function of {sorted(byname)} declared on the "
                         f"command line, not read from the blueprint")
        title = _flag_value(args, "--title", eq_only=True)
        if title:
            bp["title"] = title
            decls.append("title declared on the command line")
        hooks = list(bp.get("hooks", ()))
        for a in args[2:]:
            if a.startswith("--hook="):
                hooks.append(a.split("=", 1)[1])
                decls.append("hook declared on the command line")
        song = _blueprint_or_refuse(_grid_song, GR, bp,
                                   _reraise=(GR.UnknownFunction,))
        key = GR.rime_cmudict(lex) if "--rhyme-key=cmudict" in args else None
        rep = GR.song_function_report(song, hooks=hooks, rhyme_key=key)
        p = rep["profile"]
        print("  module: quality/grid.py — Section.function, the returns, "
              "the hook")
        for d in decls:
            print(f"  DECLARED AT THE CLI: {d}")
        print(f"  rhyme key: "
              + (getattr(key, "declared_name", "cmudict") if key else
                 "NONE DECLARED — 'did the rhyme scheme survive the return' "
                 "stays CANNOT TELL (use --rhyme-key=cmudict)"))
        print(f"  form: {' -> '.join(x or 'UNDECLARED' for x in p['form'])}")
        print(f"  declared {p['declared']}/{len(song.sections)} sections   "
              f"bars until first chorus: {p['bars_until_first_chorus']}")
        print(f"  convention: {rep['convention']}")
        print(f"  asked {rep['asked']}  answered {rep['answered']}  "
              f"refused {rep['refused']}"
              + ("   (three counts, never one — doctrine 79)"
                 if rep["refused"] else ""))
        for f in rep["findings"]:
            print(f"  [{f.code}] {f.message}")
            if f.evidence:
                print(f"      {f.evidence}")
        for r in rep["refusals"]:
            print(f"  REFUSED {r.code}: {r.message}")
            if getattr(r, "evidence", ""):
                print(f"      {r.evidence}")
        for fn, rets in rep["returns"].items():
            for a, b, ret in rets:
                print(f"  -- {fn}: {a.name} -> {b.name}")
                for row in ret.describe().splitlines():
                    print(f"     {row}")

    elif cmd == "refrain":
        # The A-1 notation: a CAPITAL is a line that must come back VERBATIM,
        # a lowercase one only has to rhyme. A villanelle whose second refrain
        # drifted by one word passes the rhyme partition, passes the band, and
        # is a broken villanelle -- which this repo could not say until
        # `parse_refrain` existed, and could not ASK until now.
        from quality import schemes as SC
        if len(args) < 2:
            print("  refrain NOTATION|FORM [FILE]")
            print(f"  named forms: {', '.join(sorted(SC.REFRAIN_FORMS))}")
            return
        spec, how = _refrain_spec_or_refuse(args[1], SC.REFRAIN_FORMS)
        sch = SC.parse_refrain(spec)
        print("  module: quality/schemes.py — parse_refrain / RefrainScheme")
        print(f"  READ AS: {how}")
        if args[1] in SC.REFRAIN_FORMS:
            print(f"  named form: {args[1]!r}")
        print(f"  {sch.describe()}")
        pairs = sch.repeat_pairs()
        print(f"  REPEAT pairs the notation REQUIRES: {len(pairs)}"
              + ("   — inside a verse each of these is a band violation "
                 "(doctrine 3); here it is the requirement, which is why the "
                 "identity partition is kept separate from the rhyme one"
                 if pairs else " — this scheme states rhyme only"))
        for a, b, lab in pairs:
            print(f"    {lab}: L{a} == L{b}")
        if len(args) > 2:
            lines = load_lyric_lines(args[2])
            print(f"  checked against {args[2]}: {len(lines)} line(s) vs "
                  f"{sch.n_lines} declared")
            bad = sch.check_identity(lines)
            if not bad:
                print("  every declared refrain returned VERBATIM")
            for lab, i, j, kind, msg in bad:
                print(f"  [{kind}] {msg}")

    elif cmd == "readability":
        from quality import readability as RD
        lines = RD.read_lines(args[1])
        rep = RD.report(lex, lines)
        for f in rep["findings"]:
            print(f"  [{f.severity.upper()}] {f.code}: {f.message}")
            if f.evidence:
                print(f"      {f.evidence}")
        # THREE COUNTS, and they were never being printed: this line read
        # `refusals {len(rep.get('refusals', []))}` and `report()` has no
        # `refusals` key, so the verb printed `refusals 0` on every text it
        # has ever been run on -- including a Barnes file where 2,401 of
        # 16,179 line ends are refusals. Doctrine 79's own rule broken in the
        # rendering of the module that exists to enforce it.
        n = rep["lines_countable"]
        ref = rep["lines_unreadable_final"]
        print(f"  countable line ends {n}   read {n - ref}   REFUSED {ref}"
              f"   ({ref / n:.2%})" if n else f"  countable line ends 0")
        print(f"    by cause: {rep['lines_unreadable_final_token']} the whole "
              f"end word, {rep['lines_unreadable_final_piece']} the LAST "
              f"piece of a compound")
        # AND WITH `--fallback` DECLARED, THE TWO LINES ABOVE ARE NOT ENOUGH.
        # "read" there means "the harness produced phones", and once a
        # fallback is consulted that silently becomes "produced OR INVENTED
        # phones". On corpus/song/eng_hall_william_barnes.txt the line-end
        # refusals fall 2298 -> 476 at `--fallback=low` and the word-token
        # refusal rate falls 18.29% -> 5.26%, and 8,784 of the readings that
        # bought that fall came from the LETTER layer, whose phones no
        # dictionary entry supplied -- which quality/test_g2p.py §10 measures
        # as answering Shakespeare's own real refusals wrong 50.0% of the
        # time against 5.1% for the derived layers, 9.8x, which is why `high`
        # is the shipped default. The falling rate is the only thing this
        # verb has ever printed. The middle column is what it cost, and
        # doctrine 79 says the two are never one number.
        #
        # WHY THE MIDDLE COLUMN IS THE DERIVATION, AND NOT AN ARTIFACT OF
        # WHICH SHIM `Fallback` HAPPENS TO BE BUILT OVER. `Lexicon.__init__`
        # wraps `_DictionaryOnlyLexicon` -- bare `entries`, none of
        # `transcribe_word`'s own `-s`/`'d`/`in'` reductions -- and it has to,
        # because `Fallback.read` calls back into `transcribe_word` and the
        # real object would recurse. Counting against THAT boundary would
        # charge every plural and every `crown'd` to the fallback: readings
        # this harness already had before anyone declared one, reported as
        # derivations, and the middle column would then be measuring the
        # recursion guard rather than the flag. `lexicon_three_counts` does
        # not use the shim. It counts against `quality.g2p._NoFallbackView`,
        # which runs THIS class's `transcribe_word` with `g2p_fallback` set
        # to None -- so column one is exactly what this Lexicon read before
        # the flag, and column two is exactly what the flag added to it.
        #
        # WORD TOKENS, NOT LINE ENDS -- A DIFFERENT POPULATION, WHICH IS WHY
        # THE LABEL SAYS SO AND WHY A SENTENCE IS PRINTED AHEAD OF THE
        # NUMBERS RATHER THAN GLUING THEM TO THE TWO ABOVE. Those two count
        # LINE ENDS as `line_readability` judges them, and it judges a
        # hyphenated compound on its LAST PIECE — `threshing-floor` is READ
        # there because `floor` reads, and `hill-zide` REFUSES there because
        # `zide` does not, neither of them on the token as a whole.
        # `transcribe_word` judges the whole token, so `a-bed` refuses to it
        # while the line ending in it reads above. Measured on the Barnes
        # file with the fallback OFF: 414 line ends are READABLE to the two
        # lines above and REFUSED to these three, every single one of the 414
        # hyphenated (`a-bed`, `Jack-daw`, `Year-clock`), and the reverse
        # direction is 0. So a reader who subtracted one from the other would
        # be measuring the hyphen rule and calling it a fallback effect.
        # AN EXACT REFINEMENT IS NOT AVAILABLE FROM THIS FILE: it needs
        # `quality/readability.py` to expose the LAYER each per-line record
        # was read at, which is that module's to add and is recorded as the
        # follow-up rather than reached across for here.
        if lex.g2p_fallback is not None:
            # `Lexicon.__init__` imported `quality.g2p` to build the very
            # `Fallback` this gate tests for, so passing the gate guarantees
            # the module is already in `sys.modules` and this import is a
            # dict lookup. With no `--fallback` the gate is False, nothing
            # here is imported, tokenized, counted or printed, and the verb
            # is byte-identical to what it was before this block existed.
            from quality.g2p import (format_three_counts,
                                     lexicon_three_counts)
            print("  A DIFFERENT POPULATION FROM THE TWO LINES ABOVE — DO "
                  "NOT SUBTRACT. Those count LINE ENDS, and a hyphenated "
                  "end word is READ there when its LAST PIECE reads; these "
                  "count EVERY WORD TOKEN, and refuse the token whole.")
            _words = [w for _l in lines
                      for w in line_tokens(_l, strip_parens=lex.strip_parens)]
            for _out in format_three_counts(
                    lexicon_three_counts(lex, _words), what="word tokens"):
                print(_out)

    elif cmd in ("brief", "verify", "revise", "song"):
        from quality import loop as LP
        from quality.revise import Reviser
        from quality.schemes import NoMandate
        from quality import schemes as SC
        from quality.revise import (ReviseDeclaration, RHYME_FINDINGS,
                                    draft_fingerprint)

        # `--pursue=CODE,CODE` — WHICH NOTES THE LOOP KEEPS WORKING ON.
        # Omitted, `pursue` is empty and every run reads exactly as it did
        # before this flag existed. `ReviseDeclaration.pursue` carries the
        # argument for why this is a declaration and not a re-typing of
        # `MODAL_RHYME` to a flag.
        _raw = _flag_value(args, "--pursue")
        args = _strip_flag(args, "--pursue")
        _pur = None
        if _raw is not None:
            _pur = [c.strip().upper() for c in _raw.split(",") if c.strip()]
            # A code this loop can never brief is a REFUSAL, not a no-op: a
            # silently-inert coordinate is what `--propose=bogus` and
            # `--fallback=bogus` already refuse to be, and a writer who
            # mistypes one would otherwise be told the draft is clean by a
            # loop that was never looking (doctrine 1/20).
            unknown = [c for c in _pur if c not in RHYME_FINDINGS]
            if unknown:
                _refuse(f"--pursue names {', '.join(unknown)}, which "
                        f"`brief()` cannot offer a candidate field for",
                        detail=["pursuable codes are the ones in "
                                "quality.revise.RHYME_FINDINGS, because those "
                                "are the findings a Brief answers with a "
                                "field: " + ", ".join(sorted(RHYME_FINDINGS)),
                                "a code outside that set would keep the loop "
                                "asking on a line it has no move for, and "
                                "spend every round reaching ROUND_LIMIT."])
        # ONLY `revise` RUNS A LOOP, so only `revise` can pursue anything —
        # FIXED 2026-08-15, and this was MY defect from the commit that added
        # the flag. `pursue` is read by `revise_loop` and by nothing else, so
        # on `brief`/`verify`/`song` it was inert. Worse than inert: the
        # disclosure below printed anyway, telling a caller "the loop keeps
        # asking on a line carrying one" on three verbs that run no loop at
        # all. A silent no-op is doctrine 1; a no-op that ANNOUNCES itself as
        # working is that plus a false statement in the report a writer reads.
        # `--propose` already had exactly this refusal one flag over — "only
        # `revise` runs a proposer" — so the shape was written, and this flag
        # was added to the shared block without it.
        if _pur and cmd != "revise":
            _refuse(f"--pursue={','.join(_pur)} on `{cmd}` — only `revise` "
                    f"runs a loop, and `pursue` is read by `revise_loop` "
                    f"alone",
                    detail=["`brief` reports what it finds and asks for "
                            "nothing; `verify` grades one revision and its "
                            "gate is deliberately UNCHANGED by pursuit; "
                            "`song` runs no loop. On all three this flag "
                            "would change no output.",
                            "run `revise FILE MANDATE --pursue=...` instead."])
        rdecl = ReviseDeclaration(pursue=frozenset(_pur)) if _pur else None
        rv = Reviser(lex=lex, decl=decl, rdecl=rdecl)
        if _pur:
            print(f"  PURSUING {len(_pur)} note code(s) beyond the flags: "
                  f"{', '.join(sorted(_pur))} — the loop keeps asking on a "
                  f"line carrying one, and `verify()` is UNCHANGED: it still "
                  f"gates on new FLAGS alone, so a pursued note can ask for a "
                  f"revision and still cannot reject one (doctrine 6/7)")

        # `--blueprint=`/`--subdivision`/`--isochronous`: THE SAME THREE
        # DECLARED COORDINATES the `fit` verb already reads, wired here for
        # the first time. `Reviser.brief`/`.verify` and `revise_loop` have
        # taken `blueprint=`/`subdivision=`/`assume=` since the meter and
        # song-function layers were folded into their finding set -- but
        # nothing on this command line could ever hand them one, so every
        # run through here was rhyme-and-floor only, silently, no matter
        # what the Python API supported. Omit `--blueprint` and nothing
        # changes; these three verbs behave exactly as they did before this
        # existed.
        from quality import fit as FT
        bp_path = _flag_value(args, "--blueprint", eq_only=True)
        # `--profile` — THE COMPARATOR EVERY SCORE BELOW IS READ UNDER, and
        # it was reachable on `scheme` and on nothing else — WIRED 2026-08-15.
        # `Reviser.brief`, `.verify` and `revise_loop` have ALL taken
        # `profile=` since they were written, and `_matrix` forwards it to
        # `best_score` — the same parameter `scheme --profile` rebinds. No
        # CLI spelling reached any of the four verbs that grade a draft, so
        # the one flag that changes what every number MEANS was API-only.
        # `revise` printed the coordinate anyway (`COMPARATOR: profile=
        # declared default`), which is a report naming a setting its own
        # caller could not set. Same shape as `--blueprint` before
        # 2026-08-11: built, tested, and unreachable.
        rv_profile = _flag_value(args, "--profile")
        if rv_profile is not None:
            _value_in_vocabulary_or_refuse(
                "--profile", rv_profile, PROFILES,
                "The profile rebinds the CHANNEL WEIGHTS every score in this "
                "report is computed under, so an unrecognised name cannot "
                "fall through to the default ones -- that is a silent "
                "comparator substitution (doctrine 1).")
        sub_arg = _flag_value(args, "--subdivision")
        subdivision = _subdivision_or_refuse(
            FT, sub_arg,
            "lyric_harness.py brief/verify/revise --subdivision, an "
            "explicit decision by whoever ran the command")
        # THE SAME `=`-SPELLING HOLE `fit` HAD, on the same flag, three verbs
        # wide: `--isochronous=true` was stripped from `args` by the
        # `_FLAG_NAMES` pass below (its base matches) and then read by
        # `"--isochronous" in args` as absent, so the assumption was consumed
        # and dropped in one pass.
        assume = FT.Isochrony(
            source="lyric_harness.py brief/verify/revise --isochronous, an "
                   "explicit assumption by whoever ran the command") \
            if _bare_flag_or_refuse(
                args, "--isochronous",
                "that the pulses are evenly spaced in time (there is no "
                "audio and no tempo here, so isochrony is an ASSUMPTION and "
                "never a measurement)") else None

        # A METER COORDINATE DECLARED WITH NO METER TO CHECK — 2026-08-15.
        # `--subdivision`/`--isochronous` are coordinates OF THE METER LAYER,
        # and meter rides `--blueprint`. Given without one they were accepted,
        # consumed, and dropped: MEASURED byte-identical, md5 202b23ce64 for
        # `brief FILE --groups=...` with each of them and without. That is the
        # exact sentence `_no_unknown_flags_or_refuse` refuses on one line
        # up -- a flag silently not read leaves a report that looks like one
        # you never asked for -- so the answer is the same one.
        # AND `song` DECLARES ITS BLUEPRINT POSITIONALLY, so the predicate is
        # "no blueprint reaches the meter layer", NOT "no `--blueprint=` was
        # typed". Asking the narrower question refused `song BP LYRIC
        # --subdivision N` -- a command whose blueprint is sitting in
        # `args[1]` -- on the one verb of the four that always has one. Caught
        # by the battery, not by the check that shipped with the guard: §29
        # tested `song --blueprint=` and never tested `song --subdivision`,
        # which is the same "a check that cannot fail" this lane is about,
        # one layer up.
        if (bp_path is None and cmd != "song"
                and (sub_arg is not None or assume is not None)):
            _which = "--subdivision" if sub_arg is not None else "--isochronous"
            _refuse(f"{_which} was declared and no --blueprint was",
                    detail=["it is a coordinate of the METER check, and meter "
                            "is only asked when a blueprint is declared "
                            "(omitting one drops meter AND song-function).",
                            "declare `--blueprint=B` too, or drop the flag: "
                            "leaving it in produces a rhyme-and-floor report "
                            "byte-identical to one that never carried it."])

        # `--propose=stub|replay:PATH|defer:PATH|call:MODULE:FACTORY` — read here with
        # the other three flags and RESOLVED inside the `revise` branch, so a
        # spelling that cannot be honoured refuses AFTER the mandate refusal
        # rather than ahead of it (doctrine 20 again: `revise FILE` with no
        # mandate must
        # print the missing-mandate refusal first, and `quality/test_verbs.py`
        # §6 pins the refusal to line 1).
        #
        # `eq_only`, the same reasoning `--fallback` records: `stub`,
        # `replay:PATH` and `call:M:F` are all bare words and `--propose
        # replay:x FILE.txt` would give a following-token reader nothing to
        # distinguish a value from a filename.
        #
        # REFUSED ON THE OTHER THREE VERBS RATHER THAN IGNORED. `brief`,
        # `verify` and `song` do not run a proposer at all — they grade a
        # draft that already exists — so accepting the flag there and doing
        # nothing with it would be a silent no-op on a flag whose entire
        # subject is who wrote the words. That is the "silent downgrade"
        # this flag's own shape exists to refuse.
        propose_spec = _flag_value(args, "--propose", eq_only=True)
        if propose_spec is not None and cmd != "revise":
            _refuse(f"--propose={propose_spec} on `{cmd}` — only `revise` "
                    f"runs a proposer",
                    detail=[f"`{cmd}` grades a draft it is handed; nothing in it "
                     f"writes a line, so this flag would have had no effect "
                     f"and saying so is the point (it is not ignored)",
                     "`revise FILE MANDATE --propose=...` is the verb that "
                     "drives quality/loop.py"])
        propose_spec = propose_spec or "stub"
        song_counts = None

        # WHICH FILE IS WHICH — doctrine 79, and the half of the refusal only
        # this frame can supply. `quality/revise.py`'s message carries both
        # COUNTS ("blueprint declares 16 line(s), 4 were handed to the loop")
        # and neither PATH, correctly: it is a library, it was handed a list
        # of strings and a blueprint object, and it was never told what the
        # command line called them. A caller fixes a count mismatch by editing
        # one of two files and has to be told WHICH TWO, so the paths are
        # collected here as each verb reads its own arguments and printed
        # under the refusal. Order matters and is the message's own: the side
        # that DECLARES first, the side that was HANDED IN after it.
        sides = []
        if bp_path:
            sides.append(("DECLARED  --blueprint=", bp_path))

        def _say_blueprint():
            """Printed only once a mandate spec is known to be present —
            with NO mandate this verb REFUSES immediately (doctrine 20) and
            that refusal has to be the FIRST thing printed, not buried under
            a disclosure about a layer that was never going to run either
            way (`quality/test_verbs.py` pins the refusal to line 1)."""
            if bp_path:
                # BOTH METER COORDINATES, NOT ONE — 2026-08-16. This banner
                # named `subdivision` in both states (declared, or refusing to
                # assume one) and said NOTHING about isochrony in either, so a
                # reader saw one meter coordinate disclosed and reasonably
                # read that as the set. It is not: `--isochronous` is the
                # OTHER one, and it moves the finding set. MEASURED on
                # `brief` over `quality/fixtures/song.txt` + the shipped
                # blueprint at subdivision 2 — it REMOVES the `NO_SETTING`
                # refusal and ADDS `EVEN_DIVISION_LANDINGS` and four
                # `TUPLET_REQUIRED`.
                #
                # AND `verify` IS WHY THIS IS A DISCLOSURE AND NOT A LOG LINE.
                # `verify` prints a verdict plus fixed/broken/untargeted/
                # modal_taken — a SET DIFFERENCE — and this flag moves the
                # BEFORE and AFTER drafts identically, so every finding it
                # adds or removes cancels. Measured byte-identical with and
                # without on a real pair where `--subdivision 2` DOES change
                # the verdict body, which is the positive control that the
                # plumbing works. So on this one verb the coordinate was READ,
                # was CHANGING the analysis, and could not be seen at all in
                # the output: not inert, and not visible either. Naming it
                # here is what makes the two runs distinguishable, and it is
                # doctrine 1 — an analysis states the coordinates it was run
                # under, including the ones whose effect cancels.
                print(f"  BLUEPRINT: {bp_path} — meter and song-function "
                      f"join the rhyme/floor finding set"
                      + (f", subdivision={sub_arg}" if sub_arg else
                         ", NO SUBDIVISION DECLARED — the slot questions "
                         "refuse rather than assume one")
                      + (", ISOCHRONY ASSUMED — units evenly spaced across "
                         "the span, a declared assumption and never a "
                         "measurement (doctrine 4); every setting verdict "
                         "below is conditional on it"
                         if assume is not None else
                         ", no isochrony assumed — the setting questions "
                         "refuse (`NO_SETTING`) rather than divide the span "
                         "evenly on their own"))
            else:
                print("  BLUEPRINT: none declared — meter and song-function "
                      "are NOT asked; only rhyme and the slop floor are "
                      "(doctrine 20: this is a refusal on those two layers, "
                      "not evidence they are clean)")

        # `verify`'s [MANDATE] [lines] are POSITIONAL (`args[3]`, `args[4]`),
        # so a trailing `--blueprint=...` has to be pulled out of `args`
        # before that indexing runs, or it would be read as the targeted-
        # line spec instead of a flag. Consumed here, once, for all four
        # verbs sharing this branch. (`song`'s own blueprint is its OWN
        # positional argument, not `--blueprint=` -- see its branch below --
        # but it can still take `--subdivision`/`--isochronous` as trailing
        # flags, so it shares this same stripping pass.)
        _FLAG_NAMES = ("--blueprint", "--profile", "--subdivision",
                       "--isochronous", "--propose")
        #: The flags with NO following value to eat. `--isochronous` is a bare
        #: presence flag; `--propose` is `=`-only for the reason `--fallback`
        #: records (its values are bare words a following-token reader could
        #: not tell from a filename), so a space-separated `--propose stub`
        #: must not silently swallow `stub` and leave the default standing.
        _NO_VALUE = ("--isochronous", "--propose")
        if "--propose" in args:
            _refuse("--propose wants the `=` spelling: --propose=stub, "
                    "--propose=replay:PATH, --propose=defer:PATH, "
                    "--propose=call:MODULE:FACTORY",
                    detail=["a space-separated `--propose stub` cannot be told from "
                     "a positional argument that happens to be that word — "
                     "the same reason `--fallback` is `=`-only, and it is a "
                     "refusal rather than a swallowed token because the "
                     "swallowed token would leave the DEFAULT proposer "
                     "running under a command line that asked for another"])
        args, _skip = list(args), False
        cleaned = []
        for a in args:
            if _skip:
                _skip = False
                continue
            base = a.split("=", 1)[0]
            if base in _FLAG_NAMES:
                if "=" not in a and base not in _NO_VALUE:
                    _skip = True          # space-separated form: eat the value
                continue
            cleaned.append(a)
        args = cleaned

        # AND NOW REFUSE WHAT IS LEFT — 2026-08-15. Everything these four
        # verbs declare has been consumed above (`--blueprint`,
        # `--subdivision`, `--isochronous`, `--propose` here; `--pursue`
        # earlier; `--fallback`/`--voices` before any verb dispatched), so any
        # token still starting with `-` and not a mandate spelling is a flag
        # nobody read.
        #
        # `_no_unknown_flags_or_refuse` HAS EXISTED SINCE `--isochronus` was
        # caught in `fit`, and `fit` was its ONLY caller — one verb of 28.
        # Import reachability is not invocation reachability, at the guard
        # written for exactly this. What it cost on these four, MEASURED at
        # a3536ce by md5-ing the reports:
        #
        #   revise ... --propse=defer:PATH   BYTE-IDENTICAL to no flag at all,
        #     exit 0, no pending file, and THE STUB WROTE THE SONG. The
        #     deferred loop is the gate that refuses to advance without a
        #     writer; one missing letter selected a word-splicer instead, and
        #     nothing in the output said which had run.
        #   brief ... --blueprnt=BP          BYTE-IDENTICAL to no blueprint:
        #     meter AND song-function silently not asked, while the report's
        #     own disclosure line printed "BLUEPRINT: none declared".
        #   song ... --isochronus            BYTE-IDENTICAL, exit 3, on the
        #     verb a pipeline gates on.
        #
        # A near-miss spelling producing the SAME BYTES as omitting the flag
        # is the worst available shape: there is nothing to notice, and the
        # disclosure that would have told you goes on to deny the flag was
        # ever there.
        _no_unknown_flags_or_refuse(
            [a for a in args
             if a.split("=", 1)[0] not in ("--groups", "--returns",
                                           "--cliques", "--structures")],
            ("--blueprint=B", "--profile=" + "|".join(sorted(PROFILES)),
             "--subdivision N", "--isochronous",
             "--propose=stub|replay:PATH|defer:PATH|call:MODULE:FACTORY",
             "--pursue=CODE,CODE", "--groups=", "--returns=", "--cliques",
             "--structures=LABEL:NAME,..."),
            cmd)

        def _mandate_arg(args, at, lines):
            """CLI spelling(s) -> anything `quality.schemes.mandate` accepts.

            `brief FILE ABAB` could only ever name a PARTITION, and the song
            in examples/ has no letter scheme at all — its cliques overlap,
            which doctrine 2 says is a structure with no letter
            representation. These two spellings are the ones a letter string
            cannot express.

            A THIRD GAP, FOUND BY USE RATHER THAN BY READING THE CODE —
            FIXED 2026-08-12. `quality.schemes.mandate`'s `returns=` parameter
            has, since it was written, been the ONLY way to say "these lines
            are the SAME LINE" — REQUIRE_RETURN, identity required, REPEAT is
            the requirement, not a violation (doctrine 3's second half).
            Nothing on this command line could ever reach it: `--groups=`
            builds a bare Cover, which defaults every pair to REQUIRE_RHYME
            (identity FORBIDDEN, REPEAT a violation), and `--cliques` derives
            its groups from OBSERVED rhyme rather than the writer's own
            declared repeat. A song with a verbatim chorus, declared either
            way from the CLI, had its own returning hook charged
            SCHEME_VIOLATION for being exactly identical — the one thing it
            was SUPPOSED to be. `examples/the_well_is_running_dry` hit this
            for real: `song ... --cliques` flagged its three-times-repeated
            chorus, and the fix could only be reached by dropping to the
            Python API and calling `SC.mandate(groups, returns=groups)`
            directly. `--returns=` closes that: same syntax as `--groups=`,
            same 1-based/';'-separated groups, but every group becomes a
            RETURN CLASS instead of a plain rhyme requirement.

            A FOURTH GAP, IN THE READER RATHER THAN IN THE VOCABULARY —
            FOUND BY WRITING A SONG THROUGH THE LOOP, FIXED 2026-08-15. The
            three spellings above were all reachable and only ONE OF THEM WAS
            EVER READ: the mandate came out of a single positional slot, so a
            second spelling on the same command line was never looked at.
            A song with ABAB verses AND a verbatim chorus needs both at once —
            `--groups=` cannot say "identity required" and `--returns=` cannot
            say "these merely rhyme" — and that is the ordinary shape of a
            popular song, not a corner case.

            IT FAILED TWO DIFFERENT WAYS, and the quiet one is the bad one.
            `song`/`brief`/`revise` read slot N and DROPPED the rest without a
            word: `song ... --groups=A --returns=B` was measured
            BYTE-IDENTICAL to `song ... --groups=A`, so a declared chorus was
            silently ungraded and the report said nothing. `verify` has a
            trailing line-number positional, so the unread flag reached
            `int()` instead and it refused with `invalid literal for int()
            with base 10: '--returns=1'` — the same defect wearing a crash.
            One coordinate, dropped in silence by three verbs and mis-blamed
            by the fourth; doctrine 1 says a declared coordinate is not
            silently outranked, and doctrine 20 says a refusal has to name its
            own cause.

            NOT COMBINABLE, and these REFUSE rather than pick a winner:
            `--cliques` with anything (it DERIVES its groups from observed
            rhyme, so what a writer additionally declared cannot be layered on
            a cover that was not declared at all — doctrine 14), a letter
            string with anything (a letter is a property of a LINE and cannot
            carry an overlapping return class — doctrine 2), and the same
            spelling handed in twice.

            -> (scheme, tail), where `tail` is the positionals that FOLLOW the
            mandate. It is returned rather than recomputed because removing a
            flag MOVES every positional after it, and `verify`'s targeted line
            numbers are one of them.
            """
            flags, tail = [], []
            for tok in args[at:]:
                if tok == "--cliques":
                    flags.append(("--cliques", None))
                elif tok.startswith("--groups="):
                    flags.append(("--groups=", tok.split("=", 1)[1]))
                elif tok.startswith("--returns="):
                    flags.append(("--returns=", tok.split("=", 1)[1]))
                elif tok.startswith("--structures="):
                    flags.append(("--structures=", tok.split("=", 1)[1]))
                else:
                    tail.append(tok)

            names = [n for n, _ in flags]
            if len(names) != len(set(names)):
                _refuse("the same mandate spelling was handed in more than "
                        "once, and this reader will not choose between them",
                        detail=[f"handed in: {' '.join(names)}"])
            if "--cliques" in names and len(flags) > 1:
                _refuse("--cliques cannot be combined with another mandate "
                        "spelling",
                        detail=["--cliques DERIVES its groups from the song's "
                                "own rhyme graph (source=derived, doctrine "
                                "14), so it is not a declaration another one "
                                "can be layered onto.",
                                "declare the whole mandate with --groups= "
                                "and/or --returns=, or hand in --cliques "
                                "alone."])
            if flags and not names:              # unreachable; keeps the pair honest
                _refuse("mandate flags were found and none was named")

            def _groups(raw):
                # 1-based, ';'-separated, MAY OVERLAP
                return [[int(x) for x in g.split(",") if x.strip()]
                        for g in raw.split(";") if g.strip()]

            def _structs(raw):
                # --structures=B:kalevala-alliteration,A:qafiya — a group
                # LABEL (A, B, ...) or a 1-based group index, a colon, and
                # a catalog row name or world alias. SHIPPED BY THE
                # KALEVALA ADOPTION (2026-08-18): the registration deferred
                # this spelling to the first calibration on purpose, and
                # that calibration adopted. Validation is the catalog's —
                # an unknown name refuses through `_normalise_structures`
                # as NoMandate, naming the vocabulary's size.
                out = {}
                for part in raw.split(","):
                    part = part.strip()
                    if not part:
                        continue
                    if ":" not in part:
                        _refuse(f"--structures entry {part!r} has no ':' — "
                                f"the spelling is LABEL:NAME (group label "
                                f"or 1-based index, then a catalog row "
                                f"name or alias)")
                    key, name = part.split(":", 1)
                    key = key.strip()
                    out[int(key) - 1 if key.isdigit() else key] = name.strip()
                return out

            by = dict(flags)
            if not flags:
                # No flag: the mandate is the FIRST positional, as it always
                # was — a letter string, or None so the refusal can fire.
                spec = tail[0] if tail else None
                return spec, tail[1:]
            if "--cliques" in by:
                # The song's OWN structure. `mandate_from_graph` marks it
                # source="derived", so the brief says out loud that its groups
                # band-pass BY CONSTRUCTION (doctrine 14).
                return rv.mandate_from_graph(lines), tail
            st = _structs(by["--structures="]) if "--structures=" in by \
                else None
            if tail and not tail[0].lstrip("-").replace(",", "").isdigit():
                if set(by) == {"--structures="}:
                    # A letter string WITH --structures= is expressible and
                    # NOT the conflict the refusal below closes: the letter
                    # fully determines the cover and its labels, and
                    # `structures` ANNOTATES those groups rather than
                    # declaring new ones. Built here because
                    # `Reviser.mandate()` forwards no structures= of its own
                    # — the same reason the returns spelling builds early.
                    return (SC.mandate(tail[0], n_lines=len(lines),
                                       structures=st), tail[1:])
                # A letter string BESIDE a flag. Refused rather than ignored:
                # silently dropping it is the very defect this block closes.
                _refuse(f"mandate {tail[0]!r} was handed in beside "
                        f"{' '.join(names)}, and a letter scheme cannot be "
                        f"combined with either",
                        detail=["a letter is a property of a LINE (doctrine "
                                "2), so it cannot carry an overlapping group "
                                "or a return class.",
                                "spell the whole mandate as --groups= and/or "
                                "--returns=."])

            g = _groups(by["--groups="]) if "--groups=" in by else []
            r = _groups(by["--returns="]) if "--returns=" in by else []
            if st is not None and not (g or r):
                _refuse("--structures= was handed in with no groups to "
                        "annotate — declare the mandate it speaks about "
                        "(a letter scheme, --groups= and/or --returns=)")
            # `--returns=` groups are REQUIRE_RETURN — identity REQUIRED,
            # REPEAT is the requirement and not a violation (doctrine 3's
            # second half). `--groups=` groups are plain REQUIRE_RHYME. Both
            # go into ONE cover with `returns=` naming which of them are the
            # return classes, because a Mandate is the only object that can
            # hold two different requirement kinds at once, and
            # `Reviser.mandate()` forwards no `returns=` of its own.
            if r:
                return (SC.mandate(g + r, n_lines=len(lines), returns=r,
                                   structures=st),
                        tail)
            if st is not None:
                # --groups= with --structures=: built here for the same
                # reason the returns branch builds here.
                return SC.mandate(g, n_lines=len(lines), structures=st), tail
            return g, tail                       # --groups= alone, as before

        def _say_derived(m):
            """Doctrine 14, out loud. A cover read off the rhyme graph is
            mutually band-passing BY CONSTRUCTION, so a clean rhyme result
            against it is an identity and not a verdict. `Mandate.describe`
            has said so since it was written; nothing printed it."""
            if not (hasattr(m, "independent") and not m.independent()):
                return
            print(f"  MANDATE: {len(m.groups)} group(s) over {m.n_lines} "
                  f"lines, {len(m.pairs())} mandated pair(s), "
                  f"source={m.source} ({m.origin})")
            print("  NOT INDEPENDENT of the grader (doctrine 14): this cover "
                  "was read off the rhyme graph, so every group band-passes "
                  "BY CONSTRUCTION and a clean rhyme result here is an "
                  "identity. What it can still say is everything the band did "
                  "not decide — unreadable lines, REPEAT, the slop floor, and "
                  "the joint field at a pivot.")
            if not m.is_partition():
                print(f"  NO LETTER SCHEME EXISTS: lines "
                      f"{m.overlapping_lines()} are in more than one group, "
                      f"and a letter is a property of a LINE (doctrine 2).")

        def _print_brief_report(lines, scheme, blueprint):
            """`brief`'s own report, factored out so `song` can print the
            identical thing after its own structural pre-check — one report
            format for "what to revise and what is forbidden", not two that
            could drift apart from each other.

            -> {"flags": n, "notes": n, "flagged_lines": [...], ...}. The
            counts are what `song` gates its EXIT CODE on, and they are
            computed from `rv.brief()`'s finding set BEFORE any of the
            rendering below runs: a rollup, an ordering or a heading may
            never move a verdict (doctrine 91 — a count is a coordinate of
            the rendering, so the rendering must not be a coordinate of the
            count).

            THREE SECTIONS, IN THIS ORDER, AND THE ORDER IS THE FIX. A real
            16-line run printed 91 findings over 208 lines with the three
            actionable `REPEAT_IN_VERSE` flags at output lines 45, 61 and
            177 — scattered through 48 correct, long, near-identical
            evidence paragraphs about a declared grid being one fact too
            tight. Nothing here drops a finding; what changes is which of
            them a reader reaches first (measured after: all four flag
            decisions inside one six-line block at output line 19).

              ROLLED UP     the codes that fire on (nearly) every line, one
                            row each, with their own count and every line
                            named (`rollup_findings`, above).
              WHAT TO CHANGE  the FLAG inventory, one line per decision, no
                            evidence. This is the part a writer acts on.
              THE EVIDENCE  everything not rolled up, in full, flagged lines
                            first — the paragraphs that used to be first.
            """
            briefs = rv.brief(lines, scheme, blueprint=blueprint,
                              subdivision=subdivision, assume=assume,
                              profile=rv_profile)
            # WHAT WAS GRADED, printed the moment the grader has read it and
            # BEFORE any render path forks — the early returns below include
            # `nothing flagged`, which is precisely the report a wrong draft
            # must not produce anonymously. A run that REFUSES never reaches
            # this line, and that is right: a refusal names its own cause,
            # while a successful report used to name nothing about its
            # input, so a same-length wrong draft was indistinguishable on
            # the page (`quality.revise.draft_fingerprint`'s docstring
            # records the day that cost a false repin).
            print(f"  draft: {len(lines)} line(s), md5 "
                  f"{draft_fingerprint(lines)}")
            # THE WHOLE-DRAFT HALF OF THE SAME FINDING SET. `inspect()`
            # returns `per_line` AND `whole`; `brief()` is built from
            # `per_line` only, because a `Brief` carries a `line_no`,
            # `candidates` and `must_answer` and a finding that names no
            # line does not fit inside one. So every whole-draft finding
            # this run computed was DISCARDED HERE, silently, on `brief`
            # and on `song` both -- including the only FLAG the
            # song-function layer has (`HOOK_ABSENT`), the six
            # `grid.stanza_lock` shape codes, and `LEXICAL_MONOTONY`.
            # Measured on `quality/fixtures/song.txt` with a blueprint
            # declaring an absent hook: `inspect()` put 10 findings in
            # `whole` and this report printed 0 of them, while the banner
            # above said "meter and song-function join the rhyme/floor
            # finding set" -- true of the SET, false of the report.
            #
            # THE FIX IS IN THE REPORT, NOT IN `brief()`, and the
            # precedent is `quality/loop.py`'s: `revise_loop` has the
            # identical problem one layer up (its stop conditions read
            # `brief()` and so cannot see a whole-draft flag either) and
            # does NOT fabricate a line number to smuggle one into a
            # `Brief` -- it SURFACES them separately, as
            # `LoopResult.whole`/`.whole_flags`, printed under the stop
            # reason by `LoopResult.disclosure()`. Same move here, on the
            # same grounds: the per-line half stays per-line, and the
            # thing that names no line is printed as what it is.
            #
            # The second `inspect()` is what `Reviser.report()` already
            # does for exactly this reason. It is not a second grading
            # pass in any measurable sense: `_matrix`/`_field_cache` are
            # warm from the `brief()` call above, measured at 0.02s
            # against that call's 11.4s on the 16-line fixture.
            found = rv.inspect(lines, scheme, profile=rv_profile,
                               blueprint=blueprint,
                               subdivision=subdivision, assume=assume)
            whole = dedupe_findings(found["whole"])
            # THE SPANS THAT PRODUCED EACH FAILING NUMBER, beside it.
            # BACKLOG 1.2's acceptance names `brief` as well as
            # `check_scheme`, and a brief is where the misattribution
            # costs most: it tells a writer WHICH WORD to change, and if
            # the number came from `enjoys it` the word to change is not
            # `it`. Read off `grade`'s own cached matrix -- the same
            # `Scored` objects it graded, never a second comparison. The
            # proper home for this is a `spans` field on the verdict
            # dict, which lives in `quality/revise.py` and is filed as a
            # patch; this reads the object rather than recomputing it, so
            # the two cannot disagree, and it degrades to silence rather
            # than raising if that file is refactored underneath it.
            span_by_pair = {}
            try:
                graded = rv.grade(lines, scheme)
                _, _, _, mx = rv._matrix(lines)
                for v in graded["violations"]:
                    i, j = v["lines"]
                    s = mx[i - 1][j - 1]
                    span_by_pair[(i, j)] = (v, s)
            except Exception:                # pragma: no cover
                span_by_pair = {}
            whole_flags = [f for f in whole
                           if getattr(f, "severity", "") == "flag"]
            # THE COUNTS ARE TAKEN HERE, off the finding set, BEFORE a single
            # line of the rendering below runs. `song` gates its exit code on
            # them, and a rollup that collapsed 48 findings into 3 rows must
            # not move a verdict by one (doctrine 91: a count is a coordinate
            # of the rendering, so the rendering may not be a coordinate of
            # the count).
            groups, rolled = rollup_findings(briefs)
            n_flag = sum(len(v) for (_c, sev), v in groups.items()
                         if sev == "flag")
            n_note = sum(len(v) for (_c, sev), v in groups.items()
                         if sev != "flag")
            rolled_n = sum(len(groups[k]) for k in rolled)
            flagged_lines = sorted({ln for (_c, sev), items in groups.items()
                                    if sev == "flag" for ln, _f in items})

            def _counts():
                """The report's own arithmetic, handed to the caller.

                `flags` and `whole_flags` are SEPARATE and are never added
                together here (doctrine 79): one names lines and one cannot,
                and `song` says both out loud rather than a sum when it
                chooses its exit code.
                """
                return {"briefed": len(briefs), "flags": n_flag,
                        "notes": n_note, "flagged_lines": flagged_lines,
                        "rolled_codes": len(rolled),
                        "rolled_findings": rolled_n,
                        "whole": len(whole), "whole_flags": len(whole_flags)}

            def _print_whole():
                """BELOW the per-line half on purpose: `inspect()`'s own
                NEAR_COLLISION evidence ends "See the whole-draft note
                below", and until now there was no below to see.

                A closure rather than a block at the end of the function
                because three paths reach it — no briefs at all, briefs with
                nothing left to print, and the ordinary report — and a fourth
                copy of the same paragraph is what doctrine 1 forbids.
                """
                if not whole:
                    return
                print(f"\n  WHOLE DRAFT — {len(whole)} finding(s) that name "
                      f"no single line, {len(whole_flags)} of them FLAG(S)")
                print("      Not a line to revise, and not covered by the "
                      "per-line half above: these are properties of the "
                      "ITEM (the hook, the shape of the grid, the "
                      "vocabulary across the whole draft), so there is no "
                      "line_no to hand back and no candidate field to "
                      "offer. `verify()` DOES read them — its diff covers "
                      "`whole` as well as `per_line` — so a whole-draft "
                      "flag can REJECT a revision and can never ASK for "
                      "one. Disclosed here for the same reason "
                      "`quality/loop.py` discloses them under a SUCCESS: a "
                      "silent one reads exactly like a clean draft.")
                for f in whole:
                    loc = (f" (lines {', '.join(map(str, f.locations))})"
                           if f.locations else "")
                    print(f"      FINDING [{f.severity.upper():4}] "
                          f"{f.code}: {f.message}{loc}")
                    print(f"         {f.evidence}")

            # "nothing flagged" is now gated on BOTH halves. It used to be
            # printed on a draft carrying a whole-draft FLAG, which is the
            # worst reading this report can give: not a missing line, an
            # affirmative all-clear over a defect the same run had found.
            if not briefs and not whole:
                print("  nothing flagged — every mandated pair passes the "
                      "band on the lines the harness could read")
                return _counts()
            if not briefs:
                print("  no LINE is flagged — every mandated pair passes the "
                      "band on the lines the harness could read. The "
                      "whole-draft findings below are not about one line and "
                      "are not covered by that sentence")
                _print_whole()
                return _counts()

            # THE HEADLINE, AND IT IS COUNTS BY KIND RATHER THAN ONE TOTAL.
            # Flags and notes are not added together anywhere in this report:
            # they ask different things of a writer (a flag is a defect, a
            # note is a measurement handed back), and doctrine 79's whole
            # subject is what a summed numerator hides. The whole-draft half
            # is a THIRD count and is not folded into either — it names no
            # line, so it cannot be a per-line total.
            print(f"  REPORT: {len(briefs)} line(s) briefed — "
                  f"{n_flag} FLAG, {n_note} NOTE (two counts, never summed: "
                  f"doctrine 79)"
                  + (f"; {len(whole)} WHOLE-DRAFT finding(s), "
                     f"{len(whole_flags)} of them FLAG(S), below"
                     if whole else ""))
            if rolled:
                print(f"          {len(rolled)} code(s) covering "
                      f"{rolled_n} finding(s) are ROLLED UP below, and "
                      f"{n_flag + n_note - rolled_n} print in full. Nothing "
                      f"is dropped — a rolled code names every line it "
                      f"fired on and carries its own count")
                print(f"          ROLLUP RULE (declared: "
                      f"lyric_harness.ROLLUP_SATURATION"
                      f"/ROLLUP_MIN_LINES): a code on >= "
                      f"{ROLLUP_SATURATION:.0%} of the briefed lines, or one "
                      f"whose text is IDENTICAL everywhere it fires; either "
                      f"way >= {ROLLUP_MIN_LINES} lines")

                print("\n  ROLLED UP — one fact about the DRAFT, said once")
                for key in groups:
                    if key not in rolled:
                        continue
                    code, sev = key
                    items = groups[key]
                    ls = sorted({ln for ln, _ in items})
                    f0 = items[0][1]
                    print(f"    [{sev.upper():4}] {code}  x{len(items)} on "
                          f"{line_range(ls)} ({len(ls)} of {len(briefs)} "
                          f"briefed line(s), {rolled[key]}): "
                          f"{getattr(f0, 'message', '')}")
                    ev = getattr(f0, "evidence", "")
                    if ev and rolled[key] == "identical":
                        print(f"           the SAME text on every one, so it "
                              f"is one measurement: {ev}")
                    elif ev:
                        print(f"           L{items[0][0]}, as the sample "
                              f"(the other {len(ls) - 1} differ only in "
                              f"their numbers): {ev}")

            # WHAT A WRITER ACTS ON, AHEAD OF WHY. Flags only, one row each,
            # no evidence — the evidence is correct and long and was what
            # buried this. A rolled-up code is ONE decision here however many
            # lines it fired on, which is the honest count: a grid that is
            # too tight for all sixteen lines is one thing to change.
            #
            # THE WHOLE-DRAFT FLAGS ARE IN THIS INVENTORY TOO, and marked as
            # naming no line. They are the half `brief()` structurally cannot
            # carry, and `verify()` reads them — a whole-draft flag can
            # REJECT a revision — so leaving them out of the one list headed
            # "what to change" would be the same silence this section was
            # written to end, one layer over.
            decisions = []
            for key in groups:
                code, sev = key
                if sev != "flag":
                    continue
                items = groups[key]
                ls = sorted({ln for ln, _ in items})
                if key in rolled:
                    decisions.append(f"{code} — {line_range(ls)} "
                                     f"(x{len(items)}, rolled up above)")
                else:
                    for ln in ls:
                        decisions.append(f"{code} — L{ln}")
            for f in whole_flags:
                decisions.append(f"{getattr(f, 'code', '?')} — WHOLE DRAFT "
                                 f"(names no line; see below)")
            print(f"\n  WHAT TO CHANGE — {len(decisions)} decision(s). "
                  f"Flags only; the notes below are measurements handed "
                  f"back, not defects (doctrine 6)")
            if not decisions:
                print("    nothing on any line, and nothing about the draft "
                      "as a whole, carries a flag. The notes below still say "
                      "what the draft is doing")
            for i, d in enumerate(decisions, 1):
                print(f"    {i}. {d}")

            # THE EVIDENCE, LAST AND UNABRIDGED. Ordered by the lines that
            # carry a flag THIS SECTION still prints — not by `flagged_lines`,
            # which on the measured run is every line in the draft (the
            # saturated `SLOTS_EXCEEDED` is on all sixteen) and would have
            # made "flagged first" mean nothing at all. Inside a line, flags
            # before notes, so the ordering is the same claim at every scale.
            lead = {ln for key, items in groups.items()
                    if key[1] == "flag" and key not in rolled
                    for ln, _f in items}
            order = sorted(briefs,
                           key=lambda b: (b.line_no not in lead, b.line_no))
            blocks = []
            for b in order:
                keep = [f for f in dedupe_findings(b.findings)
                        if (getattr(f, "code", "?"),
                            getattr(f, "severity", "note")) not in rolled]
                keep.sort(key=lambda f: getattr(f, "severity", "") != "flag")
                spans = [(i, j) for (i, j) in span_by_pair
                         if b.line_no in (i, j)]
                apparatus = (b.must_answer or b.joint_conflict
                             or b.must_rhyme_with or b.forbidden_modal
                             or b.forbidden_incumbent or b.candidates)
                if not (keep or spans or apparatus):
                    # Every finding on this line is in a rollup row above,
                    # which named it. Printing the line again with nothing
                    # under it would be the noise this section is fixing.
                    continue
                blocks.append((b, keep, spans))
            if not blocks:
                print("\n  THE EVIDENCE — nothing to print: every finding on "
                      "every briefed line is in a ROLLED UP row above, and "
                      "no line carries a candidate field")
            else:
                print("\n  THE EVIDENCE — every finding not rolled up, in "
                      "full; the lines carrying an un-rolled flag first")
            for b, keep, spans in blocks:
                print(f"  L{b.line_no}: {b.text}")
                for f in keep:
                    print(f"      FINDING {f}")
                for (i, j) in sorted(spans):
                    v, s = span_by_pair[(i, j)]
                    head, *rest = report_pair(
                        s, v["endwords"][0], v["endwords"][1],
                        indent="          ")
                    print(f"      FAILS L{i}-L{j} {head}  — {v['why']}")
                    for ln in rest:
                        print(ln)
                for lab, mem, calls in b.must_answer:
                    shown = ", ".join(f"L{n} ({w!r})" for n, w in calls)
                    print(f"      must answer group {lab} {mem}: {shown}")
                if len(b.must_answer) > 1:
                    print(f"      L{b.line_no} is a PIVOT — in "
                          f"{len(b.must_answer)} groups, and must answer "
                          f"every one (conjunctive; doctrine 2)")
                if b.joint_conflict:
                    print("      NO JOINT CANDIDATE: nothing in the "
                          "lexicon answers all of those groups at once. "
                          "The MANDATE is what needs revising, not the "
                          "line.")
                if not b.must_answer and b.must_rhyme_with:
                    n, w = b.must_rhyme_with
                    print(f"      must rhyme with L{n} ({w!r})")
                # TWO RULES, TWO LINES — split 2026-08-16. This label used to
                # sit over a list that also carried the INCUMBENT, so the word
                # already on the line was announced to a writer as a modal
                # candidate. The `FORBIDDEN (modal` prefix is deliberately
                # byte-identical to what it has always been: `quality/
                # test_verbs.py` §22 scrapes this exact line and compares it
                # to `candidates W n --modal`, and the second line below must
                # NOT match that substring or it would be compared as if it
                # were the modal head.
                if b.forbidden_modal:
                    print(f"      FORBIDDEN (modal — doctrine 9): "
                          f"{', '.join(b.forbidden_modal)}")
                if b.forbidden_incumbent:
                    print(f"      ALREADY THERE (a different rule — "
                          f"re-proposing the end word that is already on "
                          f"this line is not a revision): "
                          f"{b.forbidden_incumbent}")
                if b.candidates:
                    print(f"      offered: {', '.join(b.candidates[:12])}")
            _print_whole()
            return _counts()

        try:
            if cmd == "brief":
                sides.append(("HANDED IN brief's FILE", args[1]))
                lines = load_lyric_lines(args[1])
                scheme, _tail = _mandate_arg(args, 2, lines)
                _say_derived(scheme)
                if scheme is not None:
                    _say_blueprint()
                _print_brief_report(lines, scheme, bp_path)
            elif cmd == "song":
                # `song BLUEPRINT LYRIC [MANDATE]` -- RETIRED the old
                # per-section {"lines","scheme","ref"} schema 2026-08-12.
                # Every blueprint shipped in this repo had already moved to
                # the bar-grid shape (bars/start_bar/meter/function, per-line
                # bar/beat/duration), which that schema could not read at
                # all -- `song` refused by name on every real blueprint in
                # `examples/`, silently, since the rewrite. It now reads the
                # SAME shape and runs the SAME Reviser pipeline `brief` does,
                # plus one thing `brief` has no reason to do: cross-check the
                # LYRIC'S OWN `[Section]` markers against what the blueprint
                # declares. The two can drift independently -- a verse added
                # to the words and not the blueprint, or the reverse.
                from quality import grid as GR
                # `song --blueprint=X` WAS ACCEPTED AND NEVER OPENED —
                # 2026-08-15. This verb's blueprint is its FIRST POSITIONAL,
                # so the flag spelling has nothing to bind to: `bp_path` is
                # parsed above, stripped from `args` by the shared
                # `_FLAG_NAMES` pass, and never read here. MEASURED, with a
                # path that does not exist: byte-identical to omitting the
                # flag, exit 3 either way. A caller who names a blueprint and
                # is graded against a different one is the worst available
                # outcome for a declared coordinate (doctrine 1).
                if bp_path is not None:
                    _refuse(f"song takes its blueprint as the FIRST "
                            f"POSITIONAL, not as --blueprint=; got "
                            f"{bp_path!r} beside {args[1]!r}",
                            sides=[("DECLARED by --blueprint=", bp_path),
                                   ("DECLARED positionally", args[1])],
                            detail=["usage: song BLUEPRINT LYRIC [MANDATE] "
                                    "[--subdivision N] [--isochronous]",
                                    "the flag was accepted and never opened, "
                                    "so the two spellings disagreeing was "
                                    "silent."])
                song_bp_path = args[1]
                sides.append(("DECLARED  song's BLUEPRINT", song_bp_path))
                sides.append(("HANDED IN song's LYRIC", args[2]))
                # Same locale-dependent decode as the `relations`
                # reader above; this one keeps apparatus on purpose,
                # because `parse_lyric_sections` is looking for the
                # `[Section]` markers `is_apparatus_line` would drop.
                lyric_text = open(args[2], encoding="utf-8").read()
                marked = parse_lyric_sections(lyric_text)
                song_obj, _hooks = GR.song_from_blueprint(song_bp_path)
                # A `--- TITLE:` LINE IN THE LYRIC WAS DROPPED IN SILENCE —
                # 2026-08-15. It is this repo's own item convention:
                # `grid.read_marked_songs` parses it, `audit_corpus` counts
                # `--- TITLE:` blocks as the unit every staged file writes, and
                # `verify_entries` reads it as the rule for what a song IS. On
                # this verb it is apparatus, so `load_lyric_lines` drops it —
                # correctly, it is not sung — and NOTHING ELSE LOOKED AT IT.
                # The title `hook_findings` grades comes from the blueprint's
                # own `"title"` key alone, so a writer who named their song the
                # way the corpus does was graded against a title they never
                # gave. MEASURED: byte-identical, md5 d3ca7fb536, with and
                # without the line. `TITLE_NOT_IN_HOOK` is a real check that
                # fires correctly on a blueprint title — what was broken is
                # which declaration reaches it. `song` hands the blueprint
                # PATH down and the title is re-read from that file, so there
                # is no seam to carry a second one; this REFUSES and names both
                # spellings rather than inventing plumbing or dropping the
                # coordinate, the same answer `song --blueprint=` gets.
                _lyric_title = next(
                    (l[len("--- TITLE:"):].strip()
                     for l in lyric_text.splitlines()
                     if l.startswith("--- TITLE:")), None)
                if _lyric_title:
                    _bp_title = song_obj.title or ""
                    if _bp_title.strip().lower() != _lyric_title.lower():
                        _refuse(
                            f"song grades the title the BLUEPRINT declares, "
                            f"and the lyric declares a different one",
                            sides=[("DECLARED in the lyric  --- TITLE:",
                                    _lyric_title),
                                   ("DECLARED in the blueprint \"title\"",
                                    _bp_title or "(absent)")],
                            detail=["the `--- TITLE:` line is APPARATUS here "
                                    "and is dropped before grading, so it "
                                    "reached no check; put the title in the "
                                    "blueprint's \"title\" key, or drop the "
                                    "line.",
                                    "TITLE_NOT_IN_HOOK reads the blueprint's "
                                    "title only — a second spelling that "
                                    "never arrives is worse than none."])
                # `lines_in(s)` MATCHES BY BAR RANGE, and the section OBJECT is
                # passed rather than its name for the reason that accessor
                # refuses a repeated name in as many words: two sections may
                # share one, and verse/chorus/bridge/chorus is the commonest
                # song form there is. This counted `l.section == s.name` until
                # then, so EACH chorus was charged with BOTH choruses' lines
                # and `chorus: 4 lyric line(s), blueprint places 8` printed
                # TWICE — a cross-check inventing a defect in a blueprint that
                # was right, on the one verb whose job is to compare the two
                # declarations against each other.
                bp_sections = [(s.name, len(song_obj.lines_in(s)))
                               for s in song_obj.sections]
                if len(marked) != len(bp_sections):
                    print(f"  STRUCTURE: lyric has {len(marked)} marked "
                          f"section(s), blueprint declares "
                          f"{len(bp_sections)}")
                else:
                    for (mname, mlines), (bname, bn) in zip(marked,
                                                            bp_sections):
                        if mname.lower() != bname.lower():
                            print(f"  STRUCTURE: marked {mname!r}, "
                                  f"blueprint section is {bname!r}")
                        if len(mlines) != bn:
                            print(f"  STRUCTURE: {mname}: {len(mlines)} "
                                  f"lyric line(s), blueprint places {bn}")
                lines = ([l for _, ls in marked for l in ls] if marked else
                        [l.strip() for l in lyric_text.splitlines()
                         if l.strip() and not is_apparatus_line(l)])
                scheme, _tail = _mandate_arg(args, 3, lines)
                _say_derived(scheme)
                if scheme is not None:
                    print(f"  BLUEPRINT: {song_bp_path} — meter and "
                          f"song-function join the rhyme/floor finding set"
                          + (f", subdivision={sub_arg}" if sub_arg else
                             ", NO SUBDIVISION DECLARED — the slot "
                             "questions refuse rather than assume one"))
                # NO `except ValueError` OF ITS OWN — MOVED OUT 2026-08-13.
                # This call used to be wrapped in a private copy of the
                # refusal that now sits on the shared handler below, and a
                # second copy is exactly what "do not invent a second refusal
                # shape" forbids: `brief`, `verify` and `revise` reach the
                # SAME `Reviser._meter_findings` through the SAME
                # `_print_brief_report`, and three of the four verbs printed
                # a raw traceback where the fourth refused. The private copy
                # was also strictly narrower than it looked — it started
                # AFTER `GR.song_from_blueprint` above, so a blueprint this
                # verb could not parse at all (`Invalid literal for
                # Fraction`, a JSON syntax error) escaped `song` too. One
                # handler, on the try every verb on this branch already
                # shares, covers both.
                song_counts = _print_brief_report(lines, scheme,
                                                  song_bp_path)
            elif cmd == "verify":
                sides.append(("HANDED IN verify's BEFORE", args[1]))
                sides.append(("HANDED IN verify's AFTER", args[2]))
                before = load_lyric_lines(args[1])
                after = load_lyric_lines(args[2])
                scheme, tail = _mandate_arg(args, 3, before)
                _say_derived(scheme)
                if scheme is not None:
                    _say_blueprint()
                    # BOTH SIDES, BEFORE THE VERDICT THAT COMPARES THEM.
                    # `verify` is the one verb whose whole output is a SET
                    # DIFFERENCE, so it is the verb least able to show which
                    # drafts it read — two wrong inputs of the right length
                    # produce a complete verdict block naming neither. The
                    # `HANDED IN` sides above carry the PATHS, and a path is
                    # not an identity: the false collisions-69 repin was made
                    # from a right-shaped run on the wrong content.
                    #
                    # THE GATE IS "A MANDATE WAS DECLARED", NOT "IT BOUND" —
                    # stated precisely because the first draft of this
                    # comment overclaimed. With NO mandate this verb refuses
                    # before reaching here and the refusal is the first
                    # thing printed. With a DECLARED mandate that then fails
                    # to BIND (wrong arity, say), these two lines print and
                    # THEN the refusal — measured: `verify b.txt a.txt AAB`
                    # on 2-line drafts prints BEFORE/AFTER above `REFUSED —
                    # the scheme 'AAB' is 3 characters and the draft is 2
                    # lines`. That ordering is KEPT, not tolerated: an arity
                    # refusal is a claim ABOUT these drafts (3 letters
                    # against THESE 2 lines), so the identity of the drafts
                    # it was measured on belongs above it. `brief` prints no
                    # fingerprint on the identical refusal — its draft line
                    # sits after `rv.brief()`, which raises first — and that
                    # asymmetry is the two verbs' report shapes, not a
                    # drifted rule: `brief`'s refusal names its one draft's
                    # line count itself, while an arity refusal here names a
                    # count from EACH side's file and would otherwise name
                    # neither identity.
                    print(f"  BEFORE: {len(before)} line(s), md5 "
                          f"{draft_fingerprint(before)}")
                    print(f"  AFTER : {len(after)} line(s), md5 "
                          f"{draft_fingerprint(after)}")
                # `tail` and NOT `args[4]`: pulling a mandate flag out moves
                # every positional behind it, and this one is the targeted
                # line list. Reading the raw index is what met `--returns=1`
                # at `int()` and refused in the wrong layer's words.
                targeted = ({int(x) for x in tail[0].split(",")}
                            if tail else None)
                v = rv.verify(before, after, scheme, targeted=targeted,
                              blueprint=bp_path, subdivision=subdivision,
                              assume=assume, profile=rv_profile)
                print(f"  VERDICT: "
                      f"{'ACCEPTED' if v.get('accepted') else 'REJECTED'}")
                for r in v.get("reasons", []):
                    print(f"    {r}")
                # THE KEYS `verify()` ACTUALLY RETURNS — corrected
                # 2026-08-16. This tuple asked for `untargeted` and
                # `modal_taken`, and `Reviser.verify` has never set either:
                # the untargeted case returns early with only a `reasons`
                # string, and the modal list has been `modal_violations`
                # since it was written. So the STRUCTURED half of RULE 3's
                # disclosure was unreachable from the command line while
                # `revise.py`'s own comment argued it was "DISCLOSED, NOT
                # SWALLOWED (doctrine 20)" — true at the API and false here.
                # Found while splitting the modal field, because
                # `modal_endword_unchanged` would have been dropped in
                # exactly the same silence.
                for k in ("fixed", "broken", "new_flags", "new_notes",
                          "modal_violations", "modal_endword_unchanged"):
                    if v.get(k):
                        print(f"    {k}: {v[k]}")

            else:
                # `revise` — quality/loop.py driven end to end. WHO WRITES
                # THE LINE IS `--propose=`, DEFAULTING TO `stub`: the same
                # mechanical single-word splice this verb has always run
                # (quality/loop.py's own docstring — it proves the loop's
                # accept/reject/retry/backtrack/stop control flow and is not
                # a way to get a good line), now one of three declared
                # spellings rather than the only reachable one. See
                # `_resolve_proposer` for why the default may not reach
                # anything outside this process, and why a `call:` that
                # cannot be honoured refuses instead of quietly becoming
                # this.
                sides.append(("HANDED IN revise's FILE", args[1]))
                lines = load_lyric_lines(args[1])
                scheme, _tail = _mandate_arg(args, 2, lines)
                _say_derived(scheme)
                if scheme is not None:
                    _say_blueprint()
                propose, propose_pair, say_proposer = _resolve_proposer(
                    propose_spec)
                # DISCLOSED BEFORE THE RUN AS WELL AS AFTER IT, and the two
                # are the same callable. Which proposer wrote the draft is
                # the first thing a reader of this output needs and the last
                # thing they can reconstruct from it — the same argument
                # `_say_blueprint()` already makes one flag over.
                print(say_proposer())
                try:
                    result = LP.revise_loop(rv, lines, scheme,
                                            blueprint=bp_path,
                                            subdivision=subdivision,
                                            assume=assume,
                                            profile=rv_profile,
                                            propose=propose,
                                            propose_pair=propose_pair)
                except _NeedProposal as need:
                    # EXIT 4 — SUSPENDED, and it is a fourth code for the same
                    # reason `song`'s flag verdict needed a third: 0 is "the
                    # draft is clean", 2 is "the harness could not answer", 1
                    # is Python's own uncaught exception, and 3 is "answered,
                    # and a flag stands". None of those is "answered, and it
                    # is your turn" — a gate that is WAITING is not a gate
                    # that failed, and a caller in a pipeline has to tell a
                    # suspension from a verdict (doctrine 20, one code
                    # further out).
                    path = propose_spec.split(":", 1)[1]
                    with open(path, "w", encoding="utf-8") as fh:
                        json.dump(say_proposer.state, fh, indent=2)
                        fh.write("\n")
                    print(f"\n  SUSPENDED — the loop asked for a "
                          f"{need.kind} it has no answer for, and will not "
                          f"guess one.")
                    print(f"  Written to {path}. Fill `pending.answer`, then "
                          f"run the SAME command again.\n")
                    print(need.prompt)
                    sys.exit(4)
                print(result)
                print(say_proposer(done=True))
                if propose_spec.startswith("defer:"):
                    # The run reached a stop condition, so `pending` is empty
                    # and `answered` is now a COMPLETE record. Written on the
                    # way out for the same reason it is written on suspension:
                    # a state file that only exists while a run is unfinished
                    # would make the replayable artefact the one thing a
                    # finished run does not leave behind.
                    with open(propose_spec.split(":", 1)[1], "w",
                              encoding="utf-8") as fh:
                        json.dump(say_proposer.state, fh, indent=2)
                        fh.write("\n")
                if result.lines != lines:
                    print("\n  FINAL DRAFT:")
                    for i, l in enumerate(result.lines, 1):
                        mark = "*" if l != lines[i - 1] else " "
                        print(f"  {mark} L{i}: {l}")
                # EXIT 3 WHEN ANYTHING ACTIONABLE STANDS — 2026-08-17, the
                # owner's order made a pipeline fact. `revise` used to exit 0
                # on NO_PROGRESS with unresolved lines, so "the loop gave up"
                # was indistinguishable from "the draft is clean" to any
                # caller reading the code and not the prose. 3 already means
                # "answered, and a finding stands" on `song`/`brief`;
                # `result.unresolved` is the union of flagged and pursued, so
                # a pursued note held open to the end is a 3 exactly like a
                # flag.
                if result.unresolved:
                    sys.exit(3)
        except NoMandate as e:
            # Exit 2, not 0. A refusal is not a pass and a caller in a
            # pipeline has to be able to tell them apart; the traceback this
            # replaces said the same thing in six frames of noise.
            #
            # FIRST, and not merely by luck: `NoMandate` IS-A `ValueError`,
            # so this clause has to sit ahead of the one below or every
            # missing mandate would print the generic refusal instead of the
            # one that names what is missing.
            print("  REFUSED — this verb was given nothing to check against.")
            for ln in str(e).splitlines():
                print(f"  {ln}")
            sys.exit(2)
        except ValueError as e:
            # THE SAME REFUSAL, FOR ALL FOUR VERBS — FIXED 2026-08-13. A
            # blueprint whose line count does not match the draft is a
            # DECLARATION MISMATCH, not a crash: `Reviser._meter_findings`
            # correlates blueprint placements to draft lines BY POSITION and
            # raises rather than silently misaligning every line after the
            # first difference, which is the right call and is deliberately
            # worded. Only `song` routed it — it had a private copy of this
            # handler — so `brief FILE MANDATE --blueprint=BP`, `verify` and
            # `revise` printed a raw traceback and exited 1 on the identical
            # user mistake that `song` answered with `REFUSED` and exit 2.
            # Same family as the `candidates` KeyError fixed earlier the same
            # day (a user-facing verb tracebacking where its sibling refuses)
            # except loud rather than silent, and the same remedy: ONE
            # refusal shape, reached by every verb that can provoke it.
            #
            # BROAD ON `ValueError` AND NOT WIDER, ON PURPOSE. It catches the
            # rest of the blueprint-reading family a wrong file provokes —
            # `pulses must be positive`, `groups (3, 3) sum to 6, not 4`,
            # `Invalid literal for Fraction`, and `json.JSONDecodeError`,
            # which is a `ValueError` subclass — all of which are a statement
            # about the FILE the caller named. It deliberately does NOT catch
            # `KeyError`: `KeyError: 'bars'` from a section missing a
            # required field looks identical, at this frame, to
            # `KeyError: 'anchor_syllables'`, which was a REAL defect in this
            # spine and was found precisely because it escaped. Swallowing
            # that class here would hide the next one (doctrine 48's own
            # failure mode, and §12's argument against broad handlers).
            # `_refuse` and not a fourth `print(f"  REFUSED — ...")`: this
            # clause and the `grid`/`fit`/`function` branches above have to
            # print the SAME refusal about the SAME file, and the only way
            # that is guaranteed rather than believed is one printer.
            _refuse(e, sides)

        # ---------------------------------------------------------------
        # `song`'S EXIT CODE — A FLAG IS NOT A REFUSAL AND IT IS NOT A PASS
        #
        # THE DEFECT: a real run reported 19 FLAG findings on 16 lines and
        # exited 0, so nothing in a pipeline could gate on it. `song` is the
        # WHOLE-SONG verb — the one a build step runs — and it answered
        # "there are nineteen things wrong with this" in the same byte a
        # clean song answers with.
        #
        # WHAT THE OTHER VERBS DO, checked before choosing rather than
        # asserted: `brief`, `verify`, `revise` and `song` all exit 2 on a
        # refusal (`NoMandate`, a blueprint/draft length mismatch, an
        # unparseable blueprint) and 0 on absolutely everything else —
        # `verify` prints `VERDICT: REJECTED` and exits 0, `revise` prints
        # `no_progress` and exits 0, `candidates` exits 2 on a word it
        # cannot read, `--fallback=bogus` exits 2. So 2 in this project
        # already means ONE thing, consistently: THE HARNESS DID NOT ANSWER.
        #
        # WHICH IS WHY A FLAG MAY NOT BE 2. A flag is the harness answering
        # — it read the song and found a defect. Charging that to the
        # refusal code would make "sixteen lines overflow their bars"
        # indistinguishable from "no mandate was declared", which is
        # doctrine 20's own collapse ("inconclusive by construction" is not
        # a result) run backwards. And it may not stay 0, because that is
        # the defect. So it is a THIRD code.
        #
        #   0  answered, and nothing carries a flag
        #   1  NOT USED HERE — an uncaught exception is Python's own 1, and
        #      a gate that read 1 as "flags found" would pass a crash
        #   2  REFUSED (doctrine 20): could not answer
        #   3  answered, and at least one FLAG stands
        #
        # BOTH HALVES OF THE FINDING SET COUNT, and the whole-draft half is
        # the one a gate would most easily have lost. `brief()` is built
        # from `inspect()`'s `per_line` half, so a finding that names no
        # line is in no `Brief` — `HOOK_ABSENT` (the song-function layer's
        # ONLY flag), `LEXICAL_MONOTONY`, `FUNCTION_WORD_HEAVY`. `verify()`
        # already reads them and a whole-draft flag can REJECT a revision,
        # so a `song` that exited 0 over one would be certifying a draft the
        # very same run refuses to accept a revision of. THE TWO COUNTS ARE
        # NOT SUMMED (doctrine 79): the message states them separately,
        # because one names lines and the other structurally cannot.
        #
        # SCOPED TO `song`, ON PURPOSE. `brief` is the interactive "what do
        # I fix next" verb and every one of its useful runs has flags; a
        # gate wants the whole-song verb, and moving `brief` in the same
        # commit would silently change an exit code four other cases in
        # `quality/test_verbs.py` assert on. NOTES NEVER MOVE IT: a note is
        # a measurement handed back and doctrine 6 says a convention a
        # writer may depart from cannot be the thing that fails a check.
        # Computed from the finding set, never from the rendering — the
        # rollup above collapses 48 findings into 3 rows and does not move
        # this by one (`quality/test_verbs.py` §15).
        if cmd == "song" and song_counts and (song_counts["flags"]
                                              or song_counts["whole_flags"]):
            per_line = (f"{song_counts['flags']} FLAG finding(s) on "
                        f"{len(song_counts['flagged_lines'])} line(s) "
                        f"{line_range(song_counts['flagged_lines'])}"
                        if song_counts["flags"] else "no per-line FLAG")
            whole_part = (f"{song_counts['whole_flags']} WHOLE-DRAFT FLAG(S) "
                          f"naming no line"
                          if song_counts["whole_flags"] else
                          "no whole-draft FLAG")
            print(f"\n  EXIT 3 — {per_line}; {whole_part}. Two counts, not a "
                  f"sum (doctrine 79): one names lines and the other cannot. "
                  f"Not a refusal (2, doctrine 20: the harness answered) and "
                  f"not a pass (0). {song_counts['notes']} NOTE(s) are "
                  f"reported above and are NOT counted here — a note is a "
                  f"measurement handed back, never a defect (doctrine 6/79)")
            sys.exit(3)

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
        # WAS EXIT 0. An unrecognised verb printed one line and returned
        # SUCCESS, so a pipeline could not tell `lyric_harness.py schme ...`
        # (a typo) from a clean run of a real verb that found nothing -- the
        # same shape of defect the flag values on every verb above had, at
        # the verb level. `--voices=true` reached here too, since the global
        # bare-presence parse did not consume it and it became `cmd`.
        _refuse(f"unknown command {cmd!r}. Run with --help for the verb "
                f"list; `wiring` prints which verb runs on which layer.")


if __name__ == "__main__":
    # ONE FILE, TWO MODULE OBJECTS — and the first thing this branch has to
    # do is stop being two, because an `except` clause below cannot catch a
    # class raised by the other copy.
    #
    # Run as a script this file is `__main__`. Every module under `quality/`
    # does `from lyric_harness import ...`, which finds no `lyric_harness` in
    # `sys.modules`, RE-EXECUTES this whole file under that name, and binds a
    # SECOND, unrelated set of every class and function in it. Two
    # `Lexicon`s, two `Declaration`s, two of everything, differing by
    # identity and by nothing else — which is invisible until identity is
    # what a statement rests on. It rests on it here: `read_lyric_text`
    # reached through `quality/readability.py` raises
    # `lyric_harness.UndecodableLyricFile` and this block catches
    # `__main__.UndecodableLyricFile`, so the refusal added in this same
    # commit was caught for seven verbs and MISSED for the eighth —
    # `readability`, which kept exiting 1 with a traceback whose last line
    # reads `lyric_harness.UndecodableLyricFile: ... not valid UTF-8`. The
    # message was right, the handler was right, and they were about two
    # different classes.
    #
    # `setdefault` rather than assignment, and BEFORE `main()`, which is
    # where every `from quality import ...` happens: any importer arriving
    # afterwards is handed this module instead of re-running the file. It
    # also stops the double execution (47.9ms, `-X importtime`) and collapses
    # the two copies of every module-level cache into the one the CLI is
    # actually using. `setdefault` is not paranoia about a race — it says
    # that if something has ALREADY imported this file under its own name,
    # that copy wins and this branch does not swap it out underneath it.
    sys.modules.setdefault("lyric_harness", sys.modules["__main__"])

    # THE LAST TWO SHAPES THAT STILL REACHED A USER AS A TRACEBACK — FIXED
    # 2026-08-15. Every verb in this file was given ONE refusal shape
    # (`REFUSED — ...`, exit 2) a piece at a time — `candidates` on an OOV
    # word, `--fallback=bogus`, a blueprint/draft length mismatch, `song`'s
    # private handler, `--propose`'s vocabulary — and TWO whole classes were
    # never covered, on any verb, because no single verb owned them.
    # MEASURED at a3536ce, on the shipped file:
    #     $ python3 lyric_harness.py brief                    -> IndexError, 1
    #     $ python3 lyric_harness.py brief missing.txt ABAB   -> FileNotFound, 1
    # Exit 1 is Python's own uncaught exception, so a caller in a pipeline
    # reading 1 as "the harness crashed" was right, and reading it as "my
    # arguments were wrong" had no way to tell (doctrine 20).
    #
    # THEY ARE CAUGHT SEPARATELY AND SAID DIFFERENTLY, because they are not
    # the same fact. A named file that is not there is ALWAYS the caller's —
    # `OSError` carries the filename and the OS's own reason, so the refusal
    # can name both. A missing positional is NOT always the caller's: an
    # `IndexError` from four frames inside a grader is a DEFECT in this file,
    # and a handler that reported it as "you left out an argument" would be
    # collapsing two different things into one message, which is the error
    # doctrine 20 is about. So that refusal states the argument count it
    # actually received AND says plainly that a complete-looking command line
    # reaching it is a bug to report, with the exception carried through.
    #
    # AND `UnicodeDecodeError` IS NEITHER OF THOSE, WHICH IS WHY IT ESCAPED
    # BOTH — added 2026-08-15, after the sweep above was re-run against the
    # file the sweep itself produced. It is a `ValueError`, so `except
    # OSError` never saw it, and it carries no filename, so a clause here
    # could not have named the file even if it had. `UndecodableLyricFile`
    # is raised at `read_lyric_text`, where the path is in scope, and this
    # handler just prints what it was already told.
    try:
        main()
    except UndecodableLyricFile as e:
        _refuse(str(e),
                detail=["this harness reads lyrics and corpora as UTF-8 and "
                        "does NOT substitute a replacement character for a "
                        "byte it cannot decode — a file read that way grades "
                        "as text and reports nothing wrong (doctrine 20).",
                        "if the file is in another encoding, convert it: "
                        "`iconv -f latin1 -t utf-8 FILE > FILE.utf8`."])
    except OSError as e:
        _refuse(f"{e.filename or 'a file this verb was given'} — "
                f"{e.strerror or e}",
                detail=["the path is read relative to the working directory, "
                        "not to any file already handed in."])
    except IndexError as e:
        verb = sys.argv[1] if len(sys.argv) > 1 else "(no verb)"
        n = max(0, len(sys.argv) - 2)
        _refuse(f"{verb} — ran out of arguments at {n} given",
                detail=["`--help` prints every verb's usage line; `wiring` "
                        "prints which verb runs on which layer.",
                        f"IF THE COMMAND LINE WAS COMPLETE this is a DEFECT "
                        f"in lyric_harness.py and not your mistake — the "
                        f"exception was {e!r}. Please report it with the "
                        f"command you ran."])
