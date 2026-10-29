#!/usr/bin/env python3
"""Poem adapter over Codex Musica's existing occurrence-pair judges.

FROST_ANALYSIS_ROOT may point to the analysis directory holding CodexMusica,
the output files, and the sibling frost_notation source when this is archived.
--reading selects the same full comparison under all or annotated readings.
"""
from __future__ import annotations

import argparse
import ast
import collections
import csv
import hashlib
import itertools
import json
import os
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(os.environ.get("FROST_ANALYSIS_ROOT", Path(__file__).resolve().parent)).resolve()
REPO = HERE / "CodexMusica"
HARNESS = REPO / "lyric-harness"
EXPECTED_COMMIT = "022fb015a9c567712e873fbf63f8e19a0ae2b417"
POEM_SOURCE = HERE.parent / "frost_notation" / "render_cohesive.py"
ADAPTER_VERSION = "frost-pair-contracts-v3"

# Existing canonical schema names. E10 is a label union; E22 has no judge.
SCHEMA_BY_ID = {
    1: "perfect rhyme", 2: "rime riche", 3: "repetition", 4: "assonance",
    5: "consonance", 6: "parechesis / general consonance", 7: "pararhyme",
    8: "reverse rhyme", 9: "alliteration", 11: "family rhyme",
    12: "additive rhyme", 13: "subtractive rhyme", 14: "semirhyme",
    15: "apocopated rhyme", 16: "light rhyme", 17: "wrenched rhyme",
    18: "syllabic rhyme", 19: "amphisbaenic rhyme", 20: "eye rhyme",
    21: "historical rhyme",
}

# Only these labels depend entirely on matching consonants. Other schemas
# can have positive vowel, identity, orthographic, or structural support.
CONSONANT_EVIDENCE_CHANNELS = {
    5: frozenset({"coda"}),
    7: frozenset({"onset", "coda"}),
    9: frozenset({"onset"}),
}


def bit(n):
    return 1 << (n - 1)


def reading_output_path(reading, *, addon=False):
    """Keep the two complete reading populations in separate files."""
    if reading not in {"all", "annotated"}:
        raise ValueError(f"Unknown reading scope: {reading}")
    if addon:
        name = ("frost_extra_classifications.json" if reading == "all"
                else "frost_annotated_extra_classifications.json")
    else:
        name = ("frost_rhyme_pairs.json" if reading == "all"
                else "frost_annotated_pairs.json")
    return HERE / name


def analysis_module_hashes(*modules):
    return {Path(module.__file__).name:
            hashlib.sha256(Path(module.__file__).read_bytes()).hexdigest()
            for module in modules}


def load_poem():
    for node in ast.parse(POEM_SOURCE.read_text()).body:
        if isinstance(node, ast.Assign) and any(
            isinstance(target, ast.Name) and target.id == "POEM"
            for target in node.targets
        ):
            lines = ast.literal_eval(node.value)
            assert len(lines) == 16
            return lines
    raise RuntimeError("The validated poem literal was not found")


def ids(mask):
    return [f"E{n}" for n in range(1, 23) if mask & bit(n)]


def consonant_support(R, schema, stream, at_a, at_b, channels):
    """Positive evidence in a TRUE native instance: True / False / unknown.

    Read the native instance's actual alignment and channel scopes. A vowel
    DIFFER read, lexical distinction, or consonant in an excluded syllable
    cannot support one of the matching-consonant labels.
    """
    members = []
    for at, rule in ((at_a, schema.spans[0]), (at_b, schema.spans[-1])):
        unit_ids = stream.tokens.get(at)
        if not unit_ids:
            return None
        try:
            spans = list(R._spans_at(rule, stream, unit_ids, "evidence"))
        except R.NoReferent:
            return None
        if not spans:
            return None
        members.append(spans)
    unplaced = R._pair_schema_unplaced(schema)
    unresolved = False
    for sa, sb in itertools.product(*members):
        if sa.idx == sb.idx:
            continue
        instance = R.evaluate(unplaced, sa, sb, stream)
        if instance is None:
            continue
        if instance.verdict is True and any(
            channel in channels and read.value is True and read.informative
            for channel, _position, read in instance.reads
        ):
            return True
        if instance.verdict is None:
            unresolved = True
    return None if unresolved else False


