import test from 'node:test';
import assert from 'node:assert/strict';
import { createRepository, itemKey } from '../public/playlist-repository.js';
import { normalizeItems, normalizeItem } from '../public/playlist-model.js';

import { memoryStorage } from './helpers.js';
const post = code => ({ url: `https://www.instagram.com/reel/${code}/`, shortcode: code });

test('normalization deduplicates post/reel aliases while preserving first-seen order and route', () => {
  assert.deepEqual(normalizeItems([post('abc'), { url: 'https://instagram.com/p/abc/?utm_source=copy' }, post('def')]), [post('abc'), post('def')]);
});
test('URL validation rejects misleading hosts and executable URLs', () => {
  for (const url of ['https://evilinstagram.com/p/abc/', 'https://instagram.com.evil.test/p/abc/', 'javascript:alert(1)', 'http://instagram.com/p/abc/', 'https://instagram.com/direct/inbox/']) {
    assert.throws(() => normalizeItem({ url }));
  }
});
test('first run discards legacy local lists once, then preserves new data after worker restart', async () => {
  const storage = memoryStorage({ instagram_playlists: { stale: [post('old')] }, instagram_playlist: [post('old')] });
  let repository = createRepository(storage);
  assert.deepEqual(await repository('all'), {});
  assert.equal(storage.rows.instagram_playlists, undefined);
  await repository('create', { name: 'Memory Feelings' });
  await repository('add', { name: 'Memory Feelings', items: [post('new')] });
  repository = createRepository(storage);
  assert.deepEqual(await repository('get', { name: 'Memory Feelings' }), [post('new')]);
});
test('concurrent edits across contexts preserve every post and touch only one playlist', async () => {
  const storage = memoryStorage(); const repository = createRepository(storage);
  await repository('create', { name: 'Tools' });
  await repository('create', { name: 'Feelings' });
  const start = storage.writes.length;
  await Promise.all(Array.from({ length: 100 }, (_, i) => repository('add', { name: 'Tools', items: [post(`code${i}`)] })));
  assert.equal((await repository('get', { name: 'Tools' })).length, 100);
  assert.ok(storage.writes.slice(start).every(keys => keys.length === 1 && keys[0] === itemKey('Tools')));
  assert.deepEqual(await repository('get', { name: 'Feelings' }), []);
});
test('large libraries retain all URLs and import validation is atomic', async () => {
  const storage = memoryStorage(); const repository = createRepository(storage);
  await repository('import', { playlists: { Tools: Array.from({ length: 12000 }, (_, i) => post(`id${i}`)), Feelings: [post('mood')] } });
  assert.equal((await repository('get', { name: 'Tools' })).length, 12000);
  await assert.rejects(repository('import', { playlists: { Tools: [post('valid')], Bad: [{ url: 'https://evil.test/p/no/' }] } }));
  assert.equal((await repository('get', { name: 'Tools' })).length, 12000);
});
test('storage failures reach caller and do not poison later commands', async () => {
  const storage = memoryStorage(); const repository = createRepository(storage);
  await repository('create', { name: 'Tools' });
  storage.fail = true;
  await assert.rejects(repository('add', { name: 'Tools', items: [post('lost')] }), /QUOTA/);
  storage.fail = false;
  await repository('add', { name: 'Tools', items: [post('saved')] });
  assert.deepEqual(await repository('get', { name: 'Tools' }), [post('saved')]);
});
test('rename and delete maintain the active playlist, including unusual names', async () => {
  const repository = createRepository(memoryStorage());
  await repository('create', { name: '__proto__' });
  await repository('activate', { name: '__proto__' });
  await repository('rename', { name: '__proto__', newName: 'Memory Feelings' });
  assert.equal(await repository('active'), 'Memory Feelings');
  await repository('delete', { name: 'Memory Feelings' });
  assert.equal(await repository('active'), null);
  await assert.rejects(repository('activate', { name: 'Missing' }));
});
