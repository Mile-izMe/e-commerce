import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import {
  decodeCursor,
  encodeCursor,
  paginateCursor,
} from '../../common/api/cursor-pagination.js';
import { UsersService } from '../users/user.service.js';
import type {
  AddGuildMemberDto,
  CreateChannelDto,
  CreateGuildDto,
  MessageHistoryQueryDto,
  SendMessageDto,
} from './dto/messaging.dto.js';
import type { MessageCursor } from './entities/chat.js';
import { MessagingRepository } from './messaging.repository.js';

@Injectable()
export class MessagingService {
  constructor(
    private readonly repo: MessagingRepository,
    private readonly users: UsersService,
  ) {}

  createGuild(userId: string, data: CreateGuildDto) {
    return this.repo.createGuild(userId, data);
  }
  listGuilds(userId: string) {
    return this.repo.listGuilds(userId);
  }

  private async requireOwner(guildId: string, userId: string) {
    const guild = await this.repo.findGuild(guildId);
    if (!guild) throw new NotFoundException('Guild not found');
    if (guild.ownerId !== userId)
      throw new ForbiddenException(
        'Only the guild owner can perform this action',
      );
    return guild;
  }

  private async requireMember(guildId: string, userId: string) {
    if (!(await this.repo.findMember(guildId, userId)))
      throw new ForbiddenException('Guild membership required');
  }

  async addMember(guildId: string, userId: string, data: AddGuildMemberDto) {
    await this.requireOwner(guildId, userId);
    if (!(await this.users.getActiveProfile(data.userId)))
      throw new NotFoundException('Active user not found');
    return this.repo.addMember(guildId, data.userId);
  }

  async createChannel(guildId: string, userId: string, data: CreateChannelDto) {
    await this.requireOwner(guildId, userId);
    return this.repo.createChannel(guildId, data);
  }

  async listChannels(guildId: string, userId: string) {
    await this.requireMember(guildId, userId);
    return this.repo.listChannels(guildId);
  }

  async requireChannelAccess(channelId: string, userId: string) {
    const channel = await this.repo.findChannel(channelId);
    if (!channel) throw new NotFoundException('Channel not found');
    await this.requireMember(channel.guildId, userId);
    return channel;
  }

  async sendMessage(userId: string, data: SendMessageDto) {
    await this.requireChannelAccess(data.channelId, userId);
    return this.repo.saveMessage(userId, data);
  }

  async history(
    channelId: string,
    userId: string,
    query: MessageHistoryQueryDto,
  ) {
    await this.requireChannelAccess(channelId, userId);
    let cursor: MessageCursor | undefined;
    if (query.cursor) {
      const value = decodeCursor(query.cursor) as Partial<MessageCursor> | null;
      if (
        typeof value !== 'object' ||
        !value ||
        value.v !== 1 ||
        value.channelId !== channelId ||
        typeof value.id !== 'string' ||
        !isUUID(value.id) ||
        typeof value.createdAt !== 'string' ||
        Number.isNaN(Date.parse(value.createdAt))
      )
        throw new BadRequestException('Invalid message cursor');
      cursor = value as MessageCursor;
    }
    return paginateCursor(
      query.limit,
      (take) => this.repo.history(channelId, take, cursor),
      (message) =>
        encodeCursor({
          v: 1,
          channelId,
          createdAt: message.createdAt,
          id: message.id,
        } satisfies MessageCursor),
    );
  }
}