def consonant_support_any(R, k, schema, stream, at_a, at_b, builder):
    """Find positive native evidence in any whole reading, with its witness.

    A certain merged answer is conclusive. Otherwise try complete dictionary
    readings, continuing past empty true witnesses. Unknown or truncated
    negative searches stay unknown, never become an absence flag.
    """
    channels = CONSONANT_EVIDENCE_CHANNELS[k]
    support = consonant_support(R, schema, stream, at_a, at_b, channels)
    if support is not None:
        return support, None
    combos, complete = R.reading_combos(stream, {at_a, at_b})
    if not combos:
        return None, None
    unresolved = not complete
    for combo in combos:
        reader = R.pinned_phonology(stream, combo)
        if reader is None:
            unresolved = True
            continue
        alternative = builder(reader)
        ai = R._remap_token(stream, alternative, *at_a)
        bi = R._remap_token(stream, alternative, *at_b)
        if ai is None or bi is None:
            unresolved = True
            continue
        support = consonant_support(
            R, schema, alternative, (at_a[0], ai), (at_b[0], bi), channels
        )
        if support is True:
            return True, R.reading_witness(combo)
        if support is None:
            unresolved = True
    return (None if unresolved else False), None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--probe", action="store_true")
    parser.add_argument("--reading", choices=("all", "annotated"), default="all")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    args.output = args.output or reading_output_path(args.reading)
    start = time.monotonic()
    adapter_source = {
        "version": ADAPTER_VERSION,
        "sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    }
    commit = subprocess.check_output(
        ["git", "-C", str(REPO), "rev-parse", "HEAD"], text=True
    ).strip()
    if commit != EXPECTED_COMMIT:
        raise RuntimeError(f"Unexpected source revision: {commit}")

    sys.path.insert(0, str(HARNESS))
    import lyric_harness as LH
    from quality import relations as R
    from quality.phonology.eng import English, _reading_scope
    import english_schema_contracts as contracts
    import poem_readings as readings

    poem = load_poem()
    lexicon = LH.Lexicon(reader_scheme="v2")
    phon = English(readings="all", lexicon=lexicon, reader_scheme="v2")
    annotated = None
    if args.reading == "annotated":
        annotated = readings.annotated_manifest(phon, poem)
        phon = readings.annotated_phonology(phon, poem)
    schemas = contracts.audited_schemas()
    assert set(schemas) == set(SCHEMA_BY_ID), "The complete schema inventory changed"
    module_hashes = analysis_module_hashes(contracts, readings)

    def build(reader):
        # Native any-reading trials construct fresh English readers. Apply
        # the same declared normalization to every base and trial stream.
        reader = readings.normalize_reader(reader)
        stream = R.build_stream(
            poem, reader, stanzas=[i // 4 for i in range(16)],
            stanza_source="supplied_poem_quatrains",
        )
        R.declare_orthography(stream, LH.spelled_rime)
        return stream

    with _reading_scope():
        stream = build(phon)

    token_records = []
    locations = []
    for line, words in enumerate(stream.lexical_tokens):
        for position, word in enumerate(words):
            token_records.append([word, line + 1, position + 1])
            locations.append((line, position))
    n = len(token_records)
    assert n == 108, (n, token_records)
    total = n * (n - 1) // 2

    with (HARNESS / "quality" / "canon_index.tsv").open() as f:
        canon = {row["idx"]: row for row in csv.DictReader(f, delimiter="\t")}
    categories = []
    for k in range(1, 23):
        row = canon[f"E{k}"]
        categories.append([f"E{k}", row["name"], SCHEMA_BY_ID.get(k)])

    if args.probe:
        def find(word, line):
            return next(i for i, r in enumerate(token_records) if r[0].lower() == word and r[1] == line)
        pair_iterator = [
            (find("are", 1), find("village", 2)),
            (find("village", 2), find("to", 4)),
            (find("to", 4), find("before", 15)),
            (find("to", 4), find("up", 4)),
            (find("the", 2), find("between", 7)),
            (find("the", 2), find("easy", 12)),
            (find("whose", 1), find("his", 2)),
            (find("know", 1), find("snow", 4)),
            (find("see", 3), find("me", 3)),
            (find("sleep", 15), find("sleep", 16)),
            (find("i", 1), find("are", 1)),
            (find("miles", 15), find("miles", 16)),
        ]
        pair_iterator = [tuple(sorted(pair)) for pair in pair_iterator]
    else:
        pair_iterator = itertools.combinations(range(n), 2)

    pairs, absence_flags = [], []
    counts = {k: collections.Counter() for k in range(1, 23)}
    refusal_reasons = {k: collections.Counter() for k in range(1, 23)}
    audible_counts = collections.Counter()
    variant_counts = collections.Counter()
    witness_pool, witness_lookup, witness_edges = [], {}, []
    engine_true_pair_count = audible_true_pair_count = 0
    probe_rows = []

    with _reading_scope(), R._line_read_scope():
        for pno, (a, b) in enumerate(pair_iterator, 1):
            at_a, at_b = locations[a], locations[b]
            builder = R.cached_builder(build)
            answers, witnesses = {}, {}
            for k, schema in schemas.items():
                answer, witness = R.pair_satisfies_any(
                    schema, stream, at_a, at_b, builder
                )
                answers[k] = answer
                if witness:
                    witnesses[k] = witness
                    variant_counts[k] += 1
            # The agreed umbrella adds no phonetic predicate. Codex Musica's
            # assonance/consonance are inclusive; their union is kept so.
            if answers[4] is True or answers[5] is True:
                answers[10] = True
            elif answers[4] is False and answers[5] is False:
                answers[10] = False
            else:
                answers[10] = None
            answers[22] = "unverified"

            mask = 0
            for k in range(1, 23):
                answer = answers[k]
                if answer is True:
                    counts[k]["true"] += 1
                    mask |= bit(k)
                elif answer is False:
                    counts[k]["false"] += 1
                elif answer is None:
                    counts[k]["undecided"] += 1
                elif isinstance(answer, R.Refusal):
                    counts[k]["refused"] += 1
                    reason = answer.kind + ":" + ",".join(answer.missing or (answer.capability,))
                    refusal_reasons[k][reason] += 1
                elif k == 22:
                    counts[k]["unverified"] += 1
                else:
                    raise RuntimeError((k, answer))

            absent = 0
            for k in CONSONANT_EVIDENCE_CHANNELS:
                if answers[k] is not True:
                    continue
                support, evidence_witness = consonant_support_any(
                    R, k, schemas[k], stream, at_a, at_b, builder
                )
                if support is None:
                    raise RuntimeError(
                        f"Unresolved E{k} consonant evidence for "
                        f"{token_records[a]} / {token_records[b]}; "
                        "refusing to write unchecked output"
                    )
                if support:
                    if evidence_witness:
                        witnesses[k] = evidence_witness
                else:
                    absent |= bit(k)
                    witnesses.pop(k, None)
            if absent & bit(5) and answers[4] is not True:
                absent |= bit(10)
            audible = mask & ~absent
            pairs.append([a + 1, b + 1, mask])
            if absent:
                absence_flags.append([a + 1, b + 1, absent])
            engine_true_pair_count += bool(mask)
            audible_true_pair_count += bool(audible)
            for k in range(1, 23):
                if audible & bit(k):
                    audible_counts[k] += 1

            grouped_witnesses = collections.defaultdict(int)
            for k, witness in witnesses.items():
                if audible & bit(k):
                    key = tuple(witness)
                    grouped_witnesses[key] |= bit(k)
            for key, witness_mask in grouped_witnesses.items():
                if key not in witness_lookup:
                    witness_lookup[key] = len(witness_pool)
                    witness_pool.append(list(key))
                witness_edges.append([a + 1, b + 1, witness_mask, witness_lookup[key]])

            if args.probe:
                probe_rows.append({
                    "tokens": [token_records[a], token_records[b]],
                    "ids": ids(mask), "absence_only": ids(absent),
                    "displayed_ids": ids(audible),
                    "unresolved": [f"E{k}" for k, answer in answers.items()
                                   if answer is None or isinstance(answer, R.Refusal) or k == 22],
                    "witnesses": witnesses,
                })
            elif pno % 500 == 0:
                print(json.dumps({"pairs": pno, "of": total,
                                  "seconds": round(time.monotonic() - start, 1)}), flush=True)

    if args.probe:
        print(json.dumps({"tokens": n, "source": commit, "adapter": adapter_source,
                          "reading_scope": args.reading,
                          "analysis_modules": module_hashes,
                          "schema_corrections": contracts.CORRECTIONS,
                          "samples": probe_rows}, ensure_ascii=False, indent=2))
        return

    assert len(pairs) == total == 5778
    assert len({(a, b) for a, b, _ in pairs}) == total
    assert all(sum(counts[k].values()) == total for k in range(1, 23))
    file_hashes = {}
    for rel in ("quality/relations.py", "quality/rhyme_types.py", "quality/phonology/eng.py", "quality/canon_index.tsv", "cmudict.dict"):
        file_hashes[rel] = hashlib.sha256((HARNESS / rel).read_bytes()).hexdigest()

    output = {
        "format": "frost-word-pairs-v1",
        "source": {"repository": "https://github.com/WeningerII/CodexMusica", "commit": commit,
                   "sha256": file_hashes, "phonology": stream.phon.declaration(),
                   "adapter": adapter_source, "analysis_modules": module_hashes,
                   "reading_scope": args.reading, "annotated_reading": annotated},
        "method": {
            "judge": "quality.relations.pair_satisfies_any",
            "reading_scope": args.reading,
            "schema_corrections": contracts.CORRECTIONS,
            "bindings": "All actual poem (line,token) occurrence pairs; native bound-pair evaluator with the recorded English schema contracts. Only placement constraints are removed for explicit word bindings.",
            "pronunciation": (
                "All General American dictionary readings with the recorded vowel-quality normalization. A pair's ID set is the union across supported whole readings: different IDs need not hold in one simultaneous performance. Compact witnesses retain reading-dependent support."
                if args.reading == "all" else
                "One declared pronunciation per occurrence, aligned to the existing annotated reading and recorded in the source manifest, with the same vowel-quality normalization. Every pair and original category is evaluated under those pins."
            ),
            "E10": "Inclusive umbrella: native E4 OR native E5 in raw results; displayed E4 OR displayed E5 after evidence flags. It is an aggregation, not an additional phonetic predicate.",
            "E20": "Existing declare_orthography with lyric_harness.spelled_rime; default final vowel-group rule.",
            "E22": "Canon entry is unverified and has no executable schema; never inferred.",
            "direction": "A is the earlier global occurrence; B is the later. Directional IDs keep that orientation.",
            "absence_flags": "E5/E7/E9 require a true, informative matching-consonant read in a TRUE evaluated instance under at least one permitted whole reading, using the schema alignment and scopes. Only definitely unsupported matches are flagged; unresolved evidence stops the run. E10 is flagged when its only basis is flagged E5. Evidence flags do not alter the audited-schema result masks; witness edges support displayed labels only.",
        },
        "categories": categories,
        "token_columns": ["word", "line_1based", "position_1based"],
        "tokens": token_records,
        "pair_columns": ["occurrence_A_1based", "occurrence_B_1based", "E1_to_E22_bitmask"],
        "pairs": pairs,
        "absence_only": absence_flags,
        "reading_witnesses": witness_pool,
        "witness_edges": witness_edges,
        "counts": {
            "occurrences": n, "unordered_pairs": total, "category_slots": total * 22,
            "pairs_with_native_matches": engine_true_pair_count,
            "pairs_with_nonabsence_matches": audible_true_pair_count,
            "by_category": {f"E{k}": dict(counts[k]) for k in range(1, 23)},
            "nonabsence_by_category": {f"E{k}": audible_counts[k] for k in range(1, 23)},
            "refusal_reasons": {f"E{k}": dict(v) for k, v in refusal_reasons.items() if v},
            "reading_search_matches": {f"E{k}": v for k, v in variant_counts.items()},
            "base_stream_unreadable_occurrences": stream.unreadable,
        },
        "elapsed_seconds": round(time.monotonic() - start, 3),
    }
    temp = args.output.with_suffix(".staged.json")
    temp.write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")) + "\n")
    check = json.loads(temp.read_text())
    assert len(check["pairs"]) == total
    temp.replace(args.output)
    print(json.dumps({"output": str(args.output), "bytes": args.output.stat().st_size,
                      "pairs": total, "matched": engine_true_pair_count,
                      "nonabsence": audible_true_pair_count,
                      "seconds": output["elapsed_seconds"]}), flush=True)


if __name__ == "__main__":
    main()
