/**
 * ChatGPT DOM selectors — keep assumptions centralized.
 *
 * 2026 UI (current):
 * - Message unit: [data-content-search-unit-key] values like "fallback-turn-0:0:user"
 * - Turn wrapper: [data-turn-key]
 * - Active transcript: [data-thread-find-target="conversation"]
 * - User bubble: [data-user-message-bubble]
 * - Assistant markdown: [data-markdown-text-style]
 *
 * During SPA chat switches, ChatGPT may keep the previous transcript mounted
 * (height 0). Always prefer the laid-out / visible conversation root.
 *
 * IMPORTANT: Never fall back to document-wide `.group.w-full` — ChatGPT's
 * sidebar/profile chrome also uses those Tailwind classes.
 */
export const SELECTORS = {
  MESSAGE_UNIT: "[data-content-search-unit-key]",
  TURN: "[data-turn-key]",
  CONVERSATION_ROOT: '[data-thread-find-target="conversation"]',

  MESSAGE_TURN: "[data-testid^='conversation-turn-']",
  MESSAGE_TURN_NEW: ".text-message",

  USER_BUBBLE: "[data-user-message-bubble]",
  ASSISTANT_MARKDOWN: "[data-markdown-text-style], [class*='MarkdownRoot']",
  USER_TEXT: ".whitespace-pre-wrap",
  CONTENT:
    "[data-markdown-text-style], [class*='MarkdownRoot'], .whitespace-pre-wrap, .markdown, .prose, .flex-col.gap-1, [class*='markdown'], pre, [class*='overflow-wrap']",

  ROLE_ATTR: "data-message-author-role",
  ROLE_ATTR_NEW: "data-conversation-role",
  UNIT_KEY_ATTR: "data-content-search-unit-key",

  SEARCH_MESSAGE_IDS: "data-chatgpt-search-message-ids",
  DIL_MESSAGE_ID: "data-dil-message-id",
  SELECTION_MESSAGE_ID: "data-chatgpt-selection-message-id",
  TURN_KEY: "data-turn-key",
  LEGACY_MESSAGE_ID: "data-message-id",

  CODE_BLOCK: "pre, code, .cm-editor",

  CONVERSATION_TITLE:
    "a[aria-current='page'], nav ul li a[data-active] span[dir='auto'], a[aria-current='page'] span[dir='auto'], li:has(a[data-discover='true']) span[dir='auto']",
};

const UNIT_KEY_ROLE_RE = /:(user|assistant)$/;

export function isLaidOut(el: Element): boolean {
  const rect = el.getBoundingClientRect();
  return rect.height > 0 && rect.width > 0;
}

export function isMessageUnitKey(unitKey: string | null | undefined): boolean {
  return !!unitKey && UNIT_KEY_ROLE_RE.test(unitKey);
}

/** Prefer the live transcript; SPA switches often leave a zero-height stale root. */
export function getActiveConversationRoot(): Element | null {
  const roots = Array.from(document.querySelectorAll(SELECTORS.CONVERSATION_ROOT));
  if (roots.length === 0) return null;

  let best: Element | null = null;
  let bestVisible = -1;

  for (const root of roots) {
    const units = root.querySelectorAll(SELECTORS.MESSAGE_UNIT);
    let visible = 0;
    units.forEach((unit) => {
      if (isLaidOut(unit) && isMessageUnitKey(unit.getAttribute(SELECTORS.UNIT_KEY_ATTR))) {
        visible++;
      }
    });
    if (visible > bestVisible) {
      bestVisible = visible;
      best = root;
    }
  }

  if (bestVisible > 0) return best;

  // Early paint: nothing laid out yet — use the newest root.
  return roots[roots.length - 1] || null;
}

function unitsIn(scope: ParentNode): Element[] {
  return Array.from(scope.querySelectorAll(SELECTORS.MESSAGE_UNIT)).filter((el) =>
    isMessageUnitKey(el.getAttribute(SELECTORS.UNIT_KEY_ATTR))
  );
}

/**
 * Only return real conversation message nodes.
 * Never scan the whole document for generic `.group.w-full` chrome.
 */
