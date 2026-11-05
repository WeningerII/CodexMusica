"""Supplied-reading, single-family verse candidates (#677 Stage 3).

This pure module does not read text, choose pronunciations, alter stress or
claim a unique meter. It is not wired into any production verb. Input vectors
are whole correlated readings supplied by the caller; no cartesian product is
taken. Musical timing and quantitative syllable weight are not inputs.

Interface: #677 comments 6642873705 and 6642828841, with amendments
6642971751 (counts/prefixes), 6643037958 (policy order/representation), and
6643123630 (explicit unsearched scope).
Policy source acceptance:
6642871642 (endings); 6642887791 leaves initial truncation unsupported.
"""

from itertools import combinations
from typing import NotRequired, TypedDict


class Token(TypedDict):
    index: int
    word: str


class Occurrence(TypedDict):
    token: int
    digits: str | None
    lexical: str | None
    source: str
    reading_id: str | None


class Reading(TypedDict):
    id: str
    occurrences: list[Occurrence]


class LineInput(TypedDict):
    text: str
    language: str
    theory: NotRequired[str]
    tokens: list[Token]
    readings: list[Reading]


# Ordered registries. Caller-supplied subsets preserve their declared order.
FAMILIES = {
    "iambic": "WS",
    "trochaic": "SW",
    "anapestic": "WWS",
    "dactylic": "SWW",
    "amphibrachic": "WSW",
}
POLICY_REGISTRY = {
    "initial_inversion": {"status": "admitted", "source": 6642873705},
    "final_catalexis": {"status": "admitted", "source": 6642871642},
    "extra_final_weak": {"status": "admitted", "source": 6642871642},
    "initial_truncation": {"status": "unsupported", "source": None},
}
_FAMILY_PATTERNS = tuple(FAMILIES.items())
_POLICY_NAMES = tuple(POLICY_REGISTRY)
_SOURCES = ("dictionary", "rule", "guessed", "declared", "unknown")
BASIS = (
    "post-demotion lexical stress per supplied reading; 0=W, 1 and 2=S; "
    "one syllable per position; no contextual prominence; line only"
)
SCOPE = "modern English accentual-syllabic, single-family lines"
NOT_SEARCHED = (
    "mixed-foot composition", "medial substitution", "resolution", "synizesis",
    "outrides", "rove-over", "anacrusis", "stanza and printed-line structure",
)


def _result(readings, max_readings):
    return {
        "schema": "meter_recognize.v1",
        "status": "no_candidate_in_searched_space",
        "unsupported_reason": None,
        "candidates": [],
        "requires_unsupported_policy": [],
        "prefix_agreeing": [],
        "excluded_by_reading": [],
        "search": {"readings_supplied": len(readings), "readings_examined": 0,
                   "max_readings": max_readings, "complete": False},
        "basis": BASIS,
        "scope": SCOPE,
        "not_searched": list(NOT_SEARCHED),
    }


def _registries(families, policies):
    """Snapshot caller data without mutating it or admitting a new grammar."""
    if not isinstance(families, dict) or not isinstance(policies, dict):
        raise ValueError("families and policies must be ordered mappings")
    for name, foot in families.items():
        if (name, foot) not in _FAMILY_PATTERNS:
            raise ValueError(f"unsupported family definition: {name!r}")
    for name, row in policies.items():
        if name not in _POLICY_NAMES or not isinstance(row, dict):
            raise ValueError(f"unsupported policy definition: {name!r}")
        if row.get("status") not in ("admitted", "unsupported"):
            raise ValueError(f"invalid policy status for {name!r}")
        source = row.get("source")
        if source is not None and (type(source) is not int or source <= 0):
            raise ValueError("policy source must be a comment id or None")
        if row["status"] == "admitted" and source is None:
            raise ValueError("an admitted policy needs its source acceptance id")
    return tuple(families.items()), {
        name: {"status": row["status"], "source": row.get("source")}
        for name, row in policies.items()
    }


def _validate_line(line):
    if not isinstance(line, dict) or not isinstance(line.get("text"), str):
        raise ValueError("line must contain the exact text string")
    if not isinstance(line.get("language"), str):
        raise ValueError("line must declare its language")
    if not isinstance(line.get("readings"), list):
        raise ValueError("readings must be an ordered list of whole vectors")


