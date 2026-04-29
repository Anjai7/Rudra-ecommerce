// ============================================================
// Inventory Processor — Reservation Expiry
// ============================================================
// Cron: Every 5 minutes, check for expired reservations.
// Also handles delayed expiry jobs from checkout.
// ============================================================

import { Job } from 'bullmq';
import { prisma } from '@ecommerce/database';

export async function processInventoryJob(job: Job): Promise<void> {
  const { type, order_id } = job.data;

  if (type === 'cron-expiry-check') {
    // Periodic sweep for all expired reservations
    await expireAllReservations();
  } else if (order_id) {
    // Specific order reservation expiry (delayed job from checkout)
    await expireOrderReservation(order_id);
  }
}

/**
 * Sweep all active reservations that have passed their expiry time.
 * This is the safety net — even if the delayed job doesn't fire,
 * this cron catches expired reservations every 5 minutes.
 */
async function expireAllReservations(): Promise<void> {
  const now = new Date();

  const expired = await prisma.inventoryReservation.findMany({
    where: {
      status: 'ACTIVE',
      expires_at: { lte: now },
    },
    include: { order: true },
  });

  if (expired.length === 0) {
    console.info('[inventory] No expired reservations found');
    return;
  }

  console.info(`[inventory] Found ${expired.length} expired reservations`);

  for (const reservation of expired) {
    try {
      await prisma.$transaction(async (tx) => {
        // Release reserved quantity back to available
        await tx.productVariant.update({
          where: { id: reservation.variant_id },
          data: { reserved_quantity: { decrement: reservation.quantity } },
        });

        // Mark reservation as expired
        await tx.inventoryReservation.update({
          where: { id: reservation.id },
          data: { status: 'EXPIRED', released_at: now },
        });

        // Only expire the order if it's still PENDING (not already paid)
        if (reservation.order.status === 'PENDING') {
          await tx.order.update({
            where: { id: reservation.order_id },
            data: { status: 'EXPIRED' },
          });
        }
      });

      console.info(
        `[inventory] Released: variant=${reservation.variant_id}, qty=${reservation.quantity}, order=${reservation.order_id}`,
      );
    } catch (err) {
      console.error(`[inventory] Failed to expire reservation ${reservation.id}:`, err);
    }
  }
}

/**
 * Expire reservations for a specific order.
 * Called by the delayed job scheduled during checkout.
 */
async function expireOrderReservation(orderId: string): Promise<void> {
  // Check if order is still pending (payment might have come through)
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.status !== 'PENDING') {
    console.info(`[inventory] Order ${orderId} is ${order?.status || 'missing'}, skipping expiry`);
    return;
  }

  const reservations = await prisma.inventoryReservation.findMany({
    where: { order_id: orderId, status: 'ACTIVE' },
  });

  if (reservations.length === 0) return;

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    for (const res of reservations) {
      await tx.productVariant.update({
        where: { id: res.variant_id },
        data: { reserved_quantity: { decrement: res.quantity } },
      });

      await tx.inventoryReservation.update({
        where: { id: res.id },
        data: { status: 'EXPIRED', released_at: now },
      });
    }

    await tx.order.update({
      where: { id: orderId },
      data: { status: 'EXPIRED' },
    });
  });

  console.info(`[inventory] Expired ${reservations.length} reservations for order ${orderId}`);
}