export function queryTurns(): Element[] {
  const root = getActiveConversationRoot();
  if (!root) return [];

  const units = unitsIn(root);
  const laidOut = units.filter(isLaidOut);
  if (laidOut.length > 0) return laidOut;
  if (units.length > 0) return units;

  // Legacy formats — still scoped to the conversation root only.
  let turns = Array.from(root.querySelectorAll(SELECTORS.MESSAGE_TURN));
  if (turns.length > 0) {
    const visible = turns.filter(isLaidOut);
    return visible.length > 0 ? visible : turns;
  }

  turns = Array.from(root.querySelectorAll(SELECTORS.MESSAGE_TURN_NEW));
  if (turns.length > 0) {
    const visible = turns.filter(isLaidOut);
    return visible.length > 0 ? visible : turns;
  }

  turns = Array.from(root.querySelectorAll(SELECTORS.TURN));
  if (turns.length > 0) {
    const visible = turns.filter(isLaidOut);
    return visible.length > 0 ? visible : turns;
  }

  return [];
}

export function parseRoleFromUnitKey(unitKey: string | null | undefined): "user" | "assistant" | "unknown" {
  if (!unitKey) return "unknown";
  if (unitKey.endsWith(":user") || /:user(?:$|:)/.test(unitKey)) return "user";
  if (unitKey.endsWith(":assistant") || /:assistant(?:$|:)/.test(unitKey)) return "assistant";
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

export type FindMessageOptions = {
  unitKey?: string;
  role?: "user" | "assistant" | "unknown";
  listIndex?: number;
};

export function findMessageElement(domMessageId: string, opts: FindMessageOptions = {}): Element | null {
  const root = getActiveConversationRoot();
  if (!root) return null;

  if (opts.unitKey && isMessageUnitKey(opts.unitKey)) {
    const byKey = Array.from(
      root.querySelectorAll(`[${SELECTORS.UNIT_KEY_ATTR}="${cssEscape(opts.unitKey)}"]`)
    ).find(isLaidOut);
    if (byKey) return byKey;
  }

  if (domMessageId) {
    const candidates = [
      `[${SELECTORS.DIL_MESSAGE_ID}="${cssEscape(domMessageId)}"]`,
      `[${SELECTORS.SELECTION_MESSAGE_ID}="${cssEscape(domMessageId)}"]`,
      `[${SELECTORS.SEARCH_MESSAGE_IDS}*="${cssEscape(domMessageId)}"]`,
      `[${SELECTORS.TURN_KEY}="${cssEscape(domMessageId)}"]`,
      `[${SELECTORS.LEGACY_MESSAGE_ID}="${cssEscape(domMessageId)}"]`,
      `[data-message-id="${cssEscape(domMessageId)}"]`,
    ];

    for (const sel of candidates) {
      const matches = Array.from(root.querySelectorAll(sel));
      const el = matches.find(isLaidOut) || matches[0];
      if (!el) continue;

      const turn = el.closest(SELECTORS.TURN) || (el.hasAttribute(SELECTORS.TURN_KEY) ? el : null);
      if (turn && (el === turn || el.hasAttribute(SELECTORS.TURN_KEY))) {
        const roleSuffix = opts.role === "assistant" ? ":assistant" : opts.role === "user" ? ":user" : "";
        if (roleSuffix) {
          const roleUnit = Array.from(turn.querySelectorAll(SELECTORS.MESSAGE_UNIT)).find((unit) =>
            (unit.getAttribute(SELECTORS.UNIT_KEY_ATTR) || "").endsWith(roleSuffix)
          );
          if (roleUnit && isLaidOut(roleUnit)) return roleUnit;
        }
      }

      const unit =
        el.closest(SELECTORS.MESSAGE_UNIT) ||
        (el.matches?.(SELECTORS.MESSAGE_UNIT) ? el : null);
      if (unit && isLaidOut(unit)) return unit;
      if (unit) return unit;

      return el.closest(SELECTORS.TURN) || el.closest(SELECTORS.MESSAGE_TURN) || el;
    }
  }

  if (typeof opts.listIndex === "number") {
    const turns = queryTurns();
    if (opts.listIndex >= 0 && opts.listIndex < turns.length) {
      return turns[opts.listIndex];
    }
  }

  return null;
}

function cssEscape(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replace(/["\\]/g, "\\$&");
}
