#!/usr/bin/env node
// build_atlas_basemap.js — derive the atlas basemap from the vendored source.
//
// WHY THIS EXISTS
// The atlas shipped with a 180-outline world file that drew no small island
// territories. That is not a cosmetic gap: build_atlas_geo.js tests every pin
// against these polygons to keep spread pins ashore, so an undrawn island reads
// as open ocean. Twenty-nine coordinate groups sat more than 50km from any
// drawn land — Tahiti, Réunion, Okinawa, the Faroes, the Canaries, Jeju,
// Shetland, Barbados, Malé, Zanzibar — and every one of them was a CORRECT
// coordinate on an island the basemap omitted. The file was wrong, not the data.
// (An earlier comment in build_atlas_geo.js read that count as a geo.json audit
// finding. It never was one, and this script is why the confusion cannot recur:
// with these polygons nothing sits further than ~6km offshore.)
//
// Natural Earth 1:50m Admin 0 countries draws all 242 of them. This script
// simplifies it to something a browser can fetch without dropping a single
// polygon — thinning small rings is exactly how island territories go missing,
// so a ring that would collapse below four points is kept UNSIMPLIFIED instead.
//
// SOURCE AND LICENCE
// references/_natural_earth_50m.json is Natural Earth 1:50m Admin 0 — Countries
// (naturalearthdata.com), reduced to id + name + geometry. Natural Earth is in
// the public domain: "no permission is needed to use Natural Earth. Crediting
// the authors is unnecessary." It is vendored rather than fetched so the build
// is reproducible offline and CI never depends on a third-party host.
//
// Reads:  references/_natural_earth_50m.json
// Writes: data/countries.geo.json
//
// Usage:
//   node scripts/build_atlas_basemap.js            # regenerate
//   node scripts/build_atlas_basemap.js --check    # fail if the output is stale
//   node scripts/build_atlas_basemap.js --stats    # regenerate and report shape

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC_FILE = path.join(ROOT, 'references', '_natural_earth_50m.json');
const OUT_FILE = path.join(ROOT, 'data', 'countries.geo.json');

// Douglas-Peucker tolerance in degrees, and the coordinate precision kept.
//
// 0.02deg is ~2.2km at the equator, and 3 decimal places is ~110m. Both were
// chosen against the measurement this file exists to protect rather than by
// eye: at 0.02 no origin coordinate in data/geo.json sits further than 6.1km
// from a drawn coast, and every one of those is a real coastal or delta city
// (Belém on the braided Pará channels is the furthest). Coarser tolerances stay
// correct on that metric but cut visibly into bays; 0.05 was measured at 6.1km
// too and saves 330KB, and is the obvious lever if the payload ever matters
// more than the coastline.
//
// DO NOT REACH FOR ADAPTIVE TOLERANCE HERE. 57 coordinate groups still test as
// just-offshore, all within 6.1km, and the obvious theory is that flat
// simplification shaves small islands harder than large landmasses. MEASURED
// AND FALSE: scaling tolerance by ring size costs 6,171 vertices and 100KB and
// moves the count by ZERO, because those pins are offshore in the RAW,
// UNSIMPLIFIED source too — New York, Venice, Cádiz, Belém, Bridgetown,
// Fort-de-France, Shetland, all of them. 1:50m is a 1:50-million-scale product
// whose coastlines the cartographers already generalised at about this
// distance; Manhattan sits inside the harbour generalisation and Venice is a
// lagoon. The residue is the source's scale, not this script's arithmetic, and
// the only fix would be a finer Natural Earth tier at several times the bytes.
const TOLERANCE = 0.02;
const PRECISION = 3;

// ── Douglas-Peucker ──
function sqSegDist(p, a, b) {
  let x = a[0];
  let y = a[1];
  let dx = b[0] - x;
  let dy = b[1] - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = b[0];
      y = b[1];
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }
  return (p[0] - x) ** 2 + (p[1] - y) ** 2;
}

