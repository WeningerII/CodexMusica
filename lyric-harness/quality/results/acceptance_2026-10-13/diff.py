"""Acceptance diff: two `record.py` runs joined by line id, every change
classified WORD BY WORD, attributed to a mechanism by the shape of the word
that changed, and set against the PROJECTION in the scope receipt's
`shape_sweep.json`.

    python3 quality/results/acceptance_2026-10-13/diff.py BEFORE.jsonl.gz AFTER.jsonl.gz OUT.json [--mechanisms=item6,M1,M2a,M2b] [--summary]

`--summary` writes counts and the cross-tab only, without ids or detail.

`--mechanisms` names what the AFTER head implements (cumulative over R2's
commit series; default all): item6, M1, M2a, M2b and dash (alias tokenizer:
the cut at `--` and edge hyphens, projected as every base line with such a
token). A change attributed to a mechanism outside
that list is reported as such, never credited to the projection.

HOW WORDS ARE COMPARED. Each side's tokens are cut by the dash rule (split at
`-{2,}`, edge hyphens off) into words, each tied to its token. A word is
refused when its token's own `transcribe` OOV list names the word or any of
its hyphen pieces, so a refusal reported as a piece before and as the whole
word after is the SAME refusal. The two word lists are aligned with difflib on
case- and apostrophe-folded spellings; a word present on one side only (a digit
that became a token) is reported as added or removed, with its status.

MECHANISM BY SHAPE (of the word, and of the token it came from before):
  M1     the word carries a digit
  item6  a true hyphen between letters (U+002D, U+2010, U+2011)
  M2     an edge apostrophe: a refusal is M2b, a reading switch is M2a
  dash   the word came from a token cut at `--` or an edge hyphen
  other  none of these: the change nobody predicted

READERS COMPARED: the anchor path (`readable`, end word, cause, reason,
anchors), per-token phones (reading switches), the schema judge's stream
(`stream_unread`), the grid end key, the meter (`meter_stress`,
`meter_refused`), the declared-reading probe (lines whose declarations stop
or start clearing the report; the unresolved totals are a standing measure), the voices reading, and token
coordinate agreement. Any line that differs in a recorded field but lands in
no class is listed as `unclassified`. Fixture lines are shown side by side and
counted nowhere else.
"""
import difflib, gzip, json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
SWEEP = os.path.join(os.path.dirname(HERE), "scope_2026-10-12", "shape_sweep.json")
_DETAIL = 25
_APOS = "’‘`´ʼʻ＇՚"
_HYPHEN = re.compile(r"[^\W\d_]['’]?[-‐‑]['’]?[^\W\d_]")
_ALL = ("item6", "M1", "M2a", "M2b", "dash")
_SCOPE_ONLY = ("M3",)
_ALIAS = {"tokenizer": "dash"}
_PIN = ("split_sha256", "population_sha256", "fixtures_sha256")
_CONFIG = ("reader", "reader_scheme", "effective_fallback", "supplement", "cmudict_sha256", "fallback", "strip_parens", "declarations",
           "recorder_sha256", "comparator_fingerprint_parts")


def _load(path):
    with gzip.open(path, "rt", encoding="utf-8") as fh:
        rows = [json.loads(x) for x in fh]
    corpus = {r["id"]: r for r in rows[1:] if not r.get("fixture")}
    fixtures = {r["id"]: r for r in rows[1:] if r.get("fixture")}
    return rows[0], corpus, fixtures


def _fold(w):
    for ch in _APOS:
        w = w.replace(ch, "'")
    return w.lower().strip("\"“”.,;:!?()[]-‐‑")


def _raw(t):
    """A token's coordinate identity: apostrophes folded and case folded, edge
    hyphens KEPT, so a cut that only drops them (`shore--` -> `shore`) shows."""
    for ch in _APOS:
        t = t.replace(ch, "'")
    return t.lower()


def _parts(w):
    f = _fold(w)
    return {f, f.strip("'")} | {p.strip("'") for p in re.split(r"-+|[‐‑]", f) if p.strip("'")}


