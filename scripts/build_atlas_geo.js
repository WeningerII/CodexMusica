#!/usr/bin/env node
// build_atlas_geo.js — deterministic display coordinates for the Traditions Atlas.
//
// THE PROBLEM
// data/geo.json places 2503 traditions on 835 distinct coordinates. 103 sit on
// one London point, 54 on Los Angeles, 39 on Tokyo. The atlas bins pins into
// 58px screen cells and draws a numbered bubble for any cell holding 4+, so a
// stack of identical coordinates projects to one screen point at EVERY zoom and
// the bubble never opens: 1516 pins (60.6%) were unreachable by clicking, and a
// further 311 sat under a same-pixel neighbour that won the hit test. The list
// panel's "zoom in to see more" was advice the geometry could not honour.
//
// THE FIX
// Spread each stack over a small disc so the pins separate as you zoom. Two
// properties matter more than the spreading itself:
//
//   1. data/geo.json stays the honest record. A pin whose origin is "London" is
//      recorded as London. This file is a DISPLAY transform, generated and
//      byte-compared, never hand-edited — so the audit pass that moves ids into
//      data/geo-meta.json's verified list reviews real coordinates, not nudged
//      ones.
//   2. It is self-liquidating. Only coordinates shared by 2+ traditions are
//      touched; a unique coordinate is copied through exactly. Give a tradition
//      a real venue coordinate and it leaves the stack and stops being nudged,
//      with no flag to remember to unset.
//
// HOW
// Each stack is laid out on a phyllotaxis (sunflower) spiral — r = R*sqrt(i/n),
// theta = i*goldenAngle — which fills a disc evenly with no clumping at any n.
// The spiral is rotated by a hash of the coordinate so neighbouring cities do
// not all wear the same pattern, and pins are ordered by sorted tradition id so
// the output does not depend on key order in the source file.
//
// LAND AWARENESS
// A naive spiral put 88 pins into open water — Brooklyn in the Atlantic,
// Stockholm in the Baltic, Kingston in the Caribbean. Before accepting a slot,
// each candidate is tested against the basemap polygons; if a pin whose origin
// is on land would land at sea, the angle is nudged through a fixed ladder
// (inland is almost always available in SOME direction) and only then is the
// radius shrunk. Pins whose ORIGIN falls outside every basemap polygon are left
// alone, since there is no shore to keep them on: --stats counts 99 of those
// inside a stack.
//
// THAT COUNT IS NOT A COORDINATE AUDIT, and an earlier version of this comment
// wrongly read it as one. data/countries.geo.json carries 180 country outlines
// and draws no small island territories, so a pin sitting correctly on an
// island the basemap omits tests exactly the same as a pin genuinely dropped in
// the ocean. The number measures the basemap's coverage, not geo.json's
// accuracy, and nothing here should be read as a finding about the data.
//
// A minimum separation of 0.62 * R/sqrt(n) km is also enforced between accepted
// slots, so the angle search can never park two pins on top of each other and
// recreate the bug this file exists to fix.
//
// WHAT THIS DOES NOT FIX
// No geographically honest radius separates a 103-stack at a sane zoom: at 25km
// the London pins still bin together until roughly 0.17 km/px. Mega-city stacks
// are the cluster POPOVER's job (src/atlas.js), which lists a bubble's members
// instead of zooming into a dead end. Jitter buys the common case — 94.6% of
// pins become individually clickable at the atlas's max zoom, up from 17.4% —
// and the popover guarantees the floor for the rest.
//
// Reads:  api/traditions/index.json, data/geo.json, data/countries.geo.json
// Writes: data/atlas-geo.json
//
// Usage:
//   node scripts/build_atlas_geo.js            # regenerate
//   node scripts/build_atlas_geo.js --check    # fail if the committed file is stale
//   node scripts/build_atlas_geo.js --stats    # regenerate and report the spread

'use strict';

const fs = require('fs');
const path = require('path');
const { validateEntry } = require('./_atlas_regions.js');

