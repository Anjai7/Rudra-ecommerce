// ============================================================
// Checkout Service
// ============================================================
// Orchestrates the complete checkout flow:
// 1. Idempotency check (prevents duplicate orders)
// 2. Distributed lock acquisition (prevents overselling)
// 3. Price freezing (snapshot current prices)
// 4. Atomic order creation with Prisma transaction
// 5. Razorpay payment order creation
// 6. 15-minute reservation expiry scheduling
// ============================================================

import { Injectable, Logger, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { prisma } from '@ecommerce/database';
import { InventoryService } from '../inventory/inventory.service';
import Redis from 'ioredis';
import Razorpay from 'razorpay';
import { v4 as uuidv4 } from 'uuid';
import type { CreateCheckoutDto, CheckoutResponse } from '@ecommerce/shared-types';

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);
  private readonly redis: Redis;
  private readonly razorpay: Razorpay;

  // Reservation window: 15 minutes for payment completion
  private readonly RESERVATION_TTL_MS = 15 * 60 * 1000;

  constructor(
    private readonly inventoryService: InventoryService,
    @InjectQueue('reservation-expiry') private readonly expiryQueue: Queue,
  ) {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    this.razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });
  }

  /**
   * Main checkout flow. Creates an order with inventory reservation
   * and returns a Razorpay order for payment collection.
   */
  async createCheckout(userId: string, dto: CreateCheckoutDto): Promise<CheckoutResponse> {
    const { idempotency_key, shipping_address, billing_address, notes } = dto;

    // ─── Step 1: Idempotency Check ─────────────────────────
    // If this idempotency key was already used, return the existing order.
    // This prevents duplicate orders from double-clicks or network retries.
    const existingOrderId = await this.redis.get(`idempotency:${idempotency_key}`);
    if (existingOrderId) {
      this.logger.warn(`Duplicate checkout attempt: idempotency_key=${idempotency_key}`);
      const existingOrder = await prisma.order.findUnique({
        where: { id: existingOrderId },
        include: { items: true, payment: true },
      });
      if (existingOrder && existingOrder.payment) {
        return {
          order: existingOrder as any,
          razorpay_order_id: existingOrder.payment.provider_order_id,
          razorpay_key_id: process.env.RAZORPAY_KEY_ID!,
          amount: Number(existingOrder.total_amount) * 100,
          currency: existingOrder.currency,
        };
      }
      throw new ConflictException('Order already exists for this idempotency key');
    }

    // ─── Step 2: Fetch and validate cart ────────────────────
    const cart = await prisma.cart.findFirst({
      where: { user_id: userId, deleted_at: null },
      include: {
        items: {
          where: { deleted_at: null },
          include: {
            variant: { include: { product: true } },
          },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    // ─── Step 3: Price Freeze ──────────────────────────────
    // Snapshot current prices at checkout time. The customer
    // pays the price shown at checkout, not a future price.
    const priceFrozenAt = new Date();
    const orderItems = cart.items.map((item) => ({
      variant_id: item.variant_id,
      product_name: item.variant.product.name,
      variant_name: item.variant.name,
      sku: item.variant.sku,
      quantity: item.quantity,
      unit_price: Number(item.variant.price),
      total_price: Number(item.variant.price) * item.quantity,
    }));

    const subtotal = orderItems.reduce((sum, item) => sum + item.total_price, 0);
    const taxRate = 0.18; // 18% GST
    const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
    const shippingAmount = subtotal > 999 ? 0 : 99; // Free shipping above ₹999
    const totalAmount = subtotal + taxAmount + shippingAmount;

    // ─── Step 4: Generate order number ─────────────────────
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // ─── Step 5: Reserve inventory ─────────────────────────
    const reservationExpiry = new Date(Date.now() + this.RESERVATION_TTL_MS);
    const orderId = uuidv4();

    // Create order + reserve stock in a single flow
    const order = await prisma.$transaction(async (tx) => {
      // Create the order
      const newOrder = await tx.order.create({
        data: {
          id: orderId,
          user_id: userId,
          order_number: orderNumber,
          status: 'PENDING',
          subtotal,
          tax_amount: taxAmount,
          shipping_amount: shippingAmount,
          discount_amount: 0,
          total_amount: totalAmount,
          currency: 'INR',
          shipping_address: shipping_address as any,
          billing_address: billing_address as any || null,
          notes: notes || null,
          idempotency_key,
          price_frozen_at: priceFrozenAt,
          items: {
            create: orderItems,
          },
        },
        include: { items: true },
      });

      return newOrder;
    });

    // Reserve inventory (uses Redlock internally)
    await this.inventoryService.reserveStock(
      orderItems.map((item) => ({ variant_id: item.variant_id, quantity: item.quantity })),
      order.id,
      reservationExpiry,
    );

    // ─── Step 6: Create Razorpay order ─────────────────────
    const razorpayOrder = await this.razorpay.orders.create({
      amount: Math.round(totalAmount * 100), // Razorpay uses paise
      currency: 'INR',
      receipt: order.order_number,
      notes: {
        order_id: order.id,
        user_id: userId,
      },
    });

    // Create payment record
    await prisma.payment.create({
      data: {
        order_id: order.id,
        provider: 'RAZORPAY',
        provider_order_id: razorpayOrder.id,
        amount: totalAmount,
        currency: 'INR',
        status: 'PENDING',
      },
    });

    // ─── Step 7: Set idempotency key in Redis ──────────────
    // Expires after 24 hours (long enough for retries)
    await this.redis.set(`idempotency:${idempotency_key}`, order.id, 'EX', 86400);

    // ─── Step 8: Schedule reservation expiry ────────────────
    // If payment isn't received within 15 minutes, the worker
    // will release the reserved stock and expire the order.
    await this.expiryQueue.add(
      'expire-reservation',
      {
        order_id: order.id,
        reservation_ids: [], // Worker will look up active reservations
      },
      {
        delay: this.RESERVATION_TTL_MS,
        jobId: `reservation-expiry-${order.id}`,
      },
    );

    this.logger.log(
      `Checkout completed: order=${order.order_number}, total=₹${totalAmount}, razorpay=${razorpayOrder.id}`,
    );

    return {
      order: order as any,
      razorpay_order_id: razorpayOrder.id,
      razorpay_key_id: process.env.RAZORPAY_KEY_ID!,
      amount: Math.round(totalAmount * 100),
      currency: 'INR',
    };
  }
}
