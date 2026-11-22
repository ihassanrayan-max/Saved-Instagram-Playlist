import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Play, Pause, SkipForward, SkipBack, Shuffle, X, Minimize2, Settings, GripVertical, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPlaylist, subscribeLibrary, type PlaylistItem } from '@/utils/playlistStorage';
import { currentPostCode } from '@/instagram/adapter';
import { playPost, pausePost, preparePostNavigation, subscribePlayback } from '@/instagram/playback';
import { normalizeItem } from '../../public/playlist-model.js';
import { shouldStartPlayback } from '../../public/player-session.js';
import { navigatePost } from '@/instagram/navigation';
import { handlePlayerRequests } from '@/instagram/playerRequests';
import { extensionStorage, sendExtensionMessage, reportExtensionError } from '@/utils/extensionContext';

interface PlaylistMiniPlayerProps { onClose?: () => void }
interface PlaylistState {
  currentIndex: number; isPlaying: boolean; isShuffle: boolean;
  shuffledOrder: number[]; isMinimized: boolean;
  lastLoadMs?: number;
}
const initialState = (): PlaylistState => ({ currentIndex: 0, isPlaying: false, isShuffle: false, shuffledOrder: [], isMinimized: false });

export const PlaylistMiniPlayer = ({ onClose }: PlaylistMiniPlayerProps) => {
  const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
  const [playlistName, setPlaylistName] = useState<string | null>(null);
  const [state, setState] = useState<PlaylistState>(initialState);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const containerRef = useRef<HTMLDivElement>(null);
  const latest = useRef({ state, playlist, playlistName });
  const navigating = useRef(false);
  const managedPlayback = useRef(false);
  const pendingTarget = useRef<string | null>(null);
  const startedAt = useRef<number | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  latest.current = { state, playlist, playlistName };

  useEffect(() => {
    let disposed = false;
    let generation = 0;
    const load = async () => {
      const request = ++generation;
      try {
        const response = await sendExtensionMessage({ type: 'PLAYER_CONTEXT' });
        if (!response.ok) throw new Error(response.error);
        const { name, items, state: savedState } = response.data as { name: string | null; items: PlaylistItem[]; state?: Partial<PlaylistState> & { navigationShortcode?: string; navigationStartedAt?: number } };
        if (disposed || request !== generation) return;
        setPlaylist(items); setPlaylistName(name);
        const saved = savedState || {};
        const { navigationShortcode: _navigationShortcode, navigationStartedAt: _navigationStartedAt, ...restored } = saved;
        const code = currentPostCode();
        const index = items.findIndex(item => item.shortcode === code);
        if (name !== latest.current.playlistName) {
          managedPlayback.current = shouldStartPlayback(saved, code);
          startedAt.current = managedPlayback.current ? saved.navigationStartedAt || null : null;
        }
        setState(prev => {
          const next = name === latest.current.playlistName ? prev : { ...initialState(), ...restored, isPlaying: shouldStartPlayback(saved, code) };
          const order = next.shuffledOrder || [];
          return { ...next, currentIndex: index >= 0 ? index : Math.min(next.currentIndex, Math.max(0, items.length - 1)),
            shuffledOrder: order.length === items.length && new Set(order).size === items.length && order.every(i => i >= 0 && i < items.length) ? order : [] };
        });
        setLoaded(true);
      } catch (e) { if (!disposed) setError(e instanceof Error ? e.message : 'Could not load playlist.'); }
    };
    load();
    const unsubscribe = subscribeLibrary(load);
    return () => { disposed = true; unsubscribe(); };
  }, []);

  const persist = useCallback(async (next: PlaylistState & { navigationShortcode?: string; navigationStartedAt?: number }) => {
    const response = await sendExtensionMessage({ type: 'PLAYER_SET', args: { name: latest.current.playlistName, state: next } });
    if (!response.ok) throw new Error(response.error || 'Could not save playback position.');
  }, []);

  useEffect(() => {
    if (loaded && playlistName && !navigating.current) persist(state).catch(e => setError(e.message));
  }, [state, loaded, playlistName, persist]);

  const navigateToUrl = useCallback(async (url: string, next: PlaylistState, prepared = false) => {
    if (navigating.current) throw new Error('Please wait for the current post to open.');
    navigating.current = true;
    setTransitioning(true);
    const target = normalizeItem({ url }).shortcode;
    pendingTarget.current = target;
    managedPlayback.current = true;
    startedAt.current = Date.now();
    setError('');
    try {
      // Save before unloading; React effects may not run before navigation.
      if (!prepared) await persist({ ...next, navigationShortcode: target, navigationStartedAt: startedAt.current });
      preparePostNavigation(target);
      latest.current = { ...latest.current, state: next };
      setState(next);
      const mode = await navigatePost(url, !prepared);
      if (mode !== 'reload') {
        navigating.current = false; pendingTarget.current = null; setTransitioning(false);
        playPost(target);
        // Do not await: popup-initiated requests are acknowledged before the
        // worker can process another playback-state command.
        persist(next).catch(e => setError(e.message));
      }
      return mode;
    } catch (e) {
      navigating.current = false; pendingTarget.current = null; managedPlayback.current = false; setTransitioning(false);
      setState(prev => ({ ...prev, isPlaying: false }));
      setError(e instanceof Error ? e.message : 'Could not navigate.');
      throw e;
    }
  }, [persist]);

  useEffect(() => handlePlayerRequests(async request => {
    const items = request.name === latest.current.playlistName ? latest.current.playlist : await getPlaylist(request.name);
    const target = normalizeItem({ url: request.url }).shortcode;
    const index = items.findIndex(item => item.shortcode === target);
    if (index < 0) throw new Error('Post no longer exists in this playlist.');
    const next = { ...initialState(), currentIndex: index, isPlaying: true };
    latest.current = { state: next, playlist: items, playlistName: request.name };
    setPlaylist(items); setPlaylistName(request.name); setLoaded(true);
    return navigateToUrl(request.url, next, true);
  }), [navigateToUrl]);

  const step = useCallback((direction: number, automatic = false) => {
    const { state: current, playlist: items } = latest.current;
    if (!items.length) return;
    const order = current.isShuffle && current.shuffledOrder.length === items.length ? current.shuffledOrder : items.map((_, i) => i);
    const position = Math.max(0, order.indexOf(current.currentIndex));
    const nextPosition = position + direction;
    // A listening session ends at the end of the queue.
    if (automatic && nextPosition >= order.length) { setState(prev => ({ ...prev, isPlaying: false })); return; }
    const nextIndex = order[(nextPosition + order.length) % order.length];
    const next = { ...current, currentIndex: nextIndex, isPlaying: true };
    navigateToUrl(items[nextIndex].url, next).catch(() => {});
  }, [navigateToUrl]);

  useEffect(() => subscribePlayback(notice => {
    const { state: current, playlist: items } = latest.current;
    if (notice.type === 'route') {
      if (pendingTarget.current === notice.shortcode) {
        managedPlayback.current = true;
        return;
      }
      if (pendingTarget.current) return;
      managedPlayback.current = false;
      const index = items.findIndex(item => item.shortcode === notice.shortcode);
      setState(prev => ({ ...prev, currentIndex: index >= 0 ? index : prev.currentIndex, isPlaying: false }));
      return;
    }
    if (notice.shortcode !== items[current.currentIndex]?.shortcode) return;
    if (notice.type === 'ready' && startedAt.current && managedPlayback.current) {
      const elapsed = Date.now() - startedAt.current;
      startedAt.current = null;
      if (elapsed >= 0 && elapsed < 120000) setState(prev => ({ ...prev, lastLoadMs: elapsed }));
    }
    if (notice.type === 'ended' && current.isPlaying && managedPlayback.current) {
      step(1, true);
    } else if (notice.type === 'play' || notice.type === 'pause') {
      setState(prev => ({ ...prev, isPlaying: notice.type === 'play' }));
    } else if (notice.type === 'error') {
      setError(notice.message || 'Video unavailable. You can skip to the next post.');
      setState(prev => ({ ...prev, isPlaying: false }));
    }
  }), [step]);

  const code = playlist[state.currentIndex]?.shortcode;
  useEffect(() => {
    if (!loaded || !code || !state.isPlaying || !managedPlayback.current || currentPostCode() !== code) return;
    playPost(code);
    const timeout = setTimeout(() => {
      if (!document.querySelector('main video, [role="dialog"] video')) {
        setError('No video appeared. This may be a photo, an unavailable post, or a login screen. You can skip to the next post.');
        setState(prev => ({ ...prev, isPlaying: false }));
      }
    }, 15000);
    return () => clearTimeout(timeout);
  }, [loaded, code, state.isPlaying]);

  const handlePlay = () => {
    const { state: current, playlist: items } = latest.current;
    const item = items[current.currentIndex];
    if (!item) return;
    managedPlayback.current = true;
    setError('');
    if (currentPostCode() === item.shortcode) { setState(prev => ({ ...prev, isPlaying: true })); playPost(item.shortcode); }
    else navigateToUrl(item.url, { ...current, isPlaying: true }).catch(() => {});
  };
  const handlePause = () => { pausePost(latest.current.playlist[latest.current.state.currentIndex]?.shortcode); setState(prev => ({ ...prev, isPlaying: false })); };
  const handleNext = () => step(1);
  const handlePrevious = () => step(-1);
  const handleShuffle = () => setState(prev => {
    const order = playlist.map((_, i) => i).filter(i => i !== prev.currentIndex);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]];
    }
    return { ...prev, isShuffle: !prev.isShuffle, shuffledOrder: [prev.currentIndex, ...order] };
  });
  const handleMinimize = () => setState(prev => ({ ...prev, isMinimized: !prev.isMinimized }));

  const [queueOpen, setQueueOpen] = useState(false);
  const [queueQuery, setQueueQuery] = useState('');
  const [queuePage, setQueuePage] = useState(0);
  useEffect(() => setQueuePage(0), [queueQuery, playlistName]);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [positionLoaded, setPositionLoaded] = useState(false);
  const constrain = useCallback((point: { x: number; y: number }) => {
    const rect = containerRef.current?.getBoundingClientRect();
    return { x: Math.max(8, Math.min(point.x, innerWidth - (rect?.width || 320) - 8)), y: Math.max(8, Math.min(point.y, innerHeight - (rect?.height || 160) - 8)) };
  }, []);
  useEffect(() => {
    extensionStorage.get('player_v2_position').then(rows => {
      const saved = rows.player_v2_position as { x: number; y: number } | undefined;
      if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) setPosition(constrain(saved));
      setPositionLoaded(true);
    }).catch(() => setPositionLoaded(true));
    const resize = () => setPosition(prev => constrain(prev));
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [constrain]);
  useEffect(() => {
    if (!positionLoaded) return;
    const timer = setTimeout(() => { extensionStorage.set({ player_v2_position: position }).catch(reportExtensionError); }, 200);
    return () => clearTimeout(timer);
  }, [position, positionLoaded]);
  useEffect(() => { setPosition(prev => constrain(prev)); }, [queueOpen, state.isMinimized, constrain]);
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (!event.altKey || !event.shiftKey || event.repeat || event.composedPath().some(node => node instanceof Element && node.matches('input,textarea,select,[contenteditable="true"]'))) return;
      if (event.key === 'ArrowRight') { event.preventDefault(); step(1); }
      else if (event.key === 'ArrowLeft') { event.preventDefault(); step(-1); }
    };
    window.addEventListener('keydown', keyboard);
    return () => window.removeEventListener('keydown', keyboard);
  }, [step]);
  const endSession = async () => {
    pausePost(latest.current.playlist[latest.current.state.currentIndex]?.shortcode);
    try {
      const response = await sendExtensionMessage({ type: 'END_SESSION' });
      if (!response.ok) throw new Error(response.error || 'Could not end this session.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not end this session.'); }
  };
  const openSettings = () => {
    sendExtensionMessage({ type: 'OPEN_POPUP' }).then(response => {
      if (!response.ok) setError('Click the extension icon in the browser toolbar to open Playlist Manager.');
    }).catch(() => setError('Click the extension icon in the browser toolbar to open Playlist Manager.'));
  };
  const currentItem = playlist[state.currentIndex];
  const queueOrder = state.isShuffle && state.shuffledOrder.length === playlist.length ? state.shuffledOrder : playlist.map((_, index) => index);
  const queue = queueOrder.map(index => ({ item: playlist[index], index })).filter(({ item }) => [item.title, item.username, item.caption, item.shortcode, item.notes, ...(item.tags || [])].join(' ').toLowerCase().includes(queueQuery.trim().toLowerCase()));
  const queuePages = Math.max(1, Math.ceil(queue.length / 30));
  const queueCurrentPage = Math.min(queuePage, queuePages - 1);
  if (!playlistName || !playlist.length) return null;
  return <aside ref={containerRef} role="region" aria-label="Instagram playlist player"
    style={{ position: 'fixed', left: position.x, top: position.y, zIndex: 2147483646, width: state.isMinimized ? 56 : 'min(340px, calc(100vw - 16px))' }}
    className="player-surface overflow-hidden rounded-2xl border border-white/15 bg-zinc-950 text-white shadow-xl">
    {state.isMinimized ? <Button className="h-14 w-14 gradient-instagram rounded-2xl" aria-label="Expand playlist player" onClick={handleMinimize}><Play /></Button> : <>
      <header className="flex items-center gap-2 border-b border-white/10 px-3 py-3">
        <button className="touch-none rounded p-1.5 text-white/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" aria-label="Move player. Arrow keys move it; Enter resets position."
          onPointerDown={event => {
            if (event.button !== 0) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = { x: event.clientX - position.x, y: event.clientY - position.y };
          }}
          onPointerMove={event => { if (drag.current) setPosition(constrain({ x: event.clientX - drag.current.x, y: event.clientY - drag.current.y })); }}
          onPointerUp={event => { drag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
          onPointerCancel={() => { drag.current = null; }}
          onKeyDown={event => {
            const delta = event.shiftKey ? 40 : 10;
            const offsets: Record<string, [number, number]> = { ArrowLeft: [-delta, 0], ArrowRight: [delta, 0], ArrowUp: [0, -delta], ArrowDown: [0, delta] };
            if (offsets[event.key]) { event.preventDefault(); const [x, y] = offsets[event.key]; setPosition(prev => constrain({ x: prev.x + x, y: prev.y + y })); }
            if (event.key === 'Enter') { event.preventDefault(); setPosition({ x: 20, y: 20 }); }
          }}><GripVertical size={16} /></button>
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{playlistName}</p><p className="text-xs text-white/60">{state.currentIndex + 1} of {playlist.length}</p></div>
        <Button size="icon" variant="ghost" className="h-8 w-8 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Open Playlist Manager" onClick={openSettings}><Settings /></Button>
        <Button size="icon" variant="ghost" className="h-8 w-8 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Minimize player" onClick={handleMinimize}><Minimize2 /></Button>
        {onClose && <Button size="icon" variant="ghost" className="h-8 w-8 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Hide player" onClick={onClose}><X /></Button>}
      </header>
      <div className="space-y-4 p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-white/10" aria-hidden="true">{currentItem?.thumbnail ? <img src={currentItem.thumbnail} alt="" className="h-full w-full object-cover" /> : <Play size={20} />}</div>
          <div className="min-w-0"><p className="line-clamp-2 text-sm font-medium">{currentItem?.title || currentItem?.username || 'Instagram Post'}</p><p className="truncate text-xs text-white/60">{currentItem?.notes || currentItem?.caption || currentItem?.shortcode}</p></div>
        </div>
        <div className="flex items-center justify-center gap-3" role="group" aria-label="Playback controls">
          <Button size="icon" variant="ghost" className={cn('h-10 w-10 hover:bg-white/10 hover:text-white', state.isShuffle ? 'text-fuchsia-300' : 'text-white/60')} aria-label="Shuffle playlist" aria-pressed={state.isShuffle} onClick={handleShuffle} disabled={transitioning}><Shuffle /></Button>
          <Button size="icon" variant="ghost" className="h-10 w-10 text-white hover:bg-white/10 hover:text-white" aria-label="Previous post" aria-keyshortcuts="Alt+Shift+ArrowLeft" onClick={handlePrevious} disabled={transitioning}><SkipBack /></Button>
          <Button size="icon" className="h-12 w-12 rounded-full bg-white text-zinc-950 hover:bg-white/90" aria-label={state.isPlaying ? 'Pause video' : 'Play video'} onClick={state.isPlaying ? handlePause : handlePlay} disabled={transitioning}>{transitioning ? <Loader2 className="animate-spin" /> : state.isPlaying ? <Pause /> : <Play />}</Button>
          <Button size="icon" variant="ghost" className="h-10 w-10 text-white hover:bg-white/10 hover:text-white" aria-label="Next post" aria-keyshortcuts="Alt+Shift+ArrowRight" onClick={handleNext} disabled={transitioning}><SkipForward /></Button>
        </div>
        <p role="status" aria-live="polite" className="text-center text-xs text-white/60">{transitioning ? 'Opening post…' : state.lastLoadMs !== undefined ? `Last post ready in ${(state.lastLoadMs / 1000).toFixed(1)}s` : 'Return to something you saved.'}</p>
        {error && <div role="alert" className="space-y-2 rounded-lg bg-white/10 p-3 text-sm"><p>{error}</p><div className="flex gap-2"><Button size="sm" variant="outline" className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white" onClick={handlePlay}>Try Again</Button><Button size="sm" variant="outline" className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white" onClick={handleNext}>Skip Post</Button></div></div>}
        <div className="flex items-center justify-between border-t border-white/10 pt-3"><button className="rounded text-xs text-white/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" aria-expanded={queueOpen} aria-controls="playlist-queue" onClick={() => setQueueOpen(!queueOpen)}>Queue <span aria-hidden="true">{queueOpen ? '−' : '+'}</span></button><button className="rounded text-xs text-white/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" onClick={endSession}>End Session</button></div>
      </div>
      {queueOpen && <div id="playlist-queue" className="border-t border-white/10 px-4 pb-3 pt-3"><label className="block space-y-2"><span className="text-xs text-white/60">Find a post in this playlist</span><Input value={queueQuery} onChange={event => setQueueQuery(event.target.value)} className="h-9 border-white/20 bg-white/5 text-white placeholder:text-white/40" type="search" placeholder="Title, creator, or tag" /></label><ol className="mt-2 max-h-44 space-y-1 overflow-y-auto" aria-label="Playlist queue">{queue.slice(queueCurrentPage * 30, (queueCurrentPage + 1) * 30).map(({ item, index }) => <li key={item.shortcode}><button disabled={transitioning} aria-current={index === state.currentIndex ? 'true' : undefined} className={cn('flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white', index === state.currentIndex ? 'bg-white/10 text-fuchsia-200' : 'text-white/75')} onClick={() => navigateToUrl(item.url, { ...state, currentIndex: index, isPlaying: true }).catch(() => {})}><span className="w-5 shrink-0 tabular-nums text-white/40">{index + 1}</span><span className="truncate">{item.title || item.username || item.shortcode}</span></button></li>)}</ol>{!queue.length && <p className="py-3 text-xs text-white/60">No matching posts.</p>}{queuePages > 1 && <nav aria-label="Queue pages" className="mt-2 flex justify-between gap-2 text-xs"><button className="rounded p-1 text-white/70 disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-white" disabled={queueCurrentPage === 0} onClick={() => setQueuePage(queueCurrentPage - 1)}>Previous</button><span className="p-1 text-white/50">{queueCurrentPage + 1} / {queuePages}</span><button className="rounded p-1 text-white/70 disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-white" disabled={queueCurrentPage + 1 >= queuePages} onClick={() => setQueuePage(queueCurrentPage + 1)}>Next</button></nav>}</div>}
    </>}
  </aside>;
};
