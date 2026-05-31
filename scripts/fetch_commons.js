#!/usr/bin/env node
// Fetch image URL + license metadata from Wikimedia Commons.
//
// Strategy: query each entity's Commons category, pick the first acceptable
// file. Wikipedia pageimage is a secondary fallback when the category fails.
//
// Acceptable licenses (allowlist, matched leniently):
//   CC0, CC-BY 2.0/2.5/3.0/4.0, CC-BY-SA 2.0/2.5/3.0/4.0, public domain
//
// Blocked: any CC-BY-NC, CC-BY-ND, "fair use", "all rights reserved".

const fs = require('fs');
const path = require('path');
const https = require('https');

const args = process.argv.slice(2);
const opts = { limit: Infinity, start: 0, out: '/tmp/commons_fetch.json', map: 'scripts/_instrument_asset_map.json' };
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--limit') opts.limit = parseInt(args[++i], 10);
  else if (args[i] === '--start') opts.start = parseInt(args[++i], 10);
  else if (args[i] === '--out') opts.out = args[++i];
  else if (args[i] === '--map') opts.map = args[++i];
}

// ---- License classifier ----
function normalizeLicense(s) {
  if (!s) return '';
  return String(s).toLowerCase().replace(/[\s\-_]+/g, '-').trim();
}

function classifyLicense(short, long) {
  const s = normalizeLicense(short) || normalizeLicense(long);
  if (!s) return { ok: false, reason: 'empty', normalized: '' };
  if (/nc/.test(s) && /by/.test(s)) return { ok: false, reason: 'non_commercial', normalized: s };
  if (/nd/.test(s) && /by/.test(s)) return { ok: false, reason: 'no_derivatives', normalized: s };
  if (/fair-use/.test(s)) return { ok: false, reason: 'fair_use', normalized: s };
  if (/all-rights-reserved/.test(s)) return { ok: false, reason: 'arr', normalized: s };
  if (/copyrighted/.test(s) && !/cc-/.test(s)) return { ok: false, reason: 'copyrighted', normalized: s };
  if (/^cc-?0/.test(s)) return { ok: true, normalized: s };
  if (/^cc-by(-sa)?-[234](\.[05])?$/.test(s)) return { ok: true, normalized: s };
  if (/public-domain/.test(s)) return { ok: true, normalized: s };
  if (/^pd($|-)/.test(s)) return { ok: true, normalized: s };
  return { ok: false, reason: 'unrecognized', normalized: s };
}

function fetchJsonOnce(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'codex-music-tool/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchJsonOnce(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode === 429) return reject(new Error('rate_limit'));
      if (res.statusCode !== 200) return reject(new Error('http_' + res.statusCode));
      let body = '';
      res.setEncoding('utf8');
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch { reject(new Error('json_parse')); }
      });
    });
    req.setTimeout(15000, () => { req.destroy(new Error('timeout')); });
    req.on('error', reject);
  });
}

