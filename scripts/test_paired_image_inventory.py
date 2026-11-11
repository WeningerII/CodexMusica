import tempfile
import unittest
from pathlib import Path
from paired_image_inventory import inventory, effective_config, dependencies
import copy
from unittest.mock import patch


class Inventory(unittest.TestCase):
    def test_os_dependency_version_drift_is_retained(self):
        with patch('paired_image_inventory.importlib.metadata.distributions', return_value=[]), \
                patch('paired_image_inventory.inventory', return_value={'sha256': 'fixed'}), \
                patch('paired_image_inventory.shutil.which', return_value='/usr/bin/node'), \
                patch('paired_image_inventory.subprocess.check_output', side_effect=[
                    'libc6\t1\tamd64\tinstalled\n', 'libc6\t2\tamd64\tinstalled\n']):
            self.assertNotEqual(dependencies(Path('/app')), dependencies(Path('/app')))

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
