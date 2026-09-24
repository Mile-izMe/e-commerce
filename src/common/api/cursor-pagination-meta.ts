import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CursorPaginationMeta {
  @ApiPropertyOptional({ type: String, nullable: true })
  readonly nextCursor: string | null;

  @ApiProperty()
  readonly hasMore: boolean;

  @ApiProperty({ example: 20 })
  readonly limit: number;

  constructor(body: CursorPaginationMeta) {
    this.nextCursor = body.nextCursor;
    this.hasMore = body.hasMore;
    this.limit = body.limit;
  }
}
