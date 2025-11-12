export interface VideoData {
  id: string;
  videoUrl: string;
  thumbnailUrl: string;
  username?: string;
  caption?: string;
  element: HTMLVideoElement;
}

export class VideoDetector {
  private videos: VideoData[] = [];
  private observer: MutationObserver | null = null;

  detectVideos(): VideoData[] {
    this.videos = [];
    
    // Find all video elements on the page
    const videoElements = document.querySelectorAll('video');
    
    videoElements.forEach((video, index) => {
      if (video.src || video.querySelector('source')?.src) {
        const videoUrl = video.src || video.querySelector('source')?.src || '';
        
        // Try to find thumbnail from poster or nearby img
        const thumbnailUrl = video.poster || 
          video.closest('article')?.querySelector('img')?.src || 
          '';

        // Try to extract username and caption
        const article = video.closest('article');
        const username = article?.querySelector('a[href*="/"]')?.textContent || undefined;
        const caption = article?.querySelector('[role="button"] span')?.textContent || undefined;

        this.videos.push({
          id: `video-${index}-${Date.now()}`,
          videoUrl,
          thumbnailUrl,
          username,
          caption,
          element: video
        });
      }
    });

    return this.videos;
  }

  startObserving(callback: (videos: VideoData[]) => void): void {
    this.observer = new MutationObserver(() => {
      const videos = this.detectVideos();
      if (videos.length > 0) {
        callback(videos);
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  stopObserving(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  getVideos(): VideoData[] {
    return this.videos;
  }

  scrollToLoadMore(): void {
    window.scrollTo({
      top: document.body.scrollHeight,
      behavior: 'smooth'
    });
  }

  async collectAllVideos(onProgress?: (count: number) => void): Promise<VideoData[]> {
    return new Promise((resolve) => {
      let previousCount = 0;
      let sameCountIterations = 0;
      const maxSameCount = 3;

      const checkInterval = setInterval(() => {
        const currentVideos = this.detectVideos();
        const currentCount = currentVideos.length;

        if (onProgress) {
          onProgress(currentCount);
        }

        if (currentCount === previousCount) {
          sameCountIterations++;
          if (sameCountIterations >= maxSameCount) {
            clearInterval(checkInterval);
            this.stopObserving();
            resolve(currentVideos);
          }
        } else {
          sameCountIterations = 0;
          previousCount = currentCount;
          this.scrollToLoadMore();
        }
      }, 1500);

      this.startObserving((videos) => {
        if (onProgress) {
          onProgress(videos.length);
        }
      });
    });
  }
}
