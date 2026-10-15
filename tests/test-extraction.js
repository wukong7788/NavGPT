const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

// Mocking the extraction logic (since we can't easily import TS in a simple node script without setup)
// I'll copy the logic from extract.ts for this verification step.

const SELECTORS = {
  MESSAGE_TURN: "[data-testid^='conversation-turn-']",
  CONTENT: ".markdown, .prose, .flex-col.gap-1",
  ROLE_ATTR: "data-message-author-role",
  CODE_BLOCK: "pre, code",
};

const FALLBACKS = {
  MESSAGE_TURN: "article, .group.w-full",
};

function getPreview(text) {
  const maxChars = 80;
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxChars) return cleaned;
  return cleaned.substring(0, maxChars) + "...";
}

function extractMessages(document) {
  const turns = document.querySelectorAll(SELECTORS.MESSAGE_TURN);
  const records = [];

  turns.forEach((turn, index) => {
    const roleAttr = turn.getAttribute(SELECTORS.ROLE_ATTR) || 
                     turn.querySelector(`[${SELECTORS.ROLE_ATTR}]`)?.getAttribute(SELECTORS.ROLE_ATTR);
    
    const role = 
      roleAttr === "user" ? "user" : 
      roleAttr === "assistant" ? "assistant" : 
      "unknown";

    const contentEl = turn.querySelector(SELECTORS.CONTENT);
    const fullText = contentEl?.textContent?.trim() || "";
    
    if (!fullText && role === "unknown") return;

    const hasCode = !!turn.querySelector(SELECTORS.CODE_BLOCK);
    
    records.push({
      id: `msg-${index}`,
      index: index + 1,
      role,
      preview: getPreview(fullText),
      fullText,
      hasCode,
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
