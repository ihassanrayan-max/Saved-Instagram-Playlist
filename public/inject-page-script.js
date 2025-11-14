// This file runs in Instagram's page context (bypasses CSP)
(function() {
  console.log('🔮 [Page Script] Starting GraphQL network interception...');
  
  let collectedVideos = [];
  
  // ============= NETWORK INTERCEPTION =============
  
  // Intercept Fetch API
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const response = await originalFetch.apply(this, args);
    
    // Clone response so we can read it without consuming it
    const clonedResponse = response.clone();
    const url = args[0];
    
    // Check if this is an Instagram GraphQL request
    if (typeof url === 'string' && url.includes('/graphql/query')) {
      try {
        const data = await clonedResponse.json();
        console.log('📡 [Network] GraphQL response intercepted:', url);
        processGraphQLResponse(data);
      } catch (e) {
        console.log('⚠️ [Network] Could not parse GraphQL response:', e);
      }
    }
    
    return response;
  };
  
  // Intercept XMLHttpRequest
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._url = url;
    return originalOpen.apply(this, [method, url, ...rest]);
  };
  
  XMLHttpRequest.prototype.send = function(...args) {
    if (this._url && this._url.includes('/graphql/query')) {
      this.addEventListener('load', function() {
        try {
          const data = JSON.parse(this.responseText);
          console.log('📡 [Network] XHR GraphQL response intercepted:', this._url);
          processGraphQLResponse(data);
        } catch (e) {
          console.log('⚠️ [Network] Could not parse XHR response:', e);
        }
      });
    }
    return originalSend.apply(this, args);
  };
  
  // ============= GRAPHQL RESPONSE PROCESSOR =============
  
  function processGraphQLResponse(data) {
    try {
      // Instagram GraphQL responses can have various structures
      // Let's search for video data in common locations
      
      const videos = [];
      
      // Method 1: Check data.user.edge_saved_media.edges
      if (data?.data?.user?.edge_saved_media?.edges) {
        console.log('✅ [GraphQL] Found edge_saved_media with', data.data.user.edge_saved_media.edges.length, 'items');
        videos.push(...extractVideosFromEdges(data.data.user.edge_saved_media.edges));
      }
      
      // Method 2: Check data.user.edge_owner_to_timeline_media.edges
      if (data?.data?.user?.edge_owner_to_timeline_media?.edges) {
        console.log('✅ [GraphQL] Found edge_owner_to_timeline_media with', data.data.user.edge_owner_to_timeline_media.edges.length, 'items');
        videos.push(...extractVideosFromEdges(data.data.user.edge_owner_to_timeline_media.edges));
      }
      
      // Method 3: Check xdt_api__v1__feed__user_timeline_graphql_connection
      if (data?.data?.xdt_api__v1__feed__user_timeline_graphql_connection?.edges) {
        console.log('✅ [GraphQL] Found xdt_api timeline with', data.data.xdt_api__v1__feed__user_timeline_graphql_connection.edges.length, 'items');
        videos.push(...extractVideosFromEdges(data.data.xdt_api__v1__feed__user_timeline_graphql_connection.edges));
      }
      
      // Method 4: Check data.xdt_api__v1__media__shortcode__web_info
      if (data?.data?.xdt_api__v1__media__shortcode__web_info) {
        console.log('✅ [GraphQL] Found xdt_api media info');
        const item = data.data.xdt_api__v1__media__shortcode__web_info.items?.[0];
        if (item) {
          const video = extractVideoFromItem(item);
          if (video) videos.push(video);
        }
      }
      
      // Method 5: Deep search for any edges array with video data
      const foundEdges = deepSearchForEdges(data);
      if (foundEdges.length > 0) {
        console.log('✅ [GraphQL] Found edges via deep search:', foundEdges.length);
        videos.push(...extractVideosFromEdges(foundEdges));
      }
      
      if (videos.length > 0) {
        console.log(`🎉 [GraphQL] Extracted ${videos.length} videos from response`);
        
        // Add to collection and deduplicate
        videos.forEach(video => {
          if (!collectedVideos.some(v => v.shortcode === video.shortcode)) {
            collectedVideos.push(video);
          }
        });
        
        // Send update to content script
        window.postMessage({
          type: 'INSTAGRAM_VIDEOS_FOUND',
          videos: collectedVideos,
          source: 'graphql_interception'
        }, '*');
        
        console.log(`📊 [GraphQL] Total unique videos collected: ${collectedVideos.length}`);
      }
    } catch (error) {
      console.error('❌ [GraphQL] Error processing response:', error);
    }
  }
  
  // ============= VIDEO EXTRACTION FUNCTIONS =============
  
  function extractVideosFromEdges(edges) {
    const videos = [];
    
    edges.forEach(edge => {
      const node = edge.node;
      if (!node) return;
      
      // Check if this is a video
      const isVideo = node.__typename === 'GraphVideo' || 
                      node.__typename === 'XDTGraphVideo' ||
                      node.is_video === true ||
                      node.media_type === 2;
      
      if (isVideo) {
        const video = extractVideoFromItem(node);
        if (video) videos.push(video);
      }
    });
    
    return videos;
  }
  
  function extractVideoFromItem(item) {
    try {
      // Extract shortcode
      const shortcode = item.shortcode || item.code || item.id;
      if (!shortcode) return null;
      
      // Extract video URL
      const videoUrl = item.video_url || 
                       item.video_versions?.[0]?.url ||
                       null;
      
      // Extract thumbnail
      const thumbnail = item.display_url || 
                        item.thumbnail_url ||
                        item.image_versions2?.candidates?.[0]?.url ||
                        null;
      
      // Extract caption
      const caption = item.edge_media_to_caption?.edges?.[0]?.node?.text ||
                      item.caption?.text ||
                      '';
      
      console.log(`📹 [Extract] Found video: ${shortcode}`);
      
      return {
        shortcode,
        videoUrl,
        postUrl: `https://www.instagram.com/p/${shortcode}/`,
        thumbnail,
        caption,
        username: item.owner?.username || '',
        timestamp: item.taken_at_timestamp || Date.now() / 1000
      };
    } catch (error) {
      console.error('❌ [Extract] Error extracting video:', error);
      return null;
    }
  }
  
  function deepSearchForEdges(obj, depth = 0, maxDepth = 10) {
    if (depth > maxDepth || !obj || typeof obj !== 'object') {
      return [];
    }
    
    let results = [];
    
    // If this object has an edges array, check it
    if (Array.isArray(obj.edges)) {
      results = [...obj.edges];
    }
    
    // Recursively search nested objects
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];
        if (typeof value === 'object' && value !== null) {
          results = results.concat(deepSearchForEdges(value, depth + 1, maxDepth));
        }
      }
    }
    
    return results;
  }
  
  // ============= FALLBACK: STATIC DATA CHECK =============
  
  // Also check for any initial data that might be in window
  setTimeout(() => {
    console.log('🔍 [Fallback] Checking for static data in window object...');
    
    // Check window._sharedData
    if (window._sharedData?.entry_data) {
      console.log('📋 [Fallback] Found _sharedData.entry_data');
      const entryData = window._sharedData.entry_data;
      
      ['ProfilePage', 'CollectionPage', 'SavedPage', 'PostPage'].forEach(pageType => {
        if (entryData[pageType]?.[0]?.graphql) {
          console.log(`✅ [Fallback] Checking ${pageType}...`);
          const graphql = entryData[pageType][0].graphql;
          
          // Look for edges in various locations
          const possiblePaths = [
            graphql?.user?.edge_saved_media?.edges,
            graphql?.user?.edge_owner_to_timeline_media?.edges,
            graphql?.shortcode_media && [{ node: graphql.shortcode_media }],
            graphql?.edges
          ];
          
          possiblePaths.forEach(edges => {
            if (edges && edges.length > 0) {
              const videos = extractVideosFromEdges(edges);
              if (videos.length > 0) {
                console.log(`🎉 [Fallback] Found ${videos.length} videos in ${pageType}`);
                videos.forEach(video => {
                  if (!collectedVideos.some(v => v.shortcode === video.shortcode)) {
                    collectedVideos.push(video);
                  }
                });
              }
            }
          });
        }
      });
    }
    
    // Send final results
    if (collectedVideos.length > 0) {
      window.postMessage({
        type: 'INSTAGRAM_VIDEOS_FOUND',
        videos: collectedVideos,
        source: 'static_data_check'
      }, '*');
      console.log(`✅ [Complete] Total videos collected: ${collectedVideos.length}`);
    } else {
      window.postMessage({
        type: 'INSTAGRAM_VIDEOS_ERROR',
        error: 'No videos found. Try scrolling or refreshing the page.'
      }, '*');
      console.log('⚠️ [Complete] No videos found in any source');
    }
  }, 2000);
  
  console.log('✅ [Page Script] Network interception active. Waiting for Instagram to load data...');
  
})();
