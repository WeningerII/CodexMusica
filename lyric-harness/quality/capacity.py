#!/usr/bin/env python3
"""English rhyme capacity, constructed and checked through the current judge.

A FAMILY is a construction pool over the declared frequency vocabulary,
keyed by the first pronunciation's phoneme tail from its last prominent
vowel. It is not an equivalence class of the certified class:RHYME relation:
RIME_RICHE shares that tail but is a distinct subtype, and another allowed
pronunciation can make a prospective pair unresolved. Certification must
answer those differences, not infer acceptance from a family key.

A SPELLING CLASS is Reviser._spelled_rime's value. Same-class pairs incur
HOMEOTELEUTON, so the class count (chain_hi) is an upper bound on an earned
clique within this pool. The corpus-derived MODAL_RHYME ban removes further
pairs. chain_lo stores an actual witness accepted by Reviser.grade under
explicit class:RHYME and the same Reviser.earned_pair_ban accessor used by
inspect. Unrelated prose, meter and whole-draft floor layers are not rhyme
capacity obligations and are not executed by this pair-specific instrument.

The population is frequency-lexicon words of at least two alphabetic letters
that the harness can transcribe, not a claim about every English word. Every
family with at least 20 spelling classes is certified. Construction attempts
at most 40 classes, repairs at most 12 rounds, and drops remaining incompatible
vertices before a final exact grade. A bounded construction proves its
achieved lower bound; neither failure to enlarge it nor the largest stored
witness proves a mathematical maximum. The planner's adopted bound is the
largest measured witness, never the ungraded spelling-class ceiling.

The 2026-09-08 production re-adoption corrects an earlier false certificate:
the artifact declared RHYME while its oracle silently asked the broader
unnamed default. All 81 old witnesses failed explicit class:RHYME because
RIME_RICHE or unresolved pronunciation edges were present. Earlier comments
about family equivalence and a certified 40-word maximum were therefore not
valid proofs under the artifact's declared coordinate. Current ADOPTED values
and data/rhyme_capacity_eng.tsv must be derived together; the production
results record the complete replacement measurement and its source hashes.

Reusable family checkpoints are bound to actual judge source, lexical data,
modal tables and declarations. A changed namespace cannot reuse proof; the
parallel instrument can explicitly re-verify every old witness under the new
judge, including its two-tier ban, before binding a new checkpoint.

Run: python3 quality/capacity.py --derive --parts=DIR
     python3 quality/recertify_capacity.py --parts=DIR --workers=4 --report=FILE
     python3 quality/capacity.py --check
     python3 quality/capacity.py --families=RELATION  (uncertified pool counts)
Verb: python3 lyric_harness.py capacity WORD | --top=N
"""

import csv
import hashlib
import json
import os
import re
import sys
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

TABLE_PATH = os.path.join(HERE, "..", "data", "rhyme_capacity_eng.tsv")


def corpus_files():
    """Actual population feeding the corpus-derived modal judge tables."""
    from quality.build_song_frequency import corpus_files as source_files
    return source_files()


class CertifiedRows(list):
    """Rows coupled to the exact source/data/declaration actually derived."""
    def __init__(self, identity):
        super().__init__()
        self.certification_identity = identity


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

#: Re-adopted2026-09-08 after all81 published witnesses failed the
#: explicitly declared class:RHYME oracle (old construction used default
#: relation rescue). All81 rebuilt at the same attempt cap40 and reverified,
#: including pronunciation uncertainty and the unchanged two-tier ban.
#: These are witnessed lower bounds, not maximum-clique proofs.
ADOPTED = {
    "population": 39969,
    "families": 12387,
    "chain_hi_at_least": {2: 2817, 5: 593, 8: 272, 12: 162, 16: 106,
                          20: 81},
    "certified": 81,
    "max_chain_lo": 23,
    "max_chain_lo_family": "IY-Z",
}

