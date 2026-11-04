import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

// Browser ES module in a CommonJS repository: load these exact bytes without
// changing package.json or adding a second implementation.
const source = await readFile(new URL('../../features/recipe/live-editor.js', import.meta.url), 'utf8');
const { createBinding, mount } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

// FAKE ADAPTER ONLY. Toy scalar history proves dispatch/lifecycle plumbing;
// it is not a recipe engine, catalog, deduplication or production parity test.
function fixture() {
  const abort = new AbortController();
  const calls = [], messages = [], subscribers = new Set();
  let states = [{ value: 0 }], index = 0, released = 0;
  const emit = () => { for (const fn of [...subscribers]) fn(); };
  const recipe = {
    snapshot: () => states[index],
    canUndo: () => index > 0,
    canRedo: () => index < states.length - 1,
    apply(edit) {
      calls.push(edit);
      if (edit.refuse) return { ok: false, changed: false, refusal: edit.refuse };
      if (edit.value === states[index].value) return { ok: true, changed: false };
      states = [...states.slice(0, index + 1), { value: edit.value }];
      index++;
      emit();
      return { ok: true, changed: true };
    },
    undo() { index--; emit(); },
    redo() { index++; emit(); },
    subscribe(fn) { subscribers.add(fn); return () => { released++; subscribers.delete(fn); }; },
  };
  const ctx = { recipe, announce: text => messages.push(text), signal: abort.signal };
  return { ctx, abort, calls, messages, emit, subscribers, released: () => released };
}

test('opaque edits are forwarded once; successful apply is not repeated or rewritten', () => {
  const f = fixture(), b = createBinding(f.ctx);
  const edit = { value: 1, arbitrary: { pinned: null, character: 'unlisted text', effects: ['a', 'b'] } };
  assert.deepEqual(b.apply(edit), { ok: true, changed: true });
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0], edit);
  assert.deepEqual(b.history(), { canUndo: true, canRedo: false });
  b.undo();
  assert.equal(b.snapshot().value, 0);
  b.redo();
  assert.equal(b.snapshot().value, 1);
  b.unmount();
});

test('no-op and refusal receipts are preserved, with named refusal announced', () => {
  const f = fixture(), b = createBinding(f.ctx);
  assert.deepEqual(b.apply({ value: 0 }), { ok: true, changed: false });
  assert.equal(b.apply({ refuse: 'Choose an available part.' }).ok, false);
  assert.deepEqual(f.messages, ['Choose an available part.']);
  assert.equal(b.history().canUndo, false);
  b.unmount();
});

test('reads and focus do not apply edits; history remains adapter-owned', () => {
  const f = fixture(), b = createBinding(f.ctx);
  b.apply({ value: 1 }); b.apply({ value: 2 }); b.undo();
  const calls = f.calls.length;
  b.snapshot(); b.history();
  const handle = mount({ querySelector: () => null }, f.ctx);
  handle.focus(); handle.unmount();
  assert.equal(f.calls.length, calls);
  assert.equal(b.history().canRedo, true);
  b.apply({ value: 3 });
  assert.equal(b.history().canRedo, false);
  b.unmount();
});

test('unavailable Undo/Redo are not dispatched', () => {
  const f = fixture();
  f.ctx.recipe.undo = f.ctx.recipe.redo = () => assert.fail('unavailable history dispatched');
  const b = createBinding(f.ctx);
  b.undo(); b.redo(); b.unmount();
});

test('external adapter updates notify observers and never return a cached snapshot', () => {
  const f = fixture(), b = createBinding(f.ctx), seen = [];
  const stop = b.subscribe(() => seen.push(b.snapshot().value));
  f.ctx.recipe.apply({ value: 7 });
  f.ctx.recipe.undo();
  assert.deepEqual(seen, [7, 0]);
  stop(); f.ctx.recipe.redo();
  assert.deepEqual(seen, [7, 0]);
  b.unmount();
});

test('teardown is idempotent and disconnects recipe subscription', () => {
  const f = fixture(), b = createBinding(f.ctx);
  b.subscribe(() => assert.fail('notified after teardown'));
  b.unmount(); b.unmount(); f.emit();
  assert.equal(f.released(), 1);
  assert.equal(f.subscribers.size, 0);
  assert.throws(() => b.apply({ value: 2 }), /unmounted/);
});

test('abort synchronously releases without any subsequent notification or access', () => {
  const f = fixture(), b = createBinding(f.ctx);
  b.subscribe(() => assert.fail('notified after abort'));
  assert.equal(f.subscribers.size, 1);
  f.abort.abort();
  assert.equal(f.subscribers.size, 0);
  assert.equal(f.released(), 1);
  b.unmount(); f.abort.abort();
  assert.equal(f.released(), 1);
  assert.throws(() => b.undo(), /unmounted/);
  assert.equal(f.calls.length, 0);
  b.unmount();
});

test('explicit unmount followed by abort does not unsubscribe twice', () => {
  const f = fixture(), b = createBinding(f.ctx);
  b.unmount(); f.abort.abort();
  assert.equal(f.released(), 1);
  assert.equal(f.subscribers.size, 0);
});

test('mount with an already aborted signal never subscribes or focuses', () => {
  const f = fixture(); f.abort.abort();
  const handle = mount({ querySelector: () => assert.fail('focus after abort') }, f.ctx);
  handle.focus(); handle.unmount();
  assert.equal(f.subscribers.size, 0);
});

test('abort during synchronous subscription setup still releases exactly once', () => {
  const f = fixture();
  let released = 0;
  f.ctx.recipe.subscribe = fn => {
    f.abort.abort(); fn();
    return () => released++;
  };
  const b = createBinding(f.ctx);
  b.unmount();
  assert.equal(released, 1);
  assert.throws(() => b.snapshot(), /unmounted/);
});

test('mount does not render or steal focus; explicit focus stays in host', () => {
  const f = fixture(), log = [];
  const host = { querySelector: selector => { log.push(selector); return { focus: options => log.push(options) }; } };
  const handle = mount(host, f.ctx);
  assert.deepEqual(log, []);
  assert.deepEqual(Object.keys(handle).sort(), ['focus', 'unmount']);
  handle.focus();
  assert.deepEqual(log.at(-1), { preventScroll: true });
  handle.unmount(); handle.focus();
  assert.equal(log.length, 2);
  assert.equal(f.released(), 1);
});

test('adapter exceptions remain uncertain: no retry or invented failure receipt', () => {
  const f = fixture(), error = new Error('adapter stopped after mutation');
  f.ctx.recipe.apply = () => { f.calls.push('attempt'); throw error; };
  const b = createBinding(f.ctx);
  assert.throws(() => b.apply({ value: 1 }), e => e === error);
  assert.equal(f.calls.length, 1);
  assert.deepEqual(f.messages, ['Recipe action could not be confirmed.']);
  b.unmount();
});

test('malformed adapter contracts and receipts fail explicitly', () => {
  for (const name of ['snapshot', 'apply', 'undo', 'redo', 'canUndo', 'canRedo', 'subscribe']) {
    const f = fixture(); delete f.ctx.recipe[name];
    assert.throws(() => createBinding(f.ctx), new RegExp(name));
  }
  for (const receipt of [null, Promise.resolve({ ok: true, changed: true }), { ok: false, changed: true }]) {
    const f = fixture(); f.ctx.recipe.apply = () => receipt;
    const b = createBinding(f.ctx);
    assert.throws(() => b.apply({}), /invalid receipt/);
    assert.equal(f.messages.length, 1);
    b.unmount();
  }
});
