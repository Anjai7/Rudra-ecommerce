// ============================================================
// Database Seed Script
// ============================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.info('🌱 Seeding database...');

  // Admin user
  const admin = await prisma.user.upsert({
    where: { email: 'admin@ecommerce.com' },
    update: {},
    create: {
      email: 'admin@ecommerce.com',
      full_name: 'Platform Admin',
      role: 'SUPER_ADMIN',
      supabase_uid: 'admin-supabase-uid',
      email_verified: true,
    },
  });
  console.info(`  ✅ Admin user: ${admin.email}`);

  // Products
  const headphones = await prisma.product.upsert({
    where: { slug: 'premium-wireless-headphones' },
    update: {},
    create: {
      name: 'Premium Wireless Headphones',
      slug: 'premium-wireless-headphones',
      description: 'Crystal-clear audio with ANC, 40-hour battery, premium comfort.',
      short_description: 'ANC headphones with 40hr battery',
      base_price: 4999.0,
      compare_at_price: 7999.0,
      category: 'Electronics',
      brand: 'SoundCore',
      tags: ['electronics', 'headphones', 'wireless', 'anc'],
      images: ['headphones-1.jpg', 'headphones-2.jpg'],
    },
  });

  const tshirt = await prisma.product.upsert({
    where: { slug: 'organic-cotton-tshirt' },
    update: {},
    create: {
      name: 'Organic Cotton T-Shirt',
      slug: 'organic-cotton-tshirt',
      description: '100% organic cotton, pre-shrunk, breathable.',
      short_description: 'Sustainable organic cotton tee',
      base_price: 899.0,
      compare_at_price: 1299.0,
      category: 'Apparel',
      brand: 'EcoWear',
      tags: ['apparel', 'tshirt', 'organic'],
      images: ['tshirt-1.jpg', 'tshirt-2.jpg'],
    },
  });

  const watch = await prisma.product.upsert({
    where: { slug: 'smart-fitness-watch' },
    update: {},
    create: {
      name: 'Smart Fitness Watch',
      slug: 'smart-fitness-watch',
      description: 'GPS, heart rate, SpO2, sleep tracking, 14-day battery.',
      short_description: 'GPS fitness watch with health tracking',
      base_price: 3499.0,
      compare_at_price: 5999.0,
      category: 'Electronics',
      brand: 'FitTech',
      tags: ['electronics', 'watch', 'fitness'],
      images: ['watch-1.jpg', 'watch-2.jpg'],
    },
  });

  console.info(`  ✅ Products: ${headphones.name}, ${tshirt.name}, ${watch.name}`);

  // Variants
  const variants = [
    { product_id: headphones.id, sku: 'HP-BLK-001', name: 'Black', price: 4999.0, stock_quantity: 50, attributes: { color: 'Black' } },
    { product_id: headphones.id, sku: 'HP-WHT-001', name: 'White', price: 4999.0, stock_quantity: 30, attributes: { color: 'White' } },
    { product_id: tshirt.id, sku: 'TS-BLK-S', name: 'Black - S', price: 899.0, stock_quantity: 100, attributes: { color: 'Black', size: 'S' } },
    { product_id: tshirt.id, sku: 'TS-BLK-M', name: 'Black - M', price: 899.0, stock_quantity: 150, attributes: { color: 'Black', size: 'M' } },
    { product_id: tshirt.id, sku: 'TS-BLK-L', name: 'Black - L', price: 899.0, stock_quantity: 120, attributes: { color: 'Black', size: 'L' } },
    { product_id: watch.id, sku: 'FW-BLK-001', name: 'Black', price: 3499.0, stock_quantity: 75, attributes: { color: 'Black' } },
    { product_id: watch.id, sku: 'FW-SLV-001', name: 'Silver', price: 3699.0, stock_quantity: 40, attributes: { color: 'Silver' } },
  ];

  for (const v of variants) {
    await prisma.productVariant.upsert({
      where: { sku: v.sku },
      update: {},
      create: v,
    });
  }
  console.info(`  ✅ Variants: ${variants.length} created`);

  console.info('🎉 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
