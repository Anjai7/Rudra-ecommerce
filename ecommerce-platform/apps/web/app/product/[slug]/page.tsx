'use client';

import { useState } from 'react';
import { useCartStore } from '../../../components/providers/cart-provider';
import toast from 'react-hot-toast';
import type { Product, ProductVariant } from '@ecommerce/shared-types';

async function getProduct(slug: string): Promise<Product | null> {
  try {
    const res = await fetch(`${process.env.API_URL || 'http://localhost:4000'}/v1/products/${slug}`, {
      next: { revalidate: 30 },
    });
    const data = await res.json();
    return data.data || null;
  } catch {
    return null;
  }
}

// Server component wrapper
export default async function ProductPage({ params }: { params: { slug: string } }) {
  const product = await getProduct(params.slug);

  if (!product) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-32 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Product Not Found</h1>
        <p className="mt-3 text-gray-500">The product you're looking for doesn't exist.</p>
        <a href="/" className="mt-6 inline-block rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white">
          Back to Home
        </a>
      </div>
    );
  }

  return <ProductDetail product={product} />;
}

// Client component for interactivity
function ProductDetail({ product }: { product: any }) {
  const variants = product.variants || [];
  const [selectedVariant, setSelectedVariant] = useState<any>(variants[0] || null);
  const [quantity, setQuantity] = useState(1);
  const addItem = useCartStore((s) => s.addItem);

  const availableStock = selectedVariant
    ? selectedVariant.stock_quantity - selectedVariant.reserved_quantity
    : 0;

  const handleAddToCart = () => {
    if (!selectedVariant) return;
    addItem({
      variant_id: selectedVariant.id,
      variant: selectedVariant,
      product,
      quantity,
      unit_price: Number(selectedVariant.price),
    });
    toast.success(`Added ${product.name} to cart!`);
  };

  return (
    <div className="page-transition mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="grid gap-12 lg:grid-cols-2">
        {/* Product Image */}
        <div className="aspect-square overflow-hidden rounded-3xl bg-gradient-to-br from-gray-50 to-gray-100">
          <div className="flex h-full items-center justify-center text-9xl">🛍️</div>
        </div>

        {/* Product Info */}
        <div className="flex flex-col justify-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">{product.category}</p>
          <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-gray-900">{product.name}</h1>

          <div className="mt-4 flex items-baseline gap-3">
            <span className="text-3xl font-bold text-gray-900">
              ₹{Number(selectedVariant?.price || product.base_price).toLocaleString('en-IN')}
            </span>
            {product.compare_at_price && (
              <>
                <span className="text-lg text-gray-400 line-through">
                  ₹{Number(product.compare_at_price).toLocaleString('en-IN')}
                </span>
                <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                  {Math.round((1 - Number(product.base_price) / Number(product.compare_at_price)) * 100)}% off
                </span>
              </>
            )}
          </div>

          <p className="mt-6 text-gray-600 leading-relaxed">{product.description}</p>

          {/* Variant Selector */}
          {variants.length > 0 && (
            <div className="mt-8">
              <p className="text-sm font-semibold text-gray-700">Select Variant</p>
              <div className="mt-3 flex flex-wrap gap-3">
                {variants.map((v: any) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVariant(v)}
                    className={`rounded-xl border-2 px-4 py-2.5 text-sm font-medium transition ${
                      selectedVariant?.id === v.id
                        ? 'border-brand-600 bg-brand-50 text-brand-700'
                        : 'border-gray-200 text-gray-600 hover:border-brand-200'
                    }`}
                  >
                    {v.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Stock Indicator */}
          <div className="mt-6">
            {availableStock > 10 ? (
              <p className="text-sm font-medium text-green-600">✓ In Stock</p>
            ) : availableStock > 0 ? (
              <p className="text-sm font-medium text-amber-600">⚠ Only {availableStock} left</p>
            ) : (
              <p className="text-sm font-medium text-red-600">✕ Out of Stock</p>
            )}
          </div>

          {/* Quantity & Add to Cart */}
          <div className="mt-8 flex items-center gap-4">
            <div className="flex items-center rounded-xl border border-gray-200">
              <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="px-4 py-3 text-gray-500 hover:text-gray-700">−</button>
              <span className="min-w-[3rem] text-center font-semibold">{quantity}</span>
              <button onClick={() => setQuantity(Math.min(availableStock, quantity + 1))} className="px-4 py-3 text-gray-500 hover:text-gray-700">+</button>
            </div>
            <button
              onClick={handleAddToCart}
              disabled={availableStock === 0}
              className="flex-1 rounded-xl bg-brand-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-200 transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none"
            >
              Add to Cart
            </button>
          </div>

          {/* Tags */}
          {product.tags?.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-2">
              {product.tags.map((tag: string) => (
                <span key={tag} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
