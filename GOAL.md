# GOAL — Complete the instrument catalogue

Living ledger for the `/goal` autonomous build. `/goal` reads this, executes the next
unchecked **Track 1** item, validates, commits, pushes, checks it off here, and repeats.
Branch: `claude/instrument-kit-atoms`. **Never merged to main without the user.**

> **STATUS (2026-06-02): Track 1 (breadth) COMPLETE.** 41 instruments added this run
> (kit ×11, folk/dance ×5, body-percussion ×4, percussive-dance ×2, orchestral/effect
> idiophones ×15, standard gaps ×4 = ukulele/clavichord/davul/gadulka), plus the flamenco
> tap variant. 421 → 462 instruments, output byte-identical throughout (recipe regression
> 1198/1198 on every commit). The catalogue is now audited near-complete; remaining work is
> the **Gated** output-changing items below, which need the user's explicit go.

## The contract (why this can run unattended)
- **Prime invariant:** every shipped change keeps `npm run test:recipes` at **1198/1198**
  (existing output byte-identical). Anything that would change output → `## Gated`, not shipped.
- **Research-grounded:** every instrument / variant / descriptor verified against a real
  source. No conversational invention (the "busker kick" error). Sources cited in commits.
- **No duplicates / no new structure:** audit before adding; an instrument is just an
  instrument — existing `{ id, name, family, class, axes, short, parts }` shape only.
- **Validated every batch:** validate.js + recipe regression + check_docs + rebuild codex.html.

## Audit reality (2026-06-02)
437 instruments across 11 families; **every** instrument already decomposed into
parts/variants/defaults (~4,000 variants). This is **gap-filling, not a rebuild** — a
bounded set of genuinely-missing standard instruments, plus the gated structural items.
Family counts: percussion 125 · plucked_traditional 76 · wind 73 · ensemble 32 ·
bowed 31 · electronic 25 · acoustic_strings 24 · keyboard 16 · free_reed 14 ·
electric_strings 11 · voice 10.

## Done
- [x] Western drum-kit pieces ×11 — `c7f045e` (bass_drum, snare_drum, rack_tom, floor_tom,
      hi_hats, ride_cymbal, crash_cymbal, gong, octoban, cowbell, woodblock)
- [x] Folk/dance idiophones ×5 — `e25ff89` (tap_shoes, spoons, rhythm_bones, jaw_harp, washboard)

## Track 1 — genuine breadth gaps (autonomous · pure additions · keep 1198/1198)
Each item: verify it isn't a synonym/variant of an existing instrument → research real
organology → author → validate → commit with sources → check off with SHA.

### Batch A — body percussion (genuinely absent; includes the user's stomp-clap) ✅
- [x] hand_clap (claps; flamenco palmas — claras/sordas — as variants)
- [x] finger_snap (single + pitos)
- [x] foot_stomp (floor + resonant-platform; stomp-clap / Sacred Harp / clogging)
- [x] hambone / body percussion (patting juba — thigh, chest, cheek)
  (beatbox already present in the voice family — skipped)

### Batch B — percussive dance (tap_shoes already done) ✅
- [x] zapateado footwear → added as a 4th `tap_shoes` variant (`tap_flamenco_clavos`),
      consistent with how tap_shoes already bundles rhythm/Broadway/Irish footwear
- [x] gumboot (isicathulo; Wellington boots, stomp+slap, optional belled variant)
- [x] ghungroo / ankle bells (brass-Kathak default, copper, salangai-Bharatanatyam)

### Batch C — orchestral & effect idiophones ✅ (all 15 verified genuinely absent, then added)
- [x] crotales (tuned_percussion; struck + bowed) · [x] tubular_bells (tuned_percussion)
- [x] musical_saw (bowed friction) · [x] glass_harmonica (+ glass-harp variant)
- [x] waterphone (bowed/struck) · [x] cabasa (steel + gourd) · [x] finger_cymbals (zills + sagat)
- [x] flexatone · [x] vibraslap · [x] ratchet · [x] mark_tree (+ bamboo) · [x] sleigh_bells
- [x] slapstick · [x] anvil · [x] thunder_sheet
  (glass_harmonica's presence-check hit was a substring false-positive on the free-reed
  `harmonica`; the friction idiophone was genuinely absent.)

### Batch D — per-family completeness audits ✅ (one broad cross-family presence audit)
Audited every family against standard inventories. The catalogue is already near-complete:
saxophone carries all 4 sizes + 26 variants; `bass_clarinet`/`contra_clarinet` are clarinet
variants; Hammond lives inside `tonewheel_organ`; viola/cello/double_bass exist standalone;
classical/flamenco/resonator/archtop/semi-hollow guitars all present; free_reed complete.
Genuine *standard* gaps found and added:
- [x] ukulele (acoustic_strings) — soprano/concert/tenor/baritone sizes
- [x] clavichord (keyboard) — fretted/unfretted, Bebung vibrato
- [x] davul (percussion/membranophone) — bass (tokmak) + treble (çubuk) heads, Balkan tapan
- [x] gadulka (bowed) — sympathetic-string + plain forms
Skipped as padding/synonyms: sousaphone (≈ tuba wrap), vuvuzela (one-note novelty),
generic slit_drum (already covered by nafa / pahu / log_drum).

## Gated — output-changing (needs explicit user go; NOT autonomous)
These change existing recipes, so they violate the prime invariant. Produce a measured
recipe delta and wait for the user before shipping.
- [ ] **Phase B — kit_configuration:** add a `kit_configuration` part on `drum_kit`
      (3/4/5/7-piece) + wire genre kit defaults via `tradition.parts`. Changes `drum_kit`
      recipes across ~248 traditions.
- [ ] **Strings split:** `violin_orchestral` → `violin` / `viola` / `cello`; re-point the
      ~59 traditions that reference it. Changes their recipes.
- [ ] **Choir split:** `choir_ensemble` → SATB sections; re-point the ~67 traditions.

## Needs a call
(empty)

## Progress log
- 2026-06-02: `/goal` created; catalogue audited (437 instruments already fully decomposed);
  Track 1 backlog grounded against a presence-check (36 candidates already present, ~20
  genuine gaps). Prior work: kit pieces (`c7f045e`), folk/dance idiophones (`e25ff89`).
- 2026-06-02: Batch A shipped — body percussion ×4 (hand_clap, finger_snap, foot_stomp,
  hambone), class hand_percussion, grounded in flamenco-palmas + patting-juba sources.
  441 instruments; regression 1198/1198; check_docs green.
- 2026-06-02: Batch B shipped — percussive dance: +gumboot, +ghungroo (class idiophone),
  + flamenco clavos variant on tap_shoes. 443 instruments; regression 1198/1198; check_docs green.
- 2026-06-02: Batch C shipped — orchestral & effect idiophones ×15 (crotales, tubular_bells,
  musical_saw, glass_harmonica, waterphone, cabasa, finger_cymbals, flexatone, vibraslap,
  ratchet, mark_tree, sleigh_bells, slapstick, anvil, thunder_sheet). Axes calibrated to
  glockenspiel/vibraphone/maracas siblings. 458 instruments; regression 1198/1198; check_docs green.
- 2026-06-02: Batch D shipped — cross-family audit; catalogue confirmed near-complete.
  Added 4 genuine standard gaps: ukulele, clavichord, davul, gadulka (4 different families).
  462 instruments; regression 1198/1198; check_docs green. Track 1 breadth complete.
