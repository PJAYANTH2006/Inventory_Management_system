import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { Dimension, Unit } from '@prisma/client';
import { isValidUnitForDimension } from '@/lib/units';

// PUT /api/products/[id] - Update Product (Admin Only)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();

    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, sku, description, category, dimension, stock, price, priceUnit, minStockAlert } = body;

    // Check if product exists
    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Valdiations if supplied
    if (sku && sku !== existingProduct.sku) {
      const skuConflict = await prisma.product.findUnique({
        where: { sku },
      });
      if (skuConflict) {
        return NextResponse.json({ error: `Product with SKU "${sku}" already exists` }, { status: 409 });
      }
    }

    const finalDimension = (dimension || existingProduct.dimension) as Dimension;
    const finalPriceUnit = (priceUnit || existingProduct.priceUnit) as Unit;

    if (dimension || priceUnit) {
      if (!isValidUnitForDimension(finalPriceUnit, finalDimension)) {
        return NextResponse.json(
          { error: `Invalid pricing unit "${finalPriceUnit}" for dimension "${finalDimension}"` },
          { status: 400 }
        );
      }
    }

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        name: name !== undefined ? name : existingProduct.name,
        sku: sku !== undefined ? sku : existingProduct.sku,
        description: description !== undefined ? description : existingProduct.description,
        category: category !== undefined ? category : existingProduct.category,
        dimension: finalDimension,
        stock: stock !== undefined ? Number(stock) : existingProduct.stock,
        price: price !== undefined ? Number(price) : existingProduct.price,
        priceUnit: finalPriceUnit,
        minStockAlert: minStockAlert !== undefined ? Number(minStockAlert) : existingProduct.minStockAlert,
      },
    });

    return NextResponse.json({ message: 'Product updated successfully', product: updatedProduct });
  } catch (error) {
    console.error('Update product error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// DELETE /api/products/[id] - Delete Product (Admin Only)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();

    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { id } = await params;

    // Check if product exists
    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Check if there are order items referencing it
    const orderItemsCount = await prisma.orderItem.count({
      where: { productId: id },
    });

    if (orderItemsCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete product because it has associated orders/quotations' },
        { status: 400 }
      );
    }

    await prisma.product.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete product error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
