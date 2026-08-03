#!/usr/bin/env node
// audit.js — data-quality audit of the catalog.
//
// Catches issues that validate.js doesn't but which silently degrade output:
//
//   1. crossRef == parent (redundant — sentence 1 dedup hides it but the data
//      is still wrong, and any code consuming crossRefs sees garbage)
//   2. Dead canonical-suffix tags (no tradition's context tokens match the
//      tag's stripped form — purely scoring noise)
//   3. Dead trusted-technique whitelist entries (whitelist entry that no
//      catalog descriptor uses)
//   4. Duplicate descriptors within a single descriptor list (double-counting
//      in scoring, redundant in output)
//   5. crossRef in same top-level branch as parent (often defensible but
//      sometimes redundant; reported as warnings only)
//   6. Empty crossRefs arrays (not an error, but a data-completeness gap)
//   7. Circular crossRefs (opt-in; A's crossRefs ↔ B's parent AND B's crossRefs ↔ A's parent)
//   8. applies_to family-mismatch (variant in family X targeting only family-Y instruments)
//   9. Family-parts coverage gaps (instruments in a family with shared parts that
//      inherit none — usually means own-parts override every shared part by id)
//  10. Bare-genre descriptors (genre tokens used as descriptors without -canonical suffix —
//      would surface as if iconic, almost always an authoring mistake)
//  11. Catalog coverage gaps (resources defined but no tradition references them —
//      rooms, chain items, aesthetics; advisory only)
//  12. Unsurfaceable variants (variant whose descriptors can never surface: no iconic
//      match to id, no whitelist bypass, no token in any tradition context — ghost variant)
//  13. Descriptor redundancy across siblings (descriptor appears in 50%+ of sibling
//      variants — not distinguishing them, suggests copy-paste authoring)
//  14. Description-instrument mismatch (variant description text references instruments
//      that aren't in its applies_to — sentence-2-builder may emit wrong instrument
//      names; warning)
//  15. No iconic descriptor (variant has no descriptor sharing a token with its id or
//      name — can score but never surface as named in output; opt-in via --section)
//  16. Duplicate axes signatures (multiple traditions occupying same 13-axis cell —
//      ambiguous to search engine on axis-vector queries; advisory)
//  17. Variant score below threshold (variant whose best-case score on any card never
//      reaches a minimum surfaceability bar; warning)
//  18. Runtime coverage gaps (slots in tradition surfaces with no defensible pick —
//      catalog has a hole the scoring engine masks; warning)
//  19. Multi-start convergence (Layer 9E — does hill-climb starting from different
//      seeds converge to the same recipe? Divergence indicates landscape ruggedness)
//
// USAGE
//   node scripts/audit.js                 # full report
//   node scripts/audit.js --quiet         # exit 0 if no errors, 1 otherwise; no stdout
//   node scripts/audit.js --strict        # exit 1 if ANY issue found (warnings included)
//   node scripts/audit.js --section=NAME  # only run a specific section
//
// SECTIONS
//   parent_crossref_redundant       -- Issue #1
//   duplicate_part_id               -- Issue #1b (errors)
//   dead_canonical                  -- Issue #2
//   dead_whitelist                  -- Issue #3
//   duplicate_descriptors           -- Issue #4
//   parent_top_branch_overlap       -- Issue #5 (warnings)
//   empty_crossrefs                 -- Issue #6 (warnings)
//   circular_crossrefs              -- Issue #7 (opt-in only via --section)
//   applies_to_family_mismatch      -- Issue #8 (errors + warnings)
//   family_parts_coverage           -- Issue #9 (warnings)
//   bare_genre_descriptors          -- Issue #10 (warnings)
//   coverage_gaps                   -- Issue #11 (advisory)
//   unsurfaceable_variants          -- Issue #12 (warnings)
//   redundant_descriptors_in_part   -- Issue #13 (warnings)
//   description_instrument_mismatch -- Issue #14 (warnings)
//   no_iconic_descriptor            -- Issue #15 (warnings, opt-in)
//   duplicate_axes_signature        -- Issue #16 (advisory)
//   variant_score_below_threshold   -- Issue #17 (warnings)
//   coverage_gaps_runtime           -- Issue #18 (warnings)
//   multistart_divergent            -- Issue #19 (warnings)
//   function_branch_shape           -- Issue #20 (advisory)
//
// EXIT CODES
//   0 — no issues (or warnings-only without --strict)
//   1 — errors found, or --strict with any issues

const fs = require('fs');
const path = require('path');
const C = require('./_loader.js');

const args = process.argv.slice(2);
const flags = {};
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a.startsWith('--')) {
    const eq = a.indexOf('=');
    if (eq > 0) flags[a.slice(2, eq)] = a.slice(eq + 1);
    else flags[a.slice(2)] = true;
  }
}

const sectionsToRun = flags.section ? new Set(flags.section.split(',')) : null;
const shouldRun = (s) => !sectionsToRun || sectionsToRun.has(s);

const errors = [];
const warnings = [];

// crossRefs can be plain strings ('parent.path') OR objects ({ ref, isolated_parts })
// after the voice-isolation work. Always extract the ref string before treating
// it as a tree path. Returns null for malformed entries (which won't be reported
// here — validate.js catches structural errors).
function crossRefRef(cr) {
  if (typeof cr === 'string') return cr;
  if (cr && typeof cr === 'object' && typeof cr.ref === 'string') return cr.ref;
  return null;
}

// ─────────────── 1. crossRef == parent ───────────────
if (shouldRun('parent_crossref_redundant')) {
  for (const tid of Object.keys(C.TRADITION_EXTRAS)) {
    const e = C.TRADITION_EXTRAS[tid];
    if (!e.parent || !e.crossRefs) continue;
    for (const cr of e.crossRefs) {
      const r = crossRefRef(cr);
      if (r === null) continue;
      if (r === e.parent) {
        errors.push({
          section: 'parent_crossref_redundant',
          tid,
          detail: `crossRef '${r}' equals parent — remove (it's redundant)`,
        });
      }
    }
  }
}

// ─────────────── 1b. Duplicate part IDs within an instrument ───────────────
// If the same part id appears twice on one instrument, only one survives (and the
// duplicate's variants become unreachable). Catches authoring collisions like
// adding a 'qanun_strings' part for material when 'qanun_strings' already exists
// for configuration.
if (shouldRun('duplicate_part_id')) {
  for (const inst of C.INSTRUMENTS) {
    const seen = new Map();
    for (const p of inst.parts || []) {
      if (!p || !p.id) continue;
      if (seen.has(p.id)) {
        errors.push({
          section: 'duplicate_part_id',
          instrument: inst.id,
          detail: `part id '${p.id}' appears twice on ${inst.id} — only one survives, variants on the other are unreachable`,
        });
      }
      seen.set(p.id, true);
    }
  }
}

// ─────────────── 2. Dead canonical-suffix tags ───────────────
// Build the set of all tradition-context tokens
function harvestContextTokens() {
  const tokens = new Set();
  // Generic harvest: splits on whitespace, hyphens, underscores, common punctuation.
  const harvest = (s) => {
    if (!s) return;
    for (const t of String(s)
      .toLowerCase()
      .split(/[\s\-_,.()/]+/)) {
      if (t && t.length > 2) tokens.add(t);
    }
  };
  // Parent-path harvest: matches score.js buildContext semantics — dot-split THEN
  // camelCase-split each segment ("functionalSong.soulRb" → functional, song, soul, rb).
  // Without this, audit misses tokens like "rb" from "soulRb" that scoring actually uses,
  // and compound canonicals like "contemporary-rb-canonical" get falsely flagged dead.
  // No length filter — score.js keeps all parent tokens regardless of length, so audit
  // must too (otherwise legitimate compounds with 2-letter segments like "rb" get
  // false-positive dead flags).
  const harvestParent = (s) => {
    if (!s) return;
    for (const seg of String(s).split('.')) {
      const camelSplit = seg
        .replace(/([A-Z])/g, ' $1')
        .toLowerCase()
        .split(/\s+/);
      for (const t of camelSplit) {
        if (t) tokens.add(t);
      }
    }
  };
  // tradition.id is a curated identifier — full-tokenize without length filter so
  // 2-char locale/genre codes ("la", "nu", "rb", "uk", "us", "sf", etc.) are
  // preserved. Other fields keep the noise-reduction filter.
  const harvestId = (s) => {
    if (!s) return;
    for (const t of String(s)
      .toLowerCase()
      .split(/[\s\-_,.()/]+/)) {
      if (t) tokens.add(t);
    }
  };
  for (const t of C.TRADITIONS) {
    harvestId(t.id);
    harvest(t.name);
    harvest(t.lineage);
    harvest(t.family);
    // tradition.canonical_tags are explicit context signals — harvest with no length filter
    for (const tag of t.canonical_tags || []) harvestId(tag);
    const e = C.TRADITION_EXTRAS[t.id] || {};
    harvestParent(e.parent);
    harvest(e.description);
    for (const cr of e.crossRefs || []) harvestParent(crossRefRef(cr));
  }
  for (const a of C.CHAIN_ARCHETYPES || []) {
    harvest(a.id);
    harvest(a.name);
  }
  for (const r of C.ROOMS) {
    for (const d of r.descriptors || []) harvest(d);
  }
  return tokens;
}

if (shouldRun('dead_canonical')) {
  const ctxTokens = harvestContextTokens();
  // Also build a set of full hyphenated tokens that appear in any tradition's
  // text (e.g., "lo-fi", "post-punk", "two-step"). The audit's per-token
  // split-and-AND check will miss these because individual tokens like "fi"
  // rarely stand alone, even when "lo-fi" appears across many traditions.
  const ctxFullTokens = new Set();
  const harvestFull = (s) => {
    if (!s) return;
    const lc = String(s).toLowerCase();
    // Capture both space-separated and hyphenated multi-word units
    for (const tok of lc.split(/[\s,.()/]+/)) {
      if (tok.length > 2) ctxFullTokens.add(tok);
    }
  };
  for (const t of C.TRADITIONS) {
    harvestFull(t.id);
    harvestFull(t.name);
    harvestFull(t.lineage);
    harvestFull(t.family);
    const e = C.TRADITION_EXTRAS[t.id] || {};
    harvestFull(e.parent);
    harvestFull(e.description);
    for (const cr of e.crossRefs || []) harvestFull(crossRefRef(cr));
  }
  for (const a of C.CHAIN_ARCHETYPES || []) {
    harvestFull(a.id);
    harvestFull(a.name);
  }
  for (const r of C.ROOMS) {
    for (const d of r.descriptors || []) harvestFull(d);
  }

  const checkCanonical = (canonical) => {
    // Post-refactor: canonical_tags entries are clean tokens (no '-canonical' suffix).
    // Pre-refactor compatibility: still tolerant of trailing '-canonical' if a legacy
    // input slips through during transition.
    const stripped = canonical.replace(/-canonical$/, '').toLowerCase();
    // CITES regulatory tags (cites-app-i, cites-app-ii, cites-pre-1992-antique) are
    // intentional regulatory metadata, NOT scoring signals.
    // Exempt them from dead_canonical checks.
    if (stripped.startsWith('cites-')) return true;
    // Use-case / instrument-role classifier tags are equipment-classification metadata
    // and intentionally don't reference any tradition. Examples: 'drum-overhead'
    // tells us the mic is positioned as a drum overhead, not that some tradition is
    // called "drum overhead". Exempt these from dead_canonical checks.
    if (
      /^(drum-(?:overhead|bus|bus-grit)|kick-drum-eq|tom-drum|snare-drum|hi-hat|cymbal-(?:air)|guitar-amp|bass-(?:direct|tracking|amp)|live|live-vocal|live-canonical|podcast|broadcast|broadcast-(?:presence|mastering|classical)|overhead|mastering(?:-(?:bus|bus-glue|bus-shaping|program-eq|reference|leaning|vocal|air|archive))?|mix-bus(?:-modern|-character)?|bus-tone-shaping|ssl-buscomp-alt|tape-warmth-emulation|tube-bus-tracking|modern-tracking-(?:boutique)?|modern-vocal(?:-(?:boutique|eq|air))?|r-and-b(?:-(?:vocal|eq|vocal-canonical))?|transparent-boost|jungle-tearout|truckdriver|demo-tape-vhs-audio|sacd-release|car-stereo|consumer-home-recording-90s|bedroom-archive-90s|drum|drums|electronic-direct|keyboard-direct|modern-tracking|tube-bus|british-60s-overhead|80s-mix-bus|90s-r-and-b-vocal)$/.test(
        stripped
      )
    )
      return true;
    if (ctxFullTokens.has(stripped)) return true;
    const tokens = stripped.split(/[-_]/);
    return tokens.every((t) => ctxTokens.has(t));
  };

  // Family-parts
  const fp = C.INSTRUMENT_FAMILY_PARTS || {};
  for (const fam of Object.keys(fp)) {
    for (const part of fp[fam]) {
      for (const v of part.variants || []) {
        for (const ct of v.canonical_tags || []) {
          if (!checkCanonical(ct)) {
            warnings.push({
              section: 'dead_canonical',
              location: `family_parts.${fam}.${v.id}`,
              detail: `canonical_tag '${ct}' has no matching tradition context`,
            });
          }
        }
      }
    }
  }
  // Chain sections
  for (const sec of C.CHAIN_SECTIONS) {
    for (const it of sec.items || []) {
      for (const ct of it.canonical_tags || []) {
        if (!checkCanonical(ct)) {
          warnings.push({
            section: 'dead_canonical',
            location: `chain.${sec.id}.${it.id}`,
            detail: `canonical_tag '${ct}' has no matching tradition context`,
          });
        }
      }
    }
  }
  // Instruments (per-instrument parts only — family parts checked above)
  for (const inst of C.INSTRUMENTS) {
    for (const part of inst._ownParts || []) {
      for (const v of part.variants || []) {
        for (const ct of v.canonical_tags || []) {
          if (!checkCanonical(ct)) {
            warnings.push({
              section: 'dead_canonical',
              location: `instruments.${inst.id}.${part.id}.${v.id}`,
              detail: `canonical_tag '${ct}' has no matching tradition context`,
            });
          }
        }
      }
    }
  }
}

