"""Acceptance probe for H1 (#527 6193568101): a declared relation on a
repeated, multi-reading word whose token index holds the same word under
the v1 and v2 cuts but on different characters must still be JUDGED, as
at 5e97e06f; caller-side ambiguity refusals must still REFUSE.

    python3 h1_probe.py TREE OUT.json [PYTHON]

TREE is a checkout root (its lyric-harness/cmudict.dict staged). The probe
runs that tree's own `lyric_harness.py brief` for every case under the
`none` and `v2` lexicon supplements, passing `--numbering=v2` only where
the tree accepts the flag. Each run is classified from the tree's own
lyric-result record: JUDGED (the declared rhyme obligation answered),
UNJUDGED (refused / unreadable), REFUSED (the run refused before grading).
Exit 0 when every `judge` case is JUDGED and every `refuse` case REFUSED.
"""
import json, os, subprocess, sys, tempfile

TREE, OUT = sys.argv[1], sys.argv[2]
PY = sys.argv[3] if len(sys.argv) > 3 else sys.executable
HARNESS = os.path.join(TREE, "lyric-harness")
SRC = open(os.path.join(HARNESS, "lyric_harness.py"), encoding="utf-8").read()
HAS_NUMBERING = "--numbering=" in SRC

# (name, expect, line1, line2, groups, relation, numbering_flag_if_supported)
CASES = [
    ("read_dash", "judge", "Read--read, read it again", "the bed is made for me", "1.T2,2.T2", "perfect rhyme", True),
    ("lead_dash", "judge", "Lead--lead, lead the way", "the bed is made for me", "1.T2,2.T2", "perfect rhyme", True),
    ("wound_dash", "judge", "Wound--wound, wound it tight", "the ground is made for me", "1.T2,2.T2", "perfect rhyme", True),
    ("tear_dash", "judge", "Tear--tear, tear it down", "the care is made for me", "1.T2,2.T2", "perfect rhyme", True),
    ("live_dash", "judge", "Live--live, live it out", "the give is made for me", "1.T2,2.T2", "perfect rhyme", True),
    ("read_plain_control", "judge", "I read, I read it again", "the bed is made for me", "1.T2,2.T2", "perfect rhyme", True),
    # caller-side ambiguity (H4): unmarked N.Tn where the v1 and v2 cuts bind different characters
    ("unmarked_ambiguous", "refuse", "I 2 love you love", "the dove above", "1.T3,2.end", "perfect rhyme", False),
]

def run(argv):
    env = dict(os.environ, LYRIC_STAGED_DATA=os.environ.get("LYRIC_STAGED_DATA", os.path.join(HARNESS, "data")))
    p = subprocess.run([PY, "lyric_harness.py"] + argv, capture_output=True, text=True, env=env, cwd=HARNESS, timeout=600)
    rec = None
    for line in p.stdout.splitlines():
        if line.startswith("  lyric result: "):
            rec = json.loads(line[len("  lyric result: "):])
    return p.returncode, rec, p.stdout, p.stderr

def classify(rc, rec, out, err):
    if rec is None:
        return "REFUSED" if ("REFUSED" in out + err or rc == 2) else "ERROR"
    if rec.get("status") == "refused" or rec.get("refusal"):
        return "REFUSED"
    cov = rec.get("coverage") or {}
    obs = [o for o in cov.get("obligations", []) if str(o.get("id", "")).startswith("rhyme:")]
    if obs and all(o.get("status") in ("answered", "holds", "pass", "fails", "fail") for o in obs):
        return "JUDGED"
    if any(o.get("status") in ("refused", "unjudged", "unreadable") for o in obs) or cov.get("pairs_refused"):
        return "UNJUDGED"
    return "JUDGED" if cov.get("pairs_judged") else "UNJUDGED"

rows, ok = [], True
with tempfile.TemporaryDirectory() as td:
    for name, expect, l1, l2, groups, rel, numflag in CASES:
        draft = os.path.join(td, name + ".txt")
        open(draft, "w", encoding="utf-8").write(l1 + "\n" + l2 + "\n")
        for sup in ("none", "v2"):
            argv = [f"--lexicon-supplement={sup}", "--reader-scheme=v2", "brief", draft, f"--groups={groups}", f"--relation={rel}"]
            if numflag and HAS_NUMBERING:
                argv.append("--numbering=v2")
            rc, rec, out, err = run(argv)
            got = classify(rc, rec, out, err)
            obs = [(o.get("id"), o.get("status")) for o in ((rec or {}).get("coverage") or {}).get("obligations", []) if str(o.get("id", "")).startswith("rhyme:")]
            codes = sorted({f.get("code") for f in (rec or {}).get("findings", []) if f.get("code") in ("SCHEME_UNREADABLE",)})
            want = "JUDGED" if expect == "judge" else "REFUSED"
            passed = got == want
            ok &= passed
            rows.append({"case": name, "supplement": sup, "argv": argv[:2] + ["brief", "<draft>"] + argv[4:], "lines": [l1, l2],
                         "expect": want, "got": got, "pass": passed, "rc": rc, "rhyme_obligations": obs, "codes": codes,
                         "certified": ((rec or {}).get("coverage") or {}).get("certified"),
                         "refusal": ((rec or {}).get("refusal") or (out + err)[-300:] if got != "JUDGED" else None)})
            print(f"{name:20s} sup={sup:4s} expect={want:8s} got={got:8s} {'PASS' if passed else 'FAIL'} {obs} {codes}")
commit = subprocess.run(["git", "-C", TREE, "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
json.dump({"tree_commit": commit, "has_numbering_flag": HAS_NUMBERING, "ok": ok, "rows": rows}, open(OUT, "w"), indent=1, ensure_ascii=False)
print("OK" if ok else "FAIL", commit)
sys.exit(0 if ok else 1)
