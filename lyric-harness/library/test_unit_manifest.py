"""The per-unit manifest refuses evidence it cannot authenticate.

Run from lyric-harness/: python3 -m unittest library.test_unit_manifest

Each case builds a tiny synthetic snapshot in the shape library.catalog writes
(manifest.json, index.json, readings/), checks that a consistent one yields
rows, then breaks one link in the chain of hashes or one rights invariant and
checks that unit_manifest stops instead of writing a baseline.
"""

import json
import tempfile
import unittest
from pathlib import Path

from library import unit_manifest as um

ADMITTED = {"ADMIT_PD_AFFIRMED", "ADMIT_DATE_VERIFIED", "ADMIT_PUBLICATION_VERIFIED"}


def write_snapshot(root, mutate=None):
    root = Path(root)
    (root / "readings").mkdir(parents=True)
    units = [
        ("reading_00000000-0000-5000-8000-000000000001", "readable", "ADMIT_PD_AFFIRMED"),
        ("reading_00000000-0000-5000-8000-000000000002", "held", "REJECT_NO_EVIDENCE"),
    ]
    artifacts, summaries = {}, []
    for rid, availability, verdict in units:
        body = {"reading_unit_id": rid, "availability": availability, "normalized_sha256": um.sha(rid.encode())}
        body["reading_revision"] = um.sha(body)
        raw = um.canonical(body)
        path = f"readings/{rid}.json"
        artifacts[path] = um.sha(raw)
        summaries.append({
            "reading_unit_id": rid,
            "availability": availability,
            "path": path,
            "reading_revision": body["reading_revision"],
            "normalized_sha256": body["normalized_sha256"],
            "availability_reason": {"admission": [{"verdict": verdict}], "unresolved": []},
        })
        (root / path).write_bytes(raw)
    index = {"collections": [], "works": [], "editions": [], "readings": summaries}
    state = {"index": index, "artifacts": artifacts, "root": root}
    if mutate:
        mutate(state)
    index_raw = um.canonical(state["index"])
    (root / "index.json").write_bytes(index_raw)
    state["artifacts"].setdefault("index.json", um.sha(index_raw))
    counts = {}
    for r in state["index"]["readings"]:
        counts[r["availability"]] = counts.get(r["availability"], 0) + 1
    manifest = {"schema_version": 1, "counts": {"availability": counts}, "artifacts": state["artifacts"]}
    manifest["snapshot_id"] = um.sha(manifest)
    (root / "manifest.json").write_bytes(um.canonical(manifest))
    return root


class UnitManifestTests(unittest.TestCase):
    def rows(self, mutate=None):
        with tempfile.TemporaryDirectory() as d:
            return um.rows(write_snapshot(d, mutate), ADMITTED)

    def refuses(self, mutate, message):
        with self.assertRaisesRegex(um.ManifestError, message):
            self.rows(mutate)

    def test_consistent_snapshot_yields_every_unit(self):
        _, table, counts = self.rows()
        self.assertEqual(len(table), 2)
        self.assertEqual(counts, {"readable": 1, "held": 1})

    def test_stale_index_is_refused(self):
        def stale(state):
            state["artifacts"]["index.json"] = "0" * 64
        self.refuses(stale, "index.json does not match")

    def test_missing_artifact_entry_is_refused(self):
        def drop(state):
            del state["artifacts"]["readings/reading_00000000-0000-5000-8000-000000000001.json"]
        self.refuses(drop, "not a registered artifact")

    def test_tampered_reading_file_is_refused(self):
        def tamper(state):
            path = state["root"] / "readings/reading_00000000-0000-5000-8000-000000000002.json"
            path.write_bytes(path.read_bytes().replace(b"held", b"held "))
        self.refuses(tamper, "does not match its artifact entry")

    def test_unknown_availability_is_refused(self):
        def unknown(state):
            state["index"]["readings"][1]["availability"] = "maybe"
        self.refuses(unknown, "unknown availability")

    def test_readable_without_admission_is_refused(self):
        def unadmitted(state):
            summary = state["index"]["readings"][0]
            summary["availability_reason"]["admission"] = [{"verdict": "REJECT_NO_EVIDENCE"}]
        self.refuses(unadmitted, "readable without an admitting verdict")

    def test_readable_with_unresolved_source_is_refused(self):
        def unresolved(state):
            state["index"]["readings"][0]["availability_reason"]["unresolved"] = ["src"]
        self.refuses(unresolved, "unresolved sources")

    def test_revision_disagreeing_with_index_is_refused(self):
        def revised(state):
            state["index"]["readings"][0]["reading_revision"] = "1" * 64
        self.refuses(revised, "revision disagrees")


