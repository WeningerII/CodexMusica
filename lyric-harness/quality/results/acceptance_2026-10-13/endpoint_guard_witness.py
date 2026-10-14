"""An executable witness for the default end's endpoint-occurrence guard
(`quality/loop.py` `_end_occurrence_bound`, reader-batch head 58de1816 on).

    cd <tree>/lyric-harness
    python3 <this dir>/endpoint_guard_witness.py OUT.json [HARNESS_ROOT] [SHARD/SHARDS]

3PO asked for it (#527, 6163217917): on the 3,990-line slot population the
guard changes 0 of 15,870 `end` records against 67889851, so the population
never exercises it.

PART 1, REAL INPUTS. Every UNIQUE reader line text of `corpus/song/eng_*`
(deduplicated in first-seen order, then sharded), under the v2
lexicon with asides stripped and sung (the slot tool's two process-scheme
modes). Each line's default end is swapped twice:
- `with_guard`: `swap_end_word(line, mark, lex=lex)`, as production calls it
  (scheme from the lexicon);
- `protections_only`: `swap_end_word(line, mark, scheme="v2")`, the same
  function with no lexicon, so the guard does not run.
A line where the two differ is a real input on which the guard changes the
outcome. Each one is judged by the occurrence oracle (`slot_binding._bound`
and `_edited`): what the unguarded edit would have replaced, and what the
grader binds.

PART 2, FOCUSED CASES. A grader whose endpoint is NOT the swap's last token
is simulated by replacing `quality.loop._RESOLVE` (the reviser's own binding
of `slots.resolve`) and `slots.resolve` together, so the reviser and the
oracle see the same grader. For each case: the guarded swap (production), the
same swap with `_end_occurrence_bound` forced True (the guard removed), and
the oracle's verdict on each. The guard is witnessed when the guarded swap
refuses and the unguarded one edits a token the grader does not bind
(`occ_wrong` or `edit_unbound`). Controls: on the same lines with the real
resolver, guarded and unguarded swaps agree.

Exit 0 when part 2 witnesses the guard on every focused case and every
control agrees; 1 otherwise; 3 on error. Part 1 is reported, never gated: a
count of 0 is a finding about the corpus, not about the guard.
"""
import copy, glob, hashlib, importlib.util, json, os, subprocess, sys

OUT = sys.argv[1]
ROOT = os.path.abspath(sys.argv[2] if len(sys.argv) > 2 else os.getcwd())
SHARD = tuple(int(x) for x in sys.argv[3].split("/")) if len(sys.argv) > 3 else (0, 1)
HERE = os.path.dirname(os.path.abspath(__file__))
#: (line, the token index the rigged grader ends on, the word it reports)
#: -- each a line whose last token is NOT where the rigged grader ends.
FOCUSED = [
    ("I want to hold it", 3, "hold"),
    ("do me a favour, do", 0, "do"),          # another occurrence of the same spelling
    ("love, love me do", 1, "love"),
    ("the night and the day goes on", 4, "day"),
]
MARK = "zqzq"


def _sha(p):
    with open(p, "rb") as fh:
        return hashlib.sha256(fh.read()).hexdigest()


