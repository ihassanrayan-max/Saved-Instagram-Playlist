import { extensionCall } from './extensionContext';
export async function selectedInstagramTab() {
  if (typeof chrome === 'undefined' || !chrome.tabs) throw new Error('Open the installed extension on an Instagram saved collection.');
  const [tab] = await extensionCall(() => chrome.tabs.query({ active: true, currentWindow: true }));
  if (!tab?.id || !tab.url?.startsWith('https://www.instagram.com/')) throw new Error('Open Instagram in the active tab first.');
  return tab.id;
}
