import { extractProduct, isProductPage } from "./extractProduct";
import { openProductPromptEditor } from "./promptEditor";

const HOST_ID = "navgpt-iherb-fab-root";
const FAB_POSITION_KEY = "iherb_fab_position";
const FAB_SIZE = 44;

type FabPosition = { left: number; top: number };

let host: HTMLElement | null = null;
let fab: HTMLButtonElement | null = null;
let dragMoved = false;

function clampPosition(pos: FabPosition): FabPosition {
  const maxLeft = Math.max(0, window.innerWidth - FAB_SIZE);
  const maxTop = Math.max(0, window.innerHeight - FAB_SIZE);
  return {
    left: Math.min(Math.max(0, pos.left), maxLeft),
    top: Math.min(Math.max(0, pos.top), maxTop),
  };
}

function defaultPosition(): FabPosition {
  return {
    left: Math.max(16, window.innerWidth - FAB_SIZE - 20),
    top: Math.max(16, window.innerHeight - FAB_SIZE - 20),
  };
}

function applyPosition(btn: HTMLButtonElement, pos: FabPosition) {
  const clamped = clampPosition(pos);
  btn.style.left = `${clamped.left}px`;
  btn.style.top = `${clamped.top}px`;
  btn.style.right = "auto";
  btn.style.bottom = "auto";
}

function loadPosition(btn: HTMLButtonElement) {
  chrome.storage.local.get([FAB_POSITION_KEY], (result) => {
    const saved = result[FAB_POSITION_KEY] as FabPosition | undefined;
    applyPosition(btn, saved?.left != null && saved?.top != null ? saved : defaultPosition());
  });
}

function savePosition(pos: FabPosition) {
  chrome.storage.local.set({ [FAB_POSITION_KEY]: clampPosition(pos) });
}

function enableDrag(btn: HTMLButtonElement) {
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let originLeft = 0;
  let originTop = 0;

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    dragging = true;
    dragMoved = false;
    startX = e.clientX;
    startY = e.clientY;
    const rect = btn.getBoundingClientRect();
    originLeft = rect.left;
    originTop = rect.top;
    btn.classList.add("dragging");
    btn.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragMoved = true;
    applyPosition(btn, { left: originLeft + dx, top: originTop + dy });
  };

  const onPointerUp = (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    btn.classList.remove("dragging");
    try {
      btn.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    const rect = btn.getBoundingClientRect();
    savePosition({ left: rect.left, top: rect.top });
  };

  btn.addEventListener("pointerdown", onPointerDown);
  btn.addEventListener("pointermove", onPointerMove);
  btn.addEventListener("pointerup", onPointerUp);
  btn.addEventListener("pointercancel", onPointerUp);
}

function ensureHost(): HTMLElement {
  if (host?.isConnected) return host;

  host = document.createElement("div");
  host.id = HOST_ID;
  const shadow = host.attachShadow({ mode: "open" });

  // Match ChatGPT/Grok Nav FAB (rounded square), not a circle.
  const style = document.createElement("style");
  style.textContent = `
    :host {
      all: initial;
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 2147483646;
    }
    .fab {
      position: fixed;
      width: ${FAB_SIZE}px;
      height: ${FAB_SIZE}px;
      padding: 0;
      border: none;
      border-radius: 12px;
      background: #10a37f;
      color: #fff;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
      cursor: grab;
      pointer-events: auto;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      touch-action: none;
      user-select: none;
    }
    .fab:hover { filter: brightness(1.08); }
    .fab.dragging { cursor: grabbing; opacity: 0.92; }
    .fab img {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: cover;
      pointer-events: none;
      user-select: none;
    }
  `;

  const iconUrl = chrome.runtime.getURL("icon48.png");
  fab = document.createElement("button");
  fab.type = "button";
  fab.className = "fab";
  fab.title = "问 AI 这个产品";
  fab.setAttribute("aria-label", "问 AI 这个产品");
  fab.innerHTML = `<img src="${iconUrl}" alt="" width="44" height="44" draggable="false" />`;

  fab.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragMoved) return;
    const product = extractProduct();
    void openProductPromptEditor({ product });
  });

  enableDrag(fab);
  loadPosition(fab);
  window.addEventListener("resize", () => {
    if (!fab) return;
    const rect = fab.getBoundingClientRect();
    applyPosition(fab, { left: rect.left, top: rect.top });
  });

  shadow.append(style, fab);
  document.documentElement.appendChild(host);
  return host;
}

export function removeIherbFab(): void {
  document.getElementById(HOST_ID)?.remove();
  host = null;
  fab = null;
}

export function syncIherbFab(): void {
  if (!isProductPage()) {
    removeIherbFab();
    return;
  }
  ensureHost();
}
