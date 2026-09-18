#!/usr/bin/env python3
"""THE PERSISTENT FLOOR-FIELD STORE — a rhyme field that outlives the process,
keyed on the word AND the declaration it was scored under (`MISSING.md` M-244).

WHAT IT IS FOR, IN THE MEASUREMENT THAT ASKED FOR IT. M-244 profiled a graded
seed and found `RhymeField.field` at 151.5 s of a 171.8 s `Reviser.inspect`,
all of it inside `lyric_harness.score` (2,229,177 calls). The per-object cache
HITS — 1,496 of 1,558 calls — so the cost is the 62 MISSES, one per distinct
end word, ~2.4 s each, and every fresh process pays them again. The entry names
this as the next lever and does not take it: "a field memo that outlives the
process (keyed on the word AND the declaration it was scored under)". This is
that memo.

IT ADDS NO SCORING CODE AND CHANGES NO NUMBER. A field is a pure function of
(word, declaration, lexicon, comparator source); this module stores the answer
and serves it back byte for byte. What it has to get right is the KEY, because
the only way a memo of a deterministic function can be wrong is by answering a
question it was not asked.

WHY IT INSTALLS BY ASSIGNMENT AND NOT BY EDITING THE COMPARATOR.
`quality/features.py` `RhymeField.field` touches `self._cache` with exactly
three operations — `in`, `[]` and `[] =` — so any MutableMapping can stand in
its place, and none of the comparator's own bytes have to move. That matters
beyond tidiness: `quality/features.py` is one of the files
`quality/check_comparator_pin.py` hashes, and editing it would move the
comparator pin, discard the ~2.1 CPU-hour predictability memo, and demand a
cold re-verification. A cache that could only be installed by invalidating
every calibration that depends on it is not a cache. So the attach site is the
CALLER — `quality/floor.py` `SlopFloor.__init__` — and this file.

WHAT IT REUSES. `quality/calibration_rebuild.py` already carries a working
persistent field store: `SQLiteFields` over a `fields(fingerprint, word,
value BLOB, PRIMARY KEY(fingerprint, word))` table, `PrimitiveUnpickler` and
`decode_field` (which refuse a blob that is not a list of (str, int, number)),
and `BoundedCache`. Those are imported, not rewritten. The table shape is
literally the same one, so a file written by either is readable by the other —
and nothing can be SERVED across them, because the fingerprint column is the
namespace and the two modules spell different identities into it.

THE ONE THING THAT IS NOT REUSED, AND IT IS WHY M-244 IS STILL OPEN.
`calibration_rebuild.field_input_record()` records `repr(harness.Declaration())`
-- the DEFAULT declaration, constructed on the spot -- rather than the
declaration the field was actually scored under. For a script that only ever
builds one `QualityFeatures()` with no `decl` that is true by accident; as a
SHARED store it is the silent comparator substitution doctrine 1 exists for,
because a caller holding `Declaration(theta_rhyme=0.9)` would be served the
0.75 field and never learn it. `store_identity()` below reads the instance's
own `decl`, and `quality/test_field_store.py` section 3 is the test that would
have caught it.

THE KEY, IN FULL. A row is addressed by (fingerprint, word.lower()), where the
fingerprint folds:

  1. `store_version` -- this file's own format number.
  2. `declaration` -- `discriminate.declaration_tuple(decl)` over EVERY entry
     of `dataclasses.fields(Declaration)`, all 21 of them, and deliberately
     NOT a hand-picked subset. Only 6 of the 21 can move a field result today
     (`field()` keeps `s["total"]` and discards `s["relation"]`, so the whole
     relation ladder is invisible to it), and keying on a measured subset
     would be exactly right until the day somebody returns `relation` from
     `field()` -- at which point the key would be incomplete and nothing would
     say so. Keying on all 21 also means a coordinate ADDED to `Declaration`
     enters the key by itself, with nobody remembering to add it.
  3. `lexicon` -- the type, `strip_parens`, the g2p fallback's (type,
     min_confidence), and the CONTENT digests of `cmudict.dict` and
     `data/opensubtitles_en_50k.tsv`. CONTENT, not path: every tuple a field
     returns carries a `rank` read from `lex.freq_rank`, which is that TSV,
     so a re-fetched frequency table rescales every field in the store while
     the path it lives at says nothing at all (doctrine 58).
  4. `comparator` -- the docstring-stripped digests of `lyric_harness.py` and
     `quality/features.py`, in `discriminate._digest_source`'s shape.
     `NUC_FLOOR`, the vowel and consonant tables, `anchor`, `syllabify`,
     `vowel_sim` and every line of `score` are constants no declaration names
     and no lexicon carries; a key that skipped them would serve a field
     scored by comparator A to a caller running comparator B, which is the
     defect `quality/check_comparator_pin.py` exists because of. Docstring
     stripping is `_digest_source`'s own argument (a comment cannot move a
     number, and keying on one made fixing a wrong comment cost 2.3
     CPU-hours); it is used here for the same reason and with the same
     over-approximation.

AN IDENTITY THAT CANNOT BE SPELLED IS A MISS, NEVER A HIT. A live
`pronunciations` override, a lexicon already scoped to one occurrence reading,
a data file that cannot be read, a `RhymeField` subclass, a database path that
cannot be opened: `attach()` leaves the plain dicts exactly where they were,
returns a status saying which of those it was, and does not raise. The whole
value of this module is that a hit is an identical question; a store that
guessed at one coordinate to avoid a miss would be worth less than no store.

THERE IS NO INVALIDATION, BY DESIGN. A moved coordinate is a different
fingerprint, hence a different namespace, and the old rows are simply never
addressed again. Nothing is deleted, nothing is discarded, and no run has to
decide whether somebody else's rows are still good. The cost is disk: rows
under a retired fingerprint are dead weight until the file is removed by hand,
which is the same bargain `song_profile_calibration.py` takes with its
predictability TSV and the reason the version rides in the FILENAME as well as
in the key.

`LYRIC_FIELD_STORE=0` bypasses it entirely, in the shape of `LYRIC_FIELD_MEMO`
and `LYRIC_PAIR_MEMO`. `disclosure()` is the one line a caller prints: served,
scored and held, three counts and never a sum (doctrine 79).
"""
import hashlib
import os
import sqlite3
import sys
import weakref

