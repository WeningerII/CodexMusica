"""test_field_store.py — the persistent floor-field store answers identically
and only ever identically (`MISSING.md` M-244's remaining lever).

THE ORACLE IS THE FIELD'S OWN DETERMINISM. `RhymeField.field` is a pure
function of (word, declaration, lexicon, comparator source), so a store that
serves one back is either byte-for-byte the value that was scored or it is a
defect. There is no tolerance to widen and no statistic to compare: every
section below is an equality.

THE DEFECT THIS SUITE EXISTS FOR IS CROSS-PROCESS AND IS SPELLED OUT IN §3.
`quality/calibration_rebuild.py` already carried a working persistent field
store and recorded `repr(harness.Declaration())` — the DEFAULT declaration,
constructed on the spot — where it meant the declaration the field was scored
under. For a one-declaration script that is true by accident; shared, it serves
one declaration's field to another declaration's caller and nothing says so.
§3 is that test, and it fails against that key.

Sections:
  1. CROSS-PROCESS byte equality — subprocess 1 scores a fixed list of real
     corpus end words cold, subprocess 2 is served them, and the digests of
     the field list, `words()` and `ranks()` all three match. TWO PROCESSES,
     because one process's second call is answered by the in-memory cache
     this store sits behind and would prove nothing.
  2. AT THE VERDICT — `SlopFloor().check()` on a real corpus item, cold then
     warm in separate processes, through the attach site in `quality/floor.py`
     rather than through a hand-built `RhymeField`. The findings digest must
     match.
  3. A MOVED DECLARATION MISSES, and the original is still served byte for
     byte afterwards. The test the `repr(Declaration())` key fails.
  4. EVERY declared coordinate is in the identity — a loop over
     `dataclasses.fields(Declaration)`, so a coordinate ADDED to the
     declaration is covered without anybody remembering to cover it. Plus the
     comparator: the fingerprint follows `lyric_harness.py`'s digest.
  5. AN IDENTITY THAT CANNOT BE SPELLED IS A MISS — a live `pronunciations`
     override, a `RhymeField` subclass, a database path that cannot be
     opened. `attach` says which, the plain dicts stay in place, and the
     fields are unchanged.
  6. The kill switch, the decoded-cache bound (a persistent row outlives an
     in-memory eviction), and the disclosure line.
"""

import copy
import dataclasses
import hashlib
import json
import os
import pickle
import sqlite3
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

import lyric_harness as LH  # noqa: E402
import quality.features  # noqa: E402
from quality import field_store as FS  # noqa: E402
from quality.features import QualityFeatures, RhymeField  # noqa: E402

FAILS = []


def check(name, cond, detail=""):
    tag = "PASS" if cond else "FAIL"
    print(f"  {tag}  {name}" + (f"  [{detail}]" if detail and not cond else ""))
    if not cond:
        FAILS.append(name)


def digest(value):
    return hashlib.sha256(repr(value).encode("utf-8")).hexdigest()


def run(source, *args, env=None):
    """One probe as its own PROCESS. The store is structurally cold in the
    first and structurally warm in the second; nothing in memory survives
    between them, which is the whole claim under test."""
    environment = dict(os.environ)
    if env:
        environment.update(env)
    path = os.path.join(WORK, f"probe_{abs(hash(source)) % 10**8}.py")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(source)
    done = subprocess.run([sys.executable, path, *args], cwd=ROOT, text=True,
                          capture_output=True, timeout=900, env=environment)
    payload = None
    for line in done.stdout.splitlines():
        if line.startswith("PROBE "):
            payload = json.loads(line[len("PROBE "):])
    return done.returncode, payload, done.stdout + done.stderr


WORK = tempfile.mkdtemp(prefix="field_store_")

#: The real corpus item every section reads. Committed, parsed by
#: `quality/corpus.py`'s own loader, and fixed — not sampled, not generated.
ITEM = 18

print("test_field_store — the persistent floor-field store (M-244)")

# ── 1. cross-process byte equality ───────────────────────────────────────
print("\n1. TWO PROCESSES: one scores a fixed list of real corpus end words "
      "cold, the next is served them, and the field, words() and ranks() "
      "digests all three match")

