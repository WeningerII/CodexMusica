# Asset attribution

## App icon / favicon (`icon-master.png`, `favicon-*.png`, `icon-*.png`, `apple-touch-icon.png`, `mstile-150x150.png`, `favicon.ico`, `og-image.png`)

Original to this project. The mark is a slash and an eighth note — `/♪` — in
green on black. `assets/icon-master.png` is the source of record; the per-size
PNGs and `favicon.ico` beside it are the owner's own cuts of that master and
ship byte-for-byte, pinned by SHA-256 in `scripts/build_favicon.js`. The 1024
listing icon and the mark inside `og-image.png` are rendered from the master by
`npm run assets:favicon`. No third-party glyph is used.

~~Drawn as plain SVG paths in `favicon.svg`.~~ **RETIRED 2026-09-14** with the
red mark it drew: the green artwork was delivered as a raster package and there
is no vector of it, so `favicon.svg` and `assets/icon.svg` were removed rather
than left shipping an icon the project no longer uses. Hand-tracing a
replacement would have shipped an approximation of the owner's art under a
claim of being its source.

Previously this icon composited **"music-note-eighth"** from
[Material Design Icons](https://pictogrammers.com/library/mdi/) (Apache-2.0)
onto a rounded tile. That glyph is no longer present in any shipped asset, so
the attribution it required no longer applies here — it is recorded only so the
change is traceable rather than silent. Material Design Icons is not otherwise
vendored in this repository.

## UI icons (`references/_assets/icons/`)

[Lucide](https://lucide.dev) icons, licensed **ISC** (see
`references/_assets/icons/_LICENSE.txt`).

## Atlas satellite imagery

`assets/earth-tiles/200407-v1/` is derived from NASA Earth Observatory's
[Blue Marble: Next Generation, base map](https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/),
July **2004**, native 500 m imagery (eight 21,600 × 21,600 source panels).
Credit: NASA Earth Observatory / NASA Goddard Space Flight Center, Blue Marble
Next Generation. This is a historical satellite composite, not live imagery.
`assets/earth-sources.json` pins the eight source URLs, byte counts and SHA-256
hashes. `scripts/build_earth_tiles.py` reprojects them to Equal Earth and writes
small WebP tiles at seven resolutions plus an overview. The generated inventory
records every output tile's bytes and hash; it is not fetched by the browser.
The older `assets/earth-equal.webp` remains the historical NASA Blue Marble
2002 derivative described in the original production workbench notes.
