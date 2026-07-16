import React from "react";
import type { Metadata } from "next";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Refund Policy | 6K",
  description: "Refund processing timelines and methods at 6K.",
  openGraph: {
    title: "Refund Policy | 6K",
    description: "Refund processing timelines and methods at 6K.",
    images: [{ url: "/og-default.jpg" }],
  },
};

export default function RefundPolicyPage() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-24 flex-grow w-full">
      <span className="text-[10px] font-black uppercase tracking-[0.4em] text-secondary">REFUND MATRIX</span>
      <h1 className="font-headline text-5xl font-black uppercase tracking-tighter text-on-surface mt-4 mb-12">
        Refund &amp; Cancellation Policy
      </h1>
      <div className="space-y-8 text-sm text-outline leading-relaxed uppercase tracking-wider font-semibold">
        <section className="bg-surface-container-low p-8 border border-outline-variant/10">
          <h3 className="text-on-surface font-black text-lg mb-4">1. Order Cancellation</h3>
          <p>
            Customers can request to cancel their order at any time <strong>before dispatch only</strong>. Once the package has been processed and shipped (handover to our logistics provider), cancellations cannot be accepted.
          </p>
        </section>

        <section className="bg-surface-container-low p-8 border border-outline-variant/10">
          <h3 className="text-on-surface font-black text-lg mb-4">2. Refund Eligibility</h3>
          <p>
            Refunds are approved only in the following eligible cases:
            <br />- Wrong product delivered.
            <br />- Product arrived in a damaged condition.
            <br />- Manufacturing defects verified by our quality team.
            <br />- Package is lost in transit.
            <br />- Successful order cancellation request completed before dispatch.
            <br />
            <br />
            Refunds are <strong>NOT eligible</strong> in the following cases:
            <br />- Change of mind or custom color preferences.
            <br />- Wrong size ordered (eligible for one free size exchange instead).
            <br />- Products that show signs of usage, washing, or damage after delivery.
            <br />- Items returned without original packaging or attached tags.
            <br />- Tailor-made or customized apparel.
          </p>
        </section>

        <section className="bg-surface-container-low p-8 border border-outline-variant/10">
          <h3 className="text-on-surface font-black text-lg mb-4">3. Refund Processing Timeline</h3>
          <p>
            Once a cancellation is confirmed or a returned item is checked at our facility, refunds are processed according to the timeline below:
            <br />- Verification &amp; Approval: <strong>24–72 Hours</strong>
            <br />- Gateway Processing: <strong>3–5 Business Days</strong>
            <br />- Bank Settlement: <strong>5–10 Business Days</strong>
            <br />- Total Duration: <strong>7–14 Business Days</strong>
          </p>
        </section>
      </div>
    </main>
  );
}
