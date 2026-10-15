import { MessagePayload } from "../shared/types";
import { extractMessages } from "./extract";
import { jumpToMessage, injectStyles, hasExtractableMessages } from "./jump";
import { initFloatingPanel, togglePanel, setPanelMessages } from "./panel";

injectStyles();
initFloatingPanel();

console.log("NavGPT Content Script loaded.");

let debounceTimer: number | null = null;

function debouncedRescan() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => {
    const messages = extractMessages();
    console.log(`Auto-rescan: Extracted ${messages.length} messages.`);
    setPanelMessages(messages);
  }, 1000);
}

const observer = new MutationObserver((mutations) => {
  const hasRelevantChange = mutations.some(
    (m) => m.addedNodes.length > 0 || m.removedNodes.length > 0
  );
  if (hasRelevantChange) {
    debouncedRescan();
  }
});

const targetNode = document.querySelector("main") || document.body;
observer.observe(targetNode, { childList: true, subtree: true });

chrome.runtime.onMessage.addListener((message: MessagePayload) => {
  if (message.type === "TOGGLE_PANEL") {
    togglePanel();
    return;
  }

  if (message.type === "RESCAN_REQUEST") {
    const messages = extractMessages();
    setPanelMessages(messages);
    return;
  }

  if (message.type === "JUMP_TO_MESSAGE") {
    jumpToMessage(message.messageId, message.domMessageId);
  }
});

function checkPendingJump() {
  chrome.storage.local.get(["pendingJump"], (result) => {
    const jump = result.pendingJump as
      | { url: string; messageId: string; domMessageId?: string }
      | undefined;

    if (!jump || jump.url !== window.location.href) return;

    console.log("NavGPT: Found pending jump for this URL.", jump.messageId);

    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (hasExtractableMessages()) {
        console.log("NavGPT: Messages found, executing pending jump.");
        jumpToMessage(jump.messageId, jump.domMessageId);
        chrome.storage.local.remove("pendingJump");
        clearInterval(interval);
      }
      if (attempts > 20) {
        console.warn("NavGPT: Pending jump timed out.");
        chrome.storage.local.remove("pendingJump");
        clearInterval(interval);
      }
    }, 500);
  });
}

checkPendingJump();
