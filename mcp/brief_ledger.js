// brief_ledger.js — which lines a lyric_revise run flagged without briefing,
// kept across calls so a later run cannot hand-edit them (Refs #665).
//
// One entry per run. It holds no lyric text: every line is kept only as a
// short keyed digest of its FOLDED text (NFKC, lowercase, letters, marks and
// digits only), under a key derived from the server secret and used for
// nothing else. "Changed" and "put back" are both judged on that folded text,
// so a retype that differs only in case, spacing or punctuation is the same
// line.
//
// The store fails closed: a file that cannot be read or parsed, a file whose
// key check is missing or malformed, a file that holds even one damaged
// entry, or a key that cannot be loaded makes it unhealthy, and while it is
// unhealthy the caller refuses every revise run. A file that failed to load
// is never written over until recover() reads it again. A well-formed key
// check that does not match (the server secret changed) is not damage: the
// old entries cannot be matched any more, so they are dropped and the store
// starts empty, with a log line. The file carries no checksum: damage that
// keeps every field's shape is not detected.
//
// Durable when BRIEF_LEDGER_FILE or LYRIC_RUNTIME_DIR names a disk, and saved
// as RunLedger saves (run_store.js): a 'wx' temp file at 0600, fsync, rename,
// then a directory fsync. Otherwise it covers the life of the process. The
// key comes from the server secret (loadChatSecret): with BRIEF_LEDGER_FILE
// and no CHAT_SECRET, CHAT_SECRET_FILE or LYRIC_RUNTIME_DIR that secret is new
// on every start, so every restart reads as a key change and drops the store;
// createBriefLedger logs that at start.
import { createHash, createHmac, hkdfSync, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { loadChatSecret } from './job_store.js';

export const BRIEF_RETAIN_MS = 3 * 60 * 60 * 1000;
export const BRIEF_CAP = 2000; // free partition, by count, plus the TTL
export const BRIEF_PAID_CAP = 2000; // writer === 'kitchen'; the same TTL
// Items kept per partition, over all its entries: each entry counts its lines,
// its protected lines and its undo items. A store over the budget (or over its
// count cap) is pruned before a new entry is kept, so the heap and the cost of
// each save stay bounded. Pruning drops first the entries that guard nothing
// (retired, or with no protected line and no undo item), oldest first, and only
// then the oldest of the rest: under that load a live entry's protection can
// end before its 3 hours.
export const BRIEF_LINE_BUDGET = 100_000;
// A progress capture that is not saved at once is saved this long after.
export const BRIEF_SAVE_GAP_MS = 1000;
const MAX_WIRES = 8;
const MAX_UNDO = 256;
const KEY_LABEL = 'lyric-brief-v1';
const STATUSES = new Set([
  'progress',
  'suspended',
  'parked',
  'uncertified',
  'interrupted',
  'journal_capacity',
]);

// The same entry id RunLedger uses for a run_id (run_store.js).
const runDigest = (runId) => createHash('sha256').update(String(runId)).digest('hex').slice(0, 32);

// Letters, combining marks (a vowel sign is part of the word) and digits. A
// line with none of them keeps its symbols, so two such lines stay apart.
export function fold(line) {
  const text = String(line).normalize('NFKC');
  const kept = text.toLowerCase().replace(/[^\p{L}\p{M}\p{N}]/gu, '');
  return kept || '\0' + text.replace(/\s+/gu, '');
}

export function deriveBriefKey(secret) {
  return Buffer.from(hkdfSync('sha256', String(secret), Buffer.alloc(0), KEY_LABEL, 32));
}

// Longest common subsequence on folded digests; within each gap between two
// anchors, old and new lines are paired by position as substitutions, and
// what is left over is deleted (old) or inserted (new). Indices are 0-based.
export function alignLines(oldFo, newFo) {
  const n = oldFo.length,
    m = newFo.length;
  const w = m + 1;
  const dp = new Uint16Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i * w + j] =
        oldFo[i] === newFo[j]
          ? dp[(i + 1) * w + j + 1] + 1
          : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1]);
  const pairs = [],
    subs = [],
    deleted = [],
    inserted = [];
  const gap = (i0, i1, j0, j1) => {
    let i = i0,
      j = j0;
    for (; i < i1 && j < j1; i++, j++) subs.push([i, j]);
    for (; i < i1; i++) deleted.push(i);
    for (; j < j1; j++) inserted.push(j);
  };
  let i = 0,
    j = 0,
    gi = 0,
    gj = 0;
  while (i < n && j < m) {
    if (oldFo[i] === newFo[j]) {
      gap(gi, i, gj, j);
      pairs.push([i, j]);
      i++;
      j++;
      gi = i;
      gj = j;
    } else if (dp[(i + 1) * w + j] >= dp[i * w + j + 1]) i++;
    else j++;
  }
  gap(gi, n, gj, m);
  return { pairs, subs, deleted, inserted };
}

