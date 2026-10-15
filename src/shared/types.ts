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
  /** Stable DOM attribute: data-message-id on the .text-message element */
  domMessageId?: string;
};

export type MessagePayload = {
  type: "MESSAGES_EXTRACTED";
  messages: ChatMessageRecord[];
} | {
  type: "JUMP_TO_MESSAGE";
  messageId: string;
  /** Stable DOM attribute for precise element targeting */
  domMessageId?: string;
} | {
  type: "RESCAN_REQUEST";
};
