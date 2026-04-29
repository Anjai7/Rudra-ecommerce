import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { PaymentWorker } from './payment.worker';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [
    InventoryModule,
    BullModule.registerQueue(
      { name: 'payment-processing' },
      { name: 'email' },
    ),
  ],
  controllers: [PaymentController],
  providers: [PaymentService, PaymentWorker],
  exports: [PaymentService],
})
export class PaymentModule {}
