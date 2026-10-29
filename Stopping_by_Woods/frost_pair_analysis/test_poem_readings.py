"""Bounded regression checks for the observed pronunciation failures."""
import json

import poem_readings as P
from quality import relations as R
from quality.phonology.eng import English


def main():
    app = P.SITE / "dist/data.js"
    data = json.JSONDecoder().raw_decode(app.read_text().split("window.POEM_DATA=", 1)[1])[0]
    poem = [line["text"] for line in data["lines"]]
    lex = P.LH.Lexicon(reader_scheme="v2")
    before = {w: [list(p) for p in lex.entries[w]] for w in P.ADDITIONS}
    base = English(readings="all", lexicon=lex, reader_scheme="v2")
    normalized = P.normalize_reader(base)
    assert P.normalize_reader(normalized) is normalized
    for word, extra in P.ADDITIONS.items():
        assert extra["phones"] in normalized.lexicon.pronunciation_variants(word)
        assert lex.entries[word] == before[word]
        assert all(p in normalized.lexicon.pronunciation_variants(word) for p in before[word])

    manifest = P.annotated_manifest(base, poem)
    assert len(manifest["rows"]) == 108
    assert not manifest["ambiguous"] and not manifest["unresolved"]
    pinned = P.annotated_phonology(base, poem)
    def build(reader):
        return R.build_stream(poem, P.normalize_reader(reader))
    fixed = build(pinned)
    assert len(fixed.units) == 128 and not fixed.unreadable
    assert all(len(fixed.lines[i]) == 8 for i in range(16))
    assert [x["text"] for x in data["lines"]] == poem
    for row in pinned.lexicon.pronunciations:
        if row["word"].lower() in P.ADDITIONS and row["phones"] == P.ADDITIONS[row["word"].lower()]["phones"]:
            assert row["basis"] == "declared" and "Cambridge" in row["source"]

    def answer(stream, name, a, b):
        return R.pair_satisfies(R.REGISTRY[name], stream, a, b)
    assert answer(fixed, "assonance", (3, 0), (3, 5)) is False  # To / up
    assert answer(fixed, "additive rhyme", (3, 0), (3, 5)) is False
    assert answer(fixed, "assonance", (1, 4), (2, 3)) is False  # the / see
    assert answer(fixed, "family rhyme", (1, 4), (2, 3)) is False
    assert answer(fixed, "perfect rhyme", (2, 6), (4, 6)) is True  # here / queer

    full = build(base)
    found, witness = R.pair_satisfies_any(R.REGISTRY["assonance"], full, (1, 4), (2, 3), R.cached_builder(build))
    assert found is True and "the = DH IY0" in witness
    found, witness = R.pair_satisfies_any(R.REGISTRY["assonance"], full, (3, 0), (3, 5), R.cached_builder(build))
    assert found is False

    # A native any-reading trial instantiates base English. The builder must
    # restore the declaration, without rewriting its raw witness phones.
    combo = {(3, 0): (1, "To", ["T", "AH0"]), (3, 5): (6, "up", ["AH1", "P"])}
    trial = R.pinned_phonology(full, combo)
    assert type(trial) is English
    rebuilt = build(trial)
    assert isinstance(rebuilt.phon, P.RealizedEnglish)
    assert answer(rebuilt, "assonance", (3, 0), (3, 5)) is False
    assert R.reading_witness(combo) == ["To = T AH0", "up = AH1 P"]

    # A lexically full STRUT vowel stays full in an unstressed metrical slot.
    # The relation stream retains lexical prominence; the poem grid is a
    # separate editorial delivery surface.
    reduced = R.build_stream(["up in"], normalized)
    assert reduced.units[0].syl.nucleus == "AH"
    print(json.dumps({"status": "passed", "annotated_occurrences": 108,
                      "syllables": 128, "unresolved": 0,
                      "checks": ["unchanged CMU alternatives", "sourced additions", "AH0/STRUT separation",
                                 "conditional the/see", "here/queer", "native trial wrapping", "grid preservation"]}))


if __name__ == "__main__":
    main()
