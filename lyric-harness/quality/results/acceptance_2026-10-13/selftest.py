"""Self-test of `diff.py` on synthetic recordings (3PO, PR #527 6138433530): the
cases a corpus null test and one positive control cannot show.

    python3 quality/results/acceptance_2026-10-13/selftest.py

Each case writes a two-line BEFORE/AFTER pair, runs the diff, and checks one
property. Exit status 1 if any case fails.
  mixed            an expected item-6 refusal and an unexplained grid change
                   on ONE line: the grid change still surfaces as unattributed
  secondary_only   a schema-stream refusal of a plain word and nothing else
  meter_only       a meter stress change with no token change
  field_only       a field no class explains (`final_lr`)
  dash_cut         a `--` token cut with no refusal: observed for `dash` when
                   in scope, unattributed when not
  dash_switch      a reading switch on a word cut from a `--` token counts as
                   observed for `dash` (folded before the counts)
  dash_switch_fixed  the same with the token coordinate unchanged: counted as
                   a reading switch, not a token cut
  edge_hyphen_cut  `shore--` -> `shore` is a token cut (edge hyphens are part
                   of the coordinate)
  meter_raw_and_loss  a stress change beside an expected refusal is still
                   recorded, and a lost meter refusal on a plain word is
                   unattributed
  m3_raw_only      under M3, stream and grid changes are raw deltas: neither
                   out of scope nor unattributed
  respelled        a refusal reported as a piece before and whole after is
                   neither new nor unattributed
"""
import copy, gzip, json, os, subprocess, sys, tempfile
HERE = os.path.dirname(os.path.abspath(__file__))
_HEADER = {"header": True, "commit": "synthetic", "split_sha256": "s", "population_sha256": "p", "fixtures_sha256": "f"}


def _line(i, text, tokens, tok, **kw):
    rec = {"id": f"synthetic:{i}", "text": text, "tokens": tokens, "final": tokens[-1], "final_lr": tokens[-1],
           "readable": True, "cause": None, "final_unread_pieces": [], "unreadable": [], "interior_unreadable": [],
           "reason": None, "anchors": ["a"], "phones": " ".join(p for p, _ in tok), "oov": [o for _, oo in tok for o in oo],
           "words_ne_tokens": False, "tok": tok, "stream_unread": [], "grid": [tokens[-1], "K"], "meter_stress": "/."}
    rec.update(kw)
    return rec


def _run(before, after, *flags):
    with tempfile.TemporaryDirectory() as d:
        paths = []
        for name, rows in (("b", before), ("a", after)):
            p = os.path.join(d, f"{name}.jsonl.gz")
            with gzip.open(p, "wt", encoding="utf-8") as fh:
                for r in [_HEADER] + rows:
                    fh.write(json.dumps(r) + "\n")
            paths.append(p)
        out = os.path.join(d, "out.json")
        subprocess.run([sys.executable, os.path.join(HERE, "diff.py"), *paths, out, *flags],
                       check=True, capture_output=True, text=True)
        with open(out, encoding="utf-8") as fh:
            return json.load(fh)


