// Prototype storage: every read and write goes through here, and only under
// the `codex-prototype:` namespace (#670, R2's limit 2). The production app's
// keys — saved workspaces, sessions, layout, Lyrics drafts, the Library's
// stores — are never named, read, written or cleared by the prototype.
// scripts/check_prototype_isolation.js seeds every production key with a
// sentinel and fails if any of them changes, or if any other key is touched.

export const NAMESPACE = 'codex-prototype:';
const NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;

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
  const ls = area();
  if (!ls) return { ok: false, reason: 'unavailable' };
  try {
    ls.setItem(key, JSON.stringify(value));
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
    return { ok: true };
  } catch {
    return { ok: false, reason: 'refused' };
  }
}
