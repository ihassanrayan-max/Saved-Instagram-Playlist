/// <reference types="vite/client" />

interface ExtensionResponse { ok: boolean; error?: string; data?: unknown }
interface ExtensionMessage { type: string; operation?: string; args?: Record<string, unknown>; resume?: boolean }
interface ExtensionTab { id?: number; url?: string }
interface StorageChange { newValue?: unknown; oldValue?: unknown }
interface ChromeEvent<T> { addListener(callback: T): void; removeListener(callback: T): void }
declare const chrome: {
  runtime: {
    id?: string;
    getURL(path: string): string;
    sendMessage(message: ExtensionMessage): Promise<ExtensionResponse>;
    onMessage: ChromeEvent<(message: ExtensionMessage, sender: unknown, respond: (response: ExtensionResponse) => void) => boolean | void>;
  };
  storage: {
    local: {
      get(keys: string | string[]): Promise<Record<string, unknown>>;
      set(values: Record<string, unknown>): Promise<void>;
      remove(keys: string | string[]): Promise<void>;
    };
    onChanged: ChromeEvent<(changes: Record<string, StorageChange>, area: string) => void>;
  };
  tabs: {
    query(query: Record<string, unknown>): Promise<ExtensionTab[]>;
    sendMessage(id: number, message: ExtensionMessage): Promise<ExtensionResponse>;
  };
};
