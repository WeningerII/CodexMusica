"""Versioned source reader shared by runtime and current calibrations.

Rows retain physical line numbers, indentation, and item boundaries. Historical
calibrations can still select their declared legacy reader explicitly; they may
not silently call it the current runtime population.
"""
from dataclasses import dataclass
from functools import lru_cache
import hashlib
import json
from pathlib import Path

READER_VERSION = "normalized-lyrics-v1"
ROOT = Path(__file__).resolve().parents[1]
WORK_EDITIONS = ROOT / "data" / "calibration_work_editions.json"
LABEL_PREFIXES = ROOT / "data" / "lyric_label_prefixes.json"
CORPUS_SONG = ROOT / "corpus" / "song"


@lru_cache(maxsize=1)
def _label_prefixes():
    """{(corpus file name, physical line): label} for printed labels that stand
    IN FRONT of sung words on the same line: a speaker name (`_Polly._ Over
    the Hills...`), a section label (`Chorus.--And maun I...`), a printed stanza
    numeral. A whole-line label is marked `# APPARATUS:` in the corpus file;
    a prefix cannot be, because the rest of the line is sung, and splitting the
    line would move every physical coordinate the edition registry and the
    apparatus receipts are keyed on. So each prefix is DECLARED per line from a
    reviewed reading, never matched by pattern, and the reader strips exactly
    the declared characters."""
    if not LABEL_PREFIXES.exists():
        return {}
    value = json.loads(LABEL_PREFIXES.read_text(encoding="utf-8"))
    if value.get("version") != 1:
        raise ValueError("label-prefix declarations have an undeclared version")
    out = {}
    for entry in value["prefixes"]:
        key = (entry["file"], entry["line"])
        if key in out or not entry["prefix"].strip():
            raise ValueError("invalid label-prefix declaration: %s:%d" % key)
        out[key] = entry["prefix"]
    return out


def _declared_prefixes(path):
    """The declarations for one CORPUS file; a draft or fixture gets none."""
    resolved = Path(path).resolve()
    if resolved.parent != CORPUS_SONG.resolve():
        return {}
    name = resolved.name
    return {line: prefix for (file, line), prefix in _label_prefixes().items() if file == name}


@dataclass(frozen=True)
class SourceRow:
    lineno: int
    indent: int
    kind: str
    text: str


def normalized_rows(path):
    # Deferred import avoids a cycle when the CLI itself delegates here.
    import lyric_harness as lh
    raw = lh.read_lyric_text(path).splitlines()
    drops = lh.wrapped_apparatus_drops(raw, path)
    vdrops, edits = lh.bracketed_verse_edits(raw, path)
    drops |= vdrops
    prefixes = _declared_prefixes(path)
    stripped = set()
    for i, original in enumerate(raw):
        text = edits.get(i, original.strip())
        kind = "apparatus"
        if i in drops:
            pass
        elif text.startswith("--- TITLE:"):
            kind = "title"
        elif not text:
            kind = "blank"
        elif not lh.is_apparatus_line(text):
            text = lh.normalise_bracket_spans(text, path).strip()
            kind = "lyric" if text else "apparatus"
            prefix = prefixes.get(i + 1) if kind == "lyric" else None
            if prefix is not None:
                if not text.startswith(prefix):
                    raise ValueError(f"label prefix drift: {Path(path).name}:{i + 1} no longer "
                                     f"starts with its declared label {prefix!r}")
                text = text[len(prefix):].strip()
                kind = "lyric" if text else "apparatus"
                stripped.add(i + 1)
        yield SourceRow(i + 1, lh.line_indent(original), kind, text)
    if set(prefixes) - stripped:
        raise ValueError(f"label prefix declared on a line that is not a lyric row: "
                         f"{Path(path).name}:{sorted(set(prefixes) - stripped)}")


def lyric_items(path):
    """(title, physical title line, [SourceRow]) preserving source item bounds."""
    title, title_line, body = None, 0, []
    for row in normalized_rows(path):
        if row.kind == "title":
            if title is not None:
                yield title, title_line, body
            title, title_line, body = row.text[10:].strip(), row.lineno, []
        elif row.kind == "lyric":
            body.append(row)
    if title is not None or body:
        yield title or "", title_line, body


@lru_cache(maxsize=1)
def _edition_policy():
    value = json.loads(WORK_EDITIONS.read_text(encoding="utf-8"))
    if value.get("version") != 1 or value.get("reader") != READER_VERSION:
        raise ValueError("calibration edition policy has an undeclared reader/version")
    by_file = {}
    for work in value["works"]:
        if sum(e["weight"] for e in work["editions"]) != 1:
            raise ValueError("a calibration work must have exactly one representative")
        for entry in work["editions"]:
            key = (work["file"], entry["title_line"])
            if key in by_file:
                raise ValueError("a calibration edition belongs to multiple works")
            by_file[key] = entry
    for entry in value.get("excluded", []):
        key = (entry["file"], entry["title_line"])
        if key in by_file or entry["weight"] != 0 or not entry.get("reason"):
            raise ValueError("invalid calibration population exclusion")
        by_file[key] = entry
    return by_file


def calibration_items(path):
    """Current normalized population, one explicitly identified work vote.

    Source readers intentionally retain all printings. This layer is a declared
    population choice, shared by all calibration consumers, never a fuzzy-text
    deduplication heuristic. A changed or removed edition refuses re-adoption.
    """
    path = Path(path).resolve()
    try:
        rel = path.relative_to(ROOT).as_posix()
    except ValueError:
        yield from lyric_items(path)  # caller-owned synthetic/research fixture
        return
    declared = {at: entry for (name, at), entry in _edition_policy().items() if name == rel}
    seen = set()
    for title, at, body in lyric_items(path):
        entry = declared.get(at)
        if entry:
            digest = hashlib.sha256("\n".join(row.text for row in body).encode()).hexdigest()
            if title != entry["title"] or digest != entry["body_sha256"]:
                raise ValueError(f"calibration edition drift: {rel}:{at}; review the work identity before re-adoption")
            seen.add(at)
            if entry["weight"] == 0:
                continue
        yield title, at, body
    if seen != set(declared):
        raise ValueError(f"calibration edition disappeared: {rel}:{sorted(set(declared) - seen)}")


def population_fingerprint():
    """Binds the semantics and explicit work choices in corpus adoption."""
    digest = hashlib.sha256()
    for path in (Path(__file__), WORK_EDITIONS):
        digest.update(path.read_bytes())
        digest.update(b"\0")
    # The label-prefix declarations change which words are read as sung, so
    # they bind the population exactly as the edition registry does.
    if LABEL_PREFIXES.exists():
        digest.update(LABEL_PREFIXES.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()
