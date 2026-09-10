"""Production data admission, population conservation, and source reader regressions."""
import contextlib
import io
import hashlib
import json
import os
import pickle
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from quality import provenance as p
from quality import corpus_manifest as cm


class ProductionDataTests(unittest.TestCase):
    def test_cold_archive_staging_downloads_verifies_and_installs(self):
        from quality import fetch_data as staging
        import zipfile
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            archive = root / "source.zip"
            payload = b'{"model": "fixture"}'
            with zipfile.ZipFile(archive, "w") as zipped:
                zipped.writestr("fixture/model.json", payload)
            asset = {"id": "fixture", "base": "staged", "runtime": True,
                     "url": archive.as_uri(), "archive_sha256": staging.sha256(archive),
                     "directory": "nltk/taggers/fixture", "files": [
                         {"path": "nltk/taggers/fixture/model.json", "bytes": len(payload),
                          "sha256": hashlib.sha256(payload).hexdigest()}]}
            staged = root / "staged"
            with patch.object(staging, "DATA", str(staged)), \
                 patch.object(staging, "_ASSETS", {"fixture": asset}), \
                 patch.object(staging, "nltk_data_dir"):
                staging.fetch_all()
                self.assertEqual((staged / asset["files"][0]["path"]).read_bytes(), payload)
                self.assertEqual(staging.file_errors(asset, staged), [])
                self.assertEqual(list(staged.rglob("*.part")), [])
                self.assertEqual(list(staged.rglob("lyric-stage-*")), [])
                archive.unlink()
                staging.fetch_all()  # Verified warm install needs no source archive.

    def test_default_staging_never_fetches_optional_research_or_legacy_models(self):
        from quality import fetch_data as staging
        assets = {key: {"id": key, "base": "staged", "runtime": key == "current",
                       "url": "https://example.invalid/" + key,
                       "files": [{"path": key, "sha256": "0" * 64}]}
                  for key in ("current", "concreteness", "tagger_legacy", "punkt_tab")}
        with patch.object(staging, "_ASSETS", assets), patch.object(staging, "_get") as get, \
             patch.object(staging, "nltk_data_dir"):
            staging.fetch_all()
            self.assertEqual([c.args[0].rsplit("/", 1)[1] for c in get.call_args_list], ["current"])
            get.reset_mock()
            staging.fetch_all(runtime=False)
            self.assertEqual([c.args[0].rsplit("/", 1)[1] for c in get.call_args_list],
                             ["current", "concreteness"])
            self.assertFalse(staging.HISTORICAL_ASSETS & {a["id"] for a in staging.manifest()["assets"]})

    def test_missing_research_norms_names_explicit_research_staging(self):
        from quality import features as f
        with tempfile.TemporaryDirectory() as directory, patch.object(f, "DATA", directory), \
             patch.object(f, "nltk_data_dir", return_value=directory), \
             patch.object(f, "_tagger", return_value=lambda words: []):
            f.staged_resources_or_refuse(require_concreteness=False)
            output = io.StringIO()
            with contextlib.redirect_stdout(output), self.assertRaises(SystemExit) as error:
                f.staged_resources_or_refuse(require_concreteness=True)
            self.assertEqual(error.exception.code, 2)
            self.assertIn("quality/fetch_data.py --research", output.getvalue())

    def test_song_frequency_literal_header_words_and_author_exclusion(self):
        from quality import frequency as frequency
        with tempfile.TemporaryDirectory() as directory, patch.object(frequency, "DATA", directory):
            root = Path(directory)
            (root / "song_endword_en.tsv").write_text(
                "# source fixture\nword\tauthor\tcount\n"
                "word\tU\t7\nword\tV\t11\nbird\tU\t2\n"
                "a\tU\t3\nca\tU\t4\nthe\tU\t5\na\tV\t2\nca\tV\t2\n")
            (root / "song_rhymepair_en.tsv").write_text(
                "a\tb\tauthor\tcount\na\tca\tU\t2\na\tthe\tU\t1\n"
                "a\tca\tV\t2\nbird\tword\tU\t5\n")
            layer = frequency.FrequencyLayer()
            layer.declare(frequency.LAYER._sources["eng-song"])
            ranks = layer.ranks("eng-song", scoring=frequency.UNSEEN)
            self.assertEqual(ranks["word"], 0)
            self.assertIn("a", ranks)
            self.assertEqual(dict(layer.conditional("eng-song", "a", scoring=frequency.UNSEEN)),
                             {"ca": 4, "the": 1})
            self.assertEqual(dict(layer.conditional("eng-song", "a", scoring="U")), {"ca": 2})
            self.assertEqual(dict(layer.conditional("eng-song", "word", scoring="V")), {"bird": 5})

    def test_song_frequency_refuses_bad_headers_counts_and_partial_cache(self):
        from quality import frequency as frequency
        good_end = "word\tauthor\tcount\na\tU\t2\nca\tU\t2\n"
        good_pair = "a\tb\tauthor\tcount\na\tca\tU\t1\n"
        bad_ends = ["", "word\tauthor\tcounts\n", "word\tU\t7\n",
                    good_end + "word\tauthor\tcount\n", good_end + "word\tU\n",
                    good_end + "a\tU\t1\n", good_end + "word\t\t1\n"]
        bad_ends += [good_end + "word\tU\t" + value + "\n"
                     for value in ("0", "-1", "nan", "1.5", "", " 1")]
        bad_pairs = ["", good_pair + "a\tb\tauthor\tcount\n",
                     good_pair + "a\tca\tU\t1\n",
                     "a\tb\tauthor\tcount\nca\ta\tU\t1\n",
                     "a\tb\tauthor\tcount\na\tmissing\tU\t1\n",
                     "a\tb\tauthor\tcount\na\tca\tOTHER\t1\n"]
        with tempfile.TemporaryDirectory() as directory, patch.object(frequency, "DATA", directory):
            root = Path(directory)
            for end, pair in [(bad, good_pair) for bad in bad_ends] + [(good_end, bad) for bad in bad_pairs]:
                with self.subTest(end=end, pair=pair):
                    (root / "song_endword_en.tsv").write_text(end)
                    (root / "song_rhymepair_en.tsv").write_text(pair)
                    layer = frequency.FrequencyLayer()
                    layer.declare(frequency.LAYER._sources["eng-song"])
                    with self.assertRaises(ValueError):
                        layer.ranks("eng-song", scoring=frequency.UNSEEN)
                    self.assertEqual(layer._song, {})
                    (root / "song_endword_en.tsv").write_text(good_end)
                    (root / "song_rhymepair_en.tsv").write_text(good_pair)
                    self.assertEqual(dict(layer.conditional("eng-song", "a", scoring=frequency.UNSEEN)),
                                     {"ca": 1})

    def test_song_frequency_live_population_includes_literal_word(self):
        from quality import frequency as frequency
        layer = frequency.FrequencyLayer()
        source = frequency.LAYER._sources["eng-song"]
        layer.declare(source)
        end, pair, _ = layer._song_tables(source)
        self.assertEqual((len(end), sum(sum(per.values()) for per in end.values())), (13856, 248628))
        self.assertEqual(sum(end["word"].values()), 407)
        self.assertEqual(set(pair["a"]), {"ca", "the"})

    def test_optional_norms_do_not_disable_or_change_any_requested_floor_feature(self):
        from quality import features as f
        floor_features = ("mattr", "function_word_ratio")
        full = f.QualityFeatures()
        lines = ["My kettle whistles by the stove", "Your fingers brush my heavy coat"]
        expected = full.extract(lines, features=floor_features)
        with tempfile.TemporaryDirectory() as directory, patch.object(f, "DATA", directory):
            limited = f.QualityFeatures(lex=full.lex, features=floor_features)
            self.assertEqual(limited.extract(lines), expected)
            self.assertEqual(set(limited.extract(lines)), set(floor_features))
            with self.assertRaisesRegex(ValueError, "unavailable"):
                limited.extract(lines, features=("concreteness_mean",))
            with contextlib.redirect_stdout(io.StringIO()), self.assertRaises(SystemExit) as error:
                f.QualityFeatures(lex=full.lex)
            self.assertEqual(error.exception.code, 2, "all-feature research request still refuses missing norms")

        with patch.object(full, "_predictability", side_effect=AssertionError("unused expensive scorer")), \
             patch.object(full, "_inversions", side_effect=AssertionError("unused inversion scorer")):
            self.assertEqual(full.extract(lines, features=floor_features), expected)
            self.assertEqual(set(full.extract([], features=floor_features)), set(floor_features))

    def test_saved_rows_require_current_input_provenance_and_exact_bytes(self):
        from quality import length_curve_calibration as lc
        provenance = {"version": 1, "with_predictability": True, "comparator_fingerprint": "scorer-a",
                      "population_fingerprint": "reader-a", "corpus_sha256": "corpus-a"}
        row = {"file": "fixture", "author": "author", "title": "song", "n_lines": 2,
               "n_tokens": 10, "mattr": .8, "fwr": .3, "anaphora": 0,
               "cv": .1, "predictability": .2}
        with tempfile.TemporaryDirectory() as directory, patch.object(lc, "row_provenance", return_value=provenance):
            path = Path(directory) / "rows.tsv"
            lc.write_rows([row], path)
            self.assertEqual(len(lc.read_rows([path], verify=True)), 1)
            self.assertEqual(lc.verify_rows(path)["items"], 1)
            with patch.object(lc, "row_provenance", return_value={**provenance, "corpus_sha256": "changed"}):
                with self.assertRaisesRegex(ValueError, "stale.*corpus_sha256"):
                    lc.read_rows([path], verify=True)
            path.write_text(path.read_text().replace("0.8", "0.9"))
            with self.assertRaisesRegex(ValueError, "changed bytes"):
                lc.read_rows([path], verify=True)
            path.with_suffix(".meta.json").unlink()
            with self.assertRaisesRegex(ValueError, "lack verified provenance"):
                lc.read_rows([path], verify=True)

    def test_the_tagger_prepends_its_directory_once_and_keeps_it_first(self):
        """Two properties, and the second is why the obvious fix is wrong.

        `_tagger` used to `insert(0, where)` unconditionally, appending a
        duplicate on every call -- measured at 8 path entries becoming 11 over
        three `row_provenance` calls. Bounded rather than hot, so it changed no
        answer; M-259 adding a fourth call site is what made it worth fixing.

        The tempting guard is `if where not in nltk.data.path`. It keeps the
        list short and quietly loses the contract: a copy already sitting
        further down STAYS there, and some earlier entry decides which model
        loads. So this asserts BOTH that the list stops growing and that the
        staged directory is still index 0 -- the second is the half a bare
        membership guard fails.
        """
        import nltk
        from quality.features import _tagger, nltk_data_dir

        staged = nltk_data_dir()
        _tagger()
        settled = list(nltk.data.path)
        for _ in range(5):
            _tagger()
        self.assertEqual(nltk.data.path, settled, 'the search path grew')
        self.assertEqual(nltk.data.path.count(staged), 1)
        self.assertEqual(nltk.data.path[0], staged)

        # And it must reclaim first place from wherever it has drifted to,
        # which is exactly what a membership guard would decline to do.
        nltk.data.path.remove(staged)
        nltk.data.path.insert(len(nltk.data.path), staged)
        _tagger()
        self.assertEqual(nltk.data.path[0], staged)
        self.assertEqual(nltk.data.path.count(staged), 1)

    def test_calibration_provenance_reads_the_staged_tagger_with_no_ambient_pointer(self):
        """The model the sidecar names must be the model the tagging uses.

        `row_provenance` used to call `nltk.data.find` on nltk's ambient search
        path, which never consults `features.nltk_data_dir` -- the ONE place
        the staged directory is decided (doctrine 1). Production qualification
        run 1 staged the model under `lyric-harness/data/nltk`, exported no
        `NLTK_DATA`, and `curves` refused in 1.8s of a 2400s budget.

        The assertion is EQUALITY between an environment that points at the
        staged model and one that says nothing, not merely "it did not
        raise" -- because the silent half of the defect is a box that HAS an
        ambient copy, where the old code returned a fingerprint of bytes no
        measurement ever touched. Neither half survives an equal sha. `HOME`
        moves so a stray `~/nltk_data` cannot decide the answer either way.
        """
        import subprocess
        staged = os.path.abspath(os.path.join(ROOT, "data", "nltk"))
        script = ("import json,sys;sys.path.insert(0,%r);"
                  "from quality import length_curve_calibration as lc;"
                  "print(json.dumps(lc.row_provenance()))" % str(ROOT))

        def provenance(**overrides):
            env = {k: v for k, v in os.environ.items() if k != "NLTK_DATA"}
            with tempfile.TemporaryDirectory() as elsewhere:
                env["HOME"] = elsewhere
                env.update({k: v for k, v in overrides.items() if v is not None})
                return subprocess.run([sys.executable, "-c", script], cwd=str(ROOT),
                                      env=env, capture_output=True, text=True)

        silent = provenance()
        self.assertEqual(silent.returncode, 0, silent.stderr)
        told = provenance(NLTK_DATA=staged)
        self.assertEqual(told.returncode, 0, told.stderr)
        self.assertEqual(json.loads(silent.stdout)["tagger_sha256"],
                         json.loads(told.stdout)["tagger_sha256"])
        self.assertTrue(json.loads(silent.stdout)["tagger_sha256"])

        # And the refusal still reaches an operator who really has no model:
        # a guard whose failing branch cannot fire is decoration (doctrine 48).
        with tempfile.TemporaryDirectory() as bare:
            hidden = provenance(LYRIC_STAGED_DATA=bare, NLTK_DATA=bare)
            self.assertNotEqual(hidden.returncode, 0)
            self.assertIn("requires the staged English tagger", hidden.stderr)

    def test_saved_rows_refuse_missing_and_duplicate_shards(self):
        from quality import length_curve_calibration as lc
        row = {"file": "fixture", "author": "author", "title": "song", "n_lines": 2,
               "n_tokens": 10, "mattr": .8, "fwr": .3, "anaphora": 0,
               "cv": .1, "predictability": .2}
        with tempfile.TemporaryDirectory() as directory, patch.object(lc, "row_provenance", return_value={"version": 1}):
            first, second = (Path(directory) / name for name in ("first.tsv", "second.tsv"))
            lc.write_rows([row], first, shard="1/2")
            lc.write_rows([{**row, "title": "second"}], second, shard="2/2")
            self.assertEqual(len(lc.read_rows([first, second], verify=True)), 2)
            for paths in ([first], [first, first], [first, second, second]):
                with self.assertRaisesRegex(ValueError, "complete, unique shard coverage"):
                    lc.read_rows(paths, verify=True)

    def test_parallel_held_out_is_exactly_the_sequential_seed_population(self):
        from quality import length_curve_calibration as lc
        import math
        rows = [{"file": str(i // 4), "n_tokens": 10 + i, "x": math.log(10 + i),
                 "i": i, "bin": 0, "mattr": .5 + (i % 11) / 25} for i in range(120)]
        bins = [{"k": 0, "x_med": math.log(70)}]
        sequential = lc.held_out(rows, bins, ["mattr"], 2, verbose=False, bands=[("fixture", 10, 129)])
        parallel = lc.held_out(rows, bins, ["mattr"], 2, verbose=False, bands=[("fixture", 10, 129)], workers=2)
        self.assertEqual(parallel, sequential)
        self.assertEqual(sequential[3], 2)
        self.assertNotEqual(sequential[5][0], sequential[5][1])

    def test_structure_parts_bind_source_and_comparator(self):
        from quality import structure_census as census
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "eng_fixture.txt"
            path.write_text("--- TITLE: song\nThe cat sat\n")
            first = census.part_fingerprint(path, "judge-a")
            self.assertNotEqual(first, census.part_fingerprint(path, "judge-b"))
            path.write_text("--- TITLE: song\nThe dog slept\n")
            self.assertNotEqual(first, census.part_fingerprint(path, "judge-a"))

    def test_release_manifest_refuses_ambiguous_decisions_and_file_shapes(self):
        from quality import release_assets as assets
        import copy
        original = assets.manifest()
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "manifest.json"
            for key, bad in (("runtime", "false"), ("files", [])):
                value = copy.deepcopy(original)
                value["assets"][0][key] = bad
                path.write_text(json.dumps(value))
                with self.assertRaises(ValueError):
                    assets.manifest(path)
            for key, bad in (("path", "../outside"), ("bytes", True), ("sha256", "x" * 64)):
                value = copy.deepcopy(original)
                value["assets"][0]["files"][0][key] = bad
                path.write_text(json.dumps(value))
                with self.assertRaises(ValueError):
                    assets.manifest(path)

    def test_band_check_proves_population_count_and_refuses_missing_measurements(self):
        from quality import song_profile_calibration as calibration
        profile = next(p for p in calibration.PROFILES if p.name == "song")
        full = {f: profile.percentiles[key] for f, key in calibration.FLOOR_KEY.items()}
        keys = {"mattr": "mattr", "fwr": "function_word_ratio", "anaphora": "anaphora",
                "cv": "line_length_cv", "predictability": "predictability", "ANY": "ANY", "cliche": "cliche"}
        rates = {name: profile.held_out_fpr[key] for name, key in keys.items()}
        slopes = {"anaphora": calibration.PROFILE_PERIOD["song"]}
        def check(count, values=full):
            with contextlib.redirect_stdout(io.StringIO()):
                return calibration.check_shipped(profile.lo, profile.hi, values, rates, slopes, n_human=count)
        self.assertEqual(check(profile.n_human), calibration.EXIT_OK)
        self.assertEqual(check(profile.n_human + 1), calibration.EXIT_DRIFT)
        self.assertEqual(check(None), calibration.EXIT_NO_VERDICT)
        self.assertEqual(check(profile.n_human, {**full, "mattr": float("nan")}), calibration.EXIT_NO_VERDICT)

    def test_short_band_proves_its_declared_unadopted_predictability_disposition(self):
        from quality import song_profile_calibration as calibration
        profile = next(p for p in calibration.PROFILES if p.name == "short")
        full = {f: profile.percentiles.get(key, 1.0) for f, key in calibration.FLOOR_KEY.items()}
        keys = {"mattr": "mattr", "fwr": "function_word_ratio", "anaphora": "anaphora",
                "cv": "line_length_cv", "ANY": "ANY", "cliche": "cliche"}
        rates = {name: profile.held_out_fpr[key] for name, key in keys.items()}
        rates["predictability"] = (0.0, 0.0, 0.0)
        def check(values):
            with contextlib.redirect_stdout(io.StringIO()):
                return calibration.check_shipped(profile.lo, profile.hi, values, rates,
                    {"anaphora": calibration.PROFILE_PERIOD["short"]}, name="short", n_human=profile.n_human)
        self.assertEqual(check(full), calibration.EXIT_OK)
        self.assertEqual(check({**full, "predictability": .9}), calibration.EXIT_DRIFT)

    def test_curve_gate_checks_ttr_population_at_inclusive_window_boundary(self):
        from quality import length_curve_calibration as curve, floor
        from types import SimpleNamespace
        from contextlib import redirect_stdout
        import io
        rows = [{"n_tokens": n} for n in (49, 50, 51)]
        profile = SimpleNamespace(n_lines=0, curves={"fixture": True}, n_human=3,
                                  mattr_ttr_population={"window": 50, "items": 2})
        args = SimpleNamespace(rows=["fixture.tsv"])
        with patch.object(floor, "PROFILES", [profile]), patch.object(curve, "read_rows", return_value=rows), \
                patch.object(curve, "make_bins", side_effect=RuntimeError("reached curve fitting")), \
                redirect_stdout(io.StringIO()):
            with self.assertRaisesRegex(RuntimeError, "reached curve fitting"):
                curve.cmd_check(args)
            for stale in ({"window": 50, "items": 1}, {"window": 49, "items": 2}, {}):
                profile.mattr_ttr_population = stale
                with self.assertRaises(SystemExit) as refused:
                    curve.cmd_check(args)
                self.assertEqual(refused.exception.code, 1)

    def test_source_identity_survives_line_movement_and_detects_body_change(self):
        import importlib.util
        import inspect
        from quality.source_identity import definition_source
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "identity_fixture.py"
            source = "def preceding():\n    return 1\n\ndef measured():\n    return 2\n"
            path.write_text(source)
            spec = importlib.util.spec_from_file_location("identity_fixture", path)
            module = importlib.util.module_from_spec(spec)
            sys.modules[spec.name] = module
            try:
                spec.loader.exec_module(module)
                expected = inspect.getsource(module.measured)
                self.assertEqual(definition_source(module.measured), expected)
                path.write_text("# unrelated line\n# another unrelated line\n" + source)
                self.assertNotEqual(inspect.getsource(module.measured), expected,
                                    "the old line-offset mechanism hashes the wrong definition")
                self.assertEqual(definition_source(module.measured), expected)
                path.write_text(path.read_text().replace("return 2", "return 3"))
                self.assertNotEqual(definition_source(module.measured), expected)
            finally:
                sys.modules.pop(spec.name, None)

    def test_sqlite_field_cache_eviction_preserves_exact_values_and_namespaces(self):
        import sqlite3
        from quality.calibration_rebuild import SQLiteFields, BoundedCache
        database = sqlite3.connect(":memory:")
        database.execute("CREATE TABLE fields (fingerprint TEXT, word TEXT, value BLOB, PRIMARY KEY(fingerprint,word))")
        cache = SQLiteFields(database, "judge-a", 1)
        first, second = [("love", 1, .99)], [("sky", 2, .91)]
        cache["above"], cache["high"] = first, second
        self.assertEqual(len(cache.decoded), 1)
        self.assertEqual(cache["above"], first)
        self.assertEqual(cache["high"], second)
        self.assertEqual(set(cache), {"above", "high"})
        other = SQLiteFields(database, "judge-b", 1)
        self.assertNotIn("above", other)
        with self.assertRaises(KeyError):
            other["above"]
        projection = BoundedCache(1)
        projection["above"], projection["high"] = ["love"], ["sky"]
        self.assertEqual(list(projection), ["high"])
        database.close()

    def test_field_checkpoint_rejects_executable_pickle_globals(self):
        from quality.calibration_rebuild import decode_field
        value = [("love", 4, .8)]
        self.assertEqual(decode_field(pickle.dumps(value)), value)
        with self.assertRaisesRegex(ValueError, "primitive values only"):
            decode_field(pickle.dumps(os.system))

    def test_editorial_staging_removes_prose_and_preserves_adjacent_verse(self):
        import lyric_harness as lh
        corpus = ROOT / "corpus" / "song"
        herrick = lh.load_lyric_lines(corpus / "eng_british_robert_herrick.txt")
        self.assertIn("The quarrelets of Pearl.", herrick)
        self.assertNotIn("_Quarrelets_, little squares.", herrick)
        hemans = lh.load_lyric_lines(corpus / "eng_british_felicia_hemans.txt")
        self.assertIn("Banners are in the field!", hemans)
        self.assertNotIn("they continue arming themselves_.", hemans)
        self.assertNotIn("of Saragossa always tolled spontaneously before a king of Spain died.", hemans)
        from quality.lyric_reader import calibration_items
        durfey = list(calibration_items(corpus / "eng_hall_thomas_durfey.txt"))
        second = [body for title, _at, body in durfey if "BERENCLOW" in title]
        self.assertEqual(len(second), 1)
        self.assertEqual(len(second[0]), 16, "restored separate song survives deduplication")
        table = (ROOT / "data" / "song_endword_en.tsv").read_text()
        self.assertNotIn("emmett\teng_parlour_daniel_decatur_emmett\t", table)

    def test_release_gate_binds_decision_and_exact_bytes(self):
        from quality import release_assets as r
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            data = root / "data"
            data.mkdir()
            payload = data / "fixture.txt"
            payload.write_text("approved bytes")
            record = {"id": "fixture", "base": "root", "runtime": True, "decision": "approved",
                      "files": [{"path": "data/fixture.txt", "bytes": payload.stat().st_size,
                                 "sha256": hashlib.sha256(payload.read_bytes()).hexdigest()}]}
            manifest = root / "manifest.json"
            manifest.write_text(json.dumps({"version": 1, "assets": [record]}))
            self.assertTrue(r.inventory(root=root, staged=data, manifest_path=manifest)["ok"])
            record["decision"] = "unresolved"
            manifest.write_text(json.dumps({"version": 1, "assets": [record]}))
            self.assertFalse(r.inventory(root=root, staged=data, manifest_path=manifest)["ok"])
            record["decision"] = "approved"
            manifest.write_text(json.dumps({"version": 1, "assets": [record]}))
            payload.write_text("corrupted bytes")
            self.assertFalse(r.inventory(root=root, staged=data, manifest_path=manifest)["ok"])

    def test_staging_refuses_nonempty_corruption_and_empty_package_dirs(self):
        from quality import fetch_data as staging
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            bad = root / "norms.txt"
            bad.write_text("not the declared norms")
            with patch.object(staging, "download_to", side_effect=AssertionError("network must not run")):
                with self.assertRaisesRegex(ValueError, "checksum mismatch"):
                    staging._get("https://example.invalid/fixture", bad, "0" * 64)
            package = root / "nltk" / "taggers" / "fixture"
            package.mkdir(parents=True)
            asset = {"id": "fixture", "base": "staged", "runtime": True,
                     "directory": "nltk/taggers/fixture", "files": [
                         {"path": "nltk/taggers/fixture/model.json", "bytes": 1, "sha256": "0" * 64}]}
            with patch.object(staging, "DATA", str(root)), patch.object(staging, "_ASSETS", {"fixture": asset}):
                with self.assertRaisesRegex(ValueError, "missing"):
                    staging.fetch_all(runtime=True)

    def test_release_root_selects_its_own_manifest_for_assembly_and_cli(self):
        from quality import release_assets as r
        import subprocess
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "source"
            data = root / "data"
            data.mkdir(parents=True)
            (root / "quality").mkdir()
            (root / "lyric_harness.py").write_text("# runtime fixture\n")
            payload = data / "fixture.txt"
            payload.write_text("root-specific approved bytes")
            record = {"id": "fixture", "base": "root", "runtime": True, "decision": "approved",
                      "files": [{"path": "data/fixture.txt", "bytes": payload.stat().st_size,
                                 "sha256": hashlib.sha256(payload.read_bytes()).hexdigest()}]}
            source_manifest = data / "runtime_assets.json"
            source_manifest.write_text(json.dumps({"version": 1, "assets": [record]}))
            self.assertEqual(r.verify_asset("fixture", root=root, staged=data), record)
            target = Path(directory) / "assembled"
            self.assertTrue(r.assemble(target, root=root, staged=data)["ok"])
            installed_manifest = target / "data" / "runtime_assets.json"
            self.assertEqual(source_manifest.read_bytes(), installed_manifest.read_bytes())
            args = [sys.executable, r.__file__, "--root", str(target),
                    "--staged-data", str(target / "data"), "--check"]
            before = subprocess.run(args, capture_output=True, text=True, check=False)
            self.assertEqual(before.returncode, 0, before.stdout + before.stderr)
            record["decision"] = "unresolved"
            installed_manifest.write_text(json.dumps({"version": 1, "assets": [record]}))
            after = subprocess.run(args, capture_output=True, text=True, check=False)
            self.assertEqual(after.returncode, 2, after.stdout + after.stderr)
            result = json.loads(after.stdout)
            self.assertFalse(result["ok"])
            self.assertIn("unresolved", " ".join(result["errors"]))
            self.assertEqual(result["manifest_sha256"], r.sha256(installed_manifest))

    def test_missing_item_source_cannot_bypass_terms_by_date(self):
        gate = p.ProvenanceGate(sources={}, authority={
            "old": p.AuthorRecord("old", 1700, verification_source="printed_authority:fixture")})
        for item in [p.Item("a", "eng", "missing", author_key="old"),
                     p.Item("b", "eng", "missing", pub_year=1800)]:
            self.assertEqual(gate.admit(item)[0], p.REJECT_UNDECLARED_SOURCE)

    def test_anonymous_publication_needs_matching_evidence(self):
        source = p.Source("declared", publication_year=1800)
        gate = p.ProvenanceGate(sources={"declared": source}, authority={})
        item = p.Item("a", "eng", "declared", pub_year=1700)
        self.assertEqual(gate.admit(item)[0], p.REJECT_UNVERIFIED_PUBLICATION)
        source.publication_evidence = "Fixture title page gives 1800"
        self.assertEqual(gate.admit(item)[0], p.REJECT_UNVERIFIED_PUBLICATION)
        item.pub_year = 1800
        self.assertEqual(gate.admit(item)[0], p.ADMIT_PUBLICATION_VERIFIED)
        item.pub_year = 1700
        item.publication_evidence = "Fixture separate first publication gives 1700"
        self.assertEqual(gate.admit(item)[0], p.ADMIT_PUBLICATION_VERIFIED)

    def test_corpus_hash_gate_checks_snapshot_and_local_declaration_independently(self):
        from quality import audit_corpus as audit
        from types import SimpleNamespace
        rel = "corpus/song/eng_fixture.txt"
        source = SimpleNamespace(route=lambda _file, _rel: (audit.ROUTE_HEADER, "upstream"), blobs={})
        file = SimpleNamespace(md5="a" * 32, sha256="b" * 64)
        snapshot = {rel: (file.md5, 2, "2026-09-08")}
        self.assertEqual(audit.check_hash([(rel, file)], source, snapshot=snapshot), [])
        missing = audit.check_hash([(rel, file)], source, snapshot={})
        self.assertTrue(any(f.severity == audit.WARN for f in missing))
        drifted = {rel: ("c" * 32, 2, "2026-09-08")}
        self.assertTrue(any(f.severity == audit.FAIL for f in
                            audit.check_hash([(rel, file)], source, snapshot=drifted)))
        source.route = lambda _file, _rel: (audit.ROUTE_LOCAL, "local:" + rel)
        source.blobs["local:" + rel] = "md5 " + "c" * 32
        self.assertTrue(any(f.severity == audit.FAIL for f in
                            audit.check_hash([(rel, file)], source, snapshot=snapshot)))
        source.blobs["local:" + rel] = "md5 " + file.md5
        self.assertEqual(audit.check_hash([(rel, file)], source, snapshot=snapshot), [])
        self.assertTrue(any(f.severity == audit.FAIL for f in
                            audit.check_hash([(rel, file)], source, snapshot=drifted)))

    def test_enclitic_audit_counts_disjoint_spellings_without_false_dominance(self):
        from quality import audit_corpus as audit
        from types import SimpleNamespace
        texts = {
            "spaced": "There ’s joy. We 'll sing. They 're here.",
            "attached": "There's joy. We'll sing. They're here.",
            "tie": "There's joy. We 'll sing.",
            "mostly_attached": "There's joy. We'll sing. They 're here.",
            "neither": "'twas 'ithin o' a' 'oman",
        }
        files = [("corpus/song/eng_" + name + ".txt",
                  SimpleNamespace(text=value, header_fields=lambda: {}))
                 for name, value in texts.items()]
        findings = audit.check_enclitic_convention(files, None)
        self.assertEqual(len(findings), 2)
        self.assertIn("attached-only 1, spaced-only 1, both 2", findings[0].what)
        self.assertEqual(findings[1].path, "corpus/song/eng_spaced.txt")
        self.assertIn("3 spaced against 0 attached", findings[1].what)

    def test_audit_main_honors_explicit_argv_shape_gate(self):
        from quality import audit_corpus as audit
        with patch.object(audit, "audit", return_value=([], [])), \
                patch.object(audit, "_verify_shape", return_value=7) as verify, \
                contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(audit.main(["--verify-shape"]), 7)
        verify.assert_called_once_with([], [])

    def test_corpus_snapshot_refuses_duplicate_weak_and_unbound_rows(self):
        from quality import corpus_manifest as manifest
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "manifest.tsv"
            header = "file\tmd5\tlines\tsnapshot\n"
            row = "corpus/song/eng_fixture.txt\t" + "a" * 32 + "\t2\t2026-09-08\n"
            with patch.object(manifest, "MANIFEST", str(path)):
                path.write_text(header + row)
                self.assertEqual(len(manifest.read_manifest()), 1)
                for bad in (header, header + row + row, header + row.replace("a" * 32, "abcd"),
                            header + row.replace("corpus/song/", "../"),
                            header + row.replace("\t2\t", "\t-2\t"),
                            header + row.replace("2026-09-08", "2026-99-08")):
                    path.write_text(bad)
                    with self.assertRaises(ValueError):
                        manifest.read_manifest()

    def test_snapshot_actual_cli_publishes_a_bound_pair_and_preserves_it_on_owner_failure(self):
        import subprocess
        import shutil
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "harness"
            quality = root / "quality"
            quality.mkdir(parents=True)
            (root / "data").mkdir()
            (root / "corpus" / "song").mkdir(parents=True)
            (root / "corpus" / "song" / "eng_fixture.txt").write_text("--- TITLE: fixture\nA line\n")
            (quality / "__init__.py").write_text("")
            (quality / "lyric_reader.py").write_text("def population_fingerprint(): return 'fixture-reader'\n")
            script = quality / "corpus_manifest.py"
            shutil.copyfile(cm.__file__, script)
            for _label, module in cm.CALIBRATED:
                (quality / (module.split('.')[-1] + '.py')).write_text(
                    "from pathlib import Path\ndef corpus_files():\n"
                    " return [str(Path(__file__).resolve().parents[1] / 'corpus/song/eng_fixture.txt')]\n")
            def run(*args):
                return subprocess.run([sys.executable, str(script), *args], cwd=directory,
                                      capture_output=True, text=True, check=False)
            published = run("--write", "2026-09-08")
            self.assertEqual(published.returncode, 0, published.stdout + published.stderr)
            manifest = root / "data" / "calibration_manifest.tsv"
            population = root / "data" / "calibration_populations.json"
            original = manifest.read_bytes(), population.read_bytes()
            self.assertEqual(run("--check").returncode, 0)
            manifest.write_text(manifest.read_text().replace("2026-09-08", "2026-09-09"))
            split = run("--check")
            self.assertEqual(split.returncode, 2, split.stdout + split.stderr)
            self.assertIn("different publications", split.stdout)
            manifest.write_bytes(original[0])
            (quality / "capacity.py").write_text("def corpus_files(): raise ValueError('planted owner failure')\n")
            failed = run("--write", "2026-09-10")
            self.assertEqual(failed.returncode, 2, failed.stdout + failed.stderr)
            self.assertEqual((manifest.read_bytes(), population.read_bytes()), original)

    def test_removed_english_member_still_owes_every_previous_adoption(self):
        deleted = "corpus/song/eng_hymn_watts.txt"
        self.assertEqual({module for _label, module in cm.CALIBRATED}, {
            "quality.meter_bands", "quality.song_profile_calibration",
            "quality.length_curve_calibration", "quality.build_song_frequency",
            "quality.structure_census", "quality.capacity"})
        historical = {module: [deleted] for _label, module in cm.CALIBRATED}
        with patch.object(cm, "_population", return_value=set()):
            hits, unaskable = cm.readoption_owed([deleted], historical)
        self.assertFalse(unaskable)
        self.assertEqual(len(hits), len(cm.CALIBRATED))
        self.assertTrue(all(inside == [deleted] for _label, inside in hits))
        with patch.object(cm, "_population", return_value=set()):
            self.assertEqual(cm.readoption_owed(["corpus/song/non_unrelated.txt"], historical), ([], []))

    def test_check_carries_deleted_members_into_readoption(self):
        deleted = "corpus/song/eng_hymn_watts.txt"
        captured = []
        def owed(drifted):
            captured.extend(drifted)
            return [("meter bands", [deleted])], []
        with patch.object(cm, "read_manifest", return_value={deleted: ("old", 1, "old")}), \
             patch.object(cm, "scan", return_value=[]), patch.object(cm, "readoption_owed", owed), \
             contextlib.redirect_stdout(io.StringIO()) as out:
            self.assertEqual(cm.check(), 3)
        self.assertEqual(captured, [deleted])
        self.assertIn("RE-ADOPTION IS OWED", out.getvalue())
        self.assertNotIn("NO RE-ADOPTION", out.getvalue())

    def test_current_calibration_readers_match_runtime_source_rows(self):
        import lyric_harness as lh
        from quality import meter_bands as mb, song_profile_calibration as sp, structure_census as sc
        from quality.lyric_reader import normalized_rows, calibration_items
        for name in ["eng_parlour_daniel_decatur_emmett.txt", "eng_british_richard_lovelace.txt",
                     "eng_hymn_watts.txt", "eng_hall_thomas_durfey.txt"]:
            path = ROOT / "corpus" / "song" / name
            expected = lh.load_lyric_lines(path)
            self.assertEqual([r.text for r in normalized_rows(path) if r.kind == "lyric"], expected)
            expected = [row.text for _title, _at, body in calibration_items(path) for row in body]
            self.assertEqual([text for _number, text in mb.lyric_lines(path)], expected)
            self.assertEqual([text for _title, body in sp.items_in(path) for text in body], expected)
            self.assertEqual([text for body in sc.items_of(path) for text in body], expected)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "plain.txt"
            path.write_text("[VERSE]\n  A real line\n\n[CHORUS]\n    Another line\n")
            self.assertEqual(lh.load_lyric_lines(path, with_indent=True), [(2, "A real line"), (4, "Another line")])

    def test_explicit_work_votes_preserve_sources_and_distinct_shared_titles(self):
        from quality.lyric_reader import lyric_items, calibration_items, _edition_policy
        path = ROOT / "corpus/song/eng_british_william_blake.txt"
        raw = list(lyric_items(path))
        selected = list(calibration_items(path))
        self.assertEqual(sum(t == "The Garden Of Love" for t, _, _ in raw), 2)
        self.assertEqual(sum(t == "The Garden Of Love" for t, _, _ in selected), 1)
        self.assertTrue(any(t == "I laid me down upon a bank" and len(body) == 8 for t, _, body in selected))
        path = ROOT / "corpus/song/eng_hymn_montgomery.txt"
        selected = {at for _title, at, _body in calibration_items(path)}
        self.assertTrue({47, 821}.issubset(selected), "distinct psalm paraphrases share closing verses")
        with patch.dict(_edition_policy(), {(path.relative_to(ROOT).as_posix(), 47): {
                "title": "wrong title", "body_sha256": "0" * 64, "weight": 1}}):
            with self.assertRaisesRegex(ValueError, "edition drift"):
                list(calibration_items(path))


if __name__ == "__main__":
    unittest.main()
