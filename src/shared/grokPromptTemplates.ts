export type GrokPromptTemplate = {
  id: string;
  /** Short label on the quick-action button */
  label: string;
  /** Instruction text above the pasted post body */
  instruction: string;
  /** Built-in defaults (still editable); custom ones can be deleted */
  builtin?: boolean;
  order: number;
};

const STORAGE_KEY = "grok_prompt_templates";
const SEED_VERSION_KEY = "grok_prompt_templates_seed_version";
const LAST_TEMPLATE_KEY = "grok_last_prompt_template_id";
/** Bump when shipping new builtin templates so they are appended once. */
const SEED_VERSION = 1;

export const POST_CONTENT_MARKER = "帖子内容：";

const BUILTIN_TEMPLATES: GrokPromptTemplate[] = [
  {
    id: "factCheck",
    label: "事实核查",
    instruction: [
      "请核查以下 X 帖子中的事实与数据是否准确。",
      "请分别标出：已核实 / 存疑 / 无法核实，并简要说明依据。",
    ].join("\n"),
    builtin: true,
    order: 0,
  },
  {
    id: "oneLineSummary",
    label: "一句话摘要",
    instruction: [
      "请用中文写一句话摘要（不超过 50 字），说明这条 X 帖子的核心主张。",
      "然后另起三行，各用一句补充：关键点 / 可信度（高/中/低）/ 需注意的风险或不确定处。",
    ].join("\n"),
    builtin: true,
    order: 1,
  },
];

function cloneBuiltins(): GrokPromptTemplate[] {
  return BUILTIN_TEMPLATES.map((t) => ({ ...t }));
}

function sortTemplates(list: GrokPromptTemplate[]): GrokPromptTemplate[] {
  return [...list].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, "zh-Hans"));
}

function normalizeTemplate(raw: unknown, index: number): GrokPromptTemplate | null {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as Partial<GrokPromptTemplate>;
  const id = typeof t.id === "string" && t.id.trim() ? t.id.trim() : "";
  const label = typeof t.label === "string" ? t.label.trim() : "";
  const instruction = typeof t.instruction === "string" ? t.instruction.trim() : "";
  if (!id || !label || !instruction) return null;
  return {
    id,
    label,
    instruction,
    builtin: !!t.builtin,
    order: typeof t.order === "number" ? t.order : index,
  };
}

/**
 * Load templates. Empty storage → seed builtins.
 * After that, storage is authoritative (deleted buttons stay deleted).
 * Bumping SEED_VERSION appends any new builtin ids once.
 */
export async function loadGrokPromptTemplates(): Promise<GrokPromptTemplate[]> {
  const result = await chrome.storage.local.get([STORAGE_KEY, SEED_VERSION_KEY]);
  const stored = result[STORAGE_KEY];
  const seedVersion =
    typeof result[SEED_VERSION_KEY] === "number" ? result[SEED_VERSION_KEY] : 0;

  if (!Array.isArray(stored) || stored.length === 0) {
    const seeded = cloneBuiltins();
    await chrome.storage.local.set({
      [STORAGE_KEY]: seeded,
      [SEED_VERSION_KEY]: SEED_VERSION,
    });
    return seeded;
  }

  const list: GrokPromptTemplate[] = [];
  const ids = new Set<string>();
  stored.forEach((raw, index) => {
    const t = normalizeTemplate(raw, index);
    if (!t || ids.has(t.id)) return;
    const builtin = BUILTIN_TEMPLATES.some((b) => b.id === t.id);
    list.push({ ...t, builtin: builtin || t.builtin });
    ids.add(t.id);
  });

  if (seedVersion < SEED_VERSION) {
    for (const b of cloneBuiltins()) {
      if (!ids.has(b.id)) {
        list.push(b);
        ids.add(b.id);
      }
    }
    const sorted = sortTemplates(list);
    await chrome.storage.local.set({
      [STORAGE_KEY]: sorted,
      [SEED_VERSION_KEY]: SEED_VERSION,
    });
    return sorted;
  }

  return sortTemplates(list.length > 0 ? list : cloneBuiltins());
}

export async function saveGrokPromptTemplates(templates: GrokPromptTemplate[]): Promise<void> {
  const cleaned = sortTemplates(
    templates
      .map((t, i) => normalizeTemplate(t, i))
      .filter((t): t is GrokPromptTemplate => !!t)
  ).map((t, i) => ({ ...t, order: i }));
  await chrome.storage.local.set({
    [STORAGE_KEY]: cleaned,
    [SEED_VERSION_KEY]: SEED_VERSION,
  });
}

export async function getLastPromptTemplateId(): Promise<string> {
  const result = await chrome.storage.local.get([LAST_TEMPLATE_KEY]);
  return typeof result[LAST_TEMPLATE_KEY] === "string" ? result[LAST_TEMPLATE_KEY] : "factCheck";
}

export async function setLastPromptTemplateId(id: string): Promise<void> {
  await chrome.storage.local.set({ [LAST_TEMPLATE_KEY]: id });
}

export function buildPromptFromTemplate(
  template: GrokPromptTemplate,
  tweetText: string,
  postUrl: string
): string {
  return [
    template.instruction.trim(),
    "",
    POST_CONTENT_MARKER,
    tweetText || "(未能读取正文)",
    "",
    `帖子链接：${postUrl}`,
  ].join("\n");
}

export function createPromptTemplate(label: string, instruction: string): GrokPromptTemplate | null {
  const trimmedLabel = label.trim();
  const trimmedInstruction = instruction.trim();
  if (!trimmedLabel || !trimmedInstruction) return null;
  return {
    id: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    label: trimmedLabel,
    instruction: trimmedInstruction,
    builtin: false,
    order: 999,
  };
}

export function getBuiltinDefaults(): GrokPromptTemplate[] {
  return cloneBuiltins();
}
