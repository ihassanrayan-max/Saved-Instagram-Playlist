// Background script for playlist extension
// Handles messaging between popup and content scripts

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'OPEN_POPUP') {
    // Open the extension popup
    chrome.action.openPopup?.().catch(() => {
      // If openPopup fails, try to focus the extension icon
      console.log('Could not open popup programmatically');
    });
    sendResponse({ success: true });
  } else if (request.type === 'PLAYLIST_UPDATED') {
    // Notify all Instagram tabs that playlist was updated
    chrome.tabs.query({ url: 'https://www.instagram.com/*' }, (tabs) => {
      tabs.forEach(tab => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, {
            type: 'PLAYLIST_STATE_CHANGED',
            data: request.data
          }).catch(() => {
            // Tab might not have content script loaded yet
          });
        }
      });
    });
    sendResponse({ success: true });
  } else if (request.type === 'COLLECTION_UPDATE') {
    // Forward collection updates to popup if it's open
    // The popup will listen for these messages
    sendResponse({ success: true });
  }
  return true; // Keep channel open for async response
});

// Listen for storage changes and notify content scripts
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && (changes.instagram_playlists || changes.instagram_active_playlist)) {
    // Notify all Instagram tabs
    chrome.tabs.query({ url: 'https://www.instagram.com/*' }, (tabs) => {
      tabs.forEach(tab => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, {
            type: 'PLAYLIST_STORAGE_CHANGED'
          }).catch(() => {
            // Tab might not have content script loaded yet
          });
        }
      });
    });
  }
});

