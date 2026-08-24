#!/usr/bin/env python3
"""The CAPACITY layer — what the English lexicon can sustain, derived.

STAGE 1 OF THE DENSITY DESIGN (owner's ruling, 2026-08-18). The question
"how much rhyme density is even possible" is not a corpus question — a
census of what's been done would band the middle of the distribution and
rate the ten-line marvel verse out-of-band, which is the move-37 ban all
over again. It is a LEXICON question, and this module answers it the way
`plan.py` answered meters: a space derived from the grammar of the
material, never sampled from history.

THE OBJECTS.
- A FAMILY is a perfect-rhyme equivalence class: words sharing the
  phoneme string from the RHYMING syllable's vowel to the end, anchored
  at the last PROMINENT vowel (primary or secondary stress, else the
  last vowel) — the COMPARATOR's anchor, the one the judge hears with.
  Run 1 anchored primary-first (`_spelled_rime`'s own rule, which is
  tier 1's, not the comparator's) and was VOIDED before commit:
  test_capacity §1's control pair convicted it (gasoline/tambourine
  grade as a satisfied rhyme on the final -ine; the primary-first key
  filed them apart). Held to the grader behaviorally — a family whose
  members do not grade as satisfied rhymes is a drift, and the witness
  certification below convicts it.
- A SPELLING CLASS within a family is `Reviser._spelled_rime`'s value —
  tier 1 of the two-tier ban: same-class pairs are HOMEOTELEUTON,
  banned outright. So a family's EARNED-chain ceiling is its spelling-
  class count (`chain_hi`): a scheme group of k mutually-earned lines
  needs k distinct spellings of one sound, because every pair in a
  mandated group is judged.
- The MODAL tier (the most-predictable partners) deletes a few more
  pairs. Rather than re-implementing that judgment — the drift sin the
  `screen` verb exists to avoid — the certified lower bound
  (`chain_lo`) is built by construction THROUGH THE GRADER ITSELF: a
  candidate witness (one word per spelling class, most frequent first)
  is graded as a real mandated group by `Reviser.inspect`, offending
  members are swapped or dropped, and the surviving clique is stored
  with its WITNESS WORDS so anyone can re-run the certification. The
  grader is the oracle; this module never holds an opinion of its own
  about any pair.

THE POPULATION is declared, not universal: the frequency lexicon
(`data/opensubtitles_en_50k.tsv` — the singable working vocabulary),
alphabetic words of two letters or more, transcribable by the
harness's own reader. Capacity of the LIVING vocabulary; a rarer word
is hand-reachable and simply not counted here.

WHAT THE NUMBERS SAY (derived 2026-08-18; `ADOPTED` below, re-derived
exactly by `--check`). English is narrow: 12,387 families, and only a
handful support a long single-sound earned chain — the distribution's
tail is in `data/rhyme_capacity_eng.tsv`. The ten-line dense verse
therefore REQUIRES family switching; that is now a derived fact about
the language, not a stylistic observation.

WHAT THIS DOES NOT LICENSE. Nothing here grades a draft (stage 2, the
earned-event counter, is deliberately unbuilt pending the owner's
ruling), nothing here is a target (a capacity is a ceiling, not a
score), and the planner samples none of it. The one consumer today is
the `capacity` verb: a reader over the committed artifact.

Run:   python3 quality/capacity.py --derive [--parts=DIR]  (writes the table)
       python3 quality/capacity.py --check                 (re-derives tier 1
                                                            + re-certifies the
                                                            sample; exits 1 on
                                                            any drift)
Verb:  python3 lyric_harness.py capacity WORD | --top=N
Test:  python3 quality/test_capacity.py
"""

import csv
import hashlib
import os
import re
import sys
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

TABLE_PATH = os.path.join(HERE, "..", "data", "rhyme_capacity_eng.tsv")


class BudgetReached(RuntimeError):
    """derive() stopped cleanly at its declared time budget; the parts
    directory carries everything certified so far — re-invoke to resume."""

