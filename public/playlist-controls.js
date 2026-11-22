import { playerKey } from './player-session.js';
import { openPlaylistItem } from './play-item.js';
export async function playlistStatus({ tabs, session }, name) {
  const [active] = await tabs.query({ active: true, currentWindow: true });
  let tab = active?.url?.startsWith('https://www.instagram.com/') ? active : null;
  if (!tab) [tab] = await tabs.query({ url: 'https://www.instagram.com/*', currentWindow: true });
  const state = tab ? (await session.get(playerKey(tab.id, name)))[playerKey(tab.id, name)] || null : null;
  return { tab, state };
}
export async function togglePlaylist(dependencies, name) {
  const { library, session, tabs } = dependencies;
  const items = await library('get', { name });
  if (!items.length) throw new Error('This playlist is empty.');
  const { tab, state } = await playlistStatus(dependencies, name);
  const index = Math.max(0, Math.min(state?.currentIndex || 0, items.length - 1));
  const item = items[index];
  const onPost = tab?.url?.includes(`/${item.shortcode}/`);
  if (onPost && await library('active') === name && state) {
    const playing = !state.isPlaying;
    const next = { ...state, currentShortcode: item.shortcode, isPlaying: playing, playbackIntent: playing ? 'playing' : 'paused', isMuted: playing ? false : Boolean(state.isMuted) };
    await session.set({ [playerKey(tab.id, name)]: next });
    try {
      const response = await tabs.sendMessage(tab.id, { type: 'CONTROL_PLAYBACK', args: { name, shortcode: item.shortcode, state: next } });
      if (response?.ok) return;
    } catch { /* Keep the saved pause intent if the old tab needs a refresh. */ }
    if (!playing) throw new Error('Pause was saved. Refresh the Instagram tab to reconnect its controls.');
  }
  await openPlaylistItem(dependencies, { name, url: item.url });
}
