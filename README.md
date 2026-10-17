# NavGPT

轻量级 Chrome 扩展：在长 ChatGPT / Grok 对话里快速导航；也可在 X 帖子页用自定义指令打开 Grok；在 iHerb 产品页一键把商品信息发给 Grok / ChatGPT。

扫描当前会话、按关键词搜索、按角色 / 代码 / 收藏过滤，并一键跳转到对应消息——全部在本地浏览器完成。

![NavGPT 悬浮导航窗截图](docs/screenshot.png)

## 功能

- **悬浮窗**：在 ChatGPT / Grok 页面显示（不是浏览器全局侧栏）
- **可拖拽 Nav 按钮**：位置会记住，下次仍在该处
- **切换对话自动刷新**：换会话时自动重新抓取列表，一般不用点 Rescan
- 当前对话关键词搜索
- 过滤：全部 / 用户 / AI / 代码 / 收藏
- 点击跳转并高亮
- **发到 X**：ChatGPT 消息右上角 X 按钮，打开发帖页并预填正文（不带对话链接）
- **同步项目**：在 chatgpt.com 点「同步 ChatGPT 项目」、在 grok.com 点「同步 Grok 项目」；两套列表分开存储，互不混用
- **X NavGPT / Grok 按钮**：帖子详情页（绿色 Grok）与 [历史页](https://x.com/i/history)（NavGPT 图标）可用；弹窗可选提示词，并分别发送给 **Grok** 或 **ChatGPT**
- **iHerb 问产品**：产品详情页（`/pr/`）悬浮 FAB；抽取名称 / 价格 / 评分等；弹窗分别选择 Grok / ChatGPT 项目后再发送
- 星标收藏（Starred）
- 页面更新后可手动 Rescan
- 权限：`storage` + `chatgpt.com` + `grok.com` + `x.com` / `twitter.com` + `*.iherb.com`

## 隐私

- 无账号、无统计、无远程后端
- 消息内容只留在页面 / 扩展本地存储（如收藏、按钮位置、Grok 项目、X / 购物提示词模板）
- 不会把对话内容上传到任何服务器

## 在 Chrome 里安装

目前需要从源码加载（未上架 Chrome 网上应用店）：

1. 安装 [Bun](https://bun.sh)（或改用 npm / pnpm 也可）。
2. 克隆并构建：

```bash
git clone https://github.com/wukong7788/NavGPT.git
cd NavGPT
bun install
bun run build
```

3. 打开 Chrome，地址栏输入并访问：`chrome://extensions/`
4. 右上角打开 **开发者模式**
5. 点击 **加载已解压的扩展程序**
6. 选择本仓库生成的 **`dist`** 文件夹（不要选整个项目根目录）
7. 列表里出现 **NavGPT - Chat Navigator** 即表示安装成功

以后更新代码时：再执行 `bun run build` → 在扩展页点 **重新加载** → 刷新 ChatGPT / Grok / X / iHerb 标签页。

## 在 Chrome 里怎么用

### ChatGPT

1. 打开并登录 [https://chatgpt.com](https://chatgpt.com)
2. 进入任意一条**已有对话**（空白「新聊天」页没有消息可抓）
3. 页面右下角会出现绿色 **Nav** 按钮（单击开关；可拖拽并记住位置）
4. 也可点浏览器工具栏 **NavGPT** 图标开关面板
5. 悬浮窗内：搜索 / 过滤 / 跳转 / Rescan / 星标 / **发到 X**
6. 点 **同步 ChatGPT 项目**：拉取侧栏 Projects 到本地，供 iHerb 弹窗「发送给 ChatGPT」选用

### Grok

1. 打开并登录 [https://grok.com](https://grok.com)
2. 同样会出现 **Nav** 悬浮导航（搜索、过滤、跳转；摘要不含「工作了 Xs」等状态文案）
3. 点面板上的 **同步 Grok 项目**：拉取项目名称与链接到本地
4. 同步后，在 X / iHerb 弹窗「发送给 Grok」时可直接选择这些项目

### 在 X 帖子页用自定义 Grok

1. 打开任意帖子（`https://x.com/用户名/status/数字`），或打开 [Grok 历史](https://x.com/i/history)
2. 帖子页：官方 Grok 旁会出现绿色 **Grok** 按钮；历史页：列表项上会出现 **NavGPT** 图标（需已登录 X）
3. 点击后弹出编辑框：
   - 分别选择 **Grok 项目** / **ChatGPT 项目**（可在对应网站 Nav 面板同步，也可手动添加）
   - 用快捷按钮切换初始提示词（默认：**事实核查**、**一句话摘要**；点 **设置** 可改/增删）
   - 可再编辑文案；帖子正文与链接会附在提示词后
4. 点「发送给 Grok」或「发送给 ChatGPT」打开对应页面，并自动填入发送

### 在 iHerb 产品页问 AI

1. 打开任意 iHerb 产品详情页（URL 含 `/pr/`，例如 `https://sg.iherb.com/pr/.../152148`）
2. 页面右下角会出现绿色 NavGPT 悬浮按钮（可拖拽并记住位置）
3. 点击后弹出编辑框：
   - 分别选择 **Grok 项目** / **ChatGPT 项目**（两套列表独立；可在对应站点 Nav 面板同步）
   - 用快捷按钮切换初始提示词（默认：**产品怎么样**、**成分与副作用**、**是否值得买**）
   - 点 **设置** 可修改或新增提示词
4. 「发送给 Grok」只用 Grok 项目并打开 grok.com；「发送给 ChatGPT」只用 ChatGPT 项目并打开 chatgpt.com；均会自动填入发送

## 开发

```bash
bun install
bun run build
bun run test
```

协作约定与架构说明见 [`agents.md`](./agents.md)，变更记录见 [`CHANGELOG.md`](./CHANGELOG.md)。

当前版本见 `package.json` / `src/manifest.json`（二者保持同步）。

## 开源协议

[ISC](./LICENSE)