def _validate_vectors(line):
    tokens = line.get("tokens")
    if not isinstance(tokens, list):
        raise ValueError("tokens must be an ordered list")
    indices = []
    for i, token in enumerate(tokens, 1):
        if (not isinstance(token, dict) or type(token.get("index")) is not int
                or token["index"] != i or not isinstance(token.get("word"), str)):
            raise ValueError("tokens need consecutive one-based indices and words")
        indices.append(i)
    seen = set()
    for vector in line["readings"]:
        if (not isinstance(vector, dict) or not isinstance(vector.get("id"), str)
                or not vector["id"] or vector["id"] in seen):
            raise ValueError("each reading needs a unique nonempty id")
        seen.add(vector["id"])
        occurrences = vector.get("occurrences")
        if not isinstance(occurrences, list) or len(occurrences) != len(indices):
            raise ValueError("a whole vector needs one occurrence per token")
        for token, occurrence in zip(indices, occurrences):
            if (not isinstance(occurrence, dict)
                    or type(occurrence.get("token")) is not int
                    or occurrence["token"] != token):
                raise ValueError("occurrences must follow the token order")
            source = occurrence.get("source")
            if source not in _SOURCES:
                raise ValueError("occurrence source is not supported")
            digits, lexical = occurrence.get("digits"), occurrence.get("lexical")
            if source == "unknown":
                if digits is not None:
                    raise ValueError("an unknown occurrence must have null digits")
            elif (not isinstance(digits, str) or not digits
                  or any(d not in "012" for d in digits)):
                raise ValueError("known occurrences need nonempty 0/1/2 digits")
            if lexical is not None and (not isinstance(lexical, str)
                                        or any(d not in "012" for d in lexical)):
                raise ValueError("lexical digits must be 0/1/2 or null")
            rid = occurrence.get("reading_id")
            if rid is not None and (not isinstance(rid, str) or not rid):
                raise ValueError("reading_id must be a nonempty string or null")
            if source == "declared" and rid is None:
                raise ValueError("a declared occurrence needs its declaration id")


def _prefix(vector):
    digits, token_ids, conditions = [], [], []
    unknown = None
    for occurrence in vector["occurrences"]:
        if occurrence["source"] == "unknown":
            unknown = occurrence["token"]
            break
        digits.extend(occurrence["digits"])
        token_ids.extend([occurrence["token"]] * len(occurrence["digits"]))
        if occurrence["source"] == "guessed":
            conditions.append(f"guessed: token {occurrence['token']}")
        elif occurrence["source"] == "declared":
            conditions.append(f"declared: {occurrence['reading_id']}")
    return "".join(digits), token_ids, conditions, unknown


