# Genres motion pilot

This pilot stays on Browse: a shelf card opens the existing **Selected tradition**
panel; **Close details** returns focus to its card while keeping the selection.
The 280 ms container outline connects those two locations without delaying the
panel, cloning its content, or changing the horizontal shelf. Timing is a pilot
choice, not a measured usability threshold. No route leads into the separate
Genre lane as part of this change.

`createContainerMotion` lives inside the Browse lane to respect its import
boundary. Call `capture` before committing layout, then `connect` afterwards.
It owns only a pointer-transparent, aria-hidden outline. A new action cancels the
old outline. Scroll, changing target geometry, viewport resize, reduced-motion
changes and unmount also cancel it. Completion callbacks cannot affect a newer
transition. Reduced motion or unavailable animation produces the instant UI;
shelf navigation still uses instant scrolling. No state or focus waits on motion.

## Reproducible before/after browser comparison

Use the exact reviewed PR head SHA from the PR description in place of HEAD_SHA.
These commands serve local checkouts, never production. Run the two servers in
separate terminals from the repository root:

```sh
git fetch origin HEAD_SHA
git worktree add --detach /tmp/musica-motion-before 47f010dfa92f1eb51723ce2b0753967997bb343b
git worktree add --detach /tmp/musica-motion-after HEAD_SHA
node scripts/_pages_server.js --root=/tmp/musica-motion-before --port=8011
node scripts/_pages_server.js --root=/tmp/musica-motion-after --port=8012
```

Open <http://127.0.0.1:8011/prototype/#browse> (before) and
<http://127.0.0.1:8012/prototype/#browse> (after). Use a fresh browser context for
each side so each starts without a restored prototype selection. Ports isolate
storage. Both sides use the committed real catalog.

1. At 1280 px, activate Honky-tonk, Bakersfield country and Outlaw country in
   turn; close each panel. Before cuts immediately; after adds the moving outline.
2. At 320 and 390 px, repeat by tapping and by Enter/Space. Arrow keys, Home and
   End move shelf focus. Selection remains pressed after close; close returns
   focus without scrolling the shelf to a different position.
3. Select a different card or close immediately during the outline movement.
   Scroll the shelf during selection. The final panel and pressed card must
   agree, with no lingering outline.
4. Switch reduced motion on during a transition and resize during another.
   The outline disappears. With reduced motion on, repeat open/close: instant.
5. In the after tab's console set `Element.prototype.animate = undefined`, then
   repeat. The same panel and focus behavior work immediately. Reload to restore.

The native behavior has no Escape handler; this pilot retains its Close button
and does not add a new keyboard contract. Touch tests are Chromium emulation,
not physical-device evidence. No screen-reader, Firefox, Safari, user-study or
frame-budget qualification is claimed. The outline is an initial visual treatment
for exact-head review, not an accepted usability improvement.

## Checks

Install the existing lockfile dependencies with `npm ci`; no new dependencies.
Use `CHROMIUM_PATH` for the available Chromium executable (the commands below use
`/usr/bin/chromium`):

```sh
CHROMIUM_PATH=/usr/bin/chromium node scripts/check_prototype_lanes.js
CHROMIUM_PATH=/usr/bin/chromium node scripts/check_prototype_isolation.js --base=47f010dfa92f
CHROMIUM_PATH=/usr/bin/chromium node scripts/check_prototype_hosts.js
CHROMIUM_PATH=/usr/bin/chromium node scripts/run_prototype_scenarios.js --keep-results
```

The documented scenario runner discovers both Browse scenarios automatically.
The existing discovery fixture covers the lane contract; `motion.cjs` uses the
real shell/catalog and checks three genres, native activation, interruption at
25/50/75%, selection/focus/scroll, paused-animation cancellation on reduced motion
and resize, missing/throwing animation APIs, and page errors at all three widths.
Runner receipts are written outside the checkout and reconciled against scenario
blobs. Test results and the exact reviewed head belong in the PR description.
