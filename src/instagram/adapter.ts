import { normalizeItem } from '../../public/playlist-model.js';
import type { PlaylistItem } from '@/utils/playlistStorage';

export const collectionSource = () => `${location.origin}${location.pathname.replace(/\/+$/, '')}/`;
export const isSavedPage = () => /\/saved(?:\/|$)/.test(location.pathname);

export function visiblePosts(): PlaylistItem[] {
  const root = document.querySelector('main') || document;
  const items: PlaylistItem[] = [];
  root.querySelectorAll<HTMLAnchorElement>('a[href*="/p/"], a[href*="/reel/"]').forEach(link => {
    try {
      const image = link.querySelector('img');
      items.push(normalizeItem({ url: link.href, thumbnail: image?.currentSrc || image?.src, caption: image?.alt }));
    } catch { /* Ignore navigation links that are not canonical post links. */ }
  });
  return items;
}

export function scrollContainer(): HTMLElement {
  const link = document.querySelector('main a[href*="/p/"], main a[href*="/reel/"]');
  let node = link?.parentElement;
  while (node && node !== document.body) {
    if (/(auto|scroll)/.test(getComputedStyle(node).overflowY) && node.scrollHeight > node.clientHeight + 50) return node;
    node = node.parentElement;
  }
  return (document.scrollingElement || document.documentElement) as HTMLElement;
}

export function currentPostCode(): string | null {
  try { return normalizeItem({ url: location.href }).shortcode; } catch { return null; }
}

export function activeVideo(): HTMLVideoElement | null {
  const scope = document.querySelector('[role="dialog"]') || document.querySelector('main') || document;
  return [...scope.querySelectorAll('video')].filter(video => {
    const rect = video.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight;
  }).sort((a, b) => {
    const area = (video: HTMLVideoElement) => {
      const r = video.getBoundingClientRect();
      return Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)) * r.width;
    };
    return area(b) - area(a);
  })[0] || null;
}

export function setNativeMuted(video: HTMLVideoElement, muted: boolean) {
  const scope = video.closest('article') || document.querySelector('[role="dialog"]') || document.querySelector('main');
  const action = muted ? /^(mute|turn off sound)$/i : /^(unmute|turn on sound)$/i;
  const control = scope && [...scope.querySelectorAll<HTMLElement>('[aria-label]')].find(node => action.test(node.getAttribute('aria-label') || ''));
  const button = control?.closest<HTMLElement>('button,[role="button"]');
  if (button) button.click();
  video.muted = muted;
  if (!muted && video.volume === 0) video.volume = 1;
}
