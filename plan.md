# plan.md

## Project
ChatGPT Conversation Navigator (Chrome Extension)

## Objective
Build a Chrome extension MVP that provides fast navigation for long ChatGPT web conversations through a side panel.

---

## Phase 0 — Success Criteria

Before coding, align on MVP success criteria:

The extension is considered successful if a user can:
1. open ChatGPT web
2. open the extension side panel
3. see a generated message list for the current conversation
4. search messages by keyword
5. filter messages by type
6. click any item and jump to that message

Non-goals for MVP:
- AI summarization
- cloud sync
- export workflows
- support for multiple websites

---

## Phase 1 — Project Setup

### Tasks
1. Initialize Chrome Extension project using Manifest V3
2. Create base folders:
   - `src/background`
   - `src/content`
   - `src/sidepanel`
   - `src/shared`
3. Add build tooling
   - recommended: TypeScript + Vite or another minimal bundler
4. Configure extension manifest
5. Set up side panel entry
6. Set up content script injection on ChatGPT domains

### Deliverables
- runnable extension skeleton
- side panel opens successfully
- content script loads on ChatGPT pages

### Notes
- Keep permissions minimal.
- Do not add broad permissions unless required.

---

## Phase 2 — Message Extraction MVP

### Goal
Extract conversation messages from current ChatGPT page into a normalized array.

### Tasks
1. Inspect current ChatGPT conversation DOM
2. Identify stable-enough message containers
3. Implement extraction function:
   - detect message blocks
   - infer role: `user` / `assistant` / `unknown`
   - extract full text
   - create short preview
   - detect whether message contains code block
4. Generate local stable IDs for current page session
5. Return normalized records

### Output Shape
```ts
type ChatMessageRecord = {
  id: string;
  index: number;
  role: "user" | "assistant" | "unknown";
  preview: string;
  fullText: string;
  hasCode: boolean;
};
```

### Deliverables
- extraction utility working on current ChatGPT page
- console-verifiable output
- sample long-chat test run

### Risks
- DOM structure may vary
- some messages may be partially rendered
- lazy loading may hide older messages

### Mitigation
- centralize selectors
- use fallback extraction logic
- support manual rescan later

---

## Phase 3 — Side Panel UI MVP

### Goal
Render extracted messages in a usable side panel.

### Tasks
1. Build side panel layout:
   - header
   - status line
   - search box
   - filter controls
   - result list
2. Request message data from content script
3. Render each item with:
   - message index
   - role
   - preview
   - code badge if needed
4. Add empty/error states

### Deliverables
- side panel shows extracted messages
- user can visually scan long conversation quickly

### UX Requirements
- list should be compact
- previews should be readable
- scrolling should remain smooth
- no excessive UI chrome

---

## Phase 4 — Jump Navigation

### Goal
Clicking a side panel item scrolls to the corresponding message in page.

### Tasks
1. Add content-script jump handler
2. Map message record ID to DOM node
3. Scroll target message into view
4. Add temporary visual highlight on jumped-to message
5. Handle re-scan mismatch gracefully

### Deliverables
- click => jump works reliably in common cases
- target message becomes visually obvious

### Edge Cases
- DOM updated after indexing
- target no longer exists
- target shifted due to lazy render

### Fallback Behavior
If target cannot be found:
1. trigger rescan
2. notify side panel to refresh list

---

## Phase 5 — Search and Filters

### Goal
Allow fast local filtering without rescanning page every keystroke.

### Filters
- all
- user
- assistant
- has code

### Tasks
1. Implement in-memory search over extracted records
2. Add case-insensitive keyword matching
3. Add filter toggles
4. Combine filters with search
5. Show result counts

### Deliverables
- instant local search
- useful filtered navigation for long chats

### Notes
- Keep search simple for MVP.
- Do not build a heavy indexing engine unless performance proves insufficient.

---

## Phase 6 — Rescan and DOM Change Resilience

### Goal
Make extension recoverable when ChatGPT DOM changes during active usage.

### Tasks
1. Add manual rescan button
2. Rebuild message list on rescan
3. Optionally add lightweight mutation observer
4. Prevent duplicate records after rescan
5. Add parsing status indicator

### Deliverables
- extension can recover after new messages appear
- side panel data can be refreshed without reloading tab

### Notes
- Mutation observer should be conservative.
- Avoid overly chatty rescans.

---

## Phase 7 — QA and Hardening

### Manual Test Matrix

#### Functional
- side panel opens
- messages are extracted
- search works
- filters work
- jump works
- rescan works

#### Content Diversity
- plain text conversation
- code-heavy conversation
- long conversation
- mixed Chinese/English conversation
- markdown-heavy conversation

#### Stability
- page refresh
- new assistant reply appears
- jump after new messages
- rescan after partial page changes
- missing or malformed DOM nodes

### Bug Types to Watch
- wrong message-role classification
- duplicate messages
- empty previews
- jump to wrong block
- stale IDs after rescan
- major lag on large conversations

### Deliverables
- QA checklist completed
- main selector assumptions documented
- known limitations documented

---

## Recommended File Structure
```
chatgpt-conversation-navigator/
  manifest.json
  package.json
  src/
    background/
      index.ts
    content/
      index.ts
      extract.ts
      jump.ts
      selectors.ts
    sidepanel/
      index.html
      index.ts
      ui.ts
      styles.css
    shared/
      types.ts
      constants.ts
      search.ts
```

---

## Technical Decisions

### 1. Use TypeScript
- **Reason:**
  - better maintainability
  - safer refactors
  - clearer shared types between modules

### 2. Keep business logic out of background script
- **Reason:**
  - content script and side panel are the real core
  - background should remain thin

### 3. Keep selectors centralized
- **Reason:**
  - ChatGPT DOM changes are the highest maintenance risk

### 4. Prefer simple in-memory search
- **Reason:**
  - MVP complexity should stay low
  - typical usage volume is manageable

---

## Milestone Breakdown

### Milestone A — Skeleton
- Extension skeleton running
- manifest valid
- side panel visible
- content script injected

### Milestone B — Extraction
- Message extraction working
- records visible in console
- role and preview populated

### Milestone C — UI
- Side panel list working
- extracted messages visible in UI

### Milestone D — Navigation
- Jump navigation working
- click list item scrolls to message

### Milestone E — Search
- Search and filters working
- user can narrow list instantly

### Milestone F — Rescan & QA
- Rescan and QA
- extension usable for real long chats

---

## Definition of Done

The MVP is done when:
- a user can install the unpacked extension
- open ChatGPT conversation page
- open side panel
- browse extracted message list
- search by keyword
- filter by role / code presence
- click an entry and jump to that message
- rescan after page changes
- use the extension on long chats without obvious lag or breakage

---

## Future Iteration Backlog

Only after MVP is stable:
- favorites / bookmarks
- current viewport sync
- export outline to Markdown
- keyboard navigation
- fold/unfold ranges
- auto-generated section titles
- conversation statistics
- support for other chat websites

---

## Implementation Priority Order

**Strict order:**
1. extension skeleton
2. message extraction
3. side panel rendering
4. jump navigation
5. search/filter
6. rescan
7. QA hardening

> [!IMPORTANT]
> Do not start advanced features before the above sequence is working end-to-end.

---

## Final Instruction for Implementation Agent

Build the smallest working end-to-end version first.

- Do not overengineer.
- Do not add backend.
- Do not add AI features in MVP.
- Do not optimize prematurely.

### Primary requirement:
Make long ChatGPT conversations navigable quickly and reliably.