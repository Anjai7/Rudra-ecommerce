import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [
    InventoryModule,
    BullModule.registerQueue({ name: 'reservation-expiry' }),
  ],
  controllers: [CheckoutController],
  providers: [CheckoutService],
})
export class CheckoutModule {}
