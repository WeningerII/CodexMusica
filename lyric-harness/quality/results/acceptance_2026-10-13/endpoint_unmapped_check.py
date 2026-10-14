"""Endpoint-level binding and provenance for the default-end refusals the
occurrence oracle could not place (`unmapped`: a line holding a multi-piece
token, such as a spaced enclitic the cut joins).

    cd <tree>/lyric-harness
    python3 <this dir>/endpoint_unmapped_check.py SWEEP_GLOB OUT.json [HARNESS_ROOT] [EXTRA_LINES.json]

SWEEP_GLOB names `endpoint_guard_witness.py` receipts (.json or .json.gz).
For every line those receipts list as `unmapped` with a guarded refusal,
and for any EXTRA_LINES (a JSON list of lines, e.g. the slot tool's
excluded witnesses), in both aside modes under the v2 lexicon, it records
from the harness's own functions, with no span mapping by this tool:
- `slots.resolve(lex, line, 1)` for the default end: the number of
  readings, the syllables bound (with `widx` and spelling), the label and
  the unread words;
- `reader_line` tokens with their raw pieces, and the last token;
- `raw_final_token`;
- the guarded swap (production: `swap_end_word(line, mark, lex=lex)`) and
  the unguarded one (no lexicon), and which raw characters the unguarded
  edit replaced, found by a plain prefix/suffix diff of old and new text.
It classifies each line-mode:
- `zero_anchor`: the grader binds no syllable at the end, so the refusal is
  the contract's;
- `bound_endpoint`: the grader binds syllables and the last one sits on the
  line's last token;
- `bound_elsewhere`: the grader binds syllables on another token;
- `no_unguarded_edit`: nothing to compare.
A bound kind is NOT by itself collateral. `collateral` is true only where
the grader binds the end AND the guard changes the outcome (a guarded refusal
or an output that differs from the unguarded one); the `bound_endpoint` lines
in the 0af39c6f receipt are positive controls, guarded output equal to the
unguarded one (3PO, #527 6167341734).
Pins: commit, this tool's and `loop.py`'s sha256 only; the sweep receipts it
reads carry the fuller pins (corpus, lexicons, CMUdict, dirty state).
Read-only.
"""
import copy, glob, gzip, hashlib, json, os, sys

SWEEP, OUT = sys.argv[1], sys.argv[2]
ROOT = os.path.abspath(sys.argv[3] if len(sys.argv) > 3 else os.getcwd())
EXTRA = sys.argv[4] if len(sys.argv) > 4 else None
MARK = "zqzq"


def _load(p):
    op = gzip.open if p.endswith(".gz") else open
    with op(p, "rt", encoding="utf-8") as fh:
        return json.load(fh)


def main():
    sys.path.insert(0, ROOT)
    os.chdir(ROOT)
    import lyric_harness as LH
    from quality import slots as SL
    from quality import loop as LOOP
    from quality.coverage_census import build_lexicon
    base = build_lexicon("v2", "none")
    sung = copy.copy(base)
    sung.strip_parens = False
    lexes = {"cur:stripped": base, "cur:sung": sung}
    targets = {}
    for p in sorted(glob.glob(SWEEP)):
        for d in _load(p)["part1_real_inputs"]["lines_where_guard_changes_outcome"]:
            if d.get("with_guard") is None and (d.get("unguarded_judged") or {}).get("oracle") == "unmapped":
                targets.setdefault(d["line"], set()).add(d["mode"])
    extra = json.load(open(EXTRA, encoding="utf-8")) if EXTRA else []
    for line in extra:
        targets.setdefault(line, set()).update(lexes)
    rows, tally = [], {}
    for line in sorted(targets):
        for m in sorted(targets[line]):
            lex = lexes[m]
            anchors, label, oov = SL.resolve(lex, line, 1)
            toks = LH.reader_line(line, lex.strip_parens, scheme="v2").tokens
            last = toks[-1] if toks else None
            guarded = LOOP.swap_end_word(line, MARK, lex=lex)
            unguarded = LOOP.swap_end_word(line, MARK, scheme="v2")
            replaced = None
            if unguarded is not None:
                a = 0
                while a < min(len(line), len(unguarded)) and line[a] == unguarded[a]:
                    a += 1
                b = 0
                while b < min(len(line), len(unguarded)) - a and line[-1 - b] == unguarded[-1 - b]:
                    b += 1
                replaced = {"span": [a, len(line) - b], "text": line[a:len(line) - b]}
            ends = sorted({(s.get("widx"), s.get("word")) for r in anchors for s in r[-1:]}, key=str)
            if not anchors:
                kind = "zero_anchor"
            elif unguarded is None:
                kind = "no_unguarded_edit"
            elif last is not None and all(w == len(toks) - 1 for w, _ in ends):
                kind = "bound_endpoint"
            else:
                kind = "bound_elsewhere"
            collateral = bool(anchors) and guarded != unguarded
            tally[f"{m} | {kind}"] = tally.get(f"{m} | {kind}", 0) + 1
            if collateral:
                tally[f"{m} | collateral"] = tally.get(f"{m} | collateral", 0) + 1
            rows.append({"line": line, "mode": m, "kind": kind, "collateral": collateral, "source": "extra" if line in extra else "sweep",
                         "resolve": {"readings": len(anchors), "label": label, "unread": list(oov or []),
                                     "end_syllables": [list(e) for e in ends]},
                         "last_token": None if last is None else {"text": last.text, "pieces": [list(p) for p in last.pieces]},
                         "raw_final_token": LH.raw_final_token(line, lex.strip_parens, scheme="v2"),
                         "guarded": guarded, "unguarded": unguarded, "unguarded_replaced": replaced})
    rec = {"tally": tally, "lines": len(targets), "rows": rows,
           "pins": {"commit": os.popen(f"git -C {ROOT} rev-parse HEAD").read().strip(),
                    "tool_sha256": hashlib.sha256(open(os.path.abspath(__file__), "rb").read()).hexdigest(),
                    "loop_sha256": hashlib.sha256(open(os.path.join(ROOT, "quality", "loop.py"), "rb").read()).hexdigest()}}
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(rec, fh, indent=1, ensure_ascii=False)
    print(json.dumps({"lines": len(targets), "tally": tally}, indent=1))


if __name__ == "__main__":
    main()
