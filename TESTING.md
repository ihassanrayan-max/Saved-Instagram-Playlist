# Testing Instagram Video Playlist

Requires Node.js 22+ for the automated test suite, Chrome 116+ for the extension, and an Instagram account for live checks.

## Build and automated checks

```sh
npm ci
npm test
npm run lint
npm run build
```

The build runs TypeScript checks, builds both popup and content script, copies worker modules, and checks manifest assets. The Node tests use simulated Instagram DOM adapters and video elements; they do not establish compatibility with the live Instagram site.

## Install or update

1. Open `chrome://extensions/` and load `dist/` with Load unpacked, or click Reload for the existing extension.
2. Check that the displayed extension version is **1.2.1**.
3. Reload the Instagram tab too. Existing tabs retain old content scripts until reloaded.

Legacy local URL lists are intentionally discarded on the first v2 library initialization. Instagram saved collections are never changed.

## Playback checks for 1.2.0

1. Open Playlist Manager and click any entry's title or URL. It should open that post in an Instagram tab, activate its playlist, and select the correct queue position. Next and Previous should continue from that entry.
2. Use Next and Previous, including a video that takes several seconds to buffer. Extension-started playback should request sound after the video appears, including if Instagram replaces the video element during loading.
3. Manually mute the video using Instagram's controls. It should stay muted. Opening a different video through the extension starts a new playback request with sound.
4. Open a post normally through Instagram while the extension is present. Native playback and mute settings should be left alone unless you press Play in the mini-player.
5. Let a natively looping video finish. The extension has no loop button and should not reset its currentTime, reload the post, or change the video's loop property.
6. If Chrome blocks audible autoplay, the mini-player should show an actionable message. Clicking Play or Instagram's video provides a fresh user gesture; the extension does not change browser autoplay policy.
7. Click the current entry again, and an entry from another playlist. The correct entry must remain selected after navigation, even if the outgoing page tries to save its old playback state.

## Collection regression checks

1. Navigate into Saved from Instagram without refreshing. Open an individual collection, then Start Collection from the popup.
2. Stop midway, close and reopen the popup, and Resume. Previously saved posts must not duplicate.
3. Reload Instagram midway and Resume. Completed batches must remain available.
4. Change tabs during collection. Background tabs pause traversal instead of falsely declaring completion.
5. Import into an active playlist. Check its count and a sample from the beginning and end. A 30-row page in the editor is a display page, not a collection limit.

## Playback speed investigation

Current cross-post navigation loads an Instagram document for each URL. No fixed 3–5-second wait is inserted before play; readiness events start playback as the video becomes available. The startup sound correction's timers do not delay play.

Next, measure click-to-navigation, content-script initialization, video appearance, and first playing event on cold and warm loads. Compare a native Instagram click with an extension transition. Evaluate native client-side navigation before adding prefetching or caching; signed media URLs and Instagram internals should not become long-term storage dependencies.

## Phase 2 interaction checks

1. Add a personal title, notes, and comma-separated tags to a post. Close and reopen the popup; confirm all metadata remains. Export/import must retain it too.
2. Select another playlist and search for a word from the first playlist's notes. Search results must include its playlist name; clicking a result opens the correct playlist and queue position.
3. Move a post up/down using the buttons. The browser announces the change and keeps keyboard focus on the moved post's notes button, including at list boundaries.
4. Open Queue in the floating player. Search, jump to another post, and page through a long queue. Shuffle must be reflected in queue order.
5. Use Tab to reach every control. Use the move handle's arrows to position the player; Shift moves farther. Alt+Shift+Left/Right changes posts unless editing text. Resize the window and confirm the player stays reachable.
6. Enable reduced motion in the OS. Animated gradients, decorative motion, and transitions should be suppressed.
7. End Session from either popup or player. Managed playback should pause and the player should disappear.
8. Test a post with a real link currently present in Instagram's page, then a saved URL without a corresponding link. The former can use native navigation; the latter must still load through a document fallback. Changing pages manually during a pending navigation must cancel the request.
9. Watch the player's last-post readiness time over several transitions. It measures local click-to-playing when available, not a network benchmark. No analytics or browsing data are sent off-device.

The responsive library preview was exercised with disposable sample posts, including note persistence, cross-playlist search, reorder focus, and horizontal overflow checks. Live authenticated Instagram navigation and browser autoplay restrictions still require a real-account check after reloading the extension and Instagram tab.

## Extension-update regression checks (1.2.1)

1. Reload the extension once and refresh Instagram to install the new content script. Historical errors from previous builds remain in Chrome's Errors view until cleared; they are not evidence that the updated script is generating new errors.
2. With the new player open, reload the extension again without refreshing Instagram. Return to the Instagram tab. The old player must retire and show a single reload prompt, without repeated `Extension context invalidated` messages.
3. Start collection and repeat the extension reload. The collector must cancel without attempting a final write through the invalidated runtime. Previously checkpointed batches remain available after refreshing Instagram.
4. After invalidation, a pending native-navigation fallback must not redirect the page. Dismiss the prompt or use Reload Instagram to reconnect.
5. For a local runtime simulation, run the development server and open `/tests/fixtures/context-reload.html` after building. Simulate extension reload, then Check retired script. The fixture should show zero API calls after invalidation and the actual content script's reload prompt.

Automated tests also verify synchronous throws, rejected and in-flight promises, cleanup idempotency, preserving real quota errors, and preventing fallback writes to Instagram's local storage.
