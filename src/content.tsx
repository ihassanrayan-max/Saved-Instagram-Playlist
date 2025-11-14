import { createRoot } from 'react-dom/client';
import { ExtensionOverlay } from './components/ExtensionOverlay';
import './index.css';

// Robust init that waits for <body> and avoids duplicate mounts
const init = () => {
  // Avoid duplicate mounts
  if (document.getElementById('instagram-playlist-extension')) return;

  // Ensure body exists (run_at: document_start safety)
  if (!document.body) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
      // Edge case: body still not available; retry shortly
      setTimeout(init, 50);
    }
    return;
  }

  const container = document.createElement('div');
  container.id = 'instagram-playlist-extension';
  document.body.appendChild(container);

  const root = createRoot(container);
  root.render(<ExtensionOverlay />);
};

// Start immediately; will self-defer until safe
init();
