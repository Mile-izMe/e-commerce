export interface ChatMessage {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  clientMessageId: string;
  name?: string | null;
  createdAt: string;
}

export interface MessageCursor {
  v: 1;
  channelId: string;
  createdAt: string;
  id: string;
}