PROBE_FIELDS = '''
import hashlib, json, os, sys
sys.path.insert(0, %r)
import lyric_harness as LH
from quality import field_store as FS
from quality.corpus import load_sonnets
from quality.features import QualityFeatures, RhymeField

database = sys.argv[1]
words = []
for line in load_sonnets()[%d]:
    word = QualityFeatures._endword(line)
    if word and word not in words:
        words.append(word)
words = words[:4]
rhyme_field = RhymeField(LH.Lexicon(), LH.Declaration())
status = FS.attach(rhyme_field, database=database)


def digest(value):
    return hashlib.sha256(repr(value).encode("utf-8")).hexdigest()


print("PROBE " + json.dumps({
    "asked": words,
    "attached": status["attached"],
    "reason": status["reason"],
    "fingerprint": status["fingerprint"],
    "rows_at_attach": status["rows"],
    "field": digest([rhyme_field.field(w) for w in words]),
    "words": digest([rhyme_field.words(w) for w in words]),
    "ranks": digest([rhyme_field.ranks(w) for w in words]),
    "tally": FS.tally(),
}, sort_keys=True))
''' % (ROOT, ITEM)

DB1 = os.path.join(WORK, "cross_process.sqlite")
rc_cold, cold, log_cold = run(PROBE_FIELDS, DB1)
rc_warm, warm, log_warm = run(PROBE_FIELDS, DB1)
check("both processes exit 0 and report", rc_cold == 0 and rc_warm == 0
      and cold is not None and warm is not None,
      (log_cold + log_warm)[-800:])
if cold and warm:
    check("both attached, to the SAME fingerprint",
          cold["attached"] and warm["attached"]
          and cold["fingerprint"] == warm["fingerprint"],
          f"{cold['reason']} / {warm['reason']}")
    check("the words asked are real corpus end words, read from the item "
          "rather than written into this file",
          len(cold["asked"]) == 4 and cold["asked"] == warm["asked"],
          str(cold["asked"]))
    check("the first process is COLD: nothing addressable at attach, one "
          "miss per distinct word",
          cold["rows_at_attach"] == 0
          and cold["tally"]["miss"] == len(cold["asked"]),
          str(cold["tally"]))
    check("the second process is WARM: every row already addressable, ZERO "
          "misses — it scored nothing",
          warm["rows_at_attach"] == len(cold["asked"])
          and warm["tally"]["miss"] == 0 and warm["tally"]["hit"] > 0,
          str(warm["tally"]))
    for axis in ("field", "words", "ranks"):
        check(f"the {axis} digest is identical across the two processes",
              cold[axis] == warm[axis], f"{cold[axis]} != {warm[axis]}")

# ── 2. at the verdict ────────────────────────────────────────────────────
print("\n2. AT THE VERDICT: SlopFloor().check() on a real corpus item, cold "
      "then warm in separate processes, through floor.py's own attach site")

PROBE_VERDICT = '''
import hashlib, json, sys
sys.path.insert(0, %r)
from quality import field_store as FS
from quality.corpus import SONNET_SCHEME, load_sonnets
from quality.floor import SlopFloor

floor = SlopFloor()
findings = floor.check(load_sonnets()[%d], SONNET_SCHEME)
print("PROBE " + json.dumps({
    "findings": hashlib.sha256(repr(findings).encode("utf-8")).hexdigest(),
    "codes": [f.code for f in findings],
    "status": floor.field_store,
    "tally": FS.tally(),
    "disclosure": FS.disclosure(),
}, sort_keys=True))
''' % (ROOT, ITEM)

CACHE = os.path.join(WORK, "xdg")
rc_v1, v1, log_v1 = run(PROBE_VERDICT, env={"XDG_CACHE_HOME": CACHE})
rc_v2, v2, log_v2 = run(PROBE_VERDICT, env={"XDG_CACHE_HOME": CACHE})
check("both verdict processes exit 0 and report",
      rc_v1 == 0 and rc_v2 == 0 and v1 is not None and v2 is not None,
      (log_v1 + log_v2)[-800:])
if v1 and v2:
    check("the floor attaches without being asked to, at the versioned path "
          "under XDG_CACHE_HOME",
          v1["status"]["attached"]
          and v1["status"]["database"].startswith(CACHE)
          and v1["status"]["database"].endswith(
              "field_store_v%d.sqlite" % FS.STORE_VERSION),
          str(v1["status"]))
    check("the FINDINGS digest is identical cold and warm",
          v1["findings"] == v2["findings"],
          f"{v1['codes']} -> {v2['codes']}")
    check("the warm verdict scored NOTHING — it is the store that answered, "
          "not a second cold run",
          v1["tally"]["miss"] > 0 and v2["tally"]["miss"] == 0
          and v2["status"]["rows"] == v1["tally"]["miss"],
          f"{v1['tally']} -> {v2['tally']}")
    check("the cold run discloses cold and the warm run discloses warm",
          "FIELD STORE: cold" in v1["disclosure"]
          and "FIELD STORE: warm" in v2["disclosure"],
          f"{v1['disclosure']} / {v2['disclosure']}")