def _words(rec, unread_tokens=None):
    """-> [(folded word, raw word, token index, refused, entries)] under the
    dash rule, `entries` being the token's OOV entries assigned to the word.
    Each OOV entry of a token is assigned to ONE of the token's words: the word
    it spells, else the first word it is a hyphen piece of, else (an entry
    naming the whole `--` token) every word it covers. `unread_tokens` (token
    indices) overrides this, for the stream reader, which refuses whole tokens."""
    out = []
    toks = rec.get("tokens") or []
    tok = rec.get("tok") or []
    for i, t in enumerate(toks):
        ws = [p.strip("-\u2010\u2011") for p in re.split(r"-{2,}", t)]
        ws = [p for p in ws if p and re.search(r"[^\W_]", p)]
        flags = [False] * len(ws)
        got = [[] for _ in ws]
        if unread_tokens is not None:
            flags = [i in unread_tokens] * len(ws)
        else:
            for o in tok[i][1] if i < len(tok) else ():
                fo = _fold(o).strip("'")
                hit = [k for k, w in enumerate(ws) if _fold(w).strip("'") == fo]
                if not hit:
                    hit = [k for k, w in enumerate(ws) if fo in _parts(w)][:1]
                if not hit:
                    hit = [k for k, w in enumerate(ws) if _parts(w) & _parts(o)]
                for k in hit:
                    flags[k] = True
                    got[k].append(_fold(o))
        out += [(_fold(w), w, i, f, tuple(sorted(g))) for w, f, g in zip(ws, flags, got)]
    return out


def _mech(word, before_token):
    if re.search(r"\d", word):
        return "M1"
    if _HYPHEN.search(word):
        return "item6"
    w = word
    for ch in _APOS:
        w = w.replace(ch, "'")
    if w.startswith("'") or w.endswith("'"):
        return "M2"
    if before_token is not None and (re.search(r"-{2,}", before_token) or before_token.strip("-") != before_token):
        return "dash"
    return "other"


def _align(a, b):
    """-> (pairs of aligned indices, a-only indices, b-only indices)."""
    sm = difflib.SequenceMatcher(None, [x[0] for x in a], [x[0] for x in b], autojunk=False)
    pairs, only_a, only_b = [], [], []
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            pairs += list(zip(range(i1, i2), range(j1, j2)))
        else:
            only_a += list(range(i1, i2)); only_b += list(range(j1, j2))
    return pairs, only_a, only_b


def _word_changes(b, a, unread_b=None, unread_a=None):
    """-> list of (kind, mechanism, position, word) for refusal changes."""
    wb, wa = _words(b, unread_b), _words(a, unread_a)
    btoks = b.get("tokens") or []
    pairs, only_b, only_a = _align(wb, wa)
    last = len(wa) - 1
    out = []
    for i, j in pairs:
        mech = _mech(wa[j][1], btoks[wb[i][2]] if wb[i][2] < len(btoks) else None)
        mech = "M2b" if mech == "M2" else mech
        pos = "end" if j == last else "interior"
        if wb[i][3] != wa[j][3]:
            out.append(("newly_refused" if wa[j][3] else "newly_read", mech, pos, wa[j][1]))
        elif wb[i][3] and unread_b is None and wb[i][4] != wa[j][4]:
            # refused on both sides, reported in a different unit (a piece
            # before, the whole word after): the same refusal, respelled
            out.append(("refusal_respelled", mech, pos, wa[j][1]))
    for j in only_a:
        mech = _mech(wa[j][1], None)
        out.append(("added_refused" if wa[j][3] else "added_read", "M2b" if mech == "M2" else mech,
                    "end" if j == last else "interior", wa[j][1]))
    for i in only_b:
        out.append(("removed", _mech(wb[i][1], None), "", wb[i][1]))
    return out