#: Families certified through the grader: every family whose spelling-class
#: count reaches this floor. DECLARED at 20 (raised from 8, 2026-08-19,
#: with the measurement that forced the choice): the corrected anchor
#: merged the secondary-stress clusters and TRIPLED the certifiable set
#: (98 families at the first anchor, 272 at the corrected one), pricing
#: floor-8 certification at ~4 hours of grading. The >=20 tier is where
#: the SUSTAINING question lives — a family below it cannot hold even a
#: 20-line single-sound chain in principle, so tier-1 arithmetic answers
#: it — and any family below the floor is certifiable on demand by this
#: same instrument (`certify()` takes any family's classes).
CERTIFY_MIN_CLASSES = 20

#: Witness repair rounds before reporting the achieved size. Each round
#: swaps every offending member for its class's next-most-frequent word
#: (or drops the class when exhausted) and re-grades the whole group.
MAX_REPAIR_ROUNDS = 12

#: A COMPUTATIONAL HONESTY BOUND ON CONSTRUCTION, exactly EXACT_ENUM_MAX's
#: species: for a family with more spelling classes than this, the witness
#: ATTEMPT takes the classes with the most frequent top members and no
#: more. Measured need: the uncapped attempt on the deepest family (IY, 99
#: classes) re-grades ~4,900 pairs per repair round and ran past 30 CPU-
#: minutes without converging (2026-08-18). chain_hi stays EXACT — the
#: ceiling is tier-1 arithmetic, uncapped — and chain_lo was always a
#: lower bound; on a capped family it is additionally bounded by this
#: constant, which the record and the verb's wording both carry.
CERTIFY_ATTEMPT_CAP = 40

#: The headline constants, adopted from the 2026-08-18 derivation and
#: re-derived EXACTLY by --check (the Kalevala discipline: a committed
#: number nothing re-measures is a rumor). Filled by that run; the check
#: recomputes tier 1 in full (~seconds) and re-certifies the sample
#: families below through the grader.
ADOPTED = {
    "population": 39969,
    "families": 12387,
    "chain_hi_at_least": {2: 2817, 5: 593, 8: 272, 12: 162, 16: 106,
                          20: 81},
    "certified": 81,
    "max_chain_lo": 40,
    "max_chain_lo_family": "EY",
}

#: Families the per-push crown re-certifies (test_capacity §3) — the
#: deepest, one mid-tail, and the two the density conversation named.
CHECK_SAMPLE = ("IY", "AY-ER", "EH-R", "UW-Z", "EY-N", "AO-R")

_PAIR_RE = re.compile(r"L(\d+)/L(\d+)")


#: THE DEEPEST RHYME GROUP THE LEXICON IS MEASURED TO SUSTAIN — the adopted
#: constant, and the only figure from this layer a GENERATOR may read
#: (2026-08-23, `MISSING.md` M-41's first half).
#:
#: A rhyme group of k members needs a family with k members that the grader
#: accepts TOGETHER, and this layer is what measures that. Two numbers, and
#: the smaller one is the one that binds:
#:   * the tier-1 CEILING reaches 228 (family `IY`) — a spelling-class count,
#:     an upper bound nobody has graded;
#:   * the deepest CERTIFIED chain is 40 — a witness clique stored word for
#:     word and graded THROUGH `Reviser.inspect`, held by nine families at
#:     the declared construction cap.
#: 40 is adopted because it is the one a run can stand on. It measures the
#: CAP rather than the language — those nine families are bounded BELOW at 40
#: and their true ceilings are unmeasured — so a generator refusing above it
#: is refusing where the MEASUREMENT stops, which is the honest place.
#:
#: WHY A CONSTANT AND NOT A CALL: `quality/plan.py` may open no file (the
#: owner's move-37 ban), and `read_table()` opens one. This is the same
#: species as `meter_bands.ADOPTED` and `floor.PROFILES` — an adopted figure
#: from a preregistered derivation, re-derived by `capacity.py --check` in
#: the nightly lane, so drift fails loud rather than silently widening what a
#: planner will volunteer.
ADOPTED_MAX_GROUP = 40


