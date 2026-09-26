#!/usr/bin/env node
// Build references/_image_manifest.json: openly licensed image links for
// catalog instruments and traditions. Links only, no image binaries.
//
// Volume over completeness: every match is automatic, and anything
// ambiguous is skipped rather than resolved by hand.
//
//   1. Wikidata: batched SPARQL over English labels/aliases, restricted to
//      musical instruments / music genres; accept a name only when exactly
//      one such item carries it. Take its P18 image, then read license + author from the Commons API
//      (imageinfo/extmetadata, 50 titles per call).
//      Several in-class items sharing a name: take the one whose main label
//      is the name, else the only such one labelled in lower case (the
//      generic class, over museum objects that carry the capitalised name),
//      else the only one with an image; otherwise skip. Items
//      with no P18 fall back to the top Commons file tagged as depicting
//      them (P180), under a time budget (--depicts-minutes, default 30).
//   2. Instruments still missing: Met Open Access (Musical Instruments dept,
//      isPublicDomain only).
//   3. Smithsonian Open Access (CC0) only when SI_API_KEY is set.
//   4. Instruments still missing: Cleveland Museum of Art (CC0, musical
//      instrument records), then Europeana open-reuse images (EUROPEANA_KEY,
//      else the public demo key). Either counts only when a part of the
//      record's title is the instrument name.
//   5. Anything still missing, traditions first: Openverse keyword search
//      (title must start with the name or say "<name> music"; `low`
//      confidence). Anonymous access is 200 requests/day, so each run spends
//      at most --openverse-budget.
//
// Round 2 adds, in the same order of trust:
//   - wider names: the instrument's `short` name, the id read as words, each
//     side of "X and Y", "<name> music" (allCandidates), for Wikidata and
//     the museums;
//   - a Wikidata item's Commons category (P373): a photo filed there whose
//     own title names the item;
//   - traditions: a photo of a performer whose only Wikidata genre is it;
//   - Commons full-text search: a photo whose title and categories both
//     name the thing, with categories about music (--search-minutes);
//   - Smithsonian via api.data.gov's DEMO_KEY when SI_API_KEY is unset.
// Entries already in the manifest are kept; a run fills only the gaps
// (--fresh rebuilds everything).
//
// Entries a reviewer found by hand, not by this script, name their route
// with the source names above plus `_manual`: wikidata_commons_manual (P18
// of a hand-matched Wikidata item), wikidata_performer_manual (a performer
// the tradition's lineage names), commons_category_manual,
// commons_search_manual, and enwiki_lead_image_manual (the lead image of the
// exact English Wikipedia article). A run keeps them like any other entry.
//
// Picks a manual accuracy pass rejected (REJECTED below) are dropped as each
// source reports, so the entity stays open for the next source.
//
// The source's own license field is trusted; only Public Domain / CC0 /
// CC BY / CC BY-SA are kept. Sources that fail (network policy, no key) are
// recorded under `skipped_sources` and the run carries on.
//
// Usage: node scripts/fetch_image_manifest.js [--offset N] [--limit N]
//        [--kind instrument|tradition] [--cache FILE] [--out FILE] [--fresh] [--depicts-minutes N]
//        [--category-minutes N] [--search-minutes N] [--openverse-budget N]
//
// --kind, --offset and --limit narrow which index entries a run looks up
// (offset/limit count within each kind's index), so a long fill can run in
// chunks; entries outside that scope are kept as they are.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const opts = {
  limit: Infinity,
  offset: 0,
  kind: null,
  out: path.join(ROOT, 'references', '_image_manifest.json'),
  cache: null,
  concurrency: 4,
  depictsMinutes: 30,
  openverseBudget: 190,
  categoryMinutes: 30,
  searchMinutes: 45,
  fresh: false,
};
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--limit') opts.limit = parseInt(args[++i], 10);
  else if (args[i] === '--offset') opts.offset = parseInt(args[++i], 10);
  else if (args[i] === '--kind') opts.kind = args[++i];
  else if (args[i] === '--out') opts.out = args[++i];
  else if (args[i] === '--cache') opts.cache = args[++i];
  else if (args[i] === '--concurrency') opts.concurrency = parseInt(args[++i], 10);
  else if (args[i] === '--openverse-budget') opts.openverseBudget = parseInt(args[++i], 10);
  else if (args[i] === '--depicts-minutes') opts.depictsMinutes = parseFloat(args[++i]);
  else if (args[i] === '--category-minutes') opts.categoryMinutes = parseFloat(args[++i]);
  else if (args[i] === '--search-minutes') opts.searchMinutes = parseFloat(args[++i]);
  else if (args[i] === '--fresh') opts.fresh = true;
}

const UA = 'CodexMusica-image-manifest/1.0 (https://github.com/WeningerII/CodexMusica)';
const THUMB_WIDTH = 400;

// ---- HTTP ----
// Node's fetch ignores HTTPS_PROXY unless NODE_USE_ENV_PROXY is set at
// startup, so re-run under it when a proxy is configured.
// Only when run directly: requiring this module must not spawn a process.
if (
  require.main === module &&
  (process.env.HTTPS_PROXY || process.env.https_proxy) &&
  !process.env.NODE_USE_ENV_PROXY
) {
  const r = require('child_process').spawnSync(process.execPath, process.argv.slice(1), {
    stdio: 'inherit',
    env: { ...process.env, NODE_USE_ENV_PROXY: '1', NODE_NO_WARNINGS: '1' },
  });
  process.exit(r.status === null ? 1 : r.status);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, attempt = 0, body = null) {
  let res;
  const headers = { 'User-Agent': UA, Accept: 'application/json' };
  if (body) headers['Content-Type'] = 'application/x-www-form-urlencoded';
  try {
    res = await fetch(url, body ? { method: 'POST', headers, body } : { headers });
  } catch (e) {
    if (attempt < 2) return sleep(2000 * (attempt + 1)).then(() => getJson(url, attempt + 1, body));
    throw new Error('network: ' + ((e.cause && e.cause.message) || e.message));
  }
  if ((res.status === 429 || res.status >= 500) && attempt < 5) {
    await sleep(3000 * 2 ** attempt + Math.random() * 2000);
    return getJson(url, attempt + 1, body);
  }
  if (!res.ok) throw new Error('http_' + res.status);
  return res.json();
}

// A lookup whose single failure should skip that one item, not the source.
async function tryJson(url) {
  try {
    return await getJson(url);
  } catch (e) {
    if (/^http_4/.test(e.message)) return null;
    throw e;
  }
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return out;
}

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

// ---- Cache (resumable runs) ----
let cache = {};
if (opts.cache && fs.existsSync(opts.cache))
  cache = JSON.parse(fs.readFileSync(opts.cache, 'utf8'));
function saveCache() {
  if (opts.cache) fs.writeFileSync(opts.cache, JSON.stringify(cache));
}
// Saved every few new entries too, so a run cut short keeps most lookups.
let unsaved = 0;
async function cached(key, fn) {
  if (key in cache) return cache[key];
  const v = await fn();
  cache[key] = v;
  if (++unsaved >= 25) {
    unsaved = 0;
    saveCache();
  }
  return v;
}

