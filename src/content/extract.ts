import { ChatMessageRecord } from "../shared/types";
import { SELECTORS, queryTurns } from "./selectors";

export function extractMessages(): ChatMessageRecord[] {
  const turns = queryTurns();
  
  console.log(`NavGPT Debug: Found ${turns.length} turns in DOM.`);

  const records: ChatMessageRecord[] = [];

  const url = window.location.href;
  const match = url.match(/\/c\/([a-zA-Z0-9-]+)/);
  const conversationId = match ? match[1] : "default";

  // Try to find the active conversation title in the sidebar
  let conversationTitle = "Untitled Chat";
  const titleEl = document.querySelector(SELECTORS.CONVERSATION_TITLE);
  if (titleEl && titleEl.textContent) {
    conversationTitle = titleEl.textContent.trim();
  } else if (document.title && document.title !== "ChatGPT") {
    // Fallback to page title, cleaning up any " - ChatGPT" suffixes if present
    conversationTitle = document.title.replace(/ - ChatGPT$/, "").trim();
  }

  turns.forEach((turn, index) => {
    const roleAttr = turn.getAttribute(SELECTORS.ROLE_ATTR) ||
                     turn.querySelector(`[${SELECTORS.ROLE_ATTR}]`)?.getAttribute(SELECTORS.ROLE_ATTR);

    const role: ChatMessageRecord["role"] =
      roleAttr === "user" ? "user" :
      roleAttr === "assistant" ? "assistant" :
      "unknown";

    const contentEl = turn.querySelector(SELECTORS.CONTENT);
    if (!contentEl) {
      console.log(`NavGPT Debug: Turn ${index} has no content element matched.`);
    }

    let fullText = "";

    if (contentEl) {
      // Check for CodeMirror content
      const cmContent = contentEl.querySelector(".cm-content");
      if (cmContent) {
        // CodeMirror might represent lines in separate divs or spans
        fullText = Array.from(cmContent.querySelectorAll(".cm-line"))
          .map(line => line.textContent)
          .join("\n");

        // If cm-line is not used, fallback to textContent
        if (!fullText) fullText = cmContent.textContent || "";
      } else {
        fullText = contentEl.textContent?.trim() || "";
      }
    }

    // Skip empty messages (like loading states)
    if (!fullText && role === "unknown") return;

    const hasCode = !!turn.querySelector(SELECTORS.CODE_BLOCK) || !!turn.querySelector(".cm-editor");

    // Stable ID generation
    // 1. Try to get the test-id from the turn element (e.g., conversation-turn-5)
    const turnTestId = turn.getAttribute("data-testid") || "";

    // 2. Extract data-message-id for precise DOM identification
    //    The .text-message element may be the turn itself or a child
    const textMsgEl = turn.matches?.('.text-message')
      ? turn
      : turn.querySelector('.text-message');
    const domMessageId = textMsgEl?.getAttribute('data-message-id') || "";

    // 3. Generate a stable ID
    let stableId = `msg-${conversationId}-${turnTestId || index}`;

    if (conversationId === "default") {
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

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36).substring(0, 5);
}

function getPreview(text: string): string {
  const maxChars = 80;
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxChars) return cleaned;
  return cleaned.substring(0, maxChars) + "...";
}
