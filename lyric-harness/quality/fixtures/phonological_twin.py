#!/usr/bin/env python3
"""Mechanical fixture text: a seeded PHONOLOGICAL TWIN of a draft.

WHY THIS EXISTS (2026-10-27). The owner approved deleting every AI-written
song in this repository, and the regression fixtures that quoted them with
it. Several of those fixtures were load-bearing: a test needed a draft whose
rhyme web, returns and meter were a real song's, not a toy's. The owner's
condition was that a replacement is NEVER a written lyric line: fixture text
must be mechanically generated tokens or seeded dictionary words.

WHAT A TWIN IS. Every CONTENT word is replaced by a word drawn, with a fixed
seed, from the staged pronunciation dictionary (`cmudict.dict`) intersected
with the staged frequency list (`data/opensubtitles_en_50k.tsv`), among the
words that have exactly ONE dictionary reading and share the original's
syllable count, stress pattern and RIME (every phone from the last stressed
vowel to the end), relaxing to the final syllable's rime, then to the
stressed vowel, then to the stress pattern alone, only when no stricter twin
exists. The same word always maps to the same twin, so returns and
repeated words stay repeated, a twin keeps the original's last two letters
whenever a candidate does, and two different words never share a twin
(the mapping is injective within one draft). Function words (`FUNCTION`) are kept, because
they carry no lyric content and the graders read their share. Case and
punctuation are kept. Nothing about meaning is kept, and nothing is composed:
the output is a sequence of dictionary draws in the source's phonological
shape, which is the property the regressions were pinned on.

WHAT IT DOES NOT PRESERVE: onsets (so an alliteration or a headrime that
depended on an onset may move), part of speech, frequency and concreteness.
A test that consumed a twin re-measured what it pins on the twin.

The source drafts these twins were made from are deleted; this function is
kept so the method is inspectable. Run: `python3 -m quality.fixtures.
phonological_twin SEED < draft.txt`.
"""
import os
import random
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))

#: Closed-class words left as they are: articles, pronouns, prepositions,
#: conjunctions, auxiliaries and their contractions. A closed list, not a
#: tagger's guess, so a twin is the same on every machine.
FUNCTION = frozenset("""
a an the this that these those some any no every each all both either neither
i me my mine myself you your yours yourself he him his himself she her hers
herself it its itself we us our ours ourselves they them their theirs
themselves who whom whose which what where when why how there here
and or but nor so yet if then than because as while though although until
unless since of in on at by for from to with without into onto upon over
under above below about across after before behind beside between beyond
down up out off through toward towards around along against among near
is am are was were be been being have has had having do does did doing done
will would shall should can could may might must not
i'm i'll i've i'd you're you'll you've you'd he's he'll he'd she's she'll
she'd it's it'll we're we'll we've we'd they're they'll they've they'd
that's there's here's what's who's where's don't doesn't didn't won't
wouldn't can't couldn't shouldn't isn't aren't wasn't weren't haven't hasn't
hadn't let's
""".split())

#: Never drawn: slurs, profanity and sexual terms. A fixture is read by
#: people; a seeded draw does not get to pick these.
BLOCKED = frozenset("""
fag fags faggot nigger nigga niggas twat twats cunt cunts fuck fucks fucked
fucker shit shits bitch bitches whore whores slut sluts dick dicks cock
cocks prick pricks piss pissed porn rape raped rapes rapist kike kikes spic
spics chink chinks gook gooks dyke dykes tranny retard retards wank wanker
tits titty boob boobs butt butts anus anal semen sperm penis vagina clit
negro negroes jap japs paki pakis coon coons homo homos queer queers
nazi nazis hitler bastard bastards damn damned hell crap ass asses arse
slave slaves slavery lynch lynched holocaust genocide suicide
""".split())

_WORD = re.compile(r"[A-Za-z]+(?:'[A-Za-z]+)*")
_VOWEL = re.compile(r"[AEIOU]")


def _key(phones):
    """(syllables, stress pattern, rime from the last stressed vowel)."""
    stresses = [p[-1] for p in phones if _VOWEL.match(p)]
    if not stresses:
        return None
    last = max((i for i, p in enumerate(phones)
                if _VOWEL.match(p) and p[-1] in "12"), default=None)
    if last is None:
        last = max(i for i, p in enumerate(phones) if _VOWEL.match(p))
    return (len(stresses), "".join(stresses), tuple(phones[last:]))


