# Changelog

All notable changes to this project are recorded here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/). This file replaces the former
`docs/plans/` collection of point-in-time planning documents.

## [Unreleased]

### Added — family glyphs on the instrument picker's headings

The instrument emoji were already assigned and already drawn on card thumbnails,
the detail header and the part rows; the picker — the one screen whose whole job
is *finding* an instrument — showed none of them.

- Each of the 11 family headings now carries a glyph, from a new `_family_header`
  map in `scripts/_instrument_emoji_map.json` emitted as `FAMILY_HEADER_EMOJI`.
- It is a separate map from `_family_fallback` on purpose. The fallbacks are
  per-instrument card art, where acoustic, electric and plucked-traditional all
  resolving to the guitar is correct; on three adjacent headings it is three
  identical pictures. The heading map is mutually distinct — the generator fails
  the build if it ever isn't — so electric-stringed takes the plug and
  plucked-traditional the banjo.
- The find-similar view also gained a per-row glyph. It is the one instrument
  list that is *not* grouped by family, so the glyph carries information there.

**Not done: a glyph on every picker row.** The registry resolves 872 instruments
to 16 distinct glyphs, and the picker is already grouped by family, so within a
block the glyph is constant — 1 distinct glyph across all 162 bowed instruments,
1 across 29 acoustic strings, 1 across 41 ensembles. A per-row glyph there
repeats the heading up to 162 times and tells the eye nothing. Worth doing only
after the instrument vocabulary is widened the way the room and preface ones
were; that is a data task, not a UI one.

### Fixed — re-running build_emoji.js corrupted the asset manifest

The script strips its previously emitted block before re-emitting, but the strip
pattern still looked for a heading (`EMOJI_REGISTRY`) that the script had stopped
writing (`EMOJI registries`). The strip silently no-opped and the whole block was
**appended** instead of replaced — a second `const EMOJI_SVGS` in the same file,
which is a hard syntax error in the browser build. It matches both headings now,
and asserts the strip actually removed the old block rather than trusting it.

### Added — 92 prefaces closing systematic gaps in the lexicon

The lexicon had 649 entries and whole families missing from it. It carried
`optimistic` with no `pessimistic`, `lustful` with no `virtuous`, `frantic` with
no `composed`, and nothing at all for the variety-stage register — no
`vaudevillian`, `cabaret`, `burlesque` or `music-hall`. A word a user types and
the app cannot match is a dead end, so the gaps were worth closing as families
rather than one word at a time.

Now 741. The eleven families added: seduction and flirtation, pessimism and
resignation, reluctance and hesitation, the theatrical register, carnal and
coarse, virtue and piety, mania and hysteria, composure and poise, complexity,
simplicity, and a run of common temperament words (`plaintive`, `jaunty`,
`brash`, `sullen`, `smug`, `aloof`, `reckless`, `maudlin`).

- Every token was drawn from the vocabulary existing prefaces already use, so
  the new entries sit in the same space rather than beside it. All ~740 token
  choices resolve against the production descriptor universe on the first pass —
  `check_prefaces.js` reports 741 prefaces, 6662 tokens, 0 issues.
- Each new word also carries a navigation glyph, which is not optional: the
  coverage gate added with the glyph vocabulary failed the build until all 92
  had one. That is the gate doing its job on the first change after it landed.
  Preface glyph count rises 421 → 519 distinct.
- 20 entries needed a `PREFACE_CAT_OVERRIDE`. The keyword rules put them in the
  wrong neighbourhood for legible reasons — `congregation-loud` reads as Sacred,
  so `bawdy` and `vulgar` filed under devotional; `clownish` scored Grief off its
  slide tokens; the minimal/beat-free simplicity words drifted into Ambient.
- Deliberately not added: `minstrel`. The word names a specific racist
  performance tradition, and nothing about the app needs it as an aesthetic a
  user applies to a recording.
- `composed` shares 🧘 with `calm`. Every distinct candidate was either taken or
  a weak literal; sharing the glyph of a true synonym is the documented
  exception, and it is the honest answer for two words this close.
### Fixed — a superseded build could overwrite the live site

The publish workflow had no gate on it, and it shipped a stale artifact to
production twice on consecutive merge pairs without anything going red.

- **What was happening.** `sync-pages.yml` checks out the exact commit CI
  validated, builds `codex.html` from it, then does `git checkout -B main
  origin/main` and copies that build onto whatever main is at push time. Those
  are two different trees the moment main advances in between. Publishes are
  serialized but **not ordered** (`concurrency: cancel-in-progress: false`), so
  when two PRs merge minutes apart the older run can land last and overwrite the
  live artifact with a build made before the newer merge existed. It did: once
  dropping PR #106's CSS, then again dropping an **823 KB** `09_nav_glyphs.js`
  data block, leaving the live app without its navigation glyph assets.
- **Why nobody caught it.** The auto-publish commit message was
  `"...from $(git rev-parse --short HEAD)"`, evaluated *after* the branch switch —
  so it always named main's tip and could never reveal that the artifact came
  from somewhere older. Every stale publish announced itself with the right sha.
- **The fix.** `scripts/publish_guard.sh` stands the job down when main carries
  source the artifact was not built from. It compares **source**, not shas, and
  that distinction is the whole design: main's tip is almost always an
  auto-publish commit, which by construction rewrites only the generated outputs
  and never reverts source, so a sha comparison would refuse every legitimate
  publish while a source comparison sees straight through it. Generated outputs
  (`codex.html`, `llms.txt`, `sitemap.xml`, `robots.txt`, `api/`) are excluded
  from the diff — they are what is about to be overwritten. `index.html` and
  `AGENTS.md` are deliberately *not* excluded: sync-pages copies both through
  verbatim from the built ref, so they are inputs.
- **Standing down is a no-op, not a failure.** Exit 10 means the newer commit has
  its own CI run and that run publishes it. The final `git push` stays a plain
  push, never a force: if main advances in the seconds after the guard runs, the
  push is no longer a fast-forward and git refuses it. The guard closes the wide
  window; non-fast-forward closes the narrow one.
- **New gate: `npm run check:publish`** (`scripts/check_publish_guard.js`) builds
  throwaway git repositories and replays the sequence — nothing moved, a newer
  merge, an auto-publish commit on top, a newer merge hidden *under* an
  auto-publish commit, a landing-page edit, and a missing or bogus `BUILT_SHA`.
  Verified two-sided in both directions: reverting the guard to always-publish
  fails 3 cases, and implementing it the obvious way — comparing shas — fails the
  auto-publish case, which is to say the naive fix would have silently blocked
  every real publish.

### Added — a navigation glyph vocabulary for rooms and prefaces

The tradition tree is fast to scan because every row carries a pair of
pictographs: a function glyph inherited from the root, and a second glyph for
the branch. Nothing else in the app had that. The room picker was 256 rows of
prose under seven text headings; the preface browser, 649 words under sixteen.
Both are now on the same two-axis system.

- **`ROOM_CLUSTER_GLYPH` / `ROOM_GLYPH`** — 7 cluster glyphs, one per room across
  all 256, 173 distinct glyphs in total.
- **`PREFACE_CAT_GLYPH` / `PREFACE_GLYPH`** — 16 category glyphs, one per preface
  across all 649, 428 distinct glyphs in total.
- Curated against the whole Twemoji set (3,720 glyphs) rather than the 16 the
  instrument registry reuses. A vocabulary that repeats is wallpaper: it costs
  page weight and returns no navigational information.
- Where a row sits under its own cluster heading it shows axis 2 alone — the
  heading already supplies axis 1. Loose chips (recently-used prefaces, the
  suggestion fan) and the composer's environment row carry the full pair,
  because nothing above them supplies the first axis.
- New `references/09_nav_glyphs.js`, generated by `scripts/build_nav_glyphs.js`
  from `scripts/_nav_glyph_map.json`. It got its own file rather than becoming a
  fourth writer of `08_asset_manifest.js`, whose three existing writers already
  carry a documented ordering footgun.
- The generator fails on an unassigned row, on an assignment to an id that has
  left the catalog, and on a row that would draw the same picture twice. The
  duplicate case is not hypothetical: it caught 25 of them. It lands on the
  archetypal member of a cluster (the cathedral in "large indoor", the taiga in
  "outdoor") and on the archetypal word of a category (`comforting` under
  TENDERNESS, `cutting` under BRIGHT & CUTTING) precisely because the same
  glyph is the obvious pick for both axes. Axis-1 glyphs are now reserved: a
  cluster or category glyph is never also a row glyph.
- **Cost: `codex.html` grows 4,369,051 → 5,191,886 bytes (+823 KB, +19%)**, all
  of it glyph artwork, embedded because both surfaces are modals that must open
  instantly. 92 of the 503 glyphs are also inlined in the tradition table in
  `src/app.js`; merging the two stores would return roughly 150 KB and is the
  obvious next move if the weight matters more than the isolation.

### Fixed — the skin convention is enforced instead of remembered

`✊` (protest song and topical song) and `🫠` shipped stock Twemoji yellow next to
`🤠`, `🥹` and `😴`, which had been recoloured to the codex green by hand. The
convention was real, undocumented, and applied by eye, so it drifted.

- Both glyphs recoloured. The mapping was derived from the glyphs that already
  followed the convention rather than invented: `#FFDC5D`/`#FFCC4D` → `#77bf57`,
  `#EF9645`/`#FFAC33` → `#6ab948`.
- `scripts/_glyph_skin.js` owns the convention; `build_nav_glyphs.js` applies it
  at build time, so new artwork cannot arrive yellow.
- `scripts/check_glyph_skin.js` enforces it, wired into `npm test` and
  `scripts/build.js`. Run against the pre-fix tree it flags exactly `270a` and
  `1fae0` — the two real defects — and nothing else.
- One documented exception: 🪷 LOTUS paints its flower centre with the skin
  colour. It is the only glyph in the 15.x set using a skin colour for something
  that is not skin, and greening it would turn its heart green.

### Changed — emoji vendoring can source from npm

`scripts/fetch_emoji.js` gained `--source=npm`, which pulls the same CC-BY
artwork from the `@twemoji/svg` package; sandboxes routinely allow the npm
registry and block the CDN, and this vocabulary needed 478 new assets.
Neither source overwrites an already-vendored file without `--force`, `--prune`
removes assets the map no longer references, and `_TWEMOJI_VERSION.txt` records
every source drawn from — the published package is 15.0.0 and has been through a
different SVGO pass, so its markup is not byte-identical to the CDN's 15.1.0.
The package's own MIT licence is deliberately *not* copied over the vendored
CC-BY text: it covers the packaging, not the artwork.
### Fixed — "Add instrument to tradition" dropped the instrument into Ungrouped

The sidebar's per-genre "Add instrument to tradition" button stashed the target
genre on `app._addToTradition` and opened the instrument picker — but no code
ever read that field back. The picker's add handlers called `addCard(iid)` with
no options, so the new card got `traditionId: null` and the sidebar filed it
under the `__ungrouped__` pseudo-group. The button's entire premise, choosing
*which* genre the instrument joins, had no effect on the result.

