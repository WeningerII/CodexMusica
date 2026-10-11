#!/usr/bin/env python3
"""Regressions for THE MOBY CONVERTER (quality/moby_convert.py).

The converter's promise is that a Moby transcription becomes ARPAbet only by
the legend, and that everything the legend does not settle is held or
rejected by name rather than guessed. Each section would fail if that broke.

Sections:
  1  legend rows convert exactly (including the reading PR #531 shipped),
     and the legend table itself is pinned symbol by symbol
  2  what the legend does not settle is held or rejected, never guessed
  3  the counted extensions and conventions are logged, so each can be vetoed
  4  the --check CLI: missing input is CANNOT TELL, a different file refuses
  5  the pinned counts AND output digest on the pinned mpron.txt (staged)

Exit 0 all pass; 1 a failure; 2 CANNOT TELL (section 5's input not staged).
"""

import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
sys.path.insert(0, ROOT)

from quality import moby_convert as M                            # noqa: E402

FAILURES = []


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


def conv(word, moby):
    log = set()
    return M.convert(moby, log, "review", "-" in word, "all", word), sorted(log)


def test_legend_rows():
    print("\n1. legend rows convert exactly")
    got, _ = conv("streetlight", "'str/i/t,l/aI/t")
    check("streetlight (mpron.txt L151586) is the reading PR #531 shipped as "
          "moby:3205:attested",
          got == ("S", "T", "R", "IY1", "T", "L", "AY2", "T"), got)
    got, _ = conv("lights", "l/aI/ts")
    check("lights (L95072): a monosyllable, final T S kept",
          got == ("L", "AY1", "T", "S"), got)
    got, _ = conv("thorough", "'T/@r//oU/")
    check("@r is the legend's ER, stressed by the preceding apostrophe",
          got is not None and got[:2] == ("TH", "ER1"), got)
    got, _ = conv("long", "l/O//N/")
    check("the SLASHED /N/ is English ng (long, mpron.txt)",
          got == ("L", "AO1", "NG"), got)
    # The legend, pinned literally: a symbol remapped in the table (an
    # AE->AA slip passed every count pin, #534 review) fails here by name.
    check("the vowel legend is aaREADME's, symbol by symbol",
          M.LEGEND_V == {'&': 'AE', '(@)': 'EH', 'A': 'AA', 'eI': 'EY', '@': 'AH',
                         '-': 'AH', 'E': 'EH', 'i': 'IY', 'I': 'IH', 'aI': 'AY',
                         'Oi': 'OY', 'AU': 'AW', 'O': 'AO', 'oU': 'OW', 'u': 'UW',
                         'U': 'UH', '@r': 'ER'})
    check("the consonant legend is aaREADME's, symbol by symbol",
          M.LEGEND_C == {'b': 'B', 'tS': 'CH', 'd': 'D', 'f': 'F', 'g': 'G',
                         'h': 'HH', 'hw': 'W', 'dZ': 'JH', 'k': 'K', 'l': 'L',
                         'm': 'M', 'N': 'NG', 'n': 'N', 'p': 'P', 'r': 'R',
                         'S': 'SH', 's': 'S', 'T': 'TH', 'D': 'DH', 't': 'T',
                         'v': 'V', 'w': 'W', 'j': 'Y', 'Z': 'ZH', 'z': 'Z'})


def test_unsettled_is_not_guessed():
    print("\n2. what the legend does not settle is held or rejected")
    got, log = conv("glory", "'gl/oU/r/i/")
    check("OW before an intervocalic r is held for review (glory vs showroom)",
          got is None and any(t.startswith("review:OW") for t in log), log)
    got, log = conv("bach", "b/A/x")
    check("a foreign sound rejects the row", got is None and "reject:foreign" in log, log)
    got, log = conv("qat", "q/&/t")
    check("a character outside the legend rejects the row",
          got is None and "reject:non-legend char" in log, log)
    got, log = conv("lemon", "l/E/m/@/n")
    check("a polysyllable with no stress mark is held, not given a stress",
          got is None and "review:no primary mark (unmarked)" in log, log)
    got, log = conv("blanc", "bl/A/N")
    check("a BARE N (outside slashes) is the foreign nasal and is rejected, "
          "never read as NG (real row: mpron.txt L18248, #534 review)",
          got is None
          and "reject:foreign nasal (bare N; English ng is slashed /N/)" in log, log)
    got, log = conv("zinnwaldite", "'/z/I/nv/A/l,t/aI/t")
    check("unbalanced slashes reject the row (real malformed row)",
          got is None and "reject:unbalanced slashes" in log, log)
    got, log = conv("ice_cream", "aIs_kr/i/m")
    check("a phrase with no hyphen in its headword is rejected",
          got is None and "reject:phrase" in log, log)


def test_extensions_are_counted():
    print("\n3. extensions and conventions are logged")
    got, log = conv("how", "h/&//U/")
    check("/&//U/ (undocumented) reads as AW and is counted as an extension",
          got == ("HH", "AW1") and "ext:/&//U/ -> AW" in log, (got, log))
    got, log = conv("light", "l/aI/t")
    check("an unmarked monosyllable takes primary stress by a counted convention",
          got == ("L", "AY1", "T")
          and "convention:monosyllable stress 1 (unmarked in source)" in log, log)
    got, log = conv("white", "hw/aI/t")
    check("the hw->W merger is a logged convention, not a silent mapping",
          got == ("W", "AY1", "T")
          and "convention:hw->W (wine/whine merger; CMUdict has no HW)" in log, log)


def test_cli():
    print("\n4. the --check CLI")
    script = os.path.join(HERE, "moby_convert.py")
    missing = os.path.join(tempfile.mkdtemp(), "mpron.txt")
    r = subprocess.run([sys.executable, script, "--check", f"--mpron={missing}"],
                       capture_output=True, text=True)
    check("a missing mpron.txt is CANNOT TELL, exit 2",
          r.returncode == 2 and "CANNOT TELL" in r.stdout, r.stdout.strip())
    with open(missing, "w", encoding="latin-1") as fh:
        fh.write("light l/aI/t\n")
    r = subprocess.run([sys.executable, script, "--check", f"--mpron={missing}"],
                       capture_output=True, text=True)
    check("a file that is not the pinned mpron.txt is refused, exit 1",
          r.returncode == 1 and "REFUSED" in r.stdout, r.stdout.strip())


def test_pinned_counts():
    print("\n5. the pinned counts on the pinned mpron.txt")
    path = M.staged_mpron()
    code, lines = M.check(path)
    if code == 2:
        print("  CANNOT TELL  " + lines[0])
        return False
    check("--check reproduces the pinned counts and the digest of every "
          "converted reading", code == 0, "; ".join(lines))
    return True


if __name__ == "__main__":
    test_legend_rows()
    test_unsettled_is_not_guessed()
    test_extensions_are_counted()
    test_cli()
    staged = test_pinned_counts()
    print()
    if FAILURES:
        print(f"{len(FAILURES)} FAILED")
        sys.exit(1)
    if not staged:
        print("CANNOT TELL: sections 1-4 pass; section 5 needs mpron.txt staged")
        sys.exit(2)
    print("ALL PASS")
