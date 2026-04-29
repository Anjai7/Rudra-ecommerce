-- ============================================================
-- E-Commerce Platform — Initial Migration
-- ============================================================
-- Creates all tables, indexes, RLS policies, triggers, and seed data
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For full-text search

-- ─── Enums ──────────────────────────────────────────────────

CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'ADMIN', 'SUPER_ADMIN');
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED', 'EXPIRED');
CREATE TYPE "ReservationStatus" AS ENUM ('ACTIVE', 'CONFIRMED', 'EXPIRED', 'RELEASED');
CREATE TYPE "PaymentProvider" AS ENUM ('RAZORPAY', 'STRIPE', 'COD');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED');
CREATE TYPE "WebhookEventStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED');
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'CHECKOUT', 'PAYMENT', 'REFUND');

-- ─── Users ──────────────────────────────────────────────────

CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "avatar_url" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
    "supabase_uid" TEXT NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_supabase_uid_key" ON "users"("supabase_uid");
CREATE INDEX "users_role_idx" ON "users"("role");
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");

-- ─── Products ───────────────────────────────────────────────

CREATE TABLE "products" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "short_description" TEXT,
    "base_price" DECIMAL(12,2) NOT NULL,
    "compare_at_price" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "brand" TEXT,
    "tags" TEXT[] DEFAULT '{}',
    "images" TEXT[] DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");
CREATE INDEX "products_category_idx" ON "products"("category");
CREATE INDEX "products_is_active_idx" ON "products"("is_active");
CREATE INDEX "products_base_price_idx" ON "products"("base_price");
CREATE INDEX "products_deleted_at_idx" ON "products"("deleted_at");
CREATE INDEX "products_created_at_idx" ON "products"("created_at" DESC);
-- Full-text search index using pg_trgm
CREATE INDEX "products_name_trgm_idx" ON "products" USING gin ("name" gin_trgm_ops);
CREATE INDEX "products_description_trgm_idx" ON "products" USING gin ("description" gin_trgm_ops);

-- ─── Product Variants ───────────────────────────────────────

CREATE TABLE "product_variants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "compare_at_price" DECIMAL(12,2),
    "stock_quantity" INTEGER NOT NULL DEFAULT 0,
    "reserved_quantity" INTEGER NOT NULL DEFAULT 0,
    "low_stock_threshold" INTEGER NOT NULL DEFAULT 5,
    "weight_grams" INTEGER,
    "dimensions" JSONB,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "images" TEXT[] DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "product_variants_sku_key" ON "product_variants"("sku");
CREATE INDEX "product_variants_product_id_idx" ON "product_variants"("product_id");
CREATE INDEX "product_variants_is_active_idx" ON "product_variants"("is_active");
CREATE INDEX "product_variants_stock_idx" ON "product_variants"("stock_quantity");
CREATE INDEX "product_variants_deleted_at_idx" ON "product_variants"("deleted_at");

-- ─── Carts ──────────────────────────────────────────────────

CREATE TABLE "carts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "session_id" TEXT,
    "expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "carts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "carts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX "carts_session_id_key" ON "carts"("session_id");
CREATE INDEX "carts_user_id_idx" ON "carts"("user_id");
CREATE INDEX "carts_expires_at_idx" ON "carts"("expires_at");
CREATE INDEX "carts_deleted_at_idx" ON "carts"("deleted_at");

-- ─── Cart Items ─────────────────────────────────────────────

CREATE TABLE "cart_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cart_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "cart_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE CASCADE,
    CONSTRAINT "cart_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "cart_items_cart_variant_key" ON "cart_items"("cart_id", "variant_id");
CREATE INDEX "cart_items_cart_id_idx" ON "cart_items"("cart_id");
CREATE INDEX "cart_items_variant_id_idx" ON "cart_items"("variant_id");
CREATE INDEX "cart_items_deleted_at_idx" ON "cart_items"("deleted_at");

-- ─── Orders ─────────────────────────────────────────────────

