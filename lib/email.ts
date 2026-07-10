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
  const fromEmail = process.env.RESEND_FROM_EMAIL || "Stitch 6K <noreply@the6k.com>";

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

export async function sendReturnAcceptedEmail(order: {
  id: string;
  customerName: string;
  customerEmail: string;
  refundAmount: number;
  refundOption: string;
}): Promise<void> {
  const fromEmail = process.env.RESEND_FROM_EMAIL || "Stitch 6K <noreply@the6k.com>";
  const methodText = order.refundOption === "wallet" ? "Store Wallet Credit" : "Original Bank Account / Card";

  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #BA7517; font-size: 24px;">
        Return Request Approved ✓
      </h1>
      <p>Hi ${order.customerName},</p>
      <p>Your return request for Order <strong>#${order.id}</strong> has been accepted. The quality inspection has passed, and we have processed your refund.</p>
      
      <h2 style="font-size: 16px; border-bottom: 1px solid #e5e5e5; padding-bottom: 8px;">
        Refund Summary
      </h2>
      
      <div style="padding: 12px 0; border-bottom: 1px solid #f5f5f5;">
        <strong>Refund Amount:</strong>
        <span style="float: right; font-weight: bold;">₹${order.refundAmount.toLocaleString("en-IN")}.00</span>
      </div>
      <div style="padding: 12px 0; border-bottom: 1px solid #f5f5f5;">
        <strong>Refund Destination:</strong>
        <span style="float: right; font-weight: bold;">${methodText}</span>
      </div>
      
      <p style="color: #6b7280; font-size: 13px; margin-top: 16px;">
        For bank refunds, the amount should reflect in your account within 5-7 business days depending on your bank. Wallet credits are available immediately.
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
      subject: `Return Approved — #${order.id} | 6K Brand`,
      html: htmlContent,
    });
  } catch (err: any) {
    console.error(`[Email Error] Failed to deliver return approved email to ${order.customerEmail} via Resend. Error:`, err.message || err);
    console.warn(`[Email Sandbox Fallback] Printing email HTML to console:`);
    console.log(`=== RETURN APPROVED EMAIL FOR ${order.customerEmail} ===`);
    console.log(htmlContent);
    console.log(`===================================================`);
    throw err;
  }
}

export async function sendReturnRejectedEmail(order: {
  id: string;
  customerName: string;
  customerEmail: string;
  rejectReason: string;
}): Promise<void> {
  const fromEmail = process.env.RESEND_FROM_EMAIL || "Stitch 6K <noreply@the6k.com>";

  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #e11d48; font-size: 24px;">
        Return Request Rejected
      </h1>
      <p>Hi ${order.customerName},</p>
      <p>We are writing to inform you that your return request for Order <strong>#${order.id}</strong> has been rejected following quality inspection or review by our workshop team.</p>
      
      <h2 style="font-size: 16px; border-bottom: 1px solid #e5e5e5; padding-bottom: 8px;">
        Rejection Reason
      </h2>
      
      <p style="background: #fdf2f8; border: 1px solid #fbcfe8; padding: 16px; font-style: italic; color: #9f1239; margin-top: 16px;">
        "${order.rejectReason}"
      </p>
      
      <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">
        If you have any questions or require further clarification, please contact our support desk.
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
      subject: `Return Update — #${order.id} | 6K Brand`,
      html: htmlContent,
    });
  } catch (err: any) {
    console.error(`[Email Error] Failed to deliver return rejected email to ${order.customerEmail} via Resend. Error:`, err.message || err);
    console.warn(`[Email Sandbox Fallback] Printing email HTML to console:`);
    console.log(`=== RETURN REJECTED EMAIL FOR ${order.customerEmail} ===`);
    console.log(htmlContent);
    console.log(`===================================================`);
    throw err;
  }
}

