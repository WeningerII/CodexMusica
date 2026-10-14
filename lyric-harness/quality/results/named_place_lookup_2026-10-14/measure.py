"""Identical-cut lines whose default END binding moves between reader schemes.

BB8 (#519 6161601064) found lines of the English song corpus whose v1 and v2
cuts are IDENTICAL (the same token texts on the same raw characters) and whose
end binding still changes, so the Lyrics page's named-place notice (which
fired only on a changed cut) said nothing there. This receipt names the cause
and measures the page's general condition against the whole population.

THE CAUSE. Under scheme v1, `line_anchors` reads the words before the last by
re-cutting them joined with single spaces (`lex.transcribe(" ".join(
words[:-1]))`, the v1 body of `Lexicon.transcribe`, which applies
`join_spaced_enclitics`). Re-cutting is not idempotent: an enclitic that the
printed line sets apart from its host by punctuation (`knap, 's`, `M.P.'s`,
`U.’s`) is a word of its own in the cut, the space join turns it into a
SPACED enclitic, and the re-cut joins it to the word before (`knap's`, `P's`
P IY1 Z, `U's` Y UW1 Z). Scheme v2 reads each token at its own position
(`transcribe_tokens`), so `'s` is read alone (EH1 S) and the rhyme starts
elsewhere. The cut did not change; the LOOKUP WORDS did.

THE CONDITION (src/pages/lyrics.js lyLineCutChanged, the mirror's
CMLyricTokens.v1GraderLookup): on a line whose cut is identical, the line is
changed when v1's lookup words -- `_line_tokens_v1(" ".join(words[:-1]))`
plus the last word -- differ from the cut. It is computed here with the
harness's own functions, not the mirror.

POPULATION. `corpus/song/eng_*.txt`; a sung line is a stripped non-blank line
that does not begin `#`, `---` or `[` (audit_register's rule); voices off
(asides stripped), as the page reads a draft without the voices row.

END BINDING. `line_anchors(lex, line)` under each scheme with that scheme's
production English lexicon (`quality.phonology.eng._lexicon()`), compared on
the anchors' phones and stress (the key `line_anchors` deduplicates by) and
the label. A line where neither scheme binds anything (no anchor under
either) and the two labels differ only by Unicode NFC (v2 normalises, v1
reads the raw codepoints: polytonic Greek U+1F79 against U+03CC) binds no
word under either scheme; it is listed apart as `label_nfc_only`, not as a
binding change.

    python3 quality/results/named_place_lookup_2026-10-14/measure.py [--write]

Writes result.json beside this file with --write; prints it otherwise.
"""
import json
import os
import platform
import sys
import unicodedata
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT))
os.chdir(ROOT)

import lyric_harness as LH  # noqa: E402
from quality.phonology import eng  # noqa: E402


def _sung_lines():
    for path in sorted((ROOT / "corpus" / "song").glob("eng_*.txt")):
        for raw in path.read_text(encoding="utf-8").split("\n"):
            line = raw.strip()
            if not line or line.startswith(("#", "---", "[")):
                continue
            yield path.name, line


def _identical_cut(line):
    old = LH._v1_token_spans(line, True)
    if old is None:
        return None
    cur = [(t.text, tuple(tuple(p) for p in t.pieces))
           for t in LH.reader_line(line, True, scheme="v2").tokens]
    old = [(t, tuple(tuple(p) for p in ps)) for t, ps in old]
    return [t for t, _ in old] if old == cur else None


def _lookup_differs(words):
    if not words:
        return False
    looked = LH._line_tokens_v1(" ".join(words[:-1]), True) + [words[-1]]
    return looked != words


def _main():
    lexes = {}
    for scheme in ("v1", "v2"):
        with LH.reader_scheme_scope(scheme):
            lexes[scheme] = eng._lexicon()

    def end_key(scheme, line):
        with LH.reader_scheme_scope(scheme):
            anchors, label, _ = LH.line_anchors(lexes[scheme], line)
        return ([[(s["nucleus"], list(s["coda"]), list(s["onset"]), s["stress"])
                  for s in a] for a in anchors], label)

    total = identical = 0
    seen = {}
    lookup, changed, nfc_only = [], [], []
    for name, line in _sung_lines():
        total += 1
        words = _identical_cut(line)
        if words is None:
            continue
        identical += 1
        differs = _lookup_differs(words)
        if differs:
            lookup.append({"file": name, "line": line})
        if line not in seen:
            k1, k2 = end_key("v1", line), end_key("v2", line)
            seen[line] = "same" if k1 == k2 else (
                "nfc" if (not k1[0] and not k2[0] and
                          unicodedata.normalize("NFC", k1[1]) == k2[1]) else "moved")
        if seen[line] == "nfc":
            nfc_only.append({"file": name, "line": line, "lookup_differs": differs})
        if seen[line] == "moved":
            changed.append({"file": name, "line": line, "lookup_differs": differs,
                            "latin": bool(words),
                            "v1": end_key("v1", line), "v2": end_key("v2", line)})
    by_line = {x["line"] for x in changed}
    for x in lookup:
        x["end_changed"] = x["line"] in by_line
    out = {
        "population": {"rule": "corpus/song/eng_*.txt stripped lines, non-blank, not "
                               "starting '#', '---' or '['; voices off",
                       "sung_lines": total, "identical_cut": identical,
                       "unique_identical_cut": len(seen)},
        "condition": "v1 lookup words (_line_tokens_v1 of the space-joined words before "
                     "the last, then the last word) differ from the identical cut",
        "lookup_differs": lookup,
        "end_changed": changed,
        "label_nfc_only": nfc_only,
        "python": f"{platform.python_implementation()} {platform.python_version()}",
    }
    text = json.dumps(out, ensure_ascii=False, indent=1) + "\n"
    if "--write" in sys.argv:
        (HERE / "result.json").write_text(text, encoding="utf-8")
    print(json.dumps({k: (len(v) if isinstance(v, list) else v) for k, v in out.items()},
                     ensure_ascii=False, indent=1))


if __name__ == "__main__":
    _main()
