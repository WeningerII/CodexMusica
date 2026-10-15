#!/usr/bin/env bash
# One-command qualifier for a Lyrics release tree (BB8, 2026-10-15).
#
#   qualify_combined.sh TREE OUTDIR [CONTROL_TREE] [BASE_REF]
#
# TREE          checkout root of the exact tree to qualify (cmudict.dict is
#               staged into it if missing; node_modules symlinked if missing).
# OUTDIR        where every log and JSON lands; SUMMARY.txt is the verdict.
# CONTROL_TREE  tree for the unchanged-fields gate: TREE without the tools
#               lane's harness change (skip the gate if omitted).
# BASE_REF      ref the lint step diffs against (default origin/main).
#
# Env: LYRIC_STAGED_DATA (data dir with the gitignored assets; required),
#      PY (python, default python3), PLAYWRIGHT_BROWSERS_PATH, NODE_PATH,
#      CMUDICT (a cmudict.dict to stage), REPS (real-key repetitions, 5).
#
# Python probes run first and in parallel; browser checks run afterwards and
# one at a time, because the natural-timing check is timing-sensitive.
# Exit 0 only when every step that ran passed. Headless emulation only: no
# physical device, on-screen keyboard, IME or assistive technology.
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
probes="$(cd "$here/.." && pwd)"
acc="$(cd "$probes/.." && pwd)"
tree="$(cd "$1" && pwd)"; out="$(mkdir -p "$2" && cd "$2" && pwd)"
ctrl="${3:-}"; base="${4:-origin/main}"
py="${PY:-python3}"; reps="${REPS:-5}"
: "${LYRIC_STAGED_DATA:?set LYRIC_STAGED_DATA to a data dir holding the gitignored assets}"
export LYRIC_STAGED_DATA PY="$py"

[ -f "$tree/lyric-harness/cmudict.dict" ] || cp "${CMUDICT:?cmudict.dict missing in TREE; set CMUDICT}" "$tree/lyric-harness/cmudict.dict"
[ -e "$tree/node_modules" ] || ln -s "$(git -C "$here" rev-parse --show-toplevel)/node_modules" "$tree/node_modules"
if [ -n "$ctrl" ]; then ctrl="$(cd "$ctrl" && pwd)"
  [ -f "$ctrl/lyric-harness/cmudict.dict" ] || cp "$tree/lyric-harness/cmudict.dict" "$ctrl/lyric-harness/cmudict.dict"; fi

head_sha="$(git -C "$tree" rev-parse HEAD)"
summary="$out/SUMMARY.txt"
{ echo "tree $head_sha  ($(date -u +%FT%TZ))"; echo "control ${ctrl:+$(git -C "$ctrl" rev-parse HEAD)}"; } > "$summary"
fail=0
rec() { printf '%-26s %-5s %s\n' "$1" "$2" "$3" | tee -a "$summary"; [ "$2" = PASS ] || [ "$2" = SKIP ] || fail=1; }

# ---- 1. build: the committed codex.html equals a fresh build ---------------
committed="$(git -C "$tree" show HEAD:codex.html | sha256sum | cut -c1-16)"
(cd "$tree" && node scripts/build_html.js --out="$out/codex.rebuilt.html" --check --quiet) > "$out/build.log" 2>&1
rebuilt="$(sha256sum "$out/codex.rebuilt.html" 2>/dev/null | cut -c1-16)"
[ -n "$rebuilt" ] && [ "$committed" = "$rebuilt" ] && rec build PASS "codex.html $committed = fresh build" \
  || rec build FAIL "committed $committed, rebuilt ${rebuilt:-none} (build.log)"

# ---- 2. python probes, in parallel ------------------------------------------
( cd "$tree/lyric-harness" && "$py" "$probes/h1_pin_guard/h1_probe.py" "$tree" "$out/h1.json" "$py" > "$out/h1.log" 2>&1; echo $? > "$out/h1.rc" ) &
( bash "$probes/pa_voices/run.sh" "$tree" "$out/pa" combined > "$out/pa.log" 2>&1; echo $? > "$out/pa.rc" ) &
if [ -n "$ctrl" ]; then
  ( cd "$tree/lyric-harness" && "$py" "$probes/unchanged_fields/unchanged_fields.py" "$tree" "$ctrl" "$out/unchanged_fields.json" "$py" > "$out/unchanged_fields.log" 2>&1; echo $? > "$out/uf.rc" ) &
