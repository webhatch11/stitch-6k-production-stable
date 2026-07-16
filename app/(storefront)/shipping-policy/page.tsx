import React from "react";
import type { Metadata } from "next";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Shipping & Delivery Policy | 6K",
  description: "Shipping timelines, coverage and delivery details for 6K prepaid orders across India.",
  openGraph: {
    title: "Shipping & Delivery Policy | 6K",
    description: "Shipping timelines, coverage and delivery details for 6K prepaid orders across India.",
    images: [{ url: "/og-default.jpg" }],
  },
};

export default function ShippingPolicyPage() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-24 flex-grow w-full">
      <span className="text-[10px] font-black uppercase tracking-[0.4em] text-secondary">ATELIER GUIDANCE</span>
      <h1 className="font-headline text-5xl font-black uppercase tracking-tighter text-on-surface mt-4 mb-12">
        Shipping &amp; Delivery Policy
      </h1>
      <div className="space-y-8 text-sm text-outline leading-relaxed uppercase tracking-wider font-semibold">
        <section className="bg-surface-container-low p-8 border border-outline-variant/10">
          <h3 className="text-on-surface font-black text-lg mb-4">1. Order Processing</h3>
          <p>
            All orders are processed within 2–3 business days after successful payment confirmation. Monday to Saturday only.
          </p>
        </section>
        <section className="p-8 border border-[#e8d08a] bg-[#faf5e8]">
          <h3 className="text-[#7a5c00] font-black text-lg mb-4">2. Prepaid Orders Only</h3>
          <p className="text-[#7a5c00]">
            6K Brand currently accepts Prepaid Orders only. Cash on Delivery (COD) is NOT available. Customers are requested to complete payment online during checkout before their orders are processed and shipped.
          </p>
        </section>
        <section className="bg-surface-container-low p-8 border border-outline-variant/10">
          <h3 className="text-on-surface font-black text-lg mb-4">3. Delivery Timelines</h3>
          <p>
            Orders are shipped via trusted courier partners powered by Shiprocket. Deliveries usually take 3–7 business days depending on delivery location.
          </p>
        </section>
        <section className="bg-surface-container-low p-8 border border-outline-variant/10">
          <h3 className="text-on-surface font-black text-lg mb-4">4. Order Tracking</h3>
          <p>
            Real-time tracking updates will be shared via Email, SMS, and WhatsApp as soon as the package is handed over to our shipping provider.
          </p>
        </section>
        <section className="bg-surface-container-low p-8 border border-outline-variant/10">
          <h3 className="text-on-surface font-black text-lg mb-4">5. Contact Support</h3>
          <p>
            For any queries regarding shipping or delivery timelines, contact us at:
            <br />Email: {process.env.NEXT_PUBLIC_SUPPORT_EMAIL}
            <br />Phone: +91 93636 93004
          </p>
        </section>
      </div>
    </main>
  );
}
