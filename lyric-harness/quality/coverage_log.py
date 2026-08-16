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
import json, re, subprocess, sys, os
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
    """
    pat = re.compile(r'(?:Finding|FitFinding|FitRefusal|GridFinding|Refusal)'
                     r'\(\s*["\']([A-Z][A-Z0-9_]{3,})["\']')
    alt = re.compile(r'\bcode\s*=\s*["\']([A-Z][A-Z0-9_]{3,})["\']')
    codes = set()
    for dp, _d, fs in os.walk(os.path.join(ROOT, "quality")):
        if "test" in dp:
            continue
        for f in fs:
            if not f.endswith(".py") or f.startswith("test_"):
                continue
            src = open(os.path.join(dp, f), encoding="utf-8").read()
            codes |= set(pat.findall(src)) | set(alt.findall(src))
    src = open(os.path.join(ROOT, "lyric_harness.py"), encoding="utf-8").read()
    codes |= set(pat.findall(src)) | set(alt.findall(src))
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

if __name__ == "__main__":
    print(json.dumps(run(*sys.argv[1:]), indent=1))
