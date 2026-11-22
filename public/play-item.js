import { normalizeItem } from './playlist-model.js';
import { documentKey, intentKey, playerKey } from './player-session.js';

// Called by the extension popup, never by an Instagram page message.
export async function openPlaylistItem({ library, tabs, session }, args) {
  const item = normalizeItem({ url: args.url });
  const items = await library('get', { name: args.name });
  const currentIndex = items.findIndex(entry => entry.shortcode === item.shortcode);
  if (currentIndex < 0) throw new Error('This post is no longer in the playlist.');
  const [active] = await tabs.query({ active: true, currentWindow: true });
  let tab = active?.url?.startsWith('https://www.instagram.com/') ? active : null;
  if (!tab) [tab] = await tabs.query({ url: 'https://www.instagram.com/*', currentWindow: true });
  if (!tab) tab = await tabs.create({ url: 'about:blank', active: false });
  const key = playerKey(tab.id, args.name);
  const state = { currentIndex, isPlaying: true, isShuffle: false, shuffledOrder: [], isMinimized: false, navigationShortcode: item.shortcode, navigationStartedAt: Date.now() };
  const previousDocumentId = (await session.get(documentKey(tab.id)))[documentKey(tab.id)] || null;
  await session.set({ [key]: state, [intentKey(tab.id)]: { name: args.name, shortcode: item.shortcode, previousDocumentId, state } });
  await library('activate', { name: args.name });
  try {
    if (typeof tabs.sendMessage === 'function') {
      try {
        const response = await tabs.sendMessage(tab.id, { type: 'NAVIGATE_PLAYLIST', args: { name: args.name, url: items[currentIndex].url, state } });
        if (response?.ok && response.data !== 'reload') {
          await session.remove(intentKey(tab.id));
          await tabs.update(tab.id, { active: true });
          return;
        }
      } catch { /* Older/unloaded content script: fall back to document navigation. */ }
    }
    if (tab.url === items[currentIndex].url) {
      await tabs.update(tab.id, { active: true });
      await tabs.reload(tab.id);
    } else await tabs.update(tab.id, { url: items[currentIndex].url, active: true });
  } catch (error) {
    await session.remove(intentKey(tab.id));
    throw error;
  }
}
