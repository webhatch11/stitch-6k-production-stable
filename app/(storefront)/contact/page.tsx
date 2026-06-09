"use client";

import React from "react";

export default function ContactPage() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-24 flex-grow w-full">
      <span className="text-[10px] font-black uppercase tracking-[0.4em] text-secondary">GET IN TOUCH</span>
      <h1 className="font-headline text-5xl font-black uppercase tracking-tighter text-on-surface mt-4 mb-12">
        Contact Concierge
      </h1>
      <div className="space-y-8 text-sm text-outline leading-relaxed uppercase tracking-wider font-semibold">
        <section className="bg-surface-container-low p-8 border border-outline-variant/10">
          <h3 className="text-on-surface font-black text-lg mb-4">Atelier Concierge</h3>
          <p>
            Email: support@stitch6k.com
            <br />
            Concierge Line: +91 6000 6000 (Available 24/7)
          </p>
        </section>
        <section className="bg-surface-container-low p-8 border border-outline-variant/10">
          <h3 className="text-on-surface font-black text-lg mb-4">Workshop Location</h3>
          <p>
            The Stitch 6K Workshop
            <br />
            Tiruppur Textile District
            <br />
            Tamil Nadu, India 641604
          </p>
        </section>
      </div>
    </main>
  );
}
