"""Retained reader snapshots remain pinned, complete, and admission-filtered."""
import hashlib
import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from library.catalog import build, canonical, load_reading
from quality import release_assets as assets


SOURCE_IMAGE = "ghcr.io/weningerii/codexmusica/lyrics@sha256:" + "7" * 64


class RetainedReaderCatalogTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix="retained-reader-")
        self.addCleanup(temporary.cleanup)
        self.directory = Path(temporary.name)
        self.old_root, self.old_catalog, self.old_manifest = self._catalog("old", "a" * 40)
        self.current_root, self.current_catalog, self.current_manifest = self._catalog(
            "current", "b" * 40
        )
        self.assertNotEqual(self.old_manifest["snapshot_id"], self.current_manifest["snapshot_id"])
        self.retained_id = "library_catalog_" + self.old_manifest["snapshot_id"]
        self.retained_directory = "library/snapshot/" + self.old_manifest["snapshot_id"]
        self._runtime_inputs(self.current_root)

    def _catalog(self, name, repository_commit, *, common=False):
        root = self.directory / (name + "-source")
        song = root / "corpus/song"
        song.mkdir(parents=True)
        data = root / "data"
        data.mkdir()
        (song / "eng_allowed.txt").write_text(
            f"--- TITLE: {name} admitted witness\n{name} words remain exactly here.\n",
            encoding="utf-8",
        )
        (song / "eng_held.txt").write_text(
            f"--- TITLE: {name} held witness\n{name} body has no admission record.\n",
            encoding="utf-8",
        )
        (data / "sources.tsv").write_text(
            "source_id\tlicence\tpd_affirmed\tevidence\n"
            "local:corpus/song/eng_allowed.txt\tpublic domain\ttrue\trecorded fixture\n",
            encoding="utf-8",
        )
        if common:
            (song / "eng_common.txt").write_text(
                "--- TITLE: Shared admitted witness\nThese same words survive both releases.\n",
                encoding="utf-8",
            )
            with (data / "sources.tsv").open("a", encoding="utf-8") as stream:
                stream.write("local:corpus/song/eng_common.txt\tpublic domain\ttrue\trecorded fixture\n")
        (data / "authority.tsv").write_text("author_key\tdeath_year\n", encoding="utf-8")
        catalog = self.directory / (name + "-canonical")
        manifest = build(root, catalog, repository_commit)
        self.assertEqual(manifest["counts"]["reading_units"], 3 if common else 2)
        self.assertEqual(manifest["counts"]["availability"], {"readable": 2 if common else 1, "held": 1})
        return root, catalog, manifest

    def _runtime_inputs(self, root):
        # A real approved byte declaration keeps inventory independent of the
        # repository's large lexical assets and ambient staged resources.
        (root / "lyric_harness.py").write_text("# executable runtime fixture\n", encoding="utf-8")
        payload = root / "data/fixture.txt"
        payload.write_bytes(b"approved runtime fixture\n")
        record = {
            "id": "fixture",
            "base": "root",
            "runtime": True,
            "decision": "approved",
            "files": [self._file_record(payload, "data/fixture.txt")],
        }
        (root / "data/runtime_assets.json").write_bytes(
            canonical({"version": 1, "assets": [record]}) + b"\n"
        )
        library = root / "library"
        library.mkdir()
        registry = {"contract_version": 1, "methods": []}
        registry["registry_hash"] = hashlib.sha256(canonical(registry)).hexdigest()
        (library / "methods.json").write_bytes(canonical(registry) + b"\n")
        for filename in ("schema.json", "catalog_manifest.schema.json"):
            (library / filename).write_bytes(
                canonical({"$id": "https://example.invalid/" + filename, "type": "object"}) + b"\n"
            )

    @staticmethod
    def _file_record(path, relative):
        raw = path.read_bytes()
        return {"path": relative, "bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()}

    def _assemble(self):
        target = self.directory / "runtime"
        result = assets.assemble(
            target,
            root=self.current_root,
            staged=self.current_root / "data",
            reader_catalog=self.current_catalog,
            retained_reader_catalogs=[
                (self.old_catalog, self.old_manifest["snapshot_id"], SOURCE_IMAGE)
            ],
        )
        self.assertTrue(result["ok"], result["errors"])
        self.assertTrue(assets.inventory(root=target, staged=target / "data")["ok"])
        return target

    @staticmethod
    def _asset_manifest(target):
        path = target / "data/runtime_assets.json"
        return path, json.loads(path.read_bytes())

    @staticmethod
    def _save_manifest(path, value):
        path.write_bytes(canonical(value) + b"\n")

    def _assert_inventory_refuses(self, target):
        result = assets.inventory(root=target, staged=target / "data")
        self.assertFalse(result["ok"], "mutated retained snapshot was accepted")
        self.assertTrue(result["errors"], "a refused inventory must explain the failure")
        return result

    def test_current_and_retained_readings_keep_separate_pinned_identities(self):
        target = self._assemble()
        _, value = self._asset_manifest(target)
        declarations = {entry["id"]: entry for entry in value["assets"]}
        current = declarations["library_catalog"]
        retained = declarations[self.retained_id]
        self.assertEqual(current["snapshot_id"], self.current_manifest["snapshot_id"])
        self.assertEqual(retained["snapshot_id"], self.old_manifest["snapshot_id"])
        self.assertEqual(retained["directory"], self.retained_directory)
        self.assertEqual(retained["source_image"], SOURCE_IMAGE)
        self.assertTrue(all(entry["path"].startswith(self.retained_directory + "/")
                            for entry in retained["files"]))
        self.assertFalse(any(entry["path"].startswith(self.retained_directory + "/")
                             for entry in current["files"]),
                         "retained files must have their own decision and fingerprint")
        for source, installed, manifest in (
            (self.current_catalog, target / "library/snapshot", self.current_manifest),
            (self.old_catalog, target / self.retained_directory, self.old_manifest),
        ):
            with self.subTest(snapshot=manifest["snapshot_id"]):
                self.assertEqual((installed / "manifest.json").read_bytes(),
                                 (source / "manifest.json").read_bytes())
                index = json.loads((source / "index.json").read_bytes())
                readable = [row for row in index["readings"] if row["availability"] == "readable"]
                held = [row for row in index["readings"] if row["availability"] == "held"]
                self.assertEqual(len(readable), 1)
                self.assertEqual(len(held), 1)
                row = readable[0]
                recovered = load_reading(installed, manifest["snapshot_id"],
                                         row["reading_unit_id"], row["reading_revision"])
                original = json.loads((source / row["path"]).read_bytes())
                self.assertEqual(recovered["normalized_text"], original["normalized_text"])
                self.assertEqual(recovered["reading_revision"], original["reading_revision"])
                self.assertFalse((installed / held[0]["path"]).exists())
                self.assertFalse((installed / "sources" / (held[0]["source_sha256"] + ".bin")).exists())

    def test_retention_refuses_wrong_snapshot_and_mutable_source_image(self):
        with self.assertRaises(ValueError):
            assets.retained_reader_catalog_asset(self.old_catalog, "0" * 64, SOURCE_IMAGE)
        invalid_images = (
            "ghcr.io/weningerii/codexmusica/lyrics:latest",
            "ghcr.io/another/codexmusica/lyrics@sha256:" + "7" * 64,
            "ghcr.io/weningerii/codexmusica/lyrics@sha256:" + "7" * 63,
            "ghcr.io/weningerii/codexmusica/lyrics@sha256:" + "G" * 64,
        )
        for image in invalid_images:
            with self.subTest(source_image=image), self.assertRaises(ValueError):
                assets.retained_reader_catalog_asset(
                    self.old_catalog, self.old_manifest["snapshot_id"], image
                )

    def test_assembly_links_identical_admitted_files_without_linking_different_manifests(self):
        self.old_root, self.old_catalog, self.old_manifest = self._catalog(
            "old-common", "c" * 40, common=True
        )
        self.current_root, self.current_catalog, self.current_manifest = self._catalog(
            "current-common", "d" * 40, common=True
        )
        self.retained_id = "library_catalog_" + self.old_manifest["snapshot_id"]
        self.retained_directory = "library/snapshot/" + self.old_manifest["snapshot_id"]
        self._runtime_inputs(self.current_root)
        target = self._assemble()
        _, value = self._asset_manifest(target)
        declarations = {entry["id"]: entry for entry in value["assets"]}
        current = {str(Path(entry["path"]).relative_to("library/snapshot")): entry
                   for entry in declarations["library_catalog"]["files"]}
        retained = {str(Path(entry["path"]).relative_to(self.retained_directory)): entry
                    for entry in declarations[self.retained_id]["files"]}
        matched = [relative for relative in current.keys() & retained.keys()
                   if (current[relative]["sha256"], current[relative]["bytes"])
                   == (retained[relative]["sha256"], retained[relative]["bytes"])]
        self.assertTrue(any(relative.startswith("readings/") for relative in matched))
        self.assertTrue(any(relative.startswith("sources/") for relative in matched))
        for relative in matched:
            with self.subTest(shared_artifact=relative):
                self.assertTrue((target / current[relative]["path"]).samefile(
                    target / retained[relative]["path"]
                ), "identical installed artifacts should share an inode")
        current_manifest = target / "library/snapshot/manifest.json"
        retained_manifest = target / self.retained_directory / "manifest.json"
        self.assertNotEqual(current_manifest.read_bytes(), retained_manifest.read_bytes())
        self.assertFalse(current_manifest.samefile(retained_manifest),
                         "different pinned manifests must retain separate files")

    def test_inventory_refuses_retained_files_without_their_declaration(self):
        target = self._assemble()
        path, value = self._asset_manifest(target)
        value["assets"] = [entry for entry in value["assets"] if entry["id"] != self.retained_id]
        self._save_manifest(path, value)
        self._assert_inventory_refuses(target)

    def test_inventory_refuses_corrupted_retained_reading_bytes(self):
        target = self._assemble()
        index = json.loads((self.old_catalog / "index.json").read_bytes())
        readable = next(row for row in index["readings"] if row["availability"] == "readable")
        path = target / self.retained_directory / readable["path"]
        path.write_bytes(path.read_bytes() + b"corrupted retained bytes")
        result = self._assert_inventory_refuses(target)
        self.assertIn(readable["path"], " ".join(result["errors"]))

    def test_inventory_refuses_withheld_body_or_original_inserted_into_retention(self):
        target = self._assemble()
        index = json.loads((self.old_catalog / "index.json").read_bytes())
        held = next(row for row in index["readings"] if row["availability"] == "held")
        for relative in (held["path"], "sources/" + held["source_sha256"] + ".bin"):
            with self.subTest(inserted=relative):
                path = target / self.retained_directory / relative
                path.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(self.old_catalog / relative, path)
                self._assert_inventory_refuses(target)
                path.unlink()
                restored = assets.inventory(root=target, staged=target / "data")
                self.assertTrue(restored["ok"], restored["errors"])

    def test_inventory_refuses_valid_different_catalog_substituted_under_old_pin(self):
        target = self._assemble()
        installed = target / self.retained_directory
        shutil.rmtree(installed)
        installed.mkdir()
        selection = assets.reader_catalog_selection(self.current_catalog)
        # Update byte declarations too: rejection must come from the snapshot
        # pin, rather than an ordinary checksum mismatch after replacement.
        files = []
        for relative in sorted(selection["selected"]):
            destination = installed / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(self.current_catalog / relative, destination)
            files.append(self._file_record(destination, self.retained_directory + "/" + relative))
        path, value = self._asset_manifest(target)
        retained = next(entry for entry in value["assets"] if entry["id"] == self.retained_id)
        retained["files"] = files
        for key in ("repository_commit", "canonical_manifest_sha256", "counts", "omitted_artifact_count"):
            retained[key] = selection[key]
        self._save_manifest(path, value)
        self.assertEqual(retained["snapshot_id"], self.old_manifest["snapshot_id"])
        self.assertNotEqual(selection["snapshot_id"], retained["snapshot_id"])
        self._assert_inventory_refuses(target)

    def test_inventory_refuses_mutable_source_image_after_assembly(self):
        target = self._assemble()
        path, value = self._asset_manifest(target)
        retained = next(entry for entry in value["assets"] if entry["id"] == self.retained_id)
        retained["source_image"] = "ghcr.io/weningerii/codexmusica/lyrics:latest"
        self._save_manifest(path, value)
        self._assert_inventory_refuses(target)


if __name__ == "__main__":
    unittest.main()
