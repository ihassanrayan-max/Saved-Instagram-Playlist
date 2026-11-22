import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Play, Plus, Search, Pencil, Trash2, Download, Upload, ListMusic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { normalizeItem, validatePlaylists } from '../../public/playlist-model.js';
import { searchLibrary, postTitle } from '../../public/library-view.js';
import { getAllPlaylists, getActivePlaylistName, setActivePlaylistName, subscribeLibrary, createPlaylist, renamePlaylist, deletePlaylist, addUrlsToPlaylist, removeUrlsFromPlaylist, annotatePlaylistItem, saveAllPlaylists, type PlaylistItem, type PlaylistsData } from '@/utils/playlistStorage';
import { cn } from '@/lib/utils';
import { sendExtensionMessage, isExtensionEnvironment } from '@/utils/extensionContext';

type NotesEditor = { name: string; item: PlaylistItem; title: string; notes: string; tags: string; position: string };
type ImportPreview = { playlists: PlaylistsData; active: string | null };

export const PlaylistManager = () => {
  const [playlists, setPlaylists] = useState<PlaylistsData>({});
  const [active, setActive] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const selectedRef = useRef(selected); selectedRef.current = selected;
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [nameDialog, setNameDialog] = useState<'create' | 'rename' | null>(null);
  const [nameValue, setNameValue] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editor, setEditor] = useState<NotesEditor | null>(null);
  const [deletePost, setDeletePost] = useState<{ name: string; item: PlaylistItem } | null>(null);
  const [expandedPosts, setExpandedPosts] = useState(false);
  const postDisclosure = useRef<HTMLDetailsElement>(null);
  const [importing, setImporting] = useState<ImportPreview | null>(null);
  const [manualUrl, setManualUrl] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const generation = useRef(0);
  const results = useMemo(() => searchLibrary(playlists, selected, query), [playlists, selected, query]);
  const pages = Math.max(1, Math.ceil(results.length / 30));
  const currentPage = Math.min(page, pages - 1);
  const rows = results.slice(currentPage * 30, (currentPage + 1) * 30);
  const names = Object.keys(playlists);
  const total = Object.values(playlists).reduce((count, items) => count + items.length, 0);

  const load = useCallback(async () => {
    const request = ++generation.current;
    const [library, activeName] = await Promise.all([getAllPlaylists(), getActivePlaylistName()]);
    if (request !== generation.current) return;
    setPlaylists(library); setActive(activeName);
    const previous = selectedRef.current;
    setSelected(previous && Object.prototype.hasOwnProperty.call(library, previous) ? previous : activeName || Object.keys(library)[0] || null);
    setLoading(false);
  }, []);
  useEffect(() => {
    const requestGeneration = generation;
    const refresh = () => load().catch(e => { setError(e.message); setLoading(false); });
    refresh(); const unsubscribe = subscribeLibrary(refresh);
    return () => { requestGeneration.current++; unsubscribe(); };
  }, [load]);
  useEffect(() => {
    setPage(0);
    if (query.trim() && postDisclosure.current) postDisclosure.current.open = true;
  }, [query, selected]);


  const run = async (action: () => Promise<void>, message?: string) => {
    if (busy) return;
    setBusy(true); setError(''); setStatus('');
    try { await action(); await load(); if (message) setStatus(message); }
    catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.'); }
    finally { setBusy(false); }
  };
  const open = (name: string, item: PlaylistItem) => run(async () => {
    const response = await sendExtensionMessage({ type: 'PLAY_ITEM', args: { name, url: item.url } });
    if (!response?.ok) throw new Error(response?.error || 'Could not open this post.');
  });
  const exportLibrary = () => run(async () => {
    const data = { version: '2.0', playlists: await getAllPlaylists(), activePlaylist: active, exportDate: new Date().toISOString() };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `instagram-playlists-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'Library exported, including your notes and tags.');

  return <section className="space-y-5" aria-labelledby="library-heading" onKeyDown={event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); searchRef.current?.focus(); }
  }}>
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl gradient-instagram text-white" aria-hidden="true"><ListMusic size={23} /></div>
        <div><h1 ref={headingRef} tabIndex={-1} id="library-heading" className="text-xl font-semibold tracking-tight">Playlist Manager</h1>
          <p className="text-sm text-muted-foreground">{names.length} playlists · {total.toLocaleString()} saved posts</p></div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={busy || !names.length} onClick={exportLibrary}><Download />Export</Button>
        <Button asChild variant="outline" size="sm" disabled={busy}><label className="cursor-pointer"><Upload />Import<input type="file" accept=".json,application/json" className="sr-only" disabled={busy} aria-label="Import playlists from JSON" onChange={async event => {
          const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
          try {
            const data = JSON.parse(await file.text());
            const validated = validatePlaylists(data.playlists) as PlaylistsData;
            setImporting({ playlists: validated, active: typeof data.activePlaylist === 'string' ? data.activePlaylist : null });
          } catch (e) { setError(e instanceof Error ? e.message : 'Invalid playlist file.'); }
        }} /></label></Button>
        <Button size="sm" disabled={busy} onClick={() => { setError(''); setNameValue(''); setNameDialog('create'); }}><Plus />New Playlist</Button>
      </div>
    </header>
    <div className="space-y-2">
      <label htmlFor="library-search" className="text-sm font-medium">Find something you saved</label>
      <div className="relative"><Search aria-hidden="true" className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input id="library-search" ref={searchRef} type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search playlists, titles, notes, tags, or creators" className="pl-10" aria-describedby="search-help" />
      </div><p id="search-help" className="text-xs text-muted-foreground">Search across your library. Ctrl/⌘ K focuses search. Notes and tags stay in this browser.</p>
    </div>
    {error && <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>}
    <p role="status" aria-live="polite" className={cn('text-sm', status ? 'text-foreground' : 'sr-only')}>{status || (busy ? 'Working…' : '')}</p>
    <div className="grid gap-5 sm:grid-cols-[190px_minmax(0,1fr)]">
      <nav aria-label="Your playlists" className="space-y-1">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Your library</h2>
        {names.map(name => <button key={name} className={cn('flex w-full items-center justify-between gap-2 rounded-lg px-3 py-3 text-left text-sm transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', selected === name && 'bg-primary/10 text-primary font-semibold')}
          aria-current={selected === name ? 'true' : undefined} onClick={() => { setSelected(name); setQuery(''); }}>
          <span className="min-w-0 truncate">{name}{active === name && <span className="ml-2 text-xs" aria-label="Active playlist">●</span>}</span>
          <span className="tabular-nums text-xs text-muted-foreground">{playlists[name].length}</span>
        </button>)}
        {!names.length && !loading && <p className="py-2 text-sm text-muted-foreground">Create your first playlist, then collect posts from Instagram.</p>}
      </nav>
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-lg font-semibold">{query.trim() ? 'Search results' : selected || 'Your saved moments'}</h2>
            <p className="text-sm text-muted-foreground">{loading ? 'Loading your library…' : `${results.length.toLocaleString()} ${query.trim() ? 'matches across all playlists' : 'posts in this playlist'}`}</p></div>
          {selected && <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy || !playlists[selected]?.length} onClick={() => open(selected, playlists[selected][0])}><Play />Play Playlist</Button>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => run(async () => {
              if (active === selected && isExtensionEnvironment()) {
                const response = await sendExtensionMessage({ type: 'END_SESSION' });
                if (!response.ok) throw new Error(response.error || 'Could not end this session.');
              } else await setActivePlaylistName(active === selected ? null : selected);
            }, active === selected ? 'Session ended.' : 'Playlist activated.')}>
              {active === selected ? 'End Session' : 'Activate'}</Button>
            <details className="relative"><summary className="cursor-pointer rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Manage</summary>
              <div className="absolute right-0 z-10 mt-2 flex w-40 flex-col gap-1 rounded-lg border bg-background p-2 shadow-sm">
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => { setNameValue(selected); setNameDialog('rename'); }}>Rename Playlist</Button>
                <Button variant="ghost" size="sm" disabled={busy} className="text-destructive" onClick={() => setDeleting(selected)}>Delete Playlist</Button>
              </div></details>
          </div>}
        </div>
        {!query.trim() && selected && <form className="flex items-end gap-2" onSubmit={event => { event.preventDefault(); run(async () => {
          const item = normalizeItem({ url: manualUrl.trim() }); await addUrlsToPlaylist(selected, [item]); setManualUrl('');
        }, 'Post added.'); }}>
          <div className="flex-1 space-y-1"><label htmlFor="manual-url" className="text-xs font-medium">Add a post by URL</label><Input id="manual-url" type="url" value={manualUrl} onChange={e => setManualUrl(e.target.value)} placeholder="https://www.instagram.com/reel/…" required /></div>
          <Button variant="outline" disabled={busy || !manualUrl.trim()}>Add Post</Button>
        </form>}
        <details ref={postDisclosure} open className="rounded-xl border border-border">
          <summary className="cursor-pointer rounded-xl px-4 py-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Posts · {results.length.toLocaleString()} {query.trim() ? 'matches' : 'items'}</summary>
          <div className="flex items-center justify-between border-t px-4 py-2"><span className="text-xs text-muted-foreground">{expandedPosts ? 'Expanded list' : 'Scroll within the list'}</span><Button size="sm" variant="ghost" aria-pressed={expandedPosts} onClick={() => setExpandedPosts(!expandedPosts)}>{expandedPosts ? 'Use Compact View' : 'Expand List'}</Button></div>
          <div role="region" aria-label="Playlist posts" tabIndex={0} className={cn('rounded-b-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', !expandedPosts && 'max-h-[390px] overflow-y-auto overscroll-contain')} aria-busy={busy || loading}>
          {rows.map(({ name, item, index, total: count, title, matches }) => <article key={`${name}:${item.shortcode}`} className="group flex items-start gap-3 border-b border-border px-3 py-2.5 last:border-b-0">
            <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-secondary text-muted-foreground" aria-hidden="true">
              {item.thumbnail ? <img src={item.thumbnail} alt="" loading="lazy" className="h-full w-full object-cover" onError={event => { event.currentTarget.style.display = 'none'; }} /> : <Play size={18} />}
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="line-clamp-2 rounded text-sm font-semibold leading-5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={event => { if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || !isExtensionEnvironment()) return; event.preventDefault(); open(name, item); }}>
                {title}</a>
              <p className="truncate text-xs text-muted-foreground">{query.trim() && `${name} · `}{item.username ? `@${item.username.replace(/^@/, '')} · ` : ''}{index + 1} / {count}</p>
              {query.trim() && matches.filter(match => !['URL', 'Code'].includes(match.field)).map(({ field, value }) => <p key={`${field}:${value}`} className="truncate text-xs text-muted-foreground"><strong className="font-medium">{field}:</strong> {value}</p>)}
              {!!item.tags?.length && query.trim() && <ul aria-label="Tags" className="flex flex-wrap gap-1 pt-1">{item.tags.map(tag => <li key={tag}><button className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => { setQuery(tag); searchRef.current?.focus(); }}>{tag}</button></li>)}</ul>}
              <a className="block truncate rounded text-xs text-muted-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={item.url} target="_blank" rel="noopener noreferrer" aria-label={`Play Instagram post ${item.shortcode}`} onClick={event => {
                if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || !isExtensionEnvironment()) return;
                event.preventDefault(); open(name, item);
              }}>{item.url}</a>
            </div>
            <Button id={`edit-${encodeURIComponent(name)}-${item.shortcode}`} size="icon" variant="ghost" className="h-9 w-9 shrink-0" aria-label={`Edit post ${postTitle(item)}`} disabled={busy} onClick={() => { setError(''); setEditor({ name, item, title: item.title || '', notes: item.notes || '', tags: item.tags?.join(', ') || '', position: String(index + 1) }); }}><Pencil /></Button>
          </article>)}
          {!rows.length && <div className="space-y-2 px-6 py-12 text-center"><ListMusic className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" /><p className="font-medium">{loading ? 'Loading your playlists' : query.trim() ? 'No matching posts' : 'Make room for what matters'}</p><p className="text-sm text-muted-foreground">{query.trim() ? 'Try another word, creator, or tag.' : 'Add a URL above or collect a saved collection below.'}</p>{query && <Button variant="outline" size="sm" onClick={() => setQuery('')}>Clear Search</Button>}</div>}
        </div>
        </details>
        {pages > 1 && <nav aria-label="Post result pages" className="flex items-center justify-between gap-2"><Button variant="outline" size="sm" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</Button><span className="text-xs text-muted-foreground">Page {currentPage + 1} of {pages}</span><Button variant="outline" size="sm" disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}>Next</Button></nav>}
      </div>
    </div>

    <Dialog open={!!nameDialog} onOpenChange={open => { if (!open && !busy) setNameDialog(null); }}><DialogContent><DialogHeader><DialogTitle>{nameDialog === 'rename' ? 'Rename Playlist' : 'Create a Playlist'}</DialogTitle><DialogDescription>A place for knowledge, a feeling, or something you want to return to.</DialogDescription></DialogHeader>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <form className="space-y-4" onSubmit={event => { event.preventDefault(); run(async () => {
        const name = nameValue.trim(); if (nameDialog === 'rename' && selected) await renamePlaylist(selected, name); else await createPlaylist(name);
        selectedRef.current = name; setSelected(name); setQuery(''); setNameDialog(null);
      }, 'Playlist saved.'); }}><label className="block space-y-2"><span className="text-sm font-medium">Playlist name</span><Input autoFocus value={nameValue} onChange={e => setNameValue(e.target.value)} required /></label><Button disabled={busy || !nameValue.trim()}>Save Playlist</Button></form>
    </DialogContent></Dialog>
    <Dialog open={!!editor} onOpenChange={open => { if (!open && !busy) setEditor(null); }}><DialogContent><DialogHeader><DialogTitle>Edit post</DialogTitle><DialogDescription>Your personal notes stay in this browser and are included in exports.</DialogDescription></DialogHeader>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {editor && <form className="space-y-4" onSubmit={event => { event.preventDefault(); run(async () => {
        await annotatePlaylistItem(editor.name, editor.item.shortcode, { title: editor.title.trim(), notes: editor.notes.trim(), tags: editor.tags.split(',').map(tag => tag.trim()).filter(Boolean) }, Number(editor.position)); setEditor(null);
      }, 'Title, notes, and tags saved.'); }}>
        <label className="block space-y-1"><span className="text-sm font-medium">Your title</span><Input maxLength={160} value={editor.title} onChange={e => setEditor({ ...editor, title: e.target.value })} placeholder="What do you want to remember?" /></label>
        <label className="block space-y-1"><span className="text-sm font-medium">Notes</span><Textarea maxLength={5000} value={editor.notes} onChange={e => setEditor({ ...editor, notes: e.target.value })} placeholder="A useful detail, a tool name, or how this made you feel" /></label>
        <label className="block space-y-1"><span className="text-sm font-medium">Tags, separated by commas</span><Input value={editor.tags} onChange={e => setEditor({ ...editor, tags: e.target.value })} placeholder="motivation, tools, calm" /><span className="block text-xs text-muted-foreground">Up to 20 tags, 64 characters each.</span></label>
        <label className="block space-y-1"><span className="text-sm font-medium">Position in playlist</span><Input type="number" min={1} max={playlists[editor.name]?.length || 1} step={1} required value={editor.position} onChange={event => setEditor({ ...editor, position: event.target.value })} /><span className="block text-xs text-muted-foreground">Move directly to any position from 1 to {playlists[editor.name]?.length || 1}.</span></label>
        <div className="flex justify-between gap-2"><Button type="button" variant="outline" className="text-destructive" disabled={busy} onClick={() => setDeletePost({ name: editor.name, item: editor.item })}><Trash2 />Remove from Playlist</Button><Button disabled={busy}>Save Changes</Button></div>
      </form>}
    </DialogContent></Dialog>
    <AlertDialog open={!!deletePost} onOpenChange={open => { if (!open) setDeletePost(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Remove this post?</AlertDialogTitle><AlertDialogDescription>This removes “{deletePost && postTitle(deletePost.item)}” from this local playlist. Your Instagram save is unchanged.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep Post</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { const post = deletePost; setDeletePost(null); if (post) run(async () => { await removeUrlsFromPlaylist(post.name, [post.item.url]); setEditor(null); }, 'Post removed from this playlist.'); }}>Remove Post</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={!!deleting} onOpenChange={open => { if (!open) setDeleting(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete “{deleting}”?</AlertDialogTitle><AlertDialogDescription>This removes the local playlist and its notes. Your Instagram saved posts are unchanged.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep Playlist</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { const name = deleting; setDeleting(null); if (name) run(async () => { await deletePlaylist(name); headingRef.current?.focus(); }, 'Playlist deleted.'); }}><Trash2 className="mr-2 h-4 w-4" />Delete Playlist</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={!!importing} onOpenChange={open => { if (!open) setImporting(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Import {importing && Object.keys(importing.playlists).length} playlists?</AlertDialogTitle><AlertDialogDescription>Playlists with matching names will be replaced, including their notes and tags. Other playlists stay unchanged.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => { const preview = importing; setImporting(null); if (preview) run(async () => { await saveAllPlaylists(preview.playlists); if (preview.active && Object.prototype.hasOwnProperty.call(preview.playlists, preview.active)) await setActivePlaylistName(preview.active); }, 'Playlists imported.'); }}>Import Playlists</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </section>;
};
