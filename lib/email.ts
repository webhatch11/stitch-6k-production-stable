/**
 * Email Subsystem Interface (Decoupled No-Op Implementation)
 *
 * All functions return cleanly without executing network calls or background jobs.
 * Preserves all function signatures across the codebase for easy re-activation later.
 */

export const transporter = {
  sendMail: async () => Promise.resolve({ messageId: "noop-disabled" }),
};

export const FROM_EMAIL = `"6K Designer Shirts" <noreply@the6k.com>`;
export const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "6kthebrand@gmail.com";

export async function sendOrderConfirmationEmail(_order: any): Promise<void> {
  return Promise.resolve();
}

export async function sendReturnAcceptedEmail(_order: any): Promise<void> {
  return Promise.resolve();
}

export async function sendReturnRejectedEmail(_order: any): Promise<void> {
  return Promise.resolve();
}

export async function sendShippingNotification(_order: any): Promise<void> {
  return Promise.resolve();
}

export async function sendAdminAlert(_params: any): Promise<void> {
  return Promise.resolve();
}

export async function sendWelcomeEmail(_user: any): Promise<void> {
  return Promise.resolve();
}

export async function sendPasswordResetEmail(_params: any): Promise<void> {
  return Promise.resolve();
}

export async function sendWalletCreditedEmail(..._args: any[]): Promise<void> {
  return Promise.resolve();
}

export async function sendOrderCancelledEmail(..._args: any[]): Promise<void> {
  return Promise.resolve();
}

export async function sendOrderCancelledByAdminEmail(..._args: any[]): Promise<void> {
  return Promise.resolve();
}

export async function sendReturnPickupScheduledEmail(..._args: any[]): Promise<void> {
  return Promise.resolve();
}

export async function sendReturnDeclinedEmail(..._args: any[]): Promise<void> {
  return Promise.resolve();
}

export async function sendReturnPickupAssignedEmail(..._args: any[]): Promise<void> {
  return Promise.resolve();
}

export async function sendQcFailedEmail(..._args: any[]): Promise<void> {
  return Promise.resolve();
}

export async function sendOrderDeliveredEmail(..._args: any[]): Promise<void> {
  return Promise.resolve();
}

export async function sendShippingConfirmationEmail(..._args: any[]): Promise<void> {
  return Promise.resolve();
}
