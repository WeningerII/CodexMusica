import test from 'node:test';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
test('a', async () => { await sleep(700); });
test('b', async () => { await sleep(700); });
