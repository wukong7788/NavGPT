export type PendingGrokPrompt = {
  prompt: string;
  createdAt: number;
  /** Optional target page URL we opened (project or home). */
  targetUrl?: string;
};

export const PENDING_GROK_KEY = "pending_grok_prompt";
const TTL_MS = 2 * 60 * 1000;

export async function setPendingGrokPrompt(prompt: string, targetUrl?: string): Promise<void> {
  const payload: PendingGrokPrompt = {
    prompt,
    createdAt: Date.now(),
    targetUrl,
  };
  await chrome.storage.local.set({ [PENDING_GROK_KEY]: payload });
}

export async function peekPendingGrokPrompt(): Promise<PendingGrokPrompt | null> {
  const result = await chrome.storage.local.get([PENDING_GROK_KEY]);
  const pending = result[PENDING_GROK_KEY] as PendingGrokPrompt | undefined;
  if (!pending?.prompt) return null;
  if (Date.now() - pending.createdAt > TTL_MS) {
    await chrome.storage.local.remove(PENDING_GROK_KEY);
    return null;
  }
  return pending;
}

export async function clearPendingGrokPrompt(): Promise<void> {
  await chrome.storage.local.remove(PENDING_GROK_KEY);
}
