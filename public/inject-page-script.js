// This file runs in Instagram's page context (bypasses CSP)
(function() {
  console.log('🔮 [Page Script] Extracting data from Instagram page context...');
  
  try {
    // Log all window properties that might contain Instagram data
    console.log('🔍 [Page Script] Scanning window object for Instagram data...');
    const windowKeys = Object.keys(window).filter(key => 
      key.includes('shared') || 
      key.includes('initial') || 
      key.includes('additional') ||
      key.includes('data') ||
      key.includes('Data') ||
      key.startsWith('__')
    );
    console.log('📋 [Page Script] Relevant window properties:', windowKeys);
    
    let videos = [];
    let dataSource = null;
    
    // Method 1: Check window._sharedData
    if (window._sharedData) {
      console.log('✅ [Page Script] Found window._sharedData');
      console.log('📊 [Page Script] _sharedData keys:', Object.keys(window._sharedData));
      
      if (window._sharedData.entry_data) {
        console.log('📊 [Page Script] entry_data keys:', Object.keys(window._sharedData.entry_data));
        
        const entryData = window._sharedData.entry_data;
        let savedPosts = null;
        
        if (entryData.ProfilePage?.[0]?.graphql?.user?.edge_saved_media?.edges) {
          savedPosts = entryData.ProfilePage[0].graphql.user.edge_saved_media.edges;
          dataSource = 'window._sharedData.entry_data.ProfilePage';
        } else if (entryData.CollectionPage?.[0]?.graphql?.edges) {
          savedPosts = entryData.CollectionPage[0].graphql.edges;
          dataSource = 'window._sharedData.entry_data.CollectionPage';
        } else if (entryData.SavedPage?.[0]?.graphql?.user?.edge_saved_media?.edges) {
          savedPosts = entryData.SavedPage[0].graphql.user.edge_saved_media.edges;
          dataSource = 'window._sharedData.entry_data.SavedPage';
        }
        
        if (savedPosts && savedPosts.length > 0) {
          videos = extractVideosFromPosts(savedPosts);
          console.log(`✅ [Page Script] Found ${videos.length} videos in ${dataSource}`);
        }
      }
    }
    
    // Method 2: Check window.__additionalDataLoaded
    if (videos.length === 0 && window.__additionalDataLoaded) {
      console.log('✅ [Page Script] Found window.__additionalDataLoaded');
      console.log('📊 [Page Script] __additionalDataLoaded keys:', Object.keys(window.__additionalDataLoaded));
      
      Object.keys(window.__additionalDataLoaded).forEach(key => {
        const data = window.__additionalDataLoaded[key];
        if (data?.data?.user?.edge_saved_media?.edges) {
          videos = extractVideosFromPosts(data.data.user.edge_saved_media.edges);
          dataSource = `window.__additionalDataLoaded.${key}`;
          console.log(`✅ [Page Script] Found ${videos.length} videos in ${dataSource}`);
        }
      });
    }
    
    // Method 3: Check window.__initialData
    if (videos.length === 0 && window.__initialData) {
      console.log('✅ [Page Script] Found window.__initialData');
      console.log('📊 [Page Script] __initialData keys:', Object.keys(window.__initialData));
      
      const initialData = window.__initialData;
      if (initialData?.data?.user?.edge_saved_media?.edges) {
        videos = extractVideosFromPosts(initialData.data.user.edge_saved_media.edges);
        dataSource = 'window.__initialData';
        console.log(`✅ [Page Script] Found ${videos.length} videos in ${dataSource}`);
      }
    }
    
    // Method 4: Search React Fiber tree
    if (videos.length === 0) {
      console.log('🔍 [Page Script] Searching React Fiber tree...');
      const reactRoot = document.querySelector('[data-reactroot]') || document.querySelector('#react-root') || document.body;
      
      if (reactRoot) {
        const fiberKey = Object.keys(reactRoot).find(key => key.startsWith('__reactFiber') || key.startsWith('__reactInternalInstance'));
        
        if (fiberKey) {
          console.log('✅ [Page Script] Found React Fiber');
          const fiber = reactRoot[fiberKey];
          const posts = searchFiberForSavedPosts(fiber);
          
          if (posts && posts.length > 0) {
            videos = extractVideosFromPosts(posts);
            dataSource = 'React Fiber tree';
            console.log(`✅ [Page Script] Found ${videos.length} videos in ${dataSource}`);
          }
        }
      }
    }
    
    // Method 5: Log all window properties with 'data' or graph-like structures
    if (videos.length === 0) {
      console.log('🔍 [Page Script] Checking for other data structures...');
      windowKeys.forEach(key => {
        const value = window[key];
        if (value && typeof value === 'object') {
          console.log(`📊 [Page Script] window.${key} structure:`, {
            type: typeof value,
            keys: Object.keys(value).slice(0, 10),
            hasData: 'data' in value,
            hasGraphql: 'graphql' in value,
            hasEdges: searchForEdges(value)
          });
        }
      });
    }
    
    // Send results
    if (videos.length > 0) {
      console.log(`✅ [Page Script] Successfully extracted ${videos.length} videos from ${dataSource}`);
      window.postMessage({
        type: 'INSTAGRAM_VIDEO_DATA',
        videos: videos,
        source: dataSource
      }, '*');
    } else {
      console.warn('⚠️ [Page Script] No videos found in any data source');
      console.log('💡 [Page Script] Instagram may be using a different data structure or loading method');
      window.postMessage({
        type: 'INSTAGRAM_VIDEO_DATA',
        videos: [],
        error: 'No videos found. Data may be loaded dynamically.',
        availableKeys: windowKeys
      }, '*');
    }
    
  } catch (error) {
    console.error('❌ [Page Script] Error extracting data:', error);
    window.postMessage({
      type: 'INSTAGRAM_VIDEO_DATA',
      videos: [],
      error: error.message
    }, '*');
  }
  
  // Helper functions
  function extractVideosFromPosts(posts) {
    const videos = [];
    
    posts.forEach((edge) => {
      const node = edge.node;
      
      const isVideo = node.__typename === 'GraphVideo' || 
                     node.is_video === true ||
                     (node.media_type && node.media_type === 2);
      
      if (isVideo) {
        videos.push({
          shortcode: node.shortcode,
          videoUrl: node.video_url || null,
          thumbnailUrl: node.display_url || node.thumbnail_src || node.thumbnail_resources?.[0]?.src,
          username: node.owner?.username || 'unknown',
          caption: node.edge_media_to_caption?.edges?.[0]?.node?.text || '',
          postUrl: `https://www.instagram.com/p/${node.shortcode}/`
        });
      }
    });
    
    return videos;
  }
  
  function searchFiberForSavedPosts(fiber, depth = 0, maxDepth = 15) {
    if (!fiber || depth > maxDepth) return null;
    
    // Check memoizedProps and memoizedState for data
    if (fiber.memoizedProps?.data?.user?.edge_saved_media?.edges) {
      return fiber.memoizedProps.data.user.edge_saved_media.edges;
    }
    
    if (fiber.memoizedState?.data?.user?.edge_saved_media?.edges) {
      return fiber.memoizedState.data.user.edge_saved_media.edges;
    }
    
    // Traverse fiber tree
    let result = null;
    if (fiber.child && !result) {
      result = searchFiberForSavedPosts(fiber.child, depth + 1, maxDepth);
    }
    if (fiber.sibling && !result) {
      result = searchFiberForSavedPosts(fiber.sibling, depth + 1, maxDepth);
    }
    
    return result;
  }
  
  function searchForEdges(obj, depth = 0, maxDepth = 3) {
    if (!obj || typeof obj !== 'object' || depth > maxDepth) return false;
    
    if (Array.isArray(obj) && obj.length > 0 && obj[0]?.node) {
      return true;
    }
    
    for (const key in obj) {
      if (key === 'edges' && Array.isArray(obj[key])) {
        return true;
      }
      if (typeof obj[key] === 'object') {
        if (searchForEdges(obj[key], depth + 1, maxDepth)) {
          return true;
        }
      }
    }
    
    return false;
  }
})();
