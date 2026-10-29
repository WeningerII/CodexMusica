"""Package the existing poem annotation and comparison files for the browser.

This does not run a rhyme classifier or add linguistic interpretations.
"""
from __future__ import annotations

import ast
import hashlib
import json
import os
import re
import sys
from pathlib import Path

HERE = Path(os.environ.get("FROST_SITE_ROOT", Path(__file__).resolve().parent))
ROOT = HERE.parent
AUDIT = ROOT / "frost_notation/full_sound_audit.json"
PAIRS = ROOT / "frost_pair_analysis/frost_rhyme_pairs.json"
EXTRAS = ROOT / "frost_pair_analysis/frost_extra_classifications.json"
ANNOTATED_PAIRS = ROOT / "frost_pair_analysis/frost_annotated_pairs.json"
ANNOTATED_EXTRAS = ROOT / "frost_pair_analysis/frost_annotated_extra_classifications.json"
RENDERER = ROOT / "frost_notation/render_full_sound_study.py"
COHESIVE = ROOT / "frost_notation/render_cohesive.py"


def literals(path: Path) -> dict:
    result = {}
    for node in ast.parse(path.read_text()).body:
        if not isinstance(node, ast.Assign):
            continue
        try:
            value = ast.literal_eval(node.value)
        except (ValueError, TypeError):
            continue
        for target in node.targets:
            if isinstance(target, ast.Name):
                result[target.id] = value
    return result


def normal_word(value: str) -> str:
    return re.sub(r"[^\w']", "", value.replace("’", "'")).lower()


audit = json.loads(AUDIT.read_text())
pairs = json.loads(PAIRS.read_text())
original = literals(COHESIVE)
rendered = literals(RENDERER)
tokens = pairs["tokens"]
lines = []
token_pronunciations = [None] * len(tokens)

for i, row in enumerate(audit["lines"]):
    line = {k: v for k, v in row.items() if k not in ("y_top", "y_bottom")}
    line["words"] = row["text"].split()
    line["wordIds"] = [j + 1 for j, t in enumerate(tokens) if t[1] == i + 1]
    assert row["text"] == original["POEM"][i]
    assert len(line["words"]) == len(line["wordIds"])
    groups = []
    group = []
    for syllable in range(8):
        group.append(syllable)
        if syllable not in row["joins"]:
            groups.append(group)
            group = []
    assert not group and len(groups) == len(line["wordIds"])
    syllable_words = [None] * 8
    for local_word, (word_id, group) in enumerate(zip(line["wordIds"], groups)):
        assert normal_word("".join(original["SYLS"][i][j] for j in group)) == normal_word(tokens[word_id - 1][0])
        assert normal_word(line["words"][local_word]) == normal_word(tokens[word_id - 1][0])
        token_pronunciations[word_id - 1] = "-".join(row["pronunciation"][j] for j in group)
        for syllable in group:
            syllable_words[syllable] = word_id
    line["syllableWords"] = syllable_words
    line["rhymeTail"] = rendered["TAILS"][i]
    lines.append(line)

optional_pauses = {}
for zero_line, syllable_boundary in rendered["OPTIONAL_PAUSES"].items():
    line = lines[zero_line]
    after_id = line["syllableWords"][syllable_boundary - 1]
    optional_pauses[zero_line + 1] = line["wordIds"].index(after_id) + 1

sentences = []
for stanza, groups in enumerate(rendered["SENTENCE_GROUPS"]):
    for start, end, label in groups:
        sentences.append({"id": label, "firstLine": stanza * 4 + start + 1,
                          "lastLine": stanza * 4 + end + 1})

source_text = RENDERER.read_text()
source_lines = source_text.splitlines()
tree = ast.parse(source_text)


def existing_paragraphs(start_marker: str, end_marker: str) -> list[str]:
    first = next(i + 1 for i, v in enumerate(source_lines) if start_marker in v)
    last = next(i + 1 for i, v in enumerate(source_lines) if i + 1 > first and end_marker in v)
    found = []
    for node in ast.walk(tree):
        if (isinstance(node, ast.Call) and isinstance(node.func, ast.Name)
                and node.func.id == "paragraph" and first < node.lineno < last
                and len(node.args) >= 3 and isinstance(node.args[2], ast.Constant)
                and isinstance(node.args[2].value, str)):
            found.append((node.lineno, node.args[2].value))
    return [text for _, text in sorted(found)]


