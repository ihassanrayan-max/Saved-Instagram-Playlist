import { activeVideo, currentPostCode, setNativeMuted } from './adapter';
import { extensionContext } from '@/utils/extensionContext';

export interface PlaybackNotice { type: 'route' | 'ready' | 'play' | 'pause' | 'sound' | 'ended' | 'error'; shortcode: string | null; message?: string; muted?: boolean }
const listeners = new Set<(notice: PlaybackNotice) => void>();
let detach = () => {};
let bound: HTMLVideoElement | null = null;
let managedCode: string | null = null;
let wantsPlay = false;
let attempted: HTMLVideoElement | null = null;
let observedCode: string | null = null;
let cancelSoundStartup = () => {};
let outgoing: { video: HTMLVideoElement; source: string } | null = null;
let desiredMuted = false;
let userPaused = false;
let soundStartup = false;
let nativeGestureUntil = 0;

// Instagram can reapply its default mute while attaching/loading a video.
// Correct that only during extension-started playback, and stop as soon as
// the user interacts with Instagram's own player.
function startSound(video: HTMLVideoElement) {
  cancelSoundStartup();
  soundStartup = true;
  let started = false;
  const unmute = () => {
    if (!wantsPlay || currentPostCode() !== managedCode || activeVideo() !== video) return;
    setNativeMuted(video, desiredMuted);
    emit('sound');
  };
  const stop = () => {
    soundStartup = false;
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
  for (const listener of listeners) listener({ type, shortcode: currentPostCode(), message, ...(type === 'sound' ? { muted: Boolean(activeVideo()?.muted || activeVideo()?.volume === 0) } : {}) });
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
      const play = () => {
        if (currentPostCode() !== code) return;
        if (managedCode === code && userPaused && Date.now() > nativeGestureUntil) { video.pause(); return; }
        if (Date.now() <= nativeGestureUntil) userPaused = false;
        emit('play');
      };
      const sound = () => {
        if (currentPostCode() !== code || soundStartup) return;
        desiredMuted = Boolean(video.muted || video.volume === 0); emit('sound');
      };
      const ready = () => { if (currentPostCode() === code) emit('ready'); };
      const pause = () => { if (currentPostCode() === code && !video.ended) emit('pause'); };
      const ended = () => { if (currentPostCode() === code) emit('ended'); };
      const error = () => { if (currentPostCode() === code) emit('error', 'This video could not load. You can skip to the next post.'); };
      video.addEventListener('play', play); video.addEventListener('pause', pause);
      video.addEventListener('playing', ready);
      video.addEventListener('loadedmetadata', scan);
      video.addEventListener('volumechange', sound);
      video.addEventListener('ended', ended); video.addEventListener('error', error);
      detach = () => {
        video.removeEventListener('play', play); video.removeEventListener('pause', pause);
        video.removeEventListener('playing', ready);
        video.removeEventListener('loadedmetadata', scan);
        video.removeEventListener('volumechange', sound);
        video.removeEventListener('ended', ended); video.removeEventListener('error', error);
      };
    }
  }
  if (video && currentPostCode() === managedCode) {
    // A client-side route can update before Instagram replaces the old video.
    if (outgoing?.video === video && outgoing.source === (video.currentSrc || video.src || '')) return;
    outgoing = null;
    if (userPaused) { if (!video.paused) video.pause(); return; }
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
  const nativeGesture = (event: Event) => {
    const target = event.target as Element | null;
    if (!event.isTrusted || target?.closest?.('#instagram-playlist-extension,input,textarea,[contenteditable="true"]')) return;
    const video = activeVideo();
    if (video && (target === video || target?.closest?.('article')?.contains(video) || target === document.body)) nativeGestureUntil = Date.now() + 1000;
  };
  document.addEventListener('pointerdown', nativeGesture, true);
  document.addEventListener('keydown', nativeGesture, true);
  scan();
  return () => {
    listeners.delete(listener); observer.disconnect(); window.removeEventListener('popstate', scan); detach(); cancelSoundStartup(); bound = null;
    document.removeEventListener('pointerdown', nativeGesture, true); document.removeEventListener('keydown', nativeGesture, true);
    managedCode = null; wantsPlay = false; attempted = null; outgoing = null; userPaused = false; desiredMuted = false; nativeGestureUntil = 0;
  };
}

export function playPost(shortcode: string, muted = desiredMuted) {
  if (managedCode !== shortcode) outgoing = null;
  managedCode = shortcode; wantsPlay = true; userPaused = false; desiredMuted = muted; attempted = null;
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
  userPaused = true;
  cancelSoundStartup();
  if (currentPostCode() === managedCode) activeVideo()?.pause();
}
export function setPostMuted(shortcode: string, muted: boolean) {
  managedCode = shortcode; desiredMuted = muted; cancelSoundStartup();
  if (currentPostCode() === shortcode) {
    const video = activeVideo(); if (video) { setNativeMuted(video, muted); emit('sound'); }
  }
}
