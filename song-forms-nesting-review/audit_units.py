"""Inventory bounded lexical references in every review diagram.

Headings are matched as whole normalized token sequences, including plural final
nouns. Additional vocabulary below covers stanza-unit names, explicit N-line
units, and two shorthand codes for catalogued 32-bar forms. These are lexical
candidates, never automatic graph edges. A rhyme string alone does not specify
bars. Matching does not infer a stanza from a coincidental number of children.
"""
import argparse
import csv
import io
import json
from pathlib import Path
import re
import unicodedata

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
    2: ("two", "Couplet"), 3: ("three", "Tercet"), 4: ("four", "Quatrain"),
    5: ("five", "Quintain"), 6: ("six", "Sestet / sixain"),
    7: ("seven", "Septet"), 8: ("eight", "Octave / huitain"),
}
SHORTHAND = {"aaba": "AABA 32-bar", "abac": "ABAC 32-bar"}
# Semantic decisions for lexical hits with no decided edge in either direction.
EXCLUSIONS = {
    ("Music-hall song", "Octave / huitain"): (
        "scoped count comparison", "The catalog’s example gives an eight-line verse. Its genre identity and refrain say nothing about a French huitain scheme."),
    ("Parlour ballad", "Octave / huitain"): (
        "scoped count comparison", "The eight-line verses occur in the displayed title-refrain setting. The genre admits other implementations."),
    ("Gospel song (Sankey)", "Quatrain"): (
        "scoped count comparison", "The model illustrates a four-line verse and chorus. Section length varies across gospel songs."),
    ("Choka", "Couplet"): (
        "withheld: phrase or line", "The recurring unit counts five and seven Japanese sound units. A pair of measured phrases does not establish two independently lineated verses."),
    ("Tanaga", "Quatrain"): (
        "broader class via named unit", "The graph records the specific monorhymed quatrain. Its own variant link reaches the broader Quatrain class."),
    ("Kyrielle", "Tercet"): (
        "withheld: incomplete stanza", "Three lines precede the refrain in a four-line stanza. The label describes the changing part of one quatrain."),
    ("Hir a thoddaid", "Quatrain"): (
        "scoped count comparison", "Four longer lines introduce the closing toddaid in this six-line version. This is a portion of one stanza, and its size varies in other versions."),
    ("Paradelle", "Quatrain"): (
        "withheld: repeated-line prefix", "In each six-line stanza, two lines repeated make the opening four positions. The model does not call these an independent stanza."),
    ("Spenserian stanza", "Octave / huitain"): (
        "broader class via named unit", "The eight-line pentameter prefix is already linked to the more specific Monk’s Tale stanza, whose octave link records its eight-line shape."),
    ("Christ's Kirk stanza", "Octave / huitain"): (
        "scoped count comparison", "Eight lines form the opening of one ten-line stanza. Alternating rhymes and a closing bob give no separate French huitain or eight-line stanza."),
    ("Haiga", "Tercet"): (
        "broader class via named unit", "The modeled three-line contribution is specifically a haiku. The graph captures that component, and English haiku lineation varies."),
    ("Gnomic verse", "Couplet"): (
        "variable line count", "One or two lines express a maxim in this catalog. A two-line option alone cannot establish a couplet throughout the form."),
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
            rf"{count} (?:short |alternating |pentameter |rhymed |linked |(?:[0-9]+|four|five|six|seven|eight|ten) syllable )?lines?\b|"
            rf"(?:stanzas|envois|units) of {count}\b")
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


def raw_inventory(root):
    models, audits, groups = {}, {}, {}
    for path in sorted((root / "models").glob("*.json")):
        group = path.stem
        model = json.loads(path.read_text())
        audit = json.loads((root / "audit" / path.name).read_text())
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
    return models, relations, hits, paths


def edge_label(edge):
    return f"{edge['kind']} / {edge['status']}" if edge else ""


def classify(source, target, label, rule, forward, reverse):
    if source == "Cherry and Slae stanza" and target == "Couplet" and "internal rhyme pair" in label:
        return "different unit at this node", "This pair consists of two sounds within one line. The source’s actual Couplet edge applies to line pairs in the opening six."
    if "line count to review" in rule and re.search(r"\d+\s*[–—-]\s*\d+ (?:rhymed )?lines?\b", label):
        return "variable line count", "The numeral gives the upper bound of a range in this node. It does not prescribe a stanza of that size."
    if forward or reverse:
        records = []
        for direction, edge in (("Outgoing", forward), ("Incoming", reverse)):
            if edge:
                records.append(f"{direction}. {edge['evidence']}")
        relations = list(dict.fromkeys(edge["kind"] + " / " + edge["status"] for edge in (forward, reverse) if edge))
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
        status, reason = classify(source, target, label, rule, f, r)
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
