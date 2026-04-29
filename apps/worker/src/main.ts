// ============================================================
// Worker Process — BullMQ Job Processor
// ============================================================
// Standalone process that listens to multiple queues and
// processes jobs. Can be scaled independently from the API.
// ============================================================

import { Worker, Queue } from 'bullmq';
import Redis from 'ioredis';
import * as http from 'http';
import { processInventoryJob } from './processors/inventory.processor';
import { processEmailJob } from './processors/email.processor';
import { processReconciliationJob } from './processors/reconciliation.processor';

const CONNECTION = {
  host: new URL(process.env.REDIS_URL || 'redis://localhost:6379').hostname,
  port: parseInt(new URL(process.env.REDIS_URL || 'redis://localhost:6379').port || '6379'),
  password: new URL(process.env.REDIS_URL || 'redis://localhost:6379').password || undefined,
};

// ─── Workers ────────────────────────────────────────────────

const workers: Worker[] = [];

// Reservation expiry worker (processes delayed jobs from checkout)
const reservationWorker = new Worker(
  'reservation-expiry',
  async (job) => {
    console.info(`[reservation-expiry] Processing: ${job.name} (${job.id})`);
    await processInventoryJob(job);
  },
  { connection: CONNECTION, concurrency: 5 },
);

// Email worker
const emailWorker = new Worker(
  'email',
  async (job) => {
    console.info(`[email] Processing: ${job.name} (${job.id})`);
    await processEmailJob(job);
  },
  { connection: CONNECTION, concurrency: 10 },
);

// Reconciliation worker (daily job)
const reconciliationWorker = new Worker(
  'reconciliation',
  async (job) => {
    console.info(`[reconciliation] Processing: ${job.name} (${job.id})`);
    await processReconciliationJob(job);
  },
  { connection: CONNECTION, concurrency: 1 },
);

workers.push(reservationWorker, emailWorker, reconciliationWorker);

// ─── Scheduled Jobs ─────────────────────────────────────────

async function setupScheduledJobs() {
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

  // Inventory expiry check every 5 minutes
  const inventoryQueue = new Queue('reservation-expiry', { connection: CONNECTION });
  await inventoryQueue.upsertJobScheduler(
    'expire-reservations-cron',
    { pattern: '*/5 * * * *' },
    {
      name: 'cron-expire-reservations',
      data: { type: 'cron-expiry-check' },
    },
  );

  // Daily reconciliation at 2 AM
  const reconQueue = new Queue('reconciliation', { connection: CONNECTION });
  await reconQueue.upsertJobScheduler(
    'daily-reconciliation',
    { pattern: '0 2 * * *' },
    {
      name: 'daily-reconciliation',
      data: { type: 'daily-settlement-check' },
    },
  );

  await redis.quit();
  console.info('📅 Scheduled jobs configured');
}

// ─── Event Handlers ─────────────────────────────────────────

for (const worker of workers) {
  worker.on('completed', (job) => {
    console.info(`✅ Job completed: ${job.name} (${job.id})`);
  });

  worker.on('failed', (job, err) => {
    console.error(`❌ Job failed: ${job?.name} (${job?.id}):`, err.message);
  });

  worker.on('error', (err) => {
    console.error('Worker error:', err.message);
  });
}

// ─── Graceful Shutdown ──────────────────────────────────────

async function shutdown(signal: string) {
  console.info(`\n${signal} received. Shutting down workers gracefully...`);

  await Promise.all(workers.map((w) => w.close()));

  console.info('All workers stopped. Exiting.');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ─── Start ──────────────────────────────────────────────────

console.info('🔧 Worker process starting...');
console.info(`📡 Redis: ${process.env.REDIS_URL || 'redis://localhost:6379'}`);
console.info(`👷 Workers: reservation-expiry, email, reconciliation`);

setupScheduledJobs().catch(console.error);

console.info('✅ Worker process ready');

// ─── Dummy HTTP Server for Render Free Tier ─────────────────
// Render requires Web Services to bind to a port within 10 minutes.
// This allows deploying the worker as a free "Web Service".
const port = process.env.PORT || 8080;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Worker is running and healthy\\n');
}).listen(port, () => {
  console.info(`🌐 Dummy HTTP server listening on port ${port} (Render Health Check)`);
});
