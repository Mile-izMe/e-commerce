import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CursorPaginationQueryDto } from '../../../common/api/cursor-pagination.query.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateGuildDto {
  @ApiProperty({ example: 'Architecture Lab' })
  @Transform(trim)
  @IsString()
  @Length(1, 80)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class CreateChannelDto extends CreateGuildDto {}

export class AddGuildMemberDto {
  @ApiProperty()
  @IsUUID()
  userId!: string;
}

export class ChannelEventDto {
  @IsUUID()
  channelId!: string;
}

export class SendMessageDto extends ChannelEventDto {
  @IsUUID()
  clientMessageId!: string;

  @Transform(trim)
  @IsString()
  @Length(1, 2000)
  content!: string;
}

export class MessageHistoryQueryDto extends CursorPaginationQueryDto {}