// old index -> new index (pairs and substitutions), -1 when deleted.
function mapOf(align, n) {
  const map = new Int32Array(n).fill(-1);
  for (const [i, j] of align.pairs) map[i] = j;
  for (const [i, j] of align.subs) map[i] = j;
  return map;
}

const LINE = (v, n) => Number.isSafeInteger(v) && v >= 1 && v <= n;
const DIGEST = (v) => typeof v === 'string' && /^[A-Za-z0-9+/]{11}=$/.test(v);
const WIRE = (v) => typeof v === 'string' && /^[0-9a-f]{32}$/.test(v);

function validEntry(e) {
  if (!e || typeof e !== 'object') return false;
  if (!/^[0-9a-f]{32}$/.test(e.id) || !Number.isFinite(e.t) || !STATUSES.has(e.status))
    return false;
  if (!Number.isSafeInteger(e.n) || e.n < 0 || !Array.isArray(e.fo) || e.fo.length !== e.n)
    return false;
  if (!e.fo.every(DIGEST)) return false;
  if (!Array.isArray(e.prot) || !e.prot.every((p) => LINE(p, e.n))) return false;
  // An undo item's line 0 is a replaced line no longer in the song: its old
  // text may not come back anywhere.
  if (
    !Array.isArray(e.undo) ||
    !e.undo.every((u) => Array.isArray(u) && (u[0] === 0 || LINE(u[0], e.n)) && DIGEST(u[1]))
  )
    return false;
  if (e.retired !== undefined && typeof e.retired !== 'boolean') return false;
  return Array.isArray(e.wires) && e.wires.every(WIRE);
}

// What an entry costs the store: its lines, protected lines and undo items.
const weightOf = (e) => e.n + e.prot.length + e.undo.length;

// Line numbers as a sorted unique list.
const uniq = (xs) => [...new Set(xs)].sort((a, b) => a - b);

export class BriefLedger {
  constructor({
    file = null,
    key,
    now = () => Date.now(),
    retainMs = BRIEF_RETAIN_MS,
    cap = BRIEF_CAP,
    paidCap = BRIEF_PAID_CAP,
    lineBudget = BRIEF_LINE_BUDGET,
    saveGapMs = BRIEF_SAVE_GAP_MS,
    log = console.error,
  } = {}) {
    this.file = file;
    this.keySource = key;
    this.now = now;
    this.retainMs = retainMs;
    this.cap = cap;
    this.paidCap = paidCap;
    this.lineBudget = lineBudget;
    this.saveGapMs = saveGapMs;
    this.saveTimer = null;
    this.log = log;
    this.free = new Map(); // id -> entry, insertion order = recency
    this.paid = new Map();
    this.index = new Map(); // folded digest -> Set of entry ids
    this.isHealthy = true;
    this.loadFailed = false;
    this.key = null;
    this.keyCheck = null;
    if (this.loadKey()) this.load();
  }

  get healthy() {
    return this.isHealthy;
  }

  loadKey() {
    try {
      const k = typeof this.keySource === 'function' ? this.keySource() : this.keySource;
      if (!k || !(Buffer.isBuffer(k) || typeof k === 'string')) throw new Error('no key');
      this.key = Buffer.isBuffer(k) ? k : Buffer.from(k);
      this.keyCheck = this.mac('k', 'key-check');
      return true;
    } catch (err) {
      this.key = null;
      this.loadFailed = true;
      this.fail(err, 'key unavailable');
      return false;
    }
  }

