import { queryTurns } from "./selectors";

function getScrollableParent(el: Element): Element | null {
  let parent = el.parentElement;
  while (parent) {
    const style = getComputedStyle(parent);
    const overflowY = style.overflowY;
    if ((overflowY === "auto" || overflowY === "scroll") && parent.scrollHeight > parent.clientHeight) {
      return parent;
    }
    parent = parent.parentElement;
  }
  return null;
}

export function jumpToMessage(messageId: string, domMessageId?: string) {
  let target: Element | null = null;

  // 1. Prefer data-message-id for precise DOM targeting (most stable)
  if (domMessageId) {
    const el = document.querySelector(`[data-message-id="${domMessageId}"]`);
    if (el) {
      // Prefer the outer turn container over the inner .text-message
      target = el.closest("[data-testid^='conversation-turn-']") || el.closest(".text-message") || el;
    }
  }

  // 2. Fall back to index-based lookup
  if (!target) {
    const parts = messageId.split("-");
    const index = parseInt(parts[parts.length - 1], 10);

    if (isNaN(index)) {
      console.error("Invalid message ID for jumping:", messageId);
      return;
    }

    const turns = queryTurns();
    if (index >= 0 && index < turns.length) {
      target = turns[index];
    }
  }

  if (target) {
    const scrollContainer = getScrollableParent(target);

    // Sticky header offset
    const headerEl = document.querySelector("nav") || document.querySelector("[class*='sticky']") || document.querySelector("header");
    const offset = headerEl ? headerEl.getBoundingClientRect().bottom + 8 : 60;

    if (scrollContainer) {
      const targetRect = target.getBoundingClientRect();
      const containerRect = scrollContainer.getBoundingClientRect();
      const scrollTarget = scrollContainer.scrollTop + targetRect.top - containerRect.top - offset;
      scrollContainer.scrollTo({ top: scrollTarget, behavior: "smooth" });
    } else {
      const y = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top: y, behavior: "smooth" });
    }

    highlightElement(target as HTMLElement);
  } else {
    console.warn("Jump target not found for message:", messageId);
  }
}

function highlightElement(el: HTMLElement) {
  // Add the class for the animation (defined in content style)
  el.classList.add("navgpt-highlight");

  setTimeout(() => {
    el.classList.remove("navgpt-highlight");
  }, 2000);
}

// Inject static styles for the highlight and layout fixes
export function injectStyles() {
  const STYLE_ID = "navgpt-styles";
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement;
  
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }

  style.textContent = `
    @keyframes navgpt-flash {
      0% { background-color: rgba(16, 163, 127, 0.2); }
      100% { background-color: transparent; }
    }
    .navgpt-highlight {
      animation: navgpt-flash 2s ease-out forwards;
      border-left: 4px solid #10a37f !important;
    }

    /* SPECIFIC FIX FOR CODEMIRROR (ChatGPT's new code viewer) */
    /* We target multiple nested levels to ensure the wrap sticks */
    .cm-editor, .cm-scroller, .cm-content, .cm-line {
      white-space: pre-wrap !important;
      word-break: break-all !important;
      overflow-wrap: anywhere !important;
    }

    .cm-content {
      display: block !important;
    }

    .cm-line {
      display: block !important;
      max-width: 100% !important;
      overflow-wrap: anywhere !important;
    }

    /* Force parent containers to not clip or provide their own scrolls */
    .overflow-x-hidden {
      overflow-x: visible !important;
    }

    [id="code-block-viewer"] {
      height: auto !important;
      max-height: none !important;
      max-width: 100% !important;
    }

    pre, code {
      white-space: pre-wrap !important;
      word-break: break-all !important;
    }
  `;
}
