import { collectionSource, isSavedPage, scrollContainer, visiblePosts } from './adapter';
import { checkpoint, clearCollection, emptyCollection, readCollection, readCollectionItems, type CollectionSnapshot } from './collectionStorage';
import type { PlaylistItem } from '@/utils/playlistStorage';
import { isContextInvalidation } from '@/utils/extensionContext';

export function abortableDelay(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new DOMException('Stopped', 'AbortError')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
  });
}

export class Collector {
  private controller?: AbortController;
  private job?: Promise<void>;
  private snapshot?: CollectionSnapshot;
  private disposed = false;
  dispose() { this.disposed = true; this.controller?.abort(); }

  async state() {
    const source = collectionSource();
    if (this.snapshot?.source === source && this.snapshot.status === 'error') return this.snapshot;
    const snapshot = await readCollection(source);
    const locks = await navigator.locks.query();
    const running = locks.held?.some(lock => lock.name === `ig-playlist:${source}`);
    if (snapshot.status === 'collecting' && !running) {
      return { ...snapshot, status: 'interrupted', message: 'Collection was interrupted. Resume to continue.' };
    }
    return snapshot;
  }

  async start(resume: boolean) {
    if (this.disposed) throw new Error('Reload Instagram before collecting again.');
    if (this.job) throw new Error('A collection is already running in this tab.');
    if (!isSavedPage()) throw new Error('Open an individual Instagram saved collection first.');
    const source = collectionSource();
    // Locks prevent two tabs from writing the same collection concurrently.
    let began = false;
    let ready: () => void;
    let fail: (error: unknown) => void;
    const started = new Promise<void>((resolve, reject) => { ready = resolve; fail = reject; });
    this.controller = new AbortController();
    const signal = this.controller.signal;
    this.job = navigator.locks.request(`ig-playlist:${source}`, { ifAvailable: true }, async lock => {
      if (!lock) throw new Error('This collection is already being collected in another tab.');
      if (!resume) await clearCollection(source);
      let snapshot = resume ? await readCollection(source) : emptyCollection(source);
      const known = new Set((await readCollectionItems(snapshot)).map(item => item.shortcode));
      const scanned = new Set<string>();
      let pending: PlaylistItem[] = [];
      snapshot = { ...snapshot, status: 'collecting', message: undefined };
      this.snapshot = snapshot;
      // Rescan from the top on resume: lazy-loaded/virtualized pages cannot
      // reliably restore a previously saved pixel offset after a reload.
      scrollContainer().scrollTo({ top: 0, behavior: 'instant' });
      let lastProgress = Date.now();
      let bottomSince = 0;
      try {
        snapshot = await checkpoint(snapshot, []);
        began = true;
        ready();
        while (!signal.aborted) {
          if (collectionSource() !== source) {
            snapshot.status = 'interrupted';
            snapshot.message = 'The page changed. Return to this collection to resume.';
            break;
          }
          if (document.hidden) {
            await abortableDelay(1000, signal);
            lastProgress = Date.now(); bottomSince = 0;
            continue;
          }
          for (const item of visiblePosts()) {
            // Traversing already saved posts is progress during a resumed scan.
            if (!scanned.has(item.shortcode)) { scanned.add(item.shortcode); lastProgress = Date.now(); }
            if (!known.has(item.shortcode)) {
              known.add(item.shortcode); pending.push(item); lastProgress = Date.now();
            }
          }
          const container = scrollContainer();
          snapshot = { ...snapshot, count: known.size, scrollTop: container.scrollTop };
          if (pending.length) {
            snapshot = await checkpoint(snapshot, pending);
            pending = [];
          }
          const bottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 8;
          if (bottom) bottomSince ||= Date.now();
          else bottomSince = 0;
          const idle = Date.now() - lastProgress;
          if (bottomSince && Date.now() - bottomSince >= 15000 && idle >= 15000) {
            snapshot.status = known.size ? 'complete' : 'stalled';
            snapshot.message = known.size
              ? 'Reached the visible end; no additional posts appeared for 15 seconds. Resume if Instagram loads more.'
              : 'No posts appeared. Check that an individual collection is open and Instagram has loaded it.';
            break;
          }
          if (!bottom && idle >= 30000) {
            snapshot.status = 'stalled';
            snapshot.message = 'No new posts appeared for 30 seconds. Check Instagram and resume.';
            break;
          }
          container.scrollBy({ top: Math.max(100, container.clientHeight * 0.65), behavior: 'instant' });
          await abortableDelay(1000, signal);
        }
        if (signal.aborted) { snapshot.status = 'stopped'; snapshot.message = 'Stopped. Collected posts are saved; resume at any time.'; }
      } catch (error) {
        if (isContextInvalidation(error)) this.disposed = true;
        if (!began) throw error;
        if (signal.aborted) snapshot.status = 'stopped';
        else { snapshot.status = 'error'; snapshot.message = error instanceof Error ? error.message : 'Collection failed.'; }
      } finally {
        if (began && !this.disposed) {
          try {
            await checkpoint(snapshot, pending);
            this.snapshot = undefined;
          } catch (error) {
            if (isContextInvalidation(error)) this.disposed = true;
            else {
              const saved = await readCollection(source);
              this.snapshot = { ...saved, status: 'error', message: `Could not save progress: ${error instanceof Error ? error.message : 'Storage unavailable'}. Free storage space and resume.` };
            }
          }
        } else this.snapshot = undefined;
      }
    }).catch(error => {
      if (!began) fail(error);
      else if (!isContextInvalidation(error)) console.error('Collection checkpoint failed:', error);
    }).finally(() => { this.job = undefined; this.controller = undefined; });
    return started;
  }

  async stop() { this.controller?.abort(); await this.job; }
  async clear() {
    await this.stop();
    await navigator.locks.request(`ig-playlist:${collectionSource()}`, { ifAvailable: true }, async lock => {
      if (!lock) throw new Error('Stop the collection in the other tab before clearing it.');
      await clearCollection(collectionSource());
    });
  }
}