#: Families the per-push crown re-certifies (test_capacity §3) — the
#: deepest, one mid-tail, and the two the density conversation named.
CHECK_SAMPLE = ("IY", "AY-ER", "EH-R", "UW-Z", "EY-N", "AO-R")

_PAIR_RE = re.compile(r"L(\d+)/L(\d+)")


#: Largest actually witnessed class:RHYME group in the current artifact.
#: Re-adopted2026-09-08:23 words in IY-Z, after all81 families were rebuilt
#: at construction attempt cap40 and regraded with the actual current ban.
#: The former40 was not valid under the artifact's declared strict relation;
#: rich-rime/default rescue and ambiguous readings had been admitted.
#: Neither23 nor the first-reading spelling-class ceiling proves a maximum.
#: This generator rhyme-group bound is separate from writer workload limits.
#: `plan.py` reads this adopted measurement; production admission additionally
#: requires an all-family proof bound to the actual installed runtime.
ADOPTED_MAX_GROUP = 23


def _rime_key(phones):
    """First-reading construction key from the last prominent vowel.

    This preserves the comparator's last-primary-or-secondary anchor and
    the historical gasoline/tambourine correction. Equal keys do not prove
    explicit class:RHYME: rich-rime subtypes and pronunciation disagreements
    are adjudicated by the actual certification oracle.
    """
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


def _vowel_anchor(phones):
    """Index of the rhyming syllable's vowel — the comparator's anchor
    (`_rime_key`'s own rule, factored so the relation keys below share
    ONE anchor rather than four spellings of it)."""
    vidx = [i for i, p in enumerate(phones) if p[-1:].isdigit()]
    if not vidx:
        return None
    for i in reversed(vidx):
        if phones[i][-1] in "12":
            return i
    return vidx[-1]


def _assonance_key(phones):
    """The anchor NUCLEUS alone — what ASSONANCE holds constant."""
    a = _vowel_anchor(phones)
    return None if a is None else (phones[a].rstrip("012"),)


def _consonance_key(phones):
    """The consonants from the anchor to the end — what CONSONANCE holds
    constant. An OPEN final syllable keys `()`: every open-coda word
    shares "no coda", which is one family on purpose rather than an
    exclusion — excluding them would shrink the population under one
    relation and the comparison table would stop being over one set."""
    a = _vowel_anchor(phones)
    if a is None:
        return None
    return tuple(p for p in phones[a + 1:] if not p[-1:].isdigit())


def _rime_riche_key(phones):
    """The WHOLE word's phones, onset included, stress stripped — two
    words in one family sound identical (bare/bear)."""
    return tuple(p.rstrip("012") for p in phones)


#: THE RELATION IS A COORDINATE OF EVERY CAPACITY NUMBER (M-41). Each key is
#: the obvious phonological rendering of its relation over the comparator's
#: own anchor — written HERE, not derived from `rhyme_types.classify_pair`,
#: which may cut any of them finer; the keys say what was counted and the
#: certified path still runs only under RHYME (see `derive`). The name set
#: is checked against `ADMITTABLE_RELATIONS` at import below, because a
#: capacity under a relation the mandate door cannot admit would be a number
#: about nothing a writer can declare.
RELATION_KEYS = {
    "RHYME": _rime_key,
    "ASSONANCE": _assonance_key,
    "CONSONANCE": _consonance_key,
    "RIME_RICHE": _rime_riche_key,
}

#: The relation the SHIPPED artifact and every ADOPTED constant are derived
#: under. One spelling, read by `derive`, the artifact rows and the verb.
ADOPTED_RELATION = "RHYME"


def _check_relation_vocabulary():
    from lyric_harness import ADMITTABLE_RELATIONS
    if set(RELATION_KEYS) != set(ADMITTABLE_RELATIONS):
        raise AssertionError(
            "RELATION_KEYS %r != ADMITTABLE_RELATIONS %r — the capacity "
            "layer's relation vocabulary must be the mandate door's"
            % (sorted(RELATION_KEYS), sorted(ADMITTABLE_RELATIONS)))


