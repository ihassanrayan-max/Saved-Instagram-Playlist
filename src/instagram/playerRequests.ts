export interface PlayerRequest { name: string; url: string; state: Record<string, unknown> }
let handler: ((request: PlayerRequest) => Promise<string>) | undefined;
export function handlePlayerRequests(next: typeof handler) { handler = next; return () => { if (handler === next) handler = undefined; }; }
export function requestPlayer(request: PlayerRequest) {
  if (!handler) return Promise.reject(new Error('The playlist player is not ready.'));
  return handler(request);
}
