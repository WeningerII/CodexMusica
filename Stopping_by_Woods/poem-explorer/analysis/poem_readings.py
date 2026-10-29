"""Declared pronunciation support for the existing Frost annotation.

Native relation predicates are unchanged. Every stream, including native
any-reading trials, must receive ``normalize_reader(reader)`` in its builder.
"""
from __future__ import annotations

import copy
import hashlib
import json
import os
import sys
from pathlib import Path

HERE = Path(os.environ.get("FROST_ANALYSIS_ROOT", Path(__file__).resolve().parent)).resolve()
SITE = Path(os.environ.get("FROST_SITE_ROOT", HERE.parent / "poem-explorer")).resolve()
HARNESS = HERE / "CodexMusica/lyric-harness"
if str(HARNESS) not in sys.path:
    sys.path.insert(0, str(HARNESS))

import lyric_harness as LH
from quality.phonology.eng import English
from quality import pronunciation as PR

DECLARATION = "frost-pronunciation-realizations-v1"
BEFORE_R = LH.Declaration().nucleus_licence_before_r
ADDITIONS = {
    "of": {
        "phones": "AH0 V".split(),
        "source": "Cambridge US /əv/ in auction of promises; https://dictionary.cambridge.org/us/pronunciation/english/auction-of-promises",
    },
    "promises": {
        "phones": "P R AA1 M IH0 S IH0 Z".split(),
        "source": "Cambridge US /ˈprɑː.mɪsɪz/; https://dictionary.cambridge.org/us/pronunciation/english/auction-of-promises",
    },
    "darkest": {
        "phones": "D AA1 R K IH0 S T".split(),
        "source": "Compositional declaration: CMUdict dark D AA1 R K plus Cambridge US -est /ɪst/; https://dictionary.cambridge.org/pronunciation/english/est",
    },
}
_LEX_CLASSES = {}


def _key(word):
    return LH.fold_apostrophes(word).lower().strip("\"'.,;:!?()[]")


class _SourcedVariants:
    """Add explicitly sourced alternatives without mutating CMU entries."""

    def pronunciation_variants(self, word):
        values = super().pronunciation_variants(word)
        if getattr(self, "_pronunciation_choice", None):
            return values
        extra = ADDITIONS.get(_key(word))
        if extra and extra["phones"] not in values:
            values = [list(p) for p in values] + [list(extra["phones"])]
        return values

    def reading_source(self, word, phones):
        extra = ADDITIONS.get(_key(word))
        if extra and list(phones) == extra["phones"]:
            return extra["source"]
        inherited = getattr(super(), "reading_source", None)
        return inherited(word, phones) if inherited else "cmudict"


def _with_sources(lex):
    if not isinstance(lex, _SourcedVariants):
        result = copy.copy(lex)
        cls = _LEX_CLASSES.setdefault(type(lex), type(
            "FrostSourced" + type(lex).__name__, (_SourcedVariants, type(lex)), {}))
        result.__class__ = cls
    else:
        result = lex
    # Native pin_readings correctly sets non-CMU additions to basis=declared,
    # but its generic search source says dictionary. Keep actual provenance.
    rows = getattr(result, "pronunciations", ())
    corrected = []
    changed = False
    for row in rows:
        extra = ADDITIONS.get(_key(row["word"]))
        if extra and row["phones"] == extra["phones"]:
            updated = {**row, "basis": "declared", "source": extra["source"]}
            changed |= updated != row
            corrected.append(updated)
        else:
            corrected.append(row)
    if changed:
        result = copy.copy(result)
        result.pronunciations = corrected
        # Scope views must be regenerated from the corrected declaration.
        for attr in ("_pronunciation_line", "_pronunciation_tokens", "_pronunciation_choice"):
            result.__dict__.pop(attr, None)
    return result


def _normalize_syllables(syllables):
    """Called only on native lexical parses, before performance demotion."""
    for syllable in syllables:
        if syllable.nucleus == "AH" and syllable.prominence == 0:
            syllable.nucleus = "AH0"
        if syllable.coda and syllable.coda[0] == "R":
            for first, second in BEFORE_R:
                if syllable.nucleus in (first, second):
                    syllable.nucleus = first
                    break
    return syllables


class RealizedEnglish(English):
    def _syllabify_single(self, word):
        return _normalize_syllables(super()._syllabify_single(word))

    def parses(self, word):
        return [_normalize_syllables(p) for p in super().parses(word)]

    def for_line(self, text):
        if self.lexicon is None or not self.lexicon.pronunciations:
            return self
        result = copy.copy(self)
        result.lexicon = self.lexicon.for_line(text)
        return result

    def for_token(self, index):
        if self.lexicon is None or not self.lexicon.pronunciations:
            return self
        result = copy.copy(self)
        result.lexicon = self.lexicon.for_token(index)
        return result

    def declaration(self):
        result = super().declaration()
        result["poem_pronunciation_realization"] = {
            "version": DECLARATION,
            "AH": "AH0 retains schwa; AH1/AH2 retain STRUT. Normalized on lexical parses before function-word prominence demotion.",
            "before_r": "Native LH.Declaration.nucleus_licence_before_r; IH/IY agree only when the syllable coda starts R.",
            "lexical_stress": "Retained separately from the editorial metrical/prominence grid.",
            "additional_readings": ADDITIONS,
        }
        return result


def normalize_reader(reader):
    """Return an idempotently normalized English reader; retain all state."""
    if not isinstance(reader, English):
        raise TypeError("This declaration only applies to the English reader")
    lex = _with_sources(reader._lexicon())
    if isinstance(reader, RealizedEnglish) and lex is reader.lexicon:
        return reader
    result = copy.copy(reader)
    result.__class__ = RealizedEnglish
    result.lexicon = lex
    return result


