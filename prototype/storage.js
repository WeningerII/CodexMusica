// Prototype storage: every read and write goes through here, and only under
// the `codex-prototype:` namespace (#670, R2's limit 2). The production app's
// keys — saved workspaces, sessions, layout, Lyrics drafts, the Library's
// stores — are never named, read, written or cleared by the prototype.
// scripts/check_prototype_isolation.js seeds every production key with a
// sentinel and fails if any of them changes, or if any other key is touched.
//
// Feature lanes never import this file. The shell hands each lane
// scope('<lane>'), whose names are stored as `codex-prototype:<lane>-<name>`
// (#670, 6639542176 §1).

export const NAMESPACE = 'codex-prototype:';
// The prototype shares the production app's origin, and so its quota (Jony,
// #719). Everything it stores, keys and values, stays within this many
// characters, the same measure check_prototype_isolation.js applies.
export const CEILING = 64 * 1024;
const NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;
const LANE = /^[a-z0-9][a-z0-9]{0,23}$/;
// The names this wrapper has stored, so the ceiling is checked without ever
// enumerating the origin's keys (which would read production key names).
const INDEX = 'index';

function keyFor(name) {
  if (typeof name !== 'string' || !NAME.test(name)) {
    throw new TypeError(`prototype storage: "${name}" is not a prototype key name`);
  }
  return NAMESPACE + name;
}

function area() {
  try {
    return window.localStorage;
  } catch {
    return null; // access itself can throw (blocked site data)
  }
}

function names(ls) {
  try {
    const list = JSON.parse(ls.getItem(NAMESPACE + INDEX) || '[]');
    return Array.isArray(list) ? list.filter((n) => typeof n === 'string' && NAME.test(n)) : [];
  } catch {
    return [];
  }
}

function used(ls, list, except) {
  let n = (NAMESPACE + INDEX).length + JSON.stringify(list).length;
  for (const name of list) {
    if (name === except) continue;
    n += (NAMESPACE + name).length + (ls.getItem(NAMESPACE + name) || '').length;
  }
  return n;
}

// Each call returns { ok, value?, reason? } instead of throwing, so a page
// whose storage is unavailable still works and can say so.
export function read(name) {
  const key = keyFor(name);
  const ls = area();
  if (!ls) return { ok: false, reason: 'unavailable' };
  try {
    const raw = ls.getItem(key);
    return { ok: true, value: raw === null ? null : JSON.parse(raw) };
  } catch {
    return { ok: false, reason: 'unreadable' };
  }
}

export function write(name, value) {
  const key = keyFor(name);
  if (name === INDEX) throw new TypeError('prototype storage: "index" is reserved');
  const ls = area();
  if (!ls) return { ok: false, reason: 'unavailable' };
  try {
    const raw = JSON.stringify(value);
    const list = names(ls);
    const next = list.includes(name) ? list : [...list, name];
    if (used(ls, next, name) + key.length + raw.length > CEILING) {
      return { ok: false, reason: 'full' };
    }
    if (next !== list) ls.setItem(NAMESPACE + INDEX, JSON.stringify(next));
    ls.setItem(key, raw);
    return { ok: true };
  } catch {
    return { ok: false, reason: 'refused' };
  }
}

export function remove(name) {
  const key = keyFor(name);
  const ls = area();
  if (!ls) return { ok: false, reason: 'unavailable' };
  try {
    ls.removeItem(key);
    const list = names(ls);
    if (list.includes(name)) {
      ls.setItem(NAMESPACE + INDEX, JSON.stringify(list.filter((n) => n !== name)));
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: 'refused' };
  }
}

// The wrapper a feature lane receives as ctx.storage: the same three calls,
// with every name kept under `<lane>-`.
export function scope(lane) {
  if (typeof lane !== 'string' || !LANE.test(lane)) {
    throw new TypeError(`prototype storage: "${lane}" is not a lane name`);
  }
  const at = (name) => `${lane}-${name}`;
  return Object.freeze({
    read: (name) => read(at(name)),
    write: (name, value) => write(at(name), value),
    remove: (name) => remove(at(name)),
  });
}
