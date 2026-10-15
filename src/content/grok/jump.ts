import { ChatMessageRecord } from "../../shared/types";
import { findGrokMessageElement } from "./extract";

function getScrollableParent(el: Element): Element | null {
  let parent = el.parentElement;
  while (parent) {
    const style = getComputedStyle(parent);
    const overflowY = style.overflowY;
    if ((overflowY === "auto" || overflowY === "scroll") && parent.scrollHeight > parent.clientHeight) {
      return parent;
    }
    parent = parent.parentElement;
  }
  return null;
}

export function jumpToGrokMessage(
  _messageId: string,
  _domMessageId?: string,
  opts?: {
    domUnitKey?: string;
    role?: ChatMessageRecord["role"];
    listIndex?: number;
  }
) {
  const target = findGrokMessageElement(opts?.listIndex, opts?.domUnitKey);
  if (!target) {
    console.warn("NavGPT Grok: jump target not found", opts);
    return;
  }

  const scrollContainer = getScrollableParent(target);
  const offset = 80;

  if (scrollContainer) {
    const targetRect = target.getBoundingClientRect();
    const containerRect = scrollContainer.getBoundingClientRect();
    const scrollTarget = scrollContainer.scrollTop + targetRect.top - containerRect.top - offset;
    scrollContainer.scrollTo({ top: scrollTarget, behavior: "smooth" });
  } else {
    const y = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: y, behavior: "smooth" });
  }

  const html = target as HTMLElement;
  html.classList.add("navgpt-highlight");
  setTimeout(() => html.classList.remove("navgpt-highlight"), 2000);
}
