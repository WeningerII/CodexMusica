"""Session logger for the coverage experiment.

TWO DEFECTS FOUND BY THE RUNG-0 INSTRUMENT CHECK AND FIXED HERE:

1. CODES WERE MATCHED BY A REGEX OVER PROSE with a noise blocklist, so
   `readability` on one bad line reported ALREADY, CHARGE, EARLIER, REPLACED,
   SECOND, SILENTLY, UNKNOWN, WHICH alongside the two real codes. The
   vocabulary is now CLOSED and extracted from the SOURCE (every
   Finding/FitFinding/FitRefusal/GridFinding/Refusal construction), so a match
   is a real code or it is nothing. Extracted from source rather than from the
   pre-registered denominator ON PURPOSE: matching against the denominator
   could never reveal a code the denominator forgot.

2. A REFUSAL WAS INDISTINGUISHABLE FROM SILENCE. `brief one-line A` exits 2
   with a named cause in PROSE and no code at all, so the log recorded
   `codes=[]` -- identical to a layer that said nothing. That collapses the
   experiment's four states to three, in the instrument, on the exact
   distinction the experiment exists to measure. Exit 2 now captures the
   REFUSED line and its cause.
"""
import ast, json, re, subprocess, sys, os
ROOT = "/home/user/CodexMusica/lyric-harness"
#: Session artefacts live in the caller's scratch, never in the repo: a run
#: log is evidence of one session and doctrine 77 keeps those namespaced out.
OUT   = os.environ.get("COVERAGE_OUT") or os.path.join(ROOT, "..", "coverage-run")
LOG   = os.path.join(OUT, "session.jsonl")

def vocabulary():
    """The CLOSED set of finding codes, extracted from SOURCE on every call.

    Not read from the pre-registered denominator, and not cached: a vocabulary
    matched against the denominator could never reveal a code the denominator
    FORGOT, which is one of the two findings this experiment is looking for.
    That is not hypothetical -- the denominator DID forget one
    (`PHRASE_CLICHE_REFUSED`), found only because this list is built
    independently of it.

    THREE EXTRACTION DEFECTS, ALL FOUND BY RECONCILING TWO INDEPENDENT COUNTS
    THAT DISAGREED (95 by regex, 99 by an agent's reading, 101 by a naive AST
    pass -- none of them right):

      FALSE POSITIVES. `quality/audit_corpus.py` reuses `Finding()` with a
      CHECK LETTER as its first argument, so a bare AST pass collects `A`
      through `G` as finding codes. Excluded by MINIMUM LENGTH 4 and not by a
      name blocklist: `CROWDED`, `SPARSE` and `ANACRUSIS` carry no underscore,
      so an "underscore required" rule would delete three real codes.

      A CONDITIONAL FIRST ARGUMENT. `grid.ingest_mark` builds
      `Refusal("MARK_NOT_A_FUNCTION" if reason else "MARK_UNRECOGNISED", ...)`,
      an `ast.IfExp`, invisible to a pass that only reads `ast.Constant`. Both
      branches are walked now.

      A VARIABLE FIRST ARGUMENT, which no static pass can resolve.
      `Reviser._collision_code()` RETURNS the code and `revise.py:2025` passes
      it as `Finding(code, ...)`. The four are declared below with that reason
      attached, because a silent omission here would understate the
      denominator by four and the understatement would look like coverage.
    """
    pat_ctor = ("Finding", "FitFinding", "FitRefusal", "GridFinding", "Refusal")
    codes = set()

    def literals(node):
        """-> every string constant reachable as this argument's value."""
        if isinstance(node, ast.Constant) and isinstance(node.value, str):
            return [node.value]
        if isinstance(node, ast.IfExp):
            return literals(node.body) + literals(node.orelse)
        return []

    for dirpath, _dirs, names in os.walk(ROOT):
        if any(x in dirpath for x in (".git", "__pycache__")):
            continue
        for name in sorted(names):
            if not name.endswith(".py") or name.startswith("test_"):
                continue
            try:
                tree = ast.parse(open(os.path.join(dirpath, name),
                                      encoding="utf-8").read())
            except SyntaxError:
                continue
            for node in ast.walk(tree):
                if not isinstance(node, ast.Call):
                    continue
                fn = getattr(node.func, "id", None) or \
                    getattr(node.func, "attr", None)
                if fn not in pat_ctor:
                    continue
                cand = list(literals(node.args[0])) if node.args else []
                for kw in node.keywords:
                    if kw.arg == "code":
                        cand += literals(kw.value)
                for c in cand:
                    if len(c) >= 4 and c.replace("_", "").isalnum() \
                            and c.upper() == c:
                        codes.add(c)

    #: PASSED AS A VARIABLE, so no static pass can see them at the call site.
    #: `Reviser._collision_code()` returns one of these and `revise.py` builds
    #: `Finding(code, ...)` from it. Declared, with the reason, rather than
    #: silently absent (doctrine 1: the coordinate is stated where it is read).
    codes |= {"SCHEME_COLLISION", "NEAR_COLLISION", "REPEAT_ACROSS_GROUPS",
              "COLLISION_UNDECLARED"}
    return codes


