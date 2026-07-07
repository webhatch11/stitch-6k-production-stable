import React from "react";
import type { Metadata } from "next";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Payment Policy | Stitch 6K",
  description: "Accepted payment methods at Stitch 6K — secure prepaid payments via Razorpay. Cash on Delivery is currently unavailable.",
  openGraph: {
    title: "Payment Policy | Stitch 6K",
    description: "Accepted payment methods at Stitch 6K — secure prepaid payments via Razorpay.",
    images: [{ url: "/og-default.jpg" }],
  },
};

export default function PaymentPolicyPage() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-24 flex-grow w-full">
      <span className="text-[10px] font-black uppercase tracking-[0.4em] text-secondary">PAYMENT SEGREGATION</span>
      <h1 className="font-headline text-5xl font-black uppercase tracking-tighter text-on-surface mt-4 mb-12">
        Payment Policy
      </h1>
      <div className="space-y-8 text-sm text-outline leading-relaxed uppercase tracking-wider font-semibold">
        <section className="bg-surface-container-low p-8 border border-outline-variant/10">
          <h3 className="text-on-surface font-black text-lg mb-4">1. Accepted Payment Methods</h3>
          <p>
            We accept a wide range of secure online payment options to ensure a smooth checkout experience. These include:
            <br />- UPI (Google Pay, PhonePe, Paytm, BHIM, etc.)
            <br />- Credit Cards &amp; Debit Cards (Visa, Mastercard, RuPay, American Express)
            <br />- Net Banking (All major Indian banks)
            <br />- Digital Wallets (Paytm, Mobikwik, PhonePe, etc.)
            <br />
            <br />
            All online payments are securely processed through our authorized gateway partner, <strong>Razorpay</strong>.
          </p>
        </section>

        <section className="p-8 border border-[#e8d08a] bg-[#faf5e8]">
          <h3 className="text-[#7a5c00] font-black text-lg mb-4">2. Cash on Delivery (COD)</h3>
          <p className="text-[#7a5c00]">
            Cash on Delivery (COD) is currently <strong>NOT available</strong>. All orders must be fully prepaid using our secure online payment gateway during checkout before they can be processed, packaged, and shipped.
          </p>
        </section>

        <section className="bg-surface-container-low p-8 border border-outline-variant/10">
          <h3 className="text-on-surface font-black text-lg mb-4">3. Payment Security &amp; Encryption</h3>
          <p>
            Your payment security is our top priority. All transactions are encrypted using industry-standard Secure Socket Layer (SSL) technology. 6K Brand does not store, record, or have access to any card numbers, CVVs, or bank account credentials on our servers.
          </p>
        </section>

        <section className="bg-surface-container-low p-8 border border-outline-variant/10">
          <h3 className="text-on-surface font-black text-lg mb-4">4. Order Confirmation</h3>
          <p>
            Upon successful transaction authorization, an immediate payment and order confirmation will be dispatched to your registered Email, SMS, and WhatsApp coordinates.
          </p>
        </section>

        <section className="bg-surface-container-low p-8 border border-outline-variant/10">
          <h3 className="text-on-surface font-black text-lg mb-4">5. Failed Transactions &amp; Refunds</h3>
          <p>
            In the event that funds are debited from your account but the order is not placed (failed transaction), the amount is automatically returned by the payment gateway. The refund will be settled back to your original payment source within <strong>5–10 business days</strong>.
          </p>
        </section>

        <section className="bg-surface-container-low p-8 border border-outline-variant/10">
          <h3 className="text-on-surface font-black text-lg mb-4">6. Fraud Prevention</h3>
          <p>
            To prevent unauthorized transactions, our payment systems actively monitor and flag suspicious payments. We reserve the right to put orders on hold and request standard verification details for any flagged or high-risk transactions.
          </p>
        </section>
      </div>
    </main>
  );
}
