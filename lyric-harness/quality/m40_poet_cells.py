"""M-40's declared follow-up cells; exploratory, never an admissibility update.

Run from lyric-harness: python3 -m quality.m40_poet_cells --output=PATH
All available nominated files are fixed below before observing results. Missing
Welsh nominations and the radif null problem are reported as separate blockers.
"""
import argparse
import dataclasses
import hashlib
import json
from pathlib import Path

from quality import relations as R, relations_null as N
from quality.lyric_reader import normalized_rows, READER_VERSION
from quality.phonology import get

ROOT = Path(__file__).resolve().parents[1]
CHAIN = "chain rhyme (interlocking scheme)"
# Supplemental panel: do not silently widen the historical nine-cell PANEL.
M40_PANEL = tuple(N.Slice(name, "corpus/song/" + filename, language, 40,
                         reader="normalized_one_song",
                         declare=("caesura:searched", "refrain:all_lines"),
                         note="M-40 nominated follow-up, first work, at most 40 lyric lines")
                  for name, filename, language in (
    ("kingsley", "eng_british_charles_kingsley.txt", "eng"),
    ("shakespeare", "eng_oxford_william_shakespeare.txt", "eng"),
    ("henley", "eng_pah_william_ernest_henley.txt", "eng"),
    ("keats", "eng_british_john_keats.txt", "eng"),
    ("shelley", "eng_british_percy_bysshe_shelley.txt", "eng"),
    ("byron", "eng_british_lord_byron.txt", "eng"),
    ("mynyddog", "cym_song_mynyddog.txt", "cym"),
)) + (N.Slice("ceiriog", "quality/fixtures/m40_ceiriog_nant_y_mynydd.txt",
              "cym", 40, reader="normalized_one_song",
              declare=("caesura:searched", "refrain:all_lines"),
              note="First poem in Gutenberg 3500, 1902 edition; declared before measurement"),)
TARGETS = {
    "ceiriog": ("cynghanedd lusg",),
    "kingsley": ("semirhyme",),
    "shakespeare": ("anaphora",),
    "henley": ("cross rhyme", "interlaced rhyme", "linked rhyme"),
    "keats": ("cross rhyme", "interlaced rhyme", "linked rhyme"),
    "shelley": ("cross rhyme", "interlaced rhyme", "linked rhyme", CHAIN),
    "byron": (CHAIN,),
    "mynyddog": ("cynghanedd lusg", "cynghanedd groes o gyswllt"),
}
BLOCKERS = {
    "Tudur Aled": "No nominated edition staged; the edition gate recorded in M-40(d) remains unresolved.",
    "epistrophe / radif": "Corpus expansion does not repair a null that destroys the defining refrain. No new qualification claimed.",
}


def run(n=200, cells=None):
    output = {"replicates": n, "seed": N.SEED, "reader": READER_VERSION,
              "scope": "exploratory follow-up; no promotion into the admissible set",
              "registry_size": len(R.REGISTRY), "blockers": BLOCKERS, "cells": []}
    output["implementation_sha256"] = {
        name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest()
        for name in ("quality/relations.py", "quality/relations_null.py",
                     "quality/lyric_reader.py", "lyric_harness.py")}
    for sl in (cells if cells is not None else M40_PANEL):
        print(sl.name, flush=True)
        path = ROOT / sl.path
        lines, stanzas, source, refused, failure = sl.read_grounded(str(ROOT))
        if failure is not None:
            output["cells"].append({"slice": dataclasses.asdict(sl), "refusal": dataclasses.asdict(failure)})
            continue
        phon = get(sl.language)
        rows, census = N.sweep(lines, phon, sl.language,
            schemas={name: R.REGISTRY[name] for name in TARGETS[sl.name]}, n=n,
            seed=N.SEED, budget=None, prepare=sl.prepare(),
            stanzas=stanzas, stanza_source=source)
        values = []
        for row in rows:
            record = dataclasses.asdict(row)
            record["kind"] = "refusal" if isinstance(row, R.Refusal) else "result"
            if isinstance(row, N.Result):
                record.update(clears=N.cleared(row), gap_to_max=row.gap_to_max,
                              differing=row.differing)
            values.append(record)
        normalized = [r.text for r in normalized_rows(path) if r.kind == "lyric"]
        output["cells"].append({"slice": dataclasses.asdict(sl),
            "source_sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            "full_file_lyric_lines": len(normalized),
            "normalized_sha256": hashlib.sha256("\n".join(normalized).encode()).hexdigest(),
            "lines": lines, "stanzas": stanzas, "stanza_source": source,
            "refused_marks": refused,
            "census": [dataclasses.asdict(c) for c in census], "results": values})
    return output


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True)
    parser.add_argument("--n", type=int, default=200)
    args = parser.parse_args()
    Path(args.output).write_text(json.dumps(run(args.n), ensure_ascii=False, indent=2) + "\n")