// ─────────────── 3. Dead trusted-technique whitelist entries ───────────────
if (shouldRun('dead_whitelist')) {
  const translatePath = path.join(__dirname, 'translate.js');
  const translateSrc = fs.readFileSync(translatePath, 'utf8');
  const start = translateSrc.indexOf('TRUSTED_TECHNIQUE_DESCRIPTORS = new Set([');
  const end = translateSrc.indexOf(']);', start);
  if (start > 0 && end > start) {
    const block = translateSrc.slice(start, end);
    const noComments = block.replace(/\/\/.*$/gm, '');
    const whitelist = [...noComments.matchAll(/'([^']+)'/g)].map((x) => x[1]);

    // Build set of all descriptor tokens used in catalog
    const allDescriptors = new Set();
    for (const inst of C.INSTRUMENTS) {
      for (const part of inst.parts || []) {
        for (const v of part.variants || []) {
          for (const d of v.descriptors || []) {
            allDescriptors.add(d.replace(/-canonical$/, '').toLowerCase());
          }
        }
      }
    }
    for (const sec of C.CHAIN_SECTIONS) {
      for (const it of sec.items || []) {
        for (const d of it.descriptors || []) {
          allDescriptors.add(d.replace(/-canonical$/, '').toLowerCase());
        }
      }
    }

    const seen = new Set();
    for (const w of whitelist) {
      if (seen.has(w.toLowerCase())) {
        errors.push({
          section: 'dead_whitelist',
          location: 'translate.js TRUSTED_TECHNIQUE_DESCRIPTORS',
          detail: `duplicate entry '${w}'`,
        });
        continue;
      }
      seen.add(w.toLowerCase());
      if (!allDescriptors.has(w.toLowerCase())) {
        warnings.push({
          section: 'dead_whitelist',
          location: 'translate.js TRUSTED_TECHNIQUE_DESCRIPTORS',
          detail: `entry '${w}' is not used as a descriptor anywhere in the catalog`,
        });
      }
    }
  }
}

// ─────────────── 4. Duplicate descriptors within single list ───────────────
if (shouldRun('duplicate_descriptors')) {
  const checkDescriptorList = (location, descriptors) => {
    const seen = new Set();
    const dupes = new Set();
    for (const d of descriptors || []) {
      if (seen.has(d)) dupes.add(d);
      seen.add(d);
    }
    if (dupes.size > 0) {
      errors.push({
        section: 'duplicate_descriptors',
        location,
        detail: `duplicates: ${[...dupes].join(', ')}`,
      });
    }
  };

  // Family-parts
  const fp = C.INSTRUMENT_FAMILY_PARTS || {};
  for (const fam of Object.keys(fp)) {
    for (const part of fp[fam]) {
      for (const v of part.variants || []) {
        checkDescriptorList(`family_parts.${fam}.${v.id}`, v.descriptors);
      }
    }
  }
  // Chain sections
  for (const sec of C.CHAIN_SECTIONS) {
    for (const it of sec.items || []) {
      checkDescriptorList(`chain.${sec.id}.${it.id}`, it.descriptors);
    }
  }
  // Instruments
  for (const inst of C.INSTRUMENTS) {
    for (const part of inst._ownParts || []) {
      for (const v of part.variants || []) {
        checkDescriptorList(`instruments.${inst.id}.${part.id}.${v.id}`, v.descriptors);
      }
    }
  }
}

