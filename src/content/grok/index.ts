import { MessagePayload } from "../../shared/types";
import { syncProjectsFromPage } from "../../shared/grokProjects";
import { clearPendingGrokPrompt, peekPendingGrokPrompt } from "../../shared/pendingGrok";
import {
  configureFloatingPanel,
  initFloatingPanel,
  setPanelMessages,
  setPanelStatus,
  togglePanel,
} from "../panel";
import { extractGrokMessages, extractionGrokLooksReady, hasGrokMessages } from "./extract";
import { jumpToGrokMessage } from "./jump";

console.log("NavGPT Grok content script loaded.");

const HIGHLIGHT_STYLE_ID = "navgpt-grok-highlight-style";

function injectHighlightStyles() {
  if (document.getElementById(HIGHLIGHT_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = HIGHLIGHT_STYLE_ID;
  style.textContent = `
    [data-navgpt-grok-msg].navgpt-highlight {
      outline: 2px solid #10a37f;
      outline-offset: 4px;
      border-radius: 8px;
      transition: outline-color 0.3s ease;
    }
  `;
  document.documentElement.appendChild(style);
}

configureFloatingPanel({
  extractMessages: extractGrokMessages,
  jumpToMessage: jumpToGrokMessage,
  siteLabel: "Grok",
  showShareToX: false,
  syncProjectsLabel: "同步 Grok 项目",
  syncProjects: async () => {
    const result = await syncProjectsFromPage();
    if (result.count === 0) {
      return "未找到项目。请先登录 grok.com，再点同步。";
    }
    const parts = [`已同步 ${result.count} 个项目`];
    if (result.added) parts.push(`新增 ${result.added}`);
    if (result.updated) parts.push(`更新 ${result.updated}`);
    if (result.removed) parts.push(`清理 ${result.removed}`);
    return parts.join(" · ");
  },
});

injectHighlightStyles();
initFloatingPanel();

// ── Pending prompt delivery (from X → Grok) ──────────────────────────

const INPUT_SELECTORS = [
  ".tiptap",
  'div[contenteditable="true"][role="textbox"]',
  'div.ProseMirror[contenteditable="true"]',
  '[data-testid="grokInput"]',
  'textarea[placeholder*="Ask" i]',
  'textarea[placeholder*="问" i]',
  'textarea[data-testid="grok-input"]',
  'div[contenteditable="true"]',
  "textarea",
];

const SEND_SELECTORS = [
  'button[aria-label="Send"]',
  'button[aria-label="发送"]',
  'button[aria-label*="Send" i]',
  'button[aria-label*="发送"]',
  '[data-testid="grokSend"]',
  '[data-testid="grokSendButton"]',
  'button[type="submit"]',
];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findInput(): HTMLElement | null {
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
    if (el instanceof HTMLElement) return el;
  }

  const buttons = Array.from(document.querySelectorAll("button"));
  return (
    buttons.find((btn) => {
      const label = `${btn.getAttribute("aria-label") || ""} ${btn.textContent || ""}`.toLowerCase();
      return /send|提交|发送/.test(label);
    }) || null
  );
}

async function fillEditor(el: HTMLElement, text: string): Promise<boolean> {
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

async function tryDeliverPendingPrompt(): Promise<boolean> {
  const pending = await peekPendingGrokPrompt();
  if (!pending) return false;

  for (let i = 0; i < 40; i++) {
    const input = findInput();
    if (input) {
      const ok = await fillEditor(input, pending.prompt);
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

      await clearPendingGrokPrompt();
      console.log("NavGPT Grok: pending prompt delivered.");
      return true;
    }
    await sleep(250);
  }

  console.warn("NavGPT Grok: could not find chat input; prompt left in clipboard/storage briefly.");
  return false;
}

// ── Navigation panel: rescan + SPA ───────────────────────────────────

let debounceTimer: number | null = null;
let navigationTimer: number | null = null;
let lastUrl = window.location.href;
let didAutoSync = false;

function runRescan(reason: string) {
  const messages = extractGrokMessages();
  console.log(`NavGPT Grok rescan (${reason}): ${messages.length} messages.`);
  setPanelMessages(messages);
  return messages;
}

function debouncedRescan() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => {
    runRescan("mutation");
  }, 500);
}

function rescanAfterNavigation() {
  if (navigationTimer) clearTimeout(navigationTimer);

  setPanelMessages([]);
  setPanelStatus("Switching chat...");

  let attempts = 0;
  const maxAttempts = 20;

  const tick = () => {
    attempts++;
    const messages = runRescan(`navigation-${attempts}`);
    void tryDeliverPendingPrompt();

    if (extractionGrokLooksReady(messages) || attempts >= maxAttempts) {
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
  console.log("NavGPT Grok: URL changed →", url);
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
  window.setInterval(onUrlMaybeChanged, 800);
}

async function autoSyncProjectsOnce() {
  if (didAutoSync) return;
  try {
    const result = await syncProjectsFromPage();
    if (result.count > 0) {
      didAutoSync = true;
      console.log(
        `NavGPT Grok: auto-synced ${result.count} projects (+${result.added} / ~${result.updated})`
      );
    }
  } catch (err) {
    console.warn("NavGPT Grok: auto sync failed", err);
  }
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
void tryDeliverPendingPrompt();
void autoSyncProjectsOnce();
window.setTimeout(() => void autoSyncProjectsOnce(), 2500);

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
    jumpToGrokMessage(message.messageId, message.domMessageId, {
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

    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (hasGrokMessages()) {
        jumpToGrokMessage(jump.messageId, jump.domMessageId, {
          domUnitKey: jump.domUnitKey,
          role: jump.role,
          listIndex: jump.listIndex,
        });
        chrome.storage.local.remove("pendingJump");
        clearInterval(interval);
      }
      if (attempts > 20) {
        chrome.storage.local.remove("pendingJump");
        clearInterval(interval);
      }
    }, 500);
  });
}

checkPendingJump();
