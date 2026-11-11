import subprocess
import tempfile
from pathlib import Path
import unittest
from unittest.mock import patch
from hosted_paired_fixture_prepare import invoke

class Preparation(unittest.TestCase):
    def test_timeout_cleans_owned_container_without_retry(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            with patch('hosted_paired_fixture_prepare.subprocess.run',side_effect=[
                subprocess.TimeoutExpired(['docker'],1200),subprocess.CompletedProcess([],0,'','')]) as run:
                with self.assertRaises(subprocess.TimeoutExpired):
                    invoke('sha256:'+'a'*64,root,root,['generate','/bundle/common'],root/'log')
            self.assertEqual(run.call_count,2)
            argv=run.call_args_list[0].args[0]
            name=argv[argv.index('--name')+1]
            self.assertEqual(run.call_args_list[1].args[0],['docker','rm','-f',name])
            self.assertIn('--network=none',argv)
            self.assertIn('--memory-swap=2g',argv)

    def test_cleanup_failure_is_not_a_preparation_success(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            with patch('hosted_paired_fixture_prepare.subprocess.run',side_effect=[
                subprocess.CompletedProcess([],0),subprocess.CompletedProcess([],1,'','cleanup refused')]):
                with self.assertRaisesRegex(RuntimeError,'cleanup failed'):
                    invoke('sha256:'+'a'*64,root,root,[],root/'log')
