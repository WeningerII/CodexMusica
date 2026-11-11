import io
import tarfile
import tempfile
from pathlib import Path
import unittest
from unittest.mock import patch
import paired_fixture_archive as archive

class Archive(unittest.TestCase):
    def test_compressed_output_is_capped_during_write(self):
        target=io.BytesIO()
        with patch.object(archive,'MAX_ARCHIVE',4):
            writer=archive.CappedWriter(target);writer.write(b'123')
            with self.assertRaisesRegex(ValueError,'during write'):writer.write(b'45')
        self.assertEqual(target.getvalue(),b'123')

    def test_member_count_is_refused_before_extra_extraction(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);packed=root/'count.gz'
            with tarfile.open(packed,'w:gz') as tar:
                for name in ('first','extra'):
                    info=tarfile.TarInfo(name);info.size=1;tar.addfile(info,io.BytesIO(b'x'))
            with patch.object(archive.shutil,'disk_usage',return_value=type('D',(),{'free':8*1024**3})()), \
                    patch.object(archive,'MAX_FILES',1):
                with self.assertRaisesRegex(ValueError,'budget'):archive.unpack(packed,root/'out',archive.sha(packed))
            self.assertFalse((root/'out/extra').exists())

    def test_roundtrip_hash_membership_and_private_permissions(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);source=root/'source';source.mkdir()
            (source/'jobs').mkdir();(source/'jobs/a').write_text('synthetic')
            packed=root/'fixtures.tar.gz'
            with patch.object(archive.shutil,'disk_usage',return_value=type('D',(),{'free':8*1024**3})()):
                receipt=archive.pack(source,packed)
                result=archive.unpack(packed,root/'out',receipt['archive_sha256'])
                self.assertEqual(result,receipt['files'])
                self.assertEqual((root/'out/jobs/a').stat().st_mode&0o777,0o600)
                with self.assertRaisesRegex(ValueError,'hash mismatch'):
                    archive.unpack(packed,root/'wrong','0'*64)

    def test_links_traversal_duplicates_and_size_refused(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            for kind in ('link','traversal','duplicate','size'):
                packed=root/(kind+'.tar.gz')
                with tarfile.open(packed,'w:gz') as tar:
                    info=tarfile.TarInfo('../escape' if kind=='traversal' else 'file')
                    if kind=='link':info.type=tarfile.SYMTYPE;info.linkname='/etc/hosts';tar.addfile(info)
                    else:
                        info.size=4;tar.addfile(info,io.BytesIO(b'test'))
                        if kind=='duplicate':tar.addfile(info,io.BytesIO(b'test'))
                with patch.object(archive.shutil,'disk_usage',return_value=type('D',(),{'free':8*1024**3})()), \
                        patch.object(archive,'MAX_EXPANDED',3 if kind=='size' else 1024):
                    with self.assertRaises(ValueError):archive.unpack(packed,root/kind,archive.sha(packed))

    def test_pack_rejects_nonregular_and_budget(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);source=root/'source';source.mkdir()
            (source/'link').symlink_to('/etc/hosts')
            with self.assertRaises(ValueError):archive.pack(source,root/'bad.gz')
            (source/'link').unlink();(source/'data').write_text('large')
            with patch.object(archive,'MAX_EXPANDED',2):
                with self.assertRaises(ValueError):archive.pack(source,root/'large.gz')
