import React from "react";
import type { Metadata } from "next";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Contact Us | 6K",
  description: "Reach the 6K atelier concierge — email, phone and workshop location in Tiruchirappalli, Tamil Nadu.",
};

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
            Email: {process.env.NEXT_PUBLIC_SUPPORT_EMAIL}
            <br />
            Phone: +91 93636 93004 (Mon–Sat 10AM–7PM IST)
          </p>
        </section>
        <section className="bg-surface-container-low p-8 border border-outline-variant/10">
          <h3 className="text-on-surface font-black text-lg mb-4">Workshop Location</h3>
          <p>
            JRT TEXTILES (6K Brand)
            <br />
            1st Floor, 66/D, 1st Cross, Devar Colony, Thillai Nagar
            <br />
            Tiruchirappalli – 620018, Tamil Nadu
          </p>
        </section>
      </div>
    </main>
  );
}
