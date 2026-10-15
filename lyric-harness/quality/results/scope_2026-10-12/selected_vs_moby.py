"""Item 2 on the population that matters: the reading the program SELECTS for
each dev-side word occurrence (SupplementedLexicon v2, no fallback), compared
with Moby, weighted by occurrences and, separately, by line-END occurrences.
Read-only. Moby flags disagreements; it does not judge.

    python3 quality/results/scope_2026-10-12/selected_vs_moby.py PATH/TO/mpron.txt OUT.json
"""
import collections, glob, hashlib, json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
sys.path.insert(0, ROOT)
import lyric_harness as LH  # noqa: E402
from quality import moby_convert as M  # noqa: E402
from quality.coverage_census import POPULATIONS, build_lexicon, items_of  # noqa: E402
from quality.coverage_split import checked_assignment  # noqa: E402


def _main():
    mpron, out = sys.argv[1], sys.argv[2]
    digest = hashlib.sha256(open(mpron, "rb").read()).hexdigest()
    if digest != M.MPRON_SHA256:
        sys.exit(f"REFUSED: {mpron} is not the pinned mpron.txt ({digest})")
    E = M.load(mpron)
    lex = build_lexicon("v2", "none")
    assignment, _ = checked_assignment()
    keep = {u for u, s in assignment.items() if s == "dev"}
    paths = sorted({p for g in POPULATIONS["song"] for p in glob.glob(os.path.join(ROOT, g), recursive=True)})
    occ, endocc = collections.Counter(), collections.Counter()
    for path in paths:
        rel = os.path.relpath(path, ROOT); ordinal = -1
        for _t, lines in items_of(path):
            if not lines: continue
            ordinal += 1
            if f"{rel}#{ordinal}" not in keep: continue
            for line in lines:
                toks = lex.transcribe(line)[1]
                for t in toks: occ[LH.fold_apostrophes(t).lower()] += 1
                if toks: endocc[LH.fold_apostrophes(toks[-1]).lower()] += 1

    def _selected(w):
        ph = []
        for p in lex.word_pieces(w):
            if not p: continue
            r, oov = lex.transcribe_word(p)
            if oov: return None
            ph += r
        return tuple(ph)

    strip = lambda t: tuple(re.sub(r"\d", "", x) for x in t)
    def _red(t):
        o = []
        for i, x in enumerate(t):
            b = re.sub(r"\d", "", x)
            if x[-1:] == "0" and b in ("AH", "IH", "IY", "EH", "UW"): b = "@"
            if b in ("IY", "IH") and i + 1 < len(t) and t[i + 1] == "NG": b = "I"
            o.append(b)
        return tuple(o)
    def _tail(t):
        idx = [i for i, x in enumerate(t) if x.endswith("1")]
        return _red(t[idx[-1]:] if idx else t)

    def _classify(w):
        s = _selected(w)
        if s is None: return "unread", None
        if w not in E: return "not in Moby", None
        m = E[w]
        if s in m: return "exact", None
        if strip(s) in {strip(x) for x in m}: return "stress only", None
        if _red(s) in {_red(x) for x in m}: return "reduced vowel only", None
        if _tail(s) in {_tail(x) for x in m}: return "sounds differ before the rhyme tail", None
        return "sounds differ in the rhyme tail", (" ".join(s), [" ".join(x) for x in m[:2]])

    import subprocess
    res = {"commit": subprocess.run(["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, text=True).stdout.strip(), "mpron_sha256": digest}
    for name, C in (("all_occurrences", occ), ("end_occurrences", endocc)):
        cls_t, cls_o, ex = collections.Counter(), collections.Counter(), []
        for w, n in C.items():
            k, d = _classify(w)
            cls_t[k] += 1; cls_o[k] += n
            if d: ex.append([w, n, d[0], d[1]])
        ex.sort(key=lambda r: -r[1])
        res[name] = {"types": sum(cls_t.values()), "occurrences": sum(cls_o.values()),
                     "by_class": {k: {"types": cls_t[k], "occurrences": cls_o[k]} for k in sorted(cls_t)},
                     "rhyme_tail_disagreements_by_occurrence": ex[:300]}
    json.dump(res, open(out, "w"), indent=1, ensure_ascii=False)
    for name in ("all_occurrences", "end_occurrences"):
        r = res[name]; print(name, "types", r["types"], "occurrences", r["occurrences"])
        for k, v in sorted(r["by_class"].items(), key=lambda kv: -kv[1]["occurrences"]):
            print(f"   {k:40s} types {v['types']:7d}  occurrences {v['occurrences']:8d}  {100*v['occurrences']/r['occurrences']:.1f}%")
        print("   top tail disagreements:", [(w, n) for w, n, *_ in r["rhyme_tail_disagreements_by_occurrence"][:25]])


if __name__ == "__main__":
    # Reproduces a historical receipt (D8a): the pre-batch reader cut, v1.
    with LH.reader_scheme_scope("v1"):
        _main()
