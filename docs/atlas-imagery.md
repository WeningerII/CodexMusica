# Atlas imagery

The atlas keeps its Equal Earth canvas projection, cultural pins, filters,
routes, zoom limits and controls. A small July 2004 overview stays behind
on-demand WebP tiles. All runtime requests are same-origin static files; NASA
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

The Build atlas imagery workflow can generate and commit these assets on the
implementation branch. It is restricted to that first-party branch, never PR
code or main, and refuses a non-fast-forward push. Routine CI verifies existing
assets; it does not download or regenerate satellite imagery.

## Browser loading

- The overview appears while the manifest or detail tiles load; failure leaves
  the overview and geographic controls usable.
- The requested level follows projected screen size and device pixel ratio,
  capped at 2. Requests start after 100 ms without a changed tile selection.
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
Browser measurements and visual verification are recorded below after building.
