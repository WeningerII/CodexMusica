"""null-and-variants (c): behavioural reverts of 0af39c6f items 4-5, one at a time, in a COPY of
wt-0af/lyric-harness (c/mut/lyric-harness); each mutation is applied to a pristine copy of the file,
the named tests run, the file restored. argv: which (all | comma list)."""
import json, os, shutil, subprocess, sys, time
C = "/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/h0af/null-and-variants/c"
PY = "/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/venv311/bin/python"
ROOT = C + "/mut/lyric-harness"
LH, LS = "lyric_harness.py", "quality/lexicon_supplement.py"
T_NULL = "quality.test_reader.LegacyReplay.test_a_present_null_scheme_is_malformed_not_pre_batch"
T_VAR = "quality.test_reader.Normalisation.test_bare_word_variants_are_normalised_as_a_token_is"
T_SUPBARE = "quality.test_reader.Normalisation.test_a_supplemented_bare_word_is_normalised_as_a_token_is"
T_LEGACY = "quality.test_reader.LegacyReplay"
MUT = {
 "none": [],
 "N1_defer_null_admitted": [(LH, "    if recorded and run not in READER_SCHEMES:\n        _refuse(_malformed_scheme_message(f\"--propose=defer:{path}\", run))",
                                 "    if run not in (None,) + READER_SCHEMES:\n        _refuse(_malformed_scheme_message(f\"--propose=defer:{path}\", run))")],
 "N2_check_after_lexicon_block": [(LH, "    _run_scheme = _defer_scheme_check(path, st)\n    # THE RUN KEEPS THE SUPPLEMENT", "    # THE RUN KEEPS THE SUPPLEMENT"),
                                  (LH, "    _here_scheme = resolve_reader_scheme(None)\n    st[\"reader_scheme\"] = _run_scheme or _here_scheme",
                                       "    _here_scheme = resolve_reader_scheme(None)\n    _run_scheme = _defer_scheme_check(path, st)\n    st[\"reader_scheme\"] = _run_scheme or _here_scheme")],
 "N3_checkpoint_check_removed": [(LH, "            if run_scheme not in READER_SCHEMES:\n                raise ValueError(_malformed_scheme_message(\n                    \"LYRIC_CHECKPOINT_PATH\", run_scheme))\n", "")],
 "N4_replay_old_get": [(LH, "    _rs = _record_scheme(rec)\n    if _rs not in READER_SCHEMES:\n        _refuse(_malformed_scheme_message(f\"--propose=replay:{path}\", _rs))",
                            "    _rs = rec.get(\"reader_scheme\", \"v1\")\n    if _rs not in READER_SCHEMES:\n        _refuse(f\"--propose=replay:{path} — recorded reader scheme {_rs!r} \"\n                f\"is not one this build reads ({', '.join(READER_SCHEMES)})\")")],
 "N5_null_read_as_v1": [(LH, "    return rec[\"reader_scheme\"] if \"reader_scheme\" in rec else \"v1\"", "    return rec.get(\"reader_scheme\") or \"v1\"")],
 "N6_message_shows_None": [(LH, "    shown = \"null\" if value is None else repr(value)", "    shown = repr(value)")],
 "V1_lexicon_lookup_raw": [(LH, "        if _scheme_of(self) == \"v2\":\n            raw = fold_apostrophes(normalise_word(word)).lower().strip('\"“”.,;:!?()[]')\n", "")],
 "V2_supplement_lookup_raw": [(LS, "        key = _key(self._entry_word(word))\n        bare = _bare(key)\n        exact", "        key = _key(word)\n        bare = _bare(key)\n        exact")],
 "V3_provenance_key_raw": [(LS, "        key, phones = _key(self._entry_word(word)), tuple(phones)", "        key, phones = _key(word), tuple(phones)")],
 "V4_lexicon_normalises_under_v1": [(LH, "        if _scheme_of(self) == \"v2\":\n            raw = fold_apostrophes(normalise_word(word))", "        if True:\n            raw = fold_apostrophes(normalise_word(word))")],
 "V5_supplement_normalises_under_v1": [(LS, "        return LH.normalise_word(word) if LH._scheme_of(self) == \"v2\" else word", "        return LH.normalise_word(word)")],
 "V6_declared_match_on_normalised": [(LH, "        raw = fold_apostrophes(word).lower().strip('\"“”.,;:!?()[]')\n        choice = getattr(self, \"_pronunciation_choice\", None)\n",
                                         "        raw = fold_apostrophes(word).lower().strip('\"“”.,;:!?()[]')\n        if _scheme_of(self) == \"v2\":\n            raw = fold_apostrophes(normalise_word(word)).lower().strip('\"“”.,;:!?()[]')\n        choice = getattr(self, \"_pronunciation_choice\", None)\n")],
}
which = list(MUT) if sys.argv[1] == "all" else sys.argv[1].split(",")
tests = sys.argv[2].split(",") if len(sys.argv) > 2 else [T_NULL, T_VAR, T_SUPBARE, T_LEGACY]
env = {k: v for k, v in os.environ.items() if k not in ("LYRIC_CONTROL_TOKEN", "LYRIC_CHECKPOINT_PATH", "LYRIC_REQUEST_DEADLINE_MS")}
env["LYRIC_STAGED_DATA"] = "/home/user/CodexMusica/lyric-harness/data"
os.makedirs(C + "/mut_out", exist_ok=True)
results = {}
for name in which:
    saved = {}
    try:
        for f, old, new in MUT[name]:
            p = os.path.join(ROOT, f)
            if f not in saved:
                saved[f] = open(p, encoding="utf-8").read()
            cur = open(p, encoding="utf-8").read()
            assert cur.count(old) == 1, (name, f, cur.count(old))
            open(p, "w", encoding="utf-8").write(cur.replace(old, new))
        diff = subprocess.run(["diff", "-u", "--label", "orig", "--label", "mut", "-"] , input="", capture_output=True, text=True)
        rec = {}
        for t in tests:
            t0 = time.time()
            r = subprocess.run([PY, "-m", "unittest", "-v", t], cwd=ROOT, env=env, capture_output=True, text=True, timeout=3000)
            tail = r.stderr.strip().splitlines()
            rec[t] = {"rc": r.returncode, "summary": tail[-1] if tail else "", "secs": round(time.time() - t0, 1),
                      "fail_lines": [l for l in tail if l.startswith(("FAIL:", "ERROR:", "AssertionError", "SystemExit"))][:6]}
            open(f"{C}/mut_out/{name}__{t.split('.')[-1]}.log", "w").write(r.stdout + r.stderr)
        results[name] = rec
    finally:
        for f, text in saved.items():
            open(os.path.join(ROOT, f), "w", encoding="utf-8").write(text)
    print(name, {t.split(".")[-1]: (v["rc"], v["summary"]) for t, v in results[name].items()}, flush=True)
out = C + "/mutation_results.json"
prev = json.load(open(out)) if os.path.exists(out) else {}
prev.update(results)
json.dump(prev, open(out, "w"), indent=1)