- The picker's two add paths (the instrument list and the similar-instruments
  view) now go through `addInstrumentFromPicker`, which consumes the pending
  genre context, configures the card from that tradition — tuning, room,
  recording chain, voice-part overrides and the amp variant that suits the
  instrument's class — and places it after the group's last card so it appends
  to the run rather than trailing the workspace. Adds without the context (the
  toolbar's Add button, the empty state) still produce a loose ungrouped card.
- The tradition→card derivation is now shared with `importTradition` rather
  than duplicated, so an instrument added by hand and one that shipped with the
  genre can't drift into different configurations.
- Each card in an imported tradition now gets its OWN chain object. They
  previously shared one, so editing one card's chain silently changed every
  other card in that tradition.
- Undo/redo snapshots the final position (the add is a single history entry),
  the target group expands if it was collapsed, and the toast names the
  destination: "Added harmonica to Garage rock".
### Fixed — a tradition's picks no longer depend on what its neighbours are called

The naming pass turned up a coupling: renaming `aussie_pub_rock` silently changed
`merseybeat` and `mod_60s_british`. This removes the mechanism rather than the
symptom.

- **What was happening.** `scoreVariant` consults nearest-neighbour traditions
  (neighbor-bias, `NEIGHBOR_WEIGHT_FACTOR = 0.15`) and the hill-climber staples a
  primary's crossRef siblings into the scoring stack on its own
  (`search.js traditionStapleMoves`). `build_static_api.js` seeds with **no**
  staples, so this is easy to miss by reading the seed — the stack is assembled
  during the climb. Both paths called `buildContext(otherId)`, which builds the
  other tradition's FULL context including source 1, `name + lineage`. A
  neighbour's **label** therefore became prose tokens the focal tradition scored
  against. `Aussie pub rock (70s-80s)` put `70s` and `80s` into merseybeat's
  context; the Marshall JCM800, descriptors "British 80s rock amp", collected the
  bonus. A tradition dated **1962-1968** compiled with a **1981 amplifier**, and a
  1970s hydraulic drumhead beside it.
- **Why the era guard didn't catch it.** `scoreVariant` already penalises
  anachronism, but `_getEraYear` parses only 4-digit years (`ERA_YEAR_RE = /\d{4}/`).
  "British 80s rock amp" contains no 4-digit year, so the -2.0 era-conflict
  penalty never fired. The decade form was invisible to the one guard built to
  stop exactly this. Left as-is here and recorded under Known below — widening it
  is a separate change with its own blast radius, and it should not ride along in
  a diff about names.
- **The fix.** `buildContext(tradId, { includeName: false })` builds the same
  context without the name half of source 1; lineage, family, parent path, room
  and archetype all still contribute. Both cross-tradition call sites — staple
  merge and neighbor-bias — now pass it. A tradition still scores against its
  **own** name at full weight, because that is self-description and is meant to
  matter: rename merseybeat and merseybeat moves, which is what anyone expects.
  What no longer happens is a neighbour's label moving it.
- **New gate: `npm run check:names`** (`scripts/check_name_isolation.js`,
  `@promise: name-isolation`). Compiles a sample of traditions twice; the second
  run first appends `1985 80s 90s modern digital tube tape analog vintage
  distorted` to every OTHER tradition's name. The observer's compiled config must
  be byte-identical. Configs are compared rather than recipe strings, because
  sentence 1 legitimately PRINTS the names of the tradition and its staples — the
  rendered text is supposed to move when a displayed label moves; the choice is
  not. Verified two-sided: against the unfixed scorer **10 of 12 sampled
  traditions drift**, including `historical_informed_performance` reaching for an
  AI-harmonizer vocal chain. Fault class `foreign-name-in-picks` flips the one
  word `false` → `true` and asserts the gate catches it.
- **Blast radius: 180 of 1171 pinned fixtures moved; 168 compiled recipes changed.**
  Every tradition has neighbours, so a change to how neighbours are read reaches
  much of the catalog.
- **What that bought, measured rather than asserted.** Counting picked variants
  whose descriptors name a decade outside the tradition's era window:
  **84 → 79** across the recipes that moved, 10 traditions improved against 5
  worsened. On the narrower 4-digit-year measure it is flat (88 → 87) — and that
  measure is precisely the one that cannot see this defect class, since "80s"
  contains no year. So: a modest accuracy gain, roughly two improvements per
  regression, and it would be overselling to call it more than that. The reason to
  make the change is not the five fewer anachronisms. It is that a tradition's
  output is now a function of its own record and its neighbours' *sound*, which
  means a rename is once again a rename and not a silent edit to someone else's
  recipe.

Measured and NOT changed: the rendering trust filter
(`translate.js buildTraditionContextTokens`) also harvests staple names. Holding a
config fixed and renaming its staples changes the rendered recipe **only** by
printing those staples' new names in sentence 1 — strip the injected tokens and
the string is byte-identical, so the filter admitted no additional descriptor
words. That coupling is display-only and self-evident: it shows you the label it
is showing you.

### Fixed — catalog naming and roster accuracy

A naming pass that started as cosmetic turned up a scoring defect underneath it.

- **Nine instruments printed their id where their name belongs.** The recipe
  renderer labels a card `inst.short || inst.name`, and nine `short` values had
  never been written as prose — `irish_bouzouki`, `tenor_banjo`, `slit_gong`,
  `native_american_flute`, `pat_waing`, `dan_nguyet`, `bombo_leguero`,
  `peyote_water_drum`, `border_pipes`. Every other display field in the catalog
  is clean: 0 underscores across tradition, room, tuning, preface, part and
  variant names. (Tradition `family` is a taxonomy key, not a label — the app
  renders it through `FamName()`, which already replaces underscores.)
- **Two instruments printed the same label as another instrument.** A recipe
  naming "marimba" or "smallpipes" gave the reader no way to tell which record
  had been chosen. Now `Guatemalan marimba` vs `marimba`, and `Scottish
  smallpipes` vs `Northumbrian smallpipes`. Short labels are unique catalog-wide.
- **27 superfluous parenthetical tags removed from tradition names** — bare
  decade and place tags that restated what the name already said (`Anti-folk
  (NYC)`, `Emo revival (2010s)`, `Britpop (90s)`). Precise year ranges are kept:
  `Classic R&B (1948-1962 era)`, `Early rock-and-roll (1954–1958)` and
  `Early Romantic (1800-1850)` narrow the name rather than repeat it. Kept for
  disambiguation: `(European)` on power and folk metal.
- **A tradition's decade tag was hijacking its SIBLINGS' gear.** This is the
  finding under the cosmetics, and the same class as the earlier up-tempo →
  carnival-tuning hijack. A tradition is scored against a stack that includes
  its crossRef siblings at half weight, and `buildContext` feeds the sibling's
  NAME into that stack as prose tokens. `Aussie pub rock (70s-80s)` therefore
  put `70s` and `80s` into `merseybeat`'s scoring context — and the Marshall
  JCM800 variant, described as a "British 80s rock amp", won on that token.
  A Liverpool tradition dated **1962-1968** was being recorded through a **1981
  amplifier**, with a 1970s hydraulic drumhead to match. Dropping the
  parenthetical drops the tokens: `merseybeat` and `mod_60s_british` now pick
  `amp_british_late_60s_marshall_plexi` and `single_clear`. Both traditions'
  own records are untouched — only a sibling's name changed. Note the corrected
  picks score *lower* (14.04 vs 14.56); the old winner was being subsidised.
- **`son huasteco` rostered the wrong regional instrument.** It listed
  `jarana_jarocha` — the Veracruz son-jarocho instrument — where the trío
  huasteco uses the jarana huasteca. The record's own lineage prose already said
  "jarana huasteca five-string rhythm-guitar"; only the roster was wrong. Added
  `jarana_huasteca` and repointed the pins.
- **Two panpipe traditions rostered no panpipe.** `solomon_islands_panpipe` and
  `papua_new_guinean_polyphony` both carried `['voice']` alone, because the only
  panpipes in the catalog were Andean (`siku_panpipes`) and ancient Greek
  (`syrinx_greek`). Substituting either would have misrepresented the tradition,
  so `melanesian_panpipes` was added (Are'are raft-panpipe, bundle panpipe,
  New Guinea Highlands pipes) and wired into both.
- **Barbershop carried vocal percussion.** SPEBSQSA barbershop is strictly
  unaccompanied four-part harmony; vocal percussion belongs to contemporary and
  collegiate a cappella. Removed from `barbershop_quartet` (retained on
  `doo_wop`, where the bass vamp earns it).

Not defects, checked and left alone: `string_quartet`'s three-instrument roster
is correct — a roster is a set of distinct instrument *cards*, and 0 of 1167
rosters list a duplicate id, so "two violins" is unrepresentable by design. The
vocal quartets (`barbershop_quartet`, `jubilee_quartet`,
`southern_gospel_quartet`) pair a solo-voice card with an ensemble card for the
same reason. Of the 203 traditions with a roster of one, all but the two panpipe
records are solo vocal or spoken traditions where `['voice']` is the whole
ensemble.

### Fixed — connector correctness

An adversarial deliberation on the connector's tool surface (should it be one
tool or nine?) concluded that the count was close to irrelevant and turned up
four defects instead. Fixed here; the surface stays at nine pending an eval that
can actually measure a routing change.

- **`format: "compact"` silently dropped the environment.** Its first tier
  repeats the room, tuning and every chain stage on EVERY line, so any roster
  past about four cards blew the character ceiling; the fallback then reduced to
  bare instrument labels and the environment vanished. Setting `carpeted_bedroom`
  and asking for compact returned 164 characters with no room in them, no error,
  and nothing to notice — while the connector's own instructions say to present
  that string verbatim. A middle tier now names the environment once, the way
  rich, tags and prose already did. Mirrored in `src/app.js`; parity holds at
  1167/1167 across all four formats.
- **`get_instrument` was a context trapdoor.** A few instruments inherit a
  655-entry materials table, so the honest return-the-whole-record shape made this
  the most expensive call in the connector by two orders of magnitude:
  `acoustic_guitar_dread` serialised to **208,883 bytes (~52k tokens, about fifty
  times the entire tool menu)** and **91 of 870 instruments cleared 100 KB**,
  against a median of 2,156. The server instructions route models straight at it
  ("specific gear/material/technique → get_instrument"). Wide parts are now
  sampled against a shared budget, each part reports `variant_count` and sets
  `truncated`, and `query` / `part` / `limit` narrow the request. The default
  variant always survives filtering — verified across all 870 instruments, 0
  dropped. Worst case is now **23,340 bytes**; mean 37,243 → 3,530.
- **Chain overrides were unvalidated.** `room` and `tuning` were both guarded;
  `chain` two lines below wrote anything. A bogus stage name was a silent no-op,
  and a bogus item id did not fail but DELETED: the renderer drops a stage it
  cannot resolve, so a typo'd mic id quietly removed the real mic from the recipe.
  Both now raise the same actionable error as room and tuning.
- **Search ranking was alphabetical, not ranked.** Every row scored one point per
  matched term regardless of where it hit, so single-term queries left everything
  tied and the codepoint tiebreak became the order: `country` returned all 37
  matching traditions alphabetically, putting the tradition named `country`
  **ninth**, behind `australian_didgeridoo_yidaki_extended`. Scoring is now
  field-weighted — exact id/name, then word-boundary, then descriptor prose — with
  a bonus when every term matches. `country` ranks first; `worn bitter struggling`
  puts all three prefaces above the tape and bamboo variants that used to outrank
  them.

### Changed — connector documentation

- `get_instrument` advertises `part` / `query` / `limit` and says wide parts are
  sampled, so the budget is visible rather than surprising.
- `search_catalog` no longer says "ALWAYS use this" for a request's words. It
  routes concrete nouns to itself and mood adjectives to `search_prefaces`, which
  returns the token profiles you need to choose between near-synonyms — the old
  wording sent mood words to a search that ranked a bamboo flute above `bitter`.
- `start_recipe` says "any number of traditions" rather than "one or more", and
  `traditions` now states what order MEANS — first is named first in the header
  and is last to lose material at the ceiling — instead of asserting an undefined
  "primary".
- `limit` is capped at 50 in the schema on both search tools, matching the cap the
  engine already applied silently.

### Known

- **The era-conflict guard reads years, not decades.** `_getEraYear` matches
  `/\d{4}/`, so a variant described as "British **80s** rock amp" or "**90s**
  digital" carries no era signal the guard can see and never draws the -2.0
  anachronism penalty — only a literal "1981" would. That is why the JCM800 could
  win a 1962-1968 tradition on a bonus with nothing pushing back. The name leak
  that supplied the bonus is fixed and gated; the guard's blind spot is not.
  Widening it to decade forms is a one-line regex change with a large and
  unmeasured blast radius across the catalog, so it wants its own diff and its own
  before/after — not a ride-along in a change about names.
- The tool count is unresolved on purpose. Three judges split 6/6/9, and the one
  who ruled for nine ruled on the state of the evidence rather than the merits:
  nobody has an eval that scores a final recipe against the words the user
  actually said, so no routing change can be shown to help or hurt. That eval is
  cheaper than any of the merges considered and would settle it.


### Fixed — stability audit

An audit of the repo's instability, architecture and dead code turned up eleven
findings. All eleven are addressed here; one, branch protection on `main`, is a
repository setting rather than code and is called out at the end because it is
the one that makes the rest enforceable.

**The rendered recipe depended on the machine that produced it.**
`localeCompare` with no locale argument collates by the runtime's ICU locale.
Hashing 4,668 renders (1,167 traditions × 4 formats) under five collations gave
`928c8664` on en-US and `1fc09d82` on da-DK — Danish reads "aa" as "å", which
sorts `maag` after `mid-emphasized` and reorders a shipped descriptor chunk. The
catalog carries 90 non-ASCII instrument names and 17 non-ASCII descriptors, so
the exposure was growing. A `_cmp` codepoint comparator now backs every ordering
that reaches the recipe, in `scripts/_recipe_stack.js` and a byte-identical copy
in `src/app.js`. All five collations now produce `928c8664` — identical to the
en-US baseline, so nothing moved; it only stopped depending on where it ran. Two
deliberate display sorts (instrument roster, tradition search) keep their
collation semantics with the locale pinned to `en`.

**The connector returned a different recipe than the app for three of its four
formats.** `render_recipe` advertises `rich | tags | prose | compact` and the
server card promises the result is identical to what a human sees, but
`check_app_parity.js` compared `rich` alone — so the other three drifted on
every tradition without a gate going red. The gate now compares all four
(1167/1167 byte-identical, 4,668 comparisons) and sixteen edits to
`scripts/_recipe_stack.js` close the gap; `src/app.js` is untouched, because the
app is what the promise is about.

  - `prose` had **two** independent causes. Node attached a full descriptor list
    to every chunk where the app carries only a preface, so `rasping voice` came
    out `belt-quality-high-larynx-thick-fold blues-shouter … voice` and the
    environment chunks dragged tuning/room/mic tokens in front of labels meant to
    read bare. Separately, node's Phase-1 trim chose its victim by descriptor
    tier and would strip a card to zero tokens, where the app chooses the part
    holding the most prefaces with `targetLen` starting at 1 — so each card's
    primary preface survives by construction. The second cause is **latent**:
    fixing only the first still scored 1167/1167 catalog-wide, because no seeded
    tradition exceeds the ceiling today (largest untrimmed prose body: 743 chars,
    `progressive_rock`). A ceiling sweep — 8 workspaces × 15 ceilings — scored
    33/120 with one fix and 120/120 with both. Breadth alone would have blessed a
    half-fix as complete.
  - `tags` was missing `_collapseSharedSuffixes` entirely and was not
    priority-sorting chunk descriptors before the trim cascade. Because the
    cascade drops from the end of a chunk, a different order meant a different
    **set** survived the ceiling — the two sides disagreed about which
    descriptors a card kept, not merely about their order.
  - `compact` omitted the `,` line tail on both reduction tiers.