CREATE TABLE "orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "order_number" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "tax_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "shipping_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "shipping_address" JSONB NOT NULL,
    "billing_address" JSONB,
    "notes" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "price_frozen_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "orders_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id")
);

CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");
CREATE UNIQUE INDEX "orders_idempotency_key_key" ON "orders"("idempotency_key");
CREATE INDEX "orders_user_id_idx" ON "orders"("user_id");
CREATE INDEX "orders_status_idx" ON "orders"("status");
CREATE INDEX "orders_created_at_idx" ON "orders"("created_at" DESC);
CREATE INDEX "orders_deleted_at_idx" ON "orders"("deleted_at");

-- ─── Order Items ────────────────────────────────────────────

CREATE TABLE "order_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "product_name" TEXT NOT NULL,
    "variant_name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "total_price" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE,
    CONSTRAINT "order_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id")
);

CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");
CREATE INDEX "order_items_variant_id_idx" ON "order_items"("variant_id");
CREATE INDEX "order_items_deleted_at_idx" ON "order_items"("deleted_at");

-- ─── Inventory Reservations ─────────────────────────────────

CREATE TABLE "inventory_reservations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "variant_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "expires_at" TIMESTAMPTZ NOT NULL,
    "confirmed_at" TIMESTAMPTZ,
    "released_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "inventory_reservations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "inventory_reservations_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id"),
    CONSTRAINT "inventory_reservations_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id")
);

CREATE INDEX "inventory_reservations_variant_id_idx" ON "inventory_reservations"("variant_id");
CREATE INDEX "inventory_reservations_order_id_idx" ON "inventory_reservations"("order_id");
CREATE INDEX "inventory_reservations_status_idx" ON "inventory_reservations"("status");
CREATE INDEX "inventory_reservations_expires_at_idx" ON "inventory_reservations"("expires_at");
CREATE INDEX "inventory_reservations_deleted_at_idx" ON "inventory_reservations"("deleted_at");

-- ─── Payments ───────────────────────────────────────────────

CREATE TABLE "payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'RAZORPAY',
    "provider_order_id" TEXT NOT NULL,
    "provider_payment_id" TEXT,
    "provider_signature" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "method" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "paid_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "payments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id")
);

CREATE UNIQUE INDEX "payments_order_id_key" ON "payments"("order_id");
CREATE UNIQUE INDEX "payments_provider_order_id_key" ON "payments"("provider_order_id");
CREATE INDEX "payments_provider_payment_id_idx" ON "payments"("provider_payment_id");
CREATE INDEX "payments_status_idx" ON "payments"("status");
CREATE INDEX "payments_deleted_at_idx" ON "payments"("deleted_at");

-- ─── Webhook Events ─────────────────────────────────────────

CREATE TABLE "webhook_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider" "PaymentProvider" NOT NULL,
    "event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "WebhookEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "processed_at" TIMESTAMPTZ,
    "error_message" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "webhook_events_event_id_key" ON "webhook_events"("event_id");
CREATE INDEX "webhook_events_event_type_idx" ON "webhook_events"("event_type");
CREATE INDEX "webhook_events_status_idx" ON "webhook_events"("status");
CREATE INDEX "webhook_events_deleted_at_idx" ON "webhook_events"("deleted_at");

-- ─── Audit Logs ─────────────────────────────────────────────

CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "action" "AuditAction" NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "old_values" JSONB,
    "new_values" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs"("entity_type", "entity_id");
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at" DESC);

-- ─── Triggers: Auto-update updated_at ───────────────────────

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'users','products','product_variants','carts','cart_items',
    'orders','order_items','inventory_reservations','payments','webhook_events'
  ]) LOOP
    EXECUTE format(
      'CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at()',
      tbl
    );
  END LOOP;
END;
$$;

-- ─── RLS Policies (for Supabase) ────────────────────────────

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "carts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;

