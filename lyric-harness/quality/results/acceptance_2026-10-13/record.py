"""Acceptance recorder for the reader batch John approved on 2026-10-13 (PR #527,
R2 6136624835): what the harness's public readers return for every dev line at
ONE head, keyed by a stable line id, so two heads can be diffed (`diff.py`).
Read-only. This is tokenization / readability / phone / anchor evidence for
each reader below; it is not relation or meter certification and not legacy
replay, which the batch's own tests and 3PO's contract review cover.

    python3 quality/results/acceptance_2026-10-13/record.py OUT.jsonl.gz [HARNESS_ROOT] [--fallback=high]

HARNESS_ROOT (default: this checkout's lyric-harness) is the tree measured, so
one copy of this script records any head checked out in a worktree (give the
worktree the pinned `cmudict.dict` and set LYRIC_STAGED_DATA). The reader is
the census's English reader, `build_lexicon("v2", FALLBACK)`, with no declared
pronunciations; the header pins every coordinate that could move a reading
without a code change.

Per dev line, in the coordinate of THAT head's tokenizer:
  text, tokens, final            the raw line, `line_tokens`, `raw_final_token`
  readable ... reason, extra     `line_readability` (anchor path), with
                                 `final_lr` its own end token
  anchors                        `line_anchors`: every candidate end anchor,
                                 one string per candidate
  phones, oov, words_ne_tokens   `Lexicon.transcribe` on the whole line
  tok                            per token: [phones, oov] from `transcribe` of
                                 that token alone (the position-keyed record
                                 the diff aligns on)
  stream_unread, stream_tokens   the schema judge's reader:
                                 `relations.build_stream` through
                                 `revise.relation_phonology_for` (token index,
                                 token); `stream_tokens` only when they differ
                                 from `tokens`
  grid                           `grid.rime_cmudict(lex).end_occurrence`:
                                 [word, key], key None = refused
  meter_stress                   `word_syllable_map`, '/' stressed '.' not
  meter_refused                  `fit.read_line` [token, cause], only on lines
                                 with a digit, apostrophe or hyphen
  declared                       lines with a refusal and such a shape: every
                                 refused token declared (its first dictionary
                                 reading, else AH1) through
                                 `pronunciation.pin_readings`, then
                                 `line_readability` again; `rejected` when the
                                 declaration was refused
  voices                         lines with `(`: the same calls with
                                 strip_parens off
  error                          the exception, when a line raises
Then FIXTURE lines (ids `fixture:N`), the shapes the dev corpus does not
contain: Unicode hyphens, a soft hyphen, NFD accents, digits, apostrophes,
`--`. The diff reports them side by side and keeps them out of every count.
"""
import copy, glob, gzip, hashlib, json, os, re, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
_ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
_FLAGS = dict(a[2:].split("=", 1) for a in sys.argv[1:] if a.startswith("--") and "=" in a)
ROOT = os.path.abspath(_ARGS[1]) if len(_ARGS) > 1 else os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
sys.path.insert(0, ROOT)
os.chdir(ROOT)
import lyric_harness as LH  # noqa: E402
from quality import fit as FIT, grid as GRID, pronunciation as PR, relations as REL, revise as REV  # noqa: E402
from quality.coverage_census import POPULATIONS, build_lexicon, items_of  # noqa: E402
from quality.coverage_split import SPLIT_PATH, checked_assignment  # noqa: E402
from quality.phonology.eng import English  # noqa: E402

FIXTURES = [
    "a well‑known road", "a well‐known road", "the long road well‑known",
    "so beau­tiful a day", "the street­light", "cafés were full", "a sweet café",
    "born in 1914", "she was born in '62", "I got 99 problems", "the heart.    10", "death?[8]",
    "answer for 't", "go tell 'em", "o'er th' hill", "a' the bonnie lads", "goin' home",
    "our fathers' graves", "thee--Arise", "the shore--", "U--h, u--h, Lawdy,", "d---- the man",
    "to-day and to-morrow", "the war-cry rang", "fifty-one days", "There 's high", "I don′t know",
    "(ad lib) the whole night long", "the 'record spins",
    # appended 2026-10-13 from R2's verifier findings (#519 6141450779); keep
    # the list append-only so earlier fixture ids stay stable
    "There\u00ad 's high", "There \u00ad's high", "we sing 4\u2011ever", "we sing 4-ever",
    "co\u2011operate", "to\u2011night and to-night",
]
_KNOWN = {"text", "final_token", "readable", "final_unreadable", "final_unreadable_cause",
          "final_unread_pieces", "unreadable", "interior_unreadable", "reason"}
