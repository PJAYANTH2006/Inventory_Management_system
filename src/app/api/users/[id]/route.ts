import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { Role } from '@prisma/client';

// PATCH /api/users/[id] - Update User Role (Admin Only)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();

    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    
    // Prevent admin from modifying their own account role/details
    if (session.id === id) {
      return NextResponse.json(
        { error: 'Conflict: You cannot update your own user role or details' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { role, name } = body;

    // Validate role if updated
    if (role && !Object.values(Role).includes(role as Role)) {
      return NextResponse.json({ error: 'Invalid user role' }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        role: role ? (role as Role) : existingUser.role,
        name: name !== undefined ? name : existingUser.name,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    return NextResponse.json({ message: 'User updated successfully', user: updatedUser });
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// DELETE /api/users/[id] - Delete User (Admin Only)
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

    // Prevent admin from deleting their own account
    if (session.id === id) {
      return NextResponse.json(
        { error: 'Conflict: You cannot delete your own admin account' },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Delete user's orders first (Prisma relations handles it, but since order has items, Cascade Delete should delete them)
    // In schema.prisma:
    // model OrderItem has orderId and is onDelete: Cascade.
    // User has orders relation, but is it Cascade? No cascade is specified in model User -> Order. 
    // So we should delete the user's orders and items first, or let transaction handle it.
    await prisma.$transaction(async (tx) => {
      // Find all order IDs of this user
      const userOrders = await tx.order.findMany({
        where: { userId: id },
        select: { id: true },
      });
      const orderIds = userOrders.map(o => o.id);

      if (orderIds.length > 0) {
        // Delete order items
        await tx.orderItem.deleteMany({
          where: { orderId: { in: orderIds } },
        });

        // Delete orders
        await tx.order.deleteMany({
          where: { id: { in: orderIds } },
        });
      }

      // Delete user
      await tx.user.delete({
        where: { id },
      });
    });

    return NextResponse.json({ message: 'User account deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
