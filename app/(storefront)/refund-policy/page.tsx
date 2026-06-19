"use client";

import React from "react";

export default function RefundPolicyPage() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-24 flex-grow w-full">
      <span className="text-[10px] font-black uppercase tracking-[0.4em] text-secondary">REFUND MATRIX</span>
      <h1 className="font-headline text-5xl font-black uppercase tracking-tighter text-on-surface mt-4 mb-12">
        Refund Policy
      </h1>
      <div className="space-y-8 text-sm text-outline leading-relaxed uppercase tracking-wider font-semibold">
        <section className="bg-surface-container-low p-8 border border-outline-variant/10">
          <h3 className="text-on-surface font-black text-lg mb-4">1. Refund Eligibility</h3>
          <p>
            Stitch 6K accepts returns and refund requests on unworn, unwashed products with all tags attached within 7 days of delivery. Custom atelier exclusives are subject to verification before refunds are approved.
          </p>
        </section>
        <section className="bg-surface-container-low p-8 border border-outline-variant/10">
          <h3 className="text-on-surface font-black text-lg mb-4">2. Processing Time</h3>
          <p>
            Once our Quality Check team verifies the returned items at our facility, refunds are processed back to the original payment source within 5-7 business days. Alternatively, refunds can be immediately credited to your local wallet balance.
          </p>
        </section>
      </div>
    </main>
  );
}