# ── 3. a moved declaration misses ────────────────────────────────────────
print("\n3. A MOVED DECLARATION MISSES, and the original row is still served "
      "byte for byte — the test the repr(Declaration()) key fails")
FS.clear()
DB3 = os.path.join(WORK, "declaration.sqlite")
LEX = LH.Lexicon()
BASE = LH.Declaration()
WORD, SECOND = "rain", "stove"

field_base = RhymeField(LEX, BASE)
status_base = FS.attach(field_base, database=DB3)
answer_base = field_base.field(WORD)
field_base.field(SECOND)          # a second row, for the bound in section 6

#: MEASURED, not assumed: perturbing each of the 21 declared coordinates one
#: at a time and re-scoring `rain`, `stove` and `day`, FIVE move a field —
#: `channel_weights`, `trailing_syllable_penalty`, `theta_rhyme`,
#: `coda_empty_evidence` and `scalar_alignment`. `scalar_alignment` is used
#: here rather than a threshold on purpose: a key built from the thresholds
#: somebody remembered would still be wrong about this one.
MOVED = dataclasses.replace(BASE, scalar_alignment="tail")
field_moved = RhymeField(LEX, MOVED)
status_moved = FS.attach(field_moved, database=DB3)
answer_moved = field_moved.field(WORD)
check("the perturbed declaration is a DIFFERENT fingerprint — a different "
      "namespace in the same file",
      status_moved["attached"]
      and status_moved["fingerprint"] != status_base["fingerprint"],
      f"{status_base['fingerprint']} / {status_moved['fingerprint']}")
check("and it genuinely moves the field, so a served hit here would be a "
      "WRONG ANSWER rather than a harmless one",
      answer_moved != answer_base,
      f"{len(answer_base)} vs {len(answer_moved)} candidates")
check("the moved declaration scored its own field instead of being served "
      "the original's", FS.tally()["miss"] >= 3, str(FS.tally()))

field_again = RhymeField(LEX, BASE)
status_again = FS.attach(field_again, database=DB3)
served_before = FS.tally()["hit"]
answer_again = field_again.field(WORD)
check("re-attaching under the ORIGINAL declaration returns to the original "
      "fingerprint", status_again["fingerprint"] == status_base["fingerprint"])
check("and the original field is SERVED, not re-scored",
      FS.tally()["hit"] == served_before + 1, str(FS.tally()))
check("byte for byte: the served field pickles to the same bytes as the "
      "field that was scored",
      pickle.dumps(answer_again, protocol=5)
      == pickle.dumps(answer_base, protocol=5))
_db = sqlite3.connect(DB3)
_row = _db.execute("SELECT value FROM fields WHERE fingerprint=? AND word=?",
                   (status_base["fingerprint"], WORD)).fetchone()
_moved_row = _db.execute(
    "SELECT value FROM fields WHERE fingerprint=? AND word=?",
    (status_moved["fingerprint"], WORD)).fetchone()
check("and the stored BLOB under the original fingerprint is those bytes",
      _row is not None
      and _row[0] == pickle.dumps(answer_base, protocol=5))
check("both declarations' answers coexist in ONE file under two fingerprints "
      "— the moved coordinate is a new namespace, never an invalidation",
      _moved_row is not None and _moved_row[0] != _row[0])
_db.close()

# ── 4. every declared coordinate, and the comparator ─────────────────────
print("\n4. EVERY entry of dataclasses.fields(Declaration) moves the "
      "fingerprint, so a coordinate added later is in the key without anybody "
      "adding it; and so does lyric_harness.py's own digest")

#: Alternatives that are VALID declarations — `Declaration.__post_init__`
#: refuses an unknown `admit` relation or `coda_empty_evidence` name, and
#: `score()` refuses an undeclared agreement or alignment, so a perturbation
#: cannot simply be "the old value plus one" for those.
ENUMERATED = {"coda_agreement": ("scalar", "identity", "licensed"),
              "nucleus_agreement": ("scalar", "identity", "licensed"),
              "scalar_alignment": ("head", "tail")}