export async function sendOrderCancelledEmail(order: {
  id: string;
  customerName: string;
  customerEmail: string;
  cancelReason: string;
  refundAmount: number;
  refundDetails: string;
}): Promise<void> {
  const fromEmail = process.env.RESEND_FROM_EMAIL || "Stitch 6K <noreply@the6k.com>";

  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #e11d48; font-size: 24px;">
        Order Cancelled
      </h1>
      <p>Hi ${order.customerName},</p>
      <p>We are very sorry, but we have had to cancel your Order <strong>#${order.id}</strong> due to workshop stock issues or unforeseen circumstances. An automated full refund has been issued.</p>
      
      <h2 style="font-size: 16px; border-bottom: 1px solid #e5e5e5; padding-bottom: 8px;">
        Cancellation & Refund Details
      </h2>
      
      <div style="padding: 12px 0; border-bottom: 1px solid #f5f5f5;">
        <strong>Cancellation Reason:</strong>
        <span style="float: right; font-style: italic;">${order.cancelReason}</span>
      </div>
      <div style="padding: 12px 0; border-bottom: 1px solid #f5f5f5;">
        <strong>Total Refunded:</strong>
        <span style="float: right; font-weight: bold;">₹${order.refundAmount.toLocaleString("en-IN")}.00</span>
      </div>
      <div style="padding: 12px 0; border-bottom: 1px solid #f5f5f5;">
        <strong>Refund Action:</strong>
        <span style="float: right; font-weight: bold;">${order.refundDetails}</span>
      </div>
      
      <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">
        Apologies again for the inconvenience. For bank-refunded portions, please allow 5-7 business days for the credit to appear. Wallet-refunded portions are available immediately.
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
      subject: `Order Cancelled — #${order.id} | 6K Brand`,
      html: htmlContent,
    });
  } catch (err: any) {
    console.error(`[Email Error] Failed to deliver cancellation email to ${order.customerEmail} via Resend. Error:`, err.message || err);
    console.warn(`[Email Sandbox Fallback] Printing email HTML to console:`);
    console.log(`=== ORDER CANCELLED EMAIL FOR ${order.customerEmail} ===`);
    console.log(htmlContent);
    console.log(`===================================================`);
    throw err;
  }
}

export async function sendReturnPickupScheduledEmail(order: {
  id: string;
  customerName: string;
  customerEmail: string;
  awb: string;
  pickupDate: string;
}): Promise<void> {
  const fromEmail = process.env.RESEND_FROM_EMAIL || "Stitch 6K <noreply@the6k.com>";
  const formattedDate = new Date(order.pickupDate).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });

  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #BA7517; font-size: 24px;">
        Return Pickup Scheduled ✓
      </h1>
      <p>Hi ${order.customerName},</p>
      <p>Your return request for Order <strong>#${order.id}</strong> has been approved, and we have scheduled a reverse courier pickup for the item(s).</p>
      
      <h2 style="font-size: 16px; border-bottom: 1px solid #e5e5e5; padding-bottom: 8px;">
        Pickup Details
      </h2>
      
      <div style="padding: 12px 0; border-bottom: 1px solid #f5f5f5;">
        <strong>Courier AWB Number:</strong>
        <span style="float: right; font-family: monospace; font-weight: bold;">${order.awb}</span>
      </div>
      <div style="padding: 12px 0; border-bottom: 1px solid #f5f5f5;">
        <strong>Estimated Pickup Date:</strong>
        <span style="float: right; font-weight: bold;">${formattedDate}</span>
      </div>
      
      <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">
        Please hand over the product in its original packaging with tags intact to the courier agent when they arrive. Once the package is received and verified at our workshop, your refund will be finalized.
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
      subject: `Return Pickup Scheduled — #${order.id} | 6K Brand`,
      html: htmlContent,
    });
  } catch (err: any) {
    console.error(`[Email Error] Failed to deliver return pickup scheduled email to ${order.customerEmail} via Resend. Error:`, err.message || err);
    console.warn(`[Email Sandbox Fallback] Printing email HTML to console:`);
    console.log(`=== RETURN PICKUP SCHEDULED EMAIL FOR ${order.customerEmail} ===`);
    console.log(htmlContent);
    console.log(`===========================================================`);
    throw err;
  }
}
