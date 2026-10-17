import { formatProductBlock, type ProductInfo } from "./product";

export type ProductPromptTemplate = {
  id: string;
  /** Short label on the quick-action button */
  label: string;
  /** Instruction text above the product info block */
  instruction: string;
  /** Built-in defaults (still editable); custom ones can be deleted */
  builtin?: boolean;
  order: number;
};

const STORAGE_KEY = "product_prompt_templates";
const SEED_VERSION_KEY = "product_prompt_templates_seed_version";
const LAST_TEMPLATE_KEY = "product_last_prompt_template_id";
/** Bump when shipping new builtin templates so they are appended once. */
const SEED_VERSION = 1;

export const PRODUCT_CONTENT_MARKER = "商品信息：";

const BUILTIN_TEMPLATES: ProductPromptTemplate[] = [
  {
    id: "productReview",
    label: "产品怎么样",
    instruction: [
      "请根据以下商品信息，用中文评价这个产品怎么样。",
      "请覆盖：主要功效 / 适用人群 / 注意事项 / 总体建议（值得买 / 谨慎 / 不建议），并说明依据。",
    ].join("\n"),
    builtin: true,
    order: 0,
  },
  {
    id: "ingredientsSafety",
    label: "成分与副作用",
    instruction: [
      "请根据以下商品信息，分析其主要成分、常见副作用与禁忌人群。",
      "若信息不足请明确指出不确定处，不要编造剂量或医学结论。",
    ].join("\n"),
    builtin: true,
    order: 1,
  },
  {
    id: "worthBuying",
    label: "是否值得买",
    instruction: [
      "请根据以下商品信息，判断是否值得购买。",
      "请分别说明：性价比、替代选择、适合 / 不适合谁，并给出明确结论（买 / 观望 / 不买）。",
    ].join("\n"),
    builtin: true,
    order: 2,
  },
];

function cloneBuiltins(): ProductPromptTemplate[] {
  return BUILTIN_TEMPLATES.map((t) => ({ ...t }));
}

function sortTemplates(list: ProductPromptTemplate[]): ProductPromptTemplate[] {
  return [...list].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, "zh-Hans"));
}

function normalizeTemplate(raw: unknown, index: number): ProductPromptTemplate | null {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as Partial<ProductPromptTemplate>;
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
export async function loadProductPromptTemplates(): Promise<ProductPromptTemplate[]> {
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

  const list: ProductPromptTemplate[] = [];
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

export async function saveProductPromptTemplates(
  templates: ProductPromptTemplate[]
): Promise<void> {
  const cleaned = sortTemplates(
    templates
      .map((t, i) => normalizeTemplate(t, i))
      .filter((t): t is ProductPromptTemplate => !!t)
  ).map((t, i) => ({ ...t, order: i }));
  await chrome.storage.local.set({
    [STORAGE_KEY]: cleaned,
    [SEED_VERSION_KEY]: SEED_VERSION,
  });
}

export async function getLastProductTemplateId(): Promise<string> {
  const result = await chrome.storage.local.get([LAST_TEMPLATE_KEY]);
  return typeof result[LAST_TEMPLATE_KEY] === "string"
    ? result[LAST_TEMPLATE_KEY]
    : "productReview";
}

export async function setLastProductTemplateId(id: string): Promise<void> {
  await chrome.storage.local.set({ [LAST_TEMPLATE_KEY]: id });
}

export function buildProductPromptFromTemplate(
  template: ProductPromptTemplate,
  product: ProductInfo
): string {
  return [
    template.instruction.trim(),
    "",
    PRODUCT_CONTENT_MARKER,
    formatProductBlock(product),
  ].join("\n");
}

export function createProductPromptTemplate(
  label: string,
  instruction: string
): ProductPromptTemplate | null {
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
