import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "6kthebrand@gmail.com";

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
  couponCode?: string | null;
  couponDiscount?: number | null;
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
      
      ${order.couponCode && order.couponDiscount && order.couponDiscount > 0 ? `
        <div style="padding: 12px 0; border-bottom: 1px solid #f5f5f5; color: #166534; font-size: 14px;">
          <strong>Coupon (${order.couponCode}):</strong>
          <span style="float: right;">
            -₹${order.couponDiscount}
          </span>
        </div>
      ` : ""}
      
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
        ${supportEmail} | +91 93636 93004
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
    console.error(`[sendOrderConfirmationEmail] Failed to deliver to ${order.customerEmail}:`, err.message || err);
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
        ${supportEmail} | +91 93636 93004
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
    console.error(`[sendReturnAcceptedEmail] Failed to deliver to ${order.customerEmail}:`, err.message || err);
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
        ${supportEmail} | +91 93636 93004
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
    console.error(`[sendReturnRejectedEmail] Failed to deliver to ${order.customerEmail}:`, err.message || err);
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
        ${supportEmail} | +91 93636 93004
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
    console.error(`[sendOrderCancelledEmail] Failed to deliver to ${order.customerEmail}:`, err.message || err);
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
        ${supportEmail} | +91 93636 93004
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
    console.error(`[sendReturnPickupScheduledEmail] Failed to deliver to ${order.customerEmail}:`, err.message || err);
  }
}

export async function sendShippingConfirmationEmail(params: {
  to: string;
  customerName: string;
  orderId: string;
  awbCode: string;
  courierName: string;
  estimatedDelivery: string;
  items: Array<{ name: string; quantity: number }>;
  trackingUrl: string;
}): Promise<void> {
  const fromEmail = process.env.RESEND_FROM_EMAIL || "Stitch 6K <noreply@the6k.com>";
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "6kthebrand@gmail.com";

  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #f0f0f0;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #BA7517; font-size: 26px; margin: 0; font-weight: 900; letter-spacing: 0.1em; text-transform: uppercase;">
          STITCH 6K
        </h1>
        <p style="color: #6b7280; font-size: 11px; tracking-widest; text-transform: uppercase; margin: 4px 0 0 0;">
          Atelier / Workshop Series
        </p>
      </div>

      <h2 style="color: #BA7517; font-size: 20px; margin-top: 0; font-weight: bold; border-bottom: 1px solid #e5e5e5; padding-bottom: 8px;">
        Your order is on its way ✓
      </h2>
      <p style="font-size: 14px; color: #1f2937; line-height: 1.6;">Hi ${params.customerName},</p>
      <p style="font-size: 14px; color: #4b5563; line-height: 1.6;">Great news! Your Stitch 6K order <strong>#${params.orderId}</strong> has been shipped and handed over to our logistics partner.</p>
      
      <div style="background: #fafafa; border: 1px solid #e5e5e5; padding: 16px; margin: 24px 0; border-radius: 4px;">
        <p style="margin: 0 0 12px 0; font-size: 14px; color: #374151;">
          <strong>AWB Waybill Number:</strong><br>
          <span style="font-size: 20px; font-weight: bold; color: #BA7517; font-family: monospace; letter-spacing: 0.05em; display: inline-block; margin-top: 4px;">
            ${params.awbCode}
          </span>
        </p>
        <p style="margin: 0 0 12px 0; font-size: 13px; color: #4b5563;">
          <strong>Courier Partner:</strong> ${params.courierName}
        </p>
        <p style="margin: 0; font-size: 13px; color: #4b5563;">
          <strong>Estimated Delivery:</strong> ${params.estimatedDelivery}
        </p>
      </div>

      <h3 style="font-size: 14px; font-weight: bold; border-bottom: 1px solid #f3f4f6; padding-bottom: 6px; margin-top: 24px; text-transform: uppercase; letter-spacing: 0.05em; color: #374151;">
        Shipped Items
      </h3>
      ${params.items
        .map(
          (item) => `
        <div style="padding: 10px 0; border-bottom: 1px solid #f9fafb; font-size: 13px; color: #4b5563;">
          <strong>${item.name}</strong>
          <span style="float: right; color: #9ca3af;">
            Qty: ${item.quantity}
          </span>
        </div>
      `
        )
        .join("")}
      
      <div style="text-align: center; margin: 36px 0 24px 0;">
        <a href="${params.trackingUrl}" target="_blank" style="background-color: #BA7517; color: #ffffff; padding: 14px 28px; text-decoration: none; font-size: 12px; font-weight: bold; letter-spacing: 0.15em; text-transform: uppercase; display: inline-block; border-radius: 0px; box-shadow: 0 4px 6px rgba(186, 117, 23, 0.15);">
          Track Your Order
        </a>
      </div>

      <p style="color: #6b7280; font-size: 12px; line-height: 1.6; margin-top: 32px;">
        Please note that it can take up to 12-24 hours for the courier network to scan and update waybill event logs.
      </p>

      <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;">
      
      <p style="color: #9ca3af; font-size: 12px; line-height: 1.6;">
        — 6K Brand | JRT TEXTILES<br>
        Tiruchirappalli, Tamil Nadu<br>
        ${supportEmail} | +91 93636 93004
      </p>
    </div>
  `;

  try {
    await resend.emails.send({
      from: fromEmail,
      to: params.to,
      subject: `Your 6K order has been shipped — #${params.orderId}`,
      html: htmlContent,
    });
  } catch (err: any) {
    console.error(`[Email Error] Failed to deliver shipping confirmation email for order ${params.orderId} to ${params.to}. Error:`, err.message || err);
  }
}

