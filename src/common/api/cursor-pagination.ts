import { BadRequestException } from '@nestjs/common';

export class CursorPage<T> {
  constructor(
    readonly items: T[],
    readonly nextCursor: string | null,
    readonly hasMore: boolean,
    readonly limit: number,
  ) {}

  map<U>(transform: (item: T) => U): CursorPage<U> {
    return new CursorPage(
      this.items.map(transform),
      this.nextCursor,
      this.hasMore,
      this.limit,
    );
  }
}

export async function paginateCursor<T>(
  limit: number,
  load: (take: number) => Promise<T[]>,
  encodeLast: (item: T) => string,
): Promise<CursorPage<T>> {
  const rows = await load(limit + 1);
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit);
  return new CursorPage(
    items,
    hasMore ? encodeLast(items[items.length - 1]) : null,
    hasMore,
    limit,
  );
}

export function encodeCursor(value: object): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

export function decodeCursor(value: string): unknown {
  try {
    const raw = Buffer.from(value, 'base64url');
    if (raw.toString('base64url') !== value)
      throw new Error('Noncanonical cursor');
    return JSON.parse(raw.toString('utf8')) as unknown;
  } catch {
    throw new BadRequestException('Invalid cursor');
  }
}
