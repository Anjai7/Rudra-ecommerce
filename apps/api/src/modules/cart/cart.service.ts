// ============================================================
// Cart Service
// ============================================================

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { prisma } from '@ecommerce/database';

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  /** Get or create cart for user or session */
  async getOrCreateCart(userId?: string, sessionId?: string) {
    if (!userId && !sessionId) {
      throw new BadRequestException('User ID or session ID required');
    }

    let cart = await prisma.cart.findFirst({
      where: userId ? { user_id: userId } : { session_id: sessionId },
      include: {
        items: {
          where: { deleted_at: null },
          include: { variant: { include: { product: true } } },
        },
      },
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: { user_id: userId, session_id: sessionId },
        include: {
          items: {
            where: { deleted_at: null },
            include: { variant: { include: { product: true } } },
          },
        },
      });
    }

    return { success: true, data: cart };
  }

  /** Add item to cart with stock validation */
  async addItem(cartId: string, variantId: string, quantity: number) {
    // Validate variant exists and has stock
    const variant = await prisma.productVariant.findFirst({
      where: { id: variantId, is_active: true, deleted_at: null },
    });

    if (!variant) throw new NotFoundException('Product variant not found');

    const availableStock = variant.stock_quantity - variant.reserved_quantity;
    if (availableStock < quantity) {
      throw new BadRequestException(
        `Insufficient stock. Available: ${availableStock}, requested: ${quantity}`,
      );
    }

    // Upsert cart item (update quantity if already in cart)
    const existingItem = await prisma.cartItem.findFirst({
      where: { cart_id: cartId, variant_id: variantId, deleted_at: null },
    });

    let item;
    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity;
      if (availableStock < newQuantity) {
        throw new BadRequestException(`Cannot add ${quantity} more. Max available: ${availableStock - existingItem.quantity}`);
      }
      item = await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQuantity, unit_price: variant.price },
        include: { variant: { include: { product: true } } },
      });
    } else {
      item = await prisma.cartItem.create({
        data: {
          cart_id: cartId,
          variant_id: variantId,
          quantity,
          unit_price: variant.price,
        },
        include: { variant: { include: { product: true } } },
      });
    }

    return { success: true, data: item };
  }

  /** Update cart item quantity */
  async updateItem(cartId: string, itemId: string, quantity: number) {
    if (quantity <= 0) {
      return this.removeItem(cartId, itemId);
    }

    const item = await prisma.cartItem.findFirst({
      where: { id: itemId, cart_id: cartId, deleted_at: null },
      include: { variant: true },
    });

    if (!item) throw new NotFoundException('Cart item not found');

    const available = item.variant.stock_quantity - item.variant.reserved_quantity;
    if (available < quantity) {
      throw new BadRequestException(`Only ${available} available`);
    }

    const updated = await prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity, unit_price: item.variant.price },
      include: { variant: { include: { product: true } } },
    });

    return { success: true, data: updated };
  }

  /** Remove item from cart */
  async removeItem(_cartId: string, itemId: string) {
    await prisma.cartItem.delete({ where: { id: itemId } });
    return { success: true, data: null, message: 'Item removed' };
  }

  /** Merge anonymous cart into user cart on login */
  async mergeCarts(sessionId: string, userId: string) {
    const [anonCart, userCart] = await Promise.all([
      prisma.cart.findFirst({
        where: { session_id: sessionId, deleted_at: null },
        include: { items: { where: { deleted_at: null } } },
      }),
      prisma.cart.findFirst({
        where: { user_id: userId, deleted_at: null },
        include: { items: { where: { deleted_at: null } } },
      }),
    ]);

    if (!anonCart || anonCart.items.length === 0) return;

    const targetCart = userCart || await prisma.cart.create({ data: { user_id: userId } });

    // Merge items, preferring larger quantity
    for (const anonItem of anonCart.items) {
      const existing = userCart?.items.find((i) => i.variant_id === anonItem.variant_id);
      if (existing) {
        const maxQty = Math.max(existing.quantity, anonItem.quantity);
        await prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: maxQty } });
      } else {
        await prisma.cartItem.create({
          data: {
            cart_id: targetCart.id,
            variant_id: anonItem.variant_id,
            quantity: anonItem.quantity,
            unit_price: anonItem.unit_price,
          },
        });
      }
    }

    // Soft-delete anonymous cart
    await prisma.cart.delete({ where: { id: anonCart.id } });
    this.logger.log(`Merged anonymous cart ${anonCart.id} into user cart for ${userId}`);
  }
}
