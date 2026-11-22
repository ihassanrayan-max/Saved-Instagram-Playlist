// Shared validation for imports, storage, collection and playback.
export function normalizeItem(value) {
  if (!value || typeof value.url !== 'string') throw new Error('Expected an Instagram post URL.');
  const url = new URL(value.url);
  const match = url.pathname.match(/^\/(?:[\w.]+\/)?(p|reels?)\/([\w-]+)\/?$/);
  if (url.protocol !== 'https:' || !['instagram.com', 'www.instagram.com'].includes(url.hostname) || !match) {
    throw new Error('Please enter a valid HTTPS Instagram post or reel URL.');
  }
  const kind = match[1] === 'p' ? 'p' : 'reel';
  const item = { url: `https://www.instagram.com/${kind}/${match[2]}/`, shortcode: match[2] };
  for (const key of ['thumbnail', 'username', 'caption', 'title', 'notes']) {
    if (typeof value[key] === 'string') item[key] = value[key];
  }
  if (typeof item.title === 'string') item.title = item.title.slice(0, 160);
  if (typeof item.notes === 'string') item.notes = item.notes.slice(0, 5000);
  if (value.tags !== undefined) {
    if (!Array.isArray(value.tags) || value.tags.some(tag => typeof tag !== 'string')) throw new Error('Tags must be a list of text labels.');
    item.tags = [...new Set(value.tags.map(tag => tag.trim().slice(0, 64)).filter(Boolean))].slice(0, 20);
  }
  return item;
}

export function normalizeItems(items) {
  if (!Array.isArray(items)) throw new Error('Expected a list of posts.');
  const unique = new Map();
  for (const input of items) {
    const item = normalizeItem(input);
    if (!unique.has(item.shortcode)) unique.set(item.shortcode, item);
  }
  return [...unique.values()];
}

export function playlistName(value) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('A playlist name is required.');
  return value.trim();
}

export function validatePlaylists(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected a playlists object.');
  return Object.fromEntries(Object.entries(value).map(([name, items]) => [playlistName(name), normalizeItems(items)]));
}
