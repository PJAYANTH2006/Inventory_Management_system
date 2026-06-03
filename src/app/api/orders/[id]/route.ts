import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { OrderStatus } from '@prisma/client';
import { Decimal } from 'decimal.js';

// PATCH /api/orders/[id] - Update Order Status (Admin Only)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();

    if (!session || (session.role !== 'ADMIN' && session.role !== 'SELLER')) {
      return NextResponse.json({ error: 'Forbidden: Admin or Seller access required' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { status } = body as { status: OrderStatus };

    if (!status || !Object.values(OrderStatus).includes(status)) {
      return NextResponse.json({ error: 'Invalid order status' }, { status: 400 });
    }

    // Retrieve order with items
    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const oldStatus = order.status;
    if (oldStatus === status) {
      return NextResponse.json({ message: `Order status is already ${status}`, order });
    }

    // Determine stock updates based on status transitions
    // PENDING/APPROVED are "deducted" states
    // REJECTED/CANCELLED are "refunded" states
    const isOldDeducted = oldStatus === 'PENDING' || oldStatus === 'APPROVED';
    const isNewDeducted = status === 'PENDING' || status === 'APPROVED';

    const updatedOrder = await prisma.$transaction(async (tx) => {
      // Transition from deducted -> refunded: Refund stock
      if (isOldDeducted && !isNewDeducted) {
        for (const item of order.items) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
          });

          if (product) {
            const currentStock = new Decimal(product.stock.toString());
            const refundQty = new Decimal(item.baseQuantity.toString());
            const newStock = currentStock.plus(refundQty);

            await tx.product.update({
              where: { id: item.productId },
              data: { stock: newStock.toNumber() },
            });
          }
        }
      }

      // Transition from refunded -> deducted: Verify and deduct stock
      if (!isOldDeducted && isNewDeducted) {
        for (const item of order.items) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
          });

          if (!product) {
            throw new Error(`Product for item not found`);
          }

          const currentStock = new Decimal(product.stock.toString());
          const deductQty = new Decimal(item.baseQuantity.toString());

          if (currentStock.lessThan(deductQty)) {
            throw new Error(
              `Insufficient stock to approve order for product "${product.name}". Required: ${deductQty.toFixed(4)} base units, Available: ${currentStock.toFixed(4)} base units`
            );
          }

          const newStock = currentStock.minus(deductQty);
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: newStock.toNumber() },
          });
        }
      }

      // Update the order status
      return await tx.order.update({
        where: { id },
        data: { status },
        include: {
          items: {
            include: {
              product: {
                select: { name: true, sku: true },
              },
            },
          },
        },
      });
    });

    return NextResponse.json({
      message: `Order status updated to ${status} successfully`,
      order: updatedOrder,
    });
  } catch (error: any) {
    console.error('Update order status error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
