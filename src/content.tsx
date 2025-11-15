import { createRoot } from 'react-dom/client';
import { ExtensionOverlay } from './components/ExtensionOverlay';
import './index.css';

// Listen for messages from background script
if (typeof chrome !== 'undefined' && (chrome as any).runtime) {
  (chrome as any).runtime.onMessage.addListener((message: any) => {
    if (message.type === 'PLAYLIST_STORAGE_CHANGED' || message.type === 'PLAYLIST_STATE_CHANGED') {
      // Dispatch custom event for React components to listen to
      window.dispatchEvent(new CustomEvent('playlist-storage-changed'));
    }
  });
}

// Robust init that waits for <body> and avoids duplicate mounts
const init = () => {
  // Avoid duplicate mounts
  if (document.getElementById('instagram-playlist-extension')) return;

  // Ensure body exists (run_at: document_start safety)
  if (!document.body) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
      // Use MutationObserver as alternative to setTimeout polling
      const observer = new MutationObserver((mutations, obs) => {
        if (document.body) {
          obs.disconnect();
          init();
        }
      });
      
      // Observe document for body creation
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
      
      // Fallback: retry after timeout if MutationObserver doesn't catch it
      setTimeout(() => {
        observer.disconnect();
        if (document.body) {
          init();
        } else {
          // Last resort: retry with setTimeout
      setTimeout(init, 50);
        }
      }, 1000);
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