NAMED = {
    "admit": ("RHYME",),
    "channel_weights": {"nucleus": 0.20, "coda": 0.65, "stress": 0.15},
    "channel_weights_interior": {"nucleus": 0.10, "coda": 0.55,
                                 "onset": 0.20, "stress": 0.15},
    "theta_by_relation": {"ASSONANCE": 0.50, "CONSONANCE": 0.50},
    "theta_coda": 0.20, "theta_nucleus": 0.95, "theta_rhyme": 0.50,
    "trailing_syllable_penalty": 0.90,
    "coda_licence": (("T", "D"),),
    "nucleus_licence": (("AA", "AE"), ("IY", "IH")),
}


def alternative(decl, spec):
    value = getattr(decl, spec.name)
    if spec.name == "coda_empty_evidence":
        return sorted(set(LH.CODA_EMPTY_EVIDENCE) - {value})[0]
    if spec.name in NAMED:
        return NAMED[spec.name]
    if spec.name in ENUMERATED:
        return next(x for x in ENUMERATED[spec.name] if x != value)
    if isinstance(value, bool):
        return not value
    if isinstance(value, str):
        return value + " (probe)"
    raise AssertionError(f"no alternative declared for {spec.name}")


# A DEDICATED OBJECT, NOT ONE OF THE ATTACHED ONES. `RhymeField.__init__`
# reads the lexicon, `VOWELS` and `NUC_FLOOR` and nothing from the
# declaration, so swapping `decl` on one object is the same identity question
# as building 21 of them and costs one construction instead of 21. Nothing
# below scores a field, so no store is touched.
probe = RhymeField(LEX, BASE)
mark = FS.fingerprint(FS.store_identity(probe))
declared = dataclasses.fields(LH.Declaration)
check("the declaration has coordinates and every one of them is READ into "
      "the identity", len(declared) > 0
      and {f.name for f in declared}
      == set(FS.store_identity(probe)["declaration"]),
      str(sorted({f.name for f in declared}
                 ^ set(FS.store_identity(probe)["declaration"]))))
for spec in declared:
    try:
        probe.decl = dataclasses.replace(BASE, **{spec.name: alternative(BASE, spec)})
        moved_mark = FS.fingerprint(FS.store_identity(probe))
    except Exception as error:                       # a refused declaration
        moved_mark, error_detail = mark, f"{type(error).__name__}: {error}"
    else:
        error_detail = ""
    check(f"moving Declaration.{spec.name} moves the fingerprint",
          moved_mark != mark, error_detail or "the key did not follow it")
probe.decl = BASE

_source = os.path.join(WORK, "lyric_harness_probe.py")
with open(_source, "w", encoding="utf-8") as fh:
    fh.write(open(LH.__file__, encoding="utf-8").read()
             + "\n\nFIELD_STORE_PROBE = 1\n")
_real_sources = FS.comparator_sources
try:
    FS.comparator_sources = lambda: (_source, quality.features.__file__)
    check("moving lyric_harness.py's own digest moves the fingerprint — "
          "NUC_FLOOR, score() and the vowel tables are coordinates no "
          "declaration names",
          FS.fingerprint(FS.store_identity(probe)) != mark)
finally:
    FS.comparator_sources = _real_sources
check("and the fingerprint returns to where it was once the real comparator "
      "is back", FS.fingerprint(FS.store_identity(probe)) == mark)

# ── 5. an identity that cannot be spelled is a MISS ──────────────────────
print("\n5. UNSPELLABLE IS A MISS: attach names the reason, the plain dicts "
      "stay where they were, and the fields are unchanged")
DB5 = os.path.join(WORK, "unspellable.sqlite")

_scoped = copy.copy(LEX)
_scoped.pronunciations = [{"line": "a line the writer declared a reading for",
                           "token": 1, "word": "a", "phones": ["AH0"],
                           "basis": "declared", "source": "this suite"}]
field_scoped = RhymeField(_scoped, BASE)
status_scoped = FS.attach(field_scoped, database=DB5)
check("a lexicon carrying a live pronunciations override is REFUSED, and the "
      "status says which coordinate it is",
      not status_scoped["attached"]
      and "pronunciation" in status_scoped["reason"],
      str(status_scoped))
check("its cache is still a plain dict — nothing was installed",
      type(field_scoped._cache) is dict)
check("and it answers exactly what it answered with no store at all",
      field_scoped.field(WORD) == answer_base)


class _SubclassedField(RhymeField):
    """A subclass may override `field`, `NUC_FLOOR` or the bucketing, and the
    identity describes none of that."""