// ─── ACCEPTED_OVERLAPS — whitelisted parent_top_branch_overlap entries ───
const ACCEPTED_OVERLAPS = new Set([
  'alternative_rock:distortedRock.punk',
  'drone_metal:distortedRock.metal.doom',
  'western_swing:functionalSong.country.honkyTonkEra',
  'gothic_country:functionalSong.country.honkyTonkEra',
  'bakersfield:functionalSong.country.outlaw',
  'mariachi:functionalSong.mexican',
  'ranchera:functionalSong.tejanoBorder.corrido',
  'ranchera:functionalSong.mexican',
  'ranchera:functionalSong.tropicalSong',
  'corrido:functionalSong.tejanoBorder.ranchera',
  'corrido:functionalSong.tejanoBorder',
  'sacred_steel:ritualDevotional.christianGospel.blackGospel',
  'northern_soul_motown:functionalSong.popRock',
  'philly_soul_intl:functionalSong.popRock',
  'disco:electronicDance.eurodance',
  'new_orleans:improvOnFrame.americanJazz.bop',
  'ragtime:improvOnFrame.americanJazz.early',
  'stride_piano:improvOnFrame.americanJazz.preJazzRagtime',
  'stride_piano:improvOnFrame.americanJazz.early',
  'boogie_woogie:improvOnFrame.americanJazz.preJazzRagtime',
  'latin_jazz:improvOnFrame.americanJazz.bop',
  'bebop:improvOnFrame.americanJazz.early',
  'free_jazz:improvOnFrame.jamFree',
  'fusion:improvOnFrame.americanJazz.bop',
  'soul_jazz:improvOnFrame.americanJazz.bop',
  'symphonic:artMusic.westernEarly',
  'symphonic:artMusic.westernModern',
  'string_quartet:artMusic.westernEarly',
  'string_quartet:artMusic.westernModern',
  'beijing_opera:artMusic.eastAsian',
  'cantonese_opera:artMusic.eastAsian',
  'garage_rock:distortedRock.punk',
  'psychedelic_rock:distortedRock.experimental',
  'hard_rock:distortedRock.metal.nwobhm',
  'surf_rock:distortedRock.classic',
  'progressive_rock:distortedRock.classic',
  'progressive_rock:distortedRock.experimental',
  'gothic_rock:distortedRock.alternative',
  'gothic_rock:distortedRock.experimental',
  'art_rock:distortedRock.experimental',
  'art_rock:distortedRock.classic',
  'glam_rock:distortedRock.classic',
  'glam_rock:distortedRock.artRock',
  'synthpop:functionalSong.popRock.newWave',
  'new_wave:functionalSong.popRock.synthpop',
  'new_wave:functionalSong.popRock',
  'folk_rock:functionalSong.country',
  'folk_rock:functionalSong.popRock',
  'skiffle:functionalSong.popRock.folkRock',
  'jug_band:balladPoetry.bluesNarrative.hokumBlues',
  'jug_band:balladPoetry.bluesNarrative.deltaNarrative',
  'yacht_rock:functionalSong.popRock',
  'emo:distortedRock.punk',
  'emo:distortedRock.popPunk',
  'emo:distortedRock.alternative',
  'kansas_city_swing:improvOnFrame.americanJazz.early',
  'kansas_city_swing:improvOnFrame.americanJazz.bop',
  'kansas_city_swing:improvOnFrame.americanJazz.boogieWoogie',
  'thai_classical:artMusic.southeastAsian',
  'thai_classical:artMusic.eastAsian',
  'hard_bop:improvOnFrame.americanJazz.bop',
  'hard_bop:improvOnFrame.americanJazz.soulJazz',
  'southern_rock:distortedRock.classic',
  'country_rock:functionalSong.popRock.folkRock',
  'noise_rock:distortedRock.experimental',
  'noise_rock:distortedRock.alternative',
  'pop_punk:distortedRock.punk',
  'pop_punk:distortedRock.alternative',
  'gangsta_rap:mcRhythm.usHipHop.westCoast',
  'gangsta_rap:mcRhythm.usHipHop.eastCoast',
  'conscious_hip_hop:mcRhythm.usHipHop.eastCoast',
  'conscious_hip_hop:mcRhythm.usHipHop.modern',
  'arena_rock:distortedRock.classic',
  'hair_metal:distortedRock.metal.nwobhm',
  'doom:distortedRock.metal.sludge',
  'black_metal:distortedRock.metal.doom',
  'thrash_metal:distortedRock.punk',
  'death_metal:distortedRock.metal.thrash',
  'punk:distortedRock.classic',
  'hardcore_punk:distortedRock.metal.thrash',
  'post_punk:distortedRock.alternative',
  'grunge:distortedRock.metal.sludge',
  'math_rock_post_rock:distortedRock.experimental',
  'peak_techno:electronicDance.house',
  'jungle:bassSystem.ukSoundsystem',
  'idm:experimentalElec.musiqueConcrete',
  'vaporwave:experimentalElec.retroAesthetic',
  'hawaiian_slack_key:droneModal.vocal',
  'morna:balladPoetry.chansonFado.fadoLisboa',
  'milonga:balladPoetry.latinAmTroubadour',
  'pagode:groovePercussion.brazilian',
  'mariachi_traditional:functionalSong.tejanoBorder',
  'congolese_rumba:functionalSong.tropicalSong',
  'ndombolo:groovePercussion.westAfrican',
  'wenrenyue:artMusic.westernEarly',
  'mongolian_long_song:droneModal.overtone',
  'javanese_gamelan:artMusic.eastAsian',
  'dangdut:functionalSong.midEastNAfricanPop',
  'latin_trap:mcRhythm.usHipHop.southern',
  'sludge_metal:distortedRock.metal.doom',
  'stoner_metal:distortedRock.metal.sludge',
  'post_metal:distortedRock.experimental',
  'deathcore:distortedRock.metal.thrash',
  'mathcore:distortedRock.experimental',
  'grindcore:distortedRock.punk',
  'melodic_death_metal:distortedRock.metal.power',
  'hardstyle:electronicDance.continental',
  'gabber:electronicDance.techno',
  'uk_drill:mcRhythm.intlHipHop',
  'french_rap:mcRhythm.usHipHop',
  'laiko:balladPoetry.chansonFado',
  'nashville_sound:functionalSong.crooners',
  'brill_building_pop:functionalSong.popRock',
  'doo_wop:functionalSong.popRock',
  'girl_group_60s:functionalSong.soulRb.doowop',
  'girl_group_60s:functionalSong.popRock',
  'sophisti_pop:functionalSong.crooners',
  'bubblegum_pop:functionalSong.crooners',
  'j_pop_classic:functionalSong.popRock',
  'enka:functionalSong.crooners',
  'city_pop:functionalSong.soulRb',
  'mandopop:functionalSong.popRock',
  'cantopop:functionalSong.popRock',
  'cantautore_italiano:balladPoetry.chansonFado',
  'schlager_german:functionalSong.crooners',
  'eurovision_pop:functionalSong.popRock',
  'scandi_pop:functionalSong.popRock',
  'russian_estrada:functionalSong.popRock',
  'son_cubano:groovePercussion.cuban.rumba',
  'salsa_cubana_timba:groovePercussion.cuban.rumba',
  'cha_cha_cha:groovePercussion.latinAm',
  'charanga:groovePercussion.cuban',
  'guaracha:groovePercussion.cuban.rumba',
  'danzon:groovePercussion.cuban.rumba',
  'merengue_dominicano:groovePercussion.cuban.sonSalsa',
  'forro_brasileiro:groovePercussion.brazilian',
  'vocal_trance:electronicDance.house',
  'eurodance_90s:electronicDance.continental',
  'italo_dance:electronicDance.continental',
  'russian_bard_song:balladPoetry.chansonFado',
  'polish_poezja_spiewana:balladPoetry.chansonFado',
  'czech_pisnicka:balladPoetry.chansonFado',
  'south_slavic_kantautor:balladPoetry.chansonFado',
  'hasidic_niggun:ritualDevotional.sufi',
  'naat_devotional:ritualDevotional.sufi',
  'athan_call_prayer:ritualDevotional.sufi',
  'islamic_anasheed:ritualDevotional.sufi',
  'chillwave:experimentalElec.retroAesthetic',
  'mumble_rap:mcRhythm.usHipHop.southern',
  'greenwich_village_confessional:balladPoetry.angloSingerSong.laurelCanyon',
  'greenwich_village_confessional:balladPoetry.angloSingerSong.britfolk',
  'britfolk_revival:balladPoetry.celticBalladic',
  'bothy_ballad_doric:balladPoetry.celticBalladic',
  'child_ballad_revival:balladPoetry.angloSingerSong.britfolk',
  'english_broadside_revival:balladPoetry.angloSingerSong.britfolk',
  'newfoundland_outport:balladPoetry.angloSingerSong.britfolk',
  'classic_blues_women:balladPoetry.bluesNarrative.hokumBlues',
  'chanson_classique:balladPoetry.angloSingerSong',
  'fado_coimbra_university:balladPoetry.chansonFado',
  'nwobhm:distortedRock.classic',
  'power_metal_european:distortedRock.metal.symphonic',
  'italo_house_piano:electronicDance.continental',
  'russian_orthodox_chant:ritualDevotional.christianGospel.coptic',
  'hot_country_2010s:functionalSong.popRock',
  'country_pop_crossover:functionalSong.popRock',
  'traditional_doom:distortedRock.metal.nwobhm',
  'melodic_death_swedish:distortedRock.metal.power',
  'technical_death_metal:distortedRock.metal.prog',
  'brutal_death_metal:distortedRock.metal.thrash',
  'gospel_quartet_male:ritualDevotional.christianGospel.southernGospel',
  'spirituals_african_american:ritualDevotional.christianGospel.jubileeQuartet',
  'spirituals_african_american:ritualDevotional.christianGospel.blackGospel',
  'jubilee_quartet:ritualDevotional.christianGospel.spirituals',
  'jubilee_quartet:ritualDevotional.christianGospel.blackGospel',
  'southern_gospel_quartet:ritualDevotional.christianGospel.blackGospel',
  'cool_jazz_vocal:improvOnFrame.latinJazz',
  'tech_house_classic:electronicDance.techno',
  'dsbm_black_metal:distortedRock.metal.doom',
  'anadolu_rock:distortedRock.classic',
  'latin_alternative:distortedRock.alternative',
  'rockabilly_50s:functionalSong.popRock',
  'golden_age_hip_hop_1986_1991:mcRhythm.usHipHop',
  'garage_rock_revival_2000s:distortedRock.punk',
  'sikh_gurmat_sangeet:ritualDevotional.sufi',
  'frevo:groovePercussion.cuban.charangaDanza',
  'axe_music:groovePercussion.caribbean',
  'cadence_lypso:groovePercussion.afroDiasporicElec',
  'bouyon:groovePercussion.afroDiasporicElec',
  'genge_kenyan:mcRhythm.intlHipHop',
  'genge_kenyan:mcRhythm.afroDiasporic',
  'algerian_rap:mcRhythm.intlHipHop',
  'hyperion_classical_aesthetic:artMusic.westernEarly',
  'historical_informed_performance:artMusic.westernCommonPractice',
  'anglican_choral_cathedral:artMusic.westernEarly',
  'manhattan_chamber_loft:artMusic.westernModern',
  'chinese_traditional_ensemble:artMusic.southAsian',
  'vietnamese_traditional:artMusic.eastAsian',
  'vietnamese_traditional:artMusic.southAsian',
  'bengali_baul:balladPoetry.medEastPoetic',
  'finnish_kantele_folk:balladPoetry.slavicBard',
  'swedish_nyckelharpa_folk:balladPoetry.slavicBard',
  'swedish_nyckelharpa_folk:balladPoetry.celticBalladic.scottishBallad',
  'russian_byliny:balladPoetry.celticBalladic.scottishBallad',
  'breton_folk:balladPoetry.angloSingerSong',
  'italian_southern_folk:balladPoetry.celticBalladic',
  'turkish_romani_cumbus:improvOnFrame.klezmerImprov',
  'barbershop_quartet:functionalSong.country',
  'british_brass_band:artMusic.westernEarly',
  'american_drumline:groovePercussion.cuban',
  // ─── Heterophonic-leaf-population follow-on ───
  'mongolian_urtiin_duu:droneModal.vocal',
  // ─── Auto-added 270 overlaps from systematic curation review ───
  'beijing_opera:artMusic.eastAsian.cantoneseOpera',
  'beijing_opera:artMusic.eastAsian.tibetanRitual',
  'cantonese_opera:artMusic.eastAsian.beijingOpera',
  'cantonese_opera:artMusic.eastAsian.tibetanRitual',
  'inuit_katajjaq:huntingSong.centralAsian',
  'inuit_katajjaq:huntingSong.indigenous',
  'inuit_katajjaq:huntingSong.subSaharanAfrican',
  'cantautore_italiano:balladPoetry.chansonFado.classicChanson',
  'cantautore_italiano:balladPoetry.chansonFado.fadoLisboa',
  'charanga:groovePercussion.cuban.sonSalsa',
  'charanga:groovePercussion.cuban.sonSalsa',
  'fado_coimbra_university:balladPoetry.chansonFado.fadoLisboa',
  'fado_coimbra_university:balladPoetry.chansonFado.classicChanson',
  'azerbaijani_mugham:artMusic.southAsian',
  'khmer_pinpeat:artMusic.southeastAsian.thaiClassical',
  'mbaqanga:functionalSong.africanPop.isicathamiya',
  'azmari_ethiopian:balladPoetry.westAfricanGriot',
  'xhosa_umngqokolo_overtone:droneModal.vocal',
  'mongolian_urtiin_duu:droneModal.heterophonic',
  'mongolian_khoomei:droneModal.vocal',
  'tuvan_kargyraa:droneModal.vocal',
  'tuvan_sygyt:droneModal.vocal',
  'sakha_olonkho_epic:balladPoetry.medEastPoetic',
  'cambodian_chapei_dang_veng:balladPoetry.westAfricanGriot',
  'cambodian_chapei_dang_veng:balladPoetry.medEastPoetic',
  'korean_gagok:artMusic.eastAsian.beijingOpera',
  'chinese_kunqu_opera:artMusic.eastAsian.cantoneseOpera',
  'sardinian_cantu_a_tenore:droneModal.overtone',
  'swedish_kulning:balladPoetry.bluesNarrative.fieldHoller',
  'shipibo_icaros:ritualDevotional.indigenous.mapuche',
  'shipibo_icaros:ritualDevotional.indigenous.arctic',
  'tigrinya_music_eritrean:balladPoetry.medEastPoetic',
  'oromo_music_ethiopian:balladPoetry.medEastPoetic',
  'sudanese_aghani_al_banat:balladPoetry.medEastPoetic',
  'singeli_tanzanian:electronicDance.footwork',
  'sufi_inshad_egyptian:ritualDevotional.islamic',
  'bahraini_fjiri:balladPoetry.medEastPoetic',
  'kurdish_dengbej:balladPoetry.slavicBard',
  'borgeet_assamese:ritualDevotional.indigenous',
  'divya_prabandham_tamil_vaishnav:ritualDevotional.indigenous',
  'thiruvaachakam_shaivite:ritualDevotional.indigenous',
  'huangmei_opera_chinese:artMusic.eastAsian.cantoneseOpera',
  'sichuan_opera_chuanju:artMusic.eastAsian.cantoneseOpera',
  'yueju_shanghai_opera:artMusic.eastAsian.cantoneseOpera',
  'pingju_northern_chinese:artMusic.eastAsian.cantoneseOpera',
  'qinqiang_shaanxi:artMusic.eastAsian.cantoneseOpera',
  'yu_opera_henan:artMusic.eastAsian.cantoneseOpera',
  'vietnamese_cai_luong:artMusic.eastAsian.cantoneseOpera',
  'vietnamese_don_ca_tai_tu:artMusic.eastAsian.cantoneseOpera',
  'vietnamese_hat_cheo:artMusic.eastAsian.cantoneseOpera',
  'burmese_mahagita:artMusic.eastAsian',
  'navajo_healing_chantways:ritualDevotional.indigenous.amazonian',
  'maya_marimba:groovePercussion.brazilian',
  'gwerz_breton:balladPoetry.celticBalladic.scottishBallad',
  'stornelli:balladPoetry.medEastPoetic',
  'pontic_greek:balladPoetry.slavicBard',
  'faroese_kvaedi:balladPoetry.celticBalladic.scottishBallad',
  'norteno:functionalSong.country',
  'trova_cubana:balladPoetry.chansonFado',
  'descarga_cubana:improvOnFrame.americanJazz.fusion',
  'chutney_indo_caribbean:functionalSong.tropicalSong',
  'twoubadou_haitian:balladPoetry.chansonFado',
  'zamba_argentina:balladPoetry.chansonFado',
  'festejo_afroperuano:groovePercussion.brazilian',
  'lando_afroperuano:groovePercussion.brazilian',
  'currulao_pacifico:groovePercussion.brazilian',
  'sertanejo_universitario:functionalSong.country',
  'repente_embolada:balladPoetry.medEastPoetic',
  'maya_marimba_guatemalteca:groovePercussion.brazilian',
  'classical_period_18c:artMusic.westernEarly',
  'early_romantic_19c:artMusic.westernModern',
  'late_romantic_19c:artMusic.westernModern',
  'russian_five:artMusic.westernModern',
  'les_six_french:artMusic.westernCommonPractice',
  'second_viennese_school:artMusic.westernCommonPractice',
  'neoclassicism_interwar:artMusic.westernCommonPractice',
  'polish_avant_garde_sonorism:artMusic.westernCommonPractice',
  'new_complexity:artMusic.westernCommonPractice',
  'acousmatic_music:experimentalElec.ambient',
  'soundscape_composition:experimentalElec.ambient',
  'shakers_singing:ritualDevotional.americanSacred',
  'opera_seria_baroque:artMusic.westernCommonPractice',
  'dixieland_traditional_jazz:improvOnFrame.americanJazz.preJazzRagtime',
  'chicago_jazz_1920s:improvOnFrame.americanJazz.preJazzRagtime',
  'cool_jazz_west_coast:improvOnFrame.americanJazz.smoothVocal',
  'mod_60s_british:distortedRock.regional',
  'merseybeat:distortedRock.regional',
  'garage_punk_60s:distortedRock.regional',
  'proto_punk:distortedRock.classic',
  'anarcho_punk_crass:distortedRock.regional',
  'crust_punk:distortedRock.metal.thrash',
  'd_beat_swedish:distortedRock.metal.thrash',
  'powerviolence:distortedRock.metal.thrash',
  'screamo_skramz:distortedRock.metal.thrash',
  'riot_grrrl:distortedRock.regional',
  'midwest_emo:distortedRock.alternative',
  'britpop:distortedRock.alternative',
  'slacker_rock:distortedRock.experimental',
  'speed_metal:distortedRock.metal.power',
  'groove_metal:distortedRock.metal.death',
  'gothic_metal:distortedRock.gothicRock',
  'stoner_rock:distortedRock.metal.sludge',
  'desert_rock_palm:distortedRock.metal.sludge',
  'space_rock:distortedRock.experimental',
  'aussie_pub_rock:distortedRock.classic',
  'east_coast_hip_hop_classic:mcRhythm.usHipHop.consciousRap',
  'west_coast_hip_hop_classic:mcRhythm.usHipHop.gangsta',
  'bay_area_hyphy:mcRhythm.usHipHop.gangsta',
  'memphis_rap_horrorcore:mcRhythm.usHipHop.gangsta',
  'atlanta_trap_classic:mcRhythm.usHipHop.gangsta',
  'phonk_old_memphis:mcRhythm.usHipHop.gangsta',
  'chicago_drill:mcRhythm.usHipHop.gangsta',
  'detroit_hip_hop:mcRhythm.usHipHop.consciousRap',
  'german_deutschrap:mcRhythm.usHipHop',
  'australian_hip_hop:mcRhythm.usHipHop.eastCoast',
  'japanese_hip_hop:mcRhythm.usHipHop.eastCoast',
  'korean_hip_hop:mcRhythm.usHipHop.eastCoast',
  'melodic_techno:electronicDance.house',
  'ragga_jungle:bassSystem.jamaican',
  'speed_garage_1990s:bassSystem.jamaican',
  'ghetto_house_dance_mania:electronicDance.footwork',
  'ghettotech_detroit:electronicDance.house',
  'dark_ambient_industrial:experimentalElec.industrialNoise',
  'witch_house_2010s:experimentalElec.idmGlitch',
  'glitch_2000s:experimentalElec.ambient',
  'modern_indie_rock_2010s:distortedRock.experimental',
  'math_rock_classic:distortedRock.metal.thrash',
  'post_hardcore_90s:distortedRock.punk',
  'emo_revival_2010s:distortedRock.alternative',
  'vapor_aesthetic:experimentalElec.idmGlitch',
  'hauntology_uk_2010s:experimentalElec.idmGlitch',
  'happy_hardcore:electronicDance.eurodance',
  'teen_pop_late_90s:functionalSong.eastAsianPop',
  'blackgaze:distortedRock.alternative',
  'post_punk_revival:distortedRock.classic',
  'spanish_nana:lullaby.middleEastern',
  'yiddish_vigndlid:lullaby.middleEastern',
  'greek_nanourisma:lullaby.middleEastern',
  'hindi_lori:lullaby.middleEastern',
  'greek_moirologi:funeralLament.middleEastern',
  'albanian_vajtim:funeralLament.middleEastern',
  'yiddish_wedding_bulgar:wedding.middleEastern',
  'roma_svatba_balkan:wedding.middleEastern',
  'greek_gamilio_glendi:wedding.middleEastern',
  'albanian_dasma:wedding.middleEastern',
  'persian_aroosi:wedding.european',
  'lebanese_arab_takht_wedding:wedding.european',
  'indian_sangeet:wedding.middleEastern',
  'chinese_xiqing_wedding:wedding.southAsian',
  'javanese_wedding_gamelan:wedding.southAsian',
  'yoruba_aso_ebi_wedding:wedding.southAsian',
  'andean_matrimonio_huayno:wedding.southAsian',
  'american_folk_revival_protest:protestSong.iberianLatin',
  'american_folk_revival_protest:protestSong.european',
  'chilean_nueva_cancion:protestSong.european',
  'argentine_canto_nuevo:protestSong.european',
  'italian_canti_partigiani:protestSong.angloAmerican',
  'portuguese_musica_de_intervencao:protestSong.iberianLatin',
  'south_african_freedom_song:protestSong.angloAmerican',
  'korean_minjung_gayo:protestSong.angloAmerican',
  'catalan_nova_canco:protestSong.iberianLatin',
  'algerian_rai_political:protestSong.european',
  'egyptian_sayyed_darwish_sheikh_imam:protestSong.european',
  'polish_sung_poetry_protest:protestSong.angloAmerican',
  'vietnamese_nhac_phan_chien:protestSong.angloAmerican',
  'american_political_hip_hop:protestSong.angloAmerican',
  'brazilian_mpb_protest:protestSong.european',
  'greek_entechno_politicized:protestSong.middleEastNAfrican',
  'irish_rebel_song:protestSong.angloAmerican',
  'zulu_izibongo:praiseSong.oceaniaPacific',
  'hindu_stuti_bhajan:praiseSong.middleEastNAfrican',
  'sikh_shabad_kirtan:praiseSong.middleEastNAfrican',
  'sufi_munajat_naat:praiseSong.indianSubcontinent',
  'welsh_moliannu_cerdd_dant:praiseSong.subSaharanAfrican',
  'maori_waiata_moteatea_patere:praiseSong.subSaharanAfrican',
  'arabic_madh_qasida:praiseSong.indianSubcontinent',
  'mande_jeli_praise:praiseSong.middleEastNAfrican',
  'english_nursery_rhyme:nurseryRhyme.americas',
  'french_comptines:nurseryRhyme.americas',
  'german_kinderlieder:nurseryRhyme.americas',
  'italian_filastrocche:nurseryRhyme.americas',
  'spanish_rondas:nurseryRhyme.european',
  'russian_poteshki:nurseryRhyme.americas',
  'romanian_cantece_pentru_copii:nurseryRhyme.middleEastNAfrican',
  'korean_dongyo:nurseryRhyme.european',
  'japanese_warabe_uta:nurseryRhyme.european',
  'mandarin_tongyao:nurseryRhyme.european',
  'hindi_nursery_rhyme:nurseryRhyme.european',
  'hindi_nursery_rhyme:nurseryRhyme.eastAsian',
  'tamil_children_song:nurseryRhyme.eastAsian',
  'tamil_children_song:nurseryRhyme.european',
  'bengali_chhotoder_chora:nurseryRhyme.european',
  'yoruba_omo_iya:nurseryRhyme.americas',
  'lebanese_egyptian_aghani_atfal:nurseryRhyme.southAsian',
  'lebanese_egyptian_aghani_atfal:nurseryRhyme.european',
  'american_handgame_clapping:nurseryRhyme.subSaharanAfrican',
  'mexican_rondas:nurseryRhyme.european',
  'brazilian_cantigas_de_roda:nurseryRhyme.european',
  'brazilian_cantigas_de_roda:nurseryRhyme.subSaharanAfrican',
  'german_trinklied:drinkingSong.americas',
  'irish_pub_song:drinkingSong.americas',
  'french_chansons_a_boire:drinkingSong.americas',
  'italian_canti_goliardici:drinkingSong.americas',
  'czech_pijacka:drinkingSong.balkan',
  'hungarian_bordal:drinkingSong.balkan',
  'polish_biesiadne:drinkingSong.balkan',
  'russian_zastolnaya:drinkingSong.balkan',
  'macedonian_kafana_drinking:drinkingSong.european',
  'georgian_supra_drinking:drinkingSong.european',
  'korean_jubu_ga:drinkingSong.european',
  'japanese_izakaya_enka:drinkingSong.european',
  'mexican_cantina_drinking:drinkingSong.european',
  'american_drinking_song:drinkingSong.european',
  'norwegian_skipperslatter:seaShanty.atlantic',
  'hebridean_iorram:seaShanty.atlantic',
  'trinidad_road_march:carnivalProcessional.brazilian',
  'brazilian_samba_school_enredo:carnivalProcessional.caribbean',
  'mardi_gras_indians:carnivalProcessional.caribbean',
  'new_orleans_brass_parade:carnivalProcessional.caribbean',
  'cologne_karneval:carnivalProcessional.americanSouth',
  'caribbean_junkanoo:carnivalProcessional.americanSouth',
  'caribbean_junkanoo:carnivalProcessional.brazilian',
  'bolivian_diablada_oruro:carnivalProcessional.european',
  'japanese_matsuri_taiko:carnivalProcessional.european',
  'venice_carnevale:carnivalProcessional.americanSouth',
  'caribbean_carnival_steelpan_panorama:carnivalProcessional.brazilian',
  'mississippi_delta_field_holler:fieldWork.subSaharanAfrican',
  'bulgarian_zhetvarski:fieldWork.eastAsian',
  'romanian_colinde_seceris:fieldWork.eastAsian',
  'hungarian_aratonota:fieldWork.eastAsian',
  'russian_zhnitvenye:fieldWork.eastAsian',
  'mande_wolof_harvest:fieldWork.americanSouth',
  'andean_huayno_trabajo:fieldWork.subSaharanAfrican',
  'chinese_chayang_diao:fieldWork.southAsian',
  'korean_nongak_field:fieldWork.southAsian',
  'vietnamese_ho:fieldWork.southAsian',
  'bengali_bhatiali:fieldWork.eastAsian',
  'japanese_taue_uta:fieldWork.southAsian',
  'indonesian_padi_planting:fieldWork.southAsian',
  'west_african_rice_planting:fieldWork.americanSouth',
  'baaka_hunting_polyphony:huntingSong.arctic',
  'san_bushman_hunting:huntingSong.arctic',
  'san_bushman_hunting:huntingSong.centralAsian',
  'mongolian_hunting_khoomei:huntingSong.arctic',
  'mongolian_hunting_khoomei:huntingSong.indigenous',
  'sami_yoik_tracking:huntingSong.centralAsian',
  'sami_yoik_tracking:huntingSong.indigenous',
  'aboriginal_australian_songlines:huntingSong.arctic',
  'aboriginal_australian_songlines:huntingSong.subSaharanAfrican',
  'apache_hunting_medicine:huntingSong.arctic',
  'apache_hunting_medicine:huntingSong.subSaharanAfrican',
  'hebridean_waulking:domesticRhythm.slavicBaltic',
  'irish_spinning_song:domesticRhythm.slavicBaltic',
  'sami_vuolle_domestic:domesticRhythm.celticHebridean',
  'romanian_cantece_de_tors:domesticRhythm.celticHebridean',
  'andean_quechua_spinning:domesticRhythm.subSaharanAfrican',
  'indian_jata_gita_grinding:domesticRhythm.subSaharanAfrican',
  'wolof_grain_grinding:domesticRhythm.southAsian',
  'korean_baennoraega:domesticRhythm.celticHebridean',
  'yiddish_spinning_domestic:domesticRhythm.celticHebridean',
  'sardinian_boci_de_tela:domesticRhythm.slavicBaltic',
  'faroese_kvaedi_domestic:domesticRhythm.celticHebridean',
  'japanese_domestic_hataori:domesticRhythm.celticHebridean',
]);

