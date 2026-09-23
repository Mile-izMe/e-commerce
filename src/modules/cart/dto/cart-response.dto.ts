import { ApiProperty } from '@nestjs/swagger';

export class CartItemResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  variantId!: string;

  @ApiProperty()
  productName!: string;

  @ApiProperty()
  variantName!: string;

  @ApiProperty({ type: String, nullable: true })
  imageUrl!: string | null;

  @ApiProperty({ example: 2 })
  quantity!: number;

  @ApiProperty({
    example: '199000',
    description:
      'Current unit price in minor currency units, encoded as a string',
  })
  unitPriceAmount!: string;

  @ApiProperty({
    example: '398000',
    description: 'Unit price multiplied by quantity, encoded as a string',
  })
  lineTotalAmount!: string;

  @ApiProperty({ example: 'VND' })
  currency!: string;

  @ApiProperty({ example: 10 })
  availableQuantity!: number;

  @ApiProperty({
    description:
      'Whether the product is saleable and stock currently covers the selected quantity',
  })
  purchasable!: boolean;
}

export class CartResponseDto {
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  id!: string | null;

  @ApiProperty({
    example: 1,
    description: 'Increments when cart contents change',
  })
  version!: number;

  @ApiProperty({ example: 2 })
  totalQuantity!: number;

  @ApiProperty({ type: () => [CartItemResponseDto] })
  items!: CartItemResponseDto[];
}
