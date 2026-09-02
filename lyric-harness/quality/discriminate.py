#!/usr/bin/env python3
"""Discrimination test for the pre-registered quality features.

Reports, per feature: AUC, whether the observed direction matches the direction
committed in PREREGISTRATION.md, a permutation p-value, and a Benjamini-Hochberg
FDR verdict across the whole pre-registered set.

Two rules this module enforces rather than merely documents:

1. Only features named in PREREGISTRATION.md are reported as findings. Anything
   else is exploratory and is printed under a separate heading.
2. A feature that separates with the *wrong* sign is a failed prediction, not a
   success. It is never counted as a hit no matter how small its p-value.

A third rule joined them 2026-08-13, and it is about the CACHE rather than the
statistics -- see the "Cache identity" section below. Until that date the
on-disk feature cache was keyed on `tag:ident` alone, so it named WHICH POEM a
vector belonged to and never WHICH CODE COMPUTED IT. Every number this module
has ever printed from a warm cache was therefore a number about whatever
`features.py` and `lyric_harness.py` looked like when that entry was first
written, silently. Doctrine 1: the declaration is part of the identity of any
measurement, and a cache key that omits the declaration is not a cache key.
"""

import ast
import hashlib
import json
import math
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

from lyric_harness import Declaration  # noqa: E402
from quality.corpus import (SONNET_SCHEME, labelled_sonnets,  # noqa: E402
                            load_generated, load_sonnets)
from quality.features import DATA as STAGED_DATA, QualityFeatures  # noqa: E402
from quality.within_item import WithinItemFeatures  # noqa: E402

CACHE = os.path.join(HERE, "..", "data", "feature_cache.json")
N_PERM = 20000
FDR_Q = 0.10
SEED = 20260809          # fixed so the permutation test is reproducible


# ---------------------------------------------------------------------------
# Statistics -- no scipy; rank-based so permutation is O(n) per shuffle
# ---------------------------------------------------------------------------

def _ranks(values):
    """Average ranks, ties shared."""
    order = sorted(range(len(values)), key=lambda i: values[i])
    out = [0.0] * len(values)
    i = 0
    while i < len(order):
        j = i
        while j + 1 < len(order) and values[order[j + 1]] == values[order[i]]:
            j += 1
        avg = (i + j) / 2.0 + 1.0
        for k in range(i, j + 1):
            out[order[k]] = avg
        i = j + 1
    return out


def auc_from_ranks(ranks, idx_a, n_a, n_b):
    """AUC that a member of group A outranks a member of group B."""
    r_a = sum(ranks[i] for i in idx_a)
    u_a = r_a - n_a * (n_a + 1) / 2.0
    return u_a / (n_a * n_b)


def permutation_test(vals_a, vals_b, n_perm=N_PERM, seed=SEED):
    """Two-sided permutation test on AUC. Returns (auc, p)."""
    values = list(vals_a) + list(vals_b)
    n_a, n_b = len(vals_a), len(vals_b)
    ranks = _ranks(values)
    observed = auc_from_ranks(ranks, range(n_a), n_a, n_b)
    obs_dev = abs(observed - 0.5)
    rng = random.Random(seed)
    idx = list(range(n_a + n_b))
    hits = 0
    for _ in range(n_perm):
        rng.shuffle(idx)
        a = auc_from_ranks(ranks, idx[:n_a], n_a, n_b)
        if abs(a - 0.5) >= obs_dev - 1e-12:
            hits += 1
    return observed, (hits + 1) / (n_perm + 1)


def benjamini_hochberg(pvals, q=FDR_Q):
    """-> list of bools, True where the hypothesis is rejected at FDR q."""
    m = len(pvals)
    order = sorted(range(m), key=lambda i: pvals[i])
    keep = [False] * m
    kmax = -1
    for rank, i in enumerate(order, start=1):
        if pvals[i] <= q * rank / m:
            kmax = rank
    for rank, i in enumerate(order, start=1):
        if rank <= kmax:
            keep[i] = True
    return keep


