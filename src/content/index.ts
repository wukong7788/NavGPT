import { MessagePayload } from "../shared/types";
import { extractMessages } from "./extract";
import { jumpToMessage, injectStyles } from "./jump";

injectStyles();

console.log("NavGPT Content Script loaded.");

let debounceTimer: number | null = null;

function debouncedRescan() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => {
    const messages = extractMessages();
    console.log(`Auto-rescan: Extracted ${messages.length} messages.`);
    chrome.runtime.sendMessage({
      type: "MESSAGES_EXTRACTED",
      messages,
    } as MessagePayload);
  }, 1000); // 1s debounce
}

// Start observing the conversation container
const observer = new MutationObserver((mutations) => {
  const hasRelevantChange = mutations.some(m => 
    m.addedNodes.length > 0 || m.removedNodes.length > 0
  );
  if (hasRelevantChange) {
    debouncedRescan();
  }
});

// ChatGPT's main conversation area
const targetNode = document.querySelector("main") || document.body;
observer.observe(targetNode, { childList: true, subtree: true });

chrome.runtime.onMessage.addListener((message: MessagePayload, _sender, _sendResponse) => {
  if (message.type === "RESCAN_REQUEST") {
    const messages = extractMessages();
    chrome.runtime.sendMessage({
      type: "MESSAGES_EXTRACTED",
      messages,
    } as MessagePayload);
  } else if (message.type === "JUMP_TO_MESSAGE") {
    jumpToMessage(message.messageId, message.domMessageId);
  }
});

// Check for pending jumps from storage
function checkPendingJump() {
  chrome.storage.local.get(["pendingJump"], (result: any) => {
    const jump = result.pendingJump as { url: string; messageId: string; domMessageId?: string } | undefined;
    if (jump && jump.url === window.location.href) {
      console.log("NavGPT: Found pending jump for this URL. Waiting for messages...", jump.messageId);

      // We need to wait until the message exists in the DOM
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        const hasTurns = document.querySelectorAll("[data-testid^='conversation-turn-']").length > 0 ||
                         document.querySelectorAll(".text-message").length > 0;
        if (hasTurns) {
          console.log("NavGPT: Messages found, executing pending jump.");
          jumpToMessage(jump.messageId, jump.domMessageId);
          chrome.storage.local.remove("pendingJump");
          clearInterval(interval);
        }
        if (attempts > 20) {
          console.warn("NavGPT: Pending jump timed out or too many attempts.");
          chrome.storage.local.remove("pendingJump");
          clearInterval(interval);
        }
      }, 500);
    }
  });
}

// Run pending jump check
checkPendingJump();
