#!/usr/bin/env python3
"""Run the record job's counters and map checks before pushing.

Usage: python3 tests/tools/check_generated_prepush.py
Runs from this script's checkout, regardless of the caller's directory. Requires
the same Python dependencies and staged lexical inputs as CI's record job; this
wrapper does not install or fetch them, regenerate files, or install a Git hook.

This checks working-tree bytes, not a prospective pushed commit. The map uses
git ls-files: untracked additions are invisible until added to the index, while
tracked edits are read from disk. Stage intended additions/deletions first;
regenerate with the relevant owners, commit all intended changes, then rerun on
the final clean checkout before pushing. Later edits, commits or rebases require
another check. This is only two gates, not a replacement for the record job/CI.
Non-ignored untracked harness files make this check fail even when both gates
pass. Ignored inputs are excluded from that inventory; this is not a Git audit.
"""

from pathlib import Path
import subprocess
import sys


def main():
    if len(sys.argv) != 1:
        print(__doc__, file=sys.stderr)
        return 2
    root = Path(__file__).resolve().parents[2]
    harness = root / "lyric-harness"
    print("Checking working-tree counters, then map (CI record-job order).", flush=True)
    print("Counters can take several minutes (CI has measured 154–232 seconds). "
          "Both checks run even if counters fails.", flush=True)
    print("Untracked files are not in the map; rerun after staging and committing "
          "the final changes. This does not certify a pushed commit or all CI gates.", flush=True)
    checks = (
        ("counters", "quality/counters.py",
         "For stale values/commands: cd lyric-harness && python3 quality/counters.py --write. "
         "Broken counters or malformed tables need the specific repair reported above; "
         "--write cannot fix those."),
        ("map", "map/build.py",
         "For generated-map drift, explicitly regenerate: cd lyric-harness && "
         "python3 map/build.py --write. If the checker requests a retrace, follow its diagnostic."),
    )
    failed = []
    try:
        inventory = subprocess.run(
            ["git", "ls-files", "--others", "--exclude-standard", "-z", "--", "lyric-harness/"],
            cwd=root, capture_output=True, check=True)
        untracked = [p for p in inventory.stdout.split(b"\0") if p]
        if untracked:
            failed.append("untracked harness files")
            print("FAIL: untracked harness files are invisible to the map:", file=sys.stderr)
            for path in untracked:
                print(f"  {path.decode(errors='backslashreplace')!r}", file=sys.stderr)
            print("Stage intended additions with git add, remove unintended files, then rerun. "
                  "Both checks will still run to report existing drift.", file=sys.stderr)
    except (OSError, subprocess.CalledProcessError) as error:
        failed.append("Git inventory unavailable")
        print(f"FAIL: cannot inspect untracked harness files: {error}", file=sys.stderr)
    for name, script, repair in checks:
        print(f"Running: cd lyric-harness && python3 {script} --check", flush=True)
        try:
            result = subprocess.run([sys.executable, script, "--check"], cwd=harness)
        except OSError as error:
            print(f"FAIL: could not run {name}: {error}. Check the checkout and Python setup.",
                  file=sys.stderr)
            failed.append(name)
            continue
        if result.returncode:
            print(f"FAIL: {name} check exited {result.returncode}. No automatic repair was attempted.",
                  file=sys.stderr)
            print(repair, file=sys.stderr)
            print("Resolve missing dependencies/input data first if reported. Coordinate generated "
                  "file edits with their owner, review the diff, commit and rerun this check.",
                  file=sys.stderr)
            failed.append(name)
    if failed:
        print("FAIL: generated-file pre-push check: " + "; ".join(failed), file=sys.stderr)
        return 1
    print("PASS: both generated-file checks passed for this working tree; no files regenerated.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
