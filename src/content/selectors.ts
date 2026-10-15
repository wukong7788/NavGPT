export const SELECTORS = {
  // Each message turn in the conversation
  MESSAGE_TURN: "[data-testid^='conversation-turn-']",
  MESSAGE_TURN_NEW: ".text-message",
  // The actual text content area (usually markdown)
  CONTENT: ".markdown, .prose, .flex-col.gap-1, [class*='markdown'], pre, .whitespace-pre-wrap, [class*='overflow-wrap']",
  // Role attribute on the turn or its children
  ROLE_ATTR: "data-message-author-role",
  // Code block indicator
  CODE_BLOCK: "pre, code",
  // Conversation title from the sidebar (active item)
  CONVERSATION_TITLE: "nav ul li a[data-active] span[dir='auto'], a[aria-current='page'] span[dir='auto'], li:has(a[data-discover='true']) span[dir='auto']",
};

export function queryTurns(): NodeListOf<Element> {
  // Try primary selector (old ChatGPT format with data-testid)
  let turns = document.querySelectorAll(SELECTORS.MESSAGE_TURN);
  if (turns.length > 0) return turns;

  // Try new ChatGPT format (.text-message wrapper)
  turns = document.querySelectorAll(SELECTORS.MESSAGE_TURN_NEW);
  if (turns.length > 0) return turns;

  // Fall back to broad structural matches
  return document.querySelectorAll("article, .group.w-full");
}