def _rime_key(phones):
    """Phoneme rime from the rhyming syllable's vowel to the end, stress
    digits stripped. The ANCHOR IS THE COMPARATOR'S — last PROMINENT
    vowel (primary or secondary stress), else the last vowel — because a
    family is a perfect-rhyme class as the JUDGE hears it: gasoline
    (…AE1…IY2 N) rhymes on the final -ine, not on the early primary.
    This is deliberately NOT `_spelled_rime`'s primary-first anchor —
    that one is tier 1's own (the spelling classes below still use it) —
    and the first run of test_capacity §1 caught exactly this conflation
    (2026-08-18): the primary-first key put gasoline and tambourine in
    different families while the grader called them a satisfied rhyme.
    Held to the grader behaviorally: same-key pairs must grade satisfied
    (the crown re-grades every committed witness). The converse is NOT
    claimed: the graded band admits some cross-family near pairs
    (silver/deliver), so families are strictly FINER than the band."""
    vidx = [i for i, p in enumerate(phones) if p[-1:].isdigit()]
    if not vidx:
        return None
    anchor = None
    for i in reversed(vidx):
        if phones[i][-1] in "12":
            anchor = i
            break
    if anchor is None:
        anchor = vidx[-1]
    return tuple(p.rstrip("012") for p in phones[anchor:])


def population(lex):
    """-> {word: phones} over the declared population (module docstring)."""
    out = {}
    for w in lex.freq_rank:
        if not w.isalpha() or len(w) < 2:
            continue
        phones, oov = lex.transcribe_word(w)
        if not oov and phones and _rime_key(phones):
            out[w] = phones
    return out


def families(reviser):
    """-> {family_key: {spelled_rime: [words, most frequent first]}}."""
    lex = reviser.lex
    pop = population(lex)
    fams = defaultdict(lambda: defaultdict(list))
    for w, phones in pop.items():
        fams[_rime_key(phones)][reviser._spelled_rime(w)].append(w)
    for classes in fams.values():
        for words in classes.values():
            words.sort(key=lambda x: lex.freq_rank.get(x, 10 ** 9))
    return fams


def fam_label(key):
    return "-".join(key)


def _grade_group(reviser, words):
    """One real mandated group over carrier lines -> (bad_pairs, drifted).
    bad_pairs: {frozenset of two member INDICES} that the grader banned
    (HOMEOTELEUTON / MODAL_RHYME). drifted: members whose pairs the
    grader did not judge as satisfied rhymes at all — a family-key drift
    this module must fail loudly on, never absorb."""
    import quality.schemes as SC
    lines = [f"we carry the evening to the {w}" for w in words]
    found = reviser.inspect(lines, SC.mandate([list(range(1, len(words) + 1))],
                                              n_lines=len(words)))
    bad = set()
    for fs in found["per_line"].values():
        for f in fs:
            if f.code in ("HOMEOTELEUTON", "MODAL_RHYME"):
                m = _PAIR_RE.search(str(f.message))
                if m:
                    bad.add(frozenset((int(m.group(1)) - 1,
                                       int(m.group(2)) - 1)))
    drifted = set()
    for v in found["grade"]["verdicts"]:
        if v["why"] is not None:
            i, j = v["lines"]
            drifted.add(i - 1)
            drifted.add(j - 1)
    for r in found["grade"]["refusals"]:
        i, j = r["lines"]
        drifted.add(i - 1)
        drifted.add(j - 1)
    return bad, drifted


def certify(reviser, classes, max_rounds=MAX_REPAIR_ROUNDS):
    """Build and grade a witness clique for one family -> (witness, rounds).

    Start with each spelling class's most frequent member; grade the
    whole group through the REAL Reviser; on a banned pair, advance the
    rarer side to its class's next member (drop the class when the well
    is dry); a pair the grader would not judge as rhyme at all is a
    family drift and raises. The returned witness is exactly what the
    grader accepted — chain_lo by construction, not by claim. Families
    beyond CERTIFY_ATTEMPT_CAP classes attempt only the cap's worth (the
    classes with the most frequent top members), so the bound is honest
    and the cost is bounded; the ceiling (chain_hi) is never capped."""
    slots = [list(ws) for ws in classes.values() if ws]
    if len(slots) > CERTIFY_ATTEMPT_CAP:
        fr = reviser.lex.freq_rank
        slots.sort(key=lambda ws: fr.get(ws[0], 10 ** 9))
        slots = slots[:CERTIFY_ATTEMPT_CAP]
    pick = [0] * len(slots)
    live = list(range(len(slots)))
    for _round in range(max_rounds):
        words = [slots[i][pick[i]] for i in live]
        bad, drifted = _grade_group(reviser, words)
        if drifted:
            raise RuntimeError(
                f"family drift: the grader refused/denied rhyme inside a "
                f"derived family ({[words[k] for k in sorted(drifted)]}) — "
                f"the family key no longer mirrors the grader's anchor")
        if not bad:
            return words, _round + 1
        demote = set()
        for pair in bad:
            k = max(pair, key=lambda x: pick[live[x]])
            demote.add(k)
        new_live = []
        for idx, i in enumerate(live):
            if idx in demote:
                if pick[i] + 1 < len(slots[i]):
                    pick[i] += 1
                    new_live.append(i)
            else:
                new_live.append(i)
        live = new_live
        if not live:
            return [], _round + 1
    words = [slots[i][pick[i]] for i in live]
    bad, _ = _grade_group(reviser, words)
    while bad:
        counts = defaultdict(int)
        for pair in bad:
            for k in pair:
                counts[k] += 1
        worst = max(counts, key=lambda k: counts[k])
        del words[worst]
        if not words:
            return [], max_rounds
        bad, _ = _grade_group(reviser, words)
    return words, max_rounds


