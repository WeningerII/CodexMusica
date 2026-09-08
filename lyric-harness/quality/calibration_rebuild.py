#!/usr/bin/env python3
"""Rebuild every current calibration row using the existing scoring functions.

Example: python3 quality/calibration_rebuild.py --output-dir /tmp/adoption --workers 6

No sampling and no alternate scorer. Fork workers prewarm each exact RhymeField
once. The parent then runs unmodified song_profile_calibration.population().
SQLite checkpoints use format1: (comparator fingerprint, call word, primitive
pickle of field tuples). A changed comparator never reuses the old namespace.
Saved rows carry their own exact input provenance and cannot pass the current
length-curve check after any consumed input changes.
"""
import argparse
from collections import OrderedDict
from collections.abc import MutableMapping
import ast
import hashlib
import io
import inspect
import json
import multiprocessing as mp
import os
from pathlib import Path
import pickle
import resource
import sqlite3
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from quality import song_profile_calibration as C
from quality import length_curve_calibration as LC
from quality.features import QualityFeatures, RhymeField

CHECKPOINT_VERSION = 1
_QF = None


def harness_field_source(source):
    """Conservative imported-module dependency closure of the field's roots.

    Include every top-level executable declaration (including mutating loops),
    then every function/class reachable by a name load. The script-only main
    guard is false in this imported module. CLI helper bodies are omitted only
    when none of the scoring roots or imported-module declarations reach them.
    Dynamic methods are covered by retaining each reached class in full.
    """
    tree = ast.parse(source)
    definitions = {node.name: node for node in tree.body
                   if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef))}
    selected = []
    pending = {"Lexicon", "Declaration", "anchor", "line_anchors", "score", "syllabify", "vowel_sim"}
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            continue
        if isinstance(node, ast.Expr) and isinstance(node.value, ast.Constant) and isinstance(node.value.value, str):
            continue
        if (isinstance(node, ast.If) and isinstance(node.test, ast.Compare)
                and isinstance(node.test.left, ast.Name) and node.test.left.id == "__name__"
                and len(node.test.comparators) == 1
                and isinstance(node.test.comparators[0], ast.Constant)
                and node.test.comparators[0].value == "__main__"
                and isinstance(node.test.ops[0], ast.Eq) and not node.orelse):
            continue
        selected.append(node)
        pending.update(n.id for n in ast.walk(node) if isinstance(n, ast.Name) and isinstance(n.ctx, ast.Load))
    seen = set()
    while pending:
        name = pending.pop()
        if name in seen or name not in definitions:
            continue
        seen.add(name)
        node = definitions[name]
        selected.append(node)
        pending.update(n.id for n in ast.walk(node) if isinstance(n, ast.Name) and isinstance(n.ctx, ast.Load))
    return "\n".join(ast.dump(node, include_attributes=False) for node in sorted(selected, key=lambda node: node.lineno))


def field_input_record():
    """All inputs to RhymeField.field; extractor/reporting branches are unrelated."""
    import lyric_harness as harness
    from quality.source_identity import definition_source
    return {"version": CHECKPOINT_VERSION, "python": sys.version.split()[0],
            "rhyme_field_source": hashlib.sha256(definition_source(RhymeField).encode()).hexdigest(),
            "harness_field_source": hashlib.sha256(harness_field_source(Path(harness.__file__).read_text()).encode()).hexdigest(),
            "files": {Path(path).name: hashlib.sha256(Path(path).read_bytes()).hexdigest()
                      for path in (harness.CMUDICT_PATH, harness.FREQ_PATH)},
            "declaration": repr(harness.Declaration())}


def field_fingerprint():
    return hashlib.sha256(json.dumps(field_input_record(), sort_keys=True).encode()).hexdigest()


class PrimitiveUnpickler(pickle.Unpickler):
    def find_class(self, module, name):
        raise ValueError("field checkpoint may contain primitive values only")


def decode_field(raw):
    value = PrimitiveUnpickler(io.BytesIO(raw)).load()
    if not isinstance(value, list) or any(
        not isinstance(row, (list, tuple)) or len(row) != 3
        or not isinstance(row[0], str) or type(row[1]) is not int
        or type(row[2]) not in (int, float) for row in value
    ):
        raise ValueError("invalid field checkpoint shape")
    return value


class BoundedCache(OrderedDict):
    """Operational memory bound; eviction changes only repeated lookup cost."""

    def __init__(self, limit):
        super().__init__()
        self.limit = limit

    def __getitem__(self, key):
        value = super().__getitem__(key)
        self.move_to_end(key)
        return value

    def __setitem__(self, key, value):
        super().__setitem__(key, value)
        self.move_to_end(key)
        if len(self) > self.limit:
            self.popitem(last=False)


