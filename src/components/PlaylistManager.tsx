import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  Play,
  Pause,
  Edit2,
  Trash2,
  MoreVertical,
  ExternalLink,
  Check,
  X,
  GripVertical,
  Download,
  Upload,
  Link as LinkIcon,
  List,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getAllPlaylists,
  getActivePlaylistName,
  setActivePlaylistName,
  createPlaylist,
  deletePlaylist,
  renamePlaylist,
  getPlaylist,
  addUrlsToPlaylist,
  removeUrlsFromPlaylist,
  reorderPlaylist,
  saveAllPlaylists,
  type PlaylistItem,
  type PlaylistsData,
} from '@/utils/playlistStorage';

export const PlaylistManager = () => {
  const [playlists, setPlaylists] = useState<PlaylistsData>({});
  const [activePlaylistName, setActivePlaylistNameState] = useState<string | null>(null);
  const [editingPlaylist, setEditingPlaylist] = useState<string | null>(null);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [renameValue, setRenameValue] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null);
  const [playlistItems, setPlaylistItems] = useState<PlaylistItem[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [manualUrl, setManualUrl] = useState('');
  const [isAddingUrl, setIsAddingUrl] = useState(false);
  const [importConfirm, setImportConfirm] = useState(false);

  // Load playlists and active playlist
  const loadData = useCallback(async () => {
    const allPlaylists = await getAllPlaylists();
    const active = await getActivePlaylistName();
    setPlaylists(allPlaylists);
    setActivePlaylistNameState(active);
    
    if (active && allPlaylists[active]) {
      setSelectedPlaylist(active);
      setPlaylistItems(allPlaylists[active]);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle creating a new playlist
  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    
    try {
      await createPlaylist(newPlaylistName.trim());
      setNewPlaylistName('');
      setIsCreating(false);
      await loadData();
      notifyPlaylistUpdate();
    } catch (error: any) {
      alert(error.message || 'Failed to create playlist');
    }
  };

  // Notify background script of playlist changes
  const notifyPlaylistUpdate = () => {
    if (typeof chrome !== 'undefined' && (chrome as any).runtime) {
      (chrome as any).runtime.sendMessage({
        type: 'PLAYLIST_UPDATED',
        data: { timestamp: Date.now() }
      }).catch(() => {
        // Ignore errors
      });
    }
  };

  // Handle deleting a playlist
  const handleDeletePlaylist = async (name: string) => {
    try {
      await deletePlaylist(name);
      setDeleteConfirm(null);
      if (selectedPlaylist === name) {
        setSelectedPlaylist(null);
        setPlaylistItems([]);
      }
      await loadData();
      notifyPlaylistUpdate();
    } catch (error: any) {
      alert(error.message || 'Failed to delete playlist');
    }
  };

  // Handle renaming a playlist
  const handleRenamePlaylist = async (oldName: string, newName: string) => {
    if (!newName.trim() || newName === oldName) {
      setEditingPlaylist(null);
      return;
    }
    
    try {
      await renamePlaylist(oldName, newName.trim());
      setEditingPlaylist(null);
      if (selectedPlaylist === oldName) {
        setSelectedPlaylist(newName.trim());
      }
      await loadData();
      notifyPlaylistUpdate();
    } catch (error: any) {
      alert(error.message || 'Failed to rename playlist');
    }
  };

  // Handle activating a playlist
  const handleActivatePlaylist = async (name: string) => {
    await setActivePlaylistName(name);
    setActivePlaylistNameState(name);
    setSelectedPlaylist(name);
    setPlaylistItems(playlists[name] || []);
    notifyPlaylistUpdate();
  };

  // Handle deactivating the active playlist
  const handleDeactivatePlaylist = async () => {
    await setActivePlaylistName(null);
    setActivePlaylistNameState(null);
    notifyPlaylistUpdate();
  };

  // Handle selecting a playlist to view/edit
  const handleSelectPlaylist = (name: string) => {
    setSelectedPlaylist(name);
    setPlaylistItems(playlists[name] || []);
  };

  // Handle removing URLs from playlist
  const handleRemoveUrls = async (playlistName: string, urls: string[]) => {
    try {
      await removeUrlsFromPlaylist(playlistName, urls);
      await loadData();
      if (selectedPlaylist === playlistName) {
        setPlaylistItems(await getPlaylist(playlistName));
      }
      notifyPlaylistUpdate();
    } catch (error: any) {
      alert(error.message || 'Failed to remove URLs');
    }
  };

  // Validate Instagram URL
  const validateInstagramUrl = (url: string): { valid: boolean; shortcode?: string; fullUrl?: string; error?: string } => {
    try {
      // Clean up the URL
      const cleanUrl = url.trim();
      
      // Check if it's a valid Instagram URL
      // Pattern matches:
      // - instagram.com/p/SHORTCODE/ (post)
      // - instagram.com/reel/SHORTCODE/ (reel)
      // - instagram.com/USERNAME/p/SHORTCODE/ (post with username)
      // - instagram.com/USERNAME/reel/SHORTCODE/ (reel with username)
      const instagramPattern = /instagram\.com\/(?:[^\/]+\/)?(p|reel)\/([^\/\?]+)/i;
      const match = cleanUrl.match(instagramPattern);
      
      if (!match) {
        return { valid: false, error: 'Please enter a valid Instagram post or reel URL' };
      }
      
      const postType = match[1]; // 'p' or 'reel'
      const shortcode = match[2];
      
      // Construct full URL (always use /p/ format for consistency)
      const fullUrl = `https://www.instagram.com/p/${shortcode}/`;
      
      return { valid: true, shortcode, fullUrl };
    } catch (e) {
      return { valid: false, error: 'Invalid URL format' };
    }
  };

  // Handle adding manual URL
  const handleAddManualUrl = async (playlistName: string, url: string) => {
    if (!url.trim()) return;
    
    const validation = validateInstagramUrl(url);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }
    
    setIsAddingUrl(true);
    try {
      const newItem: PlaylistItem = {
        url: validation.fullUrl || url,
        shortcode: validation.shortcode || '',
        thumbnail: undefined,
        username: undefined,
        caption: undefined
      };
      
      await addUrlsToPlaylist(playlistName, [newItem]);
      setManualUrl('');
      await loadData();
      if (selectedPlaylist === playlistName) {
        setPlaylistItems(await getPlaylist(playlistName));
      }
      notifyPlaylistUpdate();
      alert(`URL added to "${playlistName}"`);
    } catch (error: any) {
      alert(error.message || 'Failed to add URL');
    } finally {
      setIsAddingUrl(false);
    }
  };

  // Handle exporting all playlists to JSON
  const handleExportPlaylists = async () => {
    try {
      const allPlaylists = await getAllPlaylists();
      const activePlaylist = await getActivePlaylistName();
      
      const exportData = {
        playlists: allPlaylists,
        activePlaylist: activePlaylist,
        exportDate: new Date().toISOString(),
        version: '1.0'
      };
      
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `instagram-playlists-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      alert('Playlists exported successfully!');
    } catch (error: any) {
      alert(error.message || 'Failed to export playlists');
    }
  };

  // Handle importing playlists from JSON
  const handleImportPlaylists = async (file: File, confirmed: boolean = false) => {
    try {
      const text = await file.text();
      const importData = JSON.parse(text);
      
      // Validate import data structure
      if (!importData.playlists || typeof importData.playlists !== 'object') {
        throw new Error('Invalid file format. Expected playlists object.');
      }
      
      // Check if importing will overwrite existing playlists
      if (!confirmed) {
        const existingPlaylists = await getAllPlaylists();
        const existingNames = Object.keys(existingPlaylists);
        const importNames = Object.keys(importData.playlists);
        const willOverwrite = importNames.some(name => existingNames.includes(name));
        
        if (willOverwrite) {
          setImportConfirm(true);
          // Store file for later use
          (window as any).__pendingImportFile = file;
          return;
        }
      }
      
      // Merge or replace playlists
      const allPlaylists = await getAllPlaylists();
      const mergedPlaylists = { ...allPlaylists, ...importData.playlists };
      
      await saveAllPlaylists(mergedPlaylists);
      
      // Restore active playlist if provided
      if (importData.activePlaylist) {
        await setActivePlaylistName(importData.activePlaylist);
      }
      
      await loadData();
      notifyPlaylistUpdate();
      setImportConfirm(false);
      delete (window as any).__pendingImportFile;
      
      const importNames = Object.keys(importData.playlists);
      alert(`Successfully imported ${importNames.length} playlist(s)!`);
    } catch (error: any) {
      alert(error.message || 'Failed to import playlists. Please check the file format.');
      setImportConfirm(false);
      delete (window as any).__pendingImportFile;
    }
  };

  // Handle file input for import
  const handleImportFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImportPlaylists(file);
    }
    // Reset input
    e.target.value = '';
  };

  // Confirm import with overwrite
  const handleConfirmImport = () => {
    const file = (window as any).__pendingImportFile;
    if (file) {
      handleImportPlaylists(file, true);
    }
  };

  // Handle importing from current Instagram collection
  const handleImportFromCollection = async (playlistName: string) => {
    try {
      // Get current collection from storage
      if (typeof chrome !== 'undefined' && (chrome as any).storage) {
        const result = await (chrome as any).storage.local.get(['instagram_playlist']);
        if (result.instagram_playlist && Array.isArray(result.instagram_playlist)) {
          await addUrlsToPlaylist(playlistName, result.instagram_playlist);
          await loadData();
          if (selectedPlaylist === playlistName) {
            setPlaylistItems(await getPlaylist(playlistName));
          }
          notifyPlaylistUpdate();
          alert(`Imported ${result.instagram_playlist.length} items to "${playlistName}"`);
        } else {
          alert('No collection found. Please collect URLs from Instagram first.');
        }
      } else {
        const stored = sessionStorage.getItem('instagram_playlist');
        if (stored) {
          const items = JSON.parse(stored);
          await addUrlsToPlaylist(playlistName, items);
          await loadData();
          if (selectedPlaylist === playlistName) {
            setPlaylistItems(await getPlaylist(playlistName));
          }
          notifyPlaylistUpdate();
          alert(`Imported ${items.length} items to "${playlistName}"`);
        } else {
          alert('No collection found. Please collect URLs from Instagram first.');
        }
      }
    } catch (error: any) {
      alert(error.message || 'Failed to import collection');
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Playlist Manager</h1>
          <p className="text-sm text-muted-foreground">Manage your Instagram playlists</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleExportPlaylists}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <input
            id="import-file-input"
            type="file"
            accept=".json"
            onChange={handleImportFileSelect}
            className="hidden"
          />
          <Button
            variant="outline"
            onClick={() => document.getElementById('import-file-input')?.click()}
          >
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Dialog open={isCreating} onOpenChange={setIsCreating}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Playlist
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Playlist</DialogTitle>
              <DialogDescription>
                Enter a name for your new playlist
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Playlist name"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreatePlaylist();
                  }
                }}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreating(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreatePlaylist}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Playlist List */}
        <div className="md:col-span-1 space-y-2">
          <h2 className="text-lg font-semibold mb-2">Playlists</h2>
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {Object.keys(playlists).length === 0 ? (
              <div className="text-center p-12 rounded-xl border-2 border-dashed border-border/50 bg-gradient-to-br from-muted/30 to-transparent animate-fade-in">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full gradient-instagram flex items-center justify-center shadow-lg">
                  <List className="h-10 w-10 text-white" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-gradient">No playlists yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Create your first playlist to get started!
                </p>
              </div>
            ) : (
              Object.keys(playlists).map((name) => (
                <div
                  key={name}
                  className={cn(
                    "p-4 rounded-xl border cursor-pointer transition-all duration-300 hover-lift group relative overflow-hidden",
                    selectedPlaylist === name
                      ? "bg-gradient-to-br from-primary/20 via-primary/10 to-accent/20 border-primary/50 shadow-lg shadow-primary/20"
                      : "bg-card/50 hover:bg-card/80 border-border/50",
                    activePlaylistName === name && "ring-2 ring-primary/50 shadow-md"
                  )}
                  onClick={() => handleSelectPlaylist(name)}
                >
                  {/* Gradient overlay for active */}
                  {selectedPlaylist === name && (
                    <div className="absolute inset-0 gradient-animated opacity-10 pointer-events-none" />
                  )}
                  
                  <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-all",
                        selectedPlaylist === name 
                          ? "gradient-instagram shadow-lg" 
                          : "bg-muted group-hover:bg-primary/20"
                      )}>
                        <List className={cn(
                          "h-5 w-5 transition-colors",
                          selectedPlaylist === name ? "text-white" : "text-muted-foreground group-hover:text-primary"
                        )} />
                      </div>
                      <div className="flex-1 min-w-0">
                        {editingPlaylist === name ? (
                          <Input
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onBlur={() => {
                              handleRenamePlaylist(name, renameValue);
                              setRenameValue('');
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleRenamePlaylist(name, renameValue);
                                setRenameValue('');
                              } else if (e.key === 'Escape') {
                                setEditingPlaylist(null);
                                setRenameValue('');
                              }
                            }}
                            autoFocus
                            className="h-7 text-sm"
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <>
                            <h3 className={cn(
                              "font-semibold truncate transition-colors",
                              selectedPlaylist === name ? "text-primary" : "text-foreground"
                            )}>
                              {name}
                            </h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {playlists[name]?.length || 0} items
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                    {activePlaylistName === name && !editingPlaylist && (
                      <div className="flex-shrink-0 mr-2">
                        <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                      </div>
                    )}
                    {!editingPlaylist && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-white/10">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem
                            onClick={() => {
                              setEditingPlaylist(name);
                              setRenameValue(name);
                            }}
                          >
                            <Edit2 className="h-4 w-4 mr-2" />
                            Rename
                          </DropdownMenuItem>
                          {activePlaylistName === name ? (
                            <DropdownMenuItem
                              onClick={() => handleDeactivatePlaylist()}
                            >
                              <Pause className="h-4 w-4 mr-2" />
                              Deactivate
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => handleActivatePlaylist(name)}
                            >
                              <Play className="h-4 w-4 mr-2" />
                              Activate
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleImportFromCollection(name)}
                          >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Import from Collection
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setDeleteConfirm(name)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Playlist Editor */}
        <div className="md:col-span-2">
          {selectedPlaylist ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{selectedPlaylist}</h2>
                  <p className="text-sm text-muted-foreground">
                    {playlistItems.length} items
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleImportFromCollection(selectedPlaylist)}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Import Collection
                  </Button>
                  {activePlaylistName === selectedPlaylist ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeactivatePlaylist()}
                    >
                      <Pause className="h-4 w-4 mr-2" />
                      Deactivate
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => handleActivatePlaylist(selectedPlaylist)}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Activate
                    </Button>
                  )}
                </div>
              </div>

              {/* Manual URL Addition */}
              <div className="flex gap-2">
                <Input
                  placeholder="Paste Instagram post/reel URL here..."
                  value={manualUrl}
                  onChange={(e) => setManualUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isAddingUrl) {
                      handleAddManualUrl(selectedPlaylist, manualUrl);
                    }
                  }}
                  className="flex-1"
                />
                <Button
                  onClick={() => handleAddManualUrl(selectedPlaylist, manualUrl)}
                  disabled={isAddingUrl || !manualUrl.trim()}
                >
                  <LinkIcon className="h-4 w-4 mr-2" />
                  {isAddingUrl ? 'Adding...' : 'Add URL'}
                </Button>
              </div>

              <div className="border rounded-lg max-h-[500px] overflow-y-auto">
                {playlistItems.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <p>This playlist is empty</p>
                    <p className="text-sm mt-2">
                      Import URLs from your Instagram collection or add them manually
                    </p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {playlistItems.map((item, index) => (
                      <div
                        key={item.url}
                        className="p-3 hover:bg-muted/50 flex items-center gap-3"
                      >
                        <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {item.username || item.shortcode || 'Instagram Post'}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {item.url}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 flex-shrink-0"
                          onClick={() => handleRemoveUrls(selectedPlaylist, [item.url])}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground border rounded-lg">
              <p>Select a playlist to view and edit</p>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Playlist</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirm}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDeletePlaylist(deleteConfirm)}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Confirmation Dialog */}
      <AlertDialog open={importConfirm} onOpenChange={(open) => !open && setImportConfirm(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import Playlists</AlertDialogTitle>
            <AlertDialogDescription>
              Importing will overwrite existing playlists with the same names. Do you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setImportConfirm(false);
              delete (window as any).__pendingImportFile;
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmImport}>
              Import
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

