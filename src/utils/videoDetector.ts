// Phase 5: Updated VideoData interface
export interface VideoData {
  id: string;
  shortcode: string;
  postUrl: string;
  videoUrl: string | null;
  thumbnailUrl: string;
  username?: string;
  caption?: string;
  isLoading?: boolean;
  error?: string;
}

export class VideoDetector {
  private videos: VideoData[] = [];
  private observer: MutationObserver | null = null;

  // NEW: Extract videos via page context injection (bypasses CORS and detection issues)
  async extractViaPageContext(): Promise<VideoData[]> {
    console.log('🔮 [VideoDetector] Injecting page script to extract data...');
    
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        window.removeEventListener('message', messageHandler);
        console.warn('⚠️ [VideoDetector] Timeout waiting for page script response');
        resolve([]);
      }, 5000);

      // Listen for message from injected script
      const messageHandler = (event: MessageEvent) => {
        if (event.source !== window) return;
        
        if (event.data.type === 'INSTAGRAM_VIDEO_DATA') {
          clearTimeout(timeout);
          window.removeEventListener('message', messageHandler);
          
          if (event.data.error) {
            console.error('❌ [VideoDetector] Page script error:', event.data.error);
            resolve([]);
            return;
          }
          
          console.log(`✅ [VideoDetector] Received ${event.data.videos.length} videos from page script`);
          
          this.videos = event.data.videos.map((v: any, index: number) => ({
            id: `video-${index}-${Date.now()}`,
            shortcode: v.shortcode,
            postUrl: v.postUrl,
            videoUrl: v.videoUrl,
            thumbnailUrl: v.thumbnailUrl,
            username: v.username,
            caption: v.caption,
            isLoading: false,
            error: undefined
          }));
          
          resolve(this.videos);
        }
      };
      
      window.addEventListener('message', messageHandler);
      
      // Inject script via src (bypasses CSP)
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('inject-page-script.js');
      (document.head || document.documentElement).appendChild(script);
      script.onload = () => script.remove();
    });
  }

  // Phase 1-3: New detection methods (LEGACY - kept for reference)
  detectPostLinks(): Array<{ shortcode: string; postUrl: string; thumbnailUrl: string; isVideo: boolean }> {
    console.log('🔍 [Phase 1] Starting post link detection...');
    
    const posts: Array<{ shortcode: string; postUrl: string; thumbnailUrl: string; isVideo: boolean }> = [];
    
    // Find all links to posts (including reels)
    const postLinks = document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]');
    console.log(`📊 [Phase 1] Found ${postLinks.length} post links on page`);
    
    postLinks.forEach((link, index) => {
      const href = (link as HTMLAnchorElement).href;
      
      // Extract shortcode
      const shortcodeMatch = href.match(/\/(p|reel)\/([^\/\?]+)/);
      if (!shortcodeMatch) {
        console.log(`⚠️ [Phase 1] Could not extract shortcode from: ${href}`);
        return;
      }
      
      const shortcode = shortcodeMatch[2];
      console.log(`✅ [Phase 1] Extracted shortcode: ${shortcode}`);
      
      // Phase 2: Find thumbnail
      const img = link.querySelector('img');
      const thumbnailUrl = img?.src || img?.getAttribute('srcset')?.split(' ')[0] || '';
      console.log(`${thumbnailUrl ? '🖼️' : '⚠️'} [Phase 2] Thumbnail ${thumbnailUrl ? 'found' : 'missing'} for ${shortcode}`);
      
      // Phase 3: Determine if it's a video
      const isReel = href.includes('/reel/');
      const hasVideoIcon = link.querySelector('svg[aria-label*="Video"], svg[aria-label*="Reel"], [aria-label*="Video"], [aria-label*="Reel"]');
      const isVideo = isReel || !!hasVideoIcon;
      console.log(`${isVideo ? '🎥' : '📷'} [Phase 3] Post ${shortcode} is a ${isVideo ? 'VIDEO' : 'PHOTO'}`);
      
      posts.push({
        shortcode,
        postUrl: href,
        thumbnailUrl,
        isVideo
      });
    });
    
    const videoPosts = posts.filter(p => p.isVideo);
    console.log(`✅ [Phase 3] Detected ${videoPosts.length} video posts out of ${posts.length} total posts`);
    
    return posts;
  }

  detectVideos(): VideoData[] {
    console.log('🚀 [VideoDetector] Starting video detection...');
    this.videos = [];
    
    const posts = this.detectPostLinks();
    const videoPosts = posts.filter(p => p.isVideo);
    
    videoPosts.forEach((post, index) => {
      this.videos.push({
        id: `video-${index}-${Date.now()}`,
        shortcode: post.shortcode,
        postUrl: post.postUrl,
        videoUrl: null, // Will be fetched later
        thumbnailUrl: post.thumbnailUrl,
        username: undefined,
        caption: undefined,
        isLoading: true,
        error: undefined
      });
    });

    console.log(`📦 [VideoDetector] Created ${this.videos.length} video entries`);
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
