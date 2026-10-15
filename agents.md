agents.md
# agents.md

## Project
ChatGPT Conversation Navigator (Chrome Extension)

## Goal
Build a Chrome extension that adds fast navigation for long ChatGPT web conversations.

The extension should help users:
- quickly scan long conversations
- jump to specific messages
- search messages by keyword
- filter by user / assistant / code-containing messages
- keep a lightweight, stable, low-maintenance architecture

The project should prioritize robustness over flashy features.

---

## Product Principles

1. **Navigation first**
   The first job is not summarization or AI analysis.
   The first job is fast, reliable navigation in long chats.

2. **Low coupling to page structure**
   ChatGPT page DOM may change.
   Avoid brittle selectors and deeply nested CSS paths.
   Prefer tolerant extraction logic and defensive fallbacks.

3. **Readable and maintainable**
   Keep code small, modular, typed where practical, and easy to debug.

4. **Graceful degradation**
   If some messages cannot be parsed, the extension should still work for the rest.

5. **Fast local UX**
   All core functions should run locally in browser:
   - scan current page
   - build message index
   - filter/search
   - jump to message

6. **No unnecessary permissions**
   Ask only for the minimum Chrome permissions required.

---

## Scope

### In Scope (MVP)
- Chrome Extension Manifest V3
- Floating panel UI injected only on ChatGPT pages (not Chrome side panel)
- Content script that scans conversation messages
- Build local index of messages
- Click-to-scroll navigation
- Keyword search
- Basic message filters:
  - user messages
  - assistant messages
  - messages containing code blocks

### Out of Scope (MVP)
- Cloud sync
- Remote backend
- AI-generated summaries
- Multi-site support beyond ChatGPT
- Export to external services
- Browser support beyond Chrome-compatible browsers

---

## Suggested Roles

### 1. Product / UX Agent
Responsible for:
- defining minimal useful workflow
- making sure floating-panel interaction is efficient
- reducing clutter in navigation UI
- ensuring long-chat usage is smooth
- keeping the panel ChatGPT-only (no leftover UI on other sites)

Deliverables:
- feature priority
- UI state definitions
- interaction flow notes

### 2. Extension Architecture Agent
Responsible for:
- project structure
- MV3 design
- communication between background action click and content-script floating panel
- permission minimization
- storage and state boundaries

Deliverables:
- module boundaries
- event/data flow
- manifest design
- extension lifecycle notes

### 3. DOM Extraction Agent
Responsible for:
- robust detection of conversation messages
- message identity generation
- text extraction
- extracting metadata such as:
  - role
  - index
  - preview
  - code presence
- resilience to DOM changes

Deliverables:
- extraction strategy
- selector fallback strategy
- rescan / mutation observer logic
- parsing test cases

### 4. Navigation Agent
Responsible for:
- stable message anchors
- scroll-to-message behavior
- highlight current target
- re-locate message after DOM updates if possible

Deliverables:
- ID generation approach
- jump behavior
- current item tracking
- scroll stabilization strategy

### 5. Search / Filter Agent
Responsible for:
- local indexing
- keyword matching
- fast filtering by role/type
- result ordering

Deliverables:
- search model
- filter model
- match highlighting design
- performance constraints for long conversations

### 6. QA / Robustness Agent
Responsible for:
- test cases against long chats
- page refresh / partial load / lazy load scenarios
- selector breakage detection
- regression checklist

Deliverables:
- QA checklist
- manual test plan
- edge case list
- bug templates

---

## Architecture Principles

### Core Components
- `manifest.json`
- `src/content/` (extraction, jump, floating panel)
- `src/shared/`
- `src/background/`

### Responsibilities

#### Content Script
- runs only on `https://chatgpt.com/*`
- scans DOM and extracts messages
- mounts the floating navigator panel (Shadow DOM)
- performs scroll/jump actions
- handles toggle / rescan / search / filter UI locally

#### Floating Panel
- page-local UI (FAB + panel), never a browser-global side panel
- displays searchable message list
- renders filters
- jumps within the current page
- shows counts/status

