"""Download fidelity, mandatory-credit, rights-filter and bounded-part checks."""
import csv
import io
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

from library.catalog import (CatalogError, IdentityRegistry, build_reading, canonical,
                             marked_units, physical_rows, sha, stable)
from library.catalog_downloads import build_downloads, verify_downloads


class DownloadTests(unittest.TestCase):
    def snapshot(self, directory, long=False):
        root = Path(directory)
        (root / "readings").mkdir(parents=True)
        (root / "sources").mkdir()
        notice = "MIT notice\nCopyright © Author\nRetain this credit.\n"
        notice_hash = sha(notice.encode())
        text = 'آ😀, "quoted"\n' + ("\n".join(f"پایان😀 شماره {index}: متن کامل و بدون حذف!" for index in range(3000)) if long else "پایان😀")
        sources = {
            "corpus/song/fas_mixed.txt": "# author: Credited Author\n--- TITLE: Admitted\n[VERSE 1]\n  " + text + "\n--- TITLE: Held\nHELD_BODY_CANARY\n",
            "corpus/song/fas_clear.txt": "# author: Other Author\n--- TITLE: Clear\n[VOICE Ali]\nمتن روشن\n",
            "corpus/song/fas_research.txt": "--- TITLE: Research\nRESEARCH_BODY_CANARY\n",
        }
        artifacts, readings, units = {}, [], []
        identities = IdentityRegistry()
        for rel, source in sources.items():
            raw = source.encode()
            digest = sha(raw)
            source_path = f"sources/{digest}.bin"
            (root / source_path).write_bytes(raw)
            artifacts[source_path] = digest
            _, rows = physical_rows(raw)
            with tempfile.TemporaryDirectory() as files:
                path = Path(files) / Path(rel).name
                path.write_bytes(raw)
                pieces = marked_units(path, rows)
            for piece in pieces:
                availability = "held" if piece["title"] == "Held" else "research_only" if piece["title"] == "Research" else "readable"
                normalized = "\n".join(row["text"] for row in piece["rows"] if row["kind"] == "lyric")
                identity = identities.resolve(rel, piece, sha(normalized.encode()))
                rights = {"availability": availability, "required_attribution": ["Keep Credited Author"],
                          "sources": [{"source_id": "fixture", "licence": "MIT", "evidence": "Fixture evidence"}],
                          "notices": [{"path": "LICENSE", "scope": [rel], "sha256": notice_hash, "text": notice}]}
                reading = build_reading(rel, source, digest, piece, identity, {}, rights, "fas", stable("collection", rel))
                path = f"readings/{reading['reading_unit_id']}.json"
                encoded = canonical(reading)
                (root / path).write_bytes(encoded)
                artifacts[path] = sha(encoded)
                readings.append({"reading_unit_id": reading["reading_unit_id"], "availability": availability,
                                 "source_sha256": digest, "path": path})
                units.append(reading)
        index = {"readings": readings}
        raw = canonical(index)
        (root / "index.json").write_bytes(raw)
        artifacts["index.json"] = sha(raw)
        manifest = {"schema_version": 1, "repository_commit": "fixture-pinned-commit", "artifacts": artifacts}
        manifest["snapshot_id"] = sha(manifest)
        (root / "manifest.json").write_bytes(canonical(manifest))
        return units, text, notice

    def test_all_formats_keep_credits_and_exclude_unadmitted_bodies(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            units, _, notice = self.snapshot(root / "snapshot")
            manifest = build_downloads(root / "snapshot", root / "export", part_bytes=1024)
            verified = verify_downloads(root / "snapshot", root / "export")
            self.assertEqual(verified["result"], "passed")
            self.assertEqual(verified["csv_row_count"], manifest["csv_row_count"])
            self.assertEqual(manifest["reading_count"], 2)
            self.assertEqual(manifest["whole_original_source_count"], 1)
            held = next(unit for unit in units if unit["availability"] == "held")
            readable = [unit for unit in units if unit["availability"] == "readable"]
            for kind, item in manifest["packages"].items():
                with zipfile.ZipFile(root / "export" / item["filename"]) as archive:
                    self.assertIsNone(archive.testzip())
                    self.assertEqual(len(archive.namelist()), item["entry_count"])
                    self.assertIn("PROVENANCE.json", archive.namelist())
                    self.assertIn("ATTRIBUTION.txt", archive.namelist())
                    credit = archive.read("ATTRIBUTION.txt").decode()
                    self.assertIn("Keep Credited Author", credit)
                    self.assertIn("Fixture evidence", credit)
                    provenance = json.loads(archive.read("PROVENANCE.json"))
                    self.assertEqual({row["reading_unit_id"] for row in provenance["readings"]},
                                     {unit["reading_unit_id"] for unit in readable})
                    self.assertNotIn(held["reading_unit_id"], archive.namelist())
                    self.assertEqual(archive.read(f"NOTICES/{sha(notice.encode())}.txt").decode(), notice)
                    for name in archive.namelist():
                        body = archive.read(name)
                        self.assertNotIn(b"HELD_BODY_CANARY", body)
                        self.assertNotIn(b"RESEARCH_BODY_CANARY", body)
                    source_entries = [name for name in archive.namelist() if name.startswith("SOURCES/")]
                    self.assertEqual(len(source_entries), 1 if kind == "json" else 0)
                    self.assertNotIn(f"SOURCES/{held['source_sha256']}.bin", archive.namelist())
                    if kind == "json":
                        for source in source_entries:
                            self.assertEqual(sha(archive.read(source)), Path(source).stem)
                        for unit in readable:
                            self.assertEqual(json.loads(archive.read(f"READINGS/{unit['reading_unit_id']}.json")), unit)
                    if kind == "csv":
                        clear = next(unit for unit in readable if unit["title"] == "Clear")
                        clear_rows = list(csv.DictReader(io.StringIO(archive.read(f"READINGS/{clear['reading_unit_id']}.csv").decode(), newline="")))
                        self.assertEqual(clear_rows[-1]["voice"], "[VOICE Ali]")
                        self.assertEqual(clear_rows[-1]["structure"], "")
                combined = b"".join((root / "export" / part["path"]).read_bytes() for part in item["parts"])
                self.assertEqual(sha(combined), item["sha256"])
                self.assertEqual(combined, (root / "export" / item["filename"]).read_bytes())
                self.assertTrue(all(part["bytes"] <= 1024 for part in item["parts"]))
                self.assertTrue(all(sha((root / "export" / part["path"]).read_bytes()) == part["sha256"] for part in item["parts"]))

    def test_utf8_csv_and_long_text_are_faithful_without_invented_headers(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            units, _, _ = self.snapshot(root / "snapshot", long=True)
            unit = next(row for row in units if row["title"] == "Admitted")
            result = build_downloads(root / "snapshot", root / "export", [unit["reading_unit_id"]])
            self.assertEqual(verify_downloads(root / "snapshot", root / "export")["reading_count"], 1)
            self.assertEqual(result["reading_count"], 1)
            self.assertEqual(result["whole_original_source_count"], 0)
            with zipfile.ZipFile(root / "export" / result["packages"]["text"]["filename"]) as archive:
                raw = archive.read(f"READINGS/{unit['reading_unit_id']}.txt")
                self.assertEqual(raw.decode(), unit["normalized_text"])
                self.assertEqual(sha(raw), unit["normalized_sha256"])
                self.assertGreater(len(raw), 100000)
                self.assertEqual(archive.read(f"SOURCE-TRANSCRIPTIONS/{unit['reading_unit_id']}.txt").decode(), unit["source_text"])
            with zipfile.ZipFile(root / "export" / result["packages"]["csv"]["filename"]) as archive:
                rows = list(csv.DictReader(io.StringIO(archive.read(f"READINGS/{unit['reading_unit_id']}.csv").decode(), newline="")))
                self.assertEqual(len(rows), len(unit["lines"]))
                self.assertEqual(rows[-1]["text"], unit["lines"][-1]["text"])
                self.assertEqual(rows[-1]["source_text"], unit["lines"][-1]["source_text"])
                self.assertEqual(json.loads(rows[-1]["source_ranges"]), unit["lines"][-1]["source_ranges"])
                self.assertEqual(rows[-1]["structure"], "[VERSE 1]")
                self.assertEqual(rows[-1]["voice"], "")

    def test_selected_readings_do_not_admit_held_neighbors_or_silently_drop_ids(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            units, _, _ = self.snapshot(root / "snapshot")
            held = next(unit for unit in units if unit["availability"] == "held")
            with self.assertRaisesRegex(CatalogError, "not admitted"):
                build_downloads(root / "snapshot", root / "bad", [held["reading_unit_id"]])
            with self.assertRaisesRegex(CatalogError, "unknown"):
                build_downloads(root / "snapshot", root / "bad", ["reading_missing"])
            with self.assertRaisesRegex(CatalogError, "empty"):
                build_downloads(root / "snapshot", root / "bad", [])

    def test_repeated_exports_are_deterministic_and_corruption_fails_closed(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            units, _, _ = self.snapshot(root / "snapshot")
            first = build_downloads(root / "snapshot", root / "first")
            second = build_downloads(root / "snapshot", root / "second")
            self.assertEqual(first, second)
            unit = next(row for row in units if row["availability"] == "readable")
            path = root / "snapshot" / f"readings/{unit['reading_unit_id']}.json"
            path.write_bytes(path.read_bytes() + b" ")
            with self.assertRaisesRegex(CatalogError, "artifact hash"):
                build_downloads(root / "snapshot", root / "corrupt")
            self.assertFalse((root / "corrupt" / "package-manifest.json").exists())

    def test_complete_verifier_rejects_a_tampered_upload_part(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.snapshot(root / "snapshot")
            result = build_downloads(root / "snapshot", root / "export")
            part = root / "export" / result["packages"]["csv"]["parts"][0]["path"]
            raw = part.read_bytes()
            part.write_bytes(bytes([raw[0] ^ 1]) + raw[1:])
            with self.assertRaisesRegex(CatalogError, "part hash"):
                verify_downloads(root / "snapshot", root / "export")


if __name__ == "__main__":
    unittest.main()
