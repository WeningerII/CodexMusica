#!/usr/bin/env python3
"""Bounded, reproducible initial-consonant audit of the 108 Frost occurrences.

Reads existing pronunciation declarations and E9 outputs. Changes neither Codex
Musica nor the Site. Run from any directory; --root may override the workspace.
"""
from __future__ import annotations

import argparse
from collections import Counter
import hashlib
from itertools import combinations, product
import json
from pathlib import Path
import re
import sys

CONSONANTS = frozenset("B CH D DH F G HH JH K L M N NG P R S SH T TH V W Y Z ZH".split())
VOWELS = frozenset("AA AE AH AO AW AY EH ER EY IH IY OW OY UH UW AX AXR IX UX".split())
IPA = dict(zip("B CH D DH F G HH JH K L M N NG P R S SH T TH V W Y Z ZH".split(),
               "b tʃ d ð f ɡ h dʒ k l m n ŋ p ɹ s ʃ t θ v w j z ʒ".split()))


def first_consonant(phones):
    """Return the first PHONE only if consonantal; vowel-initial returns None.

    A missing or invalid pronunciation is unresolved, never a negative match.
    Affricates CH/JH are single ARPAbet phones. Y/W are consonantal glides.
    """
    if not phones:
        raise ValueError("Missing pronunciation")
    phone = re.sub(r"[012]$", "", phones[0])
    if phone in CONSONANTS:
        return phone
    if phone in VOWELS:
        return None
    raise ValueError(f"Unrecognized initial phone: {phones[0]}")


def initial_consonant_agreement(a, b):
    x, y = first_consonant(a), first_consonant(b)
    return x is not None and x == y


