import React from "react";
import type { Metadata } from "next";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Terms & Conditions | 6K",
  description: "The terms and conditions governing purchases and use of the 6K store.",
  openGraph: {
    title: "Terms & Conditions | 6K",
    description: "The terms and conditions governing purchases and use of the 6K store.",
    images: [{ url: "/og-default.jpg" }],
  },
};

export default function TermsPage() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-24 flex-grow w-full">
      <span className="text-[10px] font-black uppercase tracking-[0.4em] text-secondary">LEGAL AGREEMENTS</span>
      <h1 className="font-headline text-5xl font-black uppercase tracking-tighter text-on-surface mt-4 mb-12">
        Terms of Service
      </h1>
      <div className="space-y-8 text-sm text-outline leading-relaxed uppercase tracking-wider font-semibold">
        <section className="bg-surface-container-low p-8 border border-outline-variant/10">
          <h3 className="text-on-surface font-black text-lg mb-4">1. Product Quality &amp; Manufacturing</h3>
          <p>
            6K Brand offers high-end apparel manufactured at our operations in Tiruchirappalli. Sizing charts are provided as guide references, and minor weaving or dye variations are a natural signature characteristic of organic cotton and linen fabrics.
          </p>
        </section>

        <section className="p-8 border border-[#e8d08a] bg-[#faf5e8]">
          <h3 className="text-[#7a5c00] font-black text-lg mb-4">2. Payment Policy &amp; No Cash on Delivery (COD)</h3>
          <p className="text-[#7a5c00]">
            We currently accept UPI, Credit Cards, Debit Cards, Net Banking, and Wallets. Cash on Delivery (COD) is not available. All transactions must be completed securely online during checkout before orders are confirmed, processed, and shipped.
          </p>
        </section>

        <section className="bg-surface-container-low p-8 border border-outline-variant/10">
          <h3 className="text-on-surface font-black text-lg mb-4">3. User Conduct &amp; Ordering</h3>
          <p>
            By using this website, you agree to provide accurate checkout coordinates, make honest transaction disclosures, and respect intellectual property rights. We reserve the right to cancel suspicious or high-risk orders.
          </p>
        </section>

        <section className="bg-surface-container-low p-8 border border-outline-variant/10">
          <h3 className="text-on-surface font-black text-lg mb-4">4. Governing Law &amp; Jurisdiction</h3>
          <p>
            These Terms of Service shall be governed by and construed in accordance with the laws of India. Any disputes arising out of or in connection with these terms shall be subject to the exclusive jurisdiction of the competent courts in Tamil Nadu, India.
          </p>
        </section>
      </div>
    </main>
  );
}
