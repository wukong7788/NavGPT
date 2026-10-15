export type GrokProject = {
  id: string;
  name: string;
  /** Full project page URL, e.g. https://grok.com/project/xxxx */
  url: string;
  /** Set when discovered by auto-sync from grok.com */
  syncedAt?: number;
  source?: "manual" | "sync";
};

const STORAGE_KEY = "grok_projects";
const LAST_PROJECT_KEY = "grok_last_project_id";
const LAST_SYNC_KEY = "grok_projects_last_sync";

const PROJECT_HREF_RE = /\/project\/([a-f0-9-]{36})/i;
const WORKSPACES_API =
  "https://grok.com/rest/workspaces?pageSize=50&orderBy=ORDER_BY_LAST_USE_TIME&kind=WORKSPACE_KIND_ALL";

export async function loadGrokProjects(): Promise<GrokProject[]> {
  const result = await chrome.storage.local.get([STORAGE_KEY]);
  const list = result[STORAGE_KEY];
  return Array.isArray(list) ? (list as GrokProject[]) : [];
}

export async function saveGrokProjects(projects: GrokProject[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: projects });
}

export async function getLastProjectId(): Promise<string> {
  const result = await chrome.storage.local.get([LAST_PROJECT_KEY]);
  return typeof result[LAST_PROJECT_KEY] === "string" ? result[LAST_PROJECT_KEY] : "";
}

export async function setLastProjectId(id: string): Promise<void> {
  await chrome.storage.local.set({ [LAST_PROJECT_KEY]: id });
}

export async function getLastProjectsSyncAt(): Promise<number> {
  const result = await chrome.storage.local.get([LAST_SYNC_KEY]);
  return typeof result[LAST_SYNC_KEY] === "number" ? result[LAST_SYNC_KEY] : 0;
}

