"""What a declared relation needs from the ONE word a brief is searching for,
read off that relation's own definition.

WHY THIS EXISTS (2026-09-28). When the screened menu for a place comes back
empty under a declared relation, `Reviser.brief` widens the search to the
whole lexicon and puts every word through the exact grade
(`Reviser.declared_offer`). That is 39,423 trial grades, about a minute per
place, and on a relation few words satisfy it finds nothing only after
looking at everything. The owner's ruling: no limit on that search; make it
fast instead, and do it for EVERY relation a mandate can declare. A name is
never treated as unusable to buy speed.

WHAT A PREDICATE HERE MAY SAY. Only "this word CANNOT stand in the relation
with that partner". The verdict on every word that is kept is still the full
grade. Each requirement is a NECESSARY condition derived from the judge's own
definition, so it can never remove a word the grade would accept. Where no
such condition can be derived — a judge that reads other words of the line,
spelling, meaning or a graded similarity, or a predicate that can pass on
empty material — the requirement is None and the search skips nothing.

THE THREE JUDGES `Reviser.grade` routes a declared relation to:

  type:    `rhyme_types.satisfies_relation` -> `classify_pair`, which compares
           the two slot words' own syllables channel by channel with plain
           equality (`_cmp`). A name holds only where some registration's
           agreement cells are met, and a cell's agreeing channels must agree
           on SOME syllable pair. English declares no relation of its own
           (`English.relation`), so the phonology never overrides this.
  schema:  `relations.evaluate` over the members' spans. An exact `Agree` on
           onset / nucleus / coda at a scope that always reads a position
           must hold on some unit pair. Only schemas whose two members are
           confined to one token (no cross-word, searched or frame-edge span).
  class:   `lyric_harness.score` types a pair from `channel_agreement`, which
           aligns from the tail and takes the weakest aligned syllable, and
           every span `best_score` tries ends at the line's end. So the two
           end words' own LAST syllables must pass the same predicate at the
           same cut (`COARSE_NEEDS`); the judge is called on them directly,
           so a licensed vowel or a graded coda is judged exactly as the
           grade judges it. The same test serves a BARE group whose schema
           route is closed: it is judged at the admit door, so one admitted
           relation's requirement must hold. Only on the default end slots,
           where the line's last syllable is the end word's.

A WORD IS NEVER FILTERED when it is not purely alphabetic or the phonology
holds no syllables for it: the stream then splits or drops the token, the
line's final token becomes a different word, and the judge may well accept
that word. Those words go to the full grade like any other.

Channel values are the phonology's MERGED readings (`merge_readings`): a
channel the readings disagree on is a `Readings` set, and `_cmp` / `Agree`
can only answer True when two values are equal, which for two sets means
they share every element. Testing for a shared element is therefore implied
by every True either judge can return.
"""

from quality import relations as RL
from quality import rhyme_types as RT

#: The order of a `classify_pair` agreement cell.
CHANNELS = ("onset", "nucleus", "coda")

#: Scopes `relations._positions` answers with at least one position whenever
#: both member spans are non-empty and the alignment pairs anything.
_SCOPES_WITH_A_READ = ("each", "first", "last")

#: Aligners whose pair list is non-empty for two non-empty spans.
_PAIRING_ALIGNERS = ("anchor", "flush_left", "flush_right")


def _ks(v):
    """A channel value as its knowledge set."""
    return v if isinstance(v, frozenset) else frozenset((v,))


def _cluster(v):
    """The value `relations._rd_onset` / `_rd_coda` hand a predicate."""
    if isinstance(v, frozenset):
        return tuple(next(iter(v))) if len(v) == 1 else v
    return tuple(v)


def syllable_sets(syllables):
    """-> per-syllable (onset, nucleus, coda) knowledge sets, as the channel
    readers present them."""
    return tuple((_ks(_cluster(s.onset)), _ks(s.nucleus), _ks(_cluster(s.coda)))
                 for s in syllables)


def word_sets(phon, word):
    """-> the syllable sets `phon` reads for `word`, or None when the word
    must not be filtered (see the module docstring). Memoised on `phon`."""
    if not word or not word.isalpha():
        return None
    cache = phon.__dict__.setdefault("_relation_index_sets", {})
    key = word.lower()
    if key in cache:
        return cache[key]
    try:
        sy = phon.syllabify(key)
    except Exception:
        sy = []
    out = syllable_sets(sy) if sy else None
    cache[key] = out
    return out


def meets(cells, sw, sp):
    """Does every cell find one syllable pair (one of `sw`, one of `sp`)
    sharing a value on each of its channels?"""
    for cell in cells:
        if not any(all(a[c] & b[c] for c in cell) for a in sw for b in sp):
            return False
    return True


def type_requirement(canon, position):
    """-> the agreement a NAMED relation needs, from its registrations.

    None     no requirement can be derived: skip nothing.
    ()       `satisfies_relation` can never answer True for this name at this
             position (no phonetic registration there), so no word passes.
    tuple    ALTERNATIVES, one per registration that names `canon`, each a
             tuple of cells (channel-index sets); a pair must meet every cell
             of at least one alternative.

    EVERY registration naming `canon` is an alternative, not only the ones
    the outer loop classifies at: `names()` answers over all of NAMED, so a
    name can be reached through another key that carries it. A superset of
    alternatives only ever keeps more words.
    """
    eligible = False
    alts = []
    for key, val in RT.NAMED.items():
        names = val if isinstance(val, (list, tuple, set, frozenset)) else (val,)
        if canon not in names:
            continue
        if key[6] == "phonetic" and (key[3] is None or key[3] == position):
            eligible = True
        if "agreement" in RT.FREE.get(key, ()):
            return None
        cells = tuple(frozenset(i for i, r in enumerate(cell) if r)
                      for cell in key[0])
        req = tuple(c for c in cells if c)
        if not req:
            # An all-zero registration names nothing (`_agreement_satisfies`).
            continue
        alts.append(req)
    if not eligible:
        return ()
    return tuple(alts)


