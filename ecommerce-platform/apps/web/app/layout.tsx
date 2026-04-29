import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '../components/providers/query-provider';
import { CartProvider } from '../components/providers/cart-provider';
import { AuthProvider } from '../components/providers/auth-provider';
import Script from 'next/script';

export const metadata: Metadata = {
  title: { default: 'ShopCraft — Premium E-Commerce', template: '%s | ShopCraft' },
  description: 'Discover premium products with fast delivery and secure payments.',
  keywords: ['ecommerce', 'shopping', 'online store', 'premium products'],
  authors: [{ name: 'ShopCraft' }],
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    siteName: 'ShopCraft',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  return (
    <html lang="en">
      <head>
        {gaMeasurementId && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`} strategy="afterInteractive" />
            <Script id="gtag-init" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaMeasurementId}');`}
            </Script>
          </>
        )}
      </head>
      <body className="min-h-screen bg-white text-gray-900 antialiased">
        <Providers>
          <AuthProvider>
            <CartProvider>
              <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-lg">
                <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                  <a href="/" className="text-xl font-bold tracking-tight text-brand-700">ShopCraft</a>
                  <nav className="hidden items-center gap-8 md:flex">
                    <a href="/" className="text-sm font-medium text-gray-600 transition hover:text-brand-600">Home</a>
                    <a href="/products" className="text-sm font-medium text-gray-600 transition hover:text-brand-600">Products</a>
                  </nav>
                  <div className="flex items-center gap-4">
                    <a href="/checkout" className="relative inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700">
                      Cart
                    </a>
                  </div>
                </div>
              </header>
              <main className="page-transition">{children}</main>
              <footer className="mt-auto border-t border-gray-100 bg-gray-50 py-12">
                <div className="mx-auto max-w-7xl px-4 text-center text-sm text-gray-500">
                  © {new Date().getFullYear()} ShopCraft. All rights reserved.
                </div>
              </footer>
            </CartProvider>
          </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}
