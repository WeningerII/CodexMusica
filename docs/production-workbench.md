# Production shared workspace

The production HTML is generated from `src/index.template.html`, `src/app.js`,
`src/workbench.js`, and `src/workbench.css` by `scripts/build_html.js`. The new
interface uses native catalog, recipe compilation, part/preface cascades, room,
tuning, chain, Save and signed chat implementations. There is no copied engine
or runtime function replacement. Genre, Instrument, Map and Lyrics share one
recipe and saved session. Browser additions apply directly and support Undo.

Genre and instrument discovery use category controls and catalog rows. Circular
charts and the duplicate related-genre graph are removed; the browse tree,
category navigation, related-genre list, and YouTube Listen actions remain.

## State and recovery

Versioned autosave includes cards, name and lyrics. Named saves use schema 2;
legacy card-only saves still load. Export/import validate catalog identifiers
and preserve intentionally unset parts. Undo records musical refinements,
pinning, reordering, name and lyrics; visual tab changes retain the redo future.
Named writes serialize within and across tabs when Web Locks are supported.
Enumerating saved records recovers records orphaned by older index races.
Importing a legacy recipe-only file clears the previous session's lyrics; Undo
restores the complete previous session. Invalid imports leave it untouched.

Each tab keeps a recovery copy. A conflicting shared session is never silently
overwritten: the current tab is restored on reload and offers Keep this session
or Export. Storage failure cannot be reported as a permanent Save. AI recipe
transfers own their card objects. A lyric result auto-applies only to the same
request and unchanged draft; otherwise Use these lyrics is available. Switching
writers must durably preserve the compact continuation before changing state.

## Verification and release limits

- `scripts/check_workbench.js` boots freshly compiled source in jsdom and checks
  direct Undo controls, session recovery, invalid/partial imports, independent
  transfers, concurrent saves and failure-injected AI/storage boundaries.
- `scripts/check_lazy_app.js` waits for complete boot before comparing lazy and
  embedded catalogs, picker DOM, imports, recipes and failed-fetch behavior.
- `scripts/check_mobile_layout.js` retains the native viewport, touch target,
  overlap and drag gates with updated visible entry points.
- `scripts/ui_reachability_check.js` checks the 94 reachable inventory entries.
  Selector existence alone does not prove visibility or an end-to-end workflow.
- Adversarial browser review exercised 360/390px navigation, search, room edits,
  all eight chain stages, Undo/Redo, editor tabs and menu/dialog focus. The
  viewport harness did not exercise a physical phone keyboard or pinch input.
- Fixture chat tests do not establish live model quality or a completed long
  lyrics run. The review Site origin is not currently enabled by the AI service;
  the production codexmusica.com origin uses its existing service policy.
- The September 12 continuation rechecked genre search, instrument inspection,
  Listen URLs and lyrics routing in the managed browser. The local reachability
  command could not launch because its Playwright browser binary is absent;
  the repository CI must run that gate and the viewport suite before release.

Merge and Pages publication remain gated by the repository CI and release
workflow. A private review Site is a UI review build, not a claim that production
has been deployed or that all release gates passed.

## Map asset

`assets/earth-equal.webp` derives from NASA Blue Marble:
https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57730/land_ocean_ice_2048.jpg

`scripts/project_earth.py` reproduces the reprojection with Pillow and NumPy.
The image is a fixed world raster, not high-resolution satellite tiles. Existing
geographic anchors, verification metadata, tree, routes and Kin calculations
remain in use. No political boundary overlay is drawn. Attribution is available
in the map information control. The atlas publish gate checks runtime image
paths as well as data and HTML resources.
