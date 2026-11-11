import tempfile
import unittest
from pathlib import Path
from paired_image_inventory import inventory


class Inventory(unittest.TestCase):
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
