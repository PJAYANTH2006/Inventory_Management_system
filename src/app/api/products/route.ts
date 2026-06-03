import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { Dimension, Unit } from '@prisma/client';
import { isValidUnitForDimension } from '@/lib/units';

// GET /api/products - Search & List Products
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const dimension = searchParams.get('dimension') as Dimension | null;
    const category = searchParams.get('category') || '';

    // Build Prisma query filter
    const where: any = {};

    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { sku: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { category: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (dimension) {
      where.dimension = dimension;
    }

    if (category) {
      where.category = category;
    }

    const products = await prisma.product.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ products });
  } catch (error) {
    console.error('Fetch products error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// POST /api/products - Create Product (Admin Only)
export async function POST(request: Request) {
  try {
    const session = await getSession();

    if (!session || (session.role !== 'ADMIN' && session.role !== 'SELLER')) {
      return NextResponse.json({ error: 'Forbidden: Admin or Seller access required' }, { status: 403 });
    }

    const body = await request.json();
    const { name, sku, description, category, dimension, stock, price, priceUnit, minStockAlert } = body;

    // Validation
    if (!name || !sku || !dimension || stock === undefined || price === undefined || !priceUnit) {
      return NextResponse.json(
        { error: 'Name, SKU, Dimension, Stock, Price, and PriceUnit are required' },
        { status: 400 }
      );
    }

    // Validate if the pricing unit is valid for the selected dimension
    if (!isValidUnitForDimension(priceUnit as Unit, dimension as Dimension)) {
      return NextResponse.json(
        { error: `Invalid pricing unit "${priceUnit}" for dimension "${dimension}"` },
        { status: 400 }
      );
    }

    // Check SKU uniqueness
    const existingProduct = await prisma.product.findUnique({
      where: { sku },
    });

    if (existingProduct) {
      return NextResponse.json(
        { error: `Product with SKU "${sku}" already exists` },
        { status: 409 }
      );
    }

    const product = await prisma.product.create({
      data: {
        name,
        sku,
        description: description || null,
        category: category || null,
        dimension: dimension as Dimension,
        stock: Number(stock),
        price: Number(price),
        priceUnit: priceUnit as Unit,
        minStockAlert: minStockAlert !== undefined ? Number(minStockAlert) : 0,
      },
    });

    return NextResponse.json({ message: 'Product created successfully', product }, { status: 201 });
  } catch (error) {
    console.error('Create product error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
