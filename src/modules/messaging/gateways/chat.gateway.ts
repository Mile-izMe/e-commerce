import {
  UseFilters,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import type { IncomingMessage } from 'node:http';
import type { Namespace } from 'socket.io';
import { AccessTokenService } from '../../auth/service/access-token.service.js';
import { ChannelEventDto, SendMessageDto } from '../dto/messaging.dto.js';
import {
  ChatExceptionFilter,
  chatError,
} from '../filters/chat-exception.filter.js';
import { WsAuthGuard } from '../guards/ws-auth.guard.js';
import { MessagingService } from '../messaging.service.js';
import type { ChatSocket } from './chat-socket.js';
import { channelRoom } from './chat-socket.js';

const allowedOrigins = () =>
  (process.env.CHAT_ALLOWED_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

// Nest's default IoAdapter attaches to the existing HTTP server/port.
@WebSocketGateway({
  namespace: '/chat',
  maxHttpBufferSize: 32_768,
  cors: {
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow: boolean) => void,
    ) => callback(null, !origin || allowedOrigins().includes(origin)),
  },
  // CORS alone does not restrict WebSocket upgrades. Validate Origin too.
  allowRequest: (
    request: IncomingMessage,
    callback: (error: string | null, allow: boolean) => void,
  ) =>
    callback(
      null,
      !request.headers.origin ||
        allowedOrigins().includes(request.headers.origin),
    ),
})
@UseGuards(WsAuthGuard)
@UseFilters(ChatExceptionFilter)
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() private server!: Namespace;

  constructor(
    private readonly tokens: AccessTokenService,
    private readonly chat: MessagingService,
  ) {}

  afterInit(server: Namespace) {
    server.use((socket: ChatSocket, next) => {
      void this.authenticate(socket)
        .then(() => next())
        .catch((error: unknown) => {
          const rejected = new Error('Chat connection rejected') as Error & {
            data?: unknown;
          };
          rejected.data = chatError(error);
          next(rejected);
        });
    });
  }

  private async authenticate(socket: ChatSocket) {
    const token: unknown = socket.handshake.auth?.token;
    if (typeof token !== 'string' || !token || token.length > 4096) {
      throw new WsException({
        code: 'AUTH_INVALID',
        message: 'Access token required',
      });
    }
    const identity = await this.tokens.authenticate(token);
    socket.data.user = identity.user;
    socket.data.expiresAt = identity.expiresAt;
  }

  handleConnection(socket: ChatSocket) {
    const remaining = (socket.data.expiresAt ?? 0) - Date.now();
    if (remaining <= 0) {
      socket.disconnect(true);
      return;
    }
    socket.data.expiryTimer = setTimeout(
      () => {
        socket.emit('chat.error', {
          success: false,
          error: {
            code: 'AUTH_EXPIRED',
            message: 'Reconnect with a fresh access token',
          },
        });
        socket.disconnect(true);
      },
      Math.min(remaining, 2_147_483_647),
    );
    socket.data.expiryTimer.unref();
  }

  handleDisconnect(socket: ChatSocket) {
    clearTimeout(socket.data.expiryTimer);
  }

  @SubscribeMessage('channel.join')
  async join(
    @ConnectedSocket() socket: ChatSocket,
    @MessageBody() data: ChannelEventDto,
  ) {
    await this.chat.requireChannelAccess(data.channelId, socket.data.user!.id);
    await socket.join(channelRoom(data.channelId));
    return { success: true, data: { channelId: data.channelId } };
  }

  @SubscribeMessage('channel.leave')
  async leave(
    @ConnectedSocket() socket: ChatSocket,
    @MessageBody() data: ChannelEventDto,
  ) {
    await socket.leave(channelRoom(data.channelId));
    return { success: true, data: { channelId: data.channelId } };
  }

  @SubscribeMessage('message.send')
  async send(
    @ConnectedSocket() socket: ChatSocket,
    @MessageBody() data: SendMessageDto,
  ) {
    const now = Date.now();
    const window = socket.data.sendWindow;
    if (!window || now - window.startedAt >= 10_000)
      socket.data.sendWindow = { startedAt: now, count: 1 };
    else if (++window.count > 30)
      throw new WsException({
        code: 'RATE_LIMITED',
        message: 'Maximum 30 sends per 10 seconds per connection',
      });
    const result = await this.chat.sendMessage(socket.data.user!.id, data);
    // Persistence precedes delivery. Retrying an existing key returns the same message without rebroadcast.
    if (result.created)
      this.server
        .to(channelRoom(data.channelId))
        .emit('message.created', result.message);
    return { success: true, data: result.message };
  }

  @SubscribeMessage('typing.activity')
  async onTyping(
    @ConnectedSocket() socket: ChatSocket,
    @MessageBody() data: ChannelEventDto,
  ) {
    const currentUser = socket.data.user!.id;
    const currentUserName = socket.data.user!.name;
    const result = await this.chat.requireChannelAccess(
      data.channelId,
      currentUser,
    );
    const message = {
      userId: currentUser,
      userName: currentUserName,
      channelId: data.channelId,
      isTyping: true,
    };
    if (result)
      socket.to(channelRoom(data.channelId)).emit('typing.changed', message);
    return { success: true, data: message };
  }

  @SubscribeMessage('typing.stop')
  async stopTyping(
    @ConnectedSocket() socket: ChatSocket,
    @MessageBody() data: ChannelEventDto,
  ) {
    const currentUser = socket.data.user!.id;
    const currentUserName = socket.data.user!.name;
    const result = await this.chat.requireChannelAccess(
      data.channelId,
      currentUser,
    );
    const message = {
      userId: currentUser,
      userName: currentUserName,
      channelId: data.channelId,
      isTyping: false,
    };
    if (result)
      socket.to(channelRoom(data.channelId)).emit('typing.changed', message);
    return { success: true, data: message };
  }
}
