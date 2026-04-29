// ============================================================
// Prisma Client Singleton
// ============================================================
// Singleton pattern prevents multiple Prisma Client instances
// in development (due to hot-reloading). Includes soft-delete
// middleware and connection pool configuration.
// ============================================================

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['warn', 'error'],
    datasources: {
      db: {
        // Use connection pool URL if available (pgBouncer), fallback to direct
        url: process.env.DATABASE_POOL_URL || process.env.DATABASE_URL,
      },
    },
  });

  // ─── Soft Delete Middleware ──────────────────────────────
  // Intercepts delete operations and converts them to soft deletes
  // by setting deleted_at instead of actually removing records.

  client.$use(async (params, next) => {
    // Models that support soft delete
    const softDeleteModels = [
      'User', 'Product', 'ProductVariant', 'Cart', 'CartItem',
      'Order', 'OrderItem', 'InventoryReservation', 'Payment',
      'WebhookEvent',
    ];

    if (params.model && softDeleteModels.includes(params.model)) {
      // Convert delete to soft delete
      if (params.action === 'delete') {
        params.action = 'update';
        params.args.data = { deleted_at: new Date() };
      }

      if (params.action === 'deleteMany') {
        params.action = 'updateMany';
        if (params.args.data !== undefined) {
          params.args.data.deleted_at = new Date();
        } else {
          params.args.data = { deleted_at: new Date() };
        }
      }

      // Auto-filter soft-deleted records on queries
      if (params.action === 'findUnique' || params.action === 'findFirst') {
        params.action = 'findFirst';
        if (!params.args) params.args = {};
        if (params.args.where) {
          if (params.args.where.deleted_at === undefined) {
            params.args.where.deleted_at = null;
          }
        } else {
          params.args.where = { deleted_at: null };
        }
      }

      if (params.action === 'findMany') {
        if (!params.args) params.args = {};
        if (params.args.where) {
          if (params.args.where.deleted_at === undefined) {
            params.args.where.deleted_at = null;
          }
        } else {
          params.args.where = { deleted_at: null };
        }
      }

      if (params.action === 'count') {
        if (!params.args) params.args = {};
        if (params.args.where) {
          if (params.args.where.deleted_at === undefined) {
            params.args.where.deleted_at = null;
          }
        } else {
          params.args.where = { deleted_at: null };
        }
      }
    }

    return next(params);
  });

  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export { PrismaClient };
export * from '@prisma/client';
export default prisma;
