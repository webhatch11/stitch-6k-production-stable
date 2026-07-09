import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendOrderConfirmationEmail(order: {
  id: string;
  customerName: string;
  customerEmail: string;
  items: Array<{
    productName: string;
    size: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  address: string;
}): Promise<void> {
  const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@webhatch.dev";

  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #BA7517; font-size: 24px;">
        Order Confirmed ✓
      </h1>
      <p>Hi ${order.customerName},</p>
      <p>Your order has been confirmed and will be processed within 2-3 business days.</p>
      
      <h2 style="font-size: 16px; border-bottom: 1px solid #e5e5e5; padding-bottom: 8px;">
        Order #${order.id}
      </h2>
      
      ${order.items
        .map(
          (item) => `
        <div style="padding: 12px 0; border-bottom: 1px solid #f5f5f5;">
          <strong>${item.productName}</strong><br>
          <span style="color: #6b7280; font-size: 14px;">
            Size: ${item.size} × ${item.quantity}
          </span>
          <span style="float: right;">
            ₹${item.price}
          </span>
        </div>
      `
        )
        .join("")}
      
      <div style="padding: 16px 0; font-size: 18px; font-weight: bold;">
        Total: ₹${order.total}
      </div>
      
      <p style="color: #6b7280; font-size: 13px;">
        Delivery to: ${order.address}
      </p>
      
      <p style="color: #6b7280; font-size: 13px;">
        Once shipped, you will receive tracking details via Email, SMS, and WhatsApp.
      </p>
      
      <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;">
      
      <p style="color: #9ca3af; font-size: 12px;">
        — 6K Brand | JRT TEXTILES<br>
        Tiruchirappalli, Tamil Nadu<br>
        6kthebrand@gmail.com | +91 93636 93004
      </p>
    </div>
  `;

  try {
    await resend.emails.send({
      from: fromEmail,
      to: order.customerEmail,
      subject: `Order Confirmed — #${order.id} | 6K Brand`,
      html: htmlContent,
    });
  } catch (err: any) {
    console.error(`[Email Error] Failed to deliver order confirmation email to ${order.customerEmail} via Resend. Check API Key or Domain verification status. Error:`, err.message || err);
    console.warn(`[Email Sandbox Fallback] Printing email HTML to console for reference:`);
    console.log(`=== ORDER CONFIRMATION EMAIL FOR ${order.customerEmail} ===`);
    console.log(htmlContent);
    console.log(`=======================================================`);
    throw err;
  }
}