_check_relation_vocabulary()


def relation_key(relation):
    """-> the key function for a DECLARED relation name, or refuse."""
    try:
        return RELATION_KEYS[relation]
    except KeyError:
        raise ValueError(
            f"undeclared relation {relation!r} — capacity is derived under "
            f"one of {sorted(RELATION_KEYS)}") from None


def population(lex):
    """-> {word: phones} over the declared population (module docstring).

    Membership is gated on the RHYME key alone, whatever relation a
    caller then partitions by — the four family counts are comparable
    only because they are taken over ONE population (M-41's own table is
    'over the identical population'), and the RHYME key's gate is 'the
    word carries a rhymable syllable at all'."""
    out = {}
    for w in lex.freq_rank:
        if not w.isalpha() or len(w) < 2:
            continue
        phones, oov = lex.transcribe_word(w)
        if not oov and phones and _rime_key(phones):
            out[w] = phones
    return out


def families(reviser, relation=ADOPTED_RELATION):
    """-> {family_key: {spelled_rime: [words, most frequent first]}}.

    `relation` is a DECLARED coordinate (M-41): the family count moves by
    two orders of magnitude depending on it, so no caller gets a
    partition without naming which one. The default reproduces the
    shipped artifact byte-for-byte."""
    key_fn = relation_key(relation)
    lex = reviser.lex
    pop = population(lex)
    fams = defaultdict(lambda: defaultdict(list))
    for w, phones in pop.items():
        fams[key_fn(phones)][reviser._spelled_rime(w)].append(w)
    for classes in fams.values():
        for words in classes.values():
            words.sort(key=lambda x: lex.freq_rank.get(x, 10 ** 9))
    return fams


