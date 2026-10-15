import { ChatMessageRecord } from "../../shared/types";

const MSG_ATTR = "data-navgpt-grok-msg";

function conversationMeta() {
  const url = window.location.href;
  const projectMatch = url.match(/\/project\/([a-f0-9-]{36})/i);
  const chatMatch = url.match(/\/c\/([a-zA-Z0-9-]+)/);
  const conversationId = projectMatch?.[1] || chatMatch?.[1] || "grok-default";

  let conversationTitle = "Grok";
  const h1 = document.querySelector("h1");
  if (h1?.textContent?.trim()) {
    conversationTitle = h1.textContent.trim();
  } else if (document.title && document.title !== "Grok") {
    conversationTitle = document.title.replace(/\s*[-–|]\s*Grok\s*$/i, "").trim();
  }

  return { url, conversationId, conversationTitle };
}

function looksLikeComposer(el: Element): boolean {
  if (el.closest("form")) return true;
  if (el.closest('[contenteditable="true"]') && el.closest("form, [class*='composer'], [class*='input']")) {
    return true;
  }
  const label = `${el.getAttribute("aria-label") || ""} ${el.getAttribute("data-placeholder") || ""}`;
  return /ask grok|type a message|输入|询问/i.test(label);
}

function detectRole(el: Element, index: number): ChatMessageRecord["role"] {
  const attr =
    el.getAttribute("data-message-author-role") ||
    el.getAttribute("data-role") ||
    el.querySelector("[data-message-author-role], [data-role]")?.getAttribute("data-message-author-role") ||
    el.querySelector("[data-role]")?.getAttribute("data-role");

  if (attr === "user" || attr === "assistant" || attr === "human" || attr === "bot") {
    if (attr === "human") return "user";
    if (attr === "bot") return "assistant";
    return attr;
  }

  const cls = String((el as HTMLElement).className || "").toLowerCase();
  const text = (el.textContent || "").slice(0, 40).toLowerCase();
  if (/user|human|you/.test(cls) || /^you\b/.test(text)) return "user";
  if (/assistant|model|grok|bot|ai/.test(cls)) return "assistant";

  // Fallback: odd indices often assistant in chat UIs that alternate starting with user
  return index % 2 === 0 ? "user" : "assistant";
}

function queryMessageNodes(): Element[] {
  const explicit = Array.from(
    document.querySelectorAll(
      [
        "[data-message-author-role]",
        "[data-testid*='message']",
        "[data-testid*='conversation-turn']",
        `[${MSG_ATTR}]`,
      ].join(",")
    )
  ).filter((el) => !looksLikeComposer(el));

  if (explicit.length > 0) {
    return explicit.filter((el) => {
      const t = (el.textContent || "").trim();
      return t.length > 0;
    });
  }

  // Heuristic: sizable markdown/prose blocks in the main column (exclude composer).
  const root =
    document.querySelector("main") ||
    document.querySelector("#grok-content-area") ||
    document.body;

  const blocks = Array.from(
    root.querySelectorAll(".markdown, .prose, [class*='markdown'], [class*='Message'], [class*='message']")
  ).filter((el) => {
    if (looksLikeComposer(el)) return false;
    const rect = el.getBoundingClientRect();
    if (rect.height < 24 || rect.width < 80) return false;
    const text = (el.textContent || "").trim();
    return text.length >= 2 && text.length < 20000;
  });

  // Dedupe nested matches — keep outermost-ish by preferring fewer ancestors in set
  return blocks.filter((el) => !blocks.some((other) => other !== el && other.contains(el)));
}

/** Strip Grok UI chrome (thinking/work timers) from message text. */
export function stripGrokUiChrome(text: string): string {
  return text
    .replace(/^\s*工作了\s*\d+\s*(?:秒|s|sec|seconds?)?\s*/iu, "")
    .replace(/^\s*(?:已思考|思考了|Thought for|Thinking for|Worked for)\s*\d+\s*(?:秒|s|sec|seconds?|m|min|minutes?)?\s*/iu, "")
    .replace(/\b工作了\s*\d+\s*(?:秒|s|sec|seconds?)?\b/giu, " ")
    .replace(/\b(?:Thought for|Thinking for|Worked for)\s*\d+\s*(?:s|sec|seconds?|m|min|minutes?)?\b/gi, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function messageBodyText(node: Element): string {
  // Prefer markdown/prose body so thinking-status controls outside aren't included.
  const body =
    node.querySelector(".markdown, .prose, [class*='markdown'], [class*='prose']") ||
    node.querySelector("[data-testid*='markdown'], [data-testid*='message-content']") ||
    node;

  const clone = body.cloneNode(true) as Element;
  clone
    .querySelectorAll("button, [role='button'], nav, svg, script, style")
    .forEach((el) => el.remove());

  // Drop short status rows like「工作了 33s」
  clone.querySelectorAll("div, span, p").forEach((el) => {
    const t = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (/^(工作了|已思考|思考了|Thought for|Thinking for|Worked for)\s*\d+/iu.test(t) && t.length < 40) {
      el.remove();
    }
  });

  return stripGrokUiChrome((clone.textContent || "").replace(/\s+\n/g, "\n"));
}

function getPreview(text: string): string {
  const cleaned = stripGrokUiChrome(text).replace(/\s+/g, " ").trim();
  if (cleaned.length <= 80) return cleaned;
  return cleaned.slice(0, 80) + "...";
}

export function extractGrokMessages(): ChatMessageRecord[] {
  const { url, conversationId, conversationTitle } = conversationMeta();
  const nodes = queryMessageNodes();
  const records: ChatMessageRecord[] = [];

  nodes.forEach((node, index) => {
    const role = detectRole(node, index);
    const fullText = messageBodyText(node);
    if (!fullText) return;

    const domId = node.getAttribute("data-message-id") || `grok-${index}`;
    node.setAttribute(MSG_ATTR, String(index));

    records.push({
      id: `msg-${conversationId}-${domId}`,
      index: index + 1,
      listIndex: index,
      role,
      preview: getPreview(fullText),
      fullText,
      hasCode: !!node.querySelector("pre, code"),
      url,
      conversationId,
      conversationTitle,
      domMessageId: domId,
      domUnitKey: `${MSG_ATTR}:${index}`,
    });
  });

  return records;
}

export function extractionGrokLooksReady(messages: ChatMessageRecord[]): boolean {
  return messages.length > 0;
}

export function hasGrokMessages(): boolean {
  return queryMessageNodes().length > 0;
}

export function findGrokMessageElement(listIndex?: number, domUnitKey?: string): Element | null {
  if (domUnitKey?.startsWith(`${MSG_ATTR}:`)) {
    const idx = domUnitKey.split(":")[1];
    const el = document.querySelector(`[${MSG_ATTR}="${idx}"]`);
    if (el) return el;
  }
  if (typeof listIndex === "number") {
    const nodes = queryMessageNodes();
    return nodes[listIndex] || null;
  }
  return null;
}