_SHAPED = re.compile(r"\d|['’‘`′]|[-‐‑­]")


def _sha(path):
    with open(path, "rb") as fh:
        return hashlib.sha256(fh.read()).hexdigest()


def _anchor(a):
    return " ".join(f"{'.'.join(s['onset'])}/{s['nucleus']}{s['stress']}/{'.'.join(s['coda'])}" for s in a)


def _readability(lex, line, anchors=None):
    rd = LH.line_readability(lex, line, anchors)
    out = {"final_lr": rd["final_token"], "readable": rd["readable"], "cause": rd["final_unreadable_cause"],
           "final_unread_pieces": rd["final_unread_pieces"], "unreadable": rd["unreadable"],
           "interior_unreadable": rd["interior_unreadable"], "reason": rd["reason"]}
    extra = {k: v for k, v in rd.items() if k not in _KNOWN}
    if extra:
        out["extra"] = extra
    return out


def _record(ctx, lid, line):
    lex = ctx["lex"]
    rec = {"id": lid, "text": line}
    try:
        tokens = LH.line_tokens(line, strip_parens=lex.strip_parens)
        anchors = LH.line_anchors(lex, line)[0] if tokens else []
        rec.update({"tokens": tokens, "final": LH.raw_final_token(line, strip_parens=lex.strip_parens),
                    **_readability(lex, line, anchors), "anchors": [_anchor(a) for a in anchors]})
        phones, words, oov = lex.transcribe(line)
        rec.update({"phones": " ".join(phones), "oov": oov, "words_ne_tokens": list(words) != list(tokens)})
        reader = lex.for_line(line) if hasattr(lex, "for_line") else lex
        rec["tok"] = []
        for i, t in enumerate(tokens):
            tl = reader.for_token(i) if hasattr(reader, "for_token") else reader
            p, _w, o = tl.transcribe(t, phrase_final=i == len(tokens) - 1)
            rec["tok"].append([" ".join(p), o])
        st = REL.build_stream([line], ctx["stream_phon"])
        rec["stream_unread"] = [[i, t] for _l, i, t in st.unreadable]
        if list(st.lexical_tokens[0]) != list(tokens):
            rec["stream_tokens"] = list(st.lexical_tokens[0])
        w, _tok, key = ctx["grid"].end_occurrence(line)
        rec["grid"] = [w, key]
        rec["meter_stress"] = "".join("/" if s["stress"] in (1, 2) else "." for s in LH.word_syllable_map(lex, line))
        if _SHAPED.search(line):
            lu = FIT.read_line(line, phon=ctx["fit_phon"], strip_parens=lex.strip_parens)
            rec["meter_refused"] = [[r.token, r.cause] for r in lu.refused]
            refused = [i for i, (_p, o) in enumerate(rec["tok"]) if o]
            if refused or not rec["readable"]:
                if not rec["readable"] and tokens and len(tokens) - 1 not in refused:
                    refused.append(len(tokens) - 1)
                occ = []
                for i in sorted(set(refused)):
                    dr = PR.dictionary_readings(lex, tokens[i])
                    occ.append((line, i + 1, tokens[i], list(dr[0]) if dr else ["AH1"]))
                pinned = PR.pin_readings(lex, occ, "acceptance")
                rec["declared"] = ({"rejected": True} if pinned is None
                                   else {"rejected": False, **_readability(pinned, line)})
        if "(" in line:
            v = copy.copy(lex)
            v.strip_parens = False
            vt = LH.line_tokens(line, strip_parens=False)
            rec["voices"] = {"tokens": vt, "final": LH.raw_final_token(line, strip_parens=False),
                             **{k: x for k, x in _readability(v, line).items() if k in ("readable", "interior_unreadable", "unreadable")}}
    except Exception as exc:  # noqa: BLE001 -- recorded, not swallowed
        rec["error"] = f"{type(exc).__name__}: {exc}"
    return rec


