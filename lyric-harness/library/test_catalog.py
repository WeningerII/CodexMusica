"""Catalog source fidelity and refusal tests; no external resources."""
import copy
import gzip
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

from library.catalog import (CatalogError, Coordinates, IdentityRegistry, RightsResolver,
    build, build_reading, canonical, dcs_units, hafez_units, load_reading, marked_units, physical_rows,
    registry_seed_bytes, search_projection, sha, stable, u16, validate_reading)
from library.catalog_site_export import compact_summary, export_snapshot, verify_export, gunzip_checked


class CatalogTests(unittest.TestCase):
    def test_export_schema_accepts_producer_metadata_and_refuses_malformed_metadata(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp) / "harness"; (root / "corpus/song").mkdir(parents=True); (root / "data").mkdir()
            (root / "corpus/song/eng_fixture.txt").write_text("--- TITLE: Schema witness\nAllowed source.\n")
            (root / "data/sources.tsv").write_text("source_id\tlicence\tpd_affirmed\tevidence\nlocal:corpus/song/eng_fixture.txt\tpublic domain\ttrue\trecorded\n")
            canonical_dir = root / "library/snapshot"
            built = build(root, canonical_dir, "a" * 40)
            without_labels = export_snapshot(canonical_dir, Path(temp) / "without-labels")
            self.assertEqual(without_labels["derived_metadata"], {"version": 1, "label_registry_sha256": None})
            label_bytes = canonical({"version": 1, "prefixes": []})
            (root / "data/lyric_label_prefixes.json").write_bytes(label_bytes)
            with_labels = export_snapshot(canonical_dir, Path(temp) / "with-labels")
            self.assertEqual(with_labels["derived_metadata"], {"version": 1, "label_registry_sha256": sha(label_bytes)})
            self.assertEqual(with_labels["snapshot_id"], built["snapshot_id"])
            cases = [{"name": "observed null registry", "value": without_labels, "valid": True},
                     {"name": "observed hashed registry", "value": with_labels, "valid": True}]
            malformed = [{"version": 2, "label_registry_sha256": sha(label_bytes)},
                         {"version": 1}, {"label_registry_sha256": sha(label_bytes)},
                         {"version": 1, "label_registry_sha256": "a" * 63},
                         {"version": 1, "label_registry_sha256": "A" * 64},
                         {"version": 1, "label_registry_sha256": 1},
                         {"version": 1, "label_registry_sha256": None, "unregistered": True},
                         None, []]
            for i, metadata in enumerate(malformed):
                value = copy.deepcopy(with_labels); value["derived_metadata"] = metadata
                cases.append({"name": "malformed metadata " + str(i), "value": value, "valid": False})
            extra = copy.deepcopy(with_labels); extra["unregistered"] = True
            cases.append({"name": "unregistered descriptor field", "value": extra, "valid": False})
            schema = json.loads(Path(__file__).with_name("catalog_export.schema.json").read_text())
            # Ajv 6 is an existing repository dev dependency. This schema uses
            # shared Draft 7/2020 assertions and local JSON Pointer references;
            # remove only the dialect header, not any validation assertion.
            script = """const fs=require('fs'),Ajv=require('ajv');
const input=JSON.parse(fs.readFileSync(0,'utf8'));
delete input.schema.$schema;
const validate=new Ajv({allErrors:true}).compile(input.schema);
for(const item of input.cases) {
  if(validate(item.value)!==item.valid) {
    console.error(item.name,JSON.stringify(validate.errors));process.exit(1);
  }
}
"""
            checked = subprocess.run(["node", "-e", script],
                                     input=json.dumps({"schema": schema, "cases": cases}), text=True,
                                     capture_output=True, timeout=15, cwd=Path(__file__).resolve().parents[2])
            self.assertEqual(checked.returncode, 0, checked.stdout + checked.stderr)

    def test_gzip_seed_preserves_plain_snapshot_identity_and_explicit_loading(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp) / "harness"; (root / "corpus/song").mkdir(parents=True); (root / "data").mkdir()
            (root / "corpus/song/eng_fixture.txt").write_text("--- TITLE: A\nUnicode 😀 witness.\n")
            (root / "data/sources.tsv").write_text("source_id\tlicence\tpd_affirmed\tevidence\nlocal:corpus/song/eng_fixture.txt\tpublic domain\ttrue\trecorded\n")
            first = build(root, Path(temp) / "plain", "a" * 40, write_registry=True)
            plain = root / "data/library_identity_registry.json"; raw = plain.read_bytes()
            compressed = root / "data/library_identity_registry.json.gz"
            encoded = registry_seed_bytes(json.loads(raw), compressed=True)
            self.assertEqual(gzip.decompress(encoded), raw)
            compressed.write_bytes(encoded); plain.unlink()
            second = build(root, Path(temp) / "gzip-default", "a" * 40, write_registry=True)
            self.assertEqual(first, second)
            self.assertEqual(compressed.read_bytes(), encoded)
            self.assertFalse(plain.exists())
            third = build(root, Path(temp) / "gzip-explicit", "a" * 40, registry_path=compressed)
            self.assertEqual(first, third)

    def reading(self, raw, unit, rel="corpus/song/fas_fixture.txt"):
        source = raw.decode(); registry = IdentityRegistry()
        body = "\n".join(r["text"] for r in unit["rows"] if r["kind"] == "lyric")
        identity = registry.resolve(rel, unit, sha(body.encode()))
        rights = {"availability": "readable"}
        return build_reading(rel, source, sha(raw), unit, identity, {}, rights, "fas", stable("collection", rel))

    def test_unicode_crlf_and_normalization_roundtrip(self):
        raw = "# author: Test\r\n--- TITLE: A\r\n[VERSE 1]\r\n  آ😀ب  \r\n\r\n".encode()
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "fas_fixture.txt"; path.write_bytes(raw)
            _, rows = physical_rows(raw)
            unit = marked_units(path, rows)[0]
            reading = self.reading(raw, unit)
        validate_reading(reading, raw)
        self.assertEqual(reading["normalized_text"], "آ😀ب")
        lyric = next(r for r in reading["lines"] if r["kind"] == "lyric")
        self.assertEqual(lyric["normalized_cp_range"], [0, 3])
        self.assertEqual(lyric["normalized_utf16_range"], [0, 4])
        exact = next(s for s in lyric["transformation_spans"] if s["kind"] == "unchanged")
        a, b = exact["byte_range"]
        self.assertEqual(raw[a:b].decode(), "آ😀ب")
        self.assertEqual(reading["source_marks"][0]["name"], "VERSE 1")

    def test_sanskrit_pretitle_prelude_is_not_dropped(self):
        raw = "# author: Jayadeva\n[SLOKA 1]\nmeghair meduram\n--- TITLE: First song\n[VERSE 1]\nśrita kamalā\n".encode()
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "san_fixture.txt"; path.write_bytes(raw)
            _, rows = physical_rows(raw); units = marked_units(path, rows)
        self.assertEqual(len(units), 2)
        self.assertEqual(units[0]["completeness"], "contiguous_source_segment")
        self.assertEqual([r["text"] for r in units[0]["rows"] if r["kind"] == "lyric"], ["meghair meduram"])

    def test_native_hafez_fields_and_escapes(self):
        text = '[\n {"id": 7, "poem": ["آ😀", "\\u0628"]}\n]'
        raw = text.encode(); _, rows = physical_rows(raw)
        unit = hafez_units(Path("fas_hafez.json"), text, rows)[0]
        reading = self.reading(raw, unit, "corpus/fas_hafez.json")
        validate_reading(reading, raw)
        self.assertEqual(reading["normalized_text"], "آ😀\nب")
        self.assertEqual(reading["native_id"], 7)
        self.assertEqual(reading["lines"][0]["source_ranges"][0]["precision"], "exact")
        self.assertEqual(reading["lines"][1]["source_ranges"][0]["precision"], "span")
        self.assertEqual(reading["lines"][1]["couplet"], 1)
        with self.assertRaisesRegex(CatalogError, "uncleared"):
            hafez_units(Path("x"), '[{"id":1,"poem":["a"],"mp3":"x"}]', rows)

    def test_dcs_native_pada_offsets(self):
        raw = "# header\nGītagovinda\tchapter.conllu\t1\t2\tvasantatilaka\tnamed\tśrita kamala | rādhā mādhava\n".encode()
        text, rows = physical_rows(raw)
        unit = dcs_units(Path("san_dcs_verse.txt"), rows)[0]
        reading = self.reading(raw, unit, "corpus/san_dcs_verse.txt")
        validate_reading(reading, raw)
        self.assertEqual(reading["normalized_text"], "śrita kamala\nrādhā mādhava")
        self.assertEqual(reading["native_fields"]["half"], "2")
        self.assertEqual(reading["completeness"], "documented_excerpt")
        for row in reading["lines"]:
            a, b = row["source_ranges"][0]["codepoint_range"]
            self.assertEqual(text[a:b], row["text"])

    def test_first_seen_identical_items_remain_distinct(self):
        registry = IdentityRegistry()
        a = registry.resolve("a", {"title": "Generic", "anchor": "line:2"}, "body")
        b = registry.resolve("a", {"title": "Generic", "anchor": "line:8"}, "body")
        self.assertNotEqual(a["reading_unit_id"], b["reading_unit_id"])
        self.assertNotEqual(a["work_id"], b["work_id"])

    def test_moving_lines_preserves_identity_ambiguity_refuses(self):
        first = IdentityRegistry()
        a = first.resolve("a", {"title": "A", "anchor": "line:2"}, "body")
        value = copy.deepcopy(first.value)
        moved = IdentityRegistry(value).resolve("a", {"title": "A", "anchor": "line:12"}, "body")
        self.assertEqual(a["reading_unit_id"], moved["reading_unit_id"])
        first.resolve("a", {"title": "B", "anchor": "line:8"}, "body")
        with self.assertRaisesRegex(CatalogError, "ambiguous"):
            IdentityRegistry(copy.deepcopy(first.value)).resolve("a", {"title": "C", "anchor": "line:20"}, "body")

    def test_explicit_lineage_retains_identity_after_anchor_and_population_change(self):
        first = IdentityRegistry()
        old = first.resolve("a", {"title": "A", "anchor": "line:70"}, "old-body")
        value = copy.deepcopy(first.value)
        value["lineage"]["a#line:73"] = old["reading_unit_id"]
        current = IdentityRegistry(value)
        moved = current.resolve("a", {"title": "A", "anchor": "line:73"}, "apparatus-stripped-body")
        for key in ("reading_unit_id", "work_id", "edition_id", "first_anchor"):
            self.assertEqual(moved[key], old[key])
        self.assertNotIn("a#line:70", current.value["entries"])
        self.assertEqual(list(current.value["entries"]), ["a#line:73"])
        unreviewed = IdentityRegistry(copy.deepcopy(first.value)).resolve("a", {"title": "A", "anchor": "line:73"}, "apparatus-stripped-body")
        self.assertNotEqual(unreviewed["reading_unit_id"], old["reading_unit_id"])

    def test_declared_prefix_keeps_source_offsets_and_export_sidecar(self):
        from quality import lyric_reader
        raw = ("# author: Test\r\n--- TITLE: Labelled source\r\n"
               "# APPARATUS: printed speaker label\r\n  _Polly._ آ😀 sung words\r\n").encode()
        prefix = "_Polly._ "
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp) / "harness"; song = root / "corpus/song"; song.mkdir(parents=True); (root / "data").mkdir()
            path = song / "eng_fixture.txt"; path.write_bytes(raw)
            labels = root / "data/lyric_label_prefixes.json"
            labels.write_text(json.dumps({"version": 1, "prefixes": [{"file": path.name, "line": 4, "prefix": prefix, "kind": "speaker-or-stage-direction"}]}))
            (root / "data/sources.tsv").write_text("source_id\tlicence\tpd_affirmed\tevidence\nlocal:corpus/song/eng_fixture.txt\tpublic domain\ttrue\trecorded\n")
            canonical_dir = root / "library/snapshot"; export_dir = Path(temp) / "export"
            lyric_reader._label_prefixes.cache_clear()
            try:
                with patch.object(lyric_reader, "CORPUS_SONG", song), patch.object(lyric_reader, "LABEL_PREFIXES", labels):
                    build(root, canonical_dir, "a" * 40)
            finally:
                lyric_reader._label_prefixes.cache_clear()
            index = json.loads((canonical_dir / "index.json").read_bytes()); summary = index["readings"][0]
            original = (canonical_dir / summary["path"]).read_bytes(); reading = json.loads(original)
            validate_reading(reading, raw)
            self.assertEqual(reading["normalized_text"], "آ😀 sung words")
            lyric = next(row for row in reading["lines"] if row["kind"] == "lyric")
            self.assertEqual(lyric["physical_lineno"], 4)
            self.assertEqual(lyric["source_text"], "  " + prefix + "آ😀 sung words")
            apparatus = next(row for row in reading["lines"] if row["physical_line"] == 3)
            self.assertEqual(apparatus["kind"], "apparatus")
            self.assertIsNone(apparatus["normalized_cp_range"])
            exact = next(span for span in lyric["transformation_spans"] if span["kind"] == "unchanged")
            text = raw.decode(); sung_start = text.index("آ😀 sung words")
            self.assertEqual(exact["normalized_cp_range"], [0, len(reading["normalized_text"])])
            self.assertEqual(exact["source_cp_range"][0], sung_start)
            self.assertEqual(exact["source_utf16_range"][0], u16(text[:sung_start]))
            self.assertEqual(exact["byte_range"][0], len(text[:sung_start].encode()))
            descriptor = export_snapshot(canonical_dir, export_dir)
            rows = [row for pack in descriptor["packs"] if pack["kind"] == "readings"
                    for row in json.loads(gunzip_checked(export_dir / pack["path"], pack["raw_bytes"]))["readings"]]
            self.assertEqual(canonical(rows[0]["reading"]), original)
            label = rows[0]["source_labels"][0]
            a, b = label["byte_range"]
            self.assertEqual(raw[a:b].decode(), prefix)
            self.assertEqual(label["codepoint_range"], [sung_start - len(prefix), sung_start])
            self.assertEqual(label["registry_sha256"], sha(labels.read_bytes()))
            self.assertEqual(descriptor, verify_export(export_dir))

    def test_reviewed_work_groups_editions_without_hiding(self):
        registry = IdentityRegistry()
        a = registry.resolve("a", {"title": "A", "anchor": "line:2"}, "one", "reviewed-1", "PG1")
        b = registry.resolve("a", {"title": "B", "anchor": "line:8"}, "two", "reviewed-1", "PG2")
        self.assertEqual(a["work_id"], b["work_id"])
        self.assertNotEqual(a["edition_id"], b["edition_id"])
        self.assertNotEqual(a["reading_unit_id"], b["reading_unit_id"])

    def test_export_joins_reviewed_work_and_preserves_complete_refusal(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp) / "harness"; (root / "corpus/song").mkdir(parents=True); (root / "data").mkdir()
            (root / "corpus/song/eng_fixture.txt").write_text("--- TITLE: A\nOne witness.\n--- TITLE: B\nSecond witness.\n--- TITLE: C\nIndependent item.\n")
            (root / "data/sources.tsv").write_text("source_id\tlicence\tpd_affirmed\tevidence\nlocal:corpus/song/eng_fixture.txt\tpublic domain\ttrue\trecorded\n")
            policy = {"works": [{"file": "corpus/song/eng_fixture.txt", "work_id": "reviewed-group", "editions": [
                {"title_line": 1, "title": "A", "body_sha256": sha(b"One witness.")},
                {"title_line": 3, "title": "B", "body_sha256": sha(b"Second witness.")},
            ]}]}
            (root / "data/calibration_work_editions.json").write_text(json.dumps(policy))
            canonical_dir = Path(temp) / "canonical"; export_dir = Path(temp) / "export"
            build(root, canonical_dir, "a" * 40)
            descriptor = export_snapshot(canonical_dir, export_dir)
            rows = [row for pack in descriptor["packs"] if pack["kind"] == "readings"
                    for row in json.loads(gunzip_checked(export_dir / pack["path"], pack["raw_bytes"]))["readings"]]
            flags = {row["summary"]["title"]: row["summary"]["work_reviewed_equivalence"] for row in rows}
            self.assertEqual(flags, {"A": True, "B": True, "C": False})
            self.assertTrue(all("work_equivalence_basis" not in row["summary"] for row in rows))
            self.assertEqual(rows[0]["summary"]["source_basis"]["sources"][0]["licence"], "public domain")
            self.assertEqual(descriptor, verify_export(export_dir))
        reason = {"admission": [{"source_id": "held", "verdict": "held", "reason": "recorded remedy " * 100}], "unresolved": ["scope unknown"]}
        summary = compact_summary({"availability_reason": reason}, {"reviewed_equivalence": True, "equivalence_basis": "reviewed registry declaration"})
        self.assertEqual(summary["availability_reason"], reason)
        self.assertEqual(summary["work_equivalence_basis"], "reviewed registry declaration")

    def test_scope_rejects_unknown_parent_and_noncommercial(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp); (root / "data").mkdir()
            (root / "data/sources.tsv").write_text("source_id\tlicence\tpd_affirmed\tevidence\nlocal:corpus/x.txt\tpublic domain\ttrue\trecorded\nOrg/Allowed_1\tpublic domain\ttrue\trecorded\nOrg/Restricted_2\tcc-by-nc-4.0\ttrue\trecorded\n")
            resolver = RightsResolver(root, IdentityRegistry())
            unit = {"anchor": "1", "rows": [{"text": "--- SOURCE: PG1"}]}
            rights = resolver.resolve("corpus/x.txt", {"source": ["Org/Allowed_1", "Other/Missing_9"]}, unit, "eng")
            self.assertEqual(rights["availability"], "held")
            unit = {"anchor": "1", "rows": [{"text": "--- SOURCE: PG2"}]}
            rights = resolver.resolve("corpus/x.txt", {"source": ["Org/Allowed_1", "Org/Restricted_2"]}, unit, "eng")
            self.assertEqual(rights["availability"], "rejected")
            self.assertEqual([s["source_id"] for s in rights["sources"]], ["local:corpus/x.txt", "Org/Restricted_2"])

    def test_search_preserves_accents_and_original_spans(self):
        projected = search_projection("  Straße\nĀ😀")
        self.assertEqual(projected["text"], " strasse ā😀")
        self.assertEqual(projected["spans"][1]["normalized_cp_range"], [2, 8])

    def test_snapshot_determinism_local_resolver_and_tamper_refusal(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp) / "harness"; (root / "corpus/song").mkdir(parents=True); (root / "data").mkdir()
            (root / "corpus/song/eng_fixture.txt").write_text("# author: Source author\n--- TITLE: A\n  Test source.\n--- TITLE: B\nAnother source.\n")
            (root / "data/sources.tsv").write_text("source_id\tlicence\tpd_affirmed\tevidence\nlocal:corpus/song/eng_fixture.txt\tpublic domain\ttrue\trecorded\n")
            a, b = Path(temp) / "first", Path(temp) / "second"
            first = build(root, a, "a" * 40, write_registry=True)
            second = build(root, b, "a" * 40)
            self.assertEqual(first, second)
            self.assertEqual(first["counts"]["readable_reading_units"], 2)
            index = json.loads((a / "index.json").read_bytes()); item = index["readings"][0]
            result = load_reading(a, first["snapshot_id"], item["reading_unit_id"], item["reading_revision"])
            self.assertEqual(result["normalized_text"], "Test source.")
            with self.assertRaisesRegex(CatalogError, "STALE_READING"):
                load_reading(a, first["snapshot_id"], item["reading_unit_id"], "old")
            (a / item["path"]).write_text("{}")
            with self.assertRaisesRegex(CatalogError, "reading hash mismatch"):
                load_reading(a, first["snapshot_id"], item["reading_unit_id"], item["reading_revision"])

    def test_packed_export_omits_held_body_and_mixed_original(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp) / "harness"; (root / "corpus/song").mkdir(parents=True); (root / "data").mkdir()
            (root / "corpus/song/eng_fixture.txt").write_text("# source: Org/Approved_1\n--- TITLE: Admitted\n--- SOURCE: PG1\nAllowed source.\n--- TITLE: Held\n--- SOURCE: PG9\nHELD_BODY_SENTINEL\n")
            (root / "data/sources.tsv").write_text("source_id\tlicence\tpd_affirmed\tevidence\nlocal:corpus/song/eng_fixture.txt\tpublic domain\ttrue\trecorded\nOrg/Approved_1\tpublic domain\ttrue\trecorded\n")
            canonical_dir = Path(temp) / "canonical"; export_dir = Path(temp) / "export"
            full = build(root, canonical_dir, "a" * 40)
            descriptor = export_snapshot(canonical_dir, export_dir)
            self.assertEqual(descriptor["snapshot_id"], full["snapshot_id"])
            self.assertEqual(descriptor, verify_export(export_dir))
            self.assertTrue(any(r["path"].startswith("sources/") for r in descriptor["omitted"]))
            for pack in descriptor["packs"]:
                raw = gunzip_checked(export_dir / pack["path"], pack["raw_bytes"])
                self.assertNotIn(b"HELD_BODY_SENTINEL", raw)
                self.assertLessEqual(len(raw), 1024 * 1024)
            reading_pack = descriptor["packs"][0]
            path = export_dir / reading_pack["path"]; raw = path.read_bytes(); path.write_bytes(raw[:-1] + bytes([raw[-1] ^ 1]))
            with self.assertRaisesRegex(CatalogError, "gzip hash"):
                verify_export(export_dir)

    def test_oversized_reading_has_bounded_logical_chunks(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp) / "harness"; (root / "corpus/song").mkdir(parents=True); (root / "data").mkdir()
            lines = [f"Line {i} " + "ā😀 source words " * 8 for i in range(1000)]
            (root / "corpus/song/eng_fixture.txt").write_text("--- TITLE: Large source\n" + "\n".join(lines) + "\n")
            (root / "data/sources.tsv").write_text("source_id\tlicence\tpd_affirmed\tevidence\nlocal:corpus/song/eng_fixture.txt\tpublic domain\ttrue\trecorded\n")
            canonical_dir = Path(temp) / "canonical"; export_dir = Path(temp) / "export"
            build(root, canonical_dir, "a" * 40)
            descriptor = export_snapshot(canonical_dir, export_dir)
            self.assertTrue(any(p["kind"] == "reading_chunks" for p in descriptor["packs"]))
            headers = []
            for p in descriptor["packs"]:
                raw = gunzip_checked(export_dir / p["path"], p["raw_bytes"])
                self.assertLessEqual(len(raw), 1024 * 1024)
                if p["kind"] == "readings": headers.extend(json.loads(raw)["readings"])
            header = headers[0]
            self.assertTrue(header["reading_is_header"])
            self.assertNotIn("lines", header["reading"])
            self.assertEqual(header["reading"]["census"]["normalized_lines"], 1000)
            self.assertIn("lines", header["reading_chunks"])
            self.assertEqual(header["reading"]["line_count"], 1001)
            for pack in descriptor["packs"]:
                if pack["kind"] != "reading_chunks" or pack["field"] not in {"lines", "search.spans"}: continue
                body = json.loads(gunzip_checked(export_dir / pack["path"], pack["raw_bytes"]))["value"]
                key = "normalized_cp_range" if pack["field"] == "lines" else "search_cp_range"
                ranges = [row[key] for row in body if row.get(key) is not None]
                self.assertEqual(pack[key], [ranges[0][0], ranges[-1][1]])
                self.assertEqual(pack["value_count"], len(body))
            self.assertEqual(descriptor, verify_export(export_dir))


if __name__ == "__main__": unittest.main()