const ROOT = path.join(__dirname, '..');
const INDEX_FILE = path.join(ROOT, 'api', 'traditions', 'index.json');
const GEO_FILE = path.join(ROOT, 'data', 'geo.json');
const WORLD_FILE = path.join(ROOT, 'data', 'countries.geo.json');
const OUT_FILE = path.join(ROOT, 'data', 'atlas-geo.json');

// Spread parameters. RADIUS_K * sqrt(n), clamped — so a pair sits ~7km apart
// while a 25-deep stack fills a 25km disc, roughly the reach of the metro areas
// these coordinates actually name. Raising MAX_KM buys a little separation and
// spends geographic truth; 25km is where a "London" pin stops being London.
const RADIUS_K = 5;
const MIN_KM = 2;
const MAX_KM = 25;

// Minimum gap between two accepted slots, as a fraction of the spiral's natural
// spacing. Below ~0.5 the angle search starts stacking pins again.
const MIN_SEP_FRACTION = 0.62;

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const KM_PER_DEGREE = 111.32;

// Angle nudges tried in order before the radius is shrunk, then the shrink
// ladder. Fixed tables, not a search — the output must be reproducible.
const ANGLE_TRIES = [0, 0.52, -0.52, 1.05, -1.05, 1.65, -1.65, 2.3, -2.3, Math.PI];
const SHRINK_TRIES = [1, 0.72, 0.5, 0.32, 0.18];

// FNV-1a. Any stable string hash works; this one is short and has no deps.
function hash32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// ── basemap land test ──
// The same polygons the atlas draws, so "on land" here means "inside the shape
// the user sees". Bounding boxes first; the ray cast is only reached by the few
// polygons that could contain the point.
function loadLand(world) {
  const polys = [];
  const add = (rings) => {
    const outer = rings[0];
    let minx = Infinity;
    let miny = Infinity;
    let maxx = -Infinity;
    let maxy = -Infinity;
    for (const c of outer) {
      if (c[0] < minx) minx = c[0];
      if (c[0] > maxx) maxx = c[0];
      if (c[1] < miny) miny = c[1];
      if (c[1] > maxy) maxy = c[1];
    }
    polys.push({ rings, minx, miny, maxx, maxy });
  };
  for (const f of world.features) {
    const g = f.geometry;
    if (!g) continue;
    if (g.type === 'Polygon') add(g.coordinates);
    else if (g.type === 'MultiPolygon') g.coordinates.forEach(add);
  }
  return polys;
}

function inRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function makeOnLand(polys) {
  return function onLand(lat, lng) {
    for (const p of polys) {
      if (lng < p.minx || lng > p.maxx || lat < p.miny || lat > p.maxy) continue;
      if (!inRing(lng, lat, p.rings[0])) continue;
      let inHole = false;
      for (let k = 1; k < p.rings.length; k++) {
        if (inRing(lng, lat, p.rings[k])) {
          inHole = true;
          break;
        }
      }
      if (!inHole) return true;
    }
    return false;
  };
}

