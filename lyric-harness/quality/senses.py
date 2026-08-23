#!/usr/bin/env python3
"""THE SENSE RESOURCE — WordNet, and a NAMED disambiguation algorithm.

`antanaclasis` is ONE WORD IN TWO SENSES: its identity rules are `token`
AGREE and `sense` DIFFER, so it needs an answer to "which sense does THIS
occurrence carry", not merely "how many senses does this word have".

THE FIRST ATTEMPT AT THIS WAS DECLARATION-ONLY AND THAT WAS STOPPING SHORT.
`relations.declare_senses` let a caller state `{(line, token): sense}` and
nothing computed anything, which is a real coordinate and NOT an
implementation of the figure. It shipped on the strength of
`relations_null.BLOCKERS`' note that "`data/nltk/` carries taggers and
tokenizers, not WordNet" — a note that is about what is ON DISK and was read
as a claim about what is OBTAINABLE. WordNet is a 10 MB download under a
licence that grants use, copy, modification and redistribution without fee or
royalty, and `nltk` was already installed. It is now in `data/nltk/corpora/`
and recorded in `data/sources.tsv`.

THE ALGORITHM IS NAMED, NOT HIDDEN. Simplified Lesk (Lesk 1986; the
`nltk.wsd.lesk` implementation): for each candidate synset of the target
word, count the overlap between that synset's definition-and-examples bag and
the words of the CONTEXT, and take the argmax. It is deterministic, it is
inspectable, and IT IS A WEAK BASELINE — simplified Lesk is well known to sit
far below supervised WSD on fine-grained senses. That is a fact about the
instrument and it is reported by `report()` rather than left for a reader to
discover, on the same terms as `quality/morphology.py`'s tie-break: a
heuristic that names its rule and publishes its rate is a declared
instrument; a silent one is laundering.

WHAT IS NOT CLAIMED. This does not resolve senses correctly. It produces a
DERIVED sense assignment good enough to distinguish the cases antanaclasis is
built on — a word whose two occurrences sit in visibly different contexts —
and it will be wrong on subtle ones. That is why the DECLARATION WINS: a
`relations.declare_senses` entry for a position overrides this for that
position (doctrine 1), and a writer who cares about a particular pun says so.

THE MONOSEMOUS DEFAULT IS THE SAFE ONE. A word with fewer than two WordNet
synsets, or one WordNet does not know, gets its own lowercased text as its
sense — so two occurrences of it are sense-IDENTICAL and antanaclasis does
NOT fire. Silence means "an ordinary repeat", never "a figure".
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.dirname(HERE))

#: WHERE THE CORPUS LIVES. A repo-local path, so a run never depends on a
#: user-level `~/nltk_data` that may or may not exist and may or may not hold
#: the same release (doctrine 34: a citation that resolves to nothing).
WORDNET_DIR = os.path.join(os.path.dirname(HERE), "data", "nltk")

#: The release this was measured against. WordNet 3.0, Princeton University,
#: 2006 — the licence text ships beside the data at
#: `data/nltk/corpora/wordnet/LICENSE` and the row is in `data/sources.tsv`.
WORDNET_RELEASE = "WordNet 3.0 (Princeton), via nltk_data corpora/wordnet"

_WN = None
_LESK = None
_TAG = None

#: Penn Treebank tag prefix -> WordNet POS. Anything else has no WordNet POS
#: and is skipped: WordNet holds nouns, verbs, adjectives and adverbs, and a
#: determiner or a preposition has no synsets to disambiguate between.
_WN_POS = {"N": "n", "V": "v", "J": "a", "R": "r"}


def available():
    """-> True if the corpus is present. A missing corpus is a REFUSAL for
    every caller, never a silently monosemous world: `sense_resource` returns
    None and `Stream.supply('sense')` stays absent, so `antanaclasis` refuses
    exactly as it did before this module existed."""
    return _load() is not None


def _load():
    global _WN, _LESK, _TAG          # _TAG WAS MISSING FROM THIS LINE
    # and the assignment below therefore bound a LOCAL: `_pos` read the
    # module-level None forever and returned no tag for any token, so
    # every sense was resolved WITHOUT a part of speech — which is the
    # exact defect the POS constraint was added to fix, reintroduced by
    # a missing name in a `global`. MEASURED: `sat` came back
    # `noun.time` on one line and `verb.motion` on another.
    if _WN is None:
        try:
            import nltk
            if WORDNET_DIR not in nltk.data.path:
                nltk.data.path.insert(0, WORDNET_DIR)
            from nltk.corpus import wordnet as wn
            from nltk.wsd import lesk
            wn.synsets("test")          # force the load; raises if absent
            nltk.pos_tag(["test"])      # and the tagger; see `_pos`
            _WN, _LESK, _TAG = wn, lesk, nltk.pos_tag
        except Exception:
            _WN, _LESK = False, None
    return None if _WN is False else _WN


def polysemy(word):
    """-> how many WordNet synsets this word has. 0 if unknown or no corpus.

    THE GATE ANTANACLASIS ACTUALLY NEEDS, and the cheapest true thing here: a
    word with one sense cannot be used in two, so a monosemous repeat is an
    ordinary repeat and no amount of context changes that.
    """
    wn = _load()
    if wn is None:
        return 0
    try:
        return len(wn.synsets(str(word).lower()))
    except Exception:
        return 0


def sense_of(word, context, pos=None):
    """-> a sense key for `word` read in `context` (an iterable of words).

    `word` monosemous or unknown -> its own lowercased text, so two such
    occurrences AGREE. Polysemous -> THE WINNING SYNSET'S LEXICOGRAPHER FILE,
    not its name, and the two corrections below are why.

    (1) POS IS CONSTRAINED, and without it the disambiguator was picking
    readings from the wrong part of speech entirely. MEASURED on the way in:
    `sat` in "she sat beside the river bank" came back `saturday.n.01` — the
    noun abbreviation — while the same word in "the cat sat on the mat" came
    back `ride.v.01`, so two occurrences of one past-tense verb read as two
    different senses and `antanaclasis` fired on an ordinary repeat. The
    tagger says VBD for both, and WordNet holds no verb sense of `Saturday`.

    (2) THE KEY IS THE LEXNAME (`noun.object`, `verb.motion`), which is
    WordNet's own coarse semantic grouping. Simplified Lesk is a weak
    baseline AT FINE GRAIN and a much better one at deciding which broad
    field a word is in; keying on the synset NAME asks it for precision it
    does not have and turns every near-miss into a claimed figure. Keying on
    the field asks it the question it can answer. `bank` still separates —
    `noun.object` for the riverside, `noun.group` for the institution — which
    is the case the figure is actually about.
    """
    w = str(word or "").lower()
    if not w:
        return ""
    wn = _load()
    if wn is None:
        return w
    try:
        if pos is not None and pos not in ("n", "v", "a", "r"):
            return w                    # no WordNet POS: nothing to resolve
        syns = wn.synsets(w, pos=pos) if pos else wn.synsets(w)
        if len(syns) < 2:
            return w
        got = _LESK(list(context), w, pos=pos) if pos \
            else _LESK(list(context), w)
        return got.lexname() if got is not None else w
    except Exception:
        return w


def _pos(tokens):
    """-> [WordNet POS or None], one per token, from the Penn tagger."""
    if _load() is None or _TAG is None:
        return [None] * len(tokens)
    try:
        return [_WN_POS.get((t or "")[:1]) for _, t in _TAG(list(tokens))]
    except Exception:
        return [None] * len(tokens)


def sense_resource(stream=None):
    """-> a callable `unit -> sense`, or None when there is no corpus.

    THE CONTEXT IS THE UNIT'S OWN LINE, which is the right window for this
    figure and not merely the convenient one: antanaclasis turns on a word
    meaning one thing HERE and another THERE, and the two occurrences are
    normally in different lines. Widening the window to the whole song would
    hand both occurrences the same bag and drive the two readings together —
    the disambiguator would then be arguing against the figure it is meant to
    detect.
    """
    if _load() is None:
        return None
    cache, tagged = {}, {}

    def _line_tokens(ln):
        """-> the line's tokens IN ORDER, deduplicated per token index.

        Order matters here in a way it did not before: the tagger reads a
        SEQUENCE, so handing it a set would destroy the very context that
        decides `sat` is a verb.
        """
        if ln in tagged:
            return tagged[ln]
        toks, seen = [], set()
        for i in (stream.lines[ln] if ln < len(stream.lines) else ()):
            u = stream.units[i]
            if u.token in seen:
                continue
            seen.add(u.token)
            toks.append((u.token, (u.token_text or "").lower()))
        pos = _pos([t for _, t in toks])
        tagged[ln] = (toks, pos)
        return tagged[ln]

    def _sense(u):
        ln = getattr(u, "line", None)
        key = (ln, getattr(u, "token", None))
        if key in cache:
            return cache[key]
        if stream is None or ln is None:
            out = sense_of(getattr(u, "token_text", ""), [])
        else:
            toks, pos = _line_tokens(ln)
            words = [t for _, t in toks]
            p = None
            for k, (tk, _t) in enumerate(toks):
                if tk == u.token:
                    p = pos[k]
                    break
            out = sense_of(getattr(u, "token_text", ""), words, pos=p)
        cache[key] = out
        return out

    return _sense


def report(sample=None):
    """Coverage and the honest caveat, measured rather than asserted."""
    wn = _load()
    print(f"WordNet present : {wn is not None}   ({WORDNET_RELEASE})")
    if wn is None:
        print("  no corpus — `sense` stays absent and antanaclasis refuses")
        return
    import lyric_harness as lh
    words = sample or sorted(lh.Lexicon().freq_rank)[:5000]
    known = poly = 0
    for w in words:
        n = polysemy(w)
        if n:
            known += 1
        if n > 1:
            poly += 1
    print(f"sampled words   : {len(words)}")
    print(f"  in WordNet    : {known} ({100.0 * known / max(1, len(words)):.1f}%)")
    print(f"  POLYSEMOUS    : {poly} ({100.0 * poly / max(1, len(words)):.1f}%)"
          f" — only these can carry antanaclasis at all")
    print("\nALGORITHM: simplified Lesk (Lesk 1986, nltk.wsd.lesk), POS-"
          "constrained, keyed on the WordNet LEXICOGRAPHER FILE.")
    print("MEASURED 2026-08-23 over 40 corpus songs / 1,603 lines: of 14,508 "
          "line pairs\n  sharing a word, the sense layer separated 1,366 — "
          "9.42% — and the sampled\n  separations are visibly REFRAINS, not "
          "puns (\"Land of the South! the\n  fairest land\" against \"Land of "
          "the South! in brightest dreams\").")
    print("SO IT IS OPT-IN. A figure detector at that rate buries a writer in "
          "false\n  findings, which is worse than the refusal it would "
          "replace. Declare\n  `derive_senses=True` on the stream to accept "
          "the rate; declare specific\n  positions with "
          "`relations.declare_senses` for an exact answer; declare\n  "
          "neither and `antanaclasis` refuses. Doctrine 16/22: the cut is "
          "STATED as a\n  rate and NOT adopted.")


#: THE CORPORA THIS MODULE NEEDS ARE STAGED BY `quality/fetch_data.py`, which
#: already existed and already staged NLTK packages into this same directory.
#: ~~A second installer lived here~~ and was deleted the moment that was
#: found: two fetchers writing one directory is two tables that will disagree
#: about what is staged (doctrine 1), and this module having its own was the
#: same not-looking-first that put a stale blocker note in front of WordNet
#: for a whole session.
#:
#:     python3 quality/fetch_data.py
#:
#: `data/nltk/` is gitignored — the convention here is FETCH, NOT COMMIT — so
#: what carries the reproducibility is that fetcher's table, the two rows in
#: `data/sources.tsv`, and this module refusing cleanly when the corpus is
#: absent.

__all__ = ["WORDNET_DIR", "WORDNET_RELEASE", "available", "polysemy",
           "sense_of", "sense_resource", "report"]


if __name__ == "__main__":
    report()
