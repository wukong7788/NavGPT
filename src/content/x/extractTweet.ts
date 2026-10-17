/** Extract post text + url on X status / Grok history pages. */

export function isStatusPage(pathname = location.pathname): boolean {
  return /\/status\/\d+/.test(pathname);
}

export function isHistoryPage(pathname = location.pathname): boolean {
  return pathname === "/i/history" || pathname.startsWith("/i/history/");
}

/** Pages where the green Grok action button should appear. */
export function isGrokActionPage(pathname = location.pathname): boolean {
  return isStatusPage(pathname) || isHistoryPage(pathname);
}

export function getStatusUrl(): string {
  const match = location.pathname.match(/^(\/[^/]+\/status\/\d+)/);
  if (match) return `https://x.com${match[1]}`;
  return location.href.split("?")[0];
}

export function getStatusUrlFromElement(root: Element | null): string {
  if (!root) return "";

  // Prefer the time/permalink anchor (not /analytics, /quotes, etc.)
  const timeLink = root.querySelector('a[href*="/status/"] time')?.closest("a");
  if (timeLink) {
    const href = timeLink.getAttribute("href") || "";
    const match = href.match(/\/([^/?#]+)\/status\/(\d+)(?:\?|$)/);
    if (match) return `https://x.com/${match[1]}/status/${match[2]}`;
  }

  const anchors = Array.from(root.querySelectorAll('a[href*="/status/"]'));
  for (const a of anchors) {
    const href = a.getAttribute("href") || "";
    const match = href.match(/\/([^/?#]+)\/status\/(\d+)(?:\/)?(?:\?|$)/);
    if (!match) continue;
    if (/\/(analytics|quotes|retweets|likes)\b/i.test(href)) continue;
    return `https://x.com/${match[1]}/status/${match[2]}`;
  }
  return "";
}

export function getPrimaryTweetArticle(): HTMLElement | null {
  const articles = Array.from(document.querySelectorAll("article"));
  if (articles.length === 0) return null;

  const statusId = location.pathname.match(/\/status\/(\d+)/)?.[1];
  if (statusId) {
    const matched = articles.find((article) =>
      !!article.querySelector(`a[href*="/status/${statusId}"]`)
    );
    if (matched) return matched as HTMLElement;
  }

  return articles[0] as HTMLElement;
}

/** Targets that should get a green Grok button on the current page. */
export function getGrokButtonTargets(): HTMLElement[] {
  if (isStatusPage()) {
    const primary = getPrimaryTweetArticle();
    return primary ? [primary] : [];
  }

  if (isHistoryPage()) {
    const articles = Array.from(document.querySelectorAll("article")) as HTMLElement[];
    if (articles.length > 0) {
      return articles.filter((el) => !articles.some((other) => other !== el && other.contains(el)));
    }

    const candidates = Array.from(
      document.querySelectorAll(
        '[data-testid="cellInnerDiv"], [data-testid="conversation"], [role="listitem"], main [role="link"]'
      )
    ) as HTMLElement[];

    const withPostOrGrok = candidates.filter((el) => {
      if (el.querySelector('a[href*="/status/"]')) return true;
      if (el.querySelector('button[aria-label*="Grok" i], [aria-label*="Grok 操作"]')) return true;
      return false;
    });

    const pool =
      withPostOrGrok.length > 0
        ? withPostOrGrok
        : candidates.filter((el) => {
            const text = (el.textContent || "").replace(/\s+/g, " ").trim();
            const rect = el.getBoundingClientRect();
            return text.length >= 4 && text.length < 300 && rect.height >= 36 && rect.height < 220;
          });

    return pool.filter((el) => !pool.some((other) => other !== el && other.contains(el)));
  }

  return [];
}

const SHOW_MORE_SELECTORS = [
  '[data-testid="tweet-text-show-more-link"]',
  '[data-testid="tweet-text-show-more-button"]',
  'button[data-testid="tweet-text-show-more-link"]',
  'div[data-testid="tweet-text-show-more-link"]',
];

const SHOW_MORE_LABEL =
  /^(显示更多|顯示更多|看更多|Show more|Show More|もっと見る|더 보기|Mostrar más|Afficher plus|Mehr anzeigen)$/i;

function findShowMoreControls(root: HTMLElement): HTMLElement[] {
  const found = new Set<HTMLElement>();

  for (const sel of SHOW_MORE_SELECTORS) {
    root.querySelectorAll(sel).forEach((el) => {
      if (el instanceof HTMLElement) found.add(el);
    });
  }

  root.querySelectorAll("button, a, span, div[role='button'], div[role='link']").forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    const label = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (SHOW_MORE_LABEL.test(label)) found.add(el);
  });

  return Array.from(found);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Click「显示更多」so long posts expand before we read text. */
export async function expandTweetText(root: HTMLElement): Promise<boolean> {
  const controls = findShowMoreControls(root);
  if (controls.length === 0) return false;

  let clicked = false;
  for (const el of controls) {
    try {
      el.click();
      clicked = true;
    } catch {
      // ignore
    }
  }

  if (!clicked) return false;

  // Wait for X to swap in the full note-tweet body.
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await sleep(80);

  // One more pass if a nested control remains
  const again = findShowMoreControls(root);
  for (const el of again) {
    try {
      el.click();
    } catch {
      // ignore
    }
  }
  if (again.length) await sleep(60);

  return true;
}

function normalizeTweetText(raw: string): string {
  return raw
    .replace(/\s*\n\s*/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/(?:^|\n)\s*(?:显示更多|顯示更多|看更多|Show more|Show More|もっと見る|더 보기)\s*$/gim, "")
    .trim();
}

function readTweetTextSync(article: HTMLElement): string {
  // Collect all tweetText blocks (main + quoted). Prefer longest after expansion.
  const blocks = Array.from(article.querySelectorAll('[data-testid="tweetText"]')) as HTMLElement[];
  if (blocks.length > 0) {
    const texts = blocks.map((el) => normalizeTweetText(el.innerText || el.textContent || ""));
    texts.sort((a, b) => b.length - a.length);
    if (texts[0]) return texts[0];
  }

  const langEl = article.querySelector("[lang]") as HTMLElement | null;
  if (langEl) {
    const t = normalizeTweetText(langEl.innerText || "");
    if (t) return t;
  }

  return normalizeTweetText(article.innerText || "");
}

/** Sync helper (may be truncated if「显示更多」not expanded). */
export function extractTweetText(article: HTMLElement | null = getPrimaryTweetArticle()): string {
  if (!article) return "";
  return readTweetTextSync(article);
}

/** Expand「显示更多」then return full post text. */
export async function extractTweetTextFull(
  article: HTMLElement | null = getPrimaryTweetArticle()
): Promise<string> {
  if (!article) return "";
  await expandTweetText(article);
  return readTweetTextSync(article);
}
