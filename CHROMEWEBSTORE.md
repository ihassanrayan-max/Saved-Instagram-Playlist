# Chrome Web Store Listing — Instagram Video Playlist

Last updated: 2026-11-21. Draft release tracking only; nothing has been submitted or published.

## Store listing

**Extension name:** Instagram Video Playlist

**Short description:** Turn your Instagram saved collections into interactive video playlists.

**Detailed description draft:**

Organize Instagram saved posts into playlists you can revisit for knowledge, motivation, or a particular feeling.

Collect post links from a saved collection, search across your playlists, add personal titles and notes, and organize posts with tags. Play a selected post on Instagram and use the floating player to move through your queue, shuffle posts, or end your session.

Your playlists and notes are stored in your browser. Export and import your library as a JSON file. Instagram saves are not modified. You need access to the original Instagram posts; removed or restricted content may not play.

**Category:** Productivity (draft).

**Single purpose:** Organize and revisit Instagram saved posts as searchable playlists.

**Primary language:** English.

## Graphics and assets

- `public/icon16.png`, `public/icon48.png`, and `public/icon128.png`: verified actual PNGs at 16×16, 48×48, and 128×128. Existing artwork retained; previous files were 512×512 JPEGs with PNG filenames.
- Store screenshots and promotional graphics: not prepared. Capture the library, floating queue, and collection flow during the publication phase.
- Required store screenshot sizes and final visual review remain publication work.

## Permissions justification

- `storage`: Save the user's playlists, personal titles, notes, tags, collection progress, player position, and temporary playback session.
- `tabs`: Identify the active Instagram tab and reuse an Instagram tab when the user opens a playlist entry.
- `activeTab`: Currently declared. Review removal before publication because the present static content script uses scoped Instagram host access.
- `https://www.instagram.com/*`: Read post links from the selected saved collection, display the floating playlist controls, and control playback when the user requests it. No access to other website origins is requested.
- `content.css` is exposed only to Instagram so the isolated floating player can load its own stylesheet.

## Privacy and data use

The extension stores selected Instagram post URLs, available creator names/captions/thumbnails, user-created playlist names, personal titles, notes, and tags locally. Collection checkpoints are local. Playback state and timings are temporary browser-session data.

There is no extension analytics service, account system, or custom backend. No passwords or authentication tokens are collected by this extension. Playing original posts and loading their thumbnails uses Instagram and its media infrastructure; normal Instagram network traffic continues. JSON export creates a local file containing the user's library and notes, and sharing that file is up to the user.

Arbitrary personal information can appear in free-text notes or saved content. Final store data-use classifications must accurately cover that information before submission; do not claim that no user data is handled merely because it is stored locally.

Current code does not sell data, use it for unrelated purposes, or use it for lending/credit decisions. The publisher must review and complete the store's declarations before submission.

## Privacy policy

A public privacy policy URL has not been supplied or published. This is a submission blocker for the publication phase.

## Distribution

Visibility and regions have not been selected. This project is currently tested as an unpacked extension.

## Developer information

Publisher name, public contact address, support URL, and homepage require the user's choices during publication preparation. No personal contact information has been inferred from the computer or account.

## Version history

- **1.2.1 — 2026-11-21 — Local build:** Retire invalidated content scripts, cancel outstanding work, prevent stale storage fallback, and offer a reload prompt. Correct icon formats and dimensions and validate them during packaging.
- **1.2.0 — 2026-11-21 — Local build:** Library search, personal metadata, queue controls, native-link navigation with fallback, and accessibility improvements.

## Review notes

No store submission or rejection is recorded.

### Known limitations

- An Instagram tab must reload to reconnect after Chrome replaces or disables the extension's runtime. The extension detects invalidation and retires the old script rather than repeatedly calling disconnected APIs.
- A tab still running a pre-1.2.1 content script needs one manual refresh to pick up the fix.
- Instagram can change its DOM and media behavior. Native-link navigation is opportunistic; other post transitions use a full-document fallback.
- Browser autoplay rules may require a user click for sound.
- Final authenticated Instagram smoke testing, store screenshots, privacy policy publication, permission review, and release packaging remain separate publication tasks.
