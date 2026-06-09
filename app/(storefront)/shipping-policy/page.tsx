"use client";

import React from "react";

export default function ShippingPolicyPage() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-24 flex-grow w-full">
      <span className="text-[10px] font-black uppercase tracking-[0.4em] text-secondary">ATELIER GUIDANCE</span>
      <h1 className="font-headline text-5xl font-black uppercase tracking-tighter text-on-surface mt-4 mb-12">
        Global Shipping Policy
      </h1>
      <div className="space-y-8 text-sm text-outline leading-relaxed uppercase tracking-wider font-semibold">
        <section className="bg-surface-container-low p-8 border border-outline-variant/10">
          <h3 className="text-on-surface font-black text-lg mb-4">1. Dispatch Timeline</h3>
          <p>
            Each shirt is handcrafted in South India Textils District. Handloom products undergo strict quality checks before packing. Please allow 24-48 hours for dispatch confirmation via SMS and WhatsApp dispatches.
          </p>
        </section>
        <section className="bg-surface-container-low p-8 border border-outline-variant/10">
          <h3 className="text-on-surface font-black text-lg mb-4">2. Courier Partners</h3>
          <p>
            We integrate with Shiprocket Premium Logistics. Insured express delivery is standard for all domestic shipments across India. Deliveries usually arrive within 3-5 business days.
          </p>
        </section>
        <section className="bg-surface-container-low p-8 border border-outline-variant/10">
          <h3 className="text-on-surface font-black text-lg mb-4">3. Rates & Customs</h3>
          <p>
            Shipping is free across India. International dispatches are subject to destination customs tariffs and extra carrier charges shown at the time of final gateway transaction.
          </p>
        </section>
      </div>
    </main>
  );
}
