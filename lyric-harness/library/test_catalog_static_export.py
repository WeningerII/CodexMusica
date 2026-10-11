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


def harness(temp, labels=(), author="Fixture Author", evidence="recorded", terms=None, whitman=True,
            end_marker=True):
    """A harness root with one long multi-page reading (astral characters,
    apparatus rows), two editions of one reviewed work and a held item. With
    `terms`, also a small Gutenberg witness (corpus/whitman.txt) whose terms
    text after its END marker is a notice: changing `terms`, `author` or
    `evidence` changes the readings' notices, metadata and sources.tsv rows.
    whitman=False leaves the witness without a sources.tsv row (held);
    end_marker=False drops its END marker, so it carries no notice at all."""
    root = Path(temp) / "harness"
    (root / "corpus/song").mkdir(parents=True)
    (root / "data").mkdir()
    long_body = "\n".join(f"Line {i} of the long one 😀 آ" for i in range(PAGE_ROWS * 2 + 17))
    (root / "corpus/song/eng_fixture.txt").write_text(
        f"# author: {author}\n--- TITLE: Long\n# APPARATUS: a note\n" + long_body +
        "\n--- TITLE: A\nOne witness.\n--- TITLE: B\nSecond witness.\n--- TITLE: Held\n--- SOURCE: PG9\nHELD_BODY\n")
    rows = f"source_id\tlicence\tpd_affirmed\tevidence\nlocal:corpus/song/eng_fixture.txt\tpublic domain\ttrue\t{evidence}\n"
    if terms is not None:
        (root / "corpus/whitman.txt").write_text(
            "*** START OF THE PROJECT GUTENBERG EBOOK LEAVES ***\n\nSong One\n  The first verse line\n"
            "  The second verse line\n\nSong Two\n  The third verse line\n"
            + ("*** END OF THE PROJECT GUTENBERG EBOOK LEAVES ***\n" if end_marker else "") + f"{terms}\n")
        if whitman:
            rows += f"local:corpus/whitman.txt\tpublic domain\ttrue\t{evidence}\n"
    (root / "data/sources.tsv").write_text(rows)
    (root / "data/calibration_work_editions.json").write_text(json.dumps({"works": [{
        "file": "corpus/song/eng_fixture.txt", "work_id": "reviewed-group", "editions": [
            {"title_line": len(long_body.splitlines()) + 4, "title": "A", "body_sha256": sha(b"One witness.")},
            {"title_line": len(long_body.splitlines()) + 6, "title": "B", "body_sha256": sha(b"Second witness.")}]}]}))
    (root / "data/lyric_label_prefixes.json").write_bytes(canonical({"version": 1, "prefixes": list(labels)}))
    (root / "library").mkdir()
    (root / "library/methods.json").write_text('{"methods":[],"registry_hash":"fixture-registry"}\n')
    (root / "library/schema.json").write_text('{"title":"fixture result schema"}\n')
    return root


class StaticExportTests(unittest.TestCase):
    def build(self, temp, labels=(), **fixture):
        root = harness(temp, labels, **fixture)
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

    def test_retention_keeps_a_superseded_directory_for_30_days(self):
        import importlib.util
        spec = importlib.util.spec_from_file_location("build_library_data", GATE.parent / "build_library_data.py")
        builder = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(builder)
        label = {"file": "eng_fixture.txt", "line": 5, "prefix": "Line", "kind": "speaker-or-stage-direction"}
        with tempfile.TemporaryDirectory() as plain, tempfile.TemporaryDirectory() as labelled:
            _, old, _ = self.build(plain)
            snapshot, new, _ = self.build(labelled, labels=[label])
            kept = builder.retain(new, old, "2026-10-11")
            self.assertEqual(len(kept), 1, "the labelled reading's previous directory is retained")
            (directory, since), = kept.items()
            self.assertEqual(since, "2026-10-11")
            self.assertTrue((new / directory / "head.json.gz").is_file())
            gate = self.gate(new, snapshot)
            self.assertEqual(gate.returncode, 0, gate.stdout + gate.stderr)
            # A later build keeps the recorded day, and drops it after 30 days.
            with tempfile.TemporaryDirectory() as later:
                again = Path(later) / "static"
                build_static(Path(labelled) / "export", again)
                self.assertEqual(builder.retain(again, new, "2026-11-10"), {directory: "2026-10-11"})
            with tempfile.TemporaryDirectory() as later:
                again = Path(later) / "static"
                build_static(Path(labelled) / "export", again)
                self.assertEqual(builder.retain(again, new, "2026-11-11"), {})
            # A tampered ledger date beyond 30 days is refused by the gate.
            manifest = json.loads((new / "manifest.json").read_bytes())
            manifest["retained"][directory] = "2026-09-01"
            (new / "manifest.json").write_bytes(canonical(manifest))
            self.assertIn("retained beyond 30 days", self.gate(new, snapshot).stdout)

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


