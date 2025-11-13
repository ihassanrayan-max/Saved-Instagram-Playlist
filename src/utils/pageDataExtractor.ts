// This script will be injected into Instagram's page context
// It runs with access to window._sharedData and other page variables

export const pageDataExtractorScript = `
(function() {
  console.log('🔮 [Page Script] Extracting data from Instagram page context...');
  
  try {
    // Try to get data from window._sharedData
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
    
    // Try multiple possible data locations in Instagram's structure
    let savedPosts = null;
    
    // Location 1: ProfilePage saved media
    if (sharedData.entry_data?.ProfilePage?.[0]?.graphql?.user?.edge_saved_media?.edges) {
      savedPosts = sharedData.entry_data.ProfilePage[0].graphql.user.edge_saved_media.edges;
      console.log('📍 [Page Script] Found posts in ProfilePage.edge_saved_media');
    }
    
    // Location 2: SavedCollectionPage
    if (!savedPosts && sharedData.entry_data?.CollectionPage?.[0]?.graphql?.edges) {
      savedPosts = sharedData.entry_data.CollectionPage[0].graphql.edges;
      console.log('📍 [Page Script] Found posts in CollectionPage');
    }
    
    // Location 3: Direct saved posts
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
    
    console.log(\`📦 [Page Script] Processing \${savedPosts.length} posts...\`);
    
    const videos = [];
    
    savedPosts.forEach((edge, index) => {
      const node = edge.node;
      
      // Check if it's a video using multiple indicators
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
          postUrl: \`https://www.instagram.com/p/\${node.shortcode}/\`
        });
        
        console.log(\`✅ [Page Script] Found video \${videos.length}: \${node.shortcode}\`);
      }
    });
    
    console.log(\`📦 [Page Script] Extracted \${videos.length} videos from \${savedPosts.length} posts\`);
    
    // Send data back to content script
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
`;
