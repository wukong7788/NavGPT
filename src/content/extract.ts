import { ChatMessageRecord } from "../shared/types";
import {
  SELECTORS,
  queryTurns,
  parseRoleFromUnitKey,
  resolveDomMessageId,
  isMessageUnitKey,
} from "./selectors";

const ROLE_LABEL_RE = /^(你说：|ChatGPT 说：|You said:|ChatGPT said:)\s*/i;

export function extractMessages(): ChatMessageRecord[] {
  const turns = queryTurns();

  console.log(`NavGPT Debug: Found ${turns.length} turns in active conversation.`);

  const records: ChatMessageRecord[] = [];

  const url = window.location.href;
  const match = url.match(/\/c\/([a-zA-Z0-9-]+)/);
  const conversationId = match ? match[1] : "default";

  let conversationTitle = "Untitled Chat";
  const titleEl = document.querySelector(SELECTORS.CONVERSATION_TITLE);
  if (titleEl && titleEl.textContent) {
    conversationTitle = titleEl.textContent.trim();
  } else if (document.title && document.title !== "ChatGPT") {
    conversationTitle = document.title.replace(/ - ChatGPT$/, "").trim();
  }

  turns.forEach((turn, index) => {
    const unitKey = turn.getAttribute(SELECTORS.UNIT_KEY_ATTR) || "";
    const role = resolveRole(turn);

    // Reject chrome / non-message nodes that slipped through fallbacks.
    const looksLikeMessage =
      isMessageUnitKey(unitKey) ||
      !!turn.getAttribute("data-testid")?.startsWith("conversation-turn-") ||
      !!turn.getAttribute(SELECTORS.ROLE_ATTR) ||
      !!turn.querySelector(`[${SELECTORS.ROLE_ATTR}]`) ||
      !!turn.querySelector(SELECTORS.USER_BUBBLE) ||
      !!turn.querySelector(SELECTORS.ASSISTANT_MARKDOWN);
    if (!looksLikeMessage) return;

    const contentEl = resolveContentElement(turn, role);
    if (!contentEl) {
      console.log(`NavGPT Debug: Turn ${index} has no content element matched.`);
    }

    let fullText = extractText(contentEl);
    if (!fullText) fullText = extractText(turn);
    fullText = fullText.replace(ROLE_LABEL_RE, "").trim();

    // Stale / still-loading assistant shells often only contain the sr-only label.
    if (!fullText) {
      if (role === "assistant") {
        // Keep a short placeholder so the row exists for jump once content paints,
        // but mark empty so navigation retry can wait for real text.
        fullText = "";
      } else if (role === "unknown") {
        return;
      }
    }

    const hasCode = !!turn.querySelector(SELECTORS.CODE_BLOCK);
    const turnTestId = turn.getAttribute("data-testid") || "";
    const domMessageId = resolveDomMessageId(turn);

    let stableId = `msg-${conversationId}-${domMessageId || unitKey || turnTestId || index}`;
    if (unitKey) {
      // Unit keys can repeat across chats; keep conversation + unit for stability.
      stableId = `msg-${conversationId}-${unitKey}`;
    }

    if (conversationId === "default" && !domMessageId && !unitKey) {
      const contentHash = simpleHash(fullText.substring(0, 100));
      stableId = `msg-def-${contentHash}-${index}`;
    }

    records.push({
      id: stableId,
      index: index + 1,
      listIndex: index,
      role,
      preview: fullText ? getPreview(fullText) : role === "assistant" ? "(loading…)" : "(empty)",
      fullText,
      hasCode,
      url,
      conversationId,
      conversationTitle,
      domMessageId: domMessageId || undefined,
      domUnitKey: unitKey || undefined,
    });
  });

  return records;
}

export function extractionLooksReady(messages: ChatMessageRecord[]): boolean {
  if (messages.length === 0) return false;

  // Sidebar chrome must never count as "ready".
  const real = messages.filter((m) => m.domUnitKey || m.domMessageId);
  if (real.length === 0) return false;

  const assistants = real.filter((m) => m.role === "assistant");
  if (assistants.length === 0) {
    // User-only turns are ok once we have real unit keys.
    return real.every((m) => !!m.domUnitKey || m.fullText.trim().length > 0);
  }
  return assistants.every((m) => m.fullText.trim().length > 0);
}

function resolveRole(turn: Element): ChatMessageRecord["role"] {
  const fromUnit = parseRoleFromUnitKey(turn.getAttribute(SELECTORS.UNIT_KEY_ATTR));
  if (fromUnit !== "unknown") return fromUnit;

  const roleAttr =
    turn.getAttribute(SELECTORS.ROLE_ATTR) ||
    turn.querySelector(`[${SELECTORS.ROLE_ATTR}]`)?.getAttribute(SELECTORS.ROLE_ATTR) ||
    turn.getAttribute(SELECTORS.ROLE_ATTR_NEW) ||
    turn.querySelector(`[${SELECTORS.ROLE_ATTR_NEW}]`)?.getAttribute(SELECTORS.ROLE_ATTR_NEW);

  if (roleAttr === "user" || roleAttr === "assistant") return roleAttr;

  if (turn.querySelector(SELECTORS.USER_BUBBLE) || turn.matches(SELECTORS.USER_BUBBLE)) {
    return "user";
  }
  if (turn.querySelector(SELECTORS.ASSISTANT_MARKDOWN)) {
    return "assistant";
  }

  return "unknown";
}

function resolveContentElement(turn: Element, role: ChatMessageRecord["role"]): Element | null {
  if (role === "user") {
    return (
      turn.querySelector(`${SELECTORS.USER_BUBBLE} ${SELECTORS.USER_TEXT}`) ||
      turn.querySelector(SELECTORS.USER_TEXT) ||
      turn.querySelector(SELECTORS.USER_BUBBLE) ||
      turn.querySelector(SELECTORS.CONTENT)
    );
  }

  if (role === "assistant") {
    return (
      turn.querySelector(SELECTORS.ASSISTANT_MARKDOWN) ||
      turn.querySelector(SELECTORS.CONTENT)
    );
  }

  return turn.querySelector(SELECTORS.CONTENT);
}

function extractText(el: Element | null): string {
  if (!el) return "";

  const cmContent = el.querySelector(".cm-content");
  if (cmContent) {
    const lines = Array.from(cmContent.querySelectorAll(".cm-line"))
      .map((line) => line.textContent)
      .join("\n");
    if (lines) return lines.trim();
    return (cmContent.textContent || "").trim();
  }

  // Prefer innerText so sr-only labels are less likely to dominate,
  // but fall back to textContent when innerText is empty (hidden containers).
  const inner = ("innerText" in el ? (el as HTMLElement).innerText : "") || "";
  const text = inner.trim() || (el.textContent || "").trim();
  return text;
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36).substring(0, 5);
}

function getPreview(text: string): string {
  const maxChars = 80;
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxChars) return cleaned;
  return cleaned.substring(0, maxChars) + "...";
}
