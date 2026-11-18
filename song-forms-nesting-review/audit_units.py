"""Inventory bounded lexical references in every review diagram.

Headings are matched as whole normalized token sequences, including plural final
nouns. Additional vocabulary below covers stanza-unit names, explicit N-line
units, and two shorthand codes for catalogued 32-bar forms. These are lexical
candidates, never automatic graph edges. A rhyme string alone does not specify
bars. A second pass recognizes numbered lines or independently marked rhyme-line
children. Counts of arbitrary children alone never introduce a graph edge.
"""
import argparse
import csv
import io
import json
from pathlib import Path
import re
import unicodedata

import sys

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from build import parse_catalog

HERE = Path(__file__).resolve().parent
FIELDS = ("group", "form", "node_path", "label", "match", "rule", "target",
          "adjudication", "source_to_target", "target_to_source", "evidence")
UNIT_NAMES = {
    "distich": "Couplet",
    "tetrastich": "Quatrain",
    "pentastich": "Quintain",
    "sestet": "Sestet / sixain",
    "sixain": "Sestet / sixain",
    "octave": "Octave / huitain",
    "octet": "Octave / huitain",
    "octastich": "Octave / huitain",
    "hexastich": "Sestet / sixain",
    "heptastich": "Septet",
    "huitain": "Octave / huitain",
    "tail rhyme": "Tail-rhyme stanza",
}
LINE_UNITS = {
    1: ("one", "Monostich"), 2: ("two", "Couplet"), 3: ("three", "Tercet"), 4: ("four", "Quatrain"),
    5: ("five", "Quintain"), 6: ("six", "Sestet / sixain"),
    7: ("seven", "Septet"), 8: ("eight", "Octave / huitain"),
    9: ("nine", "Nonet"), 10: ("ten", "Dizain"),
}
SHORTHAND = {"aaba": "AABA 32-bar", "abac": "ABAC 32-bar"}
# Semantic decisions for lexical hits with no decided edge in either direction.
EXCLUSIONS = {
    ("Choka", "Couplet"): (
        "withheld: phrase or line", "The recurring unit counts five and seven Japanese sound units. The pair of measured phrases does not establish two independently lineated verses."),
    ("Gnomic verse", "Couplet"): (
        "variable line count", "One or two lines express a maxim in this catalog. The two-line option does not govern the form."),
}
# Named, reviewed count-only candidates. New forms reaching these targets require a fresh decision.
for form, target, reason in [
    ("Curtal sonnet", "Quatrain", "The four full lines and final half-line together make the shortened answer. Line length distinguishes the parts, but the four alone have no separately identified stanza function here."),
    ("Rhyme royal", "Quintain", "Lines one to five are the arithmetic remainder before CC. The diagram does not assign them a distinct five-line rule or function."),
    ("Lai", "Nonet", "The nine-line stanza consists of three repeated groups. A nonet prescribes descending syllable counts from nine to one."),
    ("Glosa", "Nonet", "Nine lines of gloss lead to a tenth borrowed line. They have no nine-to-one syllable rule."),
    ("Spenserian stanza", "Nonet", "Its nine lines are eight pentameters and an alexandrine. This is incompatible with the descending syllable sequence in the Nonet entry."),
    ("Etheree", "Dizain", "The ten-line recipe specifies increasing syllables and no required ABABBCCDCD end-rhyme scheme."),
    ("Keatsian ode stanza", "Dizain", "The illustrated ten-line scheme is ABABCDECDE. The catalogued dizain uses ABABBCCDCD."),
    ("Christ's Kirk stanza", "Dizain", "This ten-line design adds a bob and a variable refrain to an alternating opening. The catalogued dizain requires a different rhyme pattern."),
    ("Cherita", "Monostich", "The one-line opening stanza starts a longer poem. The target denotes an entire poem of one line."),
    ("Terza rima", "Monostich", "A possible final line closes the preceding tercets. It does not constitute a complete one-line poem."),
    ("Bouts-rimés", "Monostich", "One line is written for each supplied end rhyme. This is a per-rhyme instruction rather than the length of the work."),
    ("Exquisite corpse", "Monostich", "One contributor adds one line to a collective poem. This describes the turn rather than the finished work."),
]:
    EXCLUSIONS[form, target] = ("withheld: count alone", reason)

# Patterns for which comparative review identifies two related settings under dissimilar headings.
STRUCTURAL_COMPARISONS = {
    ("Gwawdodyn", "1.2"): ("Hir a thoddaid", "hir branch with closing toddaid"),
}


def norm(text):
    chars = unicodedata.normalize("NFKD", text.casefold())
    folded = "".join(c for c in chars if not unicodedata.combining(c))
    return " ".join(re.findall(r"[a-z0-9]+", folded))


