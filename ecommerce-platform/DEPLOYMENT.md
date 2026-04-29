# Deployment Guide

## Prerequisites

- Node.js 20+
- Docker & Docker Compose
- pnpm 9+
- Railway CLI / AWS CLI / kubectl (depending on target)

## Local Development

```bash
# 1. Clone and install
git clone <repo-url> && cd ecommerce-platform
cp .env.example .env  # Fill in your values

# 2. Install deps
pnpm install

# 3. Start infrastructure
docker compose -f infra/docker/docker-compose.yml up -d

# 4. Database setup
pnpm db:generate
pnpm db:migrate
pnpm db:seed

# 5. Start all apps
pnpm dev
```

**URLs:**
- Web: http://localhost:3000
- API Docs: http://localhost:4000/api/docs
- Prisma Studio: `pnpm db:studio`

---

## Production Deployment

### Option A: Railway (Easiest)

```bash
# 1. Install Railway CLI
npm i -g @railway/cli

# 2. Login and link project
railway login
railway init

# 3. Add PostgreSQL and Redis plugins in Railway dashboard

# 4. Set environment variables in Railway dashboard
# (copy from .env.example)

# 5. Deploy
railway up

# 6. Run migrations
railway run pnpm db:migrate:deploy
railway run pnpm db:seed
```

### Option B: Docker Compose (Single Server)

```bash
# 1. Copy files to server
scp -r . your-server:/app/ecommerce

# 2. SSH into server
ssh your-server

# 3. Set environment variables
cd /app/ecommerce
cp .env.example .env
# Edit .env with production values

# 4. Build and start
export DOMAIN=yourdomain.com
export ACME_EMAIL=admin@yourdomain.com
export DB_USER=ecommerce
export DB_PASSWORD=$(openssl rand -hex 32)
export REDIS_PASSWORD=$(openssl rand -hex 32)

docker compose -f infra/docker/docker-compose.prod.yml up -d

# 5. Run migrations
docker compose exec api pnpm db:migrate:deploy
docker compose exec api pnpm db:seed
```

### Option C: Kubernetes

```bash
# 1. Create namespace
kubectl apply -f infra/k8s/namespace.yml

# 2. Create secrets
kubectl create secret generic app-secrets \
  --from-env-file=.env \
  -n ecommerce

# 3. Deploy infrastructure
kubectl apply -f infra/k8s/postgres.yml
kubectl apply -f infra/k8s/

# 4. Wait for pods
kubectl get pods -n ecommerce -w

# 5. Run migrations (exec into API pod)
kubectl exec -it deployment/api -n ecommerce -- pnpm db:migrate:deploy

# 6. Setup ingress
kubectl apply -f infra/k8s/ingress.yml
```

### Option D: AWS with Terraform

```bash
# 1. Initialize Terraform
cd infra/terraform
terraform init

# 2. Plan
terraform plan \
  -var="db_username=ecommerce" \
  -var="db_password=$(openssl rand -hex 32)"

# 3. Apply
terraform apply

# 4. Get outputs
terraform output database_url
terraform output redis_url
```

### Option E: Modern Cloud Stack (Vercel + Supabase + Render)

This approach uses specialized cloud providers for each layer of the application.

#### 1. Database & Auth (Supabase)
1. Create a new project on [Supabase](https://supabase.com).
2. Go to **Project Settings -> Database**.
3. Copy the **Transaction Pooler URL** (usually port 6543) for `DATABASE_URL`.
4. Copy the **Session / Direct URL** (usually port 5432) for `DIRECT_URL`.
5. Run migrations locally against your Supabase database:
   ```bash
   export DATABASE_URL="<your-pooler-url>"
   export DIRECT_URL="<your-direct-url>"
   pnpm db:migrate:deploy
   ```

#### 2. Redis (Upstash or Render)
The inventory and queue systems require Redis. Create a free Redis instance on [Upstash](https://upstash.com/) or [Render](https://render.com) and copy the `REDIS_URL`.

#### 3. Backend & Worker (Render)
1. Push your monorepo to GitHub.
2. In [Render](https://render.com), create a **Web Service** for the API and a **Background Worker** for the worker.
3. **API Service:**
   - **Root Directory:** (leave blank)
   - **Build Command:** `pnpm install && pnpm --filter @ecommerce/api run build`
   - **Start Command:** `cd apps/api && pnpm start`
   - **Env Vars:** Add `DATABASE_URL`, `REDIS_URL`, `RAZORPAY_KEY_ID`, etc.
4. **Worker Service:**
   - **Root Directory:** (leave blank)
   - **Build Command:** `pnpm install && pnpm --filter @ecommerce/worker run build`
   - **Start Command:** `cd apps/worker && pnpm start`
   - **Env Vars:** Same as API.

#### 4. Frontend (Vercel)
1. Go to [Vercel](https://vercel.com) and import your GitHub repository.
2. **Framework Preset:** Next.js
3. **Root Directory:** `apps/web` (Vercel natively supports Turborepo monorepos).
4. **Environment Variables:**
   - `NEXT_PUBLIC_API_URL`: Your Render API URL (e.g., `https://ecommerce-api.onrender.com`)
   - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase Anon Key
5. Click **Deploy**. Vercel will automatically build and deploy the Next.js storefront.

---

## Post-Deploy Verification

- [ ] Health check: `GET /v1/health` returns 200
- [ ] Create test order with Razorpay test keys
- [ ] Verify webhook reception: check API logs
- [ ] Test inventory reservation expiry (wait 15 min)
- [ ] Confirm email delivery (check spam folder)
- [ ] Verify Meilisearch indexing
- [ ] Check Sentry error tracking

---

## Monitoring

### Health Checks
```bash
curl https://api.yourdomain.com/v1/health
```

### Logs
```bash
# Docker
docker compose logs -f api worker

# Kubernetes
kubectl logs -f deployment/api -n ecommerce
kubectl logs -f deployment/worker -n ecommerce
```

---

## Troubleshooting

### Database Connection Issues
- Ensure PgBouncer is between app and Postgres
- Check `DATABASE_URL` vs `DATABASE_POOL_URL`
- Verify SSL mode for managed databases: `?sslmode=require`

### Webhook Failures
- Verify Cloudflare isn't blocking Razorpay IPs
- Check `RAZORPAY_WEBHOOK_SECRET` matches dashboard
- Verify webhook URL is publicly accessible

### Memory Issues
- Increase Node heap: `NODE_OPTIONS="--max-old-space-size=1024"`
- Check for memory leaks in worker processes
- Monitor Redis memory usage

### Slow Queries
- Run `pnpm db:studio` to inspect data
- Check PostgreSQL `pg_stat_statements` for slow queries
- Verify indexes exist on frequently queried columns

### Cart Not Syncing
- Check localStorage in browser DevTools
- Verify Supabase JWT is valid
- Check CORS configuration matches frontend URL
