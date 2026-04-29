// ============================================================
// Payment Service
// ============================================================

import { Injectable, Logger } from '@nestjs/common';
import { prisma } from '@ecommerce/database';
import { InventoryService } from '../inventory/inventory.service';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(private readonly inventoryService: InventoryService) {}

  /**
   * Process payment confirmation after Razorpay webhook/verification.
   * Updates order status, confirms inventory, triggers email.
   */
  async processPaymentConfirmation(data: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) {
    const payment = await prisma.payment.findUnique({
      where: { provider_order_id: data.razorpay_order_id },
      include: { order: { include: { user: true, items: true } } },
    });

    if (!payment) {
      this.logger.error(`Payment not found for Razorpay order: ${data.razorpay_order_id}`);
      return;
    }

    if (payment.status === 'CAPTURED') {
      this.logger.warn(`Payment already captured: ${payment.id}`);
      return;
    }

    // Update payment record
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        provider_payment_id: data.razorpay_payment_id,
        provider_signature: data.razorpay_signature,
        status: 'CAPTURED',
        paid_at: new Date(),
      },
    });

    // Update order status to CONFIRMED
    await prisma.order.update({
      where: { id: payment.order_id },
      data: { status: 'CONFIRMED' },
    });

    // Confirm inventory reservations (deduct actual stock)
    await this.inventoryService.confirmReservations(payment.order_id);

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: payment.order.user_id,
        action: 'PAYMENT',
        entity_type: 'Payment',
        entity_id: payment.id,
        new_values: {
          status: 'CAPTURED',
          razorpay_payment_id: data.razorpay_payment_id,
          amount: Number(payment.amount),
        },
      },
    });

    this.logger.log(
      `Payment confirmed: order=${payment.order.order_number}, amount=₹${payment.amount}`,
    );

    return payment.order;
  }

  /**
   * Handle payment failure.
   */
  async processPaymentFailure(razorpayOrderId: string, reason: string) {
    const payment = await prisma.payment.findUnique({
      where: { provider_order_id: razorpayOrderId },
    });

    if (!payment) return;

    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'FAILED', metadata: { failure_reason: reason } },
    });

    // Release inventory reservations
    await this.inventoryService.releaseOrderReservations(payment.order_id);

    // Update order status
    await prisma.order.update({
      where: { id: payment.order_id },
      data: { status: 'CANCELLED' },
    });

    this.logger.warn(`Payment failed for order ${payment.order_id}: ${reason}`);
  }
}
