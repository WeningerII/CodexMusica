'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
test('stale recovery completion preserves newer polling; current completion cleans it up', async () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');
  const defer = () => {
    let resolve;
    const promise = new Promise((r) => (resolve = r));
    return { promise, resolve };
  };
  const oldRecovery = defer(),
    newPost = defer();
  const calls = [];
  const timers = new Map();
  let nextTimer = 0,
    posts = 0;
  const element = () => ({
    children: [],
    hidden: false,
    value: '',
    innerHTML: '',
    disabled: false,
    classList: { toggle() {} },
    appendChild(n) {
      this.children.push(n);
    },
    focus() {},
    remove() {},
    get firstElementChild() {
      return element();
    },
  });
  const nodes = new Map(
    ['chat-log', 'chat-panel', 'chat-dock', 'chat-input', 'chat-send', 'chat-domain'].map((id) => [
      id,
      element(),
    ])
  );
  nodes.get('chat-domain').value = 'recipe';
  const stored = new Map();
  const context = vm.createContext({
    window: {},
    document: {
      hidden: false,
      getElementById: (id) => nodes.get(id),
      createElement: element,
      dispatchEvent() {},
    },
    localStorage: {
      getItem: (k) => stored.get(k) || null,
      setItem: (k, v) => stored.set(k, v),
      removeItem: (k) => stored.delete(k),
    },
    crypto: crypto.webcrypto,
    Uint8Array,
    AbortController,
    Date,
    esc: String,
    RECIPE_CHAR_CEILING: 1000,
    CustomEvent: class {},
    setTimeout: (fn, ms) => {
      const id = ++nextTimer;
      timers.set(id, { fn, ms });
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
    fetch: async (url, opts = {}) => {
      calls.push({ url, method: opts.method || 'GET', signal: !!opts.signal });
      if (opts.method === 'POST') {
        posts++;
        if (posts === 1) return { json: async () => ({ state: 'pending' }) };
        return newPost.promise;
      }
      if (url.includes('?view=progress'))
        return {
          ok: true,
          headers: { get: () => null },
          json: async () => ({ view: 'progress', state: 'pending', stage: 'working' }),
        };
      return oldRecovery.promise;
    },
  });
  vm.runInContext(
    src.slice(src.indexOf('const CHAT_BACKEND ='), src.indexOf('// Reveal the dock')) +
      '\nglobalThis.ui={chatState,_chatSend,_chatReset,_chatPoll};',
    context
  );
  const { ui } = context;
  const oldSend = ui._chatSend('old request', { choice: 'recipe' });
  for (let i = 0; i < 10; i++) await Promise.resolve();
  assert.equal(calls.length, 2);
  assert.equal(calls[1].signal, false);
  ui._chatReset();
  const send = ui._chatSend('new request', { choice: 'recipe' });
  const id = ui.chatState.pending.request_id;
  const newTimer = ui._chatPoll.timer;
  assert.equal(ui._chatPoll.request_id, id);
  assert.ok(timers.has(newTimer));
  // Drive one real new-generation progress tick so loss of its next poll is observable.
  const tick = timers.get(newTimer);
  timers.delete(newTimer);
  await tick.fn();
  assert.equal(ui.chatState.progress.stage, 'working');
  const nextPoll = ui._chatPoll.timer;
  assert.ok(timers.has(nextPoll));
  oldRecovery.resolve({ ok: true, json: async () => ({ state: 'pending' }) });
  await oldSend;
  assert.equal(ui.chatState.pending.request_id, id);
  assert.equal(ui.chatState.busy, true);
  assert.equal(ui._chatPoll.request_id, id);
  assert.equal(ui._chatPoll.timer, nextPoll);
  assert.equal(timers.has(nextPoll), true);
  const laterTick = timers.get(nextPoll);
  timers.delete(nextPoll);
  await laterTick.fn();
  assert.equal(ui.chatState.progress.stage, 'working');
  assert.ok(timers.has(ui._chatPoll.timer));
  assert.equal(posts, 2);
  // The owning send still stops its own timer on normal completion.
  newPost.resolve({ headers: { get: () => null }, json: async () => ({ reply: 'done' }) });
  await send;
  assert.equal(ui._chatPoll.request_id, null);
  assert.equal(ui._chatPoll.timer, 0);
  assert.equal(timers.size, 0);
  assert.equal(ui.chatState.busy, false);
  assert.equal(ui.chatState.pending, null);
  assert.equal(calls.length, 5); // Two POSTs, old recovery, and two progress polls.
});
