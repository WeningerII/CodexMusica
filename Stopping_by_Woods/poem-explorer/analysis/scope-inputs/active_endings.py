#!/usr/bin/env python3
"""Proposed E63 audible ending + declared position rule, both reading modes.

Independent poem audit; imports existing readers read-only and writes only here.
"""
import itertools
import json
import sys
from pathlib import Path

OUT = Path(__file__).resolve().parent
ROOT = OUT.parent.parent
sys.path.insert(0, str(ROOT / "frost_pair_analysis"))
import poem_readings as PR
import lyric_harness as LH
from quality.phonology.eng import English


def final_rime(phones):
    s = LH.syllabify(phones)[-1]
    nucleus, coda = s["nucleus"], list(s["coda"])
    if nucleus == "AH" and s["stress"] == 0:
        nucleus = "AH0"
    if coda[:1] == ["R"]:
        for first, second in PR.BEFORE_R:
            if nucleus in (first, second):
                nucleus = first
                break
    return [nucleus] + coda, s["stress"]


def calculate():
    poem = json.loads((ROOT / "frost-rhetoric-application/poem.json").read_text())
    lines = [x["text"] for x in poem["lines"]]
    reader = PR.normalize_reader(English(readings="all", lexicon=LH.Lexicon(reader_scheme="v2"), reader_scheme="v2"))
    lex = reader._lexicon()
    manifest = PR.annotated_manifest(reader, lines)
    assert not manifest["ambiguous"] and not manifest["unresolved"]
    tokens = [dict(zip(manifest["columns"], r)) for r in manifest["rows"]]
    line_end_ids = {x["wordIds"][-1] for x in poem["lines"]}
    repeated_slots = set(zip(poem["lines"][14]["wordIds"], poem["lines"][15]["wordIds"]))
    assert [t["word"].lower() for t in tokens if t["line"] == 15] == [t["word"].lower() for t in tokens if t["line"] == 16]

    def flags(a, b):
        out = []
        if a["line"] == b["line"] and b["token"] == a["token"] + 1:
            out.append("A")
        if a["id"] in line_end_ids and b["id"] in line_end_ids:
            out.append("L")
        if (a["id"], b["id"]) == (77, 80):
            out.append("P")
        if (a["id"], b["id"]) in repeated_slots:
            out.append("R")
        return out

    result = {
        "format": "frost-positioned-ending-proposal-v1",
        "rule": "Final nucleus+complete coda agree under existing English normalization, and at least one declared position scope holds. Stress is recorded, not an agreement gate. No morphology or different-word gate.",
        "position_flags": {"A": "same-line immediately adjacent words", "L": "verse-line endings", "P": "parallel adjectives: easy wind and downy flake", "R": "aligned word slots in the exactly repeated final line"},
        "not_inferred": ["authorial intention", "grammatical suffix", "performance stress", "all possible semantic parallelism"],
        "pair_columns": ["a", "b", "position_flags", "repeated_word", "witness_ids"],
        "witness_columns": ["phones_a", "phones_b", "final_rime", "lexical_stress_a", "lexical_stress_b", "source_a", "source_b"],
        "modes": {},
    }
    for mode in ("annotated", "dictionary_union"):
        phonologies = {
            t["id"]: [t["phones"]] if mode == "annotated" else lex.pronunciation_variants(t["word"])
            for t in tokens
        }
        pairs, pool, lookup = [], [], {}
        raw_sound_pairs = raw_distinct = 0
        for a, b in itertools.combinations(tokens, 2):
            placements = flags(a, b)
            repeats = a["word"].casefold() == b["word"].casefold()
            witnesses = []
            sound_match = False
            for ap, bp in itertools.product(phonologies[a["id"]], phonologies[b["id"]]):
                ae, ast = final_rime(ap)
                be, bst = final_rime(bp)
                if ae != be:
                    continue
                sound_match = True
                if not placements:
                    continue
                sources = [a["source"], b["source"]] if mode == "annotated" else [lex.reading_source(a["word"], ap), lex.reading_source(b["word"], bp)]
                witness = [ap, bp, ae, ast, bst, *sources]
                key = json.dumps(witness, ensure_ascii=False)
                if key not in lookup:
                    lookup[key] = len(pool)
                    pool.append(witness)
                witnesses.append(lookup[key])
            if sound_match:
                raw_sound_pairs += 1
                raw_distinct += not repeats
            if witnesses:
                pairs.append([a["id"], b["id"], placements, repeats, list(dict.fromkeys(witnesses))])
        result["modes"][mode] = {
            "counts": {"unordered_pairs_checked": 5778, "unrestricted_ending_agreements": raw_sound_pairs,
                       "unrestricted_distinct_word_agreements": raw_distinct,
                       "active_pairs": len(pairs), "active_distinct_word_pairs": sum(not p[3] for p in pairs),
                       "active_repeated_word_pairs": sum(p[3] for p in pairs), "unique_witnesses": len(pool)},
            "pairs": pairs, "witnesses": pool,
        }
    (OUT / "active_endings.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    return result


if __name__ == "__main__":
    result = calculate()
    print(json.dumps({m: d["counts"] for m, d in result["modes"].items()}))
