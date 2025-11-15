import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Loader2, Database, Settings } from 'lucide-react';
import { getActivePlaylistName, addUrlsToPlaylist, type PlaylistItem } from '@/utils/playlistStorage';

export const CollectionController = () => {
  const [isCollecting, setIsCollecting] = useState(false);
  const [collectedItems, setCollectedItems] = useState<PlaylistItem[]>([]);
  const [activePlaylistName, setActivePlaylistName] = useState<string | null>(null);
  const [collectionState, setCollectionState] = useState({
    status: 'idle',
    totalPosts: 0,
    processedPosts: 0,
    videosFound: 0
  });

  // Load active playlist name
  useEffect(() => {
    const loadActivePlaylist = async () => {
      const active = await getActivePlaylistName();
      setActivePlaylistName(active);
    };
    
    loadActivePlaylist();
    const interval = setInterval(loadActivePlaylist, 2000);
    return () => clearInterval(interval);
  }, []);

  // Listen for collection updates from background script
  useEffect(() => {
    const messageHandler = (msg: any) => {
      if (msg.type === 'COLLECTION_UPDATE') {
        setCollectionState(msg.state || collectionState);
        if (msg.items) {
          setCollectedItems(msg.items);
        }
        if (msg.state) {
          setIsCollecting(msg.state.status === 'scrolling' || msg.state.status === 'collecting');
        }
      }
    };
    
    if (typeof chrome !== 'undefined' && (chrome as any).runtime) {
      (chrome as any).runtime.onMessage.addListener(messageHandler);
    }
    
    // Request current collection state from content script
    if (typeof chrome !== 'undefined' && (chrome as any).tabs) {
      (chrome as any).tabs.query({ url: 'https://www.instagram.com/*' }, (tabs: any[]) => {
        tabs.forEach(tab => {
          if (tab.id) {
            (chrome as any).tabs.sendMessage(tab.id, { type: 'GET_COLLECTION_STATE' }).catch(() => {});
          }
        });
      });
    }
    
    // Load stored collection
    loadStoredCollection();
    
    // Poll for collection updates
    const interval = setInterval(loadStoredCollection, 2000);
    
    return () => {
      clearInterval(interval);
      if (typeof chrome !== 'undefined' && (chrome as any).runtime) {
        (chrome as any).runtime.onMessage.removeListener(messageHandler);
      }
    };
  }, []);

  const loadStoredCollection = async () => {
    try {
      if (typeof chrome !== 'undefined' && (chrome as any).storage) {
        const result = await (chrome as any).storage.local.get(['instagram_playlist']);
        if (result.instagram_playlist && Array.isArray(result.instagram_playlist)) {
          setCollectedItems(result.instagram_playlist);
        }
      } else {
        const stored = sessionStorage.getItem('instagram_playlist');
        if (stored) {
          const items = JSON.parse(stored);
          setCollectedItems(items);
        }
      }
    } catch (e) {
      console.error('Error loading collection:', e);
    }
  };

  const handleStartCollection = () => {
    // Send message to content script to start collection
    if (typeof chrome !== 'undefined' && (chrome as any).tabs) {
      (chrome as any).tabs.query({ url: 'https://www.instagram.com/*' }, (tabs: any[]) => {
        tabs.forEach(tab => {
          if (tab.id) {
            (chrome as any).tabs.sendMessage(tab.id, { type: 'START_COLLECTION' }).catch(() => {});
          }
        });
      });
    }
    setIsCollecting(true);
  };

  const handleStopCollection = () => {
    if (typeof chrome !== 'undefined' && (chrome as any).tabs) {
      (chrome as any).tabs.query({ url: 'https://www.instagram.com/*' }, (tabs: any[]) => {
        tabs.forEach(tab => {
          if (tab.id) {
            (chrome as any).tabs.sendMessage(tab.id, { type: 'STOP_COLLECTION' }).catch(() => {});
          }
        });
      });
    }
    setIsCollecting(false);
  };

  const handleImportToActivePlaylist = async () => {
    if (!activePlaylistName) {
      alert('No active playlist. Please activate a playlist first.');
      return;
    }
    
    if (collectedItems.length === 0) {
      alert('No collected items to import. Please collect URLs first.');
      return;
    }
    
    try {
      await addUrlsToPlaylist(activePlaylistName, collectedItems);
      alert(`Imported ${collectedItems.length} items to "${activePlaylistName}"`);
    } catch (error: any) {
      alert(error.message || 'Failed to import items');
    }
  };

  const handleClearStorage = () => {
    if (confirm('Clear all collected URLs? This cannot be undone.')) {
      setCollectedItems([]);
      setCollectionState({
        status: 'idle',
        totalPosts: 0,
        processedPosts: 0,
        videosFound: 0
      });
      if (typeof chrome !== 'undefined' && (chrome as any).storage) {
        (chrome as any).storage.local.remove(['instagram_playlist']);
      }
      sessionStorage.removeItem('instagram_playlist');
      
      // Notify content script
      if (typeof chrome !== 'undefined' && (chrome as any).tabs) {
        (chrome as any).tabs.query({ url: 'https://www.instagram.com/*' }, (tabs: any[]) => {
          tabs.forEach(tab => {
            if (tab.id) {
              (chrome as any).tabs.sendMessage(tab.id, { type: 'CLEAR_COLLECTION' }).catch(() => {});
            }
          });
        });
      }
    }
  };

  const handleLoadStored = () => {
    loadStoredCollection();
  };

  return (
    <div className="w-full space-y-4 border-t pt-4 mt-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-3 bg-primary/20 rounded-xl">
          <Play className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">Playlist Controller</h3>
          <p className="text-sm text-muted-foreground">Collect URLs for navigation</p>
        </div>
      </div>

      {collectionState.status !== 'idle' && (
        <div className="p-4 bg-background/50 rounded-lg border border-border/50">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Status:</span>
              <span className="font-semibold capitalize">{collectionState.status}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Progress:</span>
              <span>{collectionState.processedPosts} / {collectionState.totalPosts}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Posts Found:</span>
              <span className="font-semibold text-primary">{collectionState.videosFound}</span>
            </div>
            {collectionState.status === 'collecting' && collectionState.totalPosts > 0 && (
              <div className="w-full bg-muted rounded-full h-2 mt-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${Math.min((collectionState.processedPosts / collectionState.totalPosts) * 100, 100)}%` }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {!isCollecting ? (
          <>
            <Button onClick={handleStartCollection} className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold" size="lg">
              <Play className="w-5 h-5" />
              Start Collection
            </Button>
            <Button onClick={handleLoadStored} variant="secondary" className="w-full gap-2" size="sm">
              <Database className="w-4 h-4" />
              Load Stored Collection ({collectedItems.length})
            </Button>
          </>
        ) : (
          <Button onClick={handleStopCollection} className="w-full gap-2 bg-destructive hover:bg-destructive/90" size="lg">
            <Loader2 className="w-5 h-5 animate-spin" />
            Stop Collection
          </Button>
        )}
        
        {collectedItems.length > 0 && (
          <>
            <Button 
              onClick={handleImportToActivePlaylist}
              variant="default" 
              className="w-full gap-2" 
              size="lg"
            >
              <Database className="w-4 h-4" />
              Import to Active Playlist ({collectedItems.length})
            </Button>
            {!activePlaylistName && (
              <p className="text-xs text-muted-foreground text-center">
                No active playlist. Activate a playlist above to import.
              </p>
            )}
          </>
        )}
        
        <Button onClick={handleClearStorage} variant="outline" className="w-full" size="sm">
          Clear Collection
        </Button>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Collects post URLs in order from your saved collection. Import them into playlists above.
      </p>
    </div>
  );
};

