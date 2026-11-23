#!/usr/bin/env python3
"""Which letters of a word spell which of its sounds.

WHY THIS EXISTS (bug hunt finding 17, 2026-11-21). The same-spelled-ending
ban compares two words "from the stressed vowel on". Finding the letter that
vowel starts at was done by counting groups of vowel LETTERS from the end and
taking that count to be the number of vowel SOUNDS. The two disagree in three
ordinary cases, and each one moved the comparison to the wrong stretch:

  * a silent `e` inside the word: `nicely` has three letter groups and two
    vowel sounds, so its ending was read as `ely`, not `icely`;
  * one letter group spelling two sounds: `create` was read as `eate`;
  * a vowel letter spelling a consonant: `queen` was read as `ueen`.

This module lines the letters up with the sounds instead, and answers one
question: at which letter does each vowel sound of the word start.

HOW. One pass of dynamic programming over (letters, sounds). A letter spells
no sound, one sound or two; each choice has a cost from the small tables
below, and the cheapest whole reading wins. Between two readings of equal
cost the one that puts each sound on the EARLIER letter wins, so a vowel
sound starts at the first letter of the group that spells it (`queen` is
`een`, not `en`). The tables say what a letter CAN spell, not what it usually
spells, so a dictionary reading is never second-guessed: the sounds are
given, and only their letters are found.

Costs are whole numbers (tenths), so two readings tie exactly or not at all.

A word whose cheapest reading is still implausible (an initialism, a numeral
spelled in sounds) returns None, and the caller falls back to the old form.

Run the table:  python3 quality/test_letter_sound.py
"""

VOWEL_LETTERS = frozenset("aeiouy")

#: Consonant letter -> the consonant sounds it can spell on its own.
CONSONANT_SOUNDS = {
    "b": {"B"},
    "c": {"K", "S", "CH", "SH"},
    "d": {"D", "T", "JH"},
    "f": {"F", "V"},
    "g": {"G", "JH", "ZH", "F"},
    "h": {"HH", "F"},
    "j": {"JH", "Y", "HH", "ZH"},
    "k": {"K"},
    "l": {"L"},
    "m": {"M"},
    "n": {"N", "NG"},
    "p": {"P", "F"},
    "q": {"K"},
    "r": {"R"},
    "s": {"S", "Z", "SH", "ZH"},
    "t": {"T", "CH", "SH", "TH", "DH", "D"},
    "v": {"V", "F"},
    "w": {"W", "V"},
    "x": {"Z", "K"},
    "z": {"Z", "S", "ZH"},
}

#: Vowel letter -> the consonant sounds it can spell (`queen`, `onion`, `yes`).
VOWEL_LETTER_GLIDES = {
    "u": {"W": 0},
    "y": {"Y": 0},
    "i": {"Y": 4},
    "o": {"W": 20},
    "e": {"Y": 20},
}

#: Letter -> the pairs of sounds it can spell at once, with the cost.
#: A vowel sound is written `V` here; a syllabic consonant is a weak vowel
#: followed by the consonant itself (`rhythm`, `bottle`, `didn't`).
TWO_SOUNDS = {
    "x": {("K", "S"): 0, ("G", "Z"): 0, ("K", "SH"): 5, ("G", "ZH"): 5},
    "u": {("Y", "V"): 3, ("V", "W"): 5},
    "e": {("Y", "V"): 3},
    "o": {("W", "V"): 10},
    "l": {("V", "L"): 8},
    "m": {("V", "M"): 8},
    "n": {("V", "N"): 8, ("N", "Y"): 5},
    "r": {("V", "R"): 8},
    "z": {("T", "S"): 0},
}

MISMATCH = 40           # a letter standing for a sound it cannot spell
NO_LETTER = 50          # a sound no letter stands for
#: Above this cost per letter the reading is not trusted.
MAX_COST_PER_LETTER = 7.5


def is_vowel_sound(phone):
    """A vowel sound carries its stress digit; a consonant carries none."""
    return phone[-1:].isdigit()


def letters_of(word):
    """The word's letters, lower case, with everything else dropped."""
    return "".join(c for c in str(word).lower() if c.isalpha())


