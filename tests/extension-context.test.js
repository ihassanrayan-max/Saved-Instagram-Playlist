import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createExtensionContext, ExtensionContextError } from '../public/extension-context.js';

test('a disappearing runtime retires the context once without making another API call', async () => {
  let valid = true, calls = 0, cleanups = 0;
  const context = createExtensionContext(() => valid);
  context.onInvalidated(() => cleanups++);
  assert.equal(await context.run(() => ++calls), 1);
  valid = false;
  await assert.rejects(context.run(() => ++calls), ExtensionContextError);
  await assert.rejects(context.run(() => ++calls), ExtensionContextError);
  assert.equal(calls, 1); assert.equal(cleanups, 1); assert.equal(context.signal.aborted, true);
});
test('synchronous throws and rejected API promises preserve causes and trigger cleanup', async () => {
  for (const asyncFailure of [false, true]) {
    const original = new Error('Extension context invalidated.');
    const context = createExtensionContext(() => true);
    let cleaned = false; context.onInvalidated(() => { cleaned = true; });
    await assert.rejects(context.run(() => {
      if (asyncFailure) return Promise.reject(original);
      throw original;
    }), error => error instanceof ExtensionContextError && error.cause === original);
    assert.equal(cleaned, true);
  }
});
test('in-flight responses are discarded after an extension update', async () => {
  let resolve;
  const pending = new Promise(done => { resolve = done; });
  const context = createExtensionContext(() => true);
  const request = context.run(() => pending);
  context.invalidate(); resolve('obsolete result');
  await assert.rejects(request, ExtensionContextError);
});
test('quota and application errors are surfaced rather than hidden as invalidation', async () => {
  const context = createExtensionContext(() => true), quota = new Error('QUOTA_BYTES exceeded');
  await assert.rejects(context.run(() => { throw quota; }), error => error === quota);
  assert.equal(context.stopped, false); assert.equal(await context.run(() => 'recovered'), 'recovered');
});
test('throwing API getters and cleanup callbacks cannot prevent the remaining cleanup', () => {
  const context = createExtensionContext(() => { throw new Error('Extension context invalidated.'); });
  let cleaned = 0;
  context.onInvalidated(() => { throw new Error('Old event binding'); });
  context.onInvalidated(() => cleaned++);
  const unsubscribe = context.onInvalidated(() => cleaned++); unsubscribe();
  assert.equal(context.check(), false); assert.equal(cleaned, 1);
  context.onInvalidated(() => cleaned++); assert.equal(cleaned, 2);
});
test('a stale content script never falls back to Instagram localStorage', async () => {
  let fallbackCalls = 0;
  globalThis.localStorage = { getItem() { fallbackCalls++; return null; }, setItem() { fallbackCalls++; }, removeItem() { fallbackCalls++; } };
  globalThis.chrome = { runtime: { id: 'extension-id', async sendMessage() { return { ok: true, data: {} }; } } };
  const result = await build({ entryPoints: ['src/utils/playlistStorage.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
  const storage = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
  assert.deepEqual(await storage.getAllPlaylists(), {});
  delete chrome.runtime.id;
  await assert.rejects(storage.getAllPlaylists(), /Reload Instagram/);
  await assert.rejects(storage.createPlaylist('Should not leak'), /Reload Instagram/);
  assert.equal(fallbackCalls, 0);
});
