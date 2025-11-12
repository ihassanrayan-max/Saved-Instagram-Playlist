import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Loader2 } from 'lucide-react';
import { VideoPlayer } from './VideoPlayer';
import { VideoDetector } from '@/utils/videoDetector';
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

  const handleEnable = async () => {
    setIsCollecting(true);
    const detector = new VideoDetector();

    try {
      const collectedVideos = await detector.collectAllVideos((count) => {
        setVideoCount(count);
      });

      setVideos(collectedVideos);
      setShowPlayer(true);
    } catch (error) {
      console.error('Error collecting videos:', error);
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
