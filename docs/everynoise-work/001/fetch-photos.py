"""Capture real fetch receipts for researched candidates; never infer success from page metadata."""
import datetime
import io
import json
import pathlib
import urllib.error
import urllib.request
import time

from PIL import Image

work = pathlib.Path(__file__).resolve().parent
results = []
cache = pathlib.Path('/tmp/codex-everynoise-001-photo-checks')
cache.mkdir(exist_ok=True)
checked = datetime.datetime.now(datetime.timezone.utc).isoformat()
old_file = work / 'photo-fetch-receipts.json'
old_receipts = json.loads(old_file.read_text()).get('receipts', []) if old_file.exists() else []
old_success = {r.get('requested_url'): r for r in old_receipts if r.get('status') in ['bytes_verified_visual_review_pending', 'bytes_and_visual_verified']}
for packet in sorted((work / 'packets').glob('??-??.json')):
    for entry in json.loads(packet.read_text())['entries']:
        photo = entry.get('photo')
        if not photo or not photo.get('manifest'):
            results.append({'id': entry['id'], 'checked_at': checked, 'status': 'no_manifest_candidate'})
            continue
        manifest = photo['manifest']
        for role, field in [('full', 'image_url'), ('thumbnail', 'thumb_url')]:
            url = manifest.get(field)
            if url in old_success and pathlib.Path(old_success[url].get('local_path', '/nonexistent')).is_file():
                previous = dict(old_success[url])
                previous.update({'id': entry['id'], 'role': role})
                results.append(previous)
                continue
            receipt = {'id': entry['id'], 'role': role, 'requested_url': url,
                       'checked_at': checked, 'http_status': None, 'final_url': None,
                       'mime_type': None, 'decoded_dimensions': None,
                       'visual_inspected': False, 'status': 'failed'}
            results.append(receipt)
            if not url:
                receipt['error'] = 'No researched image URL supplied'
                continue
            try:
                request = urllib.request.Request(url, headers={'User-Agent': 'CodexMusicaPhotoVerification/1.0'})
                with urllib.request.urlopen(request, timeout=8) as response:
                    receipt['http_status'] = response.status
                    receipt['final_url'] = response.url
                    receipt['mime_type'] = response.headers.get_content_type()
                    raw = response.read(32 * 1024 * 1024 + 1)
                if len(raw) > 32 * 1024 * 1024:
                    raise ValueError('Photo exceeds bounded 32 MiB verification download')
                if not receipt['mime_type'].startswith('image/'):
                    raise ValueError('Response is not an image MIME type')
                with Image.open(io.BytesIO(raw)) as image:
                    image.load()
                    receipt['decoded_dimensions'] = list(image.size)
                    receipt['decoded_format'] = image.format
                target = cache / f"{entry['id']}-{role}"
                target.write_bytes(raw)
                receipt['local_path'] = str(target)
                receipt['byte_count'] = len(raw)
                receipt['status'] = 'bytes_verified_visual_review_pending'
            except urllib.error.HTTPError as error:
                receipt['http_status'] = error.code
                receipt['final_url'] = error.url
                receipt['error'] = str(error)
                receipt['retry_after'] = error.headers.get('Retry-After')
            except Exception as error:
                receipt['error'] = f'{type(error).__name__}: {error}'
            print(json.dumps({'id': receipt['id'], 'role': role, 'status': receipt['status'], 'error': receipt.get('error')}), flush=True)
            time.sleep(1)
report = {'group_id': '001', 'checked_at': checked, 'complete': False, 'receipts': results}
(work / 'photo-fetch-receipts.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({'attempts': len(results), 'bytes_verified': sum(r['status'] == 'bytes_verified_visual_review_pending' for r in results)}))
