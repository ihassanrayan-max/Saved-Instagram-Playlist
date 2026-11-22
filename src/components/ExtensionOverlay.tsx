import { useEffect, useState } from 'react';
import { PlaylistMiniPlayer } from './PlaylistMiniPlayer';
import { getActivePlaylistName, subscribeLibrary } from '@/utils/playlistStorage';
import { reportExtensionError } from '@/utils/extensionContext';

export const ExtensionOverlay = () => {
  const [active, setActive] = useState<string | null>(null);
  const [hidden, setHidden] = useState<string | null>(null);
  useEffect(() => {
    let disposed = false;
    const load = async () => {
      try { const name = await getActivePlaylistName(); if (!disposed) setActive(name); }
      catch (error) { reportExtensionError(error); }
    };
    load();
    const unsubscribe = subscribeLibrary(load);
    return () => { disposed = true; unsubscribe(); };
  }, []);
  return active && active !== hidden ? <PlaylistMiniPlayer onClose={() => setHidden(active)} /> : null;
};
