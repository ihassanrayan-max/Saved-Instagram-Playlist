import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  Shuffle, 
  Repeat, 
  Volume2, 
  VolumeX,
  X,
  List,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VideoData } from '@/utils/videoDetector';

interface VideoPlayerProps {
  videos: VideoData[];
  onClose: () => void;
}

export const VideoPlayer = ({ videos, onClose }: VideoPlayerProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isLoop, setIsLoop] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [progress, setProgress] = useState(0);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentVideo = videos[currentIndex];

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateProgress = () => {
      const progress = (video.currentTime / video.duration) * 100;
      setProgress(progress);
    };

    const handleEnded = () => {
      if (isLoop) {
        video.currentTime = 0;
        video.play();
      } else {
        playNext();
      }
    };

    video.addEventListener('timeupdate', updateProgress);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('timeupdate', updateProgress);
      video.removeEventListener('ended', handleEnded);
    };
  }, [isLoop, currentIndex]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
    }
  }, [volume]);

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const playNext = () => {
    if (isShuffle) {
      const randomIndex = Math.floor(Math.random() * videos.length);
      setCurrentIndex(randomIndex);
    } else {
      setCurrentIndex((prev) => (prev + 1) % videos.length);
    }
    setIsPlaying(true);
    setTimeout(() => videoRef.current?.play(), 100);
  };

  const playPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + videos.length) % videos.length);
    setIsPlaying(true);
    setTimeout(() => videoRef.current?.play(), 100);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleSeek = (value: number[]) => {
    if (videoRef.current) {
      const time = (value[0] / 100) * videoRef.current.duration;
      videoRef.current.currentTime = time;
      setProgress(value[0]);
    }
  };

  const playVideo = (index: number) => {
    setCurrentIndex(index);
    setIsPlaying(true);
    setShowPlaylist(false);
    setTimeout(() => videoRef.current?.play(), 100);
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-300"
    >
      <div className="relative w-full max-w-4xl mx-4">
        {/* Close Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="absolute -top-12 right-0 text-white hover:bg-white/10"
        >
          <X className="h-6 w-6" />
        </Button>

        {/* Video Container */}
        <div className="relative aspect-video bg-black rounded-lg overflow-hidden shadow-2xl">
          <video
            ref={videoRef}
            src={currentVideo?.videoUrl}
            className="w-full h-full object-contain"
            playsInline
            muted={isMuted}
          />

          {/* Controls Overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-6">
            {/* Progress Bar */}
            <Slider
              value={[progress]}
              onValueChange={handleSeek}
              max={100}
              step={0.1}
              className="mb-4"
            />

            {/* Control Buttons */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsShuffle(!isShuffle)}
                  className={cn(
                    "text-white hover:bg-white/10",
                    isShuffle && "text-primary"
                  )}
                >
                  <Shuffle className="h-5 w-5" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={playPrevious}
                  className="text-white hover:bg-white/10"
                >
                  <SkipBack className="h-5 w-5" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={togglePlayPause}
                  className="text-white hover:bg-white/10 h-12 w-12"
                >
                  {isPlaying ? (
                    <Pause className="h-6 w-6" />
                  ) : (
                    <Play className="h-6 w-6" />
                  )}
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={playNext}
                  className="text-white hover:bg-white/10"
                >
                  <SkipForward className="h-5 w-5" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsLoop(!isLoop)}
                  className={cn(
                    "text-white hover:bg-white/10",
                    isLoop && "text-primary"
                  )}
                >
                  <Repeat className="h-5 w-5" />
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsMuted(!isMuted)}
                  className="text-white hover:bg-white/10"
                >
                  {isMuted ? (
                    <VolumeX className="h-5 w-5" />
                  ) : (
                    <Volume2 className="h-5 w-5" />
                  )}
                </Button>

                <Slider
                  value={[volume * 100]}
                  onValueChange={(value) => setVolume(value[0] / 100)}
                  max={100}
                  className="w-20"
                />

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowPlaylist(!showPlaylist)}
                  className="text-white hover:bg-white/10"
                >
                  <List className="h-5 w-5" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleFullscreen}
                  className="text-white hover:bg-white/10"
                >
                  {isFullscreen ? (
                    <Minimize2 className="h-5 w-5" />
                  ) : (
                    <Maximize2 className="h-5 w-5" />
                  )}
                </Button>
              </div>
            </div>

            {/* Video Info */}
            <div className="mt-4 text-white">
              <p className="font-medium">{currentVideo?.username}</p>
              <p className="text-sm text-white/70 truncate">
                {currentVideo?.caption}
              </p>
            </div>
          </div>
        </div>

        {/* Playlist Sidebar */}
        {showPlaylist && (
          <div className="absolute right-0 top-0 bottom-0 w-80 bg-black/95 backdrop-blur-md rounded-r-lg overflow-hidden animate-in slide-in-from-right duration-300">
            <div className="p-4 border-b border-white/10">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-semibold">
                  Playlist ({videos.length})
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowPlaylist(false)}
                  className="text-white hover:bg-white/10"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="overflow-y-auto h-[calc(100%-60px)]">
              {videos.map((video, index) => (
                <button
                  key={video.id}
                  onClick={() => playVideo(index)}
                  className={cn(
                    "w-full p-3 flex items-center gap-3 hover:bg-white/5 transition-colors text-left",
                    currentIndex === index && "bg-primary/20"
                  )}
                >
                  <img
                    src={video.thumbnailUrl}
                    alt=""
                    className="w-16 h-16 object-cover rounded"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">
                      {video.username}
                    </p>
                    <p className="text-white/70 text-xs truncate">
                      {video.caption}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
