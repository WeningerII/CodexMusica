"""Raw-occurrence sidecar for 3PO's M1/M2 context ledger (PR #527, 3PO
6134364746). Read-only. Every dev-side raw token that carries a DIGIT or an
EDGE APOSTROPHE, at every line position, with what each reader did with it.

    python3 quality/results/scope_2026-10-12/occurrence_sidecar.py quality/results/scope_2026-10-12/occurrence_sidecar.jsonl.gz

One JSON object per line (gzip). A field that this pass cannot observe is the
string "UNAVAILABLE", never inferred. No verdict is recorded: whether a reading
is right is the adjudicator's question, not this file's.
"""
import collections, glob, gzip, hashlib, json, os, re, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
sys.path.insert(0, ROOT)
import lyric_harness as LH  # noqa: E402
from quality import grid as G  # noqa: E402
from quality import coverage_split as CS  # noqa: E402
from quality.coverage_census import POPULATIONS, build_lexicon, items_of  # noqa: E402

UN = "UNAVAILABLE"
_EDGE = re.compile(r"^['’]|['’]$")


def _main():
    out = sys.argv[1]
    commit = subprocess.run(["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, text=True).stdout.strip()
    assignment, meta = CS.checked_assignment()
    keep = {u for u, s in assignment.items() if s == "dev"}
    split_id = {"file": os.path.relpath(CS.SPLIT_PATH, ROOT),
                "file_sha256": hashlib.sha256(open(CS.SPLIT_PATH, "rb").read()).hexdigest(),
                "side": "dev", "units": len(keep)}
    lex = build_lexicon("v2", "none")
    key = G.rime_cmudict(lex)
    paths = sorted({p for g in POPULATIONS["song"] for p in glob.glob(os.path.join(ROOT, g), recursive=True)})
    counts = collections.Counter()
    with gzip.open(out, "wt", encoding="utf-8") as fh:
        fh.write(json.dumps({"header": True, "commit": commit, "split": split_id,
                             "lexicon": {"supplement": "v2", "fallback": "none"},
                             "selection": "raw whitespace tokens containing a digit, or starting/ending with an apostrophe after outer punctuation other than apostrophes is removed",
                             "unavailable_marker": UN}) + "\n")
        for path in paths:
            rel = os.path.relpath(path, ROOT); ordinal = -1
            for _t, lines in items_of(path):
                if not lines:
                    continue
                ordinal += 1
                if f"{rel}#{ordinal}" not in keep:
                    continue
                for li, line in enumerate(lines):
                    raws = [(m.group(0), m.start(), m.end()) for m in re.finditer(r"\S+", line)]
                    cands = []
                    for pos, (raw, s, e) in enumerate(raws):
                        core = re.sub(r"^[^\w'’]+|[^\w'’]+$", "", raw)
                        kinds = []
                        if re.search(r"\d", raw): kinds.append("digit")
                        if core and _EDGE.search(core): kinds.append("edge_apostrophe")
                        if kinds:
                            cands.append((pos, raw, s, e, core, kinds))
                    if not cands:
                        continue
                    toks = lex.transcribe(line)[1]
                    anchor_tok = LH.raw_final_token(line, strip_parens=lex.strip_parens)
                    anchor_ok = bool(anchor_tok) and bool(LH.line_anchors(lex, line)[0])
                    grid_tok = G._end_word(line) or None
                    grid_ok = bool(grid_tok) and key(grid_tok) is not None
                    for pos, raw, s, e, core, kinds in cands:
                        tk = [t for t in LH._TOKEN_RUN.findall(raw) if LH.LATIN_SCRIPT.search(t)]
                        pieces, readings = [], []
                        for t in tk:
                            for p in lex.word_pieces(t):
                                if not p:
                                    continue
                                ph, oov = lex.transcribe_word(p)
                                src = lex.reading_source(p, tuple(ph)) if (not oov and hasattr(lex, "reading_source")) else (None if oov else UN)
                                pieces.append(p)
                                readings.append({"piece": p, "phones": None if oov else " ".join(ph), "unread": bool(oov), "source": src})
                        rec = {"path": rel, "item_ordinal": ordinal, "line_index": li, "line": line,
                               "raw_token": raw, "span": [s, e], "position": pos, "is_last_raw_token": pos == len(raws) - 1,
                               "kinds": kinds, "tokenizer_tokens": tk, "dropped_by_tokenizer": not tk,
                               "pieces": pieces, "readings": readings, "fallback": "none",
                               "line_tokens_kept": toks,
                               "anchor_reader": {"end_token": anchor_tok, "reads": anchor_ok},
                               "grid_reader": {"end_token": grid_tok, "reads": grid_ok}}
                        fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
                        for k in kinds:
                            counts[k] += 1
                            counts[k + (" dropped" if not tk else " kept")] += 1
    print(json.dumps(dict(counts), indent=1))


if __name__ == "__main__":
    _main()
