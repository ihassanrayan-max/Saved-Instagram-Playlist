import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { build } from 'esbuild';
import { memoryStorage } from './helpers.js';

// Exercise the real collector and chunk storage, substituting only Instagram's
// DOM adapter. Virtual time makes multi-minute collections deterministic.
const result = await build({
  entryPoints: ['src/instagram/collector.ts'], bundle: true, format: 'esm', platform: 'node', write: false,
  plugins: [{ name: 'instagram-fixture', setup(builder) {
    builder.onResolve({ filter: /^\.\/adapter$/ }, () => ({ path: 'fixture', namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `
      export const collectionSource = () => globalThis.fixture.source;
      export const isSavedPage = () => globalThis.fixture.saved;
      export const visiblePosts = () => globalThis.fixture.posts();
      export const scrollContainer = () => globalThis.fixture.container;
    ` }));
  } }],
});
const { Collector } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);

async function setup(t, options = {}) {
  const storage = memoryStorage();
  globalThis.chrome = { runtime: { id: 'test-extension' }, storage: { local: storage } };
  globalThis.document = { hidden: false };
  const held = new Set();
  Object.defineProperty(navigator, 'locks', { configurable: true, value: {
    async request(name, _options, callback) {
      if (held.has(name)) return callback(null);
      held.add(name);
      try { return await callback({ name }); } finally { held.delete(name); }
    },
    async query() { return { held: [...held].map(name => ({ name })) }; },
  } });
  let page = 0;
  globalThis.fixture = {
    source: 'https://www.instagram.com/me/saved/tools/', saved: true,
    posts: () => Array.from({ length: 3 }, (_, i) => ({ url: `https://www.instagram.com/reel/id${page * 3 + i}/`, shortcode: `id${page * 3 + i}` })),
    container: {
      scrollTop: 0, clientHeight: 800,
      get scrollHeight() { return page < (options.pages || 250) ? this.scrollTop + 1600 : this.scrollTop + 800; },
      scrollTo({ top }) { this.scrollTop = top; page = 0; },
      scrollBy({ top }) { if (page < (options.pages || 250)) { page++; this.scrollTop += top; } },
    },
  };
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 100000 });
  const collector = new Collector();
  t.after(async () => { await collector.stop(); t.mock.timers.reset(); });
  const advance = async rounds => { for (let i = 0; i < rounds; i++) { t.mock.timers.tick(1000); await setImmediate(); } };
  return { collector, storage, advance, held };
}

test('collector passes the old 200-scroll cap, checkpoints chunks, and stops at observed end', async t => {
  const { collector, storage, advance } = await setup(t);
  await collector.start(false);
  await advance(270);
  const state = await collector.state();
  assert.equal(state.status, 'complete');
  assert.equal(state.count, 753);
  const chunks = Object.entries(storage.rows).filter(([key]) => key.includes(':chunk:'));
  assert.equal(chunks.flatMap(([, items]) => items).length, 753);
  assert.ok(chunks.every(([, items]) => items.length <= 3));
});
test('stop cancels timers and resume crosses already-saved pages without stalling', async t => {
  const { collector, advance } = await setup(t, { pages: 100 });
  await collector.start(false); await advance(60); await collector.stop();
  const stopped = await collector.state();
  assert.equal(stopped.status, 'stopped');
  await advance(20);
  assert.equal((await collector.state()).count, stopped.count);
  await collector.start(true); await advance(120);
  const state = await collector.state();
  assert.equal(state.status, 'complete');
  assert.equal(state.count, 303);
});
test('page navigation interrupts without mixing collection sources; reload exposes resumable state', async t => {
  const { collector, advance } = await setup(t);
  await collector.start(false); await advance(2);
  const before = await collector.state();
  const source = fixture.source;
  fixture.source = 'https://www.instagram.com/p/other/'; await advance(2);
  fixture.source = source;
  assert.equal((await collector.state()).status, 'interrupted');
  const reloaded = new Collector();
  assert.equal((await reloaded.state()).count, before.count);
});
test('empty collection stalls honestly and hidden tabs do not falsely complete', async t => {
  const { collector, advance } = await setup(t, { pages: 1 });
  fixture.posts = () => [];
  await collector.start(false); document.hidden = true; await advance(40);
  assert.equal((await collector.state()).status, 'collecting');
  document.hidden = false; await advance(20);
  assert.equal((await collector.state()).status, 'stalled');
});
test('storage quota failure rejects start promptly; later checkpoint failure is visible', async t => {
  const { collector, storage, advance } = await setup(t);
  storage.fail = true;
  await assert.rejects(collector.start(false), /QUOTA/);
  await setImmediate(); storage.fail = false;
  await collector.start(false); await advance(2);
  storage.fail = true; await advance(2);
  const state = await collector.state();
  assert.equal(state.status, 'error'); assert.match(state.message, /QUOTA/);
  storage.fail = false;
});
test('another tab cannot start or clear an actively collected source', async t => {
  const { collector } = await setup(t);
  await collector.start(false);
  const other = new Collector();
  await assert.rejects(other.start(false), /another tab/);
  await assert.rejects(other.clear(), /other tab/);
});
test('retiring an old content script cancels collection without final storage access', async t => {
  const { collector, storage, advance } = await setup(t);
  await collector.start(false); await advance(2);
  const writes = storage.writes.length;
  collector.dispose(); await collector.stop(); await advance(10);
  assert.equal(storage.writes.length, writes);
  await assert.rejects(collector.start(true), /Reload Instagram/);
});
