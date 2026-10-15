import { MessagePayload } from "../shared/types";
import { extractMessages, extractionLooksReady } from "./extract";
import { jumpToMessage, injectStyles, hasExtractableMessages } from "./jump";
import {
  initFloatingPanel,
  togglePanel,
  setPanelMessages,
  setPanelStatus,
} from "./panel";

injectStyles();
initFloatingPanel();

console.log("NavGPT Content Script loaded.");

let debounceTimer: number | null = null;
let navigationTimer: number | null = null;
let lastUrl = window.location.href;

function runRescan(reason: string) {
  const messages = extractMessages();
  console.log(`NavGPT rescan (${reason}): ${messages.length} messages.`);
  setPanelMessages(messages);
  return messages;
}

function debouncedRescan() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => {
    runRescan("mutation");
  }, 500);
}

/** After SPA navigation, retry until the active chat's AI text is ready. */
function rescanAfterNavigation() {
  if (navigationTimer) clearTimeout(navigationTimer);

  setPanelMessages([]);
  setPanelStatus("Switching chat...");

  let attempts = 0;
  const maxAttempts = 20;

  const tick = () => {
    attempts++;
    const messages = runRescan(`navigation-${attempts}`);

    if (extractionLooksReady(messages) || attempts >= maxAttempts) {
      navigationTimer = null;
      return;
    }

    navigationTimer = window.setTimeout(tick, 300);
  };

  navigationTimer = window.setTimeout(tick, 120);
}

function onUrlMaybeChanged() {
  const url = window.location.href;
  if (url === lastUrl) return;
  lastUrl = url;
  console.log("NavGPT: URL changed →", url);
  rescanAfterNavigation();
}

function watchSpaNavigation() {
  const wrapHistory = (method: "pushState" | "replaceState") => {
    const original = history[method];
    history[method] = function (this: History, ...args: Parameters<History["pushState"]>) {
      const result = original.apply(this, args);
      onUrlMaybeChanged();
      return result;
    };
  };

  wrapHistory("pushState");
  wrapHistory("replaceState");
  window.addEventListener("popstate", onUrlMaybeChanged);

  // Fallback for ChatGPT navigations that bypass history hooks
  window.setInterval(onUrlMaybeChanged, 800);
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

watchSpaNavigation();

chrome.runtime.onMessage.addListener((message: MessagePayload) => {
  if (message.type === "TOGGLE_PANEL") {
    togglePanel();
    return;
  }

  if (message.type === "RESCAN_REQUEST") {
    runRescan("manual");
    return;
  }

  if (message.type === "JUMP_TO_MESSAGE") {
    jumpToMessage(message.messageId, message.domMessageId, {
      domUnitKey: message.domUnitKey,
      role: message.role,
      listIndex: message.listIndex,
    });
  }
});

function checkPendingJump() {
  chrome.storage.local.get(["pendingJump"], (result) => {
    const jump = result.pendingJump as
      | {
          url: string;
          messageId: string;
          domMessageId?: string;
          domUnitKey?: string;
          role?: "user" | "assistant" | "unknown";
          listIndex?: number;
        }
      | undefined;

    if (!jump || jump.url !== window.location.href) return;

    console.log("NavGPT: Found pending jump for this URL.", jump.messageId);

    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (hasExtractableMessages()) {
        console.log("NavGPT: Messages found, executing pending jump.");
        jumpToMessage(jump.messageId, jump.domMessageId, {
          domUnitKey: jump.domUnitKey,
          role: jump.role,
          listIndex: jump.listIndex,
        });
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
