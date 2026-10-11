#!/usr/bin/env python3
"""THE MOBY CONVERTER-SCREENING PILOT: freeze the frame, then draw from it.

    python3 quality/pilot_frame.py --freeze   # writes the frozen frame
    python3 quality/pilot_frame.py --draw     # verifies it, then draws

THE PROTOCOL IS #527's, AGREED BEFORE ANY DRAW (BB8's proposal, 3PO's four
amendments, R2's sign-off of the split it reads):

FRAME. Every lexical lookup blocker of the DEV side of the frozen split
(quality/coverage_split.py, checked against the current corpus; items with a
non-lexical blocker are not in it, as the queue reads them) that the Moby
converter converts (quality/moby_convert.py) and the pinned CMUdict lacks.
The unit is the SPELLING; every converted reading of it is in the frame and
is judged. A spelling with any erroneous reading is an error.

STRATA, by the converter path that produced the reading -- a screen
certifies the converter, not word classes. A spelling goes to the
highest-priority path any of its readings triggered, in STRATA order.

DRAW. Each stratum's spellings, sorted; a stratum of 59 or more draws
random.Random(f"{SEED}:{stratum}").sample(spellings, 59), a smaller one is
audited in full. The draw first re-derives the frozen frame and refuses if
it moved.

JUDGING (3PO), ERRORS, PASS AND RETEST RULES: #527 -- not encoded here,
because they are judgements; this file only freezes and draws.

The frozen frame records the split file's sha256, the selected dev units'
digest, the corpus digest, the converter's output digest, the mpron.txt and
CMUdict hashes, the commit of every source the frame comes from, and a
digest of the frame itself.
"""
import argparse
import collections
import hashlib
import json
import os
import random
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

SEED = "20261011"
SAMPLE = 59
FRAME_PATH = os.path.join(HERE, "results", "pilot_frame_2026-10-11.json")
SAMPLE_PATH = os.path.join(HERE, "results", "pilot_sample_2026-10-11.tsv")
SOURCES = ("quality/pilot_frame.py", "quality/moby_convert.py",
           "quality/coverage_queue.py", "quality/coverage_census.py",
           "quality/coverage_split.py")

#: (stratum, test on the set of conversion-log entries of one reading), in
#: priority order: the first that any reading of a spelling triggers wins.
STRATA = (
    ("extension", lambda logs: any(x.startswith("ext:") for x in logs)),
    ("r-colour rule", lambda logs: any("schwa+r" in x or "[@]r" in x for x in logs)),
    ("OW+r rule", lambda logs: any(x.startswith("rule:OW+r") for x in logs)),
    ("hw merger", lambda logs: any("hw->W" in x for x in logs)),
    ("monosyllable stress convention",
     lambda logs: any("monosyllable" in x for x in logs)),
    ("double consonant", lambda logs: any("double-consonant" in x for x in logs)),
    ("legend only, source-marked stress", lambda logs: True),
)


def _sha(data):
    return hashlib.sha256(data).hexdigest()


def _file_sha(path):
    with open(path, "rb") as fh:
        return _sha(fh.read())


def _source_commit():
    def git(*args):
        return subprocess.run(["git", *args], cwd=ROOT, capture_output=True,
                              text=True, check=True).stdout.strip()
    try:
        head = git("rev-parse", "HEAD")
        dirty = git("status", "--porcelain", "--", *SOURCES)
    except (OSError, subprocess.CalledProcessError):
        return None
    return head + ("+dirty" if dirty else "") if head else None


def stratum_of(readings):
    for name, hit in STRATA:
        if any(hit(set(r["logs"])) for r in readings):
            return name
    raise AssertionError("the last stratum takes every reading")