class RetainedClosureTests(StaticExportTests):
    """3PO's #538 regression: a retained generation keeps every object its
    head names (rights, sources.tsv rows, notices, metadata), across changes
    to all of them, through expiry and loss of readability."""

    def builder(self):
        import importlib.util
        spec = importlib.util.spec_from_file_location("build_library_data", GATE.parent / "build_library_data.py")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    @staticmethod
    def heads(out):
        return {h.parent.relative_to(out).as_posix(): json.loads(gzip.decompress(h.read_bytes()))
                for h in out.glob("r/*/*/*/head.json.gz")}

    def test_retained_heads_keep_their_whole_reference_closure(self):
        builder = self.builder()
        with tempfile.TemporaryDirectory() as one, tempfile.TemporaryDirectory() as two:
            _, old, _ = self.build(one, terms="Terms of use, first printing.")
            snapshot, new, _ = self.build(two, terms="Terms of use, revised.",
                                          author="Fixture Author II", evidence="re-recorded")
            before, after = self.heads(old), self.heads(new)
            # The fixture really moves all three: rights rows, notices, metadata.
            self.assertFalse(set(before) & set(after), "every reading has a new directory")
            self.assertFalse({h["rights_ref"] for h in before.values()} & {h["rights_ref"] for h in after.values()})
            # The fixture file's header changed; the witness has none, so only some metadata moves.
            self.assertTrue({h["metadata_ref"] for h in before.values()} - {h["metadata_ref"] for h in after.values()})
            old_notices = {n for h in before.values() for n in h["rights"]["notices"]}
            new_notices = {n for h in after.values() for n in h["rights"]["notices"]}
            self.assertTrue(old_notices and new_notices and not old_notices & new_notices)

            kept = builder.retain(new, old, "2026-10-11")
            self.assertEqual(set(kept), set(before), "every superseded readable directory is retained")
            gate = self.gate(new, snapshot)
            self.assertEqual(gate.returncode, 0, gate.stdout + gate.stderr)
            # Each retained head's closure is in the new tree, byte for byte as it was.
            for directory, head in before.items():
                ref = head["rights_ref"]
                rights = json.loads(gzip.decompress((new / f"rights/r-{ref[:2]}.json.gz").read_bytes()))["rights"]
                self.assertEqual(rights[ref], json.loads(gzip.decompress(
                    (old / f"rights/r-{ref[:2]}.json.gz").read_bytes()))["rights"][ref])
                for digest in head["rights"]["notices"]:
                    self.assertEqual((new / f"notices/{digest}.json").read_bytes(),
                                     (old / f"notices/{digest}.json").read_bytes())

            # Expiry: 31 days on, nothing is retained and the carried objects go.
            with tempfile.TemporaryDirectory() as later:
                again = Path(later) / "static"
                build_static(Path(two) / "export", again)
                self.assertEqual(builder.retain(again, new, "2026-11-11"), {})
                self.assertFalse(any((again / f"notices/{d}.json").exists() for d in old_notices))
                gate = self.gate(again, snapshot)
                self.assertEqual(gate.returncode, 0, gate.stdout + gate.stderr)

    def test_a_retained_generation_that_loses_readability_is_dropped_with_its_objects(self):
        builder = self.builder()
        with tempfile.TemporaryDirectory() as one, tempfile.TemporaryDirectory() as two:
            _, old, _ = self.build(one, terms="Terms of use, first printing.")
            snapshot, new, _ = self.build(two, terms="Terms of use, revised.", whitman=False)
            witness = {d for d, h in self.heads(old).items() if h["source_path"] == "corpus/whitman.txt"}
            self.assertTrue(witness)
            kept = builder.retain(new, old, "2026-10-11")
            self.assertFalse(set(kept) & witness, "an unreadable unit's directory is not retained")
            old_notices = {n for d in witness for n in self.heads(old)[d]["rights"]["notices"]}
            self.assertFalse(any((new / f"notices/{d}.json").exists() for d in old_notices))
            gate = self.gate(new, snapshot)
            self.assertEqual(gate.returncode, 0, gate.stdout + gate.stderr)

    def test_a_retained_notice_is_carried_into_a_generation_that_has_none(self):
        """3PO's second #538 finding: the current generation writes no notices/
        directory at all, and a retained head still needs its notice."""
        builder = self.builder()
        with tempfile.TemporaryDirectory() as one, tempfile.TemporaryDirectory() as two:
            _, old, _ = self.build(one, terms="Terms of use, first printing.")
            snapshot, new, _ = self.build(two, terms="", end_marker=False)
            self.assertFalse(any(h["rights"]["notices"] for h in self.heads(new).values()))
            self.assertFalse((new / "notices").exists(), "the current generation has no notices/ directory")
            wanted = {n for h in self.heads(old).values() for n in h["rights"]["notices"]}
            self.assertTrue(wanted)
            kept = builder.retain(new, old, "2026-10-11")
            retained = {n for d in kept for n in self.heads(old)[d]["rights"]["notices"]}
            self.assertTrue(retained, "a retained head names a notice")
            manifest = json.loads((new / "manifest.json").read_bytes())
            for digest in retained:
                self.assertEqual((new / f"notices/{digest}.json").read_bytes(),
                                 (old / f"notices/{digest}.json").read_bytes())
                self.assertIn(f"notices/{digest}.json", manifest["files"])
            gate = self.gate(new, snapshot)
            self.assertEqual(gate.returncode, 0, gate.stdout + gate.stderr)

    def test_the_gate_refuses_a_retained_head_whose_objects_are_gone(self):
        builder = self.builder()
        with tempfile.TemporaryDirectory() as one, tempfile.TemporaryDirectory() as two:
            _, old, _ = self.build(one, terms="Terms of use, first printing.")
            snapshot, new, _ = self.build(two, terms="Terms of use, revised.",
                                          author="Fixture Author II", evidence="re-recorded")
            builder.retain(new, old, "2026-10-11")
            head = next(h for h in self.heads(old).values() if h["rights"]["notices"])
            notice = new / f"notices/{head['rights']['notices'][0]}.json"
            notice.unlink()
            manifest = json.loads((new / "manifest.json").read_bytes())
            del manifest["files"][notice.relative_to(new).as_posix()]
            (new / "manifest.json").write_bytes(canonical(manifest))
            self.assertIn("a retained head's", self.gate(new, snapshot).stdout)