def _confined(rule):
    """Is a member span built from this rule confined to ONE token?"""
    return not (rule.cross_word or rule.anchor == "searched"
                or rule.magnitude == "to_frame_edge")


def schema_requirement(schema, route):
    """-> the cells a SCHEMA needs, or None.

    `route` is how `Reviser.grade` judges the pair:
      "default"  both slots at the line end — `line_pairs_for`, members at
                 the schema's own loci, so both loci must be the final token.
      "token"    a declared single-token slot — `pair_satisfies`, members
                 built from the declared token's units by the schema's rules.

    Only required, phonemic, exact `Agree` channel rules contribute (`type(p)
    is Agree`: `PrefixAgree` passes on an empty cluster). Under the anchor
    aligner the anchor pair is compared on every `anchor` and `each` channel,
    so those channels form one joint cell; `first` / `last` channels are
    cells of their own.
    """
    rules = (schema.spans[0], schema.spans[-1])
    if not all(_confined(r) for r in rules):
        return None
    if route == "default" and not all(r.locus == "line_final_token"
                                      for r in rules):
        return None
    anchor_cell, each_cell, singles = set(), set(), []
    for cr in schema.channels:
        if not cr.required or cr.surface != "phonemic":
            continue
        if type(cr.predicate) is not RL.Agree or cr.channel not in CHANNELS:
            continue
        ci = CHANNELS.index(cr.channel)
        if cr.scope == "anchor":
            anchor_cell.add(ci)
        elif (cr.scope in _SCOPES_WITH_A_READ
              and schema.align in _PAIRING_ALIGNERS):
            if cr.scope == "each":
                each_cell.add(ci)
            else:
                singles.append(frozenset((ci,)))
    cells = []
    if schema.align == "anchor":
        joint = anchor_cell | each_cell
        if joint:
            cells.append(frozenset(joint))
    else:
        cells.extend(frozenset(c) for c in (anchor_cell, each_cell) if c)
    cells.extend(singles)
    return tuple(cells) or None


#: What each coarse relation needs of the two lines' LAST syllables, read off
#: `lyric_harness.score`: RHYME and PROMOTED_RHYME need `channel_agreement`'s
#: nucleus AND coda under the conjunctive band, ASSONANCE its nucleus,
#: CONSONANCE its coda, RIME_RICHE `full_identity` (equal nucleus and coda).
#: `channel_agreement` aligns from the TAIL and takes the weakest aligned
#: syllable, so the last pair must pass whatever else is compared; and every
#: span `best_score` tries ends at the line's end, so that pair is always the
#: two end words' own last vowels and final consonants.
COARSE_NEEDS = {"RHYME": ("nucleus", "coda"),
                "PROMOTED_RHYME": ("nucleus", "coda"),
                "ASSONANCE": ("nucleus",),
                "CONSONANCE": ("coda",),
                "RIME_RICHE": ("identity",)}


def class_requirement(canon, conj):
    """-> what a coarse relation needs of the last syllables, or None.
    `conj` is `score()`'s own conjunctive-band switch for this call."""
    need = COARSE_NEEDS.get(canon)
    if need is None:
        return None
    if canon in ("RHYME", "PROMOTED_RHYME") and not conj:
        return None
    return need


def door_requirement(admit, conj):
    """-> alternatives for a bare group judged at the admit door (at least
    one admitted relation must hold), or None when one of them has no
    requirement."""
    alts = []
    for r in admit:
        need = class_requirement(r, conj)
        if need is None:
            return None
        alts.append(need)
    return tuple(alts) or None


def last_syllables(lex, word):
    """-> the LAST syllable, as `lyric_harness.syllabify` builds it, of every
    reading `line_anchors` can take for `word` at a line end, or None (do not
    filter: no dictionary reading, so the line end is read some other way)."""
    import lyric_harness as LH
    if not word:
        return None
    key = LH.fold_apostrophes(word).lower().strip("'\".,;:!?()[]")
    if not key.isalpha():
        return None
    variants = (lex.pronunciation_variants(key)
                if hasattr(lex, "pronunciation_variants")
                else lex.entries.get(key, []))
    out = []
    for v in variants or ():
        sy = LH.syllabify(list(v))
        if sy:
            out.append(sy[-1])
    return out or None


def coarse_meets(alts, lw, lp, decl):
    """Does some reading pair's last syllables meet one alternative?

    Stress is set to 0 on both sides before `channel_agreement` is asked:
    the one stress-dependent rule (`nucleus_licence_unstressed_only`) is
    most permissive there, and a weak end word is demoted to 0 in the line
    anyway."""
    import lyric_harness as LH
    for a in lw:
        for b in lp:
            a0, b0 = dict(a, stress=0), dict(b, stress=0)
            nuc = coda = None
            for need in alts:
                if "identity" in need:
                    if (a["nucleus"] == b["nucleus"]
                            and list(a["coda"]) == list(b["coda"])):
                        return True
                    continue
                if nuc is None:
                    nuc, coda = LH.channel_agreement([a0], [b0], decl)
                if ("nucleus" not in need or nuc) and ("coda" not in need or coda):
                    return True
    return False
