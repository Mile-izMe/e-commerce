import { ChatMessage } from './chat.js';

type MessageRow = {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  clientMessageId: string;
  createdAt: string;
};

export function toChatMessage(
  row: MessageRow,
  name: string | null,
): ChatMessage {
  return {
    id: row.id,
    channelId: row.channelId,
    authorId: row.authorId,
    content: row.content,
    clientMessageId: row.clientMessageId,
    createdAt: row.createdAt,
    name,
  };
}
