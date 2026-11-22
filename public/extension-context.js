export class ExtensionContextError extends Error {
  constructor(cause) {
    super('The extension was updated or reloaded. Reload Instagram to reconnect.', { cause });
    this.name = 'ExtensionContextError';
  }
}

export function isContextInvalidation(error) {
  return error instanceof ExtensionContextError || /extension context invalidated/i.test(error?.message || String(error));
}

// Runtime validity is checked on use and page activity, not by a polling timer.
export function createExtensionContext(isValid) {
  const controller = new AbortController();
  const listeners = new Set();
  let stopped = false;
  const invalidate = () => {
    if (stopped) return;
    stopped = true;
    controller.abort();
    for (const listener of listeners) {
      try { listener(); } catch { /* All remaining cleanup must still run. */ }
    }
    listeners.clear();
  };
  const check = () => {
    if (stopped) return false;
    try { if (isValid()) return true; } catch { /* Invalidated API getters can throw. */ }
    invalidate();
    return false;
  };
  const failure = error => {
    if (isContextInvalidation(error) || !check()) {
      invalidate();
      return error instanceof ExtensionContextError ? error : new ExtensionContextError(error);
    }
    return error;
  };
  return {
    signal: controller.signal,
    check, invalidate, failure,
    get stopped() { return stopped; },
    onInvalidated(listener) {
      if (stopped) { listener(); return () => {}; }
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async run(operation) {
      if (!check()) throw new ExtensionContextError();
      try {
        const result = await operation();
        // A promise started before reload must not update the now-dead UI.
        if (!check()) throw new ExtensionContextError();
        return result;
      } catch (error) { throw failure(error); }
    },
  };
}