# ---------------------------------------------------------------------------
# Cache identity  (doctrine 1; the defect this section exists to close is
# recorded in quality/NULL_AUDIT.md §2.5)
# ---------------------------------------------------------------------------
#
# A cached feature vector is a MEASUREMENT, and a measurement is identified by
# its declaration, not by the thing measured. The old key named only the poem.
# Two axes had to be covered, and they fail differently, so they are keyed
# differently:
#
#   DEFINITIONS -- the formulas, the declared thresholds, the resource files.
#     A change here moves EVERY vector at once, so it is handled by a
#     file-level fingerprint that discards the whole cache and says why.
#     Trying to key around a changed formula per-entry would be pretending we
#     know which features a diff touched; we do not, so we throw it all away.
#
#   ITEMS -- the actual text of one poem, and the scheme that says which line
#     pairs are mandated. A change here moves ONE vector, so the per-entry key
#     is content-addressed on the lines themselves and carries the scheme.
#     A corrected corpus line cannot reuse the vector computed before the fix.
#
# `lyric_harness.py` is in the fingerprint on purpose and it is the expensive
# one: `rhyme_predictability_*` runs through `Declaration`, `score`, `anchor`,
# `syllabify` and `vowel_sim`, so an edit to the comparator changes these
# numbers without touching quality/ at all. That is precisely the path by which
# the cache went stale, and a fingerprint that skipped it would leave the
# original defect open while looking fixed.
#
# THE DEFINITIONS AXIS IS DIGESTED AT TWO GRANULARITIES SINCE 2026-08-13, and
# which file gets which is decided by what the file IS. `SOURCE_FILES` are code
# and go through `_digest_source`, whose digest is of the AST with docstrings
# stripped; `RESOURCE_FILES` are data and stay on `_digest_file`, byte for
# byte. Before that date both were byte-granular, which never wrongly reused
# and cost 2.3 CPU-hours to fix a comment -- measured, three times in one
# session, in quality/RESULTS_CACHE_IDENTITY.md. The argument for the split,
# what it still over-approximates, and what happens to a file that does not
# parse are all in `_digest_source`'s own docstring.

CACHE_FORMAT = 2

#: Files whose contents define what a feature VALUE means.
#:
#: `corpus.py` is deliberately NOT here. Everything it produces that can move a
#: vector -- the parsed lines and the item id -- is already in the per-entry
#: key by content, so a reparse that changes a poem expires exactly that poem.
#: Its other job is the survival LABELS, which choose who is compared with whom
#: and change no vector at all. Listing it would expire all 384 entries every
#: time a label moved: safe, and wrong, because over-invalidation teaches the
#: next reader that the fingerprint is noise to be worked around.
SOURCE_FILES = (
    os.path.join(HERE, "features.py"),
    os.path.join(HERE, "within_item.py"),
    os.path.join(HERE, "..", "lyric_harness.py"),
)

#: Files a feature READS at extract time. Re-fetching a norm set silently
#: re-scales concreteness and frequency; doctrine 58 -- the resource is a
#: coordinate of the number just as much as a threshold is.
RESOURCE_FILES = (
    # READ OFF `features.DATA` SINCE 2026-09-01 (M-188), because that is the
    # directory `load_concreteness` actually opens: with `LYRIC_STAGED_DATA`
    # set, a literal `data/` here would digest a file no feature read --
    # the exact drift the comment above this tuple warns about.
    os.path.join(STAGED_DATA, "concreteness.txt"),
    # REPOINTED 2026-08-22. This named `wordfreq20k.txt` -- the list
    # `Lexicon.freq_rank` STOPPED reading when the frequency source was
    # swapped -- so the cache key digested a file no feature reads and did
    # NOT digest the one they do. Re-fetching `opensubtitles_en_50k.tsv`
    # would have silently reused features scaled to the old list, which is
    # verbatim what this tuple's own comment three lines up warns about.
    # The refused file is gone from the tree; naming it here would digest
    # ABSENT forever and freeze the key.
    os.path.join(HERE, "..", "data", "opensubtitles_en_50k.tsv"),
    os.path.join(HERE, "..", "cmudict.dict"),
)


def _digest_file(path, n=16):
    """sha256 prefix of a file, or a marker naming its absence.

    ABSENT is a real state, not an error: `load_concreteness` raises without
    the norms, but `freq_rank` degrades quietly, and a cache written with a
    resource missing must not be reused once it is present.
    """
    if not os.path.exists(path):
        return "ABSENT"
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()[:n]


#: Node types Python attaches a docstring to. A docstring is the FIRST
#: statement and only the first; a string expression anywhere else is left
#: standing, because there it is a statement like any other.
_DOCSTRING_HOLDERS = (ast.Module, ast.ClassDef, ast.FunctionDef,
                      ast.AsyncFunctionDef)


