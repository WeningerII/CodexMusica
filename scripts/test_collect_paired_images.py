import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from collect_paired_images import collect


class Collection(unittest.TestCase):
    def test_both_reads_attempted_and_failure_preserved(self):
        with tempfile.TemporaryDirectory() as directory:
            evidence = Path(directory)
            with patch('collect_paired_images.read_arm', return_value=(None, None,
                    {'status':'failed', 'error':'fixture refusal'})) as read, \
                    patch('builtins.print'):
                self.assertEqual(collect(evidence, Path('helper')), 1)
            self.assertEqual([c.args[0] for c in read.call_args_list], ['before', 'after'])
            result = json.loads((evidence / 'comparison.json').read_text())
            self.assertEqual(result['status'], 'failed')
            self.assertFalse(result['measurements_run'])
            self.assertEqual(set(result['arms']), {'before', 'after'})