def derive(reviser=None, certify_min=CERTIFY_MIN_CLASSES, parts_dir=None,
           budget_s=None, log=lambda s: print(s, file=sys.stderr)):
    """The full derivation -> list of row dicts, deepest families first.
    Tier 1 (families, classes, chain_hi) for the whole population; the
    grader-certified witness (chain_lo) for every family at or above
    `certify_min` classes. `parts_dir` checkpoints one file per certified
    family so an interrupted run resumes instead of restarting (the
    census lesson). `budget_s` stops CLEANLY after that many seconds of
    certification work by raising BudgetReached — the caller re-invokes
    and the checkpoints carry the run; added when this environment
    proved willing to kill hour-long detached processes twice."""
    import time as _time
    t0 = _time.time()
    if reviser is None:
        from quality.revise import Reviser
        reviser = Reviser()
    fams = families(reviser)
    rows = []
    todo = sorted(fams.items(), key=lambda kv: (-len(kv[1]), fam_label(kv[0])))
    for key, classes in todo:
        n_classes = len(classes)
        row = {
            "family": fam_label(key),
            "words": sum(len(v) for v in classes.values()),
            "classes": n_classes,
            "chain_hi": n_classes,
            "certified": 0,
            "chain_lo": "",
            "witness": "",
            "examples": " ".join(ws[0] for ws in list(classes.values())[:8]),
        }
        if n_classes >= certify_min:
            part = (os.path.join(parts_dir, f"{row['family']}.tsv")
                    if parts_dir else None)
            if part and os.path.exists(part):
                with open(part, encoding="utf-8") as fh:
                    lo, wit = fh.read().rstrip("\n").split("\t")
                row["certified"], row["chain_lo"] = 1, int(lo)
                row["witness"] = wit
            else:
                if budget_s is not None and _time.time() - t0 > budget_s:
                    raise BudgetReached(
                        f"budget {budget_s}s reached with "
                        f"{row['family']} next — resume with the same "
                        f"--parts dir")
                log(f"certifying {row['family']} "
                    f"({n_classes} classes, {row['words']} words)...")
                witness, _rounds = certify(reviser, classes)
                row["certified"], row["chain_lo"] = 1, len(witness)
                row["witness"] = " ".join(witness)
                if part:
                    os.makedirs(parts_dir, exist_ok=True)
                    tmp = part + ".part"
                    with open(tmp, "w", encoding="utf-8") as fh:
                        fh.write(f"{len(witness)}\t{row['witness']}\n")
                    os.replace(tmp, part)
        rows.append(row)
    return rows


COLUMNS = ("family", "words", "classes", "chain_hi", "certified",
           "chain_lo", "witness", "examples")