  mac(kind, text, bytes = 8) {
    return createHmac('sha256', this.key)
      .update(kind + '\0' + text)
      .digest()
      .subarray(0, bytes)
      .toString('base64');
  }

  fail(err, what) {
    this.isHealthy = false;
    this.log(
      `[briefs] store ${what} (${err.code || err.message}); revise runs are refused until it is repaired.`
    );
  }

  // Reads the file (sweeping a kill's leftover temp files first). A file that
  // is not JSON, not an object, or holds one malformed entry fails closed: a
  // damaged entry may be the one that protects a line, so none is dropped.
  load() {
    if (!this.file) {
      this.loadFailed = false;
      return;
    }
    try {
      const base = path.basename(this.file) + '.';
      for (const name of fs.readdirSync(path.dirname(this.file)))
        if (name.startsWith(base) && name.endsWith('.tmp'))
          fs.rmSync(path.join(path.dirname(this.file), name), { force: true });
    } catch {}
    let raw;
    try {
      raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (!raw || typeof raw !== 'object' || Array.isArray(raw))
        throw new Error('store is not an object');
      // Only this store's own format is read (or, with another key, started
      // over); any other file fails closed rather than being written over.
      if (raw.v !== 1 || !Array.isArray(raw.free) || !Array.isArray(raw.paid))
        throw new Error('store is not a brief ledger');
      // A key check that is missing, cut short or not shaped like one is
      // damage; only a well-formed one that does not match is a key change.
      if (!DIGEST(raw.kc)) throw new Error('store key check is damaged');
    } catch (err) {
      if (err.code === 'ENOENT') {
        this.loadFailed = false;
        return;
      }
      this.loadFailed = true;
      this.fail(err, 'unreadable');
      return;
    }
    if (raw.kc !== this.keyCheck) {
      this.loadFailed = false;
      this.log('[briefs] store key changed; its entries are dropped and it starts empty.');
      this.save();
      return;
    }
    const bad = ['free', 'paid'].reduce(
      (k, part) => k + raw[part].filter((e) => !validEntry(e)).length,
      0
    );
    if (bad) {
      this.loadFailed = true;
      this.fail(new Error(`${bad} damaged entr${bad === 1 ? 'y' : 'ies'}`), 'damaged');
      return;
    }
    this.loadFailed = false;
    const cutoff = this.now() - this.retainMs;
    for (const [part, map] of [
      ['free', this.free],
      ['paid', this.paid],
    ])
      for (const e of raw[part])
        if (e.t >= cutoff && !this.get(e.id)) {
          const entry = {
            id: e.id,
            t: e.t,
            status: e.status,
            n: e.n,
            fo: e.fo,
            prot: uniq(e.prot),
            undo: e.undo.map((u) => [u[0], u[1]]),
            wires: e.wires.slice(-MAX_WIRES),
            ...(e.retired ? { retired: true } : {}),
          };
          map.set(e.id, entry);
          this.indexAdd(entry);
        }
  }

  // A store whose file failed to load re-reads it (it may have been repaired
  // or removed); one whose save failed retries the save; one whose key failed
  // retries the key. Entries captured meanwhile are kept over loaded ones.
  recover() {
    if (this.isHealthy) return true;
    if (!this.key && !this.loadKey()) return false;
    if (this.loadFailed) {
      const held = [...this.free.values(), ...this.paid.values()].map((e) => [
        e,
        this.paid.has(e.id),
      ]);
      this.clear();
      this.load();
      if (this.loadFailed) {
        for (const [e, paid] of held) this.put(e, paid);
        return false;
      }
      for (const [e, paid] of held) this.put(e, paid);
      this.isHealthy = true;
      this.log('[briefs] store read again; revise runs are checked against it once more.');
      if (held.length) this.save();
      return this.isHealthy;
    }
    this.save();
    return this.isHealthy;
  }

  clear() {
    this.free.clear();
    this.paid.clear();
    this.index.clear();
  }

