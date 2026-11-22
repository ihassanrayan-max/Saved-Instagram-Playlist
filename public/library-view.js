const searchable = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
export function postTitle(item) {
  return item.title?.trim() || item.caption?.trim().split(/\n/)[0].slice(0, 140) || (item.username ? `@${item.username.replace(/^@/, '')}` : `Instagram post · ${item.shortcode}`);
}
export function matchPost(item, query, playlist = '') {
  const words = searchable(query).trim().split(/\s+/).filter(Boolean);
  const fields = [
    ['Title', item.title], ['Creator', item.username], ...((item.tags || []).map(tag => ['Tag', tag])),
    ['Caption', item.caption], ['Notes', item.notes], ['Playlist', playlist], ['Code', item.shortcode], ['URL', item.url],
  ].filter(([, value]) => typeof value === 'string' && value.trim());
  const combined = searchable(fields.map(([, value]) => value).join(' '));
  if (!words.every(word => combined.includes(word))) return null;
  const matches = words.length ? fields.filter(([, value]) => words.some(word => searchable(value).includes(word))).map(([field, value]) => ({ field, value })) : [];
  return { title: postTitle(item), matches };
}
export function searchLibrary(playlists, selected, query) {
  const words = searchable(query).trim().split(/\s+/).filter(Boolean);
  const results = [];
  for (const [name, items] of Object.entries(playlists)) {
    if (!words.length && name !== selected) continue;
    items.forEach((item, index) => {
      const match = matchPost(item, query, name);
      if (match) results.push({ name, item, index, total: items.length, ...match });
    });
  }
  return results;
}
