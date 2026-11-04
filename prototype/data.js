// What the shell loads for feature lanes (#670 slice P2). Lanes fetch
// nothing themselves: every read is here, read-only, from committed files
// beside the site, with literal paths only (check_prototype_isolation.js).

async function json(response) {
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

// The review status of a place, from data/geo-meta.json. `verified` is a
// human audit and `reviewed` a model pass; the file's note says they are not
// the same claim, so neither is reported as the other.
function provenanceOf(meta) {
  const verified = new Set(meta.verified || []);
  const reviewed = new Set(meta.reviewed || []);
  return (id) =>
    verified.has(id)
      ? { status: 'verified' }
      : reviewed.has(id)
        ? { status: 'reviewed', method: meta.reviewed_method, on: meta.reviewed_on }
        : { status: 'unreviewed' };
}

// ctx.items for the browse lane: [{ id, name, family, place }], frozen, in
// the catalog's own order (api/traditions/index.json). `place` is the
// catalog's record from data/geo.json, { lat, lng, label, region,
// provenance }, or null for a tradition data/no-fixed-origin.json lists:
// no honest place on the map. Nothing here invents or derives a coordinate.
export async function loadItems() {
  const [index, geo, meta, noOrigin] = await Promise.all([
    fetch('../api/traditions/index.json').then(json),
    fetch('../data/geo.json').then(json),
    fetch('../data/geo-meta.json').then(json),
    fetch('../data/no-fixed-origin.json').then(json),
  ]);
  const none = new Set(noOrigin.ids || []);
  const provenance = provenanceOf(meta);
  const items = (index.items || []).map((t) => {
    const g = geo[t.id];
    const place =
      none.has(t.id) || !Array.isArray(g)
        ? null
        : Object.freeze({
            lat: g[0],
            lng: g[1],
            label: g[2],
            region: g[3],
            provenance: Object.freeze(provenance(t.id)),
          });
    return Object.freeze({ id: t.id, name: t.name, family: t.family, place });
  });
  return Object.freeze(items);
}
