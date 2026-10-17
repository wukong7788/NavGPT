import {
  createChatgptProject,
  getLastChatgptProjectId,
  loadChatgptProjects,
  saveChatgptProjects,
  setLastChatgptProjectId,
  type ChatgptProject,
} from "../../shared/chatgptProjects";
import { openChatgptWithPrompt } from "../../shared/chatgptShare";
import {
  createProject,
  getLastProjectId,
  loadGrokProjects,
  saveGrokProjects,
  setLastProjectId,
  type GrokProject,
} from "../../shared/grokProjects";
import { openGrokWithPrompt } from "../../shared/grokShare";
import type { ProductInfo } from "../../shared/product";
import {
  buildProductPromptFromTemplate,
  createProductPromptTemplate,
  getLastProductTemplateId,
  loadProductPromptTemplates,
  saveProductPromptTemplates,
  setLastProductTemplateId,
  type ProductPromptTemplate,
} from "../../shared/productPromptTemplates";

const ROOT_ID = "navgpt-product-prompt-root";
const STYLE_ID = "navgpt-product-prompt-style";
const DEFAULT_OPTION = "";

type AnyProject = GrokProject | ChatgptProject;

export type ProductPromptEditorContext = {
  product: ProductInfo;
  templateId?: string;
};

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #${ROOT_ID} {
      all: initial;
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    }
    #${ROOT_ID} .navgpt-backdrop {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.45);
    }
    #${ROOT_ID} .navgpt-dialog {
      position: relative;
      width: min(560px, calc(100vw - 32px));
      max-height: min(80vh, 720px);
      display: flex;
      flex-direction: column;
      background: #fff;
      color: #0f1419;
      border-radius: 16px;
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.28);
      overflow: hidden;
    }
    #${ROOT_ID} .navgpt-dialog-wide {
      width: min(640px, calc(100vw - 32px));
    }
    #${ROOT_ID} .navgpt-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 16px;
      border-bottom: 1px solid #eff3f4;
    }
    #${ROOT_ID} .navgpt-title {
      margin: 0;
      font-size: 16px;
      font-weight: 700;
    }
    #${ROOT_ID} .navgpt-close {
      border: none;
      background: transparent;
      width: 32px;
      height: 32px;
      border-radius: 999px;
      cursor: pointer;
      font-size: 20px;
      line-height: 1;
      color: #536471;
    }
    #${ROOT_ID} .navgpt-close:hover { background: #f7f9f9; }
    #${ROOT_ID} .navgpt-body {
      padding: 12px 16px;
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
      overflow: auto;
    }
    #${ROOT_ID} .navgpt-hint {
      margin: 0;
      font-size: 12px;
      color: #536471;
    }
    #${ROOT_ID} .navgpt-project-block {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    #${ROOT_ID} .navgpt-project-label {
      margin: 0;
      font-size: 12px;
      font-weight: 600;
      color: #536471;
    }
    #${ROOT_ID} .navgpt-project-row,
    #${ROOT_ID} .navgpt-preset-row {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }
    #${ROOT_ID} .navgpt-project-row select {
      flex: 1;
      min-width: 0;
      height: 36px;
      border: 1px solid #cfd9de;
      border-radius: 10px;
      padding: 0 10px;
      background: #fff;
      color: #0f1419;
      font-size: 13px;
    }
    #${ROOT_ID} .navgpt-project-row .navgpt-btn {
      padding: 8px 12px;
      white-space: nowrap;
    }
    #${ROOT_ID} .navgpt-chip {
      border: 1px solid #cfd9de;
      background: #fff;
      color: #0f1419;
      border-radius: 999px;
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      line-height: 1.2;
    }
    #${ROOT_ID} .navgpt-chip:hover { background: #f7f9f9; }
    #${ROOT_ID} .navgpt-chip.active {
      border-color: #10a37f;
      background: rgba(16, 163, 127, 0.12);
      color: #0a7a5c;
    }
    #${ROOT_ID} .navgpt-chip-settings {
      margin-left: auto;
      color: #536471;
      font-weight: 600;
    }
    #${ROOT_ID} textarea,
    #${ROOT_ID} input[type="text"] {
      width: 100%;
      border: 1px solid #cfd9de;
      border-radius: 12px;
      padding: 12px;
      font-size: 14px;
      line-height: 1.45;
      color: #0f1419;
      background: #fff;
      outline: none;
      box-sizing: border-box;
      font-family: inherit;
    }
    #${ROOT_ID} textarea {
      flex: 1;
      min-height: 180px;
      resize: vertical;
    }
    #${ROOT_ID} textarea:focus,
    #${ROOT_ID} input[type="text"]:focus,
    #${ROOT_ID} .navgpt-project-row select:focus {
      border-color: #10a37f;
      box-shadow: 0 0 0 2px rgba(16, 163, 127, 0.2);
    }
    #${ROOT_ID} .navgpt-footer {
      display: flex;
      justify-content: flex-end;
      flex-wrap: wrap;
      gap: 8px;
      padding: 12px 16px 16px;
      border-top: 1px solid #eff3f4;
    }
    #${ROOT_ID} .navgpt-btn {
      border: none;
      border-radius: 999px;
      padding: 8px 16px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
    }
    #${ROOT_ID} .navgpt-btn-secondary {
      background: #eff3f4;
      color: #0f1419;
    }
    #${ROOT_ID} .navgpt-btn-primary {
      background: #10a37f;
      color: #fff;
    }
    #${ROOT_ID} .navgpt-btn-chatgpt {
      background: #212121;
      color: #fff;
    }
    #${ROOT_ID} .navgpt-btn-danger {
      background: #fee;
      color: #b42318;
    }
    #${ROOT_ID} .navgpt-btn-primary:hover,
    #${ROOT_ID} .navgpt-btn-chatgpt:hover { filter: brightness(1.05); }
    #${ROOT_ID} .navgpt-btn-primary:disabled,
    #${ROOT_ID} .navgpt-btn-chatgpt:disabled,
    #${ROOT_ID} .navgpt-btn-secondary:disabled,
    #${ROOT_ID} .navgpt-btn-danger:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    #${ROOT_ID} .navgpt-tpl-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    #${ROOT_ID} .navgpt-tpl-item {
      border: 1px solid #eff3f4;
      border-radius: 12px;
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    #${ROOT_ID} .navgpt-tpl-item-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    #${ROOT_ID} .navgpt-tpl-item label {
      display: block;
      font-size: 12px;
      color: #536471;
      margin-bottom: 4px;
    }
    #${ROOT_ID} .navgpt-tpl-item textarea {
      min-height: 88px;
    }
    @media (prefers-color-scheme: dark) {
      #${ROOT_ID} .navgpt-dialog {
        background: #15202b;
        color: #e7e9ea;
      }
      #${ROOT_ID} .navgpt-header,
      #${ROOT_ID} .navgpt-footer,
      #${ROOT_ID} .navgpt-tpl-item {
        border-color: #38444d;
      }
      #${ROOT_ID} .navgpt-hint,
      #${ROOT_ID} .navgpt-project-label,
      #${ROOT_ID} .navgpt-tpl-item label,
      #${ROOT_ID} .navgpt-chip-settings { color: #8b98a5; }
      #${ROOT_ID} .navgpt-close { color: #e7e9ea; }
      #${ROOT_ID} .navgpt-close:hover { background: #1e2732; }
      #${ROOT_ID} textarea,
      #${ROOT_ID} input[type="text"],
      #${ROOT_ID} .navgpt-project-row select,
      #${ROOT_ID} .navgpt-chip {
        background: #0f1419;
        color: #e7e9ea;
        border-color: #38444d;
      }
      #${ROOT_ID} .navgpt-chip:hover { background: #1e2732; }
      #${ROOT_ID} .navgpt-chip.active {
        background: rgba(16, 163, 127, 0.2);
        color: #6ee7b7;
        border-color: #10a37f;
      }
      #${ROOT_ID} .navgpt-btn-secondary {
        background: #38444d;
        color: #e7e9ea;
      }
      #${ROOT_ID} .navgpt-btn-danger {
        background: #3f1d1d;
        color: #fca5a5;
      }
      #${ROOT_ID} .navgpt-btn-chatgpt {
        background: #e7e9ea;
        color: #0f1419;
      }
    }
  `;
  document.documentElement.appendChild(style);
}

function closeEditor() {
  document.getElementById(ROOT_ID)?.remove();
}

function fillProjectSelect(
  select: HTMLSelectElement,
  projects: AnyProject[],
  selectedId: string,
  defaultLabel = "默认对话（不指定项目）"
) {
  select.innerHTML = "";
  const defaultOpt = document.createElement("option");
  defaultOpt.value = DEFAULT_OPTION;
  defaultOpt.textContent = defaultLabel;
  select.appendChild(defaultOpt);

  for (const project of projects) {
    const opt = document.createElement("option");
    opt.value = project.id;
    const tag = project.source === "sync" ? " · 已同步" : "";
    opt.textContent = `${project.name}${tag}`;
    select.appendChild(opt);
  }

  const exists = selectedId && projects.some((p) => p.id === selectedId);
  select.value = exists ? selectedId : DEFAULT_OPTION;
}

function renderPresetRow(
  row: HTMLElement,
  templates: ProductPromptTemplate[],
  activeId: string,
  onPick: (id: string) => void,
  onSettings: () => void
) {
  row.innerHTML = "";
  for (const t of templates) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `navgpt-chip${t.id === activeId ? " active" : ""}`;
    btn.textContent = t.label;
    btn.setAttribute("data-template-id", t.id);
    btn.addEventListener("click", () => onPick(t.id));
    row.appendChild(btn);
  }
  const settings = document.createElement("button");
  settings.type = "button";
  settings.className = "navgpt-chip navgpt-chip-settings";
  settings.textContent = "设置";
  settings.title = "编辑 / 新增提示词按钮";
  settings.addEventListener("click", onSettings);
  row.appendChild(settings);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

function openTemplateSettings(onDone: (templates: ProductPromptTemplate[]) => void) {
  ensureStyles();
  closeEditor();

  void (async () => {
    let templates = await loadProductPromptTemplates();

    const root = document.createElement("div");
    root.id = ROOT_ID;
    root.innerHTML = `
      <div class="navgpt-backdrop" data-action="close"></div>
      <div class="navgpt-dialog navgpt-dialog-wide" role="dialog" aria-modal="true" aria-label="提示词设置">
        <div class="navgpt-header">
          <h2 class="navgpt-title">购物提示词设置</h2>
          <button class="navgpt-close" type="button" data-action="close" aria-label="关闭">×</button>
        </div>
        <div class="navgpt-body">
          <p class="navgpt-hint">可修改按钮名称与初始提示词；「商品信息 / 链接」发送时会自动附在提示词后面。也可新增自定义按钮。</p>
          <ul class="navgpt-tpl-list" data-role="list"></ul>
        </div>
        <div class="navgpt-footer">
          <button class="navgpt-btn navgpt-btn-secondary" type="button" data-action="add">新增按钮</button>
          <button class="navgpt-btn navgpt-btn-secondary" type="button" data-action="close">取消</button>
          <button class="navgpt-btn navgpt-btn-primary" type="button" data-action="save">保存</button>
        </div>
      </div>
    `;

    const list = root.querySelector('[data-role="list"]') as HTMLElement;

    const paint = () => {
      list.innerHTML = "";
      templates.forEach((t, index) => {
        const li = document.createElement("li");
        li.className = "navgpt-tpl-item";
        li.innerHTML = `
          <div class="navgpt-tpl-item-head">
            <strong>${t.builtin ? "内置" : "自定义"} · ${escapeHtml(t.label)}</strong>
            <button class="navgpt-btn navgpt-btn-danger" type="button" data-action="delete" data-index="${index}" ${
              templates.length <= 1 ? "disabled" : ""
            }>删除</button>
          </div>
          <div>
            <label>按钮名称</label>
            <input type="text" data-field="label" data-index="${index}" value="${escapeAttr(t.label)}" maxlength="20" />
          </div>
          <div>
            <label>初始提示词</label>
            <textarea data-field="instruction" data-index="${index}">${escapeHtml(t.instruction)}</textarea>
          </div>
        `;
        list.appendChild(li);
      });
    };

    const readFromDom = () => {
      const next: ProductPromptTemplate[] = [];
      templates.forEach((t, index) => {
        const labelInput = root.querySelector(
          `input[data-field="label"][data-index="${index}"]`
        ) as HTMLInputElement | null;
        const instructionInput = root.querySelector(
          `textarea[data-field="instruction"][data-index="${index}"]`
        ) as HTMLTextAreaElement | null;
        next.push({
          ...t,
          label: (labelInput?.value || t.label).trim(),
          instruction: (instructionInput?.value || t.instruction).trim(),
          order: index,
        });
      });
      templates = next;
    };

    paint();

    root.addEventListener("click", async (e) => {
      const target = e.target as HTMLElement;
      const action = target.closest("[data-action]")?.getAttribute("data-action");
      if (!action) return;

      if (action === "close") {
        closeEditor();
        onDone(await loadProductPromptTemplates());
        return;
      }

      if (action === "add") {
        readFromDom();
        const created = createProductPromptTemplate("自定义", "请针对以下商品……");
        if (!created) return;
        templates = [...templates, created];
        paint();
        return;
      }

      if (action === "delete") {
        const index = Number(target.closest("[data-index]")?.getAttribute("data-index"));
        if (Number.isNaN(index) || templates.length <= 1) return;
        const item = templates[index];
        if (!item) return;
        if (!window.confirm(`删除按钮「${item.label}」？`)) return;
        readFromDom();
        templates = templates.filter((_, i) => i !== index);
        paint();
        return;
      }

      if (action === "save") {
        readFromDom();
        const invalid = templates.find((t) => !t.label || !t.instruction);
        if (invalid) {
          window.alert("按钮名称和初始提示词都不能为空。");
          return;
        }
        await saveProductPromptTemplates(templates);
        closeEditor();
        onDone(templates);
      }
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeEditor();
        window.removeEventListener("keydown", onKeyDown, true);
        void loadProductPromptTemplates().then(onDone);
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    document.documentElement.appendChild(root);
  })();
}

/** Show editable product prompt dialog; send opens Grok or ChatGPT. */
export async function openProductPromptEditor(ctx: ProductPromptEditorContext) {
  ensureStyles();
  closeEditor();

  let grokProjects = await loadGrokProjects();
  let chatgptProjects = await loadChatgptProjects();
  let templates = await loadProductPromptTemplates();
  const lastGrokId = await getLastProjectId();
  const lastChatgptId = await getLastChatgptProjectId();
  const lastTemplateId = ctx.templateId || (await getLastProductTemplateId());
  let activeTemplateId =
    templates.find((t) => t.id === lastTemplateId)?.id || templates[0]?.id || "productReview";

  const applyTemplate = (id: string) => {
    const t = templates.find((x) => x.id === id) || templates[0];
    if (!t) return "";
    activeTemplateId = t.id;
    void setLastProductTemplateId(t.id);
    return buildProductPromptFromTemplate(t, ctx.product);
  };

  const initialPrompt = applyTemplate(activeTemplateId);

  const root = document.createElement("div");
  root.id = ROOT_ID;
  root.innerHTML = `
    <div class="navgpt-backdrop" data-action="close"></div>
    <div class="navgpt-dialog" role="dialog" aria-modal="true" aria-label="问 AI 这个产品">
      <div class="navgpt-header">
        <h2 class="navgpt-title">问 AI 这个产品</h2>
        <button class="navgpt-close" type="button" data-action="close" aria-label="关闭">×</button>
      </div>
      <div class="navgpt-body">
        <p class="navgpt-hint">两套项目互不共用：在 <strong>chatgpt.com</strong> / <strong>grok.com</strong> 的 Nav 面板分别「同步项目」。发送时只用对应一侧的选择。</p>
        <div class="navgpt-project-block">
          <p class="navgpt-project-label">Grok 项目（仅「发送给 Grok」）</p>
          <div class="navgpt-project-row">
            <select data-role="grok-project" aria-label="选择 Grok 项目"></select>
            <button class="navgpt-btn navgpt-btn-secondary" type="button" data-action="add-grok-project">添加</button>
            <button class="navgpt-btn navgpt-btn-secondary" type="button" data-action="remove-grok-project" title="删除当前选中的 Grok 项目">删除</button>
          </div>
        </div>
        <div class="navgpt-project-block">
          <p class="navgpt-project-label">ChatGPT 项目（仅「发送给 ChatGPT」）</p>
          <div class="navgpt-project-row">
            <select data-role="chatgpt-project" aria-label="选择 ChatGPT 项目"></select>
            <button class="navgpt-btn navgpt-btn-secondary" type="button" data-action="add-chatgpt-project">添加</button>
            <button class="navgpt-btn navgpt-btn-secondary" type="button" data-action="remove-chatgpt-project" title="删除当前选中的 ChatGPT 项目">删除</button>
          </div>
        </div>
        <div class="navgpt-preset-row" data-role="presets"></div>
        <textarea></textarea>
      </div>
      <div class="navgpt-footer">
        <button class="navgpt-btn navgpt-btn-secondary" type="button" data-action="close">取消</button>
        <button class="navgpt-btn navgpt-btn-chatgpt" type="button" data-action="send-chatgpt">发送给 ChatGPT</button>
        <button class="navgpt-btn navgpt-btn-primary" type="button" data-action="send-grok">发送给 Grok</button>
      </div>
    </div>
  `;

  const textarea = root.querySelector("textarea") as HTMLTextAreaElement;
  const sendGrokBtn = root.querySelector('[data-action="send-grok"]') as HTMLButtonElement;
  const sendChatgptBtn = root.querySelector('[data-action="send-chatgpt"]') as HTMLButtonElement;
  const removeGrokBtn = root.querySelector(
    '[data-action="remove-grok-project"]'
  ) as HTMLButtonElement;
  const removeChatgptBtn = root.querySelector(
    '[data-action="remove-chatgpt-project"]'
  ) as HTMLButtonElement;
  const grokSelect = root.querySelector('[data-role="grok-project"]') as HTMLSelectElement;
  const chatgptSelect = root.querySelector('[data-role="chatgpt-project"]') as HTMLSelectElement;
  const presetRow = root.querySelector('[data-role="presets"]') as HTMLElement;
  textarea.value = initialPrompt;
  fillProjectSelect(grokSelect, grokProjects, lastGrokId, "默认对话（不指定 Grok 项目）");
  fillProjectSelect(
    chatgptSelect,
    chatgptProjects,
    lastChatgptId,
    "默认对话（不指定 ChatGPT 项目）"
  );

  const syncButtons = () => {
    const empty = textarea.value.trim().length === 0;
    sendGrokBtn.disabled = empty;
    sendChatgptBtn.disabled = empty;
    removeGrokBtn.disabled = !grokSelect.value;
    removeChatgptBtn.disabled = !chatgptSelect.value;
  };

  const paintPresets = () => {
    renderPresetRow(
      presetRow,
      templates,
      activeTemplateId,
      (id) => {
        textarea.value = applyTemplate(id);
        paintPresets();
        syncButtons();
        textarea.focus();
      },
      () => {
        openTemplateSettings((next) => {
          templates = next;
          if (!templates.some((t) => t.id === activeTemplateId)) {
            activeTemplateId = templates[0]?.id || "productReview";
          }
          void openProductPromptEditor({
            product: ctx.product,
            templateId: activeTemplateId,
          });
        });
      }
    );
  };

  paintPresets();
  syncButtons();
  textarea.addEventListener("input", syncButtons);
  grokSelect.addEventListener("change", syncButtons);
  chatgptSelect.addEventListener("change", syncButtons);

  const setSending = (which: "grok" | "chatgpt") => {
    sendGrokBtn.disabled = true;
    sendChatgptBtn.disabled = true;
    if (which === "grok") sendGrokBtn.textContent = "正在打开…";
    else sendChatgptBtn.textContent = "正在打开…";
  };

  root.addEventListener("click", async (e) => {
    const target = e.target as HTMLElement;
    const action = target.closest("[data-action]")?.getAttribute("data-action");

    if (action === "close") {
      closeEditor();
      return;
    }

    if (action === "add-grok-project") {
      const name = window.prompt("Grok 项目名称（例如：补剂研究）");
      if (name === null) return;
      const url = window.prompt(
        "请粘贴该 Grok 项目页面链接（在 grok.com 打开项目后从地址栏复制）"
      );
      if (url === null) return;

      const project = createProject(name, url);
      if (!project) {
        window.alert("Grok 项目名称或链接无效，请重试。");
        return;
      }

      grokProjects = [...grokProjects, project];
      await saveGrokProjects(grokProjects);
      await setLastProjectId(project.id);
      fillProjectSelect(grokSelect, grokProjects, project.id, "默认对话（不指定 Grok 项目）");
      syncButtons();
      return;
    }

    if (action === "remove-grok-project") {
      const id = grokSelect.value;
      if (!id) return;
      const targetProject = grokProjects.find((p) => p.id === id);
      if (!targetProject) return;
      if (!window.confirm(`删除 Grok 项目「${targetProject.name}」？`)) return;

      grokProjects = grokProjects.filter((p) => p.id !== id);
      await saveGrokProjects(grokProjects);
      await setLastProjectId("");
      fillProjectSelect(grokSelect, grokProjects, "", "默认对话（不指定 Grok 项目）");
      syncButtons();
      return;
    }

    if (action === "add-chatgpt-project") {
      const name = window.prompt("ChatGPT 项目名称（例如：补剂研究）");
      if (name === null) return;
      const url = window.prompt(
        "请粘贴该 ChatGPT 项目链接（形如 https://chatgpt.com/g/g-p-…/project）"
      );
      if (url === null) return;

      const project = createChatgptProject(name, url);
      if (!project) {
        window.alert("ChatGPT 项目名称或链接无效，请确认链接含 /g/g-p-…/project。");
        return;
      }

      chatgptProjects = [...chatgptProjects, project];
      await saveChatgptProjects(chatgptProjects);
      await setLastChatgptProjectId(project.id);
      fillProjectSelect(
        chatgptSelect,
        chatgptProjects,
        project.id,
        "默认对话（不指定 ChatGPT 项目）"
      );
      syncButtons();
      return;
    }

    if (action === "remove-chatgpt-project") {
      const id = chatgptSelect.value;
      if (!id) return;
      const targetProject = chatgptProjects.find((p) => p.id === id);
      if (!targetProject) return;
      if (!window.confirm(`删除 ChatGPT 项目「${targetProject.name}」？`)) return;

      chatgptProjects = chatgptProjects.filter((p) => p.id !== id);
      await saveChatgptProjects(chatgptProjects);
      await setLastChatgptProjectId("");
      fillProjectSelect(
        chatgptSelect,
        chatgptProjects,
        "",
        "默认对话（不指定 ChatGPT 项目）"
      );
      syncButtons();
      return;
    }

    if (action === "send-grok") {
      const text = textarea.value.trim();
      if (!text) return;

      const selectedId = grokSelect.value;
      const project = grokProjects.find((p) => p.id === selectedId) || null;
      await setLastProjectId(selectedId || "");
      await setLastProductTemplateId(activeTemplateId);
      setSending("grok");
      try {
        await openGrokWithPrompt(text, project);
      } finally {
        closeEditor();
      }
      return;
    }

    if (action === "send-chatgpt") {
      const text = textarea.value.trim();
      if (!text) return;

      const selectedId = chatgptSelect.value;
      const project = chatgptProjects.find((p) => p.id === selectedId) || null;
      await setLastChatgptProjectId(selectedId || "");
      await setLastProductTemplateId(activeTemplateId);
      setSending("chatgpt");
      try {
        await openChatgptWithPrompt(text, project);
      } finally {
        closeEditor();
      }
    }
  });

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeEditor();
      window.removeEventListener("keydown", onKeyDown, true);
    }
  };
  window.addEventListener("keydown", onKeyDown, true);

  document.documentElement.appendChild(root);
  queueMicrotask(() => {
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  });
}