source_links = [
    ["Harvard · Guide to Prosody", "https://poetry.harvard.edu/guide-prosody"],
    ["Cambridge · English pronunciation", "https://dictionary.cambridge.org/us/pronunciation/"],
    ["Cambridge · US promises and weak of", "https://dictionary.cambridge.org/us/pronunciation/english/auction-of-promises"],
    ["Cambridge · -est pronunciations", "https://dictionary.cambridge.org/pronunciation/english/est"],
    ["Cambridge · here", "https://dictionary.cambridge.org/pronunciation/english/here"],
    ["Academy of American Poets · Rhyme", "https://poets.org/glossary/rhyme"],
    ["University of Toronto RPO · Rhyme", "https://rpo.library.utoronto.ca/glossary/rhyme"],
    ["Harvard · Guide to Poetic Terms", "https://poetry.harvard.edu/guide-poetic-terms"],
    ["Academy of American Poets · Enjambment", "https://poets.org/glossary/enjambment"],
    ["Academy of American Poets · Caesura", "https://poets.org/glossary/caesura"],
    ["BYU · Silva Rhetoricae", "https://rhetoric.byu.edu/"],
    ["Poetry Foundation · Poem text", "https://www.poetryfoundation.org/poems/42891/stopping-by-woods-on-a-snowy-evening"],
    ["Codex Musica · English catalogue", f"https://github.com/WeningerII/CodexMusica/blob/{pairs['source']['commit']}/lyric-harness/quality/canon_index.tsv"],
]

data = {
    "title": "Stopping by Woods on a Snowy Evening",
    "author": "Robert Frost",
    "lines": lines,
    "tokens": tokens,
    "tokenPronunciations": token_pronunciations,
    "categories": pairs["categories"],
    "pairs": pairs["pairs"],
    "absenceOnly": pairs["absence_only"],
    "readingWitnesses": pairs["reading_witnesses"],
    "witnessEdges": pairs["witness_edges"],
    "counts": pairs["counts"],
    "source": pairs["source"],
    "method": pairs["method"],
    "dataSha256": hashlib.sha256(PAIRS.read_bytes()).hexdigest(),
    "pronunciationKey": {
        "title": "One broad rhotic U.S. model",
        "vowels": rendered["keys"],
        "consonants": [["dh", "/ð/", "this"], ["th", "/θ/", "thin"],
                       ["ng", "/ŋ/", "sing"], ["j", "/dʒ/", "jam"],
                       ["ch", "/tʃ/", ""], ["sh", "/ʃ/", ""], ["kw", "/kw/", ""]],
        "notes": existing_paragraphs("PRONUNCIATION KEY ·", "FOLLOW THE COLORED ENDINGS"),
    },
    "notationKey": {
        "meter": "Four iambic feet; eight metrical positions. ˘ = weak; / = strong; | separates feet.",
        "case": "Capital pronunciation syllables mark prominence in the displayed reading. Hyphens join syllables of one word, including across feet.",
        "P": "Printed punctuation", "G": "Grammar", "V": "Optional vocal delivery", "R": "Rhetorical device and textual evidence",
        "alternatives": "Alternatives may combine. Stress, tempo, pitch and intention allow indefinitely many performances; the annotations map principal defensible choices.",
        "optionalPause": "‖? marks an optional performed pause, not a printed mark or compulsory silence.",
    },
    "stanzas": [{"number": n + 1, "roman": roman, "title": title,
                 "firstLine": n * 4 + 1, "lastLine": n * 4 + 4,
                 "scheme": ["AABA", "BBCB", "CCDC", "DDDD"][n]}
                for n, (roman, title) in enumerate(rendered["STANZA_HEADS"])],
    "optionalPauses": optional_pauses,
    "sentences": sentences,
    "rhymeFamilies": {key: {"respelling": rendered["SOUNDS"][key], "ipa": rendered["IPA"][key]}
                      for key in "ABCD"},
    "overlapTable": {"columns": rendered["headings"], "rows": rendered["matrix"]},
    "globalNotes": {
        "rhymeOverlap": existing_paragraphs("for idx,row in enumerate(matrix):", "closing_top=y"),
        "boundaries": existing_paragraphs("left_y=y", "right_y=y"),
        "rhetoric": existing_paragraphs("right_y=y", "y=max(left_y,right_y)"),
        "attribution": existing_paragraphs("TEXT, ANALYSIS AND SOURCES", "sources=["),
    },
    "sourceLinks": source_links,
    "unavailable": {
        "E6": "Requires a whole-line comparison.",
        "E17": "Requires a delivered-stress surface.",
        "E21": "Requires an earlier-pronunciation surface.",
        "E22": "Unverified catalogue entry without an executable schema.",
    },
    "readingEvidenceNote": "Recorded support; other labels were not re-tested for this reading.",
}