  resetForTests() {
    this.clear();
    this.isHealthy = true;
    this.loadFailed = false;
    if (!this.key) this.loadKey();
  }

  // Per-line digests: ex of the exact text, fo of the folded text. Only fo is
  // stored and compared; ex is for callers that need the exact identity.
  digests(lines) {
    const list = Array.isArray(lines) ? lines.map(String) : [];
    return {
      ex: list.map((l) => this.mac('e', l)),
      fo: list.map((l) => this.mac('f', fold(l))),
    };
  }

  wireDigest(wireKey) {
    return createHmac('sha256', this.key)
      .update('w\0' + String(wireKey))
      .digest('hex')
      .slice(0, 32);
  }

  // True when this server returned that wire (its wireKey) for a live run.
  minted(wireKey) {
    if (typeof wireKey !== 'string' || !this.key) return false;
    const d = this.wireDigest(wireKey);
    const cutoff = this.now() - this.retainMs;
    for (const map of [this.free, this.paid])
      for (const e of map.values()) if (e.t >= cutoff && e.wires.includes(d)) return true;
    return false;
  }

  get(id) {
    return this.paid.get(id) || this.free.get(id) || null;
  }

  // A retired entry (one a later run on its song took over) is not matched
  // by content; it still answers for its own run_id and its own wires.
  indexAdd(e) {
    if (e.retired) return;
    for (const d of new Set(e.fo)) {
      if (!this.index.has(d)) this.index.set(d, new Set());
      this.index.get(d).add(e.id);
    }
  }

  indexDrop(e) {
    for (const d of new Set(e.fo)) {
      const s = this.index.get(d);
      if (!s) continue;
      s.delete(e.id);
      if (!s.size) this.index.delete(d);
    }
  }

  drop(id) {
    const e = this.get(id);
    if (!e) return;
    this.indexDrop(e);
    this.free.delete(id);
    this.paid.delete(id);
  }

  put(e, paid) {
    this.drop(e.id);
    (paid ? this.paid : this.free).set(e.id, e);
    this.indexAdd(e);
  }

  // Expired entries go first. Then, while a partition is over its count cap or
  // its item budget, the entries that guard nothing (retired, or with no
  // protected line and no undo item) go oldest first, and only then the
  // oldest of the rest. Entries are in recency order. `keep` is the entry a
  // capture has just written: it is never the one dropped to make room.
  prune(keep = null) {
    const cutoff = this.now() - this.retainMs;
    let changed = false;
    for (const map of [this.free, this.paid])
      for (const [id, e] of map)
        if (e.t < cutoff) {
          this.drop(id);
          changed = true;
        }
    const idle = (e) => e.retired || (!e.prot.length && !e.undo.length);
    for (const [map, cap] of [
      [this.free, this.cap],
      [this.paid, this.paidCap],
    ]) {
      let items = 0;
      for (const e of map.values()) items += weightOf(e);
      const over = () => map.size > cap || items > this.lineBudget;
      for (const pass of [idle, () => true])
        for (const [id, e] of map) {
          if (!over()) break;
          if (id === keep || !pass(e)) continue;
          items -= weightOf(e);
          this.drop(id);
          changed = true;
        }
    }
    return changed;
  }

  // Live entries the draft descends from: more than half its lines in common
  // (folded LCS). A song that merely shares a line with another run's song,
  // a protected one included, is a different song: it is not checked
  // against that run, and it neither takes over nor inherits its protection.
  // Newest first.
  matches(sets, exclude) {
    const ids = new Set();
    for (const fo of sets)
      for (const d of new Set(fo)) for (const id of this.index.get(d) || []) ids.add(id);
    ids.delete(exclude);
    const hits = [];
    for (const id of ids) {
      const e = this.get(id);
      if (!e) continue;
      const hit = sets.some((fo) => {
        const have = new Set(fo);
        let shared = 0;
        for (const d of e.fo) if (have.has(d)) shared++;
        const need = Math.max(fo.length, e.n);
        if (shared * 2 <= need) return false;
        return alignLines(e.fo, fo).pairs.length * 2 > need;
      });
      if (hit) hits.push(e);
    }
    return hits.sort((a, b) => b.t - a.t);
  }

