"""Acceptance recorder for the reader batch John approved on 2026-10-13 (PR #527,
R2 6136624835): what the grader's public entry points return for every dev
line at ONE head, keyed by a stable line id, so two heads can be diffed by id
(`diff.py`). Read-only; the dev side of the coverage split; the default
English reader as the census builds it (`build_lexicon("v2", "none")`).

    python3 quality/results/acceptance_2026-10-13/record.py OUT.jsonl.gz [HARNESS_ROOT]

HARNESS_ROOT (default: this checkout's lyric-harness) is the tree measured, so
one copy of this script records any head: check the head out in a worktree and
pass its lyric-harness directory. The header names the commit measured and
whether it had tracked changes.

Per line it records only what a caller sees, never an internal of the batch:
  tokens   `line_tokens`
  final    `raw_final_token`
  readable, cause, final_unread_pieces, unreadable, interior_unreadable,
  reason   `line_readability` (`readable` False = the end word is refused)
  phones, oov  `Lexicon.transcribe` on the whole line
  extra    any other key `line_readability` returns at this head
  error    the exception, when a line raises (a crash is an outcome)
"""
import glob, gzip, json, os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
sys.path.insert(0, ROOT)
os.chdir(ROOT)
import lyric_harness as LH  # noqa: E402
from quality.coverage_census import POPULATIONS, build_lexicon, items_of  # noqa: E402
from quality.coverage_split import SPLIT_PATH, checked_assignment  # noqa: E402

_KNOWN = {"text", "final_token", "readable", "final_unreadable", "final_unreadable_cause",
          "final_unread_pieces", "unreadable", "interior_unreadable", "reason"}


def _record(lex, lid, line):
    rec = {"id": lid}
    try:
        rd = LH.line_readability(lex, line)
        phones, _words, oov = lex.transcribe(line)
        rec.update({
            "tokens": LH.line_tokens(line, strip_parens=lex.strip_parens),
            "final": LH.raw_final_token(line, strip_parens=lex.strip_parens),
            "readable": rd["readable"], "cause": rd["final_unreadable_cause"],
            "final_unread_pieces": rd["final_unread_pieces"], "unreadable": rd["unreadable"],
            "interior_unreadable": rd["interior_unreadable"], "reason": rd["reason"],
            "phones": " ".join(phones), "oov": oov,
        })
        extra = {k: v for k, v in rd.items() if k not in _KNOWN}
        if extra:
            rec["extra"] = extra
    except Exception as exc:  # noqa: BLE001 -- recorded, not swallowed
        rec["error"] = f"{type(exc).__name__}: {exc}"
    return rec


def _main():
    out = sys.argv[1]
    lex = build_lexicon("v2", "none")
    assignment, _ = checked_assignment()
    keep = {u for u, s in assignment.items() if s == "dev"}
    paths = sorted({p for g in POPULATIONS["song"] for p in glob.glob(os.path.join(ROOT, g), recursive=True)})
    commit = subprocess.run(["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, text=True).stdout.strip()
    dirty = subprocess.run(["git", "status", "--porcelain", "--untracked-files=no"], cwd=ROOT,
                           capture_output=True, text=True).stdout.strip()
    n = errors = refused = 0
    with gzip.open(out, "wt", encoding="utf-8") as fh:
        fh.write(json.dumps({"header": True, "commit": commit, "tracked_changes": bool(dirty),
                             "split": os.path.relpath(SPLIT_PATH, ROOT), "reader": type(lex).__name__,
                             "lexicon": {"supplement": "v2", "fallback": "none"}}) + "\n")
        for path in paths:
            rel = os.path.relpath(path, ROOT); ordinal = -1
            for _t, ls in items_of(path):
                if not ls:
                    continue
                ordinal += 1
                if f"{rel}#{ordinal}" not in keep:
                    continue
                for li, line in enumerate(ls):
                    rec = _record(lex, f"{rel}#{ordinal}:{li}", line)
                    n += 1; errors += "error" in rec; refused += rec.get("readable") is False
                    fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
    print(json.dumps({"commit": commit, "tracked_changes": bool(dirty), "lines": n,
                      "end_refused": refused, "errors": errors}))


if __name__ == "__main__":
    _main()
