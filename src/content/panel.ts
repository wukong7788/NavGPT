import { ChatMessageRecord } from "../shared/types";
import { openXShare } from "../shared/share";
import { extractMessages as defaultExtract } from "./extract";
import { jumpToMessage as defaultJump } from "./jump";
import { PANEL_STYLES } from "./panelStyles";

const HOST_ID = "navgpt-floating-root";
const FAB_POSITION_KEY = "fab_position";
const FAB_SIZE = 44;
const DRAG_THRESHOLD_PX = 5;

export type PanelJumpOpts = {
  domUnitKey?: string;
  role?: ChatMessageRecord["role"];
  listIndex?: number;
};

export type FloatingPanelConfig = {
  extractMessages?: () => ChatMessageRecord[];
  jumpToMessage?: (messageId: string, domMessageId?: string, opts?: PanelJumpOpts) => void;
  /** Extra footer text, e.g. site name */
  siteLabel?: string;
  /** Optional async project sync. Returns status text. */
  syncProjects?: () => Promise<string>;
  /** Sync button label / title (e.g. 同步 Grok 项目) */
  syncProjectsLabel?: string;
  showShareToX?: boolean;
};

let panelConfig: FloatingPanelConfig = {
  extractMessages: defaultExtract,
  jumpToMessage: defaultJump,
  siteLabel: "ChatGPT",
  showShareToX: true,
};

export function configureFloatingPanel(config: FloatingPanelConfig) {
  panelConfig = { ...panelConfig, ...config };
}

type FabPosition = { left: number; top: number };

let host: HTMLElement | null = null;
let shadow: ShadowRoot | null = null;
let open = false;
let suppressFabClick = false;

let allMessages: ChatMessageRecord[] = [];
let globalStarredMessages: ChatMessageRecord[] = [];
let starredMessageIds = new Set<string>();
let currentFilter = "all";
let searchQuery = "";

type PanelEls = {
  fab: HTMLButtonElement;
  panel: HTMLElement;
  status: HTMLElement;
  list: HTMLElement;
  empty: HTMLElement;
  search: HTMLInputElement;
};

let els: PanelEls | null = null;