VOCAB = vocabulary()
WORD = re.compile(r"\b([A-Z][A-Z0-9_]{3,})\b")

def run(*argv):
    p = subprocess.run([sys.executable, "lyric_harness.py", *argv],
                       cwd=ROOT, capture_output=True, text=True, timeout=1800)
    out = p.stdout + p.stderr
    codes = sorted({c for c in WORD.findall(out) if c in VOCAB})
    unknown = sorted({c for c in WORD.findall(out)
                      if c.isupper() and "_" in c and c not in VOCAB})
    refusal = None
    for i, ln in enumerate(out.splitlines()):
        if ln.strip().startswith("REFUSED"):
            tail = out.splitlines()[i + 1:i + 2]
            refusal = (ln.strip() + " || " + (tail[0].strip() if tail else ""))[:400]
            break
    fp = re.findall(r"md5 ([0-9a-f]{12})", out)
    rec = {"argv": list(argv), "rc": p.returncode, "codes": codes,
           "refusal": refusal, "fingerprints": fp,
           "unknown_shaped": unknown, "chars": len(out)}
    with open(LOG, "a") as fh:
        fh.write(json.dumps(rec) + "\n")
    return rec

def inspect_codes(lines, mandate, **kw):
    """-> (per_line_codes, whole_codes) READ FROM THE FINDING SET, not the page.

    THE GREP PATH ABOVE IS NOT A COVERAGE MEASUREMENT and rung 1 proved it:
    on one two-line draft it reported 18 codes where the API reports 8. All
    ten extras were PROSE -- `PREDICTABLE_RHYME` appears inside
    `EXTRAPOLATED_LENGTH`'s explanation of tolerance bands, `RADIF_LICENSED`
    and `CLICHE_PAIR` inside other findings' evidence. A report that explains
    which checks did NOT run necessarily names them, so grepping a report for
    code names counts the disclosure as the finding -- and inflates in the
    OPTIMISTIC direction, which is the direction that would have made this
    whole experiment report a healthier pipeline than exists.

    Doctrine 91 states the rule this function obeys: a count is a coordinate
    of the RENDERING, so the rendering must not be the source of the count.
    `Reviser.inspect()` returns `per_line` and `whole` as structured findings
    carrying `.code`; that is the population. Output-grepping is kept only for
    pure-CLI surfaces that expose no API.
    """
    sys.path.insert(0, ROOT)
    from quality.revise import Reviser
    d = Reviser().inspect(lines, mandate, **kw)
    per = sorted({f.code for v in d["per_line"].values() for f in v})
    whole = sorted({f.code for f in d["whole"]})
    return per, whole


if __name__ == "__main__":
    print(json.dumps(run(*sys.argv[1:]), indent=1))
