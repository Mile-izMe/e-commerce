import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { DATABASE } from '../../infrastructure/database/database.constants.js';
import type { DatabaseClient } from '../../prisma/db.js';
import type {
  CreateChannelDto,
  CreateGuildDto,
  SendMessageDto,
} from './dto/messaging.dto.js';
import type { ChatMessage, MessageCursor } from './entities/chat.js';
import { toChatMessage } from './entities/to-chat-mesage.js';

@Injectable()
export class MessagingRepository {
  constructor(@Inject(DATABASE) private readonly db: DatabaseClient) {}

  createGuild(ownerId: string, data: CreateGuildDto) {
    return this.db.transaction(async (tx) => {
      const guild = await tx.orm.public.Guild.create({ ...data, ownerId });
      await tx.orm.public.GuildMember.create({
        userId: ownerId,
        guildId: guild.id,
      });
      return guild;
    });
  }

  listGuilds(userId: string) {
    return this.db.orm.public.Guild.where((guild) =>
      guild.members.some((member) => member.userId.eq(userId)),
    )
      .orderBy((guild) => guild.createdAt.asc())
      .all();
  }

  findGuild(id: string) {
    return this.db.orm.public.Guild.where({ id }).first();
  }
  findMember(guildId: string, userId: string) {
    return this.db.orm.public.GuildMember.where({ guildId, userId }).first();
  }
  findChannel(id: string) {
    return this.db.orm.public.Channel.where({ id }).first();
  }

  async addMember(guildId: string, userId: string) {
    try {
      return await this.db.orm.public.GuildMember.create({ guildId, userId });
    } catch (error) {
      const existing = await this.findMember(guildId, userId);
      if (existing) return existing;
      throw error;
    }
  }

  async createChannel(guildId: string, data: CreateChannelDto) {
    try {
      return await this.db.orm.public.Channel.create({ ...data, guildId });
    } catch (error) {
      if (
        await this.db.orm.public.Channel.where({
          guildId,
          name: data.name,
        }).first()
      ) {
        throw new ConflictException(
          'Channel name already exists in this guild',
        );
      }
      throw error;
    }
  }

  listChannels(guildId: string) {
    return this.db.orm.public.Channel.where({ guildId })
      .orderBy((channel) => channel.createdAt.asc())
      .all();
  }

  async saveMessage(
    author: { id: string; name: string | null },
    data: SendMessageDto,
  ): Promise<{ message: ChatMessage; created: boolean }> {
    // The database unique constraint handles both sequential and concurrent retries.
    try {
      const row = await this.db.orm.public.Message.create({
        ...data,
        authorId: author.id,
      });
      return { message: toChatMessage(row, author.name), created: true };
    } catch (error) {
      const existing = await this.db.orm.public.Message.where({
        authorId: author.id,
        clientMessageId: data.clientMessageId,
      }).first();
      if (!existing) throw error;
      if (
        existing.channelId !== data.channelId ||
        existing.content !== data.content
      ) {
        throw new ConflictException(
          'clientMessageId was already used with a different payload',
        );
      }
      return { message: toChatMessage(existing, author.name), created: false };
    }
  }

  async history(
    channelId: string,
    take: number,
    before?: MessageCursor,
  ): Promise<ChatMessage[]> {
    const query = this.db.orm.public.Message.where({ channelId })
      .include('author')
      .orderBy([
        (message) => message.createdAt.desc(),
        (message) => message.id.desc(),
      ]);
    const rows = before
      ? query
          .cursor({ createdAt: before.createdAt, id: before.id })
          .limit(take)
          .all()
      : query.limit(take).all();

    return (await rows).map((row) => toChatMessage(row, row.author.name));
  }
}