def family_summary(reviser, relation):
    """-> {relation, families, singletons, max, mean, median} — the M-41
    comparison row, as a command instead of a one-off script. Counts
    FAMILIES only; nothing here certifies, because a family of 2,382
    assonance partners is emphatically not 2,382 usable ones (the ban,
    the modal tier and the judge all still cut it), and certified
    capacity under a non-RHYME relation awaits the owner's ruling on
    which relations are worth the grading cost (BACKLOG RULINGS WANTED).
    """
    fams = families(reviser, relation=relation)
    sizes = sorted(sum(len(v) for v in c.values()) for c in fams.values())
    n = len(sizes)
    return {
        "relation": relation,
        "families": n,
        "singletons": sum(1 for s in sizes if s == 1),
        "max": sizes[-1] if sizes else 0,
        "mean": (sum(sizes) / n) if n else 0.0,
        "median": sizes[n // 2] if n else 0,
    }


def fam_label(key):
    return "-".join(key)


def _group_measurement(reviser, words):
    """Exact pair relations and the shared grader ban, with failed edges.

    The first-reading perfect-tail partition is only a construction pool:
    RHYME excludes its RIME_RICHE subtype, and unresolved pronunciations
    cannot certify a pair. Every accepted witness answers the declared class.
    """
    import quality.schemes as SC
    if len(words) < 2:
        raise ValueError("a certified capacity witness needs at least two words")
    lines = [f"we carry the evening to the {w}" for w in words]
    m = SC.mandate([list(range(1, len(words) + 1))], n_lines=len(words),
                   default_relation=f"class:{ADOPTED_RELATION}")
    found = reviser.grade(lines, m)
    bad, incompatible = set(), set()
    for v in found["verdicts"]:
        pair = frozenset(i - 1 for i in v["lines"])
        if v["why"] is not None:
            incompatible.add(pair)
        elif reviser.earned_pair_ban(v) is not None:
            bad.add(pair)
    for row in found["refusals"]:
        incompatible.add(frozenset(i - 1 for i in row["lines"]))
    expected = {frozenset((i, j)) for i in range(len(words)) for j in range(i + 1, len(words))}
    judged = {frozenset(i - 1 for i in v["lines"]) for v in found["verdicts"]}
    incompatible.update(expected - judged)
    return found, bad, incompatible


def _group_constraints(reviser, words):
    if len(words) < 2:
        return set(), set()
    _found, bad, incompatible = _group_measurement(reviser, words)
    return bad, incompatible


def _grade_group(reviser, words):
    """The exact declared pair/ban oracle -> (banned edges, drift members)."""
    bad, incompatible = _group_constraints(reviser, words)
    return bad, {i for pair in incompatible for i in pair}


def _certification_source(path):
    """Semantic source capsule for the exact capacity oracle.

    Reviser menus, verification, and floor calibration do not participate in
    grade/earned_pair_ban. Follow self-method references from those roots so
    their helpers remain bound while independent repair/calibration can run.
    All other imported source is retained conservatively.
    """
    import ast
    from pathlib import Path
    tree = ast.parse(Path(path).read_text())
    if Path(path).name == "lyric_harness.py":
        definitions = {n.name: n for n in tree.body
                       if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef))}
        revtree = ast.parse((Path(HERE) / "revise.py").read_text())
        pending = {alias.name for n in revtree.body
                   if isinstance(n, ast.ImportFrom) and n.module == "lyric_harness"
                   for alias in n.names}
        pending.update({"Lexicon", "Declaration"})
        selected = []
        for n in tree.body:
            if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                continue
            if (isinstance(n, ast.If) and isinstance(n.test, ast.Compare)
                    and isinstance(n.test.left, ast.Name) and n.test.left.id == "__name__"
                    and len(n.test.comparators) == 1 and isinstance(n.test.comparators[0], ast.Constant)
                    and n.test.comparators[0].value == "__main__" and not n.orelse):
                continue
            selected.append(n)
            pending.update(x.id for x in ast.walk(n) if isinstance(x, ast.Name) and isinstance(x.ctx, ast.Load))
        seen = set()
        while pending:
            name = pending.pop()
            if name in seen or name not in definitions:
                continue
            seen.add(name)
            n = definitions[name]
            selected.append(n)
            pending.update(x.id for x in ast.walk(n) if isinstance(x, ast.Name) and isinstance(x.ctx, ast.Load))
        tree.body = sorted(selected, key=lambda n: n.lineno)
    elif Path(path).name == "revise.py":
        cls = next(n for n in tree.body if isinstance(n, ast.ClassDef) and n.name == "Reviser")
        methods = {n.name: n for n in cls.body if isinstance(n, ast.FunctionDef)}
        pending = {"__init__", "grade", "earned_pair_ban", "_spelled_rime"}
        selected = set()
        while pending:
            name = pending.pop()
            if name in selected or name not in methods:
                continue
            selected.add(name)
            for n in ast.walk(methods[name]):
                if (isinstance(n, ast.Attribute) and isinstance(n.value, ast.Name)
                        and n.value.id in {"self", "cls", "Reviser"}):
                    pending.add(n.attr)
        cls.body = [n for n in cls.body if not isinstance(n, ast.FunctionDef) or n.name in selected]
    elif Path(path).name == "floor.py":
        tree.body = [n for n in tree.body if isinstance(n, ast.ClassDef) and n.name == "Finding"]
    elif Path(path).name == "capacity.py":
        tree.body = [n for n in tree.body if not (isinstance(n, (ast.Assign, ast.AnnAssign))
            and any(isinstance(t, ast.Name) and t.id in {"ADOPTED", "ADOPTED_MAX_GROUP"}
                    for t in (n.targets if isinstance(n, ast.Assign) else [n.target])))]
    # Documentation and line positions are not executable judge inputs.
    for node in ast.walk(tree):
        body = getattr(node, "body", None)
        if isinstance(body, list) and body and isinstance(body[0], ast.Expr) and isinstance(body[0].value, ast.Constant) and isinstance(body[0].value.value, str):
            body.pop(0)
    return tree


