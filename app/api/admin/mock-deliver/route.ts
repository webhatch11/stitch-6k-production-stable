import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  if (process.env.NEXT_PUBLIC_ENABLE_MOCK_SHIPPING !== 'true') {
    return NextResponse.json(
      { error: 'Mock mode disabled' },
      { status: 403 }
    )
  }

  try {
    const { orderId } = await req.json()
    if (!orderId) {
      return NextResponse.json(
        { error: 'orderId required' },
        { status: 400 }
      )
    }

    const deliveredAt = new Date().toISOString()
    const pointsCreditAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    ).toISOString()

    await db.saveOrder({
      id: orderId,
      deliveredAt: deliveredAt,
      pointsCreditScheduledAt: pointsCreditAt
    })
    
    await db.transitionOrderStatus(orderId, 'Delivered', {
      triggerSource: "Mock Deliver Route",
      userOrAdmin: "admin",
      reason: "Package delivered to customer (mock/test)"
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[mock-deliver]', err)
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    )
  }
}