HERE = os.path.dirname(os.path.abspath(__file__))
if os.path.dirname(HERE) not in sys.path:
    sys.path.insert(0, os.path.dirname(HERE))

__all__ = ["STORE_VERSION", "Unspellable", "attach", "clear", "default_database",
           "disclosure", "enabled", "fingerprint", "store_identity", "tally"]

#: The store's own format number. It rides in the KEY (so a format change can
#: never serve an old row) and in the FILENAME (so a reader can see which
#: format a file on disk is without opening it), which is
#: `song_profile_calibration.CACHE_VERSION`'s convention and is followed here
#: rather than re-argued.
STORE_VERSION = 1

#: Decoded fields held in memory at once, per attached store. NOT a clamp: past
#: it the LRU evicts a DECODED field and the SQLite row stays exactly where it
#: was, so the next ask re-decodes instead of re-scoring -- the eviction changes
#: repeated lookup cost and nothing else, which is `BoundedCache`'s own
#: contract and what section 6 of the suite pins.
#:
#: DERIVED FROM THE PLANNER'S ENVELOPE, 12..447 lines (`MISSING.md` M-239): a
#: draft cannot present more distinct end words than it has lines, so 512 holds
#: every field of the longest draft the planner can emit, with room. It is the
#: same number `revise.FIELD_MEMO_CAP` and `calibration_rebuild`'s
#: `--max-cached-fields` default carry, which is a coincidence of the same
#: envelope and is stated so the next reader does not have to guess whether it
#: is one pin or three.
DECODED_FIELDS = 512

_TALLY = {"hit": 0, "miss": 0}
#: Rows this process found already addressable when it attached. It is what
#: "warm" MEANS for a store whose whole claim is cross-process: within one
#: process a field asked twice is a legitimate hit (`words()` and `ranks()`
#: both re-enter `field()`), so a state derived from the hit count says warm on
#: a run that inherited nothing and scored everything -- measured, on this
#: suite's own cold arm, which is how it was found.
_INHERITED = {"rows": 0}
#: Weak refs, so an attached store dies with the `RhymeField` that holds it and
#: a long-lived process is not kept alive by its own tally. `Mapping` sets
#: `__hash__ = None`, so these cannot live in a WeakSet.
_ATTACHED = []


class Unspellable(ValueError):
    """An identity coordinate this store cannot state exactly.

    Raised INSIDE this module only and caught by `attach()`, which turns it
    into a status. It is never allowed to reach a caller, because the caller's
    alternative to a memo is not an error -- it is doing the work.
    """


