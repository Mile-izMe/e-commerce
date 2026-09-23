import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';
import { MAX_CART_ITEM_QUANTITY } from '../cart.constants.js';

export class UpdateCartItemDto {
  @ApiProperty({ example: 3, minimum: 1, maximum: MAX_CART_ITEM_QUANTITY })
  @IsInt()
  @Min(1)
  @Max(MAX_CART_ITEM_QUANTITY)
  quantity!: number;
}
