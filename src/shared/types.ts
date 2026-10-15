export type ChatMessageRecord = {
  id: string;
  index: number;
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
    }
  | {
      type: "RESCAN_REQUEST";
    }
  | {
      type: "TOGGLE_PANEL";
    };
