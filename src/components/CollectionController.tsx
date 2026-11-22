import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { getActivePlaylistName, addUrlsToPlaylist, subscribeLibrary } from '@/utils/playlistStorage';
import { collectionKey, readCollectionItems, type CollectionSnapshot } from '@/instagram/collectionStorage';
import { selectedInstagramTab } from '@/utils/extensionTab';
import { extensionCall, listenExtensionEvent } from '@/utils/extensionContext';

export const CollectionController = () => {
  const [snapshot, setSnapshot] = useState<CollectionSnapshot | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  const send = useCallback(async (message: ExtensionMessage) => {
    const id = await selectedInstagramTab();
    let response: ExtensionResponse;
    try { response = await extensionCall(() => chrome.tabs.sendMessage(id, message)); }
    catch { throw new Error('The extension cannot reach this Instagram tab. Reload the tab after installing or updating the extension.'); }
    if (!response?.ok) throw new Error(response?.error || 'Instagram did not acknowledge the command.');
    return response.data;
  }, []);
  const refresh = useCallback(async () => {
    try { setSnapshot(await send({ type: 'GET_COLLECTION_STATE' }) as CollectionSnapshot); setError(''); setInfo(''); }
    catch (e) {
      const message = e instanceof Error ? e.message : 'Could not load collection.';
      if (/^Open (Instagram|the installed extension)/.test(message)) { setInfo(message); setError(''); }
      else setError(message);
    }
  }, [send]);

  useEffect(() => {
    const load = () => { getActivePlaylistName().then(setActive).catch(e => setError(e.message)); };
    load(); refresh();
    return subscribeLibrary(load);
  }, [refresh]);
  useEffect(() => {
    if (!snapshot || typeof chrome === 'undefined' || !chrome.storage) return;
    const listener = (changes: Record<string, StorageChange>, area: string) => {
      if (area === 'local' && changes[collectionKey(snapshot.source)]) refresh();
    };
    const unsubscribe = listenExtensionEvent(() => chrome.storage.onChanged, listener);
    // Only the small status is polled during a run, to surface storage failures
    // that cannot themselves emit a storage change.
    const timer = snapshot.status === 'collecting' ? setInterval(refresh, 3000) : undefined;
    return () => { unsubscribe(); clearInterval(timer); };
  }, [snapshot, refresh]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true); setError('');
    try { await action(); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Operation failed.'); }
    finally { setBusy(false); }
  };
  const collecting = snapshot?.status === 'collecting';
  return (
    <div className="w-full space-y-4 border-t pt-4 mt-4">
      <div><h3 className="font-semibold text-lg">Playlist Controller</h3><p className="text-sm text-muted-foreground">Open a saved collection in Instagram’s active tab.</p></div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {info && <p className="text-sm text-muted-foreground">{info}</p>}
      {snapshot && <div className="p-4 bg-muted rounded-lg space-y-2" role="status" aria-live="polite">
        <p className="capitalize">{snapshot.status} · {snapshot.count} posts saved</p>
        {snapshot.message && <p className="text-sm text-muted-foreground">{snapshot.message}</p>}
        {snapshot.count > 0 && <p className="text-xs break-all text-muted-foreground">{snapshot.source}</p>}
      </div>}
      <div className="space-y-2">
        {collecting
          ? <Button disabled={busy} className="w-full" variant="destructive" onClick={() => run(() => send({ type: 'STOP_COLLECTION' }))}>Stop Collection</Button>
          : <>
            <Button disabled={busy || !!info} className="w-full" onClick={() => run(() => send({ type: 'START_COLLECTION', resume: false }))}>{snapshot?.count ? 'Collect Again (fresh scan)' : 'Start Collection'}</Button>
            {!!snapshot?.count && <Button disabled={busy} className="w-full" variant="secondary" onClick={() => run(() => send({ type: 'START_COLLECTION', resume: true }))}>Resume Collection</Button>}
          </>}
        <Button disabled={busy} className="w-full" variant="outline" onClick={() => run(refresh)}>Refresh Status</Button>
        {!!snapshot?.count && <Button disabled={busy || collecting || !active} className="w-full" onClick={() => run(async () => {
          if (!active || !snapshot) return;
          await addUrlsToPlaylist(active, await readCollectionItems(snapshot));
        })}>Import {snapshot.count} Posts to {active || 'an Active Playlist'}</Button>}
        {!active && <p className="text-xs text-muted-foreground">Activate a playlist above before importing.</p>}
        {!!snapshot?.count && <Button disabled={busy || collecting} className="w-full" variant="outline" onClick={() => run(() => send({ type: 'CLEAR_COLLECTION' }))}>Clear Collected URLs</Button>}
      </div>
      <p className="text-xs text-muted-foreground">Progress saves as posts appear. Resume merges new posts; a fresh scan rebuilds the collected list. Your Instagram saves are never modified.</p>
    </div>
  );
};
