#!/usr/bin/env python3
"""THE COMPARATOR PIN: has the comparator moved since anyone last verified it?

    python3 quality/check_comparator_pin.py            # the gate
    python3 quality/check_comparator_pin.py --write \
        --verified-by quality/results/<dir>/curve-check.txt \
        --verdict "RESULT: HOLDS — ..."                # re-pin, with its receipt

WHY THIS EXISTS, in one measured case. On 2026-09-16 six pull requests touched
`lyric_harness.py` in a day (#297, #300, #301, #302, #304, #309), each landing
separately. Every one of them moved `comparator_fingerprint()` and so discarded
the predictability memo -- ~2.1 CPU-hours over the corpus's 11,941 distinct end
words -- and one of them MOVED THE SHIPPED `lyric` ROW. Nothing said so at the
time. The refusal surfaced hours later, on an unrelated commit, as a red
`curves` component in Production qualification that cost 134 minutes to
reach and blocked every deploy behind it until the row was repinned (#311,
`RESULTS_COMPARATOR_REPIN_2026-09-16.md`).

The defect was never the change. It was the SILENCE: a comparator can move in
a one-line diff, and the instrument that notices is the most expensive one in
the tree, so it notices late and somewhere else. This gate is cheap -- four
file hashes, a repr and two function sources -- and it turns that late,
displaced refusal into an immediate red on the PR that actually moved it.

WHAT IT CLAIMS, AND WHAT IT DOES NOT. It claims ONLY: the comparator is
byte-for-byte what it was when the pin was last written, so every calibration
verified against that pin still describes the comparator in the tree. It does
NOT claim any row is correct, and moving the pin does not make a row correct
(doctrine 58: a drift is a QUESTION -- argue it, repin as a SET, never tune).
A pin cannot be advanced without naming the receipt that backs it, because a
pin updated on nobody's authority is exactly the stale number wearing a
measurement's clothes that the fingerprint exists to refuse (doctrine 16).

EXIT 0 the comparator is where the pin says; 1 it MOVED, and the parts that
moved are named; 2 CANNOT TELL, because an input is not staged -- `cmudict.dict`
is fetched, not committed, so a job that has not run `fetch_data` has no
opinion about the comparator and must not be allowed to report one.
"""
import argparse
import hashlib
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

PIN_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                        "comparator_pin.json")
PIN_VERSION = 1


def _digest(value):
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def measure():
    """-> (fingerprint, {label: digest}, [labels not staged])."""
    from quality.song_profile_calibration import (comparator_fingerprint,
                                                  comparator_fingerprint_parts)
    parts = comparator_fingerprint_parts()
    absent = [label for label, value in parts if value.startswith("ABSENT:")]
    return (comparator_fingerprint(),
            {label: _digest(value) for label, value in parts},
            absent)


def load_pin(path=PIN_PATH):
    with open(path, encoding="utf-8") as fh:
        pin = json.load(fh)
    if pin.get("version") != PIN_VERSION:
        raise ValueError("comparator pin is version %r, this build writes %d"
                         % (pin.get("version"), PIN_VERSION))
    return pin


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--write", action="store_true",
                    help="re-pin to the comparator now in the tree")
    ap.add_argument("--verified-by",
                    help="path to the receipt that re-verified the calibrations")
    ap.add_argument("--verdict", help="what that receipt concluded, verbatim")
    ap.add_argument("--pinned-on", help="ISO date for the new pin")
    a = ap.parse_args(argv)

    fingerprint, parts, absent = measure()

    if absent:
        print("CANNOT TELL: %s not staged, so the comparator cannot be read."
              % ", ".join(absent))
        print("  `cmudict.dict` is fetched, not committed. Run:")
        print("      python3 -c \"import lyric_harness; lyric_harness.fetch_data()\"")
        print("  A job without the staged inputs has no opinion about the")
        print("  comparator and must not report one as a move.")
        return 2

    if a.write:
        if not a.verified_by or not a.verdict:
            print("REFUSED: --write needs --verified-by and --verdict.")
            print("  A pin records that somebody RE-VERIFIED the calibrations")
            print("  against this comparator. Advancing it without naming that")
            print("  receipt would launder a drift into a number nobody checked")
            print("  (doctrine 16). Re-run the affected cells first.")
            return 2
        if not os.path.exists(os.path.join(ROOT, a.verified_by)):
            print("REFUSED: --verified-by %s is not in the tree." % a.verified_by)
            print("  Bank the receipt beside the adoption, then re-pin.")
            return 2
        pin = {"version": PIN_VERSION, "fingerprint": fingerprint,
               "parts": parts, "pinned_on": a.pinned_on or "",
               "verified_by": a.verified_by, "verdict": a.verdict}
        tmp = PIN_PATH + ".tmp"
        with open(tmp, "w", encoding="utf-8") as fh:
            json.dump(pin, fh, indent=2, sort_keys=True)
            fh.write("\n")
        os.replace(tmp, PIN_PATH)
        print("RE-PINNED  %s" % fingerprint)
        print("  backed by %s" % a.verified_by)
        print("  verdict   %s" % a.verdict)
        return 0

    try:
        pin = load_pin()
    except FileNotFoundError:
        print("CANNOT TELL: no comparator pin at %s" % PIN_PATH)
        return 2
    except ValueError as e:
        print("CANNOT TELL: %s" % e)
        return 2

    print("PIN      %s" % pin["fingerprint"])
    print("MEASURED %s" % fingerprint)
    if fingerprint == pin["fingerprint"]:
        print("  backed by %s" % pin.get("verified_by", "?"))
        print("RESULT: HOLDS — the comparator is what it was when the "
              "calibrations were last verified.")
        return 0

    moved = sorted(k for k, v in parts.items() if pin.get("parts", {}).get(k) != v)
    gone = sorted(set(pin.get("parts", {})) - set(parts))
    print()
    print("THE COMPARATOR MOVED. Inputs that differ from the pin:")
    for k in moved:
        print("    %s" % k)
    for k in gone:
        print("    %s (no longer an input)" % k)
    if not moved and not gone:
        print("    (no single input differs — the pin's `parts` are stale;")
        print("     re-pin only after re-verifying)")
    print()
    print("This is not a lint failure. A moved comparator DISCARDS the")
    print("predictability memo (~2.1 CPU-hours) and can move any row fitted")
    print("against it. This pull request owns that:")
    print("  1. Re-run the calibrations this comparator feeds, at minimum")
    print("     `python3 quality/length_curve_calibration.py check`.")
    print("  2. If a row MOVED, argue it and repin as a SET — never tune a")
    print("     constant to clear this gate (doctrine 58).")
    print("  3. Bank the receipt, then re-pin:")
    print("       python3 quality/check_comparator_pin.py --write \\")
    print("           --verified-by <receipt path> --verdict \"<what it said>\"")
    print()
    print("RESULT: MOVED — %d of %d inputs." % (len(moved) + len(gone), len(parts)))
    return 1


if __name__ == "__main__":
    sys.exit(main())
