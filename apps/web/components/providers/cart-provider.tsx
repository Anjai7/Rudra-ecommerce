'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createContext, useContext, type ReactNode } from 'react';

interface CartItem {
  variant_id: string;
  variant?: any;
  product?: any;
  quantity: number;
  unit_price: number;
}

interface CartState {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  removeItem: (variantId: string) => void;
  clearCart: () => void;
  totalAmount: () => number;
  totalItems: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (newItem) => {
        set((state) => {
          const existing = state.items.find((i) => i.variant_id === newItem.variant_id);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.variant_id === newItem.variant_id
                  ? { ...i, quantity: i.quantity + newItem.quantity }
                  : i,
              ),
            };
          }
          return { items: [...state.items, newItem] };
        });
      },

      updateQuantity: (variantId, quantity) => {
        set((state) => ({
          items: quantity <= 0
            ? state.items.filter((i) => i.variant_id !== variantId)
            : state.items.map((i) =>
                i.variant_id === variantId ? { ...i, quantity } : i,
              ),
        }));
      },

      removeItem: (variantId) => {
        set((state) => ({
          items: state.items.filter((i) => i.variant_id !== variantId),
        }));
      },

      clearCart: () => set({ items: [] }),

      totalAmount: () =>
        get().items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0),

      totalItems: () =>
        get().items.reduce((sum, item) => sum + item.quantity, 0),
    }),
    {
      name: 'ecommerce-cart',
      partialize: (state) => ({
        items: state.items.map(({ variant_id, quantity, unit_price, product, variant }) => ({
          variant_id,
          quantity,
          unit_price,
          product: product ? { name: product.name, slug: product.slug } : undefined,
          variant: variant ? { name: variant.name, sku: variant.sku } : undefined,
        })),
      }),
    },
  ),
);

// Provider wrapper (for layout)
export function CartProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
