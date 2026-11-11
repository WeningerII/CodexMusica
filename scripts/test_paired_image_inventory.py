import tempfile
import unittest
from pathlib import Path
from paired_image_inventory import inventory, effective_config, dependencies, collect
import copy
import json
import os
from unittest.mock import patch


class Inventory(unittest.TestCase):
    def test_required_nested_empty_and_special_entries_fail(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'required/empty').mkdir(parents=True)
            (root / 'other').write_text('unrelated')
            with self.assertRaises(ValueError):
                inventory(root, ['required', 'other'])
            (root / 'required/file').write_text('valid')
            (root / 'required/link').symlink_to('../other')
            with self.assertRaises(ValueError):
                inventory(root, ['required'])
            (root / 'required/link').unlink()
            os.mkfifo(root / 'required/fifo')
            with self.assertRaisesRegex(ValueError, 'special'):
                inventory(root, ['required'])

    def test_collect_malformed_manifest_and_baked_identity(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            data = root / 'lyric-harness/data'
            data.mkdir(parents=True)
            manifest = data / 'runtime_assets.json'
            for value in ({}, {'assets': []}, {'assets': [{'runtime': 'true'}]}):
                manifest.write_text(json.dumps(value))
                with self.assertRaises(ValueError):
                    collect(root)
            manifest.write_text(json.dumps({'assets': [{'id':'fixture', 'runtime':True,
                'decision':'approved', 'base':'root', 'files':[{'path':'data/runtime_assets.json'}]}]}))
            (root / 'mcp').mkdir()
            (root / 'mcp/build_identity.json').write_text(json.dumps({'commit':'wrong'}))
            with patch.dict('os.environ', {'BUILD_GIT_COMMIT':'expected'}):
                with self.assertRaisesRegex(ValueError, 'commit differ'):
                    collect(root)

    def test_os_dependency_version_drift_is_retained(self):
        with patch('paired_image_inventory.importlib.metadata.distributions', return_value=[]), \
                patch('paired_image_inventory.Path.glob', return_value=[]), \
                patch('paired_image_inventory.inventory', return_value={'sha256': 'fixed'}), \
                patch('paired_image_inventory.shutil.which', return_value='/usr/bin/node'), \
                patch('paired_image_inventory.subprocess.check_output', side_effect=[
                    'libc6\t1\tamd64\tinstalled\n', 'libc6\t2\tamd64\tinstalled\n']):
            self.assertNotEqual(dependencies(Path('/app')), dependencies(Path('/app')))

    def test_collect_captures_undeclared_asset_and_stays_unreviewed(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            names = ['mcp/'+n for n in ('state_codec.js', 'payload_limits.js', 'contract_version.js',
                'schemas.js', 'lyric_tools.js', 'job_store.js', 'package-lock.json', 'production-config.json')]
            names += ['references/_tradition_aliases.json', 'mcp/library_casefold.json', 'library-data/a', 'lyric-harness/library/snapshot/a', 'lyric-harness/data/a']
            for name in names:
                p = root / name
                p.parent.mkdir(parents=True, exist_ok=True)
                p.write_text('fixture')
            (root / 'lyric-harness/data/runtime_assets.json').write_text(json.dumps({'assets':[
                {'id':'fixture','runtime':True,'decision':'approved','base':'root', 'files':[{'path':'data/a'}]}]}))
            (root / 'mcp/build_identity.json').write_text(json.dumps({'commit':'expected'}))
            with patch.dict('os.environ', {'BUILD_GIT_COMMIT':'expected'}), \
                    patch('paired_image_inventory.dependencies', return_value={'fixture':True}), \
                    patch('paired_image_inventory.subprocess.check_output', return_value='v22\n'):
                a = collect(root)
                for name in ('mcp/library_casefold.json', 'references/_tradition_aliases.json'):
                    path = root / name
                    path.write_text('mutated')
                    changed = collect(root)
                    self.assertNotEqual(a['runtime_inputs'], changed['runtime_inputs'], name)
                    path.write_text('fixture')
                (root / 'lyric-harness/data/unexpected').write_text('new')
                b = collect(root)
            self.assertEqual(b['status'], 'unreviewed')
            self.assertNotEqual(a['assets']['sha256'], b['assets']['sha256'])
            self.assertIn('lyric-harness/data/unexpected', b['assets']['files'])

    def test_environment_and_configuration_drift(self):
        before = {'Os': 'linux', 'Architecture': 'amd64',
                  'Config': {'Env': ['BUILD_GIT_COMMIT=before', 'MODE=production'], 'User': 'node'}}
        after = copy.deepcopy(before)
        after['Config']['Env'][0] = 'BUILD_GIT_COMMIT=after'
        self.assertEqual(effective_config(before), effective_config(after))
        after['Config']['Env'].append('NODE_OPTIONS=--max-old-space-size=4096')
        self.assertNotEqual(effective_config(before), effective_config(after))
        after = copy.deepcopy(before)
        after['Config']['User'] = 'root'
        self.assertNotEqual(effective_config(before), effective_config(after))

    def test_dependency_symlink_identity(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'a').write_text('same')
            (root / 'b').write_text('same')
            link = root / 'link'
            link.symlink_to('a')
            before = inventory(root, ['link'], allow_links=True)
            link.unlink()
            link.symlink_to('b')
            self.assertNotEqual(before, inventory(root, ['link'], allow_links=True))

    def test_membership_and_bytes_affect_identity(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'assets').mkdir()
            file = root / 'assets/a'
            file.write_bytes(b'original')
            before = inventory(root, ['assets'])
            self.assertEqual(before, inventory(root, ['assets']))
            file.write_bytes(b'changed')
            self.assertNotEqual(before['sha256'], inventory(root, ['assets'])['sha256'])
            file.write_bytes(b'original')
            (root / 'assets/extra').write_bytes(b'original')
            self.assertNotEqual(before['sha256'], inventory(root, ['assets'])['sha256'])

    def test_missing_empty_and_symlink_refused(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'empty').mkdir()
            (root / 'link').symlink_to('/etc/hosts')
            for name in ('missing', 'empty', 'link', '../'):
                with self.subTest(name=name), self.assertRaises(ValueError):
                    inventory(root, [name])


if __name__ == '__main__':
    unittest.main()