def terms(titles):
    patterns = []

    def add(target, rule, pattern):
        if target not in titles:
            raise ValueError(f"Unknown unit target {target}")
        patterns.append((target, rule, re.compile(r"\b(?:" + pattern + r")\b")))
    for title in sorted(titles):
        phrase = re.escape(norm(title))
        suffix = "s?" if not title.lower().endswith("s") else ""
        add(title, "catalog heading", phrase + suffix)
        bare = title.partition(" (")[0]
        if bare != title:
            add(title, "heading without qualifier", re.escape(norm(bare)) + "s?")
    for word, title in UNIT_NAMES.items():
        add(title, "unit name", word + "s?")
    for word, title in SHORTHAND.items():
        add(title, "form code or rhyme letters", word)
    for number, (word, title) in LINE_UNITS.items():
        count = rf"(?:{number}|{word})"
        group = r"(?:stanzas?|groups?|units?)"
        add(title, "numbered stanza or line group",
            rf"{count} lines? {group}|{group} (?:of |with ){count} lines")
        add(title, "line count to review",
            rf"{count} (?:full |short |closing |opening |alternating |pentameter |rhymed |linked |(?:[0-9]+|four|five|six|seven|eight|nine|ten) syllable )?lines?\b|"
            rf"(?:stanzas|envois|units) of {count}\b")
        add(title, "numbered group heading", rf"(?:opening|closing|middle|first|last) {count}$")
    add("Monostich", "one-line role", r"single (?:closing |opening |refrain )?line")
    add("Couplet", "pair wording", r"pairs?|paired lines?|paired unit")
    for word, title in (("rondeaux", "Rondeau"), ("rondeaulx", "Rondeau")):
        add(title, "inflected heading", word)
    return patterns


def diagram(nodes, prefix=""):
    for i, node in enumerate(nodes, 1):
        path = f"{prefix}.{i}" if prefix else str(i)
        if isinstance(node, str):
            yield path, node
        else:
            yield path, node["label"]
            yield from diagram(node["children"], path)


def numbered_children(nodes, group, prefix=""):
    """Recognize only children encoded as verse lines, inside verse-form groups."""
    if group not in {"C1", "C2", "D", "E"}:
        return
    for index, node in enumerate(nodes, 1):
        if isinstance(node, str):
            continue
        path = f"{prefix}.{index}" if prefix else str(index)
        children = node["children"]
        count = len(children)
        if count in LINE_UNITS and count >= 2:
            line_labels = [child if isinstance(child, str) else child["label"] for child in children]
            values = [re.match(r"^(?:Line +)?(\d+)\s*·", c, re.I) for c in line_labels]
            numbers = [int(v[1]) for v in values if v]
            numeric = len(numbers) == count and numbers == list(range(numbers[0], numbers[0] + count))
            # A whole token denoting a rhyme, as distinct from a prose clause or a syllable count.
            rhymes = count > 1 and all(re.fullmatch(r"[A-Ga-g](?:[₁₂]| · (?:feminine|masculine))?", c) for c in line_labels)
            if numeric or rhymes:
                yield path, node["label"], count
        yield from numbered_children(children, group, path)


def validate_relations(models, relations, paths):
    supported = {pair: edge for pair, edge in relations.items() if edge["status"] == "supported"}
    unique_pairs = set()
    variants = {title: [] for title in models}
    outgoing = {title: set() for title in models}
    for (source, target), edge in relations.items():
        if source == target or target not in models:
            raise ValueError(f"Invalid edge endpoint: {source} → {target}")
        if edge["status"] == "redirected":
            expected = {"source": target, "target": source}
            if edge.get("canonical_edge") != expected or (target, source) not in supported:
                raise ValueError(f"Invalid canonical relationship: {source} → {target}")
        if (source, target) not in supported:
            continue
        outgoing[source].add(target)
        pair = frozenset([source, target])
        if pair in unique_pairs:
            raise ValueError(f"Two displayed claims for one pair require explicit resolution: {source}, {target}")
        unique_pairs.add(pair)
        if edge["kind"] == "variant":
            variants[source].append(target)
        if edge["kind"] == "contains":
            scope = edge.get("scope_paths", [])
            if not scope or len(scope) != len(set(scope)) or any((source, path) not in paths for path in scope):
                raise ValueError(f"Invalid component scope: {source} → {target}: {scope}")
    for title, model in models.items():
        visible = model.get("related", [])
        if len(visible) != len(set(visible)) or set(visible) != outgoing[title]:
            raise ValueError(f"Displayed and adjudicated relationships differ for {title}")

    finished, visiting = set(), set()

    def check_variants(title):
        if title in visiting:
            raise ValueError(f"Variant cycle through {title}")
        if title in finished:
            return
        visiting.add(title)
        for parent in variants[title]:
            check_variants(parent)
        visiting.remove(title)
        finished.add(title)

    for title in models:
        check_variants(title)


