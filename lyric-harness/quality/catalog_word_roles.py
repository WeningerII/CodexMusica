"""Measure the lexical roles of a submitted word-count stanza using its sung tokens."""
from quality.features import _tagger
from quality.senses import _load as _wordnet


_POS_PREFIX = {"noun": "NN", "first-noun": "NN", "adjectives": "JJ"}


def _pos_reading(words, role):
    basis = "Penn Treebank POS tags over this sung line and WordNet POS readings"
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
    pos = {"ing-verbs": "v", "adjectives": "a"}.get(role, "n")
    wn = _wordnet()
    if wn is None:
        return {**result, "outcome": "unknown", "reason": "WordNet unavailable"}
    try:
        # synsets applies WordNet's POS-specific morphological lookup.
        # The tagger alone can assign NN or VBG to an unseen token.
        if not all(wn.synsets(word.casefold(), pos=pos) for word in words):
            return {**result, "outcome": "unknown", "reason": "missing lexical POS reading"}
    except (LookupError, OSError):
        return {**result, "outcome": "unknown", "reason": "lexical resource unreadable"}
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
        right = wn.lemmas(last.casefold(), pos=wn.NOUN)
        if role == "synonym":
            witnessed = bool({lemma.synset() for lemma in left} & {lemma.synset() for lemma in right})
        else:
            right_keys = {lemma.key() for lemma in right}
            witnessed = any(partner.key() in right_keys for lemma in left for partner in lemma.antonyms())
    except (LookupError, OSError):
        return {**detail, "outcome": "unknown", "reason": "lexical resource unreadable"}
    return ({**detail, "outcome": "pass"} if witnessed else
            {**detail, "outcome": "unknown", "reason": "no lexical witness for these words"})


def _compact_phrase(row):
    basis = "one complete determiner–adjective–noun phrase in the submitted line"
    unknown = {"outcome": "unknown", "basis": basis}
    words = row.get("sungWords")
    text = row.get("text")
    if not words or not 2 <= len(words) <= 4 or not isinstance(text, str):
        return unknown
    # Token streams strip punctuation and stage directions. Refuse to certify
    # a single phrase when the printed material contains an internal break.
    printed = text.strip().rstrip(".?!,").lower().replace("’", "'").split()
    if printed != [w.lower().replace("’", "'") for w in words]:
        return unknown
    try:
        wn = _wordnet()
        tags = [tag for _, tag in _tagger()(words)]
        matched = (wn is not None and len(tags) == len(words) and tags[0] == "DT"
                   and all(t.startswith("JJ") for t in tags[1:-1]) and tags[-1].startswith("NN")
                   and all(wn.synsets(w.casefold(), pos=wn.ADJ) for w in words[1:-1])
                   and bool(wn.synsets(words[-1].casefold(), pos=wn.NOUN)))
    except (ImportError, LookupError, OSError):
        return unknown
    return {"outcome": "pass" if matched else "unknown", "basis": basis}


def _noun_pivot(words, endpoints, relation):
    basis = "each pair of central nouns shares a WordNet noun sense with its corresponding endpoint"
    try:
        wn = _wordnet()
        if wn is not None:
            left, right = [set(wn.synsets(word.casefold(), pos=wn.NOUN)) for word in endpoints]
            central = [set(wn.synsets(word.casefold(), pos=wn.NOUN)) for word in words]
            # Independent pairwise overlaps can pick incompatible senses of one
            # endpoint; intersect all three readings on each side of the pivot.
            a, b = left.intersection(*central[:2]), right.intersection(*central[2:])
            if relation == "synonym":
                linked = bool(a & b)
            else:
                # The pivot and endpoint contrast must use the same lexical
                # senses. Polysemous words on both sides do not prove a turn.
                right_keys = {lemma.key() for lemma in wn.lemmas(endpoints[1].casefold(), pos=wn.NOUN)
                              if lemma.synset() in b - a}
                linked = any(ant.key() in right_keys
                             for lemma in wn.lemmas(endpoints[0].casefold(), pos=wn.NOUN)
                             if lemma.synset() in a - b for ant in lemma.antonyms())
            if linked:
                return {"outcome": "pass", "basis": basis, "comparedLines": [1, 4, 7]}
    except (ImportError, LookupError, OSError):
        pass
    return {"outcome": "unknown", "basis": basis}


def measure_word_roles(result, observations):
    word_lines = {c["address"] for c in result["checks"] if c["kind"] == "word-count"}
    roles = [c for c in result["checks"] if c["kind"] == "role" and c.get("address") in word_lines]
    # Each line of this setting contains exactly one bare phrase unit. A possible
    # linguistic reading is independent of whether a performer needs a breath.
    if result.get("id") == "gogyohka":
        for check in result["checks"]:
            at = check.get("lines", [])
            if (check["kind"] == "unit" and check.get("expected") == "phrase"
                    and len(at) == 1 and 1 <= at[0] <= len(observations)):
                check.update(_compact_phrase(observations[at[0] - 1]))
    elif not roles:
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
        elif role == "phrase" and len(words) == 4:
            check.update(_compact_phrase(observations[index]))
        elif role == "middle-phrase" and index == 3 and len(words) == 4 and len(observations) == 7:
            endpoints = [observations[i].get("sungWords") for i in (0, 6)]
            relation = next((r["expected"] for r in roles if r.get("lines") == [7]
                             and r["expected"] in {"synonym", "antonym"}), None)
            if relation and all(row and len(row) == 1 for row in endpoints):
                check.update(_noun_pivot(words, [row[0] for row in endpoints], relation))
        elif role in {"synonym", "antonym"} and starts_with_noun and index == len(observations) - 1:
            opening = observations[0].get("sungWords")
            if opening and len(opening) == len(words) == 1:
                check.update(_noun_relation(opening[0], words[0], role), comparedLines=[1, index + 1])
    outcomes = {check["outcome"] for check in result["checks"]}
    result["verdict"] = "fail" if "fail" in outcomes else "pass" if outcomes == {"pass"} else "unknown"
