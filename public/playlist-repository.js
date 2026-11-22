import { normalizeItems, playlistName, validatePlaylists } from './playlist-model.js';

export const INDEX_KEY = 'library_v2_names';
export const ACTIVE_KEY = 'library_v2_active';
export const itemKey = name => `library_v2_playlist:${encodeURIComponent(name)}`;

// One writer serializes read/modify/write operations across all extension contexts.
export function createRepository(storage) {
  let queue = Promise.resolve();
  async function execute(operation, args) {
    let data = await storage.get([INDEX_KEY, ACTIVE_KEY]);
    if (!data[INDEX_KEY]) {
      await storage.set({ [INDEX_KEY]: [], [ACTIVE_KEY]: null });
      // Legacy URL lists are intentionally discarded, as requested.
      await storage.remove(['instagram_playlists', 'instagram_active_playlist', 'instagram_playlist', 'lastUpdated']);
      data = { [INDEX_KEY]: [], [ACTIVE_KEY]: null };
    }
    const names = data[INDEX_KEY];
    const active = data[ACTIVE_KEY] || null;
    const read = async name => (await storage.get(itemKey(name)))[itemKey(name)] || [];
    if (operation === 'all') {
      const rows = await storage.get(names.map(itemKey));
      return Object.fromEntries(names.map(name => [name, rows[itemKey(name)] || []]));
    }
    if (operation === 'active') return active;
    if (operation === 'get') return read(playlistName(args.name));
    if (operation === 'activate') {
      if (args.name !== null && !names.includes(args.name)) throw new Error('Playlist no longer exists.');
      await storage.set({ [ACTIVE_KEY]: args.name });
      return null;
    }
    if (operation === 'import') {
      const playlists = validatePlaylists(args.playlists);
      await storage.set({
        ...Object.fromEntries(Object.entries(playlists).map(([name, items]) => [itemKey(name), items])),
        [INDEX_KEY]: [...new Set([...names, ...Object.keys(playlists)])],
      });
      return null;
    }
    const name = playlistName(args.name);
    if (operation === 'create') {
      if (names.includes(name)) throw new Error(`Playlist "${name}" already exists.`);
      await storage.set({ [INDEX_KEY]: [...names, name], [itemKey(name)]: [] });
      return null;
    }
    if (!names.includes(name)) throw new Error('Playlist no longer exists.');
    if (operation === 'delete') {
      await storage.set({ [INDEX_KEY]: names.filter(n => n !== name), [ACTIVE_KEY]: active === name ? null : active });
      await storage.remove(itemKey(name));
    } else if (operation === 'rename') {
      const next = playlistName(args.newName);
      if (names.includes(next)) throw new Error(`Playlist "${next}" already exists.`);
      await storage.set({
        [itemKey(next)]: await read(name), [INDEX_KEY]: names.map(n => n === name ? next : n),
        [ACTIVE_KEY]: active === name ? next : active,
      });
      await storage.remove(itemKey(name));
    } else if (operation === 'annotate' || operation === 'move') {
      const items = await read(name);
      const index = items.findIndex(item => item.shortcode === args.shortcode);
      if (index < 0) throw new Error('This post is no longer in the playlist.');
      if (operation === 'annotate') {
        const patch = args.metadata || {};
        items[index] = normalizeItems([{ ...items[index], title: patch.title, notes: patch.notes, tags: patch.tags }])[0];
      } else {
        if (args.direction !== -1 && args.direction !== 1) throw new Error('Invalid move direction.');
        const next = index + args.direction;
        if (next >= 0 && next < items.length) [items[index], items[next]] = [items[next], items[index]];
      }
      await storage.set({ [itemKey(name)]: items });
    } else if (['save', 'add', 'remove'].includes(operation)) {
      let items;
      if (operation === 'add') items = normalizeItems([...(await read(name)), ...normalizeItems(args.items)]);
      else if (operation === 'remove') {
        const remove = new Set(normalizeItems(args.urls.map(url => ({ url }))).map(item => item.shortcode));
        items = (await read(name)).filter(item => !remove.has(item.shortcode));
      } else items = normalizeItems(args.items);
      await storage.set({ [itemKey(name)]: items });
    } else throw new Error('Unknown playlist operation.');
    return null;
  }
  return (operation, args = {}) => {
    const result = queue.then(() => execute(operation, args));
    queue = result.catch(() => {});
    return result;
  };
}
