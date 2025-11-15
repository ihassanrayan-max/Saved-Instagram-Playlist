import { useState, useEffect } from 'react';
import { PlaylistMiniPlayer } from './PlaylistMiniPlayer';
import { getActivePlaylistName, type PlaylistItem } from '@/utils/playlistStorage';

export const ExtensionOverlay = () => {
  const [activePlaylistName, setActivePlaylistName] = useState<string | null>(null);
  const [showMiniPlayer, setShowMiniPlayer] = useState(true);
  const [collectionState, setCollectionState] = useState({
    status: 'idle',
    totalPosts: 0,
    processedPosts: 0,
    videosFound: 0
  });
  const [collectedItems, setCollectedItems] = useState<PlaylistItem[]>([]);

  // Load active playlist name and listen for changes
  useEffect(() => {
    const loadActivePlaylist = async () => {
      const active = await getActivePlaylistName();
      setActivePlaylistName(active);
      
      // Auto-show mini-player if there's an active playlist
      if (active && !showMiniPlayer) {
        const wasHidden = localStorage.getItem('instagram_miniplayer_hidden') === 'true';
        if (!wasHidden) {
          setShowMiniPlayer(true);
        }
      }
    };
    
    loadActivePlaylist();
    
    // Listen for storage changes from background script
    const messageHandler = (msg: any) => {
      if (msg.type === 'PLAYLIST_STORAGE_CHANGED' || msg.type === 'PLAYLIST_STATE_CHANGED') {
        loadActivePlaylist();
      }
    };
    
    if (typeof chrome !== 'undefined' && (chrome as any).runtime) {
      (chrome as any).runtime.onMessage.addListener(messageHandler);
    }
    
    // Poll for changes as backup
    const interval = setInterval(loadActivePlaylist, 2000);
    
    return () => {
      clearInterval(interval);
      if (typeof chrome !== 'undefined' && (chrome as any).runtime) {
        (chrome as any).runtime.onMessage.removeListener(messageHandler);
      }
    };
  }, [showMiniPlayer]);

  // Inject video detection script on ALL Instagram pages (needed for autoplay/unmute/play-pause)
  useEffect(() => {
    // Always inject the script for video detection
    const script = document.createElement('script');
    script.src = (chrome as any).runtime.getURL('inject-page-script.js');
    (document.head || document.documentElement).appendChild(script);
    script.onload = () => script.remove();
  }, []);

  // Handle collection messages from injected script (on saved pages)
  useEffect(() => {
    const pathname = window.location.pathname;
    const isCollectionPage = pathname.includes('/saved');
    
    // Listen for click collector updates (only on saved pages)
    if (isCollectionPage) {
      const messageHandler = (event: MessageEvent) => {
        if (event.source !== window) return;
        
        if (event.data.type === 'CLICK_COLLECTOR_UPDATE') {
          setCollectionState(event.data.state);
          if (event.data.videos) {
            const items: PlaylistItem[] = event.data.videos
              .filter((v: any) => v.postUrl || v.url)
              .map((v: any) => ({
                url: v.postUrl || v.url,
                shortcode: v.shortcode || v.url.match(/\/(p|reel)\/([^\/\?]+)/)?.[2] || '',
                thumbnail: v.thumbnailUrl || v.thumbnail,
                username: v.username,
                caption: v.caption
              }));
            setCollectedItems(items);
            
            // Send update to popup
            if (typeof chrome !== 'undefined' && (chrome as any).runtime) {
              (chrome as any).runtime.sendMessage({
                type: 'COLLECTION_UPDATE',
                state: event.data.state,
                items: items
              }).catch(() => {});
            }
          }
        } else if (event.data.type === 'CLICK_COLLECTOR_ERROR') {
          alert(`Collection error: ${event.data.error}`);
        } else if (event.data.type === 'CLICK_COLLECTOR_READY') {
          window.postMessage({ type: 'LOAD_STORED_PLAYLIST' }, '*');
        }
      };
      
      window.addEventListener('message', messageHandler);
      
      return () => {
        window.removeEventListener('message', messageHandler);
      };
    }
  }, []);

  // Listen for messages from popup
  useEffect(() => {
    const messageHandler = (msg: any) => {
      if (msg.type === 'START_COLLECTION') {
        window.postMessage({ type: 'START_CLICK_COLLECTION' }, '*');
      } else if (msg.type === 'STOP_COLLECTION') {
        window.postMessage({ type: 'STOP_CLICK_COLLECTION' }, '*');
      } else if (msg.type === 'CLEAR_COLLECTION') {
        window.postMessage({ type: 'CLEAR_STORAGE' }, '*');
        setCollectedItems([]);
        setCollectionState({
          status: 'idle',
          totalPosts: 0,
          processedPosts: 0,
          videosFound: 0
        });
      } else if (msg.type === 'GET_COLLECTION_STATE') {
        // Send current state to popup
        if (typeof chrome !== 'undefined' && (chrome as any).runtime) {
          (chrome as any).runtime.sendMessage({
            type: 'COLLECTION_UPDATE',
            state: collectionState,
            items: collectedItems
          }).catch(() => {});
        }
      }
    };
    
    if (typeof chrome !== 'undefined' && (chrome as any).runtime) {
      (chrome as any).runtime.onMessage.addListener(messageHandler);
      return () => {
        (chrome as any).runtime.onMessage.removeListener(messageHandler);
      };
    }
  }, [collectionState, collectedItems]);

  return (
    <>
      {/* Mini Player - appears when active playlist exists */}
      {showMiniPlayer && activePlaylistName && (
        <PlaylistMiniPlayer onClose={() => {
          setShowMiniPlayer(false);
          localStorage.setItem('instagram_miniplayer_hidden', 'true');
        }} />
      )}
    </>
  );
};
