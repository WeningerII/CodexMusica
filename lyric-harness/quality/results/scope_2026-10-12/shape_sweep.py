"""Blast-radius sweep, BB8's share (PR #527, R2 6135859837): every character
and word SHAPE the tokenizer and reader see on the dev side, counted, with
what the grader does with it today and which rule of the signed plan governs
it. Read-only; SupplementedLexicon(v2), no fallback; the end word is
`raw_final_token`, as the grader takes it; "anchored" is `line_anchors`.

    python3 quality/results/scope_2026-10-12/shape_sweep.py quality/results/scope_2026-10-12/shape_sweep.json

Sections of the output:
  chars    every character that is not an ASCII letter or whitespace: count,
           how often it sits INSIDE a word (alphanumeric on both sides), and
           what each cutter does with it (`fold_apostrophes`, `_TOKEN_RUN`,
           `raw_final_token`'s run test, `word_pieces`' split).
  shapes   every whitespace chunk the writer wrote (outer sentence punctuation
           removed, apostrophes and hyphens kept), tagged by shape; a chunk
           can carry several tags. For END chunks: anchored today, whether
           `raw_final_token` kept the written word, and how many are in
           item 6's projected refusals (`hyphen_end_classes.jsonl.gz`, policy
           class `pieces` or `earlier`).
  digits   M1. Lines whose last written chunk carries a digit, by kind
           (bracketed footnote marker, line number set off by a column gap or
           `_`, page reference, apostrophe year, number in running text), with
           anchored today; and digit runs before the end chunk.
  apostrophes  M2a/M2b over every `line_tokens` token with an edge apostrophe:
           an exact apostrophe entry that changes today's reading (M2a), a
           bare key whose selected reading is the spelled letters under the
           dotted-key alphabet `a.`..`z.` (M2b), a quotation (both edges),
           or unchanged.
  interior_refusals  M1 and M2b before the end word: lines that would gain a
           refused interior token, and how many of them read in full today.
  projected_refusals  ids of dev end lines that anchor today and would refuse
           under the plan as worded: item 6, M1 (a digit-bearing end chunk),
           M2b (end token, no declared reading), and their union.
Example ids are reproductions, not acceptance lists.
"""
import collections, glob, gzip, json, os, re, subprocess, sys, unicodedata
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
sys.path.insert(0, ROOT)
import lyric_harness as LH  # noqa: E402
from quality.coverage_census import POPULATIONS, build_lexicon, items_of  # noqa: E402
from quality.coverage_split import SPLIT_PATH, checked_assignment  # noqa: E402

_OUTER = "\"“”«»()[]{}.,;:!?*_"
_EXAMPLES = 3


def _treatment(ch):
    return {
        "name": unicodedata.name(ch, "UNNAMED"), "category": unicodedata.category(ch),
        "folded_to_apostrophe": ch in LH.APOSTROPHES,
        "in_token_run": bool(LH._TOKEN_RUN.fullmatch(ch)),
        "in_raw_final_token_run": ch.isalpha() or unicodedata.category(ch).startswith("M") or ch in "'-",
        "split_by_word_pieces": ch in "-‑",
    }


