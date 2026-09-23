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
  ApiBearerAuth,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CartService } from './cart.service.js';
import { AddToCartDto } from './dto/add-to-cart.dto.js';
import { UpdateCartItemDto } from './dto/update-cart-item.dto.js';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import type { AuthenticatedRequest } from '../auth/guards/auth.guard.js';
import { CartResponseDto } from './dto/cart-response.dto.js';

@ApiTags('Cart')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: 'Requires a valid bearer access token',
})
@UseGuards(AuthGuard)
@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  @ApiOkResponse({ type: CartResponseDto })
  @ApiOperation({ summary: 'Get the current user cart' })
  getCart(@Req() request: AuthenticatedRequest): Promise<CartResponseDto> {
    return this.cart.getCart(request.user.id);
  }

  @Post('items')
  @ApiOkResponse({ type: CartResponseDto })
  @HttpCode(200)
  @ApiOperation({
    summary: 'Add quantity to a variant in the current user cart',
  })
  addToCart(
    @Req() request: AuthenticatedRequest,
    @Body() dto: AddToCartDto,
  ): Promise<CartResponseDto> {
    return this.cart.addToCart(request.user.id, dto);
  }

  @Patch('items/:itemId')
  @ApiOkResponse({ type: CartResponseDto })
  @ApiOperation({ summary: 'Set the absolute quantity of a cart item' })
  updateItem(
    @Req() request: AuthenticatedRequest,
    @Param('itemId', new ParseUUIDPipe()) itemId: string,
    @Body() dto: UpdateCartItemDto,
  ): Promise<CartResponseDto> {
    return this.cart.updateItem(request.user.id, itemId, dto);
  }

  @Delete('items/:itemId')
  @ApiOkResponse({ type: CartResponseDto })
  @ApiOperation({ summary: 'Remove an item from the current user cart' })
  removeItem(
    @Req() request: AuthenticatedRequest,
    @Param('itemId', new ParseUUIDPipe()) itemId: string,
  ): Promise<CartResponseDto> {
    return this.cart.removeItem(request.user.id, itemId);
  }

  @Delete('items')
  @ApiOkResponse({ type: CartResponseDto })
  @ApiOperation({ summary: 'Clear the current user cart' })
  clearCart(@Req() request: AuthenticatedRequest): Promise<CartResponseDto> {
    return this.cart.clearCart(request.user.id);
  }
}