def main():
    sys.path.insert(0, ROOT)
    os.chdir(ROOT)
    import lyric_harness as LH
    from quality import slots as SL
    from quality import loop as LOOP
    from quality.coverage_census import build_lexicon
    spec = importlib.util.spec_from_file_location("sb", os.path.join(HERE, "slot_binding.py"))
    sb = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(sb)
    sb.LH, sb.SL, sb.swap_at_slot, sb.ROOT = LH, SL, LOOP.swap_at_slot, ROOT
    sb.LOOP_WORD_RE = getattr(LOOP, "_WORD_RE", None)
    if not hasattr(LOOP, "_end_occurrence_bound"):
        raise SystemExit("this tree has no _end_occurrence_bound")
    base = build_lexicon("v2", "none")
    sung = copy.copy(base)
    sung.strip_parens = False
    lexes = {"cur:stripped": base, "cur:sung": sung}

    def judge(line, lex, new):
        sp = sb._spans(line, lex.strip_parens, lex)
        if not sp:
            return {"oracle": "unmapped"}
        bound = sb._bound(lex, line, "end", sp)
        if new is None:
            return {"oracle": "refused", "bound": bound if bound != "mismatch" else "mismatch"}
        edited = sb._edited(line, new, MARK, sp)
        if bound == "mismatch":
            k = "resolver_mismatch"
        elif edited is None:
            k = "unplaceable_edit"
        elif bound is None:
            k = "edit_unbound"
        else:
            k = "occ_agree" if tuple(edited) == tuple(bound) else "occ_wrong"
        pick = lambda s: None if not s or s == "mismatch" else {"span": list(s), "text": line[s[0]:s[1]]}
        return {"oracle": k, "bound": pick(bound), "edited": pick(edited), "result": new}

    # PART 1
    files = sorted(glob.glob(os.path.join(ROOT, "corpus", "song", "eng_*")))
    all_lines = list(dict.fromkeys(t for f in files for t in LH.load_lyric_lines(f)))
    corpus_pin = {"files": len(files),
                  "file_list_sha256": hashlib.sha256("\n".join(os.path.relpath(f, ROOT) for f in files).encode()).hexdigest(),
                  "files_content_sha256": hashlib.sha256(b"".join(open(f, "rb").read() for f in files)).hexdigest(),
                  "unique_line_texts": len(all_lines),
                  "unique_line_texts_sha256": hashlib.sha256("\n".join(all_lines).encode()).hexdigest()}
    k, n = SHARD
    lines = all_lines[k::n]
    corpus_pin["shard_lines"] = len(lines)
    corpus_pin["shard_lines_sha256"] = hashlib.sha256("\n".join(lines).encode()).hexdigest()
    differ, counts = [], {m: {"lines": 0, "same": 0, "differ": 0, "errors": 0} for m in lexes}
    for line in lines:
        for m, lex in lexes.items():
            counts[m]["lines"] += 1
            try:
                a = LOOP.swap_end_word(line, MARK, lex=lex)
                b = LOOP.swap_end_word(line, MARK, scheme="v2")
            except Exception as exc:  # noqa: BLE001 -- counted, listed
                counts[m]["errors"] += 1
                if len(differ) < 400:
                    differ.append({"line": line, "mode": m, "error": f"{type(exc).__name__}: {exc}"})
                continue
            if a == b:
                counts[m]["same"] += 1
                continue
            counts[m]["differ"] += 1
            differ.append({"line": line, "mode": m, "with_guard": a, "protections_only": b,
                           "unguarded_judged": judge(line, lex, b), "guarded_judged": judge(line, lex, a)})

    # PART 2
    focused, controls = [], []
    real_loop, real_sl = LOOP._RESOLVE, SL.resolve
    real_guard = LOOP._end_occurrence_bound
    if k == 0:
        for line, widx, word in FOCUSED:
            for m, lex in lexes.items():
                def rigged(lex_, line_, member, promote=False, widx=widx, word=word):
                    anchors, label, oov = real_sl(lex_, line_, member, promote=promote)
                    return [[dict(s, widx=widx, word=word) for s in a] for a in anchors], label, oov
                row = {"line": line, "mode": m, "rigged_endpoint": [widx, word]}
                try:
                    LOOP._RESOLVE, SL.resolve = rigged, rigged
                    guarded = LOOP.swap_end_word(line, MARK, lex=lex)
                    row["guarded"] = judge(line, lex, guarded)
                    LOOP._end_occurrence_bound = lambda *a, **kw: True
                    unguarded = LOOP.swap_end_word(line, MARK, lex=lex)
                    row["guard_removed"] = judge(line, lex, unguarded)
                finally:
                    LOOP._RESOLVE, SL.resolve, LOOP._end_occurrence_bound = real_loop, real_sl, real_guard
                row["witnessed"] = (row["guarded"]["oracle"] == "refused"
                                    and row["guard_removed"]["oracle"] in ("occ_wrong", "edit_unbound"))
                focused.append(row)
                g = LOOP.swap_end_word(line, MARK, lex=lex)
                LOOP._end_occurrence_bound = lambda *a, **kw: True
                try:
                    u = LOOP.swap_end_word(line, MARK, lex=lex)
                finally:
                    LOOP._end_occurrence_bound = real_guard
                controls.append({"line": line, "mode": m, "guarded": judge(line, lex, g),
                                 "guard_removed": judge(line, lex, u), "agree": g == u})
    ok = all(r["witnessed"] for r in focused) and all(c["agree"] for c in controls)
    git = lambda d, *a: subprocess.run(["git", "-C", d, *a], capture_output=True, text=True)
    commit = git(ROOT, "rev-parse", "HEAD").stdout.strip()
    st = git(ROOT, "status", "--porcelain", "--untracked-files=no")
    tracked_changes = None if not commit or st.returncode else bool(st.stdout.strip())
    own = git(HERE, "status", "--porcelain", "--", os.path.basename(__file__), "slot_binding.py")
    tool_state = None if own.returncode else (own.stdout.strip() or "committed, unchanged")

    def lex_pin(l):
        fb = getattr(l, "g2p_fallback", None)
        sp = getattr(l, "supplement_path", None)
        return {"class": type(l).__name__,
                "g2p_fallback": None if fb is None else {"min_confidence": getattr(fb, "min_confidence", None)},
                "supplement": None if sp is None else {"id": getattr(l, "supplement_id", None),
                                                        "path": os.path.relpath(sp, ROOT),
                                                        "sha256": getattr(l, "supplement_sha256", None) or _sha(sp)},
                "strip_parens": l.strip_parens, "reader_scheme": LH._scheme_of(l)}
    rec = {"part1_real_inputs": {"shard": list(SHARD), "corpus": corpus_pin, "counts": counts,
                                 "lines_where_guard_changes_outcome": differ},
           "part2_focused": focused, "part2_controls": controls, "part2_ok": ok if k == 0 else None,
           "pins": {"commit": commit, "tracked_changes": tracked_changes, "tool_git_state": tool_state,
                    "lexicons": {m: lex_pin(l) for m, l in lexes.items()},
                    "cmudict_sha256": _sha(LH.CMUDICT_PATH) if os.path.exists(getattr(LH, "CMUDICT_PATH", "")) else None,
                    "loop_sha256": _sha(os.path.join(ROOT, "quality", "loop.py")),
                    "tool_sha256": _sha(os.path.abspath(__file__)),
                    "slot_binding_sha256": _sha(os.path.join(HERE, "slot_binding.py"))}}
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(rec, fh, indent=1, ensure_ascii=False)
    print(json.dumps({"counts": counts, "differ": len(differ),
                      "focused": [(r["line"], r["mode"], r["guarded"]["oracle"], r["guard_removed"]["oracle"],
                                   r["witnessed"]) for r in focused],
                      "controls_agree": all(c["agree"] for c in controls)}, indent=1, ensure_ascii=False))
    return 0 if (k != 0 or ok) else 1


if __name__ == "__main__":
    try:
        code = main()
    except SystemExit:
        raise
    except Exception as exc:  # noqa: BLE001
        import traceback
        traceback.print_exc()
        code = 3
    sys.exit(code)
