import {
  buildChatgptDestinationUrl,
  type ChatgptProject,
} from "./chatgptProjects";
import { setPendingChatgptPrompt } from "./pendingChatgpt";

/**
 * Save prompt locally, then open ChatGPT (project page or home).
 * chatgpt.com content script will fill/send the pending prompt.
 */
export async function openChatgptWithPrompt(
  prompt: string,
  project?: ChatgptProject | null
): Promise<void> {
  const text = prompt.trim();
  if (!text) return;

  const destination = buildChatgptDestinationUrl(project);
  await setPendingChatgptPrompt(text, destination);

  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // ignore — clipboard may be blocked
  }

  window.open(destination, "_blank", "noopener,noreferrer");
}
