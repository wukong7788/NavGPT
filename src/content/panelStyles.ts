/** Styles injected into the floating panel shadow root. */
export const PANEL_STYLES = `
:host, * { box-sizing: border-box; }

:host {
  --bg: #ffffff;
  --text: #171717;
  --muted: #676767;
  --border: #e5e5e5;
  --accent: #10a37f;
  --hover: #f7f7f8;
  --shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}

@media (prefers-color-scheme: dark) {
  :host {
    --bg: #212121;
    --text: #ececf1;
    --muted: #acacbe;
    --border: #343541;
    --hover: #2a2b32;
    --shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
  }
}

.fab {
  position: fixed;
  right: 16px;
  bottom: 96px;
  z-index: 2147483646;
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 12px;
  background: var(--accent);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.02em;
  cursor: grab;
  touch-action: none;
  user-select: none;
  box-shadow: var(--shadow);
  display: flex;
  align-items: center;
  justify-content: center;
}

.fab:hover { filter: brightness(1.05); }
.fab.dragging { cursor: grabbing; opacity: 0.92; }
.fab[aria-expanded="true"] { outline: 2px solid #fff; outline-offset: 2px; }

.panel {
  position: fixed;
  right: 16px;
  top: 72px;
  bottom: 152px;
  width: min(360px, calc(100vw - 32px));
  z-index: 2147483646;
  display: none;
  flex-direction: column;
  background: var(--bg);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: var(--shadow);
  overflow: hidden;
}

.panel.open { display: flex; }

.header {
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex-shrink: 0;
}

.header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.icon-btn, .rescan-btn {
  background: none;
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 8px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.rescan-btn {
  padding: 5px 8px;
  font-size: 12px;
  font-weight: 500;
}

.icon-btn {
  width: 28px;
  height: 28px;
  font-size: 16px;
  line-height: 1;
}

.icon-btn:hover, .rescan-btn:hover { background: var(--hover); }

.search {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text);
  font-size: 13px;
  outline: none;
}

.search:focus { border-color: var(--accent); }

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.filter-btn {
  background: var(--bg);
  border: 1px solid var(--border);
  color: var(--muted);
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  cursor: pointer;
}

.filter-btn.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.stats {
  font-size: 12px;
  color: var(--muted);
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  flex: 1;
}

.item {
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.item:hover, .item.active { background: var(--hover); }
.item.active { border-left: 3px solid var(--accent); }

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.item-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.role {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: 4px;
}

.role-user { background: #f0f0f0; color: #555; }
.role-assistant { background: #e6f7f2; color: var(--accent); }

@media (prefers-color-scheme: dark) {
  .role-user { background: #3a3a3a; color: #ddd; }
}

.index { font-size: 11px; color: var(--muted); }

.star-btn {
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: var(--muted);
  display: inline-flex;
}

.star-btn.active, .star-btn:hover { color: #ffb800; }

.preview {
  font-size: 13px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.code-badge {
  font-size: 11px;
  color: var(--accent);
  margin-top: 2px;
}

.conv-badge {
  font-size: 11px;
  color: var(--accent);
  background: var(--hover);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 2px 8px;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 4px;
  align-self: flex-start;
}

.empty {
  display: none;
  padding: 24px 16px;
  text-align: center;
  color: var(--muted);
  font-size: 13px;
}

.empty.show { display: block; }

.footer {
  padding: 8px;
  font-size: 10px;
  color: var(--muted);
  text-align: center;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}
`;
