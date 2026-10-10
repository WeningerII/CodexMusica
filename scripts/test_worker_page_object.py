"""Reader worker page objects: plain or gzip (phase A), bounded, address-verified."""
import gzip
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

SPEC = importlib.util.spec_from_file_location(
    "reader_worker", Path(__file__).resolve().parent.parent / "mcp" / "worker.py")
worker = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(worker)

BODY = json.dumps({"instances": [{"id": "evidence-a", "verdict": True}]}).encode()


class PageObjectTests(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.path = Path(self.dir.name) / f"{hashlib.sha256(BODY).hexdigest()}.json"

    def tearDown(self):
        self.dir.cleanup()

    def read(self, raw):
        self.path.write_bytes(raw)
        return worker.read_page_object(str(self.path))

    def test_plain_and_gzip_objects_read_identically(self):
        self.assertEqual(self.read(BODY), json.loads(BODY))
        self.assertEqual(self.read(gzip.compress(BODY)), json.loads(BODY))

    def test_the_address_hashes_the_uncompressed_bytes(self):
        with self.assertRaisesRegex(ValueError, "address"):
            self.read(gzip.compress(b'{"instances":[]}'))
        with self.assertRaisesRegex(ValueError, "address"):
            self.read(b'{"instances":[]}')

    def test_inflation_is_bounded(self):
        with self.assertRaisesRegex(ValueError, "bound"):
            self.read(gzip.compress(b" " * (worker.READER_OBJECT_BYTES + 1)))

    def test_truncated_or_corrupt_gzip_is_refused(self):
        with self.assertRaises(ValueError):
            self.read(gzip.compress(BODY)[:-6])
        with self.assertRaises(ValueError):
            self.read(b"\x1f\x8b" + b"\x00" * 32)

    def test_exactly_one_member_and_no_trailing_bytes(self):
        # Parity with the Node reader, which gunzip alone would not give.
        for raw in (gzip.compress(b"") + gzip.compress(BODY),
                    gzip.compress(BODY) + gzip.compress(BODY),
                    gzip.compress(BODY) + b"xyz"):
            with self.assertRaises(ValueError):
                self.read(raw)

    def test_an_oversized_plain_object_is_refused(self):
        with self.assertRaisesRegex(ValueError, "bound"):
            self.read(b" " * (worker.READER_OBJECT_BYTES + 1))


if __name__ == "__main__":
    unittest.main()
