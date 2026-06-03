import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { Unit } from '@prisma/client';
import { toBaseUnit, calculatePrice, isValidUnitForDimension } from '@/lib/units';
import { Decimal } from 'decimal.js';

// GET /api/orders - List Orders/Quotations
export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const where = session.role === 'ADMIN' ? {} : { userId: session.id };

    const orders = await prisma.order.findMany({
      where,
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                name: true,
                sku: true,
                dimension: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ orders });
  } catch (error) {
    console.error('Fetch orders error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// POST /api/orders - Place Order
export async function POST(request: Request) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { items } = body as {
      items: {
        productId: string;
        orderedQuantity: number;
        orderedUnit: string;
      }[];
    };

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Order must contain at least one item' }, { status: 400 });
    }

    // Step 1: Pre-validate all items and calculate pricing
    const validatedItems: {
      productId: string;
      orderedQuantity: Decimal;
      orderedUnit: Unit;
      baseQuantity: Decimal;
      priceAtOrder: Decimal;
      priceUnitAtOrder: Unit;
      calculatedPrice: Decimal;
      productName: string;
      currentStock: Decimal;
    }[] = [];

    let orderTotalPrice = new Decimal(0);

    for (const item of items) {
      const { productId, orderedQuantity, orderedUnit } = item;

      if (!productId || orderedQuantity <= 0 || !orderedUnit) {
        return NextResponse.json(
          { error: 'Invalid product details, quantity, or unit' },
          { status: 400 }
        );
      }

      // Fetch product details
      const product = await prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        return NextResponse.json(
          { error: `Product with ID "${productId}" not found` },
          { status: 404 }
        );
      }

      // Validate unit dimension
      if (!isValidUnitForDimension(orderedUnit as Unit, product.dimension)) {
        return NextResponse.json(
          { error: `Unit "${orderedUnit}" is not compatible with product "${product.name}" (${product.dimension})` },
          { status: 400 }
        );
      }

      const qOrder = new Decimal(orderedQuantity);
      const qBase = toBaseUnit(qOrder, orderedUnit as Unit);

      const productStockDec = new Decimal(product.stock.toString());
      if (productStockDec.lessThan(qBase)) {
        return NextResponse.json(
          {
            error: `Insufficient stock for product "${product.name}". Requested: ${orderedQuantity} ${orderedUnit} (${qBase.toFixed(4)} base units), Available: ${productStockDec.toFixed(4)} base units`,
          },
          { status: 400 }
        );
      }

      const productPriceDec = new Decimal(product.price.toString());
      const itemTotalPrice = calculatePrice(
        qOrder,
        orderedUnit as Unit,
        productPriceDec,
        product.priceUnit as Unit
      );

      orderTotalPrice = orderTotalPrice.plus(itemTotalPrice);

      validatedItems.push({
        productId,
        orderedQuantity: qOrder,
        orderedUnit: orderedUnit as Unit,
        baseQuantity: qBase,
        priceAtOrder: productPriceDec,
        priceUnitAtOrder: product.priceUnit as Unit,
        calculatedPrice: itemTotalPrice,
        productName: product.name,
        currentStock: productStockDec,
      });
    }

    // Step 2: Write to database in a single atomic transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the main Order
      const newOrder = await tx.order.create({
        data: {
          userId: session.id,
          totalPrice: orderTotalPrice.toNumber(),
          status: 'PENDING',
        },
      });

      // Process each item: create orderItem and decrement stock
      for (const item of validatedItems) {
        // Create order item
        await tx.orderItem.create({
          data: {
            orderId: newOrder.id,
            productId: item.productId,
            orderedQuantity: item.orderedQuantity.toNumber(),
            orderedUnit: item.orderedUnit,
            baseQuantity: item.baseQuantity.toNumber(),
            priceAtOrder: item.priceAtOrder.toNumber(),
            priceUnitAtOrder: item.priceUnitAtOrder,
            calculatedPrice: item.calculatedPrice.toNumber(),
          },
        });

        // Decrement product stock in DB
        const newStock = item.currentStock.minus(item.baseQuantity);
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: newStock.toNumber(),
          },
        });
      }

      return newOrder;
    });

    return NextResponse.json(
      { message: 'Order placed successfully', orderId: result.id, totalPrice: orderTotalPrice.toNumber() },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create order error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