def _switches(b, a):
    """-> [(mechanism, token)] for tokens present on both sides, read on both,
    whose phones moved."""
    tb, ta = b.get("tokens") or [], a.get("tokens") or []
    pb, pa = b.get("tok") or [], a.get("tok") or []
    sm = difflib.SequenceMatcher(None, [_fold(t) for t in tb], [_fold(t) for t in ta], autojunk=False)
    out = []
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag != "equal":
            continue
        for i, j in zip(range(i1, i2), range(j1, j2)):
            if i < len(pb) and j < len(pa) and not pb[i][1] and not pa[j][1] and pb[i][0] != pa[j][0]:
                mech = _mech(ta[j], tb[i])
                out.append(("M2a" if mech == "M2" else mech, ta[j]))
    return out


def _resolved(d):
    return (d and not d.get("rejected") and d.get("readable") and not d.get("unreadable")
            and not d.get("interior_unreadable") and not d.get("final_unread_pieces") and d.get("reason") is None)


def _detail(b, a, keys=("text", "tokens", "final", "readable", "cause", "reason", "oov", "tok", "stream_unread",
                        "grid", "meter_refused", "declared", "error")):
    return {"id": b["id"], "before": {k: b.get(k) for k in keys if k in b}, "after": {k: a.get(k) for k in keys if k in a}}


