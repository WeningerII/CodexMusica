"""Real worker subprocess; a deterministic producer stub isolates its plumbing."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest


WORKER = Path(__file__).resolve().parent.parent / "mcp" / "worker.py"
PRODUCER = '''
MISSING = object()
class AnalysisSession:
    def __init__(self, source, declarations, requested, checkpoint, *,
                 load_records, identity, requested_methods, discovery=MISSING):
        if "error" in source:
            raise ValueError(source["error"])
        self.probe = {"has_discovery": discovery is not MISSING,
                      "discovery": None if discovery is MISSING else discovery,
                      "records": list(load_records("schema"))}
    def step(self, **kwargs):
        return {"done": True, "provider_calls": 0, "probe": self.probe}
'''


class ReaderProtocolTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / "mcp").mkdir()
        self.worker = self.root / "mcp" / "worker.py"
        shutil.copyfile(WORKER, self.worker)
        harness = self.root / "lyric-harness"
        (harness / "library").mkdir(parents=True)
        (harness / "lyric_harness.py").write_text("def cli(): return 0\n")
        (harness / "library" / "__init__.py").write_text("")
        (harness / "library" / "analysis.py").write_text(PRODUCER)

    def run_worker(self, requests):
        result = subprocess.run(
            [sys.executable, str(self.worker)],
            input="".join(json.dumps(r) + "\n" for r in requests),
            text=True, capture_output=True, timeout=10, check=True)
        self.assertEqual(result.stderr, "")
        return [json.loads(line) for line in result.stdout.splitlines()]

    def refused(self, message):
        frames = self.run_worker([{"id": 1, "family": "reader",
                                   "reader": {"source": {"error": message}}}])
        self.assertEqual(len(frames), 1)
        frame = frames[0]
        self.assertEqual(frame["code"], 1)
        self.assertEqual(frame["reader_result"], {
            "status": "paused", "reason": frame["error_code"], "provider_calls": 0})
        self.assertEqual(frame["stderr"], "reader: " + message)
        return frame["error_code"], frame["error_cause"], frame["error_log"]

    def test_plain_allowlist_and_new_codes(self):
        for code in ("INVALID_DECLARATION", "UNSUPPORTED_METHOD", "STALE_READING",
                     "RESOURCE_LIMIT", "RESULT_EXPIRED", "SNAPSHOT_CHANGED",
                     "DISCOVERY_UNAVAILABLE", "STORAGE_CORRUPT", "INVARIANT_FAILURE"):
            with self.subTest(code=code):
                self.assertEqual(self.refused(code + ": detail"), (code, None, None))
        self.assertEqual(self.refused("STALE_READING"), ("STALE_READING", None, None))

    def test_cause_and_log_forwarded_without_semantic_validation(self):
        for message, expected in (
            ("RESOURCE_LIMIT[declared_coordinate_bits]: detail: more",
             ("RESOURCE_LIMIT", "declared_coordinate_bits", None)),
            ("DISCOVERY_UNAVAILABLE[segment_missing,alt_cells]: detail",
             ("DISCOVERY_UNAVAILABLE", "segment_missing", "alt_cells")),
            ("RESOURCE_LIMIT[unknown_cause,unknown_log]: detail",
             ("RESOURCE_LIMIT", "unknown_cause", "unknown_log")),
        ):
            self.assertEqual(self.refused(message), expected)

    def test_malformed_or_unknown_heads_fail_closed(self):
        for head in ("RESOURCE_LIMIT[]", "RESOURCE_LIMIT[cause,]",
                     "RESOURCE_LIMIT[,seen]", "RESOURCE_LIMIT[a,b,c]",
                     "RESOURCE_LIMIT[a]extra", "RESOURCE_LIMIT[a", "resource_limit",
                     " RESOURCE_LIMIT", "RESOURCE_LIMIT ", "RESOURCE_LIMIT\n",
                     "OTHER_CODE[cause,seen]"):
            with self.subTest(head=head):
                self.assertEqual(self.refused(head + ": detail"), ("READER_ERROR", None, None))

    def test_discovery_keyword_only_for_non_null_payloads(self):
        for extra in ({}, {"discovery": None}, {"discovery": {}},
                      {"discovery": {"version": 1, "summary": {}, "paths": {}}}):
            with self.subTest(extra=extra):
                frames = self.run_worker([
                    {"id": 1, "family": "reader", "reader": {"source": {}, **extra}},
                    {"id": 1, "event": "reader_ack", "continue": False, "reason": "COMPLETE"},
                ])
                self.assertEqual(frames[0]["event"], "reader_checkpoint")
                probe = frames[0]["data"]["probe"]
                self.assertEqual(probe["has_discovery"], extra.get("discovery") is not None)
                self.assertEqual(probe["discovery"], extra.get("discovery"))
                self.assertEqual(frames[1]["reader_result"]["status"], "complete")

    def test_load_records_keeps_order_multiplicity_and_one_yield_per_row(self):
        row = {"id": "same", "schema_id": "schema", "method_id": "schema",
               "schema_name": "schema", "engine_payload": {"schema_id": "schema", "schema_name": "schema"}}
        pages = []
        for rows in ([row, {"id": "excluded"}, row], [{"id": "next", "schema_name": "schema"}]):
            body = json.dumps({"instances": rows}).encode()
            page = self.root / (hashlib.sha256(body).hexdigest() + ".json")
            page.write_bytes(body)
            pages.append(str(page))
        frames = self.run_worker([
            {"id": 1, "family": "reader", "reader": {"source": {}, "committed_pages": pages}},
            {"id": 1, "event": "reader_ack", "reason": "COMPLETE"},
        ])
        self.assertEqual([r["id"] for r in frames[0]["data"]["probe"]["records"]],
                         ["same", "same", "next"])


if __name__ == "__main__":
    unittest.main()