#: WHAT THE CERTIFIED HALF DEPENDS ON, AND WHY IT IS RECORDED HERE.
#: `chain_hi` is tier-1 arithmetic over the pronunciation lexicon and moves
#: only when the lexicon moves. `chain_lo` is certified THROUGH THE GRADER,
#: whose tier-2 (MODAL) ban reads two CORPUS-DERIVED tables -- so the certified
#: floor rides a judge that changes whenever `corpus/song/eng_*` is reloaded
#: and the tables are rebuilt.
#:
#: THAT DEPENDENCE WAS REAL AND UNRECORDED, and it cost a day: `66eb44e`
#: rebuilt both tables over the loaded corpus (46,881 -> 131,394 and
#: 39,122 -> 97,129 rows) and every committed witness clique in this artifact
#: had been certified against the OLD ranking. `test_capacity` §3 went red with
#: six families carrying banned pairs and 0 drift, and nothing in the artifact,
#: the record or the checker could say WHY -- the answer took a before/after
#: re-grade under both tables to establish. Recording the md5s makes the next
#: rebuild LOCATABLE instead of a surprise: the check below names the moved
#: table by itself.
#:
#: THE FILE LIST IS NOT RE-STATED HERE. It is read from the one place the
#: eng-song frequency source is declared, so a third table joining the modal
#: tier cannot be silently left out of this fingerprint (doctrine 1).
JUDGE_HEADER = "#judge"


def judge_files():
    """-> the tables the tier-2 ban reads, from their single declaration."""
    from quality.frequency import LAYER
    return tuple(LAYER._sources["eng-song"].files)


def judge_fingerprint():
    """-> {relpath: md5}. ABSENT is a real state and hashes differently from
    a present file rather than crashing (the `comparator_fingerprint` rule)."""
    out = {}
    for rel in judge_files():
        try:
            with open(os.path.join(HERE, "..", rel), "rb") as fh:
                out[rel] = hashlib.md5(fh.read()).hexdigest()
        except OSError:
            out[rel] = "ABSENT"
    return out


def read_judge(path=TABLE_PATH):
    """-> the judge recorded in the artifact, or None if it predates this.

    None is NOT an empty dict: "this artifact records no judge" and "this
    artifact was certified against no tables" are different statements, and
    only the first is true of a table written before 2026-08-21 (doctrine 20).
    """
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            if not line.startswith("#"):
                return None
            if line.startswith(JUDGE_HEADER):
                out = {}
                for cell in line.rstrip("\n").split("\t")[1:]:
                    if "=" in cell:
                        k, v = cell.split("=", 1)
                        out[k] = v
                return out
    return None


def emit_table(rows, path=TABLE_PATH):
    tmp = path + ".part"
    with open(tmp, "w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh, delimiter="\t")
        w.writerow([JUDGE_HEADER] +
                   ["%s=%s" % kv for kv in sorted(judge_fingerprint().items())])
        w.writerow(COLUMNS)
        for r in rows:
            w.writerow([r[c] for c in COLUMNS])
    os.replace(tmp, path)


def read_table(path=TABLE_PATH):
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"{path} is missing — the capacity artifact ships with the "
            f"repo. Re-derive with `python3 quality/capacity.py --derive` "
            f"(the certified half grades every deep family through the "
            f"real Reviser and takes ~an hour).")
    with open(path, encoding="utf-8") as fh:
        rd = csv.reader((l for l in fh if not l.startswith("#")),
                        delimiter="\t")
        header = next(rd)
        assert tuple(header) == COLUMNS, f"unexpected columns: {header}"
        out = []
        for rec in rd:
            row = dict(zip(COLUMNS, rec))
            for k in ("words", "classes", "chain_hi", "certified"):
                row[k] = int(row[k])
            row["chain_lo"] = int(row["chain_lo"]) if row["chain_lo"] else None
            out.append(row)
        return out


def summarize(rows):
    """-> the ADOPTED-shaped dict, from rows (derived or read back)."""
    hi = {}
    for th in (2, 5, 8, 12, 16, 20):
        hi[th] = sum(1 for r in rows if r["chain_hi"] >= th)
    cert = [r for r in rows if r["certified"]]
    best = max(cert, key=lambda r: r["chain_lo"] or 0) if cert else None
    return {
        "population": sum(r["words"] for r in rows),
        "families": len(rows),
        "chain_hi_at_least": hi,
        "certified": len(cert),
        "max_chain_lo": best["chain_lo"] if best else 0,
        "max_chain_lo_family": best["family"] if best else "",
    }


