const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

const SELECTORS = {
  MESSAGE_UNIT: "[data-content-search-unit-key]",
  MESSAGE_TURN: "[data-testid^='conversation-turn-']",
  USER_BUBBLE: "[data-user-message-bubble]",
  ASSISTANT_MARKDOWN: "[data-markdown-text-style]",
  USER_TEXT: ".whitespace-pre-wrap",
  CONTENT:
    "[data-markdown-text-style], .whitespace-pre-wrap, .markdown, .prose, .flex-col.gap-1",
  ROLE_ATTR: "data-message-author-role",
  UNIT_KEY_ATTR: "data-content-search-unit-key",
  CODE_BLOCK: "pre, code, .cm-editor",
  SEARCH_MESSAGE_IDS: "data-chatgpt-search-message-ids",
  DIL_MESSAGE_ID: "data-dil-message-id",
  TURN_KEY: "data-turn-key",
};

function parseRoleFromUnitKey(unitKey) {
  if (!unitKey) return "unknown";
  if (unitKey.endsWith(":user")) return "user";
  if (unitKey.endsWith(":assistant")) return "assistant";
  return "unknown";
}

function getPreview(text) {
  const maxChars = 80;
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxChars) return cleaned;
  return cleaned.substring(0, maxChars) + "...";
}

function queryTurns(document) {
  const units = document.querySelectorAll(SELECTORS.MESSAGE_UNIT);
  if (units.length > 0) return units;
  return document.querySelectorAll(SELECTORS.MESSAGE_TURN);
}

function extractMessages(document) {
  const turns = queryTurns(document);
  const records = [];

  turns.forEach((turn, index) => {
    let role = parseRoleFromUnitKey(turn.getAttribute(SELECTORS.UNIT_KEY_ATTR));
    if (role === "unknown") {
      const roleAttr =
        turn.getAttribute(SELECTORS.ROLE_ATTR) ||
        turn.querySelector(`[${SELECTORS.ROLE_ATTR}]`)?.getAttribute(SELECTORS.ROLE_ATTR);
      role =
        roleAttr === "user" ? "user" : roleAttr === "assistant" ? "assistant" : "unknown";
    }

    const contentEl =
      role === "user"
        ? turn.querySelector(SELECTORS.USER_TEXT) || turn.querySelector(SELECTORS.USER_BUBBLE)
        : turn.querySelector(SELECTORS.ASSISTANT_MARKDOWN) || turn.querySelector(SELECTORS.CONTENT);

    let fullText = contentEl?.textContent?.trim() || "";
    fullText = fullText.replace(/^(你说：|ChatGPT 说：|You said:|ChatGPT said:)\s*/i, "").trim();

    if (!fullText && role === "unknown") return;

    const hasCode = !!turn.querySelector(SELECTORS.CODE_BLOCK);
    const domMessageId =
      turn.getAttribute(SELECTORS.SEARCH_MESSAGE_IDS)?.split(/\s+/)[0] ||
      turn.getAttribute(SELECTORS.DIL_MESSAGE_ID) ||
      turn.closest(`[${SELECTORS.TURN_KEY}]`)?.getAttribute(SELECTORS.TURN_KEY) ||
      "";

    records.push({
      id: `msg-${index}`,
      index: index + 1,
      role,
      preview: getPreview(fullText),
      fullText,
      hasCode,
      domMessageId,
    });
  });

  return records;
}

const html = fs.readFileSync(path.join(__dirname, "mock-chatgpt.html"), "utf8");
const dom = new JSDOM(html);
const messages = extractMessages(dom.window.document);

console.log(JSON.stringify(messages, null, 2));

if (messages.length === 3) {
  console.log("✅ Success: Extracted 3 messages.");
} else {
  console.error(`❌ Failure: Extracted ${messages.length} messages, expected 3.`);
  process.exit(1);
}

if (messages[0].role === "user" && messages[1].role === "assistant" && messages[2].role === "user") {
  console.log("✅ Success: Roles parsed from unit keys.");
} else {
  console.error("❌ Failure: Unexpected roles.", messages.map((m) => m.role));
  process.exit(1);
}

if (messages[1].hasCode === true) {
  console.log("✅ Success: Code block detected.");
} else {
  console.error("❌ Failure: Code block not detected.");
  process.exit(1);
}

if (messages[2].preview.endsWith("...")) {
  console.log("✅ Success: Preview truncated.");
} else {
  console.error("❌ Failure: Preview not truncated.");
  process.exit(1);
}
