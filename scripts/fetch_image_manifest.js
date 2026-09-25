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
//      is the name, else the only one with an image; otherwise skip. Items
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
// Picks a manual accuracy pass rejected (REJECTED below) are dropped as each
// source reports, so the entity stays open for the next source.
//
// The source's own license field is trusted; only Public Domain / CC0 /
// CC BY / CC BY-SA are kept. Sources that fail (network policy, no key) are
// recorded under `skipped_sources` and the run carries on.
//
// Usage: node scripts/fetch_image_manifest.js [--limit N] [--kind instrument|tradition]
//        [--cache FILE] [--out FILE]

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const opts = {
  limit: Infinity,
  kind: null,
  out: path.join(ROOT, 'references', '_image_manifest.json'),
  cache: null,
  concurrency: 4,
  depictsMinutes: 30,
  openverseBudget: 190,
};
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--limit') opts.limit = parseInt(args[++i], 10);
  else if (args[i] === '--kind') opts.kind = args[++i];
  else if (args[i] === '--out') opts.out = args[++i];
  else if (args[i] === '--cache') opts.cache = args[++i];
  else if (args[i] === '--concurrency') opts.concurrency = parseInt(args[++i], 10);
  else if (args[i] === '--openverse-budget') opts.openverseBudget = parseInt(args[++i], 10);
  else if (args[i] === '--depicts-minutes') opts.depictsMinutes = parseFloat(args[++i]);
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
async function cached(key, fn) {
  if (key in cache) return cache[key];
  const v = await fn();
  cache[key] = v;
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
    'SELECT ?lab ?item ?itemLabel ?img ?main WHERE { VALUES ?lab { ' +
    labels.map(sparqlString).join(' ') +
    ' } { ?item rdfs:label ?lab . BIND(true AS ?main) } UNION' +
    ' { ?item skos:altLabel ?lab . BIND(false AS ?main) }' +
    ' ?item wdt:P31?/wdt:P279* wd:' +
    WD_CLASS[kind] +
    ' . OPTIONAL { ?item wdt:P18 ?img } ' +
    'SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } }';
  // POST: a GET carrying 150 labels overflows the request line (HTTP 431).
  const data = await cached('sparql2:' + kind + ':' + labels.join('|'), () =>
    getJson(
      'https://query.wikidata.org/sparql?format=json',
      0,
      'query=' + encodeURIComponent(query)
    )
  );
  return data.results.bindings.map((b) => ({
    label: b.lab.value,
    qid: b.item.value.replace(/^.*\//, ''),
    itemLabel: b.itemLabel && b.itemLabel.value,
    main: b.main && b.main.value === 'true',
    file: b.img && decodeURIComponent(b.img.value.replace(/^.*\/Special:FilePath\//, '')),
  }));
}

// Pick one item for a name. One in-class item carrying it wins outright.
// Several: the single one whose main label (not an alias) is the name, else
// the single one with an image; otherwise ambiguous and skipped.
function resolveHits(hits) {
  const qids = [...new Set(hits.map((h) => h.qid))];
  if (qids.length === 1) return { qid: qids[0], tiebreak: false };
  for (const pick of [(h) => h.main, (h) => h.file]) {
    const q = [...new Set(hits.filter(pick).map((h) => h.qid))];
    if (q.length === 1) return { qid: q[0], tiebreak: true };
  }
  return null;
}

async function wikidataMatches(entities) {
  const out = {};
  for (const kind of Object.keys(WD_CLASS)) {
    const mine = entities.filter((e) => e.kind === kind);
    const allLabels = [
      ...new Set(mine.flatMap((e) => nameCandidates(e.name).flatMap(caseVariants))),
    ];
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
      for (const h of hits) (byLabel[h.label] ||= []).push(h);
      saveCache();
    };
    for (const batch of chunk(allLabels, 60)) await run(batch);
    for (const e of mine) {
      const cands = nameCandidates(e.name);
      for (const cand of cands) {
        const hits = caseVariants(cand).flatMap((v) => byLabel[v] || []);
        if (!hits.length) continue;
        const r = resolveHits(hits);
        if (!r) break; // ambiguous: skip rather than guess
        const mineHits = hits.filter((h) => h.qid === r.qid);
        const withImg = mineHits.find((h) => h.file);
        // An alias can name a broader or different item ("been" is also an
        // alias of the rudra veena), so only a main-label match is `high`.
        const byMainLabel = mineHits.some((h) => h.main);
        out[e.key] = {
          qid: r.qid,
          label: mineHits[0].itemLabel || mineHits[0].label,
          file: withImg ? withImg.file : null,
          confidence: cand === cands[0] && !r.tiebreak && byMainLabel ? 'high' : 'medium',
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
const IMAGE_EXT = /\.(jpe?g|png|gif|svg|tiff?|webp)$/i;
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
      IMAGE_EXT.test(r.title)
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

async function viaWikidata(entities, skipped) {
  const results = {};
  let matches;
  try {
    matches = await wikidataMatches(entities);
    const d = await commonsDepicts(matches);
    console.error(`commons depicts fallback: ${d.tried}/${d.of} items looked up`);
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
      source: m.via === 'depicts' ? 'commons_depicts' : 'wikidata_commons',
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
      for (const cand of nameCandidates(e.name)) {
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
            match_confidence: cand === nameCandidates(e.name)[0] ? 'medium' : 'low',
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

// ---- Source 3: Smithsonian Open Access (needs SI_API_KEY) ----
async function viaSmithsonian(entities, skipped) {
  const key = process.env.SI_API_KEY;
  const results = {};
  if (!key) {
    skipped.push({ source: 'smithsonian_open_access', reason: 'no SI_API_KEY' });
    return results;
  }
  try {
    await pool(entities, opts.concurrency, async (e) => {
      const q = `"${e.name}" AND online_media_type:"Images" AND unit_code:"NMAH"`;
      const url =
        'https://api.si.edu/openaccess/api/v1.0/search?rows=5&api_key=' +
        key +
        '&q=' +
        encodeURIComponent(q);
      const data = await cached('si:' + e.name, () => tryJson(url));
      for (const row of (data.response && data.response.rows) || []) {
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
      const cands = nameCandidates(e.name);
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
      const cands = nameCandidates(e.name);
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
// same pick again but still takes a different image for that entity.
// Commons depicts (P180) fallbacks, alias-matched Wikidata items, museum
// title matches and Openverse hits are not verified here; review new ones.
const REJECTED = {
  'instrument:barrel_organ': 'Barrel_piano_-_Λατέρνα(laterna).JPG',
  'instrument:bassanello': 'Guizza_foto_storica_chiesa_Bassanello_vista_aerea.jpg',
  'instrument:been_snake_charmer': 'Rudraveena1.JPG',
  'instrument:burundi_royal_drums':
    'Bundesarchiv_Bild_105-DOA0543,_Deutsch-Ostafrika,_Ngoma-Schlagen.jpg',
  'instrument:byzantine_lyra': 'Gdulka-bow_copy.jpg',
  'instrument:castanets': 'default.jpg',
  'instrument:contrabass_oboe': "Contrabass_oboe's_range.png",
  'instrument:cornet': '8a55c0382a904e3eac317bd76dcedc5e.jpg',
  'instrument:crotales': 'Cymbales-E_12567-img_2793.jpg',
  'instrument:cuatro_pr': 'Cuatro_Ramon_Blanco.jpg',
  'instrument:dan_tam_thap_luc': 'Hammered_dulcimer.JPG',
  'instrument:fiddle': '1918.381_print.jpg',
  'instrument:gaku_biwa': '곡경비파_(2).JPG',
  'instrument:gender': '1968.07.0001a.jpg',
  'instrument:gijak_turkmen': 'Ghaychak.jpg',
  'instrument:harmonium_indian': '134286.jpg',
  'instrument:harpa': 'zoom',
  'instrument:hydraulis': 'Paseo_de_la_Guarania.png',
  'instrument:irish_wooden_flute': 'Charles_Nicholson00.jpg',
  'instrument:kalangu': 'Afrobeats_Molo_strings.jpg',
  'instrument:kempyang': 'Wayang_Ruwatan_by_Anom_Harya.jpg',
  'instrument:kenong': 'Karawitan_Junior.jpg',
  'instrument:kuzhal': 'The_Tribal_Triumph.jpg',
  'instrument:marimba_centroamericana': 'Esmeraldian_(Afro-Ecuadorian)_marimba.jpg',
  'instrument:marimba_orchestral': 'Esmeraldian_(Afro-Ecuadorian)_marimba.jpg',
  'instrument:melodeon_diatonic': 'New_Haven_Melodeon,_Mission_Mill_Museum.jpg',
  'instrument:naghara_azerbaijani': 'Nagara,_MDMB_945.jpg',
  'instrument:organistrum':
    'Chiesa_di_San_Maurizio_-_Museo_della_Musica_in_Venice_-_Ghironda_1850_.jpg',
  'instrument:pibgorn': 'Welshbagpipe.jpg',
  'instrument:pyeonjong': 'Bianzhong.jpg',
  'instrument:quern_grindstone': 'MM+19490(1).jpg',
  'instrument:rabel_castellano': 'Encuentro_homenaje_en_Valdeolea.jpg',
  'instrument:rebab': 'DP252791.jpg',
  'instrument:riq': 'Pair_of_dafs.jpg',
  'instrument:sambuca_ancient': 'Fresco_of_women_listening_to_a_private_musical_performance.jpg',
  'instrument:sanj':
    'Musicians_of_the_Akbar\'s_naqqāra-khāna,_from_painting_"An_Attempt_on_Akbar\'s_Life"-Akbarnama.jpg',
  'instrument:shabbaba': 'midp89.4.444.jpg',
  'instrument:shawm': 'MUS478A5.jpg',
  'instrument:shudraga': 'Mongolian_lute,_circa_1279-1368,_Tomb_of_Wang_Qing.jpg',
  'instrument:tambura_balkan': 'DP-24037-001.jpg',
  'instrument:tanbur_maltese': 'midp89.4.1384.jpg',
  'instrument:tar_frame_drum': 'Tār_MET_midp89.4.1858.jpg',
  'instrument:tilinca': 'f39862d97cfc43a99c4150501a9be23a.jpg',
  'instrument:trumpet': 'MUS1129A.jpg',
  'instrument:tubular_bells': 'Windchimes_02.jpg',
  'instrument:villu_pattu_bow': 'ഓണവില്ല്_ഉപയോഗിച്ചുള്ള_പാട്ട്൧.resized.jpg',
  'instrument:vladimirskiy_rozhok': 'Рагаи_и_коленами.jpg',
  'instrument:xalam': 'Diffa_Niger_Griot_DSC_0177.jpg',
  'instrument:xylophone': 'MUS786A.jpg',
  'instrument:zokra': 'Zournas.jpg',
  'tradition:afro_punk': 'Punks_SP.jpg',
  'tradition:afrobeat': 'Kalakuta_Queens.jpg',
  'tradition:amapiano': 'Mr_Julz_photo.jpg',
  'tradition:anadolu_rock': 'The_shadows_2009_Brussels.JPG',
  'tradition:anatolian_rock': 'The_shadows_2009_Brussels.JPG',
  'tradition:art_pop': 'Cowgirl_Clue.png',
  'tradition:austropop': 'I_AM_FROM_AUSTRIA_-_Das_Musical_in_Japan.jpg',
  'tradition:bachata': '10805456595_1fce3f7fa1_b.jpg',
  'tradition:banda_sinaloense':
    "Thales_Tkzin_na_extinta_banda_L'aventura_se_apresentando_na_Pré-Bienal_da_UBES_no_colégio_Floriano_Cavalcanti_em_2016.jpg",
  'tradition:bassline': 'How_to_make_that_bassline_logo_honlapra.png',
  'tradition:bassline_uk': 'How_to_make_that_bassline_logo_honlapra.png',
  'tradition:bhangra_modern': 'Bhangra_Dance_Performed_by_Girls.jpg',
  'tradition:bomba': 'Tamborbomba.png',
  'tradition:bomba_puertorican': 'Tamborbomba.png',
  'tradition:bubblegum_pop': 'Travelling_funfair,_Bemmely_Hills.jpg',
  'tradition:c_pop': 'Chinese_music_icon.png',
  'tradition:cantopop':
    'Anita_Mui_Yim-fong_(梅艷芳)_Statue_at_Hong_Kong_Garden_of_Stars_(Ank_Kumar,_Infosys_Limited)_02.jpg',
  'tradition:champeta': '2025-07-06_15-03-41-Champeta-por-David-Ramirez-Ordonez.jpg',
  'tradition:champeta_cartagenera': '2025-07-06_15-03-41-Champeta-por-David-Ramirez-Ordonez.jpg',
  'tradition:chicano_rap': 'ChicanoRap.jpg',
  'tradition:chilean_rock': 'Los_Vanders_2020.jpg',
  'tradition:chilena': 'Jose_hernandez_bajista_del_grupo_dueño_y_fundador.jpg',
  'tradition:christian_country': '90.5_KJIC_Official_Logo.png',
  'tradition:conjunto': '1977_torres_de_almagro._jpg.webp',
  'tradition:copla_andaluza': 'Placa_Conmemorativa_Concha_Piquer_Gran_Via.jpg',
  'tradition:corridos_belicos': 'CLAZI.jpg',
  'tradition:country_gospel': '90.5_KJIC_Official_Logo.png',
  'tradition:cowboy_song': 'Hank_Williams_Promotional_Photo.jpg',
  'tradition:cowboy_western': 'Hank_Williams_Promotional_Photo.jpg',
  'tradition:cumbia_chilena': 'BANDA_RIO_CLARO.png',
  'tradition:cumbia_sonidera': 'Diálogo_abierto_Sonideros.jpg',
  'tradition:danzon': 'Zapatos_para_danzón,_03.jpg',
  'tradition:downtempo': 'Popovka,_Kazantip,_Crimea,_Sunset_party.jpg',
  'tradition:drill': 'Forja_&_Sonido.png',
  'tradition:drumstep': 'Permutation.jpg',
  'tradition:electro': 'Electrograph.png',
  'tradition:ethereal_wave': "Symphony_of_Us,_Love's_Chosen_tune.jpg",
  'tradition:festejo': 'De_la_serie_Mojigangas_de_Alvarado_3.tif',
  'tradition:festejo_afroperuano': 'De_la_serie_Mojigangas_de_Alvarado_3.tif',
  'tradition:folk_noir': 'Sol_Invictus_Live.jpg',
  'tradition:footwork': '7771148116_f3b47e9283_b.jpg',
  'tradition:freestyle': 'Exhibición_de_Deportes_Urbanos_-_evento_(23).jpg',
  'tradition:freestyle_music': 'Exhibición_de_Deportes_Urbanos_-_evento_(23).jpg',
  'tradition:fusion': '12348323204_a3b7c94021_b.jpg',
  'tradition:garage_rock': "17_bv_de_l'Hôtel_de_ville,_Vichy_-_porte_de_garage_rock_&_love_.jpg",
  'tradition:glitchcore': 'Roblox.jpg',
  'tradition:gqom':
    '77tunes_Home_of_Hiphop_Music,_News,_Gqom,_Afro_House,_Amapiano,_Hiphopza,_Zamusic,_Fakaza_Music_SaHipHop_&_Entertainment.jpg',
  'tradition:hawaiian_hip_hop': 'Flag_of_Hawaii.svg',
  'tradition:hindustani_sarod':
    'Ashwini_Bhide-Deshpande_(Hindustani_classical_music_vocalist)_01.JPG',
  'tradition:house': 'CERVEJARIA_DO_GORDO.jpg',
  'tradition:indietronica': 'Cowgirl_Clue.png',
  'tradition:iraqi_maqam': 'مقتنيات_الفنان_اسماعيل_الفحّام.jpg',
  'tradition:irish_pub_song': 'Drinking-_song_-_Zichy,_Mihály_-_1874.jpg',
  'tradition:iskelma': 'Und_abends_in_die_Scala.jpg',
  'tradition:islamic_recitation_mujawwad': 'A_Musical_Gathering_-_Ottoman,_18th_century.jpg',
  'tradition:japanese_nagauta_kabuki': 'Sake_Cup_by_Santō_Kyōden.png',
  'tradition:jersey_club':
    'Front_angle_view_from_Market_Street_of_World_Cup_Corner_Mural_-_Unicorn151.jpg',
  'tradition:kapa_haka':
    'Christopher_Luxon_and_Chris_Hipkins_2023_-_State_Opening_of_the_54th_Parliament.jpg',
  'tradition:kompa': '19274857288_047f213e12_b.jpg',
  'tradition:kulintang': 'Agung_11.jpg',
  'tradition:kundiman':
    '03032jfEspana_Boulevard_Landmarks_Barangays_Lacson_Blumentritt_Sampaloc_Manilafvf_14.jpg',
  'tradition:latin_rock': 'Gustavo_Cerati.jpg',
  'tradition:lounge_exotica': 'Hertie_School_lounge.jpg',
  'tradition:lounge_music': 'Hertie_School_lounge.jpg',
  'tradition:makossa': '5897939613_6721c5937f_b.jpg',
  'tradition:malaysian_pop': 'Malaysian_music_icon.jpg',
  'tradition:maltese_ghana': 'Ghana_Zejrun_Monument.jpeg',
  'tradition:mambo': '16064357976_0cba928e5f_b.jpg',
  'tradition:manguebeat':
    'Caranguejo_com_Cerébro_Monumento_ao_Manguebeat,_Rua_da_Aurora,_Recife_-_PE_(52181075136).jpg',
  'tradition:microhouse': "Lakay_Ago_Nature's_Park_La_Union-10.jpg",
  'tradition:minnesang': 'Joseph_Knippenberg,_Rheinisches_Bildarchiv,_rba_225486_kni.jpg',
  'tradition:negro_spiritual': 'Kurt_Carr_and_the_Kurt_Carr_Singers_perform_at_the_White_House.jpg',
  'tradition:new_jack_swing': '캣츠아이(KATSEYE)_뮤직뱅크_출근길,_분위기로_올킬.jpg',
  'tradition:no_wave': 'Billy_Nomates_op_het_Valkhof_Festival_2022.jpg',
  'tradition:nortec': 'Industriegebiet_Wellsee_2012;_37.jpg',
  'tradition:norteno': 'TERRITORIA_STICKERS.jpg',
  'tradition:opera_seria_baroque':
    'Armida,_opera_seria_in_3_atti,_ridotto_per_il_piano_forte_-_btv1b10071060n_(038_of_226).jpg',
  'tradition:plena_puertorican': 'Baile_De_Loiza_Aldea.gif',
  'tradition:post_disco': 'Kuda_Lumping_Wanita_-_Lampung_-_2019.jpg',
  'tradition:progressive_house': 'Kazantip,_Popovka,_Crimea,_Dance_party,_Techno_music.jpg',
  'tradition:punta': 'Map_of_Carib_Land_after_Treaty_of_1773.png',
  'tradition:punta_garifuna': 'Map_of_Carib_Land_after_Treaty_of_1773.png',
  'tradition:red_dirt': 'CSR007_SA_2020.jpg',
  'tradition:sean_nos_singing': 'Nioclás_Tóibín_plaque.png',
  'tradition:skiffle': "Cannon'sJugStompers.jpg",
  'tradition:sonidero':
    'Rótulos_de_grupos_musicales_en_un_muro_del_tercer_anillo_(Aguascalientes)_02.jpg',
  'tradition:southern_trap':
    'M-Audio_Trigger_Finger_Pro_-_angled_-_2014_NAMM_Show_(by_Matt_Vanacoro).jpg',
  'tradition:spirituals': 'Shri_Krishna_Balaram_Mandir.jpg',
  'tradition:spirituals_african_american': 'Shri_Krishna_Balaram_Mandir.jpg',
  'tradition:synthcore': 'Fischerspooner_NYC_2005.jpg',
  'tradition:technical_death_metal': 'Opeth_münchen_06.12.2008._8_(B&W).jpg',
  'tradition:timba': 'Münchner_Ruhestörung_30.09.2019.jpg',
  'tradition:trallalero':
    'Map_Folklore_I_1990_-_Polivocalità_-_Touring_Club_Italiano_CART-TEM-096_(cropped).jpg',
  'tradition:trap': 'M-Audio_Trigger_Finger_Pro_-_angled_-_2014_NAMM_Show_(by_Matt_Vanacoro).jpg',
  'tradition:tribal_house': 'Potters_house.jpg',
  'tradition:tropical_bolero': '14045089766_54dbf6318a_b.jpg',
  'tradition:turbo_folk': 'Zdravo_Đorđe,_Džej_Ramadanovski,_Dorćol,_Jevrejska_2,_2021.jpg',
  'tradition:turk_sanat_muzigi': 'Aleppomusic.jpg',
  'tradition:western_music': 'Hank_Williams_Promotional_Photo.jpg',
  'tradition:yacht_rock': 'Beach_Boys_Good_Vibrations_from_Central_Park_1971.jpg',
  'tradition:zouglou_ivorian':
    "Demi_ensemble_de_la_loge_des_invitées_d'honneur_et_de_la_marraine_Dominique_Ouattara.jpg",
};
function isRejected(key, imageUrl) {
  const file = decodeURIComponent(
    String(imageUrl || '')
      .split('/')
      .pop()
  );
  return REJECTED[key] === file;
}

// ---- Main ----
function loadEntities() {
  const list = [];
  for (const [kind, file] of [
    ['instrument', 'api/instruments/index.json'],
    ['tradition', 'api/traditions/index.json'],
  ]) {
    if (opts.kind && opts.kind !== kind) continue;
    const idx = JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
    for (const it of idx.items.slice(0, opts.limit)) {
      list.push({ key: kind + ':' + it.id, id: it.id, kind, name: it.name });
    }
  }
  return list;
}

async function main() {
  const entities = loadEntities();
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
  // Openverse's small daily allowance goes to traditions first: museums
  // only ever cover instruments.
  const missing = entities
    .filter((e) => !found[e.key])
    .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'tradition' ? -1 : 1));
  take(await viaOpenverse(missing, skipped));

  const images = entities
    .filter((e) => found[e.key])
    .map((e) => ({ id: e.id, kind: e.kind, name: e.name, ...found[e.key] }))
    .sort((a, b) => (a.kind + a.id < b.kind + b.id ? -1 : a.kind + a.id > b.kind + b.id ? 1 : 0));

  const coverage = {};
  for (const kind of ['instrument', 'tradition']) {
    const total = entities.filter((e) => e.kind === kind).length;
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
