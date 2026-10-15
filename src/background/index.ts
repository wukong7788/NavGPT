const PANEL_HOSTS = ["chatgpt.com", "grok.com"];

function isPanelHost(hostname: string): boolean {
  return PANEL_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`));
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url) return;

  let hostname = "";
  try {
    hostname = new URL(tab.url).hostname;
  } catch {
    return;
  }

  if (!isPanelHost(hostname)) {
    console.log("NavGPT: Floating panel is only available on chatgpt.com / grok.com");
    return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_PANEL" });
  } catch (error) {
    console.warn("NavGPT: Content script not ready yet.", error);
  }
});

console.log("NavGPT Background script loaded.");
