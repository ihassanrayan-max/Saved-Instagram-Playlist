// ============= BULLETPROOF INSTAGRAM VIDEO COLLECTOR =============
// Intercepts ALL JSON responses, deep-searches for video data, auto-scrolls, and provides robust fallbacks
(function() {
  console.log('🚀 [Collector] Starting comprehensive Instagram video collection...');
  
  let collectedVideos = [];
  let isCollecting = false;
  let collectionStartTime = 0;
  const MAX_COLLECTION_TIME = 30000; // 30 seconds
  const SCROLL_INTERVAL = 500;
  const SCROLL_DURATION = 15000;
  
  // ============= PERSISTENCE =============
  // Load previously collected videos from session storage
  try {
    const stored = sessionStorage.getItem('instagram_collected_videos');
    if (stored) {
      collectedVideos = JSON.parse(stored);
      console.log(`📦 [Persistence] Loaded ${collectedVideos.length} videos from cache`);
    }
  } catch (e) {
    console.log('⚠️ [Persistence] Could not load cached videos:', e);
  }
  
  function persistVideos() {
    try {
      sessionStorage.setItem('instagram_collected_videos', JSON.stringify(collectedVideos));
    } catch (e) {
      console.log('⚠️ [Persistence] Could not cache videos:', e);
    }
  }
  
  // ============= NETWORK INTERCEPTION (ALL JSON RESPONSES) =============
  
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const response = await originalFetch.apply(this, args);
    const clonedResponse = response.clone();
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
    
    // Process ALL responses with JSON content-type
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        const data = await clonedResponse.json();
        const urlShort = url.length > 80 ? url.substring(0, 80) + '...' : url;
        console.log(`🌐 [Intercept] Fetch: ${urlShort}`);
        processResponse(data, url);
      } catch (e) {
        // Silently skip non-JSON or empty responses
      }
    }
    
    return response;
  };
  
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._url = url;
    this._method = method;
    return originalOpen.apply(this, [method, url, ...rest]);
  };
  
  XMLHttpRequest.prototype.send = function(...args) {
    this.addEventListener('load', function() {
      const contentType = this.getResponseHeader('content-type') || '';
      if (contentType.includes('application/json')) {
        try {
          const data = JSON.parse(this.responseText);
          const urlShort = this._url.length > 80 ? this._url.substring(0, 80) + '...' : this._url;
          console.log(`🌐 [Intercept] XHR: ${urlShort}`);
          processResponse(data, this._url);
        } catch (e) {
          // Silently skip non-JSON or empty responses
        }
      }
    });
    return originalSend.apply(this, args);
  };
  
  // ============= RESPONSE PROCESSOR (DEEP EXTRACTION) =============
  
  function processResponse(data, url) {
    if (!isCollecting) return;
    
    try {
      const videos = [];
      
      // Method 1: Standard GraphQL edges patterns
      const edgesPaths = [
        'data.user.edge_saved_media.edges',
        'data.user.edge_owner_to_timeline_media.edges',
        'data.xdt_api__v1__feed__user_timeline_graphql_connection.edges',
        'data.xdt_api__v1__clips__user__connection.edges'
      ];
      
      edgesPaths.forEach(path => {
        const edges = getNestedValue(data, path);
        if (Array.isArray(edges) && edges.length > 0) {
          console.log(`✅ [Extract] Found ${edges.length} edges at ${path}`);
          videos.push(...extractVideosFromEdges(edges));
        }
      });
      
      // Method 2: Direct items arrays (mobile API style)
      const itemsPaths = [
        'data.items',
        'items',
        'data.reels_media',
        'reels_media',
        'data.user.edge_felix_video_timeline.edges',
        'data.xdt_api__v1__media__shortcode__web_info.items'
      ];
      
      itemsPaths.forEach(path => {
        const items = getNestedValue(data, path);
        if (Array.isArray(items) && items.length > 0) {
          console.log(`✅ [Extract] Found ${items.length} items at ${path}`);
          items.forEach(item => {
            const video = extractVideoFromItem(item);
            if (video) videos.push(video);
          });
        }
      });
      
      // Method 3: Deep recursive search for any video-like structures
      const foundVideos = deepSearchForVideos(data);
      if (foundVideos.length > 0) {
        console.log(`✅ [Extract] Deep search found ${foundVideos.length} videos`);
        videos.push(...foundVideos);
      }
      
      // Deduplicate and add to collection
      if (videos.length > 0) {
        let newCount = 0;
        videos.forEach(video => {
          if (!collectedVideos.some(v => v.shortcode === video.shortcode)) {
            collectedVideos.push(video);
            newCount++;
          }
        });
        
        if (newCount > 0) {
          console.log(`🎉 [Collector] Added ${newCount} new videos (total: ${collectedVideos.length})`);
          persistVideos();
          sendUpdate();
        }
      }
    } catch (error) {
      console.error('❌ [Processor] Error processing response:', error);
    }
  }
  
  // ============= VIDEO EXTRACTION FUNCTIONS =============
  
  function extractVideosFromEdges(edges) {
    const videos = [];
    edges.forEach(edge => {
      const node = edge.node || edge;
      const video = extractVideoFromItem(node);
      if (video) videos.push(video);
    });
    return videos;
  }
  
  function extractVideoFromItem(item) {
    try {
      // Check if this is actually a video
      const isVideo = item.__typename === 'GraphVideo' || 
                      item.__typename === 'XDTGraphVideo' ||
                      item.__typename === 'XDTMediaVideo' ||
                      item.is_video === true ||
                      item.media_type === 2 ||
                      item.product_type === 'clips' ||
                      item.product_type === 'igtv' ||
                      !!item.video_url ||
                      !!item.video_versions ||
                      !!item.video_resources ||
                      !!item.dash_info;
      
      if (!isVideo) return null;
      
      // Extract shortcode (required)
      const shortcode = item.shortcode || item.code || item.pk || item.id;
      if (!shortcode) return null;
      
      // Extract video URL (try multiple patterns)
      let videoUrl = null;
      let needsDash = false;
      
      // Pattern 1: Direct video_url
      if (item.video_url) {
        videoUrl = item.video_url;
      }
      // Pattern 2: video_versions array (mobile)
      else if (Array.isArray(item.video_versions) && item.video_versions.length > 0) {
        videoUrl = item.video_versions[0].url;
      }
      // Pattern 3: video_resources array (web)
      else if (Array.isArray(item.video_resources) && item.video_resources.length > 0) {
        videoUrl = item.video_resources[item.video_resources.length - 1].src;
      }
      // Pattern 4: playback_url (streaming)
      else if (item.playback_url) {
        videoUrl = item.playback_url;
      }
      // Pattern 5: DASH manifest (needs special handling)
      else if (item.dash_info?.video_dash_manifest || item.video_dash_manifest) {
        needsDash = true;
        videoUrl = null; // Will use fallback
      }
      
      // Extract thumbnail
      const thumbnail = item.display_url || 
                        item.thumbnail_url ||
                        item.image_versions2?.candidates?.[0]?.url ||
                        item.thumbnail_resources?.[0]?.src ||
                        null;
      
      // Extract caption
      const caption = item.edge_media_to_caption?.edges?.[0]?.node?.text ||
                      item.caption?.text ||
                      item.title ||
                      '';
      
      // Extract username
      const username = item.owner?.username || 
                       item.user?.username ||
                       item.username ||
                       '';
      
      const video = {
        shortcode: String(shortcode),
        videoUrl,
        postUrl: `https://www.instagram.com/p/${shortcode}/`,
        thumbnail,
        thumbnailUrl: thumbnail,
        caption,
        username,
        timestamp: item.taken_at_timestamp || item.taken_at || Date.now() / 1000,
        needsDash
      };
      
      console.log(`📹 [Extract] Video: ${shortcode} | URL: ${videoUrl ? '✅' : needsDash ? '⚠️ DASH' : '❌'}`);
      return video;
    } catch (error) {
      console.error('❌ [Extract] Error:', error);
      return null;
    }
  }
  
  function deepSearchForVideos(obj, depth = 0, maxDepth = 8) {
    if (depth > maxDepth || !obj || typeof obj !== 'object') {
      return [];
    }
    
    const results = [];
    
    // Check if this object looks like a video item
    if (obj.shortcode && (obj.is_video || obj.video_url || obj.video_versions)) {
      const video = extractVideoFromItem(obj);
      if (video) results.push(video);
    }
    
    // Check if this is an edges array
    if (Array.isArray(obj.edges)) {
      results.push(...extractVideosFromEdges(obj.edges));
    }
    
    // Recursively search nested objects and arrays
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];
        if (typeof value === 'object' && value !== null) {
          results.push(...deepSearchForVideos(value, depth + 1, maxDepth));
        }
      }
    }
    
    return results;
  }
  
  // ============= HELPER FUNCTIONS =============
  
  function getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
  
  function sendUpdate() {
    window.postMessage({
      type: 'INSTAGRAM_VIDEOS_FOUND',
      videos: collectedVideos,
      source: 'comprehensive_collector'
    }, '*');
  }
  
  function sendError(message, suggestions) {
    window.postMessage({
      type: 'INSTAGRAM_VIDEOS_ERROR',
      error: message,
      suggestions: suggestions || []
    }, '*');
  }
  
  // ============= AUTO-SCROLL TO TRIGGER LOADS =============
  
  function autoScroll() {
    console.log('📜 [Scroll] Starting auto-scroll to trigger content loads...');
    
    let scrollCount = 0;
    const maxScrolls = Math.floor(SCROLL_DURATION / SCROLL_INTERVAL);
    
    const scrollInterval = setInterval(() => {
      scrollCount++;
      
      // Smooth scroll down
      window.scrollBy({
        top: window.innerHeight * 0.8,
        behavior: 'smooth'
      });
      
      if (scrollCount >= maxScrolls) {
        clearInterval(scrollInterval);
        console.log('✅ [Scroll] Auto-scroll complete');
        
        // Scroll back to top
        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      }
    }, SCROLL_INTERVAL);
  }
  
  // ============= COLLECTION LIFECYCLE =============
  
  function startCollection() {
    console.log('🎬 [Collector] Starting collection process...');
    isCollecting = true;
    collectionStartTime = Date.now();
    
    // Start auto-scroll to trigger Instagram to load more content
    autoScroll();
    
    // Send initial update if we have cached videos
    if (collectedVideos.length > 0) {
      sendUpdate();
    }
    
    // Set timeout to stop collection
    setTimeout(() => {
      stopCollection();
    }, MAX_COLLECTION_TIME);
  }
  
  function stopCollection() {
    console.log('🏁 [Collector] Stopping collection...');
    isCollecting = false;
    
    if (collectedVideos.length === 0) {
      sendError(
        'No videos found in this collection.',
        [
          'Make sure you\'re on a saved collection page with video posts',
          'Try scrolling manually to load more content',
          'Some videos may use DASH streaming (not yet supported)',
          'Try refreshing the page and enabling the playlist again'
        ]
      );
    } else {
      console.log(`✅ [Collector] Collection complete: ${collectedVideos.length} videos found`);
      sendUpdate();
    }
  }
  
  // ============= FALLBACK: CHECK STATIC DATA =============
  
  function checkStaticData() {
    console.log('🔍 [Fallback] Checking window._sharedData...');
    
    try {
      if (window._sharedData) {
        const entryData = window._sharedData.entry_data;
        
        if (entryData) {
          const pageTypes = ['ProfilePage', 'PostPage', 'UserPage', 'SavedCollectionsPage'];
          
          pageTypes.forEach(pageType => {
            const pages = entryData[pageType];
            if (Array.isArray(pages)) {
              pages.forEach(page => {
                processResponse(page, 'static_data');
              });
            }
          });
        }
      }
    } catch (error) {
      console.log('⚠️ [Fallback] Error checking static data:', error);
    }
  }
  
  // ============= INITIALIZATION =============
  
  console.log('✅ [Collector] Network interception active. Waiting for collection trigger...');
  
  // Check static data after delay
  setTimeout(() => {
    checkStaticData();
  }, 2000);
  
  // Listen for collection start message
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    
    if (event.data.type === 'START_COLLECTION') {
      startCollection();
    } else if (event.data.type === 'STOP_COLLECTION') {
      stopCollection();
    } else if (event.data.type === 'CLEAR_CACHE') {
      collectedVideos = [];
      sessionStorage.removeItem('instagram_collected_videos');
      console.log('🗑️ [Persistence] Cache cleared');
    }
  });
  
  // Auto-start collection after a short delay
  setTimeout(() => {
    startCollection();
  }, 1000);
  
})();
