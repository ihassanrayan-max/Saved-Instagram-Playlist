import { createRoot } from 'react-dom/client';
import { ExtensionOverlay } from './components/ExtensionOverlay';
import './index.css';

// Wait for page to load
const init = () => {
  // Create container for our overlay
  const container = document.createElement('div');
  container.id = 'instagram-playlist-extension';
  document.body.appendChild(container);

  // Mount React component
  const root = createRoot(container);
  root.render(<ExtensionOverlay />);
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