export async function sendAdminAlert(params: {
  subject: string;
  body: string;
  orderId: string;
  awb?: string;
}): Promise<void> {
  const fromEmail = process.env.RESEND_FROM_EMAIL || "Stitch 6K <noreply@the6k.com>";
  const adminEmails = process.env.ADMIN_EMAILS?.split(",").map((email) => email.trim()).filter(Boolean) || [];

  if (adminEmails.length === 0) {
    console.warn("[Email SDK] No admin emails configured in ADMIN_EMAILS environment variable.");
    return;
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://the6k.com";
  const adminOrderLink = `${siteUrl}/admindashboard/orders?search=${params.orderId}`;
  
  const htmlContent = `
    <div style="font-family: sans-serif; font-size: 14px; line-height: 1.6; color: #333;">
      <h2 style="color: #e11d48; margin-top: 0;">Logistics Administrator Alert</h2>
      <p style="font-size: 15px; font-weight: bold; color: #111;">${params.subject}</p>
      <div style="background: #f8fafc; border-left: 4px solid #cbd5e1; padding: 12px; margin: 16px 0;">
        <p style="margin: 0 0 8px 0;">${params.body}</p>
        <p style="margin: 0 0 8px 0;"><strong>Order ID:</strong> #${params.orderId}</p>
        ${params.awb ? `<p style="margin: 0;"><strong>AWB:</strong> ${params.awb}</p>` : ""}
      </div>
      <p style="margin-top: 24px;">
        <a href="${adminOrderLink}" target="_blank" style="background-color: #0f172a; color: #ffffff; padding: 10px 18px; text-decoration: none; font-size: 11px; font-weight: bold; letter-spacing: 0.05em; text-transform: uppercase; display: inline-block;">
          View Order in Admin Dashboard
        </a>
      </p>
    </div>
  `;

  try {
    await resend.emails.send({
      from: fromEmail,
      to: adminEmails,
      subject: `[6K Admin Alert] ${params.subject}`,
      html: htmlContent,
    });
  } catch (err: any) {
    console.error(`[Email Error] Failed to deliver admin alert for order ${params.orderId}. Error:`, err.message || err);
  }
}

export async function sendOrderCancelledByAdminEmail(params: {
  to: string;
  customerName: string;
  orderId: string;
  refundAmount: number;
  refundMethod: string;
  reason?: string;
}): Promise<void> {
  const fromEmail = process.env.RESEND_FROM_EMAIL || "Stitch 6K <noreply@the6k.com>";
  const methodText = params.refundMethod === "wallet" ? "Store Wallet Credit" : "Original Bank Account / Card";
  const timeText = params.refundMethod === "wallet" ? "instant for wallet" : "5-7 business days for bank";

  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #ef4444; font-size: 24px;">
        Order Cancelled
      </h1>
      <p>Hi ${params.customerName},</p>
      <p>We are sorry for the inconvenience, but your order <strong>#${params.orderId}</strong> has been cancelled by the store.</p>
      ${params.reason ? `<p><strong>Reason for cancellation:</strong> ${params.reason}</p>` : ""}
      
      <h2 style="font-size: 16px; border-bottom: 1px solid #e5e5e5; padding-bottom: 8px;">
        Refund Summary
      </h2>
      
      <div style="padding: 12px 0; border-bottom: 1px solid #f5f5f5;">
        <strong>Refund Amount:</strong>
        <span style="float: right; font-weight: bold;">₹${params.refundAmount.toLocaleString("en-IN")}.00</span>
      </div>
      <div style="padding: 12px 0; border-bottom: 1px solid #f5f5f5;">
        <strong>Refund Destination:</strong>
        <span style="float: right; font-weight: bold;">${methodText}</span>
      </div>
      
      <p style="color: #6b7280; font-size: 13px; margin-top: 16px;">
        Refund processing time is ${timeText}. If you have any questions, please contact us at ${supportEmail}.
      </p>
      
      <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;">
      
      <p style="color: #9ca3af; font-size: 12px;">
        — 6K Brand | JRT TEXTILES<br>
        Tiruchirappalli, Tamil Nadu<br>
        ${supportEmail} | +91 93636 93004
      </p>
    </div>
  `;

  try {
    await resend.emails.send({
      from: fromEmail,
      to: params.to,
      subject: `Your 6K order #${params.orderId} has been cancelled`,
      html: htmlContent,
    });
  } catch (err: any) {
    console.error(`[Email Error] Failed to deliver order cancelled email to ${params.to} via Resend. Error:`, err.message || err);
  }
}