def enabled():
    """-> whether the store is live. `LYRIC_FIELD_STORE=0` bypasses it."""
    return os.environ.get("LYRIC_FIELD_STORE", "1") != "0"


def default_database():
    """-> the cache path, version in the filename.

    `song_profile_calibration.DEFAULT_CACHE`'s convention, spelled the same
    way: `$XDG_CACHE_HOME` when set, `~/.cache` when not, then
    `lyric-harness/`. Read at CALL time and not frozen at import, so a test
    (or a caller sandboxing its run) can move `XDG_CACHE_HOME` and be obeyed.
    """
    return os.path.join(
        os.environ.get("XDG_CACHE_HOME",
                       os.path.join(os.path.expanduser("~"), ".cache")),
        "lyric-harness", "field_store_v%d.sqlite" % STORE_VERSION)


def _digest_content(path):
    """sha256 of a file's BYTES. Raises OSError when it cannot be read.

    Deliberately NOT `discriminate._digest_file`, whose "ABSENT" marker is the
    right answer for a feature cache that must notice a resource arriving.
    Here an unreadable resource is an identity that cannot be spelled: the
    lexicon in hand was built from SOMETHING, and a store that keyed the
    absence would be keying a fact about this process's permissions rather
    than about the data every rank in the field came from.
    """
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def comparator_sources():
    """-> the source files whose CODE decides what a field answers.

    A function rather than a constant so the paths resolve against the modules
    actually imported, and so section 4 of the suite can point it at a moved
    copy and watch the fingerprint follow.
    """
    import lyric_harness
    import quality.features
    return (lyric_harness.__file__, quality.features.__file__)


def lexicon_resources():
    """-> the data files the lexicon READ, as the lexicon's own module names
    them. `Lexicon.__init__` opens exactly these two."""
    import lyric_harness
    return (lyric_harness.CMUDICT_PATH, lyric_harness.FREQ_PATH)


def _module_digest(value):
    """-> the docstring-stripped digest of the file defining `value`'s type.

    For the g2p fallback and for a `Lexicon` subclass: the SPEC for this key
    names the fallback's (type, min_confidence), and a type name alone is a
    promise about code this store never looked at. Digesting the defining
    module closes that without widening the key for the common case, where
    there is no fallback and the lexicon is `lyric_harness.Lexicon`, whose
    source is already in `comparator`.
    """
    import inspect
    from quality.discriminate import _digest_source
    try:
        path = inspect.getfile(type(value))
    except TypeError as error:                      # a builtin/extension type
        raise Unspellable(f"{type(value).__name__} is not file-backed: {error}")
    return _digest_source(path)


def _lexicon_identity(lex):
    """-> the lexicon's exact coordinates, or raise `Unspellable`."""
    # A LIVE OCCURRENCE READING IS NOT A LEXICON COORDINATE AND MUST NOT BE
    # TREATED AS ONE. `quality/pronunciation.py` applies a declared reading by
    # copying the lexicon and layering a ChainMap over `entries` for ONE token
    # of ONE line. The field this store holds is keyed by WORD, with no line
    # and no token in it, so there is no key under which a scoped lexicon's
    # answer is the same question as an unscoped one's. Refuse, and let the
    # caller score it.
    if getattr(lex, "pronunciations", ()):
        raise Unspellable("the lexicon carries live pronunciation overrides")
    for attribute in ("_pronunciation_line", "_pronunciation_tokens",
                      "_pronunciation_choice"):
        if getattr(lex, attribute, None):
            raise Unspellable("the lexicon is scoped to a declared occurrence "
                              f"reading ({attribute})")
    if type(getattr(lex, "entries", None)) is not dict:
        raise Unspellable("the lexicon's entries are layered over another "
                          "mapping and are not a plain dictionary")
    if type(getattr(lex, "freq_rank", None)) is not dict:
        raise Unspellable("the lexicon's frequency ranks are not a plain "
                          "dictionary")
    fallback = getattr(lex, "g2p_fallback", None)
    kind = type(lex)
    identity = {
        "type": kind.__module__ + "." + kind.__qualname__,
        "strip_parens": repr(getattr(lex, "strip_parens", None)),
        "fallback": None if fallback is None else {
            "type": type(fallback).__module__ + "."
                    + type(fallback).__qualname__,
            "min_confidence": repr(getattr(fallback, "min_confidence", None)),
            # The fallback SPELLS pronunciations for words the dictionary does
            # not carry, so its code is a coordinate of every field that
            # reaches one. A name and a threshold do not pin an algorithm.
            "source": _module_digest(fallback),
        },
    }
    # A SUBCLASS'S OWN SOURCE, for the same reason and only when there is one:
    # `lyric_harness.Lexicon`'s file is already digested under `comparator`.
    if kind.__module__ != "lyric_harness":
        identity["type_source"] = _module_digest(lex)
    resources = {}
    for path in lexicon_resources():
        try:
            resources[os.path.basename(path)] = _digest_content(path)
        except OSError as error:
            raise Unspellable(f"{os.path.basename(path)} cannot be read: "
                              f"{error.strerror or error}")
    identity["resources"] = resources
    return identity


