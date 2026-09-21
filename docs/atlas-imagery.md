# Atlas imagery

The atlas keeps its Equal Earth canvas projection, cultural pins, filters,
routes, zoom limits and controls. A small July 2004 overview stays behind
on-demand WebP tiles. All imagery requests are same-origin static files; NASA
is contacted only by the explicit asset build.

## Sources and generation

NASA Blue Marble Next Generation, July 2004, 500 m base map. Eight native
21,600-square JPEG panels provide an 86,400 × 43,200 geographic raster.
`assets/earth-sources.json` locks source URLs, byte counts and SHA-256 hashes.
The build refuses changed source bytes. This imagery represents July 2004,
not current conditions. The map information control states that date.

Install Pillow 12.3.0 and NumPy 2.3.5, then run:

```sh
python3 scripts/build_earth_tiles.py --cache=/tmp/earth-source
python3 scripts/test_earth_projection.py
```

Allow approximately 16 GB scratch space for downloaded sources and memory-mapped
source pyramids. The builder samples tile pixel centres using the inverse Equal
Earth projection. Bilinear reconstruction and globally sampled one-pixel gutters
prevent discontinuities between tile boundaries. Lower source levels are filtered
with Lanczos before reprojection. Seven output levels span 1,350 × 657 through
86,400 × 42,048 pixels; reprojection changes local ground sampling, so the
500 m label describes the source, not uniform ground resolution on the map.

The generated directory is `assets/earth-tiles/200407-v1/`. Its URL version is
immutable once published: change it and both renderer/gate paths for a future
imagery replacement. The generated inventory holds tile hashes and source
receipts. Only the compact manifest is a runtime request.

The manual Build atlas imagery workflow can generate and commit these assets
on a selected first-party branch. It refuses main, never runs on PR events,
and refuses a non-fast-forward push. Routine CI verifies existing
assets; it does not download or regenerate satellite imagery.

## Browser loading

- The overview appears while the manifest or detail tiles load; failure leaves
  the overview and geographic controls usable.
- The requested level follows projected screen size and device pixel ratio,
  capped at 2. Very large viewports use a coarser complete level to fit the
  64-tile budget, rather than leaving only the centre sharp. Requests start after 100 ms without a changed tile selection.
- Only visible tiles are queued, nearest the viewport centre first. Six fetches
  run at once; obsolete requests abort. Each request has a 15-second timeout.
- At most 64 decoded tiles are cached (about 65 MiB of RGBA pixels), independently
  of the full pyramid size. Evicted ImageBitmaps are closed. Browser/GPU/network
  overhead and the canvas itself add memory beyond this pixel budget.
- Cached coarser tiles remain visible until sharper ones arrive. A failed tile
  retains the overview underneath. Failure history is bounded to 256 entries;
  returning to a tile after its failure record is evicted can attempt it again.
- Standalone/artifact builds inline the overview and disable network tiles.
  Their map stays self-contained instead of embedding the entire pyramid.

## Verification

`npm run check:atlas` includes tile publication/integrity checks and loader
regressions (selection, concurrency, cancellation, cache eviction, fallback,
timeouts and projection placement). The image inventory is checked against
tracked files, sizes and SHA-256 hashes. The overview is budgeted below 206 KB,
the manifest below 16 KB, and each individual tile below 250 KB.

`python3 scripts/test_earth_projection.py` checks independent geographic anchors,
shared gutter coordinates and transparent pixels outside the projected Earth.

## Verified browser results (2026-09-21)

Chromium 148, fresh local HTTP sessions, external font requests blocked. These
are actual transferred imagery file sizes, not a production latency benchmark.
The 20 desktop requests include the manifest, overview and 18 visible tiles.
No NASA panel or full-pyramid inventory is fetched at runtime.

| Viewport | Device pixel ratio | Initial imagery requests | Initial imagery bytes |
|---|---:|---:|---:|
| Desktop 1440 × 900 | 1 | 20 | 216,428 |
| Mobile 390 × 844 | 3 (tile selection capped at 2) | 2 | 52,130 |

The previous single image was 205,816 bytes. The new overview is 50,278 bytes;
the manifest is 1,852 bytes. Deeper tiles arrive only after zooming. The complete
seven-level pyramid contains 16,737 tiles totaling approximately 108.81 MB on
disk; that total is not a page download.

Desktop wheel/buttons and mobile touch buttons reach native detail. Zoom,
pan, reset and resize produced no page errors or missing tiles. Simulated tile
404s retained a usable map/search and did not trigger repeated requests for the
same failed selection. The standalone build embedded the overview, loaded
without page errors and did not load the tile module. Visual inspection checked
the world extent, land detail and fallback map.

Reproduce the browser check with an installed Playwright Chromium:

```sh
node scripts/check_atlas_tiles_browser.js
```

`CHROMIUM_PATH` may specify a Chromium executable. Screenshots are written to
the system temporary directory by the browser check. Unit tests also cover
complete viewport coverage within the cache budget on large retina displays.
The existing mobile suite passed 223 assertions across eight viewports; the
layout geometry and usability suites passed as well.

The first hosted asset build completed generation but failed in the verifier:
its all-file listing exceeded Node's default 1 MiB subprocess output buffer.
The pyramid verifier now scopes that listing and provides a 64 MiB buffer;
the atlas publication gate also uses 64 MiB. The artifact-cache and build-closure
listing readers use 16 MiB so the larger repository remains enumerable. The
second hosted imagery build passed and committed the generated tiles. Runtime
code never reads that repository inventory.
