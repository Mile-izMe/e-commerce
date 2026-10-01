import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import type { AuthenticatedRequest } from '../auth/guards/auth.guard.js';
import {
  AddGuildMemberDto,
  CreateChannelDto,
  CreateGuildDto,
  MessageHistoryQueryDto,
} from './dto/messaging.dto.js';
import { MessagingService } from './messaging.service.js';

@ApiTags('Messaging')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('chat')
export class MessagingController {
  constructor(private readonly chat: MessagingService) {}

  @Post('guilds')
  @ApiOperation({ summary: 'Create a guild and owner membership' })
  createGuild(@Req() req: AuthenticatedRequest, @Body() data: CreateGuildDto) {
    return this.chat.createGuild(req.user.id, data);
  }

  @Get('guilds')
  @ApiOperation({ summary: 'List guilds the current user belongs to' })
  listGuilds(@Req() req: AuthenticatedRequest) {
    return this.chat.listGuilds(req.user.id);
  }

  @Post('guilds/:guildId/members')
  @ApiOperation({ summary: 'Owner adds an existing active user to a guild' })
  addMember(
    @Param('guildId', ParseUUIDPipe) guildId: string,
    @Req() req: AuthenticatedRequest,
    @Body() data: AddGuildMemberDto,
  ) {
    return this.chat.addMember(guildId, req.user.id, data);
  }

  @Post('guilds/:guildId/channels')
  @ApiOperation({ summary: 'Owner creates a text channel' })
  createChannel(
    @Param('guildId', ParseUUIDPipe) guildId: string,
    @Req() req: AuthenticatedRequest,
    @Body() data: CreateChannelDto,
  ) {
    return this.chat.createChannel(guildId, req.user.id, data);
  }

  @Get('guilds/:guildId/channels')
  @ApiOperation({ summary: 'List channels for a guild member' })
  listChannels(
    @Param('guildId', ParseUUIDPipe) guildId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.chat.listChannels(guildId, req.user.id);
  }

  @Get('channels/:channelId/messages')
  @ApiOperation({
    summary: 'Get message history, newest first, using a cursor',
  })
  history(
    @Param('channelId', ParseUUIDPipe) channelId: string,
    @Req() req: AuthenticatedRequest,
    @Query() query: MessageHistoryQueryDto,
  ) {
    return this.chat.history(channelId, req.user.id, query);
  }
}
