import { normalizeItem } from './playlist-model.js';

export const playerKey = (tabId, name) => `player_v2:${tabId}:${encodeURIComponent(name || '')}`;
export const intentKey = tabId => `player_v2_intent:${tabId}`;
export const documentKey = tabId => `player_v2_document:${tabId}`;
export const shouldStartPlayback = (state, shortcode) => Boolean(shortcode && state?.isPlaying && state.navigationShortcode === shortcode);
export function restorePlayback(state, shortcode, reload = false) {
  const navigation = shouldStartPlayback(state, shortcode);
  const samePost = Boolean(shortcode && state?.currentShortcode === shortcode);
  const paused = samePost && state?.playbackIntent === 'paused';
  const resume = samePost && reload && state?.playbackIntent === 'playing';
  return { managed: navigation || paused || resume, playing: !paused && (navigation || resume), muted: Boolean(state?.isMuted) };
}

export async function readPlayer(session, sender, name) {
  const key = playerKey(sender.tab.id, name);
  const pendingKey = intentKey(sender.tab.id);
  const rows = await session.get([key, pendingKey]);
  const intent = rows[pendingKey];
  let shortcode;
  try { shortcode = normalizeItem({ url: sender.url }).shortcode; } catch { /* Not a post page. */ }
  let state = rows[key] || null;
  if (intent && intent.name === name && intent.shortcode === shortcode && sender.documentId !== intent.previousDocumentId) {
    // The destination document consumes the click exactly once. Outgoing
    // React effects cannot overwrite the requested queue entry during unload.
    state = intent.state;
    await session.set({ [key]: state });
    await session.remove(pendingKey);
  }
  await session.set({ [documentKey(sender.tab.id)]: sender.documentId });
  return state;
}

export async function writePlayer(session, sender, name, state) {
  const rows = await session.get([intentKey(sender.tab.id), documentKey(sender.tab.id)]);
  const pending = rows[intentKey(sender.tab.id)];
  if (pending && sender.documentId === pending.previousDocumentId) return;
  const currentDocumentId = rows[documentKey(sender.tab.id)];
  if (currentDocumentId && sender.documentId !== currentDocumentId) return;
  await session.set({ [playerKey(sender.tab.id, name)]: state });
}
