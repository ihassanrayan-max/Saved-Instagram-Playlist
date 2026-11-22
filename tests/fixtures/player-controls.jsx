import React from 'react';
import { createRoot } from 'react-dom/client';
import { PlaylistMiniPlayer } from '../../src/components/PlaylistMiniPlayer';
import { readPlayer, writePlayer } from '../../public/player-session.js';
import { togglePlaylist } from '../../public/playlist-controls.js';
import { notifyPlaybackControl } from '../../src/instagram/playerRequests';
import { pausePost, playPost } from '../../src/instagram/playback';

const name = 'Fixture Playlist';
const items = [{ url: 'https://www.instagram.com/reel/fixtureA/', shortcode: 'fixtureA', title: 'You Never Give Up', username: 'anime_creator', tags: ['Demon Slayer'] }, { url: 'https://www.instagram.com/reel/fixtureB/', shortcode: 'fixtureB', caption: 'I will make it happen.' }];
const listeners = new Set();
const video = document.getElementById('fixture-video');
let paused = true;
let source = 'fixtureA';
globalThis.fixtureCode = 'fixtureA';
Object.defineProperty(video, 'paused', { get: () => paused });
Object.defineProperty(video, 'readyState', { get: () => 4 });
Object.defineProperty(video, 'currentSrc', { get: () => source });
const show = () => {
  document.getElementById('media-state').textContent = `${paused ? 'Paused' : 'Playing'} · ${video.muted || video.volume === 0 ? 'Muted' : 'Audible'}`;
  document.getElementById('native-sound').textContent = video.muted ? 'Unmute native video' : 'Mute native video';
};
video.play = async () => { const changed = paused; paused = false; if (changed) video.dispatchEvent(new Event('play')); video.dispatchEvent(new Event('playing')); show(); };
video.pause = () => { const changed = !paused; paused = true; if (changed) video.dispatchEvent(new Event('pause')); show(); };
video.muted = true;
video.addEventListener('volumechange', show);
globalThis.fixtureSetMuted = (element, muted) => { element.muted = muted; if (!muted && !element.volume) element.volume = 1; show(); };
globalThis.fixtureNavigate = async url => {
  globalThis.fixtureCode = new URL(url).pathname.split('/')[2]; source = globalThis.fixtureCode;
  window.dispatchEvent(new Event('popstate')); return 'native';
};
const session = {
  async get(keys) { return Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(key => [key, JSON.parse(localStorage.getItem(`media-test:${key}`) || 'null')])); },
  async set(values) { for (const [key, value] of Object.entries(values)) localStorage.setItem(`media-test:${key}`, JSON.stringify(value)); for (const listener of listeners) listener(Object.fromEntries(Object.keys(values).map(key => [key, {}])), 'session'); },
  async remove(keys) { for (const key of Array.isArray(keys) ? keys : [keys]) localStorage.removeItem(`media-test:${key}`); },
};
const sender = { tab: { id: 7 }, documentId: crypto.randomUUID(), url: items[0].url };
const library = async operation => operation === 'get' ? items : name;
const tabs = {
  async query() { return [{ id: 7, url: `https://www.instagram.com/reel/${globalThis.fixtureCode}/` }]; },
  async sendMessage(_id, message) {
    const { state, shortcode } = message.args;
    notifyPlaybackControl(name, state);
    if (state.isPlaying) playPost(shortcode, Boolean(state.isMuted)); else pausePost(shortcode);
    return { ok: true };
  },
};
globalThis.chrome = {
  runtime: { id: 'fixture-extension', async sendMessage(message) {
    sender.url = `https://www.instagram.com/reel/${globalThis.fixtureCode}/`;
    if (message.type === 'PLAYER_CONTEXT') {
      const state = await readPlayer(session, sender, name) || { currentIndex: 0, currentShortcode: 'fixtureA', navigationShortcode: 'fixtureA', isPlaying: true, playbackIntent: 'playing', isMuted: false };
      return { ok: true, data: { name, items, state } };
    }
    if (message.type === 'PLAYER_SET') { await writePlayer(session, sender, name, message.args.state); return { ok: true }; }
    if (message.type === 'LIBRARY') return { ok: true, data: await library(message.operation) };
    return { ok: true };
  } },
  storage: { local: { async get() { return {}; }, async set() {} }, onChanged: { addListener(listener) { listeners.add(listener); }, removeListener(listener) { listeners.delete(listener); } } },
};
document.getElementById('native-sound').onclick = () => { video.muted = !video.muted; show(); };
document.getElementById('native-play').onclick = () => { void video.play(); };
document.getElementById('settings-toggle').onclick = () => { void togglePlaylist({ library, session, tabs }, name); };
document.getElementById('autoplay').onclick = () => { void video.play(); };
await video.play();
createRoot(document.getElementById('player-root')).render(<PlaylistMiniPlayer />);