// ── the spread ──
function computeDisplayCoords(geo, onLand) {
  // Group by exact coordinate: a stack is what has to be pulled apart. The
  // label and region ride along untouched — they are authored in geo.json and
  // validated before this runs.
  const stacks = new Map();
  for (const id of Object.keys(geo)) {
    const key = geo[id][0] + ',' + geo[id][1];
    let s = stacks.get(key);
    if (!s) {
      s = [];
      stacks.set(key, s);
    }
    s.push(id);
  }

  const coords = {};
  const stats = {
    traditions: Object.keys(geo).length,
    distinctCoordinates: stacks.size,
    untouched: 0,
    spread: 0,
    stacksSpread: 0,
    largestStack: 0,
    angleNudged: 0,
    radiusShrunk: 0,
    unplaceable: 0,
    originAtSea: 0,
    maxDisplacementKm: 0,
  };

  // Sorted keys, sorted ids: identical output whatever order the source file
  // happens to enumerate. Bare .sort() is codepoint order — no locale, per the
  // collation ban in eslint.config.js.
  for (const key of [...stacks.keys()].sort()) {
    const ids = stacks.get(key).slice().sort();
    const n = ids.length;
    const lat0 = geo[ids[0]][0];
    const lng0 = geo[ids[0]][1];

    if (n === 1) {
      coords[ids[0]] = [lat0, lng0, geo[ids[0]][2], geo[ids[0]][3]];
      stats.untouched++;
      continue;
    }

    stats.stacksSpread++;
    if (n > stats.largestStack) stats.largestStack = n;

    const R = Math.min(MAX_KM, Math.max(MIN_KM, RADIUS_K * Math.sqrt(n)));
    const rot = (hash32(key) / 4294967296) * Math.PI * 2;
    // Longitude degrees shrink with latitude; divide so the disc stays round on
    // the ground rather than becoming a lens near the poles.
    const cosLat = Math.max(0.15, Math.cos((lat0 * Math.PI) / 180));
    const originOnLand = onLand(lat0, lng0);
    if (!originOnLand) stats.originAtSea += n;
    const minSep = (R / Math.sqrt(n)) * MIN_SEP_FRACTION;
    const taken = [];

    const toLatLng = (r, th) => [
      lat0 + (r * Math.sin(th)) / KM_PER_DEGREE,
      lng0 + (r * Math.cos(th)) / (KM_PER_DEGREE * cosLat),
    ];
    const farEnough = (r, th) => {
      const x = r * Math.cos(th);
      const y = r * Math.sin(th);
      for (const q of taken) {
        if (Math.hypot(x - q[0], y - q[1]) < minSep) return false;
      }
      return true;
    };

    for (let i = 0; i < n; i++) {
      const r0 = R * Math.sqrt((i + 0.5) / n);
      const th0 = i * GOLDEN_ANGLE + rot;
      let slot = null;
      let nudged = false;
      let shrunk = false;

      for (let si = 0; si < SHRINK_TRIES.length && !slot; si++) {
        const r = r0 * SHRINK_TRIES[si];
        for (let ai = 0; ai < ANGLE_TRIES.length; ai++) {
          const th = th0 + ANGLE_TRIES[ai];
          if (!farEnough(r, th)) continue;
          const ll = toLatLng(r, th);
          if (originOnLand && !onLand(ll[0], ll[1])) continue;
          slot = { r, th, ll };
          nudged = ai > 0;
          shrunk = si > 0;
          break;
        }
      }

      if (!slot) {
        // Every candidate was at sea or too close to a taken slot. Pull the pin
        // most of the way home and accept the overlap — the popover still
        // reaches it, which is the guarantee that matters.
        const r = r0 * 0.28;
        slot = { r, th: th0, ll: toLatLng(r, th0) };
        stats.unplaceable++;
      } else {
        if (nudged) stats.angleNudged++;
        if (shrunk) stats.radiusShrunk++;
      }

      taken.push([slot.r * Math.cos(slot.th), slot.r * Math.sin(slot.th)]);
      stats.spread++;
      if (slot.r > stats.maxDisplacementKm) stats.maxDisplacementKm = slot.r;

      const lat = Math.max(-85, Math.min(85, slot.ll[0]));
      const lng = ((((slot.ll[1] + 180) % 360) + 360) % 360) - 180;
      // 5dp is ~1m — far finer than anything this data claims, and it keeps the
      // committed file byte-stable across platforms.
      coords[ids[i]] = [
        Math.round(lat * 1e5) / 1e5,
        Math.round(lng * 1e5) / 1e5,
        geo[ids[i]][2],
        geo[ids[i]][3],
      ];
    }
  }

  return { coords, stats };
}

