# Genres motion pilot

This pilot stays on Browse: a shelf card opens the existing **Selected tradition**
panel; **Close details** returns focus to its card while keeping the selection.
The 280 ms, uniform 2px container outline connects those two locations without delaying the
panel, cloning its content, or changing the horizontal shelf. Timing is a pilot
choice, not a measured usability threshold. No route leads into the separate
Genre lane as part of this change.

`createContainerMotion` lives inside the Browse lane to respect its import
boundary. Capture a disappearing source before removal; measure a surviving card after
selection and announcement commit. Then call `connect`.
It owns only a pointer-transparent, aria-hidden outline. A new action cancels the
old outline. Genuine scroll, changing target geometry, viewport resize, reduced-motion
changes and unmount also cancel it. Completion callbacks cannot affect a newer
transition. Reduced motion or unavailable animation produces the instant UI;
shelf navigation still uses instant scrolling. No state or focus waits on motion.

## Quick visual comparison

[Phone: outline off / on](evidence/genres-motion-pilot/phone.gif) ·
[Desktop: outline off / on](evidence/genres-motion-pilot/desktop.gif)

These looping GIFs show the same real Honky-tonk card opening, the shelf scrolling
to its far end, and Close revealing the opener, at 390 and 1280 px. The decorative
outline alone is hidden on the left with a CSS visibility rule; it is visible on
the right. Both sides run identical source with the same normal-motion setting
and focus behavior. The actual status line remains visible, including its reflow.
They sample Chromium animation frames every 40 ms, replayed at 25 fps, with short
holds between actions. They are visual comparisons, not real-time performance
recordings. No status content or scroll events are hidden or suppressed. The desktop capture is scaled to fit. The implementation and these
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

## Visual lifecycle regressions

`visual-lifecycle.cjs` runs in the real shell with visible status at 320×568,
390×844 and 1280×900. It compares the opening keyframe to the actual surviving
card after two frames, including the first announcement. Four ordinary catalog
selections retain the unmodified status layout. A separate later-selection wrap
fixture temporarily limits the visible status to 20ch and calibrates a pair of
real catalog announcements whose rendered heights differ on the installed font.
It replays that actual selection, verifies changed status text, status height and
card position, then checks cue geometry after two frames. The original inline
style is restored before return/scroll checks. No announcement text, card geometry
or selection behavior is mocked. This avoids assuming that four fixed messages
will occupy different line counts on every host.
After native scrolling and Close it checks two-frame return-cue survival and
progress, then verifies that genuine scrolling cancels. A second control races
genuine movement against the reveal's queued event before the first frame.
The survival probes use 0.1× animation playback so a loaded CI host cannot
confuse natural completion with cancellation before the second frame; animation
time still advances. No scroll event is synthesized, blocked or stopped.
The existing motion scenario and GIF comparison retain normal timing.

The primitive records only the scroller explicitly passed after an instant
reveal, at its measured position. Its queued scroll event is harmless if those
coordinates are unchanged. A changed position cancels immediately, even before
the first frame; other scroll targets cancel normally. There is no timer,
one-event exemption or period with cancellation disarmed. Existing geometry,
resize, reduced-motion, rapid-action and teardown safeguards remain in place.

Negative controls reintroduce stale opening capture and unconditional scroll
cancellation independently using test-only request interception. Both fail the
new asynchronous checks. Proximity-snap clipping, double-click cancellation and
fade timing are unchanged and remain outside this corrective pass.
