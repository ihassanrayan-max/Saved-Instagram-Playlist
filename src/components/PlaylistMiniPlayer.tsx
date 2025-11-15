import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  Shuffle, 
  Repeat, 
  X,
  Minimize2,
  Maximize2,
  List,
  Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getActivePlaylist, getActivePlaylistName, type PlaylistItem } from '@/utils/playlistStorage';

interface PlaylistMiniPlayerProps {
  onClose?: () => void;
}

const STORAGE_KEY = 'instagram_playlist_state';
const POSITION_KEY = 'instagram_miniplayer_position';

interface PlaylistState {
  currentIndex: number;
  isPlaying: boolean;
  isShuffle: boolean;
  loopMode: 'off' | 'loop-video';
  shuffledOrder: number[];
  isMinimized: boolean;
}

export const PlaylistMiniPlayer = ({ onClose }: PlaylistMiniPlayerProps) => {
  const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
  const [playlistName, setPlaylistName] = useState<string | null>(null);
  
  const [state, setState] = useState<PlaylistState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Migrate old loop modes to new loop-video
        const loopMode = parsed.loopMode === 'loop-one' || parsed.loopMode === 'loop-playlist' 
          ? 'loop-video' 
          : (parsed.loopMode === 'loop-video' ? 'loop-video' : 'off');
        return {
          ...parsed,
          loopMode,
          // Ensure shuffledOrder is valid
          shuffledOrder: parsed.shuffledOrder && Array.isArray(parsed.shuffledOrder) 
            ? parsed.shuffledOrder 
            : []
        };
      }
    } catch (e) {
      console.error('Error loading playlist state:', e);
    }
    return {
      currentIndex: 0,
      isPlaying: false,
      isShuffle: false,
      loopMode: 'off',
      shuffledOrder: [],
      isMinimized: false
    };
  });

  // Load active playlist from storage and listen for changes
  useEffect(() => {
    const loadActivePlaylist = async () => {
      const active = await getActivePlaylist();
      const name = await getActivePlaylistName();
      setPlaylist(active);
      setPlaylistName(name);
      
      // Validate current index
      if (state.currentIndex >= active.length && active.length > 0) {
        setState(prev => ({ ...prev, currentIndex: 0 }));
      }
    };
    
    loadActivePlaylist();
    
    // Listen for messages from background script
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
  }, [state.currentIndex]);

  // Update state when playlist changes
  useEffect(() => {
    if (state.currentIndex >= playlist.length && playlist.length > 0) {
      setState(prev => ({ ...prev, currentIndex: 0 }));
    }
  }, [playlist.length, state.currentIndex]);

  const [position, setPosition] = useState(() => {
    try {
      const stored = localStorage.getItem(POSITION_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { x: parsed.x || 20, y: parsed.y || 20 };
      }
    } catch (e) {
      console.error('Error loading position:', e);
    }
    return { x: 20, y: 20 };
  });

  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Save state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Error saving playlist state:', e);
    }
  }, [state]);

  // Save position to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(POSITION_KEY, JSON.stringify(position));
    } catch (e) {
      console.error('Error saving position:', e);
    }
  }, [position]);

  // Generate shuffled order when shuffle is enabled
  useEffect(() => {
    if (state.isShuffle && playlist.length > 0) {
      if (state.shuffledOrder.length !== playlist.length) {
        const order = Array.from({ length: playlist.length }, (_, i) => i);
        // Fisher-Yates shuffle
        for (let i = order.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [order[i], order[j]] = [order[j], order[i]];
        }
        setState(prev => ({ ...prev, shuffledOrder: order }));
      }
    }
  }, [state.isShuffle, playlist.length, state.shuffledOrder.length]);

  // Navigate to URL - defined early to avoid initialization errors
  const navigateToUrl = useCallback((url: string) => {
    window.location.href = url;
    
    // Send message to indicate playlist navigation (for initial unmute)
    setTimeout(() => {
      window.postMessage({
        type: 'PLAYLIST_NAVIGATION',
        source: 'playlist_miniplayer'
      }, '*');
    }, 500);
  }, []);

  // Get next index - defined early to avoid initialization errors
  const getNextIndex = useCallback((): number => {
    if (playlist.length === 0) return 0;
    
    if (state.isShuffle && state.shuffledOrder.length > 0) {
      const currentPos = state.shuffledOrder.indexOf(state.currentIndex);
      if (currentPos === -1) return state.shuffledOrder[0];
      const nextPos = (currentPos + 1) % state.shuffledOrder.length;
      return state.shuffledOrder[nextPos];
    } else {
      return (state.currentIndex + 1) % playlist.length;
    }
  }, [state.currentIndex, state.isShuffle, state.shuffledOrder, playlist.length]);

  // Sync current index with actual URL when page loads or URL changes
  useEffect(() => {
    const syncIndex = () => {
      const currentUrl = window.location.href;
      const currentIndex = playlist.findIndex(item => 
        currentUrl.includes(item.shortcode) || 
        currentUrl === item.url ||
        currentUrl.includes(`/p/${item.shortcode}/`) ||
        currentUrl.includes(`/reel/${item.shortcode}/`)
      );
      if (currentIndex !== -1) {
        if (currentIndex !== state.currentIndex) {
          setState(prev => ({ ...prev, currentIndex }));
        }
        
        // Send message for initial unmute on playlist URLs
        window.postMessage({
          type: 'PLAYLIST_NAVIGATION',
          source: 'playlist_miniplayer'
        }, '*');
      }
    };

    // Check immediately
    syncIndex();

    // Listen for navigation events
    const handlePopState = () => {
      setTimeout(syncIndex, 500);
    };

    window.addEventListener('popstate', handlePopState);
    
    // Also check periodically (for SPA navigation)
    const interval = setInterval(syncIndex, 2000);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      clearInterval(interval);
    };
  }, [playlist, state.currentIndex]);

  // Listen for video events
  useEffect(() => {
    const handleVideoEvent = (event: MessageEvent) => {
      if (event.source !== window) return;
      
      if (event.data.type === 'INSTAGRAM_VIDEO_ENDED' && state.isPlaying) {
        if (state.loopMode === 'loop-video') {
          // Loop current video - reload the same URL
          const currentUrl = playlist[state.currentIndex]?.url;
          if (currentUrl) {
            setState(prev => ({ ...prev, isPlaying: true }));
            navigateToUrl(currentUrl);
          }
        } else {
          // No loop - advance to next
          const nextIdx = getNextIndex();
          setState(prev => ({ ...prev, currentIndex: nextIdx, isPlaying: true }));
          navigateToUrl(playlist[nextIdx].url);
        }
      } else if (event.data.type === 'INSTAGRAM_VIDEO_PLAYING') {
        // Always sync playing state from video, regardless of who's controlling
        setState(prev => ({ ...prev, isPlaying: true }));
      } else if (event.data.type === 'INSTAGRAM_VIDEO_PAUSED') {
        // Always sync paused state from video, regardless of who's controlling
        setState(prev => ({ ...prev, isPlaying: false }));
      }
    };

    window.addEventListener('message', handleVideoEvent);
    return () => window.removeEventListener('message', handleVideoEvent);
  }, [state.isPlaying, state.currentIndex, state.loopMode, state.isShuffle, playlist, getNextIndex, navigateToUrl]);

  // Get previous index
  const getPreviousIndex = useCallback((): number => {
    if (playlist.length === 0) return 0;
    
    if (state.isShuffle && state.shuffledOrder.length > 0) {
      const currentPos = state.shuffledOrder.indexOf(state.currentIndex);
      if (currentPos === -1) return state.shuffledOrder[state.shuffledOrder.length - 1];
      const prevPos = (currentPos - 1 + state.shuffledOrder.length) % state.shuffledOrder.length;
      return state.shuffledOrder[prevPos];
    } else {
      return (state.currentIndex - 1 + playlist.length) % playlist.length;
    }
  }, [state.currentIndex, state.isShuffle, state.shuffledOrder, playlist.length]);

  const handlePlay = useCallback(() => {
    if (playlist.length === 0) return;
    const url = playlist[state.currentIndex]?.url;
    if (url) {
      setState(prev => ({ ...prev, isPlaying: true }));
      // If already on this URL, just play the video
      const currentUrl = window.location.href;
      if (currentUrl.includes(url) || currentUrl.includes(playlist[state.currentIndex]?.shortcode || '')) {
        // Send play command to content script
        window.postMessage({ type: 'PLAYLIST_PLAY' }, '*');
      } else {
        // Navigate to URL
        navigateToUrl(url);
      }
    }
  }, [playlist, state.currentIndex, navigateToUrl]);

  const handlePause = () => {
    setState(prev => ({ ...prev, isPlaying: false }));
    // Send pause command to content script
    window.postMessage({ type: 'PLAYLIST_PAUSE' }, '*');
  };

  const handleNext = useCallback(() => {
    if (playlist.length === 0) return;
    
    const nextIndex = getNextIndex();
    setState(prev => ({ ...prev, currentIndex: nextIndex, isPlaying: true }));
    navigateToUrl(playlist[nextIndex].url);
  }, [playlist, getNextIndex, navigateToUrl]);

  const handlePrevious = useCallback(() => {
    if (playlist.length === 0) return;
    
    const prevIndex = getPreviousIndex();
    setState(prev => ({ ...prev, currentIndex: prevIndex, isPlaying: true }));
    navigateToUrl(playlist[prevIndex].url);
  }, [playlist, getPreviousIndex, navigateToUrl]);

  const handleShuffle = () => {
    setState(prev => ({
      ...prev,
      isShuffle: !prev.isShuffle,
      shuffledOrder: !prev.isShuffle ? [] : prev.shuffledOrder
    }));
  };

  const handleLoop = () => {
    setState(prev => {
      const modes: ('off' | 'loop-video')[] = ['off', 'loop-video'];
      const currentModeIndex = modes.indexOf(prev.loopMode);
      const nextMode = modes[(currentModeIndex + 1) % modes.length];
      return { ...prev, loopMode: nextMode };
    });
  };

  const handleMinimize = () => {
    setState(prev => ({ ...prev, isMinimized: !prev.isMinimized }));
  };


  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      setIsDragging(true);
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  // Open extension popup via background script
  const handleOpenSettings = () => {
    if (typeof chrome !== 'undefined' && (chrome as any).runtime) {
      (chrome as any).runtime.sendMessage({ type: 'OPEN_POPUP' }).catch(() => {
        // Popup cannot be opened programmatically, user must click extension icon
      });
    }
  };

  const currentItem = playlist[state.currentIndex];

  // Don't render if no active playlist
  if (!playlistName || playlist.length === 0) {
    return null;
  }

  // Always show mini-player when active playlist exists (not just on saved pages)

  if (state.isMinimized) {
    return (
      <div
        ref={containerRef}
        style={{
          position: 'fixed',
          left: `${position.x}px`,
          top: `${position.y}px`,
          zIndex: 9999
        }}
        className="cursor-move animate-scale-in"
        onMouseDown={handleMouseDown}
      >
        <button
          onClick={handleMinimize}
          className="w-14 h-14 rounded-full gradient-instagram shadow-lg flex items-center justify-center transition-all hover:scale-110 hover:shadow-xl hover-lift group relative overflow-hidden"
          title="Expand mini-player"
        >
          <div className="absolute inset-0 gradient-animated opacity-75 group-hover:opacity-100 transition-opacity" />
          <Play className="h-6 w-6 text-white relative z-10 drop-shadow-lg" />
          <div className="absolute inset-0 rounded-full bg-white/20 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 9999
      }}
      className="glass rounded-2xl shadow-2xl w-80 overflow-hidden animate-scale-in backdrop-blur-xl"
    >
      {/* Gradient background overlay */}
      <div className="absolute inset-0 gradient-animated opacity-10 pointer-events-none" />
      
      {/* Header - Draggable */}
      <div
        className="flex items-center justify-between p-4 border-b border-white/10 cursor-move relative z-10 bg-gradient-to-r from-transparent via-white/5 to-transparent"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="relative">
            <div className="w-2.5 h-2.5 bg-primary rounded-full animate-pulse" />
            <div className="absolute inset-0 bg-primary rounded-full animate-ping opacity-75" />
          </div>
          <span className="text-white text-sm font-bold truncate drop-shadow-sm">
            {playlistName}
          </span>
          <span className="text-white/60 text-xs flex-shrink-0 px-2 py-0.5 rounded-full bg-white/10 backdrop-blur-sm">
            {state.currentIndex + 1} / {playlist.length}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleOpenSettings}
            className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-all hover:scale-110"
            title="Open Playlist Manager"
          >
            <Settings className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleMinimize}
            className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-all hover:scale-110"
            title="Minimize"
          >
            <Minimize2 className="h-3.5 w-3.5" />
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-7 w-7 text-white/80 hover:text-white hover:bg-red-500/20 rounded-lg transition-all hover:scale-110"
              title="Close"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="p-5 space-y-4 relative z-10">
        {/* Main Controls */}
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleShuffle}
            className={cn(
              "h-9 w-9 text-white/70 hover:text-white rounded-xl transition-all hover:scale-110 hover:bg-white/10",
              state.isShuffle && "text-primary bg-primary/20 pulse-glow"
            )}
            title="Shuffle"
          >
            <Shuffle className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrevious}
            className="h-9 w-9 text-white/70 hover:text-white rounded-xl transition-all hover:scale-110 hover:bg-white/10 hover-lift"
            title="Previous"
          >
            <SkipBack className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={state.isPlaying ? handlePause : handlePlay}
            className={cn(
              "h-12 w-12 text-white rounded-xl transition-all hover:scale-110 hover-lift relative overflow-hidden",
              state.isPlaying 
                ? "bg-gradient-to-br from-primary/80 to-accent/80 shadow-lg shadow-primary/50" 
                : "gradient-instagram shadow-lg"
            )}
            title={state.isPlaying ? "Pause" : "Play"}
          >
            <div className="absolute inset-0 gradient-animated opacity-50" />
            {state.isPlaying ? (
              <Pause className="h-6 w-6 relative z-10 drop-shadow-lg" />
            ) : (
              <Play className="h-6 w-6 relative z-10 drop-shadow-lg ml-0.5" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleNext}
            className="h-9 w-9 text-white/70 hover:text-white rounded-xl transition-all hover:scale-110 hover:bg-white/10 hover-lift"
            title="Next"
          >
            <SkipForward className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleLoop}
            className={cn(
              "h-9 w-9 text-white/70 hover:text-white rounded-xl transition-all hover:scale-110 hover:bg-white/10",
              state.loopMode !== 'off' && "text-primary bg-primary/20 pulse-glow"
            )}
            title={`Loop: ${state.loopMode}`}
          >
            <Repeat className="h-4 w-4" />
          </Button>
        </div>

        {/* Current Item Info */}
        {currentItem && (
          <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10 backdrop-blur-sm hover:bg-white/10 transition-all hover-lift group">
            {currentItem.thumbnail ? (
              <div className="relative w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 group-hover:scale-105 transition-transform">
                <img
                  src={currentItem.thumbnail}
                  alt=""
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            ) : (
              <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center flex-shrink-0">
                <Play className="h-6 w-6 text-white/70" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold truncate drop-shadow-sm">
                {currentItem.username || 'Instagram Post'}
              </p>
              <p className="text-white/50 text-xs truncate">
                {currentItem.caption || currentItem.shortcode}
              </p>
            </div>
          </div>
        )}

        {/* Loop Mode Indicator */}
        {state.loopMode !== 'off' && (
          <div className="text-center text-xs text-white/60 px-3 py-1.5 rounded-full bg-primary/20 border border-primary/30 inline-block mx-auto">
            🔁 Loop: Video
          </div>
        )}
      </div>
    </div>
  );
};