CONSONANTS = dict(zip(
    "B CH D DH F G HH JH K L M N NG P R S SH T TH V W Y Z ZH".split(),
    "b ch d dh f g h j k l m n ng p r s sh t th v w y z zh".split()))
VOWELS = {"AA": "ah", "AE": "a", "AO": "aw", "AW": "ow", "AY": "eye",
          "EH": "e", "ER": "er", "EY": "ay", "IH": "i", "IY": "ee",
          "OW": "oh", "OY": "oy", "UH": "uu", "UW": "oo"}


def respell(phones):
    """Render CMU vowel realizations; case records lexical prominence."""
    output = []
    for syllable in LH.syllabify(phones):
        nucleus, coda = syllable["nucleus"], list(syllable["coda"])
        if coda[:1] == ["R"] and nucleus in ("AA", "AO", "IH", "IY", "EH"):
            vowel = {"AA": "ahr", "AO": "or", "IH": "eer", "IY": "eer", "EH": "air"}[nucleus]
            coda.pop(0)
        else:
            vowel = ("uh" if syllable["stress"] == 0 else "u") if nucleus == "AH" else VOWELS[nucleus]
        text = "".join(CONSONANTS[p] for p in syllable["onset"]) + vowel + "".join(CONSONANTS[p] for p in coda)
        output.append(text.upper() if syllable["stress"] else text)
    return "-".join(output)


def _annotations(poem):
    path = SITE / "dist/data.js"
    raw = path.read_text()
    data = json.JSONDecoder().raw_decode(raw.split("window.POEM_DATA=", 1)[1])[0]
    if [line["text"] for line in data["lines"]] != list(poem):
        raise ValueError("The requested poem differs from the existing annotation")
    return data


def annotated_manifest(base, poem):
    """Resolve all occurrences, retaining mismatches instead of guessing."""
    data = _annotations(poem)
    lex = normalize_reader(base)._lexicon()
    rows, unresolved, ambiguous = [], [], []
    for occurrence, ((word, line, token), target) in enumerate(
            zip(data["tokens"], data["tokenPronunciations"]), 1):
        variants = lex.pronunciation_variants(word)
        target_quality = target.lower().replace("-", "")
        matching = [p for p in variants if respell(p).lower().replace("-", "") == target_quality]
        target_stress = [part.isupper() for part in target.split("-")]
        if matching:
            def difference(phones):
                stresses = [s["stress"] in (1, 2) for s in LH.syllabify(phones)]
                return sum(a != b for a, b in zip(target_stress, stresses)) + abs(len(target_stress) - len(stresses))
            best = min(map(difference, matching))
            matching = [p for p in matching if difference(p) == best]
        matching = list(dict.fromkeys(tuple(p) for p in matching))
        if len(matching) != 1:
            detail = {"id": occurrence, "line": line, "token": token, "word": word,
                      "annotation": target, "options": [[p, respell(p)] for p in variants]}
            (ambiguous if matching else unresolved).append(detail)
            continue
        phones = list(matching[0])
        extra = ADDITIONS.get(_key(word))
        source = extra["source"] if extra and phones == extra["phones"] else "CMUdict; selected to match the existing annotated vowel/consonant quality"
        rows.append([occurrence, line, token, word, target, phones, source])
    return {"format": DECLARATION, "columns": ["id", "line", "token", "word", "annotation", "phones", "source"],
            "selection": "Match existing respelling quality first; among supported matches prefer annotated prominence. Preserve native lexical stress when no exact prominence choice exists. No dictionary-first tie break.",
            "editorial_grid": "The original four-foot grid is retained; its prominence is not substituted for lexical vowel quality.",
            "annotation_sha256": hashlib.sha256(json.dumps(data["tokenPronunciations"], ensure_ascii=False).encode()).hexdigest(),
            "source_readings": ADDITIONS, "rows": rows, "unresolved": unresolved, "ambiguous": ambiguous}


def annotated_phonology(base, poem):
    manifest = annotated_manifest(base, poem)
    if manifest["unresolved"] or manifest["ambiguous"]:
        raise ValueError("Annotated pronunciation unresolved: " + json.dumps(
            {key: manifest[key] for key in ("unresolved", "ambiguous")}, ensure_ascii=False))
    reader = normalize_reader(base)
    occurrences = [(poem[line-1], token, word, phones)
                   for _, line, token, word, _, phones, _ in manifest["rows"]]
    pinned = PR.pin_readings(reader._lexicon(), occurrences,
                             "Selected to match the existing Frost annotated pronunciation; lexical stress retained")
    if pinned is None:
        raise ValueError("Native occurrence-declaration validation refused the annotated readings")
    result = copy.copy(reader)
    result.lexicon = _with_sources(pinned)
    result.poem_annotated_manifest = manifest
    return result


def _main():
    data = json.JSONDecoder().raw_decode((SITE / "dist/data.js").read_text().split("window.POEM_DATA=", 1)[1])[0]
    poem = [line["text"] for line in data["lines"]]
    base = English(readings="all", lexicon=LH.Lexicon(reader_scheme="v2"), reader_scheme="v2")
    manifest = annotated_manifest(base, poem)
    path = HERE / "annotated_readings.json"
    path.write_text(json.dumps(manifest, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(json.dumps({"path": str(path), "selected": len(manifest["rows"]),
                      "unresolved": manifest["unresolved"], "ambiguous": manifest["ambiguous"]}, ensure_ascii=False))


if __name__ == "__main__":
    _main()
