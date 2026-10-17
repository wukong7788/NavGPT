# Changelog

Format: `add` / `fix` (and `change` when needed).

Versioning (see `agents.md`):
- 大版本（功能 / 适配类重要变更）: `+0.1.0`
- 小版本（缺陷修复 / 小改动）: `+0.0.1`

## 1.9.2 — 2026-10-17

### change
- 扩展图标恢复为青绿底 + 白色几何 N（箭头形），去掉外圈白边

## 1.9.1 — 2026-10-17

### change
- 扩展图标去掉白边，绿色铺满圆角方块

## 1.9.0 — 2026-10-17

### add
- X [Grok 历史页](https://x.com/i/history)：列表按钮改为 NavGPT 图标；弹窗可分别「发送给 ChatGPT」或「发送给 Grok」（两套项目独立选择）
- 帖子详情页弹窗同样支持发到 ChatGPT / Grok

## 1.8.3 — 2026-10-17

### fix
- iHerb 悬浮钮样式与 ChatGPT/Grok Nav FAB 对齐（圆角方钮，不再用圆形）

## 1.8.2 — 2026-10-17

### fix
- Nav 面板「同步项目」按钮改为短文案并对齐高度，避免换行错位；同步后弹出数量提示（如「已同步 N 个项目」）

## 1.8.1 — 2026-10-17

### fix
- ChatGPT 项目同步不全：改用 `/backend-api/projects` 分页 + snorlax sidebar 游标分页（正确解析 `items[].gizmo.gizmo`）+ session Bearer；再与侧栏 DOM 合并

## 1.8.0 — 2026-10-17

### add
- ChatGPT 项目同步：chatgpt.com Nav 面板「同步 ChatGPT 项目」，独立于 Grok 项目存储
- iHerb 弹窗拆成两套项目选择：发 Grok 用 Grok 项目，发 ChatGPT 用 ChatGPT 项目；发送时打开对应项目页

## 1.7.0 — 2026-10-17

### add
- iHerb 产品页（`/pr/`）：悬浮 FAB 抽取商品信息（JSON-LD），弹窗可编辑提示词后发送给 Grok 或 ChatGPT
- 购物向提示词模板：默认「产品怎么样」「成分与副作用」「是否值得买」，可在设置中编辑 / 增删
- ChatGPT 支持 pending 自动填入并发送（与 Grok 投递链路对齐）

## 1.6.5 — 2026-10-17

### fix
- Grok 抓取：不再误选 `.not-prose` 思考条导致 AI 正文为空；按 `user-message` / `assistant-message` 正确索引两侧消息

## 1.6.4 — 2026-10-15

### change
- 扩展图标改为翠绿底 + 白色 N，去掉黑底，网页悬浮钮更易融入页面

## 1.6.3 — 2026-10-15

### change
- 网页悬浮按钮与面板标题改用新绿色 NavGPT 图标（不再显示文字「Nav」）

## 1.6.2 — 2026-10-15

### fix
- 发送给 Grok 前自动点击帖子「显示更多」，抓取完整长文而非截断预览

## 1.6.1 — 2026-10-15

### add
- X 的 Grok 历史页 `https://x.com/i/history` 也会注入绿色 Grok 按钮（列表中每条相关内容可点）

## 1.6.0 — 2026-10-15

### add
- X 发 Grok 弹窗：项目下拉下方增加提示词快捷按钮（默认「事实核查」「一句话摘要」），点击切换不同初始提示词
- 「设置」可编辑按钮名称与提示词，也可新增 / 删除自定义按钮（本地存储）

## 1.5.3 — 2026-10-15

### fix
- Grok 导航摘要去掉「工作了 33s」等思考/耗时状态文案，只保留正文预览

## 1.5.2 — 2026-10-15

### fix
- 同步项目时按 UUID / 链接 / 同名去重：手动添加的「美股主观投资」会被最新同步结果覆盖，不再出现两条

## 1.5.1 — 2026-10-15

### fix
- 同步项目改为读取 Grok `workspaces` API，使用真正的项目名（如「美股主观投资」），不再把对话标题误当成项目名；重新同步会清理错误的同步条目

## 1.5.0 — 2026-10-15

### add
- `grok.com` 注入悬浮 Nav：扫描对话、搜索/过滤、点击跳转；扩展图标可 toggle
- 「同步项目」：拉取 Grok 项目名称与链接到本地，供 X 发帖弹窗直接选用（无需再手动粘贴链接；1.5.1 起以 workspaces API 为准）

## 1.4.1 — 2026-10-15

### fix
- 发到 Grok 项目时不再依赖无效的 `?q=`；改为本地暂存文案，在 `grok.com` 页面自动填入并发送（并复制到剪贴板兜底）

## 1.4.0 — 2026-10-15

### add
- 发送给 Grok 前可选择目标项目：本地保存项目名称 + grok.com 项目链接，支持添加/删除，并记住上次选择

## 1.3.1 — 2026-10-15

### add
- 点击绿色 Grok 后先弹出可编辑文本框，确认「发送给 Grok」再打开 grok.com

## 1.3.0 — 2026-10-15

### add
- X 帖子页：在官方 Grok 按钮右侧注入绿色 **Grok** 按钮；默认用「核查事实」文案打开 `grok.com/?q=`（含帖子正文与链接）
- 扩展权限增加 `x.com` / `twitter.com`

### fix
- 对齐官方按钮锚点：`button[aria-label="Grok 操作"]`，绿色按钮插在其外层 wrapper 右侧

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