**Descriptor order was a function of today's catalog, not of anything
committed.** `_sortDescriptorsByPriority` ranked tokens by a corpus document
frequency counted at runtime, so adding any instrument reordered descriptors on
cards nobody touched. Of 249,622 adjacent same-tier pairs, 38,831 sat at a DF
margin of exactly 1 and 81,478 were tied, with 6,806 of 9,044 distinct tokens at
DF 1; one added record moved 772 of 9,336 recipes. That is what forced a re-bless
of 1,171 fixtures on every catalog change — and a snapshot re-blessed as a matter
of routine cannot detect a regression. `scripts/build_descriptor_df.js` now
freezes the table into `references/_descriptor_df.json` and inlines the same data
into `src/app.js`. Three modes follow the `build_signatures.js` precedent:
default re-emits the app block from the JSON and can never move output,
`--freeze` re-counts from the live catalog and is the only command that can,
`--check` verifies. `--check` is two-sided on two independent modes — the app
block must equal the JSON, and the freeze must still know ≥97% of the catalog's
distinct tokens, so the lag is bounded rather than merely detected. Verified to
have moved nothing: 1171/1171 fixtures match the **committed** snapshot.

**`sitemap.xml` was a function of the wall clock.** Every build on a new UTC day
rewrote all 2,043 `<lastmod>` entries with no source change — churn that caused a
real merge conflict — while telling crawlers that 2,043 URLs had all changed
today. `lastmod` is optional; dropping it makes the file purely a function of the
URL set. `check_artifact_fresh.js` now regenerates and byte-compares
`sitemap.xml`, `llms.txt` and `robots.txt`, passing `--api` as well as `--out`
(without which the "fresh" sitemap would be derived from the committed catalog
and the gate would only ever agree with itself).

**`tests/regression_snapshot.json` was serialized in worker-completion order.**
`runFixturesParallel` merges worker messages as they arrive and `nWorkers` is
`os.cpus().length`, so a two-fixture re-bless produced a 3,590-line diff — noise
that hides real content changes and conflicts with any concurrent branch. Keys
are sorted before writing.

**`smoke.js` could validate the wrong file, or nothing.** It preferred
`../../codex.html` — a path outside the repository — over the build output, and
banked a pass when no artifact existed, and again for a blend pair naming an
unknown tradition. A rename that orphaned every pair in `BLEND_PAIRS` would have
scored perfect having exercised nothing. Both are counted skips now.

### Changed — gates and pipeline

- **`README.md` joined the docs-drift gate.** It was the only document excluded
  from `check_docs.js` and consequently the only one allowed to be wrong: it
  advertised 1,195 traditions and 651 instruments against a real 1,167 and 870.
  The obstacle was only thousands separators, so the count patterns accept them
  and strip them before comparing. `CHANGELOG.md` stays excluded on purpose —
  entries below this one are supposed to state the counts that were true when
  they were written.
- **New promise `connector-render-parity`**, binding `check_app_parity.js`.
  Because no promise bound that gate, nobody ever had to write down that its
  scope was one format out of four. Bijection is 12/12, 0 orphans.
- **`build.js` and `ci.yml` were two definitions of "the full pipeline"**, neither
  a superset. `smoke.js` — 5,879 assertions, the only catalog-wide breadth check —
  ran in `build.js` and nowhere automatic; it is now a third parallel CI job.
  `tandem.js` ran in neither and is now weekly, which is proportionate now that
  its textual app-vs-node checks are superseded by the widened
  `check_app_parity`, its HTML checks overlap `check_lazy_app`, and its zip
  round-trip guards an unpublished artifact; what remains unique is the 18
  `tests/*_audit.json` snapshots. `audit_coherence.js` stays in neither
  deliberately — it always exits 0 and is an authoring aid, and gating on it
  would only train people to ignore a green check.

### Removed

- Twelve exported symbols no other module imported, each used exactly once inside
  its own file, across five modules.
- The duplicate `process.argv` parse in `regression_recipes.js`. The first pass
  computed `a.slice(2 + eq + 1 - 2)` — which is `a.slice(eq + 1)`, the same value
  the second pass assigned under the comment "Re-parse to handle --key=value
  properly" — and set `flags.__parsed`, read nowhere.
- The unused `--fs-display` custom property (its six siblings are live).
- Hard-coded catalog counts in comments in `ci.yml`, `smoke.js` and `src/app.js`,
  de-numbered rather than re-pinned so they stop drifting.

### Known

- **`main` is unprotected.** `ci.yml` has always noted that "green before live"
  needs branch protection, which is a repository setting, not workflow config. It
  is still not set, so every gate above is advisory: a pull request can be merged
  red, and `main` accepts direct and force pushes.
- Freezing the descriptor table moved the largest `codex.html` script block from
  607 KiB to 851 KiB against a 1024 KiB ceiling. The ceiling gate will catch an
  overflow rather than ship one, but there is meaningfully less room. If it
  binds, the table can move to `api/` at the price of an async first render.


### Added
- **219 instrument records — the catalog grows 651 → 870 (+34%).** Drafted from
  two source lists (the Wikipedia drum "Types" section, and a ~350-entry list of
  horns, bowed strings, flutes, single reeds and double reeds), researched and
  authored by nine parallel workflows, then applied serially. **824 new parts,
  2,336 new variants**; the table now holds 3,227 parts across 870 instruments.

  | family | now |
  |---|---|
  | percussion | 220 |
  | wind | 198 |
  | bowed | 162 |
  | plucked_traditional | 116 |

  The largest coherent gaps closed: **Ghana/Akan** (atumpan, fontomfrom,
  aburukuwa, kpanlogo, plus the Ewe ensemble drums) — an entire regional
  tradition that had none of its drums while Senegal, Mali and Guinea were well
  covered; **Nepal/Himalaya** (madal, damphu, dhimay), previously absent
  entirely; **South India below the famous three** (tavil, parai, idakka); the
  **Chinese huqin long tail** (banhu, zhonghu, gehu, yehu, zhuihu, tuhu, huluhu,
  maguhu and others — of 80+ documented huqin types); **Arctic and First Nations
  bowed** (tautirut, the Inuit bowed box zither strung with whalebone rather
  than horsehair; qelutviaq; the Apache fiddle) — a cluster the source list
  scattered but which is organologically coherent, and which Baines links to the
  Icelandic fiðla and Shetland gue, both also added; and the **historical
  European bowed and reed families** (division viol, lyra viol, baryton,
  arpeggione, lira da braccio, lirone, tromba marina, octobass; chalumeau,
  basset clarinet, dulcian, rackett, cromorne, the capped renaissance reeds).

  **81 candidates were deliberately NOT added**, each with a recorded reason:
  55 duplicates or synonyms of records already present, 11 better expressed as a
  variant of an existing record than as a new one, 6 that no source could
  establish exist at all, 9 other. Pure size variants (contrabass flute,
  octocontra-alto clarinet, subcontrabass saxophone) were kept out on purpose —
  `Saxophone` and `Clarinet` are already modelled as single records with
  configurable size parts, and minting one record per size would fight that.

### Changed
- `bass_flute_contra_g` renamed from "Contrabass G" to the contra-alto in G. It
  is the contra-alto, not a contrabass, and the name became actively misleading
  the moment this batch's real `contrabass_flute` (in C) landed. Name only — the
  id is untouched, so no reference breaks.
- Native spelling restored on `latfiol`, `traskofiol` and `dubbeldackare`
  (Låtfiol, Träskofiol, Dubbeldäckare). The catalog already carries Tār,
  Kamāncheh, Sārangī, Cajón and Batá, so ASCII-folding was a drafting artefact
  rather than house style.
- `nepali_lok` gains `madal`, and `akan_kete_royal_praise` gains `atumpan`. Both
  were already described in their own lineage prose — `nepali_lok` reads
  "Standard instrumentation centers on madal two-headed barrel-drum" while madal
  was absent from its `instruments[]`, because no madal record existed until now.
- Two new `class` values, `bowed_box_zither` and `single_reed_cylindrical`. Both
  follow existing series exactly (`bowed_lute` / `bowed_lyre` / `bowed_tube_fiddle`;
  `single_reed_conical` / `_hornpipe` / `_droned_pipe` / `_double_clarinet`) and
  nothing already in the table fits. Note `validate.js` does not constrain
  `class`, so nothing would have caught these — they are a deliberate widening.
- Instrument counts corrected in AGENTS.md, SKILL.md, docs/connector.md,
  docs/connector-directory-submission.md, index.html and package.json (651 → 870).

### Fixed
- **`tests/regression_snapshot.json` is now written in a stable key order.**
  Re-blessing a two-fixture change produced a **3,590-line diff** — the writer's
  key order is not deterministic, so almost the entire file churned. Compared as
  sets, exactly 2 fixtures had changed content (`nepali_lok`,
  `akan_kete_royal_praise`), 0 added, 0 removed. Rewritten in the committed key
  order: the diff is now 2 insertions / 2 deletions and still passes 1171/1171.
  Left alone, that churn would have made review impossible and could hide a real
  regression behind noise.

### Known advisories (not gates, recorded honestly)
- `audit.js` warnings rise 1027 → 1307, all in three pre-existing advisory
  classes and roughly proportional to a catalog that grew 34%:
  `family_parts_coverage` +100 (204 records already carried it — no
  `percussion_technique` variant lists the new ids in `applies_to`),
  `dead_canonical` +112 (362 → 474; canonical_tags on new variants that no
  tradition references yet — the new instruments are reachable in the app, which
  lets any instrument join any tradition, but they are not yet wired into
  tradition records), and `description_instrument_mismatch` +61. That last one is
  a fuzzy substring matcher and the increase is almost entirely noise: only
  **3** genuinely new entries, all false positives (`celtic_irish_trad` mentions
  "wooden" → matches `irish_wooden_flute`; `gagaku` mentions "china" → matches
  `trompeta_china`). The hard gate, `check:dead-tokens`, is CLEAN.
- App recipe token ORDER is not fully stable across catalog growth. Six snapshot
  entries drifted for `mandolin` and `tanbur_persian` — instruments untouched by
  this change — as `ebony european-maple` → `european-maple ebony` and a rotation
  on tanbur. Verified as identical token multisets: no content changed, only a
  tie-break that shifted when the instrument table grew. Re-blessed, but the same
  catalog state should produce the same string, and it does not.

### Deferred (each edits an existing record; wrong to bundle into a 219-record insert)
- **Split the `kemence` record.** It fuses two organologically distinct
  instruments under one id — the Ottoman classical armudî kemençe (pear-shaped,
  fingernail-side stopping) and the Karadeniz box fiddle (one-block trough,
  fingertip stopping, parallel-fourth double stops). Independently confirmed by
  two separate batches, both of which correctly skipped their candidate rather
  than double-cover it.
- **Mint `nepali` / `tamang` / `newari` canonical tags and wire them to
  traditions.** The tag vocabulary has no Himalayan coverage beyond a single-use
  `himalayan`, so that regional detail currently survives only inside variant
  names. Minting them unwired would just create more dead tags.
- **Retire `ryuteki_nohkan` / `ryuteki_shinobue`** now that nohkan and shinobue
  are records. Kept for now on the catalog's own precedent — `alto_flute`,
  `bass_flute` and `piccolo` each exist both as records and as `flute_size`
  variants.
- **`sorna` as a record distinct from `zurna`.** Skipped because the live `zurna`
  record's own name claims "surnay", which would put the same word in the catalog
  twice. The `duduk`/`mey` split is precedent for the other reading.

### Fixed
- **CI was red for three commits: the mobile gate stopped failing for the right
  reason.** `scripts/faults.js` is the gate on the gates — it plants one defect
  per gate-class and asserts each gate catches *that* defect, not merely that it
  exits non-zero. Its `unfittable-header` class injects
  `.app-bar .actions { min-width: 720px }` into `codex.html` and matches the
  failure text against the measurement.

  When `check_mobile_layout.js` was rewritten it began *interacting* with the
  page — clicking a starter recipe, adding a genre, dragging — before probing.
  Under that planted defect the layout is broken enough that another element
  starts intercepting pointer events, so the click timed out, the exception hit
  the outer `.catch`, and the whole run collapsed to
  `MOBILE LAYOUT: FAIL — elementHandle.click: Timeout 30000ms exceeded`. The gate
  failed, but never printed the measurement explaining why — `WRONG-REASON`.

  Fixed on the merits rather than to satisfy the matcher: a layout too broken to
  click through is precisely what this gate exists to report, so **assertions A
  and B now run before the page is touched**, and again once a workspace loads. A
  failed starter click is reported on its own terms instead of as a bare timeout,
  and the drag check's clicks carry a short timeout so a already-failed run does
  not add four minutes of Playwright retries. Both files now carry a comment
  marking the shared phrases as a contract.
- The meta-gate's matcher said `is off-screen`, but the rewritten capability
  message reads `#btn-add off-screen (x …)` — no "is". Had the viewport-blowout
  path ever stopped firing, neither alternative would have matched and the escape
  would have been silent. Both sides now agree.

### Added
- **Drag and drop now works on touch — it never did before.** The tree's two drag
  interactions (drag an instrument row into a different genre; drag a genre header
  to reorder) were built on HTML5 drag-and-drop, and `dragstart` is a **mouse-only
  event in every mobile browser**. `draggable="true"` on a phone produces a text-
  selection callout, not a drag. So on any touch device, genre reorder was reachable
  only through the ↑/↓ buttons and **reparenting a card had no route at all** — there
  is no button equivalent for it. Nothing failed, because nothing tested it.

  Rewritten on **Pointer Events**, which are input-agnostic: one implementation now
  drives mouse, touch and pen instead of a mouse path plus a hole where the touch
  path should be. The interaction had to be designed around scrolling, since below
  900px the tree *is* the page and a finger moving up the screen usually means
  "scroll":
  - **Touch arms on a 350ms long press.** A stationary finger is unambiguous;
    moving more than 12px before the timer fires cancels the press and lets the
    scroll through untouched. A mouse still arms on 5px of movement, as before.
  - **A non-passive `touchmove` blocker** stops the page scrolling under a live
    drag. It is attached at arm time — safe precisely because the finger was
    stationary, so no scroll gesture is in flight (one already begun cannot be
    cancelled).
  - **Edge auto-scroll**: dragging within 72px of the top or bottom scrolls the
    page, so a drag can reach genres that were off screen when it started.
  - A drag preview follows the pointer while the source row stays dimmed in place
    (collapsing it would reflow every genre under the finger mid-gesture), the
    target genre takes an accent tint that stays readable *around* the preview,
    and a short `navigator.vibrate` marks the pick-up — the row being lifted is
    hidden under the user's own thumb.

  The two drop mutations are extracted as `dropCardOnTradition` and
  `dropTraditionOnTradition`, so the controller is only about input and a future
  keyboard or menu affordance can reuse the exact semantics. Drop behaviour is
  unchanged: group-target only, card lands after the target genre's last card,
  genre lands above or below the target depending on which half was released over.
