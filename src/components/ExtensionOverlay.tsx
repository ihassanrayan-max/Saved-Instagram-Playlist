import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Loader2 } from 'lucide-react';
import { VideoPlayer } from './VideoPlayer';
import { VideoDetector } from '@/utils/videoDetector';
import { fetchVideoUrl } from '@/utils/videoFetcher';
import type { VideoData } from '@/utils/videoDetector';

export const ExtensionOverlay = () => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isCollecting, setIsCollecting] = useState(false);
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [videoCount, setVideoCount] = useState(0);
  const [showPlayer, setShowPlayer] = useState(false);

  useEffect(() => {
    // Check if we're on a saved collection page
    const isCollectionPage = window.location.pathname.includes('/saved/');
    setIsEnabled(isCollectionPage);
  }, []);

  // Comprehensive video collection with progress tracking
  const handleEnable = async () => {
    console.log('🚀 Starting comprehensive video collection...');
    setIsCollecting(true);
    setVideoCount(0);
    
    const detector = new VideoDetector();

    try {
      // Progress tracking
      const progressInterval = setInterval(() => {
        // Videos are updated via the detector
        setVideoCount(prev => prev); // Trigger re-render
      }, 500);
      
      // Use the new extraction method with extended timeout
      const detectedVideos = await detector.extractViaPageContext();
      
      clearInterval(progressInterval);
      
      if (detectedVideos.length === 0) {
        const retry = confirm(
          'No videos found. This could mean:\n\n' +
          '• This collection has no video posts\n' +
          '• Instagram changed their API structure\n' +
          '• Content hasn\'t loaded yet\n\n' +
          'Try scrolling manually first, then click OK to retry, or Cancel to abort.'
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
  
  const handleFallback = async () => {
    setIsCollecting(true);
    try {
      const detector = new VideoDetector();
      const detected = detector.detectVideos();
      if (detected.length === 0) {
        alert('No posts detected. Open a saved collection and scroll, then try again.');
        return;
      }
      setVideos(detected);
      setShowPlayer(true);
    } catch (e) {
      console.error('Fallback scan failed', e);
      alert('Fallback scan failed. Try reloading the page.');
    } finally {
      setIsCollecting(false);
    }
  };
  
  const handleClearCache = () => {
    const detector = new VideoDetector();
    detector.clearCache();
    alert('Cache cleared. Reload the page to start fresh.');
  };

  if (!isEnabled) {
    return null;
  }

  if (showPlayer) {
    return <VideoPlayer videos={videos} onClose={() => setShowPlayer(false)} />;
  }

  return (
    <div className="fixed bottom-8 right-8 z-[9999] animate-in slide-in-from-bottom-4 duration-500">
      <div className="bg-glass backdrop-blur-xl border border-glass-border rounded-2xl p-6 shadow-2xl">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-instagram-gradient flex items-center justify-center">
            <Play className="h-6 w-6 text-white fill-white" />
          </div>
          
          <div className="text-center">
            <h3 className="text-white font-semibold text-lg mb-1">
              Video Playlist
            </h3>
            <p className="text-white/70 text-sm">
              {isCollecting
                ? `Found ${videoCount} videos...`
                : 'Turn this collection into a playlist'}
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleEnable}
              disabled={isCollecting}
              className="bg-instagram-gradient hover:opacity-90 text-white font-medium px-6 py-2 rounded-full transition-all"
            >
              {isCollecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Collecting...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Enable Playlist
                </>
              )}
            </Button>
            
            <Button
              onClick={handleFallback}
              disabled={isCollecting}
              variant="secondary"
              className="font-medium px-6 py-2 rounded-full transition-all"
              title="Use DOM scan and open posts in fallback player"
            >
              Fallback Player
            </Button>
            
            <Button
              onClick={handleClearCache}
              variant="ghost"
              size="sm"
              className="text-white/70 hover:text-white"
              title="Clear cached videos and start fresh"
            >
              Clear Cache
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
