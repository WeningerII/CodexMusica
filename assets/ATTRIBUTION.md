# Asset attribution

## App icon / favicon (`icon.svg`, `favicon.svg`, `icon-*.png`, `apple-touch-icon.png`, `og-image.png`)

Original to this project. The mark is a slash and an eighth note — `/♪` — drawn
as plain SVG paths in `favicon.svg`; every raster beside it is generated from
that one file by `npm run assets:favicon`. No third-party glyph is used.

Previously this icon composited **"music-note-eighth"** from
[Material Design Icons](https://pictogrammers.com/library/mdi/) (Apache-2.0)
onto a rounded tile. That glyph is no longer present in any shipped asset, so
the attribution it required no longer applies here — it is recorded only so the
change is traceable rather than silent. Material Design Icons is not otherwise
vendored in this repository.

## UI icons (`references/_assets/icons/`)

[Lucide](https://lucide.dev) icons, licensed **ISC** (see
`references/_assets/icons/_LICENSE.txt`).
