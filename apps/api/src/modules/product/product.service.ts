// ============================================================
// Product Service
// ============================================================

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { prisma } from '@ecommerce/database';
import type { ProductListQuery } from '@ecommerce/shared-types';
import type { Prisma } from '@prisma/client';

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  async findAll(query: ProductListQuery) {
    const { page = 1, limit = 20, search, category, min_price, max_price, sort_by = 'created_at', sort_order = 'desc', in_stock } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {
      is_active: true,
      deleted_at: null,
      ...(category && { category }),
      ...(min_price !== undefined && { base_price: { gte: min_price } }),
      ...(max_price !== undefined && { base_price: { ...((min_price !== undefined ? { gte: min_price } : {}) as any), lte: max_price } }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } },
          { tags: { has: search.toLowerCase() } },
        ],
      }),
      ...(in_stock && {
        variants: { some: { stock_quantity: { gt: 0 }, is_active: true } },
      }),
    };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { variants: { where: { is_active: true, deleted_at: null } } },
        orderBy: { [sort_by]: sort_order },
        skip,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    return {
      success: true,
      data: products,
      meta: {
        page, limit, total,
        total_pages: Math.ceil(total / limit),
        has_next: page * limit < total,
        has_prev: page > 1,
      },
    };
  }

  async findBySlug(slug: string) {
    const product = await prisma.product.findFirst({
      where: { slug, is_active: true, deleted_at: null },
      include: { variants: { where: { is_active: true, deleted_at: null } } },
    });
    if (!product) throw new NotFoundException(`Product "${slug}" not found`);
    return { success: true, data: product };
  }

  async findById(id: string) {
    const product = await prisma.product.findFirst({
      where: { id, deleted_at: null },
      include: { variants: { where: { deleted_at: null } } },
    });
    if (!product) throw new NotFoundException(`Product not found`);
    return { success: true, data: product };
  }

  async create(data: Prisma.ProductCreateInput) {
    const product = await prisma.product.create({ data, include: { variants: true } });
    this.logger.log(`Product created: ${product.id} — ${product.name}`);
    return { success: true, data: product };
  }

  async update(id: string, data: Prisma.ProductUpdateInput) {
    const product = await prisma.product.update({ where: { id }, data, include: { variants: true } });
    return { success: true, data: product };
  }

  async remove(id: string) {
    await prisma.product.delete({ where: { id } });
    return { success: true, data: null, message: 'Product deleted' };
  }
}
