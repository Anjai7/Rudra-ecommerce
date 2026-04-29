// ============================================================
// Inventory Service
// ============================================================
// Handles stock reservation and release with distributed
// locking via Redis to prevent overselling under concurrency.
// ============================================================

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { prisma } from '@ecommerce/database';
import Redis from 'ioredis';
import Redlock from 'redlock';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);
  private readonly redis: Redis;
  private readonly redlock: Redlock;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    this.redlock = new Redlock([this.redis], {
      driftFactor: 0.01,
      retryCount: 5,
      retryDelay: 200,
      retryJitter: 100,
    });
  }

  /**
   * Reserve stock for a list of items.
   * Uses Redlock distributed locking to prevent race conditions
   * where multiple concurrent checkouts might oversell.
   *
   * Lock Strategy:
   * - Each variant gets its own lock key: `lock:inventory:{variantId}`
   * - Lock TTL is 10 seconds (enough for the DB transaction)
   * - If lock acquisition fails, the checkout is retried
   *
   * @param items - Array of { variant_id, quantity } to reserve
   * @param orderId - The order ID to associate with reservations
   * @param expiresAt - When the reservation expires (15 min from now)
   */
  async reserveStock(
    items: Array<{ variant_id: string; quantity: number }>,
    orderId: string,
    expiresAt: Date,
  ) {
    // Sort items by variant_id to prevent deadlocks
    // (always acquire locks in the same order)
    const sortedItems = [...items].sort((a, b) => a.variant_id.localeCompare(b.variant_id));
    const lockKeys = sortedItems.map((item) => `lock:inventory:${item.variant_id}`);

    // Acquire distributed locks for ALL variants atomically
    const lock = await this.redlock.acquire(lockKeys, 10000);

    try {
      // Validate stock availability within the lock
      for (const item of sortedItems) {
        const variant = await prisma.productVariant.findUnique({
          where: { id: item.variant_id },
        });

        if (!variant) {
          throw new BadRequestException(`Variant ${item.variant_id} not found`);
        }

        const available = variant.stock_quantity - variant.reserved_quantity;
        if (available < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for ${variant.name}. Available: ${available}, requested: ${item.quantity}`,
          );
        }
      }

      // Create reservations and update reserved quantities atomically
      await prisma.$transaction(async (tx) => {
        for (const item of sortedItems) {
          // Increment reserved_quantity on the variant
          await tx.productVariant.update({
            where: { id: item.variant_id },
            data: { reserved_quantity: { increment: item.quantity } },
          });

          // Create reservation record
          await tx.inventoryReservation.create({
            data: {
              variant_id: item.variant_id,
              order_id: orderId,
              quantity: item.quantity,
              status: 'ACTIVE',
              expires_at: expiresAt,
            },
          });
        }
      });

      this.logger.log(`Stock reserved for order ${orderId}: ${sortedItems.length} variants`);
    } finally {
      // Always release the lock, even if the transaction fails
      await lock.release();
    }
  }

  /**
   * Confirm reservations after payment succeeds.
   * Deducts from actual stock_quantity and marks reservation as CONFIRMED.
   */
  async confirmReservations(orderId: string) {
    const reservations = await prisma.inventoryReservation.findMany({
      where: { order_id: orderId, status: 'ACTIVE' },
    });

    await prisma.$transaction(async (tx) => {
      for (const res of reservations) {
        // Deduct from stock and reserved
        await tx.productVariant.update({
          where: { id: res.variant_id },
          data: {
            stock_quantity: { decrement: res.quantity },
            reserved_quantity: { decrement: res.quantity },
          },
        });

        // Mark reservation as confirmed
        await tx.inventoryReservation.update({
          where: { id: res.id },
          data: { status: 'CONFIRMED', confirmed_at: new Date() },
        });
      }
    });

    this.logger.log(`Reservations confirmed for order ${orderId}`);
  }

  /**
   * Release expired reservations.
   * Called by the cron worker every 5 minutes.
   */
  async releaseExpiredReservations() {
    const now = new Date();

    const expired = await prisma.inventoryReservation.findMany({
      where: { status: 'ACTIVE', expires_at: { lte: now } },
    });

    if (expired.length === 0) return 0;

    await prisma.$transaction(async (tx) => {
      for (const res of expired) {
        // Release reserved quantity back to available stock
        await tx.productVariant.update({
          where: { id: res.variant_id },
          data: { reserved_quantity: { decrement: res.quantity } },
        });

        // Mark as expired
        await tx.inventoryReservation.update({
          where: { id: res.id },
          data: { status: 'EXPIRED', released_at: now },
        });

        // Update associated order to EXPIRED
        await tx.order.update({
          where: { id: res.order_id },
          data: { status: 'EXPIRED' },
        });
      }
    });

    this.logger.log(`Released ${expired.length} expired reservations`);
    return expired.length;
  }

  /**
   * Release reservations for a specific order (e.g., on cancellation).
   */
  async releaseOrderReservations(orderId: string) {
    const reservations = await prisma.inventoryReservation.findMany({
      where: { order_id: orderId, status: 'ACTIVE' },
    });

    await prisma.$transaction(async (tx) => {
      for (const res of reservations) {
        await tx.productVariant.update({
          where: { id: res.variant_id },
          data: { reserved_quantity: { decrement: res.quantity } },
        });

        await tx.inventoryReservation.update({
          where: { id: res.id },
          data: { status: 'RELEASED', released_at: new Date() },
        });
      }
    });

    this.logger.log(`Released reservations for order ${orderId}`);
  }
}
