/**
 * ChatGPT DOM selectors — keep assumptions centralized.
 *
 * 2026 UI (current):
 * - Message unit: [data-content-search-unit-key] values like "fallback-turn-0:0:user"
 * - Turn wrapper: [data-turn-key]
 * - User bubble: [data-user-message-bubble]
 * - Assistant markdown: [data-markdown-text-style]
 * - Message ids: data-chatgpt-search-message-ids / data-dil-message-id / data-turn-key
 *
 * Legacy (kept as fallbacks):
 * - [data-testid^='conversation-turn-'], .text-message, [data-message-author-role]
 */
export const SELECTORS = {
  // Current ChatGPT: one unit per user/assistant message
  MESSAGE_UNIT: "[data-content-search-unit-key]",
  TURN: "[data-turn-key]",

  // Legacy turn wrappers
  MESSAGE_TURN: "[data-testid^='conversation-turn-']",
  MESSAGE_TURN_NEW: ".text-message",

  // Content areas
  USER_BUBBLE: "[data-user-message-bubble]",
  ASSISTANT_MARKDOWN: "[data-markdown-text-style]",
  USER_TEXT: ".whitespace-pre-wrap",
  CONTENT:
    "[data-markdown-text-style], .whitespace-pre-wrap, .markdown, .prose, .flex-col.gap-1, [class*='markdown'], pre, [class*='overflow-wrap']",

  // Role attributes
  ROLE_ATTR: "data-message-author-role",
  ROLE_ATTR_NEW: "data-conversation-role",
  UNIT_KEY_ATTR: "data-content-search-unit-key",

  // Message identity
  SEARCH_MESSAGE_IDS: "data-chatgpt-search-message-ids",
  DIL_MESSAGE_ID: "data-dil-message-id",
  SELECTION_MESSAGE_ID: "data-chatgpt-selection-message-id",
  TURN_KEY: "data-turn-key",
  LEGACY_MESSAGE_ID: "data-message-id",

  // Code block indicator
  CODE_BLOCK: "pre, code, .cm-editor",

  // Conversation title from the sidebar (active item)
  CONVERSATION_TITLE:
    "a[aria-current='page'], nav ul li a[data-active] span[dir='auto'], a[aria-current='page'] span[dir='auto'], li:has(a[data-discover='true']) span[dir='auto']",
};

export function queryTurns(): NodeListOf<Element> {
  // Prefer per-message units (user + assistant separately)
  const units = document.querySelectorAll(SELECTORS.MESSAGE_UNIT);
  if (units.length > 0) return units;

  // Legacy ChatGPT formats
  let turns = document.querySelectorAll(SELECTORS.MESSAGE_TURN);
  if (turns.length > 0) return turns;

  turns = document.querySelectorAll(SELECTORS.MESSAGE_TURN_NEW);
  if (turns.length > 0) return turns;

  // Turn wrappers still group user+assistant; better than nothing
  turns = document.querySelectorAll(SELECTORS.TURN);
  if (turns.length > 0) return turns;

  return document.querySelectorAll("article, .group.w-full");
}

export function parseRoleFromUnitKey(unitKey: string | null | undefined): "user" | "assistant" | "unknown" {
  if (!unitKey) return "unknown";
  if (/:user(?:$|:)/.test(unitKey) || unitKey.endsWith(":user")) return "user";
  if (/:assistant(?:$|:)/.test(unitKey) || unitKey.endsWith(":assistant")) return "assistant";
  return "unknown";
}

export function resolveDomMessageId(el: Element): string {
  const searchIds = el.getAttribute(SELECTORS.SEARCH_MESSAGE_IDS);
  if (searchIds) {
    const first = searchIds.trim().split(/\s+/)[0];
    if (first) return first;
  }

  const dil =
    el.getAttribute(SELECTORS.DIL_MESSAGE_ID) ||
    el.querySelector(`[${SELECTORS.DIL_MESSAGE_ID}]`)?.getAttribute(SELECTORS.DIL_MESSAGE_ID);
  if (dil) return dil;

  const selection =
    el.getAttribute(SELECTORS.SELECTION_MESSAGE_ID) ||
    el.querySelector(`[${SELECTORS.SELECTION_MESSAGE_ID}]`)?.getAttribute(SELECTORS.SELECTION_MESSAGE_ID);
  if (selection) return selection;

  const legacy =
    el.getAttribute(SELECTORS.LEGACY_MESSAGE_ID) ||
    el.querySelector(`[${SELECTORS.LEGACY_MESSAGE_ID}]`)?.getAttribute(SELECTORS.LEGACY_MESSAGE_ID);
  if (legacy) return legacy;

  const turnKey =
    el.getAttribute(SELECTORS.TURN_KEY) ||
    el.closest(SELECTORS.TURN)?.getAttribute(SELECTORS.TURN_KEY);
  if (turnKey) return turnKey;

  return "";
}

export function findMessageElement(domMessageId: string): Element | null {
  if (!domMessageId) return null;

  const candidates = [
    `[${SELECTORS.DIL_MESSAGE_ID}="${domMessageId}"]`,
    `[${SELECTORS.SELECTION_MESSAGE_ID}="${domMessageId}"]`,
    `[${SELECTORS.SEARCH_MESSAGE_IDS}*="${domMessageId}"]`,
    `[${SELECTORS.TURN_KEY}="${domMessageId}"]`,
    `[${SELECTORS.LEGACY_MESSAGE_ID}="${domMessageId}"]`,
    `[data-message-id="${domMessageId}"]`,
  ];

  for (const sel of candidates) {
    const el = document.querySelector(sel);
    if (!el) continue;

    // Prefer the message unit when available
    const unit = el.closest(SELECTORS.MESSAGE_UNIT) || (el.matches(SELECTORS.MESSAGE_UNIT) ? el : null);
    if (unit) {
      // If we matched a turn key, prefer the user unit inside that turn
      if (el.matches(SELECTORS.TURN) || el.hasAttribute(SELECTORS.TURN_KEY)) {
        const userUnit = el.querySelector(`${SELECTORS.MESSAGE_UNIT}[data-content-search-unit-key$=":user"]`);
        if (userUnit) return userUnit;
      }
      return unit;
    }

    return (
      el.closest(SELECTORS.TURN) ||
      el.closest(SELECTORS.MESSAGE_TURN) ||
      el.closest(SELECTORS.MESSAGE_TURN_NEW) ||
      el
    );
  }

  return null;
}
