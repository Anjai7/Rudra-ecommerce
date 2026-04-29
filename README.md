# E-Commerce Platform

Production-ready e-commerce monorepo built with **Next.js 14**, **NestJS**, **BullMQ**, **Prisma**, and **Razorpay**.

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Next.js    │────▶│   NestJS    │────▶│  PostgreSQL  │
│   (Web)      │     │   (API)     │     │  (Prisma)    │
│  Port 3000   │     │  Port 4000  │     │  Port 5432   │
└─────────────┘     └──────┬──────┘     └─────────────┘
                           │
                    ┌──────▼──────┐     ┌─────────────┐
                    │    Redis    │────▶│   BullMQ     │
                    │  Port 6379  │     │  (Worker)    │
                    └─────────────┘     └─────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS, Zustand |
| Backend | NestJS 10, Prisma 5, BullMQ |
| Database | PostgreSQL 15, Redis 7 |
| Auth | Supabase (JWT) |
| Payments | Razorpay |
| Search | Meilisearch |
| Infra | Docker, Kubernetes, Terraform (AWS) |
| CI/CD | GitHub Actions |
| Monitoring | Sentry |

## Quick Start

```bash
# Clone and install
git clone <repo-url> && cd ecommerce-platform
chmod +x scripts/setup.sh && ./scripts/setup.sh

# Or manually:
pnpm install
docker compose -f infra/docker/docker-compose.yml up -d
pnpm db:generate && pnpm db:migrate && pnpm db:seed
pnpm dev
```

**URLs:**
- Web: http://localhost:3000
- API: http://localhost:4000
- API Docs: http://localhost:4000/api/docs
- Meilisearch: http://localhost:7700
- MinIO Console: http://localhost:9001

## Project Structure

```
ecommerce-platform/
├── apps/
│   ├── web/          # Next.js 14 frontend
│   ├── api/          # NestJS API server
│   └── worker/       # BullMQ background workers
├── packages/
│   ├── database/     # Prisma schema & client
│   ├── shared-types/ # TypeScript interfaces
│   └── eslint-config/# Shared ESLint rules
├── infra/
│   ├── docker/       # Docker Compose configs
│   ├── k8s/          # Kubernetes manifests
│   └── terraform/    # AWS Terraform configs
├── scripts/          # Setup, backup, migration
└── .github/workflows/# CI/CD pipelines
```

## Key Features

- **Checkout Flow**: Idempotent, distributed-locked, with 15-min price freeze
- **Inventory**: Redlock-based reservation preventing overselling
- **Payments**: Async Razorpay webhook processing via BullMQ
- **Workers**: Reservation expiry, email notifications, daily reconciliation
- **Auth**: Supabase JWT with role-based access control
- **Cart**: Zustand + localStorage with anonymous-to-user merge

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all apps in dev mode |
| `pnpm build` | Build all packages |
| `pnpm db:migrate` | Run Prisma migrations |
| `pnpm db:seed` | Seed sample data |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm docker:up` | Start Docker services |
| `pnpm lint` | Lint all packages |
| `pnpm typecheck` | Type-check all packages |

## License

MIT
