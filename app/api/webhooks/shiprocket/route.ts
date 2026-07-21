import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";

// Shiprocket webhooks are authenticated with a pre-shared token: set the same
// value in the Shiprocket dashboard (Settings → API → Webhooks, sent as the
// `x-api-key` header) and in the SHIPROCKET_WEBHOOK_TOKEN env var.
function verifyWebhookToken(req: NextRequest): boolean {
  const expected = process.env.SHIPROCKET_WEBHOOK_TOKEN || "";
  if (!expected) {
    // No token configured: reject in production, allow in dev for local testing.
    if (process.env.NODE_ENV === "production") {
      console.error("[Shiprocket Webhook] SHIPROCKET_WEBHOOK_TOKEN not configured. Refusing all webhooks.");
      return false;
    }
    console.warn("[Shiprocket Webhook] SHIPROCKET_WEBHOOK_TOKEN not set — accepting unauthenticated webhook (dev only).");
    return true;
  }
  const provided = req.headers.get("x-api-key") || req.headers.get("x-shiprocket-token") || "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  try {
    if (!verifyWebhookToken(req)) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json();
    const { awb, current_status, current_status_code, etd, scans } = body;

    if (!awb || !current_status) {
      return NextResponse.json({ success: false, error: "Missing required parameters: awb or current_status" }, { status: 400 });
    }

    // Find the order matching the AWB number (indexed lookup)
    const order = await db.getOrderByAwb(awb);

    if (!order) {
      console.error("Webhook: order not found for AWB:", awb);
      return NextResponse.json({ success: true, message: `Webhook processed, but no order matches AWB ${awb}.` });
    }

    // Map Shiprocket status to Stitch 6K order status
    let newStatus = order.status;
    const lowerStatus = current_status.toLowerCase();
    const { supabase } = await import("@/lib/db/client-raw").then(m => m.loadService());
    
    // Idempotent webhook check
    if (supabase) {
      const webhookEventId = req.headers.get('x-shiprocket-event-id') || `${order.id}_${lowerStatus}_${Date.now()}`;
      const { data: alreadyProcessed } = await supabase
        .from('tracking_logs')
        .select('id')
        .eq('order_id', order.id)
        .eq('status', lowerStatus)
        .eq('processed', true)
        .maybeSingle();

      if (alreadyProcessed) {
        return NextResponse.json({ ok: true, skipped: 'duplicate' });
      }
    }

    const { sendAdminAlert } = await import("@/lib/email");
    
    const isReversePickup = order.returnAwb === awb;

    const SHIPROCKET_STATUS_MAP: Record<string, {
      orderStatus: string;
      eventMsg: string;
      sendEmail?: string;
    }> = {
      'pickup scheduled': { orderStatus: 'Shipped', eventMsg: 'Pickup scheduled by courier' },
      'pickup generated': { orderStatus: 'Shipped', eventMsg: 'Pickup scheduled by courier' },
      'picked up': { orderStatus: 'Shipped', eventMsg: 'Package picked up by courier' },
      'shipment picked': { orderStatus: 'Shipped', eventMsg: 'Package picked up by courier' },
      'in transit': { orderStatus: 'Shipped', eventMsg: 'Package in transit' },
      'out for delivery': { orderStatus: 'Shipped', eventMsg: 'Package out for delivery' },
      'delivered': { orderStatus: 'Delivered', eventMsg: 'Package delivered to customer', sendEmail: 'delivered' },
      'label generated': { orderStatus: 'Shipped', eventMsg: 'Shipping label generated', sendEmail: 'shipped' },
      'manifested': { orderStatus: 'Shipped', eventMsg: 'Order manifested for pickup', sendEmail: 'shipped' },
      'ready to ship': { orderStatus: 'Shipped', eventMsg: 'Shipping label generated', sendEmail: 'shipped' },
      'rto initiated': { orderStatus: 'RTO Initiated', eventMsg: 'Return to origin initiated', sendEmail: 'rto_initiated' },
      'rto_initiated': { orderStatus: 'RTO Initiated', eventMsg: 'Return to origin initiated', sendEmail: 'rto_initiated' },
      'rto delivered': { orderStatus: 'RTO Delivered', eventMsg: 'Package returned to warehouse', sendEmail: 'rto_delivered' },
      'rto_delivered': { orderStatus: 'RTO Delivered', eventMsg: 'Package returned to warehouse', sendEmail: 'rto_delivered' },
      'ndr': { orderStatus: 'Shipped', eventMsg: 'Delivery attempt failed (NDR)', sendEmail: 'ndr' },
      'lost': { orderStatus: 'Shipped', eventMsg: 'Package reported as lost' },
      'cancelled': { orderStatus: 'Cancelled', eventMsg: 'Shipment cancelled by courier' },
      'canceled': { orderStatus: 'Cancelled', eventMsg: 'Shipment cancelled by courier' },
      'returned': { orderStatus: 'Returned', eventMsg: 'Package returned to warehouse' },
      'pickup error': { orderStatus: 'Shipped', eventMsg: 'Pickup failed. Rescheduling required.', sendEmail: 'pickup_error' },
      'pickup exception': { orderStatus: 'Shipped', eventMsg: 'Pickup failed. Rescheduling required.', sendEmail: 'pickup_error' },
      'return pickup scheduled': { orderStatus: 'Returned', eventMsg: 'Return pickup scheduled at customer address.' },
      'return pickup failed': { orderStatus: 'Returned', eventMsg: 'Return pickup attempt failed. Customer was unavailable.', sendEmail: 'return_pickup_failed' }
    };

    const REVERSE_STATUS_MAP: Record<string, {
      orderStatus: string;
      eventMsg: string;
      sendEmail?: string;
    }> = {
      'pickup scheduled': { orderStatus: 'Return Pickup Scheduled', eventMsg: 'Return pickup scheduled at customer address.' },
      'pickup generated': { orderStatus: 'Return Pickup Scheduled', eventMsg: 'Return pickup scheduled at customer address.' },
      'picked up': { orderStatus: 'Return in Transit', eventMsg: 'Package picked up by courier (Return)' },
      'shipment picked': { orderStatus: 'Return in Transit', eventMsg: 'Package picked up by courier (Return)' },
      'in transit': { orderStatus: 'Return in Transit', eventMsg: 'Return package in transit to warehouse' },
      'delivered': { orderStatus: 'Return QC Pending', eventMsg: 'Return package received at warehouse. QC pending.' },
      'returned': { orderStatus: 'Return QC Pending', eventMsg: 'Return package received at warehouse. QC pending.' },
      'pickup error': { orderStatus: 'Return Accepted', eventMsg: 'Return pickup failed. Rescheduling required.', sendEmail: 'return_pickup_failed' },
      'pickup exception': { orderStatus: 'Return Accepted', eventMsg: 'Return pickup failed. Rescheduling required.', sendEmail: 'return_pickup_failed' },
      'return pickup scheduled': { orderStatus: 'Return Pickup Scheduled', eventMsg: 'Return pickup scheduled.' },
      'return pickup failed': { orderStatus: 'Return Accepted', eventMsg: 'Return pickup attempt failed.', sendEmail: 'return_pickup_failed' }
    };

    let eventMsg = "";
    const snap = typeof order.address_snapshot === "string" ? JSON.parse(order.address_snapshot) : order.address_snapshot;
    const addrStr = snap ? `${snap.address_line_1 || ""}, ${snap.city || ""}, ${snap.state || ""} - ${snap.postal_code || ""}` : "Not Available";

    const statusMap = isReversePickup ? REVERSE_STATUS_MAP : SHIPROCKET_STATUS_MAP;
    const matchedStatus = Object.entries(statusMap).find(([key]) => lowerStatus.includes(key));
    if (matchedStatus) {
      const [, config] = matchedStatus;
      newStatus = config.orderStatus;
      eventMsg = config.eventMsg;

      if (config.sendEmail === 'ndr') {
        await sendAdminAlert({
          subject: `NDR Alert — Order #${order.id} delivery failed`,
          body: `Order ID: #${order.id}\nCustomer: ${order.customer}\nAWB: ${awb}\nDelivery Address: ${addrStr}\nAttempt Count: ${body.attempt_count || body.attempts || "1"}\nReason: ${body.ndr_reason || body.reason || "Courier could not contact customer / incorrect address"}`,
          orderId: order.id,
          awb,
        }).catch(err => console.error("[Webhook NDR Alert] Failed to send email:", err));
      } else if (config.sendEmail === 'rto_initiated') {
        await sendAdminAlert({
          subject: `RTO Alert — Order #${order.id} returning`,
          body: `Order ID: #${order.id}\nAWB: ${awb}\nCustomer Address: ${addrStr}\nReason: ${body.rto_reason || body.reason || "Undeliverable after multiple attempts"}`,
          orderId: order.id,
          awb,
        }).catch(err => console.error("[Webhook RTO Alert] Failed to send email:", err));
      } else if (config.sendEmail === 'rto_delivered') {
        await sendAdminAlert({
          subject: `RTO Delivered — Order #${order.id} back at warehouse`,
          body: `Order ID: #${order.id}\nAWB: ${awb}\nNext Steps: Package returned back to JRT TEXTILES warehouse. Please issue wallet refund or contact customer for reshipment.`,
          orderId: order.id,
          awb,
        }).catch(err => console.error("[Webhook RTO Delivered Alert] Failed to send email:", err));
      } else if (config.sendEmail === 'pickup_error') {
        await sendAdminAlert({
          subject: `Pickup Failed — Order #${order.id}`,
          body: `Order ID: #${order.id}\nAWB: ${awb}\nReason: ${body.pickup_error || body.reason || "Courier pickup failed"}`,
          orderId: order.id,
          awb,
        }).catch(err => console.error("[Webhook Pickup Error Alert] Failed to send email:", err));
      } else if (config.sendEmail === 'return_pickup_failed') {
        await sendAdminAlert({
          subject: `Return Pickup Failed — #${order.id}`,
          body: `Order ID: #${order.id}\nReturn AWB: ${awb}\nCustomer Address: ${addrStr}\nSuggested Next Action: Reschedule return pickup or reject return request.`,
          orderId: order.id,
          awb,
        }).catch(err => console.error("[Webhook Return Pickup Error Alert] Failed to send email:", err));
      } else if (config.sendEmail === 'shipped') {
        const awbCode = body.awb || body.awb_code || body.shipment_track?.awb_code || awb;
        if (supabase && awbCode) {
          const courierName = body.courier_name || null;
          const trackingUrl = body.courier_track_url || body.tracking_url || `https://shiprocket.co/tracking/${awbCode}`;
          
          await supabase.from("shipments").update({ awb_code: awbCode }).eq("order_id", order.id);
          
          await supabase.from("orders").update({
            awb_code: awbCode,
            shiprocket_id: awbCode,
            courier_name: courierName,
            tracking_url: trackingUrl
          }).eq("id", order.id);
          
          eventMsg = `Label generated. AWB: ${awbCode}`;
          
          try {
            if (snap?.email) {
              const { sendShippingConfirmationEmail } = await import("@/lib/email");
              await sendShippingConfirmationEmail({
                to: snap.email,
                customerName: snap.name || "Customer",
                orderId: order.id,
                awbCode: awbCode,
                courierName: courierName || "Courier",
                estimatedDelivery: body.etd || "3-5 Business Days",
                items: (order.cartItems || []).map((item: any) => ({
                  name: item.productName || item.title || "Item",
                  quantity: item.quantity || 1
                })),
                trackingUrl: trackingUrl || `${process.env.NEXT_PUBLIC_SITE_URL || "https://www.stitch6k.com"}/ordertracking?orderId=${order.id}`
              });
            }
          } catch (e) {
            console.error("Shipping email failed:", e);
          }
        }
      }
    }

    // Update the database order
    if (newStatus !== order.status) {
      const isDeliveredNow = newStatus === "Delivered";
      
      await db.transitionOrderStatus(order.id, newStatus, {
        triggerSource: "Shiprocket Webhook",
        userOrAdmin: "system",
        reason: `Status mapped to ${newStatus} from webhook`
      });

      if (isDeliveredNow) {
        try {
          const { sendOrderDeliveredEmail } = await import('@/lib/email');
          
          const freshOrder = await db.getOrderById(order.id);
          if (freshOrder && freshOrder.address_snapshot) {
            const addressSnap = freshOrder.address_snapshot;
            if (addressSnap.email) {
              const returnDeadline = new Date(
                Date.now() + 7 * 24 * 60 * 60 * 1000
              ).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
              });
              
              await sendOrderDeliveredEmail({
                to: addressSnap.email,
                customerName: addressSnap.name || 'Customer',
                orderId: freshOrder.id,
                items: (freshOrder.cartItems || []).map(
                  (item: any) => ({
                    name: item.productName || item.name,
                    quantity: item.quantity || 1
                  })
                ),
                total: freshOrder.total,
                deliveredAt: new Date().toLocaleDateString('en-IN'),
                returnDeadline
              });
            }
          }
        } catch (emailErr) {
          console.error(
            '[shiprocket webhook] delivered email failed:',
            emailErr
          );
        }
      }
    }

    // Insert order event if defined
    if (eventMsg) {
      try {
        await db.createOrderEvent(order.id, eventMsg);
      } catch (err) {
        console.error("[Webhook] Failed to create order event:", err);
      }
    }

    // Add status history entry
    try {
      await db.addOrderStatusHistory(
        order.id,
        newStatus,
        "Shiprocket Webhook",
        {
          awb,
          current_status,
          current_status_code,
          etd,
          scans: scans || []
        }
      );
    } catch (historyErr) {
      console.warn(`[Shiprocket Webhook] Failed to add status history for order ${order.id}:`, historyErr);
    }

    if (supabase) {
      try {
        await supabase
          .from('tracking_logs')
          .upsert({
            order_id: order.id,
            status: lowerStatus,
            processed: true,
            processed_at: new Date().toISOString()
          }, { onConflict: 'order_id, status' });
      } catch (upsertErr) {
        console.warn(`[Shiprocket Webhook] Failed to mark processed for order ${order.id}:`, upsertErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully processed status update of "${current_status}" for order #${order.id}.`
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Shiprocket Webhook] Error processing tracking webhook:", error);
    // Never return error status to Shiprocket webhooks, always 200
    return NextResponse.json({ success: true, error: message || "Internal server error" });
  }
}