export async function sendWalletCreditedEmail(params: {
  to: string;
  customerName: string;
  amount: number;
  reason: string;
  newBalance: number;
  creditedAt: string;
}): Promise<void> {
  const fromEmail = process.env.RESEND_FROM_EMAIL || "Stitch 6K <noreply@the6k.com>";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://the6k.com";

  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #f0f0f0; border-radius: 8px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; width: 40px; height: 40px; background-color: #000; color: #fff; text-align: center; line-height: 40px; font-weight: bold; font-size: 18px;">6K</div>
      </div>
      
      <h1 style="color: #16a34a; font-size: 22px; text-align: center; margin-bottom: 24px;">
        Wallet Credited ✓
      </h1>
      
      <p>Hi ${params.customerName},</p>
      <p>Great news! Your store wallet has been credited.</p>
      
      <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 20px; text-align: center; border-radius: 6px; margin: 24px 0;">
        <span style="color: #6b7280; font-size: 12px; text-transform: uppercase; font-weight: bold; letter-spacing: 0.05em;">Amount Credited</span>
        <h2 style="color: #16a34a; font-size: 32px; margin: 8px 0 0 0; font-weight: 900;">
          ₹${params.amount.toLocaleString("en-IN")}.00
        </h2>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 14px;">
        <tbody>
          <tr style="border-bottom: 1px solid #f5f5f5;">
            <td style="padding: 12px 0; color: #6b7280;">Reason</td>
            <td style="padding: 12px 0; text-align: right; font-weight: bold;">${params.reason}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f5f5f5;">
            <td style="padding: 12px 0; color: #6b7280;">New Wallet Balance</td>
            <td style="padding: 12px 0; text-align: right; font-weight: bold; color: #16a34a;">₹${params.newBalance.toLocaleString("en-IN")}.00</td>
          </tr>
        </tbody>
      </table>
      
      <p style="color: #4b5563; font-size: 14px; line-height: 1.5; margin-bottom: 24px;">
        Use your wallet balance at checkout for instant savings on your next order.
      </p>
      
      <div style="text-align: center; margin-bottom: 32px;">
        <a href="${siteUrl}" style="background-color: #000; color: #fff; padding: 14px 28px; text-decoration: none; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.1em; display: inline-block;">
          Shop Now
        </a>
      </div>
      
      <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;">
      
      <p style="color: #9ca3af; font-size: 12px; text-align: center; line-height: 1.5;">
        — 6K Brand | JRT TEXTILES<br>
        Tiruchirappalli, Tamil Nadu<br>
        ${supportEmail} | +91 93636 93004
      </p>
    </div>
  `;

  try {
    await resend.emails.send({
      from: fromEmail,
      to: params.to,
      subject: `₹${params.amount} credited to your 6K wallet`,
      html: htmlContent,
    });
  } catch (err: any) {
    console.error(`[Email Error] Failed to deliver wallet credit email to ${params.to} via Resend. Error:`, err.message || err);
  }
}

export async function sendOrderDeliveredEmail(params: {
  to: string;
  customerName: string;
  orderId: string;
  items: Array<{ name: string; quantity: number }>;
  total: number;
  deliveredAt: string;
  returnDeadline: string;
}): Promise<void> {
  const fromEmail = process.env.RESEND_FROM_EMAIL || "Stitch 6K <noreply@the6k.com>";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://the6k.com";

  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #BA7517; font-size: 24px;">
        Your order has arrived!
      </h1>
      <p>Hi ${params.customerName},</p>
      <p>Your order has been successfully delivered.</p>
      
      <h2 style="font-size: 16px; border-bottom: 1px solid #e5e5e5; padding-bottom: 8px;">
        Order #${params.orderId} Summary
      </h2>
      
      ${params.items
        .map(
          (item) => `
        <div style="padding: 12px 0; border-bottom: 1px solid #f5f5f5;">
          <strong>${item.name}</strong><br>
          <span style="color: #6b7280; font-size: 14px;">
            Quantity: ${item.quantity}
          </span>
        </div>
      `
        )
        .join("")}
      
      <div style="padding: 16px 0; font-size: 18px; font-weight: bold; border-bottom: 1px solid #e5e5e5; margin-bottom: 16px;">
        Total: ₹${params.total.toLocaleString("en-IN")}.00
      </div>

      <p style="margin-bottom: 12px;">
        <strong>Delivered on:</strong> ${params.deliveredAt}
      </p>
      
      <p style="margin-bottom: 24px;">
        Love it? You have until <strong>${params.returnDeadline}</strong> to request a return if needed.
      </p>

      <div style="margin-bottom: 30px;">
        <a href="${siteUrl}/orderhistory" style="background-color: #BA7517; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
          View Order
        </a>
      </div>
      
      <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;">
      
      <p style="color: #9ca3af; font-size: 12px;">
        — 6K Brand | JRT TEXTILES<br>
        Tiruchirappalli, Tamil Nadu<br>
        ${supportEmail} | +91 93636 93004
      </p>
    </div>
  `;

  try {
    await resend.emails.send({
      from: fromEmail,
      to: params.to,
      subject: `Your 6K order #${params.orderId} has been delivered!`,
      html: htmlContent,
    });
  } catch (err: any) {
    console.error(`[sendOrderDeliveredEmail] Failed to deliver to ${params.to}:`, err.message || err);
  }
}

