#!/usr/bin/env python3
"""Capture real Library backend records for the connection views' reading cases.

The three committed connection fixtures (`scripts/fixtures/connection-backend*.json`)
all carry `reading_search.state: not_needed`, no witness, no undecided edge and an
empty `reading_dependent_tokens`, so no real backend record exercises a reading
branch on the frontend. This captures one analysis per reading case from the
backend's own acceptance scenarios (lyric-harness/library/test_analysis.py and
test_connection_acceptance.py), in the same {records, identity, summary} shape:

  witness_first      first compatible reading wins; search partial (zee)
  combination_cap    EDGE_COMBOS=1: undecided edge, reason combination_cap (zeed)
  reading_dependent  a merged word named in domain.reading_dependent_tokens (zeeta)
  refused_cap        MINI_CAP=0: method refused, refusal.kind reading_combinations
                     (zibbet / zoddet)

Fixture words are patched into the lexicon exactly as the backend tests do; no
corpus, network or model is touched. Re-run from the repository root; the
script formats its output with the repository's Prettier so `format:check`
holds:
    python3 scripts/capture_connection_reading_fixtures.py
"""
import json
import os
import subprocess
import sys
from unittest.mock import patch

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "lyric-harness"))
os.chdir(os.path.join(ROOT, "lyric-harness"))

from library.analysis import AnalysisSession  # noqa: E402
from library.test_analysis import _with_words, complete, source  # noqa: E402

OUT = os.path.join(ROOT, "scripts", "fixtures", "connection-backend-reading.json")

CASES = {
    "witness_first": dict(
        words={"zee": [["Z", "IY1"], ["Z", "AH0"]]},
        text="zee is home\nand bee is too", schemas=["internal rhyme"], patches={}),
    "combination_cap": dict(
        words={"zeed": [["Z", "IY1", "D"], ["Z", "UW1", "T"]]},
        text="zeed is home\nand beet is too", schemas=["internal rhyme"],
        patches={"EDGE_COMBOS": 1}),
    "reading_dependent": dict(
        words={"zeeta": [["Z", "IY1", "T", "AH0"], ["Z", "IY0", "T", "AH1"]]},
        text="the zeeta came\nwe bring the beta home", schemas=["internal rhyme"], patches={}),
    "refused_cap": dict(
        words={"zibbet": [["B", "AH1", "T"], ["AH0", "B", "IY1", "T"]],
               "zoddet": [["D", "EH1", "T"], ["AH0", "D", "IY1", "T"]]},
        text="I saw the zibbet\nAnd then the zoddet", schemas=["perfect rhyme"],
        patches={"MINI_CAP": 0}),
}


def capture(case):
    patches = [patch.object(AnalysisSession, k, v) for k, v in case["patches"].items()]
    with _with_words(case["words"]):
        for p in patches:
            p.start()
        try:
            _, rows, last = complete(source(case["text"]), schemas=case["schemas"])
        finally:
            for p in reversed(patches):
                p.stop()
    return {"records": rows, "identity": last["identity"], "summary": last["summary"]}


def main():
    captures = {name: capture(case) for name, case in CASES.items()}
    doc = {"generator": "scripts/capture_connection_reading_fixtures.py", "captures": captures}
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, indent=1, sort_keys=True, ensure_ascii=False)
        fh.write("\n")
    subprocess.run(["npx", "prettier", "--write", OUT], cwd=ROOT, check=True,
                   stdout=subprocess.DEVNULL)
    print(f"wrote {os.path.relpath(OUT, ROOT)}: " + ", ".join(
        f"{n} ({len(c['records'])} records)" for n, c in captures.items()))


if __name__ == "__main__":
    main()
