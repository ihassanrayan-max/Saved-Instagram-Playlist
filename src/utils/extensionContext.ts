import { createExtensionContext, isContextInvalidation } from '../../public/extension-context.js';

function runtimePresent() {
  try { return typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id); }
  catch { return false; }
}
let extensionEnvironment = runtimePresent();
export function isExtensionEnvironment() {
  if (runtimePresent()) extensionEnvironment = true;
  return extensionEnvironment;
}
export const extensionContext = createExtensionContext(runtimePresent);
export { isContextInvalidation };
export const extensionCall = <T,>(operation: () => T | Promise<T>): Promise<T> => extensionContext.run(operation);
export const sendExtensionMessage = (message: ExtensionMessage) => extensionCall(() => chrome.runtime.sendMessage(message));
export const extensionStorage = {
  get: (keys: string | string[]) => extensionCall(() => chrome.storage.local.get(keys)),
  set: (values: Record<string, unknown>) => extensionCall(() => chrome.storage.local.set(values)),
  remove: (keys: string | string[]) => extensionCall(() => chrome.storage.local.remove(keys)),
};

export function listenExtensionEvent<T>(getEvent: () => ChromeEvent<T>, listener: T) {
  if (!extensionContext.check()) return () => {};
  let event: ChromeEvent<T>;
  try { event = getEvent(); event.addListener(listener); }
  catch (error) {
    const failure = extensionContext.failure(error);
    if (!isContextInvalidation(failure)) throw failure;
    return () => {};
  }
  return () => {
    // After invalidation even removeListener can throw. No API access is needed:
    // Chrome has already disconnected the old extension event bindings.
    if (extensionContext.stopped) return;
    try { event.removeListener(listener); }
    catch (error) { if (!isContextInvalidation(extensionContext.failure(error))) console.warn('Could not remove extension listener:', error); }
  };
}

export function reportExtensionError(error: unknown) {
  if (!isContextInvalidation(extensionContext.failure(error))) console.error(error);
}
