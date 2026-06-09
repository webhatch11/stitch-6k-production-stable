"use client";

import React from "react";

export default function TermsPage() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-24 flex-grow w-full">
      <span className="text-[10px] font-black uppercase tracking-[0.4em] text-secondary">LEGAL AGREEMENTS</span>
      <h1 className="font-headline text-5xl font-black uppercase tracking-tighter text-on-surface mt-4 mb-12">
        Terms of Service
      </h1>
      <div className="space-y-8 text-sm text-outline leading-relaxed uppercase tracking-wider font-semibold">
        <section className="bg-surface-container-low p-8 border border-outline-variant/10">
          <h3 className="text-on-surface font-black text-lg mb-4">1. Atelier Manufacture</h3>
          <p>
            Stitch 6K Heritage offers high-end handloomed custom products manufactured inside our Tiruppur textile facilities. Minor weaving variations are a signature hallmark of natural cotton and linen fibers.
          </p>
        </section>
        <section className="bg-surface-container-low p-8 border border-outline-variant/10">
          <h3 className="text-on-surface font-black text-lg mb-4">2. Interactive Systems</h3>
          <p>
            By accessing the store, you agree to follow proper transaction flows, verify discount parameters honestly, and acknowledge local wallet/points databases.
          </p>
        </section>
      </div>
    </main>
  );
}
