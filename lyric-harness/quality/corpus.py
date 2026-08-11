#!/usr/bin/env python3
"""Corpus loading and the pre-registered survival labels.

The labels here are a straight transcription of PREREGISTRATION.md, which was
committed before any feature code existed. They are not to be edited in light of
a result; if they change, the pre-registration is void and the run is
exploratory.
"""

import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
CORPUS = os.path.join(HERE, "..", "corpus")

SONNET_SCHEME = "ABABCDCDEFEFGG"

# Sonnets in effectively every major English-verse anthology.
SURVIVED = {18, 29, 30, 55, 60, 65, 71, 73, 94, 106, 116, 129, 130, 138, 146}

# Frequently but not universally anthologized. Excluded from the contrast so
# the comparison is between clear cases rather than across a gradient.
AMBIGUOUS = {1, 2, 12, 20, 33, 53, 54, 64, 66, 87, 91, 97, 98, 104, 107, 110,
             128, 144, 147, 151}


_ROMAN = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100, "D": 500, "M": 1000}


def roman_to_int(s):
    """Standard subtractive Roman numeral -> int, or None if malformed."""
    if not s or not all(c in _ROMAN for c in s):
        return None
    total, prev = 0, 0
    for c in reversed(s):
        v = _ROMAN[c]
        total += -v if v < prev else v
        prev = max(prev, v)
    return total


def load_sonnets(path=None):
    """-> {sonnet_number: [14 lines]}.

    The Gutenberg text heads each sonnet with a Roman numeral on its own line
    and uses CRLF. Numbering is read from the header rather than inferred from
    position, so a dropped sonnet cannot silently shift every label after it --
    which would quietly corrupt the survival labels. The sequence is then
    checked to be exactly 1..N with no gaps, and the parse fails loudly if not.
    """
    path = path or os.path.join(CORPUS, "sonnets.txt")
    out, current, num, order = {}, [], None, []
    with open(path, encoding="utf-8", errors="replace") as f:
        for raw in f:
            s = raw.replace("\r", "").strip()
            if s.startswith("***"):
                if s.startswith("*** END"):
                    break
                continue
            head = roman_to_int(s) if re.fullmatch(r"[IVXLCDM]+", s) else None
            # a bare "I" line inside a poem body would be a false header; a
            # real header always continues the sequence, so require that.
            if head is not None and head == len(order) + 1:
                if num is not None and len(current) == 14:
                    out[num] = current
                num, current = head, []
                order.append(head)
                continue
            if num is not None and s:
                current.append(s)
    if num is not None and len(current) == 14:
        out[num] = current
    if order != list(range(1, len(order) + 1)):
        raise ValueError(f"sonnet numbering is not contiguous: {order[:20]}...")
    return out


def labelled_sonnets(path=None):
    """-> (survived, forgotten) as lists of (id, lines). Ambiguous dropped."""
    sonnets = load_sonnets(path)
    survived = [(n, l) for n, l in sorted(sonnets.items()) if n in SURVIVED]
    forgotten = [(n, l) for n, l in sorted(sonnets.items())
                 if n not in SURVIVED and n not in AMBIGUOUS]
    return survived, forgotten


def load_generated(path=None):
    """Model-generated sonnets for Experiment 2, '---'-delimited."""
    path = path or os.path.join(CORPUS, "generated", "sonnets_generated.txt")
    if not os.path.exists(path):
        return []
    blocks = open(path, encoding="utf-8").read().split("---")
    out = []
    for i, b in enumerate(blocks, 1):
        lines = [l.strip() for l in b.strip().splitlines() if l.strip()]
        if len(lines) == 14:
            out.append((f"gen{i:03d}", lines))
    return out


if __name__ == "__main__":
    s, f = labelled_sonnets()
    allsn = load_sonnets()
    print(f"parsed {len(allsn)} sonnets; survived {len(s)}, forgotten {len(f)},"
          f" ambiguous excluded {len(allsn) - len(s) - len(f)}")
    missing = sorted(SURVIVED - set(allsn))
    if missing:
        print(f"  WARNING: labelled-survived sonnets not parsed: {missing}")
    print("  survived ids:", [n for n, _ in s])
