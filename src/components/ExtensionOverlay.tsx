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

  // Phase 7: Integration with new detection system
  const handleEnable = async () => {
    console.log('🚀 [Phase 7] Starting video collection process...');
    setIsCollecting(true);
    const detector = new VideoDetector();

    try {
      // Detect videos (returns VideoData with null videoUrls)
      console.log('📡 [Phase 7] Detecting videos from DOM...');
      const detectedVideos = detector.detectVideos();
      setVideoCount(detectedVideos.length);
      
      if (detectedVideos.length === 0) {
        console.warn('⚠️ [Phase 7] No videos detected on page');
        alert('No videos found on this page. Make sure you are on an Instagram saved collection with videos.');
        setIsCollecting(false);
        return;
      }

      console.log(`✅ [Phase 7] Detected ${detectedVideos.length} videos, now fetching URLs...`);
      
      // Fetch video URLs for each detected video
      const videosWithUrls = await Promise.all(
        detectedVideos.map(async (video, index) => {
          try {
            console.log(`📥 [Phase 7] Fetching URL ${index + 1}/${detectedVideos.length} for shortcode: ${video.shortcode}`);
            const videoUrl = await fetchVideoUrl(video.shortcode);
            return {
              ...video,
              videoUrl,
              isLoading: false,
              error: undefined
            };
          } catch (error) {
            console.error(`❌ [Phase 7] Failed to fetch URL for ${video.shortcode}:`, error);
            return {
              ...video,
              videoUrl: null,
              isLoading: false,
              error: 'Failed to load video'
            };
          }
        })
      );

      // Filter out videos that failed to load
      const validVideos = videosWithUrls.filter(v => v.videoUrl !== null) as VideoData[];
      
      console.log(`✅ [Phase 7] Successfully loaded ${validVideos.length}/${detectedVideos.length} videos`);
      
      if (validVideos.length === 0) {
        alert('Failed to load video URLs. The videos may be private or unavailable.');
        setIsCollecting(false);
        return;
      }

      setVideos(validVideos);
      setShowPlayer(true);
    } catch (error) {
      console.error('❌ [Phase 7] Error in collection process:', error);
      alert('An error occurred while collecting videos. Check console for details.');
    } finally {
      setIsCollecting(false);
    }
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
        </div>
      </div>
    </div>
  );
};
