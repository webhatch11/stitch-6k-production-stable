"use client";

import React from "react";

export default function CancellationPolicyPage() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-24 flex-grow w-full">
      <span className="text-[10px] font-black uppercase tracking-[0.4em] text-secondary">ORDER CANCEL RULE</span>
      <h1 className="font-headline text-5xl font-black uppercase tracking-tighter text-on-surface mt-4 mb-12">
        Cancellation Policy
      </h1>
      <div className="space-y-8 text-sm text-outline leading-relaxed uppercase tracking-wider font-semibold">
        <section className="bg-surface-container-low p-8 border border-outline-variant/10">
          <h3 className="text-on-surface font-black text-lg mb-4">1. Order Cancellations</h3>
          <p>
            You can request to cancel your order within 6 hours of payment, or before the shipment is handed over to our courier partner (whichever happens first). Once a Shiprocket AWB number has been assigned and dispatch is active, cancellations are no longer permitted.
          </p>
        </section>
        <section className="bg-surface-container-low p-8 border border-outline-variant/10">
          <h3 className="text-on-surface font-black text-lg mb-4">2. Releasing Reservations</h3>
          <p>
            If you cancel an order that was paid using wallet credits or loyalty points, the balance will be refunded to your profile immediately. Unpaid order reservations are automatically cleared after 15 minutes of inactivity.
          </p>
        </section>
      </div>
    </main>
  );
}