// ─────────────── 5. crossRef same top-level branch as parent (warning) ───────────────
if (shouldRun('parent_top_branch_overlap')) {
  for (const tid of Object.keys(C.TRADITION_EXTRAS)) {
    const e = C.TRADITION_EXTRAS[tid];
    if (!e.parent || !e.crossRefs) continue;
    const parentRoot = e.parent.split('.')[0];
    for (const cr of e.crossRefs) {
      const r = crossRefRef(cr);
      if (r === null) continue;
      if (r === e.parent) continue; // already caught by issue #1
      if (ACCEPTED_OVERLAPS.has(tid + ':' + r)) continue;
      if (r.split('.')[0] === parentRoot) {
        warnings.push({
          section: 'parent_top_branch_overlap',
          tid,
          detail: `crossRef '${r}' shares top-level branch with parent '${e.parent}' — verify this is intentional`,
        });
      }
    }
  }
}

// ─────────────── 6. Empty crossRefs (warning) ───────────────
if (shouldRun('empty_crossrefs')) {
  for (const tid of Object.keys(C.TRADITION_EXTRAS)) {
    const e = C.TRADITION_EXTRAS[tid];
    if (e.crossRefs && e.crossRefs.length === 0) {
      warnings.push({
        section: 'empty_crossrefs',
        tid,
        detail: 'crossRefs is empty — no graph connectivity beyond parent',
      });
    }
  }
}

