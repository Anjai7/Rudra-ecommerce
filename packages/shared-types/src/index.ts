// ============================================================
// E-Commerce Platform — Shared Type Definitions
// ============================================================

// ─── Enums ──────────────────────────────────────────────────

export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
  EXPIRED = 'EXPIRED',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  AUTHORIZED = 'AUTHORIZED',
  CAPTURED = 'CAPTURED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum PaymentProvider {
  RAZORPAY = 'RAZORPAY',
  STRIPE = 'STRIPE',
  COD = 'COD',
}

export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
}

export enum ReservationStatus {
  ACTIVE = 'ACTIVE',
  CONFIRMED = 'CONFIRMED',
  EXPIRED = 'EXPIRED',
  RELEASED = 'RELEASED',
}

export enum WebhookEventStatus {
  RECEIVED = 'RECEIVED',
  PROCESSING = 'PROCESSING',
  PROCESSED = 'PROCESSED',
  FAILED = 'FAILED',
}

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  CHECKOUT = 'CHECKOUT',
  PAYMENT = 'PAYMENT',
  REFUND = 'REFUND',
}

// ─── Base Types ─────────────────────────────────────────────

export interface BaseEntity {
  id: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

// ─── User ───────────────────────────────────────────────────

export interface User extends BaseEntity {
  email: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  role: UserRole;
  supabase_uid: string;
  email_verified: boolean;
  metadata: Record<string, unknown>;
}

export interface CreateUserDto {
  email: string;
  full_name: string;
  phone?: string;
  supabase_uid: string;
  role?: UserRole;
}

// ─── Product ────────────────────────────────────────────────

export interface Product extends BaseEntity {
  name: string;
  slug: string;
  description: string;
  short_description: string | null;
  base_price: number;
  compare_at_price: number | null;
  currency: string;
  category: string;
  subcategory: string | null;
  brand: string | null;
  tags: string[];
  images: string[];
  is_active: boolean;
  metadata: Record<string, unknown>;
  variants?: ProductVariant[];
}

export interface ProductVariant extends BaseEntity {
  product_id: string;
  sku: string;
  name: string;
  price: number;
  compare_at_price: number | null;
  stock_quantity: number;
  reserved_quantity: number;
  low_stock_threshold: number;
  weight_grams: number | null;
  dimensions: Record<string, unknown> | null;
  attributes: Record<string, string>;
  images: string[];
  is_active: boolean;
}

export interface CreateProductDto {
  name: string;
  slug: string;
  description: string;
  short_description?: string;
  base_price: number;
  compare_at_price?: number;
  currency?: string;
  category: string;
  subcategory?: string;
  brand?: string;
  tags?: string[];
  images?: string[];
}

export interface ProductListQuery {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  min_price?: number;
  max_price?: number;
  sort_by?: 'price' | 'name' | 'created_at';
  sort_order?: 'asc' | 'desc';
  in_stock?: boolean;
}

// ─── Cart ───────────────────────────────────────────────────

export interface Cart extends BaseEntity {
  user_id: string | null;
  session_id: string | null;
  items: CartItem[];
  expires_at: Date | null;
}

export interface CartItem extends BaseEntity {
  cart_id: string;
  variant_id: string;
  quantity: number;
  unit_price: number;
  variant?: ProductVariant;
}

export interface AddToCartDto {
  variant_id: string;
  quantity: number;
}

export interface UpdateCartItemDto {
  quantity: number;
}

// ─── Order ──────────────────────────────────────────────────

export interface Order extends BaseEntity {
  user_id: string;
  order_number: string;
  status: OrderStatus;
  subtotal: number;
  tax_amount: number;
  shipping_amount: number;
  discount_amount: number;
  total_amount: number;
  currency: string;
  shipping_address: ShippingAddress;
  billing_address: ShippingAddress | null;
  notes: string | null;
  idempotency_key: string;
  price_frozen_at: Date;
  items?: OrderItem[];
  payment?: Payment;
}

export interface OrderItem extends BaseEntity {
  order_id: string;
  variant_id: string;
  product_name: string;
  variant_name: string;
  sku: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  variant?: ProductVariant;
}

export interface ShippingAddress {
  full_name: string;
  phone: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

export interface CreateCheckoutDto {
  idempotency_key: string;
  shipping_address: ShippingAddress;
  billing_address?: ShippingAddress;
  notes?: string;
}

export interface CheckoutResponse {
  order: Order;
  razorpay_order_id: string;
  razorpay_key_id: string;
  amount: number;
  currency: string;
}

// ─── Payment ────────────────────────────────────────────────

export interface Payment extends BaseEntity {
  order_id: string;
  provider: PaymentProvider;
  provider_order_id: string;
  provider_payment_id: string | null;
  provider_signature: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  method: string | null;
  metadata: Record<string, unknown>;
  paid_at: Date | null;
}

// ─── Inventory ──────────────────────────────────────────────

export interface InventoryReservation extends BaseEntity {
  variant_id: string;
  order_id: string;
  quantity: number;
  status: ReservationStatus;
  expires_at: Date;
  confirmed_at: Date | null;
  released_at: Date | null;
}

// ─── Webhooks ───────────────────────────────────────────────

export interface WebhookEvent extends BaseEntity {
  provider: PaymentProvider;
  event_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  status: WebhookEventStatus;
  processed_at: Date | null;
  error_message: string | null;
  retry_count: number;
}

// ─── Audit Log ──────────────────────────────────────────────

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: AuditAction;
  entity_type: string;
  entity_id: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
}

// ─── API Responses ──────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  timestamp: string;
  path: string;
}

// ─── Queue Job Types ────────────────────────────────────────

export interface PaymentConfirmationJob {
  order_id: string;
  payment_id: string;
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface ReservationExpiryJob {
  reservation_id: string;
  order_id: string;
  variant_id: string;
  quantity: number;
}

export interface EmailJob {
  type: 'ORDER_CONFIRMATION' | 'SHIPPING_NOTIFICATION' | 'PAYMENT_FAILED' | 'WELCOME';
  to: string;
  subject: string;
  template_data: Record<string, unknown>;
}

export interface ReconciliationJob {
  date: string;
  provider: PaymentProvider;
}
