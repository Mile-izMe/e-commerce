import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CartService } from './cart.service.js';
import { AddToCartDto } from './dto/add-to-cart.dto.js';
import { UpdateCartItemDto } from './dto/update-cart-item.dto.js';
import { CartUserGuard } from './auth/cart-user.guard.js';
import type { AuthenticatedCartRequest } from './auth/cart-user.guard.js';
import { CartResponseDto } from './dto/cart-response.dto.js';

@ApiTags('Cart')
@ApiUnauthorizedResponse({
  description: 'Requires identity established by authentication middleware',
})
@UseGuards(CartUserGuard)
@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  @ApiOkResponse({ type: CartResponseDto })
  @ApiOperation({ summary: 'Get the current user cart' })
  getCart(@Req() request: AuthenticatedCartRequest): Promise<CartResponseDto> {
    return this.cart.getCart(request.user.id);
  }

  @Post('items')
  @ApiOkResponse({ type: CartResponseDto })
  @HttpCode(200)
  @ApiOperation({
    summary: 'Add quantity to a variant in the current user cart',
  })
  addToCart(
    @Req() request: AuthenticatedCartRequest,
    @Body() dto: AddToCartDto,
  ): Promise<CartResponseDto> {
    return this.cart.addToCart(request.user.id, dto);
  }

  @Patch('items/:itemId')
  @ApiOkResponse({ type: CartResponseDto })
  @ApiOperation({ summary: 'Set the absolute quantity of a cart item' })
  updateItem(
    @Req() request: AuthenticatedCartRequest,
    @Param('itemId', new ParseUUIDPipe()) itemId: string,
    @Body() dto: UpdateCartItemDto,
  ): Promise<CartResponseDto> {
    return this.cart.updateItem(request.user.id, itemId, dto);
  }

  @Delete('items/:itemId')
  @ApiOkResponse({ type: CartResponseDto })
  @ApiOperation({ summary: 'Remove an item from the current user cart' })
  removeItem(
    @Req() request: AuthenticatedCartRequest,
    @Param('itemId', new ParseUUIDPipe()) itemId: string,
  ): Promise<CartResponseDto> {
    return this.cart.removeItem(request.user.id, itemId);
  }

  @Delete('items')
  @ApiOkResponse({ type: CartResponseDto })
  @ApiOperation({ summary: 'Clear the current user cart' })
  clearCart(
    @Req() request: AuthenticatedCartRequest,
  ): Promise<CartResponseDto> {
    return this.cart.clearCart(request.user.id);
  }
}
