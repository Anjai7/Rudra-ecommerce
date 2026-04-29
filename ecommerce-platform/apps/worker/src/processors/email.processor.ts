// ============================================================
// Email Processor — Transactional Emails via Resend
// ============================================================

import { Job } from 'bullmq';
import { Resend } from 'resend';
import type { EmailJob } from '@ecommerce/shared-types';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.EMAIL_FROM || 'noreply@ecommerce.com';

export async function processEmailJob(job: Job): Promise<void> {
  const data = job.data as EmailJob;

  if (!data.to) {
    console.warn(`[email] No recipient for job ${job.id}, skipping`);
    return;
  }

  try {
    const html = generateEmailHtml(data);

    await resend.emails.send({
      from: FROM_EMAIL,
      to: data.to,
      subject: data.subject,
      html,
    });

    console.info(`[email] Sent ${data.type} to ${data.to}`);
  } catch (err) {
    console.error(`[email] Failed to send ${data.type} to ${data.to}:`, err);
    throw err; // Let BullMQ retry
  }
}

function generateEmailHtml(data: EmailJob): string {
  const { type, template_data } = data;

  switch (type) {
    case 'ORDER_CONFIRMATION':
      return `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; color: white; text-align: center;">
            <h1 style="margin: 0;">Order Confirmed! 🎉</h1>
          </div>
          <div style="padding: 30px; background: #f8f9fa; border-radius: 0 0 10px 10px;">
            <p>Thank you for your order!</p>
            <p><strong>Order Number:</strong> ${template_data.order_number}</p>
            <p><strong>Total:</strong> ₹${template_data.total_amount}</p>
            <p>We'll send you a shipping notification once your order is on its way.</p>
            <hr style="border: 1px solid #eee;" />
            <p style="color: #666; font-size: 12px;">
              If you have questions, reply to this email or contact support.
            </p>
          </div>
        </body>
        </html>
      `;

    case 'SHIPPING_NOTIFICATION':
      return `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #28a745; padding: 30px; border-radius: 10px; color: white; text-align: center;">
            <h1 style="margin: 0;">Your Order Has Shipped! 📦</h1>
          </div>
          <div style="padding: 30px; background: #f8f9fa; border-radius: 0 0 10px 10px;">
            <p><strong>Order:</strong> ${template_data.order_number}</p>
            <p><strong>Tracking:</strong> ${template_data.tracking_number || 'Will be updated shortly'}</p>
            <p><strong>Carrier:</strong> ${template_data.carrier || 'Standard Shipping'}</p>
          </div>
        </body>
        </html>
      `;

    case 'PAYMENT_FAILED':
      return `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #dc3545; padding: 30px; border-radius: 10px; color: white; text-align: center;">
            <h1 style="margin: 0;">Payment Failed ⚠️</h1>
          </div>
          <div style="padding: 30px; background: #f8f9fa; border-radius: 0 0 10px 10px;">
            <p>Unfortunately, your payment could not be processed.</p>
            <p><strong>Reason:</strong> ${template_data.reason || 'Unknown error'}</p>
            <p>Your cart items are still saved. Please try again.</p>
          </div>
        </body>
        </html>
      `;

    case 'WELCOME':
      return `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; color: white; text-align: center;">
            <h1 style="margin: 0;">Welcome! 👋</h1>
          </div>
          <div style="padding: 30px; background: #f8f9fa; border-radius: 0 0 10px 10px;">
            <p>Thank you for joining our platform. Start shopping today!</p>
          </div>
        </body>
        </html>
      `;

    default:
      return `<p>${JSON.stringify(template_data)}</p>`;
  }
}
