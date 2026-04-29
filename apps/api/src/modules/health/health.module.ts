// ============================================================
// Health Check Module
// ============================================================

import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../guards/jwt-auth.guard';
import { prisma } from '@ecommerce/database';
import Redis from 'ioredis';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @Public()
  async check() {
    const checks: Record<string, string> = {};
    let healthy = true;

    // Database check
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = 'ok';
    } catch {
      checks.database = 'error';
      healthy = false;
    }

    // Redis check
    try {
      const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
      });
      await redis.ping();
      await redis.quit();
      checks.redis = 'ok';
    } catch {
      checks.redis = 'error';
      healthy = false;
    }

    return {
      status: healthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks,
    };
  }
}

import { Module } from '@nestjs/common';

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