export function initFloatingPanel() {
  if (document.getElementById(HOST_ID)) return;

  host = document.createElement("div");
  host.id = HOST_ID;
  // Avoid inheriting ChatGPT page font/color resets into the host box model
  host.style.cssText = "all: initial; position: fixed; z-index: 2147483646;";
  shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = PANEL_STYLES;

  const iconUrl = chrome.runtime.getURL("icon48.png");
  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <button class="fab" type="button" aria-label="Toggle NavGPT" aria-expanded="false" title="NavGPT">
      <img src="${iconUrl}" alt="" width="44" height="44" draggable="false" />
    </button>
    <aside class="panel" role="dialog" aria-label="NavGPT navigator">
      <div class="header">
        <div class="header-top">
          <div class="title-row">
            <img src="${iconUrl}" alt="" width="20" height="20" draggable="false" />
            <h1 class="title">NavGPT</h1>
          </div>
          <div class="header-actions">
            <button class="rescan-btn" type="button" data-action="sync-projects" title="同步项目" style="display:none">
              同步项目
            </button>
            <button class="rescan-btn" type="button" data-action="rescan" title="Rescan">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M23 4v6h-6M1 20v-6h6"></path>
                <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"></path>
              </svg>
              Rescan
            </button>
            <button class="icon-btn" type="button" data-action="close" aria-label="Close">×</button>
          </div>
        </div>
        <input class="search" type="search" placeholder="Search in conversation..." autocomplete="off" />
        <div class="filters">
          <button class="filter-btn active" type="button" data-filter="all">All</button>
          <button class="filter-btn" type="button" data-filter="user">User</button>
          <button class="filter-btn" type="button" data-filter="assistant">AI</button>
          <button class="filter-btn" type="button" data-filter="hasCode">Code</button>
          <button class="filter-btn" type="button" data-filter="starred">Starred</button>
        </div>
        <div class="stats" data-role="status">Ready</div>
      </div>
      <div class="toast" data-role="toast" role="status" aria-live="polite"></div>
      <ul class="list" data-role="list"></ul>
      <div class="empty" data-role="empty">No messages found matching your criteria.</div>
      <div class="footer" data-role="footer">NavGPT</div>
    </aside>
  `;

  shadow.append(style, ...Array.from(wrap.childNodes));
  document.documentElement.appendChild(host);

  els = {
    fab: shadow.querySelector(".fab") as HTMLButtonElement,
    panel: shadow.querySelector(".panel") as HTMLElement,
    status: shadow.querySelector('[data-role="status"]') as HTMLElement,
    list: shadow.querySelector('[data-role="list"]') as HTMLElement,
    empty: shadow.querySelector('[data-role="empty"]') as HTMLElement,
    search: shadow.querySelector(".search") as HTMLInputElement,
  };

  const footer = shadow.querySelector('[data-role="footer"]') as HTMLElement | null;
  if (footer) {
    const version = chrome.runtime.getManifest?.().version || "";
    footer.textContent = version
      ? `${panelConfig.siteLabel || "NavGPT"} · v${version}`
      : panelConfig.siteLabel || "NavGPT";
  }

  const syncBtn = shadow.querySelector('[data-action="sync-projects"]') as HTMLButtonElement | null;
  if (syncBtn) {
    // Keep button short so header actions stay one-line aligned; full name in tooltip.
    const syncTitle = panelConfig.syncProjectsLabel || "同步项目";
    const syncBtnText = "同步项目";
    syncBtn.style.display = panelConfig.syncProjects ? "" : "none";
    syncBtn.textContent = syncBtnText;
    syncBtn.title = syncTitle;
    syncBtn.setAttribute("aria-label", syncTitle);
    syncBtn.addEventListener("click", async () => {
      if (!panelConfig.syncProjects) return;
      syncBtn.disabled = true;
      syncBtn.textContent = "同步中…";
      try {
        const status = await panelConfig.syncProjects();
        setPanelStatus(status);
        showPanelToast(status);
      } catch (err) {
        console.error(err);
        setPanelStatus("同步失败");
        showPanelToast("同步失败，请稍后重试");
      } finally {
        syncBtn.disabled = false;
        syncBtn.textContent = syncBtnText;
      }
    });
  }

  els.fab.addEventListener("click", (e) => {
    if (suppressFabClick) {
      e.preventDefault();
      e.stopPropagation();
      suppressFabClick = false;
      return;
    }
    togglePanel();
  });
  enableFabDrag(els.fab);
  shadow.querySelector('[data-action="close"]')?.addEventListener("click", () => setPanelOpen(false));
  shadow.querySelector('[data-action="rescan"]')?.addEventListener("click", () => rescan());
  els.search.addEventListener("input", () => {
    searchQuery = els!.search.value.toLowerCase();
    applyFiltersAndRender();
  });

  shadow.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      shadow!.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.getAttribute("data-filter") || "all";
      applyFiltersAndRender();
    });
  });

  loadFabPosition();
  loadGlobalStars();
  rescan();
}

function loadFabPosition() {
  chrome.storage.local.get([FAB_POSITION_KEY], (result) => {
    const saved = result[FAB_POSITION_KEY] as FabPosition | undefined;
    if (!saved || !els) return;
    if (typeof saved.left !== "number" || typeof saved.top !== "number") return;
    applyFabPosition(clampFabPosition(saved));
  });
}

function saveFabPosition(pos: FabPosition) {
  chrome.storage.local.set({ [FAB_POSITION_KEY]: pos });
}

function clampFabPosition(pos: FabPosition): FabPosition {
  const maxLeft = Math.max(0, window.innerWidth - FAB_SIZE);
  const maxTop = Math.max(0, window.innerHeight - FAB_SIZE);
  return {
    left: Math.min(Math.max(0, pos.left), maxLeft),
    top: Math.min(Math.max(0, pos.top), maxTop),
  };
}

function applyFabPosition(pos: FabPosition) {
  if (!els) return;
  const fab = els.fab;
  fab.style.left = `${pos.left}px`;
  fab.style.top = `${pos.top}px`;
  fab.style.right = "auto";
  fab.style.bottom = "auto";
}

function enableFabDrag(fab: HTMLButtonElement) {
  let dragging = false;
  let moved = false;
  let startX = 0;
  let startY = 0;
  let originLeft = 0;
  let originTop = 0;
  let activePointerId: number | null = null;

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;

    const rect = fab.getBoundingClientRect();
    dragging = true;
    moved = false;
    suppressFabClick = false;
    activePointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    originLeft = rect.left;
    originTop = rect.top;

    fab.classList.add("dragging");
    fab.setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!dragging || activePointerId !== e.pointerId) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;

    moved = true;
    suppressFabClick = true;
    applyFabPosition(
      clampFabPosition({
        left: originLeft + dx,
        top: originTop + dy,
      })
    );
  };

  const onPointerUp = (e: PointerEvent) => {
    if (!dragging || activePointerId !== e.pointerId) return;

    dragging = false;
    activePointerId = null;
    fab.classList.remove("dragging");

    try {
      fab.releasePointerCapture(e.pointerId);
    } catch {
      // ignore if already released
    }

    if (!moved) return;

    const rect = fab.getBoundingClientRect();
    const pos = clampFabPosition({ left: rect.left, top: rect.top });
    applyFabPosition(pos);
    saveFabPosition(pos);
  };

  fab.addEventListener("pointerdown", onPointerDown);
  fab.addEventListener("pointermove", onPointerMove);
  fab.addEventListener("pointerup", onPointerUp);
  fab.addEventListener("pointercancel", onPointerUp);

  window.addEventListener("resize", () => {
    if (!els) return;
    const rect = els.fab.getBoundingClientRect();
    // Only re-clamp when a custom position is active (left/top set)
    if (!els.fab.style.left && !els.fab.style.top) return;
    applyFabPosition(clampFabPosition({ left: rect.left, top: rect.top }));
  });
}

export function togglePanel() {
  setPanelOpen(!open);
}

export function setPanelOpen(next: boolean) {
  if (!els) initFloatingPanel();
  if (!els) return;

  open = next;
  els.panel.classList.toggle("open", open);
  els.fab.setAttribute("aria-expanded", String(open));

  if (open) {
    rescan();
    queueMicrotask(() => els?.search.focus());
  }
}

export function setPanelMessages(messages: ChatMessageRecord[]) {
  allMessages = messages;
  applyFiltersAndRender();
}

export function setPanelStatus(text: string) {
  if (!els) return;
  els.status.textContent = text;
  els.status.classList.add("flash");
  window.setTimeout(() => els?.status.classList.remove("flash"), 2400);
}

let toastTimer: number | null = null;

/** Brief banner under the header (e.g. after project sync). */
export function showPanelToast(text: string, ms = 4500) {
  if (!shadow) return;
  const toast = shadow.querySelector('[data-role="toast"]') as HTMLElement | null;
  if (!toast) return;
  toast.textContent = text;
  toast.classList.add("show");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.classList.remove("show");
    toastTimer = null;
  }, ms);
}

function loadGlobalStars() {
  chrome.storage.local.get(["global_stars"], (result) => {
    globalStarredMessages = (result.global_stars as ChatMessageRecord[]) || [];
    starredMessageIds = new Set(globalStarredMessages.map((m) => m.id));
    applyFiltersAndRender();
  });
}

function rescan() {
  if (els) els.status.textContent = "Scanning...";
  try {
    const extract = panelConfig.extractMessages || defaultExtract;
    const messages = extract();
    setPanelMessages(messages);
  } catch (err) {
    console.error("NavGPT: rescan failed", err);
    if (els) els.status.textContent = "Scan failed.";
  }
}

function toggleStar(messageId: string) {
  const existingIndex = globalStarredMessages.findIndex((m) => m.id === messageId);

  if (existingIndex > -1) {
    globalStarredMessages.splice(existingIndex, 1);
  } else {
    const msg = allMessages.find((m) => m.id === messageId);
    if (msg) {
      globalStarredMessages.push({ ...msg, starredAt: Date.now() });
    }
  }

  starredMessageIds = new Set(globalStarredMessages.map((m) => m.id));
  chrome.storage.local.set({ global_stars: globalStarredMessages });
  applyFiltersAndRender();
}

function applyFiltersAndRender() {
  if (!els) return;

  allMessages = allMessages.map((msg) => ({
    ...msg,
    isStarred: starredMessageIds.has(msg.id),
  }));

  let filtered: ChatMessageRecord[];

  if (currentFilter === "starred") {
    filtered = [...globalStarredMessages];
  } else {
    filtered = [...allMessages];
    if (currentFilter === "hasCode") {
      filtered = filtered.filter((m) => m.hasCode);
    } else if (currentFilter !== "all") {
      filtered = filtered.filter((m) => m.role === currentFilter);
    }
  }

  if (searchQuery) {
    filtered = filtered.filter(
      (m) =>
        m.fullText.toLowerCase().includes(searchQuery) ||
        m.preview.toLowerCase().includes(searchQuery) ||
        m.conversationTitle.toLowerCase().includes(searchQuery)
    );
  }

  if (currentFilter === "starred") {
    filtered.sort((a, b) => (b.starredAt || 0) - (a.starredAt || 0));
  } else {
    filtered.sort((a, b) => b.index - a.index);
  }

  const total = currentFilter === "starred" ? globalStarredMessages.length : allMessages.length;
  els.status.textContent = `${filtered.length} of ${total} messages.`;
  renderMessages(filtered);
}

function renderMessages(messages: ChatMessageRecord[]) {
  if (!els) return;

  els.list.innerHTML = "";
  els.empty.classList.toggle("show", messages.length === 0);
  if (messages.length === 0) return;

  messages.forEach((msg) => {
    const li = document.createElement("li");
    li.className = "item";

    const roleClass =
      msg.role === "user" ? "role-user" : msg.role === "assistant" ? "role-assistant" : "role-user";
    const roleLabel = msg.role === "assistant" ? "AI" : msg.role === "user" ? "User" : "?";
    const starred = msg.isStarred || starredMessageIds.has(msg.id);

    li.innerHTML = `
      ${currentFilter === "starred" ? `<div class="conv-badge">${escapeHtml(msg.conversationTitle)}</div>` : ""}
      <div class="item-header">
        <div class="item-meta">
          <span class="role ${roleClass}">${roleLabel}</span>
          <span class="index">#${msg.index}</span>
        </div>
        <div class="item-actions">
          ${
            panelConfig.showShareToX !== false
              ? `<button class="share-btn" type="button" data-share-x="${escapeHtml(msg.id)}" title="发到 X" aria-label="Share to X">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.727-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/>
            </svg>
          </button>`
              : ""
          }
          <button class="star-btn ${starred ? "active" : ""}" type="button" data-star="${escapeHtml(msg.id)}" aria-label="Star">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="${starred ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
          </button>
        </div>
      </div>
      <div class="preview">${escapeHtml(msg.preview)}</div>
      ${msg.hasCode ? '<div class="code-badge">{ } Contains code</div>' : ""}
    `;

    li.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).closest(".star-btn, .share-btn")) return;

      els!.list.querySelectorAll(".item").forEach((item) => item.classList.remove("active"));
      li.classList.add("active");

      const currentUrl = window.location.href;
      if (msg.url && msg.url !== currentUrl) {
        chrome.storage.local.set(
          {
            pendingJump: {
              url: msg.url,
              messageId: msg.id,
              domMessageId: msg.domMessageId,
              domUnitKey: msg.domUnitKey,
              role: msg.role,
              listIndex: msg.listIndex,
            },
          },
          () => {
            window.location.href = msg.url;
          }
        );
        return;
      }

      const jump = panelConfig.jumpToMessage || defaultJump;
      jump(msg.id, msg.domMessageId, {
        domUnitKey: msg.domUnitKey,
        role: msg.role,
        listIndex: msg.listIndex,
      });
    });

    li.querySelector(".star-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleStar(msg.id);
    });

    li.querySelector(".share-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      openXShare(msg);
    });

    els.list.appendChild(li);
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
