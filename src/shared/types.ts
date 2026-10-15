export type ChatMessageRecord = {
  id: string;
  index: number;
  /** 0-based position in the extracted list (for jump fallback) */
  listIndex?: number;
  role: "user" | "assistant" | "unknown";
  preview: string;
  fullText: string;
  hasCode: boolean;
  isStarred?: boolean;
  url: string;
  conversationId: string;
  conversationTitle: string;
  starredAt?: number;
  /** Stable DOM message id (data-dil-message-id / data-turn-key / legacy data-message-id) */
  domMessageId?: string;
  /** data-content-search-unit-key for precise unit targeting */
  domUnitKey?: string;
};

export type MessagePayload =
  | {
      type: "MESSAGES_EXTRACTED";
      messages: ChatMessageRecord[];
    }
  | {
      type: "JUMP_TO_MESSAGE";
      messageId: string;
      domMessageId?: string;
      domUnitKey?: string;
      role?: ChatMessageRecord["role"];
      listIndex?: number;
    }
  | {
      type: "RESCAN_REQUEST";
    }
  | {
      type: "TOGGLE_PANEL";
    };