- **`check_mobile_layout.js` assertion H — drag and drop under the viewport's real
  input.** A genuine touch gesture (CDP touch events, so `pointerType` is really
  `'touch'`) on the five phone viewports and a genuine mouse drag on the three
  desktop/tablet ones, asserting the card actually changed genre and that no ghost
  or highlight survived the drop. This is the assertion whose absence let a whole
  interaction be mouse-only indefinitely. **159 assertions → 175.** Verified by
  mutation: neutering the controller fails all 8 viewports, each naming its own
  input type.

### Removed
- **Repo hygiene sweep — dead code, no-op structure and stale prose.** A survey of
  every dimension (unreferenced scripts, unreferenced fixtures, dead CSS classes
  and custom properties, never-called functions, TODOs, stale doc claims) found
  the codebase already in good order; the real findings were concentrated in what
  the single-scroll rebuild had just orphaned, plus one long-standing token bug.
  - **The mobile drawer, in full.** `#btn-drawer-toggle`, `#sidebar-backdrop`,
    their CSS and the `DOMContentLoaded` block toggling `.is-open` on both. The
    tree is the page below 900px, so `.drawer-toggle` was `display: none` at
    *every* width and the `.is-open` rules that styled the backdrop had gone with
    the old block — the button could not render and the handler drove nothing.
    Also drops its `ui_capability_inventory.md` entry, which had been passing the
    reachability gate on the strength of `notes: selector resolves regardless`.
  - **The `.actions-scroll` wrapper.** Left over from the deleted horizontal
    scroll strip; `display: contents` at every width with no other reference, so
    it generated no box and grouped nothing. Its six children are now direct
    children of `.actions`.
  - **The "PART A" patch-application comment**, whose only concrete content was a
    self-referencing line number that had already drifted, and the superseded
    `.env-options-cluster-head` rule (`.label-micro-cap` has identical properties
    and is the live one).
  - Kept deliberately: the 10 unread CSS custom properties. They are the unused
    rungs of *documented, complete* scales — a semantic palette ("Yellow =
    warning / attention"), a shared motion vocabulary, a radius and shadow ramp.
    Deleting individual rungs would leave a gap-toothed vocabulary that reads
    worse than the dead weight.
  - Also kept: the 15 `tests/*_audit.json` fixtures, which look unreferenced to a
    filename grep but are read by `tandem.js` as `tests/${slotKey}_audit.json` —
    a template string, one per key in `pick_audit_classifications.json` (verified
    15/15, zero orphans either way), where a missing file is a fatal error.

### Fixed
- **`--accent` was never declared.** The editorial red used for preface italics,
  the active tab underline, the pinned marker and the drag indicators reached the
  page through ten copies of `var(--accent, #c8504a)` — a fallback for a variable
  that did not exist, so the fallback was the real value every time and the app's
  accent colour was absent from its own palette. Declared once in `:root` and all
  ten uses simplified; computed values verified unchanged (`rgb(200, 80, 74)`).
- **`data-tooltip-pos="left"` had no implementation.** Four controls request it;
  only the `bottom` variant existed, so they fell back to the centred-above
  default and were clipped by the sidebar's `overflow: hidden` on desktop. (Below
  900px this was also half of the layout-viewport blowout fixed above.) The left
  variant now exists.
- Simplified 16 further unreachable `var()` fallbacks whose variables are
  unconditionally declared in `:root` — several of which named *stale palette
  values* (`var(--color-blue, #4a7cb8)` against a real `--color-blue` of
  `#1a73e8`), so the dead text actively misdescribed the design system.
- `#workspace-sidebar`'s `overflow-x: clip` backstop moved into the same rule as
  its `overflow: visible`, so it no longer depends on the source order of two
  separate `max-width: 899px` blocks.

### Changed
- **The phone layout is now one scrolling page, not a desktop UI made to fit.**
  The previous pass made the app bar *fit* a 390px screen and stopped there. What
  it shipped was seven unlabelled icon squares in a horizontal scroll strip, the
  genre tree behind a hamburger, and the recipe stack at the bottom of that
  drawer — so the only route to "add a genre" was an unlabelled music-note glyph,
  and the thing you came to edit was never on screen with the thing you tapped.
  Below 900px the model is now: **the genre tree IS the page**, genres collapse
  inline (reusing the existing `collapsedTraditionGroups` machinery), and tapping
  an instrument mounts `#detail-view` directly beneath that row rather than
  repainting a pane you cannot see. The app bar carries the two authoring entry
  points with real words on them — **+ Genre** and **+ Instrument** — the recipe
  is a bar pinned to the bottom edge carrying **undo / redo / copy** and expanding
  to the full recipe on tap, and save / saved / credits sit behind an overflow
  sheet whose items forward their clicks to the real app-bar buttons, so there is
  still exactly one handler per action. Desktop (>= 900px) is untouched: same
  two-pane master/detail, same eight controls, every rule in a `max-width` query.
- **Touch sizing no longer depends on `pointer: coarse`.** It was gated on the
  emulation flag, so a narrow desktop *window* got the phone layout with 28px
  targets. Below 900px the layout is the phone layout, so it gets 44px targets
  unconditionally.
- **The stack-signature strip is dropped below 900px.** It reflowed to four
  stacked rows and cost ~40% of the panel's first screenful before a single
  editable control, and it is read-only context rather than an authoring surface.
  Authoring parity is unaffected; the nearest-traditions "Browse near" jump goes
  with it, and those traditions stay reachable through the Traditions browser.

### Fixed
- **The app bar scrolled off the top and never came back.** `html, body { height:
  100% }` is the desktop app-shell assumption — the page never scrolls there, the
  detail pane scrolls inside a viewport-tall frame. Once the phone layout made the
  *page* the scroller, that fixed-height body clamped the sticky bar to a
  viewport-tall containing block: past ~844px of scrolling the bar left the screen
  for good, taking both Add actions with it.
- **Hover tooltips were re-opening the layout viewport on phones.**
  `[data-tooltip]::after` is an always-rendered, `white-space: nowrap`,
  absolutely-positioned bubble held at opacity 0 until `:hover` — invisible on a
  touch device, but still laid out. `data-tooltip-pos="left"` (which the tradition
  mover and delete buttons ask for) has *no CSS implementation*, so those bubbles
  rendered centred-above and spilled past the right edge. The desktop sidebar is
  `overflow: hidden` and clipped them; the scrolling page did not, so a 133px
  bubble on a right-aligned 44px button pushed the document to 468px and Chrome
  scaled the whole app to 83% — the same failure class as the original collapse,
  from a new cause. Tooltips are now suppressed below 900px (every affected
  control already carries `aria-label`, so no accessible name is lost), with
  `overflow-x: clip` on the tree as a structural backstop.
- **`undo` / `redo` icon aliases existed only in the generated manifest.** They
  were added to `references/08_asset_manifest.js` directly, not to its generator,
  so the next `npm run assets:icons` would have silently returned both buttons to
  empty squares. Added to `scripts/build_assets.js`, and the CSS mask workaround
  that had been papering over the blank glyphs is deleted.
- `scripts/ui_reachability_check.js` now falls back to a preinstalled
  `chromium-<build>` when the pinned playwright's `chromium_headless_shell` is
  absent, matching `check_mobile_layout.js`. It was dying at launch.

### Added
- **`check_mobile_layout.js` now asserts the layout MODEL, not just that it fits.**
  v1 passed on the unusable icon-strip build, because it checked 2 of 8 controls
  and contained `if (c.hidden) continue;  // deliberately hidden at this width is
  fine` — which scored "solve the overflow by hiding the button" as a pass. It is
  now written against **capabilities** rather than button ids: nine capabilities
  (add instrument, add genre, undo, redo, copy recipe, recipe size, save, saved,
  credits), each satisfied only by a control that is on screen, hit-testable at
  its centre point, and >= 44px on phone widths. Moving a control into the
  overflow sheet is allowed — the gate opens the sheet and re-checks — but hiding
  it with no route at all now fails. Added alongside: pairwise overlap detection
  between painted controls, an empty-glyph check (`icon()` returns `''` for an
  unknown name, which is how `undo`/`redo` shipped blank), a sticky-app-bar check
  after scrolling to the bottom, and model assertions — the tree must be on screen
  with no interaction and the detail must mount *inside the tree* below 900px and
  *in the right-hand pane* above it. **21 assertions across 7 viewports → 159
  across 8.** Verified by mutation: hiding `#btn-traditions`, restoring `html,
  body { height: 100% }`, and restoring the tooltips each make it fail with the
  specific diagnosis.
- **Two traditions the catalog documented as missing, and every archetype now has
  an owner.** `arch_french_touch_filter_house` and `arch_ilaiyaraaja_kollywood`
  were authored but used by zero traditions. Git history confirmed neither was
  ever assigned to anything, so unlike the clobbered archetypes above this was a
  content gap, not data loss — and the catalog names the gap itself: the tree node
  `electronicDance.continental` mentions "French touch" with nothing hanging under
  it, and `hindi_filmi`'s own notes scope out the "Tamil, Telugu, Bengali,
  Malayalam parallel canons". Added `french_touch` (Motorbass, Bangalter/Daft
  Punk, Braxe, de Crécy, Cassius, Stardust, Modjo — sampled disco loops through
  resonant filter sweeps, cut to vinyl) and `tamil_filmi` (Ilaiyaraaja from
  Annakili 1976 across ~1000 scores, SPB and S. Janaki, the Prasad/AVM Madras
  scoring stages, through to Rahman's Roja 1992). Catalog: **1165 → 1167
  traditions; archetypes in active use 82 → 84 of 84, zero orphans.**

### Fixed
- **Duplicate `chain_archetype` keys were silently discarding purpose-built chains.**
  A tradition is a JS object literal, so writing a key twice keeps the *last* value
  and drops the first — invisible to every ref check, because both ids are valid.
  Nine records carried two `chain_archetype` keys, and in seven of them a
  purpose-built archetype had been clobbered by a later generic append. That is why
  four archetypes sat authored-but-unused: `northern_soul_motown` was losing
  **Motown Snakepit**, `philly_soul_intl` **Sigma Sound**, `disco` the **NYC disco
  12-inch** chain, `ecm_jazz_aesthetic` **ECM/Kongshaug**, `nashville_sound` the
  **Nashville A-Team**, `dub_techno` the **Berlin dub-techno** chain, and `mariachi`
  was rendering a *Havana* chain instead of Mexican Churubusco. Each record now
  carries exactly one key, restoring the authored chain.
- **The same bug was also discarding `production_aesthetic` — and had killed the
  array form outright.** A follow-up audit (AST sweep, cross-checked against an
  independent dependency-free scanner, exact agreement) found two more duplicate
  keys that the first, whitelist-based rule had missed: `hyperpop` and
  `hyperpop_rap` each silently dropped `maximalist_streaming_pop` to a later
  scalar. `hyperpop` had been authored as an **array** of two aesthetics — and
  arrays are supported end to end (`validate` iterates them; `search` unions them
  into the allowed set and takes `[0]` as primary) — yet **no tradition in the
  catalog was using one**, because the only one ever written had been clobbered.
  Both records now carry the union; recipes are unchanged (regression 1171/1171).
- **`validate`'s duplicate-key rule now scans every key in every `references/*.js`.**
  The first version whitelisted known single-valued tradition fields, which is
  precisely why it missed `production_aesthetic` — so the whitelist is gone. The
  scanner tracks strings and comments (prose containing a colon can't be mistaken
  for a key) and brace depth (nested objects get their own key scope, so a `parts`
  pin sharing a name with a top-level field — `tuning` is both — is not a false
  positive). It is hand-rolled rather than AST-based on purpose: `validate` must run
  from the extracted zip artifact, which ships without `node_modules`. Verified
  two-sided against an injected duplicate in all six populated reference files.
- **Ten instruments no longer show "Playing technique" twice.** Each carried a
  generic family-level technique part *and* an instrument-specific one — both
  rendering under the same "Playing technique" label — so a card listed two
  technique dropdowns and a recipe stamped two technique tokens. The generic
  family part was frequently *wrong* for the instrument (an upright bass offered
  guitar "flatpicked" / "chord-melody"; a banjo offered generic "strummed"). Each
  instrument now excludes the generic family technique part (`exclude_family_parts`,
  the same mechanism the drum kit uses) and keeps its idiomatic own part:
  `upright_bass`→`upright_play` (pizz/arco/slap), `electric_bass`→`bass_technique`,
  `archtop_jazz`→`archtop_technique`, `acoustic_guitar_om`→`acoustic_om_technique`,
  `banjo_5_string`→`banjo_play` (clawhammer/three-finger), `akonting`→`akonting_play`,
  `cuatro_venezolano`→`cuatro_venezolano_technique`, `gayageum`→`gayageum_technique`,
  `djembe`→`djembe_play`, `harmonica`→`harmonica_technique`. The instrument-specific
  part was already pinned in nearly every relevant tradition, so recipes just lose
  the spurious duplicate token (e.g. hard bop's "gut chord melody upright bass" →
  "growly gut upright bass"). 116 now-orphaned family-technique pins were removed
  from the traditions that only used them via one of these instruments; 67 fixtures
  re-blessed, 2 preface fixtures re-blessed, preface 79/79 otherwise unchanged.

### Changed
- **Broke up the catch-all recording chain (221 → 160 traditions).**
  `arch_modern_pro_daw_studio` ("2000–present") had become the fallback for anything
  modern-ish, and **104 of its 221 traditions are documented as pre-2000** — a plain
  era error. It also made the chain the least informative part of a recipe: across
  the catalog only **97 distinct chain tails** served 1,147 recipes, with **95% of
  recipes sharing a tail with at least one other**, and a single 202-recipe tail
  reading `tube condenser, 500-series boutique pre, brick-wall limiter, dynamic EQ`.
  59 traditions were reassigned to era-correct archetypes that already existed —
  90s club/rave scenes to the pre-DAW electronic-pioneer chain, 80s/90s metal and
  major-studio pop to the late-analog SSL chain, sample-era hip-hop and post-punk to
  the American indie-commercial chain, holy minimalism / free improvisation /
  European chamber-jazz to **ECM/Kongshaug**, historically-informed performance to
  the church-location chain, and the spoken-word forms out of a music-mastering
  chain entirely (radio-broadcast storytelling to the network-radio chain, audiobook
  / podcast / voiceover to the home-booth digital chain). Archetypes in active use
  rose from 78 to 82 of 84; no archetype was added or removed.

### Removed
- **Deduplicated 30 redundant tradition records (1195 → 1165).** A catalog-wide
  name-similarity scan (distinctive-token overlap, transliteration-folded) surfaced
  clusters of entries that were the *same* tradition under a rephrasing,
  transliteration, or minor scene/era/context sub-tag; a per-cluster classification
  pass (leaning "merge" for borderline, per catalog policy) confirmed 30 merge
  groups while keeping genuinely-distinct neighbors separate (early vs late
  Romantic, distinct Orthodox churches, distinct drill scenes, Thai field vs city
  song). Each removed record was folded into its canonical keeper — the keeper
  absorbs any instruments the duplicate carried that it lacked — so no roster
  coverage is lost. Examples: `mongolian_xoomii`→`mongolian_khoomei`,
  `jingju`→`beijing_opera`, `mariachi_traditional`→`mariachi`,
  `dixieland_traditional_jazz`→`new_orleans`, `shape_note`→`sacred_harp_singing`,
  `coptic_liturgical`→`coptic_orthodox_chant`. Regression fixtures and audit
  fixtures repointed to keepers; the 30 stale `api/traditions/*.json` files removed.

### Changed
- **Drum-kit recipes are now technique-first, not boilerplate-cluttered.** A kit
  carried 11+ parts, most of them fine-grained boilerplate stamped identically on
  all 257 drum traditions (shell ply, bearing edges, snare wires, cymbal lathing/
  finish/hammering — each only 2–3 distinct values catalog-wide, one dominating
  64–81%), which crowded the playing approach out of the recipe. Now:
  - **8 parts default to "not set"** (all variants `auto: false`, pins removed from
    the 257 traditions) so they contribute nothing unless a user selects them —
    shell_wood, shell_thickness, bearing_edges, snare_wires, cymbal_alloy,
    cymbal_hammering, cymbal_lathing, cymbal_finish. All stay fully selectable.
  - **`percussion_technique` dropped from the kit.** It's a generic percussion-
    family part and a strict subset of the kit's own `drum_technique` (Playing
    approach) — every drum tradition redundantly pinned both. A new
    `exclude_family_parts` mechanism on the instrument (single source in
    `_merge.js`, inlined into the HTML build) lets an instrument opt out of an
    inherited family part; `percussion_technique` stays intact on the other 13
    percussion instruments (congas, timpani, marimba…).
  - **`drum_technique` promoted to the top** of the kit's parts (Playing approach
    is the single most defining choice for a kit in a recording).
  - Net: a kit recipe now foregrounds **playing approach + batter head + kick
    pedal** (e.g. "pre-muffled edge-muffled sticks-backbeat drum kit") instead of
    "oak … machine-hammered symmetric-pattern drum kit". 278 fixtures re-blessed;
    preface 79/79 unchanged; congas/percussion unaffected.
  - The 8 detail parts also had `default: true` removed from their variants, so the
    interactive app (`defaultParts`, which keys off `default: true`, not the
    search-only `auto: false`) renders them as "—/not set" too — the two paths now
    agree. validate's missing-default rule exempts all-`auto:false` (explicit-only)
    parts, since search skips them and a canonical default is moot.

