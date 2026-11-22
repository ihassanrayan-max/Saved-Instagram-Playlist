import test from 'node:test';
import assert from 'node:assert/strict';
import { openPlaylistItem } from '../public/play-item.js';
import { createRepository } from '../public/playlist-repository.js';
import { memoryStorage } from './helpers.js';
import { readPlayer, writePlayer, documentKey, playerKey, shouldStartPlayback, restorePlayback } from '../public/player-session.js';
import { togglePlaylist } from '../public/playlist-controls.js';

async function setup(active = [{ id: 10, url: 'https://www.instagram.com/me/saved/' }], existing = []) {
  const library = createRepository(memoryStorage()), session = memoryStorage();
  await library('create', { name: 'Memory Feelings' });
  await library('add', { name: 'Memory Feelings', items: [{ url: 'https://www.instagram.com/reel/first/' }, { url: 'https://www.instagram.com/reel/second/' }] });
  const updates = [], created = [];
  const tabs = {
    async query(query) { return query.active ? active : existing; },
    async create(options) { created.push(options); return { id: 30 }; },
    async reload(id) { updates.push({ id, reloaded: true }); },
    async update(id, options) {
      assert.equal(await library('active'), 'Memory Feelings');
      assert.equal(session.rows[`player_v2:${id}:Memory%20Feelings`].currentIndex, 1);
      assert.equal(session.rows[`player_v2:${id}:Memory%20Feelings`].isPlaying, true);
      updates.push({ id, ...options });
    },
  };
  return { library, session, tabs, updates, created };
}
const args = { name: 'Memory Feelings', url: 'https://www.instagram.com/reel/second/' };
test('clicking a playlist entry saves queue selection before opening the active Instagram tab', async () => {
  const fixture = await setup(); await openPlaylistItem(fixture, args);
  assert.deepEqual(fixture.updates, [{ id: 10, url: args.url, active: true }]);
  assert.equal(fixture.created.length, 0);
});
test('entry navigation reuses an existing Instagram tab and leaves unrelated tabs untouched', async () => {
  const fixture = await setup([{ id: 5, url: 'https://example.org/' }], [{ id: 20, url: 'https://www.instagram.com/' }]);
  await openPlaylistItem(fixture, args); assert.equal(fixture.updates[0].id, 20);
});
test('entry navigation opens a new Instagram tab when necessary', async () => {
  const fixture = await setup([]); await openPlaylistItem(fixture, args);
  assert.equal(fixture.created.length, 1); assert.equal(fixture.updates[0].id, 30);
});
test('invalid and removed entries do not navigate or activate a playlist', async () => {
  const fixture = await setup();
  await assert.rejects(openPlaylistItem(fixture, { ...args, url: 'https://evil.test/reel/second/' }));
  await assert.rejects(openPlaylistItem(fixture, { ...args, url: 'https://www.instagram.com/reel/removed/' }));
  assert.equal(fixture.updates.length, 0); assert.equal(await fixture.library('active'), null);
});
test('outgoing playback state cannot overwrite a clicked entry during page unload', async () => {
  const fixture = await setup();
  const outgoing = { tab: { id: 10 }, documentId: 'old-document', url: 'https://www.instagram.com/reel/first/' };
  await fixture.session.set({ [documentKey(10)]: outgoing.documentId });
  await openPlaylistItem(fixture, args);
  await writePlayer(fixture.session, outgoing, args.name, { currentIndex: 0, isPlaying: false });
  assert.equal(fixture.session.rows[playerKey(10, args.name)].currentIndex, 1);
  const destination = { ...outgoing, documentId: 'new-document', url: args.url };
  const selected = await readPlayer(fixture.session, destination, args.name);
  assert.equal(selected.currentIndex, 1); assert.equal(selected.isPlaying, true);
  await writePlayer(fixture.session, outgoing, args.name, { currentIndex: 0, isPlaying: false });
  assert.equal(fixture.session.rows[playerKey(10, args.name)].isPlaying, true);
  await writePlayer(fixture.session, destination, args.name, { ...selected, isPlaying: false });
  assert.equal((await readPlayer(fixture.session, destination, args.name)).isPlaying, false);
});
test('only an explicit extension navigation requests audible autoplay', () => {
  assert.equal(shouldStartPlayback({ isPlaying: true }, 'second'), false);
  assert.equal(shouldStartPlayback({ isPlaying: true, navigationShortcode: 'first' }, 'second'), false);
  assert.equal(shouldStartPlayback({ isPlaying: false, navigationShortcode: 'second' }, 'second'), false);
  assert.equal(shouldStartPlayback({ isPlaying: true, navigationShortcode: 'second' }, 'second'), true);
});
test('an available content player handles a native transition without a document reload', async () => {
  const fixture = await setup();
  fixture.tabs.sendMessage = async (_id, message) => { assert.equal(message.type, 'NAVIGATE_PLAYLIST'); return { ok: true, data: 'native' }; };
  await openPlaylistItem(fixture, args);
  assert.deepEqual(fixture.updates, [{ id: 10, active: true }]);
});
test('a content player that cannot navigate delegates the reload safely', async () => {
  const fixture = await setup();
  fixture.tabs.sendMessage = async () => ({ ok: true, data: 'reload' });
  await openPlaylistItem(fixture, args);
  assert.deepEqual(fixture.updates, [{ id: 10, url: args.url, active: true }]);
});
test('an explicit pause is restored on reload and playing sessions restore sound preference', () => {
  assert.deepEqual(restorePlayback({ currentShortcode: 'second', playbackIntent: 'paused', isPlaying: false, isMuted: true }, 'second', true), { managed: true, playing: false, muted: true });
  assert.deepEqual(restorePlayback({ currentShortcode: 'second', playbackIntent: 'playing', isPlaying: true, isMuted: false }, 'second', true), { managed: true, playing: true, muted: false });
  assert.equal(restorePlayback({ currentShortcode: 'second', playbackIntent: 'playing', isPlaying: true }, 'other', true).managed, false);
});
test('Settings Play toggles pause and resume at the current item without navigating', async () => {
  const fixture = await setup([{ id: 10, url: args.url }]);
  await fixture.library('activate', { name: args.name });
  await fixture.session.set({ [playerKey(10, args.name)]: { currentIndex: 1, currentShortcode: 'second', isPlaying: true, playbackIntent: 'playing', isMuted: false } });
  const controls = [];
  fixture.tabs.sendMessage = async (_id, message) => { controls.push(message); return { ok: true }; };
  await togglePlaylist(fixture, args.name);
  assert.equal(controls[0].args.state.playbackIntent, 'paused');
  assert.equal(fixture.session.rows[playerKey(10, args.name)].isPlaying, false);
  await togglePlaylist(fixture, args.name);
  assert.equal(controls[1].args.state.playbackIntent, 'playing');
  assert.equal(fixture.updates.length, 0);
  assert.equal(fixture.session.rows[playerKey(10, args.name)].currentIndex, 1);
});