def _silent_cost(w, i):
    """What it costs for letter `i` of `w` to spell no sound."""
    ch = w[i]
    prev = w[i - 1] if i else ""
    nxt = w[i + 1] if i + 1 < len(w) else ""
    if ch in VOWEL_LETTERS:
        if prev in VOWEL_LETTERS:
            return 3              # a later letter of a group: grEAt
        if ch == "u" and prev in ("g", "q") and nxt in VOWEL_LETTERS:
            return 1              # gUess, gUide
        if ch == "e":
            return 5              # nicEly, placE
        if nxt in VOWEL_LETTERS:
            return 6              # the first letter of a group
        return 10
    if ch == prev:
        return 1                  # a doubled consonant
    if ch == "h":
        return 3
    if ch == "w" and prev in VOWEL_LETTERS:
        return 2                  # loW, floWer
    if ch == "r" and prev in VOWEL_LETTERS:
        return 4                  # hER, where the vowel sound holds the r
    if ch == "g" and nxt in ("h", "n"):
        return 3                  # niGht, siGn
    if ch == "k" and nxt == "n":
        return 2
    if ch == "c" and (nxt == "k" or prev == "s"):
        return 2
    if ch == "d" and nxt == "g":
        return 2
    return 10


def _one_cost(ch, phone):
    """What it costs for letter `ch` to spell the single sound `phone`."""
    vowel = is_vowel_sound(phone)
    if ch in VOWEL_LETTERS:
        if vowel:
            return 0
        return VOWEL_LETTER_GLIDES.get(ch, {}).get(phone, MISMATCH)
    if vowel:
        # `r` alone can stand for the vowel of fiRe; no other consonant can.
        return 10 if ch == "r" and phone[:2] == "ER" else MISMATCH
    return 0 if phone in CONSONANT_SOUNDS.get(ch, ()) else MISMATCH


def _two_cost(ch, first, second):
    """What it costs for letter `ch` to spell two sounds at once, or None."""
    shape = ("V" if is_vowel_sound(first) else first,
             "V" if is_vowel_sound(second) else second)
    return TWO_SOUNDS.get(ch, {}).get(shape)


def align(word, phones):
    """-> [(letter index, first sound index, sounds spelled)] or None.

    One entry per letter of `letters_of(word)`, in order. `sounds spelled` is
    0, 1 or 2. None when the word has no letters or no sounds, or when the
    cheapest reading costs more than `MAX_COST_PER_LETTER` a letter.
    """
    w = letters_of(word)
    phones = list(phones or ())
    n, m = len(w), len(phones)
    if not n or not m:
        return None
    # A state's score is (cost, the letter index of every sound placed so
    # far, added up). Tuples compare cost first, so the second number only
    # ever breaks a tie, and it breaks it toward the earlier letter.
    best = [[None] * (m + 1) for _ in range(n + 1)]
    back = [[None] * (m + 1) for _ in range(n + 1)]
    best[0][0] = (0, 0)

    def offer(i, j, score, came_from):
        if best[i][j] is None or score < best[i][j]:
            best[i][j] = score
            back[i][j] = came_from

    for i in range(n + 1):
        for j in range(m + 1):
            here = best[i][j]
            if here is None:
                continue
            cost, where = here
            if j < m:
                # a sound with no letter of its own
                offer(i, j + 1, (cost + NO_LETTER, where + i), (i, j, None))
            if i == n:
                continue
            ch = w[i]
            offer(i + 1, j, (cost + _silent_cost(w, i), where), (i, j, 0))
            if j < m:
                offer(i + 1, j + 1,
                      (cost + _one_cost(ch, phones[j]), where + i), (i, j, 1))
            if j + 1 < m:
                two = _two_cost(ch, phones[j], phones[j + 1])
                if two is not None:
                    offer(i + 1, j + 2, (cost + two, where + 2 * i),
                          (i, j, 2))
    if best[n][m] is None or best[n][m][0] > MAX_COST_PER_LETTER * n:
        return None
    out, i, j = [], n, m
    while (i, j) != (0, 0):
        pi, pj, k = back[i][j]
        if k is not None:
            out.append((pi, pj, k))
        i, j = pi, pj
    out.reverse()
    return out


def vowel_starts(word, phones):
    """-> the letter index each vowel sound starts at, in order, or None.

    One entry per vowel sound of `phones`. None when the word does not line
    up, or when some vowel sound has no letter of its own.
    """
    rows = align(word, phones)
    if rows is None:
        return None
    start = {}
    for letter, first, count in rows:
        for j in range(first, first + count):
            start.setdefault(j, letter)
    out = []
    for j, phone in enumerate(phones):
        if not is_vowel_sound(phone):
            continue
        if j not in start:
            return None
        out.append(start[j])
    return out


def spelled_from(word, phones, vowel_from_end):
    """-> the letters of `word` from one of its vowel sounds to the end.

    `vowel_from_end` counts vowel SOUNDS from the end, 1 for the last. None
    when the word does not line up, so the caller can fall back.
    """
    starts = vowel_starts(word, phones)
    if not starts:
        return None
    k = max(1, int(vowel_from_end))
    if k > len(starts):
        k = len(starts)
    return letters_of(word)[starts[-k]:]