def _fb(phon):
    fb = getattr(phon, "fallback", None)
    return getattr(fb, "min_confidence", fb)


def _header(lex, fallback, paths, ctx):
    def git(*a):
        return subprocess.run(["git", *a], cwd=ROOT, capture_output=True, text=True).stdout.strip()
    pop = hashlib.sha256()
    for p in paths:
        pop.update(f"{os.path.relpath(p, ROOT)}\t{_sha(p)}\n".encode())
    supp = getattr(lex, "supplement_path", None)
    try:
        from quality.song_profile_calibration import comparator_fingerprint_parts
        fp = comparator_fingerprint_parts()
    except Exception as exc:  # noqa: BLE001
        fp = f"unavailable: {type(exc).__name__}: {exc}"
    return {"header": True, "commit": git("rev-parse", "HEAD"),
            "tracked_changes": bool(git("status", "--porcelain", "--untracked-files=no")),
            "recorder_sha256": _sha(os.path.abspath(__file__)),
            "reader": type(lex).__name__, "supplement": {"version": "v2", "path": supp and os.path.relpath(supp, ROOT),
                                                         "sha256": supp and _sha(supp)},
            # what each consumer actually reads with: the schema judge keeps its
            # registered fallback while meter inherits the lexicon's (3PO)
            "effective_fallback": {"anchor_and_transcribe": getattr(lex.g2p_fallback, "min_confidence", None),
                                   "schema_stream": _fb(ctx["stream_phon"]), "meter_fit": _fb(ctx["fit_phon"])},
            "reader_scheme": ({k: repr(v) for k, v in vars(lex).items() if "scheme" in k.lower()}
                              | {k: repr(getattr(LH, k)) for k in dir(LH) if "READER" in k and "SCHEME" in k}) or None,
            "cmudict_sha256": _sha(LH.CMUDICT_PATH) if os.path.exists(getattr(LH, "CMUDICT_PATH", "")) else None, "fallback": fallback, "strip_parens": lex.strip_parens,
            "declarations": "none (the `declared` field pins its own, per line)",
            "split": os.path.relpath(SPLIT_PATH, ROOT), "split_sha256": _sha(SPLIT_PATH),
            "population_sha256": pop.hexdigest(), "population_files": len(paths),
            "fixtures_sha256": hashlib.sha256("\n".join(FIXTURES).encode()).hexdigest(),
            "comparator_fingerprint_parts": fp}


def _main():
    out = _ARGS[0]
    fallback = _FLAGS.get("fallback", "none")
    lex = build_lexicon("v2", fallback)
    ctx = {"lex": lex, "stream_phon": REV.relation_phonology_for(lex), "grid": GRID.rime_cmudict(lex),
           # as the production meter path builds it (revise.py, `Reviser` fit)
           "fit_phon": English(fallback=getattr(lex.g2p_fallback, "min_confidence", None), lexicon=lex)}
    assignment, _ = checked_assignment()
    keep = {u for u, s in assignment.items() if s == "dev"}
    paths = sorted({p for g in POPULATIONS["song"] for p in glob.glob(os.path.join(ROOT, g), recursive=True)})
    n = errors = refused = 0
    with gzip.open(out, "wt", encoding="utf-8") as fh:
        fh.write(json.dumps(_header(lex, fallback, paths, ctx), default=str) + "\n")
        for path in paths:
            rel = os.path.relpath(path, ROOT); ordinal = -1
            for _t, ls in items_of(path):
                if not ls:
                    continue
                ordinal += 1
                if f"{rel}#{ordinal}" not in keep:
                    continue
                for li, line in enumerate(ls):
                    rec = _record(ctx, f"{rel}#{ordinal}:{li}", line)
                    n += 1; errors += "error" in rec; refused += rec.get("readable") is False
                    fh.write(json.dumps(rec, ensure_ascii=False, default=str) + "\n")
        for i, line in enumerate(FIXTURES):
            rec = _record(ctx, f"fixture:{i}", line)
            rec["fixture"] = True
            fh.write(json.dumps(rec, ensure_ascii=False, default=str) + "\n")
    print(json.dumps({"lines": n, "end_refused": refused, "errors": errors, "fixtures": len(FIXTURES)}))


if __name__ == "__main__":
    _main()
