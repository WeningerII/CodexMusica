#!/usr/bin/env node
// Build references/_image_manifest.json: openly licensed image links for
// catalog instruments and traditions. Links only, no image binaries.
//
// Volume over completeness: every match is automatic, and anything
// ambiguous is skipped rather than resolved by hand.
//
//   1. Wikidata: wbsearchentities by name; accept only a hit whose label (or
//      alias) equals the catalog name when no other hit also does. Take its
//      P18 image, then read license + author from the Commons API
//      (imageinfo/extmetadata, 50 titles per call).
//   2. Instruments still missing: Met Open Access (Musical Instruments dept,
//      isPublicDomain only).
//   3. Smithsonian Open Access (CC0) only when SI_API_KEY is set.
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
};
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--limit') opts.limit = parseInt(args[++i], 10);
  else if (args[i] === '--kind') opts.kind = args[++i];
  else if (args[i] === '--out') opts.out = args[++i];
  else if (args[i] === '--cache') opts.cache = args[++i];
  else if (args[i] === '--concurrency') opts.concurrency = parseInt(args[++i], 10);
}

const UA = 'CodexMusica-image-manifest/1.0 (https://github.com/WeningerII/CodexMusica)';
const THUMB_WIDTH = 400;

// ---- HTTP (global fetch, honours HTTPS_PROXY via undici when set) ----
try {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  if (proxy) {
    const { setGlobalDispatcher, EnvHttpProxyAgent } = require('undici');
    setGlobalDispatcher(new EnvHttpProxyAgent());
  }
} catch {
  // undici not installed: fall back to a direct connection.
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, attempt = 0) {
  let res;
  try {
    res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  } catch (e) {
    if (attempt < 2) return sleep(2000 * (attempt + 1)).then(() => getJson(url, attempt + 1));
    throw new Error('network: ' + ((e.cause && e.cause.message) || e.message));
  }
  if ((res.status === 429 || res.status >= 500) && attempt < 3) {
    await sleep(5000 * 2 ** attempt);
    return getJson(url, attempt + 1);
  }
  if (!res.ok) throw new Error('http_' + res.status);
  return res.json();
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

// ---- Source 1: Wikidata + Commons ----
async function wikidataMatch(name) {
  for (const cand of nameCandidates(name)) {
    const url =
      'https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=en&type=item&limit=7&search=' +
      encodeURIComponent(cand);
    const data = await cached('wd:' + cand, () => getJson(url));
    const hits = (data && data.search) || [];
    const want = norm(cand);
    const exact = hits.filter(
      (h) =>
        norm(h.label) === want ||
        (h.match && h.match.type !== 'description' && norm(h.match.text) === want)
    );
    const usable = exact.filter(
      (h) => !/disambiguation|wikimedia|family name|given name/i.test(h.description || '')
    );
    if (usable.length === 1) {
      return {
        qid: usable[0].id,
        label: usable[0].label,
        confidence: cand === name ? 'high' : 'medium',
      };
    }
    // More than one exact hit is ambiguous: skip rather than guess.
    if (usable.length > 1) return null;
  }
  return null;
}

async function wikidataImages(qids) {
  const out = {};
  for (const batch of chunk(qids, 50)) {
    const url =
      'https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims&ids=' +
      batch.join('|');
    const data = await getJson(url);
    for (const [qid, ent] of Object.entries(data.entities || {})) {
      const p18 = ent.claims && ent.claims.P18 && ent.claims.P18[0];
      const file = p18 && p18.mainsnak && p18.mainsnak.datavalue && p18.mainsnak.datavalue.value;
      if (file) out[qid] = file;
    }
  }
  return out;
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
    const data = await getJson(url);
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
        image_url: ii.url,
        thumb_url: ii.thumburl || ii.url,
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
    matches = await pool(entities, opts.concurrency, async (e) => {
      const m = await wikidataMatch(e.name);
      return m && { ...m, key: e.key };
    });
  } catch (e) {
    skipped.push({ source: 'wikidata', reason: e.message });
    return results;
  } finally {
    saveCache();
  }
  matches = matches.filter(Boolean);
  let images, info;
  try {
    images = await wikidataImages([...new Set(matches.map((m) => m.qid))]);
    info = await commonsInfo(Object.values(images));
  } catch (e) {
    skipped.push({ source: 'wikimedia_commons', reason: e.message });
    return results;
  }
  for (const m of matches) {
    const file = images[m.qid];
    const meta = file && info[file.replace(/_/g, ' ')];
    const license = meta && classifyLicense(meta.license_raw);
    if (!license) continue;
    results[m.key] = {
      source: 'wikidata_commons',
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
        const s = await cached('met:' + cand, () => getJson(url));
        const ids = ((s && s.objectIDs) || []).slice(0, 5);
        for (const id of ids) {
          const o = await cached('meto:' + id, () =>
            getJson('https://collectionapi.metmuseum.org/public/collection/v1/objects/' + id)
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
            match_confidence: cand === e.name ? 'medium' : 'low',
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
      const data = await cached('si:' + e.name, () => getJson(url));
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
  const found = await viaWikidata(entities, skipped);
  const missingInstruments = () => entities.filter((e) => e.kind === 'instrument' && !found[e.key]);
  Object.assign(found, await viaMet(missingInstruments(), skipped));
  Object.assign(found, await viaSmithsonian(missingInstruments(), skipped));

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

module.exports = { classifyLicense, nameCandidates, norm };
