import { findMessageElement, queryTurns, SELECTORS } from "./selectors";

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

  if (domMessageId) {
    target = findMessageElement(domMessageId);
  }

  // Fall back to index suffix on generated ids: msg-...-<index>
  if (!target) {
    const parts = messageId.split("-");
    const index = parseInt(parts[parts.length - 1], 10);

    if (!isNaN(index)) {
      const turns = queryTurns();
      if (index >= 0 && index < turns.length) {
        target = turns[index];
      }
    }
  }

  if (target) {
    const scrollContainer = getScrollableParent(target);

    const headerEl =
      document.querySelector("nav") ||
      document.querySelector("[class*='sticky']") ||
      document.querySelector("header");
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
  el.classList.add("navgpt-highlight");

  setTimeout(() => {
    el.classList.remove("navgpt-highlight");
  }, 2000);
}

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

export function hasExtractableMessages(): boolean {
  return (
    document.querySelectorAll(SELECTORS.MESSAGE_UNIT).length > 0 ||
    document.querySelectorAll(SELECTORS.TURN).length > 0 ||
    document.querySelectorAll(SELECTORS.MESSAGE_TURN).length > 0 ||
    document.querySelectorAll(SELECTORS.MESSAGE_TURN_NEW).length > 0
  );
}