export function createProject(name: string, url: string): GrokProject | null {
  const trimmedName = name.trim();
  const trimmedUrl = url.trim();
  if (!trimmedName || !trimmedUrl) return null;

  let normalized = trimmedUrl;
  let projectId = "";
  try {
    const parsed = new URL(trimmedUrl, "https://grok.com");
    parsed.searchParams.delete("q");
    const match = parsed.pathname.match(PROJECT_HREF_RE);
    projectId = match?.[1] || "";
    normalized = parsed.toString();
  } catch {
    return null;
  }

  return {
    id: projectId || `proj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name: trimmedName,
    url: normalized,
    source: "manual",
  };
}

/** Clean display name from Grok project list link text. */
export function cleanProjectName(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(/修改于.*$/u, "")
    .replace(/Edited.*$/i, "")
    .replace(/Updated.*$/i, "")
    .trim();
}

export type ScrapedProject = { id: string; name: string; url: string };

function projectUrl(id: string): string {
  return `https://grok.com/project/${id}`;
}

function scoreProjectName(name: string): number {
  const n = name.trim();
  if (!n) return -100;
  // Short titles look like project names; long ones are often chat previews.
  if (n.length > 40) return 1;
  if (n.length > 24) return 5;
  return 20 - Math.min(n.length, 20) * 0.1;
}

function pickBetterName(prev: string, next: string): string {
  if (!prev) return next;
  if (!next) return prev;
  return scoreProjectName(next) >= scoreProjectName(prev) ? next : prev;
}

function extractAnchorProjectName(a: Element): string {
  // Project cards: <div class="... font-medium ...">美股主观投资</div>
  const titleEl =
    a.querySelector(".font-medium") ||
    a.querySelector('[class*="font-medium"]') ||
    a.querySelector("h2, h3, h4");
  const fromTitle = cleanProjectName(titleEl?.textContent || "");
  if (fromTitle && fromTitle.length <= 40) return fromTitle;

  const full = cleanProjectName(a.textContent || "");
  // First line / first chunk before secondary meta
  const firstChunk = full.split(/(?:修改于|Edited|Updated)/i)[0]?.trim() || full;
  if (firstChunk.length <= 40) return firstChunk;
  return firstChunk.slice(0, 32).trim();
}

/** Scrape project cards/links from the current grok.com document (fallback). */
export function scrapeProjectsFromDocument(doc: Document = document): ScrapedProject[] {
  const found = new Map<string, ScrapedProject>();

  const anchors = Array.from(doc.querySelectorAll("a[href*='/project/']"));
  for (const a of anchors) {
    const href = a.getAttribute("href") || "";
    const match = href.match(PROJECT_HREF_RE);
    if (!match) continue;

    const id = match[1];
    let url: string;
    try {
      const parsed = new URL(href, typeof location !== "undefined" ? location.origin : "https://grok.com");
      parsed.search = "";
      parsed.hash = "";
      // Normalize to project root (drop chat subpaths)
      const rootMatch = parsed.pathname.match(PROJECT_HREF_RE);
      url = rootMatch ? projectUrl(rootMatch[1]) : parsed.toString();
    } catch {
      url = projectUrl(id);
    }

    const name = extractAnchorProjectName(a) || `Project ${id.slice(0, 8)}`;
    const prev = found.get(id);
    if (!prev) {
      found.set(id, { id, name, url });
      continue;
    }
    found.set(id, { id, name: pickBetterName(prev.name, name), url });
  }

  return Array.from(found.values());
}

/** Prefer UUID from id or from /project/{uuid} in url. */
export function canonicalProjectId(project: { id: string; url: string }): string | null {
  if (/^[a-f0-9-]{36}$/i.test(project.id)) return project.id.toLowerCase();
  const fromId = project.id.match(PROJECT_HREF_RE)?.[1];
  if (fromId) return fromId.toLowerCase();
  try {
    const fromUrl = new URL(project.url, "https://grok.com").pathname.match(PROJECT_HREF_RE)?.[1];
    return fromUrl ? fromUrl.toLowerCase() : null;
  } catch {
    return null;
  }
}

function normalizeNameKey(name: string): string {
  return name.replace(/\s+/g, " ").trim().toLowerCase();
}

function existingMatchesScraped(prev: GrokProject, item: ScrapedProject): boolean {
  const canon = canonicalProjectId(prev);
  const scrapedId = item.id.toLowerCase();
  if (canon && canon === scrapedId) return true;
  if (prev.id.toLowerCase() === scrapedId) return true;
  if (normalizeNameKey(prev.name) === normalizeNameKey(item.name)) return true;
  return false;
}

/**
 * Merge scraped projects into storage.
 * Dedupes by project UUID (id/url) and by project name so a prior manual entry
 * like「美股主观投资」is absorbed into the synced workspace instead of duplicating.
 * When `replaceSynced` is true (API success), sync list is authoritative.
 */
export async function mergeSyncedProjects(
  scraped: ScrapedProject[],
  opts?: { replaceSynced?: boolean }
): Promise<{
  projects: GrokProject[];
  added: number;
  updated: number;
  removed: number;
}> {
  const existing = await loadGrokProjects();
  const lastId = await getLastProjectId();
  const now = Date.now();

  const syncedByCanon = new Map<string, GrokProject>();
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

  const finalByKey = new Map<string, GrokProject>();
  for (const [canon, project] of syncedByCanon) {
    finalByKey.set(canon, project);
  }

  const idRemap = new Map<string, string>();
  let added = 0;
  let updated = 0;
  let removed = 0;

  for (const prev of existing) {
    const canon = canonicalProjectId(prev);
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
      // Do not keep the old row — synced entry already in finalByKey
      continue;
    }

    if (opts?.replaceSynced && prev.source !== "manual") {
      removed++;
      continue;
    }

    // Unmatched manual (or leftover): keep, normalized
    const keepKey = canon || prev.id;
    if (finalByKey.has(keepKey)) {
      idRemap.set(prev.id, finalByKey.get(keepKey)!.id);
      removed++;
      continue;
    }

    finalByKey.set(keepKey, {
      ...prev,
      id: keepKey,
      url: canon ? projectUrl(canon) : prev.url,
    });
    if (prev.id !== keepKey) idRemap.set(prev.id, keepKey);
  }

  for (const item of scraped) {
    if (!existing.some((p) => existingMatchesScraped(p, item))) added++;
  }

  // Count absorbed duplicates (old id different from survivor)
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
  } else if (lastId && !projects.some((p) => p.id === lastId || p.id.toLowerCase() === lastId.toLowerCase())) {
    nextLastId = "";
  }

  await chrome.storage.local.set({
    [STORAGE_KEY]: projects,
    [LAST_SYNC_KEY]: now,
    ...(nextLastId !== lastId ? { [LAST_PROJECT_KEY]: nextLastId } : {}),
  });

  return { projects, added, updated, removed };
}

