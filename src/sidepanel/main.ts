import { MessagePayload, ChatMessageRecord } from "../shared/types";

console.log("NavGPT Sidepanel script loaded.");

let allMessages: ChatMessageRecord[] = [];
let globalStarredMessages: ChatMessageRecord[] = [];
let starredMessageIds: Set<string> = new Set();
let currentFilter: string = "all";
let searchQuery: string = "";
let currentConversationId: string = "";

const statusElement = document.getElementById("status");
const messageListElement = document.getElementById("message-list");
const emptyStateElement = document.getElementById("empty-state");
const searchInput = document.getElementById("search-input") as HTMLInputElement;
const rescanBtn = document.getElementById("rescan-btn");
const filterBtns = document.querySelectorAll(".filter-btn");

// Initial load of global stars
function loadGlobalStars() {
  chrome.storage.local.get(["global_stars"], (result) => {
    globalStarredMessages = (result.global_stars as ChatMessageRecord[]) || [];
    starredMessageIds = new Set(globalStarredMessages.map(m => m.id));
    console.log(`NavGPT: Loaded ${globalStarredMessages.length} global stars.`);
    applyFiltersAndRender();
  });
}

loadGlobalStars();

// Initial scan - Do this immediately!
requestRescan();

// Update current conversation ID based on URL
function updateContextFromUrl(url: string) {
  const match = url.match(/\/c\/([a-zA-Z0-9-]+)/);
  const newId = match ? match[1] : "default";

  if (newId !== currentConversationId) {
    console.log("NavGPT: Conversation changed to", newId);
    currentConversationId = newId;
    // We don't need to load stars per ID anymore as they are global
    applyFiltersAndRender();
  }
}

// Initial context setup
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs[0]?.url) {
    updateContextFromUrl(tabs[0].url);
  }
});

// Listen for tab updates (URL changes in SPA)
chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (tab.active && changeInfo.url) {
    updateContextFromUrl(changeInfo.url);
  }
});

// Event Listeners
rescanBtn?.addEventListener("click", () => {
  console.log("NavGPT: Manual rescan requested");
  requestRescan();
});

searchInput?.addEventListener("input", (e) => {
  searchQuery = (e.target as HTMLInputElement).value.toLowerCase();
  applyFiltersAndRender();
});

filterBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    filterBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentFilter = btn.getAttribute("data-filter") || "all";
    applyFiltersAndRender();
  });
});

function requestRescan() {
  if (statusElement) statusElement.textContent = "Scanning...";
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    if (activeTab?.id) {
      chrome.tabs.sendMessage(activeTab.id, { type: "RESCAN_REQUEST" } as MessagePayload);
    } else {
      if (statusElement) statusElement.textContent = "Please open ChatGPT.";
    }
  });
}

chrome.runtime.onMessage.addListener((message: MessagePayload) => {
  if (message.type === "MESSAGES_EXTRACTED") {
    allMessages = message.messages;
    applyFiltersAndRender();
  }
});

function toggleStar(messageId: string) {
  console.log("NavGPT: Toggling global star for", messageId);
  const existingIndex = globalStarredMessages.findIndex(m => m.id === messageId);
  
  if (existingIndex > -1) {
    globalStarredMessages.splice(existingIndex, 1);
  } else {
    // Find the message in the current list to save its full record
    const msg = allMessages.find(m => m.id === messageId);
    if (msg) {
      globalStarredMessages.push({
        ...msg,
        starredAt: Date.now()
      });
    }
  }

  starredMessageIds = new Set(globalStarredMessages.map(m => m.id));

  // Save to global storage
  chrome.storage.local.set({ global_stars: globalStarredMessages }, () => {
    if (chrome.runtime.lastError) {
      console.error("NavGPT: Error saving stars:", chrome.runtime.lastError);
    } else {
      console.log(`NavGPT: Global stars updated. Total: ${globalStarredMessages.length}`);
    }
  });

  applyFiltersAndRender();
}

