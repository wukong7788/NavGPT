import { ChatMessageRecord } from "../shared/types";
import {
  SELECTORS,
  queryTurns,
  parseRoleFromUnitKey,
  resolveDomMessageId,
} from "./selectors";

export function extractMessages(): ChatMessageRecord[] {
  const turns = queryTurns();

  console.log(`NavGPT Debug: Found ${turns.length} turns in DOM.`);

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
    const role = resolveRole(turn);

    const contentEl = resolveContentElement(turn, role);
    if (!contentEl) {
      console.log(`NavGPT Debug: Turn ${index} has no content element matched.`);
    }

    let fullText = extractText(contentEl) || extractText(turn);

    // Strip screen-reader role labels that ChatGPT injects into units
    fullText = fullText
      .replace(/^(你说：|ChatGPT 说：|You said:|ChatGPT said:)\s*/i, "")
      .trim();

    if (!fullText && role === "unknown") return;

    const hasCode = !!turn.querySelector(SELECTORS.CODE_BLOCK);

    const unitKey = turn.getAttribute(SELECTORS.UNIT_KEY_ATTR) || "";
    const turnTestId = turn.getAttribute("data-testid") || "";
    const domMessageId = resolveDomMessageId(turn);

    let stableId = `msg-${conversationId}-${domMessageId || unitKey || turnTestId || index}`;

    if (conversationId === "default" && !domMessageId) {
      const contentHash = simpleHash(fullText.substring(0, 100));
      stableId = `msg-def-${contentHash}-${index}`;
    }

    records.push({
      id: stableId,
      index: index + 1,
      role,
      preview: getPreview(fullText),
      fullText,
      hasCode,
      url,
      conversationId,
      conversationTitle,
      domMessageId: domMessageId || undefined,
    });
  });

  return records;
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

  return (el.textContent || "").trim();
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
