import Link from 'next/link';
import type { Product } from '@ecommerce/shared-types';

async function getProducts(): Promise<Product[]> {
  try {
    const res = await fetch(`${process.env.API_URL || 'http://localhost:4000'}/v1/products?limit=12`, {
      next: { revalidate: 60 },
    });
    const data = await res.json();
    return data.data || [];
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const products = await getProducts();

  return (
    <div className="page-transition">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-50 via-white to-purple-50">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
          <div className="max-w-2xl">
            <span className="inline-block rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700">
              New Collection 2024
            </span>
            <h1 className="mt-6 text-5xl font-extrabold tracking-tight text-gray-900 sm:text-6xl lg:text-7xl">
              Discover <span className="bg-gradient-to-r from-brand-600 to-purple-600 bg-clip-text text-transparent">Premium</span> Products
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-gray-600">
              Curated selection of high-quality products with secure payments and lightning-fast delivery across India.
            </p>
            <div className="mt-8 flex gap-4">
              <a href="#products" className="rounded-full bg-brand-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-200 transition hover:bg-brand-700 hover:shadow-xl">
                Shop Now
              </a>
              <a href="/products" className="rounded-full border border-gray-200 bg-white px-8 py-3.5 text-sm font-semibold text-gray-700 transition hover:border-brand-200 hover:text-brand-600">
                Browse All
              </a>
            </div>
          </div>
        </div>
        {/* Decorative elements */}
        <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-brand-100/50 blur-3xl" />
        <div className="absolute -bottom-20 right-40 h-60 w-60 rounded-full bg-purple-100/50 blur-3xl" />
      </section>

      {/* Product Grid */}
      <section id="products" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">Featured Products</h2>
          <p className="mt-3 text-gray-500">Handpicked just for you</p>
        </div>

        {products.length > 0 ? (
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product: any) => (
              <Link
                key={product.id}
                href={`/product/${product.slug}`}
                className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-1 transition-all hover:border-brand-200 hover:shadow-lg hover:shadow-brand-50"
              >
                <div className="aspect-square overflow-hidden rounded-xl bg-gray-50">
                  <div className="flex h-full items-center justify-center text-6xl">🛍️</div>
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-brand-600">{product.category}</p>
                      <h3 className="mt-1 text-lg font-semibold text-gray-900 group-hover:text-brand-700 transition">{product.name}</h3>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-gray-500 line-clamp-2">{product.short_description}</p>
                  <div className="mt-4 flex items-center gap-3">
                    <span className="text-xl font-bold text-gray-900">₹{Number(product.base_price).toLocaleString('en-IN')}</span>
                    {product.compare_at_price && (
                      <span className="text-sm text-gray-400 line-through">₹{Number(product.compare_at_price).toLocaleString('en-IN')}</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 p-16 text-center">
            <p className="text-lg text-gray-400">No products yet. Start the API server and seed the database.</p>
            <code className="mt-4 inline-block rounded bg-gray-100 px-4 py-2 text-sm text-gray-600">pnpm db:seed</code>
          </div>
        )}
      </section>
    </div>
  );
}