field_subclass = _SubclassedField(LEX, BASE)
status_subclass = FS.attach(field_subclass, database=DB5)
check("a RhymeField SUBCLASS is refused by name",
      not status_subclass["attached"]
      and "_SubclassedField" in status_subclass["reason"],
      str(status_subclass))
check("the subclass keeps its plain dict and its answer",
      type(field_subclass._cache) is dict
      and field_subclass.field(WORD) == answer_base)

_unopenable = os.path.join(WORK, "a-directory-not-a-database")
os.makedirs(_unopenable, exist_ok=True)
field_nodb = RhymeField(LEX, BASE)
status_nodb = FS.attach(field_nodb, database=_unopenable)
check("a database path that cannot be opened is a MISS at ATTACH, naming the "
      "path — not an exception out of the middle of a grade",
      not status_nodb["attached"] and _unopenable in status_nodb["reason"],
      str(status_nodb))
check("its cache is still a plain dict and its answer is unchanged",
      type(field_nodb._cache) is dict
      and field_nodb.field(WORD) == answer_base)

_before_resource = FS.lexicon_resources
try:
    FS.lexicon_resources = lambda: (os.path.join(WORK, "no-such-dictionary"),)
    status_gone = FS.attach(RhymeField(LEX, BASE), database=DB5)
    check("a data file the identity cannot read is a MISS naming the file — "
          "every rank in a field comes out of those bytes",
          not status_gone["attached"]
          and "no-such-dictionary" in status_gone["reason"],
          str(status_gone))
finally:
    FS.lexicon_resources = _before_resource

# ── 6. the kill switch, the bound, and the disclosure ────────────────────
print("\n6. LYRIC_FIELD_STORE=0 bypasses it; a persistent row outlives an "
      "in-memory eviction; the disclosure names three counts and sums none")
os.environ["LYRIC_FIELD_STORE"] = "0"
try:
    field_off = RhymeField(LEX, BASE)
    status_off = FS.attach(field_off, database=DB3)
    check("the switch is off, attach declines and says so, and the cache is "
          "a plain dict", not FS.enabled() and not status_off["attached"]
          and "LYRIC_FIELD_STORE=0" in status_off["reason"]
          and type(field_off._cache) is dict, str(status_off))
    check("and the disclosure spells OFF as off rather than as a row of "
          "zeroes that reads like a cold run",
          FS.disclosure().strip().startswith("FIELD STORE: off"),
          FS.disclosure())
finally:
    del os.environ["LYRIC_FIELD_STORE"]
check("removing the switch turns it back on", FS.enabled())

FS.clear()
field_bound = RhymeField(LEX, BASE)
status_bound = FS.attach(field_bound, database=DB3, limit=1)
check("the bounded store addresses both rows the base declaration wrote",
      status_bound["attached"] and status_bound["rows"] == 2,
      str(status_bound))
first = field_bound.field(WORD)
second = field_bound.field(SECOND)
check("decoding the second field evicted the first from memory",
      len(field_bound._cache.decoded) <= 1,
      str(len(field_bound._cache.decoded)))
served_before = FS.tally()["hit"]
again = field_bound.field(WORD)
check("and the evicted field is SERVED FROM DISK, byte for byte — an "
      "in-memory eviction is a lookup cost, never a lost row",
      FS.tally()["hit"] == served_before + 1
      and pickle.dumps(again, protocol=5) == pickle.dumps(first, protocol=5)
      and again != second, str(FS.tally()))

line = FS.disclosure()
counts = FS.tally()
check("the disclosure is one line, in the shape of the FIELD MEMO and PAIR "
      "MEMO lines", line.startswith("  FIELD STORE: ")
      and "\n" not in line, repr(line))
_total = str(counts["hit"] + counts["miss"])
_total_is_distinct = _total not in {str(counts[k])
                                    for k in ("hit", "miss", "held")}
check("it reports served, scored and held as THREE counts and sums none of "
      "them (doctrine 79)",
      all(str(counts[k]) in line for k in ("hit", "miss", "held"))
      and (not _total_is_distinct or f" {_total} " not in line),
      f"{counts} / {line}")
check("and it says warm, because this process inherited rows an earlier "
      "process wrote — not merely because it answered its own second ask",
      "FIELD STORE: warm" in line, line)

print(f"\n{'ALL PASS' if not FAILS else f'{len(FAILS)} FAILURE(S)'}")
sys.exit(1 if FAILS else 0)