def raw_inventory(root):
    models, audits, groups = {}, {}, {}
    for path in sorted((root / "models").glob("*.json")):
        group = path.stem
        model = json.loads(path.read_text(encoding="utf-8"))
        audit = json.loads((root / "audit" / path.name).read_text(encoding="utf-8"))
        if model.keys() != audit.keys() or model.keys() & models.keys():
            raise ValueError(f"Mismatched or repeated keys in {group}")
        models.update(model)
        audits.update(audit)
        groups.update(dict.fromkeys(model, group))
    source = {fields[0] for _, _, fields in parse_catalog(root / "english-forms.md")}
    if models.keys() != source:
        raise ValueError("Diagram titles and source catalog titles differ")
    patterns = terms(models)
    relations = {(s, e["target"]): e for s, a in audits.items() for e in a["edges"]}
    if len(relations) != sum(len(a["edges"]) for a in audits.values()):
        raise ValueError("Duplicate decisions for one directed pair")
    hits = []
    paths = set()
    for title, model in models.items():
        if not model["tree"]:
            raise ValueError(f"Empty diagram for {title}")
        for path, label in diagram(model["tree"]):
            paths.add((title, path))
            line = norm(label)
            for target, rule, regex in patterns:
                if target == title:
                    continue
                for match in regex.finditer(line):
                    hits.append((groups[title], title, path, label, match.group(), rule, target))
        for path, label, count in numbered_children(model["tree"], groups[title]):
            target = LINE_UNITS[count][1]
            if target != title:
                hits.append((groups[title], title, path, label, f"{count} explicit verse lines", "line-bearing children", target))
        for (source, path), (target, feature) in STRUCTURAL_COMPARISONS.items():
            if source == title:
                labels = dict(diagram(model["tree"]))
                if path not in labels or target not in models:
                    raise ValueError(f"Missing comparison witness: {title}, {target}, {path}")
                hits.append((groups[title], title, path, labels[path], feature, "reviewed structural comparison", target))
    validate_relations(models, relations, paths)
    return models, relations, hits, paths


def edge_label(edge):
    return f"{edge['kind']} / {edge['status']}" if edge else ""


def classify(source, target, path, label, rule, forward, reverse):
    if source == "Cherry and Slae stanza" and target == "Couplet" and "internal rhyme pair" in label:
        return "different unit at this node", "This pair consists of two sounds within one line. The source’s actual Couplet edge applies to line pairs in the opening six."
    if "line count to review" in rule and re.search(r"\d+\s*[–—-]\s*\d+ (?:rhymed )?lines?\b", label):
        return "variable line count", "The numeral gives the upper bound of a range in this node. It does not prescribe a stanza of that size."
    active = [e for e in (forward, reverse) if e and e["status"] != "redirected"]
    if active and all(e.get("kind") == "contains" and e.get("status") == "supported" for e in active) and forward in active:
        witnesses = forward.get("scope_paths", [])
        if not any(path == p or path.startswith(p + ".") or p.startswith(path + ".") for p in witnesses):
            return "different unit at this node", "The existing component claim is grounded at " + ", ".join(witnesses) + ". This occurrence is outside those diagram paths."
    if active:
        records = []
        for direction, edge in (("Outgoing", forward), ("Incoming", reverse)):
            if edge and edge["status"] != "redirected":
                records.append(f"{direction}. {edge['evidence']}")
        relations = list(dict.fromkeys(edge["kind"] + " / " + edge["status"] for edge in active))
        return "graph: " + " + ".join(relations), " ".join(records)
    if (source, target) in EXCLUSIONS:
        return EXCLUSIONS[source, target]
    return "unadjudicated", ""


def inventory(root):
    models, relations, hits, paths = raw_inventory(root)
    grouped = {}
    for group, source, path, label, token, rule, target in hits:
        tokens, rules = grouped.setdefault((group, source, path, label, target), ([], []))
        if token not in tokens:
            tokens.append(token)
        if rule not in rules:
            rules.append(rule)
    rows = []
    for (group, source, path, label, target), (tokens, rules) in grouped.items():
        token, rule = " | ".join(tokens), " | ".join(rules)
        f, r = relations.get((source, target)), relations.get((target, source))
        status, reason = classify(source, target, path, label, rule, f, r)
        rows.append((group, source, path, label, token, rule, target, status,
                     edge_label(f), edge_label(r), reason))
    return rows, len(models), len(paths)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("package", nargs="?", type=Path, default=HERE)
    parser.add_argument("--check", action="store_true", help="compare with existing ledger")
    args = parser.parse_args()
    rows, forms, nodes = inventory(args.package)
    if forms != 364:
        raise ValueError(f"Expected 364 forms, found {forms}")
    missing = [r for r in rows if r[7] == "unadjudicated"]
    if missing:
        pairs = sorted({(r[0], r[1], r[6], r[3]) for r in missing})
        raise ValueError(f"{len(missing)} unadjudicated matches: {pairs}")
    path = args.package / "model-unit-crosswalk.tsv"
    stream = io.StringIO(newline="")
    writer = csv.writer(stream, delimiter="\t", lineterminator="\n")
    writer.writerow(FIELDS)
    writer.writerows(rows)
    expected = stream.getvalue().encode("utf-8")
    if args.check:
        if path.read_bytes() != expected:
            raise ValueError(f"Outdated inventory: {path}")
    else:
        path.write_bytes(expected)
    print(f"{forms} models, {nodes} diagram nodes, {len(rows)} lexical matches, 0 unadjudicated")


if __name__ == "__main__":
    main()
