// Playlist storage utility for managing multiple playlists

export interface PlaylistItem {
  url: string;
  shortcode: string;
  thumbnail?: string;
  username?: string;
  caption?: string;
}

export interface PlaylistsData {
  [playlistName: string]: PlaylistItem[];
}

const STORAGE_KEY = 'instagram_playlists';
const ACTIVE_PLAYLIST_KEY = 'instagram_active_playlist';

/**
 * Get all playlists from storage
 */
export async function getAllPlaylists(): Promise<PlaylistsData> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const result = await chrome.storage.local.get([STORAGE_KEY]);
      return result[STORAGE_KEY] || {};
    } else {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    }
  } catch (e) {
    console.error('Error loading playlists:', e);
    return {};
  }
}

/**
 * Save all playlists to storage
 */
export async function saveAllPlaylists(playlists: PlaylistsData): Promise<void> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      await chrome.storage.local.set({ [STORAGE_KEY]: playlists });
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(playlists));
    }
  } catch (e) {
    console.error('Error saving playlists:', e);
  }
}

/**
 * Get the active playlist name
 */
export async function getActivePlaylistName(): Promise<string | null> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const result = await chrome.storage.local.get([ACTIVE_PLAYLIST_KEY]);
      return result[ACTIVE_PLAYLIST_KEY] || null;
    } else {
      return localStorage.getItem(ACTIVE_PLAYLIST_KEY);
    }
  } catch (e) {
    console.error('Error loading active playlist:', e);
    return null;
  }
}

/**
 * Set the active playlist name
 */
export async function setActivePlaylistName(name: string | null): Promise<void> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      await chrome.storage.local.set({ [ACTIVE_PLAYLIST_KEY]: name });
    } else {
      if (name) {
        localStorage.setItem(ACTIVE_PLAYLIST_KEY, name);
      } else {
        localStorage.removeItem(ACTIVE_PLAYLIST_KEY);
      }
    }
  } catch (e) {
    console.error('Error saving active playlist:', e);
  }
}

/**
 * Get a specific playlist by name
 */
export async function getPlaylist(name: string): Promise<PlaylistItem[]> {
  const playlists = await getAllPlaylists();
  return playlists[name] || [];
}

/**
 * Save a specific playlist
 */
export async function savePlaylist(name: string, items: PlaylistItem[]): Promise<void> {
  const playlists = await getAllPlaylists();
  // Remove duplicates
  const uniqueItems = items.filter((item, index, self) =>
    index === self.findIndex((t) => t.url === item.url)
  );
  playlists[name] = uniqueItems;
  await saveAllPlaylists(playlists);
}

/**
 * Create a new playlist
 */
export async function createPlaylist(name: string): Promise<void> {
  const playlists = await getAllPlaylists();
  if (playlists[name]) {
    throw new Error(`Playlist "${name}" already exists`);
  }
  playlists[name] = [];
  await saveAllPlaylists(playlists);
}

/**
 * Delete a playlist
 */
export async function deletePlaylist(name: string): Promise<void> {
  const playlists = await getAllPlaylists();
  delete playlists[name];
  await saveAllPlaylists(playlists);
  
  // If this was the active playlist, clear active
  const active = await getActivePlaylistName();
  if (active === name) {
    await setActivePlaylistName(null);
  }
}

/**
 * Rename a playlist
 */
export async function renamePlaylist(oldName: string, newName: string): Promise<void> {
  const playlists = await getAllPlaylists();
  if (playlists[newName]) {
    throw new Error(`Playlist "${newName}" already exists`);
  }
  if (!playlists[oldName]) {
    throw new Error(`Playlist "${oldName}" does not exist`);
  }
  
  playlists[newName] = playlists[oldName];
  delete playlists[oldName];
  await saveAllPlaylists(playlists);
  
  // Update active playlist name if needed
  const active = await getActivePlaylistName();
  if (active === oldName) {
    await setActivePlaylistName(newName);
  }
}

/**
 * Add URLs to a playlist (prevents duplicates)
 */
export async function addUrlsToPlaylist(
  playlistName: string,
  newItems: PlaylistItem[]
): Promise<void> {
  const existing = await getPlaylist(playlistName);
  const existingUrls = new Set(existing.map(item => item.url));
  
  // Filter out duplicates
  const uniqueNewItems = newItems.filter(item => !existingUrls.has(item.url));
  
  if (uniqueNewItems.length > 0) {
    await savePlaylist(playlistName, [...existing, ...uniqueNewItems]);
  }
}

/**
 * Remove URLs from a playlist
 */
export async function removeUrlsFromPlaylist(
  playlistName: string,
  urlsToRemove: string[]
): Promise<void> {
  const existing = await getPlaylist(playlistName);
  const filtered = existing.filter(item => !urlsToRemove.includes(item.url));
  await savePlaylist(playlistName, filtered);
}

/**
 * Reorder playlist items
 */
export async function reorderPlaylist(
  playlistName: string,
  newOrder: PlaylistItem[]
): Promise<void> {
  await savePlaylist(playlistName, newOrder);
}

/**
 * Get the active playlist items
 */
export async function getActivePlaylist(): Promise<PlaylistItem[]> {
  const activeName = await getActivePlaylistName();
  if (!activeName) {
    return [];
  }
  return await getPlaylist(activeName);
}

