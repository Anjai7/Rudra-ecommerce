// ============================================================
// NestJS API — Bootstrap
// ============================================================
// Initializes the NestJS application with security middleware,
// Swagger documentation, graceful shutdown, and health checks.
// ============================================================

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as Sentry from '@sentry/node';
import helmet from 'helmet';
import compression from 'compression';

import { AppModule } from './app.module';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: process.env.NODE_ENV === 'production'
      ? ['error', 'warn', 'log']
      : ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // ─── Sentry Error Tracking ───────────────────────────────
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    });
    logger.log('Sentry initialized');
  }

  // ─── Security Middleware ──────────────────────────────────
  app.use(helmet());
  app.use(compression());

  // ─── CORS ─────────────────────────────────────────────────
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Idempotency-Key'],
  });

  // ─── API Versioning ──────────────────────────────────────
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // ─── Global Pipes ────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ─── Global Filters ──────────────────────────────────────
  app.useGlobalFilters(new AllExceptionsFilter());

  // ─── Swagger / OpenAPI ────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('E-Commerce Platform API')
      .setDescription('Production-ready e-commerce API with Razorpay integration')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('products', 'Product management')
      .addTag('cart', 'Shopping cart operations')
      .addTag('checkout', 'Checkout and order creation')
      .addTag('payments', 'Payment processing and webhooks')
      .addTag('health', 'Health checks')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
    logger.log('Swagger documentation available at /api/docs');
  }

  // ─── Graceful Shutdown ────────────────────────────────────
  app.enableShutdownHooks();

  const port = process.env.API_PORT || 4000;
  await app.listen(port);
  logger.log(`🚀 API server running on http://localhost:${port}`);
  logger.log(`📖 API docs at http://localhost:${port}/api/docs`);
}

bootstrap().catch((err) => {
  console.error('Failed to start API:', err);
  process.exit(1);
});
