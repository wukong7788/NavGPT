export type PendingChatgptPrompt = {
  prompt: string;
  createdAt: number;
  /** Optional target page URL we opened. */
  targetUrl?: string;
};

export const PENDING_CHATGPT_KEY = "pending_chatgpt_prompt";
const TTL_MS = 2 * 60 * 1000;

export async function setPendingChatgptPrompt(prompt: string, targetUrl?: string): Promise<void> {
  const payload: PendingChatgptPrompt = {
    prompt,
    createdAt: Date.now(),
    targetUrl,
  };
  await chrome.storage.local.set({ [PENDING_CHATGPT_KEY]: payload });
}

export async function peekPendingChatgptPrompt(): Promise<PendingChatgptPrompt | null> {
  const result = await chrome.storage.local.get([PENDING_CHATGPT_KEY]);
  const pending = result[PENDING_CHATGPT_KEY] as PendingChatgptPrompt | undefined;
  if (!pending?.prompt) return null;
  if (Date.now() - pending.createdAt > TTL_MS) {
    await chrome.storage.local.remove(PENDING_CHATGPT_KEY);
    return null;
  }
  return pending;
}

export async function clearPendingChatgptPrompt(): Promise<void> {
  await chrome.storage.local.remove(PENDING_CHATGPT_KEY);
}
