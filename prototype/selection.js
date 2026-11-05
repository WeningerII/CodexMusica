// What the person has opened, shared by the shell's lanes (#668 6645589522):
// one value per kind, with listeners. The Genre detail lane reads the genre;
// set() is the shell's (and its tests'), so a lane can follow the selection
// but not change another lane's.
function selection() {
  let value = null;
  const listeners = new Set();
  return Object.freeze({
    current: () => value,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    set(next) {
      const v = typeof next === 'string' && next ? next : null;
      if (v === value) return;
      value = v;
      for (const fn of [...listeners]) fn();
    },
  });
}

export const genre = selection();
