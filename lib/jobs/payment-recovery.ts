import { razorpay } from "@/lib/razorpay";
import { supabaseService as supabase } from "@/lib/supabase-service";
import { db } from "@/lib/db";

export async function paymentRecoveryProcessor(job: any) {
    if (job.name === "sweep_pending_payments") {
      console.log("[Payment Recovery Worker] Scanning for abandoned payments...");
      
      if (!supabase) return;

      // 1. Find orders Payment Pending older than 15 minutes
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

      const { data: pendingOrders } = await supabase
        .from("orders")
        .select("id, razorpay_order_id, cart_items, wallet_paid, points_redeemed, idempotency_key, user_id")
        .eq("status", "Payment Pending")
        .lt("created_at", fifteenMinutesAgo);

      if (pendingOrders && pendingOrders.length > 0) {
        for (const order of pendingOrders) {
          try {
            // Check Razorpay API
            if (order.razorpay_order_id) {
              const rzpOrder = await razorpay.orders.fetch(order.razorpay_order_id);
              
              if (rzpOrder.status === "paid") {
                // Should not happen if webhook/client fired, but if it did:
                await supabase.from("orders").update({ payment_status: "Paid", status: "Paid" }).eq("id", order.id);
                continue;
              }
            }

            // 2. CAS Claim Guard: Atomically claim order cancellation to prevent races
            const { data: claimedRow, error: claimErr } = await supabase
              .from("orders")
              .update({ status: "Cancelled", payment_status: "EXPIRED" })
              .eq("id", order.id)
              .eq("status", "Payment Pending")
              .select("id");

            if (claimErr || !claimedRow || claimedRow.length === 0) {
              console.log(`[Payment Recovery] Order ${order.id} already claimed or processed by another worker.`);
              continue;
            }

            console.log(`[Payment Recovery] Marking order ${order.id} as Cancelled (Expired) and releasing reservation.`);

            // Release Inventory Reservation (EXPIRED) — NEVER call restoreStock here as stock was never deducted
            if (order.idempotency_key) {
              await supabase
                .from("inventory_reservations")
                .update({ status: "EXPIRED" })
                .eq("session_id", order.idempotency_key);
            }

            // Rollback wallet & loyalty if they were deducted initially
            const targetUserId = order.user_id;
            if (order.wallet_paid > 0 && targetUserId) {
              await db.applyWalletCredit(order.wallet_paid, `Recovery Rollback for ${order.id}`, order.id, targetUserId);
            }
            if (order.points_redeemed > 0 && targetUserId) {
              await db.applyLoyaltyCredit(order.points_redeemed, `Recovery Rollback for ${order.id}`, order.id, targetUserId);
            }

            // Log recovery action
            const { data: payment } = await supabase.from("payments").select("id").eq("order_id", order.id).single();
            if (payment) {
              await supabase.from("payment_logs").insert({
                payment_id: payment.id,
                previous_status: "CREATED",
                new_status: "Cancelled",
                metadata: { source: "payment_recovery_worker" }
              });
              await supabase.from("payments").update({ status: "EXPIRED" }).eq("id", payment.id);
            }

          } catch (err) {
            console.error(`[Payment Recovery] Failed to recover order ${order.id}:`, err);
          }
        }
      }
    } else if (job.name === "cleanup_expired_orders") {
      console.log("[Payment Recovery Worker] Cleaning up old Cancelled orders...");
      if (!supabase) return;
      
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      // Cleanup
      await supabase
        .from("orders")
        .delete()
        .eq("status", "Cancelled")
        .lt("created_at", twentyFourHoursAgo);
    }
}


