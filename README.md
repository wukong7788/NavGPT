# NavGPT

轻量级 Chrome 扩展：在长 ChatGPT 对话里快速导航。

扫描当前会话、按关键词搜索、按角色 / 代码 / 收藏过滤，并一键跳转到对应消息——全部在本地浏览器完成。

![NavGPT 悬浮导航窗截图](docs/screenshot.png)

## 功能

- **悬浮窗**：仅在 ChatGPT 页面显示（不是浏览器全局侧栏）
- **可拖拽 Nav 按钮**：位置会记住，下次仍在该处
- **切换对话自动刷新**：在 ChatGPT 里换会话时自动重新抓取列表，一般不用点 Rescan
- 当前对话关键词搜索
- 过滤：全部 / 用户 / AI / 代码 / 收藏
- 点击跳转并高亮
- **发到 X**：每条消息右上角 X 按钮，打开发帖页并预填正文（不带 ChatGPT 链接）
- 星标收藏（Starred）
- 页面更新后可手动 Rescan
- 权限尽量少：仅 `storage` + `https://chatgpt.com/*`

## 隐私

- 无账号、无统计、无远程后端
- 消息内容只留在页面 / 扩展本地存储（如收藏、按钮位置）
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

以后更新代码时：再执行 `bun run build` → 在扩展页点 **重新加载** → 刷新 ChatGPT 标签页。

## 在 Chrome 里怎么用

1. 打开并登录 [https://chatgpt.com](https://chatgpt.com)
2. 进入任意一条**已有对话**（空白「新聊天」页没有消息可抓）
3. 页面右下角会出现绿色 **Nav** 按钮：
   - **单击**：打开 / 关闭悬浮导航窗
   - **按住拖拽**：挪到喜欢的位置，松手后会记住，下次还在这里
4. 也可以点浏览器工具栏上的 **NavGPT 扩展图标** 来开关面板（只在 ChatGPT 标签页有效）
5. 在悬浮窗里可以：
   - 搜索、过滤（All / User / AI / Code / Starred）
   - 点击消息跳转并高亮
   - **Rescan**：列表不对时手动重扫（切换对话一般会自动刷新）
   - 星标收藏
   - **X** 按钮：预填正文打开发帖页（不带 ChatGPT 链接，需在 X 上确认发送）
6. 换到非 ChatGPT 网站时，悬浮窗不会出现——这是预期行为

## 开发

```bash
bun install
bun run build
bun run test
```

协作约定与架构说明见 [`agents.md`](./agents.md)，变更记录见 [`CHANGELOG.md`](./CHANGELOG.md)。

## 开源协议

[ISC](./LICENSE)
