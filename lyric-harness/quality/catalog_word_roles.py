"""Measure the lexical roles of a submitted word-count stanza using its sung tokens."""
from quality.features import _tagger
from quality.senses import _load as _wordnet


_POS_PREFIX = {"noun": "NN", "first-noun": "NN", "adjectives": "JJ"}


def _pos_reading(words, role):
    basis = "Penn Treebank POS tags over this sung line"
    if role == "ing-verbs":
        basis += " and printed -ing ending"
        if any(not word.casefold().endswith("ing") for word in words):
            return {"outcome": "fail", "basis": basis}
    try:
        tags = [tag for _, tag in _tagger()(words)]
    except (ImportError, LookupError, OSError):
        return {"outcome": "unknown", "basis": basis, "reason": "POS resource unavailable"}
    if len(tags) != len(words):
        return {"outcome": "unknown", "basis": basis}
    matched = (all(tag == "VBG" for tag in tags) if role == "ing-verbs"
               else all(tag.startswith(_POS_PREFIX[role]) for tag in tags))
    # An isolated list supplies little syntactic context. A different best tag
    # need not rule out the requested reading of an ambiguous word.
    result = {"outcome": "pass" if matched else "unknown", "basis": basis, "tags": tags}
    if not matched:
        result["reason"] = "the line tagger did not confirm the requested reading"
    return result


def _noun_relation(first, last, role):
    """A dictionary witness establishes one possible reading of the isolated nouns."""
    basis = ("shared WordNet noun synset" if role == "synonym"
             else "WordNet antonymy between the two noun lemmas")
    detail = {"basis": basis, "scope": "possible English lexical reading"}
    if role == "synonym" and first.casefold() == last.casefold():
        return {**detail, "outcome": "fail", "reason": "same spelling at both positions"}
    wn = _wordnet()
    if wn is None:
        return {**detail, "outcome": "unknown", "reason": "WordNet unavailable"}
    try:
        # Lookup lemmas for the submitted words. An antonym attached to another
        # lemma in the same synset does not establish this lexical relation.
        left = wn.lemmas(first.casefold(), pos=wn.NOUN)
        right = set(wn.lemmas(last.casefold(), pos=wn.NOUN))
        if role == "synonym":
            witnessed = bool({lemma.synset() for lemma in left} & {lemma.synset() for lemma in right})
        else:
            witnessed = any(partner in right for lemma in left for partner in lemma.antonyms())
    except (LookupError, OSError):
        return {**detail, "outcome": "unknown", "reason": "lexical resource unreadable"}
    return ({**detail, "outcome": "pass"} if witnessed else
            {**detail, "outcome": "unknown", "reason": "no lexical witness for these words"})


def measure_word_roles(result, observations):
    word_lines = {c["address"] for c in result["checks"] if c["kind"] == "word-count"}
    roles = [c for c in result["checks"] if c["kind"] == "role" and c.get("address") in word_lines]
    if not roles:
        return
    starts_with_noun = any(c.get("lines") == [1] and c["expected"] in {"first-noun", "noun"}
                           for c in roles)
    for check in roles:
        line_numbers = check.get("lines", [])
        if len(line_numbers) != 1:
            continue
        index = line_numbers[0] - 1
        if not 0 <= index < len(observations):
            continue
        words = observations[index].get("sungWords")
        if not words:
            continue
        role = check["expected"]
        if role in _POS_PREFIX or role == "ing-verbs":
            check.update(_pos_reading(words, role))
        elif role in {"synonym", "antonym"} and starts_with_noun and index == len(observations) - 1:
            opening = observations[0].get("sungWords")
            if opening and len(opening) == len(words) == 1:
                check.update(_noun_relation(opening[0], words[0], role), comparedLines=[1, index + 1])
    outcomes = {check["outcome"] for check in result["checks"]}
    result["verdict"] = "fail" if "fail" in outcomes else "pass" if outcomes == {"pass"} else "unknown"
