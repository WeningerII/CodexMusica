# Native Genres image transition experiment

This draft starts at `4dcc7b054a52f6dac47f25ea224ac0eca54f3833`. It changes the
existing production-source Genres page, not the rejected Browse outline pilot.
No production HTML, prototype, route, catalog, Song Forms or publishing workflow
is changed. No deployment or merge is part of this experiment.

## Recipe and limits

The implementation adapts Google's Chrome for Developers code samples:

- [Same-document transitions](https://developer.chrome.com/docs/web-platform/view-transitions/same-document),
  by Jake Archibald and Bramus: temporary shared image names, native DOM-update
  callback, cleanup after `finished`, and disabling the image pair's crossfade.
- [Modern Web Guidance](https://developer.chrome.com/docs/modern-web-guidance/guides/ui-behaviors/same-document-transitions):
  unique names per snapshot, instant fallback, reduced motion, and shared-image sizing.
- [Expanding-image demo](https://simple-vt-demos.jakearchibald.com/6-expanding-image/)
  was inspected as the live behavior reference. Its routing helper was not copied.

The official documentation footers identify code samples as Apache License 2.0.
The adapted portions of `src/pages/genre.js` and `src/pages/genre.css` retain that
license; a [copy is included](licenses/chrome-view-transitions-Apache-2.0.txt).
The rest of the repository retains its existing license. Adaptations use the
existing page actions and photo elements rather than replacing the document or
adding navigation. The M3 page required JavaScript in the research fetch; no
unverified M3 media is offered as evidence.

Only the existing surface of a fully visible, already loaded actual photograph
is named. Naming its surface preserves the card’s existing clipped hover zoom. The clicked
card/row supplies the old image; the same genre's detail supplies the new image.
Return uses the existing close path and its existing scroll/focus restoration.
Missing, broken, loading, clipped or absent counterparts skip motion. Related
links without a real card/row opener do not get an invented source. Both
snapshots contain at most one `genre-image` name.

The existing detail photograph is smaller than the Rows photograph. Therefore
open contracts and return expands; this is not a larger hero or a layout change.
The native image moves above the unchanged destination page for 250ms. The rest
of the page does not slide or crossfade. The overlay does not take pointer input.

State and focus still use the existing action bodies. A subsequent open/back
finishes a pending action once before applying the next. Keyboard/resize/motion
preference interruptions commit the pending action and skip its animation. A
new pointer press supersedes an uncommitted update so it cannot remove the new
pointer target before its click. An unrelated render cancels a pending stale
update. Cleanup is idempotent and cannot erase a newer transition's name.

## Local before/after preview

There is no tracked isolated branch-preview workflow. `sync-pages` publishes
main to production and must not be invoked for this experiment. These two local
checkouts serve the full existing site and its dependencies with the repository's
Pages server. They are not a standalone Site or a hosted public preview.

From the repository, substitute the exact draft PR head for `CANDIDATE_SHA`:

```sh
git worktree add --detach /tmp/cm-genres-before 4dcc7b054a52f6dac47f25ea224ac0eca54f3833
git worktree add --detach /tmp/cm-genres-after CANDIDATE_SHA
```

In one terminal:

```sh
cd /tmp/cm-genres-before
npm ci --ignore-scripts
node scripts/build_html.js --out=codex.html --no-minify --check
node scripts/_pages_server.js --root=. --port=8123
```

In another:

```sh
cd /tmp/cm-genres-after
npm ci --ignore-scripts
node scripts/build_html.js --out=codex.html --no-minify --check
node scripts/_pages_server.js --root=. --port=8124
```

Open `http://127.0.0.1:8123/codex.html#genre` and
`http://127.0.0.1:8124/codex.html#genre` side by side in Chromium. Close the opening
feature, wait for the real photographs, and select Delta blues, Detroit techno
or Javanese gamelan. Try Rows and List, Close and Escape, horizontal scrolling,
keyboard entry, and reduced motion. Keep each browser viewport at the same width
(390 or 1280) for a controlled comparison. `git rev-parse HEAD` in each checkout
identifies the served revision. The generated `codex.html` is local only.

Photo hosts can fail independently. A failed photo intentionally means instant
behavior. The automated comparison below caches the original bytes of three
catalog photographs without substituting artwork or changing the catalog.

## Reproducible validation

Build main and candidate to separate files; for example copy the two local
checkout builds to `/tmp/genres-native-before.html` and
`/tmp/genres-native-after.html`. In the candidate checkout:

```sh
CHROMIUM_PATH=/usr/bin/chromium node scripts/check_genre_transition_browser.js \
  --baseline=/tmp/genres-native-before.html \
  --html=/tmp/genres-native-after.html \
  --output=/tmp/genres-native-evidence
CHROMIUM_PATH=/usr/bin/chromium node scripts/check_genre_focus_browser.js \
  --html=/tmp/genres-native-after.html
npx eslint src/pages/genre.js scripts/check_genre_transition_browser.js
npx prettier --check src/pages/genre.js src/pages/genre.css \
  scripts/check_genre_transition_browser.js docs/genres-native-transition.md
```

Install Playwright's video support with `npx playwright install ffmpeg` if needed.
`PLAYWRIGHT_BROWSERS_PATH` can place that cache under `/tmp`. The comparison needs
`curl` and network access on its first run to cache the catalog's licensed photos.

The comparison records video, resting screenshots, browser version, HTML hashes
and actual native keyframes in `results.json`. It checks three real genres in
Rows and List at 390/1280, baseline focus and horizontal-scroll parity, tabs,
shell Back/Forward, delayed rapid selections and Escape, Tab during capture,
resize/reduced-motion/wheel interruption, emulated touch, cold images, reduced
motion, feature-disabled fallback and unique snapshot names. It requires native
image animations to actually render; using baseline as the candidate is a
negative control that must fail this assertion.

This is desktop Chromium with phone viewport/touch emulation, not physical-phone,
Safari or Firefox testing. It does not establish a compositor performance budget
or acceptance of the visual design. Hands-on review remains necessary.