class MalformedSnapshotTests(unittest.TestCase):
    """A self-consistent snapshot missing one of its tables used to raise
    KeyError past main's ManifestError handler (a traceback, not
    `unit_manifest: ...`). Each case re-hashes what it breaks, so the chain of
    hashes still holds and only the shape is wrong."""

    def refuses(self, rewrite, message):
        with tempfile.TemporaryDirectory() as d:
            root = write_snapshot(d)
            rewrite(root)
            with self.assertRaisesRegex(um.ManifestError, message):
                um.rows(root, ADMITTED)

    @staticmethod
    def manifest(change):
        def rewrite(root):
            manifest = json.loads((root / "manifest.json").read_bytes())
            manifest.pop("snapshot_id")
            change(manifest)
            manifest["snapshot_id"] = um.sha(manifest)
            (root / "manifest.json").write_bytes(um.canonical(manifest))
        return rewrite

    @classmethod
    def index(cls, change):
        def rewrite(root):
            index = json.loads((root / "index.json").read_bytes())
            change(index)
            raw = um.canonical(index)
            (root / "index.json").write_bytes(raw)
            cls.manifest(lambda m: m["artifacts"].__setitem__("index.json", um.sha(raw)))(root)
        return rewrite

    def test_a_manifest_without_artifacts_is_refused(self):
        self.refuses(self.manifest(lambda m: m.pop("artifacts")), "no artifacts table")

    def test_a_manifest_without_counts_is_refused(self):
        self.refuses(self.manifest(lambda m: m.pop("counts")), "differ from the manifest's")

    def test_an_index_without_readings_is_refused(self):
        self.refuses(self.index(lambda i: i.pop("readings")), "no readings list")

    def test_a_reading_that_is_not_an_object_is_refused(self):
        self.refuses(self.index(lambda i: i["readings"].append("x")), "not an object")

    def test_an_id_or_availability_of_the_wrong_type_is_refused(self):
        self.refuses(self.index(lambda i: i["readings"][0].__setitem__("reading_unit_id", 5)),
                     "malformed reading_unit_id")
        self.refuses(self.index(lambda i: i["readings"][0].__setitem__("availability", ["readable"])),
                     "unknown availability")

    def test_a_malformed_availability_reason_is_refused(self):
        self.refuses(self.index(lambda i: i["readings"][0].__setitem__("availability_reason", ["x"])),
                     "malformed availability_reason")

    def test_a_reading_without_a_revision_is_refused(self):
        def strip(root):
            index = json.loads((root / "index.json").read_bytes())
            summary = index["readings"][0]
            path = root / summary["path"]
            body = json.loads(path.read_bytes())
            body.pop("reading_revision")
            summary.pop("reading_revision")
            raw = um.canonical(body)
            path.write_bytes(raw)
            index_raw = um.canonical(index)
            (root / "index.json").write_bytes(index_raw)
            def change(m):
                m["artifacts"][summary["path"]] = um.sha(raw)
                m["artifacts"]["index.json"] = um.sha(index_raw)
            self.manifest(change)(root)
        self.refuses(strip, "has no revision")


if __name__ == "__main__":
    unittest.main()
