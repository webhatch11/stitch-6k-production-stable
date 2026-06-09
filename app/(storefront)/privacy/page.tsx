"use client";

import React from "react";

export default function PrivacyPage() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-24 flex-grow w-full">
      <span className="text-[10px] font-black uppercase tracking-[0.4em] text-secondary">DATA SAFEGUARDS</span>
      <h1 className="font-headline text-5xl font-black uppercase tracking-tighter text-on-surface mt-4 mb-12">
        Privacy Policy
      </h1>
      <div className="space-y-8 text-sm text-outline leading-relaxed uppercase tracking-wider font-semibold">
        <section className="bg-surface-container-low p-8 border border-outline-variant/10">
          <h3 className="text-on-surface font-black text-lg mb-4">1. Data Collected</h3>
          <p>
            We gather client details purely to execute transaction dispatches and process delivery locations. No details are shared with external entities beyond payment and shipping APIs (Razorpay, Shiprocket).
          </p>
        </section>
        <section className="bg-surface-container-low p-8 border border-outline-variant/10">
          <h3 className="text-on-surface font-black text-lg mb-4">2. Secure Payment Gateway</h3>
          <p>
            Credit credentials and billing histories are processed securely by Razorpay standard gateways. No payment tokens are recorded on our local database endpoints.
          </p>
        </section>
      </div>
    </main>
  );
}
