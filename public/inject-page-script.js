// ============= CLICK-BASED INSTAGRAM VIDEO COLLECTOR =============
(function() {
  if (window.__igClickCollectorInit) {
    return;
  }
  window.__igClickCollectorInit = true;
  
  let isCollecting = false;
  let collectedVideos = [];
  let postLinks = [];
  let currentIndex = 0;
  let collectionState = {
    status: 'idle', // 'idle' | 'scrolling' | 'collecting' | 'complete'
    totalPosts: 0,
    processedPosts: 0,
    videosFound: 0
  };
  
  // ============= CHROME STORAGE HELPERS =============
  
  async function saveToStorage(playlistItems) {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({ 
          instagram_playlist: playlistItems,
          lastUpdated: Date.now()
        });
      } else {
        // Fallback to sessionStorage if chrome.storage not available
        sessionStorage.setItem('instagram_playlist', JSON.stringify(playlistItems));
    }
  } catch (e) {
      console.error('❌ [Storage] Error saving playlist:', e);
    }
  }
  
  async function loadFromStorage() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const result = await chrome.storage.local.get(['instagram_playlist']);
        if (result.instagram_playlist) {
          collectedVideos = result.instagram_playlist;
          return collectedVideos;
        }
      } else {
        const stored = sessionStorage.getItem('instagram_playlist');
        if (stored) {
          collectedVideos = JSON.parse(stored);
          return collectedVideos;
        }
      }
    } catch (e) {
      console.error('❌ [Storage] Error loading playlist:', e);
    }
    return [];
  }
  
  // ============= SCROLL TO LOAD ALL POSTS =============
  
  async function scrollToLoadAll() {
    collectionState.status = 'scrolling';
    sendUpdate();
    
    const maxScrolls = 50; // Safety limit
    let scrollCount = 0;
    let lastHeight = 0;
    let lastLinkCount = 0;
    let noChangeCount = 0;
    let noLinkChangeCount = 0;
    
    return new Promise((resolve) => {
      const scrollInterval = setInterval(() => {
        const currentHeight = document.documentElement.scrollHeight;
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const clientHeight = document.documentElement.clientHeight;
        const isAtBottom = scrollTop + clientHeight >= currentHeight - 50; // 50px threshold for safety
        
        // Count current links to detect if new ones are still loading
        const currentLinks = document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]').length;
        
        // Scroll down
        window.scrollBy({
          top: window.innerHeight * 0.8,
          behavior: 'smooth'
        });
        
        scrollCount++;
        
        // Check if we've reached the bottom - need BOTH height stable AND at bottom position
        if (currentHeight === lastHeight && isAtBottom) {
          noChangeCount++;
          // Also check if link count is stable (new links might still be loading)
          if (currentLinks === lastLinkCount) {
            noLinkChangeCount++;
          } else {
            noLinkChangeCount = 0; // Reset if links are still appearing
          }
          
          // Only stop if height is stable, we're at bottom, AND link count is stable
          if (noChangeCount >= 5 && noLinkChangeCount >= 3) {
            clearInterval(scrollInterval);
            
            // Final verification: scroll to absolute bottom and wait for any final lazy-loaded content
            window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
            
            setTimeout(() => {
              // Check one more time if new links appeared after final scroll
              const finalLinks = document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]').length;
              const finalHeight = document.documentElement.scrollHeight;
              
              if (finalLinks > currentLinks || finalHeight > currentHeight) {
                // Continue scrolling - reset and restart
                lastLinkCount = finalLinks;
                lastHeight = finalHeight;
                noChangeCount = 0;
                noLinkChangeCount = 0;
                // Restart the interval
                const continueInterval = setInterval(() => {
                  const ch = document.documentElement.scrollHeight;
                  const st = window.pageYOffset || document.documentElement.scrollTop;
                  const ch2 = document.documentElement.clientHeight;
                  const atBottom = st + ch2 >= ch - 50;
                  const links = document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]').length;
                  
                  window.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' });
                  
                  if (ch === lastHeight && atBottom && links === lastLinkCount) {
                    noChangeCount++;
                    if (noChangeCount >= 5) {
                      clearInterval(continueInterval);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                      setTimeout(resolve, 1500);
                    }
                  } else {
                    noChangeCount = 0;
                    lastHeight = ch;
                    lastLinkCount = links;
                  }
                }, 800);
                
                // Safety timeout for continue interval
                setTimeout(() => {
                  clearInterval(continueInterval);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                  setTimeout(resolve, 1500);
                }, 30000);
                return;
              }
              
              // All done - scroll back to top
              window.scrollTo({ top: 0, behavior: 'smooth' });
              setTimeout(resolve, 1500);
            }, 2500); // Wait 2.5 seconds for final lazy-loaded content
            
            return;
          }
        } else {
          noChangeCount = 0;
          if (currentLinks !== lastLinkCount) {
            noLinkChangeCount = 0;
          }
        }
        
        if (scrollCount >= maxScrolls) {
          clearInterval(scrollInterval);
          // Still do final check before giving up
          window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
          setTimeout(() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            setTimeout(resolve, 1500);
          }, 2000);
      return;
    }
    
        lastHeight = currentHeight;
        lastLinkCount = currentLinks;
      }, 800);
    });
  }
  
  // ============= COLLECT ALL POST LINKS (PRESERVE ORDER) =============
  
  function collectPostLinks() {
    // First, scroll to top to ensure we start from the beginning
    window.scrollTo({ top: 0, behavior: 'instant' });
    
    // Wait a moment for DOM to settle, then collect links by scrolling through
    return new Promise((resolve) => {
      setTimeout(() => {
        // Collect links incrementally while scrolling (handles virtual scrolling)
        const allLinks = new Map(); // Use Map to preserve order and deduplicate
        let scrollPosition = 0;
        const scrollStep = window.innerHeight * 0.5; // Scroll half viewport at a time
        const maxScrolls = 200; // Safety limit
        let scrollCount = 0;
        let lastLinkCount = 0;
        let noNewLinksCount = 0;
        
        const collectInterval = setInterval(() => {
          // Collect links at current scroll position
          const links = document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]');
          
          links.forEach(link => {
            const href = link.href || link.getAttribute('href');
            if (href) {
              const match = href.match(/instagram\.com\/(p|reel)\/([^\/\?]+)/);
              if (match) {
                const shortcode = match[2];
                const postUrl = `https://www.instagram.com/p/${shortcode}/`;
                
                // Only add if we haven't seen this URL before
                if (!allLinks.has(postUrl)) {
                  // Get the link's position in the document for ordering
                  const rect = link.getBoundingClientRect();
                  const position = window.pageYOffset + rect.top;
                  
                  allLinks.set(postUrl, {
                    url: postUrl,
                    shortcode: shortcode,
                    thumbnail: link.querySelector('img')?.src || null,
                    position: position
                  });
                }
              }
            }
          });
          
          const currentLinkCount = allLinks.size;
          
          // Scroll down
          scrollPosition += scrollStep;
          window.scrollTo({
            top: scrollPosition,
            behavior: 'smooth'
          });
          
          scrollCount++;
          
          // Check if we've reached the bottom
          const currentHeight = document.documentElement.scrollHeight;
          const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
          const clientHeight = document.documentElement.clientHeight;
          const isAtBottom = scrollTop + clientHeight >= currentHeight - 50;
          
          // Check if we're getting new links
          if (currentLinkCount === lastLinkCount) {
            noNewLinksCount++;
          } else {
            noNewLinksCount = 0;
          }
          
          // Stop if at bottom and no new links for a few iterations
          if (isAtBottom && noNewLinksCount >= 5) {
            clearInterval(collectInterval);
            
            // Do one final scroll to absolute bottom and collect
            window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
            
            setTimeout(() => {
              // Final collection pass
              const finalLinks = document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]');
              finalLinks.forEach(link => {
                const href = link.href || link.getAttribute('href');
                if (href) {
                  const match = href.match(/instagram\.com\/(p|reel)\/([^\/\?]+)/);
                  if (match) {
                    const shortcode = match[2];
                    const postUrl = `https://www.instagram.com/p/${shortcode}/`;
                    
                    if (!allLinks.has(postUrl)) {
                      const rect = link.getBoundingClientRect();
                      const position = window.pageYOffset + rect.top;
                      
                      allLinks.set(postUrl, {
                        url: postUrl,
                        shortcode: shortcode,
                        thumbnail: link.querySelector('img')?.src || null,
                        position: position
                      });
                    }
                  }
                }
              });
              
              // Convert Map to array, sorted by position (top to bottom)
              const orderedLinks = Array.from(allLinks.values())
                .sort((a, b) => a.position - b.position)
                .map(item => ({
                  url: item.url,
                  shortcode: item.shortcode,
                  thumbnail: item.thumbnail
                }));
              
            postLinks = orderedLinks.map(item => item.url);
            collectionState.totalPosts = postLinks.length;
            sendUpdate();
              
              // Scroll back to top
              window.scrollTo({ top: 0, behavior: 'smooth' });
              
              resolve(postLinks);
            }, 2000);
            
            return;
          }
          
          if (scrollCount >= maxScrolls) {
            clearInterval(collectInterval);
            
            // Final collection
            const finalLinks = document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]');
            finalLinks.forEach(link => {
              const href = link.href || link.getAttribute('href');
              if (href) {
                const match = href.match(/instagram\.com\/(p|reel)\/([^\/\?]+)/);
                if (match) {
                  const shortcode = match[2];
                  const postUrl = `https://www.instagram.com/p/${shortcode}/`;
                  
                  if (!allLinks.has(postUrl)) {
                    const rect = link.getBoundingClientRect();
                    const position = window.pageYOffset + rect.top;
                    
                    allLinks.set(postUrl, {
                      url: postUrl,
                      shortcode: shortcode,
                      thumbnail: link.querySelector('img')?.src || null,
                      position: position
                    });
                  }
                }
              }
            });
            
            // Convert Map to array, sorted by position
            const orderedLinks = Array.from(allLinks.values())
              .sort((a, b) => a.position - b.position)
              .map(item => ({
                url: item.url,
                shortcode: item.shortcode,
                thumbnail: item.thumbnail
              }));
            
            postLinks = orderedLinks.map(item => item.url);
            collectionState.totalPosts = postLinks.length;
            sendUpdate();
            
            window.scrollTo({ top: 0, behavior: 'smooth' });
            resolve(postLinks);
            return;
          }
          
          lastLinkCount = currentLinkCount;
        }, 600); // Check every 600ms
      }, 500);
    });
  }
  
  // ============= VIDEO END DETECTION =============
  
  let videoEndObserver = null;
  let videoUnmuteInterval = null;
  
  // Track user intent for pause/mute
  const userIntent = {
    manuallyPaused: new WeakMap(),
    manuallyMuted: new WeakMap(),
    extensionControlling: new WeakMap(),
    lastUserAction: new WeakMap(),
    initialUnmuteDone: new WeakMap() // Track if we've done initial unmute
  };
  
  // Check if current URL is from playlist navigation
  function isPlaylistUrl() {
    const currentUrl = window.location.href;
    // Check if URL matches common Instagram post/reel patterns
    return currentUrl.includes('/p/') || currentUrl.includes('/reel/');
  }
  
  // Auto-unmute and autoplay function (respects user intent)
  function unmuteAndPlayVideo(video, force = false) {
    try {
      if (video && video.tagName === 'VIDEO') {
        const isManuallyMuted = userIntent.manuallyMuted.get(video);
        const isManuallyPaused = userIntent.manuallyPaused.get(video);
        const isExtensionControlling = userIntent.extensionControlling.get(video) || false;
        
        // Only unmute if user hasn't manually muted (unless forced)
        if (!isManuallyMuted || force) {
          video.muted = false;
          video.volume = 1.0;
          
          if (video.hasAttribute('muted')) {
            video.removeAttribute('muted');
          }
        }
        
        // Only autoplay if extension is controlling and user hasn't manually paused (unless forced)
        if ((isExtensionControlling && !isManuallyPaused) || force) {
          if (video.paused) {
            const playPromise = video.play();
            if (playPromise !== undefined) {
              playPromise.catch(() => {
                // Ignore play errors
              });
            }
          }
        }
      }
    } catch (e) {
      // Ignore errors
    }
  }
  
  function setupVideoEndDetection() {
    // Remove existing observer
    if (videoEndObserver) {
      videoEndObserver.disconnect();
      videoEndObserver = null;
    }
    
    // Clear existing interval
    if (videoUnmuteInterval) {
      clearInterval(videoUnmuteInterval);
      videoUnmuteInterval = null;
    }

    // Continuously monitor videos (but don't force unmute after initial)
    videoUnmuteInterval = setInterval(() => {
      const videos = document.querySelectorAll('video');
      videos.forEach(video => {
        const isManuallyPaused = userIntent.manuallyPaused.get(video);
        const isExtensionControlling = userIntent.extensionControlling.get(video) || false;
        
        // Don't auto-unmute here - only do initial unmute once
        // Respect user's manual mute/unmute after that
        
        // Only autoplay if extension is controlling and user hasn't manually paused
        if (video.paused && !isManuallyPaused && isExtensionControlling && video.readyState >= 2) {
          video.play().catch(() => {});
        }
      });
    }, 200);

    // Watch for video elements and listen for 'ended' event
    const checkForVideo = () => {
      const videos = document.querySelectorAll('video');
      videos.forEach(video => {
        // Only attach listener once
        if (!video.dataset.playlistListener) {
          video.dataset.playlistListener = 'true';
          
          // Initialize extension control state (start in passive mode)
          userIntent.extensionControlling.set(video, false);
          userIntent.manuallyPaused.set(video, false);
          userIntent.manuallyMuted.set(video, false);
          userIntent.initialUnmuteDone.set(video, false);
          
          // Check if this is a playlist URL - if so, do one-time auto-unmute
          if (isPlaylistUrl()) {
            // Mark that we'll do initial unmute when video is ready
            const doInitialUnmute = () => {
              const initialUnmuteDone = userIntent.initialUnmuteDone.get(video);
              if (!initialUnmuteDone && video.readyState >= 2) {
                // One-time auto-unmute
                video.muted = false;
                video.volume = 1.0;
                if (video.hasAttribute('muted')) {
                  video.removeAttribute('muted');
                }
                userIntent.initialUnmuteDone.set(video, true);
              }
            };
            
            // Try immediately if ready
            if (video.readyState >= 2) {
              doInitialUnmute();
            }
            
            // Also try when video can play
            video.addEventListener('canplay', doInitialUnmute, { once: true });
            video.addEventListener('loadeddata', doInitialUnmute, { once: true });
            video.addEventListener('loadedmetadata', doInitialUnmute, { once: true });
            
            // Fallback: try after a short delay
            setTimeout(doInitialUnmute, 500);
            setTimeout(doInitialUnmute, 1000);
          }
          
          // Detect user manual mute
          let lastMutedState = video.muted;
          const checkMuteChange = () => {
            const currentMuted = video.muted;
            const initialUnmuteDone = userIntent.initialUnmuteDone.get(video);
            
            // If muted state changed AFTER initial unmute, it's a user action
            if (initialUnmuteDone && currentMuted !== lastMutedState) {
              if (currentMuted) {
                // User manually muted
                userIntent.manuallyMuted.set(video, true);
              } else {
                // User manually unmuted
                userIntent.manuallyMuted.set(video, false);
              }
            }
            lastMutedState = currentMuted;
          };
          
          // Watch for mute changes via MutationObserver
          const muteObserver = new MutationObserver(checkMuteChange);
          muteObserver.observe(video, { attributes: true, attributeFilter: ['muted'] });
          
          // Also check periodically
          const muteCheckInterval = setInterval(checkMuteChange, 100);
          
          // Detect user manual pause/play - check if pause happened without extension control
          let lastPausedState = video.paused;
          const checkPauseChange = () => {
            const currentPaused = video.paused;
            const isExtensionControlling = userIntent.extensionControlling.get(video);
            
            // If paused and extension wasn't controlling, it's a user pause
            if (currentPaused && !lastPausedState && !isExtensionControlling) {
              // Check if tab is visible (not background pause)
              if (document.visibilityState === 'visible') {
                userIntent.manuallyPaused.set(video, true);
              }
            }
            lastPausedState = currentPaused;
          };
          
          // Check pause state periodically
          const pauseCheckInterval = setInterval(checkPauseChange, 100);
          
          // Detect user interactions with video or Instagram controls
          // User clicking video directly
          video.addEventListener('click', (e) => {
            const isExtensionControlling = userIntent.extensionControlling.get(video);
            if (!isExtensionControlling) {
              // User is interacting - check state after a short delay
              setTimeout(() => {
                if (video.paused) {
                  userIntent.manuallyPaused.set(video, true);
                } else {
                  userIntent.manuallyPaused.set(video, false);
                }
              }, 50);
            }
          }, { capture: true });
          
          // Detect clicks on Instagram's play/pause button (look for common selectors)
          const detectInstagramControlClick = (e) => {
            const target = e.target;
            // Instagram uses various button elements for controls
            if (target && (
              target.closest('button[aria-label*="Play"]') ||
              target.closest('button[aria-label*="Pause"]') ||
              target.closest('svg[aria-label*="Play"]') ||
              target.closest('svg[aria-label*="Pause"]') ||
              target.closest('[role="button"]')
            )) {
              const isExtensionControlling = userIntent.extensionControlling.get(video);
              if (!isExtensionControlling) {
                setTimeout(() => {
                  if (video.paused) {
                    userIntent.manuallyPaused.set(video, true);
                  } else {
                    userIntent.manuallyPaused.set(video, false);
                  }
                }, 50);
              }
            }
          };
          
          // Listen for clicks on document to catch Instagram control clicks
          document.addEventListener('click', detectInstagramControlClick, true);
          
          // Detect clicks on Instagram's mute/unmute button
          const detectMuteButtonClick = (e) => {
            const target = e.target;
            if (target && (
              target.closest('button[aria-label*="Mute"]') ||
              target.closest('button[aria-label*="Unmute"]') ||
              target.closest('svg[aria-label*="Mute"]') ||
              target.closest('svg[aria-label*="Unmute"]') ||
              target.closest('[aria-label*="volume"]')
            )) {
              const isExtensionControlling = userIntent.extensionControlling.get(video);
              if (!isExtensionControlling) {
                setTimeout(() => {
                  if (video.muted) {
                    userIntent.manuallyMuted.set(video, true);
                  } else {
                    userIntent.manuallyMuted.set(video, false);
                  }
                }, 50);
              }
            }
          };
          
          document.addEventListener('click', detectMuteButtonClick, true);
          
          // Also unmute when video can play (only if extension is controlling)
          video.addEventListener('canplay', () => {
            if (userIntent.extensionControlling.get(video)) {
              unmuteAndPlayVideo(video);
            }
          });
          
          video.addEventListener('loadeddata', () => {
            if (userIntent.extensionControlling.get(video)) {
              unmuteAndPlayVideo(video);
            }
          });
          
          video.addEventListener('loadedmetadata', () => {
            if (userIntent.extensionControlling.get(video)) {
              unmuteAndPlayVideo(video);
            }
          });
          
          // Unmute when video starts playing (only if extension is controlling)
          video.addEventListener('play', () => {
            const isExtensionControlling = userIntent.extensionControlling.get(video);
            if (isExtensionControlling) {
              unmuteAndPlayVideo(video);
            }
            // Always send state update to mini-player, regardless of who's controlling
            window.postMessage({
              type: 'INSTAGRAM_VIDEO_PLAYING',
              source: 'video_detector'
            }, '*');
          });
          
          // Detect pause - check if it was user-initiated or background pause
          video.addEventListener('pause', () => {
            const isExtensionControlling = userIntent.extensionControlling.get(video);
            // If extension wasn't controlling and tab is visible, this is a user pause
            if (!isExtensionControlling && document.visibilityState === 'visible') {
              userIntent.manuallyPaused.set(video, true);
            }
            // Always send state update to mini-player, regardless of who's controlling
    window.postMessage({
              type: 'INSTAGRAM_VIDEO_PAUSED',
              source: 'video_detector'
    }, '*');
          });
          
          // Handle visibility change (tab goes to background)
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
              // Tab went to background - Instagram will pause, don't mark as manual
              userIntent.manuallyPaused.set(video, false);
            } else {
              // Tab came back - if video is paused, might be user pause
              setTimeout(() => {
                if (video.paused && !userIntent.extensionControlling.get(video)) {
                  userIntent.manuallyPaused.set(video, true);
                }
              }, 500);
            }
          });
          
          // Only auto-unmute on timeupdate if extension is controlling and not manually muted
          video.addEventListener('timeupdate', () => {
            const isExtensionControlling = userIntent.extensionControlling.get(video);
            const isManuallyMuted = userIntent.manuallyMuted.get(video);
            // Only unmute if extension is actively controlling and user hasn't manually muted
            if (video.muted && isExtensionControlling && !isManuallyMuted) {
              video.muted = false;
              video.volume = 1.0;
              if (video.hasAttribute('muted')) {
                video.removeAttribute('muted');
              }
            }
          });
          
          // Listen for video end
          video.addEventListener('ended', () => {
    window.postMessage({
              type: 'INSTAGRAM_VIDEO_ENDED',
              source: 'video_detector'
    }, '*');
          });
          
          // Try to play when video becomes ready (only if extension is controlling)
          if (video.readyState >= 2 && userIntent.extensionControlling.get(video)) {
            unmuteAndPlayVideo(video);
          }
        }
      });
    };
    
    // Check immediately
    checkForVideo();
    
    // Watch for new video elements being added
    videoEndObserver = new MutationObserver(checkForVideo);
    videoEndObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
    
  }
  
  // Initialize video end detection
  if (document.body) {
    setupVideoEndDetection();
  } else {
    document.addEventListener('DOMContentLoaded', setupVideoEndDetection);
  }
  
  // ============= EXTRACT VIDEO FROM OPENED POST =============
  
  async function extractVideoFromPost() {
    return new Promise((resolve) => {
      let videoUrl = null;
      let thumbnail = null;
      let caption = '';
      let username = '';
      let shortcode = '';
      
      // Extract shortcode from URL
      const urlMatch = window.location.href.match(/\/(p|reel)\/([^\/\?]+)/);
      if (urlMatch) {
        shortcode = urlMatch[2];
      }
      
      // Helper to check if URL is valid (not blob, not empty)
      function isValidVideoUrl(url) {
        if (!url) return false;
        // Reject blob URLs - they're temporary
        if (url.startsWith('blob:')) return false;
        // Accept CDN URLs
        if (url.includes('cdninstagram.com') || url.includes('.mp4')) return true;
        // Accept other video URLs
        if (url.includes('video') || url.includes('instagram')) return true;
        return false;
      }
      
      // Method 1: Try to find video element and get actual source
      const videoElement = document.querySelector('video');
      if (videoElement) {
        // Try src first
        let src = videoElement.src || videoElement.currentSrc;
        
        // If it's a blob URL, try to find the actual source in data attributes or network
        if (src && src.startsWith('blob:')) {
          // Check for data attributes that might have the real URL
          const dataSrc = videoElement.getAttribute('data-src') || 
                         videoElement.getAttribute('data-video-url') ||
                         videoElement.getAttribute('src');
          
          if (dataSrc && !dataSrc.startsWith('blob:')) {
            src = dataSrc;
          } else {
            // Try to find source element
            const sourceEl = videoElement.querySelector('source');
            if (sourceEl) {
              src = sourceEl.src || sourceEl.getAttribute('src');
            }
          }
        }
        
        if (src && isValidVideoUrl(src)) {
          videoUrl = src;
        }
      }
      
      // Method 2: Try to find video in source tag
      if (!videoUrl) {
        const sourceElement = document.querySelector('video source');
        if (sourceElement) {
          const src = sourceElement.src || sourceElement.getAttribute('src');
          if (src && isValidVideoUrl(src)) {
            videoUrl = src;
          }
        }
      }
      
      // Method 3: Look in script tags or JSON data for video URLs
      if (!videoUrl) {
        try {
          // Check for JSON-LD or script tags with video data
          const scripts = document.querySelectorAll('script[type="application/ld+json"], script');
          for (const script of scripts) {
            try {
              const text = script.textContent || '';
              // Look for video URL patterns
              const videoUrlMatch = text.match(/"video_url":\s*"([^"]+)"/) ||
                                  text.match(/"contentUrl":\s*"([^"]+\.mp4[^"]*)"/) ||
                                  text.match(/https:\/\/[^"]*cdninstagram\.com[^"]*\.mp4[^"]*/);
              
              if (videoUrlMatch && isValidVideoUrl(videoUrlMatch[1])) {
                videoUrl = videoUrlMatch[1].replace(/\\u0026/g, '&');
                break;
              }
            } catch (e) {
              // Continue searching
            }
          }
        } catch (e) {
          // Ignore errors
        }
      }
      
      // Method 4: Wait a bit and check again (for lazy-loaded videos)
      if (!videoUrl) {
        setTimeout(() => {
          const videos = document.querySelectorAll('video');
          videos.forEach(video => {
            if (!videoUrl) {
              let src = video.src || video.currentSrc;
              
              // Skip blob URLs
              if (src && src.startsWith('blob:')) {
                const sourceEl = video.querySelector('source');
                if (sourceEl) {
                  src = sourceEl.src || sourceEl.getAttribute('src');
                }
              }
              
              if (src && isValidVideoUrl(src)) {
                videoUrl = src;
              }
            }
          });
        }, 2000);
      }
      
      // Extract thumbnail
      const img = document.querySelector('article img, img[src*="cdninstagram"]');
      if (img) {
        thumbnail = img.src || img.getAttribute('srcset')?.split(' ')[0];
      }
      
      // Extract caption
      const captionEl = document.querySelector('article span[dir="auto"], article h1 + div span');
      if (captionEl) {
        caption = captionEl.textContent || '';
      }
      
      // Extract username
      const usernameEl = document.querySelector('article header a, article a[href*="/"]');
      if (usernameEl) {
        username = usernameEl.textContent?.trim() || '';
      }
      
      // Wait a moment for video to load, but don't wait too long if we have a valid URL
      setTimeout(() => {
      const video = {
          shortcode: shortcode || `post-${Date.now()}`,
          videoUrl: videoUrl, // Will be null if we couldn't find a valid URL
        postUrl: `https://www.instagram.com/p/${shortcode}/`,
          thumbnail: thumbnail,
        thumbnailUrl: thumbnail,
          caption: caption.substring(0, 200), // Limit caption length
          username: username,
          timestamp: Date.now() / 1000,
        needsDash: false
      };
        
        
        resolve(video);
      }, videoUrl ? 500 : 2500); // Shorter wait if we already have URL
    });
  }
  
  // ============= CLOSE POST MODAL =============
  
  function closePostModal() {
    // Try multiple methods to close the modal
    const closeButton = document.querySelector('svg[aria-label="Close"], button[aria-label="Close"], [aria-label="Close"]');
    if (closeButton) {
      const btn = closeButton.closest('button') || closeButton;
      if (btn.click) {
        btn.click();
        return true;
      }
    }
    
    // Try ESC key
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
    
    // Try clicking outside modal (backdrop)
    const modal = document.querySelector('div[role="dialog"]');
    if (modal) {
      const backdrop = modal.parentElement;
      if (backdrop && backdrop !== modal) {
        backdrop.click();
        return true;
      }
    }
    
    return false;
  }
  
  // ============= CLICK AND EXTRACT FROM POST =============
  
  async function clickAndExtractPost(postUrl, index) {
    // Extract shortcode from URL for finding the link
    const shortcodeMatch = postUrl.match(/\/(p|reel)\/([^\/\?]+)/);
    const shortcode = shortcodeMatch ? shortcodeMatch[2] : null;
    
    if (!shortcode) {
      return null;
    }
    
    // Find the link element - try multiple selectors
    let link = null;
    
    // Method 1: Find by href containing shortcode
    const allLinks = Array.from(document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]'));
    link = allLinks.find(a => {
      const href = a.href || a.getAttribute('href') || '';
      return href.includes(shortcode);
    });
    
    // Method 2: If not found, try finding by data attributes or other methods
    if (!link) {
      // Scroll to make sure link is in view
      const testLink = document.querySelector(`a[href*="${shortcode}"]`);
      if (testLink) {
        testLink.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await new Promise(resolve => setTimeout(resolve, 500));
        link = testLink;
      }
    }
    
    if (!link) {
      return null;
    }
    
    // Scroll link into view
    link.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Click the link
    try {
      link.click();
    } catch (e) {
      // Try programmatic navigation
      window.location.href = postUrl;
    }
    
    // Wait for post to open
    await new Promise(resolve => setTimeout(resolve, 2500));
    
    // Check if we're on the post page or modal opened
    const isModal = document.querySelector('div[role="dialog"]') !== null;
    const isPostPage = window.location.href.includes('/p/') || window.location.href.includes('/reel/');
    
    if (!isModal && !isPostPage) {
      window.location.href = postUrl;
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    // Extract video
    const video = await extractVideoFromPost();
    
    // Close modal if opened
    if (isModal) {
      closePostModal();
      await new Promise(resolve => setTimeout(resolve, 800));
    } else if (isPostPage && window.history.length > 1) {
      // Navigate back
      window.history.back();
      await new Promise(resolve => setTimeout(resolve, 1500));
    } else {
      // If we navigated to post page, go back to collection
      const savedUrl = window.location.href.match(/instagram\.com\/saved/) 
        ? window.location.href 
        : 'https://www.instagram.com/saved/';
      window.location.href = savedUrl;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    return video;
  }
  
  // ============= MAIN COLLECTION PROCESS =============
  
  async function startClickCollection() {
    if (isCollecting) {
      stopCollection();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    isCollecting = true;
    collectionState.status = 'scrolling';
    collectionState.processedPosts = 0;
    collectionState.videosFound = 0;
    sendUpdate();
    
    try {
      // Step 1: Scroll to load all posts
      await scrollToLoadAll();
      
      // Step 2: Collect all post links (URLs in order) - now async to handle virtual scrolling
      const orderedLinks = await collectPostLinks();
      
      if (orderedLinks.length === 0) {
        throw new Error('No posts found on this page. Make sure you are on a saved collection page.');
      }
      
      // Step 3: Build playlist from URLs (no need to click through - just store URLs)
      collectionState.status = 'collecting';
      collectionState.processedPosts = orderedLinks.length;
      
      // Convert URLs to playlist items
      const playlistItems = orderedLinks.map((url, index) => {
        const shortcodeMatch = url.match(/\/(p|reel)\/([^\/\?]+)/);
        const shortcode = shortcodeMatch ? shortcodeMatch[2] : `post-${index}`;
        
        // Try to get thumbnail from the link element
        const linkElement = Array.from(document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]'))
          .find(link => (link.href || link.getAttribute('href') || '').includes(shortcode));
        const thumbnail = linkElement?.querySelector('img')?.src || null;
        
        return {
          url: url,
          shortcode: shortcode,
          thumbnail: thumbnail,
          username: '',
          caption: ''
        };
      });
      
      // Store playlist items
      collectedVideos = playlistItems;
      collectionState.videosFound = playlistItems.length;
      
      // Save to storage
      await saveToStorage(playlistItems);
      
      collectionState.status = 'complete';
      sendUpdate();
      
    } catch (error) {
      console.error('❌ [Collector] Error during collection:', error);
      collectionState.status = 'error';
      sendError(error.message);
    } finally {
      isCollecting = false;
    }
  }
  
  function stopCollection() {
    isCollecting = false;
    collectionState.status = 'idle';
      sendUpdate();
    }
  
  // ============= MESSAGE HANDLING =============
  
  function sendUpdate() {
    window.postMessage({
      type: 'CLICK_COLLECTOR_UPDATE',
      state: { ...collectionState },
      videos: collectedVideos,
      source: 'click_collector'
    }, '*');
  }
  
  function sendError(message) {
    window.postMessage({
      type: 'CLICK_COLLECTOR_ERROR',
      error: message,
      source: 'click_collector'
    }, '*');
  }
  
  // Load existing videos on init
  loadFromStorage().then(videos => {
    if (videos.length > 0) {
      collectedVideos = videos;
      sendUpdate();
    }
  });
  
  // Handle play/pause commands
  function handlePlayPause(command) {
    const videos = document.querySelectorAll('video');
    videos.forEach(video => {
      if (command === 'play') {
        // Play the video (don't need to set extensionControlling for basic play/pause)
        if (video.paused) {
          video.play().catch(() => {});
        }
      } else if (command === 'pause') {
        // Pause the video
        if (!video.paused) {
          video.pause();
        }
      }
    });
  }

  // Listen for messages
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    
    if (event.data.type === 'PLAYLIST_NAVIGATION') {
      // Extension navigated to a playlist URL
      // Videos on this page should get initial unmute
      const videos = document.querySelectorAll('video');
      videos.forEach(video => {
        if (!userIntent.initialUnmuteDone.get(video)) {
          // Do initial unmute
          const doInitialUnmute = () => {
            if (video.readyState >= 2) {
              video.muted = false;
              video.volume = 1.0;
              if (video.hasAttribute('muted')) {
                video.removeAttribute('muted');
              }
              userIntent.initialUnmuteDone.set(video, true);
            }
          };
          
          if (video.readyState >= 2) {
            doInitialUnmute();
          } else {
            video.addEventListener('canplay', doInitialUnmute, { once: true });
            video.addEventListener('loadeddata', doInitialUnmute, { once: true });
            setTimeout(doInitialUnmute, 500);
            setTimeout(doInitialUnmute, 1000);
          }
        }
      });
    } else if (event.data.type === 'START_CLICK_COLLECTION') {
      startClickCollection();
    } else if (event.data.type === 'STOP_CLICK_COLLECTION') {
      stopCollection();
    } else if (event.data.type === 'CLEAR_STORAGE') {
      collectedVideos = [];
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.remove(['instagram_playlist']);
      }
      sessionStorage.removeItem('instagram_playlist');
      sendUpdate();
    } else if (event.data.type === 'LOAD_STORED_PLAYLIST') {
      loadFromStorage().then(items => {
        collectedVideos = items;
        sendUpdate();
      });
    } else if (event.data.type === 'PLAYLIST_PLAY') {
      handlePlayPause('play');
    } else if (event.data.type === 'PLAYLIST_PAUSE') {
      handlePlayPause('pause');
    }
  });
  
  // Send ready message
  window.postMessage({
    type: 'CLICK_COLLECTOR_READY',
    source: 'click_collector'
  }, '*');
  
  
})();
