import { ChatMessageRecord } from "./types";

/** X / Twitter compose limit for a standard post. */
const X_POST_LIMIT = 280;

/**
 * Build an X Web Intent URL with prefilled text (message body only, no ChatGPT URL).
 * No API key / OAuth — opens the user's compose page in a new tab.
 */
export function buildXShareUrl(msg: ChatMessageRecord): string {
  let body = (msg.fullText || msg.preview || "").replace(/\s+/g, " ").trim();
  if (!body) body = msg.role === "assistant" ? "ChatGPT reply" : "ChatGPT message";

  if (body.length > X_POST_LIMIT) {
    body = body.slice(0, X_POST_LIMIT - 1).trimEnd() + "…";
  }

  return `https://x.com/intent/post?text=${encodeURIComponent(body)}`;
}

export function openXShare(msg: ChatMessageRecord): void {
  window.open(buildXShareUrl(msg), "_blank", "noopener,noreferrer");
}
