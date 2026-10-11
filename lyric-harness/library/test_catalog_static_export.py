"""Static Library data (catalog_static_export) and its gate (scripts/check_library_data.py),
on a small catalog built the way library-site.yml builds one; no external resources."""
import gzip
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from library.catalog import build, canonical, sha
from library.catalog_site_export import export_snapshot
from library.catalog_static_export import PAGE_ROWS, build_static

GATE = Path(__file__).resolve().parents[2] / "scripts/check_library_data.py"


def harness(temp, labels=()):
    """A harness root with one long multi-page reading (astral characters,
    apparatus rows), two editions of one reviewed work and a held item."""
    root = Path(temp) / "harness"
    (root / "corpus/song").mkdir(parents=True)
    (root / "data").mkdir()
    long_body = "\n".join(f"Line {i} of the long one 😀 آ" for i in range(PAGE_ROWS * 2 + 17))
    (root / "corpus/song/eng_fixture.txt").write_text(
        "# author: Fixture Author\n--- TITLE: Long\n# APPARATUS: a note\n" + long_body +
        "\n--- TITLE: A\nOne witness.\n--- TITLE: B\nSecond witness.\n--- TITLE: Held\n--- SOURCE: PG9\nHELD_BODY\n")
    (root / "data/sources.tsv").write_text(
        "source_id\tlicence\tpd_affirmed\tevidence\nlocal:corpus/song/eng_fixture.txt\tpublic domain\ttrue\trecorded\n")
    (root / "data/calibration_work_editions.json").write_text(json.dumps({"works": [{
        "file": "corpus/song/eng_fixture.txt", "work_id": "reviewed-group", "editions": [
            {"title_line": len(long_body.splitlines()) + 4, "title": "A", "body_sha256": sha(b"One witness.")},
            {"title_line": len(long_body.splitlines()) + 6, "title": "B", "body_sha256": sha(b"Second witness.")}]}]}))
    (root / "data/lyric_label_prefixes.json").write_bytes(canonical({"version": 1, "prefixes": list(labels)}))
    return root


class StaticExportTests(unittest.TestCase):
    def build(self, temp, labels=()):
        root = harness(temp, labels)
        snapshot = root / "library/snapshot"
        build(root, snapshot, "a" * 40)
        export = Path(temp) / "export"
        export_snapshot(snapshot, export)
        out = Path(temp) / "static"
        result = build_static(export, out)
        return snapshot, out, result

    def gate(self, out, snapshot):
        return subprocess.run([sys.executable, str(GATE), str(out), "--snapshot", str(snapshot)],
                              capture_output=True, text=True)

    def test_build_passes_the_gate_and_pages_carry_their_own_coordinates(self):
        with tempfile.TemporaryDirectory() as temp:
            snapshot, out, result = self.build(temp)
            gate = self.gate(out, snapshot)
            self.assertEqual(gate.returncode, 0, gate.stdout + gate.stderr)
            index = json.loads((snapshot / "index.json").read_bytes())
            readable = [r for r in index["readings"] if r["availability"] == "readable"]
            self.assertEqual(result["readable"], len(readable))
            self.assertFalse(any("HELD_BODY" in p.read_bytes().decode("latin1") for p in out.rglob("*.json")))
            long = next(r for r in readable if r["title"] == "Long")
            unit = long["reading_unit_id"]
            shard = json.loads(gzip.decompress((out / f"u/{unit[8:10]}.json.gz").read_bytes()))
            path_key = next(k for i, k, _ in shard["units"] if i == unit)
            base = out / "r" / unit[8:10] / unit / path_key
            head = json.loads(gzip.decompress((base / "head.json.gz").read_bytes()))
            self.assertEqual(head["page_count"], 3)
            self.assertEqual(len(head["lines"]), PAGE_ROWS)
            page = json.loads(gzip.decompress((base / f"2-{head['pages'][1][:12]}.json.gz").read_bytes()))
            self.assertEqual(page["start"]["row_start"], 2 * PAGE_ROWS)
            self.assertGreater(page["start"]["normalized_utf16_start"], page["start"]["normalized_cp_start"])
            self.assertNotIn("data_id", head, "immutable reading files carry no list identity")

    def test_same_build_twice_is_byte_identical(self):
        with tempfile.TemporaryDirectory() as one, tempfile.TemporaryDirectory() as two:
            _, a, ra = self.build(one)
            _, b, rb = self.build(two)
            self.assertEqual(ra["data_id"], rb["data_id"])
            self.assertEqual((a / "manifest.json").read_bytes(), (b / "manifest.json").read_bytes())

    def test_a_label_change_on_an_unchanged_revision_is_a_new_directory(self):
        with tempfile.TemporaryDirectory() as plain, tempfile.TemporaryDirectory() as labelled:
            _, a, _ = self.build(plain)
            label = {"file": "eng_fixture.txt", "line": 5, "prefix": "Line", "kind": "speaker-or-stage-direction"}
            snapshot, b, _ = self.build(labelled, labels=[label])
            self.assertEqual(self.gate(b, snapshot).returncode, 0)
            def keys(out):
                return {i: k for p in out.glob("u/*.json.gz")
                        for i, k, _ in json.loads(gzip.decompress(p.read_bytes()))["units"]}
            ka, kb = keys(a), keys(b)
            changed = [i for i in ka if ka[i] != kb[i]]
            self.assertEqual(len(changed), 1, "only the labelled reading moves")
            self.assertEqual(ka[changed[0]][:16], kb[changed[0]][:16], "same revision")
            self.assertNotEqual(ka[changed[0]][17:], kb[changed[0]][17:], "new projection")
            self.assertNotEqual(json.loads((a / "manifest.json").read_bytes())["data_id"],
                                json.loads((b / "manifest.json").read_bytes())["data_id"])

    def test_the_gate_refuses_a_tampered_line_and_a_stale_list(self):
        with tempfile.TemporaryDirectory() as temp:
            snapshot, out, _ = self.build(temp)
            heads = sorted(out.glob("r/*/*/*/head.json.gz"))
            head = json.loads(gzip.decompress(heads[0].read_bytes()))
            head["lines"][0][1] = head["lines"][0][1] + " (edited)"
            heads[0].write_bytes(gzip.compress(canonical(head), 9, mtime=0))
            result = self.gate(out, snapshot)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("FAIL", result.stdout)
        with tempfile.TemporaryDirectory() as temp:
            snapshot, out, _ = self.build(temp)
            catalog = json.loads((out / "catalog.json").read_bytes())
            catalog["data_id"] = "0" * 64
            (out / "catalog.json").write_bytes(canonical(catalog))
            result = self.gate(out, snapshot)
            self.assertIn("data_id: catalog.json", result.stdout)

    def test_an_export_without_its_label_registry_is_refused(self):
        with tempfile.TemporaryDirectory() as temp:
            root = harness(temp)
            (root / "data/lyric_label_prefixes.json").unlink()
            snapshot = root / "library/snapshot"
            build(root, snapshot, "a" * 40)
            export_snapshot(snapshot, Path(temp) / "export")
            with self.assertRaisesRegex(ValueError, "label registry"):
                build_static(Path(temp) / "export", Path(temp) / "static")


if __name__ == "__main__":
    unittest.main()
