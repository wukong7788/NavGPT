export type ChatgptProject = {
  id: string;
  name: string;
  /** Full project page URL, e.g. https://chatgpt.com/g/g-p-xxx/project */
  url: string;
  /** Set when discovered by auto-sync from chatgpt.com */
  syncedAt?: number;
  source?: "manual" | "sync";
};

const STORAGE_KEY = "chatgpt_projects";
const LAST_PROJECT_KEY = "chatgpt_last_project_id";
const LAST_SYNC_KEY = "chatgpt_projects_last_sync";

/** Matches /g/g-p-{id-slug}/… project paths. */
const PROJECT_HREF_RE = /\/g\/(g-p-[^/?#]+)/i;
const ORIGIN = "https://chatgpt.com";
const SESSION_API = `${ORIGIN}/api/auth/session`;
const PROJECTS_API = `${ORIGIN}/backend-api/projects`;
const SIDEBAR_API = `${ORIGIN}/backend-api/gizmos/snorlax/sidebar`;
const PAGE_SIZE = 100;
const MAX_PAGES = 30;

export type ScrapedChatgptProject = { id: string; name: string; url: string };

export async function loadChatgptProjects(): Promise<ChatgptProject[]> {
  const result = await chrome.storage.local.get([STORAGE_KEY]);
  const list = result[STORAGE_KEY];
  return Array.isArray(list) ? (list as ChatgptProject[]) : [];
}

export async function saveChatgptProjects(projects: ChatgptProject[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: projects });
}

export async function getLastChatgptProjectId(): Promise<string> {
  const result = await chrome.storage.local.get([LAST_PROJECT_KEY]);
  return typeof result[LAST_PROJECT_KEY] === "string" ? result[LAST_PROJECT_KEY] : "";
}

export async function setLastChatgptProjectId(id: string): Promise<void> {
  await chrome.storage.local.set({ [LAST_PROJECT_KEY]: id });
}

export async function getLastChatgptProjectsSyncAt(): Promise<number> {
  const result = await chrome.storage.local.get([LAST_SYNC_KEY]);
  return typeof result[LAST_SYNC_KEY] === "number" ? result[LAST_SYNC_KEY] : 0;
}

function projectUrl(id: string): string {
  return `https://chatgpt.com/g/${id}/project`;
}

function normalizeNameKey(name: string): string {
  return name.replace(/\s+/g, "").toLowerCase();
}

export function cleanChatgptProjectName(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(/修改于.*$/u, "")
    .replace(/Edited.*$/i, "")
    .replace(/Updated.*$/i, "")
    .trim();
}

/** Extract g-p-… id from a ChatGPT project URL or path. */
export function extractChatgptProjectId(urlOrPath: string): string {
  try {
    const parsed = new URL(urlOrPath, "https://chatgpt.com");
    return parsed.pathname.match(PROJECT_HREF_RE)?.[1] || "";
  } catch {
    return urlOrPath.match(PROJECT_HREF_RE)?.[1] || "";
  }
}

export function createChatgptProject(name: string, url: string): ChatgptProject | null {
  const trimmedName = name.trim();
  const trimmedUrl = url.trim();
  if (!trimmedName || !trimmedUrl) return null;

  let projectId = "";
  let normalized = trimmedUrl;
  try {
    const parsed = new URL(trimmedUrl, "https://chatgpt.com");
    if (!/chatgpt\.com$/i.test(parsed.hostname) && parsed.hostname !== "chat.openai.com") {
      // Still allow if path looks like a project
    }
    projectId = parsed.pathname.match(PROJECT_HREF_RE)?.[1] || "";
    if (projectId) {
      normalized = projectUrl(projectId);
    } else {
      return null;
    }
  } catch {
    return null;
  }

  return {
    id: projectId,
    name: trimmedName,
    url: normalized,
    source: "manual",
  };
}

export function canonicalChatgptProjectId(project: { id: string; url: string }): string | null {
  if (/^g-p-/i.test(project.id)) return project.id;
  return extractChatgptProjectId(project.url) || extractChatgptProjectId(project.id) || null;
}

function existingMatchesScraped(prev: ChatgptProject, item: ScrapedChatgptProject): boolean {
  const canon = canonicalChatgptProjectId(prev)?.toLowerCase();
  const scrapedId = item.id.toLowerCase();
  if (canon && canon === scrapedId) return true;
  if (prev.id.toLowerCase() === scrapedId) return true;
  if (normalizeNameKey(prev.name) === normalizeNameKey(item.name)) return true;
  return false;
}

/** Scrape project links from the current chatgpt.com sidebar / document. */
export function scrapeChatgptProjectsFromDocument(doc: Document = document): ScrapedChatgptProject[] {
  const found = new Map<string, ScrapedChatgptProject>();

  const anchors = Array.from(
    doc.querySelectorAll('a[href*="/g/g-p-"], a[href*="/g/g-p-"]')
  );
  for (const a of anchors) {
    const href = a.getAttribute("href") || "";
    const id = extractChatgptProjectId(href);
    if (!id) continue;

    const name =
      cleanChatgptProjectName(a.getAttribute("title") || "") ||
      cleanChatgptProjectName(a.getAttribute("aria-label") || "") ||
      cleanChatgptProjectName(a.textContent || "") ||
      id;

    upsertProject(found, id, name);
  }

  // Also scan any element with a project href attribute (buttons / next-link wrappers)
  doc.querySelectorAll("[href*='/g/g-p-'], [data-href*='/g/g-p-']").forEach((el) => {
    const href =
      el.getAttribute("href") || el.getAttribute("data-href") || "";
    const id = extractChatgptProjectId(href);
    if (!id) return;
    const name =
      cleanChatgptProjectName(el.getAttribute("aria-label") || "") ||
      cleanChatgptProjectName(el.textContent || "") ||
      id;
    upsertProject(found, id, name);
  });

  return Array.from(found.values());
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isProjectGizmoId(id: string): boolean {
  return /^g-p-/i.test(id.trim());
}

function pickGizmoName(gizmo: Record<string, unknown> | null | undefined): string {
  if (!gizmo) return "";
  const display = gizmo.display;
  const fromDisplay =
    display && typeof display === "object"
      ? (display as { name?: unknown }).name
      : undefined;
  const candidates = [fromDisplay, gizmo.name, gizmo.title, gizmo.short_name];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return cleanChatgptProjectName(c);
  }
  return "";
}

function pickGizmoId(raw: unknown): string {
  if (!raw) return "";
  if (typeof raw === "string") {
    if (isProjectGizmoId(raw)) return raw;
    return extractChatgptProjectId(raw);
  }
  if (typeof raw !== "object") return "";
  const obj = raw as Record<string, unknown>;
  const nested =
    obj.gizmo && typeof obj.gizmo === "object"
      ? (obj.gizmo as Record<string, unknown>)
      : null;
  // Real sidebar shape: item.gizmo.gizmo.id
  const deep =
    nested?.gizmo && typeof nested.gizmo === "object"
      ? (nested.gizmo as Record<string, unknown>)
      : null;
  const candidates = [deep?.id, nested?.id, obj.id, obj.gizmo_id, obj.project_id];
  for (const c of candidates) {
    if (typeof c === "string") {
      if (isProjectGizmoId(c)) return c;
      const extracted = extractChatgptProjectId(c);
      if (extracted) return extracted;
    }
  }
  return "";
}

function pickNameFromProjectRow(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "";
  const obj = raw as Record<string, unknown>;
  const nested =
    obj.gizmo && typeof obj.gizmo === "object"
      ? (obj.gizmo as Record<string, unknown>)
      : null;
  const deep =
    nested?.gizmo && typeof nested.gizmo === "object"
      ? (nested.gizmo as Record<string, unknown>)
      : null;
  return (
    pickGizmoName(deep) ||
    pickGizmoName(nested) ||
    pickGizmoName(obj) ||
    (typeof obj.name === "string" ? cleanChatgptProjectName(obj.name) : "") ||
    (typeof obj.title === "string" ? cleanChatgptProjectName(obj.title) : "")
  );
}

function upsertProject(
  found: Map<string, ScrapedChatgptProject>,
  id: string,
  name: string
) {
  if (!isProjectGizmoId(id)) return;
  const cleaned = (cleanChatgptProjectName(name) || id).slice(0, 60);
  const key = id.toLowerCase();
  const prev = found.get(key);
  if (!prev) {
    found.set(key, { id, name: cleaned, url: projectUrl(id) });
    return;
  }
  const prevIsId = prev.name === prev.id || /^g-p-/i.test(prev.name);
  const nextIsId = cleaned === id || /^g-p-/i.test(cleaned);
  if (prevIsId && !nextIsId) {
    found.set(key, { id, name: cleaned, url: projectUrl(id) });
  }
}

async function getAccessToken(): Promise<string> {
  try {
    const res = await fetch(SESSION_API, {
      credentials: "include",
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return "";
    const json = (await res.json()) as { accessToken?: string };
    return typeof json.accessToken === "string" ? json.accessToken : "";
  } catch {
    return "";
  }
}

function authHeaders(token: string): HeadersInit {
  const headers: Record<string, string> = {
    accept: "application/json",
    "content-type": "application/json",
  };
  if (token) headers.authorization = `Bearer ${token}`;
  return headers;
}

/** Dedicated Projects list (paginated). Best source for g-p-… projects. */
async function fetchFromProjectsApi(token: string): Promise<ScrapedChatgptProject[]> {
  const found = new Map<string, ScrapedChatgptProject>();
  let offset = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(PROJECTS_API);
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("limit", String(PAGE_SIZE));
    url.searchParams.set("order", "most_recent");

    const res = await fetch(url.toString(), {
      credentials: "include",
      cache: "no-store",
      headers: authHeaders(token),
    });
    if (!res.ok) {
      console.warn("NavGPT: ChatGPT /projects API", res.status);
      break;
    }

    const json = (await res.json()) as Record<string, unknown>;
    const items = Array.isArray(json.items)
      ? json.items
      : Array.isArray(json.data)
        ? json.data
        : Array.isArray(json.projects)
          ? json.projects
          : [];

    for (const raw of items) {
      const id = pickGizmoId(raw);
      const name = pickNameFromProjectRow(raw);
      if (id) upsertProject(found, id, name);
    }

    const total = typeof json.total === "number" ? json.total : null;
    if (items.length === 0) break;
    offset += items.length;
    if (items.length < PAGE_SIZE) break;
    if (total != null && offset >= total) break;
    await sleep(120);
  }

  return Array.from(found.values());
}

/** Sidebar gizmos with cursor pagination. Shape: items[].gizmo.gizmo */
async function fetchFromSidebarApi(token: string): Promise<ScrapedChatgptProject[]> {
  const found = new Map<string, ScrapedChatgptProject>();
  let cursor: string | null = null;

  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(SIDEBAR_API);
    url.searchParams.set("conversations_per_gizmo", "0");
    // Do not set owned_only — shared / team projects would otherwise be missing.
    if (cursor) url.searchParams.set("cursor", cursor);

    const res = await fetch(url.toString(), {
      credentials: "include",
      cache: "no-store",
      headers: authHeaders(token),
    });
    if (!res.ok) {
      console.warn("NavGPT: ChatGPT sidebar API", res.status);
      break;
    }

    const json = (await res.json()) as Record<string, unknown>;
    const items = Array.isArray(json.items) ? json.items : [];
    const gizmos = Array.isArray(json.gizmos) ? json.gizmos : [];

    for (const raw of [...items, ...gizmos]) {
      const id = pickGizmoId(raw);
      const name = pickNameFromProjectRow(raw);
      if (id) upsertProject(found, id, name);
    }

    const next =
      typeof json.cursor === "string" && json.cursor.trim() ? json.cursor.trim() : null;
    if (!next || items.length + gizmos.length === 0) break;
    cursor = next;
    await sleep(120);
  }

  return Array.from(found.values());
}

function mergeScrapedLists(
  ...lists: ScrapedChatgptProject[][]
): ScrapedChatgptProject[] {
  const found = new Map<string, ScrapedChatgptProject>();
  for (const list of lists) {
    for (const p of list) {
      upsertProject(found, p.id, p.name);
    }
  }
  return Array.from(found.values());
}

/**
 * Fetch ChatGPT Projects via /backend-api/projects (paginated) + snorlax sidebar
 * (cursor-paginated, correct nested gizmo shape) + auth token.
 */
export async function fetchChatgptProjectsFromApi(): Promise<ScrapedChatgptProject[]> {
  try {
    const token = await getAccessToken();
    const fromProjects = await fetchFromProjectsApi(token);
    const fromSidebar = await fetchFromSidebarApi(token);
    const merged = mergeScrapedLists(fromProjects, fromSidebar);
    console.log(
      `NavGPT ChatGPT: API projects=${fromProjects.length} sidebar=${fromSidebar.length} merged=${merged.length}`
    );
    return merged;
  } catch (err) {
    console.warn("NavGPT: ChatGPT projects API failed", err);
    return [];
  }
}

export async function mergeSyncedChatgptProjects(
  scraped: ScrapedChatgptProject[],
  opts?: { replaceSynced?: boolean }
): Promise<{
  projects: ChatgptProject[];
  added: number;
  updated: number;
  removed: number;
}> {
  const existing = await loadChatgptProjects();
  const lastId = await getLastChatgptProjectId();
  const now = Date.now();

  const syncedByCanon = new Map<string, ChatgptProject>();
  const syncedByName = new Map<string, string>();

  for (const item of scraped) {
    const canon = item.id.toLowerCase();
    syncedByCanon.set(canon, {
      id: item.id,
      name: item.name,
      url: item.url || projectUrl(item.id),
      syncedAt: now,
      source: "sync",
    });
    syncedByName.set(normalizeNameKey(item.name), canon);
  }

  const finalByKey = new Map<string, ChatgptProject>();
  for (const [canon, project] of syncedByCanon) {
    finalByKey.set(canon, project);
  }

  const idRemap = new Map<string, string>();
  let added = 0;
  let updated = 0;
  let removed = 0;

  for (const prev of existing) {
    const canon = canonicalChatgptProjectId(prev)?.toLowerCase();
    const nameMatch = syncedByName.get(normalizeNameKey(prev.name));
    const matchKey =
      (canon && syncedByCanon.has(canon) && canon) ||
      (nameMatch && syncedByCanon.has(nameMatch) ? nameMatch : null);

    if (matchKey) {
      const synced = syncedByCanon.get(matchKey)!;
      idRemap.set(prev.id, synced.id);
      if (prev.id !== synced.id || prev.name !== synced.name || prev.url !== synced.url) {
        updated++;
      }
      continue;
    }

    if (opts?.replaceSynced && prev.source !== "manual") {
      removed++;
      continue;
    }

    const keepKey = canon || prev.id;
    if (finalByKey.has(keepKey)) {
      idRemap.set(prev.id, finalByKey.get(keepKey)!.id);
      removed++;
      continue;
    }

    finalByKey.set(keepKey, {
      ...prev,
      id: keepKey,
      url: canon ? projectUrl(prev.id.startsWith("g-p-") ? prev.id : keepKey) : prev.url,
    });
    if (prev.id !== keepKey) idRemap.set(prev.id, keepKey);
  }

  for (const item of scraped) {
    if (!existing.some((p) => existingMatchesScraped(p, item))) added++;
  }

  for (const prev of existing) {
    const mapped = idRemap.get(prev.id);
    if (mapped && mapped !== prev.id) removed++;
  }

  const projects = Array.from(finalByKey.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "zh-Hans")
  );

  let nextLastId = lastId;
  if (lastId && idRemap.has(lastId)) {
    nextLastId = idRemap.get(lastId) || "";
  } else if (
    lastId &&
    !projects.some((p) => p.id === lastId || p.id.toLowerCase() === lastId.toLowerCase())
  ) {
    nextLastId = "";
  }

  await chrome.storage.local.set({
    [STORAGE_KEY]: projects,
    [LAST_SYNC_KEY]: now,
    ...(nextLastId !== lastId ? { [LAST_PROJECT_KEY]: nextLastId } : {}),
  });

  return { projects, added, updated, removed };
}