// ─────────────── 7. Circular crossRef detection (opt-in only) ───────────────
// A crossRef path A→B's_parent combined with B→A's_parent creates a graph
// loop. In practice, the catalog deliberately encodes many cycles — Indian
// classical traditions cycle with Hindu devotional, Sufi sama with Persian-Arab
// improv, Brazilian afro-diasporic with Brazilian groove, etc. These are
// correct modeling of traditions that genuinely exist on multiple axes.
//
// Run only when explicitly requested via --section=circular_crossrefs since
// the default output is ~100 lines of mostly-defensible cycles. Useful for
// diagnostic spelunking, not for build-pipeline gating.
if (sectionsToRun && sectionsToRun.has('circular_crossrefs')) {
  // Build map: parent path → tradition ids that have that parent
  const tradsByParent = {};
  for (const tid of Object.keys(C.TRADITION_EXTRAS)) {
    const e = C.TRADITION_EXTRAS[tid];
    if (!e.parent) continue;
    if (!tradsByParent[e.parent]) tradsByParent[e.parent] = [];
    tradsByParent[e.parent].push(tid);
  }
  // For each tradition A, look at its crossRefs. For each crossRef X (which is a
  // tree-node path), look at all traditions B with parent=X. Check if B's
  // crossRefs contain A's parent. That's the cycle.
  const reported = new Set();
  for (const aId of Object.keys(C.TRADITION_EXTRAS)) {
    const aE = C.TRADITION_EXTRAS[aId];
    if (!aE.parent || !aE.crossRefs) continue;
    for (const aCrossRefRaw of aE.crossRefs) {
      const aCrossRef = crossRefRef(aCrossRefRaw);
      if (aCrossRef === null) continue;
      const peers = tradsByParent[aCrossRef] || [];
      for (const bId of peers) {
        if (bId === aId) continue;
        const bE = C.TRADITION_EXTRAS[bId];
        if (!bE.crossRefs) continue;
        // Normalize bE.crossRefs to plain ref strings for includes() check
        const bRefs = bE.crossRefs.map(crossRefRef).filter((r) => r !== null);
        if (bRefs.includes(aE.parent)) {
          // Cycle: A.parent ← B.crossRef AND B.parent ← A.crossRef
          const key = [aId, bId].sort().join('|');
          if (reported.has(key)) continue;
          reported.add(key);
          warnings.push({
            section: 'circular_crossrefs',
            tid: aId,
            detail: `cycle with '${bId}': ${aId}→${aCrossRef} (=${bId}'s parent) AND ${bId}→${aE.parent} (=${aId}'s parent)`,
          });
        }
      }
    }
  }
}

// ─────────────── 8. applies_to family-mismatch (error) ───────────────
// A family-part variant whose applies_to lists ONLY instruments outside its
// own family is unreachable — applies_to filtering happens after family-membership
// filtering. validate.js already catches this; replicate as audit signal so
// it's visible in non-fatal mode too. Distinct from validate's error level.
if (shouldRun('applies_to_family_mismatch')) {
  const familyMembers = {};
  for (const i of C.INSTRUMENTS) {
    if (!familyMembers[i.family]) familyMembers[i.family] = new Set();
    familyMembers[i.family].add(i.id);
  }
  const fp = C.INSTRUMENT_FAMILY_PARTS || {};
  for (const fam of Object.keys(fp)) {
    const members = familyMembers[fam] || new Set();
    for (const part of fp[fam]) {
      for (const v of part.variants || []) {
        if (!Array.isArray(v.applies_to)) continue;
        const inFamily = v.applies_to.filter((t) => members.has(t));
        const outOfFamily = v.applies_to.filter((t) => !members.has(t));
        if (inFamily.length === 0 && outOfFamily.length > 0) {
          errors.push({
            section: 'applies_to_family_mismatch',
            location: `family_parts.${fam}.${v.id}`,
            detail: `applies_to has only out-of-family targets: ${outOfFamily.join(', ')} — variant unreachable`,
          });
        } else if (outOfFamily.length > 0) {
          warnings.push({
            section: 'applies_to_family_mismatch',
            location: `family_parts.${fam}.${v.id}`,
            detail: `applies_to includes out-of-family targets (will be silently filtered): ${outOfFamily.join(', ')}`,
          });
        }
      }
    }
  }
}

// ─────────────── 9. Family-parts coverage gaps (warning) ───────────────
// For each instrument family that has family-parts defined, check for
// instruments in that family that aren't actually receiving any merged
// family-part variants. A real gap usually means either the instrument's
// own parts override every family part by id, or the merge logic isn't
// firing for that instrument. Either way, worth surfacing.

// ─── ACCEPTED_FAMILY_OVERRIDES — instruments deliberately overriding family parts by id ───
const ACCEPTED_FAMILY_OVERRIDES = new Set([
  'concert_harp',
  'dan_bau',
  'mbira',
  'agogo',
  'atabaque',
  'balafon',
  'bata',
  'bendir',
  'berimbau',
  'bodhran',
  'bombo_andino',
  'bonang',
  'buk_korean',
  'sabar',
  'castanets',
  'caxixi',
  'claves',
  'daf',
  'dholak',
  'dunun',
  'frottoir',
  'jug_inst',
  'tea_chest_bass',
  'kazoo',
  'ranat_ek',
  'khong_wong_yai',
  'pi_nai',
  'taphon',
  'gender',
  'ghatam',
  'guiro',
  'hammered_dulcimer',
  'handpan',
  'janggu',
  'kkwaenggwari',
  'jing_korean',
  'kanjira',
  'kulintang_set',
  'maracas',
  'mridangam',
  'pakhawaj',
  'qarqaba',
  'riq',
  'shekere',
  'steelpan',
  'surdo',
  'tabla',
  'taiko_drums',
  'talking_drum',
  'tamborim',
  'tambourine_orch',
  'thavil',
  'tombak',
  'drum_machine_analog',
  'linndrum',
  'log_drum',
  'talkbox',
  'drum_machine_606',
  'drum_machine_808',
  'drum_machine_909',
  'drum_machine_707',
  'vocoder',
  // Ethiopian and Horn-of-Africa traditional
  'inverted_calabash',
  'krar',
  'washint',
  'kebero',
  'tbel',
  // Caribbean traditional
  'trinidadian_iron',
  'tassa_drum',
  'tambora_dominicana',
  // Brazilian / Cape Verdean
  'cape_verdean_cavaquinho',
  'bandolim',
  'violao_7_cordas',
  'alfaia',
  'zabumba',
  'triangulo_forro',
  'reco_reco',
  'ganza',
  'afoxe',
  'repinique',
  // East Asian regional
  'daegeum',
  'piri',
  'taiko_drum',
  'yangqin',
  'kendang_indonesian',
  'saron_gamelan',
  'slenthem',
  'kenong',
  // Tibetan / Mongolian
  'tibetan_dungchen',
  'tibetan_gyaling',
  'tovshuur',
  // Afro-Cuban
  'bata_drums',
  // Mexican / Latin American
  'guitarron_mexicano',
  'arpa_jarocha',
  'arpa_llanera',
  'caja_vallenata',
  'acordeon_vallenato',
  'guacharaca',
  'siku_panpipes',
  'cajon_peruano',
  // Western specialty
  'acoustic_guitar_12_string',
  'resonator_guitar',
  'flamenco_guitar',
  'guitarra_portuguesa',
  'scottish_smallpipes',
  'cajun_accordion',
  'cimbalom',
  // South Asian classical
  'shehnai',
  'nadaswaram',
  // ─── Auto-added 43 instrument-specific override-by-id cases (intentional curation) ───
  'dutar',
  'komuz',
  'roneat_ek',
  'roneat_thung',
  'sralai',
  'sampho',
  'skor_thom',
  'kong_vong_thom',
  'koauau',
  'putorino',
  'pahu',
  'ipu_heke',
  'kultrun',
  'dung_chen',
  'gaval',
  'dan_day',
  'chapei_lute',
  'qanbus',
  'viola_machete',
  'begena',
  'uhadi',
  'tende_drum',
  'naqqarat',
  'nafa',
  'dumbek',
  'riqq',
  'damaru',
  'tsenatsil',
  'sanj',
  'muthallath',
  'sisera',
  'pulili',
  'shacapa',
  'khartal',
  'zeze',
  'rolmo',
  'rgya_gling',
  'sopele',
  'gajda',
  'putatara',
  'kankles',
  'skuduciai',
  'phach',
  'trong_chau',
  // ─── Auto-added 43 instruments from systematic override-by-id review ───
  'dutar',
  'komuz',
  'roneat_ek',
  'roneat_thung',
  'sralai',
  'sampho',
  'skor_thom',
  'kong_vong_thom',
  'koauau',
  'putorino',
  'pahu',
  'ipu_heke',
  'kultrun',
  'dung_chen',
  'gaval',
  'dan_day',
  'chapei_lute',
  'qanbus',
  'viola_machete',
  'begena',
  'uhadi',
  'tende_drum',
  'naqqarat',
  'nafa',
  'dumbek',
  'riqq',
  'damaru',
  'tsenatsil',
  'sanj',
  'muthallath',
  'sisera',
  'pulili',
  'shacapa',
  'khartal',
  'zeze',
  'rolmo',
  'rgya_gling',
  'sopele',
  'gajda',
  'putatara',
  'kankles',
  'skuduciai',
  'phach',
  'trong_chau',
]);

if (shouldRun('family_parts_coverage')) {
  const fp = C.INSTRUMENT_FAMILY_PARTS || {};
  for (const inst of C.INSTRUMENTS) {
    const familyDef = fp[inst.family];
    if (!familyDef || familyDef.length === 0) continue; // family has no shared parts
    // Did any of inst's parts come from family inheritance?
    const hasFamilyParts = (inst.parts || []).some((p) => p._fromFamily);
    if (!hasFamilyParts) {
      if (ACCEPTED_FAMILY_OVERRIDES.has(inst.id)) continue;
      warnings.push({
        section: 'family_parts_coverage',
        location: `instruments.${inst.id}`,
        detail: `instrument is in family '${inst.family}' (which has ${familyDef.length} shared part(s)) but inherits NONE — verify the override-by-id is intentional`,
      });
    }
  }
}

