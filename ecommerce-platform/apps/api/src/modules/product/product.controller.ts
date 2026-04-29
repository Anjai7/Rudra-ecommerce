// ============================================================
// Product Controller
// ============================================================

import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ProductService } from './product.service';
import { Public, Roles } from '../../guards/jwt-auth.guard';

@ApiTags('products')
@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  @Public()
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'min_price', required: false, type: Number })
  @ApiQuery({ name: 'max_price', required: false, type: Number })
  @ApiQuery({ name: 'sort_by', required: false, enum: ['price', 'name', 'created_at'] })
  @ApiQuery({ name: 'sort_order', required: false, enum: ['asc', 'desc'] })
  findAll(@Query() query: any) {
    return this.productService.findAll(query);
  }

  @Get(':slug')
  @Public()
  findBySlug(@Param('slug') slug: string) {
    return this.productService.findBySlug(slug);
  }

  @Post()
  @ApiBearerAuth()
  @Roles('ADMIN', 'SUPER_ADMIN')
  create(@Body() body: any) {
    return this.productService.create(body);
  }

  @Put(':id')
  @ApiBearerAuth()
  @Roles('ADMIN', 'SUPER_ADMIN')
  update(@Param('id') id: string, @Body() body: any) {
    return this.productService.update(id, body);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles('ADMIN', 'SUPER_ADMIN')
  remove(@Param('id') id: string) {
    return this.productService.remove(id);
  }
}
