import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export async function POST(req: NextRequest) {
  // Only available in non-production or when explicit mock setting is true
  if (process.env.NODE_ENV === 'production' &&
      process.env.NEXT_PUBLIC_ENABLE_MOCK_SHIPPING !== 'true') {
    return NextResponse.json(
      { error: 'Not available in production' },
      { status: 403 }
    )
  }

  try {
    // Authenticate caller is admin
    try {
      await requireAdmin();
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orderId } = await req.json();
    if (!orderId) {
      return NextResponse.json(
        { error: 'orderId required' },
        { status: 400 }
      )
    }

    const deliveredAt = new Date().toISOString();
    const pointsCreditAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    ).toISOString();

    await db.saveOrder({
      id: orderId,
      status: 'Delivered',
      deliveredAt: deliveredAt,
      pointsCreditScheduledAt: pointsCreditAt
    });

    await db.addOrderEvent(
      orderId,
      'Package delivered to customer (mock/test)'
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[mock-deliver]', err);
    return NextResponse.json(
      { error: 'Failed' },
      { status: 500 }
    )
  }
}