### Fixed
- **Mood prefaces no longer hijack tuning to Brazilian carnival.** Applying an
  energy preface (`up-tempo`, `exuberant`, `energetic`, `frantic`, `frenetic`)
  to any card in any genre flipped its tuning to `frevo_2_4_fast` ("carnival-
  march feel") — e.g. a doom-metal drum reshaped from `doom_sabbath_tritone_
  diminished` to frevo. Cause: those 5 prefaces carried the generic token
  `fast-tempo-110-160`, and frevo was the *only* tuning in the catalog carrying
  it (a tempo descriptor mis-used as a matchable token on a culturally-specific
  rhythm), so it was a unique magnet. Removed that token from the 5 prefaces
  (it matched zero instrument variants, so nothing else changed); frevo stays
  reachable via its frevo/carnival/pernambuco descriptors. Preface regression
  79/79 unchanged.
- **Double-pedal now reads as a double bass.** `bass_drum_double_pedal`
  rendered only its abstract descriptors `rapid`/`gallop`, which don't read as a
  pedal choice. Descriptors are now `double-bass` / `rapid-double-strokes`, so
  selecting it surfaces "double-bass" in the recipe.

### Added
- **Kick pedal part on the drum kit.** The `drum_kit` instrument had four cymbal
  parts (alloy, hammering, lathing, finish) but no foot/kick-pedal part at all —
  the pedal existed only on the separate `bass_drum` instrument. Added a
  `drum_kit_kick_pedal` part: single felt (default), single wood/plastic, and
  double pedal. The two non-default options are `auto: false` (explicit-only, so
  the reshape optimizer never spuriously auto-selects a double-bass pedal for a
  bossa-nova or modal-jazz kit) and the felt default carries no descriptors, so
  the addition is fully additive — recipe regression 1198/1198 unchanged, no
  re-bless.

- **Stereo/spatial imaging — auto-derived from intent (additive core).** Recipes
  rarely conveyed any sense of stereo/panorama. A fan-out audit (5 dimensions)
  found the cause and, critically, corrected a wrong premise: the reshape
  optimizer's axes are only `mic / pre / medium / console` (+ room / parts /
  tuning) — **fx / comp / eq / amp are NOT derivation axes** — so prefaces can
  auto-derive a stereo *capture mic* but never an fx. Shipped the additive,
  zero-churn core:
  - **Spatial prefaces now auto-derive a capture technique**: `panoramic` → A-B
    spaced pair, `stereophonic` → X-Y, `widescreen` → Blumlein, `spacious` →
    ORTF, `oceanic` → ambisonic, `cinematic`/`vast` → Decca tree (one verified
    real-descriptor token added per preface). This is the "recipes now read
    stereo" win, on the mic axis the earlier round stocked.
  - **10 imaging FX items** (fx 42 → 52): stereo widener (M/S), ping-pong delay,
    Haas doubler, auto-panner, mid-side processor, dimension chorus, rotary-speaker
    sim, mono-maker (bass-mono), pseudo-stereo, true-stereo reverb. Manually/
    connector-selectable (fx isn't a derivation axis).
  - **4 console/medium items**: wide stereo bus + mono summing bus (console 27 →
    29); mono master + stereo-spectacular master (medium 23 → 25).
  - **Dead-token audit** extended to pool chain-section item descriptors (mic/pre/
    medium/console are optimizer axes, so their item descriptors are live preface
    targets) — required for the capture-mic tokens to register as reachable.
  - **Room spatial descriptors** — 7 sacred/hall rooms now read wide (byzantine
    monastery, lalibela, Armenian/Coptic churches, tibetan gompa, wooden pagoda:
    `hall-like` / `expansive-reverb` / `cathedral-air` / `cavernous`) and
    `closet_booth` reads narrow (`dry` / `boxy` / `close` / `intimate` / `narrow`),
    so spatial prefaces retain/select the right room for those traditions.
  - **Archival → mono** — `reminiscing` / `sabi-patinated` / `tarnished` now derive
    the mono summing bus (verified). So a preface applied to a pre-war/shellac card
    reads mono, the correct image for the era.
  All additive/clean: recipe regression 1198/1198 and preface auto-suggestion 79/79
  both unchanged even with the room + archival edits; dead-tokens CLEAN. (The one
  remaining churny piece — ~34 capture-technique *defaults*, e.g. orchestral →
  Decca tree — is staged for the mic-default assignment task, since it re-blesses
  recipes and overlaps that work.)

### Added
- **Microphone taxonomy + exhaustive gap-fill (mic stage 40 → 53).** Organized
  every mic under a `family` field — Acoustic, Carbon, Dynamic, Ribbon,
  Condenser, Electret, Piezoelectric, MEMS, Optical, Capture technique — and the
  chain-stage picker now renders those as grouped headers (with the inline filter
  header-aware: typing "ribbon" collapses to just the Ribbon group). Auditing the
  families by transducer principle, form-factor, and capture technique surfaced 13
  gaps, now added: **large-diaphragm / variable-D dynamic** (RE20-class broadcast/
  kick); **shotgun** (interference-tube), **measurement/reference omni**, and
  **headset** condensers; **hydrophone** and **throat/laryngophone** piezos;
  **optical/laser** (a transducer principle the catalog was entirely missing); and
  six capture techniques — **X-Y**, **A-B spaced**, **NOS**, **binaural
  dummy-head**, **ambisonic soundfield**, and **parabolic** (the stereo palette
  had the esoteric Blumlein/Decca but was missing the two most common, X-Y and
  A-B). Added as selectable options only — no archetype defaults changed, so
  recipe snapshots are unchanged. Sets up character-appropriate mic-default
  assignment off a complete, organized palette.

### Changed
- **Wired the 50 new voice-production options into the preface intent path.** A
  usage audit found that the options added in the voice round were reachable only
  by manual `set_variant` — no preface's derivation ever selected one, because no
  preface carried a token matching their descriptors (applying `operatic` vs
  `snarling` vs `crooning` derived *identical* effort/estill/tract/vibrato). Added
  142 bridging tokens across 106 prefaces so mood/technique words now auto-derive
  the right option: `operatic` → messa-di-voce + singer's-formant ring;
  `snarling` → constricted-false-fold grit + cuivré edge; `crooning`/`smoky` →
  subtone; `liturgical` → just-intonation + countertenor + oktavist; `bellowing`
  → thick-fold + jaw-dropped; `ecstatic` → gospel-push + accelerating vibrato +
  ululation; `saudade` → sighed release; `baroque` → terraced dynamics + meantone;
  and so on across all seven enriched parts. The derivation scores a variant's
  descriptors against the target preface's tokens, so this is purely additive:
  **default recipes are unchanged** (recipe regression 1198/1198; 0 of 1195
  traditions changed auto-preface) — the tokens only steer the on-demand
  `set_preface` reshape. Preface auto-suggestion is untouched (79/79) after
  keeping voice tokens off the two non-vocal-primary prefaces (`raging`,
  `marching`) whose match scores they diluted.

### Fixed
- **Dead-token audit now counts derivation-reachable variants.** `audit_dead_tokens`
  only pooled descriptors from a card's *default/override* variants, so a preface
  token matching a non-default option read as "dead" even though the reshape
  optimizer (and manual `set_variant`) can select that option — making its
  descriptor a live, working token. Broadened the audit to also pool every
  selectable (non-`expanded`) variant's descriptors + match_tokens, matching its
  own stated intent ("tokens that exist anywhere in the authoring catalog
  associated with this card"). Still catches genuine typos/orphans (a token no
  variant anywhere carries). Audit is CLEAN with the new bridging tokens.

### Added
- **50 new options across the 7 thin voice-production parts.** The earlier voice
  round fattened the *contextual* parts (tradition 39, processing-chain 32,
  quality 27) but left the parts that describe how the voice physically makes
  sound woefully under-filled. Enriched each toward parity, all authored with
  real physiological/acoustic detail and added as `auto: false` manual palette
  options (selectable in the app picker and via the connector, but not
  auto-derived — so **zero recipe churn**): **voice_effort** / phonatory effort
  6 → 14 (subtone, messa di voce, decrescendo al niente, terraced dynamics,
  sforzando, gospel breath-pulse, edge-of-clean cuivré, marcato); **voice_microtone**
  / pitch flexibility 7 → 15 (just intonation, Pythagorean leading tones,
  meantone, Byzantine genera, pelog/slendro, gapped-pentatonic glide, untempered
  drift, siren glissando); **voice_estill_quality** 8 → 16 (the figure-level
  controls underlying the six qualities — glottal/aspirate/smooth onsets, thick/
  thin/stiff true-fold body-cover, retracted vs constricted false folds);
  **voice_vocal_tract** 9 → 17 (singer's-formant ring, jaw-dropped open call,
  raised velum, narrowed epilarynx, lengthened/lowered larynx, cupped-hand
  muffle, forward mask vs back-swallowed placement); **voice_vibrato** 9 → 16
  (bleat/caprino, narrow shimmer, pure-pitch vs amplitude-only, accelerating,
  decelerating-widening, asymmetric under-pitch scoop); **voice_register** 10 →
  15 (reinforced falsetto, countertenor, leggiero head, heavy-M1 belt, oktavist
  sub-bass); **voice_articulation** 10 → 16 (marcato, portato, glottal-stop
  punctuation, vocable syllable-drumming, ululation, sighed falling releases).
  Each renders its descriptors when picked (verified 7/7 in an isolated card,
  all ≤1000 chars); preface regression 79/79 and recipe regression 1198/1198
  both unchanged.
- **8 microphone transducer principles** the catalog was entirely missing (mic
  chain stage 32 → 40 items). The existing mic list had deep named-model coverage
  but spanned only four transduction principles — acoustic horn, ribbon, condenser,
  dynamic — with **zero** carbon, crystal, piezoelectric, ceramic, electret, MEMS,
  or contact transducers anywhere in the catalog. Added, as selectable override
  options: **carbon-button** single (`carbon_button_single`) and double/broadcast
  (`carbon_button_double`) — the 1920s electrical-transition telephone/early-radio
  lo-fi era between the horn and the ribbon generation; the **piezoelectric family**
  — Rochelle-salt **crystal** (`crystal_rochelle`), the **crystal bullet**
  (`crystal_bullet_harp`, the Astatic-JT-30 blues-harp tone the existing
  dynamic-modeled `bullet_mic` was missing), **ceramic** (`ceramic_piezo`), and the
  **contact/piezo pickup** (`contact_piezo_pickup`) for direct instrument-body
  amplification; and the **modern low-cost transducers** — **electret** condenser
  (`electret_condenser`, cassette/camcorder/consumer capture) and silicon **MEMS**
  (`mems_phone`, the phone/laptop voice-memo lo-fi sound). Each carries authored
  descriptors (e.g. `carbon-hiss`, `midrange-honk`, `breaks-up-when-cupped`,
  `agc-pumping`, `direct-body-transduction`) and canonical tags, is discoverable by
  its natural query word (carbon/crystal/piezo/ceramic/electret/mems/contact), and
  renders inside the 1000-char ceiling. Added as override options only — no archetype
  defaults changed, so recipe snapshots are unchanged (1198/1198 fixtures match).
- **`tagelharpa` instrument** (490 → 491): the horsehair-strung Nordic/Baltic
  bowed lyre was entirely missing — a catalog search returned zero hits, so the
  nearest name-match a browse could surface was a generic plucked harp
  (`celtic_harp` / `concert_harp`) standing in for a bowed instrument. Added to
  the `bowed` family (modeled on `gusle`'s regional-form pattern) as one
  instrument covering the **jouhikko** (Finnish/Karelian), **talharpa**
  (Estonian-Swedish four-string), and **moraharpa** forms, with horsehair
  ("tagel") strings as the canonical default, a drone-under-melody / ritual-
  ostinato / lament playing-context part, and membership in the shared
  `bowed_rough_drone` bow-technique pool. Used by no pre-existing tradition, so
  zero recipe churn from the add itself.
- **85 missing genre-iconic instruments** (491 → 576), found by a systematic
  region-by-region audit of all 1195 traditions against the catalog. Every
  addition is either an instrument that was entirely absent or one that a
  *generic* instrument had been standing in for. By family: **28 percussion,
  24 wind, 22 plucked-traditional, 7 bowed, 4 acoustic-strings**. Highlights:
  the **Sámi frame drum** (goavddis), **gadulka**, **dombyra**, **suona**,
  **dhol**, **davul**, **angklung**, **valiha**, **saung-gauk**, **ukulele**,
  **crwth**, **Northumbrian smallpipes**, **säckpipa**, **native American
  flute**, **bandura**, **khomus**, **taepyeongso**, and regional marimbas.
  Each carries hand-authored regional-form / playing-context / material parts
  and family-calibrated axes, following the `gusle` / `igil` template.
- **18 generic-stand-in fixes**: where a tradition's roster used a generic
  instrument in place of the specific one that defines its sound, the specific
  instrument now replaces it — e.g. the **Welsh triple harp** replaces
  `celtic_harp` in Welsh cerdd-dant/hymn-balladry, the **Azerbaijani tar**
  replaces `tar_persian` in mugham, **folk marimbas** replace
  `marimba_orchestral` in Maya/Pacific-coast traditions, **panduri** replaces
  `lute_renaissance` in the Georgian supra, **gaohu** replaces `erhu` in
  Cantonese opera, and **clapsticks** replace `claves` in Aboriginal
  songlines. Orphaned per-instrument `parts` overrides pinned to the replaced
  stand-ins were removed. Wired into 93 traditions; regression re-blessed
  (104 fixtures: the wired traditions plus blends that stack them).
- **75 more instruments, second-pass audit** (576 → 651): a second region- and
  family-lensed audit surfaced gaps the first pass missed, especially in
  families it never touched. By family: **18 plucked-traditional, 14 percussion,
  13 wind, 9 ensemble, 6 free-reed, 5 bowed, 5 keyboard, 2 electronic,
  2 electric-strings, 1 acoustic-strings**. Highlights: the **sanshin**
  (Okinawan — `shamisen` was standing in for it in the tradition literally named
  after it), the **steel band** ensemble (the Panorama tradition had a lone
  `steelpan` + orchestral cello), the **cencerro** salsa cowbell (absent from
  six salsa traditions), **phin**, **chenda**, **sape**, **fujara**,
  **simsimiyya**, **bayan**, **shruti box**, plus an early-music suite
  (**sackbut, crumhorn, vielle, rebec, viola d'amore, baroque guitar, vihuela de
  mano, portative organ, medieval psaltery**) and keyboard/electronic curios
  (**omnichord, stylophone, optigan, cristal Baschet, waterphone**).
- **10 more generic-stand-in fixes**: sanshin replaces `shamisen` in Okinawan
  eisa; the hsaing waing ensemble replaces the Balinese `gamelan_balinese_full`
  that round 1 left in the Burmese traditions; `choir_isicathamiya` /
  `choir_georgian_polyphonic` / `murga_uruguaya` replace the generic
  `choir_ensemble`; `bayan` replaces `accordion` in Russian traditions;
  `trikitixa` replaces `accordion` in Basque; `tambora_colombiana` replaces
  `surdo` in cumbia; and `vielle` / `portative_organ` replace `fiddle` /
  `pipe_organ` in early-music rosters. Wired into 78 traditions; orphaned parts
  overrides cleaned; regression re-blessed.
- **62 signal-chain archetypes + 608 tradition re-homings** (22 → 84 chain
  archetypes). An archetype is the render-visible production chain
  (mic+pre+console+comp+eq+medium+fx) describing how a tradition was canonically
  recorded. Only 22 existed for 1195 traditions: 662 sat on the generic
  `arch_modern_pro_daw_studio` and many others on cross-region proxies (bossa
  nova and French chanson both rendered through the *Havana* chain, spiritual
  jazz through *UK rock*, Nashville country through *80s SSL*). An era×region
  recording-culture audit added 62 documented archetypes — Van Gelder,
  Motown Snakepit (with James Jamerson's DI bass), Nashville A-Team, Sigma
  Sound, NYC disco 12-inch, Fania salsa, Odeon/Elenco bossa-MPB, Buenos Aires
  tango golden age, Churubusco ranchera, the "Decca Sound", ECM/Kongshaug,
  Cairo state-radio golden age, Bombay filmi playback, HMV Dum Dum classical,
  Gallo township-jive, Kinshasa rumba, Melodiya, K-pop idol complex, UK jungle
  dubplate, Berlin dub-techno — plus the field-recording archetypes the catalog
  entirely lacked (Nagra analog, 24-bit portable, wax cylinder) that now re-home
  ~380 ethnographically-recorded traditions off studio chains. Each archetype's
  components resolve against the existing chain-item inventory; all 608
  re-homings validated; regression re-blessed.
- **Voice option lists enriched across all 16 voice parts** (224 → 262
  variants; 38 re-described, 38 added, 18 proposals rejected by an
  orthogonality review). The 16-part decomposition is unchanged — this fixes
  the OPTIONS under it. All five decade-named `voice_multitrack_stack`
  options now describe the technique instead of the year (e.g. "Mid-1960s
  double-tracking era stack" → "ADT / tape-offset unison double (phasey
  detimed halo)"; eras moved to `canonical_tags`); ids unchanged, so the 1051
  traditions pinning voice variants are unaffected. Thin parts filled:
  `voice_effort` gains sustained-fortissimo and overdriven-scream pressure
  levels; `voice_processing_chain` gains slapback tape echo, dub spring-send,
  phrase-end delay throw, screwed pitch-down, megaphone/bullhorn,
  reverse-reverb pre-swell, and sidechain ducking; `voice_multitrack_stack`
  gains the hip-hop ad-lib/response lane, whisper-double, and the 10cc-style
  massed tape-loop choir wall; plus vocal-tract postures, strohbass register,
  toasting/deejay chat, gospel-runs and fado-voltinha ornament systems,
  Georgian non-tempered and Byzantine 72-moria pitch systems, and five new
  vocal-tradition schools. All additions are `auto: false` (explicit-only,
  picker/connector-facing) so default recipes stay stable.
- **The 1000-char recipe ceiling is now a HARD invariant on every render
  path.** The ceiling was threaded as a soft `|| 1000` default that any caller
  could raise: the MCP `max_chars` param advertised `maximum: 9007199254740991`
  and accepted 4000+; `recipe.js --max-chars` had no upper bound; and
  `translate()`, `renderWorkspace()`, `compileStack()`, and the browser
  `compileRecipeStack()` all honored whatever ceiling they were passed. Every
  one now clamps `Math.min(requested, 1000)` — a requested ceiling can only
  *lower* the cap, never raise it past the canonical Current-Recipe length. The
  MCP tool schema now advertises `maximum: 1000` (and rejects larger values at
  the boundary); `recipe.js --max-chars` clamps with a notice. Guard tests
  assert `MAX_SAFE_INTEGER` requests still yield ≤ 1000 across the connector,
  translate, and engine paths. No output changed (no recipe ever exceeded 1000
  under the build gate); this closes the override.

### Fixed
- **36 instruments had prose stuffed into their `short` field.** `short` is the
  instrument's concise label — and, critically, the string `_recipe_stack` kebab-
  cases into the recipe's instrument label. A minority of records had a full
  descriptive sentence there instead (lineage, technique, even artist names —
  "Tiny Moore, Johnny Gimble"), 104–329 chars long, so adding one to a workspace
  produced a garbage 180-char kebab label like
  `amplified-solid-body-mandolin-—-bright-cutting-pick-and-tremolo-lead-voice-of-western-swing-…`.
  All 36 normalized to the majority convention — `short` = the name with its
  parenthetical stripped, lowercased (`"Electric mandolin"` → `electric mandolin`,
  `"Tonkori (Ainu five-string plucked zither)"` → `tonkori`). The descriptive
  character of each instrument already lives in its parts, where it belongs.
  Longest `short` is now 38 chars (was 329); recipe regression 1198/1198 unchanged
  (none of the 36 were in a default recipe — the broken labels were purely latent).
- **Saving workspaces now works on the live site.** The Save / Load / Fork /
  Delete flow was written against an async `window.storage` host API
  (`get`/`set`/`delete`/`list`), but nothing ever provided that object outside
  the test harness — its own mock comment gave it away (*"Claude.ai provides
  window.storage as a host API at runtime; headless Chromium doesn't"*). The app
  ships as a standalone static site where no host injects it, so every Save hit
  the `!window.storage` guard and toasted "Save failed." It was never cut off —
  the logic was all real; the backing store was expected from outside and never
  arrived. `src/app.js` now installs a **guarded browser-backed store**:
  **IndexedDB** primary (async-native, large quota — a natural fit for the
  existing `{key,value,shared}` contract), **localStorage** fallback, in-memory
  Map last resort, with self-heal if IndexedDB opens but a first op fails
  (private-mode engines). It installs **only when no store exists**, so a
  host-provided `window.storage` (Claude.ai artifact) still wins, and it tags
  itself `_local_shim` so the reachability gate swaps in its deterministic mock
  for isolation (a real host store is never clobbered). Proven in real Chromium:
  raw round-trip and app-level `saveWS`/`listSaved`/`loadWS` both **survive a
  page reload**. No catalog or recipe output changed; `codex.html` rebuilt.

## [2.0.0] — 2026-06-27 — production hardening

### Added
- **Gate-lattice hardening: vacuous-pass guards + two-sided coverage of the full
  CI-blocking tail.** Four gates that could report green while checking nothing now
  refuse a vacuous pass — `check_app_parity.js` (an empty-catalog `mismatch===0 &&
  errored===0` result), `check_doc_commands.js` (the "PASS — all 0" path when the doc
  scan finds no commands), `regression_prefaces.js`, and `check_slot_picks.js` (a
  deleted fixture crashed via uncaught `readFileSync`; an emptied one passed "0/0").
  Exit-code convention unified: a missing input file exits 2 (matching the
  missing-snapshot discipline in `regression_recipes.js` / `app_recipe_regression.js`),
  data present-but-empty exits 1 (matching `check_prefaces.js`). `faults.js` now plants
  a defect across **19 gate-classes** (0 escapes, registry-completeness asserted) — new
  injections prove `check_app_parity`, `regression_prefaces`, `check_slot_picks`,
  `audit_dead_tokens`, and `check_workspace_ops` go red on planted drift, closing the
  "two-sided by inspection only" tail.
- **Connector rewrite: deterministic editable workspace (PR #49).** The MCP
  connector (`mcp/`) is now a headless driver of the same deterministic pipeline
  the browser app uses, not a hill-climb search. New tool surface: `start_recipe`
  (seed a tradition → the app's "Current Recipe"), `edit_recipe` (re-pick a
  preface — which deterministically re-derives that instrument's variants/tuning/
  room/chain via inverse-configure — swap variants, override room/chain/tuning,
  add/remove instruments and traditions), `render_recipe`, plus discovery
  (`search_catalog`, `search_prefaces`, `get_instrument`, `get_tradition`,
  `list_traditions`, `list_options`). State is passed in and out — no auto-staple.
  Retired the search-based tools (`generate_recipe`, `blend_traditions`,
  `recipe_from_axis`, `apply_preface`, `find_similar_traditions`,
  `list_instruments`) and the now-unused `mcp/corpus.js`. Connector output is
  **1119/1119 byte-identical** to the app's Current Recipe, gated in CI via
  `npm run test:connector` (incl. a headless app-vs-connector catalog-wide diff,
  `scripts/check_app_parity.js`). Shared SSOT renderer/seed/inverse-configure live
  in `scripts/_recipe_stack.js` / `_seed_workspace.js` / `_inverse_configure.js` /
  `_workspace_ops.js`.
- **Genre expansion (focused everynoise cut) completed: six new traditions**
  (1113 → 1119): `gengetone` (revived from the PR #33 revert), `manele`,
  `chalga`, `marrabenta`, `murga_uruguaya`, `shangaan_electro` — the full
  vetted-gap queue from the darkpsy pilot recon. Each modeled to full standard
  (catalog entry + extras with hand-authored axes/description/exemplars,
  era-correct rooms/chains, part-variant picks) and verified: validate clean,
  placement pre-flight, per-entry coherence audit, compiled recipes distinct
  and ≤1000 chars. One new tree node (`carnivalProcessional.riverPlate`, 311 →
  312) places Río de la Plata carnival; murga crossRefs candombe's
  `groovePercussion.latinAm` and `protestSong.iberianLatin`.
- **Placement policy decided (the PR #33 question): accuracy over strict
  additivity.** New genres are placed where they genuinely belong even when
  that updates relatives' genre-signature neighbor lists; the affected recipes
  are inspected diff-by-diff and re-blessed. Gengetone's accurate
  `mcRhythm.intlHipHop` placement updates 4 relatives (genge_kenyan,
  bongo_flava, mahraganat, algerian_rap): "korean rap" → "gengetone" in their
  neighbor lists — gengetone is genuinely the nearer neighbor — plus a
  one-descriptor budget ripple where the shorter name freed recipe chars.
- **`rompler_workstation` instrument** (418 → 419, the genre cut's
  instrument-add): the ROM-playback workstation / arranger keyboard the
  electronic family lacked — Korg M1 / Roland JV / Yamaha-PSR-Casio home /
  Korg Pa arranger lineages, preset-bank part (GM combo, MIDI-marimba, oriental
  arranger, dance stabs, piano/orchestral), use-context part, and membership in
  the shared `electronic_technique` applies_to pools. Carries shangaan
  electro's MIDI-marimba signature and manele/chalga's wedding-circuit arranger
  sound; used by no pre-existing tradition, so zero recipe churn from the add
  itself.
- **Two palette-gap variants, anchored by the proper-noun-stem discipline**
  (zero spurious cross-genre bleed, verified by sweeping the scorer over all
  1119): `southern_african_bantu_vocal_tradition` (voice_tradition #34 — Zulu/
  Xhosa/Tsonga choral chant; wins exactly kwaito, gqom, maskandi, isicathamiya,
  mbaqanga, south_african_kwaito, shangaan_electro, all previously stamped with
  the West-African `yoruba_tonal_vocal_tradition`) and
  `choir_regional_rioplatense_murga` (murga block-chorus; wins exactly
  murga_uruguaya — previously the tie-broken pick was Georgian
  `kakhetian_three_voice`). Both fix visibly wrong-region tokens in rendered
  recipes; the Bantu reassignments are accuracy improvements re-blessed under
  the placement policy above.
- **check_docs count-gate hardened against the forms that actually drifted.**
  The darkpsy artifact regen (1112 → 1113) left AGENTS.md, SKILL.md,
  index.html, and package.json stale because the gate only matched a bare
  "N traditions". Now gated: modifier forms ("N recorded-music traditions",
  line-wrapped counts), adjectival forms ("1119-tradition codex", "312-node
  genre tree", ≥3 digits so example builds don't false-positive), SKILL.md §1
  table rows, loader-output shorthand ("loaded: 419 insts, 1119 trads"), and
  the derived facts "global dominates at 678/1119" and "288 of 312 ids contain
  dots"; package.json joined the scanned surfaces. All doc counts trued up to
  1119/419/312 in the same pass.

- **Default build flipped to the lazy shell (phase 4 — the flip).** `npm run
  build:html` (and `node scripts/build_html.js` with no flags) now produces the
  lazy shell, and the committed `codex.html` is that shell (~2.5 MB vs ~6.3 MB
  embedded): it deploys beside the static `api/` and boots from
  `api/browse.json`. `--embedded` builds the historical fully-self-contained
  single-file variant; `--embedded` and `--lazy` are mutually exclusive. The
  gates that boot the page in a no-fetch sandbox were retooled to build the
  `--embedded` variant from the same source — `equivalence.js`,
  `app_recipe_regression.js`, `tandem.js` (its HTML-artifact + import-simulation
  checks), and `ui_reachability_check.js` (headless Chromium can't fetch `api/`
  over `file://`); each is sound because `check_lazy_app.js` proves the shipped
  shell is behaviorally identical to that embedded build. `tandem.js` also now
  asserts the *shipped* `codex.html` is a true shell (no embedded tradition
  tables; carries `CODEX_LAZY_API`). The freshness/reproducibility job rebuilds
  the lazy shell by default and byte-diffs it against the committed copy. The
  shell↔embedded parity is registered as the `lazy-shell-parity` promise
  (`check_lazy_app.js`), and `faults.js` plants a one-tradition `browse.json`
  desync to prove that gate is two-sided. *This is the GitHub Pages deployment
  model going forward: the lone-file / open-from-`file://` property is dropped
  in favor of one hosted app + static API.*
- **Lazy shell build + parity gate (phase 3 of the lazy-load migration).**
  `node scripts/build_html.js --lazy` (`npm run build:html:lazy`) assembles the
  thin-shell variant of the app: the two tradition tables (~3.7 MB, 66% of the
  embedded data) stay out of the page and a build-injected `CODEX_LAZY_API`
  const switches `src/app.js` onto its `CATALOG_READY` boot path — ONE fetch of
  `api/browse.json` before UI init, with a persistent, honest boot-error state
  (not a blank app) if that fetch fails. The embedded build's init stays fully
  synchronous and byte-identical in behavior. `scripts/check_lazy_app.js`
  (`npm run test:lazy`, in the `npm test` chain so CI runs it) boots BOTH
  builds in jsdom — the lazy one against the committed `api/` through a fetch
  shim — and asserts behavioral identity: the app-facing catalog projection
  deep-equal across all traditions, `renderTradPicker()` innerHTML
  string-identical for the tree and search queries, a six-tradition import
  producing identical cards and an identical `compressRichRecipe` string,
  exactly one (cached) fetch per imported tradition, plus both failure paths
  (browse index unreachable → boot-error state; tradition 404 → zero cards +
  error toast). `--check` on a lazy build also fails closed if the tradition
  tables ever leak back into the page. *(Phase 4 flipped the default build to
  this shell and made the committed `codex.html` the shell — see the entry
  above.)*
- **`Catalog` data layer in the app (phase 2 of the lazy-load migration).** Every
  tradition read in `src/app.js` now routes through one `Catalog` object — direct
  `TRADITIONS` / `TRADITION_EXTRAS` access survives only inside its boot function.
  Two boot modes: *embedded* (the tables are present as globals — today's
  single-file `codex.html` and every node/jsdom gate harness; behavior is
  byte-identical) and *lazy* (`Catalog.bootFromIndex(browse)` boots from
  `api/browse.json` and `Catalog.ensureFull(id)` fetches a tradition's import
  payload once, on demand). `importTradition` stays intentionally synchronous
  (tandem's sandbox checks call it directly), reading the Catalog cache; the
  UI entry points (`importTraditionWithFeedback`, the sidebar staple button)
  await `ensureFull` first — the ONE await on the import path, a few hundred
  bytes, cached per tradition.
- **`api/browse.json` — Tier-1 browse index (phase 1 of the lazy-load migration).**
  `build:api` emits a per-tradition index carrying everything the browse surfaces
  read — id, name, family, lineage, parent, a compact 13-axis array, instrument
  ids, full description, exemplars, crossRefs (~1 MB for 1112; gzips ~4:1) — and
  `check_api` validates it (complete count, ids match the catalog, 13-axis shape,
  app-facing fields present). Search, tree, find-similar, and fingerprints run
  locally off this ONE fetch with recall and display identical to the embedded
  build. The only fields excluded are what an *import* needs (tuning/room/parts/
  chain_*): those ship per tradition as a new `source` field in
  `traditions/{id}.json` (a verbatim projection of the catalog row, gated by
  `check_api` against drift), fetched only when a tradition is imported — lifting
  the single-file memory ceiling (~3–5k traditions) with no server and no
  per-action lag on browse interactions. *Index, `source`, gates, and the app's
  data layer landed; the build-shell flip is the next phase.*
- **22 canonical umbrella genres added as distinct top-level traditions** (1090 → 1112):
  `pop`, `rock`, `metal`, `country`, `lo_fi`, `jazz`, `blues`, `folk`, `soul`, `reggae`,
  `hip_hop`, `rnb`, `gospel`, `classical`, `electronic`, `house`, `techno`, `ska`, `trap`,
  `dubstep`, `kpop`, `afrobeats`. The catalog had 40+ `pop` and 30+ `metal`/`rock`
  sub-genres but no entry for the bare, most-queried terms — an agent fetching
  `…/api/traditions/pop.json`, or a user searching "Rock", got a 404 on the single most
  likely query. Each is a peer entry (like the existing `funk`/`punk`), modeled on its most
  canonical existing exemplar's config so every id resolves, with era-neutral lineages and
  hand-authored descriptions/exemplars.
- **`umbrella: true` extras flag + staple/neighbor exclusion** (`search.js` auto-staple,
  `score.js` neighbor-bias). Umbrella genres are query endpoints, not real recording
  lineages, so both pools now skip any tradition flagged `umbrella: true`. Without it, the
  axis-central umbrellas became high-scoring staple/neighbor candidates and perturbed 53
  existing sub-genre recipes (e.g. dragging `death_metal`'s Mesa Dual Rectifier to a
  Marshall). With it, every existing recipe is byte-identical (regression 1198/1198, zero
  churn) while the umbrellas stay fully queryable and compile sensible canonical recipes.
- Four new `voice_tradition` variants (32 total) for vocal lineages the palette
  lacked: `sami_joik_tradition` (Nordic Sápmi joik), `andean_quechua_tradition`
  (Quechua/Aymara wayno), `native_american_vocal_tradition` (Plains/Southwest
  powwow & ceremonial), `southeast_asian_folk_vocal_tradition` (lam/mor-lam,
  luk-thung). 20 traditions reassigned off the `modern_pop_vocal_training`
  default onto these. Variant descriptor tokens were tuned to distinctive
  proper-noun stems so the engine's scorer surfaces them only for their own
  region (Sámi/Andean/SE-Asian/Lakota traditions auto-select correctly; spurious
  cross-genre bleed eliminated — verified by sweeping the scorer over all 1090).
- `scripts/audit_coherence.js` (`npm run audit:coherence`): a substantive
  **coherence** auditor that complements `validate` (reference resolution) and
  `audit` (token/descriptor health) by checking that a tradition's fields are
  mutually consistent — the class of issue that passes every structural gate
  because a generic default was stamped early and never customized. Checks:
  archetype↔explicit-medium recording-era clash, voice-multitrack-stack era vs
  medium, stamped `voice_tradition: modern_pop_vocal_training` on traditional
  forms (with palette suggestions), precise non-12-TET tuning contradictions
  (pentatonic/modal correctly excluded), plus advisory environment-collapse and
  single-instrument reports. `--json` / `--full` / `--section=` / `--strict`.
- `scripts/_apply_trad_edits.js`: surgical, id-scoped field editor for
  `05_traditions.js` (one tradition per line). Asserts the prior value and a
  unique, delimiter-anchored match before writing, so an edit can never corrupt
  a neighbouring field (e.g. top-level `tuning` vs the `string_tuning` part).
- `scripts/check_doc_behaviors.js` (folded into `npm run check-docs`, so it runs in
  CI): a third doc gate that asserts the documented *behaviors and outputs* of the
  agent-facing docs, not merely that commands exit 0. `check_docs.js` gates the catalog
  counts and `check_doc_commands.js` gates that every documented command runs — neither
  caught SKILL.md §3f drifting, which kept warning (as "verified") that a bare
  `--diff <a> <b>` "dies" long after `recipe.js`'s `BOOLEAN_FLAGS` made every argument
  ordering work. Each assertion pins one documented behavior to the SKILL.md section that
  states it — the `--diff` arg-order/byte-identity contract, `--swap-variant` exit-2
  rejection, stapling order → lead tradition, the `nearest_neighbor` / `preface_configure`
  outputs cited as "Verified", and arrangement being CLI-only — and fails CI when reality
  diverges (proven against the historical `--diff` regression).
- `scripts/check_api.js` + `scripts/_api_contract.js` (`npm run check:api`, in CI; also
  run at the tail of `npm run build:api` and in the Pages publish): a contract gate over
  the **static API itself** — the agent-facing product (`api/*.json`) that AGENTS.md,
  `llms.txt`, and `index.html` point every external agent at, and which until now had **no**
  automated verification at all. `_api_contract.js` encodes the promises those docs make,
  asserted in two places. (1) `build_static_api.js` now **fails closed**: a tradition that
  won't compile, an incomplete count, an over-ceiling recipe, or an unresolvable `config`
  id makes the build exit non-zero instead of silently dropping the tradition — the old
  `fail++; continue` could quietly publish fewer than the promised 1090, and
  `build_discovery.js` would then propagate the short count into `llms.txt`. (2)
  `check_api.js` re-checks the on-disk artifact: completeness (the "all 1090 in one fetch"
  promise), the ≤1000-char recipe ceiling, `recipe_chars` accuracy, and that **every**
  `config` id (room, archetype, tuning, `inline_chain`, `fx_extras`, instruments + slot
  variants) resolves against the current catalog — which also catches the committed `api/`
  snapshot drifting from `references/`.
- `validate.js` now guards three previously-unchecked tradition fields: `chain_fx`
  (against the fx section) and `chain_amp_guitar` / `chain_amp_bass` (against the
  `amp_make` variant namespace they actually draw from). That gap is what let the
  `fx_`-prefix and wrong-namespace amp ids in the Fixed section below ride along unflagged.
- Two more `check_doc_behaviors.js` assertions: fx_extras render into the recipe (surf
  rock shows its spring reverb + tremolo — the regression guard for the fx fix below) and
  the §3d `belting` lexicon tokens match the doc verbatim.
- **Three standing gates that make the dogfooding self-enforcing** (a promise-coverage
  bijection, two-sided proofs, and artifact reproducibility):
  - `scripts/check_promises.js` + `scripts/_promises.js` (`npm run check:promises`, in
    CI): enforces a bijection across the promises the agent-facing docs make
    (`<!-- @promise: id -->` markers), a registry, and the gates that verify them
    (`// @covers: id` tags). A documented promise with no gate — or a gate covering an
    unregistered/undocumented promise — fails CI. 9 promises, 0 orphans on any side.
  - `scripts/faults.js` (`npm run faults`, new `freshness` CI job): fault injection that
    plants one known defect per gate-class (broken ref, >1000-char recipe, dropped
    tradition, app↔node desync, stale `api/`, silent blend-drop) into isolated temp
    copies and asserts each owning gate exits non-zero. A check you've never seen go red
    is worthless; this proves all 7 are two-sided (0 escapes).
  - `scripts/check_artifact_fresh.js` (`npm run check:fresh`, new `freshness` CI job):
    rebuilds `api/` + `codex.html` and byte-diffs against the committed copy (build
    timestamps normalized), so the published artifact is provably a function of the
    source — killing the committed-snapshot-drift class. Caught a stale committed
    `codex.html` on first run (the file predated the `chain_fx` fix's effect on the
    embedded data; `build:api` doesn't rebuild it); regenerated.
- `build_static_api.js --out` now uses `path.resolve` so an absolute output dir is
  honored (it was `path.join`-ed onto the repo root, silently relocating absolute paths),
  matching `build_html.js`.
- **Voice model expanded with two new articulatory dimensions + an `auto: false`
  explicit-only variant mechanism.** The `voice` instrument gains `voice_vocal_tract`
  (tongue-root / vowel posture: `tongue_root_retracted_dark`, `tongue_root_advanced_bright`,
  `pharyngeal_widened_yawned`, `nasalized_tract`) and `voice_effort` (phonatory effort /
  subglottal pressure: `effort_minimal_undersung`, `effort_projected`, `effort_pressed_maximal`),
  plus a `slow_wide_terminal_vibrato` vibrato variant and an `appalachian_outlaw_folk_tradition`
  vocal tradition. These give native slots to vocal techniques the model previously had to
  cram into `voice_quality` — e.g. "keep subglottal pressure minimal / sing at conversation
  volume or below" (effort) and "pull the tongue root back, target back vowels" (vocal tract),
  which can now coexist with a lowered larynx and fry instead of competing for one slot. To add
  them without perturbing a single existing recipe, every new non-default variant carries
  `auto: false`: `search.js` skips such variants in BOTH the seed pick (`seedFromTradition`) and
  the hill-climb (`variantSwapMoves`), so an optional dimension stays at its neutral
  (empty-descriptor, silently-dropped) default for every tradition unless a caller selects it
  explicitly via `--swap-variant` (which pins it past the search). Verified zero-blast — recipes
  1198/1198, prefaces 79/79, app 56/56, equivalence 8/8, all byte-identical.
- `voice_mechanism_compound` gains `voice_mechanism_supraglottal_rasp_pitch_stable` — a
  controlled supraglottal rasp that rides on a clean core without bending pitch
  (`supraglottal-rasp-clean-core, pitch-stable-distortion, controlled-ventricular-overlay,
  throat-clear-grain`). Every prior supraglottal-grit option baked pitch alteration into its
  descriptors (`subharmonic` / `octave-down-pitched` / `sub-fundamental-buzz` / `screamed`),
  so a deliberate pitch-decoupled growl had no native variant. `auto: false` (explicit-only),
  so zero recipe drift.
- **"Not set" for instrument parts in the composer UI.** The part-variant picker now offers a
  "Not set" chip (mirroring the existing null option on `signal chain` / `environment` stages),
  and the `setPart` handler does `variant || null` like `setTuning`/`setRoom`/`setChain`. An
  unset part contributes no descriptors — both descriptor builders already skip a falsy variant
  id (`app.js` `Variant()` → null guard; `scripts/_card_descriptors.js`), so no engine change was
  needed and browser↔node parity is unaffected (app 56/56, equivalence 8/8).

### Removed
- `scripts/_instrument_asset_map.json` — orphaned since the original import;
  nothing reads it (`fetch_commons.js` reads `_instrument_asset_map_full.json`).

### Changed
- **Founder personal names dropped from maker-lineage descriptors** (the recipe
  "no artist names" contract). The synth / drum-machine / theremin "maker lineage"
  variants in `references/02_instruments.js` embedded a founder's personal name beside
  the already-named brand — e.g. "Moog Robert Moog lineage" → "Moog lineage", and the
  theremin "Moog Music Etherwave … Robert Moog reissue" → "… reissue". Brand + model +
  year + place kept, personal name removed; variant ids unchanged (opaque keys). `api/`,
  `codex.html`, `sitemap.xml`, and the recipe snapshots regenerated from source.
- **`main` is now the canonical / default branch.** Reconciled history so there is one
  source of truth; CI
  and the `sync-pages` auto-publish target `main` (the live Pages / Render line).
- Tradition defaults refined (61 traditions; recipe outputs re-snapshotted, all
  regression/equivalence gates green, `codex.html` rebuilt):
  - **Recording-era coherence (21):** corrected anachronistic `chain_archetype`
    labels and the explicit medium/voice-multitrack stamps that contradicted
    them — e.g. modern digital genres (reggaeton, merengue urbano, bachata,
    cumbia electrónica, sertanejo universitário, reggae fusion) no longer carry
    1950s Kingston/Havana tape archetypes; vintage forms (Lebanese tarab-pop,
    Sahel praise) no longer carry a modern-DAW archetype over a researched tube
    chain; Minneapolis synth-funk moved off a 2010s Melodyne stack.
  - **Vocal-tradition defaults (43):** replaced the catalog default
    `modern_pop_vocal_training` with the accurate vocal lineage on clearly
    traditional forms — Sardinian/Corsican/Balkan polyphony → Mediterranean
    demotic, Irish/Breton lament → sean-nós, Scottish/Hebridean → Gaelic,
    Japanese/Korean folk → min'yō/minsogak, Maghrebi/Levantine art-song → maqām,
    Yoruba dirge → Yoruba tonal, sacred-steel/prison-song → gospel. Heritage-named
    but modern-pop-sung genres (baroque pop, mandopop, Greek rock) were left as-is.

- Project scaffold: `package.json` (declared dev dependencies, `npm run` command
  surface, `engines.node >= 22`), committed lockfile, ESLint flat config, Prettier,
  `.gitignore`, `.editorconfig`, `README.md`, this changelog, and `LICENSE`.
- `src/app.js` and `src/index.template.html`: the browser application is now
  first-class, lintable source. The build assembles `codex.html` by injecting the
  data block, the family-parts merge, and the app into a single `<!--@CODEX_BODY-->`
  marker.
- `scripts/_merge.js`: one source for the instrument family-parts merge, shared by
  the Node loader and the build (it had been written twice).
- `scripts/app_recipe_regression.js` + `tests/app_recipe_snapshot.json`: snapshot
  regression for the browser recipe path (`makeCard` → `compileStack` /
  `compileRecipeStack` across all four formats), wired into `npm test` and the build.
- `build_html --check` now asserts a hard per-`<script>` byte ceiling in addition to
  parsing the embedded data; documented exit codes.
- `.github/workflows/ci.yml`: lint, validate, audit, regressions, build (with byte
  check), and UI reachability on every push and pull request.

### Changed
- `tests/ui_capability_inventory.md` (relocated from `docs/`): it is reachability-test
  input, not documentation.
- `check_docs.js` scoped to the canonical manifest (`SKILL.md`); prose docs and test
  fixtures are excluded.
- Splitter budgeting renamed `maxChars` (it measures characters); the real byte limit
  is enforced by the `--check` assertion.
- `ui_reachability_check.js` uses Playwright's bundled Chromium — removed the hardcoded
  browser path and the absolute `require`.

### Removed
- About 45 dead or vestigial files (~830 KB): `scripts/_one_off/`, orphaned scripts,
  archived audit outputs, and the legacy `docs/plans/` planning tree.
- The `--extract` template-reconstruction bootstrap from `build_html.js`; templates are
  required source.
- Dead code: a duplicate object key, several unused locals and parameters, and a dead
  token-set chain in `build_variants.js`. `npm run lint` is clean.

### Fixed
- **Browse-traditions search now ranks by match locus, not catalog order.** Typing a
  genre returned every tradition whose name/lineage/description merely *contained* the
  term, rendered in raw catalog-array order — so the exact title (e.g. `Pop`) sat
  hundreds of rows below prose mentions ("…Selena-era pop-conjunto…"), and newly-appended
  umbrellas sorted dead last. Results are now tiered: exact name → name prefix → name
  substring → lineage/description only, with shortest name first within a tier. (`src/app.js`,
  browser-only; recipe output and the static API are unaffected.)
- Two false-positive `tandem` gates (flagging source untouched by data work):
  the card-descriptor-semantics gate now strips comments before scanning the
  HTML embed for `match_tokens` (the injected `harvestDescriptors` core carries
  a "NOT match_tokens" comment); and the inline-SVG gate now allowlists
  `glyphSvg()`, the tradition glyph/emoji renderer (a hand-rolled SVG renderer
  like the already-allowlisted viz functions, not an `icon()` bypass).
- Delete-workspace used native `confirm()` (which browsers can suppress in the embed) —
  it now uses the app's `confirmDialog`.
- `saveWS` and `delWS` now guard `window.storage` symmetrically (each early-returns on
  `!window.storage`; reads go through `safeGet`'s try/catch wrapper).
- `scripts/expand.js` truncated piped JSON at the OS pipe buffer (~64 KiB): each success
  path did `console.log(bigJSON); process.exit(0)`, and `process.exit()` tears the process
  down before a large async stdout write drains to a pipe — so `expand.js --tradition
  <id> | jq` lost everything past byte 65524 while still exiting 0 (a file redirect was
  unaffected). Success paths now set `process.exitCode` and let the event loop flush
  stdout; the flag dispatch is an `if/else-if/else` chain so they no longer fall through
  into the usage error. Exit codes unchanged (0 success / 2 error).
- Corrected two stale SKILL.md dogfooding notes the code had outrun: §3f no longer claims
  a bare `--diff <a> <b>` "dies" (every argument ordering is byte-identical, now gated by
  `check_doc_behaviors.js`), and §3h no longer says jsdom is "already installed" — the
  headless rich-recipe path needs `npm ci` first, and a fresh clone fails with "Cannot
  find module 'jsdom'" even from the repo root.
- **18 traditions silently dropped their intended fx.** Their `chain_fx` carried
  `fx_`-prefixed ids (`fx_spring_reverb`, `fx_chorus_pedal`, `fx_tape_echo`, …) that don't
  exist in the fx section — the real ids are unprefixed (`spring_reverb`, `chorus_pedal`,
  `tape_echo`). `translate` (and the browser `compileStack`) resolve fx by exact id and
  silently `continue` past a miss, so the period-correct fx never rendered: surf rock
  without its spring-reverb tank, dub without its plate reverb, honky-tonk/bakersfield
  without spring reverb + analog delay (27 occurrences across bakersfield,
  british_invasion_rb, city_pop, country_rock, detroit_techno, dream_pop, dub, honky_tonk,
  krautrock, madchester_baggy, merseybeat, midwest_emo, new_wave, post_punk, reggae_roots,
  space_rock, surf_rock, synthpop). Stripped the bogus prefix; those recipes now render
  their fx, and `validate.js` + `check_api.js` make this class of broken ref fatal.
- `modal_jazz.chain_amp_guitar` used a chain-`amp`-section id (`amp_fender_twin_blackface`)
  in a field that resolves against the `amp_make` variant namespace, so its guitar amp
  silently never applied; corrected to `amp_american_fender_blackface` (the same Fender
  Blackface Twin). Surfaced immediately by the new `validate.js` amp guard.
- `recipe.js` blends silently dropped unknown tradition ids. The primary id (and every
  `--exclude-instrument` / `--add-instrument` / `--swap-variant` id) was validated and
  rejected with exit 2, but staple ids in `--traditions a,b` and the secondary in
  `--diff a b` were passed straight to `seedFromTradition`, which skips an unknown
  staple — so `--traditions afrobeat,typo` or `--diff afrobeat wrongid` produced a
  plausible recipe that silently omitted the requested genre (exit 0), quietly breaking
  the blend promise. Now every tradition id is validated up front (exit 2, offending id
  named) and `--diff` rejects a stray third positional. Found by an alpha/beta CLI sweep.

## [1.0.0]

- First fully-verified cut: 1,090 traditions, 421 instruments, 256 rooms, 22 chain
  archetypes, 21 production aesthetics. Reference integrity clean, recipe and preface
  regression green, single-file `codex.html` reproducible from source.
