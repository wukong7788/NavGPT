/** Extract the primary post text + url on an X status page. */

export function isStatusPage(pathname = location.pathname): boolean {
  return /\/status\/\d+/.test(pathname);
}

export function getStatusUrl(): string {
  const match = location.pathname.match(/^(\/[^/]+\/status\/\d+)/);
  if (match) return `https://x.com${match[1]}`;
  return location.href.split("?")[0];
}

export function getPrimaryTweetArticle(): HTMLElement | null {
  const articles = Array.from(document.querySelectorAll("article"));
  if (articles.length === 0) return null;

  // Prefer the article whose permalink matches the current status id.
  const statusId = location.pathname.match(/\/status\/(\d+)/)?.[1];
  if (statusId) {
    const matched = articles.find((article) =>
      !!article.querySelector(`a[href*="/status/${statusId}"]`)
    );
    if (matched) return matched as HTMLElement;
  }

  return articles[0] as HTMLElement;
}

export function extractTweetText(article: HTMLElement | null = getPrimaryTweetArticle()): string {
  if (!article) return "";

  const textEl =
    article.querySelector('[data-testid="tweetText"]') ||
    article.querySelector('[lang]') ||
    null;

  const raw = (textEl as HTMLElement | null)?.innerText || article.innerText || "";
  return raw
    .replace(/\s*\n\s*/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}