function applyFiltersAndRender() {
  // Sync star status of current chat messages with global star set
  allMessages = allMessages.map(msg => ({
    ...msg,
    isStarred: starredMessageIds.has(msg.id)
  }));

  let filtered: ChatMessageRecord[] = [];

  if (currentFilter === "starred") {
    // Special case: "starred" filter shows ALL global stars, not just from current chat
    filtered = [...globalStarredMessages];
  } else {
    filtered = [...allMessages];
    
    // Apply role/type filter
    if (currentFilter !== "all") {
      if (currentFilter === "hasCode") {
        filtered = filtered.filter((m) => m.hasCode);
      } else {
        filtered = filtered.filter((m) => m.role === currentFilter);
      }
    }
  }

  // Filter by search query
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter((m) => 
      m.fullText.toLowerCase().includes(query) || 
      m.preview.toLowerCase().includes(query) ||
      m.conversationTitle.toLowerCase().includes(query)
    );
  }

  // Sort messages to show newest first
  if (currentFilter === 'starred') {
    // Sort global stars by the time they were starred (newest first)
    filtered.sort((a, b) => (b.starredAt || 0) - (a.starredAt || 0));
  } else {
    // Sort chat messages by their sequential index (newest first)
    // We use a high-confidence sort by index
    filtered.sort((a, b) => b.index - a.index);
  }

  // Force one last verification check on the console
  const logPrefix = `NavGPT Debug [${currentFilter}]: `;
  if (filtered.length > 0) {
    console.log(`${logPrefix} First item index is ${filtered[0].index}, Last item index is ${filtered[filtered.length - 1].index}`);
  }

  if (statusElement) {
    statusElement.textContent = `${filtered.length} of ${currentFilter === 'starred' ? globalStarredMessages.length : allMessages.length} messages.`;
  }

  renderMessages(filtered);
}

function renderMessages(messages: ChatMessageRecord[]) {
  if (!messageListElement || !emptyStateElement) return;
  
  messageListElement.innerHTML = "";
  
  if (messages.length === 0) {
    emptyStateElement.style.display = "flex";
    return;
  }
  
  emptyStateElement.style.display = "none";

  messages.forEach((msg) => {
    const li = document.createElement("li");
    li.className = "message-item";
    
    const roleClass = msg.role === "user" ? "role-user" : "role-assistant";
    const roleLabel = msg.role === "assistant" ? "AI" : "User";
    const starActive = msg.isStarred ? "active" : "";

    li.innerHTML = `
      ${currentFilter === "starred" ? `<div class="conv-title-badge">${msg.conversationTitle}</div>` : ""}
      <div class="message-header">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="role-badge ${roleClass}">${roleLabel}</span>
          <span class="index-num">#${msg.index}</span>
        </div>
        <button class="star-btn ${starActive}" data-id="${msg.id}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="${msg.isStarred || starredMessageIds.has(msg.id) ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
          </svg>
        </button>
      </div>
      <div class="preview-text">${msg.preview}</div>
      ${msg.hasCode ? '<div class="code-indicator"><span>{ }</span>&nbsp;Contains code</div>' : ""}
    `;

    // Click to scroll
    li.onclick = (e) => {
      // Don't jump if clicking the star button
      if ((e.target as HTMLElement).closest(".star-btn")) return;

      document.querySelectorAll(".message-item").forEach(item => item.classList.remove("active"));
      li.classList.add("active");

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        if (activeTab?.id) {
          const currentUrl = activeTab.url || "";
          
          if (msg.url && msg.url !== currentUrl) {
            console.log("NavGPT: Target message is in a different conversation. Navigating...", msg.url);
            
            // Save pending jump
            chrome.storage.local.set({
              pendingJump: { url: msg.url, messageId: msg.id, domMessageId: msg.domMessageId }
            }, () => {
              chrome.tabs.update(activeTab.id!, { url: msg.url });
              // Side panel will stay open and the content script on the new page will pick up the pending jump.
            });
          } else {
            // Already on the right page, just jump
            chrome.tabs.sendMessage(activeTab.id, {
              type: "JUMP_TO_MESSAGE",
              messageId: msg.id,
              domMessageId: msg.domMessageId,
            } as MessagePayload);
          }
        }
      });
    };

    // Toggle star
    li.querySelector(".star-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleStar(msg.id);
    });
    
    messageListElement.appendChild(li);
  });
}
