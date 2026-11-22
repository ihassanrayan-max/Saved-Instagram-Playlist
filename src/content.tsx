import { createRoot, type Root } from 'react-dom/client';
import { ExtensionOverlay } from './components/ExtensionOverlay';
import { Collector } from './instagram/collector';
import { requestPlayer, type PlayerRequest } from './instagram/playerRequests';
import { pausePost } from './instagram/playback';
import { extensionCall, extensionContext, isContextInvalidation, listenExtensionEvent, reportExtensionError } from './utils/extensionContext';
import './index.css';

async function init() {
  if (document.getElementById('instagram-playlist-extension')) return;
  const collector = new Collector();
  const host = document.createElement('div');
  host.id = 'instagram-playlist-extension';
  host.style.fontFamily = 'system-ui, sans-serif';
  const shadow = host.attachShadow({ mode: 'open' });
  document.body.append(host);
  const ui: { root?: Root } = {};
  extensionContext.onInvalidated(() => {
    collector.dispose();
    pausePost();
    // Invalidation may be detected inside a React effect. Unmount after that
    // effect finishes so every timer, subscription and observer can clean up.
    queueMicrotask(() => {
      ui.root?.unmount();
      const notice = document.createElement('section');
      notice.setAttribute('role', 'status');
      notice.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:2147483647;max-width:300px;padding:16px;border:1px solid #555;border-radius:12px;background:#18181b;color:white;font:14px/1.5 system-ui,sans-serif';
      const text = document.createElement('p');
      text.textContent = 'Playlist extension updated. Reload Instagram to reconnect.';
      const reload = document.createElement('button');
      reload.textContent = 'Reload Instagram';
      reload.style.cssText = 'margin-top:12px;margin-right:12px;padding:8px 12px;border-radius:6px;border:0;background:white;color:#18181b;cursor:pointer';
      reload.addEventListener('click', () => location.reload());
      const dismiss = document.createElement('button');
      dismiss.textContent = 'Dismiss';
      dismiss.style.cssText = 'padding:8px;border:1px solid #888;border-radius:6px;background:transparent;color:white;cursor:pointer';
      dismiss.addEventListener('click', () => host.remove());
      notice.append(text, reload, dismiss);
      shadow.replaceChildren(notice);
    });
  });
  if (!extensionContext.check()) return;
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = await extensionCall(() => chrome.runtime.getURL('content.css'));
  const mount = document.createElement('div');
  shadow.append(css, mount);
  ui.root = createRoot(mount);
  ui.root.render(<ExtensionOverlay />);

  const handleMessage = (message: ExtensionMessage, _sender: unknown, respond: (response: ExtensionResponse) => void) => {
    if (!extensionContext.check()) return false;
    const reply = (response: ExtensionResponse) => {
      if (!extensionContext.check()) return;
      try { respond(response); }
      catch (error) { reportExtensionError(error); }
    };
    const handle = async () => {
      try {
        let data: unknown;
        switch (message.type) {
          case 'START_COLLECTION': data = await collector.start(Boolean(message.resume)); break;
          case 'STOP_COLLECTION': data = await collector.stop(); break;
          case 'CLEAR_COLLECTION': data = await collector.clear(); break;
          case 'GET_COLLECTION_STATE': data = await collector.state(); break;
          case 'NAVIGATE_PLAYLIST': data = await requestPlayer(message.args as unknown as PlayerRequest); break;
          case 'END_PLAYBACK': pausePost(); break;
        }
        reply({ ok: true, data });
      } catch (error) {
        if (!isContextInvalidation(error)) reply({ ok: false, error: error instanceof Error ? error.message : 'Command failed.' });
      }
    };
    if (!['START_COLLECTION', 'STOP_COLLECTION', 'CLEAR_COLLECTION', 'GET_COLLECTION_STATE', 'NAVIGATE_PLAYLIST', 'END_PLAYBACK'].includes(message.type)) return false;
    void handle();
    return true;
  };
  const stopMessages = listenExtensionEvent(() => chrome.runtime.onMessage, handleMessage);
  extensionContext.onInvalidated(stopMessages);
  // Event-driven checks also retire idle players when the user returns to a tab.
  window.addEventListener('focus', () => extensionContext.check(), { signal: extensionContext.signal });
  document.addEventListener('visibilitychange', () => extensionContext.check(), { signal: extensionContext.signal });
}
const start = () => { void init().catch(reportExtensionError); };
if (document.body) start();
else document.addEventListener('DOMContentLoaded', start, { once: true });
