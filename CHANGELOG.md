# Changelog

Format: `add` / `fix` (and `change` when needed).

Versioning (see `agents.md`):
- 大版本（功能 / 适配类重要变更）: `+0.1.0`
- 小版本（缺陷修复 / 小改动）: `+0.0.1`

## 1.2.0 — 2026-10-15

### add
- 消息项增加「发到 X」：打开 X 发帖页并预填回复正文（超长自动截断，不带 ChatGPT 链接）；无需 API Key

## 1.1.4 — 2026-10-15

### fix
- 去掉页面级 `.group.w-full` 回退，避免把侧栏「新聊天 / 账号名」误抓成消息
- 仅在会话根节点内、且带 `:(user|assistant)` unit key 的节点才参与索引

## 1.1.3 — 2026-10-15

### fix
- 切换对话时忽略上一会话残留的零高度节点，避免 AI 预览为空
- 跳转改为按当前可见会话的 `unitKey` / role / listIndex 定位，修复点击无法滚动

## 1.1.2 — 2026-10-15

### add
- 切换 ChatGPT 对话（SPA 路由变化）时自动清空并重新扫描消息列表，无需手动 Rescan

## 1.1.1 — 2026-10-15

### add
- 网页 `Nav` 图标可拖拽；松手后写入本地存储，下次进入 ChatGPT 以该位置为默认

## 1.1.0 — 2026-10-15

### add
- ChatGPT 页内悬浮导航窗（Shadow DOM），右下角 `Nav` 按钮开关；扩展图标点击也可 toggle
- 悬浮窗仅注入 `chatgpt.com`，离开 ChatGPT 后自然消失

### change
- 移除 Chrome Side Panel 与 `sidePanel` 权限，UI 从 `src/sidepanel/` 迁入 `src/content/panel*`

## 1.0.1 — 2026-10-15

### fix
- 适配 ChatGPT 2026 新 DOM：用 `[data-content-search-unit-key]` / `[data-turn-key]` / `[data-user-message-bubble]` / `[data-markdown-text-style]` 恢复消息抓取与跳转
- 跳转目标改为新消息 ID（`data-dil-message-id` / `data-chatgpt-search-message-ids` / `data-turn-key`），并保留旧选择器作为 fallback
- 更新 mock 与 extraction 测试以覆盖新锚点结构

## 1.0.0 — 2026-10-15

### add
- Chrome MV3 扩展骨架：side panel、content script、background
- 对话消息本地索引、关键词搜索、role / code 过滤
- 点击跳转与高亮、手动 rescan
- 初始选择器与 DOM 提取逻辑（legacy ChatGPT 结构）
