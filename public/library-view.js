const searchable = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
export function searchLibrary(playlists, selected, query) {
  const words = searchable(query).trim().split(/\s+/).filter(Boolean);
  const results = [];
  for (const [name, items] of Object.entries(playlists)) {
    if (!words.length && name !== selected) continue;
    items.forEach((item, index) => {
      const text = searchable([name, item.title, item.username, item.caption, item.notes, ...(item.tags || []), item.shortcode, item.url].join(' '));
      if (words.every(word => text.includes(word))) results.push({ name, item, index, total: items.length });
    });
  }
  return results;
}