export async function sendReturnDeclinedEmail(order: {
  id: string;
  customerName: string;
  customerEmail: string;
  reason: string;
}): Promise<void> {
  const fromEmail = process.env.RESEND_FROM_EMAIL || "Stitch 6K <noreply@the6k.com>";

  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #ef4444; font-size: 24px;">
        Return Request Declined
      </h1>
      <p>Hi ${order.customerName},</p>
      <p>Your return request for Order <strong>#${order.id}</strong> has been declined.</p>
      
      <h2 style="font-size: 16px; border-bottom: 1px solid #e5e5e5; padding-bottom: 8px;">
        Rejection Reason
      </h2>
      <p style="background: #fef2f2; border: 1px solid #fecaca; padding: 16px; font-style: italic; color: #991b1b; margin-top: 16px;">
        "${order.reason}"
      </p>
      
      <p style="margin-top: 24px;">
        Your item remains with you. Contact us if you have questions.
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
      subject: "Your return request has been declined",
      html: htmlContent,
    });
  } catch (err: any) {
    console.error(`[sendReturnDeclinedEmail] Failed to deliver to ${order.customerEmail}:`, err.message || err);
  }
}

export async function sendReturnQcFailedEmail(order: {
  id: string;
  customerName: string;
  customerEmail: string;
  reason: string;
}): Promise<void> {
  const fromEmail = process.env.RESEND_FROM_EMAIL || "Stitch 6K <noreply@the6k.com>";

  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #ef4444; font-size: 24px;">
        Return Inspection Result
      </h1>
      <p>Hi ${order.customerName},</p>
      <p>Your return item for Order <strong>#${order.id}</strong> has been inspected by our warehouse quality check team.</p>
      
      <h2 style="font-size: 16px; border-bottom: 1px solid #e5e5e5; padding-bottom: 8px;">
        Inspection Result
      </h2>
      <p style="background: #fef2f2; border: 1px solid #fecaca; padding: 16px; font-style: italic; color: #991b1b; margin-top: 16px;">
        Item was inspected and could not be accepted for return. Reason: ${order.reason}
      </p>
      
      <p style="margin-top: 24px;">
        Please contact us to arrange reshipping.
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
      subject: "Return inspection result",
      html: htmlContent,
    });
  } catch (err: any) {
    console.error(`[sendReturnQcFailedEmail] Failed to deliver to ${order.customerEmail}:`, err.message || err);
  }
}