# Each pronunciation scope uses the same schemas, category order and poem.
def merge_comparison(base_path, extras_path):
    raw = json.loads(base_path.read_text())
    result = {
        "categories": raw["categories"], "pairs": raw["pairs"],
        "absenceOnly": raw["absence_only"],
        "readingWitnesses": raw["reading_witnesses"],
        "witnessEdges": raw["witness_edges"], "counts": raw["counts"],
        "source": raw["source"], "method": raw["method"],
        "dataSha256": hashlib.sha256(base_path.read_bytes()).hexdigest(),
    }
    assert raw["tokens"] == tokens
    extra = json.loads(extras_path.read_text())
    assert extra["source"]["base_sha256"] == result["dataSha256"]
    assert [row[0] for row in extra["categories"]] == ["E63", "E66", "H1"]
    assert extra["bit_positions"] == {"E63": 22, "E66": 23, "H1": 24}
    result["categories"] = result["categories"] + extra["categories"]
    pair_masks = {(a, b): mask for a, b, mask in result["pairs"]}
    for a, b, mask in extra["pairs"]:
        assert (a, b) in pair_masks
        pair_masks[a, b] |= mask
    result["pairs"] = [[a, b, mask] for (a, b), mask in pair_masks.items()]
    absence_masks = {(a, b): mask for a, b, mask in result["absenceOnly"]}
    for a, b, mask in extra["absence_only"]:
        absence_masks[a, b] = absence_masks.get((a, b), 0) | mask
    result["absenceOnly"] = [[a, b, mask] for (a, b), mask in sorted(absence_masks.items())]
    result["readingWitnesses"] = list(result["readingWitnesses"])
    witness_lookup = {tuple(row): i for i, row in enumerate(result["readingWitnesses"])}
    extra_witness_ids = {}
    for i, row in enumerate(extra["reading_witnesses"]):
        key = tuple(row)
        if key not in witness_lookup:
            witness_lookup[key] = len(result["readingWitnesses"])
            result["readingWitnesses"].append(row)
        extra_witness_ids[i] = witness_lookup[key]
    edges = {}
    for a, b, mask, w in result["witnessEdges"]:
        key = (a, b, w)
        edges[key] = edges.get(key, 0) | mask
    for a, b, mask, w in extra["witness_edges"]:
        key = (a, b, extra_witness_ids[w])
        edges[key] = edges.get(key, 0) | mask
    result["witnessEdges"] = [
        [a, b, supported, w]
        for (a, b, w), mask in edges.items()
        if (supported := mask & pair_masks[a, b] & ~absence_masks.get((a, b), 0))
    ]
    for key in ("by_category", "nonabsence_by_category", "reading_search_matches", "refusal_reasons"):
        result["counts"].setdefault(key, {}).update(extra["counts"].get(key, {}))
    result["counts"]["category_slots"] = len(result["pairs"]) * len(result["categories"])
    result["counts"]["pairs_with_native_matches"] = sum(bool(m) for m in pair_masks.values())
    result["counts"]["pairs_with_nonabsence_matches"] = sum(
        bool(m & ~absence_masks.get(pair, 0)) for pair, m in pair_masks.items())
    result["categoryNotes"] = extra["category_notes"]
    result["additionalAnalysis"] = {
        "source": extra["source"], "method": extra["method"],
        "sha256": hashlib.sha256(extras_path.read_bytes()).hexdigest(),
    }
    return result

all_readings = merge_comparison(PAIRS, EXTRAS)
annotated = merge_comparison(ANNOTATED_PAIRS, ANNOTATED_EXTRAS)
assert all_readings["categories"] == annotated["categories"]
data.update(annotated)
data["readingMode"] = "annotated"
data["allReadings"] = dict(all_readings, readingMode="all")
data["scopeNotes"] = {
    "annotated": "Uses the displayed vowel and consonant sounds, with lexical stress. The meter grid marks a suggested delivery. Repeated words count as separate occurrences.",
    "all": "Connections include supported alternative pronunciations. The meter grid remains the reference reading; select a connection to inspect its alternatives.",
}
data["analysisNotes"] = [
    "This is an analysis of existing text. All supported labels are shown together, including labels that a writing tool might discourage.",
    "E63 (homoioteleuton) compares endings identified by Codex Musica’s declared morphology rules, together with final-syllable sounds and stress. Its morphology is heuristic; the label records that rule’s result. A pair with no affix on either side does not provide a shared ending and is excluded from the display.",
    "H1 (homeoteleuton: same spelled ending) uses Codex Musica’s separate spelling rule at an existing sound match. E63 and H1 answer different questions and may overlap.",
    "E66 (trite rhyme) means that the pair belongs to Codex Musica’s declared list. It does not measure the quality of this poem or establish that every unlisted pair is original.",
]