def _strip_docstrings(tree):
    """Remove every module/class/function docstring from `tree`, in place.

    An emptied body becomes `pass` rather than `[]`, so the stripped tree is
    still a WELL-FORMED AST -- `ast.Module.body` and friends are non-empty in
    the grammar, and a tree that cannot be compiled or unparsed is a trap for
    the next reader who tries. It also makes `def f(): "doc"` digest as
    `def f(): pass`, which is what those two functions actually are.

    The substituted `pass` INHERITS THE DOCSTRING'S LOCATION, which costs the
    digest nothing -- `_digest_source` dumps without attributes, so no
    `lineno` reaches it either way -- and buys the sentence above being true.
    A bare `ast.Pass()` carries no `lineno`, and `compile()` on a tree
    containing one raises `TypeError: required field "lineno" missing from
    stmt` unless the caller knows to run `ast.fix_missing_locations` first.
    MEASURED, not assumed: that TypeError is what a bare `ast.Pass()` gave
    here, on a module whose only function body was a docstring.
    """
    for node in ast.walk(tree):
        if not isinstance(node, _DOCSTRING_HOLDERS):
            continue
        body = node.body
        if (body and isinstance(body[0], ast.Expr)
                and isinstance(body[0].value, ast.Constant)
                and isinstance(body[0].value.value, str)):
            node.body = (body[1:]
                         or [ast.copy_location(ast.Pass(), body[0])])
    return tree


def _digest_source(path, n=16):
    """Digest of a SOURCE file's CODE -- docstrings and comments excluded.

    Returns `ast:<sha>`, or `raw:<sha>` when the file could not be parsed, or
    `ABSENT`. The prefix is part of the value on purpose; see below.

    WHY THIS IS NOT `_digest_file` (CHANGED 2026-08-13; doctrine 17, the
    superseded behaviour is stated rather than removed). Until this date every
    entry of `SOURCE_FILES` was keyed on `_digest_file`, a sha256 of the file's
    BYTES. That is a conservative over-approximation of "everything that, if
    changed, makes a stored vector a different number", and it was correct in
    the direction that matters -- it never wrongly REUSES. It was also
    expensive in the other direction, and the price was measured rather than
    argued: a discard rebuilds this module's 384 vectors at **1,050 CPU-s,
    MEASURED 2026-08-13 twice (1049.5 s and 1067.8 s)** plus
    `song_profile_calibration`'s predictability cache at ~7,400 CPU-s, so
    ~8,450 CPU-s / ~2.3 CPU-hours per discard. `quality/features.py` paid it
    THREE times in one session and the third payment was 94 bytes of
    docstring (`b8047e8 -> ef21639`) with not one executable byte moved.
    The consequence is a perverse incentive rather than merely a slow run: the
    cheapest way to preserve a 2.3-CPU-hour cache becomes leaving a wrong
    comment in place, in a repo whose own record-adversary has found four
    stale records in a week. `quality/RESULTS_CACHE_IDENTITY.md` is the
    measurement and the argument.

    `ast.dump` is taken WITHOUT attributes (the default, spelled out below
    because it is the whole mechanism): `lineno`/`col_offset` are excluded, so
    adding a line to a docstring does not shift the digest of every function
    beneath it. Comments never reach `ast.parse` at all, so they come free.

    STILL AN OVER-APPROXIMATION, NARROWED AND NOT ELIMINATED. `ast.dump`
    carries identifiers, so a pure variable rename registers as a change;
    reordering two independent function definitions registers; and the dump
    format is a coordinate of the PYTHON VERSION, so the same file can digest
    differently under a different interpreter. All three discard when they did
    not have to. None of them reuses when it should not, which is the
    direction this key exists to protect.

    ON A FILE THAT DOES NOT PARSE, the byte digest is used and the value says
    so. Raising here would turn a broken edit into a `SyntaxError` three
    frames down inside a cache-key builder, naming this module rather than the
    file the writer just broke. Falling back is also the CONSERVATIVE answer
    on its own terms: a file we cannot read the structure of is the case where
    we know least, and the byte digest is the strictest key available. Through
    this module's own path the fallback is nearly unreachable -- all three
    `SOURCE_FILES` are imported at the top of this file, so a file that does
    not parse has already killed the import. The case it is really for is the
    one `audit_joint_auc_null.py` recorded: a concurrent cell editing
    `features.py` under a running rebuild, where a half-written working-tree
    state gets read (digest `2efbffbe`, a state that is in no commit). The
    mode rides IN the digest so the degradation cannot be silent -- `main`
    prints these values on every run, and `raw:` on a source line is a
    reader's notice that the structure was never consulted. It also means a
    cache written while the file was broken can never be served to a run in
    which it parses, since `ast:` and `raw:` are different strings.

    Read whole rather than chunked: `_digest_file`'s 1 MiB loop is there for
    `cmudict.dict` at 3.6 MB, and the largest file on THIS path is
    `lyric_harness.py` at 236 KB. `ast.parse` wants the whole buffer anyway.
    """
    if not os.path.exists(path):
        return "ABSENT"
    with open(path, "rb") as f:
        raw = f.read()
    try:
        # include_attributes=False is the DEFAULT and is spelled out because
        # it is the thing being relied on: with attributes the digest would
        # move whenever a docstring changed line count, which is the defect.
        blob = ast.dump(_strip_docstrings(ast.parse(raw)),
                        include_attributes=False).encode("utf-8")
        tag = "ast"
    except (SyntaxError, ValueError, RecursionError):
        # SyntaxError: a broken edit. ValueError: a NUL byte, which is what a
        # partially-flushed write looks like. RecursionError: `ast.dump` on a
        # pathologically nested expression -- it recurses, and a cache key is
        # not the place to discover that.
        blob, tag = raw, "raw"
    return f"{tag}:{hashlib.sha256(blob).hexdigest()[:n]}"