#### Background / Service Worker
- toggles the floating panel via extension action click on ChatGPT tabs
- keeps logic minimal
- should not become a dumping ground for app logic

#### Shared Module
- message types
- message normalization helpers
- search utilities
- constants

---

## Data Model

Use a simple message record.

```ts
type ChatMessageRecord = {
  id: string;
  index: number;
  role: "user" | "assistant" | "unknown";
  preview: string;
  fullText: string;
  hasCode: boolean;
  domPathHint?: string;
};
```

Rules:

- id should be stable within a page session
- preview should be short and readable
- fullText is used for search
- avoid storing unnecessary DOM-heavy structures

## UI Requirements
Floating Panel MVP (ChatGPT-only)

Must include:

page-local FAB to open/close the panel
search input
filter toggles
message count
rescan button
scrollable result list
close control

Each item should show:

message index
role
short preview
optional badge for code

Interaction:

click item => jump to message
active message => visible highlight
search should feel instant on normal conversation sizes
panel must not appear on non-ChatGPT sites

## Robustness Requirements
1. Do not assume exact DOM class names remain unchanged forever.
2. Centralize selectors and DOM probing logic.
3. Add fallback extraction logic.
4. Support manual rescan.
5. If parsing fails, surface a compact diagnostic state in the floating panel.
6. Avoid extension crashes on partial extraction failures.

## Coding Standards
1. Prefer TypeScript
2. Keep modules small and single-purpose
3. Avoid framework bloat unless it clearly improves maintainability
4. Prefer plain DOM / lightweight UI unless React materially helps
5. No dead code
6. No giant files
7. Comment non-obvious logic only
8. Every selector assumption should be easy to find and update

## Testing Expectations

At minimum manually verify:

1. short conversation
2. very long conversation
3. conversation with many code blocks
4. conversation after page refresh
5. conversation after new messages stream in
6. search + jump after rescan
7. selector fallback behavior when some nodes are missing

> [!WARNING]
> Do NOT use the automated `browser` tool for ChatGPT testing. ChatGPT has anti-bot protections that block automated browser sessions, making it impossible to test the extension's behavior that way. Always rely on manual verification in a real Chrome browser.

## Definition of Done (MVP)

MVP is done only if:

extension loads successfully in Chrome
floating panel appears only on ChatGPT conversation pages
conversation messages can be indexed
clicking an item scrolls to the correct message
keyword search works
role filters work
code-message filter works
manual rescan works
no severe UI lag on long conversations

## Versioning

Semver-style `MAJOR.MINOR.PATCH`, but with project-specific bump rules:

| 变更类型 | 版本增量 | 示例 |
|---------|---------|------|
| 大版本（新功能、重要适配、行为面较大的变更） | `+0.1.0` | `1.0.1` → `1.1.0` |
| 小版本（bug fix、小改动、文档/测试） | `+0.0.1` | `1.0.0` → `1.0.1` |

Rules:
1. Keep `package.json` and `src/manifest.json` version in sync.
2. Every version bump must update `CHANGELOG.md` using `add` / `fix` entries (`change` optional).
3. ChatGPT DOM 适配：若仅为修复抓取/跳转失效 → `+0.0.1`；若引入新导航能力或大范围架构调整 → `+0.1.0`.

## Development Workflow

1. **Rebuild**: After making changes, run `bun run build` to recompile the project.
2. **Reload**: Go to `chrome://extensions/` and click the reload icon for the NavGPT extension.
3. **Refresh**: Refresh the ChatGPT page to apply changes.
4. **Release note**: Bump version per Versioning rules and append an `add`/`fix` section in `CHANGELOG.md`.

## Future Extensions (Post-MVP)

Only after MVP is stable:

favorites / pinned messages
collapse non-selected ranges
export outline as Markdown / JSON
auto title generation for each turn
current viewport tracking
keyboard shortcuts
support for other chat UIs

## Execution Guidance

When implementing:

prioritize end-to-end working flow over perfect abstraction
avoid overengineering
finish MVP first
document any selector assumptions clearly
leave hooks for future iteration, but do not build speculative infrastructure