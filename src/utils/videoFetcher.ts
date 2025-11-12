// Phase 4: Video URL Fetching with logging

export async function fetchVideoUrl(shortcode: string): Promise<string> {
  console.log(`🔍 [Phase 4] Attempting to fetch video URL for shortcode: ${shortcode}`);
  
  try {
    // Try Instagram's embed endpoint
    const embedUrl = `https://www.instagram.com/p/${shortcode}/embed/captioned/`;
    console.log(`📡 [Phase 4] Fetching from: ${embedUrl}`);
    
    const response = await fetch(embedUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const html = await response.text();
    
    // Look for video_url in the HTML
    const videoUrlMatch = html.match(/"video_url":"([^"]+)"/);
    
    if (videoUrlMatch && videoUrlMatch[1]) {
      const videoUrl = videoUrlMatch[1].replace(/\\u0026/g, '&');
      console.log(`✅ [Phase 4] Successfully extracted video URL for ${shortcode}`);
      return videoUrl;
    }
    
    // Try alternative pattern
    const altMatch = html.match(/src="([^"]+\.mp4[^"]*)"/);
    if (altMatch && altMatch[1]) {
      console.log(`✅ [Phase 4] Found video URL via alt method for ${shortcode}`);
      return altMatch[1];
    }
    
    throw new Error('Video URL not found in embed HTML');
  } catch (error) {
    console.error(`❌ [Phase 4] Failed to fetch video URL for ${shortcode}:`, error);
    throw error;
  }
}
