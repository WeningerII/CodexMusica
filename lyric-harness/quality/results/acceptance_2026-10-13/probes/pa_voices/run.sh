#!/usr/bin/env bash
# P-A acceptance probe: page payload (node replica) -> harness normalize-numbering.
#
#   run.sh TREE OUTDIR [LABEL] [HARNESS_TREE]
#
# TREE supplies src/pages/lyrics.js + src/lyric-tokens.js (the page side).
# HARNESS_TREE (default: TREE) supplies lyric-harness/lyric_harness.py, with
# its cmudict.dict staged. Set PY to the python to use (default python3) and
# LYRIC_STAGED_DATA as the harness needs. Writes OUTDIR/LABEL.json and
# OUTDIR/LABEL.summary.txt; exits like pa_harness.py (0 = no WRONG_WORD).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
tree="$(cd "$1" && pwd)"; out="$2"
label="${3:-$(git -C "$tree" rev-parse --short=9 HEAD)}"
htree="$(cd "${4:-$1}" && pwd)"
py="${PY:-python3}"
mkdir -p "$out"
cases="$(mktemp)"; trap 'rm -f "$cases"' EXIT
node "$here/pa_probe.js" "$tree" > "$cases"
set +e
"$py" "$here/pa_harness.py" "$htree" "$cases" "$out/$label.json" | tee "$out/$label.summary.txt"
code=${PIPESTATUS[0]}
exit "$code"
