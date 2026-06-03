import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { Decimal } from 'decimal.js';

export async function GET() {
  try {
    const session = await getSession();

    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // 1. User Stats
    const userCounts = await prisma.user.groupBy({
      by: ['role'],
      _count: {
        id: true,
      },
    });

    const users = {
      total: 0,
      admin: 0,
      seller: 0,
      buyer: 0,
    };

    userCounts.forEach(group => {
      const count = group._count.id;
      users.total += count;
      if (group.role === 'ADMIN') users.admin = count;
      else if (group.role === 'SELLER') users.seller = count;
      else if (group.role === 'BUYER') users.buyer = count;
    });

    // 2. Product Stats
    const productsList = await prisma.product.findMany({});
    
    let totalStockValue = new Decimal(0);
    let lowStockCount = 0;
    let totalSkus = productsList.length;

    productsList.forEach(product => {
      const stock = new Decimal(product.stock.toString());
      const price = new Decimal(product.price.toString());
      const minAlert = new Decimal(product.minStockAlert.toString());
      
      // Calculate low stock items
      if (stock.lessThanOrEqualTo(minAlert)) {
        lowStockCount++;
      }

      // Calculate valuation factor
      // 1 kg = 1000 g, 1 L = 1000 mL, others = 1
      const priceUnit = product.priceUnit;
      const factor = (priceUnit === 'kg' || priceUnit === 'L') ? new Decimal(1000) : new Decimal(1);
      
      // Value = stock * price / factor
      const val = stock.mul(price).div(factor);
      totalStockValue = totalStockValue.plus(val);
    });

    // 3. Order & Sales Stats
    const ordersList = await prisma.order.findMany({
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    let totalRevenue = new Decimal(0);
    const orders = {
      total: ordersList.length,
      pending: 0,
      approved: 0,
      rejected: 0,
      cancelled: 0,
    };

    ordersList.forEach(order => {
      if (order.status === 'PENDING') orders.pending++;
      else if (order.status === 'APPROVED') {
        orders.approved++;
        totalRevenue = totalRevenue.plus(new Decimal(order.totalPrice.toString()));
      }
      else if (order.status === 'REJECTED') orders.rejected++;
      else if (order.status === 'CANCELLED') orders.cancelled++;
    });

    // Recent 5 sales
    const recentActivity = ordersList.slice(0, 5).map(o => ({
      id: o.id,
      buyerName: o.user.name,
      buyerEmail: o.user.email,
      totalPrice: Number(o.totalPrice.toString()),
      status: o.status,
      createdAt: o.createdAt,
    }));

    return NextResponse.json({
      summary: {
        users,
        inventory: {
          totalProducts: totalSkus,
          totalValuation: totalStockValue.toNumber(),
          lowStockAlerts: lowStockCount,
        },
        sales: {
          totalOrders: orders.total,
          revenue: totalRevenue.toNumber(),
          pendingCount: orders.pending,
          approvedCount: orders.approved,
          rejectedCount: orders.rejected,
          cancelledCount: orders.cancelled,
        },
        recentActivity,
      },
    });
  } catch (error) {
    console.error('Reports stats error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
