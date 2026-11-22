export interface PlayerRequest { name: string; url: string; state: Record<string, unknown> }
let handler: ((request: PlayerRequest) => Promise<string>) | undefined;
let control: ((name: string, state: Record<string, unknown>) => void) | undefined;
export function handlePlaybackControls(next: typeof control) { control = next; return () => { if (control === next) control = undefined; }; }
export function notifyPlaybackControl(name: string, state: Record<string, unknown>) { control?.(name, state); }
export function handlePlayerRequests(next: typeof handler) { handler = next; return () => { if (handler === next) handler = undefined; }; }
export function requestPlayer(request: PlayerRequest) {
  if (!handler) return Promise.reject(new Error('The playlist player is not ready.'));
  return handler(request);
}
