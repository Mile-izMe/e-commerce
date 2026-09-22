import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

function integerQuery(value: unknown): unknown {
  // Reject arrays, decimals and scientific notation instead of truncating them.
  return typeof value === 'string' && /^\d+$/.test(value)
    ? Number(value)
    : value;
}

export class ListProductsQueryDto {
  @Transform(({ value }: { value: unknown }) => integerQuery(value))
  @IsInt()
  @Min(1)
  @Max(10_000)
  page = 1;

  @Transform(({ value }: { value: unknown }) => integerQuery(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  category?: string;
}
