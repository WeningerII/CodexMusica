"""Reader worker page objects: plain or gzip (phase A), bounded, address-verified."""
import gzip
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest import mock

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
        with self.assertRaisesRegex(worker.PageObjectCorrupt, "address"):
            self.read(gzip.compress(b'{"instances":[]}'))
        with self.assertRaisesRegex(worker.PageObjectCorrupt, "address"):
            self.read(b'{"instances":[]}')

    def test_inflation_is_bounded(self):
        with self.assertRaisesRegex(worker.PageObjectCorrupt, "bound"):
            self.read(gzip.compress(b" " * (worker.READER_OBJECT_BYTES + 1)))

    def test_truncated_or_corrupt_gzip_is_refused(self):
        with self.assertRaises(worker.PageObjectCorrupt):
            self.read(gzip.compress(BODY)[:-6])
        with self.assertRaises(worker.PageObjectCorrupt):
            self.read(b"\x1f\x8b" + b"\x00" * 32)

    def test_exactly_one_member_and_no_trailing_bytes(self):
        # Parity with the Node reader, which gunzip alone would not give.
        for raw in (gzip.compress(b"") + gzip.compress(BODY),
                    gzip.compress(BODY) + gzip.compress(BODY),
                    gzip.compress(BODY) + b"xyz"):
            with self.assertRaises(worker.PageObjectCorrupt):
                self.read(raw)

    def test_an_oversized_stored_gzip_file_is_refused(self):
        # The stored-file bound applies before inflation, as Node's _readFile does.
        with self.assertRaisesRegex(worker.PageObjectCorrupt, "bound"):
            self.read(gzip.compress(BODY) + b"\0" * worker.READER_OBJECT_BYTES)

    def test_an_oversized_plain_object_is_refused(self):
        with self.assertRaisesRegex(worker.PageObjectCorrupt, "bound"):
            self.read(b" " * (worker.READER_OBJECT_BYTES + 1))

    def test_missing_is_typed_and_value_error_compatible(self):
        with self.assertRaises(worker.PageObjectMissing):
            worker.read_page_object(str(self.path))
        for cls in (worker.PageObjectMissing, worker.PageObjectCorrupt,
                    worker.PageObjectUndecodable):
            self.assertTrue(issubclass(cls, ValueError))

    def test_address_verified_bad_utf8_or_json_is_undecodable(self):
        for body in (b'\xff', b'{broken'):
            for raw in (body, gzip.compress(body)):
                self.path = Path(self.dir.name) / f"{hashlib.sha256(body).hexdigest()}.json"
                with self.assertRaises(worker.PageObjectUndecodable):
                    self.read(raw)

    def test_address_check_precedes_decode(self):
        with self.assertRaises(worker.PageObjectCorrupt):
            self.read(b'\xff')

    def test_directory_is_corrupt_but_host_errors_keep_their_identity(self):
        self.path.mkdir()
        with self.assertRaises(worker.PageObjectCorrupt):
            worker.read_page_object(str(self.path))
        for error in (PermissionError('denied'), OSError(5, 'I/O error')):
            with mock.patch('builtins.open', side_effect=error):
                with self.assertRaises(type(error)) as caught:
                    worker.read_page_object(str(self.path))
                self.assertIs(caught.exception, error)


if __name__ == "__main__":
    unittest.main()