def _keys(phones):
    """The exact key, then two relaxations, strictest first: the final
    syllable's rime only, then the stressed vowel only (always with the same
    syllable count and stress pattern)."""
    k = _key(phones)
    if k is None:
        return []
    n, stress, rime = k
    vowels = [i for i, p in enumerate(phones) if _VOWEL.match(p)]
    return [k, (n, stress, "final", tuple(phones[vowels[-1]:])),
            (n, stress, "nucleus", rime[0]), (n, stress, "shape")]


def _load(root=ROOT):
    readings = {}
    with open(os.path.join(root, "cmudict.dict"), encoding="utf-8") as fh:
        for line in fh:
            line = line.split("#")[0].strip()
            if not line:
                continue
            word, *phones = line.split()
            base = re.sub(r"\(\d+\)$", "", word)
            readings.setdefault(base, []).append(phones)
    frequent = set()
    with open(os.path.join(root, "data", "opensubtitles_en_50k.tsv"),
              encoding="utf-8") as fh:
        for line in fh:
            if line.startswith("#") or not line.strip():
                continue
            frequent.add(line.split("\t")[0].strip().lower())
    pool = {}
    for word, prons in readings.items():
        if (len(prons) != 1 or word not in frequent or word in FUNCTION
                or word in BLOCKED or not word.isalpha() or len(word) < 3):
            continue
        for k in _keys(prons[0]):
            pool.setdefault(k, []).append(word)
    for k in pool:
        pool[k].sort()
    return readings, pool


class Twin:
    """`keep_end=True` keeps each line's LAST word as it is (a regression
    whose subject is the end-word layer itself: a same-spelled ending, or the
    predictability of an end-word rhyme, which the twin's dictionary draws do
    not reproduce). Every other content word is still twinned."""

    def __init__(self, seed, root=ROOT, keep_end=False):
        self.seed = seed
        self.keep_end = keep_end
        self.readings, self.pool = _load(root)
        self.mapping = {}
        self.used = set()   # injective: two source words never share a twin

    def word(self, w):
        low = w.lower()
        if low in FUNCTION:
            return w
        if low not in self.mapping:
            base, _, tail = low.partition("'")
            prons = self.readings.get(base)
            choice = None
            for k in (_keys(prons[0]) if prons else ()):
                cands = [c for c in self.pool.get(k, ())
                         if c != base and self.readings[c][0] != prons[0]
                         and c not in self.used]
                # Prefer a twin that also keeps the SPELLED ending (the last
                # two letters), so a same-spelled-ending relation between two
                # words survives the substitution as their rime does.
                spelled = [c for c in cands if c[-2:] == base[-2:]]
                if spelled or cands:
                    choice = random.Random(f"{self.seed}:{base}").choice(
                        spelled or cands)
                    break
            if choice is None:
                # No twin with the same shape: a seeded token the dictionary
                # does not read, so it can never pass as a word.
                rng = random.Random(f"{self.seed}:{base}:token")
                choice = "zq" + "".join(rng.choice("bcdfghjklmnpqrstvwxz")
                                        for _ in range(4))
            self.used.add(choice)
            self.mapping[low] = choice + (("'" + tail) if tail else "")
        out = self.mapping[low]
        if w.isupper() and len(w) > 1:
            return out.upper()
        if w[0].isupper():
            return out[0].upper() + out[1:]
        return out

    def line(self, text):
        if text.lstrip().startswith("["):
            return text          # a section header names a part, not a lyric
        spans = list(_WORD.finditer(text))
        last = spans[-1].span() if (self.keep_end and spans) else None
        return _WORD.sub(lambda m: (m.group(0) if m.span() == last
                                    else self.word(m.group(0))), text)

    def lines(self, lines):
        return [self.line(x) for x in lines]


if __name__ == "__main__":
    t = Twin(int(sys.argv[1]) if len(sys.argv) > 1 else 0)
    for raw in sys.stdin:
        sys.stdout.write(t.line(raw))
