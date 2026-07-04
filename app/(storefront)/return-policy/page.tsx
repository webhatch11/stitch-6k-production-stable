import React from "react";
import type { Metadata } from "next";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Return & Exchange Policy | Stitch 6K",
  description: "How returns and exchanges work at Stitch 6K, including eligibility windows and refund options.",
};

export default function ReturnPolicyPage() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-24 flex-grow w-full">
      <span className="text-[10px] font-black uppercase tracking-[0.4em] text-secondary">ATELIER GUIDANCE</span>
      <h1 className="font-headline text-5xl font-black uppercase tracking-tighter text-on-surface mt-4 mb-12">
        Return &amp; Exchange Policy
      </h1>
      <div className="space-y-8 text-sm text-outline leading-relaxed uppercase tracking-wider font-semibold">
        <section className="bg-surface-container-low p-8 border border-outline-variant/10">
          <h3 className="text-on-surface font-black text-lg mb-4">1. Returns Eligibility</h3>
          <p>
            We offer a return policy for eligible products within <strong>7 days from delivery</strong>. To be eligible for a return, your item must meet the following criteria:
            <br />- The product must be unused, unwashed, and in the same condition as received.
            <br />- The product must be in its original packaging with all tags attached.
            <br />- A valid proof of purchase (order invoice or confirmation email) must be provided.
          </p>
        </section>

        <section className="bg-surface-container-low p-8 border border-outline-variant/10">
          <h3 className="text-on-surface font-black text-lg mb-4">2. Size Exchanges</h3>
          <p>
            We provide <strong>one free size exchange per order</strong>, subject to catalog stock availability. If the requested size is out of stock, we will issue a refund or store credit according to the standard refund timeline.
          </p>
        </section>

        <section className="bg-surface-container-low p-8 border border-outline-variant/10">
          <h3 className="text-on-surface font-black text-lg mb-4">3. Return Shipping Charges</h3>
          <p>
            - <strong>6K Brand Bears Cost</strong>: If you receive a wrong product, damaged item, or manufacturing defect. We will coordinate reverse pickup at no charge to you.
            <br />- <strong>Customer Bears Cost</strong>: For wrong size ordered or change-of-mind returns. The shipping charges will be deducted from your final refund amount, or you must arrange the return shipment to our workshop.
          </p>
        </section>

        <section className="bg-surface-container-low p-8 border border-outline-variant/10">
          <h3 className="text-on-surface font-black text-lg mb-4">4. Non-Returnable Items</h3>
          <p>
            The following items are strictly non-returnable and non-exchangeable:
            <br />- Used or washed products.
            <br />- Items returned without original tags, labels, or packaging.
            <br />- Customized or tailor-made apparel.
            <br />- Return requests submitted after the 7-day period.
          </p>
        </section>
      </div>
    </main>
  );
}