  // Compares one candidate entry against one incoming line set (folded
  // digests). Line numbers out are 1-based, in the incoming numbering.
  compare(e, fo) {
    const align = alignLines(e.fo, fo);
    const map = mapOf(align, e.n);
    const changed = [],
      removedAfter = [],
      undone = [],
      held = [],
      prot = [],
      undo = [];
    for (const p of e.prot) {
      const j = map[p - 1];
      if (j < 0) {
        let after = 0;
        for (let i = p - 2; i >= 0; i--)
          if (map[i] >= 0) {
            after = map[i] + 1;
            break;
          }
        removedAfter.push(after);
      } else {
        held.push(j + 1);
        if (fo[j] !== e.fo[p - 1]) changed.push(j + 1);
        else prot.push(j + 1);
      }
    }
    // A replaced line's old text may not come back on any line that is not
    // one of the entry's own lines kept as they were: at its place, on an
    // inserted line, or (once its line is gone) anywhere.
    const paired = new Set(align.pairs.map(([, j]) => j));
    for (const [line, d] of e.undo) {
      const j = line ? map[line - 1] : -1;
      let back = false;
      for (let k = 0; k < fo.length; k++)
        if (fo[k] === d && !paired.has(k)) {
          undone.push(k + 1);
          back = true;
        }
      if (!back) undo.push([j >= 0 ? j + 1 : 0, d]);
    }
    return { changed, removedAfter, undone, held, prot, undo };
  }

  // { runId, lineSets: [draft, ...decoded wire line lists], wires: [wireKey] }
  // The first line set is the draft the run starts from; inherited lines are
  // numbered in it. Every candidate must pass on every line set.
  check({ runId = null, lineSets = [], wires = [] } = {}) {
    if (this.prune()) this.save();
    const sets = lineSets.filter(Array.isArray).map((l) => this.digests(l).fo);
    const ownId = runId ? runDigest(runId) : null;
    const own = ownId ? this.get(ownId) : null;
    const wireList = wires.filter((w) => typeof w === 'string');
    const exempt = wireList.length > 0 && wireList.every((w) => this.minted(w));
    const cands = own ? [own] : [];
    if (exempt) {
      // A minted wire pins the draft to what this server returned; the
      // entries that minted it are the only ones it continues.
      const ds = new Set(wireList.map((w) => this.wireDigest(w)));
      for (const map of [this.free, this.paid])
        for (const e of map.values())
          if (e.id !== ownId && e.wires.some((d) => ds.has(d))) cands.push(e);
      // Every live entry the draft descends from is a candidate: a cap on
      // their number would let newer runs on look-alike songs push the one
      // that protects a line out of the check.
    } else cands.push(...this.matches(sets, ownId));
    const inherited = { prot: [], undo: [] };
    // A wire often carries the same lines twice (its accepted lines and its
    // final draft): a line set equal to an earlier one is compared once.
    const compared = new Set();
    for (let k = 0; k < sets.length; k++) {
      const fo = sets[k];
      const same = fo.join();
      if (compared.has(same)) continue;
      compared.add(same);
      const out = cands.map((e) => this.compare(e, fo));
      const changed = uniq(out.flatMap((o) => o.changed));
      const removedAfter = uniq(out.flatMap((o) => o.removedAfter));
      const undone = uniq(out.flatMap((o) => o.undone));
      if (changed.length || removedAfter.length || undone.length) {
        const held = new Set([...out.flatMap((o) => o.held), ...undone]);
        const may = [];
        for (let j = 1; j <= fo.length; j++) if (!held.has(j)) may.push(j);
        return { ok: false, reason: 'brief', set: k, changed, removedAfter, undone, may };
      }
      if (k === 0) {
        inherited.prot = uniq(out.flatMap((o) => o.prot));
        const seen = new Set();
        for (const o of out)
          for (const u of o.undo)
            if (!seen.has(u.join())) {
              seen.add(u.join());
              inherited.undo.push(u);
            }
      }
    }
    // A wire this server did not return, for a song a live entry protects
    // lines in, is refused outright even where its lines pass: its records
    // (what it says was asked and answered) are not the run's own, and could
    // free those lines at capture. An entry that protects nothing has nothing
    // a forged record could free, so it does not refuse the wire.
    const protects = cands.some((e) => e.prot.length > 0);
    const replaced = cands.some((e) => e.undo.length > 0);
    if (wireList.length && !exempt && (protects || replaced))
      return {
        ok: false,
        reason: 'unminted_wire',
        protects,
        replaced,
        set: 0,
        changed: [],
        removedAfter: [],
        undone: [],
        may: [],
      };
    return {
      ok: true,
      supersedes: cands.filter((e) => e.id !== ownId).map((e) => ({ id: e.id, t: e.t })),
      inherited,
    };
  }

