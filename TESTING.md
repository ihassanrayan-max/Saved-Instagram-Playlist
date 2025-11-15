# Testing the Instagram Video Playlist Extension

## Prerequisites

- Node.js and npm installed
- Google Chrome browser
- Instagram account with saved collections containing videos

## Build Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Build the Extension

Run both build commands to create the extension files:

```bash
# Build the main app
npm run build

# Build the content script
npx vite build --config vite.config.content.ts

# Copy manifest and icons to dist folder
node build-extension.js
```

Or run all at once:

```bash
npm run build && npx vite build --config vite.config.content.ts && node build-extension.js
```

This will create a `dist/` folder with all necessary extension files:
- `index.html` - Extension popup
- `content.js` - Content script injected into Instagram
- `manifest.json` - Extension configuration
- `icon*.png` - Extension icons
- `assets/` - Bundled CSS and JS

## Loading the Extension in Chrome

1. **Open Chrome Extensions Page**
   - Navigate to `chrome://extensions/`
   - Or: Menu → More Tools → Extensions

2. **Enable Developer Mode**
   - Toggle the "Developer mode" switch in the top-right corner

3. **Load Unpacked Extension**
   - Click "Load unpacked" button
   - Select the `dist/` folder from your project directory
   - The extension should now appear in your extensions list

4. **Verify Installation**
   - You should see "Instagram Video Playlist" extension
   - The extension icon should appear in your Chrome toolbar
   - Check that there are no errors in the extension card

## Testing on Instagram

### 1. Navigate to Instagram Saved Collections

1. Go to [instagram.com](https://www.instagram.com)
2. Log in to your account
3. Click your profile picture
4. Click "Saved" (bookmark icon)
5. Open any collection that contains videos

### 2. Enable the Extension

1. Look for the floating purple "Enable Playlist" button in the bottom-right corner
2. Click the button to start video detection
3. The extension will automatically scroll through the collection to find all videos
4. A progress indicator will show how many videos have been detected

### 3. Test Playlist Features

Once videos are collected:

- **Play/Pause**: Click the center play button
- **Next/Previous**: Use arrow buttons to navigate
- **Shuffle**: Click shuffle icon to randomize playback order
- **Loop**: Click repeat icon to enable continuous playback
- **Close**: Click X to hide the player

## Troubleshooting

### Extension Not Loading

- **Check Console Errors**: Right-click extension → "Inspect popup"
- **Verify Build**: Ensure all files exist in `dist/` folder
- **Rebuild**: Try cleaning `dist/` and rebuilding

### "Enable Playlist" Button Not Appearing

- **Check URL**: Must be on `instagram.com/*/saved/`
- **Check Console**: Open DevTools → Console tab for errors
- **Verify Content Script**: Check if `content.js` loaded in DevTools → Sources → Content Scripts

### Videos Not Detected

- **Wait for Page Load**: Instagram loads content dynamically
- **Scroll Manually**: Try scrolling down to load more videos first
- **Check Video Format**: Extension detects `<video>` elements only

### Player Not Working

- **Check Video URLs**: Some Instagram videos may have CORS restrictions
- **Inspect Element**: Use DevTools to verify video elements exist
- **Check Browser Console**: Look for playback errors

## Development Mode

For faster development iteration:

```bash
# Terminal 1: Watch mode for main app
npm run dev

# Terminal 2: Watch mode for content script
npx vite build --config vite.config.content.ts --watch

# After changes, reload extension:
# - Go to chrome://extensions/
# - Click reload icon on extension card
# - Refresh Instagram page
```

## Debugging Tips

### View Content Script Logs

1. Open Instagram page with extension
2. Open DevTools (F12)
3. Go to Console tab
4. Content script logs will appear here

### View Extension Popup Logs

1. Click extension icon in toolbar
2. Right-click popup → "Inspect"
3. DevTools will open for the popup

### Check Injected Elements

1. Open DevTools on Instagram
2. Go to Elements tab
3. Look for `<div id="instagram-playlist-extension">` in the body
4. Verify the overlay component is rendered

## Known Limitations

- Only works on Instagram saved collections pages
- May not detect videos if Instagram changes their DOM structure
- Some videos may have playback restrictions
- Extension needs to be manually reloaded after code changes

## Next Steps

After successful testing, you can:

1. **Publish to Chrome Web Store**
   - Package the `dist/` folder as a zip
   - Submit to Chrome Web Store Developer Dashboard

2. **Add More Features**
   - Video download capability
   - Playlist export/import
   - Keyboard shortcuts
   - Settings panel

3. **Improve Detection**
   - Handle more Instagram page types
   - Better error handling
   - Performance optimizations
