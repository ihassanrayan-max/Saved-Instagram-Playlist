// This file runs in Instagram's page context (bypasses CSP)
(function() {
  console.log('🔮 [Page Script] Extracting data from Instagram page context...');
  
  try {
    const sharedData = window._sharedData;
    
    if (!sharedData) {
      console.warn('⚠️ [Page Script] window._sharedData not found');
      window.postMessage({
        type: 'INSTAGRAM_VIDEO_DATA',
        videos: [],
        error: 'window._sharedData not found'
      }, '*');
      return;
    }
    
    console.log('📊 [Page Script] Found window._sharedData, extracting posts...');
    
    let savedPosts = null;
    
    // Try multiple locations
    if (sharedData.entry_data?.ProfilePage?.[0]?.graphql?.user?.edge_saved_media?.edges) {
      savedPosts = sharedData.entry_data.ProfilePage[0].graphql.user.edge_saved_media.edges;
      console.log('📍 [Page Script] Found posts in ProfilePage.edge_saved_media');
    }
    
    if (!savedPosts && sharedData.entry_data?.CollectionPage?.[0]?.graphql?.edges) {
      savedPosts = sharedData.entry_data.CollectionPage[0].graphql.edges;
      console.log('📍 [Page Script] Found posts in CollectionPage');
    }
    
    if (!savedPosts && sharedData.entry_data?.SavedPage?.[0]?.graphql?.user?.edge_saved_media?.edges) {
      savedPosts = sharedData.entry_data.SavedPage[0].graphql.user.edge_saved_media.edges;
      console.log('📍 [Page Script] Found posts in SavedPage');
    }
    
    if (!savedPosts || savedPosts.length === 0) {
      console.warn('⚠️ [Page Script] No saved posts found in any known location');
      console.log('Available entry_data keys:', Object.keys(sharedData.entry_data || {}));
      window.postMessage({
        type: 'INSTAGRAM_VIDEO_DATA',
        videos: [],
        error: 'No posts found in _sharedData'
      }, '*');
      return;
    }
    
    console.log(`📦 [Page Script] Processing ${savedPosts.length} posts...`);
    
    const videos = [];
    
    savedPosts.forEach((edge) => {
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
        
        console.log(`✅ [Page Script] Found video ${videos.length}: ${node.shortcode}`);
      }
    });
    
    console.log(`📦 [Page Script] Extracted ${videos.length} videos from ${savedPosts.length} posts`);
    
    window.postMessage({
      type: 'INSTAGRAM_VIDEO_DATA',
      videos: videos
    }, '*');
    
  } catch (error) {
    console.error('❌ [Page Script] Error extracting data:', error);
    window.postMessage({
      type: 'INSTAGRAM_VIDEO_DATA',
      videos: [],
      error: error.message
    }, '*');
  }
})();
