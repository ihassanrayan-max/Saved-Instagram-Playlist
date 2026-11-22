let calls = 0, afterInvalidation = 0, retired = false;
const runtimeListeners = new Set(), storageListeners = new Set();
const assertLive = () => { calls++; if (retired) { afterInvalidation++; throw new Error('Extension context invalidated.'); } };
const event = listeners => ({ addListener(listener) { assertLive(); listeners.add(listener); }, removeListener(listener) { assertLive(); listeners.delete(listener); } });
const runtime = {
  id: 'reload-test-extension',
  getURL(path) { assertLive(); return `/dist/${path}`; },
  async sendMessage() { assertLive(); return { ok: true, data: null }; },
  onMessage: event(runtimeListeners),
};
window.chrome = { runtime, storage: {
  onChanged: event(storageListeners),
  local: {
    async get() { assertLive(); return {}; }, async set() { assertLive(); }, async remove() { assertLive(); },
  },
} };
await import('../../dist/content.js');
const output = document.getElementById('result');
const show = () => { output.textContent = `Content script: ${retired ? 'retired' : 'active'}\nAPI calls: ${calls}\nAPI calls after invalidation: ${afterInvalidation}`; };
document.getElementById('reload').addEventListener('click', () => {
  retired = true; delete runtime.id; runtimeListeners.clear(); storageListeners.clear();
  window.dispatchEvent(new Event('focus'));
  show();
});
document.getElementById('check').addEventListener('click', () => {
  window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange'));
  show();
});
show();
