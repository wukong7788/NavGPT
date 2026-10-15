import { buildGrokDestinationUrl, type GrokProject } from "./grokProjects";
import {
  buildPromptFromTemplate,
  loadGrokPromptTemplates,
  type GrokPromptTemplate,
} from "./grokPromptTemplates";
import { setPendingGrokPrompt } from "./pendingGrok";

/** @deprecated Prefer loadGrokPromptTemplates + buildPromptFromTemplate */
export const GROK_PROMPTS = {
  factCheck: {
    id: "factCheck",
    label: "Grok",
    title: "编辑文案后发送给 Grok",
    build: async (tweetText: string, postUrl: string) => {
      const templates = await loadGrokPromptTemplates();
      const t = templates.find((x) => x.id === "factCheck") || templates[0];
      return t ? buildPromptFromTemplate(t, tweetText, postUrl) : "";
    },
  },
} as const;

export type { GrokPromptTemplate };

/**
 * Save prompt locally, then open Grok (project page or home).
 * grok.com content script will fill/send the pending prompt.
 */
export async function openGrokWithPrompt(
  prompt: string,
  project?: GrokProject | null
): Promise<void> {
  const text = prompt.trim();
  if (!text) return;

  const destination = buildGrokDestinationUrl(project);
  await setPendingGrokPrompt(text, destination);

  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // ignore — clipboard may be blocked
  }

  window.open(destination, "_blank", "noopener,noreferrer");
}