// ---- Names ----
function norm(s) {
  return String(s || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Catalog names like "Choir / vocal ensemble" or "Oud (Arabic)" yield each
// half and the parenthesis-stripped form as search candidates.
function nameCandidates(name) {
  const out = new Set();
  const base = String(name)
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .trim();
  out.add(base);
  for (const part of base.split(/\s*\/\s*/)) if (part) out.add(part);
  return [...out].filter((s) => norm(s).length >= 3);
}

// Round 2 widens the search past the display name: the catalog's `short`
// name ("oud" for "ʿŪd (Arab/Mediterranean fretless lute)"), the id read as
// words, each side of "X and Y", and "<name> music" for traditions. The
// display name comes first, so an entity it already matched keeps that
// match. Parenthesised text is left out: it is as often a qualifier
// ("bass", "Persian", "country") as a native name.
function allCandidates(e) {
  const out = new Set(nameCandidates(e.name));
  if (e.short) for (const c of nameCandidates(e.short)) out.add(c);
  out.add(e.id.replace(/_/g, ' '));
  for (const c of [...out]) for (const part of c.split(/\s+and\s+/i)) out.add(part);
  if (e.kind === 'tradition') for (const c of [...out]) out.add(c + ' music');
  // Bare years, eras and very short fragments name nothing on their own.
  return [...out].filter((s) => norm(s).length >= 3 && !/\d{3}/.test(s));
}

// ---- Licenses ----
function classifyLicense(short) {
  const s = String(short || '')
    .toLowerCase()
    .replace(/[\s_]+/g, '-');
  if (!s) return null;
  if (/-nc|-nd|fair-use|all-rights-reserved/.test(s)) return null;
  if (/^cc0|cc-zero|^cc-0/.test(s)) return 'CC0';
  if (/public-domain|^pd($|-)/.test(s)) return 'Public Domain';
  const m = s.match(/^cc-by(-sa)?(-\d(\.\d)?)?/);
  if (m) return m[1] ? 'CC BY-SA' : 'CC BY';
  return null;
}

function stripHtml(s) {
  return String(s || '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}

// ---- Source 1: Wikidata (SPARQL) + Commons ----
// Wikidata classes a match must fall under (instance or subclass, transitively).
const WD_CLASS = { instrument: 'Q34379', tradition: 'Q188451' }; // musical instrument, music genre

function caseVariants(s) {
  const lower = s.toLowerCase();
  return [...new Set([s, lower, lower.charAt(0).toUpperCase() + lower.slice(1)])];
}

function sparqlString(s) {
  return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"@en';
}

// One SPARQL query per batch of labels: every in-class item whose English
// label or alias equals one of them, with its P18 image if it has one.
async function sparqlLabelHits(labels, kind) {
  const query =
    'SELECT ?lab ?item ?itemLabel ?img ?cat ?main WHERE { VALUES ?lab { ' +
    labels.map(sparqlString).join(' ') +
    ' } { ?item rdfs:label ?lab . BIND(true AS ?main) } UNION' +
    ' { ?item skos:altLabel ?lab . BIND(false AS ?main) }' +
    ' ?item wdt:P31?/wdt:P279* wd:' +
    WD_CLASS[kind] +
    ' . OPTIONAL { ?item wdt:P18 ?img } OPTIONAL { ?item wdt:P373 ?cat } ' +
    'SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } }';
  // POST: a GET carrying 150 labels overflows the request line (HTTP 431).
  const data = await getJson(
    'https://query.wikidata.org/sparql?format=json',
    0,
    'query=' + encodeURIComponent(query)
  );
  return data.results.bindings.map((b) => ({
    label: b.lab.value,
    qid: b.item.value.replace(/^.*\//, ''),
    itemLabel: b.itemLabel && b.itemLabel.value,
    main: b.main && b.main.value === 'true',
    file: b.img && decodeURIComponent(b.img.value.replace(/^.*\/Special:FilePath\//, '')),
    category: b.cat && b.cat.value,
  }));
}

// Pick one item for a name. One in-class item carrying it wins outright.
// Several: the single one whose main label (not an alias) is the name, else
// the single such one whose label is lower case, else the single one with an
// image; otherwise ambiguous and skipped. The lower-case rule is for museum
// objects: the Swedish Museum of Performing Arts has items labelled "Kazoo"
// or "Castanets" beside the generic "kazoo" and "castanets", which would
// otherwise leave the instrument ambiguous.
function resolveHits(hits) {
  const qids = [...new Set(hits.map((h) => h.qid))];
  if (qids.length === 1) return { qid: qids[0], tiebreak: false };
  for (const pick of [
    (h) => h.main,
    (h) => h.main && h.label === h.label.toLowerCase(),
    (h) => h.file,
  ]) {
    const q = [...new Set(hits.filter(pick).map((h) => h.qid))];
    if (q.length === 1) return { qid: q[0], tiebreak: true };
  }
  return null;
}

async function wikidataMatches(entities) {
  const out = {};
  for (const kind of Object.keys(WD_CLASS)) {
    const mine = entities.filter((e) => e.kind === kind);
    const allLabels = [...new Set(mine.flatMap((e) => allCandidates(e).flatMap(caseVariants)))];
    const byLabel = {};
    // A batch the endpoint times out on is split in half and retried.
    const run = async (batch) => {
      let hits;
      try {
        hits = await sparqlLabelHits(batch, kind);
      } catch (e) {
        if (batch.length < 8) throw e;
        const mid = batch.length >> 1;
        await run(batch.slice(0, mid));
        return run(batch.slice(mid));
      }
      // Cached per label, so a rerun over a different entity set reuses them.
      for (const l of batch) cache['wdl:' + kind + ':' + l] = [];
      for (const h of hits) cache['wdl:' + kind + ':' + h.label].push(h);
      saveCache();
    };
    const todo = allLabels.filter((l) => !('wdl:' + kind + ':' + l in cache));
    for (const batch of chunk(todo, 60)) await run(batch);
    for (const l of allLabels)
      for (const h of cache['wdl:' + kind + ':' + l] || []) (byLabel[h.label] ||= []).push(h);
    for (const e of mine) {
      const cands = allCandidates(e);
      const primary = nameCandidates(e.name)[0];
      for (const cand of cands) {
        const hits = caseVariants(cand).flatMap((v) => byLabel[v] || []);
        if (!hits.length) continue;
        const r = resolveHits(hits);
        if (!r) break; // ambiguous: skip rather than guess
        const mineHits = hits.filter((h) => h.qid === r.qid);
        const withImg = mineHits.find((h) => h.file);
        const withCat = mineHits.find((h) => h.category);
        // An alias can name a broader or different item ("been" is also an
        // alias of the rudra veena), so only a main-label match is `high`.
        const byMainLabel = mineHits.some((h) => h.main);
        out[e.key] = {
          qid: r.qid,
          kind,
          label: mineHits[0].itemLabel || mineHits[0].label,
          file: withImg ? withImg.file : null,
          category: withCat ? withCat.category : null,
          confidence: cand === primary && !r.tiebreak && byMainLabel ? 'high' : 'medium',
        };
        break;
      }
    }
  }
  return out;
}

// Items with no P18: the top Commons file whose structured data says it
// depicts (P180) that exact item. Commons rate-limits hard, so this pass
// runs under a time budget and caches, so a rerun continues where it stopped.
async function commonsDepicts(matches) {
  const deadline = Date.now() + opts.depictsMinutes * 60000;
  const todo = Object.values(matches).filter((m) => !m.file);
  let done = 0;
  await pool(todo, 2, async (m) => {
    if (!('depicts:' + m.qid in cache) && Date.now() > deadline) return;
    const url =
      'https://commons.wikimedia.org/w/api.php?action=query&format=json&list=search' +
      '&srnamespace=6&srlimit=5&srsearch=' +
      encodeURIComponent('haswbstatement:P180=' + m.qid);
    let data;
    try {
      data = await cached('depicts:' + m.qid, () => tryJson(url));
    } catch {
      return; // rate-limited past retries: leave for the next run
    }
    done++;
    if (done % 50 === 0) saveCache();
    const hit = ((data && data.query && data.query.search) || []).find((r) =>
      pickableFile(r.title)
    );
    if (hit) {
      m.file = hit.title.replace(/^File:/, '');
      m.confidence = 'medium';
      m.via = 'depicts';
    }
  });
  saveCache();
  return { tried: done, of: todo.length };
}

// Round 2. Items with no P18 but a Commons category (P373): the category is
// the item's own gallery, so a file filed in it is confirmed by its own
// categories. Take the first openly licensed photo, by title order, whose
// title also names the item; maps, logos, flags, scans of scores and
// non-image media never count.
const NOT_A_PICTURE =
  /\b(map|karte|carte|mapa|logo|flag|coat of arms|locator|signature|diagram|chart|score|sheet music|partitura|stamp|cover|poster|label|disc|record|tomb|grave|page|range|fingering|dpla)\b/i;
const PHOTO_EXT = /\.(jpe?g|png|webp)$/i;
function pickableFile(title) {
  const t = title.replace(/^File:/, '');
  // "(03 of 37)": one page of a digitised book or score.
  return (
    PHOTO_EXT.test(t) && !NOT_A_PICTURE.test(t.replace(/[_.-]/g, ' ')) && !/\d+ of \d+\)/.test(t)
  );
}
function hasWords(hay, needle) {
  const n = norm(needle);
  return n.length >= 3 && (' ' + norm(hay) + ' ').includes(' ' + n + ' ');
}
async function commonsCategory(matches) {
  const deadline = Date.now() + opts.categoryMinutes * 60000;
  const todo = Object.values(matches).filter((m) => !m.file && m.category);
  let done = 0;
  await pool(todo, 2, async (m) => {
    const key = 'cat:' + m.category;
    if (!(key in cache) && Date.now() > deadline) return;
    const url =
      'https://commons.wikimedia.org/w/api.php?action=query&format=json' +
      '&generator=categorymembers&gcmtype=file&gcmlimit=50&gcmtitle=' +
      encodeURIComponent('Category:' + m.category) +
      '&prop=imageinfo&iiprop=extmetadata&iiextmetadatafilter=LicenseShortName';
    let data;
    try {
      data = await cached(key, () => tryJson(url));
    } catch {
      return;
    }
    if (++done % 25 === 0) saveCache();
    const pages = Object.values((data && data.query && data.query.pages) || {})
      .filter((p) => pickableFile(p.title))
      .filter((p) => {
        const em = (((p.imageinfo || [])[0] || {}).extmetadata || {}).LicenseShortName;
        return classifyLicense(em && em.value);
      })
      .sort((a, b) => (a.title < b.title ? -1 : a.title > b.title ? 1 : 0));
    // Only a file whose own title names the item: a category also collects
    // strays (a techno loudspeaker filed under minimalist music).
    const pick = pages.find((p) => hasWords(p.title, m.label));
    if (!pick) return;
    m.file = pick.title.replace(/^File:/, '');
    m.confidence = 'medium';
    m.via = 'category';
  });
  saveCache();
  return { tried: done, of: todo.length };
}

// Round 2, traditions only. A genre item with no picture of its own: a
// photo of a performer whose Wikidata record names that genre (P136) as
// their only genre, from people and musical groups, so the genre is the one
// that defines them (a film composer with free jazz among three genres is
// not a free-jazz picture). The best-known such performer (most
// sitelinks) wins.
async function genrePerformers(matches) {
  const todo = Object.values(matches).filter((m) => !m.file && m.kind === 'tradition');
  const byGenre = {};
  const run = async (batch) => {
    const query =
      'SELECT ?genre ?p ?pLabel ?img ?links (COUNT(DISTINCT ?g2) AS ?ng) WHERE { VALUES ?genre { ' +
      batch.map((q) => 'wd:' + q).join(' ') +
      ' } ?p wdt:P136 ?genre ; wdt:P18 ?img ; wikibase:sitelinks ?links ; wdt:P136 ?g2 .' +
      ' { ?p wdt:P31 wd:Q5 } UNION { ?p wdt:P31/wdt:P279* wd:Q215380 }' +
      ' SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } }' +
      ' GROUP BY ?genre ?p ?pLabel ?img ?links';
    let data;
    try {
      data = await cached('performers:' + batch.join('|'), () =>
        getJson(
          'https://query.wikidata.org/sparql?format=json',
          0,
          'query=' + encodeURIComponent(query)
        )
      );
    } catch {
      if (batch.length < 2) return;
      const mid = batch.length >> 1;
      await run(batch.slice(0, mid));
      return run(batch.slice(mid));
    }
    for (const b of data.results.bindings) {
      if (Number(b.ng.value) > 1) continue;
      (byGenre[b.genre.value.replace(/^.*\//, '')] ||= []).push({
        qid: b.p.value.replace(/^.*\//, ''),
        label: b.pLabel && b.pLabel.value,
        links: Number(b.links.value),
        file: decodeURIComponent(b.img.value.replace(/^.*\/Special:FilePath\//, '')),
      });
    }
    saveCache();
  };
  for (const batch of chunk([...new Set(todo.map((m) => m.qid))], 25)) await run(batch);
  let found = 0;
  for (const m of todo) {
    const ps = (byGenre[m.qid] || [])
      .filter((p) => pickableFile(p.file) && !/^Q\d+$/.test(p.label || 'Q0'))
      .sort((a, b) => b.links - a.links || (a.qid < b.qid ? -1 : 1));
    if (!ps.length) continue;
    m.file = ps[0].file;
    m.confidence = 'medium';
    m.via = 'performer';
    m.label = ps[0].label + ' (' + m.label + ' performer)';
    found++;
  }
  return { found, of: todo.length };
}

// Commons appends utm_* tracking parameters to file URLs; drop them.
function stripTracking(u) {
  return u && u.replace(/\?utm_[^#]*$/, '');
}

async function commonsInfo(files) {
  const out = {};
  for (const batch of chunk([...new Set(files)], 50)) {
    const url =
      'https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo' +
      '&iiprop=url|extmetadata&iiextmetadatafilter=LicenseShortName|Artist|Credit' +
      '&iiurlwidth=' +
      THUMB_WIDTH +
      '&titles=' +
      encodeURIComponent(batch.map((f) => 'File:' + f).join('|'));
    let data;
    try {
      data = await cached('ii:' + batch.join('|'), () => getJson(url));
    } catch {
      continue; // one batch lost to rate limiting; the rest still count
    }
    const q = data.query || {};
    // Map normalized titles back to the P18 spelling.
    const back = {};
    for (const n of q.normalized || []) back[n.to] = n.from;
    for (const p of Object.values(q.pages || {})) {
      const ii = (p.imageinfo || [])[0];
      if (!ii) continue;
      const em = ii.extmetadata || {};
      const title = (back[p.title] || p.title).replace(/^File:/, '');
      out[title.replace(/_/g, ' ')] = {
        license_raw: (em.LicenseShortName && em.LicenseShortName.value) || '',
        author: stripHtml((em.Artist && em.Artist.value) || (em.Credit && em.Credit.value) || ''),
        image_url: stripTracking(ii.url),
        thumb_url: stripTracking(ii.thumburl || ii.url),
        source_page: ii.descriptionurl,
      };
    }
  }
  return out;
}

const SOURCE_BY_VIA = {
  depicts: 'commons_depicts',
  category: 'commons_category',
  performer: 'wikidata_performer',
};

async function viaWikidata(entities, skipped) {
  const results = {};
  let matches;
  try {
    matches = await wikidataMatches(entities);
    const c = await commonsCategory(matches);
    console.error(`commons category fallback: ${c.tried}/${c.of} categories read`);
    const d = await commonsDepicts(matches);
    console.error(`commons depicts fallback: ${d.tried}/${d.of} items looked up`);
    const g = await genrePerformers(matches);
    console.error(`genre performer fallback: ${g.found}/${g.of} traditions`);
  } catch (e) {
    skipped.push({ source: 'wikidata', reason: e.message });
    return results;
  } finally {
    saveCache();
  }
  let info;
  try {
    info = await commonsInfo(
      Object.values(matches)
        .map((m) => m.file)
        .filter(Boolean)
    );
  } catch (e) {
    skipped.push({ source: 'wikimedia_commons', reason: e.message });
    return results;
  }
  for (const [key, m] of Object.entries(matches)) {
    if (!m.file) continue;
    const meta = info[m.file.replace(/_/g, ' ')];
    const license = meta && classifyLicense(meta.license_raw);
    if (!license) continue;
    results[key] = {
      source: SOURCE_BY_VIA[m.via] || 'wikidata_commons',
      wikidata: m.qid,
      source_page: meta.source_page,
      image_url: meta.image_url,
      thumb_url: meta.thumb_url,
      license,
      license_raw: meta.license_raw,
      credit: meta.author || 'Wikimedia Commons contributor',
      match_confidence: m.confidence,
      matched_label: m.label,
    };
  }
  return results;
}

// ---- Source 2: Met Open Access (Musical Instruments = department 18) ----
async function viaMet(entities, skipped) {
  const results = {};
  try {
    await pool(entities, opts.concurrency, async (e) => {
      for (const cand of allCandidates(e)) {
        const url =
          'https://collectionapi.metmuseum.org/public/collection/v1/search?departmentId=18&hasImages=true&q=' +
          encodeURIComponent(cand);
        const s = await cached('met:' + cand, () => tryJson(url));
        const ids = ((s && s.objectIDs) || []).slice(0, 5);
        for (const id of ids) {
          const o = await cached('meto:' + id, () =>
            tryJson('https://collectionapi.metmuseum.org/public/collection/v1/objects/' + id)
          );
          // Confident only when the object's own name is the instrument name.
          if (!o || !o.isPublicDomain || !o.primaryImage) continue;
          if (norm(o.objectName) !== norm(cand)) continue;
          results[e.key] = {
            source: 'met_open_access',
            source_page: o.objectURL,
            image_url: o.primaryImage,
            thumb_url: o.primaryImageSmall || o.primaryImage,
            license: 'CC0',
            license_raw: 'Public Domain (Met Open Access, CC0)',
            credit: o.creditLine
              ? 'The Metropolitan Museum of Art, ' + o.creditLine
              : 'The Metropolitan Museum of Art',
            match_confidence: cand === allCandidates(e)[0] ? 'medium' : 'low',
            matched_label: o.title || o.objectName,
          };
          return;
        }
      }
    });
  } catch (e) {
    skipped.push({ source: 'met_open_access', reason: e.message });
  } finally {
    saveCache();
  }
  return results;
}

// ---- Source 3: Smithsonian Open Access (SI_API_KEY, else api.data.gov's
// DEMO_KEY, which allows a few dozen calls an hour: the first refusal ends
// the pass and the cache keeps what was read) ----
async function viaSmithsonian(entities, skipped) {
  const key = process.env.SI_API_KEY || 'DEMO_KEY';
  const results = {};
  try {
    await pool(entities, key === 'DEMO_KEY' ? 1 : opts.concurrency, async (e) => {
      const q = `"${e.name}" AND online_media_type:"Images" AND unit_code:"NMAH"`;
      const url =
        'https://api.si.edu/openaccess/api/v1.0/search?rows=5&api_key=' +
        key +
        '&q=' +
        encodeURIComponent(q);
      const data = await cached('si:' + e.name, async () => {
        const res = await fetch(url, { headers: { 'User-Agent': UA } });
        if (res.status === 429 || res.status === 403) throw new Error('http_' + res.status);
        return res.ok ? res.json() : null;
      });
      for (const row of (data && data.response && data.response.rows) || []) {
        if (norm(row.title) !== norm(e.name)) continue;
        const media =
          row.content &&
          row.content.descriptiveNonRepeating &&
          row.content.descriptiveNonRepeating.online_media;
        const m = media && (media.media || []).find((x) => x.usage && x.usage.access === 'CC0');
        if (!m) continue;
        results[e.key] = {
          source: 'smithsonian_open_access',
          source_page: row.content.descriptiveNonRepeating.record_link || m.guid || m.content,
          image_url: m.content,
          thumb_url: m.thumbnail || m.content,
          license: 'CC0',
          license_raw: 'CC0',
          credit: row.content.descriptiveNonRepeating.data_source || 'Smithsonian Institution',
          match_confidence: 'medium',
          matched_label: row.title,
        };
        return;
      }
    });
  } catch (e) {
    skipped.push({ source: 'smithsonian_open_access', reason: e.message });
  } finally {
    saveCache();
  }
  return results;
}

// ---- Title matching for museum records ----
// A record matches when one part of its title ("Lute or Tiorbino",
// "Moon Lute (Yueqin)", "Sitar, Musikinstrument") is the candidate name.
function titleParts(t) {
  return String(t || '')
    .split(/\s*(?:[(),/;:]|\bor\b)\s*/i)
    .map(norm)
    .filter(Boolean);
}
function titleMatches(title, cand) {
  return titleParts(title).includes(norm(cand));
}

// Europeana rights URIs -> short license names (open ones only).
function licenseFromUri(u) {
  u = String(u || '');
  if (/publicdomain\/zero/.test(u)) return 'CC0';
  if (/publicdomain\/mark/.test(u)) return 'Public Domain';
  if (/licenses\/by-sa\//.test(u)) return 'CC BY-SA';
  if (/licenses\/by\//.test(u)) return 'CC BY';
  return null;
}

// ---- Source 4: Cleveland Museum of Art Open Access (CC0, no key) ----
async function viaCleveland(entities, skipped) {
  const results = {};
  try {
    await pool(entities, opts.concurrency, async (e) => {
      const cands = allCandidates(e);
      for (const cand of cands) {
        const url =
          'https://openaccess-api.clevelandart.org/api/artworks/?cc0=1&has_image=1' +
          '&type=Musical%20Instrument&limit=20&q=' +
          encodeURIComponent(cand);
        const d = await cached('cma:' + cand, () => tryJson(url));
        const a = ((d && d.data) || []).find(
          (x) => x.share_license_status === 'CC0' && titleMatches(x.title, cand)
        );
        const img = a && a.images && (a.images.web || a.images.print);
        if (!img) continue;
        results[e.key] = {
          source: 'cleveland_open_access',
          source_page: a.url,
          image_url: (a.images.print || a.images.web).url,
          thumb_url: img.url,
          license: 'CC0',
          license_raw: 'CC0 (Cleveland Museum of Art Open Access)',
          credit: 'The Cleveland Museum of Art' + (a.creditline ? ', ' + a.creditline : ''),
          match_confidence: cand === cands[0] ? 'medium' : 'low',
          matched_label: a.title,
        };
        return;
      }
    });
  } catch (e) {
    skipped.push({ source: 'cleveland_open_access', reason: e.message });
  } finally {
    saveCache();
  }
  return results;
}

// Europeana titles cross languages ("timpani" is also Italian for a door
// tympanum), so a record must be catalogued as a musical instrument: a MIMO
// (Hornbostel-Sachs) concept, or a concept label naming an instrument.
function isInstrumentRecord(x) {
  if ((x.edmConcept || []).some((c) => /mimo-db\.eu/.test(c))) return true;
  return (x.edmConceptLabel || []).some((l) =>
    /instrument|soitin|инструмент/i.test(String(l && l.def))
  );
}

// ---- Source 5: Europeana (open-reuse images; EUROPEANA_KEY, else the
// public demo key) ----
async function viaEuropeana(entities, skipped) {
  const results = {};
  const key = process.env.EUROPEANA_KEY || 'api2demo';
  try {
    await pool(entities, opts.concurrency, async (e) => {
      const cands = allCandidates(e);
      for (const cand of cands) {
        const url =
          'https://api.europeana.eu/record/v2/search.json?reusability=open&qf=TYPE%3AIMAGE' +
          '&rows=20&wskey=' +
          key +
          '&query=' +
          encodeURIComponent('title:"' + cand + '"');
        const d = await cached('eu:' + cand, () => tryJson(url));
        const a = ((d && d.items) || []).find(
          (x) =>
            isInstrumentRecord(x) &&
            (x.title || []).some((t) => titleMatches(t, cand)) &&
            licenseFromUri((x.rights || [])[0]) &&
            (x.edmIsShownBy || x.edmPreview)
        );
        if (!a) continue;
        const rights = (a.rights || [])[0];
        results[e.key] = {
          source: 'europeana',
          source_page: stripTracking(a.guid),
          image_url: (a.edmIsShownBy || a.edmPreview)[0],
          thumb_url: (a.edmPreview || a.edmIsShownBy)[0],
          license: licenseFromUri(rights),
          license_raw: rights,
          credit: ((a.dataProvider || [])[0] || 'Europeana') + ' via Europeana',
          match_confidence: cand === cands[0] ? 'medium' : 'low',
          matched_label: (a.title || [])[0],
        };
        return;
      }
    });
  } catch (e) {
    skipped.push({ source: 'europeana', reason: e.message });
  } finally {
    saveCache();
  }
  return results;
}

// ---- Round 2 source: Commons full-text search per catalog name ----
// Entities nothing else matched. A photo counts only when its own title AND
// its own categories name the thing, and its categories are about music, so a village or a surname sharing the name
// never passes. Commons throttles hard: the pass runs under a time budget
// (--search-minutes) and caches, so a rerun continues where it stopped.
const MUSICAL =
  /\b(music\w*|musical instruments?|instruments?|drums?|percussion|lutes?|fiddles?|flutes?|guitars?|harps?|zithers?|violins?|horns?|trumpets?|oboes?|bagpipes?|singers?|singing|songs?|bands?|orchestras?|ensembles?|concerts?|festivals?|musicians?|performers?|dances?)\b/i;
async function viaCommonsSearch(entities, skipped) {
  const results = {};
  const deadline = Date.now() + opts.searchMinutes * 60000;
  try {
    await pool(entities, 2, async (e) => {
      const primary = nameCandidates(e.name);
      const cands = [...new Set([...primary, ...(e.short ? nameCandidates(e.short) : [])])];
      for (const cand of cands) {
        const key = 'cs:' + cand;
        if (!(key in cache) && Date.now() > deadline) return;
        const url =
          'https://commons.wikimedia.org/w/api.php?action=query&format=json' +
          '&generator=search&gsrnamespace=6&gsrlimit=10&gsrsearch=' +
          encodeURIComponent('intitle:"' + cand + '" filetype:bitmap') +
          '&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=' +
          THUMB_WIDTH +
          '&iiextmetadatafilter=LicenseShortName|Artist|Credit|Categories';
        let data;
        try {
          data = await cached(key, () => tryJson(url));
        } catch {
          return;
        }
        const pages = Object.values((data && data.query && data.query.pages) || {}).sort(
          (a, b) => (a.index || 0) - (b.index || 0)
        );
        for (const p of pages) {
          const ii = (p.imageinfo || [])[0];
          if (!ii || !pickableFile(p.title) || !/\.jpe?g$/i.test(p.title)) continue;
          if (!hasWords(p.title, cand)) continue;
          const em = ii.extmetadata || {};
          const license_raw = (em.LicenseShortName && em.LicenseShortName.value) || '';
          const license = classifyLicense(license_raw);
          if (!license) continue;
          const cats = String((em.Categories && em.Categories.value) || '').replace(/\|/g, ' | ');
          if (!hasWords(cats, cand) || !MUSICAL.test(cats)) continue;
          results[e.key] = {
            source: 'commons_search',
            source_page: ii.descriptionurl,
            image_url: stripTracking(ii.url),
            thumb_url: stripTracking(ii.thumburl || ii.url),
            license,
            license_raw,
            credit:
              stripHtml((em.Artist && em.Artist.value) || (em.Credit && em.Credit.value) || '') ||
              'Wikimedia Commons contributor',
            match_confidence: cand === primary[0] ? 'medium' : 'low',
            matched_label: p.title.replace(/^File:/, ''),
          };
          return;
        }
      }
    });
  } catch (e) {
    skipped.push({ source: 'commons_search', reason: e.message });
  } finally {
    saveCache();
  }
  return results;
}

// ---- Source 6: Openverse (no key; anonymous callers get 200 requests a
// day, so it spends at most --openverse-budget uncached lookups per run) ----
const OV_LICENSE = { cc0: 'CC0', pdm: 'Public Domain', by: 'CC BY', 'by-sa': 'CC BY-SA' };
async function viaOpenverse(entities, skipped) {
  const results = {};
  let budget = opts.openverseBudget;
  try {
    for (const e of entities) {
      const cand = nameCandidates(e.name)[0];
      if (!cand) continue;
      const q = e.kind === 'tradition' ? cand + ' music' : cand;
      const key = 'ov:' + q;
      if (!(key in cache)) {
        if (budget <= 0) break;
        budget--;
        await sleep(3100); // anonymous burst limit: 20/min
      }
      const url =
        'https://api.openverse.org/v1/images/?license=cc0,pdm,by,by-sa&page_size=20&mature=false&q=' +
        encodeURIComponent(q);
      let d;
      try {
        d = await cached(key, () => getJson(url));
      } catch (err) {
        if (/http_429|http_401|http_403/.test(err.message)) {
          skipped.push({ source: 'openverse', reason: err.message + ' (daily limit)' });
          break;
        }
        continue;
      }
      // The title has to name the thing, not just sit near it in search:
      // it starts with the name ("Samul nori", "Koto by ...") or says
      // "<name> music". A name buried mid-title ("Tango footwork", "Ravel
      // Bolero", "#Kompa") matched unrelated photos in the audit.
      const n = norm(cand);
      const hit = ((d && d.results) || []).find((r) => {
        const t = norm(r.title);
        return (
          OV_LICENSE[r.license] &&
          (t === n || t.startsWith(n + ' ') || (' ' + t + ' ').includes(' ' + n + ' music '))
        );
      });
      if (!hit) continue;
      results[e.key] = {
        source: 'openverse',
        source_page: hit.foreign_landing_url,
        image_url: stripTracking(hit.url),
        thumb_url: hit.thumbnail || hit.url,
        license: OV_LICENSE[hit.license],
        license_raw: (hit.license + ' ' + (hit.license_version || '')).trim(),
        credit: (hit.creator || 'Unknown') + ' via ' + (hit.source || hit.provider || 'Openverse'),
        match_confidence: 'low',
        matched_label: hit.title,
      };
    }
  } finally {
    saveCache();
  }
  return results;
}

// ---- Reviewed rejections ----
// Matches a manual accuracy pass found wrong: the image does not show the
// named instrument or tradition (a logo, map or place; a different
// instrument or genre; or nothing that can be confirmed). Keyed by entity,
// valued by the rejected image's file name, so a regeneration drops the
// same pick again but still takes a different image for that entity. A
// list rejects several picks for one entity. Round 3 also lists files a
// reviewer refused before they became entries, and files whose licence is
// not allowed or not yet confirmed on Commons ("License review needed").
// Commons depicts (P180) fallbacks, alias-matched Wikidata items, museum
// title matches and Openverse hits are not verified here; review new ones.
const REJECTED = {
  'instrument:acoustic_resonator_steel': 'Steel_guitar-KayEss.1.jpeg',
  'instrument:bandola_andina': ['Bandolallanera.jpg', 'Bandola_dusepo.jpg'],
  'instrument:barrel_organ': 'Barrel_piano_-_Λατέρνα(laterna).JPG',
  'instrument:bass_vi':
    'The_Fool_SG_(1964_Gibson_SG)_played_by_Eric_Clapton,_and_The_Fool_Bass_VI_(1962_Fender_Bass_VI)_played_by_Jack_Bruce_-_both_painted_in_1967_by_The_Fool_Collective_-_Play_It_Loud._MET_(2019-05-13_19.29.06_by_Eden,_Janine_and_Jim).jpg',
  'instrument:bassanello': 'Guizza_foto_storica_chiesa_Bassanello_vista_aerea.jpg',
  'instrument:been_snake_charmer': ['Rudraveena1.JPG', "Si's_Been_Drinking_Cider_1.jpg"],
  'instrument:brass_band_british':
    'Scott_Black_and_David_Sager,_Carnival_Time_1991,_Uptown_New_Orleans.jpg',
  'instrument:burundi_royal_drums':
    'Bundesarchiv_Bild_105-DOA0543,_Deutsch-Ostafrika,_Ngoma-Schlagen.jpg',
  'instrument:byzantine_lyra': 'Gdulka-bow_copy.jpg',
  'instrument:capoeira_roda': 'Capoeira,_Brazils.png',
  'instrument:castanets': [
    'default.jpg',
    'Woman_dancing_with_castanets_or_zill,_Qajar_Iran,19th_century.jpg',
  ],
  'instrument:cencerro': 'Tuned_Chromatic_Cowbells_(from_Emil_Richards_Collection).jpg',
  'instrument:contrabass_oboe': [
    "Contrabass_oboe's_range.png",
    'Contrabass_oboe_from_V.Volkov_ManiFEST_@_Erarta,_St_Petersburg,_Russia,_2016.01.08.jpg',
  ],
  'instrument:cornemuse_du_centre': '89.4.861 Cornemuse .jpg',
  'instrument:cornet': '8a55c0382a904e3eac317bd76dcedc5e.jpg',
  'instrument:crotales': 'Cymbales-E_12567-img_2793.jpg',
  'instrument:cuatro_pr': 'Cuatro_Ramon_Blanco.jpg',
  'instrument:dan_tam_thap_luc': 'Hammered_dulcimer.JPG',
  'instrument:darbuka':
    'Doumbek_Drum_with_Mimbres_style_geometric_design,_undergoing_(2003-01-01_by_Mark_Helms).jpg',
  'instrument:dayereh': 'Daf-Khalaj.jpg',
  'instrument:dhol': 'Armenian_Dhol.jpg',
  'instrument:drumline_dci': 'US_Army_Old_Guard_Fife_and_Drum_Corps,_Waterfire_2.jpg',
  'instrument:dyas_tapu_patu': '02349wsaPuMU?dimension=1200x1200',
  'instrument:fiddle': [
    '1918.381_print.jpg',
    'originaal?id=fe7aeb84-ad51-4ef2-a992-eccde92163d8',
    'Bow_Fiddle_Rock_East.jpg',
  ],
  'instrument:furulya': 'Furulya_001.jpg',
  'instrument:fyell': 'Fyell.jpg',
  'instrument:gaita_colombiana': 'Gaita_galega.jpg',
  'instrument:gaku_biwa': '곡경비파_(2).JPG',
  'instrument:gamelan_balinese_full': 'dia-1980.09.0009.A-001.jpg',
  'instrument:gamelan_javanese_full': [
    'dia-1980.09.0009.A-001.jpg',
    'Yogyakarta_Indonesia_Gamelan-players-with-gendèr-01.jpg',
  ],
  'instrument:gender': '1968.07.0001a.jpg',
  'instrument:gijak_turkmen': 'Ghaychak.jpg',
  'instrument:griot_voice': 'Balafon_griot_(1).jpg',
  'instrument:gypsy_jazz_quintet': 'Tony_Green_Gypsy_Jazz_Trio.jpg',
  'instrument:handbells': 'CAMPA1965.JPG',
  'instrument:harmonium_indian': [
    '134286.jpg',
    '0331wTuAoqHH?dimension=1200x1200',
    'Harmonium_repair.jpg',
  ],
  'instrument:harpa': 'zoom',
  'instrument:hydraulis': 'Paseo_de_la_Guarania.png',
  'instrument:irish_wooden_flute': 'Charles_Nicholson00.jpg',
  'instrument:jazz_trio_piano': 'Hermitage_Piano_Trio_.jpg',
  'instrument:kalangu': 'Afrobeats_Molo_strings.jpg',
  'instrument:karna_trumpet': 'DP-12679-025.jpg',
  'instrument:kawala': 'Kawala.jpg',
  'instrument:kempyang': 'Wayang_Ruwatan_by_Anom_Harya.jpg',
  'instrument:kenong': 'Karawitan_Junior.jpg',
  'instrument:kidi': 'Kidi_&_Cina_Soul_at_3_Music_Awards_22_49.jpg',
  'instrument:kolisna_lira':
    'Chiesa_di_San_Maurizio_-_Museo_della_Musica_in_Venice_-_Ghironda_1850_.jpg',
  'instrument:kompang_frame_drum': 'YosriKompang.jpg',
  'instrument:konnakol': 'Lori_Cotler,_konnakol_singer.jpg',
  'instrument:kuzhal': 'The_Tribal_Triumph.jpg',
  'instrument:lokanga_bara': 'bild-1913.06.0003.jpg',
  'instrument:marimba_centroamericana': 'Esmeraldian_(Afro-Ecuadorian)_marimba.jpg',
  'instrument:marimba_orchestral': [
    'Esmeraldian_(Afro-Ecuadorian)_marimba.jpg',
    'MUS805A.jpg',
    'zoom',
  ],
  'instrument:medieval_psaltery': 'Chiesa_di_San_Maurizio_-_Salterio_-_Scuola_Veniziana_-_1700.jpg',
  'instrument:melodeon_diatonic': ['New_Haven_Melodeon,_Mission_Mill_Museum.jpg', '134275.jpg'],
  'instrument:mey': 'Reinhard-Mey-Jahrhunderthalle-Frankfurt-01.jpg',
  'instrument:mortar_pestle': 'Mortar_and_pestle_02.jpg',
  'instrument:nafiri_trumpet':
    'COLLECTIE_TROPENMUSEUM_Messingen_hoorn_gebruikt_gedurende_de_islamitische_vastenmaand_TMnr_4438-1a.jpg',
  'instrument:naghara_azerbaijani': 'Nagara,_MDMB_945.jpg',
  'instrument:organistrum':
    'Chiesa_di_San_Maurizio_-_Museo_della_Musica_in_Venice_-_Ghironda_1850_.jpg',
  'instrument:ottavino_virginal': 'Caravaggio_Ottavino.jpg',
  'instrument:pibgorn': 'Welshbagpipe.jpg',
  'instrument:pyeonjong': 'Bianzhong.jpg',
  'instrument:quern_grindstone': 'MM+19490(1).jpg',
  'instrument:rabel_castellano': [
    'Encuentro_homenaje_en_Valdeolea.jpg',
    'Elder_with_plucked_rabel,_Santo_Domingo_de_Soria.jpg',
  ],
  'instrument:rebab': ['DP252791.jpg', 'image.jpg', 'Britannica_Rebab_Boat-shaped_Rebab.jpg'],
  'instrument:riq': 'Pair_of_dafs.jpg',
  'instrument:sahnai': 'Shehnai.jpg',
  'instrument:sambuca_ancient': 'Fresco_of_women_listening_to_a_private_musical_performance.jpg',
  'instrument:sanj':
    'Musicians_of_the_Akbar\'s_naqqāra-khāna,_from_painting_"An_Attempt_on_Akbar\'s_Life"-Akbarnama.jpg',
  'instrument:santur': 'Greek_Santur.jpg',
  'instrument:scottish_pipe_band':
    'Photo_-_Festival_de_Cornouaille_2011_-_Stockbridge_Pipe_Band_en_concert_le_22_juillet_-_007.jpg',
  'instrument:selonding': 'Traditional_indonesian_instruments04.jpg',
  'instrument:semi_hollow_bass': [
    'GMFT3-2_piles_of_semi-hollow_bodies,_in_work_in_process.jpg',
    'PRS_SE_Custom_Semi-Hollow_-_body.jpg',
  ],
  'instrument:seven_string_electric': 'Seven-string-guitar.jpg',
  'instrument:shabbaba': 'midp89.4.444.jpg',
  'instrument:shawm': 'MUS478A5.jpg',
  'instrument:shudraga': 'Mongolian_lute,_circa_1279-1368,_Tomb_of_Wang_Qing.jpg',
  'instrument:simbi_harp': 'Simbi_Kali_at_the_2025_Sundance_Film_Festival_2_(cropped).jpg',
  'instrument:siter': 'Traditional_indonesian_stringed_instrument.jpg',
  'instrument:sogeum': '소금_(Sogeum).jpg',
  'instrument:spinet_keyboard': 'Farfisa_Foyer_spinet_organ_-_hammered_by_smoker_(B&W).jpg',
  'instrument:string_quartet_inst': 'Vocalion_October_1925_Kutcher_String_Quartet.jpg',
  'instrument:tabl_baladi': '203609.jpg',
  'instrument:tambura_balkan': [
    'DP-24037-001.jpg',
    'Indian_string_instruments_-_Saravati_vina,_Bin_or_Rudra_veena,_Esraj_or_Diltuba,_Tambura,_Fiddle_or_Violin,_Sitar,_Surbahar,_Sarangi,_Tambura_-_Harmonium,_Tabla_-_MIM_Brussels_(2018-05-26_10.41.21_by_Miguel_Discart_@Flickr_46273431562).jpg',
  ],
  'instrument:tanbur_maltese': ['midp89.4.1384.jpg', '1918.347_print.jpg'],
  'instrument:tar_azerbaijani': 'DP-26166-003.jpg',
  'instrument:tar_frame_drum': ['Tār_MET_midp89.4.1858.jpg', 'midp89.4.1858.jpg'],
  'instrument:tekero': 'Chiesa_di_San_Maurizio_-_Museo_della_Musica_in_Venice_-_Ghironda_1850_.jpg',
  'instrument:tilinca': 'f39862d97cfc43a99c4150501a9be23a.jpg',
  'instrument:tinde': 'Tindé_Ber_6.jpg',
  'instrument:tingsha': 'Tingsha.jpg',
  'instrument:tiorba': 'Barocktheorbe_Martin_Hoffmann_ed.JPG',
  'instrument:tro_sau': 'Cambodia56.jpg',
  'instrument:trumpet': 'MUS1129A.jpg',
  'instrument:tsenatsil': 'Sistrum_of_the_Chantress_Tapenu_MET_68.44_EGDP019207.jpg',
  'instrument:tubular_bells': 'Windchimes_02.jpg',
  'instrument:veena': [
    'Icon_of_person_playing_Indian_instrument_Veena.svg',
    'Woman_with_veena,_Crafts_Museum,_New_Delhi,_India.jpg',
  ],
  'instrument:vihuela_de_mano': 'Libro_de_mvsica_de_vihuela_de_mano_1536.jpg',
  'instrument:villu_pattu_bow': 'ഓണവില്ല്_ഉപയോഗിച്ചുള്ള_പാട്ട്൧.resized.jpg',
  'instrument:vladimirskiy_rozhok': 'Рагаи_и_коленами.jpg',
  'instrument:wurlitzer_ep': 'Wurlitzer_4100_BW_product_plate.jpg',
  'instrument:xalam': 'Diffa_Niger_Griot_DSC_0177.jpg',
  'instrument:xylophone': [
    'MUS786A.jpg',
    '1949.15.0030.jpg',
    '(Xylophone)_Centro_Histórico_Quito.JPG',
  ],
  'instrument:yanggeum': 'Traditional_Korean_string_instrument,_Yanggeum_03.jpg',
  'instrument:zokra': 'Zournas.jpg',
  'tradition:afro_punk': 'Punks_SP.jpg',
  'tradition:afrobeat': [
    'Kalakuta_Queens.jpg',
    'Festival_de_la_musique_afrobeat_international_2024_26.jpg',
  ],
  'tradition:amapiano': 'Mr_Julz_photo.jpg',
  'tradition:american_political_hip_hop': 'Annarce2023.jpg',
  'tradition:anadolu_rock': ['The_shadows_2009_Brussels.JPG', 'Barış_Manço_cropped.JPG'],
  'tradition:anatolian_rock': 'The_shadows_2009_Brussels.JPG',
  'tradition:andean_matrimonio_huayno': 'Huayno_Carnaval_2008.jpg',
  'tradition:arabesk': 'Özcan_Deniz.jpg',
  'tradition:armenian_traditional': 'Bartok_recording_folk_music.jpg',
  'tradition:art_pop': 'Cowgirl_Clue.png',
  'tradition:asturian_gaita': 'Asturian_pipe.jpg',
  'tradition:atmospheric_black_metal': 'Wolves_In_The_Throne_Room_With_Full_Force_2018_27.jpg',
  'tradition:atmospheric_dnb': 'ISS042-E-219786_-_View_of_Earth.jpg',
  'tradition:austropop': 'I_AM_FROM_AUSTRIA_-_Das_Musical_in_Japan.jpg',
  'tradition:bachata': '10805456595_1fce3f7fa1_b.jpg',
  'tradition:bahraini_fjiri': 'Waterclothes.jpg',
  'tradition:banda_sinaloense':
    "Thales_Tkzin_na_extinta_banda_L'aventura_se_apresentando_na_Pré-Bienal_da_UBES_no_colégio_Floriano_Cavalcanti_em_2016.jpg",
  'tradition:barnmusik': 'Bild_av_Astrid_Lindgren_i_Blyge_Anton.jpg',
  'tradition:bassline': 'How_to_make_that_bassline_logo_honlapra.png',
  'tradition:bassline_uk': 'How_to_make_that_bassline_logo_honlapra.png',
  'tradition:bengali_folk_lokgeeti': 'Nargis_Akter.jpg',
  'tradition:bhangra_modern': 'Bhangra_Dance_Performed_by_Girls.jpg',
  'tradition:big_band': [
    'Dick_powell_-_publicity.JPG',
    'Whitemanband1921.jpg',
    'Bergen_Big_Band_1.jpg',
  ],
  'tradition:black_gospel_choir': 'Dartmouth_Gospel_Choir_at_the_Gospel_Brunch_(3232282945).jpg',
  'tradition:blue_note': 'Ravi_Coltrane_at_the_Blue_Note,_March_7,_2023-L1002389.jpg',
  'tradition:bomba': 'Tamborbomba.png',
  'tradition:bomba_puertorican': 'Tamborbomba.png',
  'tradition:borgeet_assamese': 'Sankaradeva.jpg',
  'tradition:bouncy_techno': 'ScottBrownTrooper_(cropped).jpg',
  'tradition:brass_band':
    'Honk_Fest_West_2015,_Georgetown,_Seattle_-_New_Creations_Brass_Band_12_(19081185021).jpg',
  'tradition:british_brass_band': 'Tanzania_Police_brass_band.jpg',
  'tradition:bronx_drill': 'Kay_Flock_in_2021.png',
  'tradition:brooklyn_drill': 'Pop_Smoke_2020.jpg',
  'tradition:bubblegum_pop': 'Travelling_funfair,_Bemmely_Hills.jpg',
  'tradition:bulgarian_dance_traditional': 'Coat_of_arms_of_Bulgaria.svg',
  'tradition:byzantine_chant':
    'Double_aulos_and_the_oksivafon,_detail_from_Vienna,_Österreichische_Nationalbibliothek,_Theol_Greek_31,_folio_17v,_6th_century.jpg',
  'tradition:c_pop': 'Chinese_music_icon.png',
  'tradition:cancion_melodica': '20170512,_Camilo_Sesto.jpg',
  'tradition:cantopop': [
    'Anita_Mui_Yim-fong_(梅艷芳)_Statue_at_Hong_Kong_Garden_of_Stars_(Ank_Kumar,_Infosys_Limited)_02.jpg',
    'Chow_Yun_Fat_2.JPG',
    'HKDemo_template_bare.jpg',
  ],
  'tradition:cape_breton_milling': 'Waulking_18th_century_engraving.jpg',
  'tradition:cape_verdean_batuko': 'Batucadeiras_do_Bairro_6_de_Maio,_Damaia,_Lisboa_-_1994.jpg',
  'tradition:caribbean_junkanoo': 'John_Canoe_Dancers_Jamaica_1975_Dec_ver06.jpg',
  'tradition:carnatic_instrumental': 'Tanjore-style_Carnatic_tambura.JPG',
  'tradition:carnatic_kacheri':
    'Stamp_of_India_-_1991_-_Colnect_164183_-_Ariyakudi_Ramanuja_Iyengar_-_Singer_and_Composer.jpeg',
  'tradition:ceilidh': 'St._Patrick’s_Festival_Céilí_(2011)_(5533276932).jpg',
  'tradition:celtic_folk_revival': 'Elizabeth_Davidson-Blythe.jpg',
  'tradition:cha_cha_cha': 'Uwe_Schmidt_Atom_Heart_Mutek_10.jpg',
  'tradition:champeta': '2025-07-06_15-03-41-Champeta-por-David-Ramirez-Ordonez.jpg',
  'tradition:champeta_cartagenera': '2025-07-06_15-03-41-Champeta-por-David-Ramirez-Ordonez.jpg',
  'tradition:chanson_classique': 'Mireille_Mathieu_Hamburg_1971_001.jpg',
  'tradition:charanga': 'La_Charanga_Mekanika_-_02.JPG',
  'tradition:chicago_soul': 'Curtis_Mayfield.png',
  'tradition:chicano_rap': 'ChicanoRap.jpg',
  'tradition:child_ballad_revival': 'Francis_Child_English_&_Scottish_Ballads,_1860.jpg',
  'tradition:chilean_nueva_cancion': 'Mercedes_Sosa,_1967.jpg',
  'tradition:chilean_rock': 'Los_Vanders_2020.jpg',
  'tradition:chilena': 'Jose_hernandez_bajista_del_grupo_dueño_y_fundador.jpg',
  'tradition:chinese_traditional_ensemble': 'Chinesezither.jpg',
  'tradition:christian_country': ['90.5_KJIC_Official_Logo.png', 'David_Leonard.png'],
  'tradition:classic_rb': 'John_Lee_Hooker_two.jpg',
  'tradition:classical': 'Sir_Earnest_MacMillan_Home_Toronto.jpg',
  'tradition:cologne_karneval': 'Dreigestirn_72.jpg',
  'tradition:compas_direk': 'Michel_Martelly_on_April_20,_2011.jpg',
  'tradition:conjunto': '1977_torres_de_almagro._jpg.webp',
  'tradition:copla_andaluza': 'Placa_Conmemorativa_Concha_Piquer_Gran_Via.jpg',
  'tradition:coptic_orthodox_chant': 'Coptic_cross.svg',
  'tradition:corridos_belicos': 'CLAZI.jpg',
  'tradition:country_gospel': ['90.5_KJIC_Official_Logo.png', 'David_Leonard.png'],
  'tradition:cowboy_song': [
    'Hank_Williams_Promotional_Photo.jpg',
    'Shalmali_Kholgade_at_TOIFA_2013.jpg',
  ],
  'tradition:cowboy_western': [
    'Hank_Williams_Promotional_Photo.jpg',
    'Roy_Rogers,_NPG_2000_21_(cropped).jpg',
  ],
  'tradition:cretan_lyra':
    'Childrens_musical_instruments_-_cretan_lyra_(1-3),_dhioli_(4._violin),_Museum_of_Greek_Folk_Musical_Instruments.jpg',
  'tradition:croatian_istrian_diaphonic':
    'Istrian_scale_Schubert_Symphony_No._8_in_B_minor_(1922),_1st_mvt.,_bars_13-20.png',
  'tradition:crunk': 'Jeffree_Star_crop.png',
  'tradition:cumbia_chilena': 'BANDA_RIO_CLARO.png',
  'tradition:cumbia_sonidera': 'Diálogo_abierto_Sonideros.jpg',
  'tradition:danzon': 'Zapatos_para_danzón,_03.jpg',
  'tradition:dark_ambient': 'Reznor_Ross_G5_setup_cropped_tight.jpg',
  'tradition:dark_ambient_industrial': 'Reznor_Ross_G5_setup_cropped_tight.jpg',
  'tradition:death_industrial': 'Brighter_Death_Now_Nocturnal_Culture_Night_13_2018_05.jpg',
  'tradition:denpa_kei': 'Oono_Marina_at_MARQUEE_20190608-trim02.jpg',
  'tradition:denpa_song': 'Oono_Marina_at_MARQUEE_20190608-trim02.jpg',
  'tradition:desi_trap': 'Badshah_snapped_on_the_sets_of_Dance_India_Dance_(cropped).jpg',
  'tradition:dizi': 'Dizi(F).jpg',
  'tradition:donsongoni_hunter_harp': 'Bassekou_Kouyate_photo.jpg',
  'tradition:downtempo': 'Popovka,_Kazantip,_Crimea,_Sunset_party.jpg',
  'tradition:drill': 'Forja_&_Sonido.png',
  'tradition:drill_espanol': 'Morad_December_2023.jpg',
  'tradition:drum_corps': 'Les_Frères_Guèdèhounguè_en_concert_traditionnel_au_Bénin_01.jpg',
  'tradition:drumstep': 'Permutation.jpg',
  'tradition:dub_techno': 'Mike_Sheridan_(2012).jpg',
  'tradition:early_romantic_19c':
    'Jean-Nicolas_Grobert_-_Early_Romantic_Guitar,_Paris_around_1830.jpg',
  'tradition:electro': ['Electrograph.png', 'Electro-Harmonix_2.jpg'],
  'tradition:emotional_hardcore': 'Guy_Picciotto.jpg',
  'tradition:english_broadside_revival': 'Skillingtryck_1583_KB_1995_a.tif',
  'tradition:english_nursery_rhyme':
    'Albert_Anker_-_Junge_Mutter,_bei_Kerzenlicht_ihr_schlafendes_Kind_betrachtend.jpg',
  'tradition:environmental_music':
    "Edison's_Children_-_Eric_Blackwood_(Eric_Pastore)_-_NASA_Photo_1_-_Simon_Lowery.jpg",
  'tradition:ethereal_wave': "Symphony_of_Us,_Love's_Chosen_tune.jpg",
  'tradition:ethiopian_eskista_wedding': 'הפרויקט_של_יוהנס_במופע_בחג_הסיגד_בנשר_34.jpg',
  'tradition:festejo': [
    'De_la_serie_Mojigangas_de_Alvarado_3.tif',
    'Plaza_de_toros_de_Hervas_1.jpg',
  ],
  'tradition:festejo_afroperuano': [
    'De_la_serie_Mojigangas_de_Alvarado_3.tif',
    'Plaza_de_toros_de_Hervas_1.jpg',
  ],
  'tradition:flamenco_solea': 'Compás_soleá.jpg',
  'tradition:fluxus_intermedia': 'Maciunas.png',
  'tradition:folk_noir': ['Sol_Invictus_Live.jpg', '20160819_Mülheim_BurgFolk_Folk_Noir_0145.jpg'],
  'tradition:folklore_chileno': 'Parra01f.PNG',
  'tradition:folklore_paraguayo': 'Jose-asuncion-flores.jpg',
  'tradition:footwork': '7771148116_f3b47e9283_b.jpg',
  'tradition:freestyle': [
    'Exhibición_de_Deportes_Urbanos_-_evento_(23).jpg',
    'TonyMoran3.WP07.BeachParty.SBM.FL.04ma07.jpg',
  ],
  'tradition:freestyle_house': 'Todd_Terry,_2012.png',
  'tradition:freestyle_music': 'Exhibición_de_Deportes_Urbanos_-_evento_(23).jpg',
  'tradition:french_baroque': 'Tremblement_dans_sonateVI_Hotteterre.jpg',
  'tradition:french_berceuse': 'François_Riss_Lullaby.jpg',
  'tradition:funk_metal': 'Sugar_Ray.jpg',
  'tradition:fusion': '12348323204_a3b7c94021_b.jpg',
  'tradition:gaita_zuliana': 'Omar_Prieto.jpg',
  'tradition:galician_kantautor': 'Taylor_Swift_103_(18118974610).jpg',
  'tradition:garage_house_paradise': 'Rock_en_Seine_2007,_Just_Jack.jpg',
  'tradition:garage_rock': "17_bv_de_l'Hôtel_de_ville,_Vichy_-_porte_de_garage_rock_&_love_.jpg",
  'tradition:garage_rock_revival_2000s': 'Franz-ferdinand-live-2006-tag.jpg',
  'tradition:girl_group_60s': 'SPIRAL.jpg',
  'tradition:glitchcore': 'Roblox.jpg',
  'tradition:gqom':
    '77tunes_Home_of_Hiphop_Music,_News,_Gqom,_Afro_House,_Amapiano,_Hiphopza,_Zamusic,_Fakaza_Music_SaHipHop_&_Entertainment.jpg',
  'tradition:grand_opera_french': 'Sissieretta_Jones.jpg',
  'tradition:gulf_and_western': 'Hank_Williams_Promotional_Photo.jpg',
  'tradition:haitian_vodou': 'VoodooValris.jpg',
  'tradition:harmonica_blues': 'Little_Walter.JPG',
  'tradition:hawaiian_hip_hop': 'Flag_of_Hawaii.svg',
  'tradition:hawaiian_oli_mele': 'Hula_Kahiko_Hawaii_Volcanoes_National_Park_01.jpg',
  'tradition:hindu_stuti_bhajan': 'Banjara_Bhajan_Songs.jpg',
  'tradition:hindustani_sarod': [
    'Ashwini_Bhide-Deshpande_(Hindustani_classical_music_vocalist)_01.JPG',
    'Bismillah_at_Concert1_(edited).jpg',
    'Photoshoot_with_Rishab_Rikhiram_Sharma_02.jpg',
  ],
  'tradition:hokkien_pop': 'Amei20201231.jpg',
  'tradition:house': 'CERVEJARIA_DO_GORDO.jpg',
  'tradition:houston_chopped_screwed': 'Og_ron_c_450x300_1_(1).jpg',
  'tradition:hungarian_cimbalom_trad': 'Bikkessy_Heinbucher_Verbunkos_dudás.jpg',
  'tradition:hungarian_folk': 'Psztatrupp1.jpg',
  'tradition:impressionism': 'Martial_Caillebotte.jpg',
  'tradition:impressionist_art_music': 'Martial_Caillebotte.jpg',
  'tradition:indian_holi_diwali_processional': 'Holi_Celebration_Huranga.jpg',
  'tradition:indietronica': 'Cowgirl_Clue.png',
  'tradition:industrial_hardcore': 'Kelly_van_Soest1.jpg',
  'tradition:iraqi_maqam': 'مقتنيات_الفنان_اسماعيل_الفحّام.jpg',
  'tradition:irish_pub_song': 'Drinking-_song_-_Zichy,_Mihály_-_1874.jpg',
  'tradition:iskelma': 'Und_abends_in_die_Scala.jpg',
  'tradition:islamic_recitation_mujawwad': 'A_Musical_Gathering_-_Ottoman,_18th_century.jpg',
  'tradition:j_poprock': ['Spitzband.PNG', 'Misuchiru.gif'],
  'tradition:japanese_gidayu_bushi': 'Osonowiki.jpg',
  'tradition:japanese_matsuri_taiko': ['煮渕.jpg', 'Kyoto_Gion_Matsuri_J09_049.jpg'],
  'tradition:japanese_nagauta_kabuki': 'Sake_Cup_by_Santō_Kyōden.png',
  'tradition:japanese_taiko_ensemble': ['Miya_Daiko_drum_-_Taiko_drums.jpg', '煮渕.jpg'],
  'tradition:javali': 'Tanjore-style_Carnatic_tambura.JPG',
  'tradition:jazztronica': 'Massimo_Bottini.JPG',
  'tradition:jeju_haenyeo_songs': 'Haenyo_8101.jpg',
  'tradition:jersey_club': [
    'Front_angle_view_from_Market_Street_of_World_Cup_Corner_Mural_-_Unicorn151.jpg',
    'Jersey_Club_Music_theme_depicted_in_the_World_Cup_Corner_Mural_-_Unicorn151.jpg',
  ],
  'tradition:jumpstyle': 'Jeckyll_and_hyde.jpg',
  'tradition:jungle': '2013-10-13_02.28.27dssss.jpg',
  'tradition:kansas_city_swing': 'Verbreitung_Kansas_City_Jazz.png',
  'tradition:kapa_haka':
    'Christopher_Luxon_and_Chris_Hipkins_2023_-_State_Opening_of_the_54th_Parliament.jpg',
  'tradition:kayokyoku': 'Sonny_Chiba_1961.jpg',
  'tradition:kazakh_aitys': 'KZ-2011-50tenge-Aytysh-b.png',
  'tradition:kentucky_roots': 'Gibson_Super_400_(1952),_Merle_Travis,_CMHF.jpg',
  'tradition:kirtan': 'Shri_Krishna_Balaram_Mandir.jpg',
  'tradition:kompa': ['19274857288_047f213e12_b.jpg', 'Michel_Martelly_on_April_20,_2011.jpg'],
  'tradition:korean_sanjo_solo': 'Intangible_Cultural_Heritage_Report_Sanjo.jpg',
  'tradition:kulintang': 'Agung_11.jpg',
  'tradition:kundiman': [
    '03032jfEspana_Boulevard_Landmarks_Barangays_Lacson_Blumentritt_Sampaloc_Manilafvf_14.jpg',
    'Imelda_Marcos_of_the_Philippines_on_January_18,_1973_(cropped).jpg',
  ],
  'tradition:kyrgyz_manaschi_epic': 'Manas-serijalary.jpg',
  'tradition:landler': 'Stubete_Gäng_Wildhaus.jpg',
  'tradition:latin_rock': ['Gustavo_Cerati.jpg', 'Alvaro-scaramalli-vivo.jpg'],
  'tradition:lithuanian_sutartines': 'Lithuanian_folklore_performance.jpg',
  'tradition:lounge_exotica': 'Hertie_School_lounge.jpg',
  'tradition:lounge_music': 'Hertie_School_lounge.jpg',
  'tradition:low_bap': 'B._D._Foxmoor.jpg',
  'tradition:luk_krung': 'Suthepweb.jpg',
  'tradition:m_base_collective': 'Steve_Coleman_1611.JPG',
  'tradition:makossa': [
    '5897939613_6721c5937f_b.jpg',
    'Rabba_Rabbi.jpg',
    'Female_Makossa_Dancer_-_Enugu_State_-_Nigeria_-_01.jpg',
  ],
  'tradition:malaysian_pop': 'Malaysian_music_icon.jpg',
  'tradition:maltese_ghana': 'Ghana_Zejrun_Monument.jpeg',
  'tradition:mambo': '16064357976_0cba928e5f_b.jpg',
  'tradition:mande_griot': ['GriotFête.jpg', 'Balafon_griot_(1).jpg'],
  'tradition:manguebeat':
    'Caranguejo_com_Cerébro_Monumento_ao_Manguebeat,_Rua_da_Aurora,_Recife_-_PE_(52181075136).jpg',
  'tradition:maori_haka_taparahi': 'MaoriWardanceKahuroa.jpg',
  'tradition:maori_karanga_powhiri': '2019-11-13_Lisualdo_Gaspar_4.jpg',
  'tradition:mevlevi_ayin': 'Turkey.Konya058.jpg',
  'tradition:mexican_pop': 'Bustos_de_Armando_Manzanero_(cropped).jpg',
  'tradition:microhouse': "Lakay_Ago_Nature's_Park_La_Union-10.jpg",
  'tradition:middle_of_the_road': 'Patrick_Bruel_Cabourg_2012.jpg',
  'tradition:minnesang': 'Joseph_Knippenberg,_Rheinisches_Bildarchiv,_rba_225486_kni.jpg',
  'tradition:mod_60s_british': 'Old_Mods_photo.jpg',
  'tradition:naija_worship': 'Nathaniel_Bassey.jpg',
  'tradition:nashville_sound':
    'Chad_Gamble_at_the_"The_Nashville_Sound"_release_party,_Grimey\'s_New_and_Preloved_Music.jpg',
  'tradition:nasyid': 'Bukhatir_Photo.JPG',
  'tradition:negro_spiritual': 'Kurt_Carr_and_the_Kurt_Carr_Singers_perform_at_the_White_House.jpg',
  'tradition:neoclassicism_interwar': 'Ashram_live_in_Lisbon,_2006.jpg',
  'tradition:new_jack_swing': [
    '캣츠아이(KATSEYE)_뮤직뱅크_출근길,_분위기로_올킬.jpg',
    'George_H._W._Bush_with_Michael_Jackson_(cropped_2).png',
  ],
  'tradition:newfoundland_folk': 'Kim_Basinger_-_The_Natural.jpg',
  'tradition:no_wave': 'Billy_Nomates_op_het_Valkhof_Festival_2022.jpg',
  'tradition:nordic_folk': 'Gaahls_Wyrd_Throne_Fest_Kuurne_04_06_2017_05.jpg',
  'tradition:nortec': 'Industriegebiet_Wellsee_2012;_37.jpg',
  'tradition:norteno': 'TERRITORIA_STICKERS.jpg',
  'tradition:opera_seria_baroque': [
    'Armida,_opera_seria_in_3_atti,_ridotto_per_il_piano_forte_-_btv1b10071060n_(038_of_226).jpg',
    "L'Antro_ovvero_l'inganno_amoroso.png",
  ],
  'tradition:palm_wine': 'Palm_Wine_Vessel,_Cameroon,_Brücke-Museum_Berlin,_64984,_view_a.jpg',
  'tradition:papua_new_guinean_polyphony': 'A_traditional_male_folk_group_from_Skrapar.JPG',
  'tradition:peak_techno': 'Vagator,_Goa,_India,_DJ_playing_music_on_turntable.jpg',
  'tradition:persian_pop_los_angeles': 'Tehrangelesstore.jpg',
  'tradition:plena_puertorican': 'Baile_De_Loiza_Aldea.gif',
  'tradition:polish_poezja_spiewana': 'Alina_Orlova.jpg',
  'tradition:post_disco': ['Kuda_Lumping_Wanita_-_Lampung_-_2019.jpg', 'Benet_Performing.jpg'],
  'tradition:post_teen_pop': 'Britney_Spears.jpg',
  'tradition:preschool_childrens_music': 'Cançons_per_la_mainada,_Guimerà-Mas_Serracant.jpg',
  'tradition:progressive_folk': 'Nancybigger.jpg',
  'tradition:progressive_house': 'Kazantip,_Popovka,_Crimea,_Dance_party,_Techno_music.jpg',
  'tradition:psyprog': 'Liquid_Soul_20th_Anniversary_Show_Stage.jpg',
  'tradition:punta': 'Map_of_Carib_Land_after_Treaty_of_1773.png',
  'tradition:punta_garifuna': 'Map_of_Carib_Land_after_Treaty_of_1773.png',
  'tradition:pure_land_buddhist': '玉里華山寺_(21)南無阿彌陀佛古碑.jpg',
  'tradition:quranic_recitation_tajweed': "Quran-Mus'haf_Al_Tajweed.jpg",
  'tradition:raggamuffin': 'Tippa_Irie_2023.jpg',
  'tradition:rap_df': 'Cartel+De+Santa+1862_carteldesanta.jpg',
  'tradition:rebetiko': 'Rembetes_Karaiskaki_1933.jpg',
  'tradition:red_dirt': ['CSR007_SA_2020.jpg', 'LataGouveia13.jpg'],
  'tradition:renaissance_sacred_polyphony': 'The_Concert_A22894.jpg',
  'tradition:repente_embolada': 'Monumento_cego_aderaldo_quixada_CE.JPG',
  'tradition:rumba_columbia':
    'Bailarines_de_rumba_cubana_en_la_plaza_de_los_trabajadores_de_Camagüey,_Cuba.jpg',
  'tradition:rumba_yambu':
    'Bailarines_de_rumba_cubana_en_la_plaza_de_los_trabajadores_de_Camagüey,_Cuba.jpg',
  'tradition:russian_byliny': 'Dobrynya_Nikitich_rescues_Zabava_from_the_Gorynych,_1941.jpg',
  'tradition:russian_folk_balalaika_choir': [
    'Thomas_Tallis.jpg',
    'Santiago_Veros_choral_composer.jpg',
    'Кореньские_родники-2_Открытие_68.JPG',
  ],
  'tradition:russian_orthodox_chant': 'Example_of_hooks_and_banners_notation.PNG',
  'tradition:sacred_harp_singing': 'Sacred_Harp_1870,_page_52.png',
  'tradition:salsa_dura': 'Willie_Colon_2017_(cropped).jpg',
  'tradition:salsa_romantica': 'Mamuang.jpg',
  'tradition:sawt_bahraini_kuwaiti':
    'COLLECTIE_TROPENMUSEUM_Dubbelvellige_cilindrische_trom_TMnr_1081-26.jpg',
  'tradition:screen_soundtrack_hybrid': 'Miguel_Ángel_Fúster_Coll.jpg',
  'tradition:sean_nos_singing': 'Nioclás_Tóibín_plaque.png',
  'tradition:sfyria_antia': 'Hand_whistle_3.jpg',
  'tradition:shakuhachi_sankyoku':
    'Caratula_del_album_Shakuhachi_and_Guitar_Conversations_-_Ricardo_Zapata.jpg',
  'tradition:shanty':
    'Simon_the_Shanty_Harpist,_Sea_Shanty_Festival,_Falmouth,_Cornwall_-_June_2024.jpg',
  'tradition:shomyo_japanese': 'Sanjusangendo_Thousand-armed_Kannon.JPG',
  'tradition:skiffle': "Cannon'sJugStompers.jpg",
  'tradition:soca_soul': 'C.Pters.jpg',
  'tradition:somali_qaraami': 'Ūd_MET_DP340079.jpg',
  'tradition:sonidero':
    'Rótulos_de_grupos_musicales_en_un_muro_del_tercer_anillo_(Aguascalientes)_02.jpg',
  'tradition:southern_trap':
    'M-Audio_Trigger_Finger_Pro_-_angled_-_2014_NAMM_Show_(by_Matt_Vanacoro).jpg',
  'tradition:spanish_rock': ['Alfred_García,_XII_Premis_Gaudí_(2020).jpg', 'Enrique_Sierra.jpg'],
  'tradition:spanish_rondas': 'Hotel_Sur_en_Hotel_Claridge.jpg',
  'tradition:spirituals': [
    'Shri_Krishna_Balaram_Mandir.jpg',
    'Zdjęcie_promocyjne_z_występu_Spirituals_Singers_Band.jpg',
  ],
  'tradition:spirituals_african_american': 'Shri_Krishna_Balaram_Mandir.jpg',
  'tradition:string_band': "Trinidadian_Calypso_group_Lovey's_String_Band.jpg",
  'tradition:sufi_sama': 'Whirlingdervishes.JPG',
  'tradition:surf_rock': 'FGF_museum_03._Surf_guitar_example.jpg',
  'tradition:sutartines':
    'Lithuanian_multipart_song_(sutartinė)_about_king_Sudaitis_written_down_by_Mykolas_Miežinis,_ca_1849.webp',
  'tradition:symphonic': 'John_Browning_1966.JPG',
  'tradition:synthcore': 'Fischerspooner_NYC_2005.jpg',
  'tradition:taiko_north_american': 'Paris_Taiko_Ensemble_en_concert_au_TGS_2022_(1).jpg',
  'tradition:technical_death_metal': 'Opeth_münchen_06.12.2008._8_(B&W).jpg',
  'tradition:thai_luk_krung': 'Suthepweb.jpg',
  'tradition:thiruvaachakam_shaivite': 'SaivismFlag.svg',
  'tradition:tibetan_ache_lhamo': 'Tsechu_cham.jpg',
  'tradition:tillana': 'Tanjore-style_Carnatic_tambura.JPG',
  'tradition:timba': 'Münchner_Ruhestörung_30.09.2019.jpg',
  'tradition:tololoche': 'Instrument_tololoche_Mex_20010.jpg',
  'tradition:tongan_lakalaka': 'Lakalaka.jpg',
  'tradition:traditional_doom': 'Candlemass_@_Rock_Hard_Festival_2017_008.jpg',
  'tradition:trallalero':
    'Map_Folklore_I_1990_-_Polivocalità_-_Touring_Club_Italiano_CART-TEM-096_(cropped).jpg',
  'tradition:trap': 'M-Audio_Trigger_Finger_Pro_-_angled_-_2014_NAMM_Show_(by_Matt_Vanacoro).jpg',
  'tradition:trap_funk': 'Ludmilla_-_TVZ_2024_(1).png',
  'tradition:tribal_house': 'Potters_house.jpg',
  'tradition:tropical_bolero': '14045089766_54dbf6318a_b.jpg',
  'tradition:trot_revival': 'Trot_5_minor_scale.jpg',
  'tradition:turbo_folk': 'Zdravo_Đorđe,_Džej_Ramadanovski,_Dorćol,_Jevrejska_2,_2021.jpg',
  'tradition:turk_sanat_muzigi': 'Aleppomusic.jpg',
  'tradition:twelve_tone': '12tones-my_example1.JPG',
  'tradition:uk_garage': 'Roam,_Toronto,_uk_garage_producer.jpg',
  'tradition:uk_garage_2step': 'Naughtyboyasianawards.png',
  'tradition:umbanda_brazilian': "Mam'etu_Sia_Vanju.jpg",
  'tradition:urban_blues':
    'Publicity_photo_of_B.B._King._-_j9602118s_files_7f3e5875-55ee-4389-8eb0-53e6b59f1df3_(cropped).jpg',
  'tradition:vapor_aesthetic': 'Wikiwave_00000.png',
  'tradition:vaudeville': [
    'Vaudeville_entertainer_Will_Hart_in_blackface_(SAYRE_3339).jpg',
    'Tony_Pastor,_Hotel_Edison,_New_York,_N.Y.,_between_1946_and_1948_(William_P._Gottlieb_06951).jpg',
  ],
  'tradition:vedic_chant': 'Group_of_Brahmins_1913.jpg',
  'tradition:vietnamese_hat_cheo': 'Water_Puppet_Theatre_Vietnam(1).jpg',
  'tradition:wassoulou': 'Wassoulou_map.png',
  'tradition:western_music': 'Hank_Williams_Promotional_Photo.jpg',
  'tradition:wind_ensemble': 'Brassaranka_bei_einem_Auftritt_2019.jpg',
  'tradition:work_songs_hollers': 'Chain_gang_-_convicts_going_to_work_nr._Sidney_N.S._Wales.jpg',
  'tradition:yacht_rock': 'Beach_Boys_Good_Vibrations_from_Central_Park_1971.jpg',
  'tradition:zouglou_ivorian':
    "Demi_ensemble_de_la_loge_des_invitées_d'honneur_et_de_la_marraine_Dominique_Ouattara.jpg",
  'tradition:zouk': 'Jessy_Matador.jpg',
};
function isRejected(key, imageUrl) {
  const file = decodeURIComponent(
    String(imageUrl || '')
      .split('/')
      .pop()
  );
  return [].concat(REJECTED[key] || []).includes(file);
}

// ---- Main ----
// Every catalog entity, each marked whether this run's --kind / --offset /
// --limit scope covers it.
function loadEntities() {
  const list = [];
  for (const [kind, file] of [
    ['instrument', 'api/instruments/index.json'],
    ['tradition', 'api/traditions/index.json'],
  ]) {
    const idx = JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
    for (const [i, it] of idx.items.entries()) {
      const e = { key: kind + ':' + it.id, id: it.id, kind, name: it.name };
      e.inScope =
        (!opts.kind || opts.kind === kind) && i >= opts.offset && i < opts.offset + opts.limit;
      if (kind === 'instrument' && e.inScope) {
        const rec = JSON.parse(
          fs.readFileSync(path.join(ROOT, 'api/instruments', it.id + '.json'))
        );
        if (rec.short) e.short = rec.short;
      }
      list.push(e);
    }
  }
  return list;
}

// Entries already in the manifest are kept as they are (an accuracy pass
// may have corrected or pruned them by hand); a run only looks for the
// entities still missing. --fresh ignores the existing file and rebuilds
// every entry from the sources.
function loadExisting() {
  if (opts.fresh || !fs.existsSync(opts.out)) return { images: [], skipped: [] };
  const m = JSON.parse(fs.readFileSync(opts.out, 'utf8'));
  return { images: m.images || [], skipped: m.skipped_sources || [] };
}

async function main() {
  const all = loadEntities();
  const existing = loadExisting();
  const kept = {};
  for (const img of existing.images) kept[img.kind + ':' + img.id] = img;
  const entities = all.filter((e) => e.inScope && !kept[e.key]);
  const skipped = [];
  const found = {};
  // A reviewed rejection leaves the entity open for the next source.
  const take = (results) => {
    for (const [key, hit] of Object.entries(results))
      if (!isRejected(key, hit.image_url)) found[key] = hit;
  };
  take(await viaWikidata(entities, skipped));
  const missingInstruments = () => entities.filter((e) => e.kind === 'instrument' && !found[e.key]);
  take(await viaMet(missingInstruments(), skipped));
  take(await viaSmithsonian(missingInstruments(), skipped));
  take(await viaCleveland(missingInstruments(), skipped));
  take(await viaEuropeana(missingInstruments(), skipped));
  // Commons search: instruments first, whose names are the more distinctive.
  take(
    await viaCommonsSearch(
      entities
        .filter((e) => !found[e.key])
        .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'instrument' ? -1 : 1)),
      skipped
    )
  );
  // Openverse's small daily allowance goes to traditions first: museums
  // only ever cover instruments.
  const missing = entities
    .filter((e) => !found[e.key])
    .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'tradition' ? -1 : 1));
  take(await viaOpenverse(missing, skipped));

  const images = all
    .filter((e) => kept[e.key] || found[e.key])
    .map((e) => kept[e.key] || { id: e.id, kind: e.kind, name: e.name, ...found[e.key] })
    .sort((a, b) => (a.kind + a.id < b.kind + b.id ? -1 : a.kind + a.id > b.kind + b.id ? 1 : 0));

  const coverage = {};
  for (const kind of ['instrument', 'tradition']) {
    const total = all.filter((e) => e.kind === kind).length;
    const mine = images.filter((i) => i.kind === kind);
    const by = (f) => mine.reduce((acc, i) => ((acc[i[f]] = (acc[i[f]] || 0) + 1), acc), {});
    coverage[kind] = {
      total,
      with_image: mine.length,
      by_source: by('source'),
      by_license: by('license'),
    };
  }

  const manifest = {
    _about:
      'Openly licensed image links (no binaries). License and credit are as reported by each source; ' +
      'regenerate with node scripts/fetch_image_manifest.js.',
    thumb_width: THUMB_WIDTH,
    coverage,
    skipped_sources: skipped,
    images,
  };
  fs.writeFileSync(opts.out, JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify({ coverage, skipped_sources: skipped }, null, 2));
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { classifyLicense, nameCandidates, norm, isRejected, REJECTED };
