import { createRepository } from '../../public/playlist-repository.js';
import { extensionContext, isExtensionEnvironment, listenExtensionEvent, sendExtensionMessage } from './extensionContext';

export interface PlaylistItem {
  url: string;
  shortcode: string;
  thumbnail?: string;
  username?: string;
  caption?: string;
  title?: string;
  notes?: string;
  tags?: string[];
}
export interface PlaylistsData { [playlistName: string]: PlaylistItem[] }

// Website preview uses the same contract in its own origin.
const preview = createRepository({
  async get(keys: string | string[]) {
    return Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(key => [key, JSON.parse(localStorage.getItem(key) || 'null')]));
  },
  async set(values: Record<string, unknown>) {
    for (const [key, value] of Object.entries(values)) localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event('playlist-storage-changed'));
  },
  async remove(keys: string | string[]) {
    for (const key of Array.isArray(keys) ? keys : [keys]) localStorage.removeItem(key);
  },
});

async function command<T>(operation: string, args: Record<string, unknown> = {}): Promise<T> {
  if (!isExtensionEnvironment()) return preview(operation, args) as Promise<T>;
  const response = await sendExtensionMessage({ type: 'LIBRARY', operation, args });
  if (!response?.ok) throw new Error(response?.error || 'Extension storage is unavailable. Reload the extension and Instagram tab.');
  return response.data as T;
}

export const getAllPlaylists = () => command<PlaylistsData>('all');
export const getActivePlaylistName = () => command<string | null>('active');
export const setActivePlaylistName = (name: string | null) => command<void>('activate', { name });
export const getPlaylist = (name: string) => command<PlaylistItem[]>('get', { name });
export const createPlaylist = (name: string) => command<void>('create', { name });
export const deletePlaylist = (name: string) => command<void>('delete', { name });
export const renamePlaylist = (name: string, newName: string) => command<void>('rename', { name, newName });
export const savePlaylist = (name: string, items: PlaylistItem[]) => command<void>('save', { name, items });
export const addUrlsToPlaylist = (name: string, items: PlaylistItem[]) => command<void>('add', { name, items });
export const removeUrlsFromPlaylist = (name: string, urls: string[]) => command<void>('remove', { name, urls });
export const reorderPlaylist = savePlaylist;
export const movePlaylistItem = (name: string, shortcode: string, direction: -1 | 1) => command<void>('move', { name, shortcode, direction });
export const annotatePlaylistItem = (name: string, shortcode: string, metadata: Pick<PlaylistItem, 'title' | 'notes' | 'tags'>) => command<void>('annotate', { name, shortcode, metadata });
export const saveAllPlaylists = (playlists: PlaylistsData) => command<void>('import', { playlists });
export async function getActivePlaylist(): Promise<PlaylistItem[]> {
  const name = await getActivePlaylistName();
  return name ? getPlaylist(name) : [];
}

export function subscribeLibrary(listener: () => void) {
  if (isExtensionEnvironment()) {
    const handler = (changes: Record<string, unknown>, area: string) => {
      if (extensionContext.check() && area === 'local' && Object.keys(changes).some(key => key.startsWith('library_v2_'))) listener();
    };
    return listenExtensionEvent(() => chrome.storage.onChanged, handler);
  }
  window.addEventListener('playlist-storage-changed', listener);
  return () => window.removeEventListener('playlist-storage-changed', listener);
}
