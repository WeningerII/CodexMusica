"""Worker transport controls: retain complete receipts without trusting diagnostics."""
import importlib.util
import json
from pathlib import Path
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location(
    "worker_measurement_capture", Path(__file__).with_name("measure_verb_memory.py"))
measurement = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(measurement)


def record(**updates):
    value = {
        "version": 1, "transport_token": measurement.CONTROL_TOKEN,
        "status": "graded", "final_draft": ["one", "two"],
        "coverage": {
            "scope": "requested_layers", "pairs_mandated": 1,
            "pairs_judged": 1, "pairs_refused": 0, "certified": True,
            "obligations": [{"id": "rhyme:1:2:0", "status": "answered"}],
            "refused_obligations": [],
        },
    }
    value.update(updates)
    return "  lyric result: " + json.dumps(value)


class WorkerCaptureTests(unittest.TestCase):
    def test_actual_frame_size_preserves_receipt_larger_than_diagnostic_tail(self):
        receipt = record(detail="x" * 225000)
        capture = measurement.WorkerCapture()
        # Split the prefix too, then use the production worker's 16-KiB frame size.
        capture.append("stdout", receipt[:7])
        remainder = receipt[7:] + "\n"
        for offset in range(0, len(remainder), 16384):
            capture.append("stdout", remainder[offset:offset + 16384])
        self.assertEqual(measurement._machine_result(capture.tail), {})
        self.assertEqual(capture.result_line, receipt)
        capture.append("stdout", "later ordinary diagnostics\n" * 10000)
        capture.finish()
        self.assertEqual(capture.result_line, receipt)
        with patch.object(measurement, "REPORT", {"lines": 2, "rows": []}):
            self.assertTrue(measurement._measurement_row(
                "grade", 0, 1.0, output=capture.tail,
                machine_output=capture.result_line))
            row = measurement.REPORT["rows"][0]
        self.assertTrue(row["authenticated"])
        self.assertGreater(row["control_record_bytes"], 131072)
        self.assertTrue(row["typed"])

    def test_forged_malformed_and_stderr_records_cannot_qualify(self):
        for stream, text in (
            ("stdout", record(transport_token="wrong nonce")),
            ("stdout", record(version="1")),
            ("stdout", "  lyric result: {malformed"),
            ("stderr", record()),
        ):
            with self.subTest(stream=stream, text=text[:60]):
                capture = measurement.WorkerCapture()
                capture.append(stream, text + "\n")
                capture.finish()
                self.assertEqual(capture.result_line, "")
                with patch.object(measurement, "REPORT", {"lines": 2, "rows": []}):
                    self.assertFalse(measurement._measurement_row(
                        "grade", 0, 1.0, output=capture.tail,
                        machine_output=capture.result_line))

    def test_streams_do_not_join_and_unterminated_final_stdout_is_kept(self):
        receipt = record()
        capture = measurement.WorkerCapture()
        capture.append("stdout", receipt[:9])
        capture.append("stderr", record(transport_token="wrong nonce") + "\n")
        capture.append("stdout", receipt[9:])
        self.assertEqual(capture.result_line, "")
        capture.finish()
        self.assertEqual(capture.result_line, receipt)

    def test_cap_counts_utf8_bytes_and_resets_at_line_boundaries(self):
        with patch.object(measurement, "CONTROL_LINE_BYTES", 8):
            capture = measurement.WorkerCapture()
            capture.append("stdout", "éé")
            capture.append("stdout", "éé\n")
            self.assertEqual(capture.pending_bytes, 0)
            capture.append("stdout", "éééé")
            self.assertEqual(capture.pending_bytes, 8)
            with self.assertRaisesRegex(RuntimeError, "exceeds"):
                capture.append("stdout", "a")

    def test_complete_receipt_does_not_override_coverage_validation(self):
        capture = measurement.WorkerCapture()
        capture.append("stdout", record(coverage={"certified": True}) + "\n")
        capture.finish()
        with patch.object(measurement, "REPORT", {"lines": 2, "rows": []}):
            self.assertFalse(measurement._measurement_row(
                "grade", 0, 1.0, output=capture.tail,
                machine_output=capture.result_line))
            self.assertTrue(measurement.REPORT["rows"][0]["authenticated"])
            self.assertFalse(measurement.REPORT["rows"][0]["typed"])


if __name__ == "__main__":
    unittest.main()