def _cases():
    base = _line(0, "the war-cry rang home", ["the", "war-cry", "rang", "home"],
                 [["DH AH0", []], ["W AO1 R K R AY1", []], ["R AE1 NG", []], ["HH OW1 M", []]])
    out = {}

    a = copy.deepcopy(base)
    a["tok"][1] = ["", ["war-cry"]]; a["grid"] = ["home", "Z"]
    r = _run([base], [a], "--mechanisms=item6")
    out["mixed"] = (r["projection_cross_tab"]["item6"]["observed"] == 1 and r["unattributed_changes"]["count"] == 1,
                    f'item6 observed {r["projection_cross_tab"]["item6"]["observed"]}, unattributed {r["unattributed_changes"]["count"]}')

    a = copy.deepcopy(base); a["stream_unread"] = [[2, "rang"]]
    r = _run([base], [a], "--mechanisms=item6")
    out["secondary_only"] = (r["unattributed_changes"]["count"] == 1, f'unattributed {r["unattributed_changes"]["count"]}')

    a = copy.deepcopy(base); a["meter_stress"] = "//"
    r = _run([base], [a], "--mechanisms=item6")
    out["meter_only"] = (r["unattributed_changes"]["count"] == 1, f'unattributed {r["unattributed_changes"]["count"]}')

    a = copy.deepcopy(base); a["final_lr"] = "elsewhere"
    r = _run([base], [a], "--mechanisms=item6")
    out["field_only"] = (r["counts"].get("unexplained_fields") == 1 and r["unattributed_changes"]["count"] == 1,
                         f'unexplained {r["counts"].get("unexplained_fields")}, fields {r["unexplained_field_counts"]}')

    db = _line(1, "thee--Arise", ["thee--Arise"], [["DH IY1 ER0 AY1 Z", []]])
    da = _line(1, "thee--Arise", ["thee", "Arise"], [["DH IY1", []], ["ER0 AY1 Z", []]])
    r_in = _run([db], [da], "--mechanisms=dash")
    r_out = _run([db], [da], "--mechanisms=item6")
    out["dash_cut"] = (r_in["projection_cross_tab"]["dash"]["observed_token_cut"] == 1
                       and r_in["unattributed_changes"]["count"] == 0 and r_out["unattributed_changes"]["count"] == 1,
                       f'in scope: cut {r_in["projection_cross_tab"]["dash"]["observed_token_cut"]}, '
                       f'unattributed {r_in["unattributed_changes"]["count"]}; out of scope: unattributed {r_out["unattributed_changes"]["count"]}')

    sb = _line(2, "home--again", ["home", "again"], [["HH OW1 M", []], ["AH0 G EH1 N", []]])
    sa = copy.deepcopy(sb); sa["tok"][1] = ["AH0 G EY1 N", []]
    sb["tokens"] = ["home--again"]; sb["tok"] = [["HH OW1 M AH0 G EH1 N", []]]
    r = _run([sb], [sa], "--mechanisms=dash")
    out["dash_switch"] = (r["projection_cross_tab"]["dash"]["observed"] == 1 and r["unattributed_changes"]["count"] == 0,
                          f'dash observed {r["projection_cross_tab"]["dash"]["observed"]}, unattributed {r["unattributed_changes"]["count"]}')

    fb = _line(4, "home--again", ["home--again"], [["HH OW1 M AH0 G EH1 N", []]])
    fa = copy.deepcopy(fb); fa["tok"][0] = ["HH OW1 M AH0 G EY1 N", []]
    r = _run([fb], [fa], "--mechanisms=dash")
    c = r["projection_cross_tab"]["dash"]
    out["dash_switch_fixed"] = (r["counts"].get("reading_switched") == 1 and c["observed_refusal_or_switch"] == 1
                                and c["observed_token_cut"] == 0 and r["unattributed_changes"]["count"] == 0,
                                f'switched {r["counts"].get("reading_switched")}, refusal_or_switch {c["observed_refusal_or_switch"]}, '
                                f'cut {c["observed_token_cut"]}, unattributed {r["unattributed_changes"]["count"]}')

    eb = _line(5, "the shore--", ["the", "shore--"], [["DH AH0", []], ["SH AO1 R", []]])
    ea = _line(5, "the shore--", ["the", "shore"], [["DH AH0", []], ["SH AO1 R", []]])
    r = _run([eb], [ea], "--mechanisms=dash")
    out["edge_hyphen_cut"] = (r["counts"].get("tokens_dash_cut") == 1 and r["projection_cross_tab"]["dash"]["observed_token_cut"] == 1,
                              f'tokens_dash_cut {r["counts"].get("tokens_dash_cut")}')

    a = copy.deepcopy(base); a["tok"][1] = ["", ["war-cry"]]; a["meter_stress"] = "//"
    a["meter_refused"] = [["war-cry", "OUT_OF_LEXICON"]]
    mb = copy.deepcopy(base); mb["meter_refused"] = [["rang", "OUT_OF_LEXICON"]]
    r = _run([mb], [a], "--mechanisms=item6")
    out["meter_raw_and_loss"] = (r["counts"].get("meter_stress_changed") == 1 and r["counts"].get("meter_refused_lost") == 1
                                 and r["unattributed_changes"]["count"] == 1,
                                 f'stress {r["counts"].get("meter_stress_changed")}, lost {r["counts"].get("meter_refused_lost")}, '
                                 f'unattributed {r["unattributed_changes"]["count"]} (the lost `rang` refusal is unexplained)')

    gb = copy.deepcopy(base); ga = copy.deepcopy(base); ga["grid"] = ["home", "Z"]; ga["stream_unread"] = [[1, "war-cry"]]
    r = _run([gb], [ga], "--mechanisms=M3")
    out["m3_raw_only"] = (r["M3_raw_deltas"] and r["out_of_scope_changes"]["count"] == 0 and r["unattributed_changes"]["count"] == 0,
                          f'raw {r["M3_raw_deltas"]}, out_of_scope {r["out_of_scope_changes"]["count"]}, unattributed {r["unattributed_changes"]["count"]}')

    rb = _line(3, "Tra-la-la", ["Tra-la-la"], [["L AA1 L AA1", ["Tra"]]])
    ra = _line(3, "Tra-la-la", ["Tra-la-la"], [["", ["Tra-la-la"]]])
    r = _run([rb], [ra], "--mechanisms=item6")
    out["respelled"] = (r["counts"].get("word_refusal_respelled") == 1 and r["counts"].get("word_newly_refused") is None
                        and r["unattributed_changes"]["count"] == 0,
                        f'respelled {r["counts"].get("word_refusal_respelled")}, newly refused {r["counts"].get("word_newly_refused")}, '
                        f'unattributed {r["unattributed_changes"]["count"]}')
    return out


def _main():
    failed = 0
    for name, (ok, note) in _cases().items():
        print(f"{'PASS' if ok else 'FAIL'}  {name}: {note}")
        failed += not ok
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    _main()