function simplify(pts, tol) {
  if (pts.length <= 3) return pts;
  const keep = new Array(pts.length).fill(false);
  keep[0] = true;
  keep[pts.length - 1] = true;
  const t2 = tol * tol;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let best = 0;
    let idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = sqSegDist(pts[i], pts[a], pts[b]);
      if (d > best) {
        best = d;
        idx = i;
      }
    }
    if (best > t2) {
      keep[idx] = true;
      stack.push([a, idx], [idx, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

const round = (p) => [Number(p[0].toFixed(PRECISION)), Number(p[1].toFixed(PRECISION))];
const dedupe = (pts) =>
  pts.filter((p, i, a) => i === 0 || p[0] !== a[i - 1][0] || p[1] !== a[i - 1][1]);

// A closed ring needs four points to bound any area. If simplification or
// rounding takes it below that, the shape is GONE — so fall back to the
// unsimplified ring rather than drop the island. Returning null here would
// reintroduce the exact defect this file was written to fix.
function reduceRing(ring) {
  let out = dedupe(simplify(ring, TOLERANCE).map(round));
  if (out.length < 4) out = dedupe(ring.map(round));
  if (out.length < 4) return null;
  const first = out[0];
  const last = out[out.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) out.push([first[0], first[1]]);
  return out;
}

function reducePolygon(rings) {
  const out = rings.map(reduceRing).filter(Boolean);
  return out.length ? out : null;
}

function build(src) {
  const features = [];
  let dropped = 0;
  for (const f of src.features) {
    const g = f.geometry;
    if (!g) continue;
    let geometry = null;
    if (g.type === 'Polygon') {
      const rings = reducePolygon(g.coordinates);
      if (rings) geometry = { type: 'Polygon', coordinates: rings };
      else dropped++;
    } else if (g.type === 'MultiPolygon') {
      const polys = [];
      for (const c of g.coordinates) {
        const rings = reducePolygon(c);
        if (rings) polys.push(rings);
        else dropped++;
      }
      if (polys.length) geometry = { type: 'MultiPolygon', coordinates: polys };
    }
    if (geometry) features.push({ type: 'Feature', id: f.id, properties: f.properties, geometry });
  }
  return { world: { type: 'FeatureCollection', features }, dropped };
}

function shapeOf(world) {
  let polygons = 0;
  let vertices = 0;
  for (const f of world.features) {
    const cs = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    polygons += cs.length;
    for (const rings of cs) for (const r of rings) vertices += r.length;
  }
  return { features: world.features.length, polygons, vertices };
}

function main() {
  const check = process.argv.includes('--check');
  const wantStats = process.argv.includes('--stats');

  const src = JSON.parse(fs.readFileSync(SRC_FILE, 'utf8'));
  const { world, dropped } = build(src);

  // Not a soft warning. Losing a polygon is the failure mode, so it fails.
  if (dropped) {
    console.error('build_atlas_basemap: FAIL — ' + dropped + ' polygon(s) collapsed to nothing');
    console.error('  lower TOLERANCE; a dropped ring is an island removed from the map');
    process.exit(1);
  }

  const shape = shapeOf(world);
  const srcShape = shapeOf(src);
  if (shape.polygons !== srcShape.polygons) {
    console.error(
      'build_atlas_basemap: FAIL — ' +
        srcShape.polygons +
        ' polygons in, ' +
        shape.polygons +
        ' out'
    );
    process.exit(1);
  }

  const body = JSON.stringify(world) + '\n';

  if (check) {
    const current = fs.existsSync(OUT_FILE) ? fs.readFileSync(OUT_FILE, 'utf8') : '';
    if (current !== body) {
      console.error('build_atlas_basemap: FAIL — data/countries.geo.json is stale');
      console.error('  run: node scripts/build_atlas_basemap.js');
      process.exit(1);
    }
    console.log(
      'build_atlas_basemap: OK — ' +
        shape.features +
        ' features, ' +
        shape.polygons +
        ' polygons, ' +
        shape.vertices +
        ' vertices'
    );
    return;
  }

  fs.writeFileSync(OUT_FILE, body);
  console.log(
    'build_atlas_basemap: wrote data/countries.geo.json — ' +
      shape.features +
      ' features, ' +
      shape.polygons +
      ' polygons, ' +
      shape.vertices +
      ' vertices, ' +
      (Buffer.byteLength(body) / 1048576).toFixed(2) +
      ' MB'
  );
  if (wantStats) {
    console.log(
      '  source: ' +
        srcShape.features +
        ' features, ' +
        srcShape.polygons +
        ' polygons, ' +
        srcShape.vertices +
        ' vertices'
    );
    console.log(
      '  kept ' +
        ((shape.vertices / srcShape.vertices) * 100).toFixed(1) +
        '% of vertices and 100% of polygons at tolerance ' +
        TOLERANCE
    );
  }
}

main();