  // Records where a run stands. cur is the song as the run left it, input the
  // draft it started from; flagged and briefed are 1-based lines of cur (a
  // whole-draft flag briefs every line). flagged is the lines that carry a
  // flag now, or null when this capture does not know them. Where it knows,
  // only those lines are protected: a line whose flag has cleared is free,
  // whoever protected it before. Where it does not know, the lines protected
  // so far stay protected where their text was kept: the ones check inherited
  // (numbered in input) and the ones the run's own entry holds. supersedes
  // are retired only if unchanged since check (by t).
  // persist false defers the save by saveGapMs (one save covers every capture
  // made meanwhile) instead of skipping it.
  async capture({
    runId,
    paid = false,
    status = 'progress',
    cur = [],
    input = [],
    flagged = null,
    briefed = [],
    whole = false,
    wire = null,
    supersedes = [],
    inherited = { prot: [], undo: [] },
    persist = true,
  } = {}) {
    if (!runId || !this.key) return;
    if (!STATUSES.has(status)) throw new Error(`unknown brief status ${status}`);
    const id = runDigest(runId);
    const curFo = this.digests(cur).fo;
    const inFo = this.digests(input).fo;
    const n = curFo.length;
    const align = alignLines(inFo, curFo);
    const map = mapOf(align, inFo.length);
    const at = (line) => (LINE(line, inFo.length) ? map[line - 1] + 1 : 0);
    const prev = this.get(id);
    // A protected line carried over stays protected only where its text was
    // kept: a line the loop itself replaced was asked about, and its old text
    // is held by the undo rule instead.
    let carried = [];
    if (!Array.isArray(flagged)) {
      const kept = new Map(align.pairs.map(([i, j]) => [i + 1, j + 1]));
      carried = (inherited?.prot || []).map((p) => kept.get(p) || 0);
      if (prev?.prot.length) {
        const held = new Map(alignLines(prev.fo, curFo).pairs.map(([i, j]) => [i + 1, j + 1]));
        carried.push(...prev.prot.map((p) => held.get(p) || 0));
      }
    }
    const free = whole ? null : new Set(briefed);
    const prot = uniq(
      (Array.isArray(flagged) ? flagged : carried).filter(
        (p) => LINE(p, n) && (free ? !free.has(p) : false)
      )
    );
    const undo = [];
    const seen = new Set();
    const addUndo = (line, d) => {
      if (!DIGEST(d) || (line !== 0 && (!LINE(line, n) || curFo[line - 1] === d))) return;
      const k = line + ':' + d;
      if (!seen.has(k)) {
        seen.add(k);
        undo.push([line, d]);
      }
    };
    for (const [i, j] of align.subs) addUndo(j + 1, inFo[i]);
    for (const [line, d] of inherited?.undo || []) addUndo(at(line), d);
    const wires = (prev?.wires || []).slice();
    if (typeof wire === 'string') {
      const d = this.wireDigest(wire);
      const k = wires.indexOf(d);
      if (k >= 0) wires.splice(k, 1);
      wires.push(d);
    }
    // A superseded entry is retired, not dropped: it no longer matches by
    // content, but a run set aside on it can still continue on its own wire.
    for (const s of supersedes || []) {
      const old = s && s.id !== id ? this.get(s.id) : null;
      if (old && old.t === s.t && !old.retired) {
        this.indexDrop(old);
        old.retired = true;
      }
    }
    let t = this.now();
    if (prev && prev.t >= t) t = prev.t + 1; // t moves forward, for compare-and-set
    this.put(
      {
        id,
        t,
        status,
        n,
        fo: curFo,
        prot,
        undo: undo.slice(-MAX_UNDO),
        wires: wires.slice(-MAX_WIRES),
      },
      paid === true
    );
    this.prune(id);
    if (persist) this.save();
    else this.saveSoon();
  }

