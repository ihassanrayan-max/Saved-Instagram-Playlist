import { activeVideo, currentPostCode } from './adapter';
import { extensionContext } from '@/utils/extensionContext';

export interface PlaybackNotice { type: 'route' | 'ready' | 'play' | 'pause' | 'ended' | 'error'; shortcode: string | null; message?: string }
const listeners = new Set<(notice: PlaybackNotice) => void>();
let detach = () => {};
let bound: HTMLVideoElement | null = null;
let managedCode: string | null = null;
let wantsPlay = false;
let attempted: HTMLVideoElement | null = null;
let observedCode: string | null = null;
let cancelSoundStartup = () => {};
let outgoing: { video: HTMLVideoElement; source: string } | null = null;

// Instagram can reapply its default mute while attaching/loading a video.
// Correct that only during extension-started playback, and stop as soon as
// the user interacts with Instagram's own player.
function startSound(video: HTMLVideoElement) {
  cancelSoundStartup();
  let started = false;
  const unmute = () => {
    if (!wantsPlay || currentPostCode() !== managedCode || activeVideo() !== video) return;
    video.muted = false;
    if (video.volume === 0) video.volume = 1;
  };
  const stop = () => {
    clearTimeout(timeout);
    for (const event of ['loadedmetadata', 'canplay', 'volumechange']) video.removeEventListener(event, unmute);
    video.removeEventListener('playing', playing);
    document.removeEventListener('pointerdown', userInteraction, true);
    document.removeEventListener('keydown', userInteraction, true);
    cancelSoundStartup = () => {};
  };
  const userInteraction = (event: Event) => {
    if (!event.isTrusted) return;
    const target = event.target as Element | null;
    if (target?.closest?.('#instagram-playlist-extension')) return;
    stop();
  };
  // The timeout bounds only the startup correction; it does not delay playback.
  let timeout = setTimeout(stop, 15000);
  const playing = () => {
    unmute();
    if (!started) { started = true; clearTimeout(timeout); timeout = setTimeout(stop, 2000); }
  };
  for (const event of ['loadedmetadata', 'canplay', 'volumechange']) video.addEventListener(event, unmute);
  video.addEventListener('playing', playing);
  document.addEventListener('pointerdown', userInteraction, true);
  document.addEventListener('keydown', userInteraction, true);
  cancelSoundStartup = stop;
  unmute();
  if (!video.paused && video.readyState >= 2) playing();
}

function emit(type: PlaybackNotice['type'], message?: string) {
  for (const listener of listeners) listener({ type, shortcode: currentPostCode(), message });
}

function scan() {
  if (!extensionContext.check()) return;
  const code = currentPostCode();
  const routeChanged = code !== observedCode;
  if (routeChanged) { observedCode = code; emit('route'); }
  const video = activeVideo();
  if (video !== bound || routeChanged) {
    cancelSoundStartup();
    detach(); bound = video;
    if (video) {
      const play = () => { if (currentPostCode() === code) emit('play'); };
      const ready = () => { if (currentPostCode() === code) emit('ready'); };
      const pause = () => { if (currentPostCode() === code && !video.ended) emit('pause'); };
      const ended = () => { if (currentPostCode() === code) emit('ended'); };
      const error = () => { if (currentPostCode() === code) emit('error', 'This video could not load. You can skip to the next post.'); };
      video.addEventListener('play', play); video.addEventListener('pause', pause);
      video.addEventListener('playing', ready);
      video.addEventListener('loadedmetadata', scan);
      video.addEventListener('ended', ended); video.addEventListener('error', error);
      detach = () => {
        video.removeEventListener('play', play); video.removeEventListener('pause', pause);
        video.removeEventListener('playing', ready);
        video.removeEventListener('loadedmetadata', scan);
        video.removeEventListener('ended', ended); video.removeEventListener('error', error);
      };
    }
  }
  if (video && currentPostCode() === managedCode) {
    // A client-side route can update before Instagram replaces the old video.
    if (outgoing?.video === video && outgoing.source === (video.currentSrc || video.src || '')) return;
    outgoing = null;
    if (wantsPlay && attempted !== video) {
      attempted = video;
      startSound(video);
      video.play().then(() => {
        if (currentPostCode() === managedCode && activeVideo() === video && !video.paused && video.readyState >= 2) emit('ready');
      }).catch(() => {
        cancelSoundStartup();
        if (currentPostCode() === managedCode && activeVideo() === video) emit('error', 'Chrome blocked playback with sound. Click Play in the mini-player or click Instagram’s video to start it.');
      });
    }
  }
}

export function subscribePlayback(listener: (notice: PlaybackNotice) => void) {
  listeners.add(listener);
  const observer = new MutationObserver(scan);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
  window.addEventListener('popstate', scan);
  scan();
  return () => {
    listeners.delete(listener); observer.disconnect(); window.removeEventListener('popstate', scan); detach(); cancelSoundStartup(); bound = null;
    managedCode = null; wantsPlay = false; attempted = null; outgoing = null;
  };
}

export function playPost(shortcode: string) {
  if (managedCode !== shortcode) outgoing = null;
  managedCode = shortcode; wantsPlay = true; attempted = null;
  scan();
}
export function preparePostNavigation(shortcode: string) {
  const video = activeVideo();
  outgoing = video && currentPostCode() !== shortcode ? { video, source: video.currentSrc || video.src || '' } : null;
  cancelSoundStartup();
  if (outgoing && !video.paused) video.pause();
  managedCode = shortcode; wantsPlay = false; attempted = null;
}
export function pausePost(shortcode?: string) {
  if (shortcode) managedCode = shortcode;
  wantsPlay = false;
  cancelSoundStartup();
  if (currentPostCode() === managedCode) activeVideo()?.pause();
}