class SQLiteFields(MutableMapping):
    """Exact prewarmed fields, decoded on demand rather than all into RAM."""

    def __init__(self, database, fingerprint, limit):
        self.database, self.fingerprint = database, fingerprint
        self.keys_available = {word for (word,) in database.execute(
            "SELECT word FROM fields WHERE fingerprint=?", (fingerprint,))}
        self.decoded = BoundedCache(limit)

    def __contains__(self, key):
        return key in self.keys_available

    def __len__(self):
        return len(self.keys_available)

    def __iter__(self):
        return iter(self.keys_available)

    def __getitem__(self, key):
        if key not in self.decoded:
            row = self.database.execute("SELECT value FROM fields WHERE fingerprint=? AND word=?",
                                        (self.fingerprint, key)).fetchone()
            if row is None:
                raise KeyError(key)
            self.decoded[key] = decode_field(row[0])
        return self.decoded[key]

    def __setitem__(self, key, value):
        raw = pickle.dumps(value, protocol=5)
        decode_field(raw)
        self.database.execute("INSERT OR REPLACE INTO fields VALUES (?,?,?)",
                              (self.fingerprint, key, raw))
        self.database.commit()
        self.keys_available.add(key)
        self.decoded[key] = value

    def __delitem__(self, key):
        raise TypeError("persistent exact fields are not deleted by an in-memory cache eviction")


def _field(word):
    try:
        return word, _QF.field.field(word)
    finally:
        # SQLite retains all fields; a worker retains at most one at a time.
        _QF.field._cache.clear()


def main(argv=None):
    global _QF
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--workers", type=int, default=1)
    parser.add_argument("--max-cached-fields", type=int, default=512,
                        help="maximum decoded fields and projections retained in parent memory")
    parser.add_argument("--field-cache", default=None,
                        help="mutable SQLite checkpoint path; keep outside synchronised folders during a live rebuild")
    args = parser.parse_args(argv)
    if not 1 <= args.workers <= 16:
        parser.error("--workers must be between1 and16; each worker needs a lexicon copy")
    if args.max_cached_fields < 1:
        parser.error("--max-cached-fields must be positive")
    if "fork" not in mp.get_all_start_methods():
        parser.error("parallel prewarming requires a platform supporting fork")
    output = Path(args.output_dir).resolve()
    output.mkdir(parents=True, exist_ok=True)
    provenance = LC.row_provenance()
    fingerprint = field_fingerprint()
    _QF = QualityFeatures(features=("rhyme_predictability_mean",))
    started = time.monotonic()
    bodies = [body for path in C.corpus_files() for _, body in C.items_in(path) if body]
    calls = set()
    for body in bodies:
        for i, j in C._couplet_pairs(body):
            call, answer, _ = _QF._strip_radif(body[i], body[j])
            if call and answer and _QF._pronounceable(call) and _QF._pronounceable(answer):
                calls.add(call.lower())
    checkpoint = Path(args.field_cache).resolve() if args.field_cache else output / "current-field-cache.sqlite"
    checkpoint.parent.mkdir(parents=True, exist_ok=True)
    database = sqlite3.connect(checkpoint)
    database.execute("CREATE TABLE IF NOT EXISTS fields (fingerprint TEXT, word TEXT, "
                     "value BLOB, PRIMARY KEY(fingerprint,word))")
    done = {word for (word,) in database.execute(
        "SELECT word FROM fields WHERE fingerprint=?", (fingerprint,))}
    pending = sorted(calls - done)
    print("FULL REBUILD", len(bodies), "items", len(calls), "exact call fields",
          len(pending), "cold", fingerprint, flush=True)
    # Fork before loading the parent cache, so each child stays bounded.
    with mp.get_context("fork").Pool(args.workers) as pool:
        for number, (word, value) in enumerate(pool.imap_unordered(_field, pending, chunksize=1), 1):
            database.execute("INSERT OR REPLACE INTO fields VALUES (?,?,?)",
                             (fingerprint, word, pickle.dumps(value, protocol=5)))
            if number % 100 == 0:
                database.commit()
                print("fields", number, "/", len(pending), "wall_s",
                      int(time.monotonic() - started), flush=True)
    database.commit()
    _QF.field._cache = SQLiteFields(database, fingerprint, args.max_cached_fields)
    _QF.field._words = BoundedCache(args.max_cached_fields)
    _QF.field._ranks = BoundedCache(args.max_cached_fields)
    print("ALL exact fields ready", len(calls), "decoded-cache bound", args.max_cached_fields, "wall_s",
          int(time.monotonic() - started), flush=True)
    cache = C.PredictabilityCache(path=str(output / "current-predictability.tsv")).open()
    rows, _ = C.population(scorer=C.Scorer(cache, _QF), with_predictability=True, pred_max_tokens=None)
    cache.flush()
    database.close()
    if LC.row_provenance() != provenance or field_fingerprint() != fingerprint:
        raise ValueError("inputs changed during measurement; re-run before adoption")
    peak_rss = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    peak_rss_bytes = peak_rss if sys.platform == "darwin" else peak_rss * 1024
    LC.write_rows(rows, output / "current-calibration-rows.tsv", provenance,
                  fields=len(calls), checkpoint_version=CHECKPOINT_VERSION,
                  workers=args.workers, max_cached_fields=args.max_cached_fields,
                  peak_rss_bytes=peak_rss_bytes,
                  wall_s=time.monotonic() - started)
    print("COMPLETE", len(rows), "rows", int(time.monotonic() - started), "seconds",
          "peak_rss_bytes", peak_rss_bytes, flush=True)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ValueError, OSError) as error:
        print(f"REFUSED — {error}", file=sys.stderr)
        raise SystemExit(2)