type WorkspaceApiItem = {
  workspaceId?: string;
  name?: string;
};

/** Authoritative project list via Grok workspaces REST API. */
export async function fetchProjectsFromWorkspacesApi(): Promise<ScrapedProject[]> {
  try {
    const res = await fetch(WORKSPACES_API, {
      credentials: "include",
      headers: { accept: "application/json" },
    });
    if (!res.ok) {
      console.warn("NavGPT: workspaces API", res.status);
      return [];
    }
    const json = (await res.json()) as { workspaces?: WorkspaceApiItem[] };
    const list = Array.isArray(json.workspaces) ? json.workspaces : [];
    return list
      .map((w) => {
        const id = typeof w.workspaceId === "string" ? w.workspaceId : "";
        const name = typeof w.name === "string" ? w.name.trim() : "";
        if (!id || !name) return null;
        return { id, name, url: projectUrl(id) } satisfies ScrapedProject;
      })
      .filter((p): p is ScrapedProject => !!p);
  } catch (err) {
    console.warn("NavGPT: workspaces API failed", err);
    return [];
  }
}

/** @deprecated Prefer fetchProjectsFromWorkspacesApi — HTML shell has no project cards. */
export async function fetchProjectsFromListPage(): Promise<ScrapedProject[]> {
  return fetchProjectsFromWorkspacesApi();
}

/**
 * Sync projects: prefer workspaces API (correct names), fall back to DOM scrape.
 */
export async function syncProjectsFromPage(doc: Document = document): Promise<{
  count: number;
  added: number;
  updated: number;
  removed: number;
}> {
  const fromApi = await fetchProjectsFromWorkspacesApi();
  if (fromApi.length > 0) {
    const result = await mergeSyncedProjects(fromApi, { replaceSynced: true });
    return {
      count: fromApi.length,
      added: result.added,
      updated: result.updated,
      removed: result.removed,
    };
  }

  // Fallback: live DOM on /project list (cards are client-rendered).
  const fromPage = scrapeProjectsFromDocument(doc);
  const byId = new Map(fromPage.map((p) => [p.id, p]));

  // Only use h1 on project pages — document.title often becomes the chat title.
  const match = typeof location !== "undefined" ? location.pathname.match(PROJECT_HREF_RE) : null;
  if (match) {
    const id = match[1];
    const h1 = cleanProjectName(doc.querySelector("h1")?.textContent || "");
    if (h1 && h1.length <= 40) {
      const prev = byId.get(id);
      byId.set(id, {
        id,
        name: prev ? pickBetterName(prev.name, h1) : h1,
        url: projectUrl(id),
      });
    }
  }

  const scraped = Array.from(byId.values());
  if (scraped.length === 0) {
    return { count: 0, added: 0, updated: 0, removed: 0 };
  }
  const result = await mergeSyncedProjects(scraped, { replaceSynced: false });
  return {
    count: scraped.length,
    added: result.added,
    updated: result.updated,
    removed: result.removed,
  };
}

/** Destination URL only (prompt delivered via pending storage + grok content script). */
export function buildGrokDestinationUrl(project?: GrokProject | null): string {
  if (!project) return "https://grok.com/";

  try {
    const u = new URL(project.url);
    u.searchParams.delete("q");
    return u.toString();
  } catch {
    return "https://grok.com/";
  }
}

export function buildGrokOpenUrl(prompt: string, project?: GrokProject | null): string {
  if (project) return buildGrokDestinationUrl(project);
  const max = 1800;
  const text = prompt.length > max ? prompt.slice(0, max - 1).trimEnd() + "…" : prompt;
  return `https://grok.com/?q=${encodeURIComponent(text)}`;
}
