// ============================================================
// Payment Worker — BullMQ Processor
// ============================================================
// Processes payment-related jobs asynchronously.
// ============================================================

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PaymentService } from './payment.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Processor('payment-processing')
export class PaymentWorker extends WorkerHost {
  private readonly logger = new Logger(PaymentWorker.name);

  constructor(
    private readonly paymentService: PaymentService,
    @InjectQueue('email') private readonly emailQueue: Queue,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    this.logger.log(`Processing job: ${job.name} (${job.id})`);

    switch (job.name) {
      case 'process-payment-webhook':
        await this.handleWebhook(job);
        break;
      case 'process-payment-verification':
        await this.handleVerification(job);
        break;
      default:
        this.logger.warn(`Unknown job type: ${job.name}`);
    }
  }

  private async handleWebhook(job: Job) {
    const { event_type, payload } = job.data;

    switch (event_type) {
      case 'payment.captured':
      case 'order.paid': {
        const paymentEntity = payload.payment?.entity;
        if (!paymentEntity) break;

        const order = await this.paymentService.processPaymentConfirmation({
          razorpay_order_id: paymentEntity.order_id,
          razorpay_payment_id: paymentEntity.id,
          razorpay_signature: '', // Webhook-verified, no client signature
        });

        // Trigger order confirmation email
        if (order) {
          await this.emailQueue.add('send-email', {
            type: 'ORDER_CONFIRMATION',
            to: order.user?.email,
            subject: `Order Confirmed — ${order.order_number}`,
            template_data: {
              order_number: order.order_number,
              total_amount: Number(order.total_amount),
              items: order.items,
            },
          });
        }
        break;
      }

      case 'payment.failed': {
        const failedPayment = payload.payment?.entity;
        if (failedPayment) {
          await this.paymentService.processPaymentFailure(
            failedPayment.order_id,
            failedPayment.error_description || 'Payment failed',
          );

          // Trigger failure notification email
          await this.emailQueue.add('send-email', {
            type: 'PAYMENT_FAILED',
            to: '', // Will be looked up in email processor
            subject: 'Payment Failed — Please retry',
            template_data: {
              razorpay_order_id: failedPayment.order_id,
              reason: failedPayment.error_description,
            },
          });
        }
        break;
      }

      default:
        this.logger.log(`Unhandled webhook event: ${event_type}`);
    }
  }

  private async handleVerification(job: Job) {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = job.data;

    const order = await this.paymentService.processPaymentConfirmation({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    });

    if (order) {
      await this.emailQueue.add('send-email', {
        type: 'ORDER_CONFIRMATION',
        to: order.user?.email,
        subject: `Order Confirmed — ${order.order_number}`,
        template_data: {
          order_number: order.order_number,
          total_amount: Number(order.total_amount),
        },
      });
    }
  }
}