async function fetchJson(url) {
  try { return await fetchJsonOnce(url); }
  catch (e) {
    if (e.message === 'rate_limit' || e.message === 'timeout') {
      await sleep(2000);
      return await fetchJsonOnce(url);
    }
    throw e;
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function stripHtml(s) {
  if (!s) return '';
  return String(s).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 300);
}

async function commonsCategoryPick(category) {
  const title = category.startsWith('Category:') ? category : 'Category:' + category;
  const url = 'https://commons.wikimedia.org/w/api.php?action=query&format=json' +
    '&generator=categorymembers&gcmtitle=' + encodeURIComponent(title) +
    '&gcmtype=file&gcmlimit=20&prop=imageinfo' +
    '&iiprop=url|extmetadata&iiurlwidth=640';
  let data;
  try { data = await fetchJson(url); }
  catch (e) { return { error: 'commons_fetch_failed', detail: e.message }; }
  const pages = data.query && data.query.pages;
  if (!pages) return { error: 'category_empty_or_missing' };
  let firstReject = null;
  for (const p of Object.values(pages)) {
    const ii = (p.imageinfo || [])[0];
    if (!ii) continue;
    const em = ii.extmetadata || {};
    const shortName = (em.LicenseShortName && em.LicenseShortName.value) || '';
    const longName = (em.License && em.License.value) || '';
    const cls = classifyLicense(shortName, longName);
    const entry = {
      filename: p.title && p.title.replace(/^File:/, ''),
      url: ii.url,
      thumburl: ii.thumburl,
      license_short: shortName,
      license_long: longName,
      author: stripHtml((em.Artist && em.Artist.value) || ''),
      description: stripHtml((em.ImageDescription && em.ImageDescription.value) || ''),
      page_url: ii.descriptionurl,
      width: ii.thumbwidth || 0,
      height: ii.thumbheight || 0,
    };
    if (cls.ok) return { pick: entry };
    if (!firstReject) firstReject = { license: shortName || longName, reason: cls.reason, filename: entry.filename };
  }
  return { error: 'no_acceptable_license', first_reject: firstReject };
}

async function wikipediaPageImagePick(title) {
  const url = 'https://en.wikipedia.org/w/api.php?action=query&format=json' +
    '&titles=' + encodeURIComponent(title) + '&prop=pageimages&piprop=original|name&pithumbsize=640';
  let data;
  try { data = await fetchJson(url); }
  catch (e) { return { error: 'wikipedia_fetch_failed', detail: e.message }; }
  const pages = data.query && data.query.pages;
  if (!pages) return { error: 'wikipedia_no_pages' };
  for (const p of Object.values(pages)) {
    if (p.missing !== undefined) return { error: 'wikipedia_article_missing' };
    const pageimageFile = p.pageimage;
    if (!pageimageFile) continue;
    await sleep(500);
    const fileUrl = 'https://commons.wikimedia.org/w/api.php?action=query&format=json' +
      '&titles=File:' + encodeURIComponent(pageimageFile) + '&prop=imageinfo' +
      '&iiprop=url|extmetadata&iiurlwidth=640';
    let fileData;
    try { fileData = await fetchJson(fileUrl); }
    catch (e) { return { error: 'wikipedia_file_lookup_failed', detail: e.message }; }
    const filePages = fileData.query && fileData.query.pages;
    if (!filePages) continue;
    for (const fp of Object.values(filePages)) {
      const ii = (fp.imageinfo || [])[0];
      if (!ii) continue;
      const em = ii.extmetadata || {};
      const shortName = (em.LicenseShortName && em.LicenseShortName.value) || '';
      const longName = (em.License && em.License.value) || '';
      const cls = classifyLicense(shortName, longName);
      const entry = {
        filename: pageimageFile,
        url: ii.url,
        thumburl: ii.thumburl,
        license_short: shortName,
        license_long: longName,
        author: stripHtml((em.Artist && em.Artist.value) || ''),
        description: stripHtml((em.ImageDescription && em.ImageDescription.value) || ''),
        page_url: ii.descriptionurl,
        width: ii.thumbwidth || 0,
        height: ii.thumbheight || 0,
      };
      if (cls.ok) return { pick: entry };
      return { error: 'wikipedia_pageimage_bad_license', license: shortName || longName, reason: cls.reason };
    }
  }
  return { error: 'wikipedia_no_pageimage' };
}

async function fetchEntity(entry) {
  const result = { id: entry.id, name: entry.name };
  if (entry.commons_category) {
    const catResult = await commonsCategoryPick(entry.commons_category);
    if (catResult.pick) {
      result.source = 'commons_category';
      result.pick = catResult.pick;
      return result;
    }
    result.commons_error = catResult;
    await sleep(500);
  }
  if (entry.wikipedia) {
    const wikiResult = await wikipediaPageImagePick(entry.wikipedia);
    if (wikiResult.pick) {
      result.source = 'wikipedia_pageimage';
      result.pick = wikiResult.pick;
      return result;
    }
    result.wikipedia_error = wikiResult;
  }
  result.source = null;
  return result;
}

async function main() {
  const mapPath = path.resolve(opts.map);
  const entries = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  console.error('Loaded ' + entries.length + ' entries from ' + mapPath);
  const results = [];
  for (let i = opts.start; i < Math.min(entries.length, opts.start + opts.limit); i++) {
    const entry = entries[i];
    process.stderr.write('[' + (i + 1) + '/' + entries.length + '] ' + entry.id.padEnd(28) + ' ');
    const t0 = Date.now();
    let r;
    try { r = await fetchEntity(entry); }
    catch (e) { r = { id: entry.id, error: e.message }; }
    results.push(r);
    const status = r.pick
      ? '✓ ' + (r.pick.license_short || r.pick.license_long || '?') + ' (' + r.source + ')'
      : r.error
        ? 'ERROR ' + r.error
        : '✗ ' + ((r.commons_error && r.commons_error.error) || '') + ' / ' + ((r.wikipedia_error && r.wikipedia_error.error) || '');
    console.error(status + '  [' + (Date.now() - t0) + 'ms]');
    // Checkpoint every 25 entries so a session interruption keeps progress.
    if ((i + 1) % 25 === 0) fs.writeFileSync(opts.out, JSON.stringify(results, null, 2));
    await sleep(800);
  }
  fs.writeFileSync(opts.out, JSON.stringify(results, null, 2));
  const found = results.filter(r => r.pick).length;
  console.error('\nWrote ' + results.length + ' entries → ' + opts.out);
  console.error('Picked: ' + found + '  ·  Unpicked: ' + (results.length - found));
}

main().catch(e => { console.error(e); process.exit(1); });
