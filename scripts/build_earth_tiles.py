#!/usr/bin/env python3
"""Build Equal Earth WebP tiles from NASA BMNG July 2004, native 500m panels.

Usage: python3 scripts/build_earth_tiles.py --cache=/path/to/cache
Requires Pillow and NumPy. Sources are downloaded only at build time. The cache
needs ~16 GB; no giant image is ever decoded by the browser. Each output tile
has a one-pixel gutter, sampled in global coordinates to avoid edge seams.
"""
import argparse
import concurrent.futures
import hashlib
import json
import math
from pathlib import Path
import urllib.request

import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = 500_000_000  # Only the known 21600-square NASA panels.
BASE = 'https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-base/july/'
EXTENT = [-2.70663, -1.317363, 2.70663, 1.317363]
LEVELS = [{'width': 1350 * 2**z, 'height': 657 * 2**z} for z in range(7)]
SIZE, GUTTER = 512, 1
ROOT = Path(__file__).resolve().parents[1]


def sources(cache):
    records = []
    locked = {r['panel']: r for r in json.loads((ROOT / 'assets/earth-sources.json').read_text())}
    for row in range(2):
        for col, letter in enumerate('ABCD'):
            panel = f'{letter}{row+1}'
            name = f'world.200407.3x21600x21600.{panel}.jpg'
            target = cache / name
            if not target.exists():
                print('Downloading', panel, flush=True)
                with urllib.request.urlopen(BASE + name, timeout=180) as response:
                    with target.with_suffix('.part').open('wb') as out:
                        while chunk := response.read(1024 * 1024):
                            out.write(chunk)
                target.with_suffix('.part').rename(target)
            with target.open('rb') as inp:
                sha = hashlib.file_digest(inp, 'sha256').hexdigest()
            record = {'panel': panel, 'url': BASE + name,
                      'bytes': target.stat().st_size, 'sha256': sha}
            if record != locked[panel]:
                raise ValueError(f'Source does not match pinned NASA bytes: {panel}')
            records.append(record)
    if not (cache / 'sources-ready.json').exists():
        maps = [np.memmap(cache / f'source-{z}.rgb', dtype='uint8', mode='w+',
                         shape=(43200 // 2**(6-z), 86400 // 2**(6-z), 3))
                for z in range(7)]
        for record in records:
            panel = record['panel']
            row, col = int(panel[1])-1, 'ABCD'.index(panel[0])
            print('Preparing source pyramid', panel, flush=True)
            with Image.open(cache / record['url'].split('/')[-1]) as im:
                if im.size != (21600, 21600) or im.mode != 'RGB':
                    raise ValueError(f'Unexpected NASA source: {panel}: {im.size}, {im.mode}')
                current = im
                for z in reversed(range(7)):
                    h, w = maps[z].shape[:2]
                    x0, x1 = round(col*w/4), round((col+1)*w/4)
                    y0, y1 = round(row*h/2), round((row+1)*h/2)
                    if current.size != (x1-x0, y1-y0):
                        reduced = current.resize((x1-x0, y1-y0), Image.Resampling.LANCZOS)
                        if current is not im:
                            current.close()
                        current = reduced
                    # Copy strips rather than allocating another 1.4 GB array.
                    for start in range(0, y1-y0, 256):
                        end = min(start+256, y1-y0)
                        maps[z][y0+start:y0+end, x0:x1] = np.asarray(current.crop((0, start, x1-x0, end)))
                    maps[z].flush()
                if current is not im:
                    current.close()
            print('Prepared', panel, flush=True)
        (cache / 'sources-ready.json').write_text(json.dumps(records))
    elif json.loads((cache / 'sources-ready.json').read_text()) != records:
        raise ValueError('Source cache changed: remove sources-ready.json and rebuild')
    return records


def inverse_grid(xpixels, ypixels, width, height):
    """Pixel centres in the exact extent used by atlas.js, inverse Equal Earth."""
    x = EXTENT[0] + (xpixels + 0.5) / width * (EXTENT[2]-EXTENT[0])
    y = EXTENT[3] - (ypixels + 0.5) / height * (EXTENT[3]-EXTENT[1])
    a1, a2, a3, a4 = 1.340264, -.081106, .000893, .003796
    t = y / a1
    for _ in range(8):
        t -= (t*(a1+a2*t*t+a3*t**6+a4*t**8)-y)/(a1+3*a2*t*t+7*a3*t**6+9*a4*t**8)
    lat = np.arcsin(np.clip(2*np.sin(t)/np.sqrt(3), -1, 1))
    lon = x[None, :] * (np.sqrt(3)*(a1+3*a2*t*t+7*a3*t**6+9*a4*t**8)/(2*np.cos(t)))[:, None]
    mask = (np.abs(lon) <= np.pi) & (np.abs(t[:, None]) <= np.pi/3)
    return lon, lat[:, None], mask


def build(cache, output, workers):
    records = sources(cache)
    output.mkdir(parents=True, exist_ok=True)
    inventory = {}
    levels = []
    for z, level in enumerate(LEVELS):
        width, height = level['width'], level['height']
        src = np.memmap(cache / f'source-{z}.rgb', dtype='uint8', mode='r',
                        shape=(43200 // 2**(6-z), 86400 // 2**(6-z), 3))
        sh, sw = src.shape[:2]
        coverage = []

        def tile(job):
            tx, ty = job
            tw, th = min(SIZE, width-tx*SIZE), min(SIZE, height-ty*SIZE)
            lon, lat, mask = inverse_grid(np.arange(tx*SIZE-1, tx*SIZE+tw+1),
                                         np.arange(ty*SIZE-1, ty*SIZE+th+1), width, height)
            if not mask.any():
                return None
            # Bilinear reconstruction, with longitude wrapping at the dateline.
            sx = (lon + np.pi)/(2*np.pi)*sw - .5
            sy = np.clip((np.pi/2-lat)/np.pi*sh - .5, 0, sh-1)
            ix, iy = np.floor(sx).astype('int32'), np.floor(sy).astype('int32')
            fx, fy = (sx-ix).astype('float32')[..., None], (sy-iy).astype('float32')[..., None]
            x0, x1 = ix % sw, (ix+1) % sw
            y0, y1 = iy, np.minimum(iy+1, sh-1)
            top = src[y0, x0]*(1-fx) + src[y0, x1]*fx
            bottom = src[y1, x0]*(1-fx) + src[y1, x1]*fx
            rgba = np.empty((*mask.shape, 4), dtype='uint8')
            rgba[..., :3] = np.clip(top*(1-fy)+bottom*fy, 0, 255).astype('uint8')
            rgba[..., 3] = mask*255
            rel = f'{z}/{tx}/{ty}.webp'
            target = output / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            Image.fromarray(rgba).save(target, quality=82, method=4)
            blob = target.read_bytes()
            return tx, ty, rel, len(blob), hashlib.sha256(blob).hexdigest()

        jobs = [(x, y) for y in range(math.ceil(height/SIZE)) for x in range(math.ceil(width/SIZE))]
        with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
            for result in pool.map(tile, jobs):
                if result:
                    x, y, rel, size, sha = result
                    while len(coverage) <= y:
                        coverage.append([])
                    coverage[y].append(x)
                    inventory[rel] = [size, sha]
        levels.append({**level, 'rows': [[min(row), max(row)] if row else None for row in coverage]})
        print('Built level', z, width, height, 'tiles', sum(len(r) for r in coverage), flush=True)
        del src
    manifest = {'version': 1, 'projection': 'Equal Earth', 'extent': EXTENT,
                'tileSize': SIZE, 'gutter': GUTTER, 'levels': levels,
                'source': 'NASA Blue Marble Next Generation, July 2004, 500m',
                'sourcePage': 'https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/'}
    (output / 'manifest.json').write_text(json.dumps(manifest, separators=(',', ':'))+'\n')
    # Build provenance/integrity is not a runtime download.
    (output / 'inventory.json').write_text(json.dumps({'sources': records, 'tiles': inventory}, separators=(',', ':'))+'\n')
    # The same July source at overview size avoids a colour/season jump on zoom.
    overview = Image.new('RGBA', (LEVELS[0]['width'], LEVELS[0]['height']))
    for rel in inventory:
        if rel.startswith('0/'):
            _, x, name = rel.split('/')
            y = int(name.split('.')[0])
            with Image.open(output / rel) as im:
                overview.paste(im.crop((1, 1, im.width-1, im.height-1)), (int(x)*SIZE, y*SIZE))
    overview.save(output / 'overview.webp', quality=85, method=6)
    print('Total', len(inventory), 'tiles,', sum(v[0] for v in inventory.values()), 'bytes', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache', type=Path, required=True)
    parser.add_argument('--output', type=Path, default=ROOT / 'assets/earth-tiles/200407-v1')
    parser.add_argument('--workers', type=int, default=4)
    args = parser.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)
    build(args.cache, args.output, args.workers)