def declaration_tuple(decl):
    """The declared coordinates of the rhyme comparator, as a stable mapping.

    Doctrine 1. `theta_rhyme` moving by a hundredth changes every rhyme field
    and therefore every predictability value; if the cache cannot see that, the
    band is a setting nobody wrote down (doctrine 58).
    """
    import dataclasses
    if dataclasses.is_dataclass(decl):
        return {f.name: repr(getattr(decl, f.name))
                for f in dataclasses.fields(decl)}
    return {k: repr(v) for k, v in sorted(vars(decl).items())
            if not k.startswith("_")}


def cache_identity(feature_classes=(QualityFeatures, WithinItemFeatures),
                   decl=None):
    """Everything that, if changed, makes a stored vector a different number.

    NAMES and DIRECTION are included as well as the file digest, because those
    two are the pre-registration itself: a feature quietly renamed or a
    committed direction quietly flipped is the failure this module exists to
    make impossible, and it must not survive in a cache either.

    THE TWO FILE GROUPS ARE DIGESTED AT DIFFERENT GRANULARITIES, and the split
    is the point rather than an inconsistency. `SOURCE_FILES` are CODE, so
    they go through `_digest_source` and their docstrings are stripped: a
    docstring cannot move a number, and keying on it made fixing a wrong
    comment cost 2.3 CPU-hours. `RESOURCE_FILES` are DATA and stay on
    `_digest_file`, byte for byte, doctrine 58.

    NOT because they have no comment layer -- `cmudict.dict` HAS one, 22 lines
    carry a trailing `# place, danish` and `Lexicon.__init__` strips it with
    `line.split("#")[0]`, so those bytes provably cannot move a number either.
    The reason is that stripping them would need a SECOND reader of that
    format. `ast.parse` is CPython's own parser, the same one that executes
    the source file, so the source stripper cannot drift from the truth; the
    only statement of `cmudict.dict`'s comment rule is one bespoke line in
    `Lexicon.__init__`, and a digest that re-implemented it would be free to
    disagree with it. A digest that strips more than the loader does discards
    bytes the loader reads -- which wrongly REUSES, the one direction this key
    exists to prevent. The tax that justified taking that risk on source files
    does not exist here anyway: nobody hand-edits a comment in a downloaded
    pronunciation dictionary.
    """
    decl = Declaration() if decl is None else decl
    return {
        "format": CACHE_FORMAT,
        "sources": {os.path.basename(p): _digest_source(p)
                    for p in SOURCE_FILES},
        "resources": {os.path.basename(p): _digest_file(p)
                      for p in RESOURCE_FILES},
        "features": {f.__name__: {"names": list(f.NAMES),
                                  "direction": dict(f.DIRECTION)}
                     for f in feature_classes},
        "declaration": declaration_tuple(decl),
    }


