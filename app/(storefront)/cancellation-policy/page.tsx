import React from "react";
import type { Metadata } from "next";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Cancellation Policy | Stitch 6K",
  description: "Order cancellation windows and refund timelines at Stitch 6K.",
  openGraph: {
    title: "Cancellation Policy | Stitch 6K",
    description: "Order cancellation windows and refund timelines at Stitch 6K.",
    images: [{ url: "/og-default.jpg" }],
  },
};

export default function CancellationPolicyPage() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-24 flex-grow w-full">
      <span className="text-[10px] font-black uppercase tracking-[0.4em] text-secondary">ORDER CANCEL RULE</span>
      <h1 className="font-headline text-5xl font-black uppercase tracking-tighter text-on-surface mt-4 mb-12">
        Cancellation Policy
      </h1>
      <div className="space-y-8 text-sm text-outline leading-relaxed uppercase tracking-wider font-semibold">
        <section className="bg-surface-container-low p-8 border border-outline-variant/10">
          <h3 className="text-on-surface font-black text-lg mb-4">1. Cancellation Window</h3>
          <p>
            You can request to cancel your order at any time <strong>before dispatch only</strong>. Once the package has been handed over to our courier partners (powered by Shiprocket) and a tracking number is generated, the order cannot be cancelled.
          </p>
        </section>
        <section className="bg-surface-container-low p-8 border border-outline-variant/10">
          <h3 className="text-on-surface font-black text-lg mb-4">2. Refund Following Cancellation</h3>
          <p>
            If a cancellation request is submitted successfully before dispatch, the refund will be processed and returned to your original payment method (via Razorpay) within <strong>7–14 business days</strong> (Approval: 24–72 Hours, Bank Processing: 5–10 Business Days).
          </p>
        </section>
        <section className="bg-surface-container-low p-8 border border-outline-variant/10">
          <h3 className="text-on-surface font-black text-lg mb-4">3. Contact for Cancellations</h3>
          <p>
            To request a cancellation, please email us immediately with your order details at:
            <br />Email: 6kthebrand@gmail.com
            <br />Phone: +91 93636 93004
          </p>
        </section>
      </div>
    </main>
  );
}
