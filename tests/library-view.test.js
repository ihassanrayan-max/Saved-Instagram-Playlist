import test from 'node:test';
import assert from 'node:assert/strict';
import { searchLibrary, matchPost, postTitle } from '../public/library-view.js';
import { normalizeItem, validatePlaylists } from '../public/playlist-model.js';
import { createRepository } from '../public/playlist-repository.js';
import { memoryStorage } from './helpers.js';
const post = (code, metadata = {}) => ({ url: `https://www.instagram.com/reel/${code}/`, shortcode: code, ...metadata });
test('library search spans playlists and combines metadata terms without losing queue positions', () => {
  const library = { Tools: [post('a'), post('b', { title: 'Résumé tips', notes: 'A useful interview checklist', tags: ['career'] })], Feelings: [post('c', { notes: 'A calm start', tags: ['morning'] })] };
  assert.equal(searchLibrary(library, 'Tools', '').length, 2);
  const results = searchLibrary(library, 'Feelings', 'resume interview career');
  assert.equal(results.length, 1); assert.equal(results[0].name, 'Tools'); assert.equal(results[0].index, 1);
  assert.equal(searchLibrary(library, 'Tools', 'feelings calm').length, 1);
  assert.equal(searchLibrary(library, 'Tools', 'missing').length, 0);
  assert.equal(searchLibrary(library, 'Tools', '   ').length, 2);
});
test('notes and tags survive normalization and JSON export/import', () => {
  const item = normalizeItem(post('a', { title: 'Morning reset', notes: 'Play when I need a little courage.', tags: [' calm ', 'calm', '', 'motivation'] }));
  assert.deepEqual(item.tags, ['calm', 'motivation']);
  assert.deepEqual(validatePlaylists(JSON.parse(JSON.stringify({ Feelings: [item] }))), { Feelings: [item] });
  assert.throws(() => normalizeItem(post('a', { tags: ['valid', 42] })));
});
test('moving and annotating concurrent posts preserves metadata and playlist membership', async () => {
  const repository = createRepository(memoryStorage());
  await repository('create', { name: 'Feelings' });
  await repository('add', { name: 'Feelings', items: [post('a'), post('b'), post('c')] });
  await Promise.all([
    repository('move', { name: 'Feelings', shortcode: 'c', direction: -1 }),
    repository('annotate', { name: 'Feelings', shortcode: 'c', metadata: { title: 'A little courage', notes: 'Remember this.', tags: ['hope'] } }),
  ]);
  const items = await repository('get', { name: 'Feelings' });
  assert.deepEqual(items.map(item => item.shortcode), ['a', 'c', 'b']);
  assert.equal(items[1].notes, 'Remember this.');
  await repository('move', { name: 'Feelings', shortcode: 'a', direction: -1 });
  assert.deepEqual((await repository('get', { name: 'Feelings' })).map(item => item.shortcode), ['a', 'c', 'b']);
  await assert.rejects(repository('move', { name: 'Feelings', shortcode: 'a', direction: 5 }));
});
test('queue results explain matching tags and creators while displaying a readable title', () => {
  const item = post('code', { title: 'You Never Give Up', username: 'anime_creator', tags: ['Demon Slayer'], caption: 'Keep going.' });
  assert.deepEqual(matchPost(item, 'demon slayer'), { title: 'You Never Give Up', matches: [{ field: 'Tag', value: 'Demon Slayer' }] });
  assert.equal(matchPost(item, 'anime_creator').matches[0].field, 'Creator');
  assert.equal(matchPost(item, 'never give').matches[0].field, 'Title');
  assert.equal(postTitle(post('x', { caption: 'I will make it happen.\nSecond line' })), 'I will make it happen.');
  assert.equal(matchPost(item, 'unrelated'), null);
});
test('editing a position moves directly across long playlists and rejects partial invalid edits', async () => {
  const repository = createRepository(memoryStorage());
  await repository('create', { name: 'Long queue' });
  await repository('add', { name: 'Long queue', items: Array.from({ length: 212 }, (_, i) => post(`item${i}`)) });
  await repository('annotate', { name: 'Long queue', shortcode: 'item0', metadata: { title: 'Moved post', notes: 'Preserved', tags: ['test'] }, position: 100 });
  const moved = await repository('get', { name: 'Long queue' });
  assert.equal(moved[99].shortcode, 'item0'); assert.equal(moved[99].title, 'Moved post'); assert.equal(moved.length, 212);
  await assert.rejects(repository('annotate', { name: 'Long queue', shortcode: 'item0', metadata: { title: 'Should not save' }, position: 999 }), /Position/);
  assert.deepEqual(await repository('get', { name: 'Long queue' }), moved);
  await repository('position', { name: 'Long queue', shortcode: 'item0', position: 1 });
  assert.equal((await repository('get', { name: 'Long queue' }))[0].shortcode, 'item0');
});