def store_identity(rhyme_field):
    """-> everything that, if it changed, would make a stored field a
    different list. Raises `Unspellable` when one of them cannot be stated.

    The argument is the `RhymeField` ITSELF, not a declaration handed in
    beside it, so the identity cannot drift from the object whose cache it is
    about to key. That is the whole of M-244's open defect in one line.
    """
    from quality.discriminate import _digest_source, declaration_tuple
    from quality.features import RhymeField
    # A SUBCLASS MAY OVERRIDE `field`, `NUC_FLOOR` OR THE BUCKETING and this
    # key describes none of that. `type(...) is not` rather than
    # `isinstance`: the whole question here is whether the code that will
    # write into this store is the code the key names.
    if type(rhyme_field) is not RhymeField:
        raise Unspellable(
            f"{type(rhyme_field).__name__} is not quality.features.RhymeField; "
            "a subclass may score a field this key does not describe")
    return {
        "store_version": STORE_VERSION,
        "declaration": declaration_tuple(rhyme_field.decl),
        "lexicon": _lexicon_identity(rhyme_field.lex),
        "comparator": {os.path.basename(p): _digest_source(p)
                       for p in comparator_sources()},
    }


def fingerprint(identity):
    """-> the namespace one identity addresses. Full sha256, not a prefix: it
    is a table column rather than something a human reads off a report, so
    there is nothing to be gained by shortening it and a collision here is a
    wrong number."""
    import json
    blob = json.dumps(identity, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


class _Tallying:
    """The hit/miss counter, mixed in over `SQLiteFields`.

    `RhymeField.field` asks `key in self._cache` and scores the word when the
    answer is no. So `__contains__` IS the hit/miss boundary -- there is no
    other place to count it, and counting anywhere else would be counting
    something adjacent and calling it a hit rate.
    """

    def __contains__(self, key):
        got = super().__contains__(key)
        _TALLY["hit" if got else "miss"] += 1
        return got


_FIELDS_CLASS = None


def _fields_class():
    """-> `_Tallying` over `calibration_rebuild.SQLiteFields`, bound on first
    use and then cached.

    THE DEFERRED IMPORT IS STRUCTURAL AND NOT A STYLE CHOICE.
    `quality/calibration_rebuild.py` imports `song_profile_calibration`, which
    imports `quality/floor.py` -- this store's own attach site. Taken at module
    scope the cycle is unresolvable and `floor.py` stops importing at all,
    which is how this was FOUND rather than reasoned: the first attach site
    edit made every floor caller in the tree an ImportError. Only the BASE is
    deferred; the counting above stays at module scope where a reader looking
    for it will look. It also means a caller that never attaches -- a bypassed
    run, a refused identity -- never pays to import the calibration modules.
    """
    global _FIELDS_CLASS
    if _FIELDS_CLASS is None:
        # `SQLiteFields` brings `BoundedCache`, `decode_field` and
        # `PrimitiveUnpickler` with it; none of the four is rewritten here.
        from quality.calibration_rebuild import SQLiteFields
        _FIELDS_CLASS = type("TallyingFields", (_Tallying, SQLiteFields), {})
    return _FIELDS_CLASS


def _open(path):
    """-> an open connection with the table present, or raise.

    `CREATE TABLE IF NOT EXISTS` is also the WRITE PROBE: a path that is a
    directory, or under an unwritable parent, or on a read-only file system
    fails HERE, at attach, where the answer is still a status. Discovering it
    at the first `[] =` instead would raise out of `RhymeField.field` -- a
    memo turning a slow grade into a failed one.
    """
    parent = os.path.dirname(path)
    if parent:
        os.makedirs(parent, exist_ok=True)
    database = sqlite3.connect(path)
    database.execute("CREATE TABLE IF NOT EXISTS fields (fingerprint TEXT, "
                     "word TEXT, value BLOB, PRIMARY KEY(fingerprint,word))")
    database.commit()
    return database


def attach(rhyme_field, database=None, limit=DECODED_FIELDS):
    """Give one `RhymeField` a persistent cache. -> a status dict; never raises.

    `{"attached": bool, "reason": str, "fingerprint": str|None,
      "database": str|None, "rows": int}` -- `rows` being how many fields are
    already addressable under this fingerprint, which is what makes a cold run
    and a warm one distinguishable in a log rather than merely different in
    wall clock (doctrine 20).

    EVERY FAILURE PATH LEAVES THE PLAIN DICTS IN PLACE. The assignment to
    `_cache` is the LAST statement, after the identity is spelled, the
    database is open and writable, and anything the object had already cached
    has been carried across. A caller that ignores this status entirely still
    gets correct fields, slowly, which is the only acceptable failure mode for
    a cache.
    """
    if not enabled():
        return {"attached": False, "reason": "off (LYRIC_FIELD_STORE=0)",
                "fingerprint": None, "database": None, "rows": 0}
    path = default_database() if database is None else database
    try:
        if type(rhyme_field._cache) is not dict:
            raise Unspellable("the field cache is not a plain dictionary; it "
                              "is already attached or held by something else")
        mark = fingerprint(store_identity(rhyme_field))
    except Unspellable as error:
        return {"attached": False, "reason": f"unspellable: {error}",
                "fingerprint": None, "database": None, "rows": 0}
    except Exception as error:                      # never a raise, ever
        return {"attached": False,
                "reason": f"unspellable: {type(error).__name__}: {error}",
                "fingerprint": None, "database": None, "rows": 0}
    try:
        database_ = _open(path)
        store = _fields_class()(database_, mark, limit)
        inherited = len(store)
        # Carry across anything already computed, so attaching cannot LOSE a
        # field. If any of these is a shape the store refuses, we raise here
        # with `_cache` still the original dict and nothing assigned.
        for word, value in rhyme_field._cache.items():
            store[word] = value
    except Exception as error:
        return {"attached": False,
                "reason": f"unusable store at {path}: "
                          f"{type(error).__name__}: {error}",
                "fingerprint": mark, "database": path, "rows": 0}
    rhyme_field._cache = store
    _ATTACHED.append(weakref.ref(store))
    _INHERITED["rows"] += inherited
    return {"attached": True, "reason": "attached", "fingerprint": mark,
            "database": path, "rows": len(store)}


def tally():
    """-> the three counts, never summed (doctrine 79).

    `held` is read from the live stores rather than counted as they are
    written, so it is what is ADDRESSABLE under this fingerprint now --
    including rows a previous process wrote, which is the whole point.
    """
    held, live = 0, []
    for reference in _ATTACHED:
        store = reference()
        if store is not None:
            live.append(reference)
            held += len(store)
    _ATTACHED[:] = live
    return {"hit": _TALLY["hit"], "miss": _TALLY["miss"], "held": held}


def clear():
    """Zero the tally and forget every attached store.

    For tests, and for a caller that wants to be sure a count it is about to
    print belongs to the work it just did. It does NOT delete a row: there is
    no invalidation in this design, and a function named `clear` that silently
    dropped somebody's fields would be the worst possible place to hide one.
    """
    for key in _TALLY:
        _TALLY[key] = 0
    _INHERITED["rows"] = 0
    _ATTACHED.clear()


def disclosure():
    """-> the one line a caller prints about this store, in the shape of
    `revise.memo_disclosure`'s and `relations.pair_memo_disclosure`'s: served
    and scored apart, never summed, and OFF spelled as off rather than as a
    row of zeroes that reads exactly like a cold run (doctrine 20)."""
    if not enabled():
        return ("  FIELD STORE: off (LYRIC_FIELD_STORE=0) — every rhyme field "
                "this process asked for was scored in full")
    t = tally()
    state = "warm" if _INHERITED["rows"] else "cold"
    return (f"  FIELD STORE: {state} — {t['hit']} field(s) served from the "
            f"persistent store, {t['miss']} scored and recorded "
            f"({t['held']} row(s) held under this fingerprint, "
            f"{_INHERITED['rows']} inherited from an earlier process)")
