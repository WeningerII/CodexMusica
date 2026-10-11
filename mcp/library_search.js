// Exact Library search over the store lyric-harness/library/search_store.py
// builds (docs/library-native-design.md, "Search store").
//
// This is a line-for-line port of the approved Worker's search route
// (sites/library/lib/library-api.ts, /api/library/search) and its hit
// projection (sites/library/lib/search-hit.ts). The Worker ran SQL over D1;
// here the same columns are UTF-8 buffers, and every SQL function is
// reproduced with SQLite's own semantics:
//   instr(X, Y)        first match at a character boundary, 1-based in code
//                      points; an empty Y matches at 1
//   substr(X, 1, 180)  the first 180 code points
//   lower(X)           ASCII A-Z only (no ICU)
//   ORDER BY ...       BINARY collation, i.e. UTF-8 byte order (precomputed)
// No canonical reading is parsed on a request: a hit reads only the
// compressed projection chunks that intersect it.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const FOLD = require('./library_casefold.json');
const PAGE_BYTES = 2 * 1024 * 1024;
const COLUMNS = ['title', 'contributor', 'contributor_lower', 'body', 'metadata'];
export const SEARCH_LIMIT = 100;

export class LibraryError extends Error {
  constructor(code, message, status = 400, remedy = 'Check the input and try again.') {
    super(message);
    Object.assign(this, { code, status, remedy });
  }
}

/** The Worker's searchText: NFC, the recorded casefold table, whitespace collapse. */
export function searchText(s) {
  return Array.from(String(s).normalize('NFC'))
    .map((c) => FOLD[c] ?? c)
    .join('')
    .replace(/\s+/gu, ' ')
    .trim();
}

const intersects = (a, b) => a[0] < b[1] && b[0] < a[1];
// Code points in a UTF-8 slice: every byte that is not a continuation byte.
function codePoints(buf, start, end) {
  let n = 0;
  for (let i = start; i < end; i++) if ((buf[i] & 0xc0) !== 0x80) n++;
  return n;
}