def build():
    """-> the frame record (deterministic; no timestamps)."""
    import lyric_harness as LH
    from quality import moby_convert as M
    from quality.coverage_census import build_lexicon, inputs_sha256, split_record
    from quality.coverage_queue import blockers
    from quality.coverage_split import checked_assignment
    lex = build_lexicon("none", "none")
    items, nonlexical, _tokens, _case = blockers(lex)
    dev_blockers = set().union(*items) if items else set()
    mpron = M.staged_mpron()
    if _file_sha(mpron) != M.MPRON_SHA256:
        raise SystemExit("REFUSED: the staged mpron.txt is not the pinned file")
    E, _C, logs = M.load(mpron, keep_logs=True)
    cmu = LH.Lexicon().entries
    frame = []
    for w in sorted(dev_blockers):
        if w not in E or w in cmu:
            continue
        readings = [{"moby": src, "phones": " ".join(a), "logs": sorted(lg)}
                    for src, a, lg in logs[w] if a]
        frame.append({"spelling": w, "stratum": stratum_of(readings),
                      "readings": readings})
    assignment, meta = checked_assignment()
    keep = {u for u, side in assignment.items() if side == "dev"}
    files = sorted({os.path.join(ROOT, u.split("#")[0]) for u in assignment})
    sizes = collections.Counter(f["stratum"] for f in frame)
    return {
        "version": 1, "protocol": "PR #527 (BB8 proposal 6104847635; 3PO "
                                  "amendments 6104984736, adopted 6105384997)",
        "seed": SEED, "sample_per_large_stratum": SAMPLE,
        "bindings": {
            "split": split_record("dev", keep, meta),
            "corpus_inputs_sha256": inputs_sha256(files),
            "dev_completable_items": len(items),
            "dev_items_blocked_nonlexically": nonlexical,
            "converter_output_sha256": M.converted_digest(E),
            "mpron_sha256": M.MPRON_SHA256,
            "cmudict_sha256": _file_sha(LH.CMUDICT_PATH),
            "lexicon": "none (CMUdict alone)",
            "source_commit": _source_commit(),
        },
        "strata": [{"name": n, "spellings": sizes[n],
                    "treatment": ("random %d" % SAMPLE if sizes[n] >= SAMPLE
                                  else "full audit")}
                   for n, _hit in STRATA],
        "spellings": len(frame),
        "readings": sum(len(f["readings"]) for f in frame),
        "frame_sha256": frame_digest(frame),
        "frame": frame,
    }


def frame_digest(frame):
    return _sha(json.dumps(frame, sort_keys=True, ensure_ascii=False).encode())


def authenticated(frozen, rec):
    """-> None when the stored frame may be drawn from, else the reason.

    The stored PAYLOAD is hashed itself -- not only the stored header -- and
    both must equal the frame re-derived now, as must the split and converter
    bindings (3PO's #541 review: comparing headers alone let an edited
    stored reading or stratum be sampled under the old digest)."""
    if frame_digest(frozen["frame"]) != frozen["frame_sha256"]:
        return "the stored frame's own digest is not its header's"
    if frozen["frame_sha256"] != rec["frame_sha256"]:
        return "the frame re-derived now is not the frozen one"
    for key in ("split", "converter_output_sha256", "corpus_inputs_sha256"):
        if frozen["bindings"][key] != rec["bindings"][key]:
            return f"the frozen binding {key} moved"
    return None


def draw(rec):
    """-> [(stratum, spelling, readings)] in stratum order, then spelling."""
    by = collections.defaultdict(list)
    for f in rec["frame"]:
        by[f["stratum"]].append(f)
    out = []
    for name, _hit in STRATA:
        pool = sorted(by.get(name, []), key=lambda f: f["spelling"])
        chosen = (random.Random(f"{SEED}:{name}").sample(pool, SAMPLE)
                  if len(pool) >= SAMPLE else pool)
        out += [(name, f["spelling"], f["readings"])
                for f in sorted(chosen, key=lambda f: f["spelling"])]
    return out


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    mode = ap.add_mutually_exclusive_group(required=True)
    mode.add_argument("--freeze", action="store_true")
    mode.add_argument("--draw", action="store_true")
    a = ap.parse_args(argv)
    rec = build()
    if a.freeze:
        os.makedirs(os.path.dirname(FRAME_PATH), exist_ok=True)
        with open(FRAME_PATH, "w", encoding="utf-8") as fh:
            json.dump(rec, fh, indent=1, sort_keys=True, ensure_ascii=False)
            fh.write("\n")
        print(json.dumps({k: v for k, v in rec.items() if k != "frame"},
                         indent=1, sort_keys=True))
        print(f"wrote {os.path.relpath(FRAME_PATH, ROOT)}")
        return 0
    with open(FRAME_PATH, encoding="utf-8") as fh:
        frozen = json.load(fh)
    why = authenticated(frozen, rec)
    if why:
        print(f"REFUSED: {why}; a moved frame is re-frozen and re-announced "
              f"before any draw")
        return 1
    rows = ["stratum\tspelling\treadings"]
    # Drawn from the frame RE-DERIVED now, which the checks above prove equal
    # to the frozen one -- never from stored rows alone.
    for name, w, readings in draw(rec):
        rows.append(f"{name}\t{w}\t" + " | ".join(
            f"{r['phones']} [{r['moby']}]" for r in readings))
    text = (f"# pilot draw -- frame {frozen['frame_sha256']}, seed {SEED}; "
            f"generated by quality/pilot_frame.py --draw\n" + "\n".join(rows) + "\n")
    with open(SAMPLE_PATH, "w", encoding="utf-8") as fh:
        fh.write(text)
    print(f"drew {len(rows) - 1} spellings; wrote {os.path.relpath(SAMPLE_PATH, ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
