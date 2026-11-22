import type { PlaylistItem } from '@/utils/playlistStorage';
import { extensionStorage } from '@/utils/extensionContext';

export type CollectionStatus = 'idle' | 'collecting' | 'stopped' | 'interrupted' | 'complete' | 'stalled' | 'error';
export interface CollectionSnapshot {
  source: string;
  status: CollectionStatus;
  count: number;
  chunks: number;
  scrollTop: number;
  updatedAt: number;
  message?: string;
}
export const collectionKey = (source: string) => `collection_v2:${encodeURIComponent(source)}`;
const chunkKey = (source: string, index: number) => `${collectionKey(source)}:chunk:${index}`;
export const emptyCollection = (source: string): CollectionSnapshot => ({ source, status: 'idle', count: 0, chunks: 0, scrollTop: 0, updatedAt: Date.now() });

export async function readCollection(source: string): Promise<CollectionSnapshot> {
  return (await extensionStorage.get(collectionKey(source)))[collectionKey(source)] as CollectionSnapshot || emptyCollection(source);
}
export async function readCollectionItems(snapshot: CollectionSnapshot): Promise<PlaylistItem[]> {
  const keys = Array.from({ length: snapshot.chunks }, (_, i) => chunkKey(snapshot.source, i));
  const rows = await extensionStorage.get(keys);
  return keys.flatMap(key => rows[key] as PlaylistItem[] || []);
}
export async function checkpoint(snapshot: CollectionSnapshot, batch: PlaylistItem[]) {
  const chunks = snapshot.chunks + (batch.length ? 1 : 0);
  const next = { ...snapshot, chunks, updatedAt: Date.now() };
  await extensionStorage.set({
    ...(batch.length ? { [chunkKey(snapshot.source, snapshot.chunks)]: batch } : {}),
    [collectionKey(snapshot.source)]: next,
  });
  return next;
}
export async function clearCollection(source: string) {
  const snapshot = await readCollection(source);
  await extensionStorage.remove([
    collectionKey(source), ...Array.from({ length: snapshot.chunks }, (_, i) => chunkKey(source, i)),
  ]);
}
