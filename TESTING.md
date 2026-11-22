# Verification

## Automated checks

```sh
npm ci
npm test
npm run lint
npm run build
git diff --check
```

Tests cover URL validation and aliases, concurrent storage writes, imports, metadata and position edits, collection checkpoints and interruption, navigation fallback, stale document writes, pause restoration, sound controls, native looping, and extension invalidation.

The build checks TypeScript, creates the popup and content script, and validates manifest paths and icon dimensions. Output belongs in `dist`; do not commit it.

## Instagram smoke test

Reload the unpacked extension and refresh Instagram before testing. Use accessible reels. Repeat playback checks on both `/reel/` and redirected `/reels/` pages.

1. Create and activate a playlist. Navigate into Saved without refreshing, enter a collection, and start collection.
2. Stop midway, reopen the popup, and resume. Import the results and spot-check the first and last entries. Re-importing must not duplicate posts.
3. Reload during collection and resume. Existing batches must survive. A hidden tab should pause traversal; a changed collection should interrupt it.
4. Open a playlist entry. Test previous/next, queue selection, shuffle, and Settings and floating-player pause/resume. Pause, reload Instagram, and confirm it remains paused.
5. Mute the current reel. Open another entry, use next/previous, resume through the extension, and reload while playing. Each start should request sound enabled. Manual mute/unmute must work. Browser-blocked audible playback must show an actionable error.
6. With **Autoplay next post** on, let a reel finish: advance once to the next item, then stop at the end of the queue. With autoplay off, let the reel finish twice: it must loop natively with the same URL/document and keep the playlist active. Toggle while playing and paused, then reload and check the preference.
7. Search each metadata field and verify match labels. Edit notes and move a post directly to another position. Invalid positions must not save a partial edit. Cancel deletion and confirm the post remains.
8. Collapse, scroll, expand, and paginate the post list. Check keyboard access, focus, reduced motion, and player position after resizing.
9. End Session: playback pauses and the player disappears. Unavailable posts should allow retry or skip.
10. Reload the extension without refreshing Instagram. The old script should retire and offer one reload prompt without repeated context-invalidated errors.

## Disposable browser fixtures

```sh
npm run test:player-fixture
npm run dev
```

Open `/tests/fixtures/player-controls.html`. It renders the real player and media controller against a fake extension runtime and media adapter. Test Settings pause/resume, mute/unmute, autoplay on/off, simulated video end, queue search, and reload. It produces no real audio and accesses no Instagram account.

Open `/tests/fixtures/context-reload.html` after a build to test retiring the bundled content script against a fake runtime. After invalidation, it should make no further extension API calls.

`tests/instagram-adapter.test.js` also exercises the production adapter, including the plural reels route. Generated fixture bundles are ignored and are not packaged.

## Release

Run the checks, complete the Instagram smoke test, and review the diff before pushing. Zip the contents of `dist`, with `manifest.json` at the archive root, rather than the repository. See [CHROMEWEBSTORE.md](CHROMEWEBSTORE.md).