  // Records, on a run's own entry, a wire the server itself built for that run
  // (the state or checkpoint of a resumed call, made from the server's own
  // stored progress record), changing nothing else, and saves at once. The run
  // is named by its run_id, or by the run ref its records carry: the sha256 of
  // that id, whose first half is the entry's id. No entry, no wire; a wire the
  // entry already holds is left as it is.
  mint({ runId = null, ref = null, wire } = {}) {
    if (!this.key || typeof wire !== 'string') return false;
    const id = runId
      ? runDigest(runId)
      : typeof ref === 'string' && /^[0-9a-f]{64}$/.test(ref)
        ? ref.slice(0, 32)
        : null;
    const e = id ? this.get(id) : null;
    if (!e) return false;
    const d = this.wireDigest(wire);
    if (e.wires.includes(d)) return true;
    e.wires.push(d);
    if (e.wires.length > MAX_WIRES) e.wires.splice(0, e.wires.length - MAX_WIRES);
    this.save();
    return true;
  }

  // One deferred save, saveGapMs from the first capture it covers.
  saveSoon() {
    if (!this.file || this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.save();
    }, this.saveGapMs);
    this.saveTimer.unref?.();
  }

  // A certified run: its entry and the ones it superseded go.
  forget({ runId, supersedes = [] } = {}) {
    if (runId) this.drop(runDigest(runId));
    for (const s of supersedes || []) if (s && this.get(s.id)?.t === s.t) this.drop(s.id);
    this.save();
  }

  save() {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (!this.file || this.loadFailed || !this.key) return;
    const temp = `${this.file}.${randomBytes(8).toString('hex')}.tmp`;
    const dir = path.dirname(this.file);
    try {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      const body = JSON.stringify({
        v: 1,
        kc: this.keyCheck,
        free: [...this.free.values()],
        paid: [...this.paid.values()],
      });
      const fd = fs.openSync(temp, 'wx', 0o600);
      try {
        fs.writeFileSync(fd, body);
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
      fs.renameSync(temp, this.file);
      const dfd = fs.openSync(dir, 'r');
      try {
        fs.fsyncSync(dfd);
      } finally {
        fs.closeSync(dfd);
      }
      if (!this.isHealthy) {
        this.isHealthy = true;
        this.log('[briefs] store saved again; revise runs are checked against it once more.');
      }
    } catch (err) {
      try {
        fs.rmSync(temp, { force: true });
      } catch {}
      this.fail(err, 'not saved');
    }
  }
}

// True when loadChatSecret(env) makes a new random secret on every start.
export const ephemeralSecret = (env) =>
  !env.CHAT_SECRET && !env.CHAT_SECRET_FILE && !env.LYRIC_RUNTIME_DIR;

export function createBriefLedger(env = process.env, opts = {}) {
  const file =
    env.BRIEF_LEDGER_FILE ||
    (env.LYRIC_RUNTIME_DIR && path.join(env.LYRIC_RUNTIME_DIR, 'brief-ledger.json'));
  const ledger = new BriefLedger({
    file: file || null,
    key: () => deriveBriefKey(loadChatSecret(env)),
    ...opts,
  });
  ledger.ephemeralKey = Boolean(file) && ephemeralSecret(env);
  if (ledger.ephemeralKey)
    ledger.log(
      '[briefs] WARNING: BRIEF_LEDGER_FILE is set, but no CHAT_SECRET, CHAT_SECRET_FILE or ' +
        'LYRIC_RUNTIME_DIR is: the store key is new on every start, so every restart drops the ' +
        'store and protection does not survive it. Set one of them to keep the key.'
    );
  return ledger;
}