def _shapes(chunk):
    """-> the shape tags of one written chunk (outer punctuation removed)."""
    tags = set()
    f = LH.fold_apostrophes(chunk)
    letters = [c for c in f if c.isalpha()]
    if any(c.isdigit() for c in f):
        tags.add("digit: number only" if not letters else "digit: with letters")
    for c in {c for c in chunk if c in LH.APOSTROPHES or c == "'"}:
        tags.add(f"apostrophe char: U+{ord(c):04X}")
    if "'" in f and letters:
        core = f.strip("-")
        if core.count("'") > 1:
            tags.add("apostrophe: several in one word")
        if core.startswith("'") and core.endswith("'") and len(core) > 2:
            tags.add("apostrophe: both edges")
        elif core.startswith("'"):
            tags.add("apostrophe: leading")
        elif core.endswith("'"):
            tags.add("apostrophe: trailing")
        if re.search(r"\w'\w", core):
            tags.add("apostrophe: internal")
    for name, pat in (("hyphen: single internal", r"[^\W_]'?-'?[^\W_]"),
                      ("hyphen: double -- internal", r"\w--+\w"),
                      ("hyphen: edge (leading/trailing)", r"^-+\w|\w-+$"),
                      ("dash: en/em inside chunk", r"\w[–—]\w"),
                      ("hyphen look-alike U+2010/2011/2012/00AD/2212 inside", r"\w[‐‑‒­−]\w")):
        if re.search(pat, f):
            tags.add(name)
    if "hyphen: single internal" in tags:
        if re.search(r"-[^-]*(?:'s|s'|'d|in')$", f, re.I):
            tags.add("hyphen + 's/s'/'d/in' ending")
        elif re.search(r"-[^-]*s$", f, re.I):
            tags.add("hyphen + -s ending")
    if re.search(r"(?:^|[^A-Za-z])[A-Za-z]\.[A-Za-z]\.", chunk):
        tags.add("dotted abbreviation")
    if any(unicodedata.category(c) == "Mn" for c in chunk):
        tags.add("combining mark (decomposed diacritic)")
    if any(c.isalpha() and not LH.LATIN_SCRIPT.match(c) for c in chunk):
        tags.add("letter outside LATIN_SCRIPT")
    if any(ord(c) > 127 and LH.LATIN_SCRIPT.match(c) for c in chunk):
        tags.add("precomposed Latin diacritic")
    for c, name in (("&", "&"), ("/", "slash /"), ("@", "@"), ("+", "+"), ("=", "="), ("%", "%"), ("$", "$"), ("#", "#")):
        if c in chunk and letters:
            tags.add(f"symbol inside: {name}")
    if any(c in "×÷" for c in chunk):
        tags.add("× or ÷ (inside _TOKEN_RUN's letter range)")
    if len(letters) > 1 and all(c.isupper() for c in letters):
        tags.add("case: ALL CAPS")
    elif re.search(r"[a-z][A-Z]", f):
        tags.add("case: internal capital")
    return tags


def _norm(line, strip_parens):
    """The text the tokenizers cut: enclitics joined, `(...)` erased."""
    cut = LH.join_spaced_enclitics(line)
    return re.sub(r"\([^)]*\)", " ", cut) if strip_parens else cut


def _chunks(cut):
    """-> every written chunk with a letter or digit, outer punctuation off."""
    out = []
    for raw in cut.split():
        c = re.sub(r"^-{2,}|-{2,}$", "", raw.strip(_OUTER + "–—"))
        if any(ch.isalnum() for ch in c):
            out.append(c)
    return out


def _digit_kind(line, m):
    before, after = line[:m.start()], line[m.end():]
    if re.search(r"\[\s*$", before) or re.match(r"\s*\]", after):
        return "footnote marker [n]"
    if re.search(r"(\s{2,}|_)$", before) and not re.search(r"[A-Za-z]", after):
        return "line number (column gap or _n)"
    if re.search(r"\bp{1,2}\.\s*$", before, re.I):
        return "page reference"
    if before.endswith("'"):
        return "apostrophe year ('62)"
    return "number in running text"


class _Alphabet:
    """The dotted-key alphabet (CMUdict `a.`..`z.`), stress ignored."""
    def __init__(self, entries):
        self.e = entries
        self.names = {ch: [self._ns(p) for p in entries.get(ch + ".", [])] for ch in "abcdefghijklmnopqrstuvwxyz"}
        assert all(self.names.values())

    @staticmethod
    def _ns(p):
        return tuple(re.sub(r"\d", "", x) for x in p)

    def spelled(self, key, phones):
        if not (key.isascii() and key.isalpha()):
            return False
        opts = {()}
        for ch in key:
            opts = {o + n for o in opts for n in self.names[ch]}
        return self._ns(phones) in opts


def _apostrophe_class(lex, alpha, tok):
    f = LH.fold_apostrophes(tok).lower().strip('"“”.,;:!?()[]').strip("-")
    if not (f.startswith("'") or f.endswith("'")) or not f.strip("'"):
        return None
    key = f.strip("'")
    today, unread = lex.transcribe_word(tok)
    if f in lex.entries:
        shape = "s'" if f.endswith("s'") else "other"
        return (f"M2a: exact entry, reading changes [{shape}]" if list(lex.entries[f][0]) != list(today)
                else "M2a: exact entry, same reading")
    if f.startswith("'") and f.endswith("'") and len(f) > 2:
        return "quotation (both edges): unchanged"
    if not unread and alpha.spelled(key, today):
        return "M2b: selected reading is the spelled letters"
    return "unchanged: stripped key reads" if not unread else "unchanged: unread today"