def check():
    """Re-derive tier 1 exactly and re-certify the sample -> exit code."""
    from quality.revise import Reviser
    rv = Reviser()
    rows = read_table()
    fams = families(rv)
    fresh = {}
    for key, classes in fams.items():
        fresh[fam_label(key)] = (sum(len(v) for v in classes.values()),
                                 len(classes))
    bad = []
    for r in rows:
        got = fresh.pop(r["family"], None)
        if got != (r["words"], r["classes"]):
            bad.append(f"{r['family']}: table says {r['words']}w/"
                       f"{r['classes']}c, fresh says {got}")
    if fresh:
        bad.append(f"{len(fresh)} fresh families missing from the table")
    summary = summarize(rows)
    # THE GENERATOR-FACING CONSTANT IS RE-DERIVED HERE TOO, and it has to be:
    # `quality/plan.py` reads `ADOPTED_MAX_GROUP` to refuse a rhyme group
    # larger than the lexicon is MEASURED to sustain, and a constant that
    # drifts from its table silently widens what a planner volunteers into
    # groups no family can fill.
    if summary.get("max_chain_lo") != ADOPTED_MAX_GROUP:
        bad.append(f"ADOPTED_MAX_GROUP = {ADOPTED_MAX_GROUP} but the table's "
                   f"deepest CERTIFIED chain is "
                   f"{summary.get('max_chain_lo')!r}")
    for k, v in ADOPTED.items():
        if summary.get(k) != v:
            bad.append(f"ADOPTED[{k!r}] = {v!r} but the table says "
                       f"{summary.get(k)!r}")
    # THE JUDGE, ASKED FIRST AND REPORTED AS THE CAUSE. A witness that no
    # longer passes has two very different explanations -- the artifact is
    # wrong, or the grader moved underneath it -- and until 2026-08-21 this
    # check could only ever report the first. Naming the moved table turns
    # six mysterious family failures into one sentence with a remedy.
    recorded, current = read_judge(), judge_fingerprint()
    judge_moved = []
    if recorded is None:
        print("  NOTE: this artifact records no judge fingerprint (written "
              "before 2026-08-21). A moved judge cannot be told apart from a "
              "bad witness until it is re-derived once.")
    elif recorded != current:
        judge_moved = sorted(k for k in set(recorded) | set(current)
                             if recorded.get(k) != current.get(k))
        bad.append(
            "THE JUDGE MOVED, and the witness verdicts below are its "
            "consequence rather than %d independent findings (doctrine 79): "
            "%s changed since this artifact was certified. `chain_hi` is "
            "unaffected -- it is tier-1 arithmetic over the lexicon -- but "
            "every `chain_lo` was certified through a grader that no longer "
            "answers the same way. Re-derive: `python3 quality/capacity.py "
            "--derive --parts=DIR`"
            % (len(CHECK_SAMPLE), ", ".join(judge_moved)))

    by_fam = {r["family"]: r for r in rows}
    for fam in CHECK_SAMPLE:
        r = by_fam.get(fam)
        if not r or not r["certified"]:
            bad.append(f"sample family {fam} not certified in the table")
            continue
        words = r["witness"].split()
        pairs, drifted = _grade_group(rv, words)
        if pairs or drifted:
            bad.append(f"{fam}: committed witness no longer passes the "
                       f"grader (banned pairs {len(pairs)}, drift "
                       f"{len(drifted)})"
                       + (" [expected: the judge moved, above]"
                          if judge_moved else ""))
    for line in bad:
        print(f"  DRIFT: {line}")
    print(f"CAPACITY CHECK: {'FAIL' if bad else 'PASS'} — tier 1 "
          f"re-derived over {summary['families']} families, ADOPTED "
          f"constants compared, {len(CHECK_SAMPLE)} witnesses re-graded")
    return 1 if bad else 0


if __name__ == "__main__":
    if "--check" in sys.argv:
        sys.exit(check())
    if "--derive" in sys.argv:
        parts, budget = None, None
        for a in sys.argv:
            if a.startswith("--parts="):
                parts = a.split("=", 1)[1]
            if a.startswith("--budget="):
                budget = int(a.split("=", 1)[1])
        try:
            rows = derive(parts_dir=parts, budget_s=budget)
        except BudgetReached as e:
            print(f"BUDGET: {e}", file=sys.stderr)
            sys.exit(3)
        emit_table(rows)
        s = summarize(rows)
        print(f"wrote {TABLE_PATH}: {s}")
        sys.exit(0)
    print(__doc__)
    sys.exit(2)