-- Users can read/update only their own profile
CREATE POLICY "users_select_own" ON "users" FOR SELECT USING (supabase_uid = auth.uid()::text);
CREATE POLICY "users_update_own" ON "users" FOR UPDATE USING (supabase_uid = auth.uid()::text);

-- Users can only see their own carts
CREATE POLICY "carts_select_own" ON "carts" FOR SELECT USING (user_id IN (SELECT id FROM users WHERE supabase_uid = auth.uid()::text));
CREATE POLICY "carts_insert_own" ON "carts" FOR INSERT WITH CHECK (user_id IN (SELECT id FROM users WHERE supabase_uid = auth.uid()::text));

-- Users can only see their own orders
CREATE POLICY "orders_select_own" ON "orders" FOR SELECT USING (user_id IN (SELECT id FROM users WHERE supabase_uid = auth.uid()::text));

-- Admin policies
CREATE POLICY "admin_all_users" ON "users" FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE supabase_uid = auth.uid()::text AND role IN ('ADMIN', 'SUPER_ADMIN'))
);

-- ─── Seed Data ──────────────────────────────────────────────

-- Admin user (password managed by Supabase Auth)
INSERT INTO "users" ("id", "email", "full_name", "role", "supabase_uid", "email_verified") VALUES
  ('00000000-0000-0000-0000-000000000001', 'admin@ecommerce.com', 'Platform Admin', 'SUPER_ADMIN', 'admin-supabase-uid', true);

-- Sample products
INSERT INTO "products" ("id", "name", "slug", "description", "short_description", "base_price", "compare_at_price", "category", "brand", "tags", "images") VALUES
  ('10000000-0000-0000-0000-000000000001', 'Premium Wireless Headphones', 'premium-wireless-headphones', 'Experience crystal-clear audio with our flagship wireless headphones featuring active noise cancellation, 40-hour battery life, and premium comfort padding.', 'ANC headphones with 40hr battery', 4999.00, 7999.00, 'Electronics', 'SoundCore', ARRAY['electronics','headphones','wireless','anc'], ARRAY['headphones-1.jpg','headphones-2.jpg']),
  ('10000000-0000-0000-0000-000000000002', 'Organic Cotton T-Shirt', 'organic-cotton-tshirt', 'Sustainably sourced 100% organic cotton t-shirt. Pre-shrunk, breathable, and available in multiple colors and sizes.', 'Sustainable organic cotton tee', 899.00, 1299.00, 'Apparel', 'EcoWear', ARRAY['apparel','tshirt','organic','cotton'], ARRAY['tshirt-1.jpg','tshirt-2.jpg']),
  ('10000000-0000-0000-0000-000000000003', 'Smart Fitness Watch', 'smart-fitness-watch', 'Track your health metrics with GPS, heart rate monitoring, SpO2 sensor, sleep tracking, and 14-day battery life. Water resistant to 50m.', 'GPS fitness watch with health tracking', 3499.00, 5999.00, 'Electronics', 'FitTech', ARRAY['electronics','watch','fitness','smart'], ARRAY['watch-1.jpg','watch-2.jpg']);

-- Sample variants
INSERT INTO "product_variants" ("id", "product_id", "sku", "name", "price", "stock_quantity", "attributes") VALUES
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'HP-BLK-001', 'Black', 4999.00, 50, '{"color": "Black"}'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'HP-WHT-001', 'White', 4999.00, 30, '{"color": "White"}'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'TS-BLK-S', 'Black - S', 899.00, 100, '{"color": "Black", "size": "S"}'),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', 'TS-BLK-M', 'Black - M', 899.00, 150, '{"color": "Black", "size": "M"}'),
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000002', 'TS-BLK-L', 'Black - L', 899.00, 120, '{"color": "Black", "size": "L"}'),
  ('20000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000003', 'FW-BLK-001', 'Black', 3499.00, 75, '{"color": "Black"}'),
  ('20000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000003', 'FW-SLV-001', 'Silver', 3699.00, 40, '{"color": "Silver"}');