def _count_domain(syllables, foot_length):
    """Spec amendment 1: one addition or two removals; no fixed foot cap."""
    low = max(1, (syllables - 1 + foot_length - 1) // foot_length)
    high = (syllables + 2) // foot_length
    return range(low, high + 1)


def _differences(digits, token_ids, template):
    """meter_strict.compare's binary positional comparison, source digit kept."""
    out = []
    for i, (digit, expected) in enumerate(zip(digits, template), 1):
        actual = "W" if digit == "0" else "S"
        if actual != expected:
            out.append({"position": i, "expected": expected, "digit": digit,
                        "token": token_ids[i - 1]})
    return out


def recognize(line: LineInput, *, families=FAMILIES, policies=POLICY_REGISTRY,
              max_readings: int = 64) -> dict:
    """Return unranked compatible candidates in the declared searched space.

    No input object is changed. Invalid input raises ValueError; unsupported
    language/theory returns a refusal without examining a reading. Alternative
    order belongs to the caller and the cap counts whole vectors, not words.
    """
    if type(max_readings) is not int or max_readings < 0:
        raise ValueError('max_readings must be a nonnegative integer')
    _validate_line(line)
    out = _result(line['readings'], max_readings)
    if line['language'] != 'eng':
        out.update(status='unsupported', unsupported_reason=(
            f"language {line['language']!r} is outside modern English scope"))
        return out
    theory = line.get('theory', 'accentual-syllabic')
    if theory != 'accentual-syllabic':
        out.update(status='unsupported', unsupported_reason=(
            f'theory {theory!r} is outside accentual-syllabic scope'))
        return out
    family_rows, policy_rows = _registries(families, policies)
    _validate_vectors(line)
    unresolved_prefix = False
    for vector in line['readings'][:max_readings]:
        out['search']['readings_examined'] += 1
        digits, token_ids, conditions, unknown = _prefix(vector)
        if unknown is not None:
            if not digits:
                unresolved_prefix = True
                out['not_computed_reason'] = (
                    'no reliable prefix: alignment stops before token 1')
                continue
            unresolved_prefix |= _unknown_attempts(
                out, vector['id'], digits, token_ids, conditions, unknown,
                family_rows, policy_rows)
        else:
            _known_attempts(out, vector['id'], digits, token_ids, conditions,
                            family_rows, policy_rows)
    out['search']['complete'] = (
        out['search']['readings_examined'] == len(line['readings']))
    if not out['search']['readings_examined']:
        out.update(status='not_computed', not_computed_reason='no reading examined')
    elif out['candidates']:
        out['status'] = 'candidates'
    elif unresolved_prefix or out['prefix_agreeing']:
        out['status'] = 'not_computed'
    return out


_START_POLICIES = ('initial_inversion', 'initial_truncation')
_END_POLICIES = ('final_catalexis', 'extra_final_weak')


def _choices(policies, *, prefix=False):
    """Canonical subsets: size then start/end order, independent of map order."""
    names = _START_POLICIES if prefix else _START_POLICIES + _END_POLICIES
    names = tuple(name for name in names if name in policies)
    for size in range(len(names) + 1):
        for subset in combinations(names, size):
            if sum(p in _START_POLICIES for p in subset) > 1:
                continue
            if sum(p in _END_POLICIES for p in subset) > 1:
                continue
            yield subset


def _transform(foot, feet, used):
    """Amendment 2: original eligibility; start then end; retain every mark."""
    original = foot * feet
    if ('initial_inversion' in used and not original.startswith('WS')
            or 'initial_truncation' in used and not original.startswith('W')
            or 'final_catalexis' in used and not original.endswith('W')
            or 'extra_final_weak' in used and not original.endswith('S')):
        return None
    marks = list(original)
    surface = list(original)
    if 'initial_inversion' in used:
        surface[:2] = ['S', 'W']
        marks[:2] = ['S', 'W']
    elif 'initial_truncation' in used:
        del surface[0]
        marks[0] = '(' + marks[0] + ')'
    if 'final_catalexis' in used:
        del surface[-1]
        marks[-1] = '(' + marks[-1] + ')'
    elif 'extra_final_weak' in used:
        surface.append('W')
    if not surface:
        return None
    segmentation = '|'.join(''.join(marks[i:i + len(foot)])
                            for i in range(0, len(marks), len(foot)))
    if 'extra_final_weak' in used:
        segmentation += '+W'
    return original, ''.join(surface), segmentation


def _evidence(reading_id, family, feet, original, surface, segmentation,
              used, conditions, policies):
    return {'family': family, 'feet': feet, 'template': original,
            'surface': surface, 'segmentation': segmentation,
            'policies_used': list(used), 'reading_id': reading_id,
            'conditional_on': list(conditions), 'positions_compared': len(surface),
            'policy_status': {p: policies[p]['status'] for p in used},
            'policy_sources': {p: policies[p]['source'] for p in used}}


def _known_attempts(out, reading_id, digits, tokens, conditions, families, policies):
    for family, foot in families:
        for feet in _count_domain(len(digits), len(foot)):
            for used in _choices(policies):
                transformed = _transform(foot, feet, used)
                if transformed is None:
                    continue
                original, surface, segmentation = transformed
                if len(surface) != len(digits):
                    continue
                row = _evidence(reading_id, family, feet, original, surface,
                                segmentation, used, conditions, policies)
                differences = _differences(digits, tokens, surface)
                if differences:
                    row['differences'] = differences
                    out['excluded_by_reading'].append(row)
                elif any(policies[p]['status'] == 'unsupported' for p in used):
                    out['requires_unsupported_policy'].append(row)
                else:
                    out['candidates'].append(row)


def _unknown_attempts(out, reading_id, digits, tokens, conditions, unknown,
                      families, policies):
    """Compare an infinite family prefix, never infer a full-line foot count."""
    unresolved = False
    for family, foot in families:
        # Only materialize enough for p symbols after one initial removal.
        # This internal repetition count is NOT a proposed line length.
        repetitions = (len(digits) + 1 + len(foot) - 1) // len(foot)
        for used in _choices(policies, prefix=True):
            transformed = _transform(foot, repetitions, used)
            if transformed is None:
                continue
            surface = transformed[1][:len(digits)]
            row = _evidence(reading_id, family, None, None, surface, None,
                            used, conditions, policies)
            row['not_compared_after_token'] = unknown
            row['unread_from_token'] = unknown
            differences = _differences(digits, tokens, surface)
            if differences:
                row['differences'] = differences
                out['excluded_by_reading'].append(row)
            else:
                unresolved = True
                if any(policies[p]['status'] == 'unsupported' for p in used):
                    out['requires_unsupported_policy'].append(row)
                else:
                    out['prefix_agreeing'].append(row)
    return unresolved
