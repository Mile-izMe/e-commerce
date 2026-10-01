import type { Socket } from 'socket.io';
import type { UserProfile } from '../../users/entities/user.js';

export interface ChatSocket extends Socket {
  data: {
    user?: UserProfile;
    expiresAt?: number;
    expiryTimer?: ReturnType<typeof setTimeout>;
    sendWindow?: { startedAt: number; count: number };
  };
}

export const channelRoom = (channelId: string) => `channel:${channelId}`;
