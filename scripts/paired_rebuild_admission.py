"""Admit actual rebuilt inventories against independently approved original bytes."""
import copy
import hashlib
import json

def file_record(path, expected=None):
    raw = path.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    if expected is not None and digest != expected:
        raise RuntimeError('reviewed inventory bytes changed: ' + path.name)
    return json.loads(raw), digest

def admit(approved, images, original, rebuilt):
    if approved.get('rebuild_rule') != 'exact-inventory-except-baked-release-v1':
        raise RuntimeError('explicit independently approved rebuild admission rule required')
    witnesses = {}
    for arm, image in images.items():
        old, old_hash = file_record(original / f'{arm}-inventory.json', approved[arm]['inventory_sha256'])
        old_config, _ = file_record(original / f'{arm}-effective-config.json', approved[arm]['effective_config_sha256'])
        new, new_hash = file_record(rebuilt / f'{arm}-inventory.json')
        new_config, config_hash = file_record(rebuilt / f'{arm}-effective-config.json')
        info, _ = file_record(rebuilt / f'{arm}-image.json')
        status, _ = file_record(rebuilt / f'{arm}-status.json')
        if status.get('status') != 'read' or status.get('image_id') != image['image_id'] or info[0]['Id'] != image['image_id']:
            raise RuntimeError('rebuilt image read/identity mismatch')
        for record in (old, new):
            if record.get('source_sha') != image['source_sha'] or record.get('baked', {}).get('commit') != image['source_sha']:
                raise RuntimeError('rebuilt source mismatch')
        a, b = copy.deepcopy(old), copy.deepcopy(new)
        for value in (a,b):
            if not value['baked'].get('release_id'):
                raise RuntimeError('missing baked release identity')
            value['baked'].pop('release_id')
        if a != b or old_config != new_config:
            raise RuntimeError('rebuilt actual inventory/configuration drift: ' + arm)
        witnesses[arm] = {'encoding_image_id':approved[arm]['image_id'], 'measurement_image_id':image['image_id'],
            'source_sha':image['source_sha'], 'reviewed_inventory_sha256':old_hash,
            'rebuilt_inventory_sha256':new_hash, 'rebuilt_config_sha256':config_hash,
            'encoding_release_id':old['baked']['release_id'], 'measurement_release_id':new['baked']['release_id'],
            'instrumented_runtime_sha256':old.get('instrumented_runtime_sha256'),
            'rule':approved['rebuild_rule'], 'status':'matched-reviewed-inventory'}
    return witnesses
