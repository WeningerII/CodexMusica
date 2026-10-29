#!/usr/bin/env python3
"""Add existing Codex Musica classifications without rerunning E1–E22.

All predicates and lexical resources come from the pinned local checkout.
--reading selects the matching complete base population and pronunciation pins.
"""
from __future__ import annotations

import argparse
import collections
import hashlib
import json
import os
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(os.environ.get("FROST_ANALYSIS_ROOT", Path(__file__).resolve().parent)).resolve()
REPO = HERE / "CodexMusica"
HARNESS = REPO / "lyric-harness"
sys.path.insert(0, str(HARNESS))

import lyric_harness as LH
from quality import relations as R, morphology as MORPH
from quality.phonology.eng import English, _reading_scope
from quality.revise import Reviser
from run_frost_pairs import analysis_module_hashes, load_poem, reading_output_path

ADAPTER_VERSION = "frost-addon-contracts-v2"

BITS = {"E63": 1 << 22, "E66": 1 << 23, "H1": 1 << 24}
CATEGORIES = [
    ["E63", "homeoteleuton · shared ending", "homoioteleuton"],
    ["E66", "trite rhyme", "trite rhyme"],
    ["H1", "homeoteleuton · same spelled ending", "HOMEOTELEUTON"],
]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--reading", choices=("all", "annotated"), default="all")
    parser.add_argument("--base", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    base_path = args.base or reading_output_path(args.reading)
    output_path = args.output or reading_output_path(args.reading, addon=True)
    started = time.monotonic()
    import english_schema_contracts as contracts
    import poem_readings as readings

    module_hashes = analysis_module_hashes(contracts, readings)
    base = json.loads(base_path.read_text())
    source_sha = hashlib.sha256(base_path.read_bytes()).hexdigest()
    if base["method"].get("reading_scope") != args.reading:
        raise RuntimeError("The base comparison has a different or undeclared reading scope")
    if base["source"].get("analysis_modules") != module_hashes:
        raise RuntimeError("The base comparison must be rerun with the current analysis modules")
    assert len(base["pairs"]) == 5778
    commit = subprocess.check_output(
        ["git", "-C", str(REPO), "rev-parse", "HEAD"], text=True).strip()
    assert commit == base["source"]["commit"]
    poem = load_poem()
    lex = LH.Lexicon(reader_scheme="v2")
    phon = English(readings="all", lexicon=lex, reader_scheme="v2")
    if args.reading == "annotated":
        phon = readings.annotated_phonology(phon, poem)
        lex = phon.lexicon
    # Only its pure spelling/one-pair predicate methods are used. Supplying
    # an unused floor prevents the constructor from loading unrelated
    # tagging/grading resources; no floor or grade method is called here.
    reviser = Reviser(lex=lex, floor=object())

    def build(reader):
        reader = readings.normalize_reader(reader)
        stream = R.build_stream(poem, reader, stanzas=[n // 4 for n in range(16)],
                                stanza_source="supplied_poem_quatrains")
        R.declare_orthography(stream, LH.spelled_rime)
        return stream

    with _reading_scope():
        stream = build(phon)
    if json.dumps(stream.phon.declaration(), sort_keys=True) != json.dumps(
            base["source"]["phonology"], sort_keys=True):
        raise RuntimeError("The add-on pronunciation declaration does not match its base")
    tokens = [[w, li + 1, ti + 1]
              for li, words in enumerate(stream.lexical_tokens)
              for ti, w in enumerate(words)]
    assert tokens == base["tokens"] and len(tokens) == 108
    locations = [(li - 1, ti - 1) for _, li, ti in tokens]
    words = sorted({w.lower() for w, _, _ in tokens})
    affixes = {w: MORPH.affix(w) for w in words}
    spelled = reviser._spelled_rimes(words)
    schema_names = {"E63": "homoioteleuton", "E66": "trite rhyme"}
    schemas = {k: R.REGISTRY[n] for k, n in schema_names.items()}
    assert stream.supply("morphology").state == "present"
    absent_old = {(a, b): m for a, b, m in base["absence_only"]}
    old_witness_edges = collections.defaultdict(list)
    for a, b, mask, witness_id in base["witness_edges"]:
        old_witness_edges[(a, b)].append((mask, witness_id))

    # H1 observes the native same-spelled-rime predicate on existing tail
    # relationships. Pure onset, reverse/head, spelling-only and repetition
    # labels cannot independently establish an audible ending relationship.
    # This is an observation about already judged pairs; no grade, candidate
    # ranking, corpus-frequency rule or writing exclusion is requested.
    tail_ids = (1, 2, 4, 5, 7, 11, 12, 13, 14, 15, 16, 18)
    tail_mask = sum(1 << (n - 1) for n in tail_ids)
    counts = {key: collections.Counter() for key in BITS}
    shown = collections.Counter()
    variant_counts = collections.Counter()
    refusals = {key: collections.Counter() for key in schemas}
    pairs, absence, witness_edges = [], [], []
    witness_pool, witness_ids = [], {}

    def intern(records):
        key = tuple(records)
        if key not in witness_ids:
            witness_ids[key] = len(witness_pool)
            witness_pool.append(list(records))
        return witness_ids[key]

    with _reading_scope(), R._line_read_scope():
        for a, b, old_raw in base["pairs"]:
            aa, bb = locations[a - 1], locations[b - 1]
            wa, wb = tokens[a - 1][0].lower(), tokens[b - 1][0].lower()
            builder = R.cached_builder(build)
            raw, absent = 0, 0
            for key, schema in schemas.items():
                answer, witness = R.pair_satisfies_any(schema, stream, aa, bb, builder)
                if answer is True:
                    raw |= BITS[key]
                    counts[key]["true"] += 1
                    if key == "E63" and not affixes[wa] and not affixes[wb]:
                        absent |= BITS[key]
                    if witness:
                        variant_counts[key] += 1
                        if not absent & BITS[key]:
                            witness_edges.append([a, b, BITS[key], intern(witness)])
                elif answer is False:
                    counts[key]["false"] += 1
                elif answer is None:
                    counts[key]["undecided"] += 1
                elif isinstance(answer, R.Refusal):
                    counts[key]["refused"] += 1
                    refusals[key][answer.kind + ":" + ",".join(answer.missing or (answer.capability,))] += 1
                else:
                    raise TypeError((key, answer))

            old_display = old_raw & ~absent_old.get((a, b), 0)
            h1 = False
            if wa != wb and old_display & tail_mask and spelled[wa] and spelled[wa] == spelled[wb]:
                # Exact existing native predicate. Equality is prechecked
                # only to avoid invoking the unrelated modal-frequency tier.
                finding = reviser.earned_pair_ban({
                    "why": None,
                    "relations": [name for id_, name, _ in base["categories"]
                                  if old_display & (1 << (int(id_[1:]) - 1))],
                    "endwords": (wa, wb),
                    "lines": (tokens[a - 1][1], tokens[b - 1][1]),
                    "label": "observed occurrence pair",
                })
                h1 = finding is not None and finding.code == "HOMEOTELEUTON"
                assert h1
            counts["H1"]["true" if h1 else "false"] += 1
            if h1:
                raw |= BITS["H1"]
                # The spelling predicate is reading-independent once its
                # native lexical anchor is declared. Reuse the recorded
                # positive tail-sound witnesses supporting that observation.
                had_witness = False
                for supported, witness_id in old_witness_edges[(a, b)]:
                    if supported & old_display & tail_mask:
                        witness_edges.append([
                            a, b, BITS["H1"],
                            intern(base["reading_witnesses"][witness_id])])
                        had_witness = True
                variant_counts["H1"] += had_witness
            if raw:
                pairs.append([a, b, raw])
            if absent:
                absence.append([a, b, absent])
            for key, bit in BITS.items():
                shown[key] += bool(raw & ~absent & bit)

    assert len(base["pairs"]) == 5778
    assert all(sum(v.values()) == 5778 for v in counts.values())
    matches = {key: [(a, b) for a, b, mask in pairs if mask & bit]
               for key, bit in BITS.items()}
    assert matches["E66"] == [(8, 98), (8, 105)], matches["E66"]
    pairmap = {(a, b): m for a, b, m in pairs}
    assert pairmap[(8, 30)] & BITS["H1"]  # know / snow
    assert not pairmap.get((101, 108), 0) & BITS["H1"]  # repetition
    assert hashlib.sha256(base_path.read_bytes()).hexdigest() == source_sha

    output = {
        "format": "frost-classification-addon-v1",
        "source": {"repository": base["source"]["repository"], "commit": commit,
                   "base_sha256": source_sha,
                   "base_file": base_path.name,
                   "reading_scope": args.reading,
                   "phonology": stream.phon.declaration(),
                   "analysis_modules": module_hashes,
                   "adapter": {"version": ADAPTER_VERSION,
                               "sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest()},
                   "files": {p: hashlib.sha256((HARNESS / p).read_bytes()).hexdigest()
                             for p in ("quality/relations.py", "quality/morphology.py", "quality/quotients.py",
                                       "quality/revise.py", "lyric_harness.py")}},
        "method": {
            "judge": "Existing quality.relations.pair_satisfies_any over every original occurrence pair, using the same pronunciation scope and normalization as the matching complete E1–E22 base.",
            "reading_scope": args.reading,
            "schema_corrections": contracts.CORRECTIONS,
            "analysis": "All positive observed categories are retained regardless of the schema's writing-quality status. No lyric revision or preference filtering is applied.",
            "E63": "Native homoioteleuton schema with English.resources (quality.morphology.ENG_RESOURCES): final nucleus, coda and prominence agree; declared affix agrees; tokens differ. The existing bound-pair route removes placement only.",
            "E66": "Native trite rhyme schema: sound agreement plus the declared 30-pair CLICHE_PAIRS partition; no frequency threshold or invented extension. Bound-pair scope includes internal words.",
            "H1": "Native Reviser.earned_pair_ban HOMEOTELEUTON observation, using its stress-anchored _spelled_rimes; asked only for distinct words with an existing nonabsence tail-sound match and an equal nonempty spelled rime. Candidate ranking and the modal-frequency tier are never invoked.",
            "H1_tail_categories": [f"E{n}" for n in tail_ids],
            "absence_flags": "E63 raw positives based on two empty declared affixes are retained but marked absence-only; absence of an affix is not displayed as an actual shared ending.",
            "pronunciation": base["method"]["pronunciation"],
            "spelling_anchor": "H1 uses the existing Reviser lexicon-based stress anchor exactly; sound support is inherited from the matched pair in the selected reading population.",
            "H1_witnesses": "Existing positive reading witnesses for qualifying tail-sound labels are carried to H1 without inventing or re-running a pronunciation.",
        },
        "categories": CATEGORIES,
        "bit_positions": {key: bit.bit_length() - 1 for key, bit in BITS.items()},
        "pairs": pairs, "absence_only": absence,
        "reading_witnesses": witness_pool, "witness_edges": witness_edges,
        "counts": {"occurrences": 108, "unordered_pairs": 5778,
                   "by_category": {k: dict(v) for k, v in counts.items()},
                   "nonabsence_by_category": dict(shown),
                   "reading_search_matches": dict(variant_counts),
                   "refusal_reasons": {k: dict(v) for k, v in refusals.items() if v}},
        "category_notes": {
            "E63": "Matching final sound and a shared ending in Codex Musica's declared morphology resource. This heuristic identifies ending forms; it does not guarantee a word's contextual grammatical analysis.",
            "E66": "A matching sound pair on Codex Musica's declared trite-rhyme list. List membership is shown as an observation; the list does not exhaust familiar rhymes.",
            "H1": "An existing sound match with the same spelled ending from the native rhyming stress anchor. Separate from the shared-affix figure; repeated identical words keep their repetition label.",
        },
        "word_endings": [[w, affixes[w], spelled[w]] for w in words],
        "examples": {"E63": [[21, 52], [71, 85]],
                     "E66": [[8, 98], [8, 105]],
                     "H1": [[8, 30], [49, 62], [88, 94]]},
        "elapsed_seconds": round(time.monotonic() - started, 3),
    }
    staged = output_path.with_suffix(".staged.json")
    staged.write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")) + "\n")
    staged.replace(output_path)
    print(json.dumps({"file": str(output_path), "bytes": output_path.stat().st_size,
                      "counts": output["counts"], "seconds": output["elapsed_seconds"]}))


if __name__ == "__main__":
    main()