function render(coords, stats) {
  const ids = Object.keys(coords).sort();
  const lines = ids.map((id) => '    ' + JSON.stringify(id) + ': ' + JSON.stringify(coords[id]));
  return (
    '{\n' +
    '  "generator": "scripts/build_atlas_geo.js",\n' +
    '  "source": "data/geo.json",\n' +
    '  "note": "DISPLAY records: [lat, lng, label, region]. Stacked pins are spread over a small land-aware disc so they can be clicked apart; unique coordinates are copied through untouched. The label is copied verbatim from data/geo.json, which is the record — never read this file for provenance. The region is the sidebar bucket from scripts/_atlas_regions.js.",\n' +
    '  "params": { "radiusK": ' +
    RADIUS_K +
    ', "minKm": ' +
    MIN_KM +
    ', "maxKm": ' +
    MAX_KM +
    ', "minSepFraction": ' +
    MIN_SEP_FRACTION +
    ' },\n' +
    '  "stats": ' +
    JSON.stringify({
      traditions: stats.traditions,
      distinctCoordinates: stats.distinctCoordinates,
      untouched: stats.untouched,
      spread: stats.spread,
      stacksSpread: stats.stacksSpread,
      largestStack: stats.largestStack,
    }) +
    ',\n' +
    '  "coords": {\n' +
    lines.join(',\n') +
    '\n  }\n' +
    '}\n'
  );
}

function main() {
  const check = process.argv.includes('--check');
  const wantStats = process.argv.includes('--stats');

  const index = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
  const geo = JSON.parse(fs.readFileSync(GEO_FILE, 'utf8'));
  const world = JSON.parse(fs.readFileSync(WORLD_FILE, 'utf8'));

  const known = new Set(index.items.map((t) => t.id));
  const missing = index.items.filter((t) => !geo[t.id]).map((t) => t.id);
  const orphans = Object.keys(geo).filter((id) => !known.has(id));
  if (missing.length || orphans.length) {
    console.error('build_atlas_geo: FAIL — data/geo.json does not cover api/traditions/index.json');
    if (missing.length)
      console.error('  missing (' + missing.length + '): ' + missing.slice(0, 10).join(', '));
    if (orphans.length)
      console.error('  orphan  (' + orphans.length + '): ' + orphans.slice(0, 10).join(', '));
    process.exit(1);
  }

  const onLand = makeOnLand(loadLand(world));
  // Validate every authored field before spreading anything: shape, ranges, the
  // region against REGIONS, and the label against the name-the-place-not-the-
  // state policy. A bad entry fails here rather than rendering as a pin nobody
  // can find under a heading nobody expects.
  const policyErrs = [];
  for (const id of Object.keys(geo)) policyErrs.push(...validateEntry(id, geo[id]));
  if (policyErrs.length) {
    console.error('build_atlas_geo: FAIL — ' + policyErrs.length + ' geo.json policy error(s)');
    policyErrs.slice(0, 25).forEach((e) => console.error('  ' + e.join(' ')));
    console.error('  see the policy in scripts/_atlas_regions.js');
    process.exit(1);
  }

  const { coords, stats } = computeDisplayCoords(geo, onLand);
  const body = render(coords, stats);

  if (check) {
    const current = fs.existsSync(OUT_FILE) ? fs.readFileSync(OUT_FILE, 'utf8') : '';
    if (current !== body) {
      console.error('build_atlas_geo: FAIL — data/atlas-geo.json is stale');
      console.error('  run: node scripts/build_atlas_geo.js');
      process.exit(1);
    }
    console.log(
      'build_atlas_geo: OK — atlas-geo.json matches data/geo.json (' +
        stats.spread +
        ' spread, ' +
        stats.untouched +
        ' exact)'
    );
    return;
  }

  fs.writeFileSync(OUT_FILE, body);
  console.log(
    'build_atlas_geo: wrote data/atlas-geo.json — ' +
      stats.traditions +
      ' traditions on ' +
      stats.distinctCoordinates +
      ' coordinates; ' +
      stats.untouched +
      ' left exact, ' +
      stats.spread +
      ' spread across ' +
      stats.stacksSpread +
      ' stacks (largest ' +
      stats.largestStack +
      ')'
  );
  if (wantStats) {
    console.log(
      '  angle-nudged off water: ' +
        stats.angleNudged +
        ', radius-shrunk: ' +
        stats.radiusShrunk +
        ', unplaceable: ' +
        stats.unplaceable
    );
    console.log(
      '  stacked pins whose ORIGIN is off every basemap polygon: ' +
        stats.originAtSea +
        '; max displacement ' +
        stats.maxDisplacementKm.toFixed(1) +
        'km'
    );
  }
}

main();
