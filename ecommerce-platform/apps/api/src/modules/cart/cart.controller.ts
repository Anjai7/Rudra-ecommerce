import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CartService } from './cart.service';
import { Public } from '../../guards/jwt-auth.guard';

@ApiTags('cart')
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @Public()
  getCart(@Query('session_id') sessionId: string, @Req() req: any) {
    return this.cartService.getOrCreateCart(req.user?.id, sessionId);
  }

  @Post('items')
  @Public()
  addItem(
    @Query('cart_id') cartId: string,
    @Body() body: { variant_id: string; quantity: number },
  ) {
    return this.cartService.addItem(cartId, body.variant_id, body.quantity);
  }

  @Put('items/:itemId')
  @Public()
  updateItem(
    @Query('cart_id') cartId: string,
    @Param('itemId') itemId: string,
    @Body() body: { quantity: number },
  ) {
    return this.cartService.updateItem(cartId, itemId, body.quantity);
  }

  @Delete('items/:itemId')
  @Public()
  removeItem(@Query('cart_id') cartId: string, @Param('itemId') itemId: string) {
    return this.cartService.removeItem(cartId, itemId);
  }

  @Post('merge')
  @ApiBearerAuth()
  mergeCarts(@Body() body: { session_id: string }, @Req() req: any) {
    return this.cartService.mergeCarts(body.session_id, req.user.id);
  }
}