def complete_onset(phones):
    first_consonant(phones)  # Validate rather than treating unknown as vowel.
    onset = []
    for phone in phones:
        if phone not in CONSONANTS:
            break
        onset.append(phone)
    return tuple(onset)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def build(root):
    analysis = root / "frost_pair_analysis"
    harness = analysis / "CodexMusica/lyric-harness"
    sys.path[:0] = [str(analysis), str(harness)]
    import lyric_harness as LH
    from quality.phonology.eng import English
    import poem_readings as readings

    manifest_path = analysis / "annotated_readings.json"
    manifest = json.loads(manifest_path.read_text())
    canonical = json.loads((root / "frost-rhetoric-application/poem.json").read_text())
    assert not manifest["unresolved"] and not manifest["ambiguous"]
    rows = manifest["rows"]
    assert len(rows) == 108
    assert [r[0] for r in rows] == list(range(1, 109))
    assert [r[3].lower().replace("’", "'") for r in rows] == [
        t["word"].lower().strip(".,;:").replace("’", "'") for t in canonical["tokens"]]
    reader = readings.normalize_reader(English(
        readings="all", lexicon=LH.Lexicon(reader_scheme="v2"), reader_scheme="v2"))
    lexicon = reader._lexicon()

    # Store each complete pronunciation once. IDs are zero-based local reading IDs.
    pronunciation_ids = {}
    pronunciation_rows = []

    def register(phones):
        key = tuple(phones)
        first_consonant(key)
        if key not in pronunciation_ids:
            pronunciation_ids[key] = len(pronunciation_rows)
            pronunciation_rows.append(list(key))
        return pronunciation_ids[key]

    occurrence_rows = []
    options = {"annotated": {}, "dictionary_union": {}}
    for r in rows:
        ident, line, position, word, annotation, phones, source = r
        annotated_id = register(phones)
        alternatives = lexicon.pronunciation_variants(word)
        if not alternatives:
            raise ValueError(f"No declared dictionary pronunciations for occurrence {ident}: {word}")
        union_ids = sorted({register(p) for p in alternatives})
        assert annotated_id in union_ids, (ident, word, phones)
        options["annotated"][ident] = [annotated_id]
        options["dictionary_union"][ident] = union_ids
        occurrence_rows.append([
            ident, canonical["tokens"][ident - 1]["id"], word, line, position,
            annotated_id, union_ids, annotation,
        ])
    by_id = {r[0]: r for r in occurrence_rows}
    scopes = {}
    inputs = {
        "annotated": analysis / "frost_annotated_pairs.json",
        "dictionary_union": analysis / "frost_rhyme_pairs.json",
    }
    for scope, path in inputs.items():
        baseline = json.loads(path.read_text())
        absence = {(a, b): mask for a, b, mask in baseline["absence_only"]}
        baseline_pairs = [(a, b) for a, b, _ in baseline["pairs"]]
        assert baseline_pairs == list(combinations(range(1, 109), 2))
        strict = {(a, b) for a, b, mask in baseline["pairs"]
                  if (mask & ~absence.get((a, b), 0)) & (1 << 8)}
        raw_strict = {(a, b) for a, b, mask in baseline["pairs"] if mask & (1 << 8)}
        positive = set()
        recomputed_strict = set()
        witnesses = []
        chosen = options[scope]
        for a, b in baseline_pairs:
            distinct = rows[a - 1][3].lower() != rows[b - 1][3].lower()
            for rid_a, rid_b in product(chosen[a], chosen[b]):
                pa, pb = pronunciation_rows[rid_a], pronunciation_rows[rid_b]
                if initial_consonant_agreement(pa, pb):
                    positive.add((a, b))
                    # One record for EACH qualifying pair of complete pronunciations.
                    witnesses.append([a, b, first_consonant(pa), rid_a, rid_b])
                oa, ob = complete_onset(pa), complete_onset(pb)
                if distinct and oa and oa == ob:
                    recomputed_strict.add((a, b))
        assert strict == recomputed_strict, sorted(strict ^ recomputed_strict)
        assert strict <= positive
        repeats = {(a, b) for a, b in positive
                   if rows[a - 1][3].lower() == rows[b - 1][3].lower()}
        added_distinct = positive - strict - repeats
        same_line = {(a, b) for a, b in positive if by_id[a][3] == by_id[b][3]}
        scopes[scope] = {
            "counts": {
                "compared_pairs": len(baseline_pairs), "A1": len(positive),
                "native_E9_positive": len(strict), "A1_and_E9": len(positive & strict),
                "A1_not_E9": len(positive - strict), "E9_not_A1": len(strict - positive),
                "A1_distinct_spelling": len(positive - repeats),
                "new_distinct_spelling": len(added_distinct),
                "same_spelling": len(repeats), "same_line_A1": len(same_line),
                "same_line_new_distinct": len(same_line & added_distinct),
                "native_E9_raw": len(raw_strict),
                "native_E9_removed_empty_onset": len(raw_strict - strict),
                "complete_pronunciation_witnesses": len(witnesses),
            },
            "positive_pairs": sorted(positive),
            "positive_pair_indices_zero_based": [i for i, p in enumerate(baseline_pairs) if p in positive],
            "native_E9_pairs": sorted(strict),
            "new_pairs": sorted(positive - strict),
            "new_distinct_spelling_pairs": sorted(added_distinct),
            "same_spelling_pairs": sorted(repeats),
            "same_line_pairs": sorted(same_line),
            "witness_columns": ["a", "b", "first_consonant", "reading_a", "reading_b"],
            "witnesses": witnesses,
            "initial_counts": dict(sorted(Counter(
                first_consonant(pronunciation_rows[chosen[r[0]][0]]) or "VOWEL_INITIAL"
                for r in rows).items())),
        }
    assert scopes["annotated"]["positive_pairs"] == scopes["dictionary_union"]["positive_pairs"]
    assert scopes["annotated"]["counts"]["A1"] == 235
    assert scopes["annotated"]["counts"]["native_E9_positive"] == 147
    assert scopes["annotated"]["counts"]["new_distinct_spelling"] == 37
    assert scopes["annotated"]["counts"]["same_spelling"] == 51

    # Negative checks protect the specific scope boundary being introduced.
    assert initial_consonant_agreement(["S", "AW1", "N", "D", "Z"], ["S", "W", "IY1", "P"])
    assert not initial_consonant_agreement(["S", "AH1", "M"], ["SH", "EY1", "K"])
    assert not initial_consonant_agreement(["DH", "AH0"], ["TH", "IH1", "NG", "K"])
    assert not initial_consonant_agreement(["AH0", "V"], ["AE1", "N", "D"])
    assert not initial_consonant_agreement(["AH0", "V"], ["V", "IH1", "L", "IH0", "JH"])

    source_paths = [manifest_path, *inputs.values(), analysis / "poem_readings.py",
                    analysis / "english_schema_contracts.py", harness / "quality/relations.py"]
    examples = []
    for a, b in [(73,75), (19,21), (27,48), (37,94), (2,26), (1,9), (1,2), (62,68), (4,14), (4,5), (14,76)]:
        pa = pronunciation_rows[options["annotated"][a][0]]
        pb = pronunciation_rows[options["annotated"][b][0]]
        examples.append({"pair":[a,b], "words":[by_id[a][2],by_id[b][2]],
                         "onsets":[complete_onset(pa),complete_onset(pb)],
                         "A1":initial_consonant_agreement(pa,pb),
                         "E9":(a,b) in {tuple(p) for p in scopes["annotated"]["native_E9_pairs"]}})
    return {
        "format":"frost-first-consonant-scope-v1",
        "relation_id":"A1", "name":"Initial-consonant agreement",
        "definition":{
            "positive":"For two different word occurrences, their first phonemes are the same consonant under a compatible pair of complete declared pronunciations.",
            "predicate":"first_consonant(a) is not None and first_consonant(a) == first_consonant(b)",
            "negative":"A vowel-initial member, different initial consonants, or phonetic similarity without exact consonant identity fails. A consonant later in a vowel-initial word is not an initial consonant.",
            "unresolved":"Missing or unrecognized pronunciations raise an error; they are never silently recorded as nonmatches.",
            "anchor":"Word-start only, not the first consonant found anywhere and not a relocated stressed-syllable onset.",
            "identity":"Occurrences must differ. Repeated spelling is allowed and reported separately; native E9 instead excludes same-spelling pairs.",
            "stress":"No stress threshold is imposed on this evidence relation. Stress-sensitive figure recognition requires a further declared rule.",
            "distance":"The relation covers all occurrence pairs. A remote match alone is not a claim of a locally salient rhetorical figure. Same-line candidates are supplied without claiming that one line is the universal proximity boundary.",
            "scope":"Annotated uses one existing pinned pronunciation per occurrence; dictionary_union is existential across the existing dictionary alternatives plus already-declared sourced additions. Both yield the same positive pairs here, but their complete-pronunciation witnesses differ.",
            "vowels":"Vowel-initial agreement is excluded. This is a first-consonant relation, not a first-phoneme rule that also accepts matching vowels or an empty-onset rule.",
            "clusters":"Only the first consonant must agree. Complete onset equality remains the stricter native E9. CH/JH are single affricate phones; W/Y are consonantal glides.",
        },
        "sources":[
            {"id":"poetry_foundation", "url":"https://www.poetryfoundation.org/education/glossary/Alliteration",
             "support":"Defines initial stressed consonant repetition, and explicitly allows different complete initial clusters, illustrated by pizza/place.",
             "retrieval":"Verified in search result; direct page fetch returned 403."},
            {"id":"american_poets", "url":"https://poets.org/glossary/alliteration",
             "support":"Defines grouped words sharing their first consonant sound; its examples include different s-initial clusters."},
            {"id":"poetry_archive", "url":"https://poetryarchive.org/glossary/alliteration/",
             "support":"Requires nearby sound repetition and distinguishes written initials from consonant sounds; admits word-start or first-stressed-syllable anchors. This relation deliberately implements only word-start evidence."},
        ],
        "source_sha256":{str(p.relative_to(root)):sha(p) for p in source_paths},
        "pronunciation_columns":["ARPAbet_phone_sequence"],
        "pronunciations":pronunciation_rows,
        "consonant_to_ipa":IPA,
        "occurrence_columns":["id", "stable_id", "word", "line", "word_index", "annotated_reading", "dictionary_readings", "annotation"],
        "occurrences":occurrence_rows,
        "scopes":scopes,
        "examples":examples,
        "integration":{
            "recommended":"Append independently named A1 without changing existing E9 bits, pair ordering, spelling identity conditions, or other categories.",
            "overlap":"A1=235 includes all147 E9 positives,37 additional different-spelling pairs with different complete onsets, and51 repeated-spelling pairs. A distinct-spelling-only adaptation would instead contain184.",
            "witness_policy":"For a displayed pronunciation pair, attach A1 only if that pair's first consonants agree. Complete witness reading IDs are supplied for every qualifying combination; do not attach a witness from another scope.",
            "nonmatches":"No per-pair prose or negative records are needed; all5778 pairs are evaluated and the compact positive lists are sufficient.",
        },
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    result = build(args.root.resolve())
    output = args.output or Path(__file__).with_name("alliteration_scope_results.json")
    output.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(json.dumps({"output":str(output), "counts":{k:v["counts"] for k,v in result["scopes"].items()}}, indent=2))


if __name__ == "__main__":
    main()