def _main():
    out = sys.argv[1]
    lex = build_lexicon("v2", "none")
    alpha = _Alphabet(lex.entries)
    assignment, _ = checked_assignment()
    keep = {u for u, s in assignment.items() if s == "dev"}
    item6 = set()
    with gzip.open(os.path.join(HERE, "hyphen_end_classes.jsonl.gz"), "rt", encoding="utf-8") as fh:
        for row in map(json.loads, fh):
            if row.get("policy", {}).get("class") in ("pieces", "earlier"):
                item6.add(row["id"])
    paths = sorted({p for g in POPULATIONS["song"] for p in glob.glob(os.path.join(ROOT, g), recursive=True)})
    commit = subprocess.run(["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, text=True).stdout.strip()
    chars = collections.Counter(); inside = collections.Counter(); char_ex = collections.defaultdict(list)
    shape_all = collections.Counter(); shape_end = collections.Counter(); shape_anch = collections.Counter()
    shape_chg = collections.Counter(); shape_i6 = collections.Counter(); shape_ex = collections.defaultdict(list)
    dig_end = collections.Counter(); dig_anch = collections.Counter(); dig_int = collections.Counter()
    dig_ex = collections.defaultdict(list)
    apo_all = collections.Counter(); apo_end = collections.Counter(); apo_ex = collections.defaultdict(list)
    refuse = {"item6": set(), "M1": set(), "M2b": set()}
    inner = {k: collections.Counter() for k in ("M1", "M2b")}
    lines = end_lines = 0
    for path in paths:
        rel = os.path.relpath(path, ROOT); ordinal = -1
        for _t, ls in items_of(path):
            if not ls:
                continue
            ordinal += 1
            if f"{rel}#{ordinal}" not in keep:
                continue
            for li, line in enumerate(ls):
                lines += 1
                lid = f"{rel}#{ordinal}:{li}"
                for i, ch in enumerate(line):
                    if ch.isspace() or (ch.isascii() and ch.isalpha()):
                        continue
                    chars[ch] += 1
                    if 0 < i < len(line) - 1 and line[i - 1].isalnum() and line[i + 1].isalnum():
                        inside[ch] += 1
                        if len(char_ex[ch]) < _EXAMPLES:
                            char_ex[ch].append(lid)
                cut = _norm(line, lex.strip_parens)
                chunks = _chunks(cut)
                for c in chunks:
                    for t in _shapes(c):
                        shape_all[t] += 1
                at = LH.raw_final_token(line, strip_parens=lex.strip_parens)
                toks = LH.line_tokens(line, strip_parens=lex.strip_parens)
                apo_end_cls = None; m2b_inside = False
                for i, tok in enumerate(toks):
                    k = _apostrophe_class(lex, alpha, tok)
                    if k:
                        apo_all[k] += 1
                        if i == len(toks) - 1 and tok == at:
                            apo_end_cls = k
                        elif k.startswith("M2b"):
                            m2b_inside = True
                m1_inside = any(re.search(r"\d", c) for c in chunks[:-1])
                if m1_inside or m2b_inside:
                    read_today = all(not lex.transcribe_word(t)[1] for t in toks)
                    for k, hit in (("M1", m1_inside), ("M2b", m2b_inside)):
                        if hit:
                            inner[k]["lines"] += 1
                            inner[k]["lines_fully_read_today"] += read_today
                if not chunks:
                    continue
                end_lines += 1
                last = chunks[-1]
                tags = _shapes(last)
                interesting = (tags - {"case: ALL CAPS", "case: internal capital"}) or lid in item6
                if not interesting and not re.search(r"\d", line):
                    continue
                anchored = bool(at) and bool(LH.line_anchors(lex, line)[0])
                if lid in item6 and anchored:
                    refuse["item6"].add(lid)
                written = re.sub(r"[^\w'-]", "", LH.fold_apostrophes(last)).lower().strip("'-")
                kept = bool(at) and LH.fold_apostrophes(at).lower().strip("'-") == written
                for t in tags:
                    shape_end[t] += 1; shape_anch[t] += anchored; shape_chg[t] += not kept
                    shape_i6[t] += lid in refuse["item6"]
                    if len(shape_ex[t]) < _EXAMPLES:
                        shape_ex[t].append({"id": lid, "written": last, "end_word_today": at, "anchored": anchored})
                ms = list(re.finditer(r"\d+", cut))
                if ms and re.search(r"\d", last):
                    k = _digit_kind(cut, ms[-1])
                    dig_end[k] += 1; dig_anch[k] += anchored
                    if anchored:
                        refuse["M1"].add(lid)
                    if len(dig_ex[k]) < _EXAMPLES:
                        dig_ex[k].append({"id": lid, "line_tail": line[-60:], "end_word_today": at, "anchored": anchored})
                else:
                    for m in ms:
                        dig_int[_digit_kind(cut, m)] += 1
                if apo_end_cls:
                    apo_end[(apo_end_cls, anchored)] += 1
                    if apo_end_cls.startswith("M2b") and anchored:
                        refuse["M2b"].add(lid)
                    if len(apo_ex[apo_end_cls]) < _EXAMPLES:
                        apo_ex[apo_end_cls].append({"id": lid, "token": at, "today": " ".join(lex.transcribe_word(at)[0]),
                                                    "anchored": anchored})
    union = refuse["item6"] | refuse["M1"] | refuse["M2b"]
    rec = {
        "commit": commit, "split": os.path.relpath(SPLIT_PATH, ROOT),
        "lexicon": {"supplement": "v2", "fallback": "none"},
        "dev_lines": lines, "end_lines_with_a_written_word": end_lines,
        "chars": sorted(({"char": c, "codepoint": f"U+{ord(c):04X}", "count": n, "inside_word": inside[c],
                          "examples_inside": char_ex[c], **_treatment(c)} for c, n in chars.items()),
                        key=lambda r: (-r["count"], r["codepoint"])),
        "shapes": [{"shape": t, "all_chunks": shape_all[t], "end_chunks": shape_end[t],
                    "end_anchored_today": shape_anch[t], "end_word_changed_today": shape_chg[t],
                    "end_in_item6_refusals": shape_i6[t], "examples": shape_ex[t]} for t in sorted(shape_all)],
        "digits": {"end_chunk_by_kind": {k: {"lines": dig_end[k], "anchored_today": dig_anch[k], "examples": dig_ex[k]}
                                         for k in sorted(dig_end)},
                   "runs_before_the_end_chunk_by_kind": dict(sorted(dig_int.items()))},
        "apostrophes": {"tokens_all_positions": dict(sorted(apo_all.items())),
                        "end_tokens": [{"class": k, "anchored_today": a, "lines": n} for (k, a), n in sorted(apo_end.items())],
                        "examples": dict(sorted(apo_ex.items()))},
        "projected_refusals": {
            "counts": {**{k: len(v) for k, v in refuse.items()}, "union": len(union),
                       "item6_and_M1": len(refuse["item6"] & refuse["M1"]),
                       "item6_and_M2b": len(refuse["item6"] & refuse["M2b"]),
                       "M1_and_M2b": len(refuse["M1"] & refuse["M2b"])},
            "ids": {k: sorted(v) for k, v in refuse.items()}},
        "interior_refusals": {k: dict(v) for k, v in inner.items()},
    }
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(rec, fh, ensure_ascii=False, indent=1)
        fh.write("\n")
    print(json.dumps({"dev_lines": lines, "end_lines": end_lines, **rec["projected_refusals"]["counts"],
                      "digits": {k: [v["lines"], v["anchored_today"]] for k, v in rec["digits"]["end_chunk_by_kind"].items()},
                      "digit_runs_before_end": rec["digits"]["runs_before_the_end_chunk_by_kind"],
                      "apostrophe_tokens": rec["apostrophes"]["tokens_all_positions"],
                      "apostrophe_end_tokens": rec["apostrophes"]["end_tokens"],
                      "interior_refusals": rec["interior_refusals"]}, indent=1))


if __name__ == "__main__":
    _main()
