// ============================================================
// Reconciliation Processor — Daily Payment Verification
// ============================================================
// Runs daily at 2 AM to verify Razorpay settlements match
// our payment records. Flags discrepancies for manual review.
// ============================================================

import { Job } from 'bullmq';
import { prisma } from '@ecommerce/database';
import Razorpay from 'razorpay';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export async function processReconciliationJob(job: Job): Promise<void> {
  console.info('[reconciliation] Starting daily payment reconciliation...');

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Fetch all captured payments from yesterday
  const ourPayments = await prisma.payment.findMany({
    where: {
      status: 'CAPTURED',
      paid_at: { gte: yesterday, lt: today },
      deleted_at: null,
    },
    include: { order: true },
  });

  console.info(`[reconciliation] Found ${ourPayments.length} captured payments from yesterday`);

  let matched = 0;
  let mismatched = 0;
  let errors = 0;

  for (const payment of ourPayments) {
    try {
      if (!payment.provider_payment_id) {
        console.warn(`[reconciliation] Payment ${payment.id} has no provider_payment_id`);
        mismatched++;
        continue;
      }

      // Verify with Razorpay API
      const rzpPayment = await razorpay.payments.fetch(payment.provider_payment_id);

      // Check amount matches (Razorpay uses paise, we use rupees)
      const expectedAmountPaise = Math.round(Number(payment.amount) * 100);
      const rzpAmount = rzpPayment.amount as number;

      if (rzpAmount !== expectedAmountPaise) {
        console.error(
          `[reconciliation] AMOUNT MISMATCH: payment=${payment.id}, ` +
          `ours=₹${payment.amount} (${expectedAmountPaise}p), razorpay=${rzpAmount}p`,
        );
        mismatched++;

        // Create audit log for discrepancy
        await prisma.auditLog.create({
          data: {
            action: 'PAYMENT',
            entity_type: 'Payment',
            entity_id: payment.id,
            old_values: { expected_amount: expectedAmountPaise },
            new_values: { razorpay_amount: rzpAmount, status: rzpPayment.status },
          },
        });
        continue;
      }

      // Verify status
      if (rzpPayment.status !== 'captured') {
        console.warn(
          `[reconciliation] STATUS MISMATCH: payment=${payment.id}, razorpay_status=${rzpPayment.status}`,
        );
        mismatched++;
        continue;
      }

      matched++;
    } catch (err) {
      console.error(`[reconciliation] Error checking payment ${payment.id}:`, err);
      errors++;
    }
  }

  console.info(
    `[reconciliation] Complete: matched=${matched}, mismatched=${mismatched}, errors=${errors}`,
  );

  // Check for pending payments older than 1 hour (possibly stuck)
  const stuckPayments = await prisma.payment.findMany({
    where: {
      status: 'PENDING',
      created_at: { lt: new Date(Date.now() - 60 * 60 * 1000) },
      deleted_at: null,
    },
  });

  if (stuckPayments.length > 0) {
    console.warn(`[reconciliation] Found ${stuckPayments.length} stuck pending payments (>1hr old)`);
  }
}