// ─────────────── 10. Bare-genre descriptors (no -canonical suffix) ───────────────
// The catalog convention is that genre identifiers used as scoring hints carry
// a `-canonical` suffix (e.g., `country-canonical`, `jazz-canonical`). When a
// bare genre token (e.g., `country` or `jazz`) appears as a descriptor without
// the suffix, it would surface in output as if it were a character/iconic
// descriptor — which reads as a genre leak. Almost always an authoring mistake.
// ─────────────── 11. Catalog coverage gaps ───────────────
// Surfaces resources that exist in the catalog but no tradition references them.
// Useful for spotting authoring gaps where a resource was added but never
// connected to a tradition. Kept advisory because some unused resources are
// legitimate alternates (specialty rooms a user can manually pick from the menu),
// but unused ASTHETICS are almost always real gaps since the system only fires
// when a tradition references one.
if (shouldRun('coverage_gaps')) {
  // Build sets of referenced resources
  const usedAesthetics = new Set();
  const usedRooms = new Set();
  const usedArchetypes = new Set();
  const usedInstruments = new Set();
  for (const t of C.TRADITIONS) {
    if (t.room) usedRooms.add(t.room);
    if (t.chain_archetype) usedArchetypes.add(t.chain_archetype);
    if (t.production_aesthetic) {
      const arr = Array.isArray(t.production_aesthetic)
        ? t.production_aesthetic
        : [t.production_aesthetic];
      for (const a of arr) usedAesthetics.add(a);
    }
    for (const i of t.instruments || []) usedInstruments.add(i);
  }
  // Aesthetics: every aesthetic should be referenced by ≥1 tradition (high-signal — system only fires on reference)
  for (const aesthetic of C.PRODUCTION_AESTHETICS || []) {
    if (!usedAesthetics.has(aesthetic.id)) {
      warnings.push({
        section: 'coverage_gaps',
        location: `aesthetics.${aesthetic.id}`,
        detail: `aesthetic '${aesthetic.id}' (${aesthetic.name}) is referenced by no tradition — system is dormant`,
      });
    }
  }
  // Archetypes: every archetype should be referenced by ≥1 tradition
  for (const arch of C.CHAIN_ARCHETYPES || []) {
    if (!usedArchetypes.has(arch.id)) {
      warnings.push({
        section: 'coverage_gaps',
        location: `archetypes.${arch.id}`,
        detail: `archetype '${arch.id}' (${arch.name}) is referenced by no tradition — orphaned`,
      });
    }
  }
}

if (shouldRun('bare_genre_descriptors')) {
  // True genre-identifier tokens — words that only mean a genre (not a period
  // or aesthetic). When used as a descriptor without `-canonical`, they surface
  // as if they were iconic identifiers and read as a genre leak. The audit's
  // signal needs to be sharper than translate.js's BARE_GENRE_TOKENS (which
  // includes period words like 'modern', 'classical', 'twentieth-century'
  // that are correctly filtered as score-hints by the engine and aren't
  // authoring mistakes).
  const TRUE_GENRE_TOKENS = new Set([
    'afrobeat',
    'funk',
    'jazz',
    'rock',
    'punk',
    'metal',
    'soul',
    'motown',
    'reggae',
    'dub',
    'fusion',
    'gospel',
    'country',
    'hip-hop',
    'electronic',
    'shoegaze',
    'post-punk',
    'doom',
    'noise',
    'disco',
    'bossa',
    'flamenco',
    'surf',
    'bebop',
    'swing',
    'western-swing',
    'blues',
    'r&b',
    'rnb',
    'ska',
    'rocksteady',
    'mariachi',
    'dixieland',
    'cool-jazz',
    'free-jazz',
    'blues-rock',
  ]);
  const checkVariant = (location, descriptors, canonical_tags) => {
    for (const d of descriptors || []) {
      const lc = String(d).toLowerCase();
      // Bare genre tokens in `descriptors` only contribute a weak token-overlap.
      // The canonical-bonus path (overlap + 1.5× boost) requires the same token
      // to appear in `canonical_tags`. Flag bare genre tokens that aren't also
      // present in canonical_tags — they're almost certainly intended as canonical
      // claims and the boost was lost.
      if (TRUE_GENRE_TOKENS.has(lc)) {
        const inCanonical = (canonical_tags || []).map((c) => String(c).toLowerCase()).includes(lc);
        if (!inCanonical) {
          warnings.push({
            section: 'bare_genre_descriptors',
            location,
            detail: `bare genre token '${d}' in descriptors — should likely be in canonical_tags`,
          });
        }
      }
    }
  };
  // Family-parts
  const fp = C.INSTRUMENT_FAMILY_PARTS || {};
  for (const fam of Object.keys(fp)) {
    for (const part of fp[fam]) {
      for (const v of part.variants || []) {
        checkVariant(`family_parts.${fam}.${v.id}`, v.descriptors, v.canonical_tags);
      }
    }
  }
  // Chain
  for (const sec of C.CHAIN_SECTIONS) {
    for (const it of sec.items || []) {
      checkVariant(`chain.${sec.id}.${it.id}`, it.descriptors, it.canonical_tags);
    }
  }
  // Instruments (own parts only)
  for (const inst of C.INSTRUMENTS) {
    for (const part of inst._ownParts || []) {
      for (const v of part.variants || []) {
        checkVariant(`instruments.${inst.id}.${part.id}.${v.id}`, v.descriptors, v.canonical_tags);
      }
    }
  }
}

