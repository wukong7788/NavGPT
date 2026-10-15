import { extractTweetText, getPrimaryTweetArticle, getStatusUrl } from "./extractTweet";
import { openPromptEditor } from "./promptEditor";

const BTN_ATTR = "data-navgpt-grok-btn";
const STYLE_ID = "navgpt-x-grok-style";

/**
 * Official X Grok control (Chinese UI example):
 * <div class="... r-18u37iz r-1h0z5md">
 *   <button aria-label="Grok 操作" type="button">...</button>
 * </div>
 */
const OFFICIAL_GROK_SELECTORS = [
  'button[aria-label="Grok 操作"]',
  'button[aria-label="Grok actions"]',
  'button[aria-label*="Grok 操作"]',
  'button[aria-label*="Grok actions" i]',
  'button[aria-label*="Grok" i]',
  'div[role="button"][aria-label*="Grok" i]',
  'button[data-testid*="grok" i]',
];

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    [${BTN_ATTR}] {
      display: inline-flex !important;
      align-items: center;
      justify-content: center;
      gap: 4px;
      margin-left: 4px;
      padding: 0 10px;
      height: 32px;
      min-width: 32px;
      border: none;
      border-radius: 999px;
      background: #10a37f;
      color: #fff !important;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.01em;
      cursor: pointer;
      line-height: 1;
      vertical-align: middle;
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    }
    [${BTN_ATTR}]:hover {
      filter: brightness(1.08);
    }
    [${BTN_ATTR}]:active {
      filter: brightness(0.96);
    }
  `;
  document.documentElement.appendChild(style);
}

function findOfficialGrokButton(scope: ParentNode): HTMLElement | null {
  for (const sel of OFFICIAL_GROK_SELECTORS) {
    const hit = scope.querySelector(sel);
    if (hit instanceof HTMLElement && !hit.hasAttribute(BTN_ATTR)) return hit;
  }

  const candidates = scope.querySelectorAll("button, div[role='button'], a");
  for (const el of Array.from(candidates)) {
    if (!(el instanceof HTMLElement) || el.hasAttribute(BTN_ATTR)) continue;
    const label = `${el.getAttribute("aria-label") || ""} ${el.textContent || ""}`.toLowerCase();
    if (label.includes("grok")) return el;
  }
  return null;
}

/** Outer wrapper that sits as a sibling among other action icons. */
function getOfficialGrokWrapper(officialBtn: HTMLElement): HTMLElement {
  const parent = officialBtn.parentElement;
  if (parent && parent !== document.body && parent.querySelector("button, [role='button']") === officialBtn) {
    return parent;
  }
  return officialBtn;
}

function findActionBar(article: HTMLElement): HTMLElement | null {
  const official = findOfficialGrokButton(article);
  if (official) {
    const bar = official.closest('[role="group"]');
    if (bar instanceof HTMLElement) return bar;
  }

  const groups = Array.from(article.querySelectorAll('[role="group"]')) as HTMLElement[];
  const scored = groups
    .map((group) => {
      const labels = Array.from(group.querySelectorAll("button, a, div[role='button']"))
        .map((el) => (el.getAttribute("aria-label") || el.getAttribute("data-testid") || "").toLowerCase())
        .join(" ");
      let score = 0;
      if (/reply|回复|retweet|转帖|like|喜欢|bookmark|书签|share|分享/.test(labels)) score += 2;
      if (/grok/.test(labels)) score += 3;
      return { group, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.group || null;
}

function createButton(): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.setAttribute(BTN_ATTR, "1");
  btn.title = "编辑文案后发送给 Grok";
  btn.setAttribute("aria-label", "编辑文案后发送给 Grok");
  btn.textContent = "Grok";

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    const article = getPrimaryTweetArticle();
    const text = extractTweetText(article);
    const url = getStatusUrl();
    void openPromptEditor({ tweetText: text, postUrl: url });
  });

  return btn;
}

function insertBesideOfficial(official: HTMLElement, btn: HTMLButtonElement): boolean {
  const wrapper = getOfficialGrokWrapper(official);
  if (!wrapper.parentElement) {
    official.insertAdjacentElement("afterend", btn);
    return true;
  }
  // Place immediately to the right of the official Grok wrapper.
  wrapper.insertAdjacentElement("afterend", btn);
  return true;
}

export function syncGrokButton(): void {
  ensureStyles();

  document.querySelectorAll(`[${BTN_ATTR}]`).forEach((el) => {
    const article = el.closest("article");
    const primary = getPrimaryTweetArticle();
    if (!primary || article !== primary) el.remove();
  });

  const article = getPrimaryTweetArticle();
  if (!article) return;
  if (article.querySelector(`[${BTN_ATTR}]`)) return;

  const btn = createButton();
  const official = findOfficialGrokButton(article);
  if (official && insertBesideOfficial(official, btn)) return;

  const bar = findActionBar(article);
  if (bar) {
    bar.appendChild(btn);
    return;
  }

  article.appendChild(btn);
}
