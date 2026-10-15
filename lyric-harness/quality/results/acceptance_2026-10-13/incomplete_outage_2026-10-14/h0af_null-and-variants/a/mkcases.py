"""-> cases.json for drive.py (null-and-variants (a))."""
import json, sys
H = "/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/h0af/null-and-variants/a"
FX, SRC, L = H + "/fx", H + "/src", H + "/legacy"
FLAGS = {"nf": [], "f1": ["--reader-scheme=v1"], "f2": ["--reader-scheme=v2"]}
V7 = ["absent", "null", "v1", "v2", "v9", "empty", "upper"]
trees = sys.argv[2].split(",")
which = sys.argv[3].split(",") if len(sys.argv) > 3 else ["R", "T", "P", "K", "L", "N"]
cases = []
draft = {"draft.txt": SRC + "/draft.txt", "draft.txt.briefed.json": SRC + "/draft.txt.briefed.json"}
for tree in trees:
    for fk, fl in FLAGS.items():
        if "R" in which:
            for v in V7 + ["v2_answerednull", "absent_answerednull"]:
                cases.append({"name": f"R_{tree}_{v}_{fk}", "tree": tree, "state": "state.json",
                              "files": {**draft, "state.json": f"{FX}/ans_{v}.json"},
                              "args": fl + ["finish", "{WK}/draft.txt", "--seed=23", "--lines=12", "--propose=defer:{WK}/state.json"]})
        if "T" in which:
            for v in V7:
                cases.append({"name": f"T_{tree}_{v}_{fk}", "tree": tree, "state": "state.json",
                              "files": {**draft, "state.json": f"{FX}/unans_{v}.json"},
                              "args": fl + ["tryline", "{WK}/draft.txt", "9", "the stone is in the yard", "--seed=23", "--lines=12", "--propose=defer:{WK}/state.json"]})
        if "P" in which:
            for v in V7:
                cases.append({"name": f"P_{tree}_{v}_{fk}", "tree": tree, "state": "replay.json",
                              "files": {**draft, "replay.json": f"{FX}/replay_{v}.json"},
                              "args": fl + ["finish", "{WK}/draft.txt", "--seed=23", "--lines=12", "--propose=replay:{WK}/replay.json"]})
        if "K" in which:
            for v in V7:
                cases.append({"name": f"K_{tree}_{v}_{fk}", "tree": tree, "state": "ck.json",
                              "files": {"d2.txt": SRC + "/d2.txt", "d2.txt.briefed.json": SRC + "/d2.txt.briefed.json", "ck.json": f"{FX}/ck_{v}.json"},
                              "env": {"PYTHONPATH": H + "/mod", "LYRIC_CHECKPOINT_PATH": "{WK}/ck.json"},
                              "args": fl + ["revise", "{WK}/d2.txt", "AA", "--propose=call:skepwriter:factory"]})
        if "N" in which:   # following the advice "start a new run": a path with no record
            cases.append({"name": f"Nr_{tree}_new_{fk}", "tree": tree, "state": None,
                          "files": dict(draft),
                          "args": fl + ["finish", "{WK}/draft.txt", "--seed=23", "--lines=12", "--propose=defer:{WK}/state_new.json"]})
            cases.append({"name": f"Nk_{tree}_new_{fk}", "tree": tree, "state": None,
                          "files": {"d2.txt": SRC + "/d2.txt", "d2.txt.briefed.json": SRC + "/d2.txt.briefed.json"},
                          "env": {"PYTHONPATH": H + "/mod", "LYRIC_CHECKPOINT_PATH": "{WK}/ck_new.json"},
                          "args": fl + ["revise", "{WK}/d2.txt", "AA", "--propose=call:skepwriter:factory"]})
    if "L" in which:   # BB8's 67889851 legacy-replay-exec fixtures t1c / t5N / t2
        for v in ("null", "empty", "upper", "v9", "v2"):
            cases.append({"name": f"L1c_{tree}_{v}_nf", "tree": tree, "state": "state.json",
                          "files": {"d12.txt": L + "/t1v2/d12.txt", "d12.txt.briefed.json": L + "/t1v2/d12.txt.briefed.json",
                                    "state.json": f"{L}/t1v2/state_{v}.json"},
                          "args": ["tryline", "{WK}/d12.txt", "9", "the salt is on the line", "--seed=23", "--lines=12", "--propose=defer:{WK}/state.json"]})
        groups = open(L + "/fx/t5_groups.txt").read().strip()
        for fk, fl in FLAGS.items():
            for st in ("t5_answered_nullscheme", "t5_answered"):
                cases.append({"name": f"L5_{tree}_{st}_{fk}", "tree": tree, "state": "state.json",
                              "files": {"d6.txt": L + "/fx/t5_d6.txt", "d6.txt.briefed.json": L + "/fx/t5_ledger.json",
                                        "state.json": f"{L}/fx/{st}.json"},
                              "args": fl + ["revise", "{WK}/d6.txt", groups, "--attempts=1", "--propose=defer:{WK}/state.json"]})
            for rp in ("rp_null", "rp_v1", "rp_v2"):
                cases.append({"name": f"L2_{tree}_{rp}_{fk}", "tree": tree, "state": "rp.json",
                              "files": {"d2.txt": L + "/t2/d2.txt", "d2.txt.briefed.json": L + "/t2/d2.txt.briefed.json",
                                        "rp.json": f"{L}/fx/{rp}.json"},
                              "args": fl + ["revise", "{WK}/d2.txt", "AA", "--propose=replay:{WK}/rp.json"]})
json.dump(cases, open(sys.argv[1], "w"), indent=1)
print(len(cases), "cases")
