import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Loader2, Clock, Grid, ExternalLink } from 'lucide-react';
import { VideoPlayer } from './VideoPlayer';
import { VideoDetector } from '@/utils/videoDetector';
import type { VideoData } from '@/utils/videoDetector';

export const ExtensionOverlay = () => {
  const [isOnSavedPage, setIsOnSavedPage] = useState(false);
  const [isCollecting, setIsCollecting] = useState(false);
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [videoCount, setVideoCount] = useState(0);
  const [showPlayer, setShowPlayer] = useState(false);
  const [extendedScan, setExtendedScan] = useState(false);
  const [forceIncludePosts, setForceIncludePosts] = useState(false);

  useEffect(() => {
    const pathname = window.location.pathname;
    const isCollectionPage = pathname.includes('/saved');
    setIsOnSavedPage(isCollectionPage);
  }, []);

  const handleGoToSaved = () => {
    window.location.href = 'https://www.instagram.com/saved/';
  };

  const handleEnable = async () => {
    console.log('🚀 Starting comprehensive video collection...');
    setIsCollecting(true);
    setVideoCount(0);
    
    const detector = new VideoDetector();

    const options = {
      durationMs: extendedScan ? 60000 : 30000,
      mode: forceIncludePosts ? 'forceDom' : 'normal'
    };
    
    console.log('📊 Collection options:', options);
    window.postMessage({ type: 'START_COLLECTION', options }, '*');

    try {
      const progressInterval = setInterval(() => {
        setVideoCount(prev => prev);
      }, 500);
      
      const detectedVideos = await detector.extractViaPageContext();
      
      clearInterval(progressInterval);
      
      if (detectedVideos.length === 0) {
        const retry = confirm(
          'No videos found. This could mean:\n\n' +
          '• This collection has no video posts\n' +
          '• Instagram changed their API structure\n' +
          '• Content hasn\'t loaded yet\n\n' +
          'Try:\n' +
          '• Scrolling manually first\n' +
          '• Enabling "Extended Scan (60s)"\n' +
          '• Enabling "Force Include Posts"\n\n' +
          'Click OK to retry, or Cancel to abort.'
        );
        
        if (retry) {
          setIsCollecting(false);
          setTimeout(() => handleEnable(), 1000);
          return;
        }
        
        setIsCollecting(false);
        return;
      }

      console.log(`✅ Successfully collected ${detectedVideos.length} videos!`);
      
      // Filter out videos without URLs (will use fallback)
      const videosWithUrls = detectedVideos.filter(v => v.videoUrl);
      const videosNeedingFallback = detectedVideos.filter(v => !v.videoUrl);
      
      console.log(`📊 Stats: ${videosWithUrls.length} direct MP4, ${videosNeedingFallback.length} need fallback`);
      
      setVideos(detectedVideos);
      setShowPlayer(true);
    } catch (error) {
      console.error('❌ Error in collection process:', error);
      alert('An error occurred. Check the console for details, then try refreshing the page.');
    } finally {
      setIsCollecting(false);
    }
  };
  
  const handleClearCache = () => {
    const detector = new VideoDetector();
    detector.clearCache();
    setVideos([]);
    setVideoCount(0);
    alert('Cache cleared. Videos will be freshly collected on next scan.');
  };

  if (showPlayer) {
    return <VideoPlayer videos={videos} onClose={() => setShowPlayer(false)} />;
  }

  if (!isOnSavedPage) {
    return (
      <div className="fixed bottom-8 right-8 z-[9999] animate-in slide-in-from-bottom-4 duration-500">
        <div className="bg-gradient-to-br from-primary/10 to-accent/10 backdrop-blur-lg border border-primary/20 rounded-2xl p-6 shadow-2xl max-w-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-primary/20 rounded-xl">
              <ExternalLink className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Navigate to Saved</h3>
              <p className="text-sm text-muted-foreground">Open a saved collection to start</p>
            </div>
          </div>
          <Button onClick={handleGoToSaved} className="w-full gap-2">
            <ExternalLink className="w-4 h-4" />
            Go to Saved Collections
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-8 right-8 z-[9999] animate-in slide-in-from-bottom-4 duration-500">
      <div className="bg-gradient-to-br from-primary/10 to-accent/10 backdrop-blur-lg border border-primary/20 rounded-2xl p-6 shadow-2xl max-w-sm space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 bg-primary/20 rounded-xl">
            <Play className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Video Playlist</h3>
            <p className="text-sm text-muted-foreground">Transform saved posts into a playlist</p>
          </div>
        </div>

        <div className="space-y-2 p-4 bg-background/50 rounded-lg border border-border/50">
          <label className="flex items-center gap-2 cursor-pointer group">
            <input type="checkbox" checked={extendedScan} onChange={(e) => setExtendedScan(e.target.checked)} className="w-4 h-4 rounded border-primary/20 text-primary focus:ring-primary" />
            <Clock className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            <span className="text-sm">Extended Scan (60s)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer group">
            <input type="checkbox" checked={forceIncludePosts} onChange={(e) => setForceIncludePosts(e.target.checked)} className="w-4 h-4 rounded border-primary/20 text-primary focus:ring-primary" />
            <Grid className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            <span className="text-sm">Force Include Posts</span>
          </label>
        </div>

        <div className="space-y-2">
          <Button onClick={handleEnable} disabled={isCollecting} className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold" size="lg">
            {isCollecting ? (<><Loader2 className="w-5 h-5 animate-spin" />Collecting Videos{videoCount > 0 ? ` (${videoCount})` : '...'}</>) : (<><Play className="w-5 h-5" />Enable Playlist</>)}
          </Button>
          <Button onClick={handleClearCache} variant="outline" className="w-full" size="sm">Clear Cache</Button>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          {extendedScan || forceIncludePosts ? <>Advanced options enabled. This may take longer.</> : <>Tip: Enable options above for better results</>}
        </p>
      </div>
    </div>
  );
};
