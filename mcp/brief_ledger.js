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
// The store fails closed: a file that cannot be read or parsed (or a key that
// cannot be loaded) makes it unhealthy, and while it is unhealthy the caller
// refuses every revise run. A file that failed to load is never written over
// until recover() reads it again. A key-check mismatch (the server secret
// changed) is not damage: the old entries cannot be matched any more, so they
// are dropped and the store starts empty, with a log line.
//
// Durable when BRIEF_LEDGER_FILE or LYRIC_RUNTIME_DIR names a disk, and saved
// as RunLedger saves (run_store.js): a 'wx' temp file at 0600, fsync, rename,
// then a directory fsync. Otherwise it covers the life of the process.
import { createHash, createHmac, hkdfSync, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { loadChatSecret } from './job_store.js';

export const BRIEF_RETAIN_MS = 3 * 60 * 60 * 1000;
export const BRIEF_CAP = 2000; // free partition, by count, plus the TTL
export const BRIEF_PAID_CAP = 2000; // writer === 'kitchen'; the same TTL
// Lines kept per partition, over all its entries: a store of long songs is
// pruned oldest first before its count cap is reached, so the heap and the
// cost of each save stay bounded.
export const BRIEF_LINE_BUDGET = 100_000;
const MAX_CANDIDATES = 8;
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
    log = console.error,
  } = {}) {
    this.file = file;
    this.keySource = key;
    this.now = now;
    this.retainMs = retainMs;
    this.cap = cap;
    this.paidCap = paidCap;
    this.lineBudget = lineBudget;
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

  // Reads the file (sweeping a kill's leftover temp files first). Entries that
  // are malformed are skipped one by one; a file that is not JSON, or not an
  // object, fails closed.
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
      if (
        raw.v !== 1 ||
        typeof raw.kc !== 'string' ||
        !Array.isArray(raw.free) ||
        !Array.isArray(raw.paid)
      )
        throw new Error('store is not a brief ledger');
    } catch (err) {
      if (err.code === 'ENOENT') {
        this.loadFailed = false;
        return;
      }
      this.loadFailed = true;
      this.fail(err, 'unreadable');
      return;
    }
    this.loadFailed = false;
    if (raw.kc !== this.keyCheck) {
      this.log('[briefs] store key changed; its entries are dropped and it starts empty.');
      this.save();
      return;
    }
    const cutoff = this.now() - this.retainMs;
    for (const [part, map] of [
      ['free', this.free],
      ['paid', this.paid],
    ])
      for (const e of raw[part])
        if (validEntry(e) && e.t >= cutoff && !this.get(e.id)) {
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

  prune() {
    const cutoff = this.now() - this.retainMs;
    let changed = false;
    for (const [map, cap] of [
      [this.free, this.cap],
      [this.paid, this.paidCap],
    ]) {
      let lines = 0;
      for (const e of map.values()) lines += e.n;
      for (const [id, e] of map) {
        if (e.t >= cutoff && map.size <= cap && lines <= this.lineBudget) break;
        lines -= e.n;
        this.drop(id);
        changed = true;
      }
    }
    // Entries are in recency order, so the loop above stops at the first live
    // one; a stale one behind it (a clock moved back) is caught here.
    for (const map of [this.free, this.paid])
      for (const [id, e] of map)
        if (e.t < cutoff) {
          this.drop(id);
          changed = true;
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
    } else cands.push(...this.matches(sets, ownId).slice(0, MAX_CANDIDATES - cands.length));
    const inherited = { prot: [], undo: [] };
    for (let k = 0; k < sets.length; k++) {
      const fo = sets[k];
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
    const guards = cands.some((e) => e.prot.length > 0 || e.undo.length > 0);
    if (wireList.length && !exempt && guards)
      return {
        ok: false,
        reason: 'unminted_wire',
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
  // whole-draft flag briefs every line). inherited comes from check, numbered
  // in input; supersedes are retired only if unchanged since check (by t).
  async capture({
    runId,
    paid = false,
    status = 'progress',
    cur = [],
    input = [],
    flagged = [],
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
    // An inherited protected line stays protected only where this run kept
    // its text: a line the loop itself replaced was asked about, and its old
    // text is held by the undo rule instead.
    const kept = new Map(align.pairs.map(([i, j]) => [i + 1, j + 1]));
    const free = whole ? null : new Set(briefed);
    const prot = uniq(
      [...flagged, ...(inherited?.prot || []).map((p) => kept.get(p) || 0)].filter(
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
    const prev = this.get(id);
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
    this.prune();
    if (persist) this.save();
  }

  // A certified run: its entry and the ones it superseded go.
  forget({ runId, supersedes = [] } = {}) {
    if (runId) this.drop(runDigest(runId));
    for (const s of supersedes || []) if (s && this.get(s.id)?.t === s.t) this.drop(s.id);
    this.save();
  }

  save() {
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

export function createBriefLedger(env = process.env, opts = {}) {
  const file =
    env.BRIEF_LEDGER_FILE ||
    (env.LYRIC_RUNTIME_DIR && path.join(env.LYRIC_RUNTIME_DIR, 'brief-ledger.json'));
  return new BriefLedger({
    file: file || null,
    key: () => deriveBriefKey(loadChatSecret(env)),
    ...opts,
  });
}