export async function sendReturnPickupAssignedEmail(order: {
  id: string;
  customerName: string;
  customerEmail: string;
  awb: string;
}): Promise<void> {
  const fromEmail = process.env.RESEND_FROM_EMAIL || "Stitch 6K <noreply@the6k.com>";

  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #BA7517; font-size: 24px;">
        Return Pickup Scheduled
      </h1>
      <p>Hi ${order.customerName},</p>
      <p>Return pickup scheduled — courier arrives in 2-3 business days. No label needed.</p>
      <p><strong>AWB:</strong> ${order.awb}</p>
      
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
      subject: `Return Pickup Scheduled — #${order.id}`,
      html: htmlContent,
    });
  } catch (err: any) {
    console.error(`[sendReturnPickupAssignedEmail] Failed to deliver to ${order.customerEmail}:`, err.message || err);
  }
}

export async function sendQcFailedEmail(params: {
  to: string;
  customerName: string;
  orderId: string;
  reason: string;
  refundOption: string;
}): Promise<void> {
  const fromEmail = process.env.RESEND_FROM_EMAIL || "Stitch 6K <noreply@the6k.com>";
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "6kthebrand@gmail.com";

  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #f0f0f0;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #BA7517; font-size: 26px; margin: 0; font-weight: 900; letter-spacing: 0.1em; text-transform: uppercase;">
          STITCH 6K
        </h1>
        <p style="color: #6b7280; font-size: 11px; tracking-widest; text-transform: uppercase; margin: 4px 0 0 0;">
          Atelier / Workshop Series
        </p>
      </div>

      <h2 style="color: #dc2626; font-size: 20px; margin-top: 0; font-weight: bold; border-bottom: 1px solid #e5e5e5; padding-bottom: 8px;">
        Return Inspection Update
      </h2>
      
      <p style="font-size: 14px; color: #1f2937; line-height: 1.6;">Hi ${params.customerName},</p>
      <p style="font-size: 14px; color: #4b5563; line-height: 1.6;">We've inspected your returned item for order <strong>#${params.orderId}</strong>.</p>
      
      <div style="background: #fef2f2; border: 1px solid #fca5a5; padding: 16px; margin: 24px 0; border-radius: 4px; color: #991b1b;">
        <p style="margin: 0; font-size: 14px; line-height: 1.6;">
          <strong>Inspection Status: QC Failed</strong><br>
          Unfortunately, we were unable to accept this return due to: <strong>${params.reason}</strong>
        </p>
      </div>

      <p style="font-size: 14px; color: #4b5563; line-height: 1.6;">
        Your item will be reshipped to your original delivery address within 3-5 business days.
      </p>

      <p style="font-size: 13px; color: #6b7280; line-height: 1.6; margin-top: 24px;">
        If you have questions, please contact us at <a href="mailto:${supportEmail}" style="color: #BA7517; text-decoration: none;">${supportEmail}</a>.
      </p>

      <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 24px 0;">
      
      <p style="color: #9ca3af; font-size: 12px; line-height: 1.6;">
        — 6K Brand | JRT TEXTILES<br>
        Tiruchirappalli, Tamil Nadu<br>
        ${supportEmail} | +91 93636 93004
      </p>
    </div>
  `;

  try {
    await resend.emails.send({
      from: fromEmail,
      to: params.to,
      subject: `Return inspection update — Order #${params.orderId}`,
      html: htmlContent,
    });
  } catch (err: any) {
    console.error(`[sendQcFailedEmail] Failed to deliver to ${params.to}:`, err.message || err);
  }
}



