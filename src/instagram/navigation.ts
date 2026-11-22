import { normalizeItem } from '../../public/playlist-model.js';
import { extensionContext, isContextInvalidation } from '@/utils/extensionContext';

interface NavigationEnvironment {
  currentCode(): string | null;
  findLink(shortcode: string): { click(): void } | null;
  watch(listener: () => void): () => void;
  assign(url: string): void;
  signal?: AbortSignal;
}
const browser: NavigationEnvironment = {
  signal: extensionContext.signal,
  currentCode() { try { return normalizeItem({ url: location.href }).shortcode; } catch { return null; } },
  findLink(shortcode) {
    const scope = document.querySelector('main') || document;
    return [...scope.querySelectorAll<HTMLAnchorElement>('a[href*="/p/"], a[href*="/reel/"], a[href*="/reels/"]')].find(link => {
      if (!link.isConnected || link.target === '_blank' || link.hasAttribute('download')) return false;
      try { return normalizeItem({ url: link.href }).shortcode === shortcode; } catch { return false; }
    }) || null;
  },
  watch(listener) {
    const observer = new MutationObserver(listener);
    observer.observe(document.body, { subtree: true, childList: true });
    window.addEventListener('popstate', listener);
    return () => { observer.disconnect(); window.removeEventListener('popstate', listener); };
  },
  assign(url) { location.assign(url); },
};

export function createPostNavigator(environment: NavigationEnvironment = browser) {
  return async (url: string, allowReload = true): Promise<'current' | 'native' | 'reload'> => {
    if (environment.signal?.aborted) throw new DOMException('Extension disconnected. Reload Instagram.', 'AbortError');
    const item = normalizeItem({ url });
    const original = environment.currentCode();
    if (original === item.shortcode) return 'current';
    const link = environment.findLink(item.shortcode);
    if (!link) { if (allowReload) environment.assign(item.url); return 'reload'; }
    return new Promise((resolve, reject) => {
      let stop = () => {};
      let finished = false;
      const cleanup = () => { if (finished) return; finished = true; stop(); clearTimeout(timeout); environment.signal?.removeEventListener('abort', cancel); };
      const cancel = () => { cleanup(); reject(new DOMException('Extension disconnected. Reload Instagram.', 'AbortError')); };
      const check = () => {
        if (finished) return;
        const code = environment.currentCode();
        if (code === item.shortcode) { cleanup(); resolve('native'); }
        else if (code !== original) { cleanup(); reject(new Error('Navigation changed. Select the post again to continue.')); }
      };
      const timeout = setTimeout(() => {
        cleanup(); if (allowReload) environment.assign(item.url); resolve('reload');
      }, 600);
      stop = environment.watch(check);
      environment.signal?.addEventListener('abort', cancel, { once: true });
      try { link.click(); check(); } catch (error) { if (finished) return; cleanup(); if (isContextInvalidation(error)) reject(error); else { if (allowReload) environment.assign(item.url); resolve('reload'); } }
    });
  };
}
export const navigatePost = createPostNavigator();
