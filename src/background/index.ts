const CHATGPT_HOST = "chatgpt.com";

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url) return;

  let hostname = "";
  try {
    hostname = new URL(tab.url).hostname;
  } catch {
    return;
  }

  if (hostname !== CHATGPT_HOST && !hostname.endsWith(`.${CHATGPT_HOST}`)) {
    // Only meaningful on ChatGPT; keep quiet on other sites.
    console.log("NavGPT: Floating panel is only available on chatgpt.com");
    return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_PANEL" });
  } catch (error) {
    console.warn("NavGPT: Content script not ready yet.", error);
  }
});

console.log("NavGPT Background script loaded.");
