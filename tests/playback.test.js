import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { setImmediate } from 'node:timers/promises';

const result = await build({ entryPoints: ['src/instagram/playback.ts'], bundle: true, format: 'esm', platform: 'node', write: false,
  plugins: [{ name: 'video-fixture', setup(builder) {
    builder.onResolve({ filter: /^\.\/adapter$/ }, () => ({ path: 'video', namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `
      export const activeVideo = () => globalThis.videoFixture.video;
      export const currentPostCode = () => globalThis.videoFixture.code;
      export const setNativeMuted = (video, muted) => { video.muted = muted; if (!muted && video.volume === 0) video.volume = 1; };
    ` }));
  } }],
});
const playback = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
class Video extends EventTarget {
  paused = true; ended = false; loop = true; muted = true; volume = 0; readyState = 2; currentTime = 9; blocked = false;
  async play() {
    if (this.blocked) throw new Error('NotAllowedError');
    this.paused = false; this.dispatchEvent(new Event('play')); this.dispatchEvent(new Event('playing'));
  }
  pause() { this.paused = true; this.dispatchEvent(new Event('pause')); }
}
function setup() {
  globalThis.chrome = { runtime: { id: 'test-extension' } };
  const observers = new Set();
  globalThis.window = new EventTarget();
  const interactions = new Set();
  globalThis.document = new EventTarget(); document.body = {};
  const add = document.addEventListener.bind(document), remove = document.removeEventListener.bind(document);
  document.addEventListener = (type, listener, options) => { if (type === 'pointerdown') interactions.add(listener); add(type, listener, options); };
  document.removeEventListener = (type, listener, options) => { interactions.delete(listener); remove(type, listener, options); };
  globalThis.MutationObserver = class {
    constructor(callback) { this.callback = callback; }
    observe() { observers.add(this); }
    disconnect() { observers.delete(this); }
  };
  globalThis.videoFixture = { video: new Video(), code: 'abc' };
  const notices = [];
  const unsubscribe = playback.subscribePlayback(notice => notices.push(notice));
  return { notices, unsubscribe, interact: () => { for (const listener of interactions) listener({ isTrusted: true, target: null }); }, mutate: () => { for (const observer of observers) observer.callback(); } };
}
test('extension playback unmutes only the active post and preserves Instagram native looping', () => {
  const { notices, unsubscribe } = setup();
  playback.playPost('different'); assert.equal(videoFixture.video.paused, true);
  playback.playPost('abc'); assert.equal(videoFixture.video.paused, false);
  assert.equal(videoFixture.video.muted, false); assert.equal(videoFixture.video.volume, 1); assert.equal(videoFixture.video.loop, true);
  playback.pausePost(); assert.equal(videoFixture.video.paused, true);
  playback.playPost('abc'); assert.equal(videoFixture.video.currentTime, 9); assert.equal(videoFixture.video.muted, false);
  assert.ok(notices.some(n => n.type === 'pause'));
  unsubscribe();
});
test('blocked autoplay produces an actionable error', async () => {
  const { notices, unsubscribe } = setup();
  videoFixture.video.blocked = true; playback.playPost('abc');
  await setImmediate();
  assert.match(notices.find(n => n.type === 'error').message, /Click/);
  unsubscribe();
});
test('replaced video elements and SPA navigation detach old listeners', () => {
  const { notices, unsubscribe, mutate } = setup();
  playback.playPost('abc');
  const old = videoFixture.video;
  videoFixture.video = new Video(); mutate();
  assert.equal(videoFixture.video.muted, false);
  const count = notices.length;
  old.dispatchEvent(new Event('ended')); assert.equal(notices.length, count);
  videoFixture.video.dispatchEvent(new Event('ended')); assert.equal(notices.at(-1).type, 'ended');
  videoFixture.code = 'def'; mutate(); assert.ok(notices.some(n => n.type === 'route' && n.shortcode === 'def'));
  unsubscribe();
  const final = notices.length;
  videoFixture.video.dispatchEvent(new Event('ended')); mutate(); assert.equal(notices.length, final);
});
test('startup corrects delayed native muting, then respects manual mute', () => {
  const { unsubscribe, interact } = setup();
  playback.playPost('abc');
  videoFixture.video.muted = true; videoFixture.video.dispatchEvent(new Event('volumechange'));
  assert.equal(videoFixture.video.muted, false);
  interact(); videoFixture.video.muted = true; videoFixture.video.dispatchEvent(new Event('volumechange'));
  assert.equal(videoFixture.video.muted, true);
  unsubscribe();
});
test('startup correction expires after playing, without fighting later mute changes', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { unsubscribe } = setup();
  playback.playPost('abc'); t.mock.timers.tick(2001);
  videoFixture.video.muted = true; videoFixture.video.dispatchEvent(new Event('volumechange'));
  assert.equal(videoFixture.video.muted, true);
  unsubscribe(); t.mock.timers.reset();
});
test('late video insertion is unmuted and ordinary Instagram visits are untouched', () => {
  const { unsubscribe, mutate } = setup();
  assert.equal(videoFixture.video.muted, true);
  videoFixture.video = null; playback.playPost('abc');
  videoFixture.video = new Video(); mutate(); assert.equal(videoFixture.video.muted, false);
  videoFixture.code = 'unmanaged'; videoFixture.video = new Video(); mutate();
  assert.equal(videoFixture.video.muted, true); assert.equal(videoFixture.video.paused, true);
  unsubscribe();
});
test('sound startup also handles a video that buffers for five seconds', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { unsubscribe } = setup();
  const video = videoFixture.video;
  video.readyState = 0;
  video.play = async () => { video.paused = false; };
  playback.playPost('abc'); t.mock.timers.tick(5000);
  video.muted = true; video.dispatchEvent(new Event('loadedmetadata'));
  assert.equal(video.muted, false);
  video.dispatchEvent(new Event('playing')); t.mock.timers.tick(2001);
  video.muted = true; video.dispatchEvent(new Event('volumechange'));
  assert.equal(video.muted, true);
  unsubscribe(); t.mock.timers.reset();
});
test('native navigation waits for Instagram to replace the outgoing video or its source', () => {
  const { unsubscribe, mutate } = setup();
  const video = videoFixture.video;
  video.currentSrc = 'old.mp4';
  playback.preparePostNavigation('next'); videoFixture.code = 'next'; mutate();
  playback.playPost('next'); assert.equal(video.paused, true); assert.equal(video.muted, true);
  video.currentSrc = 'next.mp4'; video.dispatchEvent(new Event('loadedmetadata'));
  assert.equal(video.paused, false); assert.equal(video.muted, false);
  unsubscribe();
});
test('pause intent stops native autoplay attempts and replacement videos until explicitly resumed', () => {
  const { unsubscribe, mutate } = setup();
  playback.playPost('abc'); playback.pausePost('abc');
  videoFixture.video.play(); assert.equal(videoFixture.video.paused, true);
  videoFixture.video = new Video(); videoFixture.video.paused = false; mutate();
  assert.equal(videoFixture.video.paused, true);
  playback.playPost('abc'); assert.equal(videoFixture.video.paused, false);
  unsubscribe();
});
test('mute toggles the actual video and survives replacement and resumed playback', () => {
  const { notices, unsubscribe, mutate } = setup();
  playback.playPost('abc');
  playback.setPostMuted('abc', true); assert.equal(videoFixture.video.muted, true);
  assert.equal(notices.at(-1).muted, true);
  videoFixture.video = new Video(); mutate(); assert.equal(videoFixture.video.muted, true);
  playback.setPostMuted('abc', false); assert.equal(videoFixture.video.muted, false);
  assert.equal(notices.at(-1).muted, false);
  unsubscribe();
});
test('restoring sound preference on a paused post does not resume playback', () => {
  const { unsubscribe } = setup();
  playback.playPost('abc'); playback.pausePost('abc');
  videoFixture.video.muted = true;
  playback.setPostMuted('abc', false);
  assert.equal(videoFixture.video.paused, true); assert.equal(videoFixture.video.muted, false);
  unsubscribe();
});