def certification_identity(reviser):
    """Bind parts to actual grade/ban code, lexical data and declarations.

    The imported module graph is conservative. The only exclusions are
    unrelated Reviser methods, the floor beyond the Finding value type, and
    previously measured capacity constants (outputs of this derivation).
    """
    import ast
    from pathlib import Path
    import lyric_harness as LH
    root = Path(HERE).parent
    pending = [root / 'lyric_harness.py', Path(HERE) / 'capacity.py',
               Path(HERE) / 'revise.py', Path(HERE) / 'verify_capacity.py']
    sources = {}
    while pending:
        path = pending.pop()
        rel = str(path.relative_to(root))
        if rel in sources or not path.is_file():
            continue
        tree = _certification_source(path)
        sources[rel] = hashlib.sha256(ast.dump(tree, include_attributes=False).encode()).hexdigest()
        for node in ast.walk(tree):
            candidates = []
            if isinstance(node, ast.Import):
                candidates = [alias.name for alias in node.names]
            elif isinstance(node, ast.ImportFrom) and node.module:
                candidates = [node.module] + [node.module + '.' + alias.name for alias in node.names]
            for name in candidates:
                if not (name == 'lyric_harness' or name.startswith('quality.')):
                    continue
                candidate = root / (name.replace('.', '/') + '.py')
                if not candidate.is_file():
                    candidate = root / name.replace('.', '/') / '__init__.py'
                if candidate.is_file():
                    pending.append(candidate)
    lexical = {name: hashlib.sha256(Path(path).read_bytes()).hexdigest()
               for name, path in [('cmudict', LH.CMUDICT_PATH), ('frequency', LH.FREQ_PATH)]}
    from dataclasses import asdict
    def canonical(value):
        if isinstance(value, dict):
            return {key: canonical(item) for key, item in value.items()}
        if isinstance(value, (set, frozenset)):
            return sorted((canonical(item) for item in value),
                          key=lambda item: json.dumps(item, sort_keys=True))
        if isinstance(value, (tuple, list)):
            return [canonical(item) for item in value]
        return value
    record = {'version': 3, 'relation': ADOPTED_RELATION,
              'judge': judge_fingerprint(), 'sources': sources, 'lexical': lexical,
              'python': sys.version, 'declaration': canonical(asdict(reviser.decl)),
              'revision_declaration': canonical(asdict(reviser.rdecl))}
    return hashlib.sha256(json.dumps(record, sort_keys=True).encode()).hexdigest()