def fingerprint(identity):
    blob = json.dumps(identity, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()[:16]


def _drift(old, new):
    """Name what moved between two identities, so a discard is auditable.

    A cache that silently empties itself is only marginally better than one
    that silently reuses: the run gets slower and nobody learns why. Doctrine
    79 -- report the count AND what it is a count of.
    """
    changed = []
    if old.get("format") != new.get("format"):
        changed.append(f"format {old.get('format')}->{new.get('format')}")
    for section in ("sources", "resources", "features", "declaration"):
        o, n = old.get(section) or {}, new.get(section) or {}
        for k in sorted(set(o) | set(n)):
            if o.get(k) != n.get(k):
                changed.append(f"{section}.{k}")
    return changed


def item_key(tag, scheme, ident, lines):
    """Cache key for ONE item, content-addressed on that item's own text.

    The scheme rides in the key because it selects the mandated pairs, which
    is the whole input to `_predictability`; the same fourteen lines read as
    ABABCDCDEFEFGG and as couplets are two different measurements.
    """
    dig = hashlib.sha256("\n".join(lines).encode("utf-8")).hexdigest()[:12]
    return f"{tag}|{scheme or '-'}|{ident}|{dig}"


def load_cache(identity, path=CACHE):
    """-> (entries, fingerprint, status). Never returns entries it cannot
    prove were written by the code running now."""
    fp = fingerprint(identity)
    if not os.path.exists(path):
        return {}, fp, "no cache on disk; computing cold"
    try:
        with open(path, encoding="utf-8") as f:
            blob = json.load(f)
    except (ValueError, OSError) as exc:
        return {}, fp, f"unreadable ({type(exc).__name__}); DISCARDED"
    if not isinstance(blob, dict) or "fingerprint" not in blob:
        # The format-1 cache. Its keys were `tag:ident` with no statement of
        # which feature code wrote them, so there is no evidence that would
        # let us keep any of it. Discarding is the fix, not a side effect.
        n = len(blob) if isinstance(blob, dict) else 0
        return {}, fp, (f"format-1 cache ({n} entries, keyed tag:ident with "
                        f"no fingerprint of the feature code); DISCARDED")
    if blob.get("fingerprint") != fp:
        drift = _drift(blob.get("identity") or {}, identity)
        return {}, fp, ("fingerprint MISMATCH; DISCARDED -- changed: "
                        + (", ".join(drift) if drift else "unknown"))
    return dict(blob.get("entries") or {}), fp, "fingerprint match"


def save_cache(entries, identity, path=CACHE):
    """Write via a temp file and rename, so an interrupted run leaves the
    previous cache intact rather than a truncated JSON that the next run has
    to discard."""
    parent = os.path.dirname(path)
    if parent:
        os.makedirs(parent, exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump({"format": CACHE_FORMAT,
                   "fingerprint": fingerprint(identity),
                   "identity": identity,
                   "entries": entries}, f, sort_keys=True)
    os.replace(tmp, path)


# ---------------------------------------------------------------------------
# Feature computation with an on-disk cache
# ---------------------------------------------------------------------------

def compute(qf, items, scheme, cache, tag, stats=None):
    rows = []
    for ident, lines in items:
        key = item_key(tag, scheme, ident, lines)
        if key in cache:
            if stats is not None:
                stats["reused"] += 1
        else:
            cache[key] = qf.extract(lines, scheme)
            if stats is not None:
                stats["computed"] += 1
        rows.append((ident, cache[key]))
    return rows


def _clean(rows_a, rows_b, name):
    """Paired extraction of one feature, dropping non-finite values."""
    a = [r[name] for _, r in rows_a if math.isfinite(r.get(name, float('nan')))]
    b = [r[name] for _, r in rows_b if math.isfinite(r.get(name, float('nan')))]
    return a, b


def run_experiment(title, rows_a, rows_b, label_a, label_b, note="",
                   feats=QualityFeatures):
    print(f"\n{'=' * 78}\n{title}\n{'=' * 78}")
    print(f"  {label_a}: n={len(rows_a)}    {label_b}: n={len(rows_b)}")
    if note:
        print(f"  {note}")

    results = []
    for name in feats.NAMES:
        a, b = _clean(rows_a, rows_b, name)
        if len(a) < 3 or len(b) < 3:
            results.append((name, float("nan"), 1.0, False, 0, 0))
            continue
        auc, p = permutation_test(a, b)
        predicted = feats.DIRECTION[name]
        # AUC > 0.5 means class A scores higher on this feature
        observed = "higher" if auc > 0.5 else "lower"
        results.append((name, auc, p, observed == predicted, len(a), len(b)))

    pvals = [r[2] for r in results]
    keep = benjamini_hochberg(pvals)

    print(f"\n  {'feature':32s} {'AUC':>6s} {'p':>8s}  {'dir':>9s}  verdict")
    print(f"  {'-' * 72}")
    hits = 0
    for (name, auc, p, dir_ok, na, nb), sig in zip(results, keep):
        if not math.isfinite(auc):
            print(f"  {name:32s} {'--':>6s} {'--':>8s}  {'--':>9s}  "
                  f"insufficient data")
            continue
        if sig and dir_ok:
            verdict, mark = "HIT (FDR)", "*"
            hits += 1
        elif sig and not dir_ok:
            verdict, mark = "WRONG SIGN", "x"
        elif p < 0.05:
            verdict, mark = "uncorrected only", " "
        else:
            verdict, mark = "null", " "
        pred = feats.DIRECTION[name]
        print(f" {mark}{name:32s} {auc:6.3f} {p:8.4f}  {pred:>9s}  {verdict}")

    print(f"\n  pre-registered hits surviving BH-FDR at q={FDR_Q}: "
          f"{hits}/{len(feats.NAMES)}")
    return results, keep, hits


def joint_classifier(rows_a, rows_b, names=None, folds=5, seed=SEED,
                     feats=QualityFeatures):
    """Held-out AUC for all features used jointly.

    The per-feature table answers 'does this feature track the label'. This
    answers the product question instead: could the feature set actually gate
    text it has never seen. Cross-validated, because a fit reported on its own
    training data is not evidence of anything.
    """
    try:
        import numpy as np
        from sklearn.linear_model import LogisticRegression
        from sklearn.model_selection import StratifiedKFold
        from sklearn.metrics import roc_auc_score
        from sklearn.pipeline import make_pipeline
        from sklearn.preprocessing import StandardScaler
        from sklearn.impute import SimpleImputer
    except ImportError:
        print("\n  (joint classifier skipped: scikit-learn not installed)")
        return None

    names = names or feats.NAMES
    X = np.array([[r.get(n, np.nan) for n in names] for _, r in rows_a]
                 + [[r.get(n, np.nan) for n in names] for _, r in rows_b],
                 dtype=float)
    y = np.array([1] * len(rows_a) + [0] * len(rows_b))
    n_min = min(int((y == 1).sum()), int((y == 0).sum()))
    if n_min < folds:
        folds = max(2, n_min)
    pipe = make_pipeline(SimpleImputer(strategy="median"), StandardScaler(),
                         LogisticRegression(max_iter=2000, C=1.0))
    skf = StratifiedKFold(n_splits=folds, shuffle=True, random_state=seed)
    oof = np.zeros(len(y), dtype=float)
    for tr, te in skf.split(X, y):
        pipe.fit(X[tr], y[tr])
        oof[te] = pipe.predict_proba(X[te])[:, 1]
    return float(roc_auc_score(y, oof))


def report_joint(rows_a, rows_b, label_a, label_b, feats=QualityFeatures,
                 solo_names=None):
    full = joint_classifier(rows_a, rows_b, feats=feats)
    if full is None:
        return None
    n = len(feats.NAMES)
    print(f"\n  joint held-out AUC, all {n} features ({label_a} vs {label_b})"
          f": {full:.3f}")
    solo_names = solo_names or ["rhyme_predictability_mean",
                               "rhyme_predictability_min"]
    solo_names = [x for x in solo_names if x in feats.NAMES]
    if solo_names:
        solo = joint_classifier(rows_a, rows_b, names=solo_names, feats=feats)
        print(f"  joint held-out AUC, predictability only"
              f"{'':<24}: {solo:.3f}")
    return full


def main(argv=None):
    argv = list(sys.argv[1:] if argv is None else argv)
    cold = "--cold" in argv
    if cold:
        argv.remove("--cold")
    path = CACHE
    for a in list(argv):
        if a.startswith("--cache="):
            path = a.split("=", 1)[1]
            argv.remove(a)
    if argv:
        raise SystemExit(f"unknown arguments: {argv}\n"
                         f"usage: discriminate.py [--cold] [--cache=PATH]")

    # Doctrine 1: state the identity of the measurement before making it.
    # This block is printed on every run, warm or cold, because "which code
    # produced this number" is not something a reader should have to infer
    # from a file mtime.
    identity = cache_identity()
    if cold:
        cache, fp, status = {}, fingerprint(identity), "--cold: cache ignored"
    else:
        cache, fp, status = load_cache(identity, path)
    stats = {"reused": 0, "computed": 0}
    loaded = len(cache)
    print(f"{'=' * 78}\nFEATURE CACHE\n{'=' * 78}")
    print(f"  file         {os.path.relpath(path, os.path.join(HERE, '..'))}")
    print(f"  fingerprint  {fp}")
    for k, v in sorted(identity["sources"].items()):
        print(f"    src  {k:24s} {v}")
    for k, v in sorted(identity["resources"].items()):
        print(f"    res  {k:24s} {v}")
    print(f"  status       {status}")
    print(f"  loaded       {loaded} entries")

    survived, forgotten = labelled_sonnets()
    generated = load_generated()
    allsn = load_sonnets()
    human = [(n, l) for n, l in sorted(allsn.items())]
    summary = {}

    for tag, feats, solo in (
            ("ABSOLUTE (original ten)", QualityFeatures, None),
            ("WITHIN-ITEM (respecified eight)", WithinItemFeatures,
             ["wi_predictability_advantage"])):
        print(f"\n\n{'#' * 78}\n# {tag}\n{'#' * 78}")
        qf = feats()
        pfx = "abs" if feats is QualityFeatures else "wi"

        rows_s = compute(qf, survived, SONNET_SCHEME, cache, f"{pfx}son",
                         stats)
        rows_f = compute(qf, forgotten, SONNET_SCHEME, cache, f"{pfx}son",
                         stats)
        _, _, h1 = run_experiment(
            "EXPERIMENT 1 — within-Shakespeare: anthologized vs not",
            rows_s, rows_f, "survived", "forgotten",
            note=("one author, one form, one era, one register — confounds "
                  "eliminated by construction; power is the cost"),
            feats=feats)
        a1 = report_joint(rows_s, rows_f, "survived", "forgotten", feats, solo)

        a2 = h2 = w2 = None
        if generated:
            rows_h = compute(qf, human, SONNET_SCHEME, cache, f"{pfx}son",
                             stats)
            rows_g = compute(qf, generated, SONNET_SCHEME, cache, f"{pfx}gen",
                             stats)
            res2, keep2, h2 = run_experiment(
                "EXPERIMENT 2 — Shakespeare vs model-generated sonnets",
                rows_h, rows_g, "human", "generated",
                note=("CONFOUNDED: generation-in-imitation leaves pastiche "
                      "artifacts; a hit here may detect imitation, not slop"),
                feats=feats)
            a2 = report_joint(rows_h, rows_g, "human", "generated", feats,
                              solo)
            w2 = sum(1 for (n, auc, p, ok, _, _), sig in zip(res2, keep2)
                     if sig and not ok)
        summary[tag] = (h1, a1, h2, a2, w2)

    print(f"\n\n{'=' * 78}\nHEAD TO HEAD\n{'=' * 78}")
    print(f"  {'':34s} {'Exp1 hits':>10s} {'Exp1 AUC':>9s} "
          f"{'Exp2 hits':>10s} {'Exp2 AUC':>9s} {'Exp2 wrong':>11s}")
    for tag, (h1, a1, h2, a2, w2) in summary.items():
        f = lambda x, d=3: ("--" if x is None else f"{x:.{d}f}")
        print(f"  {tag:34s} {h1:>10d} {f(a1):>9s} "
              f"{'--' if h2 is None else h2:>10} {f(a2):>9s} "
              f"{'--' if w2 is None else w2:>11}")
    print("\n  P1 (pre-registered): Exp2 AUC must FALL substantially under "
          "within-item.\n  P2: Exp1 AUC must hold or improve."
          "\n  P3: Exp2 wrong-sign count must fall below five.")

    # Doctrine 79: report the counts behind the run, not just its verdicts.
    # `reused` is the number of vectors this run did NOT recompute, and it is
    # only meaningful next to the fingerprint printed above -- reuse is a
    # claim that the code has not moved, and the fingerprint is the evidence.
    save_cache(cache, identity, path)
    print(f"\n{'=' * 78}")
    print(f"  cache: {loaded} loaded / {stats['reused']} reused / "
          f"{stats['computed']} computed / {len(cache)} written"
          f"   fingerprint {fp}")


if __name__ == "__main__":
    main()
