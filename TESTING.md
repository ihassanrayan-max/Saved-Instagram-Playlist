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
2. Check that the displayed extension version is **1.3.0**.
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
3. Open Edit and enter a new position, such as 1 to 100, then Save Changes. The post should move once and retain its metadata. An invalid position must not save a partial edit.
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

## Queue and media controls (1.3.0)

- Search the queue for a tag, creator, title, caption, or note. Confirm the result shows a readable title and labels the matching metadata. Example: “You Never Give Up” with “Tag: Demon Slayer”. Posts without a title should use their available caption before falling back to a shortcode.
- In the library, confirm each compact row has only an Edit action. Edit contains notes, tags, a direct position field, and Remove from Playlist with a separate confirmation. Cancellation must preserve the post.
- Collapse Posts, reopen it, scroll inside the bounded region, and toggle Expand List. Pagination remains available for long libraries.
- Click Pause Playlist in Settings while a reel is playing. It must pause the current post rather than restarting the first post. Refresh Instagram: it should remain paused. Play Playlist resumes that queue position.
- Toggle the mini-player's mute control twice. Verify actual audio and the control's label agree. Refresh while playing and while paused; both playback intent and sound preference should be restored. Instagram's recognizable sound button is used when available to help keep its own UI synchronized.
- Native autoplay attempts after an explicit pause must not silently resume the video. A deliberate native play action or our Play button may resume it.

Run `npm run test:player-fixture`, then open `/tests/fixtures/player-controls.html` in the development server for a disposable browser simulation. The fixture uses the real React player and playback logic with a mock extension runtime and media adapter; it does not establish live Instagram compatibility or produce real audio. Pause from its Settings control, simulate native autoplay, refresh, then test mute/unmute and queue search. Generated fixture bundles are excluded from Git and the extension package.

Live Instagram and real audible media still need a user-account smoke test; no universal reduction in Instagram reload time is claimed.
