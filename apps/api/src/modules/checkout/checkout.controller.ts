import { Controller, Post, Body, Req, Headers, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CheckoutService } from './checkout.service';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import type { CreateCheckoutDto } from '@ecommerce/shared-types';

@ApiTags('checkout')
@ApiBearerAuth()
@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async createCheckout(
    @Req() req: any,
    @Body() body: CreateCheckoutDto,
    @Headers('x-idempotency-key') headerIdempotencyKey?: string,
  ) {
    // Allow idempotency key from header or body
    const dto: CreateCheckoutDto = {
      ...body,
      idempotency_key: body.idempotency_key || headerIdempotencyKey || `${Date.now()}-${Math.random()}`,
    };
    return this.checkoutService.createCheckout(req.user.id, dto);
  }
}
