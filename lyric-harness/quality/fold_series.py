"""Time successive `--propose=defer:` FOLDS on a FLAGGED draft — the
M-170 time audit's item 3, as an instrument rather than a scratch script
(standing rule 3: a measurement used twice is a defect report).

Recipe (test_verbs §44's own): `plan --seed=SEED` declares N lines; the
draft is N filler lines `we carry the morning to the <word>`, every one
of them flagged under the plan-derived mandate; the command is
`finish DRAFT --seed=SEED --propose=defer:STATE` — the live path, the
blueprint and subdivision the plan's own. Each fold fills
`pending.answer` with a plausible one-liner from a pool, re-runs the
IDENTICAL command in a fresh process, and prints the wall time beside
the load-independent quantity: the grading calls the run reports.

Usage:  python3 quality/fold_series.py TAG [--seed=16] [--folds=6]
                [extra finish args...]      e.g.  a1 --attempts=1
Writes DRAFT and STATE under the scratch dir named by FOLD_SERIES_DIR
(default: a temp dir), never under the repo. Prints one line per fold;
it DECIDES nothing (doctrine 89: a series, not a number).
"""
import json
import os
import re
import subprocess
import sys
import tempfile
import time

HARN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BANK = ("stone rain door light road name glass train hill salt wire bell "
        "coat dust song tide map north paper").split()
POOL = ["and set it gently down beside the road",
        "then leave it on the step and close the gate",
        "a lantern hangs above the kitchen door",
        "the kettle ticks, the window holds the frost",
        "she folds the letter twice and says my name",
        "the last bus idles, someone waves it on",
        "and nobody has said the thing out loud",
        "the river takes the light and gives it back"]


def declared_lines(seed, extra=()):
    """-> the line count `plan --seed=SEED` declares, read off its report."""
    shape = [a for a in extra if a.startswith("--lines=")]
    p = subprocess.run([sys.executable, "lyric_harness.py", "plan", f"--seed={seed}", *shape],
                       cwd=HARN, capture_output=True, text=True)
    m = re.search(r"Write a song: (\d+) lines", p.stdout)
    if not m:
        sys.exit(f"REFUSED — plan --seed={seed} declared no line count "
                 f"(rc {p.returncode})")
    return int(m.group(1))


def answer_pending(pending, fold, answer_for_line=None):
    """Render every current deferred question; unknown kinds refuse explicitly."""
    choose = answer_for_line or (lambda line: POOL[(fold + line) % len(POOL)])
    kind, record = pending['kind'], pending['record']
    if kind == 'propose':
        return choose(record['line'])
    if kind == 'propose_group':
        members = record['members']
    elif kind == 'propose_batch':
        members = [row['line'] for row in record['records']]
    else:
        raise ValueError(f'unsupported pending kind: {kind}')
    return '\n'.join(f'L{line}: {choose(line)}' for line in members)


def main(argv):
    if not argv or argv[0].startswith("-"):
        sys.exit(__doc__)
    tag, extra = argv[0], []
    seed, folds = 16, 6
    for a in argv[1:]:
        if a.startswith("--seed="):
            seed = int(a.split("=", 1)[1])
        elif a.startswith("--folds="):
            folds = int(a.split("=", 1)[1])
        else:
            extra.append(a)
    d = os.environ.get("FOLD_SERIES_DIR") or tempfile.mkdtemp(prefix="fold_series_")
    os.makedirs(d, exist_ok=True)
    n = declared_lines(seed, extra)
    draft = os.path.join(d, f"draft{seed}_{tag}.txt")
    state = os.path.join(d, f"state{seed}_{tag}.json")
    if os.path.exists(state) or os.path.exists(draft):
        sys.exit("REFUSED — draft/state already exists; use a new tag to preserve evidence")
    with open(draft, "w") as f:
        f.write("".join(f"we carry the morning to the {BANK[i % len(BANK)]}\n"
                        for i in range(n)))
    cmd = [sys.executable, "lyric_harness.py", "finish", draft, f"--seed={seed}",
           f"--propose=defer:{state}"] + extra
    print(f"CMD: {' '.join(cmd)}   ({n} lines; dir {d})", flush=True)
    for fold in range(folds + 1):
        on_record = 0
        if os.path.exists(state):
            st = json.load(open(state))
            on_record = (len(st["answered"]["propose"])
                         + len(st["answered"]["propose_group"]))
        t0 = time.time()
        p = subprocess.run(["timeout", "600"] + cmd, cwd=HARN,
                           capture_output=True, text=True)
        wall = time.time() - t0
        memo = [l.strip() for l in p.stdout.splitlines()
                if "REPLAY MEMO" in l or "revise_loop:" in l]
        q, pend, rec = "(none)", None, None
        if os.path.exists(state):
            st = json.load(open(state))
            pend = st.get("pending")
            if pend:
                rec = pend["record"]
                q = (f"{pend['kind']} L{rec.get('line')} "
                     f"attempt={rec.get('attempt')} members={rec.get('members')}")
        print(f"FOLD {fold}: rc={p.returncode} wall={wall:.1f}s "
              f"answers_on_record={on_record} Q={q}", flush=True)
        for l in memo:
            print("    |", l[:170], flush=True)
        if p.returncode != 4:
            print("STOP (not suspended)", flush=True)
            for l in p.stdout.splitlines():
                if re.search(r"revise_loop|round \d|unresolved|FINISHED|STOP", l):
                    print("    #", l[:220], flush=True)
            if p.returncode not in (0, 3):
                print(p.stdout, p.stderr, flush=True)
                return 2
            return 0
        st["pending"]["answer"] = answer_pending(pend, fold)
        json.dump(st, open(state, "w"), indent=1)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