export class LibrarySearch {
  constructor(directory) {
    this.directory = directory;
    const read = (name) => fs.readFileSync(path.join(directory, name));
    this.store = JSON.parse(read('store.json'));
    if (this.store.format !== 1)
      throw new Error(`Unsupported library search store format ${this.store.format}`);
    this.units = JSON.parse(read('units.json'));
    const n = this.units.ids.length;
    if (n !== this.store.unit_count) throw new Error('Library search store unit count mismatch');
    this.index = new Map(this.units.ids.map((id, i) => [id, i]));
    const table = read('offsets.bin');
    this.offsets = {};
    COLUMNS.forEach((name, c) => {
      this.offsets[name] = new Uint32Array(table.buffer, table.byteOffset + c * (n + 1) * 4, n + 1);
    });
    for (const name of ['title', 'contributor', 'contributor_lower', 'body']) {
      this[name] = read(`${name}.bin`);
      if (this[name].length !== this.offsets[name][n])
        throw new Error(`Library search store column ${name} is truncated`);
    }
    for (const name of ['metadata', 'projection']) {
      const size = fs.statSync(path.join(directory, `${name}.bin`)).size;
      if (name === 'metadata' && size !== this.offsets.metadata[n])
        throw new Error('Library search store metadata is truncated');
      this[`${name}Fd`] = fs.openSync(path.join(directory, `${name}.bin`), 'r');
    }
  }
  close() {
    fs.closeSync(this.metadataFd);
    fs.closeSync(this.projectionFd);
  }
  get snapshotId() {
    return this.store.snapshot_id;
  }
  _readInflated(fd, offset, length) {
    const buf = Buffer.allocUnsafe(length);
    let got = 0;
    while (got < length) {
      const n = fs.readSync(fd, buf, got, length - got, offset + got);
      if (n <= 0) throw new LibraryError('STORAGE_CORRUPT', 'The search store is truncated.', 503);
      got += n;
    }
    return JSON.parse(zlib.inflateRawSync(buf).toString('utf8'));
  }
  metadata(i) {
    const off = this.offsets.metadata;
    return this._readInflated(this.metadataFd, off[i], off[i + 1] - off[i]);
  }
  /** GET /metadata/:id — the Worker's metadata route. */
  metadataById(id) {
    const i = this.index.get(id);
    if (i === undefined)
      throw new LibraryError('NOT_FOUND', 'This record is not in the snapshot.', 404);
    return this.metadata(i);
  }
  /** What analysis admission needs about a unit, or null if it is not in the snapshot. */
  unit(id) {
    const i = this.index.get(id);
    if (i === undefined) return null;
    return {
      availability: this.units.availability[i],
      revision: this.units.revision[i],
      lines: this.metadata(i).lines,
    };
  }
  // Units whose column contains the needle, each with its first match's byte
  // offset inside that unit (SQLite instr: the first occurrence).
  _matches(name, needle, into) {
    if (!needle.length) throw new Error('an empty needle matches every unit');
    const buf = this[name],
      off = this.offsets[name],
      n = off.length - 1;
    let from = 0;
    for (;;) {
      const at = buf.indexOf(needle, from);
      if (at < 0) return into;
      // The unit holding byte `at`: the last i with off[i] <= at.
      let lo = 0,
        hi = n - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >>> 1;
        if (off[mid] <= at) lo = mid;
        else hi = mid - 1;
      }
      // Skip empty units sharing this offset: the match lies in the first
      // unit whose range actually contains it.
      while (lo < n - 1 && off[lo + 1] <= at) lo++;
      if (at + needle.length <= off[lo + 1] && !into.has(lo)) into.set(lo, at - off[lo]);
      from = off[lo + 1] > at ? off[lo + 1] : at + 1;
    }
  }
  _projectHit(i, start, length) {
    const proj = this.units.projection[i];
    if (!proj) return null;
    const searchRange = [start, start + length];
    const load = (chunks, range) => {
      const out = [];
      for (const [offset, size, bound] of chunks) {
        if (bound && !intersects(bound, range)) continue;
        out.push(...this._readInflated(this.projectionFd, offset, size));
      }
      return out;
    };
    const spans = load(proj.spans, searchRange);
    const hits = spans.filter((s) => intersects(s.search_cp_range, searchRange));
    if (!hits.length) return null;
    const normalized = hits.map((s) =>
      s.precision === 'exact' &&
      s.search_cp_range[1] - s.search_cp_range[0] ===
        s.normalized_cp_range[1] - s.normalized_cp_range[0]
        ? [
            s.normalized_cp_range[0] + Math.max(start - s.search_cp_range[0], 0),
            s.normalized_cp_range[1] - Math.max(s.search_cp_range[1] - searchRange[1], 0),
          ]
        : s.normalized_cp_range
    );
    const range = [
      Math.min(...normalized.map((r) => r[0])),
      Math.max(...normalized.map((r) => r[1])),
    ];
    const lines = load(proj.lines, range);
    const matching = lines.filter(
      (l) => l.normalized_cp_range && intersects(l.normalized_cp_range, range)
    );
    if (!matching.length) return null;
    const line = matching[0],
      transforms = line.transformation_spans ?? [],
      sourceRanges = [];
    const encoder = new TextEncoder();
    for (const t of transforms) {
      if (!intersects(t.normalized_cp_range, range) || t.kind === 'deleted') continue;
      const exact =
        t.precision === 'exact' &&
        t.source_cp_range[1] - t.source_cp_range[0] ===
          t.normalized_cp_range[1] - t.normalized_cp_range[0];
      const cp = exact
        ? [
            t.source_cp_range[0] + Math.max(range[0] - t.normalized_cp_range[0], 0),
            t.source_cp_range[1] - Math.max(t.normalized_cp_range[1] - range[1], 0),
          ]
        : t.source_cp_range;
      const rowStart = line.source_cp_range[0],
        chars = Array.from(line.source_text),
        prefix = chars.slice(0, cp[0] - rowStart).join(''),
        value = chars.slice(cp[0] - rowStart, cp[1] - rowStart).join('');
      sourceRanges.push({
        physical_line: line.physical_line,
        codepoint_range: cp,
        utf16_range: [
          line.source_utf16_range[0] + prefix.length,
          line.source_utf16_range[0] + prefix.length + value.length,
        ],
        byte_range: [
          line.byte_range[0] + encoder.encode(prefix).length,
          line.byte_range[0] + encoder.encode(prefix + value).length,
        ],
        precision: exact ? 'exact' : 'span',
      });
    }
    return {
      line_id: line.id,
      line_ids: matching.map((l) => l.id),
      physical_line: line.physical_line,
      row_offset: line.row,
      normalized_cp_range: range,
      source_ranges: sourceRanges,
      precision:
        hits.every((s) => s.precision === 'exact') &&
        sourceRanges.every((s) => s.precision === 'exact')
          ? 'exact'
          : 'span',
      snippet: Array.from(line.source_text).slice(0, 240).join(''),
    };
  }
  /**
   * The Worker's /api/library/search, answering from the store. `params`
   * needs only get(name) -> string | null (URLSearchParams semantics).
   * `maxLimit` is the page cap: 100 on /library/v1 (no UI asks for more),
   * 250 to replay the Worker's goldens.
   */
  search(params, { maxLimit = SEARCH_LIMIT } = {}) {
    const q = searchText(params.get('q') ?? '');
    if (q.length > 500)
      throw new LibraryError('BAD_QUERY', 'Search queries may contain at most 500 characters.');
    const limit = Math.min(maxLimit, Number(params.get('limit') ?? 100)),
      offset = Number(params.get('offset') ?? 0);
    if (!Number.isSafeInteger(limit) || limit < 1 || !Number.isSafeInteger(offset) || offset < 0)
      throw new LibraryError('BAD_QUERY', 'Invalid search page.');
    const u = this.units;
    const eq = [];
    for (const field of ['language', 'availability', 'completeness']) {
      const value = params.get(field);
      if (value && value !== 'all') eq.push([u[field], value]);
    }
    const work = params.get('work');
    if (work) eq.push([u.work, work]);
    const collection = params.get('collection');
    const contributor = params.get('contributor');
    // instr(lower(r.contributor), fold(x)) > 0; an empty needle matches at 1.
    let contributorUnits = null;
    if (contributor) {
      const needle = Buffer.from(searchText(contributor), 'utf8');
      contributorUnits = needle.length
        ? this._matches('contributor_lower', needle, new Map())
        : null;
    }
    let matched = null,
      bodyAt = new Map();
    if (q) {
      const needle = Buffer.from(q, 'utf8');
      matched = new Set();
      for (const name of ['title', 'contributor']) {
        for (const i of this._matches(name, needle, new Map()).keys()) matched.add(i);
      }
      bodyAt = this._matches('body', needle, new Map());
      for (const i of bodyAt.keys()) matched.add(i);
    }
    const order = params.get('sort') === 'contributor' ? u.sort_contributor : u.sort_title;
    const page = [];
    let total = 0;
    for (const i of order) {
      if (matched && !matched.has(i)) continue;
      let ok = true;
      for (const [column, value] of eq)
        if (column[i] !== value) {
          ok = false;
          break;
        }
      if (!ok) continue;
      if (collection && !u.collections[i].includes(collection)) continue;
      if (contributorUnits && !contributorUnits.has(i)) continue;
      if (total >= offset && page.length < limit) page.push(i);
      total++;
    }
    const qLength = Array.from(q).length;
    const body = this.body,
      bo = this.offsets.body;
    const items = page.map((i) => {
      const item = this.metadata(i);
      // instr(r.body, q): 0 for no match; q is never empty here when it counts.
      const at = q ? bodyAt.get(i) : undefined;
      const position = at === undefined ? 0 : codePoints(body, bo[i], bo[i] + at) + 1;
      const hit =
        q && position > 0 && item.availability === 'readable'
          ? this._projectHit(i, position - 1, qLength)
          : null;
      // substr(r.body, 1, 180): 180 code points fit in 720 UTF-8 bytes.
      const snippet = Array.from(body.toString('utf8', bo[i], Math.min(bo[i] + 720, bo[i + 1])))
        .slice(0, 180)
        .join('');
      return { ...item, snippet: hit?.snippet ?? snippet, search_hit: hit };
    });
    const payload = () => ({
      snapshot_id: this.snapshotId,
      items,
      total,
      next_offset: offset + items.length < total ? offset + items.length : null,
    });
    while (items.length > 1 && Buffer.byteLength(JSON.stringify(payload())) > PAGE_BYTES)
      items.pop();
    if (Buffer.byteLength(JSON.stringify(payload())) > PAGE_BYTES)
      throw new LibraryError(
        'RESOURCE_LIMIT',
        'This metadata record exceeds the page byte budget.',
        413
      );
    return payload();
  }
}

/** The Worker's error body. */
export function errorBody(error) {
  return {
    error: {
      code: error.code ?? 'LIBRARY_ERROR',
      message: error.message,
      remedy: error.remedy ?? 'Retry explicitly.',
    },
  };
}
