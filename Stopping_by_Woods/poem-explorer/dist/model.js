(function (root) {
  'use strict';
  function popcount(mask) { let n = 0; for (; mask; mask &= mask - 1) n++; return n; }
  function create(data) {
    const bits = new Map(data.categories.map(([id], index) => [id, 1 << index]));
    const categoryBit = id => bits.get(String(id)) || 0;
    const key = (a, b) => Math.min(a, b) * 109 + Math.max(a, b);
    const raw = new Map(data.pairs.map(([a, b, m]) => [key(a, b), m]));
    const absence = new Map(data.absenceOnly.map(([a, b, m]) => [key(a, b), m]));
    const evidence = new Map();
    data.witnessEdges.forEach(([a, b, m, w]) => {
      const k = key(a, b);
      if (!evidence.has(k)) evidence.set(k, []);
      evidence.get(k).push({mask: m, witness: w, readings: data.readingWitnesses[w]});
    });
    const categories = data.categories.map(([id, name, schema]) => ({id, name, schema, bit: categoryBit(id), count: data.counts.nonabsence_by_category[id] || 0, unavailable: data.unavailable[id] || null}));
    const availableMask = categories.reduce((mask, c) => c.unavailable ? mask : mask | c.bit, 0);
    function pair(a, b) {
      if (!Number.isInteger(a) || !Number.isInteger(b) || a < 1 || b < 1 || a > data.tokens.length || b > data.tokens.length || a === b) return null;
      const k = key(a, b), r = raw.get(k), absent = absence.get(k) || 0;
      if (r === undefined) return null;
      return {a: Math.min(a, b), b: Math.max(a, b), raw: r, absence: absent, mask: r & ~absent, evidence: evidence.get(k) || []};
    }
    function matches(mask, filter = availableMask, mode = 'any') {
      return filter !== 0 && (mode === 'all' ? (mask & filter) === filter : (mask & filter) !== 0);
    }
    function related(id, filter = availableMask, mode = 'any') {
      const out = [];
      for (let other = 1; other <= data.tokens.length; other++) {
        const p = pair(id, other);
        if (p && matches(p.mask, filter, mode)) out.push({id: other, pair: p, count: popcount(p.mask & filter)});
      }
      return out;
    }
    function labels(mask) { return categories.filter(c => (mask & c.bit) !== 0); }
    function count(filter = availableMask, mode = 'any') {
      return data.pairs.reduce((n, [a,b]) => n + Number(matches(pair(a,b).mask,filter,mode)), 0);
    }
    function overview(filter = availableMask, mode = 'any') {
      const words = new Set();
      let pairs = 0;
      for (const [a,b] of data.pairs) {
        if (!matches(pair(a,b).mask,filter,mode)) continue;
        words.add(a); words.add(b); pairs++;
      }
      return {words: [...words].sort((a,b) => a-b), pairs};
    }
    return {pair, related, matches, labels, count, overview, categories, availableMask, bit: categoryBit, popcount};
  }
  const api = {create, popcount};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.PoemModel = api;
})(typeof window !== 'undefined' ? window : null);
