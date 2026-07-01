"use client";

import React from "react";

export default function ReturnPolicyPage() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-24 flex-grow w-full">
      <span className="text-[10px] font-black uppercase tracking-[0.4em] text-secondary">ATELIER GUIDANCE</span>
      <h1 className="font-headline text-5xl font-black uppercase tracking-tighter text-on-surface mt-4 mb-12">
        Returns &amp; Refund Policy
      </h1>
      <div className="space-y-8 text-sm text-outline leading-relaxed uppercase tracking-wider font-semibold">
        <section className="bg-surface-container-low p-8 border border-outline-variant/10">
          <h3 className="text-on-surface font-black text-lg mb-4">1. Eligibility Threshold</h3>
          <p>
            We offer a strict 7-day return policy starting from the date of package delivery. Product tags must remain attached, and items must be clean and unworn.
          </p>
        </section>
        <section className="bg-surface-container-low p-8 border border-outline-variant/10">
          <h3 className="text-on-surface font-black text-lg mb-4">2. Return Registration</h3>
          <p>
            Clients can request returns directly from their Order History interface by uploading a photo of the unworn product. Once registered, Shiprocket reverse logistics will coordinate pickup.
          </p>
        </section>
        <section className="bg-surface-container-low p-8 border border-outline-variant/10">
          <h3 className="text-on-surface font-black text-lg mb-4">3. Refund Processing</h3>
          <p>
            Upon arrival at the workshop and passing quality inspections:
            <br />- Refund to Store Wallet is processed instantly.
            <br />- Refund to Bank Account: Approval 24-72hrs, Processing 3-5 business days, Bank settlement 5-10 business days (Total ~7-14 business days).
          </p>
        </section>
      </div>
    </main>
  );
}
