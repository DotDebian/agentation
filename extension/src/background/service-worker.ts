// Toggle toolbar when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_TOOLBAR" });
  }
});

// Update badge count when content script reports annotation count
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === "UPDATE_BADGE" && sender.tab?.id) {
    const count = message.count as number;
    chrome.action.setBadgeText({
      text: count > 0 ? String(count) : "",
      tabId: sender.tab.id,
    });
    chrome.action.setBadgeBackgroundColor({
      color: message.color || "#3b82f6",
      tabId: sender.tab.id,
    });
  }
});
