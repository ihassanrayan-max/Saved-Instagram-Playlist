# Instagram Playlist Extension

A Chrome extension that transforms your Instagram saved collections into interactive video playlists with full playback controls.

## Features

- **Multiple Playlists**: Create, manage, and organize multiple playlists
- **Auto-Collection**: Automatically collect URLs from Instagram saved collections
- **Mini-Player**: Draggable, minimizable mini-player with full controls
- **Playlist Navigation**: Prefer native Instagram links when available, with a document fallback
- **Library Search**: Find posts across playlists by title, notes, tags, creator, or caption
- **Personal Notes**: Add a memorable title, notes, and tags; keep them in exports
- **Queue & Accessibility**: Searchable queue, keyboard reordering, reduced motion, and an end-session action
- **Auto-Play & Auto-Unmute**: Videos automatically play with sound
- **Shuffle**: Shuffle playlist order; Instagram retains its native video looping
- **Export/Import**: Backup and share playlists as JSON files
- **Modern UI**: Beautiful glassmorphic design with Instagram-inspired gradients

## Installation

### From Source

1. Clone this repository:
```bash
git clone https://github.com/YOUR_USERNAME/instagram-playlist-extension.git
cd instagram-playlist-extension
```

2. Install dependencies:
```bash
npm install
```

3. Build the extension:
```bash
npm run build
```

4. Load in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist/` folder

## Usage

1. **Create a Playlist**: Click the extension icon → Create a new playlist
2. **Collect URLs**: Go to Instagram saved collections → Click "Start Collection" in the extension popup
3. **Activate Playlist**: Select a playlist → Click "Activate"
4. **Control Playback**: Click a playlist entry to open it, or use the mini-player to play, pause, navigate, and shuffle

## Development

```bash
# Install dependencies
npm install

# Development mode (main app)
npm run dev

# Build content script
npx vite build --config vite.config.content.ts

# Build extension
npm run build
```

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **shadcn/ui** - UI components
- **Chrome Extension APIs** - Extension functionality

## Project Structure

```
├── src/
│   ├── components/       # React components
│   ├── utils/           # Utility functions
│   └── pages/           # Page components
├── public/              # Static assets and scripts
├── dist/                # Built extension files
└── build-extension.js   # Build script
```

## License

MIT License - see LICENSE file for details

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
