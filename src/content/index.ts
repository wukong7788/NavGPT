import { MessagePayload } from "../shared/types";
import { syncChatgptProjectsFromPage } from "../shared/chatgptProjects";
import {
  clearPendingChatgptPrompt,
  peekPendingChatgptPrompt,
} from "../shared/pendingChatgpt";
import { extractMessages, extractionLooksReady } from "./extract";
import { jumpToMessage, injectStyles, hasExtractableMessages } from "./jump";
import {
  configureFloatingPanel,
  initFloatingPanel,
  togglePanel,
  setPanelMessages,
  setPanelStatus,
} from "./panel";

configureFloatingPanel({
  siteLabel: "ChatGPT",
  showShareToX: true,
  syncProjectsLabel: "同步 ChatGPT 项目",
  syncProjects: async () => {
    const result = await syncChatgptProjectsFromPage();
    if (result.count === 0) {
      return "未找到项目。请先登录并展开侧栏 Projects 后再同步。";
    }
    const parts = [`已同步 ${result.count} 个项目`];
    if (result.added) parts.push(`新增 ${result.added}`);
    if (result.updated) parts.push(`更新 ${result.updated}`);
    if (result.removed) parts.push(`清理 ${result.removed}`);
    return parts.join(" · ");
  },
});

injectStyles();
initFloatingPanel();

console.log("NavGPT Content Script loaded.");

// ── Pending prompt delivery (from iHerb → ChatGPT) ───────────────────

const INPUT_SELECTORS = [
  "#prompt-textarea",
  'div[contenteditable="true"]#prompt-textarea',
  'div.ProseMirror[contenteditable="true"]',
  'div[contenteditable="true"][data-placeholder]',
  'textarea[placeholder*="Message" i]',
  'textarea[placeholder*="Ask" i]',
  'div[contenteditable="true"][role="textbox"]',
  'div[contenteditable="true"]',
  "textarea",
];

const SEND_SELECTORS = [
  'button[data-testid="send-button"]',
  'button[aria-label="Send prompt"]',
  'button[aria-label="Send"]',
  'button[aria-label="发送"]',
  'button[aria-label*="Send" i]',
  'button[aria-label*="发送"]',
];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findChatInput(): HTMLElement | null {
  for (const sel of INPUT_SELECTORS) {
    const el = document.querySelector(sel);
    if (!(el instanceof HTMLElement)) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width > 40 && rect.height > 16) return el;
  }
  return null;
}

function findSendButton(): HTMLElement | null {
  for (const sel of SEND_SELECTORS) {
    const el = document.querySelector(sel);
    if (el instanceof HTMLElement && !(el as HTMLButtonElement).disabled) return el;
  }

  const buttons = Array.from(document.querySelectorAll("button"));
  return (
    buttons.find((btn) => {
      if (btn.disabled) return false;
      const label = `${btn.getAttribute("aria-label") || ""} ${btn.textContent || ""}`.toLowerCase();
      return /send|提交|发送/.test(label);
    }) || null
  );
}

async function fillChatEditor(el: HTMLElement, text: string): Promise<boolean> {
  el.focus();

  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    const proto = Object.getOwnPropertyDescriptor(
      el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
      "value"
    );
    proto?.set?.call(el, text);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return el.value.includes(text.slice(0, 20));
  }

  try {
    document.execCommand("selectAll", false);
    document.execCommand("insertText", false, text);
  } catch {
    el.textContent = text;
  }

  el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
  el.dispatchEvent(new Event("change", { bubbles: true }));

  const current = (el.innerText || el.textContent || "").trim();
  return current.length > 0;
}

async function tryDeliverPendingChatgptPrompt(): Promise<boolean> {
  const pending = await peekPendingChatgptPrompt();
  if (!pending) return false;

  for (let i = 0; i < 40; i++) {
    const input = findChatInput();
    if (input) {
      const ok = await fillChatEditor(input, pending.prompt);
      if (!ok) {
        await sleep(200);
        continue;
      }

      await sleep(250);
      const sendBtn = findSendButton();
      if (sendBtn) {
        sendBtn.click();
      } else {
        input.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Enter",
            code: "Enter",
            bubbles: true,
            cancelable: true,
          })
        );
      }

      await clearPendingChatgptPrompt();
      console.log("NavGPT ChatGPT: pending prompt delivered.");
      return true;
    }
    await sleep(250);
  }

  console.warn("NavGPT ChatGPT: could not find chat input; prompt left in clipboard/storage briefly.");
  return false;
}

void tryDeliverPendingChatgptPrompt();

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

let didAutoSyncChatgptProjects = false;
async function autoSyncChatgptProjectsOnce() {
  if (didAutoSyncChatgptProjects) return;
  try {
    const result = await syncChatgptProjectsFromPage();
    if (result.count > 0) {
      didAutoSyncChatgptProjects = true;
      console.log(
        `NavGPT ChatGPT: auto-synced ${result.count} projects (+${result.added} / ~${result.updated})`
      );
    }
  } catch (err) {
    console.warn("NavGPT ChatGPT: auto sync failed", err);
  }
}

void autoSyncChatgptProjectsOnce();
window.setTimeout(() => void autoSyncChatgptProjectsOnce(), 2500);
