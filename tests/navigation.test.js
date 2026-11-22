import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const result = await build({ entryPoints: ['src/instagram/navigation.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const { createPostNavigator } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const url = 'https://www.instagram.com/reel/next/';
function environment() {
  const state = { code: 'current', listener: null, assigned: [], watches: 0, stops: 0, clicked: 0 };
  const env = {
    currentCode: () => state.code,
    findLink: () => ({ click: () => { state.clicked++; state.code = 'next'; state.listener?.(); } }),
    watch(listener) { state.listener = listener; state.watches++; return () => { state.listener = null; state.stops++; }; },
    assign: target => state.assigned.push(target),
  };
  return { state, env };
}
test('native Instagram links change posts without reloading the document', async () => {
  const { env, state } = environment();
  assert.equal(await createPostNavigator(env)(url), 'native');
  assert.equal(state.clicked, 1); assert.equal(state.assigned.length, 0); assert.equal(state.stops, 1);
});
test('missing target links fall back immediately; no artificial timeout is added', async () => {
  const { env, state } = environment(); env.findLink = () => null;
  assert.equal(await createPostNavigator(env)(url), 'reload');
  assert.deepEqual(state.assigned, [url]); assert.equal(state.watches, 0);
});
test('popup requests can delegate the reload to the background worker', async () => {
  const { env, state } = environment(); env.findLink = () => null;
  assert.equal(await createPostNavigator(env)(url, false), 'reload'); assert.equal(state.assigned.length, 0);
});
test('a non-responsive Instagram link falls back after a bounded wait', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { env, state } = environment(); env.findLink = () => ({ click() {} });
  const pending = createPostNavigator(env)(url); t.mock.timers.tick(601);
  assert.equal(await pending, 'reload'); assert.deepEqual(state.assigned, [url]); assert.equal(state.stops, 1);
  t.mock.timers.reset();
});
test('manual navigation cancels the pending request instead of taking the user back', async () => {
  const { env, state } = environment(); env.findLink = () => ({ click() { state.code = 'elsewhere'; state.listener(); } });
  await assert.rejects(createPostNavigator(env)(url), /Navigation changed/); assert.equal(state.assigned.length, 0);
});
test('playing the current post and invalid URLs never reload the page', async () => {
  const { env, state } = environment(); state.code = 'next';
  assert.equal(await createPostNavigator(env)(url), 'current'); assert.equal(state.clicked, 0);
  await assert.rejects(createPostNavigator(env)('https://evil.test/p/no/')); assert.equal(state.assigned.length, 0);
});
test('extension shutdown cancels a native-navigation fallback before it can redirect', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { env, state } = environment();
  const controller = new AbortController(); env.signal = controller.signal;
  env.findLink = () => ({ click() {} });
  const pending = createPostNavigator(env)(url);
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  t.mock.timers.tick(1000);
  assert.equal(state.assigned.length, 0); assert.equal(state.stops, 1);
  t.mock.timers.reset();
});