def _main():
    args = [x for x in sys.argv[1:] if not x.startswith("--")]
    flags = dict(x[2:].split("=", 1) for x in sys.argv[1:] if x.startswith("--") and "=" in x)
    scope = [_ALIAS.get(m, m) for m in flags.get("mechanisms", ",".join(_ALL)).split(",") if m]
    unknown = [m for m in scope if m not in _ALL + _SCOPE_ONLY]
    if unknown:
        sys.exit(f"unknown mechanism(s) {unknown}; known: {list(_ALL + _SCOPE_ONLY)} (alias: tokenizer = dash)")
    hb, before, fb = _load(args[0])
    ha, after, fa = _load(args[1])
    out = args[2]
    pinned = {k: (hb.get(k), ha.get(k)) for k in _PIN if hb.get(k) != ha.get(k)}
    if pinned:
        sys.exit(f"CANNOT TELL: the two recordings measure different populations: {pinned}")
    config = {k: {"before": hb.get(k), "after": ha.get(k)} for k in _CONFIG if hb.get(k) != ha.get(k)}
    with open(SWEEP, encoding="utf-8") as fh:
        pr = json.load(fh)["projected_refusals"]
    projected = {"item6": set(pr["ids"]["item6"]) | set(pr["interior_ids"]["join_only"]),
                 "M1": set(pr["ids"]["M1"]) | set(pr["interior_ids"]["M1"]),
                 "M2b": set(pr["ids"]["M2b"]) | set(pr["interior_ids"]["M2b"]),
                 "M2a": set(pr.get("m2a_switch_ids", ())),
                 # the dash cut: every line with a `--` or edge-hyphen token at the base
                 "dash": {i for i, r in before.items()
                          if any(re.search(r"-{2,}|^-|-$", t) for t in r.get("tokens") or ())}}
    cls = {}
    by_mech = {}
    unresolved = {"before": 0, "after": 0}
    tallies = {}
    residual_fields = {}

    def put(name, i):
        cls.setdefault(name, set()).add(i)

    def tally(name, key):
        tallies.setdefault(name, {}).setdefault(key, 0)
        tallies[name][key] += 1

    def attribute(prefix, mech, i):
        by_mech.setdefault(f"{prefix}{mech}", set()).add(i)

    ids = sorted(set(before) & set(after))
    for i in ids:
        b, a = before[i], after[i]
        if "error" in b or "error" in a:
            put("error_before" if "error" in b else "error_after", i)
            continue
        explained = set()

        def hit(name, *fields):
            put(name, i)
            explained.update(fields)

        if b["readable"] != a["readable"]:
            hit("end_newly_refused" if b["readable"] else "end_newly_read", "readable", "final_lr",
                "final_unread_pieces", "unreadable", "cause", "reason", "anchors", "oov", "phones")
            wa_ = _words(a)
            end_mech = _mech(wa_[-1][1], None) if wa_ else "other"
            end_mech = "M2b" if end_mech == "M2" else end_mech
            tally("end_newly_refused" if b["readable"] else "end_newly_read", end_mech)
            if b["readable"]:
                attribute("", end_mech, i)
        if _fold(b.get("final") or "") != _fold(a.get("final") or ""):
            hit("end_word_changed", "final", "final_lr")
        if b["readable"] == a["readable"]:
            if b.get("cause") != a.get("cause"):
                hit("cause_changed", "cause")
            if b.get("reason") != a.get("reason"):
                hit("reason_changed", "reason")
            if b["readable"] and b.get("anchors") != a.get("anchors"):
                hit("anchors_changed", "anchors")
        if b.get("extra") != a.get("extra"):
            hit("extra_changed", "extra")
        # token coordinate: what cut the line's tokens differently
        tb, ta = b.get("tokens") or [], a.get("tokens") or []
        if [_raw(t) for t in tb] != [_raw(t) for t in ta]:
            cut = [_raw(w[1]) for w in _words(b)]
            plain = [_raw(t) for t in ta if not re.search(r"\d", t)]
            if [_raw(t) for t in ta] == cut:
                kind, mech = "tokens_dash_cut", "dash"
            elif plain == cut:
                kind, mech = ("tokens_numeral_added", "M1") if cut == [_raw(t) for t in tb] else ("tokens_numeral_and_dash", "M1")
            else:
                kind, mech = "tokens_other", "other"
            hit(kind, "tokens", "tok", "words_ne_tokens", "phones", "oov", "unreadable", "interior_unreadable",
                "final_unread_pieces", "meter_stress", "anchors", "reason")
            attribute("tok:", mech, i)
            if kind == "tokens_numeral_and_dash":
                attribute("tok:", "dash", i)
        for kind, mech, pos, _w in _word_changes(b, a):
            hit(f"word_{kind}", "tok", "oov", "phones", "unreadable", "interior_unreadable", "final_unread_pieces",
                "reason", "meter_stress", "anchors")
            tally(f"word_{kind}", f"{mech}/{pos}" if pos else mech)
            if kind in ("newly_refused", "added_refused"):
                attribute("", mech, i)
            elif kind == "refusal_respelled":
                attribute("respell:", mech, i)
        for mech, _t in _switches(b, a):
            hit("reading_switched", "tok", "phones", "anchors", "meter_stress")
            tally("reading_switched", mech)
            attribute("" if mech == "M2a" else "switch:", mech, i)
        sb = {e[0] for e in b.get("stream_unread", [])}
        sa = {e[0] for e in a.get("stream_unread", [])}
        if b.get("stream_unread") != a.get("stream_unread"):
            explained_stream = False
            for kind, mech, pos, _w in _word_changes(b, a, sb, sa):
                if kind in ("newly_refused", "newly_read", "added_refused", "added_read"):
                    hit(f"stream_{kind}", "stream_unread")
                    tally(f"stream_{kind}", f"{mech}/{pos}")
                    attribute("stream:", mech, i)
                    explained_stream = True
            if not explained_stream and [_raw(t) for t in tb] != [_raw(t) for t in ta]:
                explained.add("stream_unread")      # re-indexed by the token cut only
        if b.get("stream_tokens") != a.get("stream_tokens"):
            hit("stream_tokens_changed", "stream_tokens")
        gb, ga = b.get("grid") or [None, None], a.get("grid") or [None, None]
        if gb != ga:
            name = ("grid_newly_refused" if gb[1] is not None and ga[1] is None else
                    "grid_newly_read" if gb[1] is None and ga[1] is not None else
                    "grid_key_changed" if gb[1] != ga[1] else "grid_word_changed")
            hit(name, "grid")
            gm = _mech(ga[0] or "", gb[0])
            tally(name, gm)
            attribute("grid:", "M2b" if gm == "M2" else gm, i)
        if b.get("meter_stress") != a.get("meter_stress"):
            # the raw delta is always recorded; it is only UNEXPLAINED when no
            # word, token or switch class on the line already accounts for it
            if "meter_stress" not in explained:
                attribute("meter:", "other", i)
            hit("meter_stress_changed", "meter_stress")
        mb = {tuple(x) for x in b.get("meter_refused") or []}
        ma = {tuple(x) for x in a.get("meter_refused") or []}
        if mb != ma:
            if ma - mb:
                hit("meter_refused_gained", "meter_refused")
                for t, c in ma - mb:
                    mm = _mech(t, None)
                    tally("meter_refused_gained", f"{mm}/{c}")
                    attribute("meter:", "M2b" if mm == "M2" else mm, i)
            if mb - ma:
                hit("meter_refused_lost", "meter_refused")
                for t, c in mb - ma:
                    mm = _mech(t, None)
                    tally("meter_refused_lost", f"{mm}/{c}")
                    attribute("meter:", "M2b" if mm == "M2" else mm, i)
        db, da = b.get("declared"), a.get("declared")
        ub, ua = db is not None and not _resolved(db), da is not None and not _resolved(da)
        unresolved["before"] += ub; unresolved["after"] += ua
        if ua and not ub:
            put("declared_newly_unresolved", i)
        if ub and not ua:
            put("declared_newly_resolved", i)
        if db != da:
            hit("declared_changed", "declared")
        if b.get("voices") != a.get("voices"):
            hit("voices_changed", "voices")
        if bool(a.get("words_ne_tokens")) != bool(b.get("words_ne_tokens")):
            hit("token_coordinate_disagreement_" + ("gained" if a.get("words_ne_tokens") else "lost"), "words_ne_tokens")
        # FIELD-LEVEL RESIDUAL: every recorded field that differs and that no
        # class above explains, even on a line where another class did hit
        differ = {k for k in set(b) | set(a) if k not in ("id", "text") and b.get(k) != a.get(k)}
        left = differ - explained
        if left:
            put("unexplained_fields", i)
            for k in left:
                residual_fields[k] = residual_fields.get(k, 0) + 1

    # fold the dash observations into one set BEFORE any count is taken
    for k in ("switch:dash", "tok:dash"):
        by_mech.setdefault("dash", set()).update(by_mech.get(k, set()))
    by_mech.setdefault("M1", set()).update(by_mech.get("tok:M1", set()))
    cross = {}
    for m in _ALL:
        obs = by_mech.get(m, set())
        cross[m] = {"in_scope": m in scope, "projected": len(projected[m]), "observed": len(obs),
                    "projected_and_observed": len(obs & projected[m]),
                    "projected_not_observed": sorted(projected[m] - obs) if m in scope else len(projected[m] - obs),
                    "observed_not_projected": sorted(obs - projected[m])}
    cross["dash"]["observed_token_cut"] = len(by_mech.get("tok:dash", set()))
    cross["dash"]["observed_refusal_or_switch"] = len(by_mech.get("dash", set()) - by_mech.get("tok:dash", set()))
    secondary = ("stream:", "grid:", "meter:")
    loose = {"other", "switch:other", "tok:other", "respell:other"} | {p + "other" for p in secondary}
    if "dash" not in scope:
        loose |= {"dash", "respell:dash"} | {p + "dash" for p in secondary}
    if "M3" in scope:     # under M3 the secondary readers' deltas are raw, not shape-attributed
        loose -= {p + "other" for p in secondary} | {p + "dash" for p in secondary}
    unpredicted = sorted(set().union(*(v for k, v in by_mech.items() if k in loose)) | cls.get("unexplained_fields", set()))
    out_of_scope = sorted(set().union(*(v for k, v in by_mech.items()
                                        if k.split(":")[-1] in _ALL and k.split(":")[-1] not in scope
                                        and not k.startswith("switch:")
                                        and not ("M3" in scope and k.startswith(secondary)))))
    m3_raw = ({k: len(v) for k, v in sorted(cls.items()) if k.startswith(("stream_", "meter_", "grid_"))}
              if "M3" in scope else None)
    # READER AGREEMENT (3PO 6147757628, 6147841348): of the lines where the
    # anchor path moved, how many moved in each secondary reader too.
    # OBSERVATIONAL ONLY: a reader may legitimately not depend on the change,
    # and a process default of v2 hides an omitted scheme argument, so this
    # proves scheme propagation in neither direction. NARROW DENOMINATOR:
    # aligned-word readability flips (the end's, for the grid, which reads
    # only the end); not switches, added/removed words, token cuts, anchor or
    # end-word changes. "Together" is line-level co-occurrence, not the same
    # word, direction or cause.
    def _union(*names):
        return set().union(*(cls.get(n, set()) for n in names))
    word_moved = _union("word_newly_refused", "word_newly_read")
    end_moved = _union("end_newly_refused", "end_newly_read")
    agreement = {}
    for reader, anchor, moved in (
            ("stream", word_moved, _union("stream_newly_refused", "stream_newly_read",
                                          "stream_added_refused", "stream_added_read")),
            ("meter", word_moved, _union("meter_refused_gained", "meter_refused_lost", "meter_stress_changed")),
            ("grid", end_moved, _union("grid_newly_refused", "grid_newly_read", "grid_key_changed", "grid_word_changed"))):
        agreement[reader] = {"anchor_path_moved": len(anchor), "moved_together": len(anchor & moved),
                             "stayed_still": sorted(anchor - moved), "moved_alone": len(moved - anchor)}
    rec = {
        "before": {k: hb.get(k) for k in ("commit", "tracked_changes", "fallback")},
        "after": {k: ha.get(k) for k in ("commit", "tracked_changes", "fallback")},
        "config_changes": config, "mechanisms_in_scope": scope,
        "projection": os.path.relpath(SWEEP, os.path.dirname(os.path.dirname(HERE))),
        "lines": {"joined": len(ids), "only_before": sorted(set(before) - set(after)), "only_after": sorted(set(after) - set(before))},
        "counts": {k: len(v) for k, v in sorted(cls.items())},
        "unexplained_field_counts": residual_fields,
        "secondary_reader_attribution": {k: len(v) for k, v in sorted(by_mech.items()) if k.startswith(("stream:", "grid:", "meter:", "tok:", "respell:"))},
        "M3_raw_deltas": m3_raw,
        "reader_agreement": agreement,
        "declared_probe_unresolved_lines": unresolved,
        "by_shape": tallies,
        "projection_cross_tab": cross,
        "unattributed_changes": {"count": len(unpredicted), "ids": unpredicted,
                                 "detail": [_detail(before[i], after[i]) for i in unpredicted[:_DETAIL]]},
        "out_of_scope_changes": {"count": len(out_of_scope), "ids": out_of_scope},
        "classes": {k: {"ids": sorted(v), "detail": [_detail(before[i], after[i]) for i in sorted(v)[:_DETAIL]]}
                    for k, v in sorted(cls.items())},
        "fixtures": [_detail(fb[k], fa[k]) for k in sorted(set(fb) & set(fa), key=lambda x: int(x.split(":")[1]))
                     if fb[k] != fa[k]],
    }
    if "summary" in flags or "--summary" in sys.argv:
        rec = {k: v for k, v in rec.items() if k not in ("classes", "unattributed_changes", "out_of_scope_changes")}
        rec["projection_cross_tab"] = {m: {k: (len(v) if isinstance(v, list) else v) for k, v in c.items()}
                                       for m, c in cross.items()}
        rec["unattributed_changes"] = len(unpredicted)
        rec["reader_agreement"] = {r: {k: (len(v) if isinstance(v, list) else v) for k, v in a.items()}
                                   for r, a in agreement.items()}
        rec["lines"] = {k: (len(v) if isinstance(v, list) else v) for k, v in rec["lines"].items()}
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(rec, fh, ensure_ascii=False, indent=1, default=str)
        fh.write("\n")
    print(json.dumps({"before": (hb.get("commit") or "")[:9], "after": (ha.get("commit") or "")[:9],
                      "config_changes": sorted(config), "counts": rec["counts"],
                      "cross": {m: {k: (len(v) if isinstance(v, list) else v) for k, v in c.items()} for m, c in cross.items()},
                      "unattributed": len(unpredicted), "out_of_scope": len(out_of_scope),
                      "reader_agreement": {r: {k: (len(v) if isinstance(v, list) else v) for k, v in a.items()}
                                           for r, a in agreement.items()},
                      "fixtures_changed": len(rec["fixtures"])}, indent=1))


if __name__ == "__main__":
    _main()
