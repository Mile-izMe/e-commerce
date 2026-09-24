import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CursorPaginationMeta } from './cursor-pagination-meta.js';
import { CursorPage } from './cursor-pagination.js';

export class ApiSuccessResponse<T> {
  @ApiProperty({ example: true })
  readonly success = true;

  @ApiProperty({ example: 'Success' })
  readonly message: string;

  @ApiProperty()
  readonly data: T;

  @ApiProperty({ example: '2026-09-24T08:00:00.000Z' })
  readonly timestamp: string;

  @ApiPropertyOptional({ type: CursorPaginationMeta })
  readonly meta?: CursorPaginationMeta;

  constructor(body: { message: string; data: T; meta?: CursorPaginationMeta }) {
    this.message = body.message;
    this.data = body.data;
    this.timestamp = new Date().toISOString();
    this.meta = body.meta;
  }

  static ofCursorPage<T>(
    page: CursorPage<T>,
    message: string,
  ): ApiSuccessResponse<T[]> {
    return new ApiSuccessResponse({
      message,
      data: page.items,
      meta: new CursorPaginationMeta({
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
        limit: page.limit,
      }),
    });
  }
}