// ─────────────── 12. Unsurfaceable variants ───────────────
// A variant is "unsurfaceable" if NONE of its descriptors can ever surface in
// recipe output. A descriptor surfaces if any one of:
//   (a) it shares a token with the variant id (iconic match)
//   (b) it's in the trusted-technique whitelist (technique-vocabulary bypass)
//   (c) at least one of its tokens appears in some tradition's context tokens
// If every descriptor fails all three checks, the variant exists for scoring
// but contributes NOTHING to surface output — it's a "ghost variant" that can
// be picked but never shown. Usually means descriptors are misaligned with
// the actual catalog vocabulary.
if (shouldRun('unsurfaceable_variants')) {
  // Read trusted-technique whitelist from translate.js
  const fs = require('fs');
  const path = require('path');
  const translateSrc = fs.readFileSync(path.join(__dirname, 'translate.js'), 'utf8');
  const wlStart = translateSrc.indexOf('TRUSTED_TECHNIQUE_DESCRIPTORS = new Set([');
  const wlEnd = translateSrc.indexOf(']);', wlStart);
  const wlBlock = translateSrc.slice(wlStart, wlEnd).replace(/\/\/.*$/gm, '');
  const trustedTechs = new Set([...wlBlock.matchAll(/'([^']+)'/g)].map((m) => m[1].toLowerCase()));
  // Build all-tradition-context tokens
  const ctxTokens = harvestContextTokens();

  const checkVariant = (location, variantId, descriptors) => {
    if (!descriptors || descriptors.length === 0) return;
    const idTokens = new Set(String(variantId).toLowerCase().split('_'));
    for (const d of descriptors) {
      const lc = String(d)
        .toLowerCase()
        .replace(/-canonical$/, '');
      // Check (a): shares token with variant id
      const dTokens = lc.split(/[-\s]/);
      if (dTokens.some((t) => idTokens.has(t))) return; // surfaceable
      // Check (b): in trusted-technique whitelist
      if (trustedTechs.has(lc)) return;
      // Check (c): at least one token in tradition context
      if (dTokens.some((t) => ctxTokens.has(t))) return;
    }
    // None of the descriptors can surface
    warnings.push({
      section: 'unsurfaceable_variants',
      location,
      detail: `no descriptor can surface (none iconic, none whitelisted, none in any tradition context): ${descriptors.join(', ')}`,
    });
  };
  // Family-parts
  const fp = C.INSTRUMENT_FAMILY_PARTS || {};
  for (const fam of Object.keys(fp)) {
    for (const part of fp[fam]) {
      for (const v of part.variants || []) {
        checkVariant(`family_parts.${fam}.${v.id}`, v.id, v.descriptors);
      }
    }
  }
  // Instruments
  for (const inst of C.INSTRUMENTS) {
    for (const part of inst._ownParts || []) {
      if (part.surface === false) continue;
      for (const v of part.variants || []) {
        checkVariant(`instruments.${inst.id}.${part.id}.${v.id}`, v.id, v.descriptors);
      }
    }
  }
}

// ─────────────── 13. Descriptor redundancy across siblings ───────────────
// Within a single part, if a descriptor appears in 50%+ of the variants, it's
// not distinguishing them — it's noise. Doesn't help users tell variants apart,
// doesn't help scoring (every variant scores the same on that descriptor).
// Suggests reflexive copy-paste authoring rather than thinking about what makes
// each variant distinctive.
if (shouldRun('redundant_descriptors_in_part')) {
  const checkPart = (locPrefix, part) => {
    const variants = part.variants || [];
    if (variants.length < 3) return; // need at least 3 to call something redundant
    const counts = {};
    for (const v of variants) {
      const seen = new Set(); // count each descriptor once per variant
      for (const d of v.descriptors || []) {
        const lc = String(d)
          .toLowerCase()
          .replace(/-canonical$/, '');
        if (seen.has(lc)) continue;
        seen.add(lc);
        counts[lc] = (counts[lc] || 0) + 1;
      }
    }
    const threshold = Math.ceil(variants.length / 2);
    for (const [d, n] of Object.entries(counts)) {
      if (n >= threshold && n >= 3) {
        warnings.push({
          section: 'redundant_descriptors_in_part',
          location: `${locPrefix}.${part.id}`,
          detail: `descriptor '${d}' appears in ${n}/${variants.length} variants — not distinguishing`,
        });
      }
    }
  };
  // Family-parts
  const fp = C.INSTRUMENT_FAMILY_PARTS || {};
  for (const fam of Object.keys(fp)) {
    for (const part of fp[fam]) {
      checkPart(`family_parts.${fam}`, part);
    }
  }
  // Instruments
  for (const inst of C.INSTRUMENTS) {
    for (const part of inst._ownParts || []) {
      // Skip parts explicitly marked as non-surfacing — their descriptors
      // document role/character for humans and aren't expected to differentiate
      // for surfacing purposes.
      if (part.surface === false) continue;
      checkPart(`instruments.${inst.id}`, part);
    }
  }
}

// ─────────────── 14. Description-instrument mismatch ───────────────
// Catches authoring drift between tradition.description prose and the
// tradition.instruments[] array. Heuristic matches on instrument-id tokens
// (more distinctive than name tokens) and requires uniqueness + length filters.
// Default-on; signal-to-noise tuned by limiting to id-derived distinctive tokens.
//
// Heuristic:
// - Token derived from instrument.id (split on _), filtered to length ≥5
// - Skip tokens that are also common English words or generic music vocabulary
// - Token must uniquely identify exactly one instrument
// - Whole-word match in description (no substrings)
if (shouldRun('description_instrument_mismatch')) {
  const STOPLIST = new Set([
    'voice',
    'piano',
    'organ',
    'guitar',
    'bass',
    'drum',
    'drums',
    'horn',
    'string',
    'strings',
    'pipe',
    'flute',
    'lute',
    'pad',
    'kit',
    'chord',
    'vocal',
    'vocals',
    'harmony',
    'melody',
    'chorus',
    'rhythm',
    'drone',
    'ensemble',
    'orchestra',
    'band',
    'choir',
    'singing',
    'singer',
    'concert',
    'classical',
    'electric',
    'acoustic',
    'open',
    'standard',
    'modern',
    'traditional',
    'folk',
    'jazz',
    'rock',
    'pop',
    'blues',
    'gospel',
    'country',
    'world',
    'opera',
    'sacred',
    'small',
    'large',
    'high',
    'low',
    'fast',
    'slow',
    'long',
    'short',
    'bright',
    'dark',
    'warm',
    'cold',
    'central',
    'south',
    'north',
    'east',
    'west',
    'machine',
    'great',
    'combo',
    'three',
    'four',
    'five',
    'twelve',
    'sustain',
    'extended',
    'paired',
    'multi',
    'double',
    'single',
    'spike',
    'based',
    'scale',
    'digital',
    'chromatic',
    'sample',
    'samples',
    'sampled',
    'tube',
    'analog',
    'sustained',
    'irish',
    'mexican',
    'indian',
    'persian',
    'arabic',
    'korean',
    'chinese',
    'japanese',
    'african',
    'cuban',
    'spanish',
    'italian',
    'french',
    'german',
    'russian',
    'eastern',
    'western',
    'northern',
    'southern',
    'american',
    'british',
    'european',
    'andean',
    'celtic',
    'balkan',
    'arab',
    'turkish',
    'greek',
    'persian',
    'archtop',
    'orchestral',
    'parlor',
    'romani',
    'pentecostal',
    'orthodox',
    'baritone',
    'fretless',
    'tambourine',
    'congregation',
    'family',
    'school',
    'anglo',
    'highland',
    'circle',
    'classic',
    'hollow',
    'mouth',
    'gongs',
    'talking',
    'shape',
    'frame',
    'pedal',
    'black',
    'orleans',
    'samba',
    'carnatic',
    'diatonic',
    'wedding',
    'sheng',
    'mountain',
    'resonator',
    'xylophone',
    'gaita',
    // Tradition-name tokens that show up as comparative/contrast vocabulary,
    // not as instrument references (e.g. "Distinguished from mariachi", "neighboring gypsy-music"):
    'mariachi',
    'gypsy',
    // Proper-noun band-name tokens that survive lowercasing and create false matches
    // (e.g. "Cathedral Quartet" in southern_gospel exemplars, "Mother Father Sister Brother"
    // in philly_soul_intl, "Hawaiian Renaissance" cultural-revival period in hawaiian_slack_key):
    'cathedral',
    'brother',
    'renaissance',
    // Words used in context other than instrument references:
    // - 'dread' as existential dread, not acoustic_guitar_dread
    // - 'griot' as tradition reference (Tuareg-not-mande), not griot_voice
    // - 'colombiana' as tradition name "cumbia colombiana", not gaita_colombiana
    // - 'hammered' as adjective ("hammered bronze"), not hammered_dulcimer
    // - 'javanese' as regional comparison reference, not gamelan_javanese_full
    // - 'keyboard' as generic-keyboard family, not tape_replay_keyboard
    // - 'biniou' as comparison reference ("Breton biniou koz"), not adopted instrument
    // - 'takht' as ensemble grouping description, not takht_arab as instrument
    // - 'marimba' as comparison ("marimba-like log-drum"), not marimba_orchestral
    'dread',
    'griot',
    'colombiana',
    'hammered',
    'javanese',
    'keyboard',
    'biniou',
    'takht',
    'marimba',
    // Further descriptor-context tokens added during Layer 3 description sweep:
    // - 'throat' as guttural-throat-resonance technique (sardinian_polyphony) not throat_singing_voice
    // - 'nylon' as string-material descriptor (koto) not classical_nylon_string_guitar
    // - 'balinese' as regional-comparison reference (javanese_gamelan distinguishing from Balinese)
    // - 'pipes' as bamboo-pipes-free-reed (mor_lam khaen) not uilleann_pipes
    // - 'jarocho' as son-jarocho-region reference (mariachi_traditional, joropo)
    'throat',
    'nylon',
    'balinese',
    'pipes',
    'jarocho',
    // From layer-3 final-batch:
    // - 'quintet' as ensemble-comparison (string_quartet reference to string-quintet) not gypsy_jazz_quintet
    // - 'guzheng' as instrument-comparison (guqin distinguished from guzheng) not direct guzheng usage
    // - 'cubano' as son-cubano-tradition comparison (son_jarocho distinguished from son cubano) not tres_cubano
    // - 'nyckelharpa' as hardanger-fiddle comparison (folk_metal_european legitimately uses it but is now in instruments[])
    'quintet',
    'guzheng',
    'cubano',
    'nyckelharpa',
    // 'portuguese' as language/nationality token in descriptions
    // (Portuguese-language vocal performance, Portuguese trader influence, etc.) —
    // not portuguese_guitar identifier
    'portuguese',
    // Tokens that overwhelmingly appear in non-instrument context:
    // - 'chest' as chest-voice / chest-resonance vocal technique, not tea_chest_bass
    // - 'grand' as in band names (Grand Funk) / generic grand-scale, not grand_piano
    // - 'replay' as in tape-replay technique / overdub-and-replay action, not tape_replay_keyboard
    // - 'gender' as gender-fluid social construct, not the Balinese gender instrument
    // - 'rudra' as Rudra Dhrupad branch lineage reference, not rudra_veena
    // - 'gaida' as Galician bagpipe (different instrument) — distinct from gaida_bulgarian
    // - 'taiko' as generic Japanese drumming reference
    // - 'barbershop' as barbershop quartet GENRE reference, not the choir instrument
    // - 'monosynth' as generic monosynth (synthesizer type)
    // - 'bateria' as samba bateria genre reference
    'chest',
    'grand',
    'replay',
    'gender',
    'rudra',
    'gaida',
    'taiko',
    'barbershop',
    'monosynth',
    'bateria',
    // Words appearing in many tradition descriptions as common English referring to drum-section
    // or vocal/instrumental stack — these tokens are too generic to uniquely identify the
    // vocal_percussion_voice and multitrack_vocal_stack entries:
    'percussion',
    'stack',
    'multitrack',
    // Regional adjectives that match instrument IDs by coincidence — they identify the region
    // in the description (a contrastive or genealogical reference), not the specific instrument:
    // - 'scottish' as Scottish-musical-tradition (in Irish/Galician/Breton/Norwegian comparisons), not scottish_smallpipes
    // - 'flamenco' as flamenco-tradition reference (in mariachi/fado/spanish_cancion_pop), not flamenco_guitar
    // - 'verdean' as Cape-Verdean reference in fado/kizomba contexts, not cape_verdean_cavaquinho
    // - 'trinidadian' as Trinidadian-context reference in calypso/soca/kompa/mento/parang descriptions
    // - 'indonesian' as Indonesian-region reference in thai_classical/dangdut/kulintang/athan, not kendang_indonesian
    // - 'cajun' as Cajun-region reference in zydeco context, not cajun_accordion specifically
    // - 'tambora' as generic-tambora-drum reference (cumbia uses tambora-de-cumbia), not tambora_dominicana
    // - 'capoeira' as capoeira-tradition reference (capoeira_music is the tradition itself), not capoeira_roda
    'scottish',
    'flamenco',
    'verdean',
    'trinidadian',
    'indonesian',
    'cajun',
    'tambora',
    'capoeira',
  ]);
  // Negated-context filter: a token preceded by "not-", "no-", "without ",
  // "absence of", "rather than ", "instead of " is being explicitly excluded
  // from the ensemble, not asserted in it. Skip these matches.
  // Example: "small-combo-with-horns-not-harmonica" should NOT flag harmonica.
  function isNegatedContext(descLC, token) {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const negPatterns = [
      // Lists after explicit negation: "NOT X / Y / Z / W" — token may appear later in the slash-separated list
      `\\bnot\\s+[\\w\\s/-]*?/\\s*${escaped}\\b`,
      `\\bnot\\b[^.]{0,80}\\b${escaped}\\b[^.]{0,40}\\bbelonging\\b`,
      `\\bnot[- ]${escaped}\\b`,
      // Hyphen-compound negation: "not-X-and-${token}" or "not-${token}-and-X" or "X-not-Y-and-${token}"
      // Example: "jarana-not-violin-and-trumpet" should negate 'trumpet'
      `\\bnot[-\\s][\\w-]+(?:-and-|-or-)${escaped}\\b`,
      `\\bnot[-\\s]${escaped}(?:-and-|-or-)[\\w-]+\\b`,
      `\\bno[- ]${escaped}\\b`,
      `\\bwithout\\s+(?:\\w+\\s+){0,3}${escaped}\\b`,
      // Absence-of with hyphenated compound: "absence of palmas-and-${token}" or "absence of ${token}-and-X"
      `\\babsence\\s+of\\s+[\\w-]+(?:-and-|-or-)${escaped}\\b`,
      `\\babsence\\s+of\\s+(?:\\w+\\s+){0,3}${escaped}\\b`,
      `\\brather\\s+than\\s+(?:\\w+\\s+){0,3}${escaped}\\b`,
      `\\binstead\\s+of\\s+(?:\\w+\\s+){0,3}${escaped}\\b`,
    ];
    for (const p of negPatterns) {
      if (new RegExp(p).test(descLC)) return true;
    }
    return false;
  }
  // Build token → instrument-id index from ID tokens only
  const tokenIndex = new Map();
  for (const inst of C.INSTRUMENTS) {
    const idTokens = inst.id
      .toLowerCase()
      .split('_')
      .filter((t) => t.length >= 5 && !STOPLIST.has(t));
    for (const t of idTokens) {
      if (!tokenIndex.has(t)) tokenIndex.set(t, new Set());
      tokenIndex.get(t).add(inst.id);
    }
  }
  // Keep only UNIQUE tokens
  const uniqueTokens = new Map();
  for (const [t, ids] of tokenIndex) {
    if (ids.size === 1) uniqueTokens.set(t, [...ids][0]);
  }
  for (const tid of Object.keys(C.TRADITION_EXTRAS)) {
    const e = C.TRADITION_EXTRAS[tid];
    const t = C.TRADITIONS.find((x) => x.id === tid);
    if (!t || !e.description) continue;
    const declared = new Set(t.instruments || []);
    const descLC = e.description.toLowerCase();
    const flagged = new Set();
    for (const [token, instId] of uniqueTokens) {
      if (declared.has(instId)) continue;
      if (flagged.has(instId)) continue;
      const re = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
      if (!re.test(descLC)) continue;
      if (isNegatedContext(descLC, token)) continue;
      flagged.add(instId);
      warnings.push({
        section: 'description_instrument_mismatch',
        location: `tradition.${tid}`,
        tid,
        detail: `description mentions '${token}' (uniquely identifies ${instId}) but tradition.instruments[] does not include it`,
      });
    }
  }
}

// ─────────────── 15. No iconic descriptor (warning, opt-in) ───────────────
// A variant has an "iconic" descriptor when one of its descriptor tokens shares
// a stem with its variant id or name. Iconic descriptors get surface priority
// in translate.js — they're the variant's identity word in recipe output.
//
// In practice this check fires on ~1500 variants because most variants name
// their identity in the variant.name field rather than embedding identifying
// tokens in descriptor strings. The check doesn't catch real bugs — it
// catches an authoring style choice. Opt-in only via --section=no_iconic_descriptor.
if (sectionsToRun && sectionsToRun.has('no_iconic_descriptor')) {
  const checkVariant = (location, variantId, variantName, descriptors) => {
    if (!descriptors || descriptors.length === 0) return;
    const idTokens = new Set(String(variantId).toLowerCase().split('_'));
    const nameTokens = new Set(
      String(variantName || '')
        .toLowerCase()
        .split(/\W+/)
        .filter(Boolean)
    );
    for (const d of descriptors) {
      const lc = String(d)
        .toLowerCase()
        .replace(/-canonical$/, '');
      const dTokens = lc.split(/[-\s]/);
      if (dTokens.some((t) => idTokens.has(t) || nameTokens.has(t))) return; // has iconic
    }
    warnings.push({
      section: 'no_iconic_descriptor',
      location,
      detail: `no descriptor shares a token with variant id '${variantId}' or name '${variantName}' — variant has no iconic surface`,
    });
  };
  for (const inst of C.INSTRUMENTS) {
    // Voice and voice-derived instruments use translate.js sentence 2's permissive
    // path which takes the first non-default non-score-hint descriptor — they don't
    // need iconic descriptors at all. Skipping these saves ~1100 of the 1474
    // false-positive warnings (Layer 9A architectural fix).
    const isVoiceLineage =
      inst.id === 'voice' ||
      inst.id.endsWith('_voice') ||
      inst.id === 'choir_ensemble' ||
      inst.id === 'choir_doo_wop_group' ||
      inst.id === 'choir_brother_duet' ||
      inst.id === 'mariachi_full' ||
      inst.id === 'griot_voice' ||
      inst.id === 'pansori_voice' ||
      inst.id === 'qawwal_voice' ||
      inst.id === 'shape_note_voice' ||
      inst.id === 'throat_singing_voice';
    if (isVoiceLineage) continue;
    for (const part of inst._ownParts || []) {
      // Skip parts explicitly marked as non-surfacing (construction details)
      if (part.surface === false) continue;
      // Skip metadata-style parts whose suffix indicates context-not-iconic role.
      // These parts ARE allowed to surface (they're how the engine picks era/region/
      // school context) but their variants are conventionally named for the context
      // value they encode (e.g. "kakaki_court" for court-context kakaki) rather than
      // for an iconic-musical-quality, so the iconic-descriptor check is misapplied.
      const partId = String(part.id || '');
      const isMetadataPart =
        /_(context|repertoire|origin|role|region|school|size|era|use|amplification|orientation|position|scale_length|tuning_choice)$/.test(
          partId
        ) ||
        partId === 'voice_register' ||
        partId === 'voice_quality' ||
        partId === 'voice_vibrato' ||
        partId === 'voice_articulation' ||
        partId === 'voice_microtone' ||
        partId === 'members' ||
        partId === 'voicing' ||
        partId === 'arrangement';
      if (isMetadataPart) continue;
      for (const v of part.variants || []) {
        checkVariant(`instruments.${inst.id}.${part.id}.${v.id}`, v.id, v.name, v.descriptors);
      }
    }
  }
}

// ─────────────── 16. Duplicate axes signatures (advisory) ───────────────
// to the search engine on axis-vector queries. Often defensible — sibling
// traditions like mandopop/cantopop genuinely occupy the same axis cell,
// and the 13-axis vocabulary isn't fine-grained enough to force false
// distinctions. Listed advisory so authors can decide case-by-case whether
// to differentiate.
if (shouldRun('duplicate_axes_signature')) {
  const AXIS_KEYS = [
    'harm',
    'pitch',
    'ornament',
    'meter',
    'density',
    'transmission',
    'improv',
    'soundTech',
    'intensity',
    'voice',
    'timbre',
    'percussion',
    'cyclicity',
  ];
  const axesSig = new Map();
  for (const tid of Object.keys(C.TRADITION_EXTRAS || {})) {
    const ax = (C.TRADITION_EXTRAS[tid] || {}).axes || {};
    const sig = AXIS_KEYS.map((k) => ax[k]).join(',');
    if (sig.includes('undefined') || sig === ',,,,,,,,,,,,') continue;
    if (axesSig.has(sig)) {
      warnings.push({
        section: 'duplicate_axes_signature',
        location: `tradition.${tid}`,
        tid,
        detail: `same 13-axis signature as tradition.${axesSig.get(sig)}`,
      });
    } else {
      axesSig.set(sig, tid);
    }
  }
}

// ─────────────── 17. Variant score below threshold ───────────────
// Flags traditions where a part's winning variant scored at-or-near zero —
// signal that the catalog has no fitting variant for that combination so
// the engine fell back to default. Default threshold 0.1; tune via
// --variant-threshold=N. Opt-in via --section because expensive (re-scores
// every tradition).
if (sectionsToRun && sectionsToRun.has('variant_score_below_threshold')) {
  const { seedFromTradition } = require('./search.js');
  const THRESHOLD = parseFloat(flags['variant-threshold']) || 0.1;
  for (const t of C.TRADITIONS) {
    const seed = seedFromTradition(t.id);
    if (!seed) continue;
    for (const inst of seed.instruments || []) {
      const cataInst = C.INSTRUMENTS.find((i) => i.id === inst.id);
      if (!cataInst) continue;
      for (const part of cataInst.parts || []) {
        if (part.surface === false) continue;
        const variantId = (inst.slots || {})[part.id];
        if (!variantId) continue;
        const score = (inst.scores || {})[part.id];
        if (score === undefined) continue;
        if (score < THRESHOLD) {
          warnings.push({
            section: 'variant_score_below_threshold',
            location: `tradition.${t.id}.${inst.id}.${part.id}`,
            tid: t.id,
            detail: `winning variant '${variantId}' scored ${score.toFixed(2)} (below ${THRESHOLD}) — catalog may lack a fitting variant for this part`,
          });
        }
      }
    }
  }
}

// ─────────────── 18. Runtime coverage gaps ───────────────
// Catches when a tradition references an aesthetic/archetype but hill-climbing
// search swaps it out for an era-compatible alternative, leaving the entity
// dormant. Field-based coverage_gaps misses this because the entity IS referenced
// in the field; runtime check verifies the entity actually appears in the final
// config. Opt-in via --section because it re-runs search for every tradition.
if (sectionsToRun && sectionsToRun.has('coverage_gaps_runtime')) {
  const { search, seedFromTradition } = require('./search.js');
  const aestheticRefs = new Map();
  const archetypeRefs = new Map();
  for (const t of C.TRADITIONS) {
    if (t.production_aesthetic) {
      const arr = Array.isArray(t.production_aesthetic)
        ? t.production_aesthetic
        : [t.production_aesthetic];
      for (const a of arr) {
        if (!aestheticRefs.has(a)) aestheticRefs.set(a, []);
        aestheticRefs.get(a).push(t.id);
      }
    }
    if (t.chain_archetype) {
      if (!archetypeRefs.has(t.chain_archetype)) archetypeRefs.set(t.chain_archetype, []);
      archetypeRefs.get(t.chain_archetype).push(t.id);
    }
  }
  for (const [aId, tids] of aestheticRefs) {
    let runtimeAlive = false;
    for (const tid of tids) {
      const seed = seedFromTradition(tid);
      if (!seed) continue;
      const result = search(seed, { maxIters: 30, useNeighbors: true });
      if (result && result.config && result.config.aesthetic === aId) {
        runtimeAlive = true;
        break;
      }
    }
    if (!runtimeAlive) {
      warnings.push({
        section: 'coverage_gaps_runtime',
        location: `aesthetics.${aId}`,
        detail: `aesthetic '${aId}' field-referenced by ${tids.length} tradition(s) but runtime swaps it out — orphan-at-runtime`,
      });
    }
  }
  for (const [archId, tids] of archetypeRefs) {
    let runtimeAlive = false;
    for (const tid of tids) {
      const seed = seedFromTradition(tid);
      if (!seed) continue;
      const result = search(seed, { maxIters: 30, useNeighbors: true });
      if (result && result.config && result.config.archetype === archId) {
        runtimeAlive = true;
        break;
      }
    }
    if (!runtimeAlive) {
      warnings.push({
        section: 'coverage_gaps_runtime',
        location: `archetypes.${archId}`,
        detail: `archetype '${archId}' field-referenced by ${tids.length} tradition(s) but runtime swaps it out — orphan-at-runtime`,
      });
    }
  }
}

// ─────────────── 19. Multi-start convergence (Layer 9E) ───────────────
// Runs 2-restart hill-climbing per tradition (seeded + 1 randomized);
// flags any tradition whose score-spread across restarts exceeds 1.0
// (signal of multimodal search space — recipe output may depend on
// seed initialization). Opt-in via --section because expensive (~2x search
// cost per tradition × 449 traditions). maxIters capped at 30 since most
// traditions converge in ≤8 iters; the cap makes the full sweep tractable.
if (sectionsToRun && sectionsToRun.has('multistart_divergent')) {
  const { searchMultiStart, seedFromTradition } = require('./search.js');
  const restarts = parseInt(flags.restarts) || 2;
  const maxIters = parseInt(flags['multistart-iters']) || 30;
  for (const t of C.TRADITIONS) {
    const seed = seedFromTradition(t.id);
    if (!seed) continue;
    try {
      const result = searchMultiStart(seed, { restarts, maxIters });
      if (result.multistart && result.multistart.multimodal) {
        const sortedScores = [...result.multistart.scores].sort((a, b) => b - a);
        warnings.push({
          section: 'multistart_divergent',
          location: `tradition.${t.id}`,
          tid: t.id,
          detail: `score spread ${result.multistart.spread.toFixed(2)} across ${restarts} restarts (scores: ${sortedScores.map((s) => s.toFixed(2)).join(', ')}) — recipe output may be seed-dependent`,
        });
      }
    } catch {
      // Skip traditions where search fails — that's a separate audit problem
    }
  }
}

// ─────────────── 20. Function-branch entry shape ───────────────
// Function-branch traditions (lullaby, funeralLament, wedding, protestSong,
// praiseSong, nurseryRhyme, drinkingSong, seaShanty, carnivalProcessional,
// fieldWork, huntingSong, domesticRhythm) document universal song-function
// categories with a specific entry-quality contract:
//   - instruments[] must be non-empty (at minimum 'voice')
//   - description ≥300 chars (universal-function entries need real context)
//   - exemplars ≥3 (named canonical examples per cultural variant)
//   - crossRefs ≥2 (cross-cultural-function and within-function links)
//
// Violations indicate an entry was added too thinly; the function-branch
// rollout established these floors and any future authoring should hold them.
const FUNCTION_BRANCHES = [
  'lullaby',
  'funeralLament',
  'wedding',
  'protestSong',
  'praiseSong',
  'nurseryRhyme',
  'drinkingSong',
  'seaShanty',
  'carnivalProcessional',
  'fieldWork',
  'huntingSong',
  'domesticRhythm',
];

if (shouldRun('function_branch_shape')) {
  for (const tid of Object.keys(C.TRADITION_EXTRAS)) {
    const e = C.TRADITION_EXTRAS[tid];
    if (!e.parent) continue;
    // Does this entry sit under a function branch?
    const topBranch = e.parent.split('.')[0];
    if (!FUNCTION_BRANCHES.includes(topBranch)) continue;

    const trad = C.TRADITIONS.find((t) => t.id === tid);
    if (!trad) continue;

    const failures = [];
    if (!Array.isArray(trad.instruments) || trad.instruments.length === 0) {
      failures.push('instruments[] empty');
    }
    if (typeof e.description !== 'string' || e.description.length < 300) {
      failures.push(`description ${e.description ? e.description.length : 0} chars (< 300)`);
    }
    if (!Array.isArray(e.exemplars) || e.exemplars.length < 3) {
      failures.push(`exemplars ${e.exemplars ? e.exemplars.length : 0} (< 3)`);
    }
    if (!Array.isArray(e.crossRefs) || e.crossRefs.length < 2) {
      failures.push(`crossRefs ${e.crossRefs ? e.crossRefs.length : 0} (< 2)`);
    }

    if (failures.length > 0) {
      warnings.push({
        section: 'function_branch_shape',
        tid,
        detail: `${topBranch}-branch entry: ${failures.join('; ')}`,
      });
    }
  }
}

// ─────────────── Report ───────────────
const totalIssues = errors.length + warnings.length;

if (flags.quiet) {
  if (errors.length > 0) process.exit(1);
  if (flags.strict && warnings.length > 0) process.exit(1);
  process.exit(0);
}

if (totalIssues === 0) {
  console.log('AUDIT CLEAN — no data-quality issues found.');
  process.exit(0);
}

// Group by section
const groupBySection = (list) => {
  const out = {};
  for (const item of list) {
    if (!out[item.section]) out[item.section] = [];
    out[item.section].push(item);
  }
  return out;
};

const errorsBySection = groupBySection(errors);
const warningsBySection = groupBySection(warnings);

const warningLimit = flags.full ? Infinity : 20;
const errorLimit = flags.full ? Infinity : 30;

if (errors.length > 0) {
  console.log(`AUDIT — ${errors.length} error(s):\n`);
  for (const [section, items] of Object.entries(errorsBySection)) {
    console.log(`[${section}] ${items.length}`);
    for (const item of items.slice(0, errorLimit)) {
      const where = item.tid || item.location;
      console.log(`  ${where}  ${item.detail}`);
    }
    if (items.length > errorLimit) console.log(`  ... +${items.length - errorLimit} more`);
    console.log('');
  }
}

if (warnings.length > 0) {
  console.log(`AUDIT — ${warnings.length} warning(s):\n`);
  for (const [section, items] of Object.entries(warningsBySection)) {
    console.log(`[${section}] ${items.length}`);
    for (const item of items.slice(0, warningLimit)) {
      const where = item.tid || item.location;
      console.log(`  ${where}  ${item.detail}`);
    }
    if (items.length > warningLimit) console.log(`  ... +${items.length - warningLimit} more`);
    console.log('');
  }
}

if (errors.length > 0) process.exit(1);
if (flags.strict && warnings.length > 0) process.exit(1);
process.exit(0);