# Render already-recorded dictionary phones in the poster's sound key. This
# uses the existing engine only for segmentation; it does not judge relations.
sys.path.insert(0, str(ROOT / "frost_pair_analysis/CodexMusica/lyric-harness"))
from lyric_harness import syllabify

CONSONANTS = {"B": "b", "CH": "ch", "D": "d", "DH": "dh", "F": "f",
              "G": "g", "HH": "h", "JH": "j", "K": "k", "L": "l",
              "M": "m", "N": "n", "NG": "ng", "P": "p", "R": "r",
              "S": "s", "SH": "sh", "T": "t", "TH": "th", "V": "v",
              "W": "w", "Y": "y", "Z": "z"}
VOWELS = {"AA": "ah", "AE": "a", "AW": "ow", "AY": "eye", "EH": "e",
          "ER": "er", "EY": "ay", "IH": "i", "IY": "ee", "OW": "oh",
          "UH": "uu", "UW": "oo"}


def witness_label(record: str) -> str:
    word, phones = record.split(" = ", 1)
    result = []
    for syllable in syllabify(phones.split()):
        nucleus = syllable["nucleus"]
        coda = list(syllable["coda"])
        if coda[:1] == ["R"] and nucleus in ("AA", "AO", "IH", "IY"):
            vowel = {"AA": "ahr", "AO": "or", "IH": "eer", "IY": "eer"}[nucleus]
            coda.pop(0)
        elif nucleus == "AH":
            vowel = "uh" if syllable["stress"] == 0 else "u"
        elif nucleus == "AO":
            vowel = "aw"
        else:
            vowel = VOWELS[nucleus]
        text = ("".join(CONSONANTS[p] for p in syllable["onset"]) + vowel
                + "".join(CONSONANTS[p] for p in coda))
        result.append(text.upper() if syllable["stress"] else text)
    return word + " = " + "-".join(result)


for snapshot in (data, data["allReadings"]):
    snapshot["readingWitnessLabels"] = [
        [witness_label(record) for record in witness]
        for witness in snapshot["readingWitnesses"]
    ]

# Native witnesses record only the members with pronunciation alternatives.
# Supply each remaining member's actual lexical reading, not the separate
# editorial prominence printed in the metrical grid. A null is deliberately
# retained when a member needs an explicit witness rather than a default.
sys.path.insert(0, str(ROOT / "frost_pair_analysis"))
from poem_readings import normalize_reader, respell
from quality.phonology.eng import English
from lyric_harness import Lexicon
all_lexicon = normalize_reader(English(
    readings="all", lexicon=Lexicon(reader_scheme="v2"), reader_scheme="v2"
))._lexicon()
data["tokenDefaultPronunciations"] = [
    respell(row[5]) for row in data["source"]["annotated_reading"]["rows"]
]
data["allReadings"]["tokenDefaultPronunciations"] = [
    respell(variants[0]) if len(variants := all_lexicon.pronunciation_variants(word)) == 1 else None
    for word, _, _ in tokens
]
data["pronunciationKey"]["vowels"].append(["aw", "/ɔ/", "thought"])
data["pronunciationKey"]["notes"].append("aw appears only in recorded dictionary alternatives. The comparison distinguishes uh /ə/ from u /ʌ/ and treats the dictionary’s IH/IY before r as the same NEAR vowel in this reading.")

assert len(data["lines"]) == 16 and len(data["tokens"]) == 108
assert len(data["pairs"]) == 5778 and all(token_pronunciations)
assert data["optionalPauses"] == {1: 4, 7: 3, 13: 4, 15: 4, 16: 4}
# The poster's annotation audit retains its own historical pair-data hash.
# Its text, syllable and annotation checks above remain authoritative; the
# corrected pair run has its own hash and must match the regenerated add-on.
data["annotationSourcePairSha256"] = audit["pair_data_sha256"]
payload = "window.POEM_DATA=" + json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/") + ";\n"
out = HERE / "dist/data.js"
out.parent.mkdir(exist_ok=True)
out.write_text(payload)
print(json.dumps({"output": str(out), "bytes": out.stat().st_size,
                  "lines": len(lines), "tokens": len(tokens), "pairs": len(pairs["pairs"]),
                  "sha256": hashlib.sha256(out.read_bytes()).hexdigest()}))