fi
wait
[ "$(cat "$out/h1.rc")" = 0 ] && rec h1_probe PASS "$(grep -c PASS "$out/h1.log")/14 cases" || rec h1_probe FAIL "$(grep -c FAIL "$out/h1.log") failing rows (h1.log)"
[ "$(cat "$out/pa.rc")" = 0 ] && rec pa_voices PASS "$(grep '^all:' "$out/pa.log")" || rec pa_voices FAIL "$(grep '^all:' "$out/pa.log") (pa.log)"
if [ -n "$ctrl" ]; then
  [ "$(cat "$out/uf.rc")" = 0 ] && rec unchanged_fields PASS "$(grep -c ' PASS$' "$out/unchanged_fields.log") runs, no field moved" \
    || rec unchanged_fields FAIL "$(grep -c ' FAIL$' "$out/unchanged_fields.log") failing runs (unchanged_fields.log)"
else rec unchanged_fields SKIP "no CONTROL_TREE given"; fi

# ---- 3. browser checks, one at a time ---------------------------------------
run_node() { # name script [env...]
  local name="$1" script="$2"; shift 2
  if [ ! -f "$tree/scripts/$script" ]; then rec "$name" SKIP "scripts/$script not in tree"; return; fi
  (cd "$tree" && env "$@" TEST_EVIDENCE="$out/$name" node "scripts/$script") > "$out/$name.log" 2>&1
  local rc=$?; local last; last="$(grep -E 'PASS|FAIL' "$out/$name.log" | tail -1 | cut -c1-110)"
  [ $rc = 0 ] && rec "$name" PASS "$last" || rec "$name" FAIL "rc $rc: $last"
}
run_node page_suite check_lyrics_page.js
run_node viewport check_lyrics_viewport.js
run_node gate check_lyrics_gate.js
run_node natural_resize check_lyrics_natural_resize.js
run_node lyrics_evidence test_lyrics_evidence.js

# real key events (page.keyboard): typing at 0/16/33 ms/settle and ArrowRight
# at 0 ms must leave line 30 visible in every repetition.
REPS="$reps" node "$acc/review_562/rev5/probe_keys.js" "$tree" 30 > "$out/keys.json" 2> "$out/keys.err"
node -e '
const r = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
const must = r.filter((x) => x.act === "type" || x.act === "ArrowRight");
const bad = must.filter((x) => !x.line.visible);
const tab = {}; for (const x of r) { const k = x.act + "@" + x.delay; tab[k] = tab[k] || [0, 0]; tab[k][0] += x.line.visible ? 1 : 0; tab[k][1]++; }
console.log(JSON.stringify(tab)); process.exit(bad.length ? 1 : 0);' "$out/keys.json" > "$out/keys_table.txt" 2>&1
[ $? = 0 ] && rec real_keys PASS "type 0/16/33/settle + ArrowRight visible $reps/$reps" \
  || rec real_keys FAIL "$(cat "$out/keys_table.txt" | cut -c1-110)"

# ---- 4. lint on files changed against BASE_REF -------------------------------
changed="$(cd "$tree" && git diff --name-only --diff-filter=AM "$base"...HEAD -- '*.js' '*.mjs' '*.css' | grep -vE '^(codex\.html|lyric-harness/quality/results/)' || true)"
if [ -n "$changed" ]; then
  (cd "$tree" && npx --no-install eslint $(echo "$changed" | grep -E '\.m?js$') && npx --no-install prettier --check $changed) > "$out/lint.log" 2>&1
  [ $? = 0 ] && rec lint PASS "$(echo "$changed" | wc -l) changed files" || rec lint FAIL "(lint.log)"
else rec lint SKIP "no changed js/css against $base"; fi

echo "VERDICT $([ $fail = 0 ] && echo PASS || echo FAIL)" | tee -a "$summary"
exit $fail
