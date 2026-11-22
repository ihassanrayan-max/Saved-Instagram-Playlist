import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { setImmediate } from 'node:timers/promises';
import { restorePlayback } from '../public/player-session.js';

// Exercise the production URL parser, video selection and mute setter together.
// The old media fixture replaced that boundary and missed Instagram's /reels/ redirect.
const result = await build({ stdin: { contents: `
  export * from './src/instagram/adapter';
  export * from './src/instagram/playback';
`, resolveDir: process.cwd() }, bundle: true, format: 'esm', platform: 'node', write: false });
const player = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);

test('redirected reel controls pause/resume and toggle sound on the actual selected video', async () => {
  globalThis.chrome = { runtime: { id: 'adapter-test' } };
  globalThis.location = new URL('https://www.instagram.com/reels/DCA__L_ItDB/');
  globalThis.innerHeight = 900;
  globalThis.window = new EventTarget();
  const observers = new Set();
  globalThis.MutationObserver = class {
    constructor(callback) { this.callback = callback; }
    observe() { observers.add(this); }
    disconnect() { observers.delete(this); }
  };
  class Video extends EventTarget {
    paused = true; ended = false; muted = true; volume = 0; readyState = 4;
    currentTime = 17; currentSrc = 'current.mp4';
    getBoundingClientRect() { return { width: 400, height: 600, top: 0, bottom: 600 }; }
    closest() { return null; }
    async play() {
      const changed = this.paused; this.paused = false;
      if (changed) this.dispatchEvent(new Event('play'));
      this.dispatchEvent(new Event('playing'));
    }
    pause() {
      const changed = !this.paused; this.paused = true;
      if (changed) this.dispatchEvent(new Event('pause'));
    }
  }
  let video = new Video();
  const main = { querySelectorAll: selector => selector === 'video' ? [video] : [] };
  globalThis.document = new EventTarget(); document.body = {};
  document.querySelector = selector => selector === 'main' ? main : null;
  const notices = [];
  const stop = player.subscribePlayback(notice => notices.push(notice));
  try {
    const shortcode = player.currentPostCode();
    assert.equal(shortcode, 'DCA__L_ItDB');
    assert.equal(player.activeVideo(), video);
    player.playPost(shortcode, false);
    await setImmediate();
    assert.equal(video.paused, false); assert.equal(video.muted, false); assert.equal(video.volume, 1);
    assert.ok(notices.some(notice => notice.type === 'play' && notice.shortcode === shortcode));
    player.pausePost(shortcode);
    assert.equal(video.paused, true); assert.equal(video.currentTime, 17);
    assert.deepEqual(restorePlayback({ currentShortcode: shortcode, playbackIntent: 'paused' }, player.currentPostCode(), true), { managed: true, playing: false, muted: false });
    player.playPost(shortcode, false);
    player.setPostMuted(shortcode, true); assert.equal(video.muted, true);
    player.setPostMuted(shortcode, false); assert.equal(video.muted, false);
    video = new Video();
    for (const observer of observers) observer.callback();
    await setImmediate();
    assert.equal(video.paused, false); assert.equal(video.muted, false);
    assert.equal(location.pathname, '/reels/DCA__L_ItDB/');
  } finally { stop(); }
});
