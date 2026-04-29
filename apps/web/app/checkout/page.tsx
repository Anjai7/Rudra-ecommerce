'use client';

import { useState } from 'react';
import { useCartStore } from '../../components/providers/cart-provider';
import { apiClient } from '../../lib/api/client';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';

declare global {
  interface Window { Razorpay: any; }
}

export default function CheckoutPage() {
  const { items, totalAmount, clearCart } = useCartStore();
  const [loading, setLoading] = useState(false);
  const [address, setAddress] = useState({
    full_name: '', phone: '', address_line_1: '', address_line_2: '',
    city: '', state: '', postal_code: '', country: 'India',
  });

  const subtotal = totalAmount();
  const tax = Math.round(subtotal * 0.18 * 100) / 100;
  const shipping = subtotal > 999 ? 0 : 99;
  const total = subtotal + tax + shipping;

  const handleCheckout = async () => {
    if (items.length === 0) return toast.error('Cart is empty');
    if (!address.full_name || !address.phone || !address.address_line_1 || !address.city || !address.state || !address.postal_code) {
      return toast.error('Please fill all required fields');
    }

    setLoading(true);
    try {
      // Create checkout (server creates Razorpay order)
      const { data } = await apiClient.post('/v1/checkout', {
        idempotency_key: uuidv4(),
        shipping_address: address,
      });

      const checkoutData = data;

      // Load Razorpay Checkout.js
      const options = {
        key: checkoutData.razorpay_key_id,
        amount: checkoutData.amount,
        currency: checkoutData.currency,
        name: 'ShopCraft',
        description: `Order ${checkoutData.order.order_number}`,
        order_id: checkoutData.razorpay_order_id,
        handler: async (response: any) => {
          // Verify payment on server
          try {
            await apiClient.post('/v1/payments/verify', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            clearCart();
            toast.success('Payment successful! Order confirmed.');
            window.location.href = '/orders';
          } catch {
            toast.error('Payment verification failed. Contact support.');
          }
        },
        prefill: {
          name: address.full_name,
          contact: address.phone,
        },
        theme: { color: '#4c6ef5' },
        modal: {
          ondismiss: () => {
            toast('Payment cancelled. Your items are reserved for 15 minutes.', { icon: '⏱️' });
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Checkout failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-transition mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Razorpay SDK */}
      <script src="https://checkout.razorpay.com/v1/checkout.js" async />

      <h1 className="text-3xl font-bold tracking-tight text-gray-900">Checkout</h1>

      <div className="mt-10 grid gap-12 lg:grid-cols-3">
        {/* Shipping Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-gray-100 bg-white p-8">
            <h2 className="text-xl font-semibold text-gray-900">Shipping Address</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <input placeholder="Full Name *" value={address.full_name} onChange={(e) => setAddress({ ...address, full_name: e.target.value })}
                className="rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100" />
              <input placeholder="Phone *" value={address.phone} onChange={(e) => setAddress({ ...address, phone: e.target.value })}
                className="rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100" />
              <input placeholder="Address Line 1 *" value={address.address_line_1} onChange={(e) => setAddress({ ...address, address_line_1: e.target.value })}
                className="col-span-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100" />
              <input placeholder="Address Line 2" value={address.address_line_2} onChange={(e) => setAddress({ ...address, address_line_2: e.target.value })}
                className="col-span-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100" />
              <input placeholder="City *" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })}
                className="rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100" />
              <input placeholder="State *" value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value })}
                className="rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100" />
              <input placeholder="Postal Code *" value={address.postal_code} onChange={(e) => setAddress({ ...address, postal_code: e.target.value })}
                className="rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100" />
              <input placeholder="Country" value={address.country} disabled
                className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500" />
            </div>
          </div>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 rounded-2xl border border-gray-100 bg-white p-8">
            <h2 className="text-xl font-semibold text-gray-900">Order Summary</h2>
            <div className="mt-6 space-y-4">
              {items.map((item) => (
                <div key={item.variant_id} className="flex justify-between text-sm">
                  <span className="text-gray-600">{item.product?.name} × {item.quantity}</span>
                  <span className="font-medium">₹{(item.unit_price * item.quantity).toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 space-y-3 border-t border-gray-100 pt-6">
              <div className="flex justify-between text-sm"><span className="text-gray-500">Subtotal</span><span>₹{subtotal.toLocaleString('en-IN')}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">GST (18%)</span><span>₹{tax.toLocaleString('en-IN')}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Shipping</span><span>{shipping === 0 ? 'Free' : `₹${shipping}`}</span></div>
              <div className="flex justify-between border-t border-gray-100 pt-3 text-lg font-bold">
                <span>Total</span><span>₹{total.toLocaleString('en-IN')}</span>
              </div>
            </div>
            <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-700">⏱️ Prices frozen at checkout. Stock reserved for 15 minutes.</p>
            <button
              onClick={handleCheckout}
              disabled={loading || items.length === 0}
              className="mt-6 w-full rounded-xl bg-brand-600 py-4 text-sm font-semibold text-white shadow-lg shadow-brand-200 transition hover:bg-brand-700 disabled:bg-gray-300"
            >
              {loading ? 'Processing...' : `Pay ₹${total.toLocaleString('en-IN')}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
