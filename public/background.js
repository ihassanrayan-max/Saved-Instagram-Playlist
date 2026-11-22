import { createRepository } from './playlist-repository.js';
import { openPlaylistItem } from './play-item.js';
import { readPlayer, writePlayer } from './player-session.js';
import { playlistStatus, togglePlaylist } from './playlist-controls.js';
const library = createRepository(chrome.storage.local);
let playbackWrites = Promise.resolve();

chrome.runtime.onMessage.addListener((request, sender, respond) => {
  if (sender.id !== chrome.runtime.id) return false;
  if (request.type === 'PLAYLIST_STATUS' || request.type === 'TOGGLE_PLAYLIST') {
    const task = playbackWrites.then(async () => {
      const dependencies = { library, tabs: chrome.tabs, session: chrome.storage.session };
      if (request.type === 'PLAYLIST_STATUS') return playlistStatus(dependencies, request.args.name);
      await togglePlaylist(dependencies, request.args.name); return null;
    });
    playbackWrites = task.catch(() => {});
    task.then(data => respond({ ok: true, data }), error => respond({ ok: false, error: error.message }));
    return true;
  }
  if (request.type === 'PLAY_ITEM') {
    if (sender.tab) { respond({ ok: false, error: 'Open posts from Playlist Manager.' }); return false; }
    const task = playbackWrites.then(() => openPlaylistItem({ library, tabs: chrome.tabs, session: chrome.storage.session }, request.args));
    playbackWrites = task.catch(() => {});
    task.then(() => respond({ ok: true }), error => respond({ ok: false, error: error.message }));
    return true;
  }
  if (request.type === 'PLAYER_GET' || request.type === 'PLAYER_SET') {
    if (!sender.tab?.id) { respond({ ok: false, error: 'Playback state requires an Instagram tab.' }); return false; }
    const task = playbackWrites.then(() => request.type === 'PLAYER_GET'
      ? readPlayer(chrome.storage.session, sender, request.args?.name)
      : writePlayer(chrome.storage.session, sender, request.args?.name, request.args.state).then(() => null));
    playbackWrites = task.catch(() => {});
    task.then(data => respond({ ok: true, data }), error => respond({ ok: false, error: error.message }));
    return true;
  }
  if (request.type === 'PLAYER_CONTEXT') {
    if (!sender.tab?.id) return false;
    const task = playbackWrites.then(async () => {
      const name = await library('active');
      const [items, state] = await Promise.all([name ? library('get', { name }) : [], readPlayer(chrome.storage.session, sender, name)]);
      return { name, items, state };
    });
    playbackWrites = task.catch(() => {});
    task.then(data => respond({ ok: true, data }), error => respond({ ok: false, error: error.message }));
    return true;
  }
  if (request.type === 'LIBRARY') {
    library(request.operation, request.args).then(
      data => respond({ ok: true, data }),
      error => respond({ ok: false, error: error.message }),
    );
    return true;
  }
  if (request.type === 'END_SESSION') {
    const task = (async () => {
      const tabs = await chrome.tabs.query({ url: 'https://www.instagram.com/*' });
      await Promise.allSettled(tabs.map(tab => chrome.tabs.sendMessage(tab.id, { type: 'END_PLAYBACK' })));
      await library('activate', { name: null });
    })();
    task.then(() => respond({ ok: true }), error => respond({ ok: false, error: error.message }));
    return true;
  }
  if (request.type === 'OPEN_POPUP') {
    chrome.action.openPopup().then(() => respond({ ok: true }), error => respond({ ok: false, error: error.message }));
    return true;
  }
  return false;
});

chrome.runtime.onInstalled.addListener(() => { library('active').catch(console.error); });