def certify(reviser, classes, max_rounds=MAX_REPAIR_ROUNDS):
    """Construct a bounded witness through the current exact pair oracle.

    At most CERTIFY_ATTEMPT_CAP classes are attempted together. Incompatible
    or unknown relation edges are rejected alongside banned edges; advancing
    representatives never counts an unanswered pair as certified. The final
    greedy deletion proves a lower bound, not a maximum or impossibility.
    """
    fr = reviser.lex.freq_rank
    slots = [list(ws) for ws in classes.values() if ws]
    slots.sort(key=lambda ws: (fr.get(ws[0], 10 ** 9), ws[0]))
    slots = slots[:CERTIFY_ATTEMPT_CAP]
    pick = [0] * len(slots)
    live = list(range(len(slots)))
    rounds = 0
    for rounds in range(1, max_rounds + 1):
        words = [slots[i][pick[i]] for i in live]
        banned, incompatible = _group_constraints(reviser, words)
        edges = banned | incompatible
        if not edges:
            return words, rounds
        # An edge cover targets the actual blockers; marking both ends of
        # every refused pair would discard an entire family over one reading.
        demote = set()
        remaining = set(edges)
        while remaining:
            degree = defaultdict(int)
            for pair in remaining:
                for k in pair:
                    degree[k] += 1
            worst = max(degree, key=lambda k: (degree[k], pick[live[k]],
                                               fr.get(words[k], 10 ** 9), k))
            demote.add(worst)
            remaining = {pair for pair in remaining if worst not in pair}
        new_live = []
        for index, member in enumerate(live):
            if index in demote:
                if pick[member] + 1 >= len(slots[member]):
                    continue
                pick[member] += 1
            new_live.append(member)
        live = new_live
        if not live:
            return [], rounds
    words = [slots[i][pick[i]] for i in live]
    banned, incompatible = _group_constraints(reviser, words)
    edges = banned | incompatible
    kept = set(range(len(words)))
    while edges:
        degree = defaultdict(int)
        for pair in edges:
            for k in pair:
                degree[k] += 1
        worst = max(degree, key=lambda k: (degree[k], fr.get(words[k], 10 ** 9), k))
        kept.remove(worst)
        edges = {pair for pair in edges if worst not in pair}
    witness = [word for i, word in enumerate(words) if i in kept]
    bad, drift = _grade_group(reviser, witness)
    if bad or drift:
        raise RuntimeError("capacity construction returned an uncertified witness")
    return witness, rounds


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
    identity = certification_identity(reviser)
    if parts_dir:
        # Legacy unbound parts are never read. Changed source/data receives
        # a new namespace while retaining previous evidence for inspection.
        parts_dir = os.path.join(parts_dir, identity)
    # THE ARTIFACT IS DERIVED UNDER ONE DECLARED RELATION AND SAYS SO ON
    # EVERY ROW (M-41). Deriving it under another is not a parameter here
    # on purpose: the certified half prices at hours of grading per
    # relation and which relations are worth paying for is the owner's
    # ruling (BACKLOG RULINGS WANTED); the uncertified family counts for
    # the other three are `--families=RELATION`, which writes nothing.
    fams = families(reviser, relation=ADOPTED_RELATION)
    rows = CertifiedRows(identity)
    todo = sorted(fams.items(), key=lambda kv: (-len(kv[1]), fam_label(kv[0])))
    for key, classes in todo:
        n_classes = len(classes)
        row = {
            "relation": ADOPTED_RELATION,
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
    if certification_identity(reviser) != identity:
        raise RuntimeError("capacity inputs changed during certification; no artifact may be adopted")
    return rows


#: `relation` leads the row (M-41): two capacity numbers can never again be
#: read against each other without the reader seeing which relation each is
#: about. `read_table` asserts the columns, so a table without the
#: coordinate is unreadable rather than silently read as RHYME.
COLUMNS = ("relation", "family", "words", "classes", "chain_hi", "certified",
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
SOURCE_HEADER = "#certification-source"


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


def read_certification_source(path=TABLE_PATH):
    """The bound all-family proof inputs, distinct from the six-family smoke."""
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            if not line.startswith("#"):
                break
            if line.startswith(SOURCE_HEADER + "\t"):
                value = line.rstrip("\n").split("\t", 1)[1]
                return value if re.fullmatch(r"[0-9a-f]{64}", value) else None
    return None


def emit_table(rows, path=TABLE_PATH):
    identity = getattr(rows, "certification_identity", None)
    if any(r["certified"] for r in rows) and not identity:
        raise ValueError("certified capacity rows lack their actual derivation source identity")
    tmp = path + ".part"
    with open(tmp, "w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh, delimiter="\t", lineterminator="\n")
        w.writerow([JUDGE_HEADER] +
                   ["%s=%s" % kv for kv in sorted(judge_fingerprint().items())])
        if identity:
            w.writerow([SOURCE_HEADER, identity])
        w.writerow(COLUMNS)
        for r in rows:
            w.writerow([r[c] for c in COLUMNS])
    os.replace(tmp, path)


def read_table(path=TABLE_PATH, *, verify_runtime=True):
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"{path} is missing — the capacity artifact ships with the "
            f"repo. Re-derive with `python3 quality/capacity.py --derive` "
            f"(the certified half grades every deep family through the "
            f"real Reviser and takes ~an hour).")
    if verify_runtime and os.environ.get("LYRIC_RELEASE_ASSETS_REQUIRED") == "1":
        require_current_proof(path=path)
    with open(path, encoding="utf-8") as fh:
        rd = csv.reader((l for l in fh if not l.startswith("#")),
                        delimiter="\t")
        header = next(rd)
        if tuple(header) != COLUMNS:
            raise ValueError(f"unexpected capacity columns: {header}")
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


def validate_rows(rv, rows, path=TABLE_PATH):
    """The complete population, witness shape and adopted-constant contract."""
    fams = families(rv)
    fresh = {}
    for key, classes in fams.items():
        fresh[fam_label(key)] = (sum(len(v) for v in classes.values()),
                                 len(classes))
    bad = []
    by_classes = {fam_label(key): classes for key, classes in fams.items()}
    for r in rows:
        # THE COORDINATE IS VERIFIED, NOT ASSUMED (M-41): every artifact
        # row must name the adopted relation — `read_table` already made
        # a missing column unreadable, and this makes a WRONG value loud.
        if r.get("relation") != ADOPTED_RELATION:
            bad.append(f"{r['family']}: relation {r.get('relation')!r} "
                       f"is not the adopted {ADOPTED_RELATION!r}")
        if bool(r["certified"]) != (r["classes"] >= CERTIFY_MIN_CLASSES):
            bad.append(f"{r['family']}: certified coverage does not match the declared floor")
        if r["certified"]:
            words = r["witness"].split()
            choices = {word: spelling for spelling, members in by_classes.get(r["family"], {}).items()
                       for word in members}
            if (r["chain_lo"] != len(words) or len(words) > min(r["chain_hi"], CERTIFY_ATTEMPT_CAP)
                    or any(word not in choices for word in words)
                    or len({choices[word] for word in words if word in choices}) != len(words)):
                bad.append(f"{r['family']}: witness length, membership or spelling classes are invalid")
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
    recorded, current = read_judge(path), judge_fingerprint()
    if recorded != current:
        bad.append("capacity modal-table fingerprint is missing or stale")
    return bad, summary



_PROOF_CACHE = None


def _proof_path():
    return os.environ.get("LYRIC_CAPACITY_ATTESTATION") or os.path.abspath(
        os.path.join(HERE, "..", "..", "mcp", "capacity_verification.json"))


def _proof_epoch(path, receipt_path):
    """Cheap cache invalidation over source/data files, with exact bytes in the proof."""
    from pathlib import Path
    import lyric_harness as LH
    root = Path(HERE).parent
    paths = [root / "lyric_harness.py", Path(path), Path(receipt_path),
             Path(LH.CMUDICT_PATH), Path(LH.FREQ_PATH)]
    paths.extend(Path(HERE).glob("*.py"))
    paths.extend(Path(root / name) for name in judge_fingerprint())
    def stamp(p):
        try:
            st = p.stat()
            return str(p), st.st_size, st.st_mtime_ns, st.st_ctime_ns, st.st_ino
        except OSError:
            return str(p), None
    return (sys.version, ADOPTED_MAX_GROUP, json.dumps(ADOPTED, sort_keys=True),
            tuple(sorted(stamp(p) for p in paths)))


def validate_receipt(receipt, rows, *, table_sha256, source_identity, python_version):
    """Validate one trusted build-generated all-family attestation, never stdout."""
    expected = {r["family"]: r for r in rows if r["certified"]}
    scalar = {
        "version": 1, "status": "verified", "scope": "all_certified_capacity_witnesses",
        "relation": ADOPTED_RELATION, "python": python_version,
        "source_identity": source_identity, "table_sha256": table_sha256,
        "families_total": len(rows), "witnesses_required": len(expected),
        "witnesses_verified": len(expected), "construction_attempt_cap": CERTIFY_ATTEMPT_CAP,
        "summary": json.loads(json.dumps(summarize(rows))),
    }
    if not isinstance(receipt, dict) or any(type(receipt.get(k)) is not type(v)
            or json.dumps(receipt.get(k), sort_keys=True) != json.dumps(v, sort_keys=True)
            for k, v in scalar.items()):
        raise ValueError("CAPACITY_UNVERIFIED: missing, stale or mismatched runtime/table attestation")
    records = receipt.get("witnesses")
    if not isinstance(records, list) or len(records) != len(expected):
        raise ValueError("CAPACITY_UNVERIFIED: the attestation did not verify every required witness")
    seen = set()
    for record in records:
        if not isinstance(record, dict) or record.get("family") not in expected or record["family"] in seen:
            raise ValueError("CAPACITY_UNVERIFIED: duplicate or unexpected witness proof")
        seen.add(record["family"])
        row = expected[record["family"]]
        n = len(row["witness"].split())
        numbers = {"chain_lo": n, "pairs_judged": n * (n - 1) // 2,
                   "banned_pairs": 0, "refused_pairs": 0, "violated_pairs": 0}
        if any(type(record.get(k)) is not int or record[k] != v for k, v in numbers.items()):
            raise ValueError("CAPACITY_UNVERIFIED: incomplete or unsuccessful witness verdict")
    return receipt


def require_current_proof(*, path=TABLE_PATH, receipt_path=None, reviser=None):
    """Require proof for this installed runtime and exact reviewed table bytes.

    The receipt is produced by quality/verify_capacity.py through ALL certified
    witnesses in the actual image. A six-family smoke, old source header, or
    another Python runtime cannot substitute. This reads a build artifact,
    not model-provided data or a conversational certification claim.
    """
    global _PROOF_CACHE
    import copy
    from pathlib import Path
    use_cache = reviser is None
    receipt_path = receipt_path or _proof_path()
    try:
        epoch = _proof_epoch(path, receipt_path)
        if use_cache and _PROOF_CACHE is not None and _PROOF_CACHE[0] == epoch:
            return copy.deepcopy(_PROOF_CACHE[1])
        receipt = json.loads(Path(receipt_path).read_text())
        rows = read_table(path, verify_runtime=False)
        summary = summarize(rows)
        if summary != ADOPTED or summary["max_chain_lo"] != ADOPTED_MAX_GROUP:
            raise ValueError("CAPACITY_UNVERIFIED: adopted generator capacity does not match the verified table")
        if reviser is None:
            from quality.revise import Reviser
            reviser = Reviser()
        identity = certification_identity(reviser)
        valid = validate_receipt(receipt, rows,
            table_sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest(),
            source_identity=identity, python_version=sys.version)
        if _proof_epoch(path, receipt_path) != epoch:
            raise ValueError("CAPACITY_UNVERIFIED: proof inputs changed during admission")
        if use_cache:
            _PROOF_CACHE = (epoch, valid)
        return copy.deepcopy(valid)
    except (OSError, json.JSONDecodeError, TypeError, KeyError) as exc:
        raise ValueError("CAPACITY_UNVERIFIED: actual-runtime all-family receipt is missing or unreadable") from exc


def check():
    """Re-derive tier 1 exactly and re-certify the sample -> exit code."""
    from quality.revise import Reviser
    rv = Reviser()
    rows = read_table()
    bad, summary = validate_rows(rv, rows)
    if read_certification_source() != certification_identity(rv):
        try:
            require_current_proof(reviser=rv)
        except ValueError as exc:
            bad.append(str(exc))
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
    for a in sys.argv:
        if a.startswith("--families="):
            rel = a.split("=", 1)[1]
            try:
                relation_key(rel)
            except ValueError as e:
                print(f"REFUSED — {e}")
                sys.exit(2)
            from quality.revise import Reviser
            s = family_summary(Reviser(), rel)
            print(f"  FAMILY COUNTS under relation {s['relation']} — "
                  f"UNCERTIFIED tier-1 partition of the identical "
                  f"population (M-41); certified capacity exists only "
                  f"under {ADOPTED_RELATION} pending the owner's ruling")
            print(f"  families {s['families']}   singletons "
                  f"{s['singletons']}   max {s['max']}   "
                  f"mean {s['mean']:.1f}   median {s['median']}")
            sys.exit(0)
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
