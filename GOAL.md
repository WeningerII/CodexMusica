# GOAL — Complete the instrument catalogue

Living ledger for the `/goal` autonomous build. `/goal` reads this, executes the next
unchecked **Track 1** item, validates, commits, pushes, checks it off here, and repeats.
Branch: `claude/instrument-kit-atoms`. **Never merged to main without the user.**

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

### Batch B — percussive dance (tap_shoes already done)
- [ ] zapateado footwear (flamenco; clavos/nails in toe & heel)
- [ ] gumboot boots (isicathulo; wellington boots, body slaps)
- [ ] ghungroo / ankle bells (kathak, bharatanatyam — pitched cluster of small bells)

### Batch C — orchestral & effect idiophones (VERIFY-then-add; some may be synonyms)
- [ ] musical saw (bowed/struck idiophone)
- [ ] glass harmonica / glass harp (friction idiophone)
- [ ] flexatone
- [ ] vibraslap (modern jawbone/quijada substitute — verify quijada absent)
- [ ] ratchet (cog rattle / crécelle)
- [ ] mark tree / wind chimes (bar chimes)
- [ ] sleigh bells (jingles)
- [ ] slapstick / whip
- [ ] anvil (tuned/untuned)
- [ ] thunder sheet
- [ ] waterphone
- [ ] crotales / antique cymbals — VERIFY vs any existing antique/finger cymbal first
- [ ] tubular bells / chimes — VERIFY vs existing celesta/glockenspiel naming first
- [ ] finger cymbals / zills — VERIFY vs existing
- [ ] cabasa — VERIFY vs existing afuche/shaker first

### Batch D — per-family completeness audits (the non-percussion families)
For each: pull the family's standard inventory from an authoritative source, diff against
the catalogue, add only genuine gaps (skip synonyms). Record findings under Progress log.
- [ ] percussion — finish (pitched idiophones, world frame/slit/log drums, friction drums)
- [ ] wind (73) — woodwind + brass standard inventory diff
- [ ] plucked_traditional (76) — world plucked-string diff
- [ ] bowed (31) — world bowed-string diff
- [ ] free_reed (14) — accordion / harmonica / sheng-khaen family diff
- [ ] keyboard (16) — diff
- [ ] voice (10) — vocal register / technique diff
- [ ] acoustic_strings (24) · electric_strings (11) · electronic (25) · ensemble (32) — diff

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