/**
 * Sync ChatGPT projects: union of /projects API + sidebar pagination + DOM scrape.
 * Only replaces previously-synced rows when the API returned a non-empty set.
 */
export async function syncChatgptProjectsFromPage(doc: Document = document): Promise<{
  count: number;
  added: number;
  updated: number;
  removed: number;
}> {
  const fromApi = await fetchChatgptProjectsFromApi();
  const fromPage = scrapeChatgptProjectsFromDocument(doc);
  const byId = new Map(fromPage.map((p) => [p.id.toLowerCase(), p]));

  const match =
    typeof location !== "undefined" ? location.pathname.match(PROJECT_HREF_RE) : null;
  if (match) {
    const id = match[1];
    const h1 = cleanChatgptProjectName(doc.querySelector("h1")?.textContent || "");
    if (h1 && h1.length <= 60) {
      byId.set(id.toLowerCase(), { id, name: h1, url: projectUrl(id) });
    }
  }

  const scraped = mergeScrapedLists(fromApi, Array.from(byId.values()));
  if (scraped.length === 0) {
    return { count: 0, added: 0, updated: 0, removed: 0 };
  }

  // Only treat API as authoritative when it actually returned projects;
  // otherwise keep prior synced rows and just merge DOM hits.
  const replaceSynced = fromApi.length > 0;
  const result = await mergeSyncedChatgptProjects(scraped, { replaceSynced });
  return {
    count: scraped.length,
    added: result.added,
    updated: result.updated,
    removed: result.removed,
  };
}

export function buildChatgptDestinationUrl(project?: ChatgptProject | null): string {
  if (!project) return "https://chatgpt.com/";
  try {
    return new URL(project.url).toString();
  } catch {
    const id = canonicalChatgptProjectId(project);
    return id ? projectUrl(id) : "https://chatgpt.com/";
  }
}
