// ============================================================
// Payment Controller — Razorpay Webhook Handler
// ============================================================
// Receives webhook events from Razorpay, verifies signature,
// checks idempotency, and dispatches to BullMQ for async
// processing. NEVER processes payments synchronously.
// ============================================================

import { Controller, Post, Body, Headers, RawBodyRequest, Req, Logger, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiExcludeEndpoint } from '@nestjs/swagger';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Public } from '../../guards/jwt-auth.guard';
import { prisma } from '@ecommerce/database';
import * as crypto from 'crypto';

@ApiTags('payments')
@Controller('payments')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(
    @InjectQueue('payment-processing') private readonly paymentQueue: Queue,
  ) {}

  /**
   * Razorpay Webhook Handler
   *
   * Razorpay sends POST requests to this endpoint for events like:
   * - payment.authorized
   * - payment.captured
   * - payment.failed
   * - order.paid
   *
   * Security: Verifies HMAC-SHA256 signature to ensure the
   * webhook came from Razorpay, not an attacker.
   */
  @Post('webhook/razorpay')
  @Public()
  @ApiExcludeEndpoint()
  async handleRazorpayWebhook(
    @Body() body: any,
    @Headers('x-razorpay-signature') signature: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    // ─── Step 1: Verify Webhook Signature ─────────────────
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new BadRequestException('Webhook secret not configured');
    }

    // Use raw body for signature verification (parsed body may differ)
    const rawBody = req.rawBody?.toString() || JSON.stringify(body);
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    if (signature !== expectedSignature) {
      this.logger.warn('Invalid webhook signature — rejecting request');
      throw new BadRequestException('Invalid signature');
    }

    // ─── Step 2: Idempotency Check ────────────────────────
    // Razorpay may retry webhooks. Check if we've already
    // processed this event to avoid duplicate processing.
    const eventId = body.event + ':' + (body.payload?.payment?.entity?.id || body.payload?.order?.entity?.id || Date.now());

    const existingEvent = await prisma.webhookEvent.findUnique({
      where: { event_id: eventId },
    });

    if (existingEvent) {
      this.logger.log(`Webhook event already processed: ${eventId}`);
      return { status: 'already_processed' };
    }

    // ─── Step 3: Store webhook event ──────────────────────
    await prisma.webhookEvent.create({
      data: {
        provider: 'RAZORPAY',
        event_id: eventId,
        event_type: body.event,
        payload: body,
        status: 'RECEIVED',
      },
    });

    // ─── Step 4: Dispatch to queue for async processing ───
    // We acknowledge the webhook immediately (return 200)
    // and process it asynchronously via BullMQ. This prevents
    // Razorpay from timing out waiting for our response.
    await this.paymentQueue.add(
      'process-payment-webhook',
      {
        event_id: eventId,
        event_type: body.event,
        payload: body.payload,
      },
      {
        priority: 1, // High priority
        attempts: 5,
        backoff: { type: 'exponential', delay: 3000 },
      },
    );

    this.logger.log(`Webhook received and queued: ${body.event} (${eventId})`);
    return { status: 'received' };
  }

  /**
   * Verify payment on client side (called after Razorpay checkout modal)
   * This is the client-side verification endpoint.
   */
  @Post('verify')
  @Public()
  async verifyPayment(
    @Body() body: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    },
  ) {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (razorpay_signature !== expectedSignature) {
      throw new BadRequestException('Payment verification failed');
    }

    // Queue for processing
    await this.paymentQueue.add(
      'process-payment-verification',
      { razorpay_order_id, razorpay_payment_id, razorpay_signature },
      { priority: 1 },
    );

    return { success: true, message: 'Payment verified, processing order...' };
  }
}
