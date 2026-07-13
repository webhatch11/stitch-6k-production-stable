import React from "react";
import type { Metadata } from "next";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Privacy Policy | Stitch 6K",
  description: "How Stitch 6K collects, uses and protects your personal data across orders, payments and delivery.",
  openGraph: {
    title: "Privacy Policy | Stitch 6K",
    description: "How Stitch 6K collects, uses and protects your personal data across orders, payments and delivery.",
    images: [{ url: "/og-default.jpg" }],
  },
};

export default function PrivacyPage() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-24 flex-grow w-full">
      <span className="text-[10px] font-black uppercase tracking-[0.4em] text-secondary">DATA SAFEGUARDS</span>
      <h1 className="font-headline text-5xl font-black uppercase tracking-tighter text-on-surface mt-4 mb-12">
        Privacy Policy
      </h1>
      <div className="space-y-8 text-sm text-outline leading-relaxed uppercase tracking-wider font-semibold">
        <section className="bg-surface-container-low p-8 border border-outline-variant/10">
          <h3 className="text-on-surface font-black text-lg mb-4">1. Information We Collect</h3>
          <p>
            To provide a seamless shopping experience, we collect information when you place an order, create an account, or interact with our website. This includes:
            <br />- Personal Identification: Name, Email Address, and Mobile Number.
            <br />- Address Coordinates: Billing Address and Shipping Address.
            <br />- Transaction Details: Payment Information and Order History.
            <br />- Technical Diagnostics: Device Info, Browser Info, and IP Address.
          </p>
        </section>

        <section className="bg-surface-container-low p-8 border border-outline-variant/10">
          <h3 className="text-on-surface font-black text-lg mb-4">2. Third-Party Integrations</h3>
          <p>
            We share relevant details with third-party service providers solely to fulfill orders and optimize operations. These include:
            <br />- Payment Gateway: <strong>Razorpay</strong> (for secure transaction processing).
            <br />- Logistics Provider: <strong>Shiprocket</strong> (for order packaging and delivery coordinates).
            <br />- Operations: Analytics Providers (for traffic metrics) and Cloud Hosting Providers (for server data safety).
          </p>
        </section>

        <section className="bg-surface-container-low p-8 border border-outline-variant/10">
          <h3 className="text-on-surface font-black text-lg mb-4">3. Data Security</h3>
          <p>
            All connection exchanges on our checkout pages are secured using Secure Socket Layer (SSL) encryption technology. Financial or payment token details are encrypted and transmitted directly to Razorpay's secure servers; no payment credentials or card details are recorded or stored in our local database.
          </p>
        </section>

        <section className="bg-surface-container-low p-8 border border-outline-variant/10">
          <h3 className="text-on-surface font-black text-lg mb-4">4. Contact Coordinates</h3>
          <p>
            If you have questions regarding this policy or want to update your stored data, contact us at:
            <br />Email: {process.env.NEXT_PUBLIC_SUPPORT_EMAIL}
            <br />Phone: +91 93636 93004
            <br />Address: JRT TEXTILES (6K Brand), 1st Floor, 66/D, 1st Cross, Devar Colony, Thillai Nagar, Tiruchirappalli – 620018, Tamil Nadu
          </p>
        </section>
      </div>
    </main>
  );
}
