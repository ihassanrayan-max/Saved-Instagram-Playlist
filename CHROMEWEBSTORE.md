# Chrome Web Store publication

Version 1.4.1. The upload was accepted as a Chrome Web Store draft. Listing setup is in progress; it has not been submitted for review.

**Draft item ID:** `kpphcabidgofolkipohnflpfimjnhefp`.

## Listing

**Name:** Instagram Video Playlist

**Short description:** Turn your Instagram saved collections into interactive video playlists.

**Category:** Productivity. **Language:** English.

**Single purpose:** Organize and revisit Instagram saved posts as searchable playlists.

### Detailed description

Return to the Instagram posts you saved for learning, practical reference, motivation, or a particular feeling.

Collect links from a saved collection, organize playlists, search titles and notes, and tag the posts you want to find again. Open a post on Instagram and control it from a floating player with pause, previous/next, shuffle, and a searchable queue.

Enable autoplay to continue to the next post, or turn it off to loop the current reel. Posts start with sound enabled when browser playback rules allow it. You can mute or pause at any time.

Your library stays in your browser. Export it as JSON to keep a portable copy. The extension does not change your Instagram saves or ask for your password. Original posts must remain accessible to your signed-in Instagram account.

Independent project; not affiliated with or endorsed by Instagram or Meta.

## Permissions

- `storage`: Save playlists, titles, notes, tags, collection checkpoints, player position, and temporary playback state.
- `tabs`: Find and reuse the appropriate Instagram tab when opening a playlist entry.
- `https://www.instagram.com/*`: Read links from saved collections, show playlist controls, and control the selected video's playback.

No access to unrelated websites is requested. No cookies, password access, analytics service, or remote executable code is used. The stylesheet is exposed only to Instagram so the floating controls can load their packaged styles.

## Privacy and support

The data handling description is in [PRIVACY.md](PRIVACY.md). After this revision is pushed, the public policy is available at:

https://github.com/ihassanrayan-max/insta-saved-playlist/blob/main/PRIVACY.md

Support: https://github.com/ihassanrayan-max/insta-saved-playlist/issues

Homepage: https://github.com/ihassanrayan-max/insta-saved-playlist

The store data-use form must cover stored post references, website content, and user-entered notes. Local storage does not mean that no user data is handled. Playing posts and loading thumbnails makes normal requests to Instagram and the hosts in the thumbnail URLs. Exports can contain personal notes.

## Assets and packaging

The package contains 16, 48, and 128-pixel PNG icons, validated by the build. Three current 1280 x 800 library screenshots and a 440 x 280 promotional tile are in `store-assets/`. They use only approved Useful tools post references with demonstration annotations; see `store-assets/README.md` for provenance.

Run `npm ci`, `npm test`, `npm run lint`, and `npm run build`, then complete [the Instagram smoke test](TESTING.md). Zip only the contents of `dist`; `manifest.json` must be at the archive root. Do not include source files, tests, personal exports, or editor settings.

## Before submission

- Upload the reviewed current screenshots and promotional tile from `store-assets/`.
- Supply a monitored publisher contact email and confirm the publisher display name.
- Select visibility and distribution regions in the developer dashboard.
- Verify the public privacy-policy URL and complete the data-use declarations.
- Complete the authenticated playback/collection smoke test on the final package.
- Record the demo video and verify its public links before promotion.

Instagram layout changes, unavailable posts, and Chrome audible-autoplay restrictions remain external dependencies. Do not claim offline playback, mobile support, account-wide synchronization, or guaranteed loading times.

## Unpublished version history

- **1.4.1:** Clearer search, editing, collection, and autoplay instructions; current store images.
- **1.4.0:** Autoplay toggle with native looping, unmuted starts and reloads, reduced dependencies, documentation and permission cleanup.
- **1.3.0:** Queue match details, compact editing, direct position changes, pause controls, and sound controls. Subsequent fix recognizes Instagram's plural reels routes.
- **1.2.1:** Extension invalidation handling and icon/package validation.
- **1.2.0:** Search, personal metadata, queue navigation, and accessibility improvements.
