# Genres motion pilot

This pilot stays on Browse: a shelf card opens the existing **Selected tradition**
panel; **Close details** returns focus to its card while keeping the selection.
The 280 ms, uniform 2px container outline connects those two locations without delaying the
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

## Quick visual comparison

[Phone: instant / revised motion](evidence/genres-motion-pilot/phone.gif) ·
[Desktop: instant / revised motion](evidence/genres-motion-pilot/desktop.gif)

These looping GIFs show the same real Honky-tonk card opening and closing, instant
on the left and revised motion on the right, at 390 and 1280 px respectively.
They sample Chromium animation frames every 40 ms, replayed at 25 fps, with short
holds between actions. They are visual comparisons, not real-time performance
recordings. The instant side uses reduced motion on this same source; the status
region is hidden in both captures to keep changing announcements out of the
comparison. The desktop capture is scaled to fit. The implementation and these
captures are pinned together by the PR head; use that head for the live comparison
below. No physical-device or frame-budget claim follows from these GIFs.

The revised cue keeps its opacity through most of the travel and animates its
bounds instead of scaling its border. This paints one empty fixed-position box;
it avoids a squashed edge at the cost of paint work that has not been performance
qualified. It never blocks input or delays the actual panel. When no real opener
exists (for example after a map selection), focus follows the existing shelf
fallback and there is no return cue toward a potentially different selected card.

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
   End move shelf focus. Selection remains pressed after close. A fully visible
   opener keeps its shelf position; an offscreen opener is revealed with nearest,
   instant scrolling before the return cue is measured. Also open the first card,
   scroll to the shelf’s far end, and close: focus must be visibly back on it.
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
25/50/75%, selection/focus/scroll, fully offscreen and visible opener return,
post-reveal geometry, paused-animation cancellation on reduced motion
and resize, missing/throwing animation APIs, and page errors at all three widths.
Runner receipts are written outside the checkout and reconciled against scenario
blobs. Test results and the exact reviewed head belong in the PR description.
