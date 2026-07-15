// Server-side GA4 via Measurement Protocol
export async function sendGA4Purchase(order: {
  orderId: string
  total: number
  items: any[]
  couponCode?: string
  sessionId?: string
  clientId?: string
}) {
  const GA_MEASUREMENT_ID = 
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
  const GA_API_SECRET = 
    process.env.GA4_API_SECRET

  if (!GA_MEASUREMENT_ID || 
      !GA_API_SECRET ||
      GA_MEASUREMENT_ID === 'G-XXXXXXXXXX') {
    console.log('[GA4 Server] Not configured — skipping server-side event')
    return
  }

  try {
    await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${GA_MEASUREMENT_ID}&api_secret=${GA_API_SECRET}`,
      {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          client_id: order.clientId || 
            order.orderId,
          events: [{
            name: 'purchase',
            params: {
              transaction_id: order.orderId,
              currency: 'INR',
              value: order.total,
              coupon: order.couponCode || '',
              items: order.items.map(item => ({
                item_id: item.productId || 
                  item.id,
                item_name: item.productName || 
                  item.name,
                price: item.price,
                quantity: item.quantity || 1,
                item_category: 
                  item.category || 'Shirts'
              }))
            }
          }]
        })
      }
    )
    console.log('[GA4 Server] Purchase event sent:', order.orderId)
  } catch (error) {
    // Never fail payment because of analytics
    console.error('[GA4 Server] Failed:', error)
  }
}

// Server-side Meta via Conversions API
export async function sendMetaPurchase(order: {
  orderId: string
  total: number
  items: any[]
  customerEmail?: string
  customerPhone?: string
  customerName?: string
  createdAt?: string
}) {
  const PIXEL_ID = 
    process.env.NEXT_PUBLIC_META_PIXEL_ID
  const ACCESS_TOKEN = 
    process.env.META_CONVERSIONS_API_TOKEN

  if (!PIXEL_ID || !ACCESS_TOKEN ||
      PIXEL_ID === 'XXXXXXXXXXXXXXXX') {
    console.log('[Meta Server] Not configured — skipping server-side event')
    return
  }

  // Hash customer data for privacy
  const crypto = await import('crypto')
  const hashData = (value: string) => 
    crypto.createHash('sha256')
      .update(value.toLowerCase().trim())
      .digest('hex')

  const timestamp = order.createdAt ? new Date(order.createdAt).getTime() : Date.now();
  const eventId = `purchase_${order.orderId}_${timestamp}`;

  try {
    await fetch(
      `https://graph.facebook.com/v19.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`,
      {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          data: [{
            event_name: 'Purchase',
            event_time: Math.floor(
              Date.now() / 1000
            ),
            event_id: eventId,
            action_source: 'website',
            user_data: {
              em: order.customerEmail 
                ? [hashData(order.customerEmail)]
                : undefined,
              ph: order.customerPhone
                ? [hashData(
                    order.customerPhone
                      .replace(/\D/g, '')
                  )]
                : undefined,
              fn: order.customerName
                ? [hashData(
                    order.customerName
                      .split(' ')[0]
                  )]
                : undefined,
              ln: order.customerName
                ? [hashData(
                    order.customerName
                      .split(' ')
                      .slice(1).join(' ')
                  )]
                : undefined,
              country: [hashData('in')]
            },
            custom_data: {
              value: order.total,
              currency: 'INR',
              order_id: order.orderId,
              content_ids: order.items.map(
                i => i.productId || i.id
              ),
              contents: order.items.map(i => ({
                id: i.productId || i.id,
                quantity: i.quantity || 1,
                item_price: i.price
              })),
              content_type: 'product'
            }
          }],
          test_event_code: 
            process.env.NODE_ENV === 
            'development' 
              ? 'TEST12345' 
              : undefined
        })
      }
    )
    console.log('[Meta Server] Purchase event sent:', order.orderId)
  } catch (error) {
    // Never fail payment because of analytics
    console.error('[Meta Server] Failed:', error)
  }
}
